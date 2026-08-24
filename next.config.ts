import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Полностью статический экспорт: `next build` кладёт готовый сайт в ./out,
  // который раздаётся nginx напрямую с диска. Никакого Node в рантайме.
  output: "export",

  // /catalog/linzy/ -> out/catalog/linzy/index.html
  // nginx отдаёт такие адреса без единой строчки конфига для роутинга.
  trailingSlash: true,

  // Встроенный оптимизатор картинок требует сервер и при экспорте недоступен.
  // Вместо него все размеры и форматы генерируются на билде: scripts/images.mjs
  images: { unoptimized: true },

  // Ошибки типов должны валить сборку, а не уезжать в прод.
  // Линт в Next 16 из сборки вынесен — он запускается отдельно: npm run check
  typescript: { ignoreBuildErrors: false },

  productionBrowserSourceMaps: false,
};

/**
 * Только для `next dev`: проксируем /api/order на локальный сервис заказов,
 * чтобы оформление можно было проверить целиком, не поднимая nginx.
 *
 * В собранный сайт это не попадает — при статическом экспорте rewrites не
 * существует, там тот же адрес проксирует nginx (см. deploy/nginx.conf).
 */
if (process.env.NODE_ENV === "development") {
  const target =
    process.env.ORDER_SERVICE_URL ?? "http://127.0.0.1:8787/api/order";
  nextConfig.rewrites = async () => [
    // Оба варианта адреса: из-за trailingSlash dev-сервер отвечает на
    // /api/order редиректом на /api/order/, и правило должно поймать оба.
    // В бою этого нет — там точный адрес разбирает nginx.
    { source: "/api/order", destination: target },
    { source: "/api/order/", destination: target },
  ];
}

export default nextConfig;
