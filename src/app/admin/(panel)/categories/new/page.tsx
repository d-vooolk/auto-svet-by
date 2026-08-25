import { CategoryForm } from "@/components/admin/CategoryForm";
import { getCategories } from "@/lib/catalog";

export const metadata = { title: "Новый раздел" };

export default function NewCategoryPage() {
  const categories = getCategories();

  // Новый раздел встаёт в конец меню: шаг 10 оставляет место, чтобы потом
  // можно было вписать раздел между существующими, не переставляя все.
  const nextOrder =
    categories.reduce((max, category) => Math.max(max, category.order ?? 0), 0) +
    10;

  return (
    <CategoryForm
      category={{ id: "", slug: "", name: "", order: nextOrder }}
      thumbs={{}}
      productCount={0}
    />
  );
}
