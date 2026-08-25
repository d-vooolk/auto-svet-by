#!/usr/bin/env node
/**
 * Первичное наполнение базы из ./data и ./media.
 *
 * Запускается сам перед сборкой и перед dev-сервером. Если в базе уже есть
 * разделы, скрипт молча выходит: это заливка стартовых данных, а не
 * синхронизация. После переезда источник правды — база и админка, JSON-файлы
 * остаются в репозитории как исходная заготовка.
 *
 *   npm run import           залить, если база пустая
 *   npm run import -- --force  перезалить поверх (правки в админке потеряются)
 *
 * Фотографии из ./media прогоняются через тот же конвейер, что и загрузка
 * через админку (src/lib/image-pipeline.mjs), и попадают в public/img.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { processImage } from "../src/lib/image-pipeline.mjs";
import { openDatabase } from "../src/lib/migrations.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const MEDIA_DIR = path.join(ROOT, "media");
const OUT_DIR = path.join(ROOT, "public", "img");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(ROOT, "var", "shop.db");

const force = process.argv.includes("--force");
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length - 1));

/* ------------------------------------------------------------------ */

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(
      `\n[import] Не удалось прочитать ${path.relative(ROOT, file)}:\n         ${error.message}\n`,
    );
    process.exit(1);
  }
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = openDatabase(Database, DB_PATH);

const existing = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;

if (existing > 0 && !force) {
  console.log(
    `[import] в базе уже ${existing} раздел(ов) — пропускаю. Перезалить: npm run import -- --force`,
  );
  process.exit(0);
}

if (!fs.existsSync(path.join(DATA_DIR, "site.json"))) {
  console.error(
    "\n[import] Нет файла data/site.json — заливать нечего.\n" +
      "         Если база уже наполнена через админку, это нормально: удалите\n" +
      "         вызов import из package.json или оставьте как есть.\n",
  );
  process.exit(existing > 0 ? 0 : 1);
}

/* ------------------------------------------------------------------ */
/* Каталог                                                             */
/* ------------------------------------------------------------------ */

const site = readJson(path.join(DATA_DIR, "site.json"));
const categories = readJson(path.join(DATA_DIR, "categories.json"));

const productsDir = path.join(DATA_DIR, "products");
const products = [];
if (fs.existsSync(productsDir)) {
  for (const name of fs.readdirSync(productsDir).sort()) {
    if (!name.endsWith(".json")) continue;
    const parsed = readJson(path.join(productsDir, name));
    if (!Array.isArray(parsed)) {
      console.error(`\n[import] ${name}: ожидался массив товаров\n`);
      process.exit(1);
    }
    products.push(...parsed);
  }
}

const now = Date.now();

db.transaction(() => {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('site', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(JSON.stringify(site));

  const insertCategory = db.prepare(
    `INSERT INTO categories (id, slug, name, sort_order, data, updated_at)
     VALUES (@id, @slug, @name, @order, @data, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       slug = @slug, name = @name, sort_order = @order,
       data = @data, updated_at = @updatedAt`,
  );

  for (const category of categories) {
    insertCategory.run({
      id: category.id,
      slug: category.slug,
      name: category.name,
      order: category.order ?? 999,
      data: JSON.stringify(category),
      updatedAt: now,
    });
  }

  const insertProduct = db.prepare(
    `INSERT INTO products
       (id, slug, category_id, title, brand, price, in_stock, featured,
        sort_order, data, updated_at)
     VALUES
       (@id, @slug, @categoryId, @title, @brand, @price, @inStock, @featured,
        @sortOrder, @data, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       slug = @slug, category_id = @categoryId, title = @title, brand = @brand,
       price = @price, in_stock = @inStock, featured = @featured,
       sort_order = @sortOrder, data = @data, updated_at = @updatedAt`,
  );

  // Порядок внутри раздела наследуем из файла: как товары шли в JSON, так и
  // будут идти в каталоге. Шаг 10 — чтобы потом можно было вставить между.
  const positions = new Map();

  for (const product of products) {
    const next = (positions.get(product.categoryId) ?? 0) + 10;
    positions.set(product.categoryId, next);

    insertProduct.run({
      id: product.id,
      slug: product.slug,
      categoryId: product.categoryId,
      title: product.title,
      brand: product.brand ?? "",
      price: product.price,
      inStock: product.inStock === false ? 0 : 1,
      featured: product.featured ? 1 : 0,
      sortOrder: next,
      data: JSON.stringify(product),
      updatedAt: now,
    });
  }
})();

console.log(
  `[import] каталог: ${categories.length} раздел(ов), ${products.length} товар(ов)`,
);

/* ------------------------------------------------------------------ */
/* Фотографии                                                          */
/* ------------------------------------------------------------------ */

function collectImagePaths() {
  const paths = new Set();
  for (const category of categories) {
    if (category.image) paths.add(category.image);
  }
  for (const product of products) {
    for (const image of product.images ?? []) paths.add(image);
    for (const group of product.optionGroups ?? []) {
      for (const value of group.values ?? []) {
        for (const image of value.images ?? []) paths.add(image);
      }
    }
  }
  return [...paths].sort();
}

const imagePaths = collectImagePaths();

let sharp;
if (imagePaths.length) {
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error(
      "\n[import] Не найден пакет sharp — фотографии пропускаю.\n" +
        "         Установите его и перезапустите: npm install -D sharp\n",
    );
  }
}

const done = db.prepare(
  `INSERT INTO images (path, w, h, blur, sources, fallback, bytes, created_at)
   VALUES (@path, @w, @h, @blur, @sources, @fallback, @bytes, @createdAt)
   ON CONFLICT(path) DO UPDATE SET
     w = @w, h = @h, blur = @blur, sources = @sources,
     fallback = @fallback, bytes = @bytes, created_at = @createdAt`,
);

const already = new Set(
  db.prepare("SELECT path FROM images").all().map((row) => row.path),
);

const missing = [];
let processed = 0;

async function handle(relativePath) {
  const source = path.join(MEDIA_DIR, relativePath);
  if (!fs.existsSync(source)) {
    missing.push(relativePath);
    return;
  }
  // Уже обработанное не трогаем: повторный прогон импорта не должен заново
  // жать сотни фотографий.
  if (already.has(relativePath) && !force) return;

  try {
    const result = await processImage({
      source,
      relativePath,
      outDir: OUT_DIR,
      sharp,
    });
    if (!result) {
      missing.push(relativePath);
      return;
    }
    done.run({
      path: relativePath,
      w: result.entry.w,
      h: result.entry.h,
      blur: result.entry.blur,
      sources: JSON.stringify(result.entry.sources),
      fallback: result.entry.fallback,
      bytes: result.bytes,
      createdAt: Date.now(),
    });
    processed += 1;
  } catch (error) {
    console.warn(`[import] ${relativePath}: ${error.message}`);
    missing.push(relativePath);
  }
}

async function pool(items, worker, limit) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) await worker(items[index++]);
    }),
  );
}

if (sharp && imagePaths.length) {
  await fsp.mkdir(OUT_DIR, { recursive: true });
  const started = Date.now();
  await pool(imagePaths, handle, CONCURRENCY);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[import] фото: обработано ${processed} из ${imagePaths.length} за ${seconds}с`,
  );
}

if (missing.length) {
  const preview = missing.slice(0, 12);
  console.log(
    `[import] нет исходников (вместо них покажется заглушка) — ${missing.length} шт.:\n` +
      preview.map((p) => `         media/${p}`).join("\n") +
      (missing.length > preview.length
        ? `\n         …и ещё ${missing.length - preview.length}`
        : ""),
  );
}

/* Сбрасываем кеши приложения: следующий рендер перечитает базу. */
for (const counter of ["catalog", "images"]) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`,
  ).run(`counter:${counter}`);
}

const admins = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (admins === 0) {
  console.log(
    "\n[import] Администратор ещё не создан. Заведите его:\n" +
      "         npm run admin -- --login ваш-логин\n",
  );
}

db.close();
console.log("[import] готово.");
