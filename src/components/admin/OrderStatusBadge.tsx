import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-types";

/**
 * Цветная метка статуса заказа.
 *
 * Классы перечислены полными строками, а не собраны из кусков: Tailwind ищет
 * имена классов по исходнику текстом, и `bg-${tone}-100` он бы не нашёл — в
 * сборке таких стилей просто не оказалось бы.
 */
const TONES: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-900",
  called: "bg-blue-100 text-blue-900",
  shipped: "bg-violet-100 text-violet-900",
  done: "bg-green-100 text-green-900",
  cancelled: "bg-slate-200 text-slate-600",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUSES.find((entry) => entry.id === status);
  return (
    <span className={`badge shrink-0 ${TONES[status]}`}>
      {meta?.name ?? status}
    </span>
  );
}
