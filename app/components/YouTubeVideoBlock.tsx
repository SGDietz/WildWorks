"use client";

const YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/Ij0jTD_FC2g";

export default function YouTubeVideoBlock() {
  return (
    <section className="discordSection discordSection--3 px-4 py-2 sm:px-6">
      <div className="md:w-[60%] mx-auto">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            src={YOUTUBE_EMBED_URL}
            title="WildWorks — Fine Art & Practical Living"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
          {/* Copy link - top right */}
          {/* <div className="absolute right-2 top-2 z-10 sm:right-4 sm:top-4">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-0.5 rounded bg-black/60 px-2 py-1.5 text-white transition hover:bg-black/80 sm:flex-row sm:gap-2 sm:px-3 sm:py-2"
              aria-label="Copy video link"
            >
              <svg
                className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="text-xs font-medium sm:text-sm">
                {copied ? "Copied!" : "Copy link"}
              </span>
            </button>
          </div> */}
          {/* Watch on YouTube - bottom left */}
          {/* <div className="absolute bottom-2 left-2 z-10 sm:bottom-4 sm:left-4">
            <a
              href={YOUTUBE_WATCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded bg-[#ff0000] px-2 py-1.5 text-white transition hover:bg-[#cc0000] sm:gap-2 sm:px-3 sm:py-2"
              aria-label="Watch on YouTube"
            >
              <svg
                className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-xs font-medium sm:text-sm">Watch on YouTube</span>
            </a>
          </div> */}
        </div>
        <p className="mt-6 mb-6 text-center text-xs text-white/90 sm:mt-8 sm:mb-8 sm:text-sm">
          Drone Footage of a Project with Boulders, Rock Outcroppings, Boulder
          Steps, a Seat Wall, and a Mushroom Seat.
        </p>
      </div>
    </section>
  );
}
