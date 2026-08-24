import fs from "node:fs";
import path from "node:path";

import {
  categorySchema,
  parseOrThrow,
  productSchema,
  siteSchema,
  type Category,
  type Product,
  type Site,
} from "./schema";

/**
 * Чтение каталога из ./data. Работает только на этапе сборки — сайт
 * статический, поэтому в браузер попадает уже готовый HTML, а не этот код.
 *
 * Новый файл в data/products/ подхватывается сам, править код не нужно.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_DIR = path.join(DATA_DIR, "products");

function readJson(file: string): unknown {
  const raw = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `\n\nБитый JSON в файле ${path.relative(process.cwd(), file)}\n` +
        `  ${(error as Error).message}\n\n` +
        `Скорее всего лишняя или пропущенная запятая. Проверьте файл в редакторе.\n`,
    );
  }
}

interface Catalog {
  site: Site;
  categories: Category[];
  products: Product[];
}

let cache: Catalog | null = null;

function load(): Catalog {
  if (cache) return cache;

  const site = parseOrThrow(
    siteSchema,
    readJson(path.join(DATA_DIR, "site.json")),
    "data/site.json",
  );

  const categories = parseOrThrow(
    categorySchema.array(),
    readJson(path.join(DATA_DIR, "categories.json")),
    "data/categories.json",
  ).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const productFiles = fs.existsSync(PRODUCTS_DIR)
    ? fs
        .readdirSync(PRODUCTS_DIR)
        .filter((name) => name.endsWith(".json"))
        .sort()
    : [];

  const products: Product[] = [];
  for (const name of productFiles) {
    const relative = `data/products/${name}`;
    const parsed = parseOrThrow(
      productSchema.array(),
      readJson(path.join(PRODUCTS_DIR, name)),
      relative,
    );
    products.push(...parsed);
  }

  validate(categories, products);

  cache = { site, categories, products };
  return cache;
}

/** Проверки, которые не выражаются схемой одного файла. */
function validate(categories: Category[], products: Product[]): void {
  const problems: string[] = [];

  const seen = <T>(items: T[], key: (item: T) => string, label: string) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const value = key(item);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const [value, count] of counts) {
      if (count > 1) problems.push(`${label} «${value}» встречается ${count} раза`);
    }
  };

  seen(categories, (c) => c.id, "id категории");
  seen(categories, (c) => c.slug, "slug категории");
  seen(products, (p) => p.id, "id товара");
  seen(products, (p) => p.slug, "slug товара");

  const categoryIds = new Set(categories.map((c) => c.id));
  for (const product of products) {
    if (!categoryIds.has(product.categoryId)) {
      problems.push(
        `товар «${product.id}»: categoryId «${product.categoryId}» отсутствует в data/categories.json`,
      );
    }
    for (const group of product.optionGroups) {
      seen(group.values, (v) => v.id, `товар «${product.id}», опция «${group.id}»: id значения`);
    }
    seen(
      product.optionGroups,
      (g) => g.id,
      `товар «${product.id}»: id набора опций`,
    );
  }

  if (problems.length) {
    throw new Error(
      `\n\nКаталог не сходится:\n${problems.map((p) => `  • ${p}`).join("\n")}\n`,
    );
  }
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
