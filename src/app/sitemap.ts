import type { MetadataRoute } from "next";

import {
  categoryUrl,
  getCategories,
  getLastModified,
  getPageDates,
  getProducts,
  getSiteModified,
} from "@/lib/catalog";
import { getImage } from "@/lib/images";
import type { Category, Product } from "@/lib/schema";
import { absoluteUrl, bigImageUrl } from "@/lib/seo";
import { allProductImages } from "@/lib/variant";

/**
 * sitemap.xml. Собирается один раз и пересобирается вместе со страницами
 * каталога, когда в админке что-то сохранили (см. src/lib/revalidate.ts).
 *
 * Страницы корзины и подтверждения заказа сюда не попадают: индексировать в
 * них нечего (см. robots.ts).
 *
 * Даты правки — настоящие, из базы. Время сборки не подставляется никуда:
 * lastmod, который меняется от каждого деплоя, поисковик перестаёт учитывать
 * вместе с честными датами товаров.
 *
 * У страниц товаров и разделов перечислены фотографии — это картиночный
 * sitemap: по нему фото попадают в поиск по картинкам, откуда в магазин
 * автосвета приходят живые люди («стекло фары гольф 7» ищут глазами).
 */

export const dynamic = "force-static";

/** Фотографии страницы — крупными версиями, как их хочет поиск. */
function imagesFor(paths: string[]): string[] {
  return paths
    .map((path) => bigImageUrl(getImage(path)))
    .filter((url): url is string => Boolean(url))
    .map((url) => absoluteUrl(url));
}

export default function sitemap(): MetadataRoute.Sitemap {
  // Дата правки у каждой страницы своя — она лежит в базе рядом с товаром.
  const dates = getPageDates();
  const modified = getLastModified();
  // Страницы, собранные из настроек магазина, меняются вместе с ними.
  const settings = getSiteModified();

  const dateFor = (url: string) => dates.get(url) ?? modified;

  const categoryEntry = (category: Category) => {
    const url = categoryUrl(category);
    const images = imagesFor(category.image ? [category.image] : []);
    return {
      url: absoluteUrl(url),
      lastModified: dateFor(url),
      changeFrequency: "weekly" as const,
      // Приоритет у подразделов ниже: они уже, и трафик по ним реже.
      priority: category.parentId ? 0.8 : 0.9,
      ...(images.length ? { images } : {}),
    };
  };

  const productEntry = (product: Product) => {
    const url = `/product/${product.slug}/`;
    const images = imagesFor(allProductImages(product));
    return {
      url: absoluteUrl(url),
      lastModified: dateFor(url),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      ...(images.length ? { images } : {}),
    };
  };

  return [
    {
      url: absoluteUrl("/"),
      // Главная показывает и товары, и тексты из настроек — берём то из
      // двух событий, которое случилось позже.
      lastModified: new Date(
        Math.max(modified.getTime(), settings.getTime()),
      ),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/catalog/"),
      lastModified: modified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    // Адрес подраздела вложенный, поэтому его собирает categoryUrl.
    ...getCategories().map(categoryEntry),
    ...getProducts().map(productEntry),
    {
      url: absoluteUrl("/delivery/"),
      lastModified: settings,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/contacts/"),
      lastModified: settings,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/about/"),
      lastModified: settings,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
