import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { ProductPurchase } from "@/components/ProductPurchase";
import {
  getCategoryById,
  getProductBySlug,
  getProducts,
  getRelatedProducts,
  getSite,
} from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { pickImages } from "@/lib/images";
import { buildMetadata, productJsonLd, sentences } from "@/lib/seo";
import { allProductImages, priceRange } from "@/lib/variant";

export function generateStaticParams() {
  return getProducts().map((product) => ({ slug: product.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};

  const site = getSite();
  const range = priceRange(product);
  const category = getCategoryById(product.categoryId);

  // В title входит цена: в выдаче такой сниппет заметно кликабельнее.
  const priceLabel = range.varies
    ? `от ${formatPrice(range.min, site.currencySymbol)}`
    : formatPrice(range.min, site.currencySymbol);

  return buildMetadata({
    title: product.seoTitle ?? `${product.title} — ${priceLabel}`,
    description:
      product.seoDescription ??
      sentences(
        product.excerpt ?? product.title,
        priceLabel,
        category && `${category.name} с доставкой по Минску и Беларуси`,
        "Оплата при получении",
      ),
    path: `/product/${product.slug}/`,
    image: product.images[0],
  });
}

/** Короткая строка о доставке для блока рядом с кнопкой заказа. */
function deliveryNote(): string {
  const site = getSite();
  const minsk = site.delivery.methods.find((method) => method.id === "minsk");
  if (!minsk) return "Доставка по Минску и Беларуси.";
  const free = minsk.freeFrom
    ? ` Бесплатно от ${formatPrice(minsk.freeFrom, site.currencySymbol)}.`
    : "";
  return `Доставка по Минску — ${formatPrice(minsk.price, site.currencySymbol)}.${free} Самовывоз бесплатно.`;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const site = getSite();
  const category = getCategoryById(product.categoryId);
  const related = getRelatedProducts(product);

  // В клиентский компонент уходят записи манифеста только для фото этого
  // товара — включая галереи всех опций, чтобы переключение цоколя работало
  // без дополнительных запросов.
  const images = pickImages(allProductImages(product));

  return (
    <div className="container-page">
      <Breadcrumbs
        items={[
          { label: "Каталог", href: "/catalog/" },
          ...(category
            ? [{ label: category.name, href: `/catalog/${category.slug}/` }]
            : []),
          { label: product.title },
        ]}
      />
      <JsonLd data={productJsonLd(product, category)} />

      <header className="mb-7">
        {product.brand && (
          <p className="mb-1.5 text-sm font-medium tracking-wide text-slate-500 uppercase">
            {product.brand}
          </p>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-[2.5rem] lg:leading-tight">
          {product.title}
        </h1>
        {product.excerpt && (
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            {product.excerpt}
          </p>
        )}
      </header>

      <ProductPurchase
        product={product}
        images={images}
        currencySymbol={site.currencySymbol}
        deliveryNote={deliveryNote()}
        warranty={site.warranty}
      />

      {/* -------------------- Описание и характеристики ------------------ */}
      <div className="mt-14 grid gap-10 border-t border-slate-200 pt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        {product.description && (
          <section className="prose-shop">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Описание</h2>
            {product.description.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        )}

        {product.specs.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-900">
              Характеристики
            </h2>
            <dl className="card divide-y divide-slate-100 overflow-hidden">
              {product.specs.map((spec) => (
                <div
                  key={spec.name}
                  className="flex items-baseline justify-between gap-4 px-4 py-3"
                >
                  <dt className="text-sm text-slate-500">{spec.name}</dt>
                  <dd className="text-right text-sm font-medium text-slate-900">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      {/* ------------------------- Похожие товары ----------------------- */}
      {related.length > 0 && (
        <section className="mt-14 border-t border-slate-200 pt-10">
          <h2 className="mb-6 text-xl font-bold text-slate-900 sm:text-2xl">
            Смотрите также
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                currencySymbol={site.currencySymbol}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
