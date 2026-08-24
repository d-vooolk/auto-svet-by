import Link from "next/link";

import { INFO_PAGES } from "@/components/Header";
import { HeadlightIcon, PhoneIcon } from "@/components/icons";
import { getCategories, getSite } from "@/lib/catalog";

export function Footer() {
  const site = getSite();
  const categories = getCategories();
  // Считается на сборке и запекается в HTML — обновится при следующем деплое.
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
              <HeadlightIcon className="h-5 w-5" />
            </span>
            <span className="text-base font-extrabold text-slate-900">
              {site.name}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            {site.tagline}. Подберём комплект под вашу модель авто и проверим
            перед отправкой.
          </p>
        </div>

        <nav aria-label="Каталог">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Каталог</h2>
          <ul className="space-y-2 text-sm">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/catalog/${category.slug}/`}
                  className="text-slate-600 hover:text-brand-700"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Информация">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Информация
          </h2>
          <ul className="space-y-2 text-sm">
            {INFO_PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="text-slate-600 hover:text-brand-700"
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Связаться</h2>
          <a
            href={`tel:${site.phoneHref}`}
            className="flex items-center gap-2 text-base font-semibold text-slate-900 hover:text-brand-700"
          >
            <PhoneIcon className="h-4 w-4 text-brand-700" />
            {site.phone}
          </a>
          <p className="mt-2 text-sm text-slate-600">{site.workHours}</p>
          <a
            href={`mailto:${site.email}`}
            className="mt-2 block text-sm text-slate-600 hover:text-brand-700"
          >
            {site.email}
          </a>
          <p className="mt-2 text-sm text-slate-600">
            {site.address.city}, {site.address.street}
          </p>
          {site.telegram && (
            <a
              href={site.telegram}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="mt-3 inline-flex text-sm font-medium text-brand-700 hover:underline"
            >
              Написать в Telegram
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.legalName}. Цены на сайте не являются публичной
            офертой.
          </p>
          <p>Оплата при получении. Доставка по Минску и Беларуси.</p>
        </div>
      </div>
    </footer>
  );
}
