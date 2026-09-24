/* ==========================================================================
   CINEPRIME - CORE JS & CARGA DINÁMICA DE NAVBAR
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    loadNavbar();
});

/**
 * Carga asíncrona del Navbar y arranque de dependencias
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

            // 1. Marcar el enlace de la página activa
            highlightActiveLink();

            // 2. Escuchar el evento de Scroll para el efecto Blur/Fondo
            initScrollHeader();

            // 3. Re-inicializar componentes dinámicos de Bootstrap (Móvil Collapse)
            initBootstrapComponents();
        })
        .catch(error => console.error("Error al cargar el navbar:", error));
}

/**
 * Detecta la página actual y aplica los estilos activos (.active)
 * tanto al menú de escritorio como al menú móvil.
 */
function highlightActiveLink() {
    // Obtener el nombre del archivo actual (por defecto 'index.html')
    let currentPath = window.location.pathname.split("/").pop();
    if (!currentPath || currentPath === "") {
        currentPath = "index.html";
    }

    // Seleccionar todos los enlaces de navegación (Desktop y Mobile)
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
 * Aplica fondo oscuro traslúcido al hacer scroll hacia abajo
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

    // Ejecutar al cargar por si la página inicia con scroll abajo
    handleScroll();
    window.addEventListener("scroll", handleScroll);
}

/**
 * Forzar la activación del menú desplegable móvil en HTML inyectado
 */
function initBootstrapComponents() {
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const mobilePanel = document.getElementById("mobile-nav-panel");

    if (mobileMenuBtn && mobilePanel && typeof bootstrap !== "undefined") {
        // Inicializar manualmente el Collapse de Bootstrap 5 sobre el elemento inyectado
        new bootstrap.Collapse(mobilePanel, {
            toggle: false
        });
    }
}