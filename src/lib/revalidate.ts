import { revalidatePath } from "next/cache";

/**
 * Пересборка страниц витрины после правки в админке.
 *
 * Страницы товаров и разделов кешируются готовым HTML — именно поэтому сайт
 * остался быстрым после отказа от статического экспорта. Обратная сторона:
 * сохранённый товар не появится на витрине сам, кеш нужно сбросить явно.
 *
 * Сбрасываем точечно, а не всё подряд: у страницы товара из четырёхсот
 * позиций нет причин пересобираться из-за правки соседней. Исключение —
 * настройки сайта: телефон и меню стоят в общем макете, поэтому там честно
 * сбрасывается всё.
 */

/** Адреса, которые зависят от каталога целиком. */
const SHARED = [
  "/", // блок «Выбирают чаще всего»
  "/catalog", // плитка разделов со счётчиками товаров
  "/sitemap.xml",
  "/variants.json", // прайс, по которому корзина сверяет цены
  "/search-index.json", // индекс поиска
];

function revalidateAll(paths: Iterable<string>): void {
  for (const path of paths) revalidatePath(path);
}

/**
 * Товар создали, изменили или удалили.
 *
 * `previous` — адреса, по которым товар был доступен до правки. Если поменяли
 * slug или перенесли товар в другой раздел, старую страницу тоже надо
 * пересобрать, иначе она останется висеть с прежним содержимым.
 */
export function revalidateProduct(
  slug: string,
  categorySlug: string | undefined,
  previous?: { slug?: string; categorySlug?: string },
): void {
  const paths = new Set(SHARED);

  paths.add(`/product/${slug}`);
  if (categorySlug) paths.add(`/catalog/${categorySlug}`);

  if (previous?.slug && previous.slug !== slug) {
    paths.add(`/product/${previous.slug}`);
  }
  if (previous?.categorySlug && previous.categorySlug !== categorySlug) {
    paths.add(`/catalog/${previous.categorySlug}`);
  }

  revalidateAll(paths);
}

/** Раздел создали, изменили или удалили. */
export function revalidateCategory(
  slug: string,
  previousSlug?: string,
): void {
  const paths = new Set(SHARED);
  paths.add(`/catalog/${slug}`);
  if (previousSlug && previousSlug !== slug) {
    paths.add(`/catalog/${previousSlug}`);
  }

  // Название и порядок раздела стоят в меню, а оно в общем макете —
  // страницы товаров тоже надо пересобрать.
  revalidatePath("/product/[slug]", "page");
  revalidateAll(paths);
}

/**
 * Настройки сайта: телефон, доставка, тексты страниц.
 *
 * Здесь сбрасываем всё под корневым макетом — телефон в шапке и подвале стоит
 * буквально на каждой странице, перечислять их поимённо бессмысленно.
 */
export function revalidateSite(): void {
  revalidatePath("/", "layout");
}

/** Фотографию заменили или удалили — она может стоять где угодно. */
export function revalidateImages(): void {
  revalidatePath("/", "layout");
}
