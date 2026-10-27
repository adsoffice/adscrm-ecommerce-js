/**
 * Varyant seçimi — ürün detayındaki `options`, `variants`, `media_option`,
 * `option_galleries` ve `default_variant_id` alanları üzerinde saf yardımcılar.
 *
 * Seçim nesnesi seçenek koduna göre değer slug'ıdır: `{ renk: 'kirmizi', beden: 'm' }`.
 */

/** Varyantlı mı? (seçenek listesi dolu) */
export function isVariable(product) {
    return Array.isArray(product?.options) && product.options.length > 0;
}

/** Başlangıç seçimi: `default_variant_id` (ilk stoktaki) varyantın seçenekleri. */
export function initialSelection(product) {
    if (!isVariable(product)) return {};
    const variant = product.variants?.find((v) => v.id === product.default_variant_id) ?? product.variants?.[0];
    return variant ? { ...variant.options } : {};
}

/** Tüm seçenekler seçildi mi? */
export function isComplete(product, selection) {
    return !isVariable(product) || product.options.every((o) => selection?.[o.code]);
}

/** Seçimle birebir eşleşen varyant (eksik seçimde null). */
export function findVariant(product, selection) {
    if (!isVariable(product) || !isComplete(product, selection)) return null;
    return product.variants.find((v) => product.options.every((o) => v.options[o.code] === selection[o.code])) ?? null;
}

/**
 * Bir seçenek değeri seçilebilir mi? Diğer seçili değerlerle birlikte stokta bir
 * varyant var mı — tükenen kombinasyonları soluk/üstü çizili göstermek için.
 * `{ exists, inStock }`: kombinasyon hiç yoksa `exists: false` (gizlenebilir).
 */
export function valueState(product, selection, code, value) {
    const others = product.options.filter((o) => o.code !== code && selection?.[o.code]);
    const matches = product.variants.filter((v) => v.options[code] === value && others.every((o) => v.options[o.code] === selection[o.code]));
    return { exists: matches.length > 0, inStock: matches.some((v) => v.in_stock) };
}

/**
 * Seçimi bir değerle günceller. Yeni kombinasyon yoksa diğer seçenekler stoktaki
 * en yakın varyanta göre düzeltilir (ör. Kırmızı'da L yoksa M'ye geçer).
 */
export function selectValue(product, selection, code, value) {
    const next = { ...selection, [code]: value };
    if (findVariant(product, next) || !isComplete(product, next)) return next;
    const candidates = product.variants.filter((v) => v.options[code] === value);
    const best = candidates.find((v) => v.in_stock) ?? candidates[0];
    return best ? { ...best.options } : next;
}

/**
 * Gösterilecek galeri (TAM liste — seçim değiştikçe galeriyi bununla değiştirin):
 * tam seçimde varyantın `images`'ı → yalnızca görselleri belirleyen seçenek (renk)
 * seçiliyse `option_galleries[renk]` → ürünün genel görselleri.
 */
export function galleryFor(product, selection) {
    const variant = findVariant(product, selection);
    if (variant?.images?.length) return variant.images;
    const mediaCode = product?.media_option;
    const mediaValue = mediaCode ? selection?.[mediaCode] : null;
    const byOption = mediaValue ? product.option_galleries?.[mediaValue] : null;
    if (byOption?.length) return byOption;
    return product?.images ?? [];
}

/**
 * Seçime göre fiyat bloğu: tam seçimde varyantın fiyatı, değilse ürünün (en düşük)
 * fiyatı + `price_range`. `{ price, compare_at_price, discount_percent, range }`
 */
export function priceFor(product, selection) {
    const variant = findVariant(product, selection);
    const source = variant ?? product;
    return {
        price: source.price,
        compare_at_price: source.compare_at_price ?? null,
        discount_percent: source.discount_percent ?? null,
        range: variant ? null : product.price_range ?? null,
    };
}

/** Seçimin stok durumu: varyantlıda tam seçim gerekir. */
export function inStockFor(product, selection) {
    if (!isVariable(product)) return !!product.in_stock;
    const variant = findVariant(product, selection);
    return !!variant?.in_stock;
}

/** Seçim → okunur başlık: "Kırmızı / M". */
export function selectionTitle(product, selection) {
    return product.options
        .map((o) => o.values.find((v) => v.slug === selection?.[o.code])?.value)
        .filter(Boolean)
        .join(' / ');
}
