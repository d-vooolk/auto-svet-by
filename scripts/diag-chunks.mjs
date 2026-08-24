import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const OUT = path.join(process.cwd(), "out");
const page = process.argv[2] ?? "product/osram-night-breaker-200/index.html";
const text = fs.readFileSync(path.join(OUT, page), "utf8");

const assets = [
  ...new Set(
    [...text.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g)].map(
      (m) => m[1],
    ),
  ),
];

console.log(`\n${page}\n`);
for (const asset of assets) {
  const file = path.join(OUT, asset);
  if (!fs.existsSync(file)) {
    console.log(`   ??? ${asset}`);
    continue;
  }
  const body = fs.readFileSync(file, "utf8");
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
