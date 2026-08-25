import crypto from "node:crypto";

/**
 * Хеширование пароля администратора.
 *
 * scrypt, а не bcrypt/argon2 — потому что он встроен в Node и не тянет
 * нативную зависимость. Параметры (N=16384) дают около 100 мс на проверку:
 * человеку при входе незаметно, а перебору мешает капитально.
 *
 * Формат строки в базе:
 *   scrypt$N$r$p$<соль base64>$<хеш base64>
 *
 * Параметры лежат внутри самой строки, поэтому их можно будет поднять со
 * временем: старые хеши продолжат проверяться со своими значениями.
 *
 * Файл на чистом JavaScript: его используют и приложение (src/lib/auth.ts), и
 * скрипт scripts/admin.mjs, заводящий администратора на сервере.
 */

// maxmem задан явно и с запасом: лимит по умолчанию (32 МБ) упирается в
// потребности scrypt уже при следующем шаге N, и поднимать N было бы нельзя.
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 256 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(
    password.normalize("NFKC"),
    salt,
    PARAMS.keylen,
    PARAMS,
  );
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

export function verifyPassword(password, stored) {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (!expected.length) return false;

  let actual;
  try {
    actual = crypto.scryptSync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      // Без этого scrypt отказывается работать при больших N: памяти по
      // умолчанию (32 МБ) ему не хватает.
      maxmem: 256 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  // Сравнение за постоянное время: обычное === выходит из цикла на первом
  // несовпавшем байте, и по времени ответа пароль можно подбирать посимвольно.
  return (
    actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  );
}

/**
 * Требования к паролю. Намеренно мягкие: это админка одного магазина за
 * ограничением на число попыток, а не банк. Длина работает лучше правил про
 * спецсимволы.
 */
export function checkPasswordStrength(password) {
  if (password.length < 10) {
    return "Пароль должен быть не короче 10 символов";
  }
  if (/^\d+$/.test(password)) {
    return "Пароль из одних цифр подбирается за минуты — добавьте буквы";
  }
  return null;
}
