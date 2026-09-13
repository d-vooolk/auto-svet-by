import { indexNowKey } from "@/lib/indexnow";

/**
 * Файл подтверждения для IndexNow.
 *
 * Поисковик, получив пинг, заходит по этому адресу и сверяет ключ — так он
 * убеждается, что адреса присылает владелец сайта. Отдаём из переменной
 * окружения, а не файлом в public/: ключ тогда не лежит в репозитории.
 *
 * force-dynamic, потому что значение берётся из окружения: запеки его в
 * статику на сборке — и смена ключа потребовала бы пересборки сайта.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const key = indexNowKey();

  // Ключа нет — значит, IndexNow не настроен, и файла быть не должно.
  if (!key) return new Response("Not found", { status: 404 });

  return new Response(key, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
