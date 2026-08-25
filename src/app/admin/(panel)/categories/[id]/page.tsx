import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/admin/CategoryForm";
import { thumbsFor } from "@/lib/admin-thumbs";
import { getCategoryRaw, listCategoriesBrief } from "@/lib/store";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: getCategoryRaw(id)?.name ?? "Раздел" };
}

export default async function EditCategoryPage({ params }: PageProps) {
  const { id } = await params;
  const category = getCategoryRaw(id);
  if (!category) notFound();

  // Сколько товаров внутри — от этого зависит, можно ли раздел удалить.
  const count =
    listCategoriesBrief().find((entry) => entry.id === id)?.count ?? 0;

  return (
    <CategoryForm
      category={category}
      previousId={category.id}
      thumbs={thumbsFor(category.image ? [category.image] : [])}
      productCount={count}
    />
  );
}
