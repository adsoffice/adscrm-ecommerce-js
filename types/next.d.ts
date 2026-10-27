import type { ProductDetail, ShopClient, ShopOptions, UrlEntry } from './index';

export { SHOP_COOKIES } from './index';

/** Next için varsayılanlarla istemci: katalog ISR 60 sn, `shop` etiketli. */
export function createShopClient(options: ShopOptions): ShopClient;

/** `shopTag('product', 'basic-tisort')` → "shop:product:basic-tisort" */
export function shopTag(...parts: Array<string | number | undefined | null>): string;

/** httpOnly, SameSite=Lax çerez seçenekleri (`cookies().set(name, value, cookieOptions())`). */
export function cookieOptions(options?: { maxAge?: number; secure?: boolean }): {
    httpOnly: true;
    sameSite: 'lax';
    secure: boolean;
    path: '/';
    maxAge: number;
};

/** Ürün sayfası `generateMetadata` çıktısı. */
export function productMetadata(product: ProductDetail, options?: { siteName?: string; baseUrl?: string }): {
    title?: string;
    description?: string;
    alternates?: { canonical: string };
    openGraph: Record<string, unknown>;
};

/** `<script type="application/ld+json">` için güvenli JSON dizesi. */
export function jsonLd(data: unknown): string;

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>, baseUrl?: string): Record<string, unknown>;

export function sitemapEntries(
    urls: { data: UrlEntry[] } | UrlEntry[],
    baseUrl: string,
    options?: { changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'; priority?: number },
): Array<{ url: string; lastModified?: Date; changeFrequency?: string; priority?: number; alternates?: { languages: Record<string, string> } }>;
