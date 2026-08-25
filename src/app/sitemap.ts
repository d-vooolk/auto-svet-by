import type { MetadataRoute } from "next";

import {
  getCategories,
  getLastModified,
  getPageDates,
  getProducts,
} from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";

/**
 * sitemap.xml. Собирается один раз и пересобирается вместе со страницами
 * каталога, когда в админке что-то сохранили (см. src/lib/revalidate.ts).
 *
 * Страницы корзины и подтверждения заказа сюда не попадают: индексировать в
 * них нечего (см. robots.ts).
 */

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // Дата правки у каждой страницы своя — она лежит в базе рядом с товаром.
  const dates = getPageDates();
  const modified = getLastModified();
  const built = new Date();

  const dateFor = (url: string) => dates.get(url) ?? modified;

  return [
    {
      url: absoluteUrl("/"),
      lastModified: built,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/catalog/"),
      lastModified: modified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...getCategories().map((category) => ({
      url: absoluteUrl(`/catalog/${category.slug}/`),
      lastModified: dateFor(`/catalog/${category.slug}/`),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...getProducts().map((product) => ({
      url: absoluteUrl(`/product/${product.slug}/`),
      lastModified: dateFor(`/product/${product.slug}/`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    {
      url: absoluteUrl("/delivery/"),
      lastModified: built,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/contacts/"),
      lastModified: built,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/about/"),
      lastModified: built,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
