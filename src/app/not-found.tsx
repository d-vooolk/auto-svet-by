import Link from "next/link";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getCategories, getSite } from "@/lib/catalog";

/**
 * 404 для адресов, не совпавших ни с одним маршрутом.
 *
 * Лежит в корне app/, а не в группе (shop) — иначе Next не считал бы её общей
 * страницей «не найдено». Поэтому шапку и подвал она подключает сама: в
 * корневом макете их больше нет, они переехали в макет витрины.
 */
export default function NotFound() {
  const site = getSite();
  const categories = getCategories();

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="container-page flex-1 py-16 sm:py-24">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-5xl font-extrabold text-brand-700">404</p>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            Страница не найдена
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Возможно, товар снят с продажи или в адресе опечатка. Посмотрите
            каталог или позвоните — подскажем аналог.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/catalog/" className="btn-primary">
              В каталог
            </Link>
            <a href={`tel:${site.phoneHref}`} className="btn-secondary">
              {site.phone}
            </a>
          </div>

          <nav className="mt-10" aria-label="Разделы каталога">
            <p className="mb-3 text-sm font-semibold text-slate-900">
              Разделы магазина
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/catalog/${category.slug}/`}
                    className="inline-flex rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 hover:border-brand-600 hover:text-brand-700"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <Footer />
    </div>
  );
}
