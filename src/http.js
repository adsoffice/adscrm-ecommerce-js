import {
    ShopError,
    ShopMaintenanceError,
    ShopNetworkError,
    ShopNotFoundError,
    ShopRateLimitError,
    ShopUnauthorizedError,
    ShopValidationError,
} from './errors.js';

const DELIVERY_PREFIX = 'api/v1/public';

/**
 * Mağaza kök adresi: `https://crm.adsoffice.net/api/v1/public/<TOKEN>/shop`.
 * `baseUrl` olarak sunucu kökü ya da tam delivery adresi verilebilir.
 */
export function buildBase(baseUrl, token) {
    const base = String(baseUrl || '').replace(/\/+$/, '');
    if (!base) throw new ShopError('createShop: `baseUrl` zorunludur.');

    if (base.includes(`/${DELIVERY_PREFIX}/`)) return base.endsWith('/shop') ? base : `${base}/shop`;
    if (!token) throw new ShopError('createShop: `token` (site delivery tokenı) zorunludur.');

    return `${base}/${DELIVERY_PREFIX}/${token}/shop`;
}

/**
 * Sorgu dizesi. Boş değerler düşer, diziler virgülle birleşir; iç içe nesneler
 * köşeli parantezle açılır: `{ attr: { renk: ['kirmizi'] } }` → `attr[renk]=kirmizi`.
 */
export function queryString(params = {}) {
    const search = new URLSearchParams();
    const add = (key, value) => {
        if (value === undefined || value === null || value === '' || value === false) return;
        if (Array.isArray(value)) {
            if (value.length) search.append(key, value.join(','));
            return;
        }
        if (typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
            return;
        }
        search.append(key, value === true ? '1' : String(value));
    };
    for (const [key, value] of Object.entries(params)) add(key, value);
    const qs = search.toString();
    return qs ? `?${qs}` : '';
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tek bir mağaza isteği. GET (katalog) uçlarında `revalidate` / `tags` Next.js
 * `fetch` önbelleğine geçer; yazma uçları ve müşteri oturumlu istekler her zaman
 * önbelleksizdir (`cache: 'no-store'`).
 */
export async function request(config, path, options = {}) {
    const {
        method = 'GET',
        query = {},
        body,
        locale,
        currency,
        customerToken,
        revalidate,
        tags,
        cache,
        signal,
        headers = {},
        retries,
    } = options;

    const params = { ...query };
    const resolvedLocale = locale !== undefined ? locale : query.locale !== undefined ? query.locale : config.locale;
    if (resolvedLocale) params.locale = resolvedLocale;
    else delete params.locale;
    // Para birimi yalnızca katalog/sepet okumalarında anlamlıdır; çağrı > istemci.
    const resolvedCurrency = currency !== undefined ? currency : query.currency !== undefined ? query.currency : config.currency;
    if (resolvedCurrency && method === 'GET') params.currency = resolvedCurrency;
    else if (!resolvedCurrency) delete params.currency;

    const url = `${config.base}/${String(path).replace(/^\/+/, '')}${queryString(params)}`;

    const fetchImpl = config.fetch || globalThis.fetch;
    if (!fetchImpl) throw new ShopError('Ortamda `fetch` yok. Node 18+ kullanın ya da `fetch` seçeneğini verin.');

    const session = customerToken !== undefined ? customerToken : config.customerToken;
    const init = {
        method,
        headers: {
            Accept: 'application/json',
            ...config.headers,
            ...(session ? { 'X-Customer-Token': session } : {}),
            ...headers,
        },
        signal,
    };
    if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    // Önbellek: yalnızca oturumsuz GET. Oturumlu katalog yanıtı (B2B fiyat) kişiye özeldir.
    const cacheable = method === 'GET' && !session;
    const nextRevalidate = cacheable ? (revalidate ?? config.revalidate) : 0;
    const nextTags = cacheable ? (tags ?? config.tags) : undefined;
    const noStore = cache === 'no-store' || nextRevalidate === 0 || nextRevalidate === false;
    const nextOptions = {};
    if (!noStore && nextRevalidate !== undefined) nextOptions.revalidate = nextRevalidate;
    if (!noStore && nextTags && nextTags.length) nextOptions.tags = nextTags;
    if (Object.keys(nextOptions).length) init.next = nextOptions;
    if (noStore) init.cache = 'no-store';
    else if (cache) init.cache = cache;

    // Yazma istekleri yeniden denenmez (çift sipariş/çift sepete ekleme olmasın).
    const maxRetries = retries ?? (method === 'GET' ? config.retries : 0);
    let attempt = 0;

    for (;;) {
        let response;
        const timeout = config.timeout;
        let timer = null;
        try {
            if (timeout && typeof AbortController !== 'undefined' && !signal) {
                const controller = new AbortController();
                timer = setTimeout(() => controller.abort(), timeout);
                init.signal = controller.signal;
            }
            response = await fetchImpl(url, init);
        } catch (error) {
            if (attempt < maxRetries) {
                attempt += 1;
                await sleep(config.retryDelay * attempt);
                continue;
            }
            throw new ShopNetworkError(
                error?.name === 'AbortError' ? `İstek zaman aşımına uğradı (${timeout} ms).` : 'Sunucuya ulaşılamadı.',
                { url: redact(url, config), cause: error },
            );
        } finally {
            if (timer) clearTimeout(timer);
        }

        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = text;
            }
        }

        if (response.ok) return payload;

        const inMaintenance = response.status === 503 && payload && payload.maintenance;
        if (response.status >= 500 && !inMaintenance && attempt < maxRetries) {
            attempt += 1;
            await sleep(config.retryDelay * attempt);
            continue;
        }

        const message = (payload && payload.message) || `AdsCRM ${response.status}`;
        const meta = { url: redact(url, config), body: payload, status: response.status };

        if (inMaintenance) {
            throw new ShopMaintenanceError(message, {
                ...meta,
                maintenance: payload.maintenance,
                retryAfter: Number(response.headers?.get?.('Retry-After')) || payload.maintenance?.retry_after || null,
            });
        }
        if (response.status === 401) throw new ShopUnauthorizedError(message, meta);
        if (response.status === 404) throw new ShopNotFoundError(message, meta);
        if (response.status === 422) throw new ShopValidationError(message, { ...meta, errors: payload?.errors });
        if (response.status === 429) {
            throw new ShopRateLimitError(message, { ...meta, retryAfter: Number(response.headers?.get?.('Retry-After')) || null });
        }
        throw new ShopError(message, meta);
    }
}

/** Hata nesnelerinde site token'ı görünmesin (günlüklere sızmasın). */
function redact(url, config) {
    return config.token ? url.replace(config.token, '***') : url;
}
