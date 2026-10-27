// Saf yardımcıların birim testleri: `npm test` (node --test, bağımlılık yok).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    filtersToQuery, parseFilters, filtersToSearchParams, toggleFilter, activeFilterCount,
    formatMoney, toMinor, discountPercent,
    initialSelection, findVariant, valueState, selectValue, galleryFor, priceFor,
    freeShippingRemaining, itemCount, returnableLines,
} from '../src/index.js';
import { queryString, buildBase } from '../src/http.js';

test('buildBase: kök adres + token → /shop', () => {
    assert.equal(buildBase('https://crm.test/', 'sk_1'), 'https://crm.test/api/v1/public/sk_1/shop');
    assert.equal(buildBase('https://crm.test/api/v1/public/sk_1', null), 'https://crm.test/api/v1/public/sk_1/shop');
});

test('queryString: iç içe attr/opt köşeli parantezle açılır', () => {
    const qs = queryString({ attr: { renk: ['kirmizi', 'mavi'] }, opt: { beden: ['m'] }, in_stock: true, empty: '', page: 2 });
    assert.equal(decodeURIComponent(qs), '?attr[renk]=kirmizi,mavi&opt[beden]=m&in_stock=1&page=2');
});

test('süzgeç: URL ↔ nesne ↔ API sorgusu', () => {
    const filters = parseFilters(new URLSearchParams('category=giyim&brand=acme,nord&opt.renk=kirmizi&attr.agirlik=100..250&in_stock=1&sort=-price&page=3&x=y'));
    assert.deepEqual(filters, { attr: { agirlik: '100..250' }, opt: { renk: ['kirmizi'] }, category: 'giyim', brand: ['acme', 'nord'], in_stock: true, sort: '-price', page: 3 });
    assert.deepEqual(filtersToQuery(filters), { category: 'giyim', sort: '-price', page: 3, in_stock: 1, brand: ['acme', 'nord'], attr: { agirlik: '100..250' }, opt: { renk: ['kirmizi'] } });
    assert.equal(filtersToSearchParams(filters).toString(), 'category=giyim&sort=-price&brand=acme%2Cnord&attr.agirlik=100..250&opt.renk=kirmizi&in_stock=1&page=3');

    const toggled = toggleFilter(filters, 'opt', 'renk', 'mavi');
    assert.deepEqual(toggled.opt.renk, ['kirmizi', 'mavi']);
    assert.equal(toggled.page, undefined);                     // sayfa sıfırlanır
    assert.deepEqual(toggleFilter(toggled, 'opt', 'renk', 'kirmizi').opt.renk, ['mavi']);
    assert.equal(activeFilterCount(filters), 5);               // 2 marka + 1 renk + aralık + stok
    assert.deepEqual(filtersToQuery({ sort: 'default' }), {});
});

test('para: biçim + çevrim', () => {
    assert.equal(formatMoney({ amount: 129990, currency: 'TRY' }).replace(/\s/g, ' '), '₺1.299,90');
    assert.equal(formatMoney(1999, 'EUR', { locale: 'en-GB' }), '€19.99');
    assert.equal(toMinor('1299,9'), 129990);
    assert.equal(discountPercent({ amount: 8000 }, { amount: 10000 }), 20);
    assert.equal(discountPercent(10000, null), null);
});

const product = {
    id: 1, price: { amount: 100, currency: 'TRY' }, price_range: { min: { amount: 100 }, max: { amount: 120 } },
    images: [{ url: 'genel.jpg' }], media_option: 'renk',
    option_galleries: { kirmizi: [{ url: 'k1.jpg' }], mavi: [{ url: 'm1.jpg' }] },
    options: [
        { code: 'renk', values: [{ slug: 'kirmizi', value: 'Kırmızı' }, { slug: 'mavi', value: 'Mavi' }] },
        { code: 'beden', values: [{ slug: 'm', value: 'M' }, { slug: 'l', value: 'L' }] },
    ],
    variants: [
        { id: 10, options: { renk: 'kirmizi', beden: 'm' }, in_stock: false, price: { amount: 100 }, images: [{ url: 'k-m.jpg' }] },
        { id: 11, options: { renk: 'kirmizi', beden: 'l' }, in_stock: true, price: { amount: 100 }, images: [{ url: 'k1.jpg' }] },
        { id: 12, options: { renk: 'mavi', beden: 'm' }, in_stock: true, price: { amount: 120 }, images: [] },
    ],
    default_variant_id: 11,
};

test('varyant: seçim, durum, galeri, fiyat', () => {
    assert.deepEqual(initialSelection(product), { renk: 'kirmizi', beden: 'l' });
    assert.equal(findVariant(product, { renk: 'mavi', beden: 'm' }).id, 12);
    assert.equal(findVariant(product, { renk: 'mavi' }), null);
    assert.deepEqual(valueState(product, { renk: 'kirmizi' }, 'beden', 'm'), { exists: true, inStock: false });
    assert.deepEqual(valueState(product, { renk: 'mavi' }, 'beden', 'l'), { exists: false, inStock: false });
    // Mavi'de L yok → stoktaki Mavi/M'ye düzeltilir.
    assert.deepEqual(selectValue(product, { renk: 'kirmizi', beden: 'l' }, 'renk', 'mavi'), { renk: 'mavi', beden: 'm' });
    assert.equal(galleryFor(product, { renk: 'kirmizi', beden: 'm' })[0].url, 'k-m.jpg');   // varyant galerisi
    assert.equal(galleryFor(product, { renk: 'mavi' })[0].url, 'm1.jpg');                  // renk galerisi
    assert.equal(galleryFor(product, { renk: 'mavi', beden: 'm' })[0].url, 'm1.jpg');       // varyant boş → renk
    assert.equal(galleryFor(product, {})[0].url, 'genel.jpg');
    assert.equal(priceFor(product, { renk: 'mavi', beden: 'm' }).price.amount, 120);
    assert.ok(priceFor(product, { renk: 'mavi' }).range);
});

test('sepet: adet, ücretsiz kargo kalanı, iade satırları', () => {
    const totals = {
        currency: 'TRY', subtotal: 120000, discount_total: 0, shipping: { free: false },
        lines: [{ qty: 2, available: true, gift: false, line_subtotal: 100000 }, { qty: 1, available: true, gift: true, line_subtotal: 20000 }],
    };
    assert.equal(itemCount(totals), 2);
    const promo = [{ actions: ['free_shipping'], min_subtotal: { amount: 150000, currency: 'TRY' }, label: 'Kargo bedava' }];
    assert.equal(freeShippingRemaining(totals, promo).remaining, 50000);   // hediye hariç 1.000 → 500 kaldı
    assert.equal(freeShippingRemaining({ ...totals, shipping: { free: true } }, promo), null);
    const order = { items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }], return_policy: { returnable: { 1: 2, 2: 0 } } };
    assert.deepEqual(returnableLines(order).map((i) => [i.id, i.returnable]), [[1, 2]]);
});
