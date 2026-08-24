import Link from "next/link";

import { AddToCartButton } from "@/components/AddToCartButton";
import { Picture } from "@/components/Picture";
import { formatPrice } from "@/lib/format";
import { pickUrl } from "@/lib/image-types";
import { getImage } from "@/lib/images";
import type { Product } from "@/lib/schema";
import {
  defaultSelection,
  hasAnyInStock,
  priceRange,
  resolveVariant,
} from "@/lib/variant";

/**
 * Карточка товара. Серверный компонент: в HTML уезжает готовая разметка,
 * в бандл — только кнопка «В корзину».
 *
 * У товара с опциями цену показываем диапазоном («от 84,90 р.»), а вместо
 * кнопки даём ссылку на страницу товара: цоколь с карточки не выберешь.
 */

interface ProductCardProps {
  product: Product;
  currencySymbol: string;
  /** Для первых карточек первого экрана — грузить фото сразу, не лениво. */
  priority?: boolean;
}

export function ProductCard({
  product,
  currencySymbol,
  priority = false,
}: ProductCardProps) {
  const range = priceRange(product);
  const inStock = hasAnyInStock(product);
  const hasOptions = product.optionGroups.length > 0;

  const imagePath = product.images[0];
  const entry = getImage(imagePath);
  const href = `/product/${product.slug}/`;

  const variant = resolveVariant(product, defaultSelection(product));

  return (
    <article className="group card flex w-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-card-hover">
      <Link
        href={href}
        className="photo-bed relative block aspect-square overflow-hidden"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Picture
          entry={entry}
          alt=""
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 280px"
          priority={priority}
          className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04]"
        />
        {product.badge && inStock && (
          <span className="badge absolute top-3 left-3 bg-accent-500 text-slate-900">
            {product.badge}
          </span>
        )}
        {range.varies === false && product.oldPrice && product.oldPrice > range.max && (
          <span className="badge absolute top-3 right-3 bg-red-600 text-white">
            −{Math.round((1 - range.max / product.oldPrice) * 100)}%
          </span>
        )}
        {!inStock && (
          <span className="badge absolute top-3 left-3 bg-slate-700 text-white">
            Нет в наличии
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.brand && (
          <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
            {product.brand}
          </p>
        )}

        <h3 className="mb-2 text-[15px] leading-snug font-semibold text-slate-900">
          <Link href={href} className="hover:text-brand-700">
            {product.title}
          </Link>
        </h3>

        {hasOptions && (
          <p className="mb-2 line-clamp-1 text-xs text-slate-500">
            {product.optionGroups
              .map(
                (group) =>
                  `${group.name}: ${group.values.map((v) => v.label).join(", ")}`,
              )
              .join(" · ")}
          </p>
        )}

        {/* mt-auto прижимает цену и кнопку к низу — карточки в сетке
            выравниваются по нижнему краю независимо от длины названия. */}
        <div className="mt-auto pt-2">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="tnum text-lg font-bold text-slate-900">
              {range.varies && (
                <span className="mr-1 text-sm font-medium text-slate-500">
                  от
                </span>
              )}
              {formatPrice(range.min, currencySymbol)}
            </span>
            {!range.varies && product.oldPrice && product.oldPrice > range.max && (
              <span className="tnum text-sm text-slate-400 line-through">
                {formatPrice(product.oldPrice, currencySymbol)}
              </span>
            )}
          </div>

          {!inStock ? (
            <Link href={href} className="btn-secondary w-full">
              Подробнее
            </Link>
          ) : hasOptions ? (
            <Link href={href} className="btn-secondary w-full">
              Выбрать вариант
            </Link>
          ) : (
            <AddToCartButton
              item={{
                key: variant.key,
                productId: product.id,
                slug: product.slug,
                title: product.title,
                optionLabel: "",
                options: [],
                price: variant.price,
                unit: product.unit,
                sku: variant.sku,
                imageUrl: pickUrl(entry, 200),
              }}
            />
          )}
        </div>
      </div>
    </article>
  );
}
