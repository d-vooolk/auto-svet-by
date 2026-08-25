import fsp from "node:fs/promises";
import path from "node:path";

/**
 * Обработка одной фотографии: из исходника получаются avif/webp в нескольких
 * ширинах, jpeg-фолбэк и размытая заглушка.
 *
 * Раньше это делалось только на сборке (scripts/images.mjs) — при статическом
 * экспорте иначе было нельзя. Теперь то же самое происходит в момент загрузки
 * фото через админку: положил файл в форму — через секунду он готов.
 *
 * Файл намеренно на чистом JavaScript, а не на TypeScript: его импортируют и
 * route handler админки, и консольный скрипт импорта. Две копии одного
 * конвейера неизбежно разъехались бы по качеству и набору ширин, а разница
 * вылезла бы уже на готовых картинках.
 */

/** Ширины под карточки (400), основное фото товара (800) и retina (1200/1600). */
export const WIDTHS = [400, 800, 1200, 1600];

const FORMATS = [
  { ext: "avif", options: { quality: 52, effort: 4 } },
  { ext: "webp", options: { quality: 78, effort: 4 } },
];

/** Фолбэк для браузеров без webp/avif — один размер, больше не нужно. */
const FALLBACK_WIDTH = 800;

/** Форматы, которые принимаем на загрузку. */
export const ACCEPTED = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

/**
 * Приводит имя файла к пути, который не выведет за пределы папки с картинками.
 *
 * Проверка не косметическая: имя приходит из браузера, и «../../etc/passwd»
 * там оказаться может.
 */
export function safeImagePath(folder, filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const base = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);

  const dir = String(folder ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\.+/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .slice(0, 3)
    .join("/");

  const name = base || "photo";
  const safeExt = ACCEPTED.has(ext) ? ext : "jpg";

  return dir ? `${dir}/${name}.${safeExt}` : `${name}.${safeExt}`;
}

function outputName(relativePath, suffix) {
  const dir = path.dirname(relativePath);
  const base = path.basename(relativePath, path.extname(relativePath));
  const name = `${base}-${suffix}`;
  return dir === "." ? name : `${dir}/${name}`;
}

/**
 * Делает все варианты картинки и возвращает запись для манифеста.
 *
 * @param {object} params
 * @param {Buffer|string} params.source   буфер загруженного файла или путь к нему
 * @param {string} params.relativePath    путь вида "lamps/osram/h7-1.jpg"
 * @param {string} params.outDir          куда писать (обычно public/img)
 * @param {(source: Buffer|string, options?: object) => any} params.sharp
 * @returns {Promise<{entry: object, bytes: number}|null>} null — если это не картинка
 */
export async function processImage({ source, relativePath, outDir, sharp }) {
  const meta = await sharp(source, { failOn: "error" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) return null;

  // Не растягиваем мелкие фото: 1200-я версия картинки шириной 900px —
  // это просто тот же файл, только тяжелее.
  const widths = WIDTHS.filter((w) => w <= width);
  if (!widths.length) widths.push(width);

  const entry = { w: width, h: height, blur: "", sources: {}, fallback: "" };
  let bytes = 0;

  for (const format of FORMATS) {
    const variants = [];
    for (const w of widths) {
      const relativeOut = `${outputName(relativePath, w)}.${format.ext}`;
      // turbopackIgnore: сборщик видит путь, собранный на ходу, и на всякий
      // случай тянет в трассировку весь проект. Здесь это не нужно: outDir
      // всегда public/img, и внутрь него мы только пишем.
      const outPath = path.join(/*turbopackIgnore: true*/ outDir, relativeOut);
      await fsp.mkdir(path.dirname(outPath), { recursive: true });
      const info = await sharp(source)
        .rotate() // учесть EXIF-поворот, иначе фото с телефона лежат на боку
        .resize({ width: w, withoutEnlargement: true })
        [format.ext](format.options)
        .toFile(outPath);
      bytes += info.size ?? 0;
      variants.push({ w, url: `/img/${relativeOut}` });
    }
    entry.sources[format.ext] = variants;
  }

  const fallbackWidth = Math.min(FALLBACK_WIDTH, width);
  const fallbackRelative = `${outputName(relativePath, fallbackWidth)}.jpg`;
  const fallbackPath = path.join(/*turbopackIgnore: true*/ outDir, fallbackRelative);
  await fsp.mkdir(path.dirname(fallbackPath), { recursive: true });
  const fallbackInfo = await sharp(source)
    .rotate()
    .resize({ width: fallbackWidth, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(fallbackPath);
  bytes += fallbackInfo.size ?? 0;
  entry.fallback = `/img/${fallbackRelative}`;

  // Размытая заглушка инлайном в HTML: убирает «прыжок» при загрузке фото,
  // а значит и CLS — один из факторов ранжирования.
  const blur = await sharp(source)
    .rotate()
    .resize({ width: 16 })
    .webp({ quality: 30 })
    .toBuffer();
  entry.blur = `data:image/webp;base64,${blur.toString("base64")}`;

  return { entry, bytes };
}

/**
 * Удаляет все файлы, сделанные из одной фотографии.
 * Список берётся из записи манифеста, а не сканированием папки.
 */
export async function removeImageFiles(entry, publicDir) {
  const urls = [
    ...Object.values(entry.sources ?? {}).flatMap((variants) =>
      variants.map((variant) => variant.url),
    ),
    entry.fallback,
  ].filter(Boolean);

  for (const url of urls) {
    // url вида /img/lamps/osram/h7-1-400.avif → путь внутри public
    const relative = url.replace(/^\//, "");
    await fsp.rm(path.join(/*turbopackIgnore: true*/ publicDir, relative), {
      force: true,
    });
  }
}
