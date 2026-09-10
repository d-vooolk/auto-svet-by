import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogControls, type CatalogItem } from "@/components/CatalogControls";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import {
  categoryTrail,
  categoryUrl,
  getBrands,
  getCategoryCounts,
  getChildCategories,
  getProductsInCategory,
  getSite,
} from "@/lib/catalog";
import { formatPrice, pluralize } from "@/lib/format";
import type { Category } from "@/lib/schema";
import { buildMetadata, itemListJsonLd, sentences } from "@/lib/seo";
import { hasAnyInStock, priceRange } from "@/lib/variant";

/**
 * Страница раздела — одна на оба адреса.
 *
 * Раздел верхнего уровня живёт по /catalog/lampy/, подраздел — по
 * /catalog/aksessuary/maski/. Это разные роуты, но страница у них одна и та
 * же, и расходиться им незачем: разойдясь, они разойдутся молча, и заметит
 * это не разработчик, а поисковик.
 *
 * Разница только в содержимом: у раздела с подразделами вместо сетки
 * товаров плитка подразделов. Своих товаров у такого раздела не бывает —
 * store.ts не даёт их туда положить.
 */

export function categoryMetadata(category: Category): Metadata {
  const site = getSite();
  const products = getProductsInCategory(category.id);
  const children = getChildCategories(category.id);
  const cheapest = products.length
    ? Math.min(...products.map((product) => priceRange(product).min))
    : 0;

  return buildMetadata({
    title: category.seoTitle ?? `${category.name} купить в Минске — ${site.name}`,
    description:
      category.seoDescription ??
      sentences(
        category.excerpt ?? category.name,
        children.length > 0 &&
          `Разделы: ${children.map((child) => child.name).join(", ")}`,
        products.length > 0 &&
          `${pluralize(products.length, "позиция", "позиции", "позиций")} в наличии, цены от ${formatPrice(cheapest, site.currencySymbol)}`,
        "Доставка по Минску и Беларуси, оплата при получении",
      ),
    path: categoryUrl(category),
    image: category.image,
  });
}

export function CategoryView({ category }: { category: Category }) {
  const site = getSite();
  const url = categoryUrl(category);
  const children = getChildCategories(category.id);
  const counts = getCategoryCounts();

  // Товары подразделов входят в выдачу родителя: у самого родителя их нет,
  // и без них его страница была бы пустой в разметке ItemList.
  const products = getProductsInCategory(category.id);
  const brands = getBrands(category.id);

  const items: CatalogItem[] = products.map((product, position) => ({
    id: product.id,
    brand: product.brand ?? "",
    price: priceRange(product).min,
    inStock: hasAnyInStock(product),
    order: position,
  }));

  return (
    <div className="container-page">
      <Breadcrumbs
        items={[
          { label: "Каталог", href: "/catalog/" },
          // Для подраздела в крошки попадает и родитель — иначе с него
          // некуда вернуться на уровень выше.
          ...categoryTrail(category).map((entry, index, trail) => ({
            label: entry.name,
            href: index < trail.length - 1 ? categoryUrl(entry) : undefined,
          })),
        ]}
      />
      <JsonLd data={itemListJsonLd(products, url)} />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-brand-900 sm:text-4xl">
          {category.name}
        </h1>
        {category.excerpt && (
          <p className="mt-2.5 max-w-2xl text-base text-brand-500">
            {category.excerpt}
          </p>
        )}
      </header>

      {children.length > 0 ? (
        // Раздел-витрина: показываем подразделы, а не товары. Товары видно
        // на страницах подразделов, туда же ведёт и меню.
        <nav
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-label={`Подразделы раздела «${category.name}»`}
        >
          {children.map((child) => (
            <Link
              key={child.id}
              href={categoryUrl(child)}
              className="card flex items-center justify-between gap-3 p-5 transition-colors hover:border-brand-600"
            >
              <span>
                <span className="block text-base font-semibold text-brand-900">
                  {child.name}
                </span>
                {child.excerpt && (
                  <span className="mt-1 block text-sm text-brand-500">
                    {child.excerpt}
                  </span>
                )}
              </span>
              <span className="tnum shrink-0 text-sm text-brand-300">
                {counts[child.id] ?? 0}
              </span>
            </Link>
          ))}
        </nav>
      ) : products.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-base font-semibold text-brand-900">
            В этом разделе пока нет товаров
          </p>
          <p className="mt-1.5 text-sm text-brand-500">
            Позвоните — скажем, что есть в наличии под заказ.
          </p>
        </div>
      ) : (
        <CatalogControls
          items={items}
          titles={products.map((product) => product.title)}
          brands={brands}
          currencySymbol={site.currencySymbol}
        >
          {products.map((product, position) => (
            <ProductCard
              key={product.id}
              product={product}
              currencySymbol={site.currencySymbol}
              priority={position < 3}
            />
          ))}
        </CatalogControls>
      )}

      {/* Текст под сеткой, а не над ней: пользователю нужны товары сразу,
          а поисковику всё равно, где на странице лежит описание раздела. */}
      {category.description && (
        <section className="prose-shop mt-14 max-w-3xl border-t border-brand-100 pt-10">
          <h2 className="mb-3 text-xl font-semibold text-brand-900">
            О разделе «{category.name}»
          </h2>
          {category.description.split("\n\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      )}
    </div>
  );
}
