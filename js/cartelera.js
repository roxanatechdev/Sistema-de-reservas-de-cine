const API_PELICULAS = 'http://127.0.0.1:8000/api/peliculas';

document.addEventListener('DOMContentLoaded', cargarCartelera);

async function cargarCartelera() {
    const contenedor = document.getElementById('cartelera-peliculas');

    if (!contenedor) {
        console.error('No se encontró el contenedor de la cartelera.');
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
        const peliculas = Array.isArray(datos) ? datos : datos.peliculas;

        if (!Array.isArray(peliculas)) {
            throw new Error('La API no devolvió una lista de películas.');
        }

        contenedor.replaceChildren();

        if (peliculas.length === 0) {
            mostrarMensaje(
                contenedor,
                'No hay películas disponibles en cartelera.'
            );
            return;
        }

        peliculas.forEach(pelicula => {
            contenedor.appendChild(crearTarjeta(pelicula));
        });

    } catch (error) {
        console.error('No se pudo cargar la cartelera:', error);

        mostrarMensaje(
            contenedor,
            'No pudimos cargar la cartelera. Comprueba que el servidor esté funcionando e inténtalo de nuevo.',
            true
        );
    }
}

function crearTarjeta(pelicula) {
    const columna = document.createElement('div');
    columna.className = 'col';

    // Placeholders y valores por defecto para datos faltantes
    const titulo = pelicula.titulo || 'Película próximamente';
    const poster = esUrlSegura(pelicula.imagen) ? pelicula.imagen : 'img/cyber-echo.jpg';
    const formato = pelicula.formato || 'FORMATO N/D';
    const rating = pelicula.rating ?? '—';
    const duracion = pelicula.duracion || (pelicula.duracion_minutos ? `${Math.floor(pelicula.duracion_minutos / 60)}h ${pelicula.duracion_minutos % 60}m` : 'Duración N/D');
    const genero = pelicula.genero || 'Género por confirmar';
    const funciones = Array.isArray(pelicula.funciones) ? pelicula.funciones : [];
    const trailerUrl = esUrlSegura(pelicula.trailer) ? pelicula.trailer : null;
    const funcionesSemanaHTML = funciones.length
        ? funciones.slice(0, 3).map(funcion => {
            const fechaHora = formatearFuncion(funcion);
            const sala = escaparHTML(funcion.sala || 'Sala por confirmar');
            const formatoFuncion = escaparHTML(funcion.formato || 'Formato N/D');
            const idFuncion = Number(funcion.id_funcion) || '';
            return `<button class="btn btn-showtime flex-fill py-1 px-1 text-nowrap rounded-1" type="button" title="${sala} · ${formatoFuncion}" data-funcion-id="${idFuncion}">${escaparHTML(fechaHora)}</button>`;
        }).join('')
        : '<span class="text-white-50 small">Sin funciones esta semana</span>';

    // Estructura HTML exacta respetando todas tus clases originales
    columna.innerHTML = `
        <div class="card movie-card h-100 bg-cm-surface rounded-3 overflow-hidden border border-white-5 transition-all">
            
            <!-- Poster con Badges, Favorito y Botón Tráiler -->
            <div class="position-relative w-100 overflow-hidden bg-cm-surface-lowest movie-poster-container">
                <!-- Imagen del póster -->
                <img src="${poster}" alt="${titulo} Poster"
                    class="w-100 h-100 object-fit-cover movie-poster-img"
                    onerror="this.onerror=null; this.src='https://via.placeholder.com/400x600/1d1f29/ffffff?text=Poster+No+Disponible';" />

                <!-- Overlay desvanecido progresivo -->
                <div class="card-media-overlay"></div>

                <!-- Botón flotante para Ver Tráiler (Hover) -->
                <div class="position-absolute top-50 start-50 translate-middle z-3 trailer-hover-btn">
                    <button type="button" aria-label="Ver Tráiler"
                        class="btn btn-trailer-play rounded-circle d-flex align-items-center justify-content-center"
                        ${trailerUrl ? '' : 'disabled title="Tráiler no disponible"'}>
                        <span class="material-symbols-outlined fs-2">play_arrow</span>
                    </button>
                </div>

                <!-- Header de Badges sobre la imagen (Formato + Rating + Favorito) -->
                <div class="position-absolute top-0 start-0 end-0 p-2 d-flex align-items-center justify-content-between z-2">
                    <!-- Badges Izquierda (Agrupadas en fila) -->
                    <div class="d-flex align-items-center gap-1">
                        <span class="badge-tag">${formato}</span>
                    </div>

                    <!-- Botón Favorito -->
                    <button type="button"
                        class="btn-favorite d-flex align-items-center justify-content-center"
                        aria-label="Agregar a favoritos">
                        <span class="material-symbols-outlined">favorite</span>
                    </button>
                </div>
            </div>

            <!-- Contenido de la Tarjeta -->
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
                    <!-- Título estilizado -->
                    <p class="movie-subtitle">
                        ${genero}
                    </p>
                </div>

                <!-- Horarios Disponibles -->
                <div class="d-flex flex-column gap-1">
                    <span class="showtime-label text-uppercase fw-bold py-1">
                        FUNCIONES ESTA SEMANA
                    </span>
                    <div class="d-flex gap-2">
                        ${funcionesSemanaHTML}
                    </div>
                </div>

                <!-- Botón Reservar -->
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
        botonTrailer.addEventListener('click', () => window.open(trailerUrl, '_blank', 'noopener,noreferrer'));
    }

    return columna;
}

function formatearFuncion(funcion) {
    if (!funcion || !funcion.inicio) return 'Hora N/D';
    const fecha = new Date(funcion.inicio);
    if (Number.isNaN(fecha.getTime())) {
        return `${funcion.fecha || ''} ${funcion.hora || ''}`.trim() || 'Hora N/D';
    }
    const dia = new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: '2-digit' }).format(fecha);
    const hora = funcion.hora || new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha);
    return `${dia} ${hora}`;
}

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
function escaparHTML(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}