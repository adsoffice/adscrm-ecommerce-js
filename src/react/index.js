/**
 * React yardımcıları (istemci bileşenleri). Bu kancalar API çağırmaz — ürün
 * detayı sunucuda çekilir, kancalar yalnızca seçim/sayaç gibi arayüz durumunu yönetir.
 * Sepete ekleme gibi yazma işlemleri server action ile yapılmalıdır (token sunucuda).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    findVariant,
    galleryFor,
    inStockFor,
    initialSelection,
    isComplete,
    priceFor,
    selectValue,
    selectionTitle,
    valueState,
} from '../variants.js';
import { formatMoney } from '../money.js';

/**
 * Varyant seçimi: seçim, eşleşen varyant, TAM galeri, fiyat ve değer durumları.
 *
 * ```jsx
 * const v = useVariantSelection(product);
 * v.select('renk', 'kirmizi');
 * v.gallery        // seçime göre görseller (renge göre değişir)
 * v.variant?.id    // sepete eklenecek varyant
 * v.state('beden', 'l').inStock
 * ```
 */
export function useVariantSelection(product, { initial } = {}) {
    const [selection, setSelection] = useState(() => initial ?? initialSelection(product));

    // Ürün değişince (istemci gezinmesi) seçim sıfırlanır.
    useEffect(() => {
        setSelection(initial ?? initialSelection(product));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id]);

    const select = useCallback((code, value) => setSelection((s) => selectValue(product, s, code, value)), [product]);

    return useMemo(() => ({
        selection,
        select,
        setSelection,
        variant: findVariant(product, selection),
        complete: isComplete(product, selection),
        gallery: galleryFor(product, selection),
        price: priceFor(product, selection),
        inStock: inStockFor(product, selection),
        title: selectionTitle(product, selection),
        state: (code, value) => valueState(product, selection, code, value),
    }), [product, selection, select]);
}

/**
 * Geri sayım (kampanya bitişi, online ödeme süresi):
 * `{ done, days, hours, minutes, seconds, total }` — her saniye güncellenir.
 */
export function useCountdown(endsAt) {
    const target = endsAt ? new Date(endsAt).getTime() : null;
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!target) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [target]);

    if (!target) return null;
    const total = Math.max(0, Math.floor((target - now) / 1000));
    return {
        done: total === 0,
        total,
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
    };
}

/** `formatMoney`'nin bileşen kısayolu: `const money = useMoney('tr-TR'); money(price)`. */
export function useMoney(locale = 'tr-TR') {
    return useCallback((value, currency) => formatMoney(value, currency, { locale }), [locale]);
}
