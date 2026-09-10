#!/usr/bin/env node
/**
 * Что лежит внутри JS-чанков конкретной страницы.
 *
 * Дополнение к report-weight.mjs: тот показывает, что страница тяжёлая, а
 * этот — из-за чего именно. Помечает чанки, в которых нашлись библиотеки,
 * данные каталога или следы dev-сборки (последние в проде — уже ошибка).
 *
 *   npm run build && npm start                          (в одном окне)
 *   npm run chunks                                      (в другом)
 *   npm run chunks -- /catalog/lampy/                   (другая страница)
 *
 * Раньше читал файлы из out/; статического экспорта больше нет, поэтому
 * страницу и её чанки берём у сервера.
 */

import { gzipSync } from "node:zlib";

const BASE = (process.env.SITE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const page = process.argv[2] ?? "/product/osram-night-breaker-200/";

async function get(url) {
  const response = await fetch(BASE + url, {
    headers: { "Accept-Encoding": "identity" },
  });
  return response.ok ? response.text() : null;
}

const text = await get(page).catch(() => null);

if (text === null) {
  console.error(
    `Не удалось получить ${BASE}${page}\n` +
      "Сайт запущен? npm run build && npm start",
  );
  process.exit(1);
}

const assets = [
  ...new Set(
    [...text.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map(
      (m) => m[1],
    ),
  ),
];

console.log(`\n${page}\n`);
for (const asset of assets) {
  const body = await get(asset);
  if (body === null) {
    console.log(`   ??? ${asset}`);
    continue;
  }
  const size = Buffer.byteLength(body);
  const marks = [];
  for (const [needle, label] of [
    ["ZodError", "zod"],
    ["zustand", "zustand"],
    ["Night Breaker", "данные-каталога!"],
    ["react-stack-bottom-frame", "react-dom"],
    ["Warning: ", "DEV-предупреждения!"],
    ["react_devtools", "devtools-хуки"],
    ["__NEXT_DEV", "DEV-код!"],
    ["app-router", "next-router"],
    ["Turbopack", "turbopack-runtime"],
  ]) {
    if (body.includes(needle)) marks.push(label);
  }
  const gzipped = gzipSync(body, { level: 6 }).length;
  console.log(
    `   ${(size / 1024).toFixed(1).padStart(7)} КБ → gzip ${(gzipped / 1024).toFixed(1).padStart(6)} КБ  ${asset.replace("/_next/static/", "")}  ${marks.join(" ")}`,
  );
}
console.log();
