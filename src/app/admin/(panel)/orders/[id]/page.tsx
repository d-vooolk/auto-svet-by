import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderControls } from "@/components/admin/OrderControls";
import { getSite } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { getOrder } from "@/lib/orders";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Заказ №${id}` };
}

export default async function OrderPage({ params }: PageProps) {
  const { id } = await params;
  const order = getOrder(Number(id));
  if (!order) notFound();

  const site = getSite();
  const price = (value: number) => formatPrice(value, site.currencySymbol);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/orders/" className="btn-ghost py-2 text-sm">
          ← К заказам
        </Link>
        <h1 className="text-xl font-extrabold text-slate-900">
          Заказ №{order.id}
        </h1>
        <span className="text-sm text-slate-500">
          {new Date(order.createdAt).toLocaleString("ru-RU")}
        </span>
      </div>

      {/* Расхождения, замеченные при приёме заявки. Показываем сразу и
          заметно: именно они портят разговор с покупателем. */}
      {order.notes.length > 0 && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Проверьте перед звонком
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-amber-800">
            {order.notes.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      {!order.telegramSent && (
        <p className="rounded-card border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          Этот заказ не ушёл в Telegram — проверьте настройки бота на сервере
          (TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID). Сам заказ сохранён полностью.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ---------------------------- Состав --------------------------- */}
        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-900">
            Состав заказа
          </h2>

          <ul className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <li key={item.key} className="flex gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {item.url ? (
                    <Link
                      href={item.url}
                      target="_blank"
                      rel="noopener"
                      className="block text-sm font-medium text-slate-900 hover:text-brand-700"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">
                      {item.title}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {item.options && <span>{item.options} · </span>}
                    {item.sku && <span>арт. {item.sku} · </span>}
                    <span className="tnum">
                      {item.qty} × {price(item.price)}
                    </span>
                  </p>
                </div>
                <p className="tnum shrink-0 text-sm font-semibold text-slate-900">
                  {price(item.sum)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-slate-200 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Товары</dt>
              <dd className="tnum font-medium">{price(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">
                {order.deliveryName || "Доставка"}
              </dt>
              <dd className="tnum font-medium">
                {order.deliveryCost === 0 ? "бесплатно" : price(order.deliveryCost)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <dt className="font-bold text-slate-900">Итого</dt>
              <dd className="tnum text-lg font-extrabold text-slate-900">
                {price(order.total)}
              </dd>
            </div>
          </dl>
        </section>

        {/* ---------------------------- Клиент --------------------------- */}
        <div className="space-y-5">
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Покупатель</h2>

            <dl className="space-y-2.5 text-sm">
              <Row label="Имя">{order.name}</Row>
              <Row label="Телефон">
                <a
                  href={`tel:+${order.phoneDigits}`}
                  className="tnum font-semibold text-brand-700 hover:underline"
                >
                  {order.phone}
                </a>
              </Row>
              {order.address && <Row label="Адрес">{order.address}</Row>}
              {order.comment && <Row label="Комментарий">{order.comment}</Row>}
            </dl>

            {(order.referer || order.ip) && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                {order.referer && <>Пришёл со страницы: {order.referer}<br /></>}
                {order.ip && <>Адрес: {order.ip}</>}
              </p>
            )}
          </section>

          <OrderControls
            id={order.id}
            status={order.status}
            note={order.adminNote}
          />
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}
