import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Корзина у каждого своя, страница успеха существует лишь секунду
        // после отправки — в индексе им делать нечего.
        disallow: ["/cart/", "/order/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
