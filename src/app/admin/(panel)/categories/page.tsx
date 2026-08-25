import Link from "next/link";

import { getCategories } from "@/lib/catalog";
import { listCategoriesBrief } from "@/lib/store";

export const metadata = { title: "Разделы" };

/**
 * Разделы каталога.
 *
 * Порядок задаётся числом в карточке раздела, а не перетаскиванием: разделов
 * пять-шесть штук, меняют их раз в год, и ради этого тащить в админку
 * библиотеку drag-and-drop незачем.
 */
export default function CategoriesPage() {
  const brief = listCategoriesBrief();
  const full = new Map(getCategories().map((category) => [category.id, category]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-900">
          Разделы{" "}
          <span className="tnum text-base font-medium text-slate-500">
            {brief.length}
          </span>
        </h1>
        <Link href="/admin/categories/new/" className="btn-primary py-2 text-sm">
          Добавить раздел
        </Link>
      </div>

      {brief.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">
          Разделов пока нет. Без них товар создать не получится — начните
          отсюда.
        </p>
      ) : (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {brief.map((category) => {
            const details = full.get(category.id);
            return (
              <div
                key={category.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="tnum w-8 shrink-0 text-xs text-slate-400">
                  {details?.order ?? "—"}
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/categories/${category.id}/`}
                    className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {category.name}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    /catalog/{category.slug}/
                    {details?.excerpt ? ` · ${details.excerpt}` : ""}
                  </p>
                </div>

                <Link
                  href={`/admin/products/?category=${category.id}`}
                  className="tnum shrink-0 text-sm text-slate-500 hover:text-brand-700"
                  title="Товары раздела"
                >
                  {category.count} тов.
                </Link>

                <Link
                  href={`/catalog/${category.slug}/`}
                  target="_blank"
                  rel="noopener"
                  title="Посмотреть на сайте"
                  className="btn-ghost px-2 py-1 text-xs"
                >
                  ↗
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
