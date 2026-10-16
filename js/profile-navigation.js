document.addEventListener("DOMContentLoaded", () => {
    const mobileSheetElement = document.getElementById("profileMobileSheet");
    const mobileSheetInstance = mobileSheetElement && typeof bootstrap !== "undefined"
        ? bootstrap.Offcanvas.getOrCreateInstance(mobileSheetElement)
        : null;

    /**
     * Sincroniza la opción activa únicamente dentro del menú Offcanvas
     */
    function updateMobileTriggerUI(tabId) {
        // Remover clase activa de las opciones del menú móvil
        document.querySelectorAll("#profile-tabs-mobile .profile-nav-link").forEach(btn => {
            btn.classList.remove("active");
        });

        // Activar la opción correspondiente dentro del menú inferior
        const targetMobileBtn = document.querySelector(`#profile-tabs-mobile [data-tab-target="${tabId}"]`);
        if (targetMobileBtn) {
            targetMobileBtn.classList.add("active");
        }
    }

    // Eventos de clic en las opciones dentro del Offcanvas
    document.querySelectorAll("#profile-tabs-mobile [data-tab-target]").forEach(button => {
        button.addEventListener("click", () => {
            const targetDesktopId = button.getAttribute("data-tab-target");
            const targetDesktopBtn = document.getElementById(targetDesktopId);

            // Cambiar la pestaña de Bootstrap
            if (targetDesktopBtn && typeof bootstrap !== "undefined") {
                const tabInstance = bootstrap.Tab.getOrCreateInstance(targetDesktopBtn);
                tabInstance.show();
            }

            // Ocultar el menú inferior tras seleccionar una opción
            if (mobileSheetInstance) {
                mobileSheetInstance.hide();
            }
        });
    });

    // Escuchar cambios de pestaña de Bootstrap
    document.querySelectorAll('#profile-tabs button[data-bs-toggle="pill"]').forEach(button => {
        button.addEventListener('shown.bs.tab', (event) => {
            updateMobileTriggerUI(event.target.id);
        });
    });

    // Carga e inicialización con parámetro de URL (?tab=favoritos o #favoritos)[cite: 6, 8]
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab") || window.location.hash.replace("#", "") || "tickets";
    updateMobileTriggerUI(`tab-${tabParam}`);
});