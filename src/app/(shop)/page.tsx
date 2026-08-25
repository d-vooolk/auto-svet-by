import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { Picture } from "@/components/Picture";
import { ProductCard } from "@/components/ProductCard";
import {
  CheckIcon,
  ChevronRightIcon,
  PhoneIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/icons";
import {
  getCategories,
  getCategoryCounts,
  getFeaturedProducts,
  getSite,
} from "@/lib/catalog";
import { pluralize } from "@/lib/format";
import { getImage } from "@/lib/images";
import { buildMetadata, organizationJsonLd } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const site = getSite();
  return buildMetadata({
    title: `${site.name} — автосвет в Минске: линзы, стёкла фар, лампы`,
    description: site.description,
    path: "/",
  });
}

const ICONS = [TruckIcon, ShieldIcon, CheckIcon, PhoneIcon];

export default function HomePage() {
  const site = getSite();
  const categories = getCategories();
  const counts = getCategoryCounts();
  const featured = getFeaturedProducts(8);

  return (
    <>
      <JsonLd data={organizationJsonLd()} />

      {/* ----------------------------- Хиро ----------------------------- */}
      <section className="border-b border-slate-200 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20">
          <div>
            {/* h1 на главной — под самый частотный запрос. */}
            <h1 className="text-3xl leading-[1.15] font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Автосвет в Минске: линзы, стёкла фар и лампы
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-100 sm:text-lg">
              Би-ЛЕД и би-ксеноновые модули, стёкла на замену помутневшим,
              лампы во всех популярных цоколях. Проверяем каждый комплект на
              стенде перед отправкой.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/catalog/"
                className="btn bg-white text-brand-800 hover:bg-brand-50"
              >
                Смотреть каталог
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
              <a
                href={`tel:${site.phoneHref}`}
                className="btn border border-white/30 text-white hover:bg-white/10"
              >
                <PhoneIcon className="h-4 w-4" />
                {site.phone}
              </a>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6">
              <div>
                <dt className="text-xs text-brand-200">Доставка по Минску</dt>
                <dd className="mt-0.5 text-base font-bold text-white">
                  в день заказа
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-200">Оплата</dt>
                <dd className="mt-0.5 text-base font-bold text-white">
                  при получении
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-200">Гарантия</dt>
                <dd className="mt-0.5 text-base font-bold text-white">
                  до 12 мес.
                </dd>
              </div>
            </dl>
          </div>

          {/* Быстрый переход в разделы прямо с первого экрана. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.slice(0, 4).map((category) => (
              <Link
                key={category.id}
                href={`/catalog/${category.slug}/`}
                className="group rounded-card border border-white/15 bg-white/5 p-5 backdrop-blur transition-colors hover:bg-white/10"
              >
                <span className="block text-base font-bold text-white">
                  {category.name}
                </span>
                <span className="mt-1 block text-xs text-brand-200">
                  {pluralize(counts[category.id] ?? 0, "товар", "товара", "товаров")}
                </span>
                <span className="mt-3 flex items-center gap-1 text-sm font-medium text-white/90">
                  Перейти
                  <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Категории -------------------------- */}
      <section className="container-page py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Категории
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Не уверены, что подойдёт к вашей машине — позвоните, подберём.
            </p>
          </div>
          <Link
            href="/catalog/"
            className="hidden shrink-0 text-sm font-semibold text-brand-700 hover:underline sm:block"
          >
            Весь каталог →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/catalog/${category.slug}/`}
              className="group card flex gap-4 overflow-hidden p-4 transition-shadow hover:shadow-card-hover"
            >
              <span className="photo-bed flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                <Picture
                  entry={getImage(category.image)}
                  alt=""
                  sizes="96px"
                  className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-slate-900 group-hover:text-brand-700">
                    {category.name}
                  </span>
                  <span className="tnum text-xs text-slate-400">
                    {counts[category.id] ?? 0}
                  </span>
                </span>
                {category.excerpt && (
                  <span className="mt-1 block text-sm leading-snug text-slate-600">
                    {category.excerpt}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------- Хиты ------------------------------ */}
      {featured.length > 0 && (
        <section className="border-y border-slate-200 bg-slate-50 py-14">
          <div className="container-page">
            <h2 className="mb-7 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Выбирают чаще всего
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {featured.map((product, position) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currencySymbol={site.currencySymbol}
                  // Первые две карточки видны без скролла — их фото
                  // участвуют в LCP, поэтому грузим их сразу.
                  priority={position < 2}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------- Почему мы --------------------------- */}
      {site.features.length > 0 && (
        <section className="container-page py-14">
          <h2 className="mb-7 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Как мы работаем
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {site.features.map((feature, position) => {
              const Icon = ICONS[position % ICONS.length];
              return (
                <div key={feature.title} className="card p-5">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------ Текст для поиска ---------------------- */}
      <section className="border-t border-slate-200 bg-slate-50 py-14">
        <div className="container-page prose-shop max-w-3xl">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Автосвет с доставкой по Минску и Беларуси
          </h2>
          <p>
            {site.name} — магазин деталей автомобильного освещения. В каталоге
            би-ЛЕД и би-ксеноновые линзы диаметром 2.5″ и 3″, стёкла передних
            фар на замену помутневшим и треснувшим, галогенные, ксеноновые и
            светодиодные лампы в цоколях H1, H4, H7, H11, HB3, HB4, D2S, а
            также блоки розжига, обманки CAN-шины и всё для установки.
          </p>
          <p>
            Лампы и стёкла продаются в вариантах: выберите на странице товара
            нужный цоколь или сторону — цена, наличие и фотографии обновятся
            под выбранный вариант. Если не знаете, какой цоколь стоит в вашей
            машине, позвоните по номеру{" "}
            <a
              href={`tel:${site.phoneHref}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {site.phone}
            </a>{" "}
            — подскажем по VIN или по модели.
          </p>
          <p>
            Заказ оформляется без онлайн-оплаты: вы выбираете товар, оставляете
            телефон, менеджер перезванивается и подтверждает наличие. Оплата
            наличными или картой при получении.{" "}
            <Link
              href="/delivery/"
              className="font-medium text-brand-700 hover:underline"
            >
              Условия доставки и оплаты
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
