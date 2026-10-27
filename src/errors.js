/**
 * Mağaza (Delivery) API hataları. Tümü `ShopError`'dan türer; tek `catch` ile
 * yakalanır, ayrım `status` ya da `instanceof` ile yapılır.
 */

export class ShopError extends Error {
    constructor(message, { status = 0, url = '', body = null, cause = undefined } = {}) {
        super(message);
        this.name = 'ShopError';
        this.status = status;
        this.url = url;
        this.body = body;
        if (cause !== undefined) this.cause = cause;
    }
}

/** 404 — ürün/kategori/sipariş bulunamadı ya da sitede e-ticaret modülü kapalı. */
export class ShopNotFoundError extends ShopError {
    constructor(message = 'Kayıt bulunamadı.', meta) {
        super(message, { ...meta, status: 404 });
        this.name = 'ShopNotFoundError';
    }
}

/** 401 — müşteri oturumu (X-Customer-Token) yok ya da süresi doldu. */
export class ShopUnauthorizedError extends ShopError {
    constructor(message = 'Oturum açmanız gerekiyor.', meta) {
        super(message, { ...meta, status: 401 });
        this.name = 'ShopUnauthorizedError';
    }
}

/**
 * 422 — doğrulama: stok yetersiz, kupon geçersiz, adres eksik, iade süresi doldu…
 * `errors` alan bazlı mesajları taşır (`items.0.qty`, `code`, `shipping_address.phone`).
 */
export class ShopValidationError extends ShopError {
    constructor(message = 'Doğrulama başarısız.', meta = {}) {
        super(message, { ...meta, status: meta.status ?? 422 });
        this.name = 'ShopValidationError';
        /** @type {Record<string, string[]>} */
        this.errors = meta.errors || {};
    }

    /** Alanın ilk hata mesajı. */
    fieldError(field) {
        const list = this.errors[field];
        return Array.isArray(list) ? list[0] : undefined;
    }

    /** `{ alan: 'mesaj' }` düz haritası — form state'ine doğrudan yazılır. */
    fieldErrors() {
        const out = {};
        for (const [key, list] of Object.entries(this.errors)) {
            out[key] = Array.isArray(list) ? list[0] : String(list);
        }
        return out;
    }

    /** Kullanıcıya gösterilecek ilk mesaj (alan hatası yoksa genel mesaj). */
    get firstMessage() {
        const first = Object.values(this.errors)[0];
        return (Array.isArray(first) ? first[0] : first) || this.message;
    }
}

/** 429 — Delivery 120 istek/dk; sepet 60/dk, giriş/kayıt 10/dk (IP başına). */
export class ShopRateLimitError extends ShopError {
    constructor(message = 'İstek sınırı aşıldı.', meta = {}) {
        super(message, { ...meta, status: 429 });
        this.name = 'ShopRateLimitError';
        this.retryAfter = meta.retryAfter ?? null;
    }
}

/** 503 — site bakım modunda (panelde yayın şarteli kapalı). */
export class ShopMaintenanceError extends ShopError {
    constructor(message = 'Site bakım modunda.', meta = {}) {
        super(message, { ...meta, status: 503 });
        this.name = 'ShopMaintenanceError';
        this.maintenance = meta.maintenance ?? null;
        this.retryAfter = meta.retryAfter ?? null;
    }

    get texts() {
        return this.maintenance?.texts ?? null;
    }
}

/** Ağ hatası / zaman aşımı — sunucudan yanıt alınamadı. */
export class ShopNetworkError extends ShopError {
    constructor(message = 'Sunucuya ulaşılamadı.', meta) {
        super(message, meta);
        this.name = 'ShopNetworkError';
    }
}

export function isNotFound(error) {
    return error instanceof ShopNotFoundError || error?.status === 404;
}

export function isUnauthorized(error) {
    return error instanceof ShopUnauthorizedError || error?.status === 401;
}

export function isValidationError(error) {
    return error instanceof ShopValidationError || error?.status === 422;
}

export function isRateLimited(error) {
    return error instanceof ShopRateLimitError || error?.status === 429;
}

export function isMaintenance(error) {
    return error instanceof ShopMaintenanceError || (error?.status === 503 && !!error?.body?.maintenance);
}

/**
 * Hatadan kullanıcıya gösterilecek tek satır — server action / form yanıtı için.
 * Teknik ayrıntı (URL, gövde) dışarı çıkmaz.
 */
export function errorMessage(error, fallback = 'İşlem tamamlanamadı, lütfen tekrar deneyin.') {
    if (isValidationError(error)) return error.firstMessage || fallback;
    if (isRateLimited(error)) return 'Çok fazla deneme yapıldı, lütfen biraz bekleyin.';
    if (isUnauthorized(error)) return 'Oturumunuzun süresi doldu, lütfen tekrar giriş yapın.';
    if (isMaintenance(error)) return error.texts?.message || 'Mağaza kısa bir bakımda.';
    if (isNotFound(error)) return error.message || 'Kayıt bulunamadı.';
    return fallback;
}
