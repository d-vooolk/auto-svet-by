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
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      {/* Верхняя полоса: на мобильных прячем — там эта информация уезжает
          в меню и в подвал, а место на первом экране дороже. */}
      <div className="hidden border-b border-slate-100 bg-slate-50 lg:block">
        <div className="container-page flex h-9 items-center justify-between text-xs text-slate-600">
          <p>{site.tagline}</p>
          <div className="flex items-center gap-5">
            <span>{site.workHours}</span>
            <Link href="/delivery/" className="hover:text-brand-700">
              Доставка по Минску и Беларуси
            </Link>
          </div>
        </div>
      </div>

      <div className="container-page flex h-16 items-center gap-3 lg:h-20 lg:gap-6">
        <MobileMenu
          categories={categoryLinks}
          pages={INFO_PAGES}
          phone={site.phone}
          phoneHref={site.phoneHref}
          workHours={site.workHours}
        />

        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label={`${site.name} — на главную`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white">
            <HeadlightIcon className="h-6 w-6" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-base leading-tight font-extrabold tracking-tight text-slate-900">
              {site.name}
            </span>
            <span className="block text-[11px] leading-tight text-slate-500">
              автосвет в Минске
            </span>
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <SearchBox currencySymbol={site.currencySymbol} />
        </div>

        <a
          href={`tel:${site.phoneHref}`}
          className="hidden shrink-0 items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 xl:flex"
        >
          <PhoneIcon className="h-5 w-5 text-brand-700" />
          <span>
            <span className="block text-sm leading-tight font-semibold text-slate-900">
              {site.phone}
            </span>
            <span className="block text-[11px] leading-tight text-slate-500">
              Звоните, поможем с выбором
            </span>
          </span>
        </a>

        <CartBadge currencySymbol={site.currencySymbol} />
      </div>

      {/* Ссылки на категории в шапке — не только навигация, но и внутренняя
          перелинковка: краулер видит все разделы с любой страницы сайта. */}
      <nav
        className="hidden border-t border-slate-100 lg:block"
        aria-label="Категории"
      >
        <div className="container-page flex h-11 items-center gap-1">
          <Link
            href="/catalog/"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Весь каталог
          </Link>
          {categoryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
