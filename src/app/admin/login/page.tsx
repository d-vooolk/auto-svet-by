import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/admin/LoginForm";
import { hasAdmin } from "@/lib/auth";
import { getSite } from "@/lib/catalog";

/**
 * Вход в админку.
 *
 * Живёт вне группы (panel), поэтому проверку сессии не наследует — иначе
 * страница входа бесконечно перенаправляла бы саму на себя.
 */

export const metadata: Metadata = {
  title: "Вход",
  // Страницу входа в поиске видеть незачем.
  robots: { index: false, follow: false },
};

// Форма зависит от состояния базы (заведён ли администратор), поэтому
// кешировать её нельзя.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const site = getSite();
  const ready = hasAdmin();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight text-brand-900">
            {site.name}
          </p>
          <p className="mt-1 text-sm text-brand-500">Панель управления</p>
        </div>

        {ready ? (
          <LoginForm next={next ?? ""} />
        ) : (
          <div className="card p-5 text-sm leading-relaxed text-brand-600">
            <p className="mb-3 font-semibold text-brand-900">
              Администратор ещё не заведён
            </p>
            <p>Выполните на сервере, в папке с сайтом:</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-brand-900 px-4 py-3 text-xs text-brand-100">
              npm run admin -- --login ваш-логин
            </pre>
            <p className="mt-3 text-brand-500">
              Команда спросит пароль и заведёт учётную запись. После этого
              обновите страницу.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-brand-400">
          <Link href="/" className="hover:text-brand-600">
            ← Вернуться на сайт
          </Link>
        </p>
      </div>
    </div>
  );
}
