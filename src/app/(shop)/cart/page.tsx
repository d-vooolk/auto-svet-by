import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CartCheckout } from "@/components/CartCheckout";
import { getSite } from "@/lib/catalog";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Корзина и оформление заказа",
    description:
      "Оформление заказа без онлайн-оплаты: выберите способ получения, оставьте телефон — менеджер перезвонит и подтвердит наличие.",
    path: "/cart/",
    // Содержимое корзины у каждого своё, индексировать нечего.
    noIndex: true,
  });
}

export default function CartPage() {
  const site = getSite();

  return (
    <div className="container-page">
      <Breadcrumbs items={[{ label: "Корзина" }]} />

      <h1 className="mb-7 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        Корзина
      </h1>

      <CartCheckout
        currencySymbol={site.currencySymbol}
        currency={site.currency}
        deliveryMethods={site.delivery.methods}
        payment={site.payment}
        orderEndpoint={site.orderEndpoint}
        phone={site.phone}
        phoneHref={site.phoneHref}
        telegram={site.telegram}
      />
    </div>
  );
}
