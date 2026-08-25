"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { toggleProductAction } from "@/app/admin/actions";
import { formatPrice } from "@/lib/format";
import type { ProductBrief } from "@/lib/store";

/**
 * Строка списка товаров.
 *
 * Наличие и «хит» переключаются прямо здесь: чтобы убрать с витрины
 * закончившийся товар, открывать карточку и жать «Сохранить» — лишние
 * четыре действия там, где хватает одного.
 */

interface ProductRowProps {
  product: ProductBrief;
  categoryName: string;
  currencySymbol: string;
  thumb: string | null;
}

export function ProductRow({
  product,
  categoryName,
  currencySymbol,
  thumb,
}: ProductRowProps) {
  const [pending, startTransition] = useTransition();

  // Показываем новое состояние сразу, не дожидаясь сервера: переключатель,
  // который «думает» полсекунды, ощущается сломанным.
  const [inStock, setInStock] = useState(product.inStock);
  const [featured, setFeatured] = useState(product.featured);
  const [error, setError] = useState("");

  const toggle = (flag: "inStock" | "featured", next: boolean) => {
    const revert = flag === "inStock" ? setInStock : setFeatured;
    revert(next);
    setError("");

    startTransition(async () => {
      const result = await toggleProductAction(product.id, flag, next);
      if (!result.ok) {
        revert(!next); // сервер не принял — возвращаем как было
        setError(result.problems.join(" "));
      }
    });
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 transition-opacity sm:px-4 ${
        pending ? "opacity-60" : ""
      } ${inStock ? "" : "bg-slate-50"}`}
    >
      <div className="photo-bed h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        {thumb ? (
          // Обычный img: это админка, размытые заглушки и srcset тут не нужны.
          <img
            src={thumb}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
            нет фото
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/products/${product.id}/`}
          className="block truncate text-sm font-semibold text-slate-900 hover:text-brand-700"
        >
          {product.title}
        </Link>
        <p className="truncate text-xs text-slate-500">
          {categoryName}
          {product.brand ? ` · ${product.brand}` : ""} · /{product.slug}/
        </p>
        {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
      </div>

      <p className="tnum hidden shrink-0 text-sm font-semibold text-slate-900 sm:block">
        {formatPrice(product.price, currencySymbol)}
      </p>

      <div className="flex shrink-0 items-center gap-1">
        <Toggle
          label="В наличии"
          short="нал."
          active={inStock}
          onChange={(value) => toggle("inStock", value)}
          activeClass="bg-green-100 text-green-800"
        />
        <Toggle
          label="Хит продаж — показывать на главной"
          short="хит"
          active={featured}
          onChange={(value) => toggle("featured", value)}
          activeClass="bg-amber-100 text-amber-900"
        />
        <Link
          href={`/product/${product.slug}/`}
          target="_blank"
          rel="noopener"
          title="Посмотреть на сайте"
          className="btn-ghost px-2 py-1 text-xs"
        >
          ↗
        </Link>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  short: string;
  active: boolean;
  onChange: (value: boolean) => void;
  activeClass: string;
}

function Toggle({ label, short, active, onChange, activeClass }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      title={label}
      className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
        active ? activeClass : "bg-slate-100 text-slate-400 hover:bg-slate-200"
      }`}
    >
      {short}
    </button>
  );
}
