document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('inputSearchOrder');
    const accordionItems = document.querySelectorAll('#purchaseHistoryAccordion .accordion-item');
    const emptyState = document.getElementById('emptyStateHistory');
    const typeFilters = document.querySelectorAll('input[name="typeFilter"]');

    // Función de filtrado dinámico
    function filterHistory() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        let visibleCount = 0;

        accordionItems.forEach(item => {
            const textContent = item.textContent.toLowerCase();
            const matchesSearch = textContent.includes(searchTerm);

            if (matchesSearch) {
                item.classList.remove('d-none');
                visibleCount++;
            } else {
                item.classList.add('d-none');
            }
        });

        // Alternar el estado vacío si no hay ítems visibles
        if (visibleCount === 0) {
            emptyState.classList.remove('d-none');
        } else {
            emptyState.classList.add('d-none');
        }
    }

    // Event listeners para búsqueda y filtros
    if (searchInput) {
        searchInput.addEventListener('input', filterHistory);
    }

    typeFilters.forEach(radio => {
        radio.addEventListener('change', filterHistory);
    });
});