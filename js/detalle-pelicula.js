/* Carga el detalle desde la API usando exclusivamente el ID de la URL. */
(function () {
    'use strict';

    const parametros = new URLSearchParams(window.location.search);
    const idPelicula = parametros.get('id_pelicula');
    const api = window.CinePrimeAPI;

    function textoSeguro(valor, alternativo = '') {
        return valor == null || String(valor).trim() === '' ? alternativo : String(valor);
    }

    function ponerTexto(elemento, valor) {
        if (elemento && valor != null && String(valor).trim() !== '') elemento.textContent = valor;
    }

    function escaparHtml(valor) {
        return String(valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function prepararUrlVideo(url) {
        if (!url) return '';
        try {
            const parsed = new URL(url, window.location.href);
            const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
            if (host === 'youtube.com' || host === 'm.youtube.com') {
                const id = parsed.searchParams.get('v');
                if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
                const shorts = parsed.pathname.match(/^\/shorts\/([^/?#]+)/);
                if (shorts) return `https://www.youtube.com/embed/${encodeURIComponent(shorts[1])}`;
                const embed = parsed.pathname.match(/^\/embed\/([^/?#]+)/);
                if (embed) return `https://www.youtube.com/embed/${encodeURIComponent(embed[1])}`;
                // La página principal de YouTube no identifica un video reproducible.
                return '';
            }
            if (host === 'youtu.be') {
                const id = parsed.pathname.split('/').filter(Boolean)[0];
                if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
            }
            if (host === 'vimeo.com') {
                const id = parsed.pathname.split('/').filter(Boolean)[0];
                if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
            }
            return parsed.href;
        } catch (_) {
            return url;
        }
    }

    function formatearDuracion(minutos) {
        const n = Number(minutos);
        if (!Number.isFinite(n) || n <= 0) return '';
        const horas = Math.floor(n / 60);
        const resto = n % 60;
        return `${horas ? `${horas}h ` : ''}${resto ? `${resto}m` : ''}`.trim();
    }

    const DESCRIPCIONES_SALA = [
        'Sala cómoda con sonido envolvente y una distribución pensada para una buena vista desde cada fila.',
        'Ambiente amplio, butacas acolchadas y acústica equilibrada para disfrutar cada escena.',
        'Sala de proyección con iluminación tenue y asientos dispuestos para una experiencia relajada.',
        'Espacio acogedor con pantalla de gran visibilidad y sonido claro durante toda la función.'
    ];
    let funcionesPelicula = [];
    let fechaSeleccionada = '';
    let formatoSeleccionado = 'TODOS';

    function fechaLocalISO(fecha) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        return `${anio}-${mes}-${dia}`;
    }

    function fechaDeFuncion(funcion) {
        if (funcion?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(funcion.fecha))) return String(funcion.fecha);
        if (funcion?.inicio) {
            const fecha = new Date(funcion.inicio);
            if (!Number.isNaN(fecha.getTime())) return fechaLocalISO(fecha);
        }
        return '';
    }

    function obtenerHora(funcion) {
        if (funcion?.hora && /^\d{1,2}:\d{2}/.test(String(funcion.hora))) return String(funcion.hora).slice(0, 5);
        if (funcion?.inicio) {
            const fecha = new Date(funcion.inicio);
            if (!Number.isNaN(fecha.getTime())) return fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        return '--:--';
    }

    function funcionesDeFecha(fecha) {
        return funcionesPelicula.filter(funcion => fechaDeFuncion(funcion) === fecha);
    }

    function renderizarDias() {
        const contenedor = document.getElementById('scheduleDayPicker');
        if (!contenedor) return;
        contenedor.replaceChildren();
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const dias = Array.from({ length: 7 }, (_, indice) => {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() + indice);
            return fecha;
        });
        if (!fechaSeleccionada) fechaSeleccionada = fechaLocalISO(dias[0]);
        dias.forEach((fecha, indice) => {
            const iso = fechaLocalISO(fecha);
            const total = funcionesDeFecha(iso).length;
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = `day-card border-0 text-start p-1 p-lg-2 rounded-4 d-flex flex-column justify-content-center${iso === fechaSeleccionada ? ' active' : ''}`;
            boton.dataset.fecha = iso;
            boton.setAttribute('aria-pressed', String(iso === fechaSeleccionada));
            const diaNombre = indice === 0 ? 'Hoy' : fecha.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '');
            const mes = fecha.toLocaleDateString('es-CL', { month: 'long' });
            boton.innerHTML = `<div><span class="day-name d-block text-uppercase fw-bold text-center">${escaparHtml(diaNombre)}</span><span class="day-number d-block text-center fw-bold my-1">${fecha.getDate()}</span><span class="day-month d-block text-center text-capitalize">${escaparHtml(mes)}</span></div><div class="day-badge text-center py-1 px-2 rounded-2 fw-bold text-uppercase mt-2">${total} ${total === 1 ? 'Función' : 'Funciones'}</div>`;
            boton.addEventListener('click', () => {
                fechaSeleccionada = iso;
                renderizarDias();
                renderizarHorarios();
            });
            contenedor.appendChild(boton);
        });
    }

    function renderizarHorarios() {
        const contenedor = document.getElementById('scheduleShowtimesList');
        if (!contenedor) return;
        const funciones = funcionesDeFecha(fechaSeleccionada)
            .filter(funcion => formatoSeleccionado === 'TODOS' || String(funcion.formato || '').toUpperCase() === formatoSeleccionado)
            .sort((a, b) => obtenerHora(a).localeCompare(obtenerHora(b)));
        contenedor.replaceChildren();
        if (!funciones.length) {
            const vacio = document.createElement('div');
            vacio.className = 'showtime-card rounded-4 p-3 p-md-4 border border-secondary border-opacity-10 bg-cm-surface-low shadow-sm';
            const fechaLegible = fechaSeleccionada ? new Date(`${fechaSeleccionada}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }) : 'este día';
            vacio.innerHTML = `<p class="text-white fw-bold mb-1">No hay funciones disponibles</p><p class="text-cm-variant mb-0">No encontramos funciones ${formatoSeleccionado === 'TODOS' ? '' : `en formato ${formatoSeleccionado} `}para el ${escaparHtml(fechaLegible)}. Prueba otro día o formato.</p>`;
            contenedor.appendChild(vacio);
            return;
        }

        const grupos = new Map();
        funciones.forEach(funcion => {
            const nombreSala = textoSeguro(funcion.sala, 'Sala por confirmar');
            if (!grupos.has(nombreSala)) grupos.set(nombreSala, []);
            grupos.get(nombreSala).push(funcion);
        });

        let indiceSala = 0;
        grupos.forEach((funcionesSala, nombreSala) => {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'showtime-card rounded-4 p-3 p-md-4 border border-secondary border-opacity-10 bg-cm-surface-low shadow-sm';
            const formatoResumen = [...new Set(funcionesSala.map(f => String(f.formato || '').toUpperCase()).filter(f => ['2D', '3D'].includes(f)))].join(' / ');
            const descripcion = DESCRIPCIONES_SALA[indiceSala % DESCRIPCIONES_SALA.length];
            const icono = formatoResumen.includes('3D') ? '3d_rotation' : 'movie';
            const funcionesHtml = funcionesSala.map(funcion => {
                const hora = escaparHtml(obtenerHora(funcion));
                const idFuncion = encodeURIComponent(String(funcion.id_funcion ?? ''));
                const idPeliculaUrl = encodeURIComponent(String(idPelicula ?? ''));
                const precio = Number(funcion.precio);
                const precioTexto = Number.isFinite(precio) && precio >= 0 ? `Bs ${precio.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
                const etiquetaPrecio = precioTexto ? `<span class="status-text text-cm-variant fs-9 mt-1">${escaparHtml(precioTexto)}</span>` : `<span class="status-text text-cm-variant fs-9 mt-1">${escaparHtml(String(funcion.formato || ''))}</span>`;
                return `<button type="button" class="btn time-pill border-0 rounded-3 p-2 d-flex flex-column align-items-center justify-content-center" data-funcion-id="${idFuncion}" ${funcion.id_funcion == null ? 'disabled aria-disabled="true"' : ''} aria-label="Seleccionar función de las ${hora}, formato ${escaparHtml(String(funcion.formato || 'no indicado'))}"><span class="time-text fw-bold">${hora}</span>${etiquetaPrecio}</button>`;
            }).join('');
            tarjeta.innerHTML = `<div class="row align-items-center gy-3"><div class="col-lg-5 col-md-12"><div class="d-flex align-items-start gap-3"><div class="format-icon-box rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"><span class="material-symbols-outlined fs-3 text-cm-primary">${icono}</span></div><div><h3 class="font-display-headline text-white mb-1 fs-4 tracking-wide text-uppercase fw-bold">${escaparHtml(nombreSala)}</h3><p class="text-cm-variant fs-7 mb-0 lh-sm py-2 py-md-0">${escaparHtml(descripcion)}</p>${formatoResumen ? `<p class="text-cm-variant fs-8 mt-2 mb-0">Formatos disponibles: ${escaparHtml(formatoResumen)}</p>` : ''}</div></div></div><div class="col-lg-7 col-md-12 mt-4 mt-lg-0"><div class="showtime-buttons-grid">${funcionesHtml}</div></div></div>`;
            tarjeta.querySelectorAll('[data-funcion-id]').forEach(boton => {
                boton.addEventListener('click', () => {
                    const idFuncion = boton.dataset.funcionId;
                    if (!idFuncion) return;
                    window.location.href = `asientos.html?id_funcion=${encodeURIComponent(idFuncion)}&id_pelicula=${encodeURIComponent(idPelicula || '')}`;
                });
            });
            contenedor.appendChild(tarjeta);
            indiceSala++;
        });
    }

    function configurarFiltrosHorarios(funciones) {
        funcionesPelicula = Array.isArray(funciones) ? funciones.filter(f => f && ['2D', '3D'].includes(String(f.formato || '').toUpperCase())) : [];
        const picker = document.getElementById('scheduleFormatPicker');
        if (picker) {
            picker.querySelectorAll('[data-formato]').forEach(boton => {
                boton.addEventListener('click', () => {
                    formatoSeleccionado = boton.dataset.formato || 'TODOS';
                    picker.querySelectorAll('[data-formato]').forEach(opcion => {
                        const activo = opcion === boton;
                        opcion.classList.toggle('active', activo);
                        opcion.setAttribute('aria-pressed', String(activo));
                    });
                    renderizarHorarios();
                });
            });
        }
        renderizarDias();
        renderizarHorarios();
    }

    function actualizarPelicula(pelicula) {
        const titulo = textoSeguro(pelicula.titulo, 'Detalle de película');
        document.querySelectorAll('.movie-title, h1').forEach(el => ponerTexto(el, titulo));
        document.title = `${titulo} | CinePrime`;

        const posters = document.querySelectorAll('.poster-card img');
        posters.forEach(img => {
            if (pelicula.imagen) img.src = api.media(pelicula.imagen);
            img.alt = textoSeguro(pelicula.imagen_alt, `Póster de ${titulo}`);
        });

        const genero = textoSeguro(pelicula.genero);
        const estreno = textoSeguro(pelicula.fecha_estreno);
        const duracion = formatearDuracion(pelicula.duracion_minutos);
        const clasificacion = textoSeguro(pelicula.clasificacion);

        // Actualiza las etiquetas existentes sin modificar clases ni estructura visual.
        const header = document.querySelector('.movie-header');
        if (header) {
            // El único badge de categoría es el género. No tocar los badges de puntuaciones.
            header.querySelectorAll('.categorias-badges .badge').forEach((badge, index) => {
                if (index === 0 && genero) ponerTexto(badge, genero);
            });
            header.querySelectorAll('#informacion-header .d-flex.align-items-center.gap-2.mb-2 > span')
                .forEach(el => {
                    const valor = el.textContent.trim();
                    if (/^\d{4}$/.test(valor) && estreno) ponerTexto(el, estreno.slice(0, 4));
                    else if (/^\d+h\s*\d+m$/i.test(valor) && duracion) ponerTexto(el, duracion);
                });
            const anio = estreno ? estreno.slice(0, 4) : '';
            const mobileMeta = header.querySelector('#informacion-header .d-flex.align-items-center.gap-2.mb-2');
            if (mobileMeta) {
                const metaSpans = [...mobileMeta.querySelectorAll('span')];
                metaSpans.forEach(el => {
                    if (/^\d{4}$/.test(el.textContent.trim()) && anio) ponerTexto(el, anio);
                    if (/^\d+h\s*\d+m$/i.test(el.textContent.trim()) && duracion) ponerTexto(el, duracion);
                });
            }
        }

        const sinopsisCompleta = textoSeguro(pelicula.sinopsis);

        // El banner reutiliza la sinopsis real y CSS limita su vista a tres líneas.
        document.querySelectorAll('.banner-synopsis').forEach(el => {
            ponerTexto(el, sinopsisCompleta || 'Sin sinopsis disponible.');
            el.title = sinopsisCompleta;
        });

        // En la sección inferior se muestra la sinopsis completa, sin recortarla.
        const synopsis = document.querySelector('.synopsis-text');
        if (synopsis) {
            const paragraph = document.createElement('p');
            paragraph.className = 'mb-3';
            paragraph.textContent = sinopsisCompleta || 'Sin sinopsis disponible.';
            synopsis.replaceChildren(paragraph);
        }

        document.querySelectorAll('.meta-pill-card').forEach(card => {
            const label = card.querySelector('span')?.textContent?.trim().toLowerCase() || '';
            const strong = card.querySelector('strong');
            const small = card.querySelector('small');
            if (label === 'duración') {
                ponerTexto(strong, duracion.toUpperCase());
                ponerTexto(small, pelicula.duracion_minutos ? `${pelicula.duracion_minutos} minutos` : 'No disponible');
            } else if (label === 'género') {
                ponerTexto(strong, genero);
                if (small) small.textContent = '';
            } else if (label === 'clasificación') {
                ponerTexto(strong, clasificacion);
                if (small) small.textContent = '';
            }
        });

        const trailerUrl = textoSeguro(pelicula.trailer);
        document.querySelectorAll('[data-bs-target="#videoPlayerModal"]').forEach(btn => {
            if (trailerUrl) {
                btn.dataset.videoSrc = prepararUrlVideo(api.media(trailerUrl));
                btn.disabled = false;
                btn.removeAttribute('aria-disabled');
            } else {
                btn.dataset.videoSrc = '';
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            }
        });

        const creditos = Array.isArray(pelicula.creditos)
            ? pelicula.creditos.filter(c => c && c.nombre && c.rol)
            : [];
        const actores = creditos.filter(c => c.rol === 'ACTOR');
        const castGrid = document.querySelector('.cast-block .row');
        if (castGrid) {
            const plantilla = castGrid.querySelector('.col');
            castGrid.replaceChildren();
            actores.forEach(actor => {
                const col = plantilla ? plantilla.cloneNode(true) : document.createElement('div');
                col.className = plantilla ? plantilla.className : 'col';
                const nombre = col.querySelector('.cast-card strong');
                const personaje = col.querySelector('.cast-card small');
                const imagen = col.querySelector('.cast-card img');
                ponerTexto(nombre, actor.nombre);
                ponerTexto(personaje, actor.personaje || 'Reparto');
                if (imagen) {
                    imagen.removeAttribute('src');
                    imagen.alt = actor.nombre;
                    imagen.classList.add('d-none');
                }
                castGrid.appendChild(col);
            });
            const badgeReparto = document.querySelector('.cast-block .badge');
            if (badgeReparto) ponerTexto(badgeReparto, `${actores.length} ${actores.length === 1 ? 'Actor' : 'Actores'}`);
        }

        actualizarFichaTecnica(creditos, pelicula);
        actualizarGaleria(pelicula.multimedia);
        configurarFiltrosHorarios(pelicula.funciones);

        const comprar = document.querySelectorAll('.movie-header a[href="#horarios"]');
        comprar.forEach(enlace => enlace.href = '#horarios');
    }


    const ETIQUETAS_ROL = {
        DIRECTOR: 'Director',
        GUIONISTA: 'Guion',
        PRODUCTOR: 'Productor',
        COMPOSITOR: 'Banda sonora'
    };

    function actualizarFichaTecnica(creditos, pelicula) {
        const ficha = document.querySelector('.technical-sheet-card');
        const lista = ficha?.querySelector('ul');
        if (!lista) return;

        const paises = Array.isArray(pelicula.paises_produccion)
            ? pelicula.paises_produccion.map(p => p?.nombre).filter(Boolean)
            : [];
        const idioma = textoSeguro(pelicula.idioma_original?.nombre || pelicula.idioma);
        const filas = [];
        const roles = [...new Set(creditos.filter(c => c.rol !== 'ACTOR' && c.nombre).map(c => c.rol))];
        roles.forEach(rol => {
            const nombres = creditos
                .filter(c => c.rol === rol && c.nombre)
                .map(c => c.nombre.trim())
                .filter((nombre, index, todos) => todos.indexOf(nombre) === index);
            if (!nombres.length) return;
            filas.push({ etiqueta: ETIQUETAS_ROL[rol] || rol.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase()), valor: nombres.join(', ') });
        });
        filas.push({ etiqueta: 'Países de producción', valor: paises.join(', ') || 'No disponible' });
        filas.push({ etiqueta: 'Audio original', valor: idioma || 'No disponible' });

        const plantilla = lista.querySelector('li');
        lista.replaceChildren();
        filas.forEach(fila => {
            const li = plantilla ? plantilla.cloneNode(true) : document.createElement('li');
            li.className = plantilla ? plantilla.className : 'd-flex justify-content-between';
            const spans = li.querySelectorAll('span');
            let etiqueta = spans[0];
            let valor = li.querySelector('strong');
            if (!etiqueta) {
                etiqueta = document.createElement('span');
                li.appendChild(etiqueta);
            }
            if (!valor) {
                valor = document.createElement('strong');
                valor.className = 'text-white text-end';
                li.appendChild(valor);
            }
            ponerTexto(etiqueta, `${fila.etiqueta}:`);
            ponerTexto(valor, fila.valor);
            lista.appendChild(li);
        });
    }


    function actualizarGaleria(recursos) {
        const todos = Array.isArray(recursos) ? recursos.filter(r => r && r.url) : [];
        const videos = todos.filter(r => ['TRAILER', 'VIDEO'].includes(String(r.tipo).toUpperCase()));
        const imagenes = todos.filter(r => String(r.tipo).toUpperCase() === 'IMAGEN');
        const destacados = [...videos, ...imagenes].slice(0, 3);
        const featuredGrid = document.getElementById('galleryFeaturedGrid');
        const videosGrid = document.getElementById('galleryVideosGrid');
        const imagesGrid = document.getElementById('galleryImagesGrid');
        const archivoBtn = document.getElementById('galleryArchiveButton');
        const tituloArchivo = document.getElementById('galleryArchiveModalLabel');
        const pieArchivo = document.querySelector('#galleryArchiveModal .modal-footer > span');
        const videosTab = document.getElementById('trailers-tab');
        const imagesTab = document.getElementById('stills-tab');
        const total = videos.length + imagenes.length;

        if (archivoBtn) archivoBtn.innerHTML = `Ver Todo el Archivo (${total}) <span class="material-symbols-outlined fs-6">chevron_right</span>`;
        if (tituloArchivo) ponerTexto(tituloArchivo, `Archivo Multimedia (${total})`);
        if (videosTab) ponerTexto(videosTab, `Videos (${videos.length})`);
        if (imagesTab) ponerTexto(imagesTab, `Imágenes (${imagenes.length})`);
        if (pieArchivo) ponerTexto(pieArchivo, `Mostrando ${total} contenidos multimedia`);

        const card = (recurso, compact = false) => {
            const esVideo = ['TRAILER', 'VIDEO'].includes(String(recurso.tipo).toUpperCase());
            const urlOriginal = api.media(recurso.url);
            const url = esVideo ? prepararUrlVideo(urlOriginal) : urlOriginal;
            const alt = textoSeguro(recurso.texto_alternativo, esVideo ? 'Video de la película' : 'Fotograma de la película');
            const col = document.createElement('div');
            col.className = 'col';
            const wrapperClass = compact
                ? 'gallery-item-card rounded-3 overflow-hidden position-relative ratio ratio-16x9 bg-cm-surface-high border border-secondary border-opacity-10'
                : 'media-card rounded-4 overflow-hidden position-relative bg-cm-surface border border-secondary border-opacity-10 shadow-sm group-hover';
            const thumbnail = esVideo ? 'img/placeholder.png' : url;
            const label = esVideo ? (String(recurso.tipo).toUpperCase() === 'TRAILER' ? 'Tráiler' : 'Video') : 'Imagen';
            const safeUrl = escaparHtml(url);
            const safeThumb = escaparHtml(thumbnail);
            const safeAlt = escaparHtml(alt);
            if (compact) {
                col.innerHTML = `<div class="${wrapperClass}"><img src="${safeThumb}" alt="${safeAlt}" class="img-fluid object-fit-cover" loading="lazy"><div class="gallery-item-overlay d-flex flex-column justify-content-between p-2"><span class="badge ${esVideo ? 'bg-cm-brand-red' : 'bg-dark bg-opacity-75'} text-white align-self-start fs-9 fw-bold">${label.toUpperCase()}</span><div class="d-flex align-items-center justify-content-between gap-2"><span class="text-white fs-8 fw-bold text-truncate">${safeAlt}</span>${esVideo && url ? `<button type="button" class="btn btn-sm btn-play-micro rounded-circle p-1 d-flex align-items-center justify-content-center" data-bs-toggle="modal" data-bs-target="#videoPlayerModal" data-video-src="${safeUrl}" aria-label="Reproducir ${label}"><span class="material-symbols-outlined fill-icon fs-6">play_arrow</span></button>` : ''}</div></div></div>`;
            } else {
                col.innerHTML = `<div class="${wrapperClass}"><div class="media-thumbnail-wrapper position-relative ratio ratio-16x9"><img src="${safeThumb}" alt="${safeAlt}" class="img-fluid object-fit-cover media-img" loading="lazy">${esVideo && url ? `<div class="media-overlay d-flex align-items-center justify-content-center"><button type="button" class="btn-play-trigger rounded-circle border-0 d-flex align-items-center justify-content-center" data-bs-toggle="modal" data-bs-target="#videoPlayerModal" data-video-src="${safeUrl}" aria-label="Reproducir ${label}"><span class="material-symbols-outlined fill-icon fs-3">play_arrow</span></button></div>` : ''}</div><div class="media-card-body p-3 bg-cm-surface-high"><span class="text-white fw-bold fs-7 text-truncate d-block">${safeAlt}</span></div></div>`;
            }
            return col;
        };

        if (featuredGrid) {
            featuredGrid.replaceChildren();
            if (!destacados.length) {
                const col = document.createElement('div');
                col.className = 'col';
                col.innerHTML = '<div class="media-card rounded-4 overflow-hidden position-relative bg-cm-surface border border-secondary border-opacity-10 shadow-sm"><div class="media-thumbnail-wrapper position-relative ratio ratio-16x9"><img src="img/placeholder.png" alt="Sin contenido multimedia registrado" class="img-fluid object-fit-cover media-img" loading="lazy"></div><div class="media-card-body p-3 bg-cm-surface-high"><span class="text-white fw-bold fs-7">Sin contenido multimedia registrado</span></div></div>';
                featuredGrid.appendChild(col);
            } else destacados.forEach(recurso => featuredGrid.appendChild(card(recurso, false)));
        }
        if (videosGrid) {
            videosGrid.replaceChildren();
            if (videos.length) videos.forEach(recurso => videosGrid.appendChild(card(recurso, true)));
            else videosGrid.innerHTML = '<p class="text-cm-variant fs-7">No hay videos registrados para esta película.</p>';
        }
        if (imagesGrid) {
            imagesGrid.replaceChildren();
            if (imagenes.length) imagenes.forEach(recurso => imagesGrid.appendChild(card(recurso, true)));
            else imagesGrid.innerHTML = '<p class="text-cm-variant fs-7">No hay imágenes registradas para esta película.</p>';
        }
    }

    async function iniciar() {
        if (!idPelicula || !/^\d+$/.test(idPelicula)) {
            console.warn('Detalle CinePrime: falta un id_pelicula válido en la URL.');
            document.querySelectorAll('.movie-title, h1').forEach(el => ponerTexto(el, 'Película no especificada'));
            return;
        }
        if (!api) {
            console.error('No se cargó js/api-cineprime.js antes del detalle.');
            return;
        }
        try {
            const respuesta = await api.json(`/api/peliculas/${encodeURIComponent(idPelicula)}`);
            const pelicula = respuesta?.pelicula;
            if (!pelicula) throw new Error('La API no devolvió el detalle de la película.');
            actualizarPelicula(pelicula);
        } catch (error) {
            console.error('No se pudo cargar el detalle de la película:', error);
            const synopsis = document.querySelector('.synopsis-text');
            if (synopsis) {
                const mensaje = document.createElement('p');
                mensaje.className = 'mb-3';
                mensaje.textContent = 'No se pudo cargar la información de esta película. Comprueba que el backend esté iniciado.';
                synopsis.replaceChildren(mensaje);
            }
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
