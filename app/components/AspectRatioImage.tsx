"use client";

import Image, { ImageProps } from "next/image";
import { useState, useCallback, type SyntheticEvent } from "react";
import ImageLightbox from "./ImageLightbox";

const DEFAULT_ASPECT = "16 / 9";

type AspectRatioImageProps = Omit<ImageProps, "onLoad"> & {
  onLoad?: ImageProps["onLoad"];
  enlargeable?: boolean;
  lightboxTitle?: string;
};

/**
 * Wraps Next.js Image with a container whose aspect ratio is set from the
 * image's natural dimensions on load. Use with fill + object-contain so the
 * full image is visible with no letterboxing (no space at top/bottom or sides).
 */
export default function AspectRatioImage({
  src,
  alt,
  className = "object-contain object-center",
  onLoad,
  enlargeable = true,
  lightboxTitle,
  ...rest
}: AspectRatioImageProps) {
  const [aspectRatio, setAspectRatio] = useState<string>(DEFAULT_ASPECT);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w && h) setAspectRatio(`${w} / ${h}`);
      onLoad?.(e);
    },
    [onLoad]
  );

  return (
    <div
      className={`relative w-full overflow-hidden${enlargeable ? " wild-zoomable-image" : ""}`}
      style={{ aspectRatio }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        onLoad={handleLoad}
        {...rest}
      />
      {enlargeable ? (
        <>
          <button
            type="button"
            className="wild-zoom-hit-area"
            onClick={() => setIsLightboxOpen(true)}
            aria-label={`Enlarge ${alt}`}
          />
          <ImageLightbox
            open={isLightboxOpen}
            src={src}
            alt={alt}
            title={lightboxTitle}
            onClose={() => setIsLightboxOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
