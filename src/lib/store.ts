import { bumpCatalogVersion, getDb } from "./db";
import { pluralize } from "./format";
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
  } else {
    // Товары живут только в листьях дерева: у раздела с подразделами
    // страница занята плиткой подразделов, товару там не показаться.
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?")
      .get(product.categoryId) as { n: number };
    if (n > 0) {
      problems.push(
        `У раздела «${product.categoryId}» есть подразделы — выберите один из них`,
      );
    }
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

/**
 * Правила дерева разделов. Проверяются при каждом сохранении.
 *
 * Их четыре, и все они про одно: дерево должно оставаться ровно
 * двухуровневым, а товары — лежать только в листьях.
 *
 * Почему товары не могут лежать в разделе с подразделами: страница такого
 * раздела показывает плитку подразделов, и товары рядом с ней оказались бы
 * ни в одном из них — попасть на них можно было бы только с этой страницы,
 * и ни в одну хлебную крошку они бы не легли.
 */
function checkParent(
  category: Category,
  previousId?: string,
  adoptProducts = false,
): string[] {
  const db = getDb();
  const problems: string[] = [];
  const id = previousId ?? category.id;

  if (category.parentId) {
    if (category.parentId === id) {
      problems.push("Раздел не может быть вложен сам в себя");
      return problems;
    }

    const parent = db
      .prepare("SELECT id, parent_id FROM categories WHERE id = ?")
      .get(category.parentId) as
      | { id: string; parent_id: string | null }
      | undefined;

    if (!parent) {
      problems.push(`Родительский раздел «${category.parentId}» не найден`);
      return problems;
    }
    if (parent.parent_id) {
      problems.push(
        "Подраздел нельзя вложить в другой подраздел — уровня всего два",
      );
    }

    const { n: inParent } = db
      .prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ?")
      .get(parent.id) as { n: number };
    if (inParent > 0 && !adoptProducts) {
      problems.push(
        `В разделе «${parent.id}» лежит ${pluralize(inParent, "товар", "товара", "товаров")}. ` +
          "Товары могут лежать только в разделах без подразделов — перенесите их в этот подраздел или в другой раздел.",
      );
    }

    const { n: children } = db
      .prepare("SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?")
      .get(id) as { n: number };
    if (children > 0) {
      problems.push(
        "У раздела есть свои подразделы — его нельзя сделать подразделом",
      );
    }
  }

  return problems;
}

/**
 * Сохранение раздела.
 *
 * `adoptProducts` — забрать товары родителя в этот подраздел. Без такой
 * возможности первый подраздел в непустом разделе создать невозможно:
 * товары нельзя оставить в родителе, но и перенести их некуда — подраздела
 * ещё нет. Замкнутый круг, в который упирается любой, кто решил разбить
 * разросшийся раздел на части.
 */
export function saveCategory(
  input: unknown,
  previousId?: string,
  adoptProducts = false,
): SaveResult {
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

  problems.push(...checkParent(category, previousId, adoptProducts));

  if (problems.length) return { ok: false, problems };

  const adopted =
    adoptProducts && category.parentId
      ? (db
          .prepare("SELECT id, data FROM products WHERE category_id = ?")
          .all(category.parentId) as Array<{ id: string; data: string }>)
      : [];

  const save = db.prepare(
    `INSERT INTO categories (id, slug, name, parent_id, sort_order, data, updated_at)
     VALUES (@id, @slug, @name, @parentId, @order, @data, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       slug = @slug, name = @name, parent_id = @parentId, sort_order = @order,
       data = @data, updated_at = @updatedAt`,
  );

  const move = db.prepare(
    "UPDATE products SET category_id = ?, data = ?, updated_at = ? WHERE id = ?",
  );
  const now = Date.now();

  // Одной транзакцией: подраздел, забравший товары наполовину, оставил бы
  // родителя с подразделом и товарами разом — то есть в состоянии, которого
  // все эти проверки и не допускают.
  db.transaction(() => {
    save.run({
      id: category.id,
      slug: category.slug,
      name: category.name,
      parentId: category.parentId ?? null,
      order: category.order ?? 999,
      data: JSON.stringify(category),
      updatedAt: now,
    });

    for (const row of adopted) {
      const product = JSON.parse(row.data) as Product;
      product.categoryId = category.id;
      move.run(category.id, JSON.stringify(product), now, row.id);
    }
  })();

  bumpCatalogVersion();
  return { ok: true };
}

/**
 * Удаление раздела. Если в нём есть товары — отказ: молча утащить за собой
 * полсотни позиций страшнее, чем заставить сначала их перенести.
 */
/**
 * Удаление раздела.
 *
 * `moveTo` — раздел, в который уедут товары. Без него раздел с товарами не
 * удаляется: товар без существующего раздела пропадает из меню и с витрины,
 * но остаётся в базе — искать его потом негде.
 *
 * Подразделы удаляемого раздела поднимаются на верхний уровень. Их адреса
 * при этом укорачиваются, о чём админка предупреждает до удаления.
 *
 * Перенос и удаление идут одной транзакцией: если раздел исчезнет, а товары
 * переехать не успеют, они как раз и окажутся в этом подвешенном состоянии.
 */
export function deleteCategory(id: string, moveTo?: string): SaveResult {
  const db = getDb();
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM products WHERE category_id = ?")
    .get(id) as { n: number };

  if (n > 0) {
    if (!moveTo) {
      return {
        ok: false,
        problems: [
          `В разделе ещё ${pluralize(n, "товар", "товара", "товаров")}. Укажите, в какой раздел их перенести.`,
        ],
      };
    }
    if (moveTo === id) {
      return { ok: false, problems: ["Перенести товары можно только в другой раздел"] };
    }
    const target = db
      .prepare("SELECT id FROM categories WHERE id = ?")
      .get(moveTo) as { id: string } | undefined;
    if (!target) {
      return { ok: false, problems: ["Раздел, в который переносим товары, не найден"] };
    }
    const { n: targetChildren } = db
      .prepare("SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?")
      .get(moveTo) as { n: number };
    if (targetChildren > 0) {
      return {
        ok: false,
        problems: [
          "У раздела, в который переносим, есть подразделы — выберите один из них",
        ],
      };
    }
  }

  const products = db
    .prepare("SELECT id, data FROM products WHERE category_id = ?")
    .all(id) as Array<{ id: string; data: string }>;

  // Подразделы удаляемого раздела поднимаются на верхний уровень вместе со
  // своими товарами. Других вариантов у них нет: вложить их в чужой раздел
  // — решение за админа, а удалить вместе с родителем значило бы потерять
  // товары, о которых никто не спрашивал.
  const children = db
    .prepare("SELECT id, data FROM categories WHERE parent_id = ?")
    .all(id) as Array<{ id: string; data: string }>;

  // Правим и колонку, и JSON: по колонке идут выборки, а JSON — источник
  // правды, из которого страница собирает товар.
  const move = db.prepare(
    "UPDATE products SET category_id = ?, data = ?, updated_at = ? WHERE id = ?",
  );
  const now = Date.now();

  const promote = db.prepare(
    "UPDATE categories SET parent_id = NULL, data = ?, updated_at = ? WHERE id = ?",
  );

  db.transaction(() => {
    for (const row of products) {
      const product = JSON.parse(row.data) as Product;
      product.categoryId = moveTo!;
      move.run(moveTo, JSON.stringify(product), now, row.id);
    }
    for (const row of children) {
      const child = JSON.parse(row.data) as Category;
      delete child.parentId;
      promote.run(JSON.stringify(child), now, row.id);
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  })();

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
export interface CategoryBrief {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  /** Товаров непосредственно в этом разделе, без подразделов. */
  count: number;
  children: number;
}

/**
 * Плоский список разделов для админки — уже в порядке дерева: родитель,
 * следом его подразделы. Собирать иерархию в каждом шаблоне не нужно,
 * достаточно посмотреть на parentId, чтобы решить, делать ли отступ.
 */
export function listCategoriesBrief(): CategoryBrief[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.name, c.slug, c.parent_id AS parentId,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS count,
              (SELECT COUNT(*) FROM categories k WHERE k.parent_id = c.id) AS children
         FROM categories c
        ORDER BY c.sort_order, c.name`,
    )
    .all() as CategoryBrief[];

  const roots = rows.filter((row) => !row.parentId);
  return roots.flatMap((root) => [
    root,
    ...rows.filter((row) => row.parentId === root.id),
  ]);
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

/**
 * Один товар для формы правки — сырой объект, каким его отдаст страница.
 *
 * Через схему, а не голым JSON.parse с приведением типа: в схеме у полей
 * вроде optionGroups и specs стоит .default([]), и тип Product обещает, что
 * массивы на месте. В базе же лежит ровно то, что записали, — у товара без
 * опций ключа optionGroups просто нет. Приведение это скрывало, а первый же
 * обход массива падал с «undefined is not iterable», и форма отдавала 500.
 */
export function getProductRaw(id: string): Product | null {
  const row = getDb()
    .prepare("SELECT data FROM products WHERE id = ?")
    .get(id) as { data: string } | undefined;
  return row
    ? parseOrThrow(productSchema, JSON.parse(row.data), `товар ${id}`)
    : null;
}

export function getCategoryRaw(id: string): Category | null {
  const row = getDb()
    .prepare("SELECT data FROM categories WHERE id = ?")
    .get(id) as { data: string } | undefined;
  return row
    ? parseOrThrow(categorySchema, JSON.parse(row.data), `раздел ${id}`)
    : null;
}

export function getSiteRaw(): Site | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'site'")
    .get() as { value: string } | undefined;
  return row
    ? parseOrThrow(siteSchema, JSON.parse(row.value), "настройки сайта")
    : null;
}
