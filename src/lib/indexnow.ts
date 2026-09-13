import { after } from "next/server";

import { env } from "./env.mjs";
import { getSite } from "./catalog";

/**
 * IndexNow — сообщить поисковикам, что страница изменилась.
 *
 * Зачем: новый товар иначе ждёт, пока краулер сам зайдёт на сайт, а это дни.
 * С пингом адрес попадает в очередь на обход сразу после сохранения в
 * админке. Один протокол на три поисковика: Яндекс (для Беларуси это
 * половина трафика), Bing и Seznam. Google свой ping-адрес закрыл в 2023
 * году, ему остаётся sitemap.xml — он в robots.txt указан.
 *
 * Ключ живёт в переменной окружения INDEXNOW_KEY, а не в настройках сайта:
 * это не настройка магазина, а секрет окружения, и в бэкап каталога ему
 * попадать незачем. Пока ключ не задан, пинга просто нет — на локальной
 * машине это единственно правильное поведение, потому что чужой домен
 * подтвердить мы всё равно не можем.
 *
 * Ключ надо получить на https://www.bing.com/indexnow (любая строка из
 * 8–128 символов a-z, A-Z, 0-9 и дефиса) и положить в .env:
 *
 *   INDEXNOW_KEY=ваш-ключ
 *
 * Файл подтверждения отдаёт маршрут /indexnow-key.txt — проверять его
 * поисковики будут по адресу из keyLocation ниже.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** За раз протокол разрешает не больше 10 000 адресов; нам хватает и сотни. */
const MAX_URLS = 100;

export function indexNowKey(): string | undefined {
  return env("INDEXNOW_KEY", undefined);
}

/**
 * Отправляет адреса в IndexNow. Ничего не ждёт и ничего не ломает: пинг —
 * приятное дополнение к сохранению товара, а не его часть.
 *
 * Через after(), поэтому запрос уходит уже после того, как админка получила
 * ответ: сохранение не становится медленнее из-за чужого сервиса.
 */
export function pingIndexNow(urls: string[]): void {
  const key = indexNowKey();
  if (!key) return;

  const list = [...new Set(urls)].filter(Boolean).slice(0, MAX_URLS);
  if (!list.length) return;

  const site = getSite();
  let host: string;
  try {
    host = new URL(site.url).host;
  } catch {
    return;
  }

  // Локальная разработка: подтвердить localhost нельзя, и пинговать его
  // незачем — только мусор в ответах.
  if (!host.includes(".") || host.startsWith("localhost")) return;

  after(async () => {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${site.url.replace(/\/$/, "")}/indexnow-key.txt`,
          urlList: list,
        }),
      });

      // Пишем в лог и успех, и отказ: если ключ не подтверждён, узнать об
      // этом больше негде — интерфейс об этом молчит намеренно.
      if (!response.ok) {
        console.warn(
          `[indexnow] ${response.status} ${response.statusText} для ${list.length} адресов`,
        );
      }
    } catch (error) {
      console.warn("[indexnow] не удалось отправить:", error);
    }
  });
}
