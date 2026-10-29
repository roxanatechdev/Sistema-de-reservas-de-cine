/* Cliente HTTP compartido: prueba hosts alternativos solo si falla la conexión. */
(function () {
    'use strict';
    const HOSTS = ['http://cine-backend.test', 'http://127.0.0.1:8000'];
    let activeHost = null;

    async function request(path, options = {}) {
        const errores = [];
        for (const host of HOSTS) {
            let response;
            try {
                response = await fetch(`${host}${path.startsWith('/') ? path : `/${path}`}`, {
                    ...options,
                    headers: { Accept: 'application/json', ...(options.headers || {}) },
                    signal: options.signal || AbortSignal.timeout(7000)
                });
            } catch (error) {
                errores.push(`${host}: ${error.message || 'sin conexión'}`);
                continue;
            }

            // Si el servidor respondió (por ejemplo, 409 por asiento ocupado), no probar otro host.
            activeHost = host;
            if (!response.ok) {
                let payload = null;
                try { payload = await response.clone().json(); } catch (_) { /* respuesta no JSON */ }
                const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(' ') : '';
                const error = new Error(payload?.message || validationMessage || `La API respondió HTTP ${response.status}.`);
                error.status = response.status;
                error.payload = payload;
                throw error;
            }
            return response;
        }
        throw new Error(`No se pudo conectar con la API de CinePrime. ${errores.join(' | ')}`);
    }

    window.CinePrimeAPI = Object.freeze({
        hosts: HOSTS.slice(),
        media(url) {
            if (typeof url !== 'string' || !activeHost) return url;
            for (const host of HOSTS) {
                if (url.startsWith(`${host}/`)) return `${activeHost}${url.slice(host.length)}`;
            }
            return url;
        },
        request,
        async json(path, options) { return (await request(path, options)).json(); }
    });
})();
