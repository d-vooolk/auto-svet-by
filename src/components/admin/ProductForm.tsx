"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteProductAction, saveProductAction } from "@/app/admin/actions";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { OptionGroupsEditor } from "@/components/admin/OptionGroupsEditor";
import { Field, Problems, Section } from "@/components/admin/form-parts";
import { SpinnerIcon, TrashIcon } from "@/components/icons";
import type { Product, Spec } from "@/lib/schema";
import { toSlug } from "@/lib/slug";

/**
 * Карточка товара.
 *
 * Форма отправляет не FormData, а готовый объект товара: внутри опции с
 * вложенными значениями, у каждого своя цена и своя галерея. Разложить такое
 * по плоским полям формы и собрать обратно можно, но это ровно тот код, в
 * котором заводятся ошибки вида «пропала галерея у второго цоколя».
 *
 * Проверяет объект всё равно zod на сервере (src/lib/store.ts) — здесь только
 * подсказки, чтобы не отправлять заведомо неполное.
 */

interface ProductFormProps {
  /** Существующий товар или заготовка нового. */
  product: Product;
  categories: Array<{ id: string; name: string }>;
  /** Пусто при создании: у нового товара ещё нет прежнего кода. */
  previousId?: string;
  /** Готовые ссылки на миниатюры уже выбранных фото. */
  thumbs: Record<string, string>;
  currencySymbol: string;
}

export function ProductForm({
  product: initial,
  categories,
  previousId,
  thumbs,
  currencySymbol,
}: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Product>(initial);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const creating = !previousId;

  const patch = (changes: Partial<Product>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setSaved(false);
  };

  /**
   * Папка для новых фото: по разделу и коду товара. Так в public/img
   * складывается понятная структура, а не свалка из тысячи файлов.
   */
  const folder = `${draft.categoryId || "misc"}/${draft.id || "new"}`;

  const save = () => {
    setProblems([]);
    startTransition(async () => {
      const result = await saveProductAction(clean(draft), previousId);
      if (!result.ok) {
        setProblems(result.problems);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setSaved(true);
      if (creating) {
        router.push(`/admin/products/${draft.id}/`);
      } else {
        router.refresh();
      }
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteProductAction(draft.id);
      // Успешное удаление уводит на список и сюда не возвращается.
      if (result && !result.ok) setProblems(result.problems);
    });
  };

  return (
    <div className="space-y-5 pb-24">
      {/* --------------------------- Шапка --------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/products/" className="btn-ghost py-2 text-sm">
          ← К списку
        </Link>
        <h1 className="text-xl font-extrabold text-slate-900">
          {creating ? "Новый товар" : draft.title || "Без названия"}
        </h1>
        {!creating && (
          <Link
            href={`/product/${draft.slug}/`}
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
          Сохранено. Страница на сайте уже обновилась.
        </p>
      )}

      {/* -------------------------- Основное -------------------------- */}
      <Section title="Основное">
        <Field label="Название" required>
          <input
            value={draft.title}
            onChange={(event) => {
              const title = event.target.value;
              // Адрес и код подставляем сами, пока товар новый и их не трогали
              // руками. У существующего товара менять их нельзя.
              patch(
                creating
                  ? { title, slug: toSlug(title), id: toSlug(title) }
                  : { title },
              );
            }}
            className="field"
            placeholder="Линзы Hella 3R G5 Bi-Xenon"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Раздел" required>
            <select
              value={draft.categoryId}
              onChange={(event) => patch({ categoryId: event.target.value })}
              className="field"
            >
              <option value="">— выберите —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Бренд" hint="Попадает в фильтр каталога">
            <input
              value={draft.brand ?? ""}
              onChange={(event) => patch({ brand: event.target.value })}
              className="field"
              placeholder="Hella"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={`Цена, ${currencySymbol}`}
            required
            hint="Если есть опции со своими ценами — запасная"
          >
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.price}
              onChange={(event) => patch({ price: Number(event.target.value) })}
              className="field tnum"
            />
          </Field>

          <Field label={`Старая цена, ${currencySymbol}`} hint="Покажется зачёркнутой">
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.oldPrice ?? ""}
              onChange={(event) =>
                patch({
                  oldPrice: event.target.value ? Number(event.target.value) : null,
                })
              }
              className="field tnum"
            />
          </Field>

          <Field label="Единица" hint="«комплект (2 шт.)», «шт.»">
            <input
              value={draft.unit ?? ""}
              onChange={(event) => patch({ unit: event.target.value })}
              className="field"
              placeholder="шт."
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Артикул">
            <input
              value={draft.sku ?? ""}
              onChange={(event) => patch({ sku: event.target.value })}
              className="field"
            />
          </Field>

          <Field label="Плашка на карточке" hint="«Хит», «Новинка», «Распродажа»">
            <input
              value={draft.badge ?? ""}
              onChange={(event) => patch({ badge: event.target.value })}
              className="field"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-5">
          <Checkbox
            checked={draft.inStock}
            onChange={(value) => patch({ inStock: value })}
            label="В наличии"
            hint="Выключено — кнопки заказа не будет"
          />
          <Checkbox
            checked={Boolean(draft.featured)}
            onChange={(value) => patch({ featured: value })}
            label="Показывать на главной"
            hint="Блок «Выбирают чаще всего»"
          />
        </div>
      </Section>

      {/* ------------------------ Адрес и код ------------------------ */}
      <Section
        title="Адрес страницы"
        note={
          creating
            ? "Подставляются из названия. Их можно поправить сейчас — после сохранения они меняться не должны."
            : "Менять нельзя: адрес уже в поиске, а код входит в ключ корзины."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Адрес (slug)" required hint={`/product/${draft.slug || "…"}/`}>
            <input
              value={draft.slug}
              onChange={(event) => patch({ slug: toSlug(event.target.value) })}
              disabled={!creating}
              className="field disabled:bg-slate-100 disabled:text-slate-500"
            />
          </Field>

          <Field label="Код (id)" required hint="Внутренний, покупателю не виден">
            <input
              value={draft.id}
              onChange={(event) => patch({ id: toSlug(event.target.value) })}
              disabled={!creating}
              className="field disabled:bg-slate-100 disabled:text-slate-500"
            />
          </Field>
        </div>
      </Section>

      {/* --------------------------- Тексты -------------------------- */}
      <Section title="Описание">
        <Field
          label="Короткое описание"
          hint="Одна-две фразы под заголовком и в выдаче поиска"
        >
          <textarea
            value={draft.excerpt ?? ""}
            onChange={(event) => patch({ excerpt: event.target.value })}
            rows={2}
            className="field resize-y"
          />
        </Field>

        <Field label="Полное описание" hint="Пустая строка разбивает текст на абзацы">
          <textarea
            value={draft.description ?? ""}
            onChange={(event) => patch({ description: event.target.value })}
            rows={8}
            className="field resize-y"
          />
        </Field>
      </Section>

      {/* ---------------------------- Фото --------------------------- */}
      <Section
        title="Фотографии"
        note="Первая — главная: она стоит на карточке в каталоге. Если у опции есть свои фото, на странице товара покажутся они."
      >
        <ImagePicker
          value={draft.images}
          onChange={(images) => patch({ images })}
          folder={folder}
          thumbs={thumbs}
          label="Общая галерея"
        />
      </Section>

      {/* ---------------------- Характеристики ----------------------- */}
      <Section title="Характеристики" note="Таблица на странице товара.">
        <SpecsEditor
          value={draft.specs}
          onChange={(specs) => patch({ specs })}
        />
      </Section>

      {/* ---------------------------- Опции -------------------------- */}
      <Section
        title="Опции"
        note="Цоколь, цветовая температура, сторона. У каждого значения может быть своя цена, свой артикул, своё наличие и своя галерея."
      >
        <OptionGroupsEditor
          value={draft.optionGroups}
          onChange={(optionGroups) => patch({ optionGroups })}
          folder={folder}
          thumbs={thumbs}
          currencySymbol={currencySymbol}
          basePrice={draft.price}
        />
      </Section>

      {/* --------------------------- Поиск --------------------------- */}
      <Section
        title="Поиск и SEO"
        note="Заголовки можно не заполнять — тогда они соберутся из названия и описания."
      >
        <Field
          label="Поисковые слова"
          hint="Через запятую. Не показываются, но по ним ищут: «лампы h7, осрам, ближний свет»"
        >
          <input
            value={draft.tags.join(", ")}
            onChange={(event) =>
              patch({
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
            className="field"
          />
        </Field>

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

      {/* ------------------------ Панель снизу ----------------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="container-page flex items-center gap-3 py-3">
          {!creating && (
            <>
              {confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={pending}
                    className="btn-primary bg-red-700 py-2 text-sm hover:bg-red-800"
                  >
                    Да, удалить навсегда
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
                  className="btn-ghost py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Удалить
                </button>
              )}
            </>
          )}

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
              "Создать товар"
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Характеристики                                                      */
/* ------------------------------------------------------------------ */

function SpecsEditor({
  value,
  onChange,
}: {
  value: Spec[];
  onChange: (value: Spec[]) => void;
}) {
  const update = (index: number, patch: Partial<Spec>) =>
    onChange(value.map((spec, i) => (i === index ? { ...spec, ...patch } : spec)));

  return (
    <div className="space-y-2">
      {value.map((spec, index) => (
        <div key={index} className="flex gap-2">
          <input
            value={spec.name}
            onChange={(event) => update(index, { name: event.target.value })}
            placeholder="Мощность"
            className="field w-1/3 py-2 text-sm"
          />
          <input
            value={spec.value}
            onChange={(event) => update(index, { value: event.target.value })}
            placeholder="55 Вт"
            className="field flex-1 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            title="Убрать строку"
            className="btn-ghost px-2 py-2 text-red-700"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, { name: "", value: "" }])}
        className="btn-secondary py-2 text-sm"
      >
        + Строка характеристики
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
      />
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Убирает пустые необязательные поля перед отправкой.
 *
 * Схема у нас строгая: пустая строка в seoTitle — это не «не заполнено», а
 * заполненное пустотой, и на странице появился бы пустой тег. Заодно
 * выбрасываем недописанные строки характеристик.
 */
function clean(product: Product): Product {
  const trimmed = (value: string | undefined | null) => {
    const text = (value ?? "").trim();
    return text.length ? text : undefined;
  };

  return {
    ...product,
    title: product.title.trim(),
    brand: trimmed(product.brand),
    unit: trimmed(product.unit),
    sku: trimmed(product.sku),
    badge: trimmed(product.badge),
    excerpt: trimmed(product.excerpt),
    description: trimmed(product.description),
    seoTitle: trimmed(product.seoTitle),
    seoDescription: trimmed(product.seoDescription),
    oldPrice: product.oldPrice ? product.oldPrice : null,
    featured: product.featured ? true : undefined,
    specs: product.specs.filter((spec) => spec.name.trim() && spec.value.trim()),
    tags: product.tags.map((tag) => tag.trim()).filter(Boolean),
  };
}
