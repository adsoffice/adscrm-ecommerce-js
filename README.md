# @adsoffice/adscrm-ecommerce

AdsCRM **E-Ticaret (Delivery) API** istemcisi — React ve Next.js mağazaları için.

- ✅ **Katalog** — kategori ağacı, markalar, ürün listesi + filtre yüzeyi (facet), arama, ürün detayı (varyantlar, renge göre değişen galeriler, özellikler, ilgili ürünler, SEO, JSON-LD).
- ✅ **Sepet → checkout → ödeme** — sunucuda hesaplanan toplamlar (kampanya, kupon, hediye, kargo, KDV), havale / kapıda ödeme, **iyzico** ve **PayTR** (yönlendirme / iframe).
- ✅ **Sipariş** — takip, kısmi kargo paketleri, havale bildirimi, yeniden ödeme, **iade talebi**.
- ✅ **Müşteri hesabı** — kayıt, giriş, şifre sıfırlama, adres defteri, siparişler.
- ✅ **B2B** — oturum açmış bayinin grup fiyatı (fiyat listesi / grup indirimi), görünür kategoriler.
- ✅ **Çoklu para birimi** — `?currency=EUR` çevrimli fiyat ya da para biriminin elle fiyat listesi.
- ✅ **Next.js App Router** — ISR + etiketler, httpOnly çerez ayarları, metadata, JSON-LD, sitemap.
- ✅ **Sıfır bağımlılık, derleme adımı yok.** Saf ESM + elle yazılmış `.d.ts`.

> İçerik (CMS) uçları — sayfalar, menüler, formlar — için kardeş paket
> [`@adsoffice/adscrm`](https://github.com/adsoffice/adscrm-js) kullanılır; ikisi aynı site token'ıyla çalışır.
>
> 📖 Adım adım mağaza rehberi: [docs/GUIDE.tr.md](docs/GUIDE.tr.md) · Örnek vitrin (Next.js 16): `adscrm-ecommerce`.

---

## Kurulum

```bash
npm i github:adsoffice/adscrm-ecommerce-js
# belirli sürüm:
npm i github:adsoffice/adscrm-ecommerce-js#v0.1.0
```

`.env.local`:

```bash
ADSCRM_URL=https://crm.adsoffice.net
ADSCRM_TOKEN=sk_xxxxxxxx          # Panel → Site → API → Delivery token
```

> **Token'lar sunucuda kalır.** Site token'ı sepet/checkout yazabildiği için `NEXT_PUBLIC_`
> ile açmayın. Sepet ve müşteri token'larını **httpOnly çerezde** tutun; yazma işlemlerini
> server action / route handler'dan yapın.

---

## Hızlı başlangıç (Next.js)

```js
// lib/shop.js — yalnızca sunucu
import 'server-only';
import { cookies } from 'next/headers';
import { createShopClient, SHOP_COOKIES } from '@adsoffice/adscrm-ecommerce/next';

export const shop = createShopClient({
  baseUrl: process.env.ADSCRM_URL,
  token: process.env.ADSCRM_TOKEN,
  locale: 'tr',
  revalidate: 60,     // oturumsuz katalog ISR (sn)
  tags: ['shop'],     // revalidateTag('shop')
});

/** İstek bağlamındaki istemci: müşteri oturumu + seçili para birimi. */
export async function shopForRequest() {
  const jar = await cookies();
  return shop
    .withCurrency(jar.get(SHOP_COOKIES.currency)?.value)
    .withCustomer(jar.get(SHOP_COOKIES.customer)?.value);   // B2B fiyat + hesap
}
```

```jsx
// app/kategori/[slug]/page.jsx
import { parseFilters, formatMoney } from '@adsoffice/adscrm-ecommerce';
import { shopForRequest } from '@/lib/shop';

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  const filters = { ...parseFilters(await searchParams), category: slug };
  const shop = await shopForRequest();
  const [{ data, meta }, facets] = await Promise.all([shop.products(filters), shop.filters(filters)]);
  return data.map((p) => <a key={p.id} href={`/urun/${p.slug}`}>{p.name} — {formatMoney(p.price)}</a>);
}
```

```js
// app/actions/cart.js — sepete ekleme (server action)
'use server';
import { cookies } from 'next/headers';
import { cookieOptions, SHOP_COOKIES } from '@adsoffice/adscrm-ecommerce/next';
import { errorMessage } from '@adsoffice/adscrm-ecommerce';
import { shopForRequest } from '@/lib/shop';

export async function addToCart(productId, variantId, qty = 1) {
  const jar = await cookies();
  const shop = await shopForRequest();
  let token = jar.get(SHOP_COOKIES.cart)?.value;
  try {
    if (!token) {
      token = (await shop.cart.create({ currency: shop.config.currency })).token;
      jar.set(SHOP_COOKIES.cart, token, cookieOptions());
    }
    const cart = await shop.cart.addItem(token, { product_id: productId, variant_id: variantId, qty });
    return { ok: true, count: cart.totals.item_count };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
```

---

## İstemci

```js
import { createShop } from '@adsoffice/adscrm-ecommerce';

const shop = createShop({
  baseUrl: 'https://crm.adsoffice.net',   // ya da tam delivery adresi
  token: 'sk_…',
  locale: 'tr',
  currency: 'TRY',          // katalog/sepet para birimi
  customerToken: undefined, // X-Customer-Token (B2B fiyat, hesap uçları)
  revalidate: 60,           // Next Data Cache — yalnızca oturumsuz GET
  tags: ['shop'],
  timeout: 15000, retries: 2, retryDelay: 300,
});

shop.withCustomer(token)   // aynı ayarlar + müşteri oturumu
shop.withCurrency('EUR')
shop.withLocale('en')
```

**Önbellek kuralı:** katalog/ayar GET'leri `revalidate` / `tags` ile önbelleklenir. Müşteri
oturumlu istekler (bayi fiyatı kişiye özeldir), sepet, sipariş ve hesap uçları **her zaman
önbelleksizdir**; yazma istekleri **yeniden denenmez** (çift sipariş olmaz).

### Mağaza

| Metot | Dönüş |
|---|---|
| `settings()` | Künye, para birimleri, KDV gösterimi, misafir alışveriş, asgari tutar, `paths` (vitrin adres kalıpları), `returns` |
| `regions()` | Ülke + il listesi (adres formu, TR plaka kodu) |
| `promotions()` | Yürürlükteki kampanyalar (banner, geri sayım, ücretsiz kargo eşiği) |
| `urls({ kind })` | Ürün / kategori / marka adresleri (sitemap) |

### Katalog

| Metot | Dönüş |
|---|---|
| `categories()` · `categoryTree()` · `category(slug)` | Kategoriler (`breadcrumb`, `children`) |
| `brands()` · `brand(slug)` | Markalar |
| `products(filters)` | `{ data: ProductCard[], meta: { total, page, last_page, category, currency… } }` |
| `search(q, filters)` | Aynı biçim (`search` görünürlüklü ürünler dahil) |
| `filters(filters)` | Facet: `attributes`, `options` (renk/beden + adet), `brands`, `price` aralığı |
| `product(slug)` | Detay: `options`, `variants`, `option_galleries`, `attributes`, `related`, `seo`, `url`, `structured_data` |
| `stock(skus)` | Anlık stok + fiyat (önbelleksiz, ≤100 SKU) |

**Süzgeç nesnesi** (`products`, `search`, `filters`):

```js
{
  category: 'giyim', brand: ['nord'],
  attr: { malzeme: ['pamuk'], agirlik: '100..250', su_gecirmez: '1' },   // özellikler
  opt:  { renk: ['kirmizi'], beden: ['m'] },                              // varyant seçenekleri (aynı varyantta)
  price_min: 10000, price_max: 50000,                                    // kuruş
  in_stock: true, featured: true, new: true, q: 'tişört',
  sort: 'default' | 'price' | '-price' | '-created' | 'name', page: 1, limit: 24,
}
```

URL ↔ süzgeç: `parseFilters(searchParams)` · `filtersToSearchParams(filters)` (`?brand=nord&opt.renk=kirmizi&attr.malzeme=pamuk`) ·
`toggleFilter(filters, 'opt', 'renk', 'mavi')` · `setFilter(filters, 'sort', '-price')` · `isSelected(…)` · `activeFilterCount(filters)`.

### Sepet

```js
const cart = await shop.cart.create({ currency: 'TRY' });           // { token, totals, … }
await shop.cart.addItem(cart.token, { product_id: 12, variant_id: 41, qty: 2 });
await shop.cart.updateItem(cart.token, itemId, 3);                  // 0 → sil
await shop.cart.removeItem(cart.token, itemId);
await shop.cart.applyCoupon(cart.token, 'HOSGELDIN');               // geçersizse ShopValidationError
await shop.cart.update(cart.token, {
  email, phone, shipping_address, billing_address: null,            // null → teslimatla aynı
  shipping_method_id, payment_method_id, notes, accepts_marketing,  // ticari ileti onayı
});
```

`totals`: `lines[]` (birim fiyat, katalog indirimi, **hediye** satırları, satır indirimi, KDV, stok sorunu),
`promotions[]`, `promotions_skipped[]`, `coupon`, `shipping_options[]`, `payment_options[]`, `subtotal`,
`discount_total`, `shipping_total`, `fee_total`, `tax_total`, `grand_total`, `issues[]`, `can_checkout`.
Tüm tutarlar **sunucuda** hesaplanır; istemci tutar göndermez.

Yardımcılar: `itemCount(totals)` · `isEmpty(totals)` · `freeShippingRemaining(totals, promotions)` (kargo bedava çubuğu) ·
`cartIssues(totals)` · `lineIssue(totals, itemId)`.

### Checkout ve ödeme

```js
const order = await shop.checkout(cartToken, { accept_terms: true });
const action = normalizePaymentAction(order.payment_action);
if (action?.type === 'redirect') redirect(action.url);          // iyzico ortak ödeme sayfası
if (action?.type === 'iframe') /* PayTR iframe: action.url */;   // + PAYTR_IFRAME_RESIZER betiği
// havale / kapıda ödeme: action null → sipariş sayfasına
```

Ödeme dönüşü `https://<alan adı>/odeme/sonuc?order=<no>&status=success|failed` (mağaza ayarı). **`status`'a
güvenmeyin** — `orders.track(no, email)` ile `payment_status: 'paid'` kontrol edin; PayTR onayı birkaç
saniye gecikebilir (`shouldPollPayment(order)`). Reddedilen ödeme: `orders.pay(no, email)` yeni `payment_action` verir.

### Sipariş (misafir: no + e-posta)

| Metot | |
|---|---|
| `orders.track(number, email)` | Durum, zaman çizelgesi, `shipments[]` (kısmi kargo), `returns[]`, `return_policy`, havale hesapları |
| `orders.pay(number, email)` | Online ödemeyi yeniden başlat |
| `orders.bankTransfer(number, { email, sender_name, amount?, note? })` | Havale bildirimi |
| `orders.requestReturn(number, { email, items: [{ order_item_id, qty, reason }], note })` | İade talebi |

Yardımcılar: `orderProgress(order)` (0 alındı · 1 hazırlanıyor · 2 kargoda · 3 teslim) · `awaitsOnlinePayment(order)` ·
`awaitsBankTransfer(order)` · `returnableLines(order)` · `RETURN_REASONS` · `ORDER_STATUS_TONE`.

### Müşteri

```js
const { token, customer } = await shop.auth.login(email, password);   // token → httpOnly çerez
await shop.auth.register({ email, password, first_name, last_name, accepts_marketing });
await shop.auth.forgotPassword(email, '/sifre-sifirla');              // bağlantı sitenizin alan adına
await shop.auth.resetPassword({ email, token, password });

const me = shop.withCustomer(token);
await me.account.get();  await me.account.update({ phone });
await me.account.addresses(); await me.account.addAddress(address);
await me.account.orders({ page: 1 });   // özet satırlar (item_count) · detay: account.order(number)
await me.account.order(number);
await me.account.requestReturn(number, { items });
await me.auth.logout();
```

Oturumlu istemcide katalog uçları **bayi (müşteri grubu) fiyatını** döner: `price_source`
`price_list` (bayi fiyatı) · `group` (grup indirimi) · `catalog` (kampanya) · `currency_list` · `base`.

### Varyantlar

```js
import { initialSelection, selectValue, findVariant, galleryFor, priceFor, valueState } from '@adsoffice/adscrm-ecommerce';

let selection = initialSelection(product);                 // ilk stoktaki varyant
selection = selectValue(product, selection, 'renk', 'mavi'); // kombinasyon yoksa en yakın stoktakine düzeltir
findVariant(product, selection)      // sepete eklenecek varyant
galleryFor(product, selection)       // TAM galeri: varyant → renk galerisi → genel
priceFor(product, selection)         // { price, compare_at_price, discount_percent, range }
valueState(product, selection, 'beden', 'l')   // { exists, inStock } — tükenmişi soluk göster
```

React: `useVariantSelection(product)` · `useCountdown(endsAt)` · `useMoney()` — `@adsoffice/adscrm-ecommerce/react`.

### Para

`formatMoney({ amount: 19990, currency: 'TRY' })` → `₺199,90` · `toMinor('199,90')` → `19990` ·
`discountPercent(price, compareAt)` · `formatTaxRate(2000)` → `%20`.

### Next.js yardımcıları (`/next`)

| | |
|---|---|
| `createShopClient(opts)` | ISR 60 sn + `shop` etiketi |
| `SHOP_COOKIES` | `shop_cart` · `shop_customer` · `shop_currency` · `shop_last_order` |
| `cookieOptions()` | httpOnly, SameSite=Lax, üretimde Secure |
| `productMetadata(product, { siteName, baseUrl })` | `generateMetadata` çıktısı (canonical, OG görseli) |
| `jsonLd(product.structured_data)` | `<script type="application/ld+json">` için güvenli dize |
| `breadcrumbJsonLd(items, baseUrl)` | BreadcrumbList |
| `sitemapEntries(await shop.urls(), baseUrl)` | `app/sitemap.js` |
| `shopTag(...)` | `shop:product:<slug>` gibi önbellek etiketi |

### Hatalar

`ShopError` → `ShopNotFoundError` (404) · `ShopUnauthorizedError` (401, oturum bitti) · `ShopValidationError` (422:
`errors`, `fieldErrors()`, `firstMessage`) · `ShopRateLimitError` (429) · `ShopMaintenanceError` (503, bakım) ·
`ShopNetworkError`. `isNotFound()` · `isUnauthorized()` · `isValidationError()` · `isRateLimited()` · `isMaintenance()` ·
`errorMessage(error)` (kullanıcıya gösterilecek tek satır).

---

## Geliştirme

```bash
npm test                                            # birim testleri (node --test)
ADSCRM_URL=… ADSCRM_TOKEN=… npm run smoke           # canlı API duman testi
ADSCRM_URL=… ADSCRM_TOKEN=… npm run smoke -- --checkout   # + gerçek sipariş (havale)
```

Lisans: MIT
