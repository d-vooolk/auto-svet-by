import { MediaGrid } from "@/components/admin/MediaGrid";
import { listImages } from "@/lib/images";

export const metadata = { title: "Фотографии" };

/**
 * Все загруженные фотографии.
 *
 * Здесь их можно догрузить впрок и подчистить лишние. Обычно фото добавляют
 * прямо в карточке товара — эта страница нужна, когда надо посмотреть, что
 * вообще лежит, и убрать мусор.
 */
export default function MediaPage() {
  const images = listImages();

  const items = images.map((image) => ({
    path: image.path,
    thumb: image.sources.webp?.[0]?.url ?? image.fallback,
    w: image.w,
    h: image.h,
    bytes: image.bytes,
    createdAt: image.createdAt,
  }));

  const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-900">
          Фотографии{" "}
          <span className="tnum text-base font-medium text-slate-500">
            {items.length}
          </span>
        </h1>
        <p className="text-sm text-slate-500">
          Занимают на диске{" "}
          <span className="tnum">{(totalBytes / 1024 / 1024).toFixed(1)} МБ</span>{" "}
          во всех форматах и размерах
        </p>
      </div>

      <MediaGrid items={items} />
    </div>
  );
}
