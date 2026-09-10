# Автосвет BY

Интернет-магазин автосвета на Next.js. Каталог, корзина, заказ в Telegram,
админка на `/admin/`. Данные — SQLite в `var/shop.db`.

## Запуск

```bash
npm install --ignore-scripts   # см. примечание ниже
cp .env.example .env           # можно оставить пустым: без токена
                               # заказы просто не уйдут в Telegram
npm run dev                    # http://localhost:3000
```

При первом запуске `predev` сам создаст базу и зальёт в неё каталог из
`data/`. Фотографий в `media/` нет — вместо них будут заглушки, это нормально.

Завести администратора:

```bash
npm run admin -- --login admin      # пароль спросит скрытым вводом
```

## Команды

| | |
|---|---|
| `npm run dev` | разработка |
| `npm run build` + `npm start` | боевой режим |
| `npm run check` | типы и линт |
| `npm run import` | перезалить `data/` в базу |
| `npm run admin -- --list` | кто заведён в админке |
| `npm run backup` | копия базы в `var/backups` |

Проверки ниже требуют запущенного сервера (`npm start` в соседнем окне):

| | |
|---|---|
| `npm run verify` | метатеги, разметка, sitemap |
| `npm run weight` | вес страниц после сжатия |
| `npm run chunks` | что лежит в JS-чанках |
| `npm run test-order` | приём заказов, включая отказы |

## Где что

```
data/        каталог в JSON — источник для npm run import (формат: data/SCHEMA.md)
media/       исходные фотографии (media/README.md)
src/app/     (shop) — витрина, admin — панель
src/lib/     каталог, база, авторизация, заказы, картинки
scripts/     импорт, администратор, бэкап, проверки
deploy/      nginx, systemd, deploy.sh
var/         база и бэкапы (не в репозитории)
```

## Про `--ignore-scripts`

`better-sqlite3` кладёт готовые бинарники прямо в пакет, но npm об этом не
знает и пытается собрать его из исходников — на Windows без Visual Studio
установка на этом падает. Флаг отключает лишнюю сборку; во всём дереве
зависимостей install-скрипт всего один, и он не нужен.

## Деплой

```bash
cd /var/www/auto-svet.by && ./deploy/deploy.sh
```

Сайт запущен под PM2 как приложение `autosvet` на порту 3011 (3000 и 3010
на сервере заняты другими проектами), nginx перед ним обратный прокси.
Node — 22 из nvm: системному 18, а `better-sqlite3` требует 22.

Подробности в шапках `ecosystem.config.cjs`, `deploy/nginx.conf` и
`deploy/deploy.sh`.
