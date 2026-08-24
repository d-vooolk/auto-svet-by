#!/usr/bin/env node
/**
 * Препроцессор картинок.
 *
 * При статическом экспорте встроенный оптимизатор next/image не работает —
 * он требует сервер. Поэтому все размеры и форматы генерируются здесь, один
 * раз на сборке, и уезжают на сервер обычными файлами. Для скорости это
 * лучше рантайм-оптимизатора: нет холодного старта, нет промахов кеша,
 * nginx просто отдаёт готовый файл с диска.
 *
 * Исходники:  ./media/<путь из JSON>        (сюда складываете фото как есть)
 * Результат:  ./public/img/<путь>-<ширина>.avif|webp + фолбэк .jpg
 * Манифест:   ./src/generated/images.json   (размеры + размытая заглушка)
 *
 * Повторный запуск пересобирает только то, что изменилось.
 *
 *   node scripts/images.mjs           обычный прогон
 *   node scripts/images.mjs --force   пересобрать всё заново
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA_DIR = path.join(ROOT, "media");
const OUT_DIR = path.join(ROOT, "public", "img");
const MANIFEST = path.join(ROOT, "src", "generated", "images.json");

/** Ширины под карточки (400), основное фото товара (800) и retina (1200/1600). */
const WIDTHS = [400, 800, 1200, 1600];
const FORMATS = [
  { ext: "avif", options: { quality: 52, effort: 4 } },
  { ext: "webp", options: { quality: 78, effort: 4 } },
];
/** Фолбэк для браузеров без webp/avif — один размер, больше не нужно. */
const FALLBACK_WIDTH = 800;
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length - 1));

const force = process.argv.includes("--force");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "\n[images] Не найден пакет sharp. Установите: npm install -D sharp\n",
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Сбор путей к картинкам из data/                                     */
/* ------------------------------------------------------------------ */

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`\n[images] Не удалось прочитать ${file}: ${error.message}\n`);
    process.exit(1);
  }
}

function collectPaths() {
  const paths = new Set();
  const dataDir = path.join(ROOT, "data");

  const categoriesFile = path.join(dataDir, "categories.json");
  if (fs.existsSync(categoriesFile)) {
    for (const category of readJson(categoriesFile)) {
      if (category.image) paths.add(category.image);
    }
  }

  const productsDir = path.join(dataDir, "products");
  if (fs.existsSync(productsDir)) {
    for (const name of fs.readdirSync(productsDir)) {
      if (!name.endsWith(".json")) continue;
      for (const product of readJson(path.join(productsDir, name))) {
        for (const image of product.images ?? []) paths.add(image);
        for (const group of product.optionGroups ?? []) {
          for (const value of group.values ?? []) {
            for (const image of value.images ?? []) paths.add(image);
          }
        }
      }
    }
  }

  return [...paths].sort();
}

/* ------------------------------------------------------------------ */
/* Обработка одной картинки                                            */
/* ------------------------------------------------------------------ */

function outputName(relativePath, suffix) {
  const dir = path.dirname(relativePath);
  const base = path.basename(relativePath, path.extname(relativePath));
  const name = `${base}-${suffix}`;
  return dir === "." ? name : `${dir}/${name}`;
}

/** Свежий ли результат: файл существует и новее исходника. */
function isFresh(outPath, sourceMtime) {
  if (force) return false;
  try {
    return fs.statSync(outPath).mtimeMs >= sourceMtime;
  } catch {
    return false;
  }
}

async function processImage(relativePath) {
  const source = path.join(MEDIA_DIR, relativePath);
  if (!fs.existsSync(source)) return { relativePath, missing: true };

  const sourceMtime = fs.statSync(source).mtimeMs;
  const image = sharp(source, { failOn: "error" });
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return { relativePath, missing: true };

  // Не растягиваем мелкие фото: 1200-я версия картинки шириной 900px —
  // это просто тот же файл, только тяжелее.
  const widths = WIDTHS.filter((w) => w <= width);
  if (!widths.length) widths.push(width);

  const entry = {
    w: width,
    h: height,
    blur: "",
    sources: {},
    fallback: "",
  };

  let written = 0;

  for (const format of FORMATS) {
    const variants = [];
    for (const w of widths) {
      const relativeOut = `${outputName(relativePath, w)}.${format.ext}`;
      const outPath = path.join(OUT_DIR, relativeOut);
      if (!isFresh(outPath, sourceMtime)) {
        await fsp.mkdir(path.dirname(outPath), { recursive: true });
        await sharp(source)
          .rotate() // учесть EXIF-поворот, иначе фото с телефона лежат на боку
          .resize({ width: w, withoutEnlargement: true })
          [format.ext](format.options)
          .toFile(outPath);
        written += 1;
      }
      variants.push({ w, url: `/img/${relativeOut}` });
    }
    entry.sources[format.ext] = variants;
  }

  // Фолбэк-jpeg для совсем старых браузеров.
  const fallbackWidth = Math.min(FALLBACK_WIDTH, width);
  const fallbackRelative = `${outputName(relativePath, fallbackWidth)}.jpg`;
  const fallbackPath = path.join(OUT_DIR, fallbackRelative);
  if (!isFresh(fallbackPath, sourceMtime)) {
    await fsp.mkdir(path.dirname(fallbackPath), { recursive: true });
    await sharp(source)
      .rotate()
      .resize({ width: fallbackWidth, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(fallbackPath);
    written += 1;
  }
  entry.fallback = `/img/${fallbackRelative}`;

  // Размытая заглушка инлайном в HTML: убирает «прыжок» при загрузке фото,
  // а значит и CLS — один из факторов ранжирования.
  const blur = await sharp(source)
    .rotate()
    .resize({ width: 16 })
    .webp({ quality: 30 })
    .toBuffer();
  entry.blur = `data:image/webp;base64,${blur.toString("base64")}`;

  return { relativePath, entry, written };
}

/* ------------------------------------------------------------------ */
/* Прогон                                                              */
/* ------------------------------------------------------------------ */

async function pool(items, worker, limit) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(runners);
  return results;
}

const paths = collectPaths();

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const started = Date.now();
const results = await pool(paths, processImage, CONCURRENCY);

const manifest = {};
const missing = [];
let written = 0;

for (const result of results) {
  if (!result) continue;
  if (result.missing) {
    missing.push(result.relativePath);
    continue;
  }
  manifest[result.relativePath] = result.entry;
  written += result.written;
}

await fsp.mkdir(path.dirname(MANIFEST), { recursive: true });
await fsp.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `[images] готово за ${seconds}с: ${Object.keys(manifest).length} из ${paths.length} фото, создано файлов: ${written}`,
);

if (missing.length) {
  const preview = missing.slice(0, 12);
  console.log(
    `[images] нет исходников (вместо них покажется заглушка) — ${missing.length} шт.:\n` +
      preview.map((p) => `         media/${p}`).join("\n") +
      (missing.length > preview.length
        ? `\n         …и ещё ${missing.length - preview.length}`
        : ""),
  );
}
