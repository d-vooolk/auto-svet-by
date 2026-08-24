#!/usr/bin/env node
/**
 * Сколько на самом деле весит страница.
 *
 * Запускать после сборки:  npm run weight
 *
 * Считает то, что реально скачает браузер при первом заходе: HTML плюс те
 * файлы CSS и JS, которые в этом HTML упомянуты. Отдельно показывает размер
 * после gzip — именно столько уйдёт по сети, потому что сжатие включено в
 * конфиге nginx.
 *
 * Ориентиры: до 100 КБ после сжатия — быстро на мобильном интернете,
 * 100–200 КБ — терпимо, выше — стоит разбираться.
 */

import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const OUT = path.join(process.cwd(), "out");

if (!fs.existsSync(OUT)) {
  console.error("Сначала соберите сайт: npm run build");
  process.exit(1);
}

const PAGES = [
  ["Главная", "index.html"],
  ["Каталог целиком", "catalog/index.html"],
  ["Категория «Лампы»", "catalog/lampy/index.html"],
  ["Товар с опциями", "product/osram-night-breaker-200/index.html"],
  ["Товар без опций", "product/osram-original-line-h7/index.html"],
  ["Корзина", "cart/index.html"],
  ["Доставка и оплата", "delivery/index.html"],
];

function kb(bytes) {
  return (bytes / 1024).toFixed(1).padStart(6);
}

function gz(buffer) {
  return gzipSync(buffer, { level: 6 }).length;
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

let worst = 0;

for (const [label, relative] of PAGES) {
  const file = path.join(OUT, relative);
  if (!fs.existsSync(file)) {
    console.log(`${label.padEnd(22)}  нет файла ${relative}`);
    continue;
  }

  const html = fs.readFileSync(file);
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
      .filter((asset) => !skipped.has(asset)),
  );

  let js = 0;
  let css = 0;
  let compressed = gz(html);

  for (const asset of assets) {
    const assetFile = path.join(OUT, asset);
    if (!fs.existsSync(assetFile)) continue;
    const buffer = fs.readFileSync(assetFile);
    if (asset.endsWith(".js")) js += buffer.length;
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
