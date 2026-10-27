// Canlı API duman testi:
//   ADSCRM_URL=http://localhost ADSCRM_TOKEN=sk_… npm run smoke
//   … npm run smoke -- --checkout     (gerçek sipariş oluşturur — havale ile)
import { createShop, formatMoney, isValidationError, galleryFor, initialSelection, findVariant } from '../src/index.js';

const baseUrl = process.env.ADSCRM_URL;
const token = process.env.ADSCRM_TOKEN;
if (!baseUrl || !token) {
    console.error('ADSCRM_URL ve ADSCRM_TOKEN ortam değişkenleri gerekli.');
    process.exit(1);
}

const shop = createShop({ baseUrl, token, locale: 'tr' });
const step = async (label, fn) => {
    const started = Date.now();
    try {
        const out = await fn();
        console.log(`✔ ${label} (${Date.now() - started} ms)${out ? ` — ${out}` : ''}`);
    } catch (error) {
        console.error(`✘ ${label}: ${error.message}`, error.body ?? '');
        process.exitCode = 1;
    }
};

let product;
let cart;

await step('settings', async () => {
    const s = await shop.settings();
    return `${s.store_name} · ${s.currencies.map((c) => c.code).join(', ')}`;
});
await step('categoryTree', async () => `${(await shop.categoryTree()).length} kök kategori`);
await step('products', async () => {
    const res = await shop.products({ in_stock: true, limit: 24 });
    product = res.data.find((p) => p.type === 'variable') ?? res.data[0];
    return `${res.meta.total} ürün; ilk: ${res.data[0]?.name} ${formatMoney(res.data[0]?.price)}`;
});
await step('product (varyant + galeri)', async () => {
    product = await shop.product(product.slug);
    const selection = initialSelection(product);
    return `${product.name}: ${product.variants.length} varyant, seçim ${JSON.stringify(selection)}, galeri ${galleryFor(product, selection).length} görsel`;
});
await step('filters', async () => {
    const f = await shop.filters();
    return `${f.attributes.length} özellik, ${f.options.length} seçenek, ${f.brands.length} marka`;
});
await step('filters + opt süzgeci', async () => {
    const opt = product.options?.[0];
    if (!opt) return 'seçenek yok';
    const res = await shop.products({ opt: { [opt.code]: [opt.values[0].slug] } });
    return `${opt.name}=${opt.values[0].value}: ${res.meta.total} ürün`;
});
await step('promotions', async () => (await shop.promotions()).map((p) => p.label).join(' · ') || 'yok');
await step('urls (sitemap)', async () => `${(await shop.urls({ kind: 'product' })).data.length} ürün adresi`);
await step('EUR fiyat', async () => formatMoney((await shop.withCurrency('EUR').product(product.slug)).price));

await step('sepet: oluştur + ekle', async () => {
    cart = await shop.cart.create({ currency: 'TRY' });
    const variant = findVariant(product, initialSelection(product));
    cart = await shop.cart.addItem(cart.token, { product_id: product.id, variant_id: variant?.id ?? null, qty: 2 });
    return `${cart.totals.item_count} adet, ara toplam ${formatMoney(cart.totals.subtotal, cart.totals.currency)}`;
});
await step('sepet: geçersiz kupon 422', async () => {
    try {
        await shop.cart.applyCoupon(cart.token, 'YOKBOYLEKUPON');
        throw new Error('422 bekleniyordu');
    } catch (error) {
        if (!isValidationError(error)) throw error;
        return error.firstMessage;
    }
});
await step('sepet: adres + kargo + ödeme', async () => {
    cart = await shop.cart.update(cart.token, {
        email: 'smoke@example.com',
        shipping_address: { first_name: 'Duman', last_name: 'Testi', phone: '05550000000', country: 'TR', city_code: '34', district: 'Kadıköy', line1: 'Test Sk. 1' },
    });
    const shipping = cart.totals.shipping_options[0];
    const payment = cart.totals.payment_options.find((p) => p.driver === 'bank_transfer') ?? cart.totals.payment_options[0];
    cart = await shop.cart.update(cart.token, { shipping_method_id: shipping?.id, payment_method_id: payment?.id });
    return `kargo ${shipping?.name} · ödeme ${payment?.name} · toplam ${formatMoney(cart.totals.grand_total, cart.totals.currency)} · checkout ${cart.totals.can_checkout}`;
});

if (process.argv.includes('--checkout')) {
    await step('checkout + takip', async () => {
        const order = await shop.checkout(cart.token, { accept_terms: true });
        const tracked = await shop.orders.track(order.number, 'smoke@example.com');
        return `${order.number} → ${tracked.status_label}`;
    });
}
