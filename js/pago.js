/* Flujo de pago simulado CinePrime. No se envían ni procesan datos bancarios reales. */
(() => {
    'use strict';

    const STORAGE_KEY = 'cineprime_reservation_v1';
    const LAST_TICKET_KEY = 'cineprime_last_ticket_v1';
    const TICKET_HISTORY_KEY = 'cineprime_tickets_history_v1';
    const EMAIL_SIM_KEY = 'cineprime_email_simulated_v1';
    let savedReservation = null;
    let currentReservation = null;
    let selectedPaymentMethod = 'TARJETA';
    let countdownId = null;
    let expiryCheckStarted = false;
    let paymentInProgress = false;
    let purchaseType = 'ENTRADAS';

    const byId = id => document.getElementById(id);

    function readSavedReservation() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            return value && value.id_compra && value.token ? value : null;
        } catch (_) {
            return null;
        }
    }

    function readCartState() {
        try {
            const cart = JSON.parse(localStorage.getItem('cineprime_cart_v1') || 'null');
            return cart && cart.version === 1 ? { ...cart, seats: Array.isArray(cart.seats) ? cart.seats : [], products: Array.isArray(cart.products) ? cart.products : [] } : { functionId: null, seats: [], products: [] };
        } catch (_) { return { functionId: null, seats: [], products: [] }; }
    }

    function renderLocalProductsPreview() {
        const cart = readCartState();
        const rows = cart.products.filter(item => Number(item.sourceId || item.id) > 0).map(item => {
            const amount = Number(item.precio || 0) * Number(item.cantidad || 0);
            return `<div class="cost-row"><span>${escapeHtml(item.nombre)} ×${Number(item.cantidad || 0)}</span><span class="text-white fw-medium">${money(amount)}</span></div>`;
        });
        const total = cart.products.reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.cantidad || 0), 0);
        const breakdown = byId('paymentBreakdown');
        if (breakdown) breakdown.innerHTML = rows.length ? rows.join('') : '<div class="cost-row"><span>No hay productos válidos en el carrito</span><span>—</span></div>';
        setText('paymentSubtotal', money(total));
        setText('paymentTotal', money(total));
        setText('paymentQrAmount', money(total));
        setText('paymentQrReference', 'Nueva compra de confitería');
        setText('paymentTotalHint', 'Estimación previa; se validará al crear la compra');
        const details = byId('paymentMovieDetails');
        if (details) { details.hidden = false; details.style.display = ''; }
        const functionDetails = byId('paymentFunctionDetails');
        if (functionDetails) { functionDetails.hidden = true; functionDetails.style.display = 'none'; }
        const poster = byId('paymentMoviePoster');
        if (poster) poster.style.display = 'none';
        const meta = byId('paymentMovieMetaBadges');
        if (meta) { meta.hidden = true; meta.style.display = 'none'; }
        const title = byId('paymentMovieTitle');
        if (title) title.textContent = 'Compra de confitería';
        const buyer = byId('paymentBuyerDetails');
        if (buyer) { buyer.hidden = false; buyer.style.display = ''; }
        const button = byId('btnPayNow');
        if (button) { button.disabled = rows.length === 0 || total <= 0; button.innerHTML = '<span class="material-symbols-outlined">receipt_long</span> Crear compra y revisar importe <span class="material-symbols-outlined">arrow_forward</span>'; }
        const timer = byId('qrTimer');
        if (timer) timer.textContent = '—';
        purchaseType = 'CONFITERIA';
    }

    async function createPurchaseFromCart() {
        const cart = readCartState();
        const products = cart.products.filter(item => Number(item.sourceId || item.id) > 0 && Number(item.cantidad) > 0)
            .map(item => ({ id_producto: Number(item.sourceId || item.id), cantidad: Number(item.cantidad) }));
        if (!products.length || cart.seats.length) {
            throw new Error('No encontramos productos válidos para una compra independiente de confitería. Vuelve al carrito y revisa tu selección.');
        }
        const name = byId('snackBuyerName')?.value.trim() || '';
        const email = byId('snackBuyerEmail')?.value.trim() || '';
        const phone = byId('snackBuyerPhone')?.value.trim() || '';
        if (name.length < 2) throw new Error('Escribe tu nombre completo para continuar.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe un correo electrónico válido.');

        const payload = await window.CinePrimeAPI.json('/api/compras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: name, correo: email, telefono: phone || null, productos: products })
        });
        const reservation = payload.reserva;
        savedReservation = {
            id_compra: reservation.id_compra,
            token: reservation.token,
            estado: reservation.estado,
            vence_reserva: reservation.vence_reserva,
            functionId: null,
            tipo_compra: 'CONFITERIA'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReservation));
        purchaseType = 'CONFITERIA';
        if (byId('paymentBuyerDetails')) { byId('paymentBuyerDetails').hidden = true; byId('paymentBuyerDetails').style.display = 'none'; }
        renderReservation(reservation);
        const button = byId('btnPayNow');
        if (button) { button.disabled = false; button.innerHTML = '<span class="material-symbols-outlined">lock</span> Confirmar y pagar <span class="material-symbols-outlined">arrow_forward</span>'; }
        showOutcome('La compra fue creada y el importe se validó con el servidor. Revisa el resumen y pulsa «Confirmar y pagar» para continuar.', 'info');
        return reservation;
    }

    function saveReservation(patch) {
        if (!savedReservation) return;
        savedReservation = { ...savedReservation, ...patch };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedReservation));
        if (savedReservation.estado === 'CONFIRMADA' && savedReservation.codigo_ticket) {
            localStorage.setItem(LAST_TICKET_KEY, JSON.stringify(savedReservation));
        }
    }

    function money(value) {
        const amount = Number(value);
        return `Bs ${Number.isFinite(amount) ? amount.toFixed(2).replace('.', ',') : '0,00'}`;
    }

    function showToast(message) {
        const toast = byId('cmToast');
        const messageNode = byId('toastMessage');
        if (messageNode) messageNode.textContent = message;
        if (toast) {
            toast.classList.add('show');
            window.setTimeout(() => toast.classList.remove('show'), 4500);
        } else {
            window.alert(message);
        }
    }

    function showOutcome(message, kind = 'info') {
        let node = byId('paymentOutcomeMessage');
        if (!node) {
            node = document.createElement('div');
            node.id = 'paymentOutcomeMessage';
            node.className = 'alert mt-3';
            node.setAttribute('role', 'status');
            byId('btnPayNow')?.parentElement?.before(node);
        }
        node.className = `alert mt-3 alert-${kind}`;
        node.textContent = message;
        node.hidden = false;
    }

    function formatDate(value) {
        if (!value) return 'Fecha por confirmar';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
        return new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }

    function formatTime(value) {
        if (!value) return 'Hora por confirmar';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Hora por confirmar';
        return new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    }

    function setText(id, value) {
        const node = byId(id);
        if (node) node.textContent = value == null || value === '' ? '—' : String(value);
    }

    function renderReservation(reservation) {
        currentReservation = reservation;
        const fn = reservation.funcion || {};
        const seats = Array.isArray(reservation.asientos) ? reservation.asientos : [];
        const products = Array.isArray(reservation.productos) ? reservation.productos : [];
        const seatLabel = seats.map(seat => `${seat.fila}${seat.numero}`).join(', ') || '—';
        purchaseType = seats.length ? 'ENTRADAS' : 'CONFITERIA';
        const movieDetails = byId('paymentMovieDetails');
        const moviePoster = byId('paymentMoviePoster');
        const movieMeta = byId('paymentMovieMetaBadges');
        const functionDetails = byId('paymentFunctionDetails');
        if (movieDetails) { movieDetails.hidden = false; movieDetails.style.display = ''; }
        if (moviePoster) moviePoster.style.display = seats.length ? '' : 'none';
        if (movieMeta) { movieMeta.hidden = !seats.length; movieMeta.style.display = seats.length ? '' : 'none'; }
        if (functionDetails) { functionDetails.hidden = !seats.length; functionDetails.style.display = seats.length ? '' : 'none'; }
        const buyerDetails = byId('paymentBuyerDetails');
        if (buyerDetails) { buyerDetails.hidden = true; buyerDetails.style.display = 'none'; }

        const movieTitle = seats.length ? (typeof fn.pelicula === 'string' ? fn.pelicula : (fn.pelicula?.titulo || fn.titulo || 'Película no disponible')) : 'Compra de confitería';
        setText('paymentMovieTitle', movieTitle);
        const poster = byId('paymentMoviePoster');
        const setPosterFallback = () => {
            if (!poster) return;
            poster.onerror = null;
            poster.src = 'https://placehold.co/100x150/191b24/e1e1ef?text=Poster+no+disponible';
            poster.alt = 'Póster no disponible';
        };
        if (poster) {
            poster.alt = movieTitle !== 'Película no disponible' ? `Póster de ${movieTitle}` : 'Póster no disponible';
            poster.onerror = setPosterFallback;
            setPosterFallback();
        }
        const movieId = fn.id_pelicula || fn.pelicula?.id_pelicula;
        if (seats.length && movieId) {
            window.CinePrimeAPI.json(`/api/peliculas/${encodeURIComponent(movieId)}`).then(data => {
                const movie = data.pelicula || data;
                if (movie.titulo) setText('paymentMovieTitle', movie.titulo);
                if (poster && movie.imagen) {
                    poster.onerror = setPosterFallback;
                    poster.src = window.CinePrimeAPI.media(movie.imagen);
                    poster.alt = movie.imagen_alt || `Póster de ${movie.titulo || movieTitle}`;
                }
            }).catch(error => console.warn('No se pudo cargar la ficha de la película para el resumen de pago:', error));
        }
        setText('paymentFunctionDate', fn.inicio ? formatDate(fn.inicio) : 'Fecha no disponible');
        setText('paymentFunctionTime', fn.inicio ? `${formatTime(fn.inicio)} hrs` : 'Hora no disponible');
        setText('paymentRoom', fn.sala || 'No disponible');
        setText('paymentSeats', seatLabel);
        const setBadge = (id, value) => {
            const node = byId(id);
            if (!node) return;
            node.textContent = value || '';
            node.hidden = !value;
        };
        setBadge('paymentFormatBadge', fn.formato || '');
        setBadge('paymentDurationBadge', fn.duracion_minutos ? `${fn.duracion_minutos} min` : '');
        setBadge('paymentClassificationBadge', fn.clasificacion ? `Clasificación ${fn.clasificacion}` : '');
        setText('paymentSubtotal', money(reservation.total));
        setText('paymentTotal', money(reservation.total));
        setText('paymentTotalHint', 'Importe validado por el servidor');
        setText('paymentQrAmount', money(reservation.total));
        setText('paymentQrReference', `${seats.length ? 'Reserva' : 'Compra'} #${reservation.id_compra}`);

        const qr = byId('paymentQrImage');
        if (qr) {
            const qrData = `CINEPRIME-DEMO|COMPRA:${reservation.id_compra}|IMPORTE:${reservation.total}|NO-ES-UN-PAGO-REAL`;
            qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}&color=11131c`;
            qr.alt = `Código QR ilustrativo para la reserva ${reservation.id_compra}; no sirve para pagar`;
        }

        const rows = [];
        seats.forEach(seat => {
            rows.push(`<div class="cost-row"><span>Entrada ${escapeHtml(`${seat.fila}${seat.numero}`)}</span><span class="text-white fw-medium">${money(seat.precio)}</span></div>`);
        });
        products.forEach(item => {
            const amount = Number(item.precio_unitario || 0) * Number(item.cantidad || 0);
            rows.push(`<div class="cost-row"><span>${escapeHtml(item.nombre)} ×${Number(item.cantidad || 0)}</span><span class="text-white fw-medium">${money(amount)}</span></div>`);
        });
        const breakdown = byId('paymentBreakdown');
        if (breakdown) breakdown.innerHTML = rows.length ? rows.join('') : '<div class="cost-row"><span>No hay conceptos de cobro disponibles</span><span class="text-white fw-medium">—</span></div>';

        const expiry = Date.parse(reservation.vence_reserva || '');
        const status = String(reservation.estado || '').toUpperCase();
        const active = ['INICIADA', 'PENDIENTE_PAGO'].includes(status) && (!Number.isFinite(expiry) || expiry > Date.now());
        const payButton = byId('btnPayNow');
        if (payButton) payButton.disabled = !active;
        if (!active && status !== 'CONFIRMADA') {
            showOutcome(purchaseType === 'CONFITERIA' ? 'Esta compra de confitería ya no está activa. Vuelve al catálogo para iniciar otra compra.' : 'Esta reserva ya no está activa. Regresa a la selección de asientos para comprobar la disponibilidad.', 'danger');
        }
        if (status === 'CONFIRMADA' && payButton) payButton.disabled = true;
        updateCountdown(status === 'CONFIRMADA' ? null : reservation.vence_reserva);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function updateCountdown(expiresAt) {
        if (countdownId) window.clearInterval(countdownId);
        const expiry = Date.parse(expiresAt || '');
        const timerNode = byId('qrTimer');
        const tick = () => {
            const seconds = Number.isFinite(expiry) ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : 0;
            if (timerNode) timerNode.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            if (seconds <= 0 && !expiryCheckStarted) {
                expiryCheckStarted = true;
                if (countdownId) window.clearInterval(countdownId);
                countdownId = null;
                verifyReservationAfterExpiry();
            }
        };
        tick();
        if (Number.isFinite(expiry) && expiry > Date.now()) countdownId = window.setInterval(tick, 1000);
    }

    async function fetchReservation() {
        const payload = await window.CinePrimeAPI.json(`/api/compras/${encodeURIComponent(savedReservation.id_compra)}/reserva`, {
            headers: { 'X-Reserva-Token': savedReservation.token }
        });
        return payload.reserva;
    }

    async function verifyReservationAfterExpiry() {
        try {
            const reservation = await fetchReservation();
            if (reservation) {
                renderReservation(reservation);
                if (!['INICIADA', 'PENDIENTE_PAGO'].includes(String(reservation.estado || '').toUpperCase())) {
                    showOutcome('La reserva venció o dejó de estar activa. El backend ya no acepta pagos para esta reserva.', 'danger');
                }
            }
        } catch (error) {
            showOutcome(error.message || 'No pudimos verificar el vencimiento. Comprueba la conexión antes de continuar.', 'warning');
        }
    }

    window.selectPayment = function (selectedId) {
        document.querySelectorAll('.payment-option-card').forEach(option => option.classList.remove('selected'));
        const target = byId(selectedId);
        if (target) target.classList.add('selected');
        selectedPaymentMethod = selectedId === 'opt-qr' ? 'QR' : 'TARJETA';
    };

    function rememberTicket(reservation, ticket) {
        if (!reservation || !ticket || !reservation.id_compra || !reservation.token) return;
        const record = { ...reservation, estado: 'CONFIRMADA', pago_estado: 'APROBADO', codigo_ticket: ticket.codigo_validacion, guardado_en: new Date().toISOString() };
        localStorage.setItem(LAST_TICKET_KEY, JSON.stringify(record));
        let history = [];
        try { history = JSON.parse(localStorage.getItem(TICKET_HISTORY_KEY) || '[]'); } catch (_) { history = []; }
        history = Array.isArray(history) ? history.filter(item => String(item.id_compra) !== String(record.id_compra)) : [];
        history.unshift(record);
        localStorage.setItem(TICKET_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
        // Simulación explícita: no se afirma que haya salido un correo real.
        let sent = [];
        try { sent = JSON.parse(localStorage.getItem(EMAIL_SIM_KEY) || '[]'); } catch (_) { sent = []; }
        sent = Array.isArray(sent) ? sent : [];
        if (!sent.some(item => String(item.id_compra) === String(record.id_compra))) {
            sent.unshift({ id_compra: record.id_compra, correo: reservation.comprador?.correo || '', fecha: new Date().toISOString(), estado: 'SIMULADO' });
            localStorage.setItem(EMAIL_SIM_KEY, JSON.stringify(sent.slice(0, 50)));
        }
    }

    window.handlePayment = async function () {
        if (paymentInProgress) return;
        const button = byId('btnPayNow');
        const originalContent = button?.innerHTML;
        paymentInProgress = true;
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Procesando simulación…';
        }
        try {
            if (!savedReservation) {
                await createPurchaseFromCart();
                return;
            }
            const outcome = byId('simulatedResult')?.value || 'APROBADO';
            const result = await window.CinePrimeAPI.json(`/api/compras/${encodeURIComponent(savedReservation.id_compra)}/pago`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Reserva-Token': savedReservation.token },
                body: JSON.stringify({ metodo: selectedPaymentMethod, resultado_simulado: outcome })
            });
            const paymentState = String(result.pago?.estado || '').toUpperCase();
            if (paymentState === 'APROBADO' && result.compra?.estado === 'CONFIRMADA') {
                const isSnackOnly = purchaseType === 'CONFITERIA' || !result.ticket;
                if (result.ticket) {
                    saveReservation({ estado: 'CONFIRMADA', pago_estado: 'APROBADO', codigo_ticket: result.ticket.codigo_validacion });
                    rememberTicket({ ...savedReservation, ...(currentReservation || {}), token: savedReservation.token }, result.ticket);
                } else {
                    saveReservation({ estado: 'CONFIRMADA', pago_estado: 'APROBADO', tipo_compra: 'CONFITERIA' });
                }
                setText('paymentResultTitle', '¡Pago aprobado!');
                setText('paymentResultMessage', isSnackOnly ? 'Tu compra de confitería fue confirmada. No se emitió una entrada de cine.' : 'El servidor confirmó la compra y emitió tu entrada. Puedes abrir el comprobante para ver el código de validación.');
                setText('paymentResultCode', result.ticket?.codigo_validacion || `Compra #${result.compra.id_compra}`);
                const codeRow = byId('paymentResultCodeRow');
                if (codeRow) codeRow.querySelector('span')?.replaceChildren(document.createTextNode(isSnackOnly ? 'Código de compra:' : 'Código de entrada:'));
                setText('paymentResultAmount', money(result.pago.importe));
                const viewButton = byId('btnViewTicket');
                if (viewButton) viewButton.textContent = isSnackOnly ? 'Volver a confitería' : 'Ver mi entrada';
                const icon = byId('paymentResultIcon');
                if (icon) { icon.textContent = 'check_circle'; icon.className = 'material-symbols-outlined display-3 animate-bounce text-success'; }
                const modalNode = byId('paymentModal');
                if (modalNode && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(modalNode).show();
                else window.location.href = isSnackOnly ? 'confiteria.html' : 'confirmacion.html';
                if (isSnackOnly) {
                    localStorage.removeItem(STORAGE_KEY);
                    if (window.CinePrimeCart?.clear) window.CinePrimeCart.clear();
                    else localStorage.removeItem('cineprime_cart_v1');
                    savedReservation = null;
                    showOutcome('Pago aprobado. Tu compra de confitería fue confirmada.', 'success');
                } else {
                    showOutcome('Pago aprobado. Tu entrada ya fue emitida por el backend.', 'success');
                }
            } else if (paymentState === 'RECHAZADO') {
                showOutcome('El pago fue rechazado en la simulación. No se emitió ningún ticket y tu reserva sigue activa hasta su vencimiento. Puedes volver a intentar el pago.', 'danger');
                if (button) button.disabled = false;
            } else {
                showOutcome('El pago quedó pendiente en la simulación. No se emitió ningún ticket. Puedes volver a intentar antes de que venza la reserva.', 'warning');
                if (button) button.disabled = false;
            }
        } catch (error) {
            showOutcome(error.message || 'No se pudo procesar el pago simulado. Comprueba el estado de la reserva e inténtalo nuevamente.', 'danger');
            if (error.status === 409) {
                try { renderReservation(await fetchReservation()); } catch (_) { /* el mensaje original se conserva */ }
            } else if (button) {
                button.disabled = false;
            }
        } finally {
            paymentInProgress = false;
            if (button && button.innerHTML.includes('Procesando simulación')) button.innerHTML = originalContent || 'Pagar ahora';
        }
    };

    window.downloadQR = function (event) {
        event?.stopPropagation();
        showToast('Este QR es solo ilustrativo y no sirve para realizar transferencias.');
    };

    window.copyGlosa = async function (event) {
        event?.stopPropagation();
        const reference = `CINEPRIME-SIM-${savedReservation?.id_compra || 'RESERVA'}`;
        try {
            await navigator.clipboard.writeText(reference);
            showToast(`Referencia de prueba copiada: ${reference}`);
        } catch (_) {
            showToast(`Referencia de prueba: ${reference}`);
        }
    };

    document.addEventListener('DOMContentLoaded', async () => {
        savedReservation = readSavedReservation();
        const cart = readCartState();
        const isSnackCheckout = !cart.seats.length && cart.products.some(item => Number(item.sourceId || item.id) > 0);
        const backLink = byId('backToSeatsLink');
        if (savedReservation?.functionId && backLink) backLink.href = `asientos.html?id_funcion=${encodeURIComponent(savedReservation.functionId)}`;
        if (isSnackCheckout && backLink) { backLink.href = 'confiteria.html'; backLink.lastChild.textContent = ' Volver a confitería'; }
        byId('btnViewTicket')?.addEventListener('click', () => {
            window.location.href = purchaseType === 'CONFITERIA' ? 'confiteria.html' : 'confirmacion.html';
        });

        // Una compra anterior confirmada no debe bloquear una nueva compra independiente de confitería.
        if (savedReservation?.estado === 'CONFIRMADA' && isSnackCheckout && !cart.seats.length) {
            localStorage.removeItem(STORAGE_KEY);
            savedReservation = null;
        }

        if (!savedReservation) {
            if (isSnackCheckout) {
                renderLocalProductsPreview();
            } else {
                const button = byId('btnPayNow');
                if (button) button.disabled = true;
                showOutcome('No hay una reserva activa ni productos de confitería válidos para pagar. Vuelve al carrito y revisa tu selección.', 'danger');
            }
            return;
        }

        try {
            const reservation = await fetchReservation();
            if (reservation?.estado === 'CONFIRMADA') {
                saveReservation({ estado: 'CONFIRMADA' });
                if (savedReservation.tipo_compra === 'CONFITERIA' || !(reservation.asientos || []).length) {
                    purchaseType = 'CONFITERIA';
                    renderReservation(reservation);
                    showOutcome('Esta compra de confitería ya fue confirmada. No hace falta volver a pagar.', 'success');
                } else {
                    window.location.href = 'confirmacion.html';
                }
                return;
            }
            renderReservation(reservation);
            if (!['INICIADA', 'PENDIENTE_PAGO'].includes(String(reservation?.estado || '').toUpperCase())) {
                showOutcome('La compra está vencida, cancelada o ya no admite pagos. Vuelve al catálogo o a la selección de asientos.', 'danger');
            }
        } catch (error) {
            const button = byId('btnPayNow');
            if (button) button.disabled = true;
            showOutcome(error.message || 'No pudimos recuperar la compra. Verifica la conexión con el backend.', 'danger');
        }
    });
})();
