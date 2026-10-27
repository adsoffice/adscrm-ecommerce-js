/**
 * Next.js (App Router) yardımcıları.
 *
 * Bu dosya `next/*` paketlerinden hiçbir şey import etmez — Next sürümüne bağımlı
 * değildir; yalnızca `fetch` önbellek seçeneklerine uygun istemci, çerez ayarları,
 * metadata / JSON-LD / sitemap üreticileri verir.
 */

import { createShop } from '../client.js';
import { SHOP_COOKIES } from '../constants.js';

export { SHOP_COOKIES };

/**
 * Next için makul varsayılanlarla istemci: katalog ISR 60 sn, `shop` etiketli.
 * Webhook'tan `revalidateTag('shop')` ile tüm katalog tazelenir.
 *
 * ```js
 * // lib/shop.js  (yalnızca sunucu)
 * import 'server-only';
 * import { createShopClient } from '@adsoffice/adscrm-ecommerce/next';
 * export const shop = createShopClient({ baseUrl: process.env.ADSCRM_URL, token: process.env.ADSCRM_TOKEN });
 * ```
 */
export function createShopClient(options = {}) {
    return createShop({ revalidate: 60, tags: ['shop'], ...options });
}

/** Önbellek etiketi: `shopTag('product', slug)` → "shop:product:<slug>". */
export function shopTag(...parts) {
    return ['shop', ...parts.filter(Boolean)].join(':');
}

/**
 * Sepet / oturum çerezleri için güvenli varsayılanlar (httpOnly, SameSite=Lax).
 * `secure` üretimde açık olmalı; yerelde (http://localhost) kapalı bırakılır.
 */
export function cookieOptions({ maxAge = 60 * 60 * 24 * 30, secure = process.env.NODE_ENV === 'production' } = {}) {
    return { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge };
}

/**
 * Ürün sayfası metadata'sı (`generateMetadata`) — başlık/açıklama ürünün SEO
 * alanlarından, canonical ürün adresi, Open Graph görseli ilk görsel.
 * Paneldeki SEO başlığı zaten tam başlıktır (site adını içerir) → `absolute`
 * olarak verilir; layout'taki `%s | Site` şablonu ikinci kez eklemez.
 */
export function productMetadata(product, { siteName, baseUrl } = {}) {
    const seoTitle = product?.seo?.title;
    const title = seoTitle || product?.name;
    const description = product?.seo?.description || product?.short_description || undefined;
    const image = product?.images?.[0]?.url || product?.image?.url;
    const url = product?.url && baseUrl ? new URL(product.url, baseUrl).toString() : product?.url;
    return {
        title: seoTitle ? { absolute: seoTitle } : title,
        description,
        alternates: url ? { canonical: url } : undefined,
        openGraph: {
            type: 'website',
            title,
            description,
            url,
            siteName,
            images: image ? [{ url: image, alt: product?.name }] : undefined,
        },
    };
}

/**
 * JSON-LD betiği için güvenli dize — `structured_data`'yı `<script type="application/ld+json">`
 * içine `dangerouslySetInnerHTML={{ __html: jsonLd(product.structured_data) }}` ile basın.
 * `</script>` enjeksiyonuna karşı `<` kaçışlanır.
 */
export function jsonLd(data) {
    return JSON.stringify(data ?? {}).replace(/</g, '\\u003c');
}

/** Breadcrumb JSON-LD: `[{ name, url }]` → schema.org BreadcrumbList. */
export function breadcrumbJsonLd(items, baseUrl) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: baseUrl ? new URL(item.url, baseUrl).toString() : item.url,
        })),
    };
}

/**
 * `app/sitemap.js` için: `shop.urls()` kayıtları → Next `MetadataRoute.Sitemap`.
 * Çok dilli kayıtlarda `alternates.languages` doldurulur.
 */
export function sitemapEntries(urlsResponse, baseUrl, { changeFrequency = 'weekly', priority } = {}) {
    const entries = urlsResponse?.data ?? urlsResponse ?? [];
    const abs = (path) => new URL(path, baseUrl).toString();
    const out = [];
    for (const entry of entries) {
        const urls = entry.urls || {};
        const languages = Object.fromEntries(Object.entries(urls).map(([locale, path]) => [locale, abs(path)]));
        for (const path of Object.values(urls)) {
            out.push({
                url: abs(path),
                lastModified: entry.updated_at ? new Date(entry.updated_at) : undefined,
                changeFrequency,
                priority: priority ?? (entry.kind === 'product' ? 0.8 : 0.6),
                alternates: Object.keys(languages).length > 1 ? { languages } : undefined,
            });
        }
    }
    return out;
}
