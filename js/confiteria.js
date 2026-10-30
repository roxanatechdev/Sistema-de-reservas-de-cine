/**
 * CinePrime — Confitería pública
 * Productos y filtros por categoría cargados desde la API.
 * Los banners, preguntas frecuentes y demás secciones visuales permanecen estáticos.
 */
(() => {
    'use strict';

    const API_URL = 'http://127.0.0.1:8000/api/productos';
    const PLACEHOLDER = 'https://placehold.co/640x420/191b24/e9c349?text=CinePrime+Confiteria';
    const API_ORIGIN = new URL(API_URL).origin;
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
        const image = product.imagen || '';
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
                        <img src="${escapeHtml(image || PLACEHOLDER)}" data-product-image="${escapeHtml(image)}"
                             data-product-name="${escapeHtml(name)}" data-product-category="${escapeHtml(product.categoria || '')}"
                             alt="${escapeHtml(name)}" class="cm-card-media-img" loading="lazy">
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

    // Los dominios *.example.test son datos ficticios del SQL de prueba: no existen en Internet.
    // Para esos registros usamos ilustraciones locales. Las rutas reales de Storage se conservan.
    function fallbackImage(name = '', category = '', raw = '') {
        const text = `${name} ${category} ${raw}`.toLowerCase();
        let file = 'confiteria.svg';
        if (/palomita|popcorn/.test(text)) file = 'palomitas.svg';
        else if (/gaseosa|agua|bebida|refresco/.test(text)) file = 'bebida.svg';
        else if (/combo/.test(text)) file = 'combo.svg';
        else if (/hot.?dog|perro caliente/.test(text)) file = 'hotdog.svg';
        else if (/sandwich|sándwich/.test(text)) file = 'sandwich.svg';
        else if (/chocolate|gomita|nacho|dulce/.test(text)) file = 'snack.svg';
        else if (/vaso|coleccionable/.test(text)) file = 'vaso.svg';
        return `img/confiteria/${file}`;
    }

    function imageCandidates(rawValue, name = '', category = '') {
        const raw = String(rawValue || '').trim();
        if (!raw) return [fallbackImage(name, category), PLACEHOLDER];

        // En el SQL de prueba se guardaron URLs como https://images.example.test/products/palomitas-s.jpg.
        // Ese dominio es intencionalmente ficticio; no se debe intentar cargarlo desde el navegador.
        if (/^https?:\/\/images\.example\.test\//i.test(raw) || /\.example\.test\//i.test(raw)) {
            return [fallbackImage(name, category, raw), PLACEHOLDER];
        }
        if (/^(https?:|data:|blob:)/i.test(raw)) return [raw, fallbackImage(name, category), PLACEHOLDER];

        let path = raw.replace(/\\/g, '/').replace(/^\.\//, '');
        const candidates = [];
        const add = (value) => {
            if (value && !candidates.includes(value)) candidates.push(value);
        };

        if (/^(img|images|assets|frontend\/img)\//i.test(path)) {
            add(path.replace(/^frontend\//i, ''));
            add(new URL(path, document.baseURI).href);
        }

        path = path.replace(/^\/+/, '').replace(/^public\//i, '');
        if (/^storage\//i.test(path)) {
            add(`${API_ORIGIN}/${path}`);
            path = path.replace(/^storage\//i, '');
        }
        if (/^productos\//i.test(path) || /^products\//i.test(path)) {
            path = path.replace(/^products\//i, 'productos/');
            add(`${API_ORIGIN}/storage/${path}`);
        } else if (path.includes('/')) {
            add(`${API_ORIGIN}/storage/${path}`);
            add(path);
            add(new URL(path, document.baseURI).href);
        } else {
            add(`${API_ORIGIN}/storage/productos/${encodeURIComponent(path)}`);
            add(`${API_ORIGIN}/storage/${encodeURIComponent(path)}`);
            add(`img/${encodeURIComponent(path)}`);
        }
        add(fallbackImage(name, category, raw));
        add(PLACEHOLDER);
        return candidates;
    }

    function bindProductImages(root = grid) {
        root.querySelectorAll('img[data-product-image]').forEach((img) => {
            const candidates = imageCandidates(
                img.dataset.productImage,
                img.dataset.productName || img.alt || '',
                img.dataset.productCategory || ''
            );
            let nextCandidate = 1;
            img.addEventListener('error', () => {
                if (nextCandidate < candidates.length) {
                    img.src = candidates[nextCandidate++];
                }
            });
            img.src = candidates[0];
        });
    }

    function renderSelectedProducts() {
        const filtered = selectedCategory === 'all'
            ? allProducts
            : allProducts.filter((product) => getCategoryKey(product) === selectedCategory);

        grid.innerHTML = filtered.map(renderProduct).join('');
        bindProductImages();
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
