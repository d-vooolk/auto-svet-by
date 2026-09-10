#!/usr/bin/env node
/**
 * Сколько на самом деле весит страница.
 *
 * Запускать против работающего сервера:
 *
 *   npm run build && npm start     (в одном окне)
 *   npm run weight                 (в другом)
 *
 * Считает то, что реально скачает браузер при первом заходе: HTML плюс те
 * файлы CSS и JS, которые в этом HTML упомянуты. Отдельно показывает размер
 * после gzip — именно столько уйдёт по сети, потому что сжатие включено в
 * конфиге nginx.
 *
 * Ориентиры: до 100 КБ после сжатия — быстро на мобильном интернете,
 * 100–200 КБ — терпимо, выше — стоит разбираться.
 *
 * Раньше скрипт считал файлы в out/. Статического экспорта больше нет,
 * поэтому и HTML, и ассеты берём у сервера по HTTP.
 */

import { gzipSync } from "node:zlib";

import { env } from "../src/lib/env.mjs";

const BASE = env("SITE_URL", "http://127.0.0.1:3000").replace(/\/$/, "");

const PAGES = [
  ["Главная", "/"],
  ["Каталог целиком", "/catalog/"],
  ["Категория «Лампы»", "/catalog/lampy/"],
  ["Товар с опциями", "/product/osram-night-breaker-200/"],
  ["Товар без опций", "/product/osram-original-line-h7/"],
  ["Корзина", "/cart/"],
  ["Доставка и оплата", "/delivery/"],
];

function kb(bytes) {
  return (bytes / 1024).toFixed(1).padStart(6);
}

function gz(buffer) {
  return gzipSync(buffer, { level: 6 }).length;
}

/**
 * Тело ответа сырыми байтами. Просим identity: нас интересует исходный
 * размер, сжимать мы будем сами и одинаковым уровнем для всех файлов.
 */
async function fetchBytes(url) {
  const response = await fetch(BASE + url, {
    headers: { "Accept-Encoding": "identity" },
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

try {
  await fetch(BASE + "/");
} catch {
  console.error(
    `Сайт не отвечает на ${BASE}\n` +
      "Запустите его в соседнем окне: npm run build && npm start",
  );
  process.exit(1);
}

console.log(
  "\n" +
    "Страница".padEnd(22) +
    "HTML".padStart(8) +
    "JS".padStart(8) +
    "CSS".padStart(8) +
    "  |" +
    "после gzip".padStart(12),
);
console.log("-".repeat(62));

// Один и тот же чанк встречается на нескольких страницах — качаем его
// один раз, иначе отчёт по семи страницам это семь скачиваний рантайма.
const assetCache = new Map();

async function asset(url) {
  if (!assetCache.has(url)) assetCache.set(url, await fetchBytes(url));
  return assetCache.get(url);
}

let worst = 0;

for (const [label, url] of PAGES) {
  const html = await fetchBytes(url);
  if (!html) {
    console.log(`${label.padEnd(22)}  не открылась: ${url}`);
    continue;
  }

  const text = html.toString("utf8");

  // Ресурсы, на которые ссылается сама страница.
  //
  // Скрипты с атрибутом noModule пропускаем: это полифилы для браузеров без
  // поддержки ES-модулей, и любой браузер, выпущенный после 2018 года, их не
  // скачивает вовсе. Если их считать, отчёт завышает вес почти на 40 КБ и
  // толкает оптимизировать то, чего в реальности никто не грузит.
  const skipped = new Set(
    [...text.matchAll(/<script[^>]*\bnoModule\b[^>]*>/gi)].flatMap((tag) => {
      const src = tag[0].match(/src="([^"]+)"/);
      return src ? [src[1]] : [];
    }),
  );

  const assets = new Set(
    [...text.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)]
      .map((match) => match[1])
      .filter((item) => !skipped.has(item)),
  );

  let js = 0;
  let css = 0;
  let compressed = gz(html);

  for (const item of assets) {
    const buffer = await asset(item);
    if (!buffer) continue;
    if (item.endsWith(".js")) js += buffer.length;
    else css += buffer.length;
    compressed += gz(buffer);
  }

  worst = Math.max(worst, compressed);

  console.log(
    label.padEnd(22) +
      kb(html.length) +
      kb(js) +
      kb(css) +
      "  |" +
      kb(compressed) +
      " КБ",
  );
}

console.log("-".repeat(62));
console.log(
  `Самая тяжёлая страница после сжатия: ${(worst / 1024).toFixed(1)} КБ` +
    (worst < 100 * 1024
      ? " — быстро даже на мобильном интернете."
      : worst < 200 * 1024
        ? " — приемлемо."
        : " — стоит разобраться, что раздулось."),
);
console.log(
  "\nФотографии сюда не входят: они грузятся лениво и в нужном под экран\n" +
    "размере, а первое фото товара — сразу, но в формате AVIF.\n",
);
