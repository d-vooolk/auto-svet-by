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

/** Адреса разделов приходят с конечным слешем, здесь он лишний. */
function trim(path: string): string {
  return path.length > 1 ? path.replace(/\/$/, "") : path;
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
  categoryPaths: string[],
  previous?: { slug?: string; categoryPaths?: string[] },
): void {
  const paths = new Set(SHARED);

  paths.add(`/product/${slug}`);
  for (const path of categoryPaths) paths.add(trim(path));

  if (previous?.slug && previous.slug !== slug) {
    paths.add(`/product/${previous.slug}`);
  }
  // Раздел у товара сменился: старая страница раздела и страница его
  // родителя тоже пересобираются — там поменялись состав и счётчик.
  for (const path of previous?.categoryPaths ?? []) paths.add(trim(path));

  revalidateAll(paths);
}

/**
 * Раздел создали, изменили или удалили.
 *
 * `paths` — адреса всего затронутого поддерева (categorySubtreePaths):
 * сам раздел, его родитель и его подразделы. Slug родителя входит в адрес
 * каждого подраздела, поэтому переименование задевает их все.
 */
export function revalidateCategory(
  paths: string[],
  previousPaths: string[] = [],
): void {
  const all = new Set(SHARED);
  for (const path of [...paths, ...previousPaths]) all.add(trim(path));

  // Название и порядок раздела стоят в меню, а оно в общем макете —
  // страницы товаров тоже надо пересобрать.
  revalidatePath("/product/[slug]", "page");
  revalidateAll(all);
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
