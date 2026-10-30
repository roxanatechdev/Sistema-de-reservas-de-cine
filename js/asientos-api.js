/* Fase 2: integración de lectura con la API pública. No crea reservas ni pagos. */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const idFuncion = params.get('id_funcion');
    const grid = document.getElementById('seatGrid');
    const candyContainer = document.getElementById('candyContainer');
    const selectedSeatIds = new Set();
    const selectedCandy = new Map();
    let seats = [];
    let products = [];
    let currency = 'BOB';
    let functionInfo = null;
    let loading = true;
    let activeCategory = 'all';
    let currentPurchaseStep = 1;

    const money = (value) => {
        const amount = Number(value);
        return `${currency === 'BOB' ? 'Bs' : currency} ${Number.isFinite(amount) ? amount.toFixed(2).replace('.', ',') : '0,00'}`;
    };

    function toast(message) {
        const notice = document.getElementById('toastNotice');
        const messageNode = document.getElementById('toastMessage');
        if (!notice || !messageNode) {
            window.alert(message);
            return;
        }
        messageNode.textContent = message;
        notice.classList.add('show');
        window.setTimeout(() => notice.classList.remove('show'), 3500);
    }

    function showGridMessage(message, isError = false) {
        grid.replaceChildren();
        const node = document.createElement('div');
        node.className = isError ? 'text-danger small text-center py-4' : 'text-light opacity-75 small text-center py-4';
        node.textContent = message;
        grid.appendChild(node);
    }

    function seatLabel(seat) {
        return `${seat.fila}${seat.numero}`;
    }

    function seatIsSelectable(seat) {
        return seat.seleccionable === true && seat.estado === 'DISPONIBLE';
    }

    function renderSeats() {
        grid.replaceChildren();
        if (!seats.length) {
            showGridMessage('Esta función no tiene asientos disponibles para mostrar.');
            return;
        }

        const byRow = new Map();
        seats.forEach(seat => {
            const row = String(seat.fila);
            if (!byRow.has(row)) byRow.set(row, []);
            byRow.get(row).push(seat);
        });

        const aisles = Array.isArray(window.__cineprimeAisles) ? window.__cineprimeAisles : [];
        const longitudinalAisles = aisles.filter(aisle =>
            String(aisle.orientacion || 'LONGITUDINAL').toUpperCase() === 'LONGITUDINAL'
        );
        const transversalAisles = aisles.filter(aisle =>
            String(aisle.orientacion || '').toUpperCase() === 'TRANSVERSAL'
        );
        const rows = Array.from(byRow.keys()).sort((a, b) =>
            a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
        );
        const hasTransversalGapBefore = (rowName) => transversalAisles.some(aisle =>
            String(aisle.fila_siguiente ?? '') === rowName &&
            String(aisle.fila ?? '') !== rowName
        );

        rows.forEach(rowName => {
            const rowSeats = byRow.get(rowName).sort((a, b) => Number(a.numero) - Number(b.numero));
            const rowNode = document.createElement('div');
            rowNode.className = 'seat-row';
            // El pasillo transversal se dibuja entre las dos filas configuradas en sala_pasillo.
            // Se añade espacio antes de fila_siguiente, sin depender de nombres de fila fijos.
            if (hasTransversalGapBefore(rowName)) {
                rowNode.style.marginTop = '22px';
                rowNode.dataset.transversalAisleBefore = 'true';
            }

            const label = document.createElement('span');
            label.className = 'row-label';
            label.textContent = rowName;
            rowNode.appendChild(label);

            const rowAisles = longitudinalAisles
                .filter(aisle => String(aisle.fila) === rowName && aisle.despues_de_numero !== null)
                .map(aisle => Number(aisle.despues_de_numero))
                .filter(Number.isFinite);

            let previousNumber = null;
            rowSeats.forEach(seat => {
                const number = Number(seat.numero);
                if (previousNumber !== null && rowAisles.some(after => after >= previousNumber && after < number)) {
                    const spacer = document.createElement('span');
                    spacer.setAttribute('aria-hidden', 'true');
                    spacer.style.cssText = 'display:block;flex:0 0 18px;width:18px;';
                    rowNode.appendChild(spacer);
                }

                const node = document.createElement('button');
                node.type = 'button';
                node.className = 'seat';
                node.textContent = String(seat.numero);
                node.dataset.functionSeatId = String(seat.id_funcion_asiento);
                node.dataset.seatLabel = seatLabel(seat);
                node.setAttribute('aria-label', `Asiento ${seatLabel(seat)}, ${seat.estado.toLowerCase()}, ${money(seat.precio)}`);
                node.title = `${seatLabel(seat)} · ${seat.tipo || 'Asiento'} · ${money(seat.precio)}`;

                if (seatIsSelectable(seat)) {
                    node.classList.add('available');
                    node.addEventListener('click', () => toggleSeat(seat));
                } else {
                    node.classList.add('occupied');
                    node.disabled = true;
                    node.setAttribute('aria-disabled', 'true');
                    node.title = `${seatLabel(seat)} · ${seat.estado === 'INACTIVO' ? 'No disponible' : 'Ocupado'}`;
                }

                if (selectedSeatIds.has(Number(seat.id_funcion_asiento))) node.classList.add('selected');
                rowNode.appendChild(node);
                previousNumber = number;
            });

            grid.appendChild(rowNode);
        });
    }

    function toggleSeat(seat) {
        const id = Number(seat.id_funcion_asiento);
        if (!seatIsSelectable(seat)) return;
        if (selectedSeatIds.has(id)) selectedSeatIds.delete(id);
        else selectedSeatIds.add(id);
        renderSeats();
        updateSummary();
    }

    function productCategory(product) {
        const value = product.categoria ?? product.nombre_categoria ?? product.categoria_nombre ?? product.category;
        return String(value || 'Otros').trim() || 'Otros';
    }

    function normalizedProduct(product) {
        const id = Number(product.id_producto ?? product.id);
        const price = Number(product.precio ?? product.precio_promocional ?? product.precio_actual ?? 0);
        return {
            ...product,
            id_producto: id,
            nombre: String(product.nombre || product.titulo || 'Producto de confitería'),
            descripcion: String(product.descripcion || ''),
            precio: Number.isFinite(price) ? price : 0,
            categoria: productCategory(product),
            en_promocion: Boolean(product.en_promocion ?? product.es_promocion),
            imagen: product.imagen || null
        };
    }

    function renderCategoryFilters() {
        const filters = document.getElementById('candyFilters');
        if (!filters) return;
        filters.replaceChildren();

        const categories = new Map();
        products.forEach(product => {
            const name = product.categoria;
            categories.set(name, (categories.get(name) || 0) + 1);
        });

        const options = [{ key: 'all', label: `Todos (${products.length})` }];
        Array.from(categories.entries())
            .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
            .forEach(([name, count]) => options.push({ key: name, label: `${name} (${count})` }));

        options.forEach(option => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-category-pill text-nowrap';
            if (String(activeCategory) === String(option.key)) button.classList.add('active');
            button.dataset.category = option.key;
            button.textContent = option.label;
            button.setAttribute('aria-pressed', String(String(activeCategory) === String(option.key)));
            button.addEventListener('click', () => {
                activeCategory = option.key;
                renderCategoryFilters();
                renderProducts();
            });
            filters.appendChild(button);
        });
    }

    function changeCandyQuantity(product, delta) {
        const id = Number(product.id_producto);
        const existing = selectedCandy.get(id);
        const quantity = Math.max(0, (existing?.cantidad || 0) + delta);
        if (quantity === 0) selectedCandy.delete(id);
        else selectedCandy.set(id, { ...product, cantidad: quantity });
        // Actualiza solo los controles de esta tarjeta: no reconstruye el catálogo
        // ni vuelve a solicitar las imágenes cuando cambia una cantidad.
        updateProductCardControls(product);
        updateSummary();
    }

    function createProductCardActions(product, quantity) {
        const actions = document.createElement('div');
        actions.className = 'candy-card-actions mt-3';
        if (quantity > 0) {
            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'btn btn-sm btn-outline-light candy-qty-button';
            minus.textContent = '−';
            minus.setAttribute('aria-label', `Quitar una unidad de ${product.nombre}`);
            minus.addEventListener('click', () => changeCandyQuantity(product, -1));
            const quantityLabel = document.createElement('span');
            quantityLabel.className = 'candy-quantity-label';
            quantityLabel.textContent = String(quantity);
            quantityLabel.setAttribute('aria-live', 'polite');
            const plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'btn btn-sm btn-outline-danger candy-qty-button';
            plus.textContent = '+';
            plus.setAttribute('aria-label', `Añadir una unidad de ${product.nombre}`);
            plus.addEventListener('click', () => changeCandyQuantity(product, 1));
            actions.append(minus, quantityLabel, plus);
        } else {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold';
            add.innerHTML = '<span class="material-symbols-outlined align-middle fs-6">add</span> Añadir';
            add.addEventListener('click', () => changeCandyQuantity(product, 1));
            actions.appendChild(add);
        }
        return actions;
    }

    function updateProductCardControls(product) {
        const card = candyContainer.querySelector(`[data-id="${Number(product.id_producto)}"]`);
        if (!card) return;
        const quantity = selectedCandy.get(Number(product.id_producto))?.cantidad || 0;
        card.classList.toggle('selected', quantity > 0);
        const oldActions = card.querySelector('.candy-card-actions');
        const newActions = createProductCardActions(product, quantity);
        if (oldActions) oldActions.replaceWith(newActions);
        else card.appendChild(newActions);
    }

    function renderProducts() {
        candyContainer.replaceChildren();
        const visibleProducts = activeCategory === 'all'
            ? products
            : products.filter(product => String(product.categoria) === String(activeCategory));

        if (!visibleProducts.length) {
            const message = document.createElement('p');
            message.className = 'col-12 text-light opacity-75 small mb-0';
            message.textContent = products.length
                ? 'No hay productos en esta categoría.'
                : 'No hay productos de confitería disponibles en este momento. Puedes continuar sin añadir productos.';
            candyContainer.appendChild(message);
            return;
        }

        visibleProducts.forEach(product => {
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-xl-3';

            const quantity = selectedCandy.get(Number(product.id_producto))?.cantidad || 0;
            const card = document.createElement('article');
            card.className = 'candy-card bg-cm-surface-high w-100 text-start';
            card.dataset.id = String(product.id_producto);
            card.classList.toggle('selected', quantity > 0);
            card.setAttribute('aria-label', product.nombre);

            const checkbox = document.createElement('div');
            checkbox.className = 'candy-checkbox';
            const checkIcon = document.createElement('span');
            checkIcon.className = 'material-symbols-outlined';
            checkIcon.textContent = 'check';
            checkbox.appendChild(checkIcon);

            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'candy-img-wrapper';
            const image = document.createElement('img');
            image.className = 'candy-img';
            image.alt = product.nombre || 'Producto de confitería';
            image.loading = 'lazy';
            const imageUrl = product.imagen && window.CinePrimeAPI.media(product.imagen);
            image.src = imageUrl || 'https://placehold.co/400x300/1d1f29/fff?text=Confiteria';
            image.onerror = () => {
                image.onerror = null;
                image.src = 'https://placehold.co/400x300/1d1f29/fff?text=Confiteria';
            };
            imageWrapper.appendChild(image);

            const info = document.createElement('div');
            info.className = 'text-center mt-auto w-100';
            const title = document.createElement('h6');
            title.className = 'fw-bold mb-1 text-white fs-6 candy-product-title';
            title.textContent = product.nombre;
            const price = document.createElement('span');
            price.className = 'text-light opacity-75 fw-semibold small d-block';
            price.textContent = money(product.precio);
            info.append(title, price);

            if (product.en_promocion) {
                const promo = document.createElement('span');
                promo.className = 'candy-promo-label';
                promo.textContent = 'Promoción';
                info.appendChild(promo);
            }
            if (product.descripcion) {
                const description = document.createElement('p');
                description.className = 'candy-product-description small text-light opacity-75 mt-2 mb-0';
                description.textContent = product.descripcion;
                info.appendChild(description);
            }

            const actions = createProductCardActions(product, quantity);

            card.append(checkbox, imageWrapper, info, actions);
            col.appendChild(card);
            candyContainer.appendChild(col);
        });
    }

    function updateReviewDetails() {
        const chosenSeats = seats.filter(seat => selectedSeatIds.has(Number(seat.id_funcion_asiento)))
            .sort((a, b) => String(a.fila).localeCompare(String(b.fila), 'es', { numeric: true }) || Number(a.numero) - Number(b.numero));
        const title = functionInfo?.pelicula?.titulo || document.getElementById('summaryMovieTitle')?.textContent || 'Película por confirmar';
        const date = document.getElementById('summaryFunctionDate')?.textContent || '';
        const time = document.getElementById('summaryFunctionTime')?.textContent || '';
        const room = document.getElementById('summaryFunctionRoom')?.textContent || 'Sala por confirmar';
        const poster = document.getElementById('summaryMoviePoster');
        const reviewPoster = document.getElementById('reviewMoviePoster');
        const titleNode = document.getElementById('reviewMovieTitle');
        const functionNode = document.getElementById('reviewFunctionDetails');
        const roomNode = document.getElementById('reviewRoomDetails');
        const seatsNode = document.getElementById('reviewSeats');
        const candyNode = document.getElementById('reviewCandyCount');
        const totalNode = document.getElementById('reviewTotal');
        if (titleNode) titleNode.textContent = title;
        if (functionNode) functionNode.textContent = [date, time].filter(v => v && !v.includes('Cargando') && v !== '--:--').join(' · ') || 'Horario por confirmar';
        if (roomNode) roomNode.textContent = room;
        if (poster && reviewPoster && poster.src) {
            reviewPoster.src = poster.src;
            reviewPoster.alt = poster.alt || `Póster de ${title}`;
        }
        if (seatsNode) seatsNode.textContent = chosenSeats.length ? chosenSeats.map(seatLabel).join(', ') : 'Sin seleccionar';
        if (candyNode) {
            const quantity = [...selectedCandy.values()].reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
            candyNode.textContent = quantity ? `${quantity} unidad${quantity === 1 ? '' : 'es'} · ${[...selectedCandy.values()].map(item => item.nombre).join(', ')}` : 'Ninguno';
        }
        if (totalNode) totalNode.textContent = document.getElementById('totalDisplay')?.textContent || money(0);
        const unsupportedNotice = document.getElementById('unsupportedCartNotice');
        const cartProducts = window.CinePrimeCart?.getState()?.products || [];
        if (unsupportedNotice) unsupportedNotice.hidden = !cartProducts.some(item => item.origen !== 'api');
    }

    function updateSummary() {
        const seatsContainer = document.getElementById('seatsContainer');
        seatsContainer.replaceChildren();
        const chosenSeats = seats.filter(seat => selectedSeatIds.has(Number(seat.id_funcion_asiento)));
        if (window.CinePrimeCart) {
            const func = functionInfo?.funcion || {};
            const movie = functionInfo?.pelicula || {};
            const room = functionInfo?.sala || {};
            const dateTime = formatDateTime(func.inicio) || {};
            window.CinePrimeCart.syncFromSeats({
                functionId: idFuncion,
                function: { titulo: movie.titulo || 'Película', fecha: dateTime.date || '', hora: dateTime.time || '', sala: room.nombre ? `${room.nombre}` : '' },
                seats: chosenSeats,
                products: [...selectedCandy.values()]
            });
        }

        if (!chosenSeats.length) {
            const empty = document.createElement('span');
            empty.className = 'text-light opacity-50 small fst-italic';
            empty.textContent = 'Sin asientos seleccionados';
            seatsContainer.appendChild(empty);
        } else {
            chosenSeats
                .sort((a, b) => String(a.fila).localeCompare(String(b.fila), 'es', { numeric: true }) || Number(a.numero) - Number(b.numero))
                .forEach(seat => {
                    const badge = document.createElement('span');
                    badge.className = 'seat-badge';
                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined fs-6';
                    icon.textContent = 'chair';
                    badge.append(icon, document.createTextNode(` ${seatLabel(seat)}`));
                    seatsContainer.appendChild(badge);
                });
        }

        const list = document.getElementById('summaryItemList');
        list.replaceChildren();
        let total = 0;

        if (chosenSeats.length) {
            const ticketTotal = chosenSeats.reduce((sum, seat) => sum + Number(seat.precio || 0), 0);
            total += ticketTotal;
            addSummaryRow(list, `Entradas ×${chosenSeats.length}`, ticketTotal);
        }

        selectedCandy.forEach(item => {
            const itemTotal = item.precio * item.cantidad;
            total += itemTotal;
            addSummaryProductRow(list, item, itemTotal);
        });

        const badgeStatus = document.getElementById('candyStatusBadge');
        badgeStatus.classList.toggle('d-none', selectedCandy.size === 0);
        badgeStatus.classList.toggle('d-inline-flex', selectedCandy.size > 0);

        document.getElementById('subtotalDisplay').textContent = money(total);
        document.getElementById('totalDisplay').textContent = money(total);
        updateReviewDetails();
        const continueButton = document.getElementById('btnContinue');
        if (continueButton) {
            continueButton.disabled = loading || selectedSeatIds.size === 0;
            continueButton.setAttribute('aria-disabled', String(continueButton.disabled));
        }
        const seatNextButton = document.getElementById('btnSeatsToCandy');
        if (seatNextButton) {
            seatNextButton.disabled = loading || selectedSeatIds.size === 0;
            seatNextButton.setAttribute('aria-disabled', String(seatNextButton.disabled));
        }
    }

    function addSummaryRow(parent, label, amount) {
        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center text-light opacity-90 small py-1';
        const name = document.createElement('span');
        name.textContent = label;
        const price = document.createElement('span');
        price.className = 'fw-semibold';
        price.textContent = money(amount);
        row.append(name, price);
        parent.appendChild(row);
    }

    function addSummaryProductRow(parent, item, amount) {
        const row = document.createElement('div');
        row.className = 'summary-product-row';
        const details = document.createElement('div');
        details.className = 'summary-product-details';
        const name = document.createElement('span');
        name.className = 'summary-product-name';
        name.textContent = item.nombre;
        const subtotal = document.createElement('span');
        subtotal.className = 'summary-product-price';
        subtotal.textContent = money(amount);
        details.append(name, subtotal);

        const controls = document.createElement('div');
        controls.className = 'summary-product-controls';
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.className = 'summary-qty-button';
        minus.textContent = '−';
        minus.setAttribute('aria-label', `Quitar una unidad de ${item.nombre}`);
        minus.addEventListener('click', () => changeCandyQuantity(item, -1));
        const quantity = document.createElement('span');
        quantity.className = 'summary-qty-value';
        quantity.textContent = String(item.cantidad);
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.className = 'summary-qty-button';
        plus.textContent = '+';
        plus.setAttribute('aria-label', `Añadir una unidad de ${item.nombre}`);
        plus.addEventListener('click', () => changeCandyQuantity(item, 1));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'summary-remove-button';
        remove.textContent = 'Quitar';
        remove.addEventListener('click', () => {
            selectedCandy.delete(Number(item.id_producto));
            updateProductCardControls(item);
            updateSummary();
        });
        controls.append(minus, quantity, plus, remove);
        row.append(details, controls);
        parent.appendChild(row);
    }

    function setPurchaseStep(step, shouldScroll = false) {
        currentPurchaseStep = Math.min(3, Math.max(1, Number(step) || 1));
        const seatSection = document.getElementById('seatSection');
        const candySection = document.getElementById('candySection');
        const reviewSection = document.getElementById('reviewSection');
        if (seatSection) seatSection.hidden = currentPurchaseStep !== 1;
        if (candySection) candySection.hidden = currentPurchaseStep !== 2;
        if (reviewSection) reviewSection.hidden = currentPurchaseStep !== 3;
        updateReviewDetails();

        document.querySelectorAll('[data-purchase-step]').forEach(node => {
            const active = Number(node.dataset.purchaseStep) === currentPurchaseStep;
            node.classList.toggle('active', active);
            node.classList.toggle('completed', Number(node.dataset.purchaseStep) < currentPurchaseStep);
            if (active) node.setAttribute('aria-current', 'step');
            else node.removeAttribute('aria-current');
        });

        const button = document.getElementById('btnContinue');
        if (button) {
            const label = button.querySelector('span:nth-child(2)');
            if (label) label.textContent = currentPurchaseStep === 1
                ? 'Continuar a confitería'
                : currentPurchaseStep === 2 ? 'Confirmar y revisar' : 'Completar datos';
            button.disabled = loading || selectedSeatIds.size === 0;
            button.setAttribute('aria-disabled', String(button.disabled));
        }

        if (shouldScroll) {
            const targetId = currentPurchaseStep === 1 ? 'seatSection'
                : currentPurchaseStep === 2 ? 'candySection' : 'reviewSection';
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    const RESERVATION_STORAGE_KEY = 'cineprime_reservation_v1';
    const LAST_TICKET_STORAGE_KEY = 'cineprime_last_ticket_v1';
    let reservationTimer = null;
    let activeReservation = null;

    function readSavedReservation() {
        try {
            const value = JSON.parse(localStorage.getItem(RESERVATION_STORAGE_KEY) || 'null');
            return value && value.id_compra && value.token ? value : null;
        } catch (_) { return null; }
    }

    function moneyReservation(value) {
        const amount = Number(value);
        return `${currency === 'BOB' ? 'Bs' : currency} ${Number.isFinite(amount) ? amount.toFixed(2).replace('.', ',') : '0,00'}`;
    }

    function setReservationCountdown(expiresAt) {
        if (reservationTimer) window.clearInterval(reservationTimer);
        const node = document.getElementById('reservationCountdown');
        const tick = () => {
            if (!node) return;
            const seconds = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
            node.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            if (seconds <= 0) {
                if (reservationTimer) window.clearInterval(reservationTimer);
                reservationTimer = null;
                refreshReservationStatus(true);
            }
        };
        tick();
        reservationTimer = window.setInterval(tick, 1000);
    }

    function renderReservation(reservation, newlyCreated = false) {
        activeReservation = reservation;
        const panel = document.getElementById('reservationStatusPanel');
        const form = document.getElementById('reservationCustomerForm');
        const title = document.getElementById('reservationStatusTitle');
        const message = document.getElementById('reservationStatusMessage');
        const code = document.getElementById('reservationCode');
        const cancelButton = document.getElementById('btnCancelReservation');
        const paymentButton = document.getElementById('btnContinueToPayment');
        const ticketButton = document.getElementById('btnViewIssuedTicket');
        const status = String(reservation.estado || 'PENDIENTE_PAGO');
        const confirmed = status === 'CONFIRMADA';
        const active = ['INICIADA', 'PENDIENTE_PAGO'].includes(status) && reservation.vence_reserva && Date.parse(reservation.vence_reserva) > Date.now();

        if (panel) panel.hidden = false;
        if (form) form.hidden = active || confirmed;
        if (title) title.textContent = confirmed ? 'Compra confirmada' : active ? 'Reserva creada correctamente' : `Estado de la reserva: ${status.toLowerCase()}`;
        if (message) message.textContent = confirmed
            ? 'El pago fue aprobado y la entrada ya fue emitida. Puedes consultar el comprobante.'
            : active
                ? (newlyCreated
                    ? 'Tus asientos están reservados durante 15 minutos. Continúa al pago antes de que termine el tiempo.'
                    : 'Recuperamos tu reserva desde el servidor. El tiempo restante corresponde a la hora oficial de vencimiento.')
                : 'Esta reserva ya no está activa. Actualiza la selección para comenzar de nuevo.';
        if (code) code.textContent = `#${reservation.id_compra}`;
        if (cancelButton) cancelButton.hidden = !active;
        if (paymentButton) paymentButton.hidden = !active;
        if (ticketButton) ticketButton.hidden = !confirmed;

        const seatsNode = document.getElementById('reviewSeats');
        if (seatsNode && Array.isArray(reservation.asientos)) {
            seatsNode.textContent = reservation.asientos.map(seat => `${seat.fila}${seat.numero}`).join(', ') || 'Sin asientos';
        }
        const productsNode = document.getElementById('reviewCandyCount');
        if (productsNode && Array.isArray(reservation.productos)) {
            const quantity = reservation.productos.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
            productsNode.textContent = quantity ? `${quantity} unidad${quantity === 1 ? '' : 'es'} · ${reservation.productos.map(item => `${item.nombre} ×${item.cantidad}`).join(', ')}` : 'Ninguno';
        }
        const totalNode = document.getElementById('reviewTotal');
        if (totalNode) totalNode.textContent = moneyReservation(reservation.total);

        if (active) setReservationCountdown(reservation.vence_reserva);
        else if (reservationTimer) {
            window.clearInterval(reservationTimer);
            reservationTimer = null;
        }
    }

    async function refreshReservationStatus(expiredCheck = false) {
        const saved = readSavedReservation();
        if (!saved) return;
        try {
            const response = await window.CinePrimeAPI.json(`/api/compras/${encodeURIComponent(saved.id_compra)}/reserva`, {
                headers: { 'X-Reserva-Token': saved.token }
            });
            const reservation = response.reserva;
            if (reservation?.estado === 'CONFIRMADA') {
                localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify({ ...saved, estado: 'CONFIRMADA' }));
                renderReservation(reservation, false);
                return;
            }
            if (reservation && ['INICIADA', 'PENDIENTE_PAGO'].includes(reservation.estado) && Date.parse(reservation.vence_reserva) > Date.now()) {
                renderReservation(reservation, false);
                return;
            }
            localStorage.removeItem(RESERVATION_STORAGE_KEY);
            if (window.CinePrimeCart) window.CinePrimeCart.clear();
            if (expiredCheck) {
                toast('La reserva venció y los asientos se liberaron. Actualizando la disponibilidad…');
                window.setTimeout(() => window.location.reload(), 900);
            } else {
                renderReservation(reservation || { id_compra: saved.id_compra, estado: 'EXPIRADA', asientos: [], productos: [], total: 0 });
            }
        } catch (error) {
            console.warn('No se pudo recuperar el estado de la reserva:', error);
            if (expiredCheck) toast('No pudimos confirmar el vencimiento con el servidor. Comprueba la conexión e inténtalo de nuevo.');
        }
    }

    async function recoverSavedReservation() {
        const saved = readSavedReservation();
        if (!saved || String(saved.functionId) !== String(idFuncion)) return;
        try {
            const response = await window.CinePrimeAPI.json(`/api/compras/${encodeURIComponent(saved.id_compra)}/reserva`, {
                headers: { 'X-Reserva-Token': saved.token }
            });
            const reservation = response.reserva;
            if (reservation?.estado === 'CONFIRMADA') {
                const confirmed = { ...saved, estado: 'CONFIRMADA', pago_estado: 'APROBADO' };
                localStorage.setItem(LAST_TICKET_STORAGE_KEY, JSON.stringify(confirmed));
                localStorage.removeItem(RESERVATION_STORAGE_KEY);
                if (window.CinePrimeCart) window.CinePrimeCart.clear();
                selectedSeatIds.clear();
                selectedCandy.clear();
                activeReservation = null;
                renderSeats();
                renderProducts();
                updateSummary();
                toast('Tu compra anterior ya está confirmada. Puedes seleccionar otros asientos para una nueva reserva; tu ticket sigue guardado.');
                return;
            }
            if (reservation && ['INICIADA', 'PENDIENTE_PAGO'].includes(reservation.estado) && Date.parse(reservation.vence_reserva) > Date.now()) {
                setPurchaseStep(3, false);
                renderReservation(reservation, false);
                return;
            }
            localStorage.removeItem(RESERVATION_STORAGE_KEY);
            if (window.CinePrimeCart) window.CinePrimeCart.clear();
            toast('La reserva anterior venció o fue cancelada. Puedes seleccionar los asientos disponibles nuevamente.');
            window.setTimeout(() => window.location.reload(), 900);
        } catch (error) {
            console.warn('No se pudo recuperar la reserva guardada:', error);
            toast('No se pudo verificar tu reserva anterior. Comprueba la conexión antes de crear otra.');
        }
    }

    document.getElementById('reservationCustomerForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        if (activeReservation && ['INICIADA', 'PENDIENTE_PAGO'].includes(activeReservation.estado)) {
            toast('Ya existe una reserva activa para esta compra.');
            return;
        }
        if (!selectedSeatIds.size) {
            toast('Selecciona al menos un asiento antes de continuar.');
            setPurchaseStep(1, true);
            return;
        }
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            form.querySelector(':invalid')?.focus();
            return;
        }

        const cart = window.CinePrimeCart?.getState();
        const staticProducts = (cart?.products || []).filter(item => item.origen !== 'api');
        if (staticProducts.length) {
            toast('Hay productos de confitería que aún no están vinculados al catálogo del backend. Quítalos del carrito y añade los productos desde la selección de confitería antes de reservar.');
            return;
        }

        const submitButton = document.getElementById('btnSubmitReservation');
        const originalButton = submitButton?.innerHTML;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Creando reserva…';
        }
        try {
            const payload = {
                nombre: document.getElementById('customerFullName').value.trim(),
                correo: document.getElementById('customerEmail').value.trim(),
                telefono: document.getElementById('customerPhone').value.trim() || null,
                id_funcion: Number(idFuncion),
                asientos: [...selectedSeatIds].map(Number),
                productos: [...selectedCandy.values()].map(item => ({ id_producto: Number(item.id_producto), cantidad: Number(item.cantidad) }))
            };
            const response = await window.CinePrimeAPI.json('/api/compras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const reservation = response.reserva;
            if (!reservation?.id_compra || !reservation?.token || !reservation?.vence_reserva) {
                throw new Error('El servidor no devolvió los datos necesarios para recuperar la reserva.');
            }
            localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify({
                id_compra: reservation.id_compra,
                token: reservation.token,
                vence_reserva: reservation.vence_reserva,
                functionId: String(idFuncion)
            }));
            renderReservation(reservation, true);
            toast('Reserva creada correctamente. El contador de 15 minutos ya está en marcha.');
        } catch (error) {
            console.error('No se pudo crear la reserva:', error);
            toast(error.message || 'No se pudo crear la reserva. Revisa la conexión e inténtalo nuevamente.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButton || 'Crear reserva';
            }
        }
    });

    document.getElementById('btnContinueToPayment')?.addEventListener('click', async () => {
        const saved = readSavedReservation();
        if (!saved) {
            toast('No encontramos una reserva activa. Crea una reserva antes de pagar.');
            return;
        }
        try {
            const response = await window.CinePrimeAPI.json(`/api/compras/${encodeURIComponent(saved.id_compra)}/reserva`, {
                headers: { 'X-Reserva-Token': saved.token }
            });
            const reservation = response.reserva;
            if (!reservation || !['INICIADA', 'PENDIENTE_PAGO'].includes(reservation.estado) || Date.parse(reservation.vence_reserva) <= Date.now()) {
                renderReservation(reservation || { id_compra: saved.id_compra, estado: 'EXPIRADA', asientos: [], productos: [], total: 0 });
                toast('La reserva ya no está activa. Actualiza la disponibilidad para volver a reservar.');
                return;
            }
            window.location.href = 'pago.html';
        } catch (error) {
            toast(error.message || 'No pudimos verificar la reserva antes de continuar al pago.');
        }
    });

    document.getElementById('btnViewIssuedTicket')?.addEventListener('click', () => {
        window.location.href = 'confirmacion.html';
    });

    document.getElementById('btnCancelReservation')?.addEventListener('click', async () => {
        const saved = readSavedReservation();
        if (!saved) return;
        const button = document.getElementById('btnCancelReservation');
        if (button) { button.disabled = true; button.textContent = 'Cancelando…'; }
        try {
            await window.CinePrimeAPI.json(`/api/compras/${encodeURIComponent(saved.id_compra)}/reserva`, {
                method: 'DELETE',
                headers: { 'X-Reserva-Token': saved.token }
            });
            localStorage.removeItem(RESERVATION_STORAGE_KEY);
            if (window.CinePrimeCart) window.CinePrimeCart.clear();
            toast('Reserva cancelada. Volveremos a cargar los asientos disponibles.');
            window.setTimeout(() => window.location.reload(), 500);
        } catch (error) {
            toast(error.message || 'No se pudo cancelar la reserva. Comprueba su estado con el servidor.');
            if (button) { button.disabled = false; button.textContent = 'Cancelar reserva'; }
        }
    });

    function formatFunctionFormat(value) {
        if (!value) return 'Formato no especificado';
        return String(value)
            .replace(/[_-]+/g, ' ')
            .toLocaleLowerCase('es')
            .replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase('es'));
    }

    function formatDateTime(isoValue) {
        if (!isoValue) return null;
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) return null;
        return {
            date: new Intl.DateTimeFormat('es-BO', {
                weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
            }).format(date),
            time: new Intl.DateTimeFormat('es-BO', {
                hour: '2-digit', minute: '2-digit', hour12: false
            }).format(date)
        };
    }

    async function updateFunctionHeading() {
        if (!functionInfo) return;
        const movie = functionInfo.pelicula || {};
        const func = functionInfo.funcion || {};
        const room = functionInfo.sala || {};

        const titleNode = document.getElementById('summaryMovieTitle');
        const formatNode = document.getElementById('summaryMovieFormat');
        const dateNode = document.getElementById('summaryFunctionDate');
        const timeNode = document.getElementById('summaryFunctionTime');
        const roomNode = document.getElementById('summaryFunctionRoom');
        const posterNode = document.getElementById('summaryMoviePoster');

        if (titleNode) titleNode.textContent = movie.titulo || 'Película no disponible';
        if (formatNode) formatNode.textContent = formatFunctionFormat(func.formato);
        if (roomNode) roomNode.textContent = room.nombre ? `${room.nombre}` : 'Sala no disponible';

        const dateTime = formatDateTime(func.inicio);
        if (dateNode) dateNode.textContent = dateTime?.date || 'Fecha no disponible';
        if (timeNode) timeNode.textContent = dateTime?.time || '--:--';

        // The function endpoint provides the authoritative movie ID; use the public movie
        // endpoint for the current poster image, without hardcoding a sample movie.
        if (posterNode) {
            posterNode.alt = movie.titulo ? `Póster de ${movie.titulo}` : 'Póster no disponible';
            posterNode.onerror = () => {
                posterNode.onerror = null;
                posterNode.src = 'https://placehold.co/300x450/1d1f29/fff?text=Poster+no+disponible';
            };
            try {
                if (movie.id_pelicula) {
                    const movieResponse = await window.CinePrimeAPI.json(`/api/peliculas/${encodeURIComponent(movie.id_pelicula)}`);
                    const movieData = movieResponse.pelicula || movieResponse;
                    if (movieData.imagen) posterNode.src = window.CinePrimeAPI.media(movieData.imagen);
                    else posterNode.src = 'https://placehold.co/300x450/1d1f29/fff?text=Poster+no+disponible';
                    if (movieData.imagen_alt) posterNode.alt = movieData.imagen_alt;
                } else {
                    posterNode.src = 'https://placehold.co/300x450/1d1f29/fff?text=Poster+no+disponible';
                }
            } catch (error) {
                console.warn('No se pudo cargar el póster de la película:', error);
                posterNode.src = 'https://placehold.co/300x450/1d1f29/fff?text=Poster+no+disponible';
            }
        }

        updateReviewDetails();

        const heading = document.querySelector('.cm-card h2');
        const subtitle = heading?.parentElement?.querySelector('p');
        if (subtitle) {
            const movieTitle = movie.titulo || 'Función seleccionada';
            const roomText = room.nombre ? ` · Sala ${room.nombre}` : '';
            subtitle.textContent = `${movieTitle}${roomText}${dateTime ? ` · ${dateTime.time}` : ''}`;
        }
    }

    async function loadData() {
        if (!idFuncion || !/^\d+$/.test(idFuncion)) {
            showGridMessage('No se indicó una función válida. Vuelve a la película y selecciona un horario.', true);
            toast('Falta el identificador de la función. No se puede cargar el mapa de asientos.');
            document.getElementById('btnContinue').disabled = true;
            candyContainer.replaceChildren();
            updateSummary();
            return;
        }

        document.getElementById('btnContinue').disabled = true;
        showGridMessage('Cargando mapa de asientos…');
        document.getElementById('countdownTimer').textContent = '--:--';

        try {
            const [details, seatData, productData] = await Promise.all([
                window.CinePrimeAPI.json(`/api/funciones/${encodeURIComponent(idFuncion)}`),
                window.CinePrimeAPI.json(`/api/funciones/${encodeURIComponent(idFuncion)}/asientos`),
                window.CinePrimeAPI.json('/api/productos').catch(() => ({ productos: [], moneda: 'BOB' }))
            ]);

            functionInfo = details;
            seats = Array.isArray(seatData.asientos) ? seatData.asientos : [];
            window.__cineprimeAisles = Array.isArray(seatData.pasillos) ? seatData.pasillos : [];
            products = Array.isArray(productData.productos) ? productData.productos.map(normalizedProduct).filter(product => Number.isFinite(product.id_producto) && product.disponible !== false) : [];
            const savedCart = window.CinePrimeCart?.restoreForFunction(idFuncion);
            if (savedCart) {
                const selectableIds = new Set(seats.filter(seat => seatIsSelectable(seat)).map(seat => Number(seat.id_funcion_asiento)));
                savedCart.seats.forEach(seat => { if (selectableIds.has(Number(seat.id))) selectedSeatIds.add(Number(seat.id)); });
                const savedProducts = new Map(savedCart.products.filter(item => item.origen === 'api').map(item => [Number(item.sourceId ?? item.id), item]));
                products.forEach(product => {
                    const saved = savedProducts.get(Number(product.id_producto));
                    if (saved && product.disponible !== false) selectedCandy.set(Number(product.id_producto), { ...product, cantidad: Math.max(1, Number(saved.cantidad || 1)) });
                });
            }
            activeCategory = 'all';
            currency = details.moneda || seatData.moneda || productData.moneda || 'BOB';

            if (!seats.length) throw new Error('La API no devolvió asientos para esta función.');
            await updateFunctionHeading();
            renderSeats();
            renderCategoryFilters();
            renderProducts();
            updateSummary();
            loading = false;
            updateSummary();
            await recoverSavedReservation();
        } catch (error) {
            console.error('No se pudo cargar la selección de asientos:', error);
            seats = [];
            selectedSeatIds.clear();
            showGridMessage('No se pudo cargar esta función. Comprueba la conexión e inténtalo de nuevo.', true);
            document.getElementById('btnContinue').disabled = true;
            toast(error.message || 'No se pudieron cargar los datos de la función.');
            updateSummary();
        }
    }

    const backButton = document.getElementById('btnBackFromSeats');
    if (backButton) {
        backButton.addEventListener('click', (event) => {
            const previousUrl = document.referrer;
            const sameOriginReferrer = (() => {
                try { return previousUrl && new URL(previousUrl).origin === window.location.origin; }
                catch (_) { return false; }
            })();

            if (sameOriginReferrer && window.history.length > 1) {
                event.preventDefault();
                window.history.back();
                return;
            }

            const movieId = functionInfo?.pelicula?.id_pelicula;
            event.preventDefault();
            if (movieId) {
                window.location.href = `detalle-pelicula.html?id=${encodeURIComponent(movieId)}`;
            } else {
                window.location.href = 'cartelera.html';
            }
        });
    }

    document.getElementById('btnSeatsToCandy')?.addEventListener('click', () => {
        if (!selectedSeatIds.size) {
            toast('Selecciona al menos un asiento disponible antes de continuar.');
            return;
        }
        setPurchaseStep(2, true);
    });

    document.getElementById('btnCandyBackToSeats')?.addEventListener('click', () => setPurchaseStep(1, true));
    document.getElementById('btnReviewBackToCandy')?.addEventListener('click', () => setPurchaseStep(2, true));
    document.getElementById('btnCandyToReview')?.addEventListener('click', () => {
        if (!selectedSeatIds.size) {
            toast('Selecciona primero al menos un asiento disponible.');
            setPurchaseStep(1, true);
            return;
        }
        setPurchaseStep(3, true);
        updateReviewDetails();
    });

    document.getElementById('btnContinue').addEventListener('click', () => {
        if (loading) return;
        if (!selectedSeatIds.size) {
            toast('Selecciona al menos un asiento disponible antes de continuar.');
            setPurchaseStep(1, true);
            return;
        }
        if (currentPurchaseStep === 1) {
            setPurchaseStep(2, true);
            return;
        }
        if (currentPurchaseStep === 2) {
            setPurchaseStep(3, true);
            updateReviewDetails();
            return;
        }
        document.getElementById('customerFullName')?.focus();
    });

    document.querySelectorAll('[data-purchase-step]').forEach(node => {
        node.addEventListener('click', event => {
            event.preventDefault();
            const step = Number(node.dataset.purchaseStep);
            if (step > 1 && !selectedSeatIds.size) {
                toast('Selecciona primero al menos un asiento disponible.');
                setPurchaseStep(1, true);
                return;
            }
            setPurchaseStep(step, true);
        });
    });

    window.addEventListener('cineprime:cart-cleared', () => {
        selectedSeatIds.clear();
        selectedCandy.clear();
        if (seats.length) renderSeats();
        if (products.length) renderProducts();
        updateSummary();
    });

    setPurchaseStep(1, false);

    loadData();
})();
