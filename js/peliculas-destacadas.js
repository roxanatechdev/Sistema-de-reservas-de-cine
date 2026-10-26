/* CinePrime: carrusel conectado con Admin > Películas. */
(() => {
  'use strict';
  const API_BASE = 'http://127.0.0.1:8000';
  const API_URL = `${API_BASE}/api/peliculas/destacadas`;
  const INTERVALO = 6000;
  let peliculas = [];
  let indice = 0;
  let temporizador = null;

  document.addEventListener('DOMContentLoaded', iniciar);

  async function iniciar() {
    conectarControles();
    try {
      const respuesta = await fetch(API_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}: ${API_URL}`);
      const json = await respuesta.json();
      const lista = Array.isArray(json) ? json : (Array.isArray(json.peliculas) ? json.peliculas : []);
      const unicas = new Map();
      lista.forEach(p => {
        if (p && p.id_pelicula != null && !unicas.has(String(p.id_pelicula))) {
          unicas.set(String(p.id_pelicula), p);
        }
      });
      peliculas = [...unicas.values()].sort(compararPeliculas).slice(0, 3);
      if (!peliculas.length) {
        estadoRespaldo('No hay películas activas; agrega una desde Admin');
        console.warn('CinePrime: la API respondió sin películas activas.');
        return;
      }
      actualizarIndicadores();
      mostrar(0);
      iniciarTemporizador();
    } catch (error) {
      estadoRespaldo('No se pudo conectar con el catálogo');
      console.error('CinePrime: revisa Laravel y la ruta /api/peliculas/destacadas.', error);
    }
  }

  function compararPeliculas(a, b) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const da = distanciaFecha(a.fecha_estreno, hoy);
    const db = distanciaFecha(b.fecha_estreno, hoy);
    if (da !== db) return da - db;
    const ca = [a.titulo,a.sinopsis,a.genero,a.imagen,a.clasificacion,a.duracion_minutos,a.trailer].filter(Boolean).length;
    const cb = [b.titulo,b.sinopsis,b.genero,b.imagen,b.clasificacion,b.duracion_minutos,b.trailer].filter(Boolean).length;
    return cb - ca || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es');
  }
  function distanciaFecha(valor, hoy) {
    if (!valor) return Number.MAX_SAFE_INTEGER;
    const p = String(valor).slice(0,10).split('-').map(Number);
    if (p.length !== 3 || p.some(Number.isNaN)) return Number.MAX_SAFE_INTEGER;
    return Math.abs(new Date(p[0],p[1]-1,p[2]).getTime() - hoy.getTime());
  }

  function mostrar(n) {
    if (!peliculas.length) return;
    indice = (n + peliculas.length) % peliculas.length;
    const p = peliculas[indice];
    const fondo = document.getElementById('hero-background');
    const imagen = resolverImagen(p.imagen);
    if (fondo) fondo.style.backgroundImage = `url("${escaparCss(imagen || 'img/fondo-cine.png')}")`;
    const hoy = new Date().toISOString().slice(0,10);
    texto('hero-status-text', p.fecha_estreno && p.fecha_estreno > hoy ? 'Próximo estreno' : 'En cartelera');
    texto('hero-title', p.titulo || 'Título por confirmar');
    texto('hero-duration', formatearDuracion(p.duracion_minutos));
    texto('hero-classification', p.clasificacion || 'Clasificación N/D');
    texto('hero-rating', p.rating ? `${p.rating}/10` : 'Calificación N/D');
    texto('hero-genre', p.genero || 'Género por confirmar');
    texto('hero-format', p.formato || 'Formato por confirmar');
    texto('hero-synopsis', p.sinopsis || 'Sinopsis no disponible por el momento.');

    const boton = document.getElementById('hero-trailer-button');
    const trailer = resolverUrl(p.trailer);
    if (boton) {
      boton.disabled = !trailer;
      boton.title = trailer ? 'Ver tráiler' : 'Tráiler no disponible';
      boton.onclick = trailer ? () => window.open(trailer, '_blank', 'noopener,noreferrer') : null;
    }
    const comprar = document.querySelector('.hero-section .btn-cm-primary');
    if (comprar) {
      comprar.href = '#cartelera-section';
      comprar.setAttribute('aria-label', `Ver cartelera para ${p.titulo || 'la película destacada'}`);
    }
    document.querySelectorAll('[data-hero-index]').forEach((b,i) => {
      const activo = i === indice;
      b.hidden = i >= peliculas.length;
      b.classList.toggle('active', activo);
      b.classList.toggle('rounded-pill', activo);
      b.classList.toggle('rounded-circle', !activo);
      if (activo) b.setAttribute('aria-current','true'); else b.removeAttribute('aria-current');
    });
    const prev = document.getElementById('hero-prev');
    const next = document.getElementById('hero-next');
    if (prev) prev.hidden = peliculas.length < 2;
    if (next) next.hidden = peliculas.length < 2;
  }

  function conectarControles() {
    document.getElementById('hero-prev')?.addEventListener('click', () => { mostrar(indice-1); reiniciarTemporizador(); });
    document.getElementById('hero-next')?.addEventListener('click', () => { mostrar(indice+1); reiniciarTemporizador(); });
    document.querySelectorAll('[data-hero-index]').forEach(b => b.addEventListener('click', () => {
      mostrar(Number(b.dataset.heroIndex) || 0); reiniciarTemporizador();
    }));
  }
  function iniciarTemporizador() {
    detenerTemporizador();
    if (peliculas.length < 2) return;
    temporizador = window.setInterval(() => {
      if (!document.hidden) mostrar(indice+1);
    }, INTERVALO);
  }
  function detenerTemporizador() {
    if (temporizador !== null) window.clearInterval(temporizador);
    temporizador = null;
  }
  function reiniciarTemporizador() { iniciarTemporizador(); }

  function estadoRespaldo(mensaje) {
    texto('hero-status-text', mensaje);
    // Conserva la presentación original de Dune hasta que existan películas activas.
    document.querySelectorAll('[data-hero-index]').forEach((b,i) => { b.hidden = i > 0; });
    const prev = document.getElementById('hero-prev');
    const next = document.getElementById('hero-next');
    if (prev) prev.hidden = true;
    if (next) next.hidden = true;
    detenerTemporizador();
  }
  function texto(id, valor) { const el = document.getElementById(id); if (el) el.textContent = valor; }
  function formatearDuracion(minutos) {
    const n = Number(minutos);
    if (!Number.isFinite(n) || n <= 0) return 'Duración N/D';
    const h = Math.floor(n/60), m = n%60;
    return h ? `${h}h ${m}min` : `${m}min`;
  }
  function resolverImagen(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return null;
    const v = valor.trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^(javascript|data):/i.test(v)) return null;
    if (/^img\//i.test(v)) return v;
    if (v.startsWith('/storage/')) return `${API_BASE}${v}`;
    if (v.startsWith('storage/')) return `${API_BASE}/${v}`;
    if (v.startsWith('/')) return `${API_BASE}${v}`;
    return `${API_BASE}/storage/${v.replace(/^\/+/, '')}`;
  }
  function resolverUrl(valor) {
    if (typeof valor !== 'string' || !valor.trim()) return null;
    try {
      const u = new URL(valor, API_BASE);
      return ['http:','https:'].includes(u.protocol) ? u.href : null;
    } catch { return null; }
  }
  function escaparCss(valor) {
    return String(valor).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\r\n]/g,'');
  }
})();
