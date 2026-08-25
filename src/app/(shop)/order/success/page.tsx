import type { Metadata } from "next";
import Link from "next/link";

import { CheckIcon, PhoneIcon } from "@/components/icons";
import { getSite } from "@/lib/catalog";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Заказ принят",
    description: "Заказ отправлен менеджеру. Мы перезвоним для подтверждения.",
    path: "/order/success/",
    noIndex: true,
  });
}

export default function OrderSuccessPage() {
  const site = getSite();

  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
          <CheckIcon className="h-8 w-8 text-green-700" />
        </span>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Заказ принят
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Заявка уже у менеджера. Он перезвонит в рабочее время, подтвердит
          наличие выбранных вариантов и согласует доставку. Ничего оплачивать
          сейчас не нужно.
        </p>

        <div className="mt-8 rounded-card border border-slate-200 bg-slate-50 p-5 text-left">
          <p className="text-sm font-semibold text-slate-900">
            Что дальше
          </p>
          <ol className="mt-2.5 space-y-2 text-sm text-slate-700">
            <li>1. Менеджер звонит и подтверждает состав заказа.</li>
            <li>2. Согласуем время доставки или самовывоза.</li>
            <li>3. Оплата наличными или картой при получении.</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">{site.workHours}</p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/catalog/" className="btn-primary">
            Вернуться в каталог
          </Link>
          <a href={`tel:${site.phoneHref}`} className="btn-secondary">
            <PhoneIcon className="h-4 w-4" />
            {site.phone}
          </a>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Не дождались звонка? Напишите нам{" "}
          {site.telegram ? (
            <a
              href={site.telegram}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-brand-700 hover:underline"
            >
              в Telegram
            </a>
          ) : (
            <a
              href={`mailto:${site.email}`}
              className="font-medium text-brand-700 hover:underline"
            >
              на {site.email}
            </a>
          )}
          .
        </p>
      </div>
    </div>
  );
}
