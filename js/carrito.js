/* Carrito compartido CinePrime. El backend crea y controla la reserva después de confirmar los datos. */
(function () {
    'use strict';
    if (window.CinePrimeCart) return;

    const STORAGE_KEY = 'cineprime_cart_v1';
    const EMPTY = () => ({ version: 1, functionId: null, function: null, seats: [], products: [], updatedAt: Date.now() });
    let state = readState();

    function readState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (!parsed || parsed.version !== 1) return EMPTY();
            return { ...EMPTY(), ...parsed, seats: Array.isArray(parsed.seats) ? parsed.seats : [], products: Array.isArray(parsed.products) ? parsed.products.filter(p => p && (p.origen === 'api' || Number(p.sourceId || p.id) > 0)) : [] };
        } catch (_) { return EMPTY(); }
    }
    function persist() {
        state.updatedAt = Date.now();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { console.warn('No se pudo guardar el carrito local.', error); }
        render();
        window.dispatchEvent(new CustomEvent('cineprime:cart-updated', { detail: getState() }));
    }
    function getState() { return JSON.parse(JSON.stringify(state)); }
    function money(value) {
        const n = Number(value);
        return `Bs ${Number.isFinite(n) ? n.toFixed(2).replace('.', ',') : '0,00'}`;
    }
    function escapeText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
    function productCount() { return state.products.reduce((n, p) => n + Math.max(0, Number(p.cantidad) || 0), 0); }
    function itemCount() { return state.seats.length + productCount(); }
    function total() { return state.seats.reduce((sum, s) => sum + Number(s.precio || 0), 0) + state.products.reduce((sum, p) => sum + Number(p.precio || 0) * Number(p.cantidad || 0), 0); }

    function syncFromSeats(payload) {
        state.functionId = payload.functionId ? String(payload.functionId) : null;
        state.function = payload.function || null;
        state.seats = Array.isArray(payload.seats) ? payload.seats.map(s => ({ id: Number(s.id_funcion_asiento), label: String(s.label || `${s.fila ?? ''}${s.numero ?? ''}`), precio: Number(s.precio || 0) })) : [];
        const merged = new Map(state.products.filter(p => Number(p.sourceId || p.id) > 0).map(p => [String(p.sourceId || p.id), { ...p }]));
        const apiProducts = Array.isArray(payload.products) ? payload.products.map(p => ({ id: String(p.id_producto), sourceId: Number(p.id_producto), nombre: String(p.nombre || 'Producto'), precio: Number(p.precio || 0), cantidad: Math.max(1, Number(p.cantidad || 1)), imagen: p.imagen || null, origen: 'api' })) : [];
        apiProducts.forEach(product => merged.set(String(product.sourceId), { ...merged.get(String(product.sourceId)), ...product }));
        state.products = Array.from(merged.values());
        persist();
    }
    function restoreForFunction(functionId) {
        if (!functionId || String(state.functionId) !== String(functionId)) return null;
        return getState();
    }
    function addProduct(product) {
        const sourceId = Number(product.sourceId || product.id_producto || (Number.isInteger(Number(product.id)) ? product.id : 0));
        if (!Number.isInteger(sourceId) || sourceId <= 0) { console.warn('No se añadió un producto sin ID válido del catálogo.'); return; }
        const id = String(sourceId);
        const found = state.products.find(p => String(p.id) === id);
        if (found) found.cantidad += 1;
        else state.products.push({ id, sourceId, nombre: String(product.nombre || 'Producto'), precio: Number(product.precio || 0), cantidad: 1, imagen: product.imagen || null, origen: 'api' });
        persist();
    }
    function changeProduct(id, delta) {
        const product = state.products.find(p => String(p.id) === String(id));
        if (!product) return;
        product.cantidad = Math.max(0, Number(product.cantidad || 0) + Number(delta || 0));
        if (!product.cantidad) state.products = state.products.filter(p => String(p.id) !== String(id));
        persist();
    }
    function clear() { state = EMPTY(); persist(); window.dispatchEvent(new CustomEvent('cineprime:cart-cleared')); }

    function render() {
        const count = itemCount();
        ['navbarCartCount', 'mobileNavbarCartCount'].forEach(id => {
            const node = document.getElementById(id);
            if (!node) return;
            node.textContent = String(count);
            node.classList.toggle('d-none', count === 0 && id === 'navbarCartCount');
        });
        const content = document.getElementById('cinePrimeCartContent');
        const totalNode = document.getElementById('cinePrimeCartTotal');
        const hint = document.getElementById('cinePrimeCartHint');
        const checkout = document.getElementById('cinePrimeCartCheckout');
        if (!content) return;
        content.replaceChildren();
        if (!state.seats.length && !state.products.length) {
            const empty = document.createElement('p');
            empty.className = 'text-white-50 small';
            empty.textContent = 'Tu carrito está vacío. Selecciona asientos o añade productos de confitería.';
            content.appendChild(empty);
        }
        if (state.function) {
            const fn = document.createElement('div');
            fn.className = 'rounded-3 border border-secondary border-opacity-25 p-3';
            fn.innerHTML = `<div class="fw-semibold">${escapeText(state.function.titulo || 'Función seleccionada')}</div><div class="small text-white-50">${escapeText([state.function.fecha, state.function.hora, state.function.sala].filter(Boolean).join(' · '))}</div>`;
            content.appendChild(fn);
        }
        if (state.seats.length) {
            const section = document.createElement('section');
            section.innerHTML = `<h3 class="h6 mb-2">Asientos (${state.seats.length})</h3>`;
            state.seats.forEach(seat => {
                const row = document.createElement('div'); row.className = 'd-flex justify-content-between align-items-center py-2 border-bottom border-secondary border-opacity-25';
                const name = document.createElement('span'); name.textContent = `Asiento ${seat.label}`;
                const price = document.createElement('span'); price.className = 'small'; price.textContent = money(seat.precio);
                row.append(name, price); section.appendChild(row);
            });
            content.appendChild(section);
        }
        if (state.products.length) {
            const section = document.createElement('section');
            const heading = document.createElement('h3'); heading.className = 'h6 mb-2'; heading.textContent = `Confitería (${productCount()} unidad${productCount() === 1 ? '' : 'es'})`; section.appendChild(heading);
            state.products.forEach(product => {
                const row = document.createElement('div'); row.className = 'd-flex gap-2 align-items-center py-2 border-bottom border-secondary border-opacity-25';
                if (product.imagen) { const img = document.createElement('img'); img.src = product.imagen; img.alt = ''; img.className = 'rounded'; img.style.cssText = 'width:54px;height:54px;object-fit:cover'; row.appendChild(img); }
                const info = document.createElement('div'); info.className = 'flex-grow-1 min-w-0';
                const title = document.createElement('div'); title.className = 'small fw-semibold'; title.textContent = product.nombre;
                const price = document.createElement('div'); price.className = 'small text-white-50'; price.textContent = `${money(product.precio)} c/u`;
                const controls = document.createElement('div'); controls.className = 'd-flex align-items-center gap-2 mt-1';
                const minus = document.createElement('button'); minus.type = 'button'; minus.className = 'btn btn-sm btn-outline-light py-0 px-2'; minus.textContent = '−'; minus.setAttribute('aria-label', `Quitar una unidad de ${product.nombre}`); minus.addEventListener('click', () => changeProduct(product.id, -1));
                const qty = document.createElement('span'); qty.className = 'small'; qty.textContent = String(product.cantidad);
                const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'btn btn-sm btn-outline-light py-0 px-2'; plus.textContent = '+'; plus.setAttribute('aria-label', `Añadir una unidad de ${product.nombre}`); plus.addEventListener('click', () => changeProduct(product.id, 1));
                controls.append(minus, qty, plus); info.append(title, price, controls);
                const subtotal = document.createElement('span'); subtotal.className = 'small text-nowrap'; subtotal.textContent = money(Number(product.precio) * Number(product.cantidad));
                row.append(info, subtotal); section.appendChild(row);
            });
            content.appendChild(section);
        }
        if (totalNode) totalNode.textContent = money(total());
        const hasSeats = state.seats.length > 0 && !!state.functionId;
        if (hint) hint.textContent = hasSeats ? 'Revisa los detalles antes de continuar. La reserva aún no se ha creado.' : (state.products.length ? 'Puedes comprar solo confitería o combinarla con una función y asientos.' : 'Añade productos de confitería o selecciona una función y sus asientos.');
        if (checkout) checkout.disabled = !state.products.length && !hasSeats;
    }

    function injectOffcanvasIfNeeded() {
        // El offcanvas viaja en navbar.html, que se carga asíncronamente.
        render();
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('.cm-candy-btn-add[data-product-id], #addOrderBtn[data-product-id]');
        if (!button) return;
        const productId = Number(button.dataset.productId);
        const product = (window.CinePrimeCatalogProducts || []).find(item => Number(item.id_producto) === productId);
        if (!product || !Number.isInteger(productId) || productId <= 0) {
            console.warn('El producto del banner/tarjeta no coincide con el catálogo de la API.');
            return;
        }
        addProduct({ id_producto: productId, nombre: product.nombre, precio: product.precio ?? product.precio_actual, imagen: product.imagen, origen: 'api' });
        const old = button.innerHTML;
        button.innerHTML = '<span class="material-symbols-outlined fs-6">check</span><span>Añadido</span>';
        button.classList.add('added');
        window.setTimeout(() => { if (button.isConnected) { button.innerHTML = old; button.classList.remove('added'); } }, 1200);
    });
    document.addEventListener('click', event => {
        if (event.target.closest('#cinePrimeCartClear')) clear();
        if (event.target.closest('#cinePrimeCartCheckout')) {
            if (!state.seats.length || !state.functionId) {
                if (state.products.length) {
                    window.location.href = 'pago.html?tipo=confiteria';
                } else {
                    window.location.href = 'cartelera.html';
                }
                return;
            }
            const url = `asientos.html?id_funcion=${encodeURIComponent(state.functionId)}`;
            if (window.location.pathname.endsWith('/asientos.html') || window.location.pathname === 'asientos.html') {
                const drawer = document.getElementById('cinePrimeCart');
                if (drawer && window.bootstrap?.Offcanvas) window.bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
                document.getElementById('btnCandyToReview')?.click();
            } else window.location.href = url;
        }
    });
    window.CinePrimeCart = { getState, restoreForFunction, syncFromSeats, addProduct, changeProduct, clear, render };
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { state = readState(); render(); } });
    const observer = new MutationObserver(injectOffcanvasIfNeeded);
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('navbar-container');
        // Observar solo los hijos directos detecta la carga del navbar, pero evita
        // el ciclo infinito causado al renderizar el offcanvas dentro de ese navbar.
        if (container) observer.observe(container, { childList: true, subtree: false });
        render();
    });
    render();
})();
