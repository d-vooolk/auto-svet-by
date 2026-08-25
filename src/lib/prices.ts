import { getProducts } from "./catalog";
import { allSelections, resolveVariant, variantKey } from "./variant";

/**
 * Прайс по всем комбинациям опций: ключ позиции корзины -> цена и наличие.
 *
 * Нужен двоим, и это принципиально один и тот же расчёт:
 *
 *  1. Корзина в браузере сверяет с ним цены, сохранённые в localStorage —
 *     корзина недельной давности не должна показывать цену, которой уже нет.
 *  2. Приём заказа пересчитывает по нему сумму. Подставить в запрос цену
 *     «1 рубль» из консоли браузера несложно, поэтому цене из запроса мы
 *     не верим — берём свою.
 *
 * Если бы эти два места считали цену по-своему, любое расхождение выглядело
 * бы как обман покупателя: на экране одна сумма, у менеджера другая.
 */

export interface VariantPrice {
  price: number;
  inStock: boolean;
}

export type PriceList = Record<string, VariantPrice>;

export function buildPriceList(): PriceList {
  const prices: PriceList = {};

  for (const product of getProducts()) {
    if (!product.optionGroups.length) {
      const variant = resolveVariant(product, {});
      prices[variantKey(product.id, {})] = {
        price: variant.price,
        inStock: variant.inStock,
      };
      continue;
    }

    for (const selection of allSelections(product)) {
      const variant = resolveVariant(product, selection);
      prices[variant.key] = {
        price: variant.price,
        inStock: variant.inStock,
      };
    }
  }

  return prices;
}
