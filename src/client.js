import { buildBase, request } from './http.js';
import { filtersToQuery } from './filters.js';

const DEFAULTS = {
    locale: undefined,
    currency: undefined,
    customerToken: undefined,
    timeout: 15000,
    retries: 2,
    retryDelay: 300,
    revalidate: undefined,
    tags: undefined,
    headers: undefined,
    fetch: undefined,
};

/**
 * AdsCRM E-Ticaret (Delivery) istemcisi.
 *
 * ```js
 * export const shop = createShop({
 *   baseUrl: 'https://crm.adsoffice.net',
 *   token: process.env.ADSCRM_TOKEN,   // site delivery token'ı — SUNUCUDA kalır
 *   locale: 'tr',
 *   currency: 'TRY',                   // katalog/sepet para birimi (?currency=)
 *   revalidate: 60, tags: ['shop'],    // Next.js Data Cache (yalnızca oturumsuz katalog)
 * });
 *
 * // Oturum açmış müşteri (B2B fiyat, hesap uçları):
 * const me = shop.withCustomer(cookies().get('shop_customer')?.value);
 * ```
 *
 * Katalog ve ayar uçları salt okunurdur ve önbelleklenebilir. Sepet, checkout,
 * sipariş ve hesap uçları yazar; her zaman önbelleksiz çalışır ve yeniden denenmez.
 * Tüm tutarlar en küçük para biriminde tamsayıdır (kuruş) ve sunucuda hesaplanır.
 */
export function createShop(options = {}) {
    const config = { ...DEFAULTS, ...options, base: buildBase(options.baseUrl, options.token) };

    const call = (path, opts) => request(config, path, opts);
    const data = (promise) => promise.then((res) => (res && typeof res === 'object' && 'data' in res ? res.data : res));
    const write = (method, path, body, opts = {}) => call(path, { ...opts, method, body, cache: 'no-store' });
    const fresh = (path, opts = {}) => call(path, { ...opts, cache: 'no-store' });
    const enc = encodeURIComponent;

    const shop = {
        /** Çözülmüş yapılandırma (base adres dahil) — hata ayıklama için. */
        config,

        /** Aynı ayarlarla, müşteri oturumlu (X-Customer-Token) yeni istemci. Token boşsa misafir. */
        withCustomer(customerToken) {
            return createShop({ ...options, customerToken: customerToken || undefined });
        },
        withCurrency(currency) {
            return createShop({ ...options, currency: currency || undefined });
        },
        withLocale(locale) {
            return createShop({ ...options, locale });
        },

        /** Şemada olmayan bir mağaza ucuna doğrudan erişim (kaçış kapısı). */
        raw(path, opts) {
            return call(path, opts);
        },

        /* ── Mağaza ───────────────────────────────────────────────── */

        /** Künye, para birimleri, KDV gösterimi, misafir alışveriş, adres kalıpları, iade politikası. */
        settings(opts) {
            return data(call('settings', opts));
        },
        /** Ülke + il listesi (adres formu; TR il plaka kodu `code`). */
        regions(opts) {
            return data(call('regions', opts));
        },
        /** Yürürlükteki kampanyalar (banner, geri sayım, "X TL üzeri kargo bedava" şeridi). */
        promotions(opts) {
            return data(call('promotions', opts));
        },
        /** Mağaza adres defteri (sitemap): `{ data: [{ kind, labels, urls, updated_at }], meta }`. */
        urls({ kind, limit, ...opts } = {}) {
            return call('urls', { ...opts, query: { kind, limit } });
        },

        /* ── Katalog ──────────────────────────────────────────────── */

        categories(opts) {
            return data(call('categories', opts));
        },
        categoryTree(opts) {
            return data(call('categories/tree', opts));
        },
        /** Kategori + `breadcrumb` + `children`. */
        category(slug, opts) {
            return data(call(`categories/${enc(slug)}`, opts));
        },
        brands(opts) {
            return data(call('brands', opts));
        },
        brand(slug, opts) {
            return data(call(`brands/${enc(slug)}`, opts));
        },

        /**
         * Ürün kartları + sayfalama: `{ data, meta: { total, page, last_page, category, currency, … } }`.
         * Süzgeçler: `{ category, brand, attr: { renk: ['kirmizi'] }, opt: { beden: ['m'] },
         * price_min, price_max, in_stock, featured, new, q, sort, page, limit }`.
         */
        products(filters = {}, opts = {}) {
            return call('products', { ...opts, query: filtersToQuery(filters) });
        },
        /** `q` zorunlu (en az 2 karakter); `search` görünürlüklü ürünler de gelir. */
        search(q, filters = {}, opts = {}) {
            return call('search', { ...opts, query: filtersToQuery({ ...filters, q }) });
        },
        /** Ürün detayı: varyantlar, galeriler, özellikler, ilgili ürünler, SEO, `url`, `structured_data`. */
        product(slug, opts) {
            return data(call(`products/${enc(slug)}`, opts));
        },
        /** Filtre yüzeyi (facet) — aynı süzgeçlerle; seçili değer dışındaki seçenekler kaybolmaz. */
        filters(filters = {}, opts = {}) {
            return data(call('filters', { ...opts, query: filtersToQuery(filters) }));
        },
        /** Anlık stok + fiyat (önbelleksiz) — en çok 100 SKU. */
        stock(skus, opts = {}) {
            return data(fresh('stock', { ...opts, query: { skus: [].concat(skus).slice(0, 100) } }));
        },

        /* ── Sepet (yazma · önbelleksiz) ──────────────────────────── */

        cart: {
            /** `{ currency?, locale? }` → sepet (`token` + `totals`). Müşteri oturumluysa sepet üyeye bağlanır. */
            create(body = {}, opts) {
                return data(write('POST', 'carts', body, opts));
            },
            get(token, opts) {
                return data(fresh(`carts/${enc(token)}`, opts));
            },
            /**
             * `{ email, phone, shipping_address, billing_address (null = teslimatla aynı),
             * shipping_address_id (üye), shipping_method_id, payment_method_id, notes,
             * currency, locale, accepts_marketing }`
             */
            update(token, patch, opts) {
                return data(write('PATCH', `carts/${enc(token)}`, patch, opts));
            },
            /** `{ product_id, variant_id?, qty }` — aynı ürün/varyant birleşir; stok/adet kuralı 422. */
            addItem(token, item, opts) {
                return data(write('POST', `carts/${enc(token)}/items`, item, opts));
            },
            /** `qty: 0` satırı siler. */
            updateItem(token, itemId, qty, opts) {
                return data(write('PATCH', `carts/${enc(token)}/items/${enc(itemId)}`, { qty }, opts));
            },
            removeItem(token, itemId, opts) {
                return data(write('DELETE', `carts/${enc(token)}/items/${enc(itemId)}`, undefined, opts));
            },
            /** Geçersiz kupon 422 + neden; önceki kupon korunur. */
            applyCoupon(token, code, opts) {
                return data(write('POST', `carts/${enc(token)}/coupon`, { code }, opts));
            },
            removeCoupon(token, opts) {
                return data(write('DELETE', `carts/${enc(token)}/coupon`, undefined, opts));
            },
        },

        /**
         * Sepeti siparişe çevirir: `{ accept_terms: true, email?, phone?, notes? }`.
         * Yanıt sipariş + `payment_action` (online ödemede `{type: 'redirect'|'iframe', url}`, yoksa null).
         */
        checkout(cartToken, body = {}, opts) {
            return data(write('POST', 'checkout', { cart_token: cartToken, ...body }, opts));
        },

        /* ── Sipariş (misafir: no + e-posta) ──────────────────────── */

        orders: {
            /** Sipariş takibi: durum, zaman çizelgesi, kargo paketleri, iade talepleri, iade politikası. */
            track(number, email, opts) {
                return data(fresh(`orders/${enc(number)}`, { ...opts, query: { email } }));
            },
            /** Online ödeme bekleyen siparişte ödemeyi yeniden başlatır → `payment_action`. */
            pay(number, email, opts) {
                return data(write('POST', `orders/${enc(number)}/pay`, { email }, opts));
            },
            /** Havale bildirimi `{ email, sender_name, amount?, bank_account_id?, note? }`. */
            bankTransfer(number, body, opts) {
                return data(write('POST', `orders/${enc(number)}/bank-transfer`, body, opts));
            },
            /** İade talebi `{ email, items: [{order_item_id, qty, reason?}], reason?, note? }`. */
            requestReturn(number, body, opts) {
                return data(write('POST', `orders/${enc(number)}/returns`, body, opts));
            },
        },

        /* ── Müşteri oturumu ──────────────────────────────────────── */

        auth: {
            /** `{ email, password, first_name, last_name, phone?, accepts_marketing? }` → `{ token, customer }` */
            register(body, opts) {
                return data(write('POST', 'auth/register', body, opts));
            },
            /** → `{ token, customer }` — token'ı httpOnly çerezde saklayın. */
            login(email, password, opts) {
                return data(write('POST', 'auth/login', { email, password }, opts));
            },
            /** Kullanılan token'ı siler (istemci `withCustomer(token)` olmalı). */
            logout(opts) {
                return data(write('POST', 'auth/logout', undefined, opts));
            },
            /** Sıfırlama bağlantısı sitenin alan adına kurulur: `<domain><resetPath>?token=…&email=…`. */
            forgotPassword(email, resetPath = '/sifre-sifirla', opts) {
                return data(write('POST', 'auth/password/forgot', { email, reset_path: resetPath }, opts));
            },
            /** `{ email, token, password }` (en az 8 karakter) — bağlantıdaki `token` + `email`. */
            resetPassword(body, opts) {
                return data(write('POST', 'auth/password/reset', body, opts));
            },
        },

        /* ── Müşteri hesabı (X-Customer-Token zorunlu) ────────────── */

        account: {
            get(opts) {
                return data(fresh('account', opts));
            },
            /** `{ first_name, last_name, phone, locale, accepts_marketing, password?, current_password? }` */
            update(body, opts) {
                return data(write('PATCH', 'account', body, opts));
            },
            addresses(opts) {
                return data(fresh('account/addresses', opts));
            },
            addAddress(address, opts) {
                return data(write('POST', 'account/addresses', address, opts));
            },
            updateAddress(id, address, opts) {
                return data(write('PUT', `account/addresses/${enc(id)}`, address, opts));
            },
            deleteAddress(id, opts) {
                return data(write('DELETE', `account/addresses/${enc(id)}`, undefined, opts));
            },
            /** `{ data, meta: { total, page, last_page } }` */
            orders({ page, ...opts } = {}) {
                return fresh('account/orders', { ...opts, query: { page } });
            },
            order(number, opts) {
                return data(fresh(`account/orders/${enc(number)}`, opts));
            },
            /** `{ items: [{order_item_id, qty, reason?}], reason?, note? }` */
            requestReturn(number, body, opts) {
                return data(write('POST', `account/orders/${enc(number)}/returns`, body, opts));
            },
        },
    };

    return shop;
}
