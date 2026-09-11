import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { CategoryView, categoryMetadata } from "@/components/CategoryView";
import { getCategories, getCategoryById, getCategoryBySlug } from "@/lib/catalog";
import { findRedirect } from "@/lib/redirects";

/**
 * Подраздел: /catalog/aksessuary/maski/.
 *
 * Slug раздела уникален на весь сайт, так что найти подраздел можно и по
 * одному только второму сегменту. Родителя всё равно проверяем: без этого
 * /catalog/lampy/maski/ отдавал бы ту же страницу, что и
 * /catalog/aksessuary/maski/, — сколько разделов, столько и дублей.
 */

export function generateStaticParams() {
  return getCategories()
    .filter((category) => category.parentId)
    .map((category) => ({
      category: getCategoryById(category.parentId!)?.slug ?? "",
      sub: category.slug,
    }))
    .filter((params) => params.category);
}

interface PageProps {
  params: Promise<{ category: string; sub: string }>;
}

/** Подраздел вместе с проверкой, что он лежит именно в этом родителе. */
function resolve(parentSlug: string, slug: string) {
  const category = getCategoryBySlug(slug);
  if (!category?.parentId) return undefined;
  const parent = getCategoryById(category.parentId);
  return parent?.slug === parentSlug ? category : undefined;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category: parentSlug, sub } = await params;
  const category = resolve(parentSlug, sub);
  return category ? categoryMetadata(category) : {};
}

export default async function SubCategoryPage({ params }: PageProps) {
  const { category: parentSlug, sub } = await params;
  const category = resolve(parentSlug, sub);
  if (!category) {
    // Переименовали родителя или сам подраздел — адрес поменялся целиком.
    const target = findRedirect(`/catalog/${parentSlug}/${sub}/`);
    if (target) permanentRedirect(target);
    notFound();
  }

  return <CategoryView category={category} />;
}
