"use client";

import Image from "next/image";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  Info,
  Link2,
  MessageCircle,
  Pencil,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type LatestXPostMediaItem = {
  type: string;
  url: string;
  videoUrl?: string;
};

export type LatestXPostPayload = {
  ok: true;
  text: string;
  createdAt: string;
  id: string;
  url: string;
  media: LatestXPostMediaItem[];
  author: {
    name: string;
    username: string;
    profileImageUrl: string;
    verified: boolean;
  };
  likeCount: number;
  edited: boolean;
};

const X_BLUE = "#1d9bf0";
const X_GRAY = "#536471";
const X_PINK = "#f91880";

function OpenOnXIcon({ className }: { className?: string }) {
  return <ArrowUpRight className={className} strokeWidth={2.25} aria-hidden />;
}

function formatPostWhen(iso: string, edited: boolean) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return edited ? `Last edited ${time} · ${date}` : `${time} · ${date}`;
}

type MediaSegment =
  | { kind: "photos"; urls: string[]; startIndex: number }
  | { kind: "video"; item: LatestXPostMediaItem };

function buildMediaSegments(media: LatestXPostMediaItem[]): MediaSegment[] {
  const segments: MediaSegment[] = [];
  let photoUrls: string[] = [];
  let photoStart = 0;
  let globalPhotoIndex = 0;

  const flushPhotos = () => {
    if (photoUrls.length > 0) {
      segments.push({
        kind: "photos",
        urls: photoUrls,
        startIndex: photoStart,
      });
      photoUrls = [];
    }
  };

  for (const m of media) {
    if (m.type === "photo") {
      if (photoUrls.length === 0) photoStart = globalPhotoIndex;
      photoUrls.push(m.url);
      globalPhotoIndex += 1;
    } else {
      flushPhotos();
      segments.push({ kind: "video", item: m });
    }
  }
  flushPhotos();
  return segments;
}

// function WatchOnXLink({
//   href,
//   className,
// }: {
//   href: string;
//   className?: string;
// }) {
//   return (
//     <a
//       href={href}
//       target="_blank"
//       rel="noopener noreferrer"
//       className={
//         className ??
//         "inline-flex items-center justify-center gap-1.5 rounded-full border border-[#cfd9de] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0f1419] shadow-sm transition-colors hover:bg-[#f7f9f9]"
//       }
//     >
//       <OpenOnXIcon className="h-4 w-4" />
//       Watch on X
//     </a>
//   );
// }

function PhotoGrid({
  urls,
  startIndex,
  onOpen,
}: {
  urls: string[];
  startIndex: number;
  onOpen: (globalIndex: number) => void;
}) {
  const n = urls.length;
  if (n === 0) return null;

  const cell = (localIdx: number, className: string) => (
    <button
      key={localIdx}
      type="button"
      onClick={() => onOpen(startIndex + localIdx)}
      className={`wild-media-button relative block w-full overflow-hidden bg-[#0f1419] ${className}`}
    >
      <Image
        src={urls[localIdx]}
        alt=""
        width={1200}
        height={1200}
        className="h-full w-full object-cover"
        sizes="(max-width: 640px) 100vw, 550px"
        unoptimized
      />
    </button>
  );

  if (n === 1) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#253042]">
        {cell(0, "aspect-video sm:aspect-[16/9]")}
      </div>
    );
  }

  if (n === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border border-[#253042]">
        {cell(0, "aspect-square")}
        {cell(1, "aspect-square")}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div className="space-y-0.5 overflow-hidden rounded-2xl border border-[#253042]">
        <div className="w-full">{cell(0, "aspect-[2/1]")}</div>
        <div className="grid grid-cols-2 gap-0.5">
          {cell(1, "aspect-square")}
          {cell(2, "aspect-square")}
        </div>
      </div>
    );
  }

  if (n === 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border border-[#253042]">
        {cell(0, "aspect-square")}
        {cell(1, "aspect-square")}
        {cell(2, "aspect-square")}
        {cell(3, "aspect-square")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl border border-[#253042]">
      {cell(0, "aspect-square")}
      {cell(1, "aspect-square")}
      {cell(2, "aspect-square")}
      <button
        type="button"
        onClick={() => onOpen(startIndex + 3)}
        className="wild-media-button relative aspect-square overflow-hidden bg-black/80"
      >
        <Image
          src={urls[3]}
          alt=""
          width={800}
          height={800}
          className="h-full w-full object-cover opacity-60"
          sizes="275px"
          unoptimized
        />
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
          +{n - 3}
        </span>
      </button>
    </div>
  );
}

/**
 * Native &lt;video&gt; + MP4 URLs from the API cannot play reliably (X CDN 403/416; Vercel proxy brittle).
 * Official embed iframe uses X’s own player — same pattern as the commented block on Home.
 */
function XTweetEmbedIframe({
  tweetId,
  username,
}: {
  tweetId: string;
  username: string;
}) {
  const src = `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(tweetId)}&theme=dark&dnt=true&maxWidth=550`;
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-[#253042] bg-[#0f1419]">
        <iframe
          title={`Post by @${username}`}
          src={src}
          className="h-[min(560px,78vh)] w-full max-w-full border-0 sm:h-[min(520px,75vh)]"
          loading="lazy"
          allowFullScreen
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        />
      </div>
      {/* <div className="flex flex-wrap items-center justify-end gap-2 px-1">
        <WatchOnXLink href={postUrl} />
      </div> */}
    </div>
  );
}

function PhotoLightbox({
  urls,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  urls: string[];
  index: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onPrev, onNext]);

  useEffect(() => {
    if (index === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [index]);

  if (index === null || !urls[index]) return null;

  const node = (
    <div
      className="wild-branded-lightbox discordSection discordSection--lightbox fixed inset-0 z-[100] flex flex-col p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <div className="wild-branded-lightbox-bar flex shrink-0 items-center justify-between gap-2">
        <span className="text-sm tabular-nums opacity-80">
          {index + 1} / {urls.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="wild-branded-lightbox-close rounded-full p-2"
          aria-label="Close"
        >
          <X className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>
      <div className="wild-branded-lightbox-stage relative flex min-h-0 flex-1 items-center justify-center">
        {urls.length > 1 ? (
          <button
            type="button"
            onClick={onPrev}
            className="wild-branded-lightbox-nav absolute left-0 z-10 rounded-full p-2 sm:left-2"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-10 w-10" strokeWidth={1.5} />
          </button>
        ) : null}
        <div className="relative max-h-full max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs native img for dynamic external URLs */}
          <img
            src={urls[index]}
            alt=""
            className="max-h-[min(85vh,900px)] max-w-full object-contain"
          />
        </div>
        {urls.length > 1 ? (
          <button
            type="button"
            onClick={onNext}
            className="wild-branded-lightbox-nav absolute right-0 z-10 rounded-full p-2 sm:right-2"
            aria-label="Next image"
          >
            <ChevronRight className="h-10 w-10" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

export function LatestXPostCard({ data }: { data: LatestXPostPayload }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const avatarSrc = data.author.profileImageUrl
    ? data.author.profileImageUrl.replace("_normal", "_400x400")
    : "";

  const longText = data.text.length > 220;
  const displayText =
    longText && !expanded ? `${data.text.slice(0, 220).trim()}…` : data.text;

  const paragraphs = displayText.split(/\n\n+/).filter((p) => p.trim());

  const onCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("https://x.com/WildWorksArt");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const profileUrl = "https://x.com/WildWorksArt";

  const photoUrls = useMemo(
    () => data.media.filter((m) => m.type === "photo").map((m) => m.url),
    [data.media]
  );

  const segments = useMemo(
    () => buildMediaSegments(data.media),
    [data.media]
  );

  const hasVideo = useMemo(
    () =>
      data.media.some(
        (m) => m.type === "video" || m.type === "animated_gif"
      ),
    [data.media]
  );

  const onOpenLightbox = useCallback((globalIndex: number) => {
    setLightboxIndex(globalIndex);
  }, []);

  const onLightboxPrev = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null || photoUrls.length < 2) return i;
      return (i - 1 + photoUrls.length) % photoUrls.length;
    });
  }, [photoUrls.length]);

  const onLightboxNext = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null || photoUrls.length < 2) return i;
      return (i + 1) % photoUrls.length;
    });
  }, [photoUrls.length]);

  const onCloseLightbox = useCallback(() => setLightboxIndex(null), []);

  return (
    <article
      className="discordSection discordSection--3 mx-auto w-full max-w-[550px] overflow-hidden rounded-2xl border border-[#253042] bg-[#0f1419] text-left shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
      style={{
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <PhotoLightbox
        urls={photoUrls}
        index={lightboxIndex}
        onClose={onCloseLightbox}
        onPrev={onLightboxPrev}
        onNext={onLightboxNext}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-3 sm:px-4 sm:pt-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#111827]"
          >
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-cover"
                unoptimized
              />
            ) : null}
          </a>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex flex-wrap items-center gap-1">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-bold text-[15px] text-[#0f1419] hover:underline"
              >
                {data.author.name}
              </a>
              {data.author.verified ? (
                <BadgeCheck
                  className="h-[18px] w-[18px] shrink-0 text-[#1d9bf0]"
                  strokeWidth={2.5}
                  aria-label="Verified account"
                />
              ) : null}
            </div>
            <p className="mt-0.5 text-[15px]" style={{ color: X_GRAY }}>
              <span className="text-[#0f1419]">@{data.author.username}</span>
              <span className="mx-1">·</span>
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
                style={{ color: X_BLUE }}
              >
                Follow
              </a>
            </p>
          </div>
        </div>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[#0f1419] opacity-90 hover:opacity-100"
          aria-label="Open on X"
        >
          <OpenOnXIcon className="h-5 w-5" />
        </a>
      </div>

      {/* Text */}
      <div className="space-y-3 px-4 pb-3 pt-1">
        {paragraphs.length > 0 ? (
          paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-[15px] leading-5 text-[#0f1419]"
              style={{ wordBreak: "break-word" }}
            >
              {para}
            </p>
          ))
        ) : (
          <p className="text-[15px] leading-5 text-[#0f1419]">{displayText}</p>
        )}
        {longText ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="wild-utility-button"
          >
            {expanded ? "Show Less" : "Show More"}
          </button>
        ) : null}
      </div>

      {/* Media: official X embed for video/GIF; photo grids for image-only posts */}
      {hasVideo ? (
        <div className="px-3 pb-3 pt-1 sm:px-4 sm:pt-2">
          <XTweetEmbedIframe
            tweetId={data.id}
            username={data.author.username}
          />
        </div>
      ) : segments.length > 0 ? (
        <div className="space-y-3 px-3 pb-3 sm:px-4">
          {segments
            .filter(
              (s): s is Extract<MediaSegment, { kind: "photos" }> =>
                s.kind === "photos"
            )
            .map((seg, i) => (
              <div key={`p-${i}`} className="space-y-2">
                <PhotoGrid
                  urls={seg.urls}
                  startIndex={seg.startIndex}
                  onOpen={onOpenLightbox}
                />
                <div className="flex justify-end">
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#cfd9de] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0f1419] shadow-sm transition-colors hover:bg-[#f7f9f9]"
                  >
                    <OpenOnXIcon className="h-4 w-4" />
                    Visit WildWorks on X
                  </a>
                </div>
              </div>
            ))}
        </div>
      ) : null}

      {/* Meta row */}
      <div
        className="flex items-center justify-between border-t border-[#253042] px-4 py-2 text-[13px]"
        style={{ color: X_GRAY }}
      >
        <span className="flex items-center gap-1">
          <Pencil className="h-4 w-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
          {formatPostWhen(data.createdAt, data.edited)}
        </span>
        <Info className="h-4 w-4 shrink-0 opacity-50" strokeWidth={2} aria-hidden />
      </div>

      {/* Actions */}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#253042] px-4 py-3 text-[13px] font-medium"
        style={{ color: X_GRAY }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Heart
            className="h-[18px] w-[18px] shrink-0"
            fill={X_PINK}
            stroke={X_PINK}
            strokeWidth={2}
            aria-hidden
          />
          <span style={{ color: X_GRAY }}>{data.likeCount}</span>
        </span>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="wild-utility-button"
        >
          <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          Open Profile
        </a>
        <button
          type="button"
          onClick={onCopyLink}
          className="wild-utility-button"
        >
          <Link2 className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          {copied ? "Copied!" : "Copy Profile Link"}
        </button>
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="money-cta money-cta--wide wild-x-post-cta"
        >
          Visit WildWorks on X
        </a>
      </div>
    </article>
  );
}

export function LatestXPostCardSkeleton() {
  return (
    <div
      className="discordSection discordSection--3 mx-auto h-[320px] w-full max-w-[550px] animate-pulse rounded-2xl border border-[#253042] bg-[#0f1419]"
      aria-hidden
    >
      <div className="p-4">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-full bg-[#111827]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-32 rounded bg-[#111827]" />
            <div className="h-3 w-48 rounded bg-[#111827]" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded bg-[#111827]" />
          <div className="h-3 w-full rounded bg-[#111827]" />
          <div className="h-3 w-2/3 rounded bg-[#111827]" />
        </div>
      </div>
    </div>
  );
}
