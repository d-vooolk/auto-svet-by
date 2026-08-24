/**
 * Поиск по каталогу.
 *
 * Индекс собирается на сборке в public/search-index.json и подгружается
 * лениво — только когда пользователь дотронулся до поля поиска. На главной
 * и в каталоге его вес не влияет ни на что.
 *
 * Ключи в индексе однобуквенные: при 300+ товарах разница между "title" и
 * "t" в каждой записи — это десятки килобайт.
 */

export interface SearchEntry {
  /** slug товара */
  s: string;
  /** title */
  t: string;
  /** brand */
  b?: string;
  /** название категории */
  c: string;
  /** минимальная цена */
  p: number;
  /** есть ли варианты в наличии */
  a: 0 | 1;
  /** URL миниатюры */
  i?: string;
  /** нормализованная строка, по которой ищем */
  q: string;
}

/** Раскладка: «р7» набрано в русской раскладке вместо «h7». */
const LAYOUT: Record<string, string> = {
  й: "q", ц: "w", у: "e", к: "r", е: "t", н: "y", г: "u", ш: "i", щ: "o",
  з: "p", х: "[", ъ: "]", ф: "a", ы: "s", в: "d", а: "f", п: "g", р: "h",
  о: "j", л: "k", д: "l", ж: ";", э: "'", я: "z", ч: "x", с: "c", м: "v",
  и: "b", т: "n", ь: "m", б: ",", ю: ".",
};

export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/** Тот же текст, но как если бы его набрали в латинской раскладке. */
function asLatinLayout(text: string): string {
  let converted = "";
  let changed = false;
  for (const char of text) {
    const mapped = LAYOUT[char];
    if (mapped) {
      converted += mapped;
      changed = true;
    } else {
      converted += char;
    }
  }
  return changed ? converted : "";
}

/**
 * Все токены запроса должны найтись в записи (логическое И). Для каталога
 * автосвета это лучше нечёткого поиска: «линза 3 дюйма» должно сузить
 * выборку, а не расширить её до всех линз.
 */
export function searchProducts(
  index: SearchEntry[],
  query: string,
  limit = 8,
): SearchEntry[] {
  const normalized = normalize(query);
  if (normalized.length < 2) return [];

  const variants = [normalized];
  const latin = asLatinLayout(normalized);
  if (latin) variants.push(latin);

  const matches: Array<{ entry: SearchEntry; score: number }> = [];

  for (const entry of index) {
    let best = -1;

    for (const variant of variants) {
      const tokens = variant.split(" ").filter(Boolean);
      if (!tokens.every((token) => entry.q.includes(token))) continue;

      // Совпадение в начале названия ценнее совпадения где-то в описании,
      // а товар в наличии — ценнее отсутствующего.
      let score = 0;
      const title = normalize(entry.t);
      if (title.startsWith(variant)) score += 100;
      else if (title.includes(variant)) score += 50;
      if (entry.a) score += 10;
      best = Math.max(best, score);
    }

    if (best >= 0) matches.push({ entry, score: best });
  }

  return matches
    .sort((a, b) => b.score - a.score || a.entry.p - b.entry.p)
    .slice(0, limit)
    .map((match) => match.entry);
}
