import { catalogVersion, getDb } from "./db";
import {
  parseOrThrow,
  productSchema,
  categorySchema,
  siteSchema,
  type Category,
  type Product,
  type Site,
} from "./schema";

/**
 * Чтение каталога из базы.
 *
 * Раньше здесь читались файлы ./data/*.json. Формат данных при переезде не
 * изменился: в колонке `data` лежит ровно тот же объект товара, что лежал в
 * JSON, и проверяется он той же схемой из schema.ts. Поэтому админка и файлы
 * описывают одно и то же, а `scripts/import-data.mjs` умеет переливать одно
 * в другое.
 *
 * Функции остались синхронными — драйвер SQLite синхронный. Благодаря этому
 * все страницы и компоненты, написанные под чтение с диска, работают без
 * единой правки.
 */

interface Catalog {
  site: Site;
  categories: Category[];
  products: Product[];
  /** Значение счётчика правок, при котором собран этот снимок. */
  version: number;
}

let cache: Catalog | null = null;

interface ProductRow {
  data: string;
}

interface CategoryRow {
  data: string;
}

/**
 * Снимок каталога целиком. Собирается заново только если после прошлого раза
 * что-то сохранили в админке: catalogVersion() — это один короткий запрос,
 * а разбор шести сотен товаров схемой — уже заметная работа.
 */
function load(): Catalog {
  const version = catalogVersion();
  if (cache && cache.version === version) return cache;

  const db = getDb();

  const siteRow = db
    .prepare("SELECT value FROM settings WHERE key = 'site'")
    .get() as { value: string } | undefined;

  if (!siteRow) {
    throw new Error(
      "\n\nВ базе нет настроек сайта — похоже, она ещё пустая.\n" +
        "Залейте начальные данные: npm run import\n",
    );
  }

  const site = parseOrThrow(
    siteSchema,
    JSON.parse(siteRow.value),
    "настройки сайта (таблица settings)",
  );

  const categoryRows = db
    .prepare("SELECT data FROM categories ORDER BY sort_order, name")
    .all() as CategoryRow[];

  const categories = categoryRows.map((row, index) =>
    parseOrThrow(
      categorySchema,
      JSON.parse(row.data),
      `категория №${index + 1} (таблица categories)`,
    ),
  );

  const productRows = db
    .prepare(
      `SELECT p.data FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY c.sort_order, p.sort_order, p.title`,
    )
    .all() as ProductRow[];

  const products = productRows.map((row, index) =>
    parseOrThrow(
      productSchema,
      JSON.parse(row.data),
      `товар №${index + 1} (таблица products)`,
    ),
  );

  cache = { site, categories, products, version };
  return cache;
}

/**
 * Сбросить снимок принудительно. Нужен импортёру и тестам, которые правят
 * базу в обход админки и потому не двигают счётчик версий.
 */
export function invalidateCatalog(): void {
  cache = null;
}

export function getSite(): Site {
  return load().site;
}

export function getCategories(): Category[] {
  return load().categories;
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return load().categories.find((c) => c.slug === slug);
}

export function getCategoryById(id: string): Category | undefined {
  return load().categories.find((c) => c.id === id);
}

export function getProducts(): Product[] {
  return load().products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return load().products.find((p) => p.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return load().products.find((p) => p.id === id);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return load().products.filter((p) => p.categoryId === categoryId);
}

export function getFeaturedProducts(limit = 8): Product[] {
  const products = load().products;
  const featured = products.filter((p) => p.featured);
  // Если хитов не отмечено — не показываем пустой блок, берём начало каталога.
  return (featured.length ? featured : products).slice(0, limit);
}

/** Товары той же категории, кроме текущего. Для блока «Похожие товары». */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return load()
    .products.filter(
      (p) => p.categoryId === product.categoryId && p.id !== product.id,
    )
    .slice(0, limit);
}

/** Сколько товаров в категории — для счётчиков в меню и на главной. */
export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of load().products) {
    counts[product.categoryId] = (counts[product.categoryId] ?? 0) + 1;
  }
  return counts;
}

/** Уникальные бренды категории — для фильтра. */
export function getBrands(categoryId?: string): string[] {
  const products = categoryId
    ? getProductsByCategory(categoryId)
    : getProducts();
  const brands = new Set<string>();
  for (const product of products) {
    if (product.brand) brands.add(product.brand);
  }
  return [...brands].sort((a, b) => a.localeCompare(b, "ru"));
}

/**
 * Когда каталог правили последний раз — для lastModified в sitemap.xml.
 * Раньше эту дату брали из времени изменения JSON-файлов.
 */
export function getLastModified(): Date {
  const row = getDb()
    .prepare(
      `SELECT MAX(updated_at) AS at FROM (
         SELECT updated_at FROM products
         UNION ALL
         SELECT updated_at FROM categories
       )`,
    )
    .get() as { at: number | null };
  return new Date(row.at ?? Date.now());
}

/**
 * Даты правки по адресам страниц — для честного lastmod в sitemap.xml.
 *
 * Раньше на все страницы каталога шла одна дата: время изменения JSON-файла.
 * Теперь у каждого товара своя, и поисковик видит, что правился один товар,
 * а не весь каталог разом.
 */
export function getPageDates(): Map<string, Date> {
  const dates = new Map<string, Date>();

  const products = getDb()
    .prepare("SELECT slug, updated_at FROM products")
    .all() as Array<{ slug: string; updated_at: number }>;
  for (const row of products) {
    dates.set(`/product/${row.slug}/`, new Date(row.updated_at));
  }

  const categories = getDb()
    .prepare("SELECT slug, updated_at FROM categories")
    .all() as Array<{ slug: string; updated_at: number }>;
  for (const row of categories) {
    dates.set(`/catalog/${row.slug}/`, new Date(row.updated_at));
  }

  return dates;
}
