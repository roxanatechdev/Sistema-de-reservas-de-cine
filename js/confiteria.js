/**
 * CinePrime — Confitería pública
 * Productos y filtros por categoría cargados desde la API.
 * Los banners, preguntas frecuentes y demás secciones visuales permanecen estáticos.
 */
(() => {
    'use strict';

    const API_URL = 'http://127.0.0.1:8000/api/productos';
    const PLACEHOLDER = 'https://placehold.co/640x420/191b24/e9c349?text=CinePrime+Confiteria';
    const grid = document.getElementById('productos-grid');
    const status = document.getElementById('productos-status');
    const categoriesContainer = document.getElementById('categorias-productos');

    if (!grid || !status || !categoriesContainer) return;

    let allProducts = [];
    let selectedCategory = 'all';

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    const money = (value) => `${Number(value || 0).toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })} Bs`;

    function renderProduct(product) {
        const name = product.nombre || 'Producto CinePrime';
        const description = product.descripcion || 'Disfruta este producto en nuestra confitería.';
        const image = product.imagen || PLACEHOLDER;
        const price = product.precio ?? product.precio_actual ?? 0;
        const oldPrice = product.es_promocion && product.precio_actual != null
            ? `<span class="cm-candy-price-savings">Antes ${money(product.precio_actual)}</span>`
            : (product.tamano ? `<span class="cm-candy-price-savings">${escapeHtml(product.tamano)}</span>` : '');
        const badge = product.es_promocion
            ? '<span class="cm-badge cm-badge-warning">Promoción</span>'
            : (product.categoria ? `<span class="cm-badge cm-badge-dark">${escapeHtml(product.categoria)}</span>` : '');
        const weight = product.peso_gramos ? `${escapeHtml(product.peso_gramos)} g` : '';
        const volume = product.contenido_ml ? `${weight ? ' · ' : ''}${escapeHtml(product.contenido_ml)} ml` : '';
        const variant = product.tipo_variante ? `${(weight || volume) ? ' · ' : ''}${escapeHtml(product.tipo_variante)}` : '';

        return `
            <div class="col-12 col-sm-6 col-lg-4 col-xl-3 d-flex">
                <article class="cm-candy-card w-100">
                    <div class="cm-media-candy">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}"
                             class="cm-card-media-img" loading="lazy"
                             onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
                        <div class="cm-card-media-overlay"></div>
                        <div class="cm-badge-overlay"><div class="cm-badge-row-top">${badge}</div></div>
                    </div>
                    <div class="cm-candy-body">
                        <h3 class="cm-candy-title">${escapeHtml(name)}</h3>
                        <p class="cm-candy-description">${escapeHtml(description)}</p>
                        <div class="cm-candy-option-slot"><span class="cm-candy-option-static">${weight}${volume}${variant}</span></div>
                        <div class="cm-candy-footer-action">
                            <div class="cm-candy-price-box">
                                <span class="cm-candy-price-main">${money(price)}</span>${oldPrice}
                            </div>
                            <button type="button" class="cm-candy-btn-add" aria-label="${escapeHtml(`Añadir ${name}`)}">
                                <span class="material-symbols-outlined fs-6">add</span><span>Añadir</span>
                            </button>
                        </div>
                    </div>
                </article>
            </div>`;
    }

    function getCategoryKey(product) {
        return product.id_categoria_producto != null
            ? String(product.id_categoria_producto)
            : String(product.categoria || 'sin-categoria');
    }

    function renderCategoryButtons() {
        const categories = new Map();
        allProducts.forEach((product) => {
            const key = getCategoryKey(product);
            const name = product.categoria || 'Otros productos';
            if (!categories.has(key)) categories.set(key, { key, name, count: 0 });
            categories.get(key).count += 1;
        });

        const buttons = [
            `<button type="button" class="btn btn-category-pill ${selectedCategory === 'all' ? 'active' : ''} text-nowrap" data-category-id="all">Todos los productos (${allProducts.length})</button>`,
            ...Array.from(categories.values()).map((category) =>
                `<button type="button" class="btn btn-category-pill ${selectedCategory === category.key ? 'active' : ''} text-nowrap" data-category-id="${escapeHtml(category.key)}">${escapeHtml(category.name)} (${category.count})</button>`
            )
        ];
        categoriesContainer.innerHTML = buttons.join('');
    }

    function renderSelectedProducts() {
        const filtered = selectedCategory === 'all'
            ? allProducts
            : allProducts.filter((product) => getCategoryKey(product) === selectedCategory);

        grid.innerHTML = filtered.map(renderProduct).join('');
        if (filtered.length === 0) {
            status.hidden = false;
            status.textContent = 'No hay productos disponibles en esta categoría.';
        } else {
            status.hidden = true;
        }
    }

    categoriesContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-category-id]');
        if (!button) return;
        selectedCategory = button.dataset.categoryId || 'all';
        categoriesContainer.querySelectorAll('button[data-category-id]').forEach((item) => {
            const active = item === button;
            item.classList.toggle('active', active);
            item.setAttribute('aria-pressed', String(active));
        });
        renderSelectedProducts();
    });

    async function loadProducts() {
        status.hidden = false;
        status.textContent = 'Cargando productos de confitería...';
        grid.replaceChildren();

        try {
            const response = await fetch(API_URL, { method: 'GET', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error(`La API respondió con HTTP ${response.status}`);
            const data = await response.json();
            const products = Array.isArray(data) ? data : data.productos;
            if (!Array.isArray(products)) throw new Error('La respuesta de la API no contiene una lista de productos.');

            allProducts = products;
            if (allProducts.length === 0) {
                renderCategoryButtons();
                status.textContent = 'Todavía no hay productos activos disponibles.';
                return;
            }
            renderCategoryButtons();
            renderSelectedProducts();
        } catch (error) {
            console.error('Error cargando productos de confitería:', error);
            status.hidden = false;
            status.textContent = 'No se pudieron cargar los productos. Verifica que Laravel esté iniciado y que /api/productos esté disponible.';
        }
    }

    loadProducts();
})();
