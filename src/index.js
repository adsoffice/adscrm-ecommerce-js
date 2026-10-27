/**
 * @adsoffice/adscrm-ecommerce — AdsCRM E-Ticaret (Delivery) API istemcisi.
 *
 * Katalog (önbelleklenebilir, salt okunur) + sepet, checkout, online ödeme,
 * sipariş takibi, iade, müşteri hesabı ve B2B (müşteri grubu) fiyatları.
 * Site token'ı ve müşteri/sepet token'ları SUNUCUDA kalmalıdır (Next.js server
 * component / server action / route handler). Panel (Management) API'si kapsam dışıdır.
 */

export { createShop } from './client.js';

export {
    ShopError,
    ShopNotFoundError,
    ShopUnauthorizedError,
    ShopValidationError,
    ShopRateLimitError,
    ShopMaintenanceError,
    ShopNetworkError,
    isNotFound,
    isUnauthorized,
    isValidationError,
    isRateLimited,
    isMaintenance,
    errorMessage,
} from './errors.js';

export {
    SORTS,
    filtersToQuery,
    parseFilters,
    filtersToSearchParams,
    toggleFilter,
    setFilter,
    isSelected,
    activeFilterCount,
} from './filters.js';

export { CURRENCY_SYMBOLS, formatMoney, toMajor, toMinor, discountPercent, formatTaxRate } from './money.js';

export {
    isVariable,
    initialSelection,
    isComplete,
    findVariant,
    valueState,
    selectValue,
    galleryFor,
    priceFor,
    inStockFor,
    selectionTitle,
} from './variants.js';

export {
    itemCount,
    isEmpty,
    freeShippingRemaining,
    cartIssues,
    lineIssue,
    ORDER_STATUS_TONE,
    orderProgress,
    awaitsOnlinePayment,
    awaitsBankTransfer,
    returnableLines,
} from './cart.js';

export { PAYTR_IFRAME_RESIZER, normalizePaymentAction, shouldPollPayment, paymentSecondsLeft } from './payment.js';

export { RETURN_REASONS, SHOP_COOKIES } from './constants.js';
