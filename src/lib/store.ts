import { bumpCatalogVersion, getDb } from "./db";
import {
  categorySchema,
  productSchema,
  siteSchema,
  type Category,
  type Product,
  type Site,
} from "./schema";

/**
 * Запись каталога. Всё, что меняет товары, категории и настройки, проходит
 * через этот модуль — и, значит, через одни и те же проверки.
 *
 * Схемы из schema.ts здесь работают вторым рубежом: формы админки и так
 * собирают правильные объекты, но Server Actions — публичные точки входа,
 * до них можно достучаться POST-запросом мимо интерфейса. Поэтому доверия
 * входным данным нет и тут.
 *
 * Каждая функция возвращает список проблем вместо исключения: админке нужно
 * показать их рядом с полями, а не белый экран с ошибкой.
 */

export type SaveResult =
  | { ok: true }
  | { ok: false; problems: string[] };

/* ------------------------------------------------------------------ */
/* Товары                                                              */
/* ------------------------------------------------------------------ */

/**
 * Сохраняет товар. `previousId` пустой при создании; при правке он совпадает
 * с product.id — идентификатор менять нельзя, он входит в ключ корзины.
 */
export function saveProduct(input: unknown, previousId?: string): SaveResult {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, problems: describe(parsed.error.issues) };
  }
  const product = parsed.data;
  const db = getDb();
  const problems: string[] = [];

  const category = db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .get(product.categoryId);
  if (!category) {
    problems.push(`Раздел «${product.categoryId}» не найден`);
  }

  const idTaken = db
    .prepare("SELECT id FROM products WHERE id = ? AND id IS NOT ?")
    .get(product.id, previousId ?? null);
  if (idTaken) {
    problems.push(`Товар с кодом «${product.id}» уже есть`);
  }

  const slugTaken = db
    .prepare("SELECT id FROM products WHERE slug = ? AND id IS NOT ?")
    .get(product.slug, previousId ?? null) as { id: string } | undefined;
  if (slugTaken) {
    problems.push(
      `Адрес «${product.slug}» уже занят товаром «${slugTaken.id}» — придумайте другой`,
    );
  }

  if (problems.length) return { ok: false, problems };

  const now = Date.now();
  db.prepare(
    `INSERT INTO products
       (id, slug, category_id, title, brand, price, in_stock, featured,
        sort_order, data, updated_at)
     VALUES
       (@id, @slug, @categoryId, @title, @brand, @price, @inStock, @featured,
        COALESCE((SELECT sort_order FROM products WHERE id = @id),
                 (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM products
                   WHERE category_id = @categoryId)),
        @data, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       slug = @slug, category_id = @categoryId, title = @title, brand = @brand,
       price = @price, in_stock = @inStock, featured = @featured,
       data = @data, updated_at = @updatedAt`,
  ).run({
    id: product.id,
    slug: product.slug,
    categoryId: product.categoryId,
    title: product.title,
    brand: product.brand ?? "",
    price: product.price,
    inStock: product.inStock ? 1 : 0,
    featured: product.featured ? 1 : 0,
    data: JSON.stringify(product),
    updatedAt: now,
  });

  bumpCatalogVersion();
  return { ok: true };
}

export function deleteProduct(id: string): void {
  getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
  bumpCatalogVersion();
}

/** Быстрые переключатели из списка товаров — без открытия карточки. */
export function setProductFlag(
  id: string,
  flag: "inStock" | "featured",
  value: boolean,
): void {
  const db = getDb();
  const row = db.prepare("SELECT data FROM products WHERE id = ?").get(id) as
    | { data: string }
    | undefined;
  if (!row) return;

  // Правим и колонку, и JSON: колонка нужна для выборок, JSON — источник
  // правды, из которого страница собирает товар.
  const product = JSON.parse(row.data) as Product;
  product[flag] = value;

  db.prepare(
    `UPDATE products
        SET ${flag === "inStock" ? "in_stock" : "featured"} = ?,
            data = ?, updated_at = ?
      WHERE id = ?`,
  ).run(value ? 1 : 0, JSON.stringify(product), Date.now(), id);

  bumpCatalogVersion();
}

/** Порядок товаров внутри раздела: список id в нужной последовательности. */
export function reorderProducts(ids: string[]): void {
  const db = getDb();
  const update = db.prepare(
    "UPDATE products SET sort_order = ? WHERE id = ?",
  );
  db.transaction(() => {
    ids.forEach((id, index) => update.run((index + 1) * 10, id));
  })();
  bumpCatalogVersion();
}

/* ------------------------------------------------------------------ */
/* Категории                                                           */
/* ------------------------------------------------------------------ */

export function saveCategory(input: unknown, previousId?: string): SaveResult {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, problems: describe(parsed.error.issues) };
  }
  const category = parsed.data;
  const db = getDb();
  const problems: string[] = [];

  const idTaken = db
    .prepare("SELECT id FROM categories WHERE id = ? AND id IS NOT ?")
    .get(category.id, previousId ?? null);
  if (idTaken) problems.push(`Раздел с кодом «${category.id}» уже есть`);

  const slugTaken = db
    .prepare("SELECT id FROM categories WHERE slug = ? AND id IS NOT ?")
    .get(category.slug, previousId ?? null) as { id: string } | undefined;
  if (slugTaken) {
    problems.push(
      `Адрес «${category.slug}» уже занят разделом «${slugTaken.id}»`,
    );
  }

  if (problems.length) return { ok: false, problems };

  db.prepare(
    `INSERT INTO categories (id, slug, name, sort_order, data, updated_at)
     VALUES (@id, @slug, @name, @order, @data, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       slug = @slug, name = @name, sort_order = @order,
       data = @data, updated_at = @updatedAt`,
  ).run({
    id: category.id,
    slug: category.slug,
    name: category.name,
    order: category.order ?? 999,
    data: JSON.stringify(category),
    updatedAt: Date.now(),
  });

  bumpCatalogVersion();
  return { ok: true };
}

/**
 * Удаление раздела. Если в нём есть товары — отказ: молча утащить за собой
 * полсотни позиций страшнее, чем заставить сначала их перенести.
 */
export function deleteCategory(id: string): SaveResult {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ?")
    .get(id) as { n: number };

  if (row.n > 0) {
    return {
      ok: false,
      problems: [
        `В разделе ещё ${row.n} товар(ов). Перенесите их в другой раздел или удалите — тогда раздел можно будет убрать.`,
      ],
    };
  }

  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  bumpCatalogVersion();
  return { ok: true };
}

export function reorderCategories(ids: string[]): void {
  const db = getDb();
  const update = db.prepare(
    "UPDATE categories SET sort_order = ? WHERE id = ?",
  );
  db.transaction(() => {
    ids.forEach((id, index) => update.run((index + 1) * 10, id));
  })();
  bumpCatalogVersion();
}

/* ------------------------------------------------------------------ */
/* Настройки сайта                                                     */
/* ------------------------------------------------------------------ */

export function saveSite(input: unknown): SaveResult {
  const parsed = siteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, problems: describe(parsed.error.issues) };
  }

  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('site', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(JSON.stringify(parsed.data));

  bumpCatalogVersion();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Служебное                                                           */
/* ------------------------------------------------------------------ */

/** Ошибки zod в вид, понятный человеку у формы. */
function describe(issues: Array<{ path: PropertyKey[]; message: string }>): string[] {
  return issues.map((issue) => {
    const where = issue.path.length ? issue.path.join(" → ") : "форма";
    return `${where}: ${issue.message}`;
  });
}

/** Списки для выпадающих меню админки — без разбора всего каталога схемой. */
export function listCategoriesBrief(): Array<{
  id: string;
  name: string;
  slug: string;
  count: number;
}> {
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.slug,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS count
         FROM categories c
        ORDER BY c.sort_order, c.name`,
    )
    .all() as Array<{ id: string; name: string; slug: string; count: number }>;
}

export interface ProductBrief {
  id: string;
  slug: string;
  title: string;
  brand: string;
  price: number;
  categoryId: string;
  inStock: boolean;
  featured: boolean;
  updatedAt: number;
  image: string | null;
}

/**
 * Список товаров для таблицы в админке. Из JSON достаётся только первое фото
 * — разбирать все шестьсот товаров схемой ради списка не нужно.
 */
export function listProducts(filter: {
  categoryId?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): { rows: ProductBrief[]; total: number } {
  const where: string[] = [];
  const params: Record<string, string | number> = {};

  if (filter.categoryId) {
    where.push("category_id = @categoryId");
    params.categoryId = filter.categoryId;
  }
  if (filter.query?.trim()) {
    where.push("(title LIKE @q OR brand LIKE @q OR id LIKE @q OR slug LIKE @q)");
    params.q = `%${filter.query.trim()}%`;
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM products ${clause}`)
      .get(params) as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT id, slug, title, brand, price, category_id, in_stock, featured,
              updated_at, json_extract(data, '$.images[0]') AS image
         FROM products ${clause}
        ORDER BY updated_at DESC
        LIMIT @limit OFFSET @offset`,
    )
    .all({
      ...params,
      limit: filter.limit ?? 50,
      offset: filter.offset ?? 0,
    }) as Array<{
    id: string;
    slug: string;
    title: string;
    brand: string;
    price: number;
    category_id: string;
    in_stock: number;
    featured: number;
    updated_at: number;
    image: string | null;
  }>;

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      brand: row.brand,
      price: row.price,
      categoryId: row.category_id,
      inStock: row.in_stock === 1,
      featured: row.featured === 1,
      updatedAt: row.updated_at,
      image: row.image,
    })),
  };
}

/** Сколько товаров выключено из продажи — для предупреждения в сводке. */
export function countOutOfStock(): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM products WHERE in_stock = 0")
      .get() as { n: number }
  ).n;
}

/** Один товар для формы правки — сырой объект, каким его отдаст страница. */
export function getProductRaw(id: string): Product | null {
  const row = getDb()
    .prepare("SELECT data FROM products WHERE id = ?")
    .get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Product) : null;
}

export function getCategoryRaw(id: string): Category | null {
  const row = getDb()
    .prepare("SELECT data FROM categories WHERE id = ?")
    .get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Category) : null;
}

export function getSiteRaw(): Site | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'site'")
    .get() as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as Site) : null;
}
