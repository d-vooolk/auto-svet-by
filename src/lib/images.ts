import fs from "node:fs";
import path from "node:path";

import type { ImageEntry, ImageMap } from "./image-types";

/**
 * Доступ к манифесту, который сгенерировал scripts/images.mjs.
 *
 * Читается с диска, а не через import: манифест содержит base64 размытых
 * заглушек, весит немало и полностью пересобирается из ./media — держать его
 * в репозитории ради того, чтобы TypeScript нашёл модуль, не хочется.
 *
 * Модуль серверный, работает только на сборке. Клиентским компонентам
 * манифест целиком не отдаём — иначе он уедет в бандл; вместо этого страница
 * передаёт им ровно нужные записи (см. pickImages).
 */

const MANIFEST_PATH = path.join(
  process.cwd(),
  "src",
  "generated",
  "images.json",
);

let manifest: ImageMap | null = null;

function load(): ImageMap {
  if (manifest) return manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ImageMap;
  } catch {
    // Препроцессор ещё не запускался — работаем без картинок, вместо них
    // покажутся заглушки. Сборку из-за этого валить не за что.
    manifest = {};
  }
  return manifest;
}

export function getImage(imagePath: string | undefined): ImageEntry | null {
  if (!imagePath) return null;
  return load()[imagePath] ?? null;
}

/** Подмножество манифеста для передачи в клиентский компонент пропсом. */
export function pickImages(paths: string[]): ImageMap {
  const all = load();
  const map: ImageMap = {};
  for (const imagePath of paths) {
    const entry = all[imagePath];
    if (entry) map[imagePath] = entry;
  }
  return map;
}
