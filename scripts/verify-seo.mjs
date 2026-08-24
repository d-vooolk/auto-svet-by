#!/usr/bin/env node
/**
 * Проверка собранного сайта: то, что должно быть в HTML для поиска, там есть.
 *
 * Запускать после сборки:  node scripts/verify-seo.mjs
 *
 * Смысл не в красоте отчёта, а в том, чтобы после правки шаблонов одной
 * командой убедиться: метатеги на месте, разметка товара валидная, товары
 * попали в HTML без участия JavaScript, sitemap не пустой.
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "out");

if (!fs.existsSync(OUT)) {
  console.error("Сначала соберите сайт: npm run build");
  process.exit(1);
}

let failures = 0;

function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(relative) {
  return fs.readFileSync(path.join(OUT, relative), "utf8");
}

function head(html) {
  const end = html.indexOf("</head>");
  return end === -1 ? html : html.slice(0, end);
}

function attr(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function jsonLd(html) {
  return [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ].map((match) => {
    try {
      return JSON.parse(match[1]);
    } catch {
      return { "@type": "БИТЫЙ JSON" };
    }
  });
}

/* ------------------------------ Главная ------------------------------ */

console.log("\nГлавная");
{
  const html = read("index.html");
  const h = head(html);
  check("есть <title>", /<title>[^<]{10,}<\/title>/.test(h));
  check(
    "есть description",
    attr(h, /name="description" content="([^"]{50,})"/).length > 0,
  );
  check("есть canonical", attr(h, /rel="canonical" href="([^"]+)"/).includes("http"));
  check("ровно один <h1>", (html.match(/<h1/g) ?? []).length === 1);
  const blocks = jsonLd(html);
  check(
    "разметка Store и WebSite",
    blocks.some((block) =>
      (block["@graph"] ?? []).some((node) => node["@type"] === "Store"),
    ),
    `блоков: ${blocks.length}`,
  );
}

/* ----------------------------- Категория ----------------------------- */

console.log("\nКатегория /catalog/lampy/");
{
  const html = read("catalog/lampy/index.html");
  const h = head(html);
  const description = attr(h, /name="description" content="([^"]*)"/);
  check("есть description", description.length > 50);
  check("нет двойных точек в description", !/\.\./.test(description), description.slice(0, 90));
  check("есть canonical", attr(h, /rel="canonical" href="([^"]+)"/).length > 0);
  check("ровно один <h1>", (html.match(/<h1/g) ?? []).length === 1);
  // Главное: карточки лежат в HTML, а не собираются скриптом на клиенте.
  const cards = (html.match(/<article/g) ?? []).length;
  check("товары есть в HTML без JS", cards > 0, `карточек: ${cards}`);
  check(
    "разметка ItemList",
    jsonLd(html).some((block) => block["@type"] === "ItemList"),
  );
}

/* ------------------------------- Товар ------------------------------- */

console.log("\nТовар /product/osram-night-breaker-200/");
{
  const html = read("product/osram-night-breaker-200/index.html");
  const h = head(html);
  const description = attr(h, /name="description" content="([^"]*)"/);
  check("есть description", description.length > 50);
  check("нет двойных точек в description", !/\.\./.test(description), description.slice(0, 90));
  check("ровно один <h1>", (html.match(/<h1/g) ?? []).length === 1);

  const blocks = jsonLd(html);
  const product = blocks.find((block) => block["@type"] === "Product");
  check("есть разметка Product", Boolean(product));
  check(
    "у Product заполнены offers",
    Boolean(product?.offers?.lowPrice || product?.offers?.price),
    JSON.stringify(product?.offers ?? {}).slice(0, 120),
  );
  check(
    "есть разметка BreadcrumbList",
    blocks.some((block) => block["@type"] === "BreadcrumbList"),
  );
  check("нет битого JSON-LD", !blocks.some((block) => block["@type"] === "БИТЫЙ JSON"));

  // Цена варианта по умолчанию должна быть в HTML: без этого краулер и
  // пользователь с отключённым JS цены не увидят.
  check("цена варианта по умолчанию в HTML", html.includes("89,90"));
  // Все варианты цоколя тоже: это текст страницы, по нему её и найдут.
  const sockets = ["H4", "H7", "H11", "HB3", "HB4"];
  const missing = sockets.filter((socket) => !html.includes(`>${socket}<`));
  check("все цоколя в HTML", missing.length === 0, missing.join(", ") || "все");
}

/* ---------------------------- Служебное ----------------------------- */

console.log("\nСлужебные файлы");
{
  const sitemap = read("sitemap.xml");
  const urls = (sitemap.match(/<url>/g) ?? []).length;
  check("sitemap.xml не пустой", urls > 5, `адресов: ${urls}`);
  check("в sitemap нет корзины", !sitemap.includes("/cart/"));

  const robots = read("robots.txt");
  check("robots.txt ссылается на sitemap", robots.includes("sitemap.xml"));
  check("robots.txt закрывает корзину", robots.includes("/cart/"));

  const variants = JSON.parse(read("variants.json"));
  check(
    "variants.json собран",
    Object.keys(variants).length > 0,
    `вариантов: ${Object.keys(variants).length}`,
  );

  const index = JSON.parse(read("search-index.json"));
  check("search-index.json собран", index.length > 0, `товаров: ${index.length}`);
  check(
    "в индексе поиска есть подписи опций",
    index.some((entry) => entry.q.includes("h7")),
  );

  const cart = read("cart/index.html");
  check(
    "страница корзины закрыта от индексации",
    /name="robots" content="noindex/.test(head(cart)),
  );
}

console.log(
  failures === 0
    ? "\nВсё на месте.\n"
    : `\nПроблем: ${failures}. Смотрите отметки ✗ выше.\n`,
);
process.exit(failures === 0 ? 0 : 1);
