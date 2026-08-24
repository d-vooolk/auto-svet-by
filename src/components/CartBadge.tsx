"use client";

import Link from "next/link";

import { CartIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import { cartCount, cartTotal, useCart, useHydrated } from "@/store/cart";

/**
 * Иконка корзины в шапке со счётчиком.
 *
 * До монтирования счётчик не рисуем: HTML сгенерирован на сборке с пустой
 * корзиной, а в браузере она уже поднята из localStorage — если показать
 * настоящее число сразу, React сообщит о расхождении разметки.
 */

export function CartBadge({ currencySymbol }: { currencySymbol: string }) {
  const items = useCart((state) => state.items);
  const hydrated = useHydrated();

  const count = hydrated ? cartCount(items) : 0;
  const total = hydrated ? cartTotal(items) : 0;

  return (
    <Link
      href="/cart/"
      className="group relative flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-slate-100"
      aria-label={count > 0 ? `Корзина, товаров: ${count}` : "Корзина пуста"}
    >
      <span className="relative">
        <CartIcon className="h-6 w-6 text-slate-700" />
        {count > 0 && (
          <span className="tnum absolute -top-1.5 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-[11px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="hidden text-left lg:block">
        <span className="block text-xs leading-tight text-slate-500">
          Корзина
        </span>
        <span className="tnum block text-sm leading-tight font-semibold text-slate-900">
          {count > 0 ? formatPrice(total, currencySymbol) : "пусто"}
        </span>
      </span>
    </Link>
  );
}
