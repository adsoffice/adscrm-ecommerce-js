/**
 * Sepet / sipariş yardımcıları — `totals` (sepet) ve sipariş çıktısı üzerinde saf işlevler.
 */

/** Sepetteki toplam adet (hediye satırları dahil değil). */
export function itemCount(totals) {
    return (totals?.lines ?? []).filter((l) => !l.gift && l.available).reduce((sum, l) => sum + l.qty, 0);
}

/** Sepet boş mu? */
export function isEmpty(totals) {
    return !(totals?.lines ?? []).some((l) => !l.gift);
}

/**
 * Ücretsiz kargo için kalan tutar — yürürlükteki "X TL üzeri kargo bedava"
 * kampanyasından (`shop.promotions()`), yoksa null. Sepet para biriminde,
 * kampanya eşiği baz para birimindedir; para birimi farklıysa hesaplanmaz.
 */
export function freeShippingRemaining(totals, promotions = []) {
    if (!totals || totals.shipping?.free) return null;
    const promo = promotions.find((p) => p.actions?.includes('free_shipping') && p.min_subtotal && !p.first_order_only && !p.members_only);
    if (!promo || promo.min_subtotal.currency !== totals.currency) return null;
    // Kampanya koşulu indirimsiz ara toplama bakar (hediye satırları hariç).
    const current = totals.subtotal - (totals.lines ?? []).filter((l) => l.gift).reduce((s, l) => s + l.line_subtotal, 0);
    const remaining = promo.min_subtotal.amount - current;
    return remaining > 0 ? { remaining, threshold: promo.min_subtotal.amount, label: promo.label, progress: Math.min(1, current / promo.min_subtotal.amount) } : null;
}

/** Sepet sorunları (stok, satışta değil, asgari tutar) — kullanıcıya gösterilecek mesajlar. */
export function cartIssues(totals) {
    return (totals?.issues ?? []).map((i) => i.message).filter(Boolean);
}

/** Satır kimliğiyle sorun (stok aşımı) — satırın altında göstermek için. */
export function lineIssue(totals, itemId) {
    return (totals?.issues ?? []).find((i) => i.item_id === itemId)?.message ?? null;
}

/** Sipariş durumu → renk tonu (rozet). */
export const ORDER_STATUS_TONE = {
    pending_payment: 'amber', awaiting_approval: 'amber', processing: 'blue', on_hold: 'slate', shipped: 'violet',
    delivered: 'green', completed: 'green', cancelled: 'red', abandoned: 'slate', return_requested: 'amber',
    returned: 'slate', refunded: 'slate',
};

/** Sipariş durumunun müşteriye adımı (ilerleme çubuğu): 0 alındı · 1 hazırlanıyor · 2 kargoda · 3 teslim. */
export function orderProgress(order) {
    const map = { pending_payment: 0, awaiting_approval: 0, processing: 1, on_hold: 1, shipped: 2, delivered: 3, completed: 3, return_requested: 3, returned: 3, refunded: 3 };
    return map[order?.status] ?? 0;
}

/** Online ödemesi tamamlanmamış sipariş (yeniden ödeme düğmesi için). */
export function awaitsOnlinePayment(order) {
    return order?.status === 'pending_payment' && order?.payment_status !== 'paid';
}

/** Havale bekliyor ve bildirim henüz yapılmadı. */
export function awaitsBankTransfer(order) {
    return (order?.bank_accounts?.length ?? 0) > 0 && !order?.bank_transfer_submitted;
}

/** Satır başına iade edilebilir adet listesi (iade formu için). */
export function returnableLines(order) {
    const map = order?.return_policy?.returnable ?? {};
    return (order?.items ?? [])
        .map((item) => ({ ...item, returnable: Number(map[item.id] ?? 0) }))
        .filter((item) => item.returnable > 0);
}
