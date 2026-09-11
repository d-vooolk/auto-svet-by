"use client";

import { useState } from "react";

import { AlertIcon } from "@/components/icons";

/**
 * Мелкие детали форм админки: секция, поле с подписью, список ошибок.
 *
 * Вынесены отдельно, потому что повторяются в четырёх формах — товара,
 * раздела, настроек и заказа. Без этого каждая обрастала бы своей вёрсткой
 * подписей, и подсказки под полями выглядели бы по-разному.
 */

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="text-sm font-bold text-brand-900">{title}</h2>
      {note && <p className="mt-1 text-xs leading-relaxed text-brand-400">{note}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-brand-400">{hint}</span>}
    </label>
  );
}

/**
 * Числовое поле, которое не держится за старое значение.
 *
 * Раньше во всех формах стоял `<input type="number" value={draft.price}>`. У
 * нового товара цена — ноль, поле показывало «0», курсор вставал после
 * нуля, и набранная сотня превращалась в 0100. Стереть ноль вручную тоже
 * не выходило: при пустом поле Number("") даёт 0, состояние снова
 * становилось нулём и ноль возвращался в поле сам.
 *
 * Поэтому набранное держится строкой и в число превращается только при
 * отправке наверх. Пустая строка — это `null`, а не ноль: «не заполнено» и
 * «ровно ноль» для цены и остатка значат разное, и решает, что с этим
 * делать, вызывающая форма.
 *
 * type="text" с inputMode="decimal": у number-поля своя беда — колёсико
 * мыши над ним молча меняет цену, а нечисловой ввод браузер отдаёт как
 * пустую строку, и понять, что человек набрал, уже нельзя.
 */
export function NumberInput({
  value,
  onChange,
  className = "field tnum",
  placeholder,
  integer = false,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  className?: string;
  placeholder?: string;
  /** Только целые — для количеств. Дробную часть отбрасываем. */
  integer?: boolean;
}) {
  const asText = (input: number | null | undefined) =>
    input === null || input === undefined ? "" : String(input);

  const [text, setText] = useState(() => asText(value));
  const [known, setKnown] = useState(value);

  // Значение могло поменяться снаружи: форма перезагрузилась после
  // сохранения или соседнее поле пересчитало цену. Правим состояние в
  // рендере, а не в эффекте — эффект дал бы лишний проход и моргание.
  if (value !== known) {
    setKnown(value);
    const shown = text.trim() === "" ? null : Number(text.trim().replace(",", "."));
    // Если снаружи пришло ровно то число, которое мы сами только что и
    // отправили, текст не трогаем: иначе набранное «10.» схлопнулось бы в
    // «10» прямо под пальцами.
    if (shown !== (value ?? null)) setText(asText(value));
  }

  const handle = (next: string) => {
    setText(next);
    const trimmed = next.trim().replace(",", ".");
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const parsed = integer ? Number.parseInt(trimmed, 10) : Number(trimmed);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  return (
    <input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      placeholder={placeholder}
      onChange={(event) => handle(event.target.value)}
      className={className}
    />
  );
}

/**
 * Адрес страницы (slug) с кнопкой «подставить из названия».
 *
 * Раньше поле после создания просто блокировалось: адрес уже в поиске,
 * менять его нельзя. На практике это упиралось в переименования — товар из
 * «Линз Hella» становился «Линзами Aozoom», а адрес оставался
 * /product/linzy-hella/ и начинал врать и покупателю, и поисковику.
 *
 * Теперь адрес менять можно, но только руками и по кнопке: автоматически,
 * следом за названием, нельзя ни в коем случае — правка одной буквы в
 * заголовке уводила бы страницу на новый адрес молча. А со старого адреса
 * ставится постоянная переадресация (см. src/lib/redirects.ts), поэтому
 * смена перестала быть необратимой потерей.
 */
export function SlugField({
  label,
  hint,
  value,
  /** Каким адрес был бы, если собрать его из текущего названия. */
  fromName,
  /** Адрес, под которым страница живёт сейчас. Пусто — она ещё не создана. */
  saved,
  /** Показать готовый адрес: (slug) => "/product/foo/". */
  preview,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  fromName: string;
  saved?: string;
  preview: (slug: string) => string;
  onChange: (value: string) => void;
}) {
  const creating = !saved;
  const stale = Boolean(fromName) && fromName !== value;
  const changed = Boolean(saved) && value !== saved;

  return (
    <div>
      <Field label={label} required hint={hint ?? preview(value || "…")}>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field"
        />
      </Field>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {stale && (
          <button
            type="button"
            onClick={() => onChange(fromName)}
            className="btn-secondary py-1.5 text-xs"
          >
            Собрать из названия: {fromName}
          </button>
        )}
        {changed && (
          <button
            type="button"
            onClick={() => onChange(saved!)}
            className="btn-ghost py-1.5 text-xs"
          >
            Вернуть прежний
          </button>
        )}
      </div>

      {changed && (
        <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          Адрес сменится: <span className="font-semibold">{preview(saved!)}</span>{" "}
          → <span className="font-semibold">{preview(value)}</span>. Со старого
          адреса встанет постоянная переадресация, так что ссылки из поиска, из
          закладок и с чужих сайтов продолжат работать. Но делать это без
          повода не стоит: каждая переадресация — лишний шаг между человеком и
          страницей.
        </p>
      )}

      {creating && (
        <p className="mt-2 text-xs text-brand-400">
          Подставляется из названия. Потом его лучше не трогать.
        </p>
      )}
    </div>
  );
}

/** Ошибки, вернувшиеся с сервера. Пустой список ничего не рисует. */
export function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;

  return (
    <div
      className="rounded-card border border-red-300 bg-red-50 p-4"
      role="alert"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
        <AlertIcon className="h-4 w-4" />
        Не сохранилось
      </p>
      <ul className="mt-2 space-y-1 text-sm text-red-800">
        {items.map((problem) => (
          <li key={problem}>• {problem}</li>
        ))}
      </ul>
    </div>
  );
}
