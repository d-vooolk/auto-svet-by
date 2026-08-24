/**
 * Форматирование цен.
 *
 * Собираем строку руками, а не через Intl.NumberFormat: реализации Intl в
 * Node и в браузере ставят разные пробелы-разделители, и React ловит это как
 * ошибку гидратации. Ручной вариант даёт одинаковый результат везде.
 */

const NBSP = " ";

/** 1234.5 -> «1 234,50» */
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const negative = rounded < 0;
  const absolute = Math.abs(rounded);

  const whole = Math.floor(absolute);
  const cents = Math.round((absolute - whole) * 100);

  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const body = cents === 0 ? grouped : `${grouped},${String(cents).padStart(2, "0")}`;

  return negative ? `−${body}` : body;
}

/** 1234.5 -> «1 234,50 р.» */
export function formatPrice(value: number, symbol = "р."): string {
  return `${formatAmount(value)}${NBSP}${symbol}`;
}

/** Для атрибутов schema.org, где нужна точка и никаких пробелов. */
export function schemaPrice(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** «1 товар» / «3 товара» / «5 товаров» */
export function plural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function pluralize(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  return `${count} ${plural(count, one, few, many)}`;
}
