#!/usr/bin/env node
/**
 * Проверка сервиса заказов вживую.
 *
 * Запуск в двух окнах:
 *   1) VARIANTS_FILE=out/variants.json npm run order-service
 *   2) node scripts/test-order.mjs
 *
 * Проверяет и хороший случай, и отказы: пустая корзина, короткий телефон,
 * отсутствие адреса и — главное — попытку подсунуть свою цену.
 */

const BASE = process.env.ORDER_URL ?? "http://127.0.0.1:8787";

async function post(label, body) {
  const response = await fetch(`${BASE}/api/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  console.log(`  ${response.status} ${label}\n      ${text}`);
  return { status: response.status, text };
}

const health = await fetch(`${BASE}/health`).then((r) => r.json());
console.log("\nhealth:", JSON.stringify(health), "\n");

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

console.log("Корректный заказ (ожидается 200, итого 179.80):");
await post("корректный", goodOrder);

console.log("\nПодмена цены: клиент присылает 1 р. вместо 84.90");
console.log("(ожидается 200, но сумма пересчитана по серверному прайсу)");
await post("подмена цены", {
  ...goodOrder,
  items: [{ ...goodOrder.items[0], price: 1, sum: 2 }],
  total: 12,
});

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

console.log("\nГотово. Проверьте журнал: tmp-orders.jsonl\n");
