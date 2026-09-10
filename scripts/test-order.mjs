#!/usr/bin/env node
/**
 * Проверка приёма заказов вживую.
 *
 * Раньше заказы принимал отдельный сервис на порту 8787
 * (server/order-service.mjs). Его больше нет: приём переехал в само
 * приложение, в src/app/api/order/route.ts. Поэтому и стучимся теперь в
 * обычный адрес сайта.
 *
 *   npm run build && npm start     (в одном окне)
 *   npm run test-order             (в другом)
 *
 * ВНИМАНИЕ: заказы создаются настоящие и попадают в базу, которую открыл
 * сервер, — вы увидите их в админке. Чтобы не мусорить в рабочих данных,
 * поднимите сервер на отдельной базе:
 *
 *   DATABASE_PATH=var/test.db npm start
 *
 * Проверяет и хороший случай, и отказы: пустая корзина, короткий телефон,
 * отсутствие адреса и — главное — попытку подсунуть свою цену.
 */

const BASE = (process.env.ORDER_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

// Со слешем на конце: в конфиге стоит trailingSlash, и без него сервер
// ответит редиректом вместо обработки заказа.
const ENDPOINT = `${BASE}/api/order/`;

async function post(label, body) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  console.log(`  ${response.status} ${label}\n      ${text}`);
  return { status: response.status, text };
}

try {
  const ping = await fetch(`${BASE}/`);
  console.log(`\nсайт на ${BASE}: ${ping.status}\n`);
} catch {
  console.error(
    `Сайт не отвечает на ${BASE}\n` +
      "Запустите его в соседнем окне: npm run build && npm start",
  );
  process.exit(1);
}

const goodOrder = {
  customer: {
    name: "Иван",
    phone: "+375 29 123-45-67",
    phoneDigits: "375291234567",
    comment: "Volkswagen Golf 7, 2016",
  },
  delivery: { id: "minsk", name: "Доставка по Минску", address: "ул. Ленина 1, кв. 5", cost: 10 },
  items: [
    {
      key: "osram-night-breaker-200|socket:h7",
      productId: "osram-night-breaker-200",
      title: "Лампы Osram Night Breaker 200",
      options: "H7",
      price: 84.9,
      qty: 2,
      sum: 169.8,
      url: "/product/osram-night-breaker-200/",
    },
  ],
  subtotal: 169.8,
  deliveryCost: 10,
  total: 179.8,
  currency: "BYN",
};

// Итог 169.80, а не 179.80: доставка по Минску бесплатна от 150 р., и
// сервер применяет это правило сам, не спрашивая клиента. Присланные в
// заявке deliveryCost и total он игнорирует — как и цены товаров.
console.log("Корректный заказ (ожидается 200, итого 169.80 — доставка бесплатна):");
await post("корректный", goodOrder);

console.log("\nПодмена цены: клиент присылает 1 р. вместо 84.90");
console.log("(ожидается 200, но сумма пересчитана по серверному прайсу)");
const tampered = await post("подмена цены", {
  ...goodOrder,
  items: [{ ...goodOrder.items[0], price: 1, sum: 2 }],
  total: 12,
});
if (tampered.text.includes('"total":169.8')) {
  console.log("      ✓ цена взята из прайса, присланная проигнорирована");
} else {
  console.log("      ✗ ВНИМАНИЕ: сервер поверил цене из запроса!");
  process.exitCode = 1;
}

console.log("\nОтказы:");
await post("пустая корзина", { ...goodOrder, items: [] });
await post("короткий телефон", {
  ...goodOrder,
  customer: { ...goodOrder.customer, phone: "123", phoneDigits: "123" },
});
await post("нет имени", {
  ...goodOrder,
  customer: { ...goodOrder.customer, name: "" },
});
await post("нет адреса при доставке", {
  ...goodOrder,
  delivery: { ...goodOrder.delivery, address: "" },
});
await post("самовывоз без адреса — это нормально", {
  ...goodOrder,
  delivery: { id: "pickup", name: "Самовывоз", address: "", cost: 0 },
});
await post("бот заполнил скрытое поле", { ...goodOrder, website: "spam.example" });

console.log("\nОграничение частоты (по умолчанию 5 за 10 минут):");
for (let attempt = 1; attempt <= 4; attempt += 1) {
  await post(`попытка ${attempt}`, goodOrder);
}

console.log("\nГотово. Принятые заявки лежат в админке: /admin/orders/\n");
