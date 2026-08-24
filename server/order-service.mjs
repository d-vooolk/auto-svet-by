#!/usr/bin/env node
/**
 * Сервис приёма заказов.
 *
 * Единственная серверная часть магазина. Слушает POST /api/order, проверяет
 * заявку, дописывает её в журнал и отправляет менеджеру в Telegram.
 * Ни базы, ни зависимостей — только встроенные модули Node.
 *
 * Почему он вообще нужен: токен бота нельзя положить в код сайта, его увидит
 * любой через инструменты разработчика. Токен живёт здесь, в переменных
 * окружения на сервере.
 *
 * Порядок действий важен: заявка сначала пишется в файл, потом уходит в
 * Telegram. Если Telegram недоступен, заказ всё равно сохранён и его можно
 * достать из журнала.
 *
 * Переменные окружения:
 *   TELEGRAM_BOT_TOKEN   токен бота от @BotFather                (обязательно)
 *   TELEGRAM_CHAT_ID     куда писать: ваш id или id группы       (обязательно)
 *   PORT                 порт, по умолчанию 8787
 *   HOST                 адрес, по умолчанию 127.0.0.1 (только через nginx)
 *   VARIANTS_FILE        путь к variants.json из сборки сайта
 *   ORDERS_LOG           путь к журналу заказов (JSONL)
 *   RATE_LIMIT           заявок с одного адреса за 10 минут, по умолчанию 5
 *
 * Запуск:  node server/order-service.mjs
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* Настройки                                                           */
/* ------------------------------------------------------------------ */

// Node умеет читать .env сам — удобно для локальной проверки. На сервере
// переменные приходят из systemd (EnvironmentFile), и файла .env там нет.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Файла нет — это нормально.
}

const CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN ?? "",
  chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "127.0.0.1",
  variantsFile:
    process.env.VARIANTS_FILE ?? path.join(process.cwd(), "out", "variants.json"),
  ordersLog: process.env.ORDERS_LOG ?? path.join(process.cwd(), "orders.jsonl"),
  rateLimit: Number(process.env.RATE_LIMIT ?? 5),
};

const MAX_BODY_BYTES = 32 * 1024;
const MAX_ITEMS = 50;
const RATE_WINDOW_MS = 10 * 60 * 1000;

if (!CONFIG.token || !CONFIG.chatId) {
  console.error(
    "\n[order] Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.\n" +
      "        Сервис запустится, но заказы будут только писаться в журнал.\n",
  );
}

/* ------------------------------------------------------------------ */
/* Актуальные цены                                                     */
/* ------------------------------------------------------------------ */

let variants = {};
let variantsMtime = 0;

/**
 * Цены перечитываются при изменении файла: после деплоя сайта сервис
 * подхватит новый прайс сам, перезапускать его не нужно.
 */
function loadVariants() {
  try {
    const stat = fs.statSync(CONFIG.variantsFile);
    if (stat.mtimeMs === variantsMtime) return;
    variants = JSON.parse(fs.readFileSync(CONFIG.variantsFile, "utf8"));
    variantsMtime = stat.mtimeMs;
    console.log(
      `[order] прайс перечитан: ${Object.keys(variants).length} вариантов`,
    );
  } catch {
    // Файла нет или он битый — проверку цен пропускаем, заявку не теряем.
  }
}

loadVariants();
setInterval(loadVariants, 60_000).unref();

/* ------------------------------------------------------------------ */
/* Ограничение частоты                                                 */
/* ------------------------------------------------------------------ */

/**
 * Два независимых счётчика, и это принципиально.
 *
 * accepted — сколько заказов с адреса принято. Здесь лимит жёсткий: пять
 * заказов за десять минут с одного человека — уже странно.
 *
 * attempts — сколько запросов вообще пришло, включая отклонённые. Лимит
 * гораздо выше, потому что отказ по валидации — это обычно живой человек,
 * который опечатался в телефоне. Если считать такие попытки вместе с
 * принятыми заказами, клиент с тремя опечатками получит блокировку на
 * десять минут и просто уйдёт.
 */
const accepted = new Map();
const attempts = new Map();

const ABUSE_LIMIT = 40;

function tooMany(store, ip, limit) {
  const now = Date.now();
  const recent = (store.get(ip) ?? []).filter(
    (time) => now - time < RATE_WINDOW_MS,
  );
  store.set(ip, recent);
  return recent.length >= limit;
}

function record(store, ip) {
  const recent = store.get(ip) ?? [];
  recent.push(Date.now());
  store.set(ip, recent);
}

// Чистим карты, чтобы они не росли бесконечно на живом сайте.
setInterval(() => {
  const now = Date.now();
  for (const store of [accepted, attempts]) {
    for (const [ip, times] of store) {
      const recent = times.filter((time) => now - time < RATE_WINDOW_MS);
      if (recent.length) store.set(ip, recent);
      else store.delete(ip);
    }
  }
}, RATE_WINDOW_MS).unref();

/* ------------------------------------------------------------------ */
/* Проверка заявки                                                     */
/* ------------------------------------------------------------------ */

function clean(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

/**
 * Возвращает { order } или { error }.
 *
 * Суммы пересчитываются по серверному прайсу: подставить в запрос цену
 * «1 рубль» из консоли браузера несложно, поэтому цене из запроса мы не
 * верим. Расхождение не отклоняет заказ, а попадает в сообщение менеджеру.
 */
function validate(payload) {
  if (typeof payload !== "object" || payload === null) {
    return { error: "Пустой запрос" };
  }

  const customer = payload.customer ?? {};
  const name = clean(customer.name, 120);
  const phone = clean(customer.phone, 40);
  const phoneDigits = clean(customer.phoneDigits, 20).replace(/\D/g, "");

  if (name.length < 2) return { error: "Не указано имя" };
  if (phoneDigits.length < 9 || phoneDigits.length > 13) {
    return { error: "Некорректный телефон" };
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { error: "Пустая корзина" };
  }
  if (payload.items.length > MAX_ITEMS) {
    return { error: "Слишком много позиций" };
  }

  const hasPrices = Object.keys(variants).length > 0;
  let serverTotal = 0;
  const notes = [];

  const items = payload.items.map((raw) => {
    const key = clean(raw.key, 200);
    const qty = Math.max(1, Math.min(99, Math.floor(Number(raw.qty) || 1)));
    const claimed = Number(raw.price) || 0;

    const actual = hasPrices ? variants[key] : undefined;
    const price = actual ? actual.price : claimed;

    if (hasPrices && !actual) {
      notes.push(`позиции «${clean(raw.title, 80)}» нет в текущем прайсе`);
    } else if (actual && Math.abs(actual.price - claimed) > 0.001) {
      notes.push(
        `«${clean(raw.title, 80)}»: в заявке ${claimed}, в прайсе ${actual.price}`,
      );
    }
    if (actual && actual.inStock === false) {
      notes.push(`«${clean(raw.title, 80)}» помечен как отсутствующий`);
    }

    serverTotal += price * qty;

    return {
      key,
      title: clean(raw.title, 200),
      options: clean(raw.options, 200),
      sku: clean(raw.sku, 60) || null,
      qty,
      price,
      sum: Math.round(price * qty * 100) / 100,
      url: clean(raw.url, 300),
    };
  });

  const delivery = payload.delivery ?? {};
  const deliveryCost = Math.max(0, Number(delivery.cost) || 0);
  const requiresAddress = clean(delivery.id, 40) !== "pickup";
  const address = clean(delivery.address, 300);

  if (requiresAddress && address.length < 5) {
    return { error: "Не указан адрес доставки" };
  }

  return {
    order: {
      receivedAt: new Date().toISOString(),
      customer: { name, phone, phoneDigits, comment: clean(customer.comment, 1000) },
      delivery: {
        id: clean(delivery.id, 40),
        name: clean(delivery.name, 100),
        address,
        cost: deliveryCost,
      },
      items,
      subtotal: Math.round(serverTotal * 100) / 100,
      deliveryCost,
      total: Math.round((serverTotal + deliveryCost) * 100) / 100,
      claimedTotal: Number(payload.total) || 0,
      currency: clean(payload.currency, 10) || "BYN",
      notes,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Telegram                                                            */
/* ------------------------------------------------------------------ */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function money(value, currency) {
  return `${value.toFixed(2)} ${currency}`;
}

function buildMessage(order, meta) {
  const lines = [
    "<b>🚗 Новый заказ с сайта</b>",
    "",
    ...order.items.map(
      (item) =>
        `• ${escapeHtml(item.title)}${item.options ? ` — <i>${escapeHtml(item.options)}</i>` : ""}\n` +
        `   ${item.qty} шт. × ${money(item.price, order.currency)} = <b>${money(item.sum, order.currency)}</b>` +
        (item.sku ? `\n   арт. ${escapeHtml(item.sku)}` : ""),
    ),
    "",
    `Товары: ${money(order.subtotal, order.currency)}`,
    `${escapeHtml(order.delivery.name || "Доставка")}: ${
      order.deliveryCost === 0
        ? "бесплатно"
        : money(order.deliveryCost, order.currency)
    }`,
    `<b>Итого: ${money(order.total, order.currency)}</b>`,
    "",
    `<b>Клиент:</b> ${escapeHtml(order.customer.name)}`,
    `<b>Телефон:</b> <a href="tel:+${order.customer.phoneDigits}">${escapeHtml(order.customer.phone)}</a>`,
  ];

  if (order.delivery.address) {
    lines.push(`<b>Адрес:</b> ${escapeHtml(order.delivery.address)}`);
  }
  if (order.customer.comment) {
    lines.push(`<b>Комментарий:</b> ${escapeHtml(order.customer.comment)}`);
  }
  if (order.notes.length) {
    lines.push(
      "",
      "⚠️ <b>Проверьте:</b>",
      ...order.notes.map((note) => `• ${escapeHtml(note)}`),
    );
  }
  if (meta.referer) {
    lines.push("", `<i>Страница: ${escapeHtml(meta.referer)}</i>`);
  }

  return lines.join("\n");
}

async function sendToTelegram(text) {
  if (!CONFIG.token || !CONFIG.chatId) return { ok: false, reason: "не настроен" };

  // Telegram обычно отвечает быстро; если завис — не держим клиента.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${CONFIG.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CONFIG.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, reason: `HTTP ${response.status} ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/* Журнал                                                              */
/* ------------------------------------------------------------------ */

async function appendLog(record) {
  try {
    await fsp.mkdir(path.dirname(CONFIG.ordersLog), { recursive: true });
    await fsp.appendFile(CONFIG.ordersLog, JSON.stringify(record) + "\n", "utf8");
    return true;
  } catch (error) {
    console.error("[order] не удалось записать журнал:", error.message);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

function clientIp(request) {
  // Сервис слушает только localhost и работает за nginx, поэтому
  // X-Forwarded-For здесь можно доверять.
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress ?? "unknown";
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("too-large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/health") {
    return json(response, 200, {
      ok: true,
      telegram: Boolean(CONFIG.token && CONFIG.chatId),
      variants: Object.keys(variants).length,
    });
  }

  if (url.pathname !== "/api/order") {
    return json(response, 404, { error: "Not found" });
  }
  if (request.method !== "POST") {
    return json(response, 405, { error: "Только POST" });
  }

  const ip = clientIp(request);

  // Флуд запросами — отсекаем сразу, до разбора тела.
  if (tooMany(attempts, ip, ABUSE_LIMIT)) {
    console.warn(`[order] флуд с ${ip}`);
    return json(response, 429, {
      error: "Слишком много запросов. Позвоните нам — оформим по телефону.",
    });
  }
  record(attempts, ip);

  // А вот лимит на принятые заказы проверяем здесь же, но списывать его
  // будем только после успешной проверки заявки — ниже.
  if (tooMany(accepted, ip, CONFIG.rateLimit)) {
    console.warn(`[order] превышен лимит заказов с ${ip}`);
    return json(response, 429, {
      error: "Слишком много заявок. Позвоните нам — оформим по телефону.",
    });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch (error) {
    const tooLarge = error.message === "too-large";
    return json(response, tooLarge ? 413 : 400, {
      error: tooLarge ? "Слишком большой запрос" : "Некорректный JSON",
    });
  }

  // Скрытое поле формы заполняют только боты.
  if (payload?.website) {
    return json(response, 200, { ok: true });
  }

  const { order, error } = validate(payload);
  if (error) {
    // Квоту на заказы не списываем: опечатка в телефоне не должна
    // приближать живого клиента к блокировке.
    return json(response, 400, { error });
  }

  record(accepted, ip);

  // Сначала журнал, потом Telegram: если мессенджер недоступен, заявка уже
  // сохранена на диске и не потеряна.
  const logged = await appendLog({ ...order, ip });
  const sent = await sendToTelegram(buildMessage(order, {
    referer: request.headers.referer ?? "",
  }));

  if (!sent.ok) {
    console.error(`[order] Telegram не принял: ${sent.reason}`);
  }
  console.log(
    `[order] ${order.customer.phone} · ${order.items.length} поз. · ${order.total} ${order.currency} · журнал:${logged ? "да" : "НЕТ"} · telegram:${sent.ok ? "да" : "нет"}`,
  );

  // Если не удалось ни записать, ни отправить — честно возвращаем ошибку,
  // и сайт покажет клиенту текст заказа для пересылки вручную.
  if (!logged && !sent.ok) {
    return json(response, 502, {
      error: "Не удалось принять заказ. Позвоните нам, пожалуйста.",
    });
  }

  return json(response, 200, { ok: true, total: order.total });
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(
    `[order] слушает http://${CONFIG.host}:${CONFIG.port}/api/order\n` +
      `[order] журнал: ${CONFIG.ordersLog}\n` +
      `[order] прайс:  ${CONFIG.variantsFile} (${Object.keys(variants).length} вариантов)`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\n[order] ${signal}, останавливаюсь`);
    server.close(() => process.exit(0));
  });
}
