import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getSite } from "@/lib/catalog";

import "./globals.css";

/**
 * Шрифт скачивается на сборке и раздаётся с нашего домена: нет запроса к
 * fonts.googleapis.com, нет лишнего DNS-резолва и TLS-хендшейка перед
 * отрисовкой текста. display: swap — текст видно сразу системным шрифтом.
 */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
  // Метрики системного шрифта подгоняются под Inter, чтобы при подмене
  // текст не «прыгал» — это убирает CLS от загрузки шрифта.
  adjustFontFallback: true,
});

const site = getSite();

export const metadata: Metadata = {
  // База для canonical и og:image — без неё Next оставит относительные пути,
  // а соцсети и краулеры их не поймут.
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline.toLowerCase()} в Минске`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.legalName }],
  keywords: [
    "автосвет",
    "линзы для фар",
    "би-лед линзы",
    "стёкла фар",
    "автомобильные лампы",
    "блоки розжига",
    "Минск",
    "Беларусь",
  ],
  formatDetection: { telephone: true },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: site.locale,
    url: site.url,
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="flex min-h-dvh flex-col">
        {/* Ссылка для клавиатуры и скринридеров: позволяет пропустить шапку
            с меню и поиском и уйти сразу к содержимому страницы. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
        >
          К содержимому
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
