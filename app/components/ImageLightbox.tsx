"use client";

import Image, { type ImageProps } from "next/image";
import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import BrandText from "./BrandText";

type ImageLightboxProps = {
  open: boolean;
  src: ImageProps["src"];
  alt: string;
  title?: string;
  onClose: () => void;
};

export default function ImageLightbox({
  open,
  src,
  alt,
  title,
  onClose,
}: ImageLightboxProps) {
  const visibleTitle = title?.trim();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="wild-image-lightbox discordSection discordSection--lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? alt}
    >
      <div
        className={`wild-image-lightbox__bar${visibleTitle ? "" : " wild-image-lightbox__bar--close-only"}`}
      >
        {visibleTitle ? (
          <span>
            <BrandText>{visibleTitle}</BrandText>
          </span>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close enlarged image">
          <X aria-hidden className="h-6 w-6" />
        </button>
      </div>
      <button
        type="button"
        className="wild-image-lightbox__stage"
        onClick={onClose}
        aria-label="Close enlarged image"
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="100vw"
          quality={94}
        />
      </button>
    </div>,
    document.body,
  );
}
