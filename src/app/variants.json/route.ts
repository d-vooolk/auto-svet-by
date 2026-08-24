import { getProducts } from "@/lib/catalog";
import { allSelections, resolveVariant, variantKey } from "@/lib/variant";

/**
 * Карта актуальных цен по всем комбинациям опций.
 *
 * Нужна для двух вещей:
 *  1. Страница корзины сверяет с ней сохранённые в localStorage цены — корзина
 *     недельной давности не покажет цену, которой уже нет.
 *  2. Сервис заказов пересчитывает по ней сумму, прежде чем отправить её
 *     менеджеру: подставить в запрос цену «1 рубль» из консоли браузера
 *     несложно, а вот подменить этот файл на сервере — нет.
 *
 * Собирается на сборке и лежит статическим файлом в out/variants.json.
 */
export const dynamic = "force-static";

export function GET() {
  const prices: Record<string, { price: number; inStock: boolean }> = {};

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

  return Response.json(prices);
}
