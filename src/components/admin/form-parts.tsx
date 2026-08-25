"use client";

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
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {note && <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>}
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
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
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
