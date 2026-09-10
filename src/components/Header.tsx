import Link from "next/link";

import { CartBadge } from "@/components/CartBadge";
import { HeadlightIcon, PhoneIcon } from "@/components/icons";
import { MobileMenu } from "@/components/MobileMenu";
import { SearchBox } from "@/components/SearchBox";
import { getCategories, getCategoryCounts, getSite } from "@/lib/catalog";

/** Статические страницы — в одном месте, чтобы меню и подвал не разъезжались. */
export const INFO_PAGES = [
  { href: "/delivery/", label: "Доставка и оплата" },
  { href: "/about/", label: "О магазине" },
  { href: "/contacts/", label: "Контакты" },
];

export function Header() {
  const site = getSite();
  const categories = getCategories();
  const counts = getCategoryCounts();

  const categoryLinks = categories.map((category) => ({
    href: `/catalog/${category.slug}/`,
    label: category.menuName ?? category.name,
    count: counts[category.id] ?? 0,
  }));

  return (
    // Полупрозрачный фон с размытием: при прокрутке содержимое просвечивает
    // сквозь шапку, и она перестаёт быть отдельной плашкой поверх страницы.
    <header className="sticky top-0 z-50 border-b border-brand-100 bg-white/80 backdrop-blur-xl">
      {/* Верхняя полоса: на мобильных прячем — там эта информация уезжает
          в меню и в подвал, а место на первом экране дороже. */}
      <div className="hidden border-b border-brand-100/70 lg:block">
        <div className="container-page flex h-9 items-center justify-between text-xs text-brand-400">
          <p>{site.tagline}</p>
          <div className="flex items-center gap-6">
            <span>{site.workHours}</span>
            <Link href="/delivery/" className="transition-colors hover:text-brand-700">
              Доставка по Минску и Беларуси
            </Link>
          </div>
        </div>
      </div>

      <div className="container-page flex h-16 items-center gap-3 lg:h-[4.5rem] lg:gap-6">
        <MobileMenu
          categories={categoryLinks}
          pages={INFO_PAGES}
          phone={site.phone}
          phoneHref={site.phoneHref}
          workHours={site.workHours}
        />

        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label={`${site.name} — на главную`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-900 text-accent-400 transition-colors duration-200 group-hover:bg-brand-700">
            <HeadlightIcon className="h-5 w-5" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-[15px] leading-tight font-semibold tracking-tight text-brand-900">
              {site.name}
            </span>
            <span className="block text-[11px] leading-tight text-brand-400">
              автосвет в Минске
            </span>
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <SearchBox currencySymbol={site.currencySymbol} />
        </div>

        <a
          href={`tel:${site.phoneHref}`}
          className="hidden shrink-0 items-center gap-2 rounded-control px-3 py-2 transition-colors hover:bg-brand-50 xl:flex"
        >
          <PhoneIcon className="h-5 w-5 text-brand-400" />
          <span>
            <span className="block text-sm leading-tight font-semibold text-brand-900">
              {site.phone}
            </span>
            <span className="block text-[11px] leading-tight text-brand-400">
              Звоните, поможем с выбором
            </span>
          </span>
        </a>

        <CartBadge currencySymbol={site.currencySymbol} />
      </div>

      {/* Ссылки на категории в шапке — не только навигация, но и внутренняя
          перелинковка: краулер видит все разделы с любой страницы сайта. */}
      <nav
        className="hidden border-t border-brand-100/70 lg:block"
        aria-label="Категории"
      >
        <div className="container-page flex h-11 items-center gap-1">
          <Link
            href="/catalog/"
            className="rounded-control px-3 py-1.5 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50"
          >
            Весь каталог
          </Link>
          {categoryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-control px-3 py-1.5 text-sm text-brand-500 transition-colors hover:bg-brand-50 hover:text-brand-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
