document.addEventListener('DOMContentLoaded', () => {
    const collapseElements = document.querySelectorAll('.hist-card [data-bs-toggle="collapse"]');

    collapseElements.forEach(trigger => {
        const card = trigger.closest('.hist-card');
        const targetId = trigger.getAttribute('data-bs-target');
        const targetCollapse = document.querySelector(targetId);

        if (targetCollapse) {
            targetCollapse.addEventListener('show.bs.collapse', () => {
                card.classList.add('is-open');
            });

            targetCollapse.addEventListener('hide.bs.collapse', () => {
                card.classList.remove('is-open');
            });
        }
    });
});