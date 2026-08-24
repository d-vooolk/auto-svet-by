import type { Metadata } from "next";

import { getSite } from "./catalog";
import { schemaPrice } from "./format";
import { getImage } from "./images";
import type { Category, Product } from "./schema";
import { allProductImages, hasAnyInStock, priceRange } from "./variant";

/**
 * SEO-обвязка: метатеги и разметка schema.org.
 *
 * Всё считается на сборке и уезжает в готовый HTML — краулеру не нужно
 * исполнять JavaScript, чтобы увидеть заголовок, описание и цену.
 */

export function absoluteUrl(path: string): string {
  const site = getSite();
  const base = site.url.replace(/\/$/, "");
  return path === "/" ? `${base}/` : `${base}${path}`;
}

/**
 * Склеивает куски описания в одну строку через точку.
 *
 * Нужно потому, что excerpt товара обычно уже заканчивается точкой, а к нему
 * дописывается цена и категория. Без этой функции получается «Комплект из 2
 * штук.. от 84,90 р.. Лампы» — именно в таком виде сниппет и попадёт в
 * выдачу.
 */
export function sentences(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part) && String(part).trim() !== "")
    .map((part) => part.trim().replace(/[.\s]+$/, ""))
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

/** Обрезает описание до длины, которую Google не отрежет многоточием. */
export function clampDescription(text: string, limit = 165): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : limit)}…`;
}

interface MetaInput {
  title: string;
  description: string;
  path: string;
  /** Путь картинки из ./media для превью в соцсетях. */
  image?: string;
  noIndex?: boolean;
}

export function buildMetadata({
  title,
  description,
  path,
  image,
  noIndex = false,
}: MetaInput): Metadata {
  const site = getSite();
  const url = absoluteUrl(path);
  const entry = getImage(image);
  const ogImage = entry ? absoluteUrl(entry.fallback) : undefined;

  return {
    title,
    description: clampDescription(description),
    // canonical снимает вопрос дублей: /catalog/lampy/ и /catalog/lampy/?sort=price
    // для краулера станут одной страницей.
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: site.locale,
      url,
      title,
      description: clampDescription(description),
      ...(ogImage ? { images: [{ url: ogImage, width: 800 }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description: clampDescription(description),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/* ------------------------------------------------------------------ */
/* schema.org                                                          */
/* ------------------------------------------------------------------ */

/** Организация и сайт. Ставится один раз, на главной. */
export function organizationJsonLd() {
  const site = getSite();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Store",
        "@id": `${site.url}/#store`,
        name: site.name,
        legalName: site.legalName,
        description: site.description,
        url: absoluteUrl("/"),
        telephone: site.phone,
        email: site.email,
        priceRange: "10–1000 BYN",
        currenciesAccepted: site.currency,
        paymentAccepted: site.payment.join(", "),
        address: {
          "@type": "PostalAddress",
          streetAddress: site.address.street,
          addressLocality: site.address.city,
          addressRegion: site.address.region,
          postalCode: site.address.postalCode,
          addressCountry: site.address.country,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: site.geo.lat,
          longitude: site.geo.lng,
        },
        openingHours: site.workHoursSchema,
        areaServed: [
          { "@type": "City", name: "Минск" },
          { "@type": "Country", name: "Беларусь" },
        ],
        ...(site.telegram ? { sameAs: [site.telegram] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: absoluteUrl("/"),
        name: site.name,
        inLanguage: "ru",
        publisher: { "@id": `${site.url}/#store` },
      },
    ],
  };
}

/**
 * Разметка товара. У товара с опциями цена отдаётся как AggregateOffer с
 * диапазоном — иначе Google покажет в выдаче цену одного цоколя, и клиент
 * придёт на страницу с другой ценой.
 */
export function productJsonLd(product: Product, category?: Category) {
  const site = getSite();
  const range = priceRange(product);
  const inStock = hasAnyInStock(product);
  const availability = inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const images = allProductImages(product)
    .map((path) => getImage(path))
    .filter((entry) => entry !== null)
    .map((entry) => absoluteUrl(entry.fallback));

  const offer = range.varies
    ? {
        "@type": "AggregateOffer",
        lowPrice: schemaPrice(range.min),
        highPrice: schemaPrice(range.max),
        offerCount: product.optionGroups.reduce(
          (total, group) => total * group.values.length,
          1,
        ),
        priceCurrency: site.currency,
        availability,
        seller: { "@id": `${site.url}/#store` },
      }
    : {
        "@type": "Offer",
        price: schemaPrice(range.min),
        priceCurrency: site.currency,
        availability,
        itemCondition: "https://schema.org/NewCondition",
        url: absoluteUrl(`/product/${product.slug}/`),
        seller: { "@id": `${site.url}/#store` },
      };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: clampDescription(
      product.excerpt ?? product.description ?? product.title,
      300,
    ),
    ...(images.length ? { image: images } : {}),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(category ? { category: category.name } : {}),
    ...(product.specs.length
      ? {
          additionalProperty: product.specs.map((spec) => ({
            "@type": "PropertyValue",
            name: spec.name,
            value: spec.value,
          })),
        }
      : {}),
    offers: offer,
  };
}

/** Список товаров категории — помогает Google понять структуру раздела. */
export function itemListJsonLd(products: Product[], path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: absoluteUrl(path),
    numberOfItems: products.length,
    itemListElement: products.slice(0, 50).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/product/${product.slug}/`),
      name: product.title,
    })),
  };
}
