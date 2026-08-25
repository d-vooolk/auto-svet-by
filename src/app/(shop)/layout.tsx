import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

/**
 * Обрамление витрины: шапка с меню и поиском, подвал с контактами.
 *
 * Раньше это стояло в корневом макете. Переехало сюда, когда в приложении
 * появилась админка: у неё своя навигация, и меню каталога с корзиной над
 * таблицей заказов выглядело бы странно.
 *
 * Группа (shop) в имени папки на адреса не влияет — скобки Next из пути
 * выбрасывает.
 */
export default function ShopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
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
    </div>
  );
}
