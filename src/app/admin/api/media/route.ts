import { getAdmin } from "@/lib/auth";
import { listImages } from "@/lib/images";

/**
 * Список загруженных фотографий для выбора в формах.
 *
 * Отдаётся отдельным запросом, а не пропсом страницы, намеренно: галерея из
 * пары тысяч снимков уехала бы в HTML каждой формы товара, хотя открывают её
 * далеко не всегда. Здесь она загружается в момент, когда нажали «Выбрать
 * из загруженных».
 *
 * Размытые заглушки (blur) в ответ не попадают — это самая тяжёлая часть
 * записи, а в сетке миниатюр она не нужна.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) {
    return Response.json({ error: "Нужно войти заново" }, { status: 401 });
  }

  const images = listImages().map((image) => ({
    path: image.path,
    thumb: image.sources.webp?.[0]?.url ?? image.fallback,
    w: image.w,
    h: image.h,
    bytes: image.bytes,
    createdAt: image.createdAt,
  }));

  return Response.json({ images });
}
