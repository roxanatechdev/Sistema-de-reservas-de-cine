/* Solo muestra una entrada cuando el backend verifica pago aprobado + ticket emitido. */
(() => {
    'use strict';
    const STORAGE_KEY = 'cineprime_reservation_v1';
    const LAST_TICKET_KEY = 'cineprime_last_ticket_v1';
    const TICKET_HISTORY_KEY = 'cineprime_tickets_history_v1';
    const EMAIL_SIM_KEY = 'cineprime_email_simulated_v1';
    let currentTicketPayload = null;
    let currentSavedReservation = null;
    let viewingHistoricalTicket = false;
    const byId = id => document.getElementById(id);

    function readSavedReservation() {
        try {
            const selected = JSON.parse(localStorage.getItem('cineprime_selected_ticket_v1') || 'null');
            viewingHistoricalTicket = Boolean(selected && selected.id_compra && selected.token);
            const lastTicket = JSON.parse(localStorage.getItem(LAST_TICKET_KEY) || 'null');
            const activeReservation = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            const saved = selected && selected.id_compra && selected.token ? selected : (lastTicket && lastTicket.id_compra && lastTicket.token ? lastTicket : activeReservation);
            return saved && saved.id_compra && saved.token ? saved : null;
        } catch (_) { return null; }
    }

    function money(value) {
        const amount = Number(value);
        return `Bs ${Number.isFinite(amount) ? amount.toFixed(2).replace('.', ',') : '0,00'}`;
    }

    function setText(id, value) {
        const node = byId(id);
        if (node) node.textContent = value == null || value === '' ? '—' : String(value);
    }

    function dateText(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
    }

    function timeText(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    }

    function showFailure(message) {
        setText('confirmTitle', 'No se pudo validar la entrada');
        setText('confirmSubtitle', 'Todavía no podemos mostrar un comprobante válido.');
        setText('confirmStatusMessage', message || 'El servidor no confirmó un pago aprobado. Si acabas de pagar, vuelve a consultar el estado de la compra.');
        const icon = byId('confirmSuccessIcon');
        if (icon) {
            icon.hidden = false;
            icon.style.display = '';
            icon.classList.remove('check-icon-circle');
            icon.classList.add('check-icon-circle', 'border', 'border-danger');
            const symbol = icon.querySelector('.material-symbols-outlined');
            if (symbol) { symbol.textContent = 'close'; symbol.classList.add('text-danger'); }
        }
    }

    function renderTicket(payload) {
        currentTicketPayload = payload;
        const ticket = payload.ticket;
        const fn = ticket.funcion || {};
        const seats = Array.isArray(ticket.asientos) ? ticket.asientos : [];
        const products = Array.isArray(ticket.productos) ? ticket.productos : [];
        const seatNames = seats.map(seat => `${seat.fila}${seat.numero}`);
        const seatTotal = seats.reduce((sum, seat) => sum + Number(seat.precio || 0), 0);

        setText('confirmTitle', '¡Tu compra ha sido confirmada!');
        setText('confirmSubtitle', 'Tu noche de cine está lista 🍿');
        setText('confirmStatusMessage', `Pago aprobado. Entrada emitida el ${dateText(ticket.emitido_en)}. Guarda este comprobante para ingresar a la sala.`);
        setText('ticketMovieTitle', fn.pelicula || 'Función de CinePrime');
        setText('ticketFormat', fn.formato || 'Formato —');
        setText('ticketDuration', fn.duracion_minutos ? `${fn.duracion_minutos} min` : 'Duración —');
        setText('ticketClassification', fn.clasificacion ? `Clasificación ${fn.clasificacion}` : 'Clasificación —');
        setText('ticketDate', dateText(fn.inicio));
        setText('ticketTime', timeText(fn.inicio));
        setText('ticketRoom', fn.sala || '—');
        setText('ticketFormatValue', fn.formato || '—');
        setText('ticketSeats', seatNames.join(', ') || 'Sin asientos');
        setText('ticketEntryType', `${seats.length} entrada${seats.length === 1 ? '' : 's'}`);
        setText('ticketSeatPrice', money(seatTotal));
        setText('ticketCode', ticket.codigo_validacion);
        setText('ticketTotal', money(payload.compra?.total));

        const poster = byId('ticketMoviePoster');
        if (poster) poster.alt = `Póster de ${fn.pelicula || 'la película'}`;
        if (fn.id_pelicula) window.CinePrimeAPI.json(`/api/peliculas/${encodeURIComponent(fn.id_pelicula)}`).then(data => { const movie = data.pelicula || data; if (poster && movie.imagen) poster.src = movie.imagen; }).catch(() => {});
        const qr = byId('ticketQrImage');
        if (qr) {
            qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(ticket.codigo_validacion)}&color=11131c`;
            qr.alt = `Código QR del ticket ${ticket.codigo_validacion}`;
        }

        const ticketCard = byId('issuedTicketCard');
        if (ticketCard) { ticketCard.hidden = false; ticketCard.style.display = ''; }
        const badge = byId('ticketValidBadge');
        if (badge) { badge.hidden = false; badge.style.display = ''; }
        const icon = byId('confirmSuccessIcon');
        if (icon) { icon.hidden = false; icon.style.display = ''; }
        const closing = byId('ticketClosingMessage');
        if (closing) { closing.hidden = false; closing.style.display = ''; }
        const buttons = byId('ticketActionButtons');
        if (buttons) { buttons.hidden = false; buttons.style.display = ''; }
    }

    function simulateEmail(saved, ticket, resend = false) {
        const email = currentTicketPayload?.ticket?.comprador?.correo || saved?.comprador?.correo || saved?.correo || '';
        let sent = [];
        try { sent = JSON.parse(localStorage.getItem(EMAIL_SIM_KEY) || '[]'); } catch (_) { sent = []; }
        sent = Array.isArray(sent) ? sent : [];
        if (resend || !sent.some(item => String(item.id_compra) === String(saved?.id_compra))) {
            sent.unshift({ id_compra: saved?.id_compra, correo: email, fecha: new Date().toISOString(), estado: 'SIMULADO' });
            localStorage.setItem(EMAIL_SIM_KEY, JSON.stringify(sent.slice(0, 50)));
        }
        const notice = byId('ticketEmailNotice');
        if (notice) notice.textContent = `${resend ? 'Simulación de reenvío' : 'Simulación de envío automático'}: el ticket quedó preparado para ${email || 'el correo registrado en la compra'}. No se envió un correo real.`;
        setText('confirmStatusMessage', `${resend ? 'Reenvío simulado' : 'Envío automático simulado'} para ${email || 'el correo registrado'}. El ticket también está guardado en Mis compras.`);
    }

    function shareWhatsApp() {
        const payload = currentTicketPayload;
        if (!payload?.ticket) return;
        const ticket = payload.ticket;
        const fn = ticket.funcion || {};
        const seats = (ticket.asientos || []).map(seat => `${seat.fila}${seat.numero}`).join(', ');
        const message = `Mi ticket CinePrime\nPelícula: ${fn.pelicula || 'CinePrime'}\nFecha: ${dateText(fn.inicio)} ${timeText(fn.inicio)}\nSala: ${fn.sala || '—'}\nAsientos: ${seats || '—'}\nCódigo: ${ticket.codigo_validacion}\nConserva este código y valida la entrada con el cine.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const saved = readSavedReservation();
        currentSavedReservation = saved;
        if (!saved) {
            showFailure('No encontramos el acceso a una reserva en este navegador. No se mostrará una entrada hasta que el servidor valide la compra.');
            return;
        }

        try {
            const response = await window.CinePrimeAPI.json(`/api/compras/${encodeURIComponent(saved.id_compra)}/ticket`, {
                headers: { 'X-Reserva-Token': saved.token }
            });
            if (!response.ticket || response.ticket.estado !== 'EMITIDO' || response.pago?.estado !== 'APROBADO' || response.compra?.estado !== 'CONFIRMADA') {
                throw new Error('El servidor no confirmó un pago aprobado y un ticket emitido.');
            }
            const confirmed = { ...saved, estado: 'CONFIRMADA', pago_estado: 'APROBADO', codigo_ticket: response.ticket.codigo_validacion, guardado_en: new Date().toISOString() };
            if (!viewingHistoricalTicket) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(confirmed));
                localStorage.setItem(LAST_TICKET_KEY, JSON.stringify(confirmed));
            }
            let history = []; try { history = JSON.parse(localStorage.getItem(TICKET_HISTORY_KEY) || '[]'); } catch (_) {}
            history = Array.isArray(history) ? history : [];
            const alreadySaved = history.some(item => String(item.id_compra) === String(confirmed.id_compra));
            if (!viewingHistoricalTicket || !alreadySaved) {
                history = history.filter(item => String(item.id_compra) !== String(confirmed.id_compra));
                history.unshift(confirmed);
            }
            localStorage.setItem(TICKET_HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
            localStorage.removeItem('cineprime_selected_ticket_v1');
            renderTicket(response);
            if (!viewingHistoricalTicket) simulateEmail(confirmed, response.ticket);
        } catch (error) {
            showFailure(error.message || 'No se pudo verificar el ticket con el backend.');
        }

        byId('btnDownloadTicket')?.addEventListener('click', () => window.print());
        byId('btnEmailTicket')?.addEventListener('click', () => { if (currentSavedReservation && currentTicketPayload) simulateEmail(currentSavedReservation, currentTicketPayload.ticket, true); });
        byId('btnShareTicket')?.addEventListener('click', () => shareWhatsApp());
        byId('btnCopyTicketCode')?.addEventListener('click', async () => {
            const code = byId('ticketCode')?.textContent || '';
            if (!code || code === '—') return;
            try {
                await navigator.clipboard.writeText(code);
                setText('confirmStatusMessage', 'Código de validación copiado. Guarda este comprobante para ingresar a la sala.');
            } catch (_) {
                setText('confirmStatusMessage', `Código de validación: ${code}`);
            }
        });
        byId('btnTicketHome')?.addEventListener('click', () => { window.location.href = 'index.html'; });
    });
})();
