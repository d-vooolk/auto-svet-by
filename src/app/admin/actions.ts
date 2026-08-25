"use server";

import { join } from "node:path";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getCategoryById, invalidateCatalog } from "@/lib/catalog";
import { removeImageFiles } from "@/lib/image-pipeline.mjs";
import { deleteImage, getImage, imageUsage } from "@/lib/images";
import { isOrderStatus } from "@/lib/order-types";
import { deleteOrder, setOrderNote, setOrderStatus } from "@/lib/orders";
import {
  revalidateCategory,
  revalidateImages,
  revalidateProduct,
  revalidateSite,
} from "@/lib/revalidate";
import {
  deleteCategory,
  deleteProduct,
  getCategoryRaw,
  getProductRaw,
  reorderCategories,
  reorderProducts,
  saveCategory,
  saveProduct,
  saveSite,
  setProductFlag,
  type SaveResult,
} from "@/lib/store";
import { login, logout, requireAdmin } from "@/lib/auth";

/**
 * Действия админки.
 *
 * Каждое начинается с requireAdmin(). Это не перестраховка: Server Actions —
 * обычные POST-адреса, до них можно достучаться в обход интерфейса, а
 * проверка в proxy.ts смотрит только на наличие куки. Настоящая проверка
 * сессии — здесь.
 *
 * Данные приходят готовыми объектами, а не FormData: у товара внутри опции с
 * вложенными значениями и галереями, и раскладывать такое по полям формы
 * значило бы собирать его обратно вручную с обеих сторон. Проверяет объекты
 * всё равно zod в src/lib/store.ts, так что доверия входным данным не больше,
 * чем при FormData.
 */

export interface FormState {
  ok: boolean;
  problems: string[];
  /** Отметка времени: по ней интерфейс понимает, что ответ новый. */
  at: number;
}

const ok = (): FormState => ({ ok: true, problems: [], at: Date.now() });
const fail = (problems: string[]): FormState => ({
  ok: false,
  problems,
  at: Date.now(),
});

function toState(result: SaveResult): FormState {
  return result.ok ? ok() : fail(result.problems);
}

/* ------------------------------------------------------------------ */
/* Вход и выход                                                        */
/* ------------------------------------------------------------------ */

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!name || !password) return fail(["Заполните логин и пароль"]);

  const userAgent = (await headers()).get("user-agent") ?? "";
  const result = await login(name, password, userAgent);

  if (!result.ok) return fail([result.error]);

  // Возвращаем туда, откуда человека развернули на форму входа. Чужие адреса
  // сюда подставить нельзя: берём только путь внутри админки.
  redirect(next.startsWith("/admin") ? next : "/admin/");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login/");
}

/* ------------------------------------------------------------------ */
/* Товары                                                              */
/* ------------------------------------------------------------------ */

export async function saveProductAction(
  input: unknown,
  previousId?: string,
): Promise<FormState> {
  await requireAdmin();

  // Адреса, по которым товар был доступен до правки: если поменяли slug или
  // перенесли в другой раздел, старые страницы тоже надо пересобрать.
  const before = previousId ? getProductRaw(previousId) : null;
  const beforeCategory = before
    ? getCategoryRaw(before.categoryId)?.slug
    : undefined;

  const result = saveProduct(input, previousId);
  if (!result.ok) return toState(result);

  const product = input as { slug: string; categoryId: string };
  invalidateCatalog();

  revalidateProduct(product.slug, getCategoryById(product.categoryId)?.slug, {
    slug: before?.slug,
    categorySlug: beforeCategory,
  });

  return ok();
}

export async function deleteProductAction(id: string): Promise<FormState> {
  await requireAdmin();

  const product = getProductRaw(id);
  if (!product) return fail(["Товар не найден"]);

  const categorySlug = getCategoryRaw(product.categoryId)?.slug;
  deleteProduct(id);
  invalidateCatalog();
  revalidateProduct(product.slug, categorySlug);

  redirect("/admin/products/");
}

export async function toggleProductAction(
  id: string,
  flag: "inStock" | "featured",
  value: boolean,
): Promise<FormState> {
  await requireAdmin();

  const product = getProductRaw(id);
  if (!product) return fail(["Товар не найден"]);

  setProductFlag(id, flag, value);
  invalidateCatalog();
  revalidateProduct(product.slug, getCategoryRaw(product.categoryId)?.slug);

  return ok();
}

export async function reorderProductsAction(ids: string[]): Promise<FormState> {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return fail(["Некорректный порядок"]);
  }

  reorderProducts(ids);
  invalidateCatalog();

  const first = getProductRaw(ids[0] ?? "");
  revalidateProduct(
    first?.slug ?? "",
    first ? getCategoryRaw(first.categoryId)?.slug : undefined,
  );

  return ok();
}

/* ------------------------------------------------------------------ */
/* Разделы                                                             */
/* ------------------------------------------------------------------ */

export async function saveCategoryAction(
  input: unknown,
  previousId?: string,
): Promise<FormState> {
  await requireAdmin();

  const before = previousId ? getCategoryRaw(previousId) : null;

  const result = saveCategory(input, previousId);
  if (!result.ok) return toState(result);

  invalidateCatalog();
  revalidateCategory((input as { slug: string }).slug, before?.slug);

  return ok();
}

export async function deleteCategoryAction(id: string): Promise<FormState> {
  await requireAdmin();

  const category = getCategoryRaw(id);
  if (!category) return fail(["Раздел не найден"]);

  const result = deleteCategory(id);
  if (!result.ok) return toState(result);

  invalidateCatalog();
  revalidateCategory(category.slug);

  redirect("/admin/categories/");
}

export async function reorderCategoriesAction(
  ids: string[],
): Promise<FormState> {
  await requireAdmin();
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return fail(["Некорректный порядок"]);
  }

  reorderCategories(ids);
  invalidateCatalog();
  revalidateSite(); // порядок разделов виден в меню на каждой странице

  return ok();
}

/* ------------------------------------------------------------------ */
/* Настройки сайта                                                     */
/* ------------------------------------------------------------------ */

export async function saveSiteAction(input: unknown): Promise<FormState> {
  await requireAdmin();

  const result = saveSite(input);
  if (!result.ok) return toState(result);

  invalidateCatalog();
  revalidateSite();

  return ok();
}

/* ------------------------------------------------------------------ */
/* Заказы                                                              */
/* ------------------------------------------------------------------ */

export async function setOrderStatusAction(
  id: number,
  status: string,
): Promise<FormState> {
  await requireAdmin();
  if (!isOrderStatus(status)) return fail(["Неизвестный статус"]);

  setOrderStatus(id, status);
  return ok();
}

export async function setOrderNoteAction(
  id: number,
  note: string,
): Promise<FormState> {
  await requireAdmin();
  setOrderNote(id, String(note ?? ""));
  return ok();
}

export async function deleteOrderAction(id: number): Promise<FormState> {
  await requireAdmin();
  deleteOrder(id);
  redirect("/admin/orders/");
}

/* ------------------------------------------------------------------ */
/* Фотографии                                                          */
/* ------------------------------------------------------------------ */

export async function deleteImageAction(path: string): Promise<FormState> {
  await requireAdmin();

  const entry = getImage(path);
  if (!entry) return fail(["Такой фотографии нет"]);

  // Фото, которое где-то стоит, удалять не даём: на его месте молча появилась
  // бы заглушка, и заметили бы это нескоро.
  const used = imageUsage(path);
  if (used.length) {
    return fail([
      `Фото используется: ${used.slice(0, 5).join(", ")}${
        used.length > 5 ? ` и ещё ${used.length - 5}` : ""
      }. Сначала уберите его оттуда.`,
    ]);
  }

  // Сначала запись, потом файлы: если удаление файлов сорвётся на половине,
  // в public/img останется мусор, но битой ссылки в каталоге не появится.
  deleteImage(path);
  await removeImageFiles(entry, join(process.cwd(), "public"));

  revalidateImages();
  return ok();
}
