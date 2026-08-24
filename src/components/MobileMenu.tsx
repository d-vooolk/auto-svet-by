"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CloseIcon, MenuIcon, PhoneIcon } from "@/components/icons";

interface MenuLink {
  href: string;
  label: string;
  count?: number;
}

interface MobileMenuProps {
  categories: MenuLink[];
  pages: MenuLink[];
  phone: string;
  phoneHref: string;
  workHours: string;
}

export function MobileMenu({
  categories,
  pages,
  phone,
  phoneHref,
  workHours,
}: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  // Пока панель открыта, фон скроллиться не должен.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
        aria-label="Открыть меню"
        aria-expanded={open}
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setOpen(false)}
          />
          <nav
            className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-2xl"
            aria-label="Основное меню"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-slate-900">Меню</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Закрыть меню"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Каталог
              </p>
              <ul>
                {categories.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      // Переход не перезагружает страницу, поэтому панель
                      // закрываем сами — иначе она останется висеть поверх.
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-800 hover:bg-slate-100"
                    >
                      {link.label}
                      {link.count !== undefined && (
                        <span className="tnum text-xs text-slate-400">
                          {link.count}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-4 px-2 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Информация
              </p>
              <ul>
                {pages.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-[15px] text-slate-700 hover:bg-slate-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-slate-200 p-4">
              <a
                href={`tel:${phoneHref}`}
                className="flex items-center gap-2 text-base font-semibold text-slate-900"
              >
                <PhoneIcon className="h-4 w-4 text-brand-700" />
                {phone}
              </a>
              <p className="mt-1 text-xs text-slate-500">{workHours}</p>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
