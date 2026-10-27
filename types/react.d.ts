import type { Image, Money, ProductDetail, Selection, Variant } from './index';

export interface VariantSelection {
    selection: Selection;
    select(code: string, value: string): void;
    setSelection(selection: Selection): void;
    /** Tam seçimde eşleşen varyant (sepete eklenecek). */
    variant: Variant | null;
    complete: boolean;
    /** Seçime göre TAM galeri (renk değişince tüm görseller değişir). */
    gallery: Image[];
    price: { price: Money; compare_at_price: Money | null; discount_percent: number | null; range: { min: Money; max: Money } | null };
    inStock: boolean;
    /** "Kırmızı / M" */
    title: string;
    state(code: string, value: string): { exists: boolean; inStock: boolean };
}

export function useVariantSelection(product: ProductDetail, options?: { initial?: Selection }): VariantSelection;

export function useCountdown(endsAt: string | Date | null | undefined): {
    done: boolean;
    total: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
} | null;

export function useMoney(locale?: string): (value: Money | number | null | undefined, currency?: string) => string;
