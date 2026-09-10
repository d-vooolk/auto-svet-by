/**
 * Чтение необязательных переменных окружения.
 *
 * Зачем отдельная функция вместо привычного `process.env.X ?? "по умолчанию"`.
 *
 * Оператор `??` подставляет запасное значение только для `null` и
 * `undefined`. А переменная, объявленная в .env но не заполненная, даёт
 * пустую строку — она проверку проходит и уезжает дальше как настоящее
 * значение. Причём выглядит это в .env совершенно безобидно:
 *
 *     DATABASE_PATH=
 *
 * Такая строка ломается по-разному и всегда неочевидно. С путём к базе
 * приложение открывает не файл, а безымянную временную базу: миграции
 * проходят, ошибок нет, но каталог пуст, потому что данные лежат в другом
 * месте. С числом ещё хуже — `Number("")` это ноль, и `ORDER_RATE_LIMIT=`
 * молча запрещает вообще все заказы.
 *
 * Поэтому правило одно: пустая строка означает «не задано». Заодно
 * обрезаем пробелы — `TOKEN= abc` встречается чаще, чем хотелось бы.
 */

/**
 * @template {string | undefined} T
 * @param {string} name
 * @param {T} fallback
 * @returns {string | T}
 */
export function env(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = raw.trim();
  return value === "" ? fallback : value;
}

/**
 * То же для чисел. Нечисловое значение считаем не заданным, а не нулём:
 * опечатка в настройке не должна оборачиваться лимитом в ноль заявок.
 *
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
export function envNumber(name, fallback) {
  const value = env(name, undefined);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
