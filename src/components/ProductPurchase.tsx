"use client";

import { useEffect, useRef, useState } from "react";

import { AddToCartButton } from "@/components/AddToCartButton";
import { ContactButtons } from "@/components/ContactButtons";
import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/icons";
import { ImagePlaceholder, Picture } from "@/components/Picture";
import { QuickOrder } from "@/components/QuickOrder";
import type { Channel } from "@/lib/contacts";
import { formatPrice } from "@/lib/format";
import { pickUrl, type ImageMap } from "@/lib/image-types";
import type { Product } from "@/lib/schema";
import { defaultSelection, resolveVariant, type Selection } from "@/lib/variant";

/**
 * Галерея, выбор опций и кнопка заказа.
 *
 * Клиентский компонент, но при сборке он рендерится и на сервере — в HTML
 * попадает вариант по умолчанию со своей ценой и фотографиями. Краулер и
 * пользователь с медленным интернетом видят готовую страницу сразу, а
 * JavaScript нужен только для переключения опций.
 *
 * Логика выбора живёт в lib/variant.ts, здесь только отображение.
 */

interface ProductPurchaseProps {
  product: Product;
  /** Записи манифеста только для фото этого товара — не весь манифест. */
  images: ImageMap;
  currencySymbol: string;
  currency: string;
  deliveryNote: string;
  warranty: string;
  /** Куда уходит быстрый заказ и каким способом получения он помечается. */
  orderEndpoint: string;
  quickDeliveryId: string;
  phone: string;
  phoneHref: string;
  /** Telegram, Viber, WhatsApp — уже с готовым текстом вопроса по товару. */
  messengers: Channel[];
}

/**
 * Следующая позиция в галерее по кругу.
 *
 * Вынесена из компонента, потому что вызывается и из кнопок, и из
 * обработчика клавиш: будь она внутри, попала бы в зависимости эффекта и
 * заставляла бы его переподписываться на каждый рендер.
 */
function shift(
  current: { key: string; index: number },
  galleryKey: string,
  count: number,
  delta: number,
): { key: string; index: number } {
  // Набор фотографий мог смениться (переключили цоколь) — тогда считаем от
  // первого кадра, а не от позиции в прежней галерее.
  const at =
    current.key === galleryKey
      ? Math.max(0, Math.min(current.index, count - 1))
      : 0;
  return { key: galleryKey, index: (at + delta + count) % count };
}

export function ProductPurchase({
  product,
  images,
  currencySymbol,
  currency,
  deliveryNote,
  warranty,
  orderEndpoint,
  quickDeliveryId,
  phone,
  phoneHref,
  messengers,
}: ProductPurchaseProps) {
  const [selection, setSelection] = useState<Selection>(() =>
    defaultSelection(product),
  );
  const [qty, setQty] = useState(1);
  const [lightbox, setLightbox] = useState(false);

  const variant = resolveVariant(product, selection);
  const gallery = variant.images;

  // Активное фото сбрасывается, когда сменился набор фотографий: после
  // переключения цоколя «третье фото» прежней галереи ничего не значит.
  const galleryKey = gallery.join("|");
  const [active, setActive] = useState({ key: galleryKey, index: 0 });
  const index =
    active.key === galleryKey
      ? Math.max(0, Math.min(active.index, gallery.length - 1))
      : 0;
  const setIndex = (next: number) => setActive({ key: galleryKey, index: next });

  const mainPath = gallery[index];
  const mainEntry = images[mainPath] ?? null;
  const altText = `${product.title}${variant.label ? `, ${variant.label}` : ""}`;

  /**
   * Листание по кругу: с последнего фото вперёд — на первое.
   *
   * Через функцию-обновитель, а не через вычисленный выше index: тогда
   * текущая позиция не нужна ни здесь, ни в списке зависимостей эффекта с
   * обработчиком клавиш — иначе он переподписывался бы на каждое нажатие
   * стрелки.
   */
  const count = gallery.length;
  const step = (delta: number) => {
    if (count < 2) return;
    setActive((current) => shift(current, galleryKey, count, delta));
  };

  // Escape закрывает фото на весь экран, стрелки листают галерею — на
  // полноэкранном просмотре это первое, что пробует человек с клавиатурой.
  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (count < 2) return;
      if (event.key === "ArrowRight") {
        setActive((current) => shift(current, galleryKey, count, 1));
      }
      if (event.key === "ArrowLeft") {
        setActive((current) => shift(current, galleryKey, count, -1));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightbox, galleryKey, count]);

  // Свайп по фото на телефоне. Порог в 40 пикселей отсекает дрожание
  // пальца при обычном нажатии, чтобы оно не пролистывало галерею.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const shift = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(shift) > 40) step(shift < 0 ? 1 : -1);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
      {/* ---------------------------- Галерея ---------------------------- */}
      <div>
        <button
          type="button"
          onClick={() => mainEntry && setLightbox(true)}
          className="photo-bed relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-card border border-brand-100"
          aria-label="Открыть фото на весь экран"
        >
          <Picture
            entry={mainEntry}
            alt={altText}
            sizes="(max-width: 1024px) 100vw, 620px"
            priority
            className="h-full w-full object-contain p-6"
          />
          {!variant.inStock && (
            <span className="badge absolute top-4 left-4 bg-brand-800 text-white">
              Нет в наличии
            </span>
          )}
        </button>

        {gallery.length > 1 && (
          <div
            className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6"
            role="tablist"
            aria-label="Фотографии товара"
          >
            {gallery.map((path, position) => (
              <button
                key={path}
                type="button"
                role="tab"
                aria-selected={position === index}
                aria-label={`Фото ${position + 1} из ${gallery.length}`}
                onClick={() => setIndex(position)}
                className={`photo-bed aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                  position === index
                    ? "border-brand-600"
                    : "border-brand-100 hover:border-brand-300"
                }`}
              >
                {images[path] ? (
                  <Picture
                    entry={images[path]}
                    alt=""
                    sizes="90px"
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <ImagePlaceholder className="h-full w-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------ Цена и опции -------------------------- */}
      <div>
        <div className="mb-5 flex flex-wrap items-baseline gap-3">
          <span className="tnum text-3xl font-semibold text-brand-900">
            {formatPrice(variant.price, currencySymbol)}
          </span>
          {variant.oldPrice && (
            <>
              <span className="tnum text-lg text-brand-300 line-through">
                {formatPrice(variant.oldPrice, currencySymbol)}
              </span>
              <span className="badge bg-red-50 text-red-700">
                выгода {formatPrice(variant.oldPrice - variant.price, currencySymbol)}
              </span>
            </>
          )}
          {product.unit && (
            <span className="w-full text-sm text-brand-400">
              цена за {product.unit}
            </span>
          )}
        </div>

        <p className="mb-6 flex items-center gap-2 text-sm font-medium">
          {variant.inStock ? (
            <>
              <CheckIcon className="h-4 w-4 text-green-600" />
              <span className="text-green-700">В наличии, отправим сегодня</span>
            </>
          ) : (
            <>
              <CloseIcon className="h-4 w-4 text-brand-400" />
              <span className="text-brand-500">
                Этого варианта нет — напишите нам, подскажем аналог
              </span>
            </>
          )}
        </p>

        {/* Наборы опций: цоколь, сторона, цветовая температура. */}
        {product.optionGroups.map((group) => {
          const selectedId = selection[group.id];
          return (
            <fieldset key={group.id} className="mb-6">
              <legend className="label">
                {group.name}
                <span className="ml-1.5 font-normal text-brand-400">
                  {group.values.find((value) => value.id === selectedId)?.label}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const selected = value.id === selectedId;
                  const outOfStock = value.inStock === false;
                  return (
                    <button
                      key={value.id}
                      type="button"
                      onClick={() =>
                        setSelection((current) => ({
                          ...current,
                          [group.id]: value.id,
                        }))
                      }
                      aria-pressed={selected}
                      title={outOfStock ? "Нет в наличии" : undefined}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        selected
                          ? "border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600"
                          : "border-brand-200 bg-white text-brand-800 hover:border-brand-300"
                      } ${outOfStock ? "text-brand-300 line-through" : ""}`}
                    >
                      {value.label}
                    </button>
                  );
                })}
              </div>
              {group.hint && (
                <p className="mt-2 text-xs text-brand-400">{group.hint}</p>
              )}
            </fieldset>
          );
        })}

        {variant.sku && (
          <p className="mb-5 text-xs text-brand-400">Артикул: {variant.sku}</p>
        )}

        {/* --------------------------- Заказ ---------------------------- */}
        <div className="mb-4 flex gap-3">
          <div className="flex items-center rounded-xl border border-brand-200">
            <button
              type="button"
              onClick={() => setQty((current) => Math.max(1, current - 1))}
              disabled={qty <= 1}
              className="p-3 text-brand-500 hover:text-brand-900 disabled:opacity-40"
              aria-label="Уменьшить количество"
            >
              <MinusIcon className="h-4 w-4" />
            </button>
            <span
              className="tnum w-10 text-center text-sm font-semibold"
              aria-live="polite"
              aria-label={`Количество: ${qty}`}
            >
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((current) => Math.min(99, current + 1))}
              disabled={qty >= 99}
              className="p-3 text-brand-500 hover:text-brand-900 disabled:opacity-40"
              aria-label="Увеличить количество"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>

          <AddToCartButton
            className="btn-primary flex-1"
            disabled={!variant.inStock}
            qty={qty}
            item={{
              key: variant.key,
              productId: product.id,
              slug: product.slug,
              title: product.title,
              optionLabel: variant.label,
              options: variant.selected.map((entry) => ({
                groupName: entry.groupName,
                label: entry.value.label,
              })),
              price: variant.price,
              unit: product.unit,
              sku: variant.sku,
              imageUrl: pickUrl(mainEntry, 200),
            }}
          />
        </div>

        <div className="mb-6">
          <QuickOrder
            orderEndpoint={orderEndpoint}
            deliveryId={quickDeliveryId}
            disabled={!variant.inStock}
            qty={qty}
            currency={currency}
            phone={phone}
            phoneHref={phoneHref}
            item={{
              key: variant.key,
              productId: product.id,
              slug: product.slug,
              title: product.title,
              options: variant.label,
              sku: variant.sku,
              price: variant.price,
            }}
          />
        </div>

        {messengers.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-card border border-brand-100 p-4">
            <span className="text-sm text-brand-600">
              Спросить о товаре в мессенджере:
            </span>
            <ContactButtons channels={messengers} size={34} />
          </div>
        )}

        <ul className="space-y-3 rounded-card bg-brand-50 p-4 text-sm text-brand-600">
          <li className="flex gap-2.5">
            <TruckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <span>{deliveryNote}</span>
          </li>
          {warranty && (
            <li className="flex gap-2.5">
              <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <span>{warranty}</span>
            </li>
          )}
          <li className="flex gap-2.5">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <span>Оплата при получении — никаких предоплат.</span>
          </li>
        </ul>
      </div>

      {/* -------------------------- Лайтбокс --------------------------- */}
      {/*
        Полноэкранное фото с листанием галереи: стрелками по бокам, клавишами
        и свайпом. Раньше здесь открывалось одно фото без выхода к
        остальным — чтобы посмотреть вторую сторону линзы, приходилось
        закрывать окно, тыкать в миниатюру и открывать заново.
      */}
      {lightbox && mainEntry && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-900/90 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={altText}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 z-10 rounded-xl bg-white/10 p-2.5 text-white hover:bg-white/20"
            aria-label="Закрыть"
          >
            <CloseIcon className="h-6 w-6" />
          </button>

          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:left-6"
                aria-label="Предыдущее фото"
              >
                <ChevronRightIcon className="h-6 w-6 rotate-180" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 sm:right-6"
                aria-label="Следующее фото"
              >
                <ChevronRightIcon className="h-6 w-6" />
              </button>
              <p className="tnum absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                {index + 1} / {gallery.length}
              </p>
            </>
          )}

          {/* Клик по самой картинке не закрывает окно: на ней листают. */}
          <div
            onClick={(event) => event.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="flex max-h-full max-w-full items-center justify-center"
          >
            <Picture
              entry={mainEntry}
              alt={altText}
              sizes="100vw"
              priority
              className="max-h-[85vh] max-w-full object-contain select-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
