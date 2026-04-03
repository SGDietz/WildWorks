"use client";

import Image from "next/image";
import { useState, useCallback } from "react";

const IMAGES_PER_PAGE = 12;
const GALLERY_IMAGES = Array.from(
  { length: 52 },
  (_, i) => `/${String(i + 1).padStart(2, "0")}.jpg`
).reverse();

export default function ImageGallery() {
  const [currentPage, setCurrentPage] = useState(1);
  const [aspectRatios, setAspectRatios] = useState<Record<string, string>>({});
  const totalPages = Math.ceil(GALLERY_IMAGES.length / IMAGES_PER_PAGE);
  const start = (currentPage - 1) * IMAGES_PER_PAGE;
  const images = GALLERY_IMAGES.slice(start, start + IMAGES_PER_PAGE).sort((a, b) => a.localeCompare(b)).reverse();

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>, src: string) => {
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w && h)
        setAspectRatios((prev) => ({ ...prev, [src]: `${w} / ${h}` }));
    },
    []
  );


  return (
    <section className="discordSection discordSection--2 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Masonry-style columns: each cell's aspect ratio matches its image so object-contain has no letterboxing */}
        <div className="columns-2 gap-2 sm:columns-3 md:columns-4 md:gap-3">
          {images.map((src, i) => (
            <div
              key={`${currentPage}-${src}`}
              className="relative mb-2 overflow-hidden border border-black bg-zinc-900 break-inside-avoid md:mb-3"
              style={{
                aspectRatio: aspectRatios[src] ?? "16/9",
              }}
            >
              <Image
                src={src}
                alt={`Wildfire project ${start + i + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                onLoad={(e) => handleLoad(e, src)}
              />
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-2 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-gray-500 transition-opacity hover:bg-white/90 cursor-pointer ${currentPage === 1 ? "hidden" : ""}`}
          >
            <span className="text-lg font-medium">&lt;</span>
          </button>


          <div className="flex items-center gap-3">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-medium underline transition-colors cursor-pointer ${
                    currentPage === page
                      ? "border border-white text-white"
                      : "text-white hover:text-cyan-300"
                  }`}
                >
                  {page}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-gray-600 transition-opacity hover:bg-white/90 cursor-pointer ${currentPage === totalPages ? "hidden" : ""}`}
          >
            <span className="text-lg font-medium">&gt;</span>
          </button>
        </div>
      </div>
    </section>
  );
}
