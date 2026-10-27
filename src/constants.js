/** İade nedenleri (sipariş çıktısındaki `return_policy.reasons` ile aynı anahtarlar). */
export const RETURN_REASONS = {
    damaged: 'Hasarlı / kusurlu ürün',
    wrong_item: 'Yanlış ürün gönderildi',
    not_as_described: 'Ürün açıklamayla uyuşmuyor',
    size: 'Beden / ölçü uymadı',
    changed_mind: 'Vazgeçtim',
    other: 'Diğer',
};

/** Next.js vitrinlerinde önerilen httpOnly çerez adları. */
export const SHOP_COOKIES = {
    cart: 'shop_cart',
    customer: 'shop_customer',
    currency: 'shop_currency',
    /** Misafir sipariş görüntüleme: "no:e-posta" (son sipariş) */
    lastOrder: 'shop_last_order',
};
