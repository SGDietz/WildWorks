/**
 * How long does iScott actually take to come alive, and WHICH part is slow?
 *
 * G, 2026-08-28: "it is taking forever to load... the avatar did not load. It
 * comes back to talk to iScott." He offered to count it by hand; a stopwatch
 * gives one number for the whole thing and cannot say which stage ate it. This
 * records each stage on HIS phone, on HIS network, including the failure he
 * gets and I cannot reproduce (my browser blocks the microphone, so my runs
 * fail differently).
 *
 * Marks, in order:
 *   tap                  the visible Talk-to-iScott press
 *   iframe_created       React mounted the avatar frame
 *   iframe_loaded        the avatar document finished loading
 *   avatar_video_present a <video> exists inside it with data
 *   avatar_first_frame   that video has actually painted a frame - alive
 *   reverted             it gave up and went back to the button
 *
 * Every mark carries ms-since-tap, so the gaps between them are the answer.
 *
 * FAIL-OPEN, and this is not decoration: an earlier version of the aiASAP
 * timing work put telemetry inside the module-load path and a single throw
 * would have stranded the session permanently. Nothing here may reach the start
 * path. Everything is wrapped, the fetch is fire-and-forget with a catch, and
 * first-mark-wins so a retry cannot double-count.
 */

export type IScottStartPoint =
  | "tap"
  | "iframe_created"
  | "iframe_loaded"
  | "avatar_video_present"
  | "avatar_first_frame"
  | "reverted";

let tapEpochMs: number | null = null;
let seen: Partial<Record<IScottStartPoint, boolean>> = {};

/** Record one stage. Safe to call from anywhere, including a click handler. */
export function markIScottStart(
  point: IScottStartPoint,
  extra?: Record<string, unknown>,
): void {
  try {
    if (typeof window === "undefined") return;

    // A fresh tap starts a fresh attempt, so a second try is measured cleanly
    // rather than reported as one enormous elapsed time.
    if (point === "tap") {
      tapEpochMs = Date.now();
      seen = {};
    }
    if (seen[point]) return;
    seen[point] = true;

    const sinceTapMs =
      tapEpochMs == null ? null : Math.max(0, Date.now() - tapEpochMs);

    void fetch("/api/app-events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive so a mark sent as the visitor navigates away still lands -
      // "reverted" and "gave up and closed the tab" are exactly the cases we
      // most want to see.
      keepalive: true,
      body: JSON.stringify({
        category: "app",
        eventType: "iscott_start_timing",
        route:
          typeof location !== "undefined" ? location.pathname : null,
        viewport:
          typeof window !== "undefined"
            ? `${window.innerWidth}x${window.innerHeight}`
            : null,
        payload: { point, sinceTapMs, ...(extra ?? {}) },
      }),
    }).catch(() => undefined);
  } catch {
    // Measurement can never be allowed to break the thing it measures.
  }
}

/**
 * Watch the avatar iframe for the two marks that cannot be observed with an
 * event: a video appearing, and that video actually painting.
 *
 * Same-origin, so reading the child document is legal. Polls rather than using
 * requestAnimationFrame because rAF is throttled in a backgrounded tab and this
 * has to keep measuring while G is looking at a stalled screen.
 *
 * Returns a stop function. Gives up on its own after `timeoutMs` so it cannot
 * poll forever on a page that never loads.
 */
export function watchAvatarFrame(
  iframe: HTMLIFrameElement | null,
  timeoutMs = 60_000,
): () => void {
  if (typeof window === "undefined" || !iframe) return () => {};
  let stopped = false;
  const startedAt = Date.now();

  const tick = () => {
    if (stopped) return;
    try {
      const doc = iframe.contentDocument;
      const video = doc ? doc.querySelector("video") : null;
      if (video) {
        if (video.readyState >= 2) {
          markIScottStart("avatar_video_present", {
            readyState: video.readyState,
          });
        }
        // currentTime advancing is the only honest proof it is really playing;
        // a video element can exist, be "ready", and still show nothing.
        if (video.currentTime > 0 && !video.paused) {
          markIScottStart("avatar_first_frame", {
            currentTime: +video.currentTime.toFixed(3),
          });
          stopped = true;
          return;
        }
      }
    } catch {
      // Cross-origin or torn-down document: stop trying, do not throw.
      stopped = true;
      return;
    }
    if (Date.now() - startedAt > timeoutMs) {
      stopped = true;
      return;
    }
    window.setTimeout(tick, 250);
  };

  window.setTimeout(tick, 250);
  return () => {
    stopped = true;
  };
}
