/**
 * @adsoffice/adscrm-ecommerce — tipler.
 * Tüm tutarlar en küçük para biriminde tamsayıdır (kuruş/sent).
 */

/* ── Temel ───────────────────────────────────────────────────── */

export interface Money {
    amount: number;
    currency: string;
}

export interface Image {
    url: string;
    alt: string | null;
}

export interface Paginated<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        last_page: number;
        per_page?: number;
        [key: string]: unknown;
    };
}

export interface Review {
    id: number;
    /** Kısaltılmış ad ("Ayşe Y."). */
    author: string;
    rating: number;
    title: string | null;
    body: string | null;
    /** Kargolanmış / teslim edilmiş siparişle doğrulandı. */
    verified_purchase: boolean;
    /** Mağaza yanıtı */
    reply: string | null;
    replied_at: string | null;
    created_at: string;
}

export interface ReviewSummary {
    average: number;
    count: number;
    /** "5" … "1" → adet */
    distribution: Record<'5' | '4' | '3' | '2' | '1', number>;
}

export interface ProductQuestion {
    id: number;
    author: string;
    question: string;
    answer: string;
    answered_at: string;
    created_at: string;
}

export interface ReviewInput {
    rating: 1 | 2 | 3 | 4 | 5;
    title?: string;
    body?: string;
    /** Misafirde zorunlu (üye oturumunda hesaptan alınır). */
    author_name?: string;
    email?: string;
}

export interface CurrencyMeta {
    currency: string;
    base_currency: string;
    exchange_rate: string;
    currency_fallback: boolean;
}

export interface RequestOptions {
    locale?: string | null;
    currency?: string;
    customerToken?: string;
    /** Next.js Data Cache süresi (sn). 0 → önbelleksiz. Oturumlu isteklerde yok sayılır. */
    revalidate?: number | false;
    tags?: string[];
    cache?: RequestCache;
    signal?: AbortSignal;
    headers?: Record<string, string>;
    retries?: number;
}

export interface ShopOptions {
    /** `https://crm.adsoffice.net` ya da tam delivery adresi. */
    baseUrl: string;
    /** Site delivery token'ı — yalnızca sunucuda. */
    token?: string;
    locale?: string;
    /** Katalog/sepet para birimi (`?currency=`). */
    currency?: string;
    /** Müşteri oturumu (X-Customer-Token) — B2B fiyat ve hesap uçları. */
    customerToken?: string;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    revalidate?: number | false;
    tags?: string[];
    headers?: Record<string, string>;
    fetch?: typeof fetch;
}

/* ── Mağaza ──────────────────────────────────────────────────── */

export interface ShopSettings {
    store_name: string;
    base_currency: string;
    currencies: Array<{ code: string; name: string; symbol: string; minor: number }>;
    prices_include_tax: boolean;
    guest_checkout: boolean;
    /** Baz para biriminde kuruş. */
    min_order_total: number;
    /** Vitrin adres kalıpları: `{ product: '/urun/{slug}', category, brand, cart }` */
    paths: Record<'product' | 'category' | 'brand' | 'cart', string>;
    paths_i18n: Record<string, Partial<Record<'product' | 'category' | 'brand' | 'cart', string>>>;
    returns: { enabled: boolean; days: number; instructions: string | null };
    reviews: { enabled: boolean; auto_approve: boolean; require_purchase: boolean; questions_enabled: boolean };
}

export interface Region {
    code: string;
    name: string;
}

export interface Regions {
    countries: Array<{ code: string; name: string; regions: Region[] }>;
}

export interface PublicPromotion {
    id: number;
    kind: 'cart' | 'catalog';
    label: string;
    description: string | null;
    /** Eylem tipleri: `percent_off_items`, `buy_x_get_y`, `free_shipping`, `add_gift`… */
    actions: string[];
    min_subtotal: Money | null;
    first_order_only: boolean;
    members_only: boolean;
    starts_at: string | null;
    ends_at: string | null;
}

export interface UrlEntry {
    ref: string;
    kind: 'product' | 'product_category' | 'brand';
    section: string;
    group: string;
    labels: Record<string, string>;
    urls: Record<string, string>;
    updated_at: string | null;
}

/* ── Katalog ─────────────────────────────────────────────────── */

export interface Category {
    id: number;
    parent_id: number | null;
    name: string;
    slug: string;
    description: string | null;
    image: string | null;
    seo: { title?: string; description?: string } | null;
    google_category: string | null;
    product_count: number | null;
    fields: Record<string, unknown>;
    children?: Category[];
    breadcrumb?: Array<{ id: number; name: string; slug: string }>;
}

export interface Brand {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    logo: string | null;
    product_count?: number;
    [key: string]: unknown;
}

/** `price_source`: fiyatın nereden geldiği (B2B / kampanya ayrımı için). */
export type PriceSource = 'base' | 'catalog' | 'group' | 'price_list' | 'currency_list';

export interface PriceBlock {
    price: Money;
    compare_at_price: Money | null;
    discount_percent: number | null;
    base_price: Money | null;
    price_source: PriceSource;
    /** Katalog indirimi (zamanlı fiyat kuralı) varsa. */
    promotion: { id: number; label: string; ends_at: string | null } | null;
}

export interface Swatch {
    value: string;
    slug: string;
    color_hex: string | null;
    image: string | null;
    media: Image | null;
}

export interface ProductCard extends PriceBlock {
    id: number;
    name: string;
    slug: string;
    short_description: string | null;
    sku: string | null;
    type: 'simple' | 'variable';
    price_range: { min: Money; max: Money } | null;
    tax_rate_bp: number;
    image: Image | null;
    images: Image[];
    brand: { name: string; slug: string } | null;
    category: { name: string; slug: string } | null;
    in_stock: boolean;
    is_featured: boolean;
    is_new: boolean;
    ships_free: boolean;
    /** Onaylı değerlendirmelerin özeti (yorum yoksa `count: 0`). */
    rating: { average: number; count: number };
    swatches: Swatch[];
}

export interface OptionValue {
    value: string;
    slug: string;
    color_hex: string | null;
    image: string | null;
    /** Bu değeri taşıyan stokta bir varyant var mı. */
    available: boolean;
}

export interface ProductOption {
    code: string;
    name: string;
    display: 'button' | 'color' | 'image' | 'select' | string;
    controls_media: boolean;
    values: OptionValue[];
}

export interface Variant extends PriceBlock {
    id: number;
    sku: string | null;
    barcode: string | null;
    /** `{ renk: 'kirmizi', beden: 'm' }` */
    options: Record<string, string>;
    title: string;
    in_stock: boolean;
    weight_g: number | null;
    desi: number | null;
    /** TAM galeri (varyant → renk → genel). */
    images: Image[];
}

export interface ProductAttribute {
    code: string;
    name: string;
    type: 'select' | 'multiselect' | 'number' | 'boolean';
    unit: string | null;
    value: string | number | boolean | null;
    values?: Array<{ value: string; slug: string }>;
}

export interface ProductDetail extends ProductCard {
    description: string | null;
    barcode: string | null;
    options: ProductOption[];
    variants: Variant[];
    media_option: string | null;
    option_galleries: Record<string, Image[]>;
    default_variant_id: number | null;
    categories: Array<{ id: number; name: string; slug: string }>;
    attributes: ProductAttribute[];
    purchase: { min_qty: number; max_qty: number | null; qty_step: number; allow_backorder: boolean };
    shipping: { weight_g: number | null; desi: number | null; dimensions_mm: Record<string, number> | null; ships_free: boolean; lead_days: number | null };
    related: { related: ProductCard[]; cross_sell: ProductCard[]; up_sell: ProductCard[] };
    seo: { title?: string; description?: string; [key: string]: unknown } | null;
    fields: Record<string, unknown>;
    /** Vitrin yolu (mağaza adres kalıbından). */
    url: string;
    /** schema.org Product JSON-LD. */
    structured_data: Record<string, unknown>;
    published_at: string | null;
    updated_at: string | null;
}

export interface ProductFilters {
    category?: string;
    brand?: string | string[];
    /** `{ malzeme: ['pamuk'], agirlik: '100..250', su_gecirmez: '1' }` */
    attr?: Record<string, string | string[]>;
    /** `{ renk: ['kirmizi'], beden: ['m'] }` — aynı varyantta birlikte sağlanır. */
    opt?: Record<string, string | string[]>;
    price_min?: number;
    price_max?: number;
    in_stock?: boolean;
    featured?: boolean;
    new?: boolean;
    q?: string;
    sort?: 'default' | 'price' | '-price' | '-created' | 'name' | '-rating';
    page?: number;
    limit?: number;
}

export interface FacetValue {
    value: string;
    slug: string;
    count: number;
    selected: boolean;
    color_hex?: string | null;
    image?: string | null;
}

export interface Facets {
    attributes: Array<{ code: string; name: string; type: string; unit: string | null; selected: unknown; values?: FacetValue[]; range?: { min: number; max: number } }>;
    options: Array<{ code: string; name: string; display: string; selected: unknown; values: FacetValue[] }>;
    brands: Array<{ name: string; slug: string; count: number; selected: boolean }>;
    price: { min: number; max: number; currency: string } | null;
    total: number;
    in_stock: number;
}

export interface StockRow {
    sku: string;
    product_id: number;
    variant_id: number | null;
    in_stock: boolean;
    stock: number | null;
    price: Money;
}

/* ── Sepet ───────────────────────────────────────────────────── */

export interface Address {
    title?: string | null;
    first_name: string;
    last_name: string;
    phone: string;
    country?: string;
    city?: string | null;
    /** TR il plaka kodu ("34"). */
    city_code?: string | null;
    district?: string | null;
    neighborhood?: string | null;
    line1: string;
    line2?: string | null;
    postal_code?: string | null;
    company?: string | null;
    tax_office?: string | null;
    tax_no?: string | null;
    /** 11 hane (yanıtlarda maskeli). */
    identity_no?: string | null;
}

export interface CartLine {
    item_id: number | null;
    product_id: number;
    variant_id: number | null;
    name: string;
    slug: string | null;
    variant_title: string | null;
    sku: string | null;
    image: string | null;
    qty: number;
    unit_price: number;
    original_unit_price: number | null;
    price_source: PriceSource | null;
    catalog_promotion: { id: number; label: string } | null;
    /** Kampanya hediyesi — düzenlenemez, tutarı 0. */
    gift: boolean;
    line_subtotal: number;
    discount: number;
    line_total: number;
    tax_rate_bp: number;
    tax: number;
    available: boolean;
    stock: number | null;
    issue: string | null;
    issue_message: string | null;
}

export interface ShippingOption {
    id: number;
    name: string;
    description: string | null;
    carrier: string | null;
    type: string;
    amount: number;
    free: boolean;
    free_over: number | null;
    cod_allowed: boolean;
    lead_days: number | null;
}

export interface PaymentOption {
    id: number;
    driver: 'bank_transfer' | 'cash_on_delivery' | 'iyzico' | 'paytr' | string;
    name: string;
    instructions: string | null;
    fee: number;
    discount_bp: number;
    online: boolean;
    max_installments: number | null;
}

export interface CartTotals {
    currency: string;
    base_currency: string;
    exchange_rate: string;
    prices_include_tax: boolean;
    lines: CartLine[];
    item_count: number;
    subtotal: number;
    promotions: Array<{ id: number; label: string; amount: number; free_shipping: boolean; gift: boolean }>;
    promotions_skipped: Array<{ id: number; label: string; reason: 'coupon' }>;
    coupon: { code: string; id: number | null; valid: boolean; message: string | null; amount?: number; type?: string; free_shipping: boolean } | null;
    discount_total: number;
    shipping: ShippingOption | null;
    shipping_total: number;
    payment: PaymentOption | null;
    fee_total: number;
    tax_total: number;
    tax_breakdown: Array<{ rate_bp: number; amount: number }>;
    grand_total: number;
    base_grand_total: number;
    adjustments: Array<{ type: string; label: string; amount: number; source_id: number | null }>;
    weight_g: number;
    shipping_options: ShippingOption[];
    payment_options: PaymentOption[];
    issues: Array<{ item_id: number | null; code: string; message: string; min?: number }>;
    can_checkout: boolean;
}

export interface Cart {
    token: string;
    currency: string;
    locale: string;
    email: string | null;
    phone: string | null;
    customer_id: number | null;
    shipping_address: Address | null;
    billing_address: Address | null;
    shipping_method_id: number | null;
    payment_method_id: number | null;
    coupon_code: string | null;
    notes: string | null;
    accepts_marketing: boolean;
    expires_at: string | null;
    totals: CartTotals;
}

export interface CartPatch {
    email?: string | null;
    phone?: string | null;
    shipping_address?: Address | null;
    /** null → teslimat adresiyle aynı. */
    billing_address?: Address | null;
    shipping_address_id?: number | null;
    shipping_method_id?: number | null;
    payment_method_id?: number | null;
    notes?: string | null;
    currency?: string;
    locale?: string;
    /** Ticari ileti onayı (terk edilmiş sepet hatırlatması bu onaya bağlıdır). */
    accepts_marketing?: boolean;
}

/* ── Sipariş ─────────────────────────────────────────────────── */

export interface PaymentAction {
    type: 'redirect' | 'iframe';
    url: string;
    token?: string | null;
}

export interface Tracking {
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
}

export interface OrderItem {
    id: number;
    product_id: number | null;
    variant_id: number | null;
    sku: string | null;
    name: string;
    variant_title: string | null;
    image: string | null;
    qty: number;
    unit_price: number;
    discount_total: number;
    tax_rate_bp: number;
    tax_total: number;
    line_total: number;
    refunded_qty: number;
    shipped_qty: number;
}

/** Hesaptaki sipariş listesi satırı (`account.orders`) — detay için `account.order(number)`. */
export interface OrderSummary {
    number: string;
    status: string;
    status_label: string;
    payment_status: Order['payment_status'];
    grand_total: number;
    currency: string;
    /** Toplam ürün adedi */
    item_count: number;
    placed_at: string | null;
}

export interface Order {
    number: string;
    status: string;
    status_label: string;
    payment_status: 'pending' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
    fulfillment_status: 'unfulfilled' | 'partial' | 'shipped' | 'delivered' | 'returned';
    currency: string;
    email: string;
    phone: string | null;
    items: OrderItem[];
    adjustments: Array<{ type: string; label: string; amount: number }>;
    subtotal: number;
    discount_total: number;
    shipping_total: number;
    fee_total: number;
    tax_total: number;
    grand_total: number;
    prices_include_tax: boolean;
    shipping_address: Address | null;
    billing_address: Address | null;
    shipping_method: { id: number; name: string; carrier: string | null; lead_days: number | null } | null;
    payment_method: { id: number; driver: string; name: string; instructions: string | null } | null;
    coupon_code: string | null;
    notes: string | null;
    tracking: Tracking | null;
    shipments: Array<Tracking & { status: string; shipped_at: string | null; delivered_at: string | null; items: Array<{ order_item_id: number; name: string; variant_title: string | null; qty: number }> }>;
    returns: Array<{ number: string; status: string; status_label: string; items: Array<{ order_item_id: number; name: string; variant_title?: string; qty: number; reason?: string }>; note: string | null; return_carrier: string | null; return_code: string | null; created_at: string }>;
    return_policy: { can_request: boolean; message: string | null; returnable: Record<string, number>; deadline: string | null; reasons: Record<string, string> };
    bank_accounts: Array<{ id: number; bank: string; branch: string | null; holder: string; iban: string; currency: string }>;
    bank_transfer_submitted: boolean;
    timeline: Array<{ type: string; status: string | null; label: string; at: string }>;
    placed_at: string;
    payment_expires_at: string | null;
    /** Yalnızca checkout / pay yanıtında. */
    payment_action?: PaymentAction | null;
}

export interface ReturnRequest {
    items: Array<{ order_item_id: number; qty: number; reason?: keyof typeof RETURN_REASONS }>;
    reason?: keyof typeof RETURN_REASONS;
    note?: string;
}

/* ── Müşteri ─────────────────────────────────────────────────── */

export interface Customer {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    locale: string | null;
    accepts_marketing: boolean;
    email_verified: boolean;
    created_at: string;
}

export interface SavedAddress extends Address {
    id: number;
    is_default_shipping: boolean;
    is_default_billing: boolean;
}

export interface AuthResult {
    token: string;
    customer: Customer;
}

/* ── İstemci ─────────────────────────────────────────────────── */

export interface ShopClient {
    config: ShopOptions & { base: string };
    withCustomer(customerToken?: string | null): ShopClient;
    withCurrency(currency?: string | null): ShopClient;
    withLocale(locale: string): ShopClient;
    raw<T = unknown>(path: string, opts?: RequestOptions & { method?: string; query?: Record<string, unknown>; body?: unknown }): Promise<T>;

    settings(opts?: RequestOptions): Promise<ShopSettings>;
    regions(opts?: RequestOptions): Promise<Regions>;
    promotions(opts?: RequestOptions): Promise<PublicPromotion[]>;
    urls(opts?: RequestOptions & { kind?: string | string[]; limit?: number }): Promise<{ data: UrlEntry[]; meta: { locales: string[]; default_locale: string; total: number; truncated: boolean; paths: Record<string, string> } }>;

    categories(opts?: RequestOptions): Promise<Category[]>;
    categoryTree(opts?: RequestOptions): Promise<Category[]>;
    category(slug: string, opts?: RequestOptions): Promise<Category>;
    brands(opts?: RequestOptions): Promise<Brand[]>;
    brand(slug: string, opts?: RequestOptions): Promise<Brand>;
    products(filters?: ProductFilters, opts?: RequestOptions): Promise<Paginated<ProductCard> & { meta: CurrencyMeta & { locale: string; category: Category | null } }>;
    search(q: string, filters?: ProductFilters, opts?: RequestOptions): Promise<Paginated<ProductCard> & { meta: CurrencyMeta }>;
    product(slug: string, opts?: RequestOptions): Promise<ProductDetail>;
    filters(filters?: ProductFilters, opts?: RequestOptions): Promise<Facets>;
    stock(skus: string | string[], opts?: RequestOptions): Promise<StockRow[]>;
    reviews(slug: string, opts?: RequestOptions & { page?: number; limit?: number; rating?: number; sort?: '-created' | '-rating' | 'rating' }): Promise<Paginated<Review> & { meta: { summary: ReviewSummary } }>;
    questions(slug: string, opts?: RequestOptions & { page?: number; limit?: number }): Promise<Paginated<ProductQuestion>>;
    submitReview(slug: string, body: ReviewInput, opts?: RequestOptions): Promise<{ message: string; data: { id: number; status: 'pending' | 'approved' } }>;
    askQuestion(slug: string, body: { question: string; author_name?: string; email?: string }, opts?: RequestOptions): Promise<{ message: string; data: { id: number; status: 'pending' } }>;

    cart: {
        create(body?: { currency?: string; locale?: string }, opts?: RequestOptions): Promise<Cart>;
        get(token: string, opts?: RequestOptions): Promise<Cart>;
        update(token: string, patch: CartPatch, opts?: RequestOptions): Promise<Cart>;
        addItem(token: string, item: { product_id: number; variant_id?: number | null; qty: number }, opts?: RequestOptions): Promise<Cart>;
        updateItem(token: string, itemId: number, qty: number, opts?: RequestOptions): Promise<Cart>;
        removeItem(token: string, itemId: number, opts?: RequestOptions): Promise<Cart>;
        applyCoupon(token: string, code: string, opts?: RequestOptions): Promise<Cart>;
        removeCoupon(token: string, opts?: RequestOptions): Promise<Cart>;
    };
    checkout(cartToken: string, body: { accept_terms: true; email?: string; phone?: string; notes?: string }, opts?: RequestOptions): Promise<Order>;
    orders: {
        track(number: string, email: string, opts?: RequestOptions): Promise<Order>;
        pay(number: string, email: string, opts?: RequestOptions): Promise<Order>;
        bankTransfer(number: string, body: { email: string; sender_name: string; amount?: number; bank_account_id?: number; note?: string }, opts?: RequestOptions): Promise<unknown>;
        requestReturn(number: string, body: ReturnRequest & { email: string }, opts?: RequestOptions): Promise<Order>;
    };
    auth: {
        register(body: { email: string; password: string; first_name: string; last_name: string; phone?: string; accepts_marketing?: boolean }, opts?: RequestOptions): Promise<AuthResult>;
        login(email: string, password: string, opts?: RequestOptions): Promise<AuthResult>;
        logout(opts?: RequestOptions): Promise<unknown>;
        forgotPassword(email: string, resetPath?: string, opts?: RequestOptions): Promise<unknown>;
        resetPassword(body: { email: string; token: string; password: string }, opts?: RequestOptions): Promise<unknown>;
    };
    account: {
        get(opts?: RequestOptions): Promise<Customer>;
        update(body: Partial<Pick<Customer, 'first_name' | 'last_name' | 'phone' | 'locale' | 'accepts_marketing'>> & { password?: string; current_password?: string }, opts?: RequestOptions): Promise<Customer>;
        addresses(opts?: RequestOptions): Promise<SavedAddress[]>;
        addAddress(address: Address & { is_default_shipping?: boolean; is_default_billing?: boolean }, opts?: RequestOptions): Promise<SavedAddress>;
        updateAddress(id: number, address: Address & { is_default_shipping?: boolean; is_default_billing?: boolean }, opts?: RequestOptions): Promise<SavedAddress>;
        deleteAddress(id: number, opts?: RequestOptions): Promise<unknown>;
        orders(opts?: RequestOptions & { page?: number }): Promise<Paginated<OrderSummary>>;
        order(number: string, opts?: RequestOptions): Promise<Order>;
        requestReturn(number: string, body: ReturnRequest, opts?: RequestOptions): Promise<Order>;
    };
}

export function createShop(options: ShopOptions): ShopClient;

/* ── Hatalar ─────────────────────────────────────────────────── */

export class ShopError extends Error {
    status: number;
    url: string;
    body: unknown;
}
export class ShopNotFoundError extends ShopError {}
export class ShopUnauthorizedError extends ShopError {}
export class ShopValidationError extends ShopError {
    errors: Record<string, string[]>;
    fieldError(field: string): string | undefined;
    fieldErrors(): Record<string, string>;
    readonly firstMessage: string;
}
export class ShopRateLimitError extends ShopError {
    retryAfter: number | null;
}
export class ShopMaintenanceError extends ShopError {
    maintenance: { enabled: boolean; retry_after: number; texts: { title: string; message: string } } | null;
    retryAfter: number | null;
    readonly texts: { title: string; message: string } | null;
}
export class ShopNetworkError extends ShopError {}

export function isNotFound(error: unknown): error is ShopNotFoundError;
export function isUnauthorized(error: unknown): error is ShopUnauthorizedError;
export function isValidationError(error: unknown): error is ShopValidationError;
export function isRateLimited(error: unknown): error is ShopRateLimitError;
export function isMaintenance(error: unknown): error is ShopMaintenanceError;
export function errorMessage(error: unknown, fallback?: string): string;

/* ── Süzgeçler ───────────────────────────────────────────────── */

export const SORTS: ReadonlyArray<NonNullable<ProductFilters['sort']>>;
export function filtersToQuery(filters?: ProductFilters): Record<string, unknown>;
export function parseFilters(searchParams?: URLSearchParams | Record<string, string | string[] | undefined>): ProductFilters & { attr: Record<string, string | string[]>; opt: Record<string, string | string[]> };
export function filtersToSearchParams(filters?: ProductFilters, options?: { omit?: string[] }): URLSearchParams;
export function toggleFilter(filters: ProductFilters, group: 'attr' | 'opt' | 'brand', code: string | null, value: string): ProductFilters;
export function setFilter<K extends keyof ProductFilters>(filters: ProductFilters, key: K, value: ProductFilters[K] | undefined): ProductFilters;
export function isSelected(filters: ProductFilters, group: 'attr' | 'opt' | 'brand', code: string | null, value: string): boolean;
export function activeFilterCount(filters?: ProductFilters): number;

/* ── Para ────────────────────────────────────────────────────── */

export const CURRENCY_SYMBOLS: Record<string, string>;
export function formatMoney(value: Money | number | null | undefined, currency?: string, options?: { locale?: string; minor?: number; hideZeroDecimals?: boolean }): string;
export function toMajor(amount: number | null | undefined, minor?: number): number | '';
export function toMinor(value: string | number | null | undefined, minor?: number): number | null;
export function discountPercent(price: Money | number, compareAt: Money | number | null | undefined): number | null;
export function formatTaxRate(bp: number): string;

/* ── Varyantlar ──────────────────────────────────────────────── */

export type Selection = Record<string, string>;
export function isVariable(product: ProductDetail): boolean;
export function initialSelection(product: ProductDetail): Selection;
export function isComplete(product: ProductDetail, selection: Selection): boolean;
export function findVariant(product: ProductDetail, selection: Selection): Variant | null;
export function valueState(product: ProductDetail, selection: Selection, code: string, value: string): { exists: boolean; inStock: boolean };
export function selectValue(product: ProductDetail, selection: Selection, code: string, value: string): Selection;
export function galleryFor(product: ProductDetail, selection: Selection): Image[];
export function priceFor(product: ProductDetail, selection: Selection): { price: Money; compare_at_price: Money | null; discount_percent: number | null; range: { min: Money; max: Money } | null };
export function inStockFor(product: ProductDetail, selection: Selection): boolean;
export function selectionTitle(product: ProductDetail, selection: Selection): string;

/* ── Sepet / sipariş ─────────────────────────────────────────── */

export function itemCount(totals: CartTotals | null | undefined): number;
export function isEmpty(totals: CartTotals | null | undefined): boolean;
export function freeShippingRemaining(totals: CartTotals | null | undefined, promotions?: PublicPromotion[]): { remaining: number; threshold: number; label: string; progress: number } | null;
export function cartIssues(totals: CartTotals | null | undefined): string[];
export function lineIssue(totals: CartTotals | null | undefined, itemId: number): string | null;
export const ORDER_STATUS_TONE: Record<string, string>;
export function orderProgress(order: Order): 0 | 1 | 2 | 3;
export function awaitsOnlinePayment(order: Order): boolean;
export function awaitsBankTransfer(order: Order): boolean;
export function returnableLines(order: Order): Array<OrderItem & { returnable: number }>;

/* ── Ödeme ───────────────────────────────────────────────────── */

export const PAYTR_IFRAME_RESIZER: string;
export function normalizePaymentAction(action: PaymentAction | null | undefined): PaymentAction | null;
export function shouldPollPayment(order: Order): boolean;
export function paymentSecondsLeft(order: Order, now?: number): number | null;

/* ── Sabitler ────────────────────────────────────────────────── */

export const RETURN_REASONS: {
    damaged: string;
    wrong_item: string;
    not_as_described: string;
    size: string;
    changed_mind: string;
    other: string;
};
export const SHOP_COOKIES: { cart: string; customer: string; currency: string; lastOrder: string };
