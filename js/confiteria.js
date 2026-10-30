/**
 * CinePrime — Confitería pública
 * Mantiene intactos el diseño, las tarjetas y los filtros dinámicos.
 * Resuelve las imágenes guardadas por el formulario administrativo de Laravel.
 */
(() => {
    'use strict';

    const API_URL = 'http://127.0.0.1:8000/api/productos';
    const API_ORIGIN = new URL(API_URL).origin;
    const PLACEHOLDER = 'https://placehold.co/640x420/191b24/e9c349?text=Imagen+no+disponible';
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
        const image = product.imagen_url || product.imagen || '';
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
                        <img src="${PLACEHOLDER}" data-product-image="${escapeHtml(image)}"
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

    // Convierte el valor guardado en producto.imagen a una URL servida por Laravel
    // o a una ruta local del frontend, sin cambiar los nombres ni mover archivos.
    // Fotografías reales que ya están dentro de frontend/img.
    // Los nombres example.test son valores de demostración guardados anteriormente;
    // se traducen a los archivos locales existentes, no se solicitan a ese dominio.
    const LOCAL_PRODUCT_IMAGES = {
        // Bebidas del catálogo de demostración
        'agua.jpg': 'agua.jpg',
        'gaseosa.jpg': 'coca.jpg',
        'gaseosa-1l.jpg': 'fanta.jpg',
        // Resto de productos
        'combo-clasico.jpg': 'combo pipo res.jpg',
        'palomitas-s.jpg': 'pipova pequ.jpg',
        'palomitas-m.jpg': 'pipoca.jpg',
        'palomitas-l.jpg': 'pipo grande.jpg',
        'gaseosa.jpg': 'coca.jpg',
        'sandwich.jpg': 'hambur.jpg',
        'chocolate.jpg': 'choco blanco.jpg',
        'hotdog.jpg': 'hotdog.jpg',
        'combo-pareja.jpg': 'combo1.jpg',
        'combo-familiar.jpg': 'combo6.jpg',
        'nachos.jpg': 'combo4.jpg'
    };

    function encodeLocalPath(path) {
        return path.split('/').map((part) => encodeURIComponent(part)).join('/');
    }

    function imageCandidates(value) {
        const raw = String(value || '').trim();
        if (!raw) return [PLACEHOLDER];
        if (/^data:image\//i.test(raw)) return [raw, PLACEHOLDER];

        let filename = raw.split(/[?#]/)[0].split('/').pop() || '';
        try { filename = decodeURIComponent(filename); } catch (_) { /* conserva el nombre */ }
        const mapped = LOCAL_PRODUCT_IMAGES[filename.toLowerCase()];
        const localCandidates = [];
        if (mapped) localCandidates.push(`img/${encodeLocalPath(mapped)}`);

        // Si la BD ya contiene el nombre real del archivo, probarlo directamente
        // dentro de img/ (donde están las fotografías descargadas del frontend).
        if (filename && !mapped) localCandidates.push(`img/${encodeLocalPath(filename)}`);

        // URLs ficticias no deben salir a Internet: se resuelven con los archivos locales.
        if (/\.example\.test\//i.test(raw)) {
            return [...localCandidates, PLACEHOLDER];
        }

        if (/^https?:\/\//i.test(raw)) {
            try {
                const parsed = new URL(raw);
                if (/\/storage\//i.test(parsed.pathname)) {
                    return [...localCandidates,
                        `${API_ORIGIN}${parsed.pathname}${parsed.search}`,
                        raw,
                        PLACEHOLDER];
                }
            } catch (_) { /* Se tratará como ruta relativa más abajo. */ }
            return [...localCandidates, raw, PLACEHOLDER];
        }

        let path = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
        path = path.replace(/^public\//i, '');
        if (/^frontend\//i.test(path)) path = path.replace(/^frontend\//i, '');

        if (/^(img|images|assets)\//i.test(path)) {
            return [path, ...localCandidates, new URL(path, document.baseURI).href, PLACEHOLDER];
        }

        path = path.replace(/^storage\//i, '').replace(/^products\//i, 'productos/');
        if (!path.includes('/')) path = `productos/${path}`;
        const encoded = path.split('/').map(encodeURIComponent).join('/');
        return [...localCandidates,
            `${API_ORIGIN}/storage/${encoded}`,
            `${API_ORIGIN}/${encoded}`,
            PLACEHOLDER];
    }

    function bindProductImages(root = grid) {
        root.querySelectorAll('img[data-product-image]').forEach((img) => {
            const candidates = imageCandidates(img.dataset.productImage);
            let index = 0;
            const tried = new Set();
            const tryNext = () => {
                while (index < candidates.length) {
                    const candidate = candidates[index++];
                    if (tried.has(candidate)) continue;
                    tried.add(candidate);
                    if (img.src !== new URL(candidate, document.baseURI).href) img.src = candidate;
                    return;
                }
            };
            img.addEventListener('error', tryNext);
            tryNext();
        });
    }

    function renderSelectedProducts() {
        const filtered = selectedCategory === 'all'
            ? allProducts
            : allProducts.filter((product) => getCategoryKey(product) === selectedCategory);

        grid.innerHTML = filtered.map(renderProduct).join('');
        bindProductImages();
        status.hidden = filtered.length > 0;
        if (!filtered.length) status.textContent = 'No hay productos disponibles en esta categoría.';
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
            const products = Array.isArray(data) ? data : (data.productos || data.data);
            if (!Array.isArray(products)) throw new Error('La API no devolvió una lista de productos.');
            allProducts = products;
            renderCategoryButtons();
            if (!allProducts.length) {
                status.hidden = false;
                status.textContent = 'Todavía no hay productos activos disponibles.';
                return;
            }
            renderSelectedProducts();
        } catch (error) {
            console.error('Error cargando productos de confitería:', error);
            status.hidden = false;
            status.textContent = 'No se pudieron cargar los productos. Verifica que Laravel esté iniciado y que /api/productos esté disponible.';
        }
    }

    loadProducts();
})();
