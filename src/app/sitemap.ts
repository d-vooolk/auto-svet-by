import fs from "node:fs";
import path from "node:path";

import type { MetadataRoute } from "next";

import { getCategories, getProducts } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";

/**
 * sitemap.xml. При статическом экспорте Next записывает его файлом в out/ —
 * отдельной генерации не нужно.
 *
 * Страницы корзины и подтверждения заказа сюда не попадают: индексировать в
 * них нечего (см. robots.ts).
 */

export const dynamic = "force-static";

/** Время последней правки данных — честный lastmod для страниц каталога. */
function catalogModified(): Date {
  const files = [path.join(process.cwd(), "data", "categories.json")];
  const productsDir = path.join(process.cwd(), "data", "products");
  if (fs.existsSync(productsDir)) {
    for (const name of fs.readdirSync(productsDir)) {
      if (name.endsWith(".json")) files.push(path.join(productsDir, name));
    }
  }

  let newest = 0;
  for (const file of files) {
    try {
      newest = Math.max(newest, fs.statSync(file).mtimeMs);
    } catch {
      // Файла нет — пропускаем, дата возьмётся из остальных.
    }
  }
  return newest ? new Date(newest) : new Date();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const modified = catalogModified();
  const built = new Date();

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
      lastModified: modified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...getProducts().map((product) => ({
      url: absoluteUrl(`/product/${product.slug}/`),
      lastModified: modified,
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
