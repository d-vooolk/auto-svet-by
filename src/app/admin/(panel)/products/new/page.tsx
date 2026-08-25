import { ProductForm } from "@/components/admin/ProductForm";
import { getSite } from "@/lib/catalog";
import type { Product } from "@/lib/schema";
import { listCategoriesBrief } from "@/lib/store";

export const metadata = { title: "Новый товар" };

/** Заготовка нового товара: обязательные поля есть, остальное пусто. */
const BLANK: Product = {
  id: "",
  slug: "",
  categoryId: "",
  title: "",
  price: 0,
  inStock: true,
  images: [],
  specs: [],
  optionGroups: [],
  tags: [],
};

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function NewProductPage({ searchParams }: PageProps) {
  const { category } = await searchParams;
  const categories = listCategoriesBrief();
  const site = getSite();

  return (
    <ProductForm
      // Если пришли из конкретного раздела, он уже выбран — одно действие меньше.
      product={{ ...BLANK, categoryId: category ?? categories[0]?.id ?? "" }}
      categories={categories}
      thumbs={{}}
      currencySymbol={site.currencySymbol}
    />
  );
}
