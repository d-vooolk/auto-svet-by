/**
 * Схема базы, шаг за шагом.
 *
 * Добавлять только в конец массива: номер применённой миграции хранится в
 * самой базе (pragma user_version), пройденные шаги повторно не выполняются.
 * Править уже вышедший шаг нельзя — у вас на сервере он давно применён, и
 * правка просто не выполнится.
 *
 * Файл на чистом JavaScript, потому что его читают двое: приложение
 * (src/lib/db.ts) и консольные скрипты, которым TypeScript недоступен.
 */

export const MIGRATIONS = [
  /* 1 — исходная схема */ `
    CREATE TABLE settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE categories (
      id         TEXT PRIMARY KEY,
      slug       TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 999,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE products (
      id          TEXT PRIMARY KEY,
      slug        TEXT NOT NULL UNIQUE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      title       TEXT NOT NULL,
      brand       TEXT NOT NULL DEFAULT '',
      price       REAL NOT NULL,
      in_stock    INTEGER NOT NULL DEFAULT 1,
      featured    INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      data        TEXT NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE INDEX products_by_category ON products(category_id, sort_order, id);

    -- Манифест обработанных фотографий: то, что раньше лежало в
    -- src/generated/images.json. Ключ — путь, который админка пишет в товар.
    CREATE TABLE images (
      path       TEXT PRIMARY KEY,
      w          INTEGER NOT NULL,
      h          INTEGER NOT NULL,
      blur       TEXT NOT NULL,
      sources    TEXT NOT NULL,
      fallback   TEXT NOT NULL,
      bytes      INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at    INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'new',
      name          TEXT NOT NULL,
      phone         TEXT NOT NULL,
      phone_digits  TEXT NOT NULL,
      comment       TEXT NOT NULL DEFAULT '',
      delivery_id   TEXT NOT NULL DEFAULT '',
      delivery_name TEXT NOT NULL DEFAULT '',
      address       TEXT NOT NULL DEFAULT '',
      delivery_cost REAL NOT NULL DEFAULT 0,
      subtotal      REAL NOT NULL,
      total         REAL NOT NULL,
      currency      TEXT NOT NULL DEFAULT 'BYN',
      items         TEXT NOT NULL,
      notes         TEXT NOT NULL DEFAULT '[]',
      ip            TEXT NOT NULL DEFAULT '',
      referer       TEXT NOT NULL DEFAULT '',
      telegram_sent INTEGER NOT NULL DEFAULT 0,
      admin_note    TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX orders_by_date ON orders(created_at DESC);
    CREATE INDEX orders_by_phone ON orders(phone_digits);

    CREATE TABLE users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      login         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      last_login_at INTEGER
    );

    -- В базе лежит хеш токена, а не сам токен. Утечка дампа базы не даёт
    -- возможности зайти в админку под чужой сессией.
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      user_agent TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX sessions_by_expiry ON sessions(expires_at);
  `,
];

/**
 * Догоняет базу до последней версии. Каждый шаг в своей транзакции: если
 * миграция упадёт на середине, база останется на предыдущей версии целиком,
 * а не в полусобранном состоянии.
 */
export function migrate(db) {
  const current = db.pragma("user_version", { simple: true });

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      db.pragma(`user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(
        `Миграция базы №${version + 1} не применилась: ${error.message}`,
      );
    }
  }

  return current;
}

/**
 * Открывает базу с теми же настройками, что и приложение.
 * Используется консольными скриптами; в приложении это делает src/lib/db.ts.
 */
export function openDatabase(Database, file) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  migrate(db);
  return db;
}
