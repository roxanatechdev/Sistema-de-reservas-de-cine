const API_PROXIMAMENTE = 'http://127.0.0.1:8000/api/peliculas/proximamente';
const POSTER_PLACEHOLDER = 'img/cyber-echo.jpg';

document.addEventListener('DOMContentLoaded', cargarProximamente);

async function cargarProximamente() {
    const contenedor = document.getElementById('proximamente-peliculas');
    if (!contenedor) return;

    try {
        const respuesta = await fetch(API_PROXIMAMENTE, {
            headers: { Accept: 'application/json' }
        });

        if (!respuesta.ok) {
            throw new Error(`Error HTTP ${respuesta.status}`);
        }

        const peliculas = await respuesta.json();
        if (!Array.isArray(peliculas)) {
            throw new Error('La API no devolvió una lista de próximos estrenos.');
        }

        contenedor.replaceChildren();

        if (peliculas.length === 0) {
            mostrarEstadoProximamente(contenedor, 'Todavía no hay próximos estrenos publicados.');
            return;
        }

        peliculas.forEach(pelicula => contenedor.appendChild(crearTarjetaProximamente(pelicula)));
    } catch (error) {
        console.error('No se pudieron cargar los próximos estrenos:', error);
        mostrarEstadoProximamente(
            contenedor,
            'No pudimos cargar los próximos estrenos. Comprueba que Laravel esté iniciado.',
            true
        );
    }
}

function crearTarjetaProximamente(pelicula) {
    const columna = document.createElement('div');
    columna.className = 'col';

    const tarjeta = document.createElement('article');
    tarjeta.className = 'card card-upcoming h-100 bg-cm-surface border border-white border-opacity-10 rounded-3 overflow-hidden';

    const zonaImagen = document.createElement('div');
    zonaImagen.className = 'position-relative overflow-hidden bg-cm-surface-low';
    zonaImagen.style.aspectRatio = '16 / 10';

    const imagen = document.createElement('img');
    imagen.className = 'w-100 h-100 object-fit-cover img-zoom';
    imagen.src = urlImagenSegura(pelicula.imagen) ? pelicula.imagen : POSTER_PLACEHOLDER;
    imagen.alt = pelicula.imagen_alt || (pelicula.titulo ? `Póster de ${pelicula.titulo}` : 'Póster no disponible');
    imagen.onerror = () => {
        imagen.onerror = null;
        imagen.src = POSTER_PLACEHOLDER;
    };
    zonaImagen.appendChild(imagen);

    const overlay = document.createElement('div');
    overlay.className = 'card-media-overlay';
    zonaImagen.appendChild(overlay);

    const estado = document.createElement('span');
    estado.className = 'position-absolute top-0 start-0 m-3 badge bg-warning text-dark px-2 py-1 uppercase font-bold tracking-wider shadow-sm z-2';
    estado.textContent = 'Próximamente';
    zonaImagen.appendChild(estado);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body p-3 d-flex flex-column justify-content-between gap-3';

    const detalles = document.createElement('div');
    const fecha = document.createElement('small');
    fecha.className = 'font-display fs-6 text-cm-tertiary text-uppercase tracking-wider d-block mb-1';
    fecha.textContent = formatearFecha(pelicula.fecha_estreno);

    const titulo = document.createElement('h3');
    titulo.className = 'font-display fs-3 text-light mb-1';
    titulo.textContent = pelicula.titulo || 'Título por confirmar';

    const sinopsis = document.createElement('p');
    sinopsis.className = 'small text-cm-variant text-truncate-2 mb-0';
    sinopsis.textContent = pelicula.sinopsis || 'La sinopsis estará disponible próximamente.';

    detalles.append(fecha, titulo, sinopsis);

    const acciones = document.createElement('div');
    acciones.className = 'd-flex align-items-center gap-2 pt-2';

    const botonAviso = document.createElement('button');
    botonAviso.type = 'button';
    botonAviso.className = 'btn btn-sm bg-warning bg-opacity-10 border border-warning border-opacity-25 text-cm-tertiary flex-fill d-flex align-items-center justify-content-center gap-2 uppercase tracking-wider py-2 rounded-2 btn-hover-gold';
    botonAviso.disabled = true;
    const iconoAviso = document.createElement('span');
    iconoAviso.className = 'material-symbols-outlined';
    iconoAviso.style.fontSize = '18px';
    iconoAviso.textContent = 'notifications';
    const textoAviso = document.createElement('span');
    textoAviso.textContent = 'Próximamente';
    botonAviso.append(iconoAviso, textoAviso);

    const botonTrailer = document.createElement('button');
    botonTrailer.type = 'button';
    botonTrailer.className = 'btn btn-sm bg-cm-surface-high text-light d-flex align-items-center justify-content-center p-2 border-0 rounded-2 btn-hover-subtle';
    botonTrailer.setAttribute('aria-label', 'Ver tráiler');
    botonTrailer.title = pelicula.trailer ? 'Ver tráiler' : 'Tráiler no disponible';
    const iconoTrailer = document.createElement('span');
    iconoTrailer.className = 'material-symbols-outlined';
    iconoTrailer.style.fontSize = '20px';
    iconoTrailer.textContent = 'play_arrow';
    botonTrailer.appendChild(iconoTrailer);
    if (urlExternaSegura(pelicula.trailer)) {
        botonTrailer.addEventListener('click', () => window.open(pelicula.trailer, '_blank', 'noopener,noreferrer'));
    } else {
        botonTrailer.disabled = true;
    }

    acciones.append(botonAviso, botonTrailer);
    cuerpo.append(detalles, acciones);
    tarjeta.append(zonaImagen, cuerpo);
    columna.appendChild(tarjeta);
    return columna;
}

function formatearFecha(valor) {
    if (!valor) return 'Fecha por confirmar';
    const partes = String(valor).split('-').map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return 'Fecha por confirmar';
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    return new Intl.DateTimeFormat('es-BO', {
        day: '2-digit', month: 'long', year: 'numeric'
    }).format(fecha);
}

function urlImagenSegura(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return false;
    const limpio = valor.trim();
    if (/^https?:\/\//i.test(limpio)) return true;
    return /^(img|storage|assets)\/[\w./%-]+$/i.test(limpio) || /^\/[\w./%-]+$/.test(limpio);
}

function urlExternaSegura(valor) {
    if (typeof valor !== 'string') return false;
    try {
        const url = new URL(valor);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function mostrarEstadoProximamente(contenedor, mensaje, esError = false) {
    const columna = document.createElement('div');
    columna.className = 'col-12';
    const texto = document.createElement('p');
    texto.className = esError ? 'alert alert-warning' : 'text-center text-cm-variant py-4';
    texto.setAttribute('role', esError ? 'alert' : 'status');
    texto.textContent = mensaje;
    columna.appendChild(texto);
    contenedor.replaceChildren(columna);
}
