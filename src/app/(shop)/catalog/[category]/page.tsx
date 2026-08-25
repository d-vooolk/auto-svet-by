import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogControls, type CatalogItem } from "@/components/CatalogControls";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import {
  getBrands,
  getCategories,
  getCategoryBySlug,
  getProductsByCategory,
  getSite,
} from "@/lib/catalog";
import { formatPrice, pluralize } from "@/lib/format";
import { buildMetadata, itemListJsonLd, sentences } from "@/lib/seo";
import { hasAnyInStock, priceRange } from "@/lib/variant";

/**
 * Страница категории — основная точка входа из поиска. Все товары раздела
 * попадают в HTML на сборке; фильтры работают поверх готовой разметки.
 */

export function generateStaticParams() {
  return getCategories().map((category) => ({ category: category.slug }));
}

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};

  const site = getSite();
  const products = getProductsByCategory(category.id);
  const cheapest = products.length
    ? Math.min(...products.map((product) => priceRange(product).min))
    : 0;

  return buildMetadata({
    title: category.seoTitle ?? `${category.name} купить в Минске — ${site.name}`,
    description:
      category.seoDescription ??
      sentences(
        category.excerpt ?? category.name,
        products.length > 0 &&
          `${pluralize(products.length, "позиция", "позиции", "позиций")} в наличии, цены от ${formatPrice(cheapest, site.currencySymbol)}`,
        "Доставка по Минску и Беларуси, оплата при получении",
      ),
    path: `/catalog/${category.slug}/`,
    image: category.image,
  });
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

  const site = getSite();
  const products = getProductsByCategory(category.id);
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
          { label: category.name },
        ]}
      />
      <JsonLd data={itemListJsonLd(products, `/catalog/${category.slug}/`)} />

      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          {category.name}
        </h1>
        {category.excerpt && (
          <p className="mt-2.5 max-w-2xl text-base text-slate-600">
            {category.excerpt}
          </p>
        )}
      </header>

      {products.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-base font-semibold text-slate-900">
            В этом разделе пока нет товаров
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
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
        <section className="prose-shop mt-14 max-w-3xl border-t border-slate-200 pt-10">
          <h2 className="mb-3 text-xl font-bold text-slate-900">
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
