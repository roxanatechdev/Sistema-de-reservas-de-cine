
const API_PELICULAS = 'http://127.0.0.1:8000/api/peliculas';

let todasLasPeliculas = [];
let semanaCartelera = null;
let filtroActual = 'todos';

const POSTER_PLACEHOLDER =
    'https://placehold.co/400x600/191b24/ffffff?text=Poster+No+Disponible';

// Iniciar cuando el documento esté preparado.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarCartelera);
} else {
    iniciarCartelera();
}

function iniciarCartelera() {
    configurarFiltros();
    cargarCartelera();
}

// Configurar los botones Todos, Estrenos y 3D.
function configurarFiltros() {
    const botones = document.querySelectorAll('.filter-btn');

    botones.forEach(boton => {
        // También reconoce los botones si todavía no tienen data-filter.
        const texto = boton.textContent.trim().toLowerCase();

        const filtrosPorTexto = {
            'todos': 'todos',
            'estrenos': 'estrenos',
            '3d': '3d'
        };

        const filtro = boton.dataset.filter || filtrosPorTexto[texto];

        if (!filtro || !['todos', 'estrenos', '3d'].includes(filtro)) {
            return;
        }

        boton.dataset.filter = filtro;

        boton.addEventListener('click', () => {
            filtroActual = filtro;

            botones.forEach(otroBoton => {
                const esSeleccionado = otroBoton === boton;

                otroBoton.classList.toggle('active', esSeleccionado);
                otroBoton.setAttribute(
                    'aria-pressed',
                    String(esSeleccionado)
                );
            });

            renderizarCartelera();
        });
    });
}

// Obtener películas desde Laravel.
async function cargarCartelera() {
    const contenedor = document.getElementById('cartelera-peliculas');

    if (!contenedor) {
        console.error(
            'No se encontró el elemento #cartelera-peliculas en index.html.'
        );
        return;
    }

    try {
        const respuesta = await fetch(API_PELICULAS, {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!respuesta.ok) {
            throw new Error(`Error HTTP ${respuesta.status}`);
        }

        const datos = await respuesta.json();

        // La API devuelve { semana: {...}, peliculas: [...] }.
        const peliculas = Array.isArray(datos)
            ? datos
            : datos?.peliculas;

        if (!Array.isArray(peliculas)) {
            throw new Error(
                'La respuesta de Laravel no contiene una lista válida de películas.'
            );
        }

        todasLasPeliculas = peliculas;
        semanaCartelera = datos?.semana || null;

        console.log(
            `Cartelera cargada: ${todasLasPeliculas.length} película(s).`
        );

        renderizarCartelera();

    } catch (error) {
        console.error('Error al cargar la cartelera:', error);

        mostrarMensaje(
            contenedor,
            'No pudimos cargar la cartelera. Comprueba que Laravel esté funcionando.',
            true
        );
    }
}

// Aplicar el filtro seleccionado y mostrar las tarjetas.
function renderizarCartelera() {
    const contenedor = document.getElementById('cartelera-peliculas');

    if (!contenedor) return;

    let peliculasFiltradas = [...todasLasPeliculas];

    if (filtroActual === 'estrenos') {
        const desde = semanaCartelera?.desde;
        const hasta = semanaCartelera?.hasta;

        peliculasFiltradas = todasLasPeliculas.filter(pelicula => {
            if (!pelicula.fecha_estreno || !desde || !hasta) {
                return false;
            }

            const fechaEstreno = String(pelicula.fecha_estreno).slice(0, 10);

            return fechaEstreno >= desde && fechaEstreno <= hasta;
        });

    } else if (filtroActual === '3d') {
        peliculasFiltradas = todasLasPeliculas.filter(pelicula => {
            const funciones = Array.isArray(pelicula.funciones)
                ? pelicula.funciones
                : [];

            return funciones.some(funcion =>
                String(funcion.formato || '').trim().toUpperCase() === '3D'
            );
        });
    }

    contenedor.replaceChildren();

    if (peliculasFiltradas.length === 0) {
        const mensajes = {
            todos: 'No hay películas disponibles en cartelera.',
            estrenos: 'No hay estrenos programados para esta semana.',
            '3d': 'No hay películas con funciones 3D disponibles esta semana.'
        };

        mostrarMensaje(
            contenedor,
            mensajes[filtroActual] || 'No hay películas para mostrar.'
        );

        return;
    }

    peliculasFiltradas.forEach(pelicula => {
        try {
            const tarjeta = crearTarjeta(pelicula);
            contenedor.appendChild(tarjeta);
        } catch (error) {
            console.error(
                `Error al crear la tarjeta de "${pelicula.titulo || 'Película'}":`,
                error
            );
        }
    });

    // Informar si hubo errores al crear todas las tarjetas.
    if (contenedor.children.length === 0) {
        mostrarMensaje(
            contenedor,
            'Recibimos las películas, pero no pudimos construir sus tarjetas.',
            true
        );
    }
}

// Crear tarjeta conservando las clases visuales originales.
function crearTarjeta(pelicula) {
    const columna = document.createElement('div');
    columna.className = 'col';

    const titulo = escaparHTML(
        pelicula.titulo || 'Película próximamente'
    );

    const poster = esUrlSegura(pelicula.imagen)
        ? pelicula.imagen
        : POSTER_PLACEHOLDER;

    const formato = escaparHTML(
        pelicula.formato || pelicula.funciones?.[0]?.formato || 'FORMATO N/D'
    );

    const rating = escaparHTML(pelicula.rating ?? '—');

    const duracion = escaparHTML(
        pelicula.duracion ||
        (pelicula.duracion_minutos
            ? `${Math.floor(pelicula.duracion_minutos / 60)}h ${pelicula.duracion_minutos % 60}m`
            : 'Duración N/D')
    );

    const genero = escaparHTML(
        pelicula.genero || 'Género por confirmar'
    );

    const funciones = Array.isArray(pelicula.funciones)
        ? pelicula.funciones
        : [];

    const trailerUrl = esUrlSegura(pelicula.trailer)
        ? pelicula.trailer
        : null;

    const funcionesSemanaHTML = funciones.length
        ? funciones.slice(0, 3).map(funcion => {
            const fechaHora = escaparHTML(formatearFuncion(funcion));
            const sala = escaparHTML(funcion.sala || 'Sala por confirmar');
            const formatoFuncion = escaparHTML(
                funcion.formato || 'Formato N/D'
            );
            const idFuncion = Number(funcion.id_funcion) || '';

            return `
                <button
                    class="btn btn-showtime flex-fill py-1 px-1 text-nowrap rounded-1"
                    type="button"
                    title="${sala} · ${formatoFuncion}"
                    data-funcion-id="${idFuncion}">
                    ${fechaHora}
                </button>
            `;
        }).join('')
        : '<span class="text-white-50 small">Sin funciones esta semana</span>';

    columna.innerHTML = `
        <div class="card movie-card h-100 bg-cm-surface rounded-3 overflow-hidden border border-white-5 transition-all">

            <div class="position-relative w-100 overflow-hidden bg-cm-surface-lowest movie-poster-container">
                <img
                    src="${escaparHTML(poster)}"
                    alt="Póster de ${titulo}"
                    class="w-100 h-100 object-fit-cover movie-poster-img"
                    onerror="this.onerror=null;this.src='${POSTER_PLACEHOLDER}';"
                />

                <div class="card-media-overlay"></div>

                <div class="position-absolute top-50 start-50 translate-middle z-3 trailer-hover-btn">
                    <button
                        type="button"
                        aria-label="Ver tráiler"
                        class="btn btn-trailer-play rounded-circle d-flex align-items-center justify-content-center"
                        ${trailerUrl ? '' : 'disabled title="Tráiler no disponible"'}>
                        <span class="material-symbols-outlined fs-2">play_arrow</span>
                    </button>
                </div>

                <div class="position-absolute top-0 start-0 end-0 p-2 d-flex align-items-center justify-content-between z-2">
                    <div class="d-flex align-items-center gap-1">
                        <span class="badge-tag">${formato}</span>
                    </div>

                    <button
                        type="button"
                        class="btn-favorite d-flex align-items-center justify-content-center"
                        aria-label="Agregar a favoritos">
                        <span class="material-symbols-outlined">favorite</span>
                    </button>
                </div>
            </div>

            <div class="card-body p-3 d-flex flex-column justify-content-between gap-1">
                <div>
                    <div class="d-flex justify-content-between">
                        <span class="badge badge-rating d-flex align-items-center gap-1 ps-0 mb-1">
                            <span class="material-symbols-outlined icon-filled text-cm-tertiary">star</span>
                            ${rating}
                        </span>

                        <span class="metadatos d-flex align-content-center gap-1 text-white-50">
                            <span class="material-symbols-outlined fs-6">schedule</span>${duracion}
                        </span>
                    </div>

                    <h3 class="movie-title text-uppercase mb-1 line-clamp-2" title="${titulo}">
                        ${titulo}
                    </h3>

                    <p class="movie-subtitle">${genero}</p>
                </div>

                <div class="d-flex flex-column gap-1">
                    <span class="showtime-label text-uppercase fw-bold py-1">
                        FUNCIONES ESTA SEMANA
                    </span>

                    <div class="d-flex gap-2">
                        ${funcionesSemanaHTML}
                    </div>
                </div>

                <button
                    class="btn btn-cm-reserve mt-1 w-100 text-uppercase rounded-2 py-1 fw-bold transition-all d-flex align-items-center justify-content-center gap-2"
                    type="button">
                    <span class="material-symbols-outlined fs-5">confirmation_number</span>
                    Comprar Entradas
                </button>
            </div>
        </div>
    `;

    const botonTrailer = columna.querySelector('.btn-trailer-play');

    if (trailerUrl && botonTrailer) {
        botonTrailer.addEventListener('click', () => {
            window.open(trailerUrl, '_blank', 'noopener,noreferrer');
        });
    }

    return columna;
}

// Formatear fecha y hora de cada función.
function formatearFuncion(funcion) {
    if (!funcion) return 'Hora N/D';

    if (!funcion.inicio) {
        return `${funcion.fecha || ''} ${funcion.hora || ''}`.trim() || 'Hora N/D';
    }

    const fecha = new Date(funcion.inicio);

    if (Number.isNaN(fecha.getTime())) {
        return `${funcion.fecha || ''} ${funcion.hora || ''}`.trim() || 'Hora N/D';
    }

    const dia = new Intl.DateTimeFormat('es-BO', {
        weekday: 'short',
        day: '2-digit',
        timeZone: 'UTC'
    }).format(fecha);

    const hora = funcion.hora ||
        new Intl.DateTimeFormat('es-BO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        }).format(fecha);

    return `${dia} ${hora}`;
}

// Aceptar únicamente URLs HTTP o HTTPS.
function esUrlSegura(valor) {
    if (typeof valor !== 'string' || !valor.trim()) {
        return false;
    }

    try {
        const url = new URL(valor);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

// Mostrar mensajes dentro del contenedor sin alterar el diseño general.
function mostrarMensaje(contenedor, mensaje, esError = false) {
    const columna = document.createElement('div');
    columna.className = 'col-12';

    const alerta = document.createElement('div');

    alerta.className = esError
        ? 'alert alert-warning'
        : 'text-center text-cm-variant py-5';

    alerta.setAttribute('role', esError ? 'alert' : 'status');
    alerta.textContent = mensaje;

    columna.appendChild(alerta);
    contenedor.replaceChildren(columna);
}

// Evitar que los datos de texto rompan el HTML de la tarjeta.
function escaparHTML(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
