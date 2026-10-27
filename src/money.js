/**
 * Para gösterimi. API tutarları en küçük birimde tamsayıdır (`19990` → 199,90 ₺);
 * fiyat alanları `{ amount, currency }` biçimindedir.
 */

export const CURRENCY_SYMBOLS = { TRY: '₺', EUR: '€', USD: '$', GBP: '£' };

const formatters = new Map();

/**
 * `formatMoney({ amount: 19990, currency: 'TRY' })` → "199,90 ₺"
 * `formatMoney(19990, 'EUR', { locale: 'en-GB' })` → "€199.90"
 */
export function formatMoney(value, currency, { locale = 'tr-TR', minor = 2, hideZeroDecimals = false } = {}) {
    if (value === null || value === undefined) return '';
    const amount = typeof value === 'object' ? value.amount : value;
    const code = (typeof value === 'object' ? value.currency : currency) || 'TRY';
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '';

    const major = Number(amount) / 10 ** minor;
    const digits = hideZeroDecimals && Number.isInteger(major) ? 0 : minor;
    const key = `${locale}|${code}|${digits}`;
    if (!formatters.has(key)) {
        try {
            formatters.set(key, new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }));
        } catch {
            formatters.set(key, { format: (n) => `${n.toFixed(digits)} ${CURRENCY_SYMBOLS[code] || code}` });
        }
    }
    return formatters.get(key).format(major);
}

/** Kuruş → ondalık sayı (form alanı için). */
export function toMajor(amount, minor = 2) {
    return amount === null || amount === undefined ? '' : Number(amount) / 10 ** minor;
}

/** "199,90" / "199.90" → 19990 */
export function toMinor(value, minor = 2) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 10 ** minor) : null;
}

/** İndirim yüzdesi (eski fiyat > fiyat ise). */
export function discountPercent(price, compareAt) {
    const p = typeof price === 'object' ? price?.amount : price;
    const c = typeof compareAt === 'object' ? compareAt?.amount : compareAt;
    return c && p !== undefined && c > p ? Math.round((1 - p / c) * 100) : null;
}

/** KDV oranı (baz puan) → "%20". */
export function formatTaxRate(bp) {
    return bp ? `%${(bp / 100).toLocaleString('tr-TR')}` : '';
}
