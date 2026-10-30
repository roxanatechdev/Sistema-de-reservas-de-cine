/* ============================================================================
   CINEPRIME - CARRUSEL DE 3 PELÍCULAS DESTACADAS
   Fuente: API pública de películas estrenadas y próximos estrenos.
   Criterio: fechas de estreno más cercanas a hoy; luego, datos más completos.
   Los campos ausentes se muestran como placeholders, nunca como datos inventados.
   ============================================================================ */

const API_CINEPRIME = 'http://127.0.0.1:8000';
const API_CARTELERA_DESTACADAS = `${API_CINEPRIME}/api/peliculas/cartelera`;
const API_PROXIMAMENTE_DESTACADAS = `${API_CINEPRIME}/api/peliculas/proximamente`;
const FONDO_HERO_PLACEHOLDER = 'img/fondo-cine.png';
const TOTAL_DESTACADAS = 3;

let peliculasDestacadas = [];
let indiceDestacadoActual = 0;
let temporizadorDestacadas = null;
const INTERVALO_DESTACADAS_MS = 6000;

document.addEventListener('DOMContentLoaded', inicializarCarruselDestacadas);

async function obtenerListaPeliculas(url) {
    const respuesta = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status} en ${url}`);
    const datos = await respuesta.json();
    if (!Array.isArray(datos)) throw new Error(`La respuesta de ${url} no es una lista.`);
    return datos;
}

async function inicializarCarruselDestacadas() {
    enlazarControlesCarrusel();
    configurarReproduccionAutomatica();

    try {
        const resultados = await Promise.allSettled([
            obtenerListaPeliculas(API_CARTELERA_DESTACADAS),
            obtenerListaPeliculas(API_PROXIMAMENTE_DESTACADAS)
        ]);
        const listas = resultados
            .filter(resultado => resultado.status === 'fulfilled' && Array.isArray(resultado.value))
            .map(resultado => resultado.value);

        if (listas.length === 0) {
            throw new Error('No se pudo consultar ninguna lista pública de películas.');
        }

        const unicas = new Map();
        listas.flat().forEach(pelicula => {
            if (pelicula && pelicula.id_pelicula != null && !unicas.has(String(pelicula.id_pelicula))) {
                unicas.set(String(pelicula.id_pelicula), pelicula);
            }
        });

        const candidatas = [...unicas.values()].sort(compararDestacadas);
        peliculasDestacadas = candidatas.slice(0, TOTAL_DESTACADAS);

        while (peliculasDestacadas.length < TOTAL_DESTACADAS) {
            peliculasDestacadas.push(crearPeliculaPlaceholder(peliculasDestacadas.length + 1));
        }

        mostrarDestacada(0);
    } catch (error) {
        console.error('No se pudieron cargar las películas destacadas:', error);
        peliculasDestacadas = Array.from({ length: TOTAL_DESTACADAS }, (_, i) => crearPeliculaPlaceholder(i + 1));
        mostrarDestacada(0);
    }
}

/* Ordena por estreno más cercano a hoy. Si hay empate, prioriza fichas completas. */
function compararDestacadas(a, b) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const distanciaA = distanciaFecha(a.fecha_estreno, hoy);
    const distanciaB = distanciaFecha(b.fecha_estreno, hoy);
    if (distanciaA !== distanciaB) return distanciaA - distanciaB;

    const completitudA = puntuarCompletitud(a);
    const completitudB = puntuarCompletitud(b);
    if (completitudA !== completitudB) return completitudB - completitudA;

    return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es');
}

function distanciaFecha(valor, hoy) {
    if (!valor) return Number.MAX_SAFE_INTEGER;
    const partes = String(valor).split('-').map(Number);
    if (partes.length !== 3 || partes.some(Number.isNaN)) return Number.MAX_SAFE_INTEGER;
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    return Math.abs(fecha.getTime() - hoy.getTime());
}

function puntuarCompletitud(pelicula) {
    return [pelicula.titulo, pelicula.sinopsis, pelicula.genero, pelicula.imagen,
    pelicula.clasificacion, pelicula.duracion_minutos, pelicula.trailer].filter(Boolean).length;
}

function crearPeliculaPlaceholder(numero) {
    return {
        id_pelicula: null,
        titulo: `Película destacada ${numero} por confirmar`,
        sinopsis: 'La información de esta película estará disponible cuando se registre en el catálogo.',
        genero: 'Género por confirmar',
        clasificacion: 'N/D',
        duracion_minutos: null,
        fecha_estreno: null,
        imagen: null,
        imagen_alt: 'Imagen de película no disponible',
        trailer: '../img/placeholder.mp4',
        es_placeholder: true
    };
}

function mostrarDestacada(indice) {
    if (!peliculasDestacadas.length) return;
    indiceDestacadoActual = (indice + peliculasDestacadas.length) % peliculasDestacadas.length;
    const pelicula = peliculasDestacadas[indiceDestacadoActual];

    const fondo = document.getElementById('hero-background');
    if (fondo) {
        const imagen = resolverUrlImagen(pelicula.imagen);
        fondo.style.backgroundImage = `url("${escaparCssUrl(imagen || FONDO_HERO_PLACEHOLDER)}")`;
    }

    ponerTexto('hero-status-text', pelicula.es_placeholder ? 'Información por confirmar' : 'Película destacada');
    ponerTexto('hero-title', pelicula.titulo || 'Título por confirmar');
    ponerTexto('hero-duration', formatearDuracion(pelicula.duracion_minutos));
    ponerTexto('hero-classification', pelicula.clasificacion || 'Clasificación N/D');
    ponerTexto('hero-rating', pelicula.rating ? `${pelicula.rating}/10` : 'Calificación N/D');
    ponerTexto('hero-genre', pelicula.genero || 'Género por confirmar');
    ponerTexto('hero-format', pelicula.formato || 'Formato por confirmar');
    ponerTexto('hero-synopsis', pelicula.sinopsis || 'La sinopsis estará disponible próximamente.');

    const botonTrailer = document.getElementById('hero-trailer-button');
    const trailer = resolverUrlExterna(pelicula.trailer);
    if (botonTrailer) {
        botonTrailer.disabled = !trailer;
        botonTrailer.title = trailer ? 'Ver tráiler' : 'Tráiler no disponible';
        botonTrailer.dataset.videoSrc = trailer || '';
    }

    // Mantiene actualizado el botón principal con la película que se muestra.
    const botonComprar = document.querySelector('.hero-section .btn-cm-primary');
    if (botonComprar) {
        botonComprar.href = '#cartelera-section';
        botonComprar.setAttribute(
            'aria-label',
            `Ver cartelera para ${pelicula.titulo || 'la película destacada'}`
        );
    }

    // Actualiza los indicadores cada vez que cambia la película.
    document.querySelectorAll('[data-hero-index]').forEach((indicador, i) => {
        const activo = i === indiceDestacadoActual;
        indicador.classList.toggle('active', activo);
        indicador.classList.toggle('rounded-pill', activo);
        indicador.classList.toggle('rounded-circle', !activo);
        if (activo) indicador.setAttribute('aria-current', 'true');
        else indicador.removeAttribute('aria-current');
    });
}

function enlazarControlesCarrusel() {
    document.getElementById('hero-prev')?.addEventListener('click', () => {
        mostrarDestacada(indiceDestacadoActual - 1);
        reiniciarReproduccionAutomatica();
    });
    document.getElementById('hero-next')?.addEventListener('click', () => {
        mostrarDestacada(indiceDestacadoActual + 1);
        reiniciarReproduccionAutomatica();
    });
    document.querySelectorAll('[data-hero-index]').forEach(indicador => {
        indicador.addEventListener('click', () => {
            mostrarDestacada(Number(indicador.dataset.heroIndex) || 0);
            reiniciarReproduccionAutomatica();
        });
    });
}

function configurarReproduccionAutomatica() {
    const hero = document.querySelector('.hero-section');
    detenerReproduccionAutomatica();
    temporizadorDestacadas = window.setInterval(() => {
        if (document.hidden || !peliculasDestacadas.length) return;
        mostrarDestacada(indiceDestacadoActual + 1);
    }, INTERVALO_DESTACADAS_MS);

    // Pausa mientras la persona interactúa con el carrusel y se reanuda al salir.
    hero?.addEventListener('mouseenter', detenerReproduccionAutomatica);
    hero?.addEventListener('mouseleave', iniciarReproduccionAutomatica);
    hero?.addEventListener('focusin', detenerReproduccionAutomatica);
    hero?.addEventListener('focusout', iniciarReproduccionAutomatica);
}

function detenerReproduccionAutomatica() {
    if (temporizadorDestacadas !== null) {
        window.clearInterval(temporizadorDestacadas);
        temporizadorDestacadas = null;
    }
}

function reiniciarReproduccionAutomatica() {
    detenerReproduccionAutomatica();
    iniciarReproduccionAutomatica();
}

function iniciarReproduccionAutomatica() {
    if (temporizadorDestacadas !== null) return;
    temporizadorDestacadas = window.setInterval(() => {
        if (document.hidden || !peliculasDestacadas.length) return;
        mostrarDestacada(indiceDestacadoActual + 1);
    }, INTERVALO_DESTACADAS_MS);
}

function ponerTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
}

function formatearDuracion(minutos) {
    const valor = Number(minutos);
    if (!Number.isFinite(valor) || valor <= 0) return 'Duración N/D';
    const horas = Math.floor(valor / 60);
    const resto = valor % 60;
    return horas ? `${horas}h ${resto}min` : `${resto}min`;
}

function resolverUrlImagen(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return null;
    const limpio = valor.trim();
    if (/^https?:\/\//i.test(limpio)) return limpio;
    if (/^(javascript|data):/i.test(limpio)) return null;
    if (/^img\//i.test(limpio)) return limpio;
    if (limpio.startsWith('/storage/')) return `${API_CINEPRIME}${limpio}`;
    if (limpio.startsWith('storage/')) return `${API_CINEPRIME}/${limpio}`;
    if (limpio.startsWith('/')) return `${API_CINEPRIME}${limpio}`;
    return `${API_CINEPRIME}/storage/${limpio.replace(/^\/+/, '')}`;
}

function resolverUrlExterna(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return null;
    try {
        const url = new URL(valor, API_CINEPRIME);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

function escaparCssUrl(valor) {
    return String(valor).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '');
}
