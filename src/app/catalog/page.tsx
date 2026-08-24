import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogControls, type CatalogItem } from "@/components/CatalogControls";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import {
  getBrands,
  getCategories,
  getCategoryCounts,
  getProducts,
  getSite,
} from "@/lib/catalog";
import { pluralize } from "@/lib/format";
import { buildMetadata, itemListJsonLd } from "@/lib/seo";
import { hasAnyInStock, priceRange } from "@/lib/variant";

export function generateMetadata(): Metadata {
  const site = getSite();
  const products = getProducts();
  return buildMetadata({
    title: `Каталог автосвета — ${pluralize(products.length, "товар", "товара", "товаров")} в наличии`,
    description: `Полный каталог ${site.name}: линзы, стёкла фар, лампы, блоки розжига и аксессуары. Доставка по Минску и Беларуси, оплата при получении.`,
    path: "/catalog/",
  });
}

export default function CatalogPage() {
  const site = getSite();
  const categories = getCategories();
  const counts = getCategoryCounts();
  const products = getProducts();
  const brands = getBrands();

  const items: CatalogItem[] = products.map((product, position) => ({
    id: product.id,
    brand: product.brand ?? "",
    price: priceRange(product).min,
    inStock: hasAnyInStock(product),
    order: position,
  }));

  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: "Каталог" }]} />
      <JsonLd data={itemListJsonLd(products, "/catalog/")} />

      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          Каталог автосвета
        </h1>
        <p className="mt-2.5 max-w-2xl text-base text-slate-600">
          {pluralize(products.length, "позиция", "позиции", "позиций")} в{" "}
          {pluralize(categories.length, "разделе", "разделах", "разделах")}.
          Подберём комплект под вашу модель — напишите её в комментарии к заказу.
        </p>
      </header>

      {/* Ссылки на разделы: и навигация, и перелинковка для краулера. */}
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Разделы каталога">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/catalog/${category.slug}/`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-brand-600 hover:text-brand-700"
          >
            {category.name}
            <span className="tnum text-xs text-slate-400">
              {counts[category.id] ?? 0}
            </span>
          </Link>
        ))}
      </nav>

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
    </div>
  );
}
