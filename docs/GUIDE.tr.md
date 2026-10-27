# Mağaza Geliştirici Rehberi — AdsCRM E-Ticaret API'siyle vitrin kurmak

> **Kime:** AdsCRM panelinde e-ticaret modülü açık bir site için Next.js (App Router)
> vitrini geliştirecek ön yüz geliştiricilerine. Katalog, sepet, ödeme, sipariş, iade ve
> müşteri hesabı **tamamen panelden** yönetilir; vitrin yalnızca gösterir ve ziyaretçinin
> isteğini API'ye iletir.
>
> 📚 Tam API referansı: [README.md](../README.md) · Örnek vitrin: `adscrm-ecommerce`
> (Next.js 16, bu rehberdeki her desen orada çalışır hâlde bulunur).

---

## İçindekiler

1. [Zihinsel model](#1-zihinsel-model)
2. [Güvenlik: hangi değer nerede durur](#2-güvenlik-hangi-değer-nerede-durur)
3. [Kurulum ve istemci](#3-kurulum-ve-istemci)
4. [Önbellek kuralları](#4-önbellek-kuralları)
5. [Katalog: liste, süzgeç, arama](#5-katalog-liste-süzgeç-arama)
6. [Ürün sayfası ve varyantlar](#6-ürün-sayfası-ve-varyantlar)
7. [Sepet](#7-sepet)
8. [Checkout](#8-checkout)
9. [Online ödeme: iyzico ve PayTR](#9-online-ödeme-iyzico-ve-paytr)
10. [Sipariş sayfası, havale, iade](#10-sipariş-sayfası-havale-iade)
11. [Müşteri hesabı ve B2B fiyatları](#11-müşteri-hesabı-ve-b2b-fiyatları)
12. [Çoklu para birimi](#12-çoklu-para-birimi)
13. [Kampanyalar ve vitrin öğeleri](#13-kampanyalar-ve-vitrin-öğeleri)
14. [SEO: metadata, JSON-LD, sitemap](#14-seo-metadata-json-ld-sitemap)
15. [Terk edilmiş sepet bağlantısı](#15-terk-edilmiş-sepet-bağlantısı)
16. [Hata yönetimi](#16-hata-yönetimi)
17. [Yayına alma](#17-yayına-alma)
18. [Kontrol listesi](#18-kontrol-listesi)

---

## 1. Zihinsel model

```
Panel (yönetici)                      Delivery API (/api/v1/public/<token>/shop)        Vitrin (Next.js)
────────────────                      ──────────────────────────────────────────        ────────────────
Ürün · varyant · stok ─────────────▶  /products · /products/{slug} · /filters  ──────▶  server component
Kategori · marka · özellik ────────▶  /categories · /brands                     ──────▶  menü, süzgeç
Kampanya · kupon · hediye ─────────▶  /promotions · sepet toplamları            ──────▶  banner, sepet
Kargo · ödeme yöntemi · KDV ───────▶  sepet `shipping_options` / `payment_options`
Müşteri grubu · fiyat listesi ─────▶  oturumlu katalog fiyatı (X-Customer-Token)
                                      /cart · /checkout · /orders · /customer   ◀──────  server action
```

Üç temel kural:

1. **Tutarı sunucu hesaplar.** Vitrin hiçbir zaman fiyat, indirim, kargo ya da KDV hesaplamaz,
   API'ye tutar göndermez. Sepetteki her rakam `cart.totals` içinden basılır.
2. **Token'lar tarayıcıya çıkmaz.** Bkz. §2.
3. **Panel değişince kod değişmez.** Yeni kategori, kampanya, kargo yöntemi, ödeme yöntemi
   ya da varyant seçeneği vitrine kendiliğinden yansır.

---

## 2. Güvenlik: hangi değer nerede durur

| Değer | Nerede | Asla |
|---|---|---|
| Site (Delivery) token'ı | Sunucu ortam değişkeni `ADSCRM_TOKEN` | `NEXT_PUBLIC_*`, istemci bileşeni |
| Sepet token'ı | httpOnly çerez `shop_cart` | `localStorage`, URL'de bırakmak |
| Müşteri oturum token'ı | httpOnly çerez `shop_customer` | İstemci JS'inin okuyabileceği yer |
| iyzico / PayTR anahtarları | **Panel → E-Ticaret → Ödeme yöntemleri** (şifreli saklanır) | `.env`, vitrin kodu |

Ödeme sağlayıcısı anahtarları vitrinde **hiç bulunmaz**: ödeme formunu/iframe'ini panel
üretir, vitrin yalnızca `payment_action` içindeki adrese yönlendirir.

Okumalar server component'te, yazmalar (sepete ekleme, checkout, giriş…) **server action**
içinde yapılır. Böylece token'lar ancak sunucuda birleşir.

---

## 3. Kurulum ve istemci

```bash
npm i github:adsoffice/adscrm-ecommerce-js server-only
```

```ts
// lib/shop.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createShopClient, SHOP_COOKIES } from "@adsoffice/adscrm-ecommerce/next";

let client: ShopClient | null = null;

/** İlk kullanımda kurulur — `next build` sırasında token yoktur ve gerekmez. */
export const shop: ShopClient = new Proxy({} as ShopClient, {
  get(_t, key) {
    client ??= createShopClient({
      baseUrl: process.env.ADSCRM_URL ?? "",
      token: process.env.ADSCRM_TOKEN ?? "",
      revalidate: Number(process.env.ADSCRM_REVALIDATE ?? 60),
      tags: ["shop"],
    });
    return client[key as keyof ShopClient];
  },
});

/** İstek bağlamı: seçili para birimi + müşteri oturumu. React cache → istek başına tek kez. */
export const shopForRequest = cache(async () => {
  const jar = await cookies();
  return shop
    .withCurrency(jar.get(SHOP_COOKIES.currency)?.value || "TRY")
    .withCustomer(jar.get(SHOP_COOKIES.customer)?.value);
});
```

> **Neden Proxy?** İstemci modül düzeyinde kurulursa `next build` (Docker imajı) token
> olmadığı için patlar. Tembel kurulum, değişkenleri çalışma anında okur.

`withCustomer`, `withCurrency`, `withLocale` yeni bir istemci döner; asıl istemci değişmez.

---

## 4. Önbellek kuralları

SDK bu kuralları kendisi uygular, bilmeniz yeterli:

| İstek | Önbellek |
|---|---|
| Oturumsuz katalog / ayar GET'leri | `revalidate` sn + `tags` (Next Data Cache) |
| Müşteri oturumlu her istek | **Yok** — bayi fiyatı kişiye özeldir |
| Sepet, checkout, sipariş, hesap | **Yok** |
| Yazma istekleri | Yeniden **denenmez** (çift sipariş olmaz) |

Sayfalar çerez okuduğu için dinamik render edilir; katalog verisi yine de Data Cache'ten
gelir. Next 16'nın `cacheComponents` modu bu yüzden **kapalı** tutulur (çerez bağımlı her
sayfayı `<Suspense>` ile bölmek gerekir, kazancı yoktur).

Panel değişikliğini anında yansıtmak için webhook ucu:

```ts
// app/api/revalidate/route.ts
import { revalidateTag } from "next/cache";
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!process.env.REVALIDATE_SECRET || body.secret !== process.env.REVALIDATE_SECRET)
    return Response.json({ error: "Yetkisiz" }, { status: 401 });
  for (const tag of body.tags?.length ? body.tags : ["shop"]) revalidateTag(tag, { expire: 0 });
  return Response.json({ ok: true });
}
```

---

## 5. Katalog: liste, süzgeç, arama

Süzgeç durumu **URL'de** tutulur (paylaşılabilir, geri tuşu çalışır, JS gerekmez):

```tsx
// app/kategori/[slug]/page.tsx
import { parseFilters } from "@adsoffice/adscrm-ecommerce";

export default async function Page({ params, searchParams }: PageProps<"/kategori/[slug]">) {
  const { slug } = await params;
  const filters = { ...parseFilters(await searchParams), category: slug };
  const shop = await shopForRequest();
  const [{ data, meta }, facets] = await Promise.all([shop.products(filters), shop.filters(filters)]);
  // facets.options → renk/beden (adetli) · facets.attributes · facets.brands · facets.price
}
```

Süzgeç bağlantıları sunucuda üretilir:

```tsx
import { toggleFilter, filtersToSearchParams, isSelected } from "@adsoffice/adscrm-ecommerce";

const next = toggleFilter(filters, "opt", "renk", value.slug);
<Link href={`?${filtersToSearchParams(next, { omit: ["category"] })}`}
      className={isSelected(filters, "opt", "renk", value.slug) ? "chip-active" : "chip"} />
```

- `omit`: sayfanın kendi yolunda zaten bulunan anahtar (kategori/marka sayfasında `category`/`brand`).
- Süzgeç değişince `page` sıfırlanır — `toggleFilter`/`setFilter` bunu yapar.
- Fiyat aralığı ve sıralama için küçük istemci bileşenleri `router.push` ile aynı URL'yi kurar.
- Arama: `shop.search(q, filters)` aynı biçimi döner.

---

## 6. Ürün sayfası ve varyantlar

```tsx
const product = await (await shopForRequest()).product(slug);   // yoksa ShopNotFoundError → notFound()
```

Varyant seçimi istemci bileşenindedir (`useVariantSelection`), ama **ilk seçim sunucuda**
URL'den kurulur — paylaşılan `?renk=mavi&beden=m` bağlantısı doğru varyantla açılır:

```tsx
"use client";
import { useVariantSelection } from "@adsoffice/adscrm-ecommerce/react";

const v = useVariantSelection(product, initialSelection);
v.gallery        // seçili renge göre TÜM galeri (varyant → renk galerisi → genel görseller)
v.variant        // sepete eklenecek varyant (seçim eksikse null)
v.price          // { price, compare_at_price, discount_percent }
v.state("beden", "l")   // { exists, inStock } → olmayanı gizle, tükeneni soluk göster
v.select("renk", "mavi") // kombinasyon yoksa en yakın stoktakine düzeltir
```

Kurallar:

- Renk değişince **tek görsel değil, galerinin tamamı** değişir (`option_galleries`).
- Tükenmiş kombinasyon seçilebilir ama "Sepete ekle" yerine "Tükendi" görünür.
- Ürün kartlarındaki renk noktaları `?secenek=<değer>` ile ürün sayfasına o renkle gider.

---

## 7. Sepet

Sepet token'ı ilk eklemede oluşturulur ve httpOnly çereze yazılır:

```ts
"use server";
import { refresh } from "next/cache";

export async function addToCart(productId: number, variantId: number | null, qty = 1) {
  const jar = await cookies();
  const shop = await shopForRequest();
  let token = jar.get(SHOP_COOKIES.cart)?.value;
  try {
    if (!token) {
      token = (await shop.cart.create({ currency: shop.config.currency })).token;
      jar.set(SHOP_COOKIES.cart, token, cookieOptions());
    }
    await shop.cart.addItem(token, { product_id: productId, variant_id: variantId, qty });
    refresh();                       // header'daki sepet sayısı güncellensin
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}
```

Sepet sayfasında gösterilecekler (hepsi `cart.totals`'tan):

- Satırlar: birim fiyat, katalog indirimi, **hediye satırları** (`gift: true`, adet değiştirilemez), stok sorunu (`lineIssue`).
- Kampanyalar (`promotions[]`) ve uygulanmayanların nedeni (`promotions_skipped[]`).
- Kupon formu → `applyCoupon`; geçersiz kupon `ShopValidationError` döner, mesajı olduğu gibi gösterin.
- Ücretsiz kargo çubuğu → `freeShippingRemaining(totals, promotions)` (hediye satırları sayılmaz).
- `can_checkout === false` ise ödeme düğmesi kapalı, `issues[]` listelenir (asgari tutar, stok…).

---

## 8. Checkout

Checkout, sepetin üzerinde **adım adım güncellenen** bir formdur; her adım `cart.update`
çağırır ve sunucu yeni toplamları döner:

1. **İletişim + teslimat adresi** → `cart.update({ email, phone, shipping_address, billing_address })`
   - İl listesi `shop.regions()`'tan (TR'de `city_code` = plaka kodu).
   - Oturumlu müşteride kayıtlı adresler seçilebilir.
   - `billing_address: null` → teslimat adresiyle aynı.
2. **Kargo** → `totals.shipping_options` arasından `shipping_method_id`. Seçenekler adrese ve
   sepete göre değişir (kapıda ödemeye izin vermeyen kargo vb.).
3. **Ödeme** → `totals.payment_options` arasından `payment_method_id`. Havale indirimi, kapıda
   ödeme ücreti toplamlara yansır.
4. **Onay** → mesafeli satış sözleşmesi kutusu zorunlu → `shop.checkout(token, { accept_terms: true })`.

```ts
export async function placeOrder(_prev: ActionResult, formData: FormData) {
  if (formData.get("accept_terms") !== "on") return { ok: false, message: "Sözleşmeyi onaylayın." };
  let target = "";
  try {
    const order = await shop.checkout(token, { accept_terms: true, notes: formData.get("notes") });
    jar.delete(SHOP_COOKIES.cart);
    jar.set(SHOP_COOKIES.lastOrder, `${order.number}:${order.email}`, cookieOptions());
    const action = normalizePaymentAction(order.payment_action);
    target = action?.type === "redirect" ? action.url : `/siparis/${order.number}?tesekkurler=1`;
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
  redirect(target);     // NEXT_REDIRECT fırlatır → try/catch'in DIŞINDA
}
```

> `shop_last_order` çerezi misafirin sipariş sayfasını e-posta sormadan açabilmesi içindir.
> Misafir başka cihazdan **Sipariş takibi** sayfasında no + e-posta ile girer.

---

## 9. Online ödeme: iyzico ve PayTR

| Sağlayıcı | `payment_action` | Vitrin |
|---|---|---|
| iyzico | `{ type: "redirect", url }` | Ortak ödeme sayfasına yönlendir |
| PayTR | `{ type: "iframe", url }` | Kendi sayfanızda iframe + `PAYTR_IFRAME_RESIZER` betiği |
| Havale / kapıda ödeme | `null` | Doğrudan sipariş sayfası |

Dönüş adresi panelde ayarlanır (öntanımlı `/odeme/sonuc?order=<no>&status=…`). **`status`
parametresine güvenmeyin**; sonuç sayfası `orders.track(no, email)` ile `payment_status`'ı
okur. PayTR onayı birkaç saniye gecikebildiği için `shouldPollPayment(order)` doğruysa sayfa
kısa aralıklarla yenilenir. Reddedilen ödeme için `orders.pay(no, email)` yeni bir
`payment_action` üretir ("Tekrar öde" düğmesi).

CSP'de `frame-src https:` açık olmalıdır (PayTR iframe'i, 3D Secure sayfaları).

---

## 10. Sipariş sayfası, havale, iade

`orders.track(no, email)` (misafir) ya da `account.order(no)` (oturumlu) tek nesne döner:

- **İlerleme çubuğu** → `orderProgress(order)` (0 alındı · 1 hazırlanıyor · 2 kargoda · 3 teslim).
- **Zaman çizelgesi** → `order.timeline`.
- **Kargo paketleri** → `order.shipments[]` (kısmi kargo: her paketin satırları ve takip bağlantısı).
- **Havale** → `awaitsBankTransfer(order)` ise banka hesapları + bildirim formu
  (`orders.bankTransfer`). Bildirim sonrası sayfa "onay bekliyor" der.
- **İade** → `returnableLines(order)` boş değilse iade formu; satır başına adet + neden
  (`RETURN_REASONS`). Süre ve koşullar `order.return_policy`'den gelir; mevcut talepler
  `order.returns[]`.

---

## 11. Müşteri hesabı ve B2B fiyatları

```ts
const { token } = await shop.auth.login(email, password);
jar.set(SHOP_COOKIES.customer, token, cookieOptions());
```

- Giriş/kayıt sonrası `?next=` parametresine yalnızca **site içi** yollar kabul edilir
  (açık yönlendirme açığı olmasın).
- Oturum düşerse istekler `ShopUnauthorizedError` fırlatır → çerezi silip giriş sayfasına yönlendirin.
- Şifre sıfırlama bağlantısı sizin alan adınıza gelir: `forgotPassword(email, "/sifre-sifirla")`.
- Çıkışta sepet çerezi de silinir (bayi fiyatlı sepet misafire kalmasın).

**B2B:** Müşteri bir gruba (ör. "Bayi") bağlıysa oturumlu istemcideki **bütün katalog
fiyatları** grup fiyatıdır. Vitrinde ek iş yoktur; isteğe bağlı olarak
`price_source === "price_list" | "group"` olduğunda "Bayi fiyatınız gösteriliyor" notu basılır.
Grubun asgari sipariş tutarı, ücretsiz kargo ve "kampanyalardan yararlanmaz" kuralları sepet
toplamlarına zaten yansır.

---

## 12. Çoklu para birimi

```ts
export async function setCurrency(currency: string) {
  const jar = await cookies();
  jar.set(SHOP_COOKIES.currency, currency, cookieOptions({ maxAge: 60 * 60 * 24 * 365 }));
  const token = jar.get(SHOP_COOKIES.cart)?.value;
  if (token) await (await shopForRequest()).withCurrency(currency).cart.update(token, { currency });
  refresh();
}
```

Desteklenen para birimleri `settings().currencies`'ten okunur. Fiyatlar ya kurla çevrilir ya
da o para biriminin panelde tanımlı fiyat listesinden gelir — vitrin farkı bilmez.
`formatMoney(value)` sembol ve biçimi para birimine göre seçer.

---

## 13. Kampanyalar ve vitrin öğeleri

`shop.promotions()` yürürlükteki kampanyaları döner: başlık, `ends_at`, ücretsiz kargo eşiği,
hediye eşiği… Örnek vitrinde:

- Üst şeritte dönen kampanya metinleri, bitişi yakın olanlarda geri sayım (`useCountdown`).
- Ürün kartında katalog indirimi rozeti (`compare_at_price` + `discountPercent`).
- Sepette ücretsiz kargo çubuğu.

Kampanya **kuralları** (X al Y öde, hediye, kupon koşulları) vitrinde yeniden yazılmaz;
sonuç her zaman `cart.totals`'tadır.

---

## 14. SEO: metadata, JSON-LD, sitemap

```tsx
export async function generateMetadata({ params }) {
  const product = await shop.product((await params).slug);
  return productMetadata(product, { siteName, baseUrl: SITE_URL });
}

// sayfa içinde
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(product.structured_data) }} />
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd(items, SITE_URL)) }} />
```

- Paneldeki SEO başlığı tam başlıktır (site adını içerir); `productMetadata` onu
  `{ absolute }` olarak verir, layout'taki `%s | Mağaza` şablonu ikinci kez eklemez.
- `structured_data` panelde üretilir (Product + Offer, fiyat, stok, marka, puan); elle kurmayın.
- Sitemap: `sitemapEntries(await shop.urls({ kind: ["product", "product_category", "brand"] }), SITE_URL)`.
  Derlemede token olmadığından `export const dynamic = "force-dynamic"`.
- `robots.ts`: `/sepet`, `/odeme`, `/hesap`, `/siparis`, `/api/` taranmaz.

---

## 15. Terk edilmiş sepet bağlantısı

Panelin hatırlatma e-postasındaki bağlantı `/sepet?cart=<token>` biçimindedir. `proxy.ts`
(Next 16'da middleware'in yeni adı) token'ı çereze yazar ve adresten temizler:

```ts
// proxy.ts
export function proxy(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("cart");
  if (!token) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.searchParams.delete("cart");
  const response = NextResponse.redirect(url);
  response.cookies.set(SHOP_COOKIES.cart, token, cookieOptions());
  return response;
}
export const config = { matcher: ["/sepet"] };
```

---

## 16. Hata yönetimi

| Hata | Ne yapılır |
|---|---|
| `ShopNotFoundError` | Ürün/kategori sayfasında `notFound()`; sepette çerezi sil |
| `ShopValidationError` | `fieldErrors()` alanların altına, `firstMessage` form üstüne |
| `ShopUnauthorizedError` | Müşteri çerezini sil → giriş sayfası |
| `ShopRateLimitError` | "Çok sık denediniz" — tekrar denemeyin |
| `ShopMaintenanceError` | Bakım sayfası |
| `ShopNetworkError` | `error.tsx`: teknik ayrıntı göstermeden "tekrar dene" |

Server action'larda `errorMessage(error, "yedek metin")` ziyaretçiye gösterilecek tek satırı verir.
Hata URL'lerinde site token'ı SDK tarafından maskelenir; yine de tam hatayı istemciye geri döndürmeyin.

---

## 17. Yayına alma

- `next.config`: `output: "standalone"`; görseller panel alan adından geliyorsa `images.remotePatterns`.
- Docker: çok aşamalı imaj, deps aşamasında `git` (paket GitHub'dan kurulur). Token **build arg
  değildir** — katalog çalışma anında çekilir.
- Panel yerelde çalışıyorsa konteynerden `ADSCRM_URL=http://host.docker.internal`
  (`extra_hosts: host.docker.internal:host-gateway`).
- Panel → Mağaza ayarlarında **vitrin alan adı** ve **ödeme dönüş yolu** doğru olmalı
  (e-posta bağlantıları, iyzico/PayTR dönüşü, sıfırlama bağlantısı buradan kurulur).
- Üretimde çerezler `Secure`'dur (`cookieOptions` `NODE_ENV=production`'da açar) → HTTPS şart.

---

## 18. Kontrol listesi

- [ ] Site token'ı yalnızca sunucuda; `NEXT_PUBLIC_` yok, istemci bileşeni `lib/shop`'u import etmiyor.
- [ ] Sepet/müşteri token'ları httpOnly çerezde.
- [ ] Vitrinde hiçbir tutar hesaplanmıyor; her rakam API'den.
- [ ] Varyant değişince galerinin tamamı değişiyor; tükenmiş kombinasyon "Tükendi".
- [ ] Süzgeçler URL'de; sayfa yenilenince/paylaşılınca aynı sonuç.
- [ ] Kupon, kampanya, hediye, ücretsiz kargo çubuğu sepette doğru.
- [ ] Havale, kapıda ödeme ve (anahtarlar panelde girildiyse) iyzico/PayTR ile sipariş verilebiliyor.
- [ ] Ödeme sonucu `status` parametresine değil `payment_status`'a göre gösteriliyor.
- [ ] Misafir sipariş takibi, havale bildirimi, iade talebi çalışıyor.
- [ ] Bayi hesabıyla girince fiyatlar değişiyor; çıkınca eski fiyatlar dönüyor.
- [ ] Para birimi değişince katalog ve açık sepet aynı para biriminde.
- [ ] Ürün sayfasında JSON-LD, canonical, tekrarsız başlık; `sitemap.xml` ürün/kategori/marka içeriyor.
- [ ] `/sepet?cart=…` hatırlatma bağlantısı sepeti geri yüklüyor.
