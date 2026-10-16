/**
 * Carga los datos del ticket seleccionado dentro del Modal QR
 */
function loadQrData(movieTitle, roomInfo, seats, ticketCode) {
    document.getElementById("modal-movie-title").textContent = movieTitle;
    document.getElementById("modal-ticket-info").textContent = `${roomInfo} • Asientos: ${seats}`;
    document.getElementById("modal-ticket-code").textContent = ticketCode;

    // Generar la URL dinámica del QR
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticketCode + '-' + movieTitle)}`;
    document.getElementById("modal-qr-img").src = qrApiUrl;
}