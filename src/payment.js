/**
 * Online ödeme (iyzico · PayTR). Kart bilgisi sitenizden geçmez: checkout/pay
 * yanıtındaki `payment_action` müşteriyi sağlayıcıya yönlendirir ya da sağlayıcının
 * iframe'ini gösterir. Sonuç için dönüş adresindeki `status`'a GÜVENMEYİN —
 * siparişi `orders.track()` ile sorgulayın (`payment_status: 'paid'`).
 */

/** PayTR iframe yüksekliğini içeriğe uyduran resmi betik. */
export const PAYTR_IFRAME_RESIZER = 'https://www.paytr.com/js/iframeResizer.min.js';

/** `{ type: 'redirect' | 'iframe', url }` ya da null (havale/kapıda ödeme). */
export function normalizePaymentAction(action) {
    if (!action || !action.url) return null;
    return { type: action.type === 'iframe' ? 'iframe' : 'redirect', url: action.url, token: action.token ?? null };
}

/** Dönüş sayfasında sipariş henüz ödenmemiş görünüyorsa tekrar sorgulama gerekir mi? */
export function shouldPollPayment(order) {
    return order?.status === 'pending_payment' && order?.payment_status !== 'paid' && !!order?.payment_expires_at;
}

/** Ödeme süresinin bitmesine kalan saniye (online ödemede stok bu süre ayrılır). */
export function paymentSecondsLeft(order, now = Date.now()) {
    if (!order?.payment_expires_at) return null;
    return Math.max(0, Math.floor((new Date(order.payment_expires_at).getTime() - now) / 1000));
}
