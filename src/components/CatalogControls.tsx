"use client";

import { useMemo, useState } from "react";

import { CloseIcon, ChevronDownIcon } from "@/components/icons";
import { formatPrice, pluralize } from "@/lib/format";

/**
 * Фильтры и сортировка каталога.
 *
 * Приём, на котором держится вся страница: карточки товаров приходят сюда
 * готовыми, отрендеренными на сервере, и лежат в children. Этот компонент
 * знает о них только цену, бренд и наличие — по паре десятков байт на товар.
 * Фильтрация прячет ненужные карточки, сортировка меняет им CSS-свойство
 * order.
 *
 * Зачем так: в HTML попадают все товары раздела — краулер видит полный
 * ассортимент без исполнения JavaScript. Если бы фильтры рендерили сетку
 * сами, в бандл пришлось бы тащить весь каталог (при 300+ товарах это
 * сотни килобайт), а поисковик увидел бы пустой div.
 *
 * Состояние фильтров сознательно не пишется в URL: /catalog/lampy/?brand=osram
 * плодил бы дубли страниц с одинаковым содержимым, и их пришлось бы закрывать
 * от индексации.
 */

export interface CatalogItem {
  /** Тот же порядок, что у children. */
  id: string;
  brand: string;
  price: number;
  inStock: boolean;
  /** Позиция в исходном порядке — для сортировки «по умолчанию». */
  order: number;
}

type SortKey = "default" | "price-asc" | "price-desc" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  default: "По умолчанию",
  "price-asc": "Сначала дешевле",
  "price-desc": "Сначала дороже",
  name: "По названию",
};

interface CatalogControlsProps {
  items: CatalogItem[];
  /** Названия товаров — нужны только для сортировки по алфавиту. */
  titles: string[];
  brands: string[];
  currencySymbol: string;
  children: React.ReactNode;
}

export function CatalogControls({
  items,
  titles,
  brands,
  currencySymbol,
  children,
}: CatalogControlsProps) {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("default");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const bounds = useMemo(() => {
    if (!items.length) return { min: 0, max: 0 };
    const prices = items.map((item) => item.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [items]);

  const filterActive =
    selectedBrands.length > 0 || inStockOnly || minPrice !== "" || maxPrice !== "";

  const { visible, orderById } = useMemo(() => {
    const min = minPrice === "" ? -Infinity : Number(minPrice);
    const max = maxPrice === "" ? Infinity : Number(maxPrice);

    const passing = items.filter((item) => {
      if (inStockOnly && !item.inStock) return false;
      if (selectedBrands.length && !selectedBrands.includes(item.brand)) return false;
      if (Number.isFinite(min) && item.price < min) return false;
      if (Number.isFinite(max) && item.price > max) return false;
      return true;
    });

    const sorted = [...passing].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "name":
          return (titles[a.order] ?? "").localeCompare(titles[b.order] ?? "", "ru");
        default:
          // Товары в наличии всегда выше: карточка «нет в наличии» в начале
          // раздела — верный способ потерять клиента.
          if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
          return a.order - b.order;
      }
    });

    const order = new Map<string, number>();
    sorted.forEach((item, position) => order.set(item.id, position));
    return { visible: new Set(sorted.map((item) => item.id)), orderById: order };
  }, [items, titles, selectedBrands, inStockOnly, minPrice, maxPrice, sort]);

  const cards = Array.isArray(children) ? children : [children];

  const reset = () => {
    setSelectedBrands([]);
    setInStockOnly(false);
    setMinPrice("");
    setMaxPrice("");
  };

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      {/* --------------------------- Фильтры --------------------------- */}
      <div className="mb-5 lg:mb-0">
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          className="btn-secondary w-full justify-between lg:hidden"
          aria-expanded={panelOpen}
        >
          <span>
            Фильтры
            {filterActive && (
              <span className="ml-2 rounded-full bg-brand-700 px-2 py-0.5 text-xs text-white">
                вкл.
              </span>
            )}
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform ${panelOpen ? "rotate-180" : ""}`}
          />
        </button>

        <aside
          className={`${panelOpen ? "mt-3 block" : "hidden"} lg:sticky lg:top-36 lg:block`}
          aria-label="Фильтры каталога"
        >
          <div className="card divide-y divide-slate-100">
            {brands.length > 1 && (
              <fieldset className="p-4">
                <legend className="mb-2.5 text-sm font-semibold text-slate-900">
                  Бренд
                </legend>
                <div className="space-y-2">
                  {brands.map((brand) => (
                    <label
                      key={brand}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={(event) =>
                          setSelectedBrands((current) =>
                            event.target.checked
                              ? [...current, brand]
                              : current.filter((value) => value !== brand),
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                      />
                      {brand}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="p-4">
              <legend className="mb-2.5 text-sm font-semibold text-slate-900">
                Цена, {currencySymbol}
              </legend>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder={String(bounds.min)}
                  aria-label="Цена от"
                  className="field tnum px-2.5 py-2 text-sm"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder={String(bounds.max)}
                  aria-label="Цена до"
                  className="field tnum px-2.5 py-2 text-sm"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                В разделе: {formatPrice(bounds.min, currencySymbol)} —{" "}
                {formatPrice(bounds.max, currencySymbol)}
              </p>
            </fieldset>

            <div className="p-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(event) => setInStockOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                />
                Только в наличии
              </label>
            </div>

            {filterActive && (
              <div className="p-4">
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                  Сбросить фильтры
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ---------------------------- Сетка ---------------------------- */}
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600" aria-live="polite">
            {visible.size === items.length
              ? pluralize(items.length, "товар", "товара", "товаров")
              : `Показано ${visible.size} из ${items.length}`}
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Сортировка:
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 focus:border-brand-600 focus:outline-none"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.size === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-base font-semibold text-slate-900">
              Под эти условия ничего не подошло
            </p>
            <p className="mt-1.5 text-sm text-slate-600">
              Попробуйте расширить диапазон цены или снять фильтр по бренду.
            </p>
            <button type="button" onClick={reset} className="btn-primary mt-5">
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {items.map((item, position) => (
              <div
                key={item.id}
                // order позволяет сортировать, не перестраивая дерево: React
                // не размонтирует карточки, браузер не перезагружает фото.
                style={{ order: orderById.get(item.id) ?? 999 }}
                // flex, чтобы карточка растянулась на всю высоту ячейки сетки.
                className={visible.has(item.id) ? "flex" : "hidden"}
              >
                {cards[position]}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
