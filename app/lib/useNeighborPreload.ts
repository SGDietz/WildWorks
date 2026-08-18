"use client";

import { useEffect } from "react";

type PreloadItem = { src?: unknown } | string | null | undefined;

function resolveSrc(item: PreloadItem): string | null {
  if (!item) return null;
  if (typeof item === "string") return item;
  const src = (item as { src?: unknown }).src;
  if (typeof src === "string") return src;
  // next/image static imports resolve to { src, width, height, ... }
  if (src && typeof src === "object" && typeof (src as { src?: unknown }).src === "string") {
    return (src as { src: string }).src;
  }
  return null;
}

/**
 * Warm the neighbours of the open lightbox image.
 *
 * Why this exists: ImageLightbox receives a single `src` and has no knowledge of
 * the list, so it cannot preload anything itself. Each parent that owns
 * (images, index) calls this. Previous/next and swipe were fetching cold at
 * `sizes="100vw"`, `quality={94}` only AFTER the gesture, which is the roughness
 * G reported on iPad landscape.
 *
 * Deliberately narrow:
 *  - no-op while the viewer is closed (index === null), so nothing is fetched
 *    on a page that never opens a picture
 *  - wraps with modulo so the first and last items warm each other, matching the
 *    existing wrap-around navigation
 *  - decoding="async" + fetchPriority="low" so warming never competes with the
 *    image the visitor is actually looking at
 *  - browser cache does the deduping; repeated forward/back navigation re-warms
 *    the same URLs and costs nothing after the first pass
 *
 * Changes nothing about order, crop, quality, zoom/pan, controls, captions, or
 * the L01 background scroll lock. It only starts a fetch earlier.
 */
export function useNeighborPreload(images: readonly PreloadItem[], index: number | null): void {
  useEffect(() => {
    if (index === null) return;
    if (!Array.isArray(images) || images.length < 2) return;

    const total = images.length;
    const wanted = [(index + 1) % total, (index - 1 + total) % total];
    const created: HTMLImageElement[] = [];

    for (const i of wanted) {
      if (i === index) continue;
      const src = resolveSrc(images[i]);
      if (!src) continue;
      const img = new window.Image();
      img.decoding = "async";
      // fetchPriority is not in older TS DOM libs; assign defensively.
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
      img.src = src;
      created.push(img);
    }

    return () => {
      // Drop references so an in-flight warm for a closed viewer can be collected.
      for (const img of created) img.src = "";
    };
  }, [images, index]);
}

export const __preloadTestUtils = { resolveSrc };
