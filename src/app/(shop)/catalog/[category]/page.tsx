import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryView, categoryMetadata } from "@/components/CategoryView";
import { getCategoryBySlug, getRootCategories } from "@/lib/catalog";

/**
 * Раздел верхнего уровня — основная точка входа из поиска.
 *
 * Подразделы сюда не попадают: у них свой адрес, /catalog/родитель/раздел/.
 * Если открыть подраздел по короткому адресу, страница отдаёт 404, а не
 * дубль — иначе один и тот же товарный список был бы доступен по двум
 * адресам, и поисковик сам решал бы, какой из них показывать.
 */

export function generateStaticParams() {
  return getRootCategories().map((category) => ({ category: category.slug }));
}

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category || category.parentId) return {};
  return categoryMetadata(category);
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category || category.parentId) notFound();

  return <CategoryView category={category} />;
}
