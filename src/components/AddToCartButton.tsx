"use client";

import { useEffect, useRef, useState } from "react";

import { CartIcon, CheckIcon } from "@/components/icons";
import { useCart, type CartItem } from "@/store/cart";

/**
 * Кнопка «В корзину». После нажатия на две секунды превращается в «Добавлено»
 * — без этого на статике непонятно, сработало ли нажатие: страница не
 * перезагружается и визуально ничего не меняется.
 */

interface AddToCartButtonProps {
  item: Omit<CartItem, "qty">;
  qty?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** Ссылка на страницу товара сразу после добавления. */
  onAdded?: () => void;
}

export function AddToCartButton({
  item,
  qty = 1,
  disabled = false,
  className = "btn-primary w-full",
  label = "В корзину",
  onAdded,
}: AddToCartButtonProps) {
  const add = useCart((state) => state.add);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Если пользователь ушёл со страницы, пока таймер шёл, setState на
  // размонтированном компоненте нам не нужен.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClick = () => {
    add(item, qty);
    setAdded(true);
    onAdded?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={className}
      aria-live="polite"
    >
      {added ? (
        <>
          <CheckIcon className="h-4 w-4 shrink-0" />
          Добавлено
        </>
      ) : (
        <>
          <CartIcon className="h-4 w-4 shrink-0" />
          {label}
        </>
      )}
    </button>
  );
}
