import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSiteRaw } from "@/lib/store";

export const metadata = { title: "Настройки" };

export default function SettingsPage() {
  const site = getSiteRaw();

  if (!site) {
    return (
      <p className="card p-10 text-center text-sm text-slate-500">
        Настройки сайта не найдены. Залейте начальные данные командой{" "}
        <code className="rounded bg-slate-100 px-1">npm run import</code>.
      </p>
    );
  }

  return <SettingsForm site={site} />;
}
