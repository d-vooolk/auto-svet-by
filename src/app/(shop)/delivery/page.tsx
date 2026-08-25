import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CheckIcon, ShieldIcon, TruckIcon } from "@/components/icons";
import { getSite } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Доставка и оплата — по Минску и Беларуси",
    description:
      "Доставка автосвета курьером по Минску в день заказа, самовывоз и отправка по Беларуси. Оплата наличными или картой при получении, без предоплаты.",
    path: "/delivery/",
  });
}

/** Вопросы-ответы. Разметка FAQPage даёт раскрывающиеся блоки в выдаче. */
const FAQ = [
  {
    q: "Нужна ли предоплата?",
    a: "Нет. Онлайн-оплаты на сайте нет вообще: вы оставляете заявку, менеджер перезванивается и подтверждает наличие, оплата происходит наличными или картой при получении товара.",
  },
  {
    q: "Как быстро доставите по Минску?",
    a: "Если заказ подтверждён до 16:00 и товар в наличии — курьер привозит его в тот же день. Заказы после 16:00 доставляем на следующий день.",
  },
  {
    q: "Можно ли посмотреть товар перед покупкой?",
    a: "Да. При самовывозе вы осматриваете товар в магазине, а линзы и блоки розжига мы включаем на стенде, чтобы вы увидели светотеневую границу и цвет своими глазами.",
  },
  {
    q: "Что делать, если лампа не подошла по цоколю?",
    a: "Обменяем на нужный цоколь. Чтобы этого не случилось, напишите модель и год автомобиля в комментарии к заказу — проверим совместимость до отправки.",
  },
  {
    q: "Отправляете ли в другие города Беларуси?",
    a: "Да, Европочтой или Белпочтой. Срок 1–3 рабочих дня, оплата при получении в отделении.",
  },
];

export default function DeliveryPage() {
  const site = getSite();

  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: "Доставка и оплата" }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />

      <header className="mb-9 max-w-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          Доставка и оплата
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Доставляем по Минску курьером и по Беларуси почтой. Предоплата не
          нужна — платите при получении, когда увидели товар.
        </p>
      </header>

      {/* --------------------------- Доставка --------------------------- */}
      <section className="mb-12">
        <h2 className="mb-5 flex items-center gap-2.5 text-xl font-bold text-slate-900">
          <TruckIcon className="h-5 w-5 text-brand-700" />
          Способы получения
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {site.delivery.methods.map((method) => (
            <div key={method.id} className="card p-5">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">
                  {method.name}
                </h3>
                <span className="tnum shrink-0 text-base font-bold text-brand-700">
                  {method.price === 0
                    ? "бесплатно"
                    : formatPrice(method.price, site.currencySymbol)}
                </span>
              </div>
              {method.note && (
                <p className="text-sm leading-relaxed text-slate-600">
                  {method.note}
                </p>
              )}
              {method.freeFrom != null && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-green-700">
                  <CheckIcon className="h-3.5 w-3.5" />
                  Бесплатно от{" "}
                  {formatPrice(method.freeFrom, site.currencySymbol)}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------- Оплата ---------------------------- */}
      <section className="mb-12 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Оплата</h2>
          <ul className="space-y-2">
            {site.payment.map((option) => (
              <li
                key={option}
                className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
              >
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                {option}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Онлайн-оплаты на сайте нет. Это сделано намеренно: вы сначала
            видите товар, потом платите.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <ShieldIcon className="h-5 w-5 text-brand-700" />
            Гарантия и возврат
          </h2>
          <p className="text-sm leading-relaxed text-slate-700">
            {site.warranty}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Если вариант не подошёл по цоколю или стороне — обменяем. Товар с
            заводским дефектом меняем или возвращаем деньги.
          </p>
        </div>
      </section>

      {/* ----------------------------- FAQ ------------------------------ */}
      <section className="mb-12 max-w-3xl">
        <h2 className="mb-5 text-xl font-bold text-slate-900">
          Частые вопросы
        </h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="card group p-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-slate-900 marker:hidden">
                {item.q}
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <div className="mb-4 rounded-card bg-brand-50 p-6 text-center">
        <p className="text-base font-semibold text-slate-900">
          Остались вопросы по доставке?
        </p>
        <p className="mt-1.5 text-sm text-slate-600">
          Позвоните — ответим и поможем подобрать товар под вашу машину.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a href={`tel:${site.phoneHref}`} className="btn-primary">
            {site.phone}
          </a>
          <Link href="/catalog/" className="btn-secondary">
            В каталог
          </Link>
        </div>
      </div>
    </div>
  );
}
