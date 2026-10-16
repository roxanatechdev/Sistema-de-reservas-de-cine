document.addEventListener('DOMContentLoaded', () => {
    const cardNumInput = document.getElementById('cardNumInput');
    const cardExpInput = document.getElementById('cardExpInput');
    const cardTypeBadge = document.getElementById('cardTypeBadge');
    const formAddCard = document.getElementById('formAddCard');
    const cardsGrid = document.getElementById('cardsGrid');
    const emptyCardsState = document.getElementById('emptyCardsState');

    // 1. Formateo y detección en tiempo real del Número de Tarjeta (BIN)
    if (cardNumInput) {
        cardNumInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Solo números
            let formatted = value.match(/.{1,4}/g)?.join(' ') || '';
            e.target.value = formatted.substring(0, 19);

            // Detección de Visa o Mastercard
            if (value.startsWith('4')) {
                cardTypeBadge.innerHTML = `<span class="fw-bold font-display text-white italic">VISA</span>`;
            } else if (/^(5[1-5]|2[2-7])/.test(value)) {
                cardTypeBadge.innerHTML = `
                    <div class="d-flex align-items-center">
                        <span class="mc-circle bg-danger opacity-75"></span>
                        <span class="mc-circle bg-warning opacity-75 ms-n2"></span>
                    </div>`;
            } else {
                cardTypeBadge.innerHTML = `<span class="material-symbols-outlined fs-5">credit_card</span>`;
            }
        });
    }

    // 2. Formateo de fecha de expiración (MM/AA)
    if (cardExpInput) {
        cardExpInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                e.target.value = value.substring(0, 2) + '/' + value.substring(2, 4);
            } else {
                e.target.value = value;
            }
        });
    }

    // 3. Lógica para eliminar tarjetas y verificar Empty State
    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-card');
        if (deleteBtn) {
            const cardWrapper = deleteBtn.closest('.card-item-wrapper');
            if (confirm('¿Estás seguro de que deseas eliminar este método de pago?')) {
                cardWrapper.remove();
                checkEmptyCards();
            }
        }

        // Lógica para cambiar tarjeta predeterminada
        const setDefaultBtn = e.target.closest('.btn-set-default');
        if (setDefaultBtn) {
            // Remover badges anteriores
            document.querySelectorAll('.card-item-wrapper').forEach(item => {
                const badge = item.querySelector('.badge');
                const actionBtn = item.querySelector('.btn-set-default, .btn-link');

                if (badge) {
                    badge.className = 'badge bg-cm-surface-low border border-secondary border-opacity-25 text-cm-variant fs-9 text-uppercase fw-bold px-2 py-1 rounded-2 mb-2 d-inline-block';
                    badge.textContent = 'Secundaria';
                }
                if (actionBtn) {
                    actionBtn.className = 'btn btn-sm text-cm-variant hover-cm-red p-0 text-decoration-none fs-8 btn-set-default';
                    actionBtn.textContent = 'Hacer predeterminada';
                }
            });

            // Establecer la actual como predeterminada
            const currentWrapper = setDefaultBtn.closest('.card-item-wrapper');
            const currentBadge = currentWrapper.querySelector('.badge');
            if (currentBadge) {
                currentBadge.className = 'badge bg-cm-brand-red text-white fs-9 text-uppercase fw-bold px-2 py-1 rounded-2 shadow-sm mb-2 d-inline-block';
                currentBadge.textContent = 'Predeterminada';
            }
            setDefaultBtn.className = 'btn btn-sm btn-link text-cm-variant p-0 text-decoration-none disabled opacity-50 fs-8';
            setDefaultBtn.innerHTML = '<span class="material-symbols-outlined fs-6 align-middle me-1">check_circle</span>Es predeterminada';
        }
    });

    function checkEmptyCards() {
        const remainingCards = cardsGrid.querySelectorAll('.card-item-wrapper');
        if (remainingCards.length === 0) {
            emptyCardsState.classList.remove('d-none');
        } else {
            emptyCardsState.classList.add('d-none');
        }
    }

    // 4. Edición de Datos de Facturación NIT/CI
    const btnEditBilling = document.getElementById('btnEditBilling');
    const btnCancelBilling = document.getElementById('btnCancelBilling');
    const billingDisplay = document.getElementById('billingDisplay');
    const billingForm = document.getElementById('billingForm');

    if (btnEditBilling && billingForm) {
        btnEditBilling.addEventListener('click', () => {
            billingDisplay.classList.add('d-none');
            billingForm.classList.remove('d-none');
        });

        btnCancelBilling.addEventListener('click', () => {
            billingForm.classList.add('d-none');
            billingDisplay.classList.remove('d-none');
        });

        billingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            document.getElementById('lblNit').textContent = document.getElementById('inputNit').value;
            document.getElementById('lblRazonSocial').textContent = document.getElementById('inputRazonSocial').value.toUpperCase();

            billingForm.classList.add('d-none');
            billingDisplay.classList.remove('d-none');
        });
    }
});