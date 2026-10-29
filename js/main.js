/* ==========================================================================
   CINEPRIME - CORE JS, CARGA DINÁMICA & COMPONENTES REUTILIZABLES
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // Carga el carrito compartido en todas las páginas que reutilizan el navbar.
    loadCarritoModule();

    // 1. Cargar el Navbar dinámicamente
    loadNavbar();

    // 2. Cargar el Footer adecuado según el tipo de página
    loadFooter();
    loadAuthModal();
});


function loadCarritoModule() {
    if (window.CinePrimeCart || document.querySelector('script[data-cineprime-cart]')) return;
    const script = document.createElement('script');
    script.src = 'js/carrito.js';
    script.dataset.cineprimeCart = 'true';
    script.defer = true;
    document.body.appendChild(script);
}

/* ==========================================================================
   1. MÓDULO NAVBAR DINÁMICO
   ========================================================================== */

/**
 * Carga asíncrona del Navbar y arranque de sus dependencias
 */
function loadNavbar() {
    const container = document.getElementById("navbar-container");
    if (!container) return;

    fetch("navbar.html")
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudo cargar navbar.html`);
            }
            return response.text();
        })
        .then(html => {
            container.innerHTML = html;

            const header = document.getElementById("main-header");
            let currentPath = window.location.pathname.split("/").pop();

            if (header) {
                // Si es la portada (index.html)
                if (!currentPath || currentPath === "" || currentPath ===  "index.html" ) {
                    header.classList.remove("sticky-top");
                    header.classList.add("fixed-top");
                    container.classList.remove("sticky-top"); // En Inicio no queremos sticky en el contenedor
                } else {
                    // En Confitería y demás páginas
                    header.classList.remove("fixed-top", "sticky-top");
                    container.classList.add("sticky-top"); // El contenedor externo se hace sticky
                }
            }

            highlightActiveLink();
            initScrollHeader();
            initBootstrapComponents();
            initNavbarReservationTimer();
        })
        .catch(error => console.error("Error al cargar el navbar:", error));
}

/**
 * Detecta la página actual y aplica los estilos activos (.active)
 */
function highlightActiveLink() {
    let currentPath = window.location.pathname.split("/").pop();
    if (!currentPath || currentPath === "") {
        currentPath = "index.html";
    }

    const links = document.querySelectorAll(".nav-link-custom, .mobile-nav-link");

    links.forEach(link => {
        const linkPath = link.getAttribute("href");

        if (linkPath === currentPath) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        } else {
            link.classList.remove("active");
            link.removeAttribute("aria-current");
        }
    });
}

/**
 * Aplica fondo oscuro traslúcido al hacer scroll
 */
function initScrollHeader() {
    const header = document.getElementById("main-header");
    if (!header) return;

    const handleScroll = () => {
        if (window.scrollY > 40) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
}

/**
 * Activa manualmente el menú colapsable en móviles para HTML inyectado
 */
function initBootstrapComponents() {
    const mobilePanel = document.getElementById("mobile-nav-panel");

    if (mobilePanel && typeof bootstrap !== "undefined") {
        new bootstrap.Collapse(mobilePanel, {
            toggle: false
        });
    }
}

/* ==========================================================================
   CONTADOR GLOBAL DE RESERVA ACTIVA
   Se basa en la expiración confirmada por el backend y persiste entre páginas.
   ========================================================================== */
function initNavbarReservationTimer() {
    const link = document.getElementById('navbarReservationTimer');
    const timeNode = document.getElementById('navbarReservationTime');
    if (!link || !timeNode) return;

    const storageKey = 'cineprime_reservation_v1';
    const hosts = ['http://cine-backend.test', 'http://127.0.0.1:8000'];
    let intervalId = null;
    let checking = false;
    let expiryMs = 0;
    let lastExpiryCheckAt = 0;

    const readSaved = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
            return saved && saved.id_compra && saved.token ? saved : null;
        } catch (_) { return null; }
    };

    const hide = () => {
        if (intervalId !== null) window.clearInterval(intervalId);
        intervalId = null;
        link.hidden = true;
        link.classList.add('d-none');
        link.classList.remove('d-inline-flex');
    };

    const show = () => {
        link.hidden = false;
        link.classList.remove('d-none');
        link.classList.add('d-inline-flex');
    };

    const clearExpiredReservation = () => {
        localStorage.removeItem(storageKey);
        if (window.CinePrimeCart && typeof window.CinePrimeCart.clear === 'function') {
            window.CinePrimeCart.clear();
        }
        hide();
    };

    const render = () => {
        const seconds = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
        const minutesText = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secondsText = String(seconds % 60).padStart(2, '0');
        timeNode.textContent = `${minutesText}:${secondsText}`;
        link.classList.toggle('border-danger', seconds <= 60);
        link.classList.toggle('text-danger', seconds <= 60);
        link.title = seconds <= 60
            ? 'Tu reserva está por vencer. Haz clic para volver a ella.'
            : 'Tiempo restante de tu reserva. Haz clic para volver a ella.';
        if (seconds <= 0 && Date.now() - lastExpiryCheckAt >= 15000) {
            lastExpiryCheckAt = Date.now();
            verifyReservation(true);
        }
    };

    async function requestReservation(saved) {
        let lastError;
        for (const host of hosts) {
            try {
                const response = await fetch(`${host}/api/compras/${encodeURIComponent(saved.id_compra)}/reserva`, {
                    method: 'GET',
                    headers: { Accept: 'application/json', 'X-Reserva-Token': saved.token },
                    signal: AbortSignal.timeout(6000)
                });
                if (!response.ok) {
                    // Un estado no exitoso en el endpoint de reserva debe verificarse
                    // contra el otro host, que puede ser el mismo backend con otro dominio.
                    lastError = new Error(`HTTP ${response.status}`);
                    continue;
                }
                return await response.json();
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('No se pudo verificar la reserva.');
    }

    async function verifyReservation(fromExpiry = false) {
        if (checking) return;
        const saved = readSaved();
        if (!saved) { hide(); return; }
        checking = true;
        try {
            const payload = await requestReservation(saved);
            const reservation = payload?.reserva;
            const reservationState = String(reservation?.estado || '').toUpperCase();
            if (reservation && reservationState === 'CONFIRMADA') {
                // Conservamos el token para que confirmacion.html pueda recuperar el ticket,
                // pero ocultamos el contador porque ya no existe una reserva pendiente.
                localStorage.setItem(storageKey, JSON.stringify({ ...saved, estado: 'CONFIRMADA' }));
                hide();
                return;
            }
            const validStates = ['INICIADA', 'PENDIENTE_PAGO'];
            const parsedExpiry = Date.parse(reservation?.vence_reserva || '');
            if (!reservation || !validStates.includes(reservationState) || !Number.isFinite(parsedExpiry) || parsedExpiry <= Date.now()) {
                clearExpiredReservation();
                return;
            }
            expiryMs = parsedExpiry;
            // Actualiza la expiración local con el dato oficial del servidor.
            localStorage.setItem(storageKey, JSON.stringify({ ...saved, estado: reservationState, vence_reserva: reservation.vence_reserva }));
            show();
            render();
        } catch (error) {
            // Si no hay conexión, conservamos el contador local y no borramos la reserva.
            console.warn('No se pudo verificar la reserva desde el navbar:', error);
            if (fromExpiry) {
                timeNode.textContent = '00:00';
                link.title = 'El tiempo terminó, pero no pudimos confirmar el estado. Comprueba tu conexión.';
            }
        } finally {
            checking = false;
        }
    }

    const saved = readSaved();
    if (!saved) { hide(); return; }
    if (String(saved.estado || '').toUpperCase() === 'CONFIRMADA') {
        hide();
        verifyReservation(false);
        return;
    }
    expiryMs = Date.parse(saved.vence_reserva || '');
    if (!Number.isFinite(expiryMs)) expiryMs = Date.now();
    link.href = saved.functionId
        ? `asientos.html?id_funcion=${encodeURIComponent(saved.functionId)}`
        : 'asientos.html';
    link.addEventListener('click', event => {
        if (link.href.endsWith('#')) event.preventDefault();
    });
    show();
    render();
    intervalId = window.setInterval(render, 1000);
    verifyReservation(false);
}

/* ==========================================================================
   2. MÓDULO FOOTER DINÁMICO (PRINCIPAL VS MINIMALISTA)
   ========================================================================== */

/**
 * Detecta la presencia del contenedor de footer y carga la variante adecuada
 */
function loadFooter() {
    const footerContainer = document.getElementById("footer-container");
    if (!footerContainer) return;

    // Detectar si la vista solicita el footer minimalista vía data-attribute
    const isMinimal = footerContainer.dataset.variant === "minimal";
    const footerFile = isMinimal ? "footer-minimal.html" : "footer-main.html";

    fetch(footerFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error ${response.status}: No se pudo cargar ${footerFile}`);
            }
            return response.text();
        })
        .then(html => {
            footerContainer.innerHTML = html;
        })
        .catch(error => console.error(`Error al cargar el footer (${footerFile}):`, error));
}

function loadAuthModal() {
    const container = document.getElementById("auth-modal-container");
    if (!container) return;

    fetch("auth-modal.html")
        .then(response => response.text())
        .then(html => {
            container.innerHTML = html;
        })
        .catch(error => console.error("Error al cargar el modal de autenticación:", error));
}