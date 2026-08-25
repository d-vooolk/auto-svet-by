#!/usr/bin/env node
/**
 * Администратор магазина: создать или сменить пароль.
 *
 *   npm run admin -- --login volk               спросит пароль скрытым вводом
 *   npm run admin -- --login volk --password …  без вопросов (для скриптов)
 *   npm run admin -- --list                     кто вообще заведён
 *
 * Почему консоль, а не страница «первичной настройки» на сайте: страница
 * создания первого администратора открыта ровно до момента, пока её не
 * использовали, и если о ней забыть после деплоя — админку заведёт себе
 * первый, кто до неё дойдёт. Скрипт на сервере такой дыры не оставляет.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import { openDatabase } from "../src/lib/migrations.mjs";
import { checkPasswordStrength, hashPassword } from "../src/lib/password.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(ROOT, "var", "shop.db");

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = openDatabase(Database, DB_PATH);

/* ------------------------------------------------------------------ */

if (process.argv.includes("--list")) {
  const rows = db
    .prepare("SELECT login, created_at, last_login_at FROM users ORDER BY id")
    .all();

  if (!rows.length) {
    console.log("[admin] администраторов пока нет");
  } else {
    for (const row of rows) {
      const created = new Date(row.created_at).toLocaleString("ru-RU");
      const last = row.last_login_at
        ? new Date(row.last_login_at).toLocaleString("ru-RU")
        : "ни разу";
      console.log(`  ${row.login}\n    заведён: ${created}\n    входил:  ${last}`);
    }
  }
  db.close();
  process.exit(0);
}

const login = (arg("login") ?? "").trim().toLowerCase();

if (!login) {
  console.error(
    "\n[admin] Укажите логин:\n" +
      "        npm run admin -- --login ваш-логин\n\n" +
      "        Посмотреть заведённых: npm run admin -- --list\n",
  );
  process.exit(1);
}

if (!/^[a-z0-9._-]{3,40}$/.test(login)) {
  console.error(
    "\n[admin] Логин: латиница, цифры, точка, дефис, подчёркивание, 3–40 символов.\n",
  );
  process.exit(1);
}

/** Ввод пароля без отображения на экране. */
function askPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Подменяем вывод: readline печатает каждый введённый символ, а пароль в
    // истории терминала и на экране за спиной нам не нужен.
    const output = rl.output;
    let muted = false;
    rl._writeToOutput = (text) => {
      if (!muted || text.includes(question)) output.write(text);
    };

    rl.question(question, (answer) => {
      rl.close();
      output.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

const provided = arg("password");
const password = provided ?? (await askPassword("Новый пароль: "));

if (!provided) {
  const again = await askPassword("Ещё раз: ");
  if (again !== password) {
    console.error("\n[admin] Пароли не совпали.\n");
    process.exit(1);
  }
}

const weak = checkPasswordStrength(password);
if (weak) {
  console.error(`\n[admin] ${weak}\n`);
  process.exit(1);
}

const existing = db.prepare("SELECT id FROM users WHERE login = ?").get(login);

if (existing) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    hashPassword(password),
    existing.id,
  );
  // Все прежние сессии этого администратора закрываем: смена пароля должна
  // выкидывать того, кто мог войти со старым.
  const closed = db
    .prepare("DELETE FROM sessions WHERE user_id = ?")
    .run(existing.id).changes;
  console.log(
    `[admin] пароль для «${login}» изменён` +
      (closed ? `, закрыто активных сессий: ${closed}` : ""),
  );
} else {
  db.prepare(
    "INSERT INTO users (login, password_hash, created_at) VALUES (?, ?, ?)",
  ).run(login, hashPassword(password), Date.now());
  console.log(`[admin] администратор «${login}» заведён. Вход: /admin/`);
}

db.close();
