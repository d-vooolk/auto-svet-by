"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteCategoryAction, saveCategoryAction } from "@/app/admin/actions";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Field, Problems, Section } from "@/components/admin/form-parts";
import { SpinnerIcon, TrashIcon } from "@/components/icons";
import type { Category } from "@/lib/schema";
import { toSlug } from "@/lib/slug";

/** Раздел каталога: название, адрес, тексты и картинка на плитке. */

interface CategoryFormProps {
  category: Category;
  previousId?: string;
  thumbs: Record<string, string>;
  productCount: number;
}

export function CategoryForm({
  category: initial,
  previousId,
  thumbs,
  productCount,
}: CategoryFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Category>(initial);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const creating = !previousId;

  const patch = (changes: Partial<Category>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setSaved(false);
  };

  const save = () => {
    setProblems([]);
    startTransition(async () => {
      const result = await saveCategoryAction(clean(draft), previousId);
      if (!result.ok) {
        setProblems(result.problems);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setSaved(true);
      if (creating) router.push(`/admin/categories/${draft.id}/`);
      else router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteCategoryAction(draft.id);
      if (result && !result.ok) {
        setProblems(result.problems);
        setConfirmDelete(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/categories/" className="btn-ghost py-2 text-sm">
          ← К разделам
        </Link>
        <h1 className="text-xl font-extrabold text-slate-900">
          {creating ? "Новый раздел" : draft.name || "Без названия"}
        </h1>
        {!creating && (
          <Link
            href={`/catalog/${draft.slug}/`}
            target="_blank"
            rel="noopener"
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Открыть на сайте ↗
          </Link>
        )}
      </div>

      <Problems items={problems} />

      {saved && (
        <p className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          Сохранено.
        </p>
      )}

      <Section title="Основное">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Название" required>
            <input
              value={draft.name}
              onChange={(event) => {
                const name = event.target.value;
                patch(
                  creating
                    ? { name, slug: toSlug(name), id: toSlug(name) }
                    : { name },
                );
              }}
              className="field"
              placeholder="Линзы"
            />
          </Field>

          <Field label="Название в меню" hint="Если в меню нужно короче">
            <input
              value={draft.menuName ?? ""}
              onChange={(event) => patch({ menuName: event.target.value })}
              className="field"
            />
          </Field>
        </div>

        <Field
          label="Порядок"
          hint="Чем меньше число, тем выше раздел в меню и на главной"
        >
          <input
            type="number"
            value={draft.order ?? 999}
            onChange={(event) => patch({ order: Number(event.target.value) })}
            className="field tnum w-32"
          />
        </Field>
      </Section>

      <Section
        title="Адрес страницы"
        note={
          creating
            ? "Подставляется из названия. Поправьте сейчас — после запуска менять нельзя."
            : "Менять нельзя: адрес уже проиндексирован, старые ссылки отдадут 404."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Адрес (slug)" required hint={`/catalog/${draft.slug || "…"}/`}>
            <input
              value={draft.slug}
              onChange={(event) => patch({ slug: toSlug(event.target.value) })}
              disabled={!creating}
              className="field disabled:bg-slate-100 disabled:text-slate-500"
            />
          </Field>

          <Field label="Код (id)" required hint="По нему товары привязаны к разделу">
            <input
              value={draft.id}
              onChange={(event) => patch({ id: toSlug(event.target.value) })}
              disabled={!creating}
              className="field disabled:bg-slate-100 disabled:text-slate-500"
            />
          </Field>
        </div>
      </Section>

      <Section title="Тексты">
        <Field label="Короткое описание" hint="Строка под названием на плитке каталога">
          <textarea
            value={draft.excerpt ?? ""}
            onChange={(event) => patch({ excerpt: event.target.value })}
            rows={2}
            className="field resize-y"
          />
        </Field>

        <Field label="Текст под сеткой товаров" hint="Пустая строка разбивает на абзацы">
          <textarea
            value={draft.description ?? ""}
            onChange={(event) => patch({ description: event.target.value })}
            rows={6}
            className="field resize-y"
          />
        </Field>
      </Section>

      <Section title="Картинка раздела">
        <ImagePicker
          value={draft.image ? [draft.image] : []}
          onChange={(images) => patch({ image: images[0] })}
          folder="categories"
          thumbs={thumbs}
          max={1}
          label="Одна картинка"
          hint="Показывается на плитке каталога и на главной"
        />
      </Section>

      <Section title="Поиск и SEO">
        <Field label="Заголовок для поиска" hint="До 60 символов">
          <input
            value={draft.seoTitle ?? ""}
            onChange={(event) => patch({ seoTitle: event.target.value })}
            className="field"
          />
        </Field>

        <Field label="Описание для поиска" hint="До 165 символов">
          <textarea
            value={draft.seoDescription ?? ""}
            onChange={(event) => patch({ seoDescription: event.target.value })}
            rows={2}
            className="field resize-y"
          />
        </Field>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="container-page flex items-center gap-3 py-3">
          {!creating &&
            (confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="btn-primary bg-red-700 py-2 text-sm hover:bg-red-800"
                >
                  Да, удалить раздел
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="btn-ghost py-2 text-sm"
                >
                  Отмена
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={productCount > 0}
                title={
                  productCount > 0
                    ? `Сначала перенесите ${productCount} товар(ов) в другой раздел`
                    : undefined
                }
                className="btn-ghost py-2 text-sm text-red-700 hover:bg-red-50 disabled:text-slate-400 disabled:hover:bg-transparent"
              >
                <TrashIcon className="h-4 w-4" />
                Удалить
              </button>
            ))}

          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="btn-primary ml-auto py-2 text-sm"
          >
            {pending ? (
              <>
                <SpinnerIcon className="h-4 w-4 animate-spin" />
                Сохраняем…
              </>
            ) : creating ? (
              "Создать раздел"
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Пустые необязательные поля выбрасываем — схема у нас строгая. */
function clean(category: Category): Category {
  const trimmed = (value: string | undefined) => {
    const text = (value ?? "").trim();
    return text.length ? text : undefined;
  };

  return {
    ...category,
    name: category.name.trim(),
    menuName: trimmed(category.menuName),
    excerpt: trimmed(category.excerpt),
    description: trimmed(category.description),
    seoTitle: trimmed(category.seoTitle),
    seoDescription: trimmed(category.seoDescription),
    image: trimmed(category.image),
  };
}
