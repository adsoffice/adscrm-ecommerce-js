/**
 * Katalog süzgeçleri — URL arama parametreleri ↔ süzgeç nesnesi ↔ API sorgusu.
 *
 * Süzgeç nesnesi:
 * ```js
 * {
 *   category: 'giyim', brand: ['acme'],
 *   attr: { malzeme: ['pamuk'], agirlik: '100..250', su_gecirmez: '1' },
 *   opt: { renk: ['kirmizi'], beden: ['m', 'l'] },
 *   price_min: 10000, price_max: 50000,      // kuruş, istenen para biriminde
 *   in_stock: true, featured: true, new: true,
 *   q: 'tişört', sort: '-created', page: 2, limit: 24,
 * }
 * ```
 *
 * Vitrin adreslerinde kısa ve okunur biçim kullanılır: `?marka=acme&malzeme=pamuk&renk=kirmizi`
 * yerine bu paket `?brand=acme&attr.malzeme=pamuk&opt.renk=kirmizi` biçimini üretir/okur —
 * adres kendinden açıklamalıdır ve API'ye birebir çevrilir.
 */

export const SORTS = ['default', 'price', '-price', '-created', 'name'];

const SCALAR = ['category', 'q', 'sort'];
const NUMERIC = ['price_min', 'price_max', 'page', 'limit'];
const FLAGS = ['in_stock', 'featured', 'new'];

const list = (value) => [].concat(value ?? [])
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);

/** Süzgeç nesnesi → API sorgu parametreleri (`attr[renk]=a,b`). */
export function filtersToQuery(filters = {}) {
    const query = {};
    for (const key of SCALAR) if (filters[key]) query[key] = String(filters[key]);
    for (const key of NUMERIC) if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') query[key] = Number(filters[key]);
    for (const key of FLAGS) if (filters[key]) query[key] = 1;
    if (filters.brand && list(filters.brand).length) query.brand = list(filters.brand);
    for (const group of ['attr', 'opt']) {
        const entries = Object.entries(filters[group] || {})
            .map(([code, value]) => [code, typeof value === 'string' && value.includes('..') ? value : list(value)])
            .filter(([, value]) => (Array.isArray(value) ? value.length : value));
        if (entries.length) query[group] = Object.fromEntries(entries);
    }
    if (query.sort === 'default') delete query.sort;
    return query;
}

/**
 * URL arama parametreleri (`URLSearchParams`, Next `searchParams` nesnesi ya da düz
 * nesne) → süzgeç nesnesi. `attr.<kod>` / `opt.<kod>` anahtarları okunur.
 */
export function parseFilters(searchParams = {}) {
    const entries = typeof searchParams?.entries === 'function'
        ? Array.from(searchParams.entries())
        : Object.entries(searchParams).flatMap(([k, v]) => [].concat(v).map((x) => [k, x]));

    const filters = { attr: {}, opt: {} };
    for (const [key, raw] of entries) {
        const value = String(raw ?? '');
        if (value === '') continue;
        const group = key.startsWith('attr.') ? 'attr' : key.startsWith('opt.') ? 'opt' : null;
        if (group) {
            const code = key.slice(group.length + 1);
            filters[group][code] = value.includes('..') ? value : [...(filters[group][code] || []), ...list(value)];
        } else if (key === 'brand') {
            filters.brand = [...(filters.brand || []), ...list(value)];
        } else if (SCALAR.includes(key)) {
            filters[key] = value;
        } else if (NUMERIC.includes(key) && Number.isFinite(Number(value))) {
            filters[key] = Number(value);
        } else if (FLAGS.includes(key)) {
            filters[key] = value === '1' || value === 'true';
        }
    }
    if (filters.sort && !SORTS.includes(filters.sort)) delete filters.sort;
    return filters;
}

/** Süzgeç nesnesi → vitrin arama parametreleri (`?brand=a,b&opt.renk=kirmizi`). */
export function filtersToSearchParams(filters = {}, { omit = [] } = {}) {
    const params = new URLSearchParams();
    const set = (key, value) => {
        if (omit.includes(key)) return;
        if (Array.isArray(value) ? value.length : value !== undefined && value !== null && value !== '' && value !== false) {
            params.set(key, Array.isArray(value) ? value.join(',') : value === true ? '1' : String(value));
        }
    };
    for (const key of SCALAR) set(key, filters[key] === 'default' ? undefined : filters[key]);
    set('brand', list(filters.brand));
    for (const group of ['attr', 'opt']) {
        for (const [code, value] of Object.entries(filters[group] || {})) {
            set(`${group}.${code}`, typeof value === 'string' && value.includes('..') ? value : list(value));
        }
    }
    for (const key of FLAGS) set(key, filters[key]);
    for (const key of NUMERIC) set(key, filters[key]);
    return params;
}

/** Bir değeri aç/kapat (çoklu seçim). Sayfa her değişimde başa döner. */
export function toggleFilter(filters, group, code, value) {
    const next = structuredCloneSafe(filters);
    delete next.page;
    if (group === 'brand') {
        const current = list(next.brand);
        next.brand = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        return next;
    }
    next[group] = { ...(next[group] || {}) };
    const current = list(next[group][code]);
    next[group][code] = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    if (!next[group][code].length) delete next[group][code];
    return next;
}

/** Süzgecin tek alanını değiştirir/kaldırır (`undefined` → kaldır). */
export function setFilter(filters, key, value) {
    const next = structuredCloneSafe(filters);
    if (key !== 'page') delete next.page;
    if (value === undefined || value === null || value === '') delete next[key];
    else next[key] = value;
    return next;
}

/** Seçili değer mi? (`brand` için code yok sayılır) */
export function isSelected(filters, group, code, value) {
    return group === 'brand' ? list(filters.brand).includes(value) : list(filters[group]?.[code]).includes(value);
}

/** Etkin süzgeç sayısı — "Filtreler (3)" rozeti için. */
export function activeFilterCount(filters = {}) {
    let count = list(filters.brand).length;
    for (const group of ['attr', 'opt']) {
        for (const value of Object.values(filters[group] || {})) count += typeof value === 'string' && value.includes('..') ? 1 : list(value).length;
    }
    for (const key of FLAGS) if (filters[key]) count += 1;
    if (filters.price_min || filters.price_max) count += 1;
    return count;
}

function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value || {}));
}
