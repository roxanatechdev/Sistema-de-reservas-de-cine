/*
 * CinePrime - Cartelera pública.
 * Comparte este archivo con index.html: detecta automáticamente si está
 * en la portada (tarjetas .movie-card) o en cartelera.html (.cm-movie-card).
 */
const API_BASE = '/api/peliculas';
const POSTER_PLACEHOLDER = 'https://placehold.co/400x600/191b24/ffffff?text=Poster+No+Disponible';

let todasLasPeliculas = [];
let peliculasEnCartelera = [];
let peliculasProximas = [];
let catalogoCompletoPeliculas = null;
let semanaCartelera = null;
let estadoActual = 'cartelera';
let formatoActual = 'todos';
let filtroActual = 'todos';
let filtroGenero = '';
let filtroIdioma = '';
let filtroClasificacion = '';
let textoBusqueda = '';
let fechaActual = '';

const esCarteleraCompleta = () => Boolean(document.querySelector('.filtros-selector'));

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarCartelera);
} else {
    iniciarCartelera();
}

function iniciarCartelera() {
    configurarFiltrosInicio();
    if (esCarteleraCompleta()) {
        configurarFiltrosPaginaCompleta();
        configurarSelectorDias();
    }
    cargarCartelera();
}

// Mantiene los filtros compactos que utiliza la portada (index.html).
function configurarFiltrosInicio() {
    const botones = document.querySelectorAll('.filter-btn');
    botones.forEach(boton => {
        const texto = boton.textContent.trim().toLowerCase();
        const filtrosPorTexto = { todos: 'todos', estrenos: 'estrenos', '3d': '3d' };
        const filtro = boton.dataset.filter || filtrosPorTexto[texto];
        if (!filtro || !['todos', 'estrenos', '3d'].includes(filtro)) return;
        boton.dataset.filter = filtro;
        boton.addEventListener('click', () => {
            filtroActual = filtro;
            botones.forEach(otro => {
                const activo = otro === boton;
                otro.classList.toggle('active', activo);
                otro.setAttribute('aria-pressed', String(activo));
            });
            renderizarCartelera();
        });
    });
}

function configurarFiltrosPaginaCompleta() {
    // Sincroniza buscadores de escritorio y móvil.
    document.querySelectorAll('.filtros-search-input').forEach(input => {
        input.addEventListener('input', () => {
            textoBusqueda = input.value.trim().toLocaleLowerCase('es');
            document.querySelectorAll('.filtros-search-input').forEach(otro => {
                if (otro !== input) otro.value = input.value;
            });
            renderizarCartelera();
        });
    });

    // Estado: cartelera semanal o próximos estrenos.
    document.querySelectorAll('.btn-status-toggle').forEach(boton => {
        const texto = boton.textContent.toLocaleLowerCase('es');
        boton.dataset.status = texto.includes('próximamente') ? 'proximamente' : 'cartelera';
        boton.addEventListener('click', async () => {
            estadoActual = boton.dataset.status;
            if (estadoActual === 'proximamente') fechaActual = '';
            document.querySelectorAll('.btn-status-toggle').forEach(otro => {
                const activo = otro.dataset.status === estadoActual;
                otro.classList.toggle('active', activo);
                otro.setAttribute('aria-pressed', String(activo));
            });
            await cargarCartelera(estadoActual);
        });
    });

    // Los únicos formatos registrados en la BD actualmente son 2D y 3D.
    document.querySelectorAll('.btn-filter-chip').forEach(boton => {
        const texto = boton.textContent.toLocaleLowerCase('es');
        let formato = 'todos';
        if (/\b3d\b/.test(texto)) formato = '3D';
        else if (/\b2d\b/.test(texto)) formato = '2D';
        boton.dataset.formato = formato;
        boton.addEventListener('click', () => {
            formatoActual = formato;
            const grupo = boton.parentElement;
            if (grupo) grupo.querySelectorAll('.btn-filter-chip').forEach(otro => {
                otro.classList.toggle('active-primary', otro === boton);
            });
            // Sincroniza el mismo filtro entre escritorio y offcanvas móvil.
            document.querySelectorAll('.btn-filter-chip').forEach(otro => {
                if (otro.dataset.formato === formato) otro.classList.add('active-primary');
                else if (otro.parentElement?.querySelector('.btn-filter-chip')) otro.classList.remove('active-primary');
            });
            renderizarCartelera();
        });
    });

    document.querySelectorAll('select.filtros-select').forEach(select => {
        const label = select.closest('div')?.querySelector('label')?.textContent.toLocaleLowerCase('es') || '';
        if (label.includes('género')) select.dataset.filter = 'genero';
        else if (label.includes('idioma')) select.dataset.filter = 'idioma';
        else if (label.includes('clasificación')) select.dataset.filter = 'clasificacion';
        select.addEventListener('change', () => {
            const value = select.value;
            const tipo = select.dataset.filter;
            if (tipo === 'genero') filtroGenero = value;
            if (tipo === 'idioma') filtroIdioma = value;
            if (tipo === 'clasificacion') filtroClasificacion = value;
            document.querySelectorAll(`select.filtros-select[data-filter="${tipo}"]`).forEach(otro => {
                if (otro !== select) otro.value = value;
            });
            renderizarCartelera();
        });
    });

    document.querySelectorAll('.btn-limpiar, .offcanvas-footer .btn-outline-warning').forEach(boton => {
        boton.addEventListener('click', limpiarFiltros);
    });
}

function configurarSelectorDias() {
    document.querySelectorAll('.btn-day-selector:not(.btn-proximamente)').forEach((boton, index) => {
        boton.dataset.dayIndex = String(index);
        boton.addEventListener('click', () => {
            if (boton.disabled || estadoActual !== 'cartelera') return;
            fechaActual = boton.dataset.fecha || '';
            document.querySelectorAll('.btn-day-selector:not(.btn-proximamente)').forEach(otro => {
                otro.classList.toggle('active', otro === boton);
            });
            renderizarCartelera();
        });
    });
    const futuros = document.querySelector('.btn-day-selector.btn-proximamente');
    if (futuros) futuros.addEventListener('click', async () => {
        fechaActual = '';
        estadoActual = 'proximamente';
        document.querySelectorAll('.btn-status-toggle').forEach(boton => {
            const activo = boton.dataset.status === 'proximamente';
            boton.classList.toggle('active', activo);
            boton.setAttribute('aria-pressed', String(activo));
        });
        await cargarCartelera('proximamente');
    });
}

function actualizarSelectorDias() {
    const botones = [...document.querySelectorAll('.btn-day-selector:not(.btn-proximamente)')];
    if (!botones.length) return;
    const esProximamente = estadoActual === 'proximamente';
    botones.forEach(boton => {
        boton.disabled = esProximamente;
        if (esProximamente) {
            boton.classList.remove('active');
            return;
        }
    });
    const desde = semanaCartelera?.desde;
    if (!desde || esProximamente) return;
    const inicio = new Date(`${desde}T12:00:00`);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    botones.forEach((boton, index) => {
        const fecha = new Date(inicio);
        fecha.setDate(inicio.getDate() + index);
        const fechaISO = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
        const peliculasDia = peliculasEnCartelera.filter(p => (p.funciones || []).some(f => f.fecha === fechaISO)).length;
        const nombreDia = new Intl.DateTimeFormat('es-BO', { weekday: 'short' }).format(fecha).replace('.', '').toUpperCase();
        const nombreCompleto = new Intl.DateTimeFormat('es-BO', { weekday: 'long' }).format(fecha);
        const spans = boton.querySelectorAll('span');
        if (spans[0]) spans[0].textContent = fecha.toDateString() === hoy.toDateString() ? 'HOY' : nombreCompleto;
        if (spans[1]) spans[1].textContent = `${nombreDia} ${String(fecha.getDate()).padStart(2, '0')}`;
        if (spans[2]) spans[2].textContent = `${peliculasDia} ${peliculasDia === 1 ? 'Peli' : 'Pelis'}`;
        boton.dataset.fecha = fechaISO;
        boton.disabled = fecha < hoy;
        boton.setAttribute('aria-label', `${nombreCompleto}, ${peliculasDia} películas con funciones`);
    });

    // Al entrar, seleccionar hoy (o el primer día disponible) y mantener
    // exactamente un día activo. El CSS pinta en rojo el botón .active.
    const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const fechaActualValida = botones.some(b => b.dataset.fecha === fechaActual && !b.disabled);
    if (!fechaActualValida) {
        const hoyBtn = botones.find(b => b.dataset.fecha === fechaHoy && !b.disabled);
        const primerDisponible = hoyBtn || botones.find(b => !b.disabled);
        fechaActual = primerDisponible?.dataset.fecha || '';
    }
    botones.forEach(boton => {
        boton.classList.toggle('active', Boolean(fechaActual) && boton.dataset.fecha === fechaActual && !boton.disabled);
        boton.setAttribute('aria-pressed', String(Boolean(fechaActual) && boton.dataset.fecha === fechaActual && !boton.disabled));
    });
}

function limpiarFiltros() {
    textoBusqueda = '';
    formatoActual = 'todos';
    filtroGenero = '';
    filtroIdioma = '';
    filtroClasificacion = '';
    document.querySelectorAll('.filtros-search-input').forEach(input => input.value = '');
    document.querySelectorAll('select.filtros-select').forEach(select => select.selectedIndex = 0);
    document.querySelectorAll('.btn-filter-chip').forEach(boton => {
        const activo = boton.dataset.formato === 'todos';
        boton.classList.toggle('active-primary', activo);
    });
    renderizarCartelera();
}

async function cargarCartelera(estado = estadoActual) {
    const contenedor = document.getElementById('cartelera-peliculas');
    if (!contenedor) return;

    estadoActual = estado;
    mostrarCargando(contenedor);
    const url = estado === 'proximamente' ? `${API_BASE}/proximamente` : API_BASE;

    try {
        const respuesta = window.CinePrimeAPI
            ? await window.CinePrimeAPI.request(url)
            : await fetch(`http://127.0.0.1:8000${url}`, { headers: { Accept: 'application/json' } });
        if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
        const datos = await respuesta.json();
        const peliculas = Array.isArray(datos) ? datos : datos?.peliculas;
        if (Array.isArray(peliculas) && window.CinePrimeAPI) {
            peliculas.forEach(p => {
                if (p.imagen) p.imagen = window.CinePrimeAPI.media(p.imagen);
                if (p.trailer) p.trailer = window.CinePrimeAPI.media(p.trailer);
            });
        }
        if (!Array.isArray(peliculas)) throw new Error('La API no devolvió una lista válida de películas.');

        // Carga el catálogo completo de películas ACTIVAS para construir los filtros,
        // aunque la cartelera semanal esté vacía o el usuario vea Próximamente.
        if (esCarteleraCompleta() && catalogoCompletoPeliculas === null) {
            try {
                const respuestaCatalogo = window.CinePrimeAPI
                    ? await window.CinePrimeAPI.request(`${API_BASE}/destacadas`)
                    : await fetch(`http://127.0.0.1:8000${API_BASE}/destacadas`, { headers: { Accept: 'application/json' } });
                if (!respuestaCatalogo.ok) throw new Error(`Error HTTP ${respuestaCatalogo.status}`);
                const datosCatalogo = await respuestaCatalogo.json();
                const listaCatalogo = Array.isArray(datosCatalogo) ? datosCatalogo : datosCatalogo?.peliculas;
                if (Array.isArray(listaCatalogo) && window.CinePrimeAPI) listaCatalogo.forEach(p => { if (p.imagen) p.imagen = window.CinePrimeAPI.media(p.imagen); if (p.trailer) p.trailer = window.CinePrimeAPI.media(p.trailer); });
                catalogoCompletoPeliculas = Array.isArray(listaCatalogo) ? listaCatalogo : peliculas;
            } catch (errorCatalogo) {
                console.warn('No se pudo cargar el catálogo completo para los filtros:', errorCatalogo);
                catalogoCompletoPeliculas = peliculas;
            }
        }

        if (estado === 'proximamente') peliculasProximas = peliculas;
        else {
            peliculasEnCartelera = peliculas;
            semanaCartelera = datos?.semana || null;
        }

        todasLasPeliculas = estado === 'proximamente' ? peliculasProximas : peliculasEnCartelera;
        poblarSelectores();
        actualizarSelectorDias();
        console.info(`CinePrime: ${todasLasPeliculas.length} película(s) en ${estado}.`);
        renderizarCartelera();
    } catch (error) {
        console.error('No se pudo cargar la cartelera pública:', error);
        mostrarMensaje(contenedor,
            'No pudimos cargar las películas. Verifica que Laravel esté iniciado y que la API sea accesible.', true);
    }
}

function poblarSelectores() {
    if (!esCarteleraCompleta()) return;
    const catalogo = catalogoCompletoPeliculas || todasLasPeliculas;
    const generos = [...new Set(catalogo.map(p => p.genero).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const idiomas = [...new Set(catalogo.map(p => p.idioma_original?.nombre || p.idioma).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const clasificaciones = [...new Set(catalogo.map(p => p.clasificacion).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

    document.querySelectorAll('select.filtros-select[data-filter="genero"]').forEach(select => {
        const actual = filtroGenero;
        select.replaceChildren(new Option('Todos los géneros', ''));
        generos.forEach(g => select.add(new Option(g, g)));
        select.value = actual;
    });
    document.querySelectorAll('select.filtros-select[data-filter="idioma"]').forEach(select => {
        const actual = filtroIdioma;
        select.replaceChildren(new Option('Todos los idiomas originales', ''));
        idiomas.forEach(i => select.add(new Option(i, i)));
        select.value = actual;
    });
    document.querySelectorAll('select.filtros-select[data-filter="clasificacion"]').forEach(select => {
        const actual = filtroClasificacion;
        select.replaceChildren(new Option('Todas las clasificaciones', ''));
        clasificaciones.forEach(c => select.add(new Option(c, c)));
        select.value = actual;
    });
}

function renderizarCartelera() {
    const contenedor = document.getElementById('cartelera-peliculas');
    if (!contenedor) return;
    let peliculas = [...todasLasPeliculas];

    if (!esCarteleraCompleta()) {
        if (filtroActual === 'estrenos') {
            const desde = semanaCartelera?.desde;
            const hasta = semanaCartelera?.hasta;
            peliculas = peliculas.filter(p => p.fecha_estreno && desde && hasta && p.fecha_estreno >= desde && p.fecha_estreno <= hasta);
        } else if (filtroActual === '3d') {
            peliculas = peliculas.filter(p => (p.funciones || []).some(f => String(f.formato).toUpperCase() === '3D'));
        }
    } else {
        if (textoBusqueda) {
            peliculas = peliculas.filter(p => {
                const creditos = (p.creditos || []).map(c => `${c.nombre || ''} ${c.nombre_busqueda || ''}`).join(' ');
                const texto = `${p.titulo || ''} ${p.sinopsis || ''} ${creditos}`.toLocaleLowerCase('es');
                return texto.includes(textoBusqueda);
            });
        }
        if (formatoActual !== 'todos') {
            peliculas = peliculas.filter(p => (p.funciones || []).some(f => String(f.formato || '').toUpperCase() === formatoActual));
        }
        if (fechaActual && estadoActual === 'cartelera') {
            peliculas = peliculas.filter(p => (p.funciones || []).some(f => f.fecha === fechaActual));
        }
        if (filtroGenero) peliculas = peliculas.filter(p => p.genero === filtroGenero);
        if (filtroIdioma) peliculas = peliculas.filter(p => (p.idioma_original?.nombre || p.idioma || '') === filtroIdioma);
        if (filtroClasificacion) peliculas = peliculas.filter(p => p.clasificacion === filtroClasificacion);
    }

    contenedor.replaceChildren();
    if (!peliculas.length) {
        const mensaje = estadoActual === 'proximamente'
            ? 'No hay próximos estrenos registrados por el momento.'
            : 'No hay películas que coincidan con los filtros seleccionados esta semana.';
        mostrarMensaje(contenedor, mensaje);
        actualizarContador(0);
        return;
    }

    peliculas.forEach(pelicula => {
        try {
            contenedor.appendChild(esCarteleraCompleta() ? crearTarjetaCinePrime(pelicula) : crearTarjetaInicio(pelicula));
        } catch (error) {
            console.error(`Error al crear tarjeta para ${pelicula.titulo || 'película'}:`, error);
        }
    });
    actualizarContador(peliculas.length);
}

function crearTarjetaCinePrime(pelicula) {
    const col = document.createElement('div');
    col.className = 'col';
    const titulo = escaparHTML(pelicula.titulo || 'Título por confirmar');
    const poster = esUrlSegura(pelicula.imagen) ? pelicula.imagen : POSTER_PLACEHOLDER;
    const clasificacion = escaparHTML(pelicula.clasificacion || 'S/C');
    const duracion = pelicula.duracion_minutos ? `${Math.floor(pelicula.duracion_minutos / 60)}h ${pelicula.duracion_minutos % 60}min` : 'Duración N/D';
    const genero = escaparHTML(pelicula.genero || 'Género por confirmar');
    let funciones = Array.isArray(pelicula.funciones) ? pelicula.funciones : [];
    if (fechaActual && estadoActual === 'cartelera') funciones = funciones.filter(f => f.fecha === fechaActual);
    const formatos = [...new Set(funciones.map(f => f.formato).filter(Boolean))];
    const chips = formatos.length ? formatos.map(f => `<span class="cm-chip">${escaparHTML(f)}</span>`).join('') : '<span class="cm-chip">Próximamente</span>';
    const primeraFuncion = funciones[0];
    const trailer = esUrlSegura(pelicula.trailer) ? pelicula.trailer : '';
    const esProxima = estadoActual === 'proximamente';
    const badgeFormato = esProxima ? 'PRÓXIMAMENTE' : (formatos.join(' / ') || 'FORMATO N/D');
    const fechaFuncion = primeraFuncion ? escaparHTML(formatearFuncion(primeraFuncion)) : 'Horarios por confirmar';
    const hrefDetalle = pelicula.id_pelicula != null ? `detalle-pelicula.html?id_pelicula=${encodeURIComponent(pelicula.id_pelicula)}` : '#';

    col.innerHTML = `
      <article class="cm-movie-card" data-pelicula-id="${Number(pelicula.id_pelicula) || ''}" tabindex="0" role="link" aria-label="Ver detalle de ${titulo}">
        <div class="cm-poster-wrapper">
          <span class="cm-badge-format">${escaparHTML(badgeFormato)}</span>
          <span class="cm-badge-rating-age">${clasificacion}</span>
          <img src="${escaparHTML(poster)}" alt="${escaparHTML(pelicula.imagen_alt || `Póster de ${pelicula.titulo || 'película'}`)}" class="cm-poster-img" loading="lazy" onerror="this.onerror=null;this.src='${POSTER_PLACEHOLDER}';">
          <div class="cm-poster-overlay"></div>
          <div class="cm-poster-hover-actions">
            <button class="cm-btn-play" type="button" title="Ver tráiler" ${trailer ? '' : 'disabled'} aria-label="Ver tráiler">
              <span class="material-symbols-outlined fs-2">play_arrow</span>
            </button>
            <span class="badge bg-dark bg-opacity-75 text-white px-3 py-1 rounded-pill fs-8">${trailer ? 'Ver tráiler' : 'Tráiler no disponible'}</span>
          </div>
        </div>
        <div class="cm-movie-body">
          <div class="cm-meta-row">
            <div class="cm-rating-box"><span class="material-symbols-outlined fs-6">star</span><span>—</span></div>
            <div class="cm-duration-box"><span class="material-symbols-outlined fs-6">schedule</span><span>${escaparHTML(duracion)}</span></div>
          </div>
          <h3 class="cm-movie-title" title="${titulo}">${titulo}</h3>
          <p class="cm-movie-genre">${genero}</p>
          <div class="cm-format-chips">${chips}</div>
          <p class="small text-white-50 mb-2">${esProxima ? `Estreno: ${escaparHTML(pelicula.fecha_estreno || 'Fecha por confirmar')}` : `Próxima función: ${fechaFuncion}`}</p>
          <div class="cm-card-actions">
            <a href="${hrefDetalle}" class="cm-btn-buy" ${pelicula.id_pelicula == null ? 'aria-disabled="true"' : ''}>
              <span class="material-symbols-outlined fs-5">confirmation_number</span><span>${esProxima ? 'Ver detalles' : 'Comprar Entradas'}</span>
            </a>
            <a href="${trailer || '#'}" class="cm-btn-schedule" title="${trailer ? 'Ver tráiler' : 'Horario por confirmar'}" ${trailer ? 'target="_blank" rel="noopener noreferrer"' : 'aria-disabled="true"'}>
              <span class="material-symbols-outlined fs-5">${trailer ? 'play_circle' : 'calendar_month'}</span>
            </a>
          </div>
        </div>
      </article>`;

    const botonTrailer = col.querySelector('.cm-btn-play');
    if (trailer && botonTrailer) botonTrailer.addEventListener('click', event => { event.stopPropagation(); window.open(trailer, '_blank', 'noopener,noreferrer'); });
    col.querySelectorAll('a[aria-disabled="true"]').forEach(a => a.addEventListener('click', event => event.preventDefault()));
    const tarjeta = col.querySelector('.cm-movie-card');
    if (tarjeta && pelicula.id_pelicula != null) {
        const irAlDetalle = event => {
            if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
            if (event.type === 'keydown') event.preventDefault();
            if (event.target.closest('a, button, input, select, textarea')) return;
            window.location.href = `detalle-pelicula.html?id_pelicula=${encodeURIComponent(pelicula.id_pelicula)}`;
        };
        tarjeta.addEventListener('click', irAlDetalle);
        tarjeta.addEventListener('keydown', irAlDetalle);
        tarjeta.style.cursor = 'pointer';
    }
    return col;
}

// Renderizador original de la portada; conserva sus clases y su apariencia.
function crearTarjetaInicio(pelicula) {
    const columna = document.createElement('div');
    columna.className = 'col';
    const titulo = escaparHTML(pelicula.titulo || 'Película próximamente');
    const poster = esUrlSegura(pelicula.imagen) ? pelicula.imagen : POSTER_PLACEHOLDER;
    const formato = escaparHTML(pelicula.formato || pelicula.funciones?.[0]?.formato || 'FORMATO N/D');
    const rating = escaparHTML(pelicula.rating ?? '—');
    const duracion = escaparHTML(pelicula.duracion || (pelicula.duracion_minutos ? `${Math.floor(pelicula.duracion_minutos / 60)}h ${pelicula.duracion_minutos % 60}m` : 'Duración N/D'));
    const genero = escaparHTML(pelicula.genero || 'Género por confirmar');
    const funciones = Array.isArray(pelicula.funciones) ? pelicula.funciones : [];
    const trailerUrl = esUrlSegura(pelicula.trailer) ? pelicula.trailer : null;
    const funcionesHTML = funciones.length ? funciones.slice(0, 3).map(f => {
        const fechaHora = escaparHTML(formatearFuncion(f));
        const sala = escaparHTML(f.sala || 'Sala por confirmar');
        const formatoFuncion = escaparHTML(f.formato || 'Formato N/D');
        return `<button class="btn btn-showtime flex-fill py-1 px-1 text-nowrap rounded-1" type="button" title="${sala} · ${formatoFuncion}" data-funcion-id="${Number(f.id_funcion) || ''}">${fechaHora}</button>`;
    }).join('') : '<span class="text-white-50 small">Sin funciones esta semana</span>';

    columna.innerHTML = `
      <div class="card movie-card h-100 bg-cm-surface rounded-3 overflow-hidden border border-white-5 transition-all">
        <div class="position-relative w-100 overflow-hidden bg-cm-surface-lowest movie-poster-container">
          <img src="${escaparHTML(poster)}" alt="Póster de ${titulo}" class="w-100 h-100 object-fit-cover movie-poster-img" onerror="this.onerror=null;this.src='${POSTER_PLACEHOLDER}';">
          <div class="card-media-overlay"></div>
          <div class="position-absolute top-50 start-50 translate-middle z-3 trailer-hover-btn">
            <button type="button" aria-label="Ver tráiler" class="btn btn-trailer-play rounded-circle d-flex align-items-center justify-content-center" ${trailerUrl ? '' : 'disabled title="Tráiler no disponible"'}><span class="material-symbols-outlined fs-2">play_arrow</span></button>
          </div>
          <div class="position-absolute top-0 start-0 end-0 p-2 d-flex align-items-center justify-content-between z-2"><span class="badge-tag">${formato}</span><button type="button" class="btn-favorite d-flex align-items-center justify-content-center" aria-label="Agregar a favoritos"><span class="material-symbols-outlined">favorite</span></button></div>
        </div>
        <div class="card-body p-3 d-flex flex-column justify-content-between gap-1"><div><div class="d-flex justify-content-between"><span class="badge badge-rating d-flex align-items-center gap-1 ps-0 mb-1"><span class="material-symbols-outlined icon-filled text-cm-tertiary">star</span>${rating}</span><span class="metadatos d-flex align-content-center gap-1 text-white-50"><span class="material-symbols-outlined fs-6">schedule</span>${duracion}</span></div><h3 class="movie-title text-uppercase mb-1 line-clamp-2" title="${titulo}">${titulo}</h3><p class="movie-subtitle">${genero}</p></div><div class="d-flex flex-column gap-1"><span class="showtime-label text-uppercase fw-bold py-1">FUNCIONES ESTA SEMANA</span><div class="d-flex gap-2">${funcionesHTML}</div></div><button class="btn btn-cm-reserve mt-1 w-100 text-uppercase rounded-2 py-1 fw-bold transition-all d-flex align-items-center justify-content-center gap-2" type="button"><span class="material-symbols-outlined fs-5">confirmation_number</span>Comprar Entradas</button></div>
      </div>`;
    const botonTrailer = columna.querySelector('.btn-trailer-play');
    if (trailerUrl && botonTrailer) botonTrailer.addEventListener('click', event => { event.stopPropagation(); window.open(trailerUrl, '_blank', 'noopener,noreferrer'); });
    const tarjeta = columna.querySelector('.movie-card');
    const hrefDetalle = pelicula.id_pelicula != null ? `detalle-pelicula.html?id_pelicula=${encodeURIComponent(pelicula.id_pelicula)}` : '#';
    const botonComprar = columna.querySelector('.btn-cm-reserve');
    if (botonComprar) botonComprar.addEventListener('click', () => { if (pelicula.id_pelicula != null) window.location.href = hrefDetalle; });
    if (tarjeta && pelicula.id_pelicula != null) {
        tarjeta.style.cursor = 'pointer';
        tarjeta.addEventListener('click', event => {
            if (event.target.closest('button, a, input, select, textarea')) return;
            window.location.href = hrefDetalle;
        });
    }
    return columna;
}

function formatearFuncion(funcion) {
    if (!funcion) return 'Hora N/D';
    if (!funcion.inicio) return `${funcion.fecha || ''} ${funcion.hora || ''}`.trim() || 'Hora N/D';
    const fecha = new Date(funcion.inicio);
    if (Number.isNaN(fecha.getTime())) return `${funcion.fecha || ''} ${funcion.hora || ''}`.trim() || 'Hora N/D';
    const dia = new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: '2-digit' }).format(fecha);
    const hora = funcion.hora || new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha);
    return `${dia} ${hora}`;
}

function esUrlSegura(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return false;
    try { const url = new URL(valor, window.location.href); return url.protocol === 'https:' || url.protocol === 'http:'; }
    catch { return false; }
}

function mostrarCargando(contenedor) {
    contenedor.replaceChildren();
    const col = document.createElement('div');
    col.className = 'col-12 text-center py-5';
    col.innerHTML = '<div class="spinner-border text-info" role="status"><span class="visually-hidden">Cargando películas...</span></div><p class="text-cm-variant mt-3">Cargando cartelera...</p>';
    contenedor.appendChild(col);
}

function mostrarMensaje(contenedor, mensaje, esError = false) {
    const columna = document.createElement('div');
    columna.className = 'col-12';
    const alerta = document.createElement('div');
    alerta.className = esError ? 'alert alert-warning' : 'text-center text-cm-variant py-5';
    alerta.setAttribute('role', esError ? 'alert' : 'status');
    alerta.textContent = mensaje;
    columna.appendChild(alerta);
    contenedor.replaceChildren(columna);
}

function actualizarContador(total) {
    const contadores = document.querySelectorAll('[data-cartelera-count]');
    contadores.forEach(el => el.textContent = `${total} ${total === 1 ? 'película' : 'películas'}`);
    const badges = document.querySelectorAll('.btn-filtros-trigger .badge');
    badges.forEach(el => el.textContent = String([filtroGenero, filtroIdioma, filtroClasificacion].filter(Boolean).length + (formatoActual !== 'todos' ? 1 : 0)));
    document.querySelectorAll('.offcanvas-footer .btn-danger').forEach(el => el.textContent = `VER (${total})`);
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
