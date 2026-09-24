/* ==========================================================================
   CINEPRIME - CORE JS, CARGA DINÁMICA & COMPONENTES REUTILIZABLES
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar el Navbar dinámicamente
    loadNavbar();

    // 2. Cargar el Footer adecuado según el tipo de página
    loadFooter();
});

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

            // Marcar enlace activo según la URL
            highlightActiveLink();

            // Escuchar el evento Scroll para el header
            initScrollHeader();

            // Inicializar menú colapsable de Bootstrap 5 en móviles
            initBootstrapComponents();
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