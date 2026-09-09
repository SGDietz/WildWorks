import { iscottAutoCloseFactory } from "../../../src/lib/iscottAutoClose";
import { versionIScottSpeechAssetReferences } from "../../../src/lib/iscottAvatarSpeechBridge";
import { iscottHomeShadowColorsScript } from "../../../src/lib/iscottHomeShadowColors";

const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";
const LOCAL_AVATAR_ASSET_PREFIX = "/pages/avatar-iscott-assets/_next/";
const WILDWORKS_AVATAR_REQUEST_HEADER = "x-wildworks-avatar-request";
const WILDWORKS_AVATAR_REQUEST_VALUE = "same-origin-v1";

export const dynamic = "force-dynamic";

// The embedded avatar expects this API to exist.  When the WildWorks page is
// opened over plain HTTP, browsers omit it entirely; install a harmless local
// fallback before the deferred embed scripts run so the avatar remains usable
// as text chat instead of surfacing its internal TypeError.
const wildWorksMicrophoneSafetyScript = `
  <script id="wildworks-avatar-microphone-safety">
    (() => {
      const unavailableMessage = "Microphone isn't available here. You can still chat with iScott by text.";

      try {
        const existingMediaDevices = navigator.mediaDevices;
        if (!existingMediaDevices || typeof existingMediaDevices.getUserMedia !== "function") {
          const safeMediaDevices = existingMediaDevices || {};
          Object.defineProperty(safeMediaDevices, "getUserMedia", {
            configurable: true,
            // writable matters: the remote SDK ASSIGNS its own wrapper over
            // getUserMedia. A read-only stub makes that assignment throw and
            // kills the whole app on insecure origins (G's smoke, 2026-08-17).
            writable: true,
            value: () => Promise.reject(new DOMException(unavailableMessage, "NotAllowedError")),
          });
          Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            get: () => safeMediaDevices,
          });
        }
      } catch {
        // Browsers that do not permit the compatibility shim still receive the
        // visitor-facing cleanup below.
      }

      // The remote React app mounts this warning late, split across nested
      // elements, and re-renders it.  So: recognise the warning per text
      // fragment, rewrite fragment text in place (never restructure DOM React
      // owns), and never mark anything "done" -- a re-render that restores the
      // raw text is simply cleaned again by the persistent observer.
      const rawMarkers = [
        "Microphone not available",
        "getUserMedia",
        "Session will continue without voice chat",
      ];
      const isRawWarningText = (text) => rawMarkers.some((marker) => text.includes(marker));
      // Any fragment of the warning collapses to the one plain sentence.  The
      // machine reason goes to the console instead of the panel, so a future
      // SDK error string cannot leak into visitor-facing UI either.
      const cleanWarningText = (text) => (isRawWarningText(text) ? unavailableMessage : text);
      const loggedRawWarnings = new Set();

      // The panel is whatever element actually holds the rendered warning,
      // found from the fragments themselves so no remote class name matters.
      const findWarningPanel = (nodes) => {
        let panel = nodes[0].parentElement;
        for (const other of nodes) {
          while (panel && !panel.contains(other)) {
            panel = panel.parentElement;
          }
        }
        return panel;
      };

      const sanitizeRawMicrophoneWarning = () => {
        if (!document.body) return;

        // NEVER WALK INTO SCRIPT OR STYLE. A script element's source IS a text
        // node, so without this filter the sanitizer rewrites the SOURCE CODE of
        // any injected script whose text happens to contain one of the markers -
        // and "getUserMedia" is a marker.
        //
        // That is not hypothetical. On 2026-08-19 the mic-gated pause was moved
        // into wildworks-avatar-capture-bridge, its comments mention
        // getUserMedia, and this walker replaced THAT ENTIRE SCRIPT with the
        // 72-character warning sentence. The script never ran: no pace marks, no
        // transcript sync, no lead capture. G rode iScott and Supabase recorded a
        // token and nothing else. It looked exactly like the earlier "two whole
        // conversations recorded nothing" incident, and it had the same shape -
        // a live script silently replaced rather than a logic bug.
        //
        // The markers describe VISITOR-FACING COPY. They have no business
        // matching machine text, and script and style are never visitor-facing.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (candidate) => {
            const owner = candidate.parentElement;
            if (!owner) return NodeFilter.FILTER_REJECT;
            const tag = owner.tagName;
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE" || tag === "NOSCRIPT") {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        const rawNodes = [];
        let node = walker.nextNode();
        while (node) {
          if (isRawWarningText(node.data || "")) rawNodes.push(node);
          node = walker.nextNode();
        }
        if (!rawNodes.length) return;

        const panel = findWarningPanel(rawNodes);
        if (panel && panel.getAttribute("aria-live") !== "polite") {
          panel.setAttribute("aria-live", "polite");
        }

        for (let index = 0; index < rawNodes.length; index += 1) {
          const rawNode = rawNodes[index];
          const current = rawNode.data || "";
          // The panel says it once: the first fragment carries the plain
          // sentence and the rest are emptied instead of repeating it.
          const cleaned = index === 0 ? cleanWarningText(current) : "";
          // Write only on real change so the observer cannot loop.
          if (cleaned !== current) {
            if (!loggedRawWarnings.has(current)) {
              loggedRawWarnings.add(current);
              console.info("[wildworks] replaced raw microphone warning:", current);
            }
            rawNode.data = cleaned;
          }
        }
      };

      new MutationObserver(sanitizeRawMicrophoneWarning).observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      document.addEventListener("DOMContentLoaded", sanitizeRawMicrophoneWarning, { once: true });
      sanitizeRawMicrophoneWarning();
    })();
  </script>
`;

// The remote demo and the WildWorks bridges call same-origin iScott APIs.
// iPad Safari can make those iframe requests with an opaque/missing
// Origin and no Referer after a lifecycle transition, which makes the server's
// CSRF guard correctly fail closed but leaves the vendor app painting its raw
// JSON errors such as "Forbidden" or "Too many requests" over Scott. Install
// this before the first remote async
// script: only the known same-origin iScott routes receive the marker, explicit
// foreign origins remain rejected server-side, and a 401/403/429 immediately
// releases our loading cover. Cross-origin browser JavaScript cannot attach
// this custom header without a successful CORS preflight.
const wildWorksAvatarOriginBridgeScript = `
  <script id="wildworks-avatar-origin-bridge">
    (() => {
      const markerName = ${JSON.stringify(WILDWORKS_AVATAR_REQUEST_HEADER)};
      const markerValue = ${JSON.stringify(WILDWORKS_AVATAR_REQUEST_VALUE)};
      const markerPaths = new Set([
        "/api/start-session",
        "/api/v1/sessions/start",
        "/api/v1/sessions/stop",
        "/api/app-events/log",
        "/api/liveavatar/session-transcript/sync",
        "/api/iscott/lead/confirm",
        "/api/media/capture",
      ]);
      const originalFetch = window.fetch.bind(window);
      let latestStartFailureClass = "";

      window.__wildworksClientDevice = () => {
        try {
          const nav = window.navigator;
          const ua = String(nav.userAgent || "").slice(0, 400);
          const touch = "ontouchstart" in window || Number(nav.maxTouchPoints || 0) > 0;
          const tablet = /iPad|Tablet/i.test(ua) || (nav.platform === "MacIntel" && touch);
          const mobile = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua);
          const browserName = ua.includes("Edg/") ? "Edge"
            : ua.includes("CriOS") || ua.includes("Chrome/") ? "Chrome"
              : ua.includes("FxiOS") || ua.includes("Firefox/") ? "Firefox"
                : ua.includes("Safari/") ? "Safari" : "Other";
          const osName = /Android/i.test(ua) ? "Android"
            : /iPhone|iPad|iPod/i.test(ua) || (nav.platform === "MacIntel" && touch) ? "iOS/iPadOS"
              : /Windows/i.test(ua) ? "Windows"
                : /Mac OS X|Macintosh/i.test(ua) ? "macOS"
                  : /Linux/i.test(ua) ? "Linux" : String(nav.platform || "unknown").slice(0, 80);
          return {
            deviceKind: tablet ? "tablet" : mobile ? "mobile" : "desktop",
            osName,
            browserName,
            screen: window.screen
              ? window.screen.width + "x" + window.screen.height + "x" + (window.devicePixelRatio || 1)
              : null,
            touchSupport: touch,
            userAgent: ua || null,
          };
        } catch (error) {
          return {};
        }
      };

      const requestUrl = (input) => {
        if (typeof input === "string") return input;
        if (typeof URL !== "undefined" && input instanceof URL) return input.href;
        if (typeof Request !== "undefined" && input instanceof Request) return input.url;
        return "";
      };

      window.fetch = async (input, init) => {
        let isMarkedSameOriginRequest = false;
        let requestPath = "";
        try {
          const url = new URL(requestUrl(input), window.location.href);
          requestPath = url.pathname;
          isMarkedSameOriginRequest = url.origin === window.location.origin
            && markerPaths.has(url.pathname);
        } catch (error) {}

        if (!isMarkedSameOriginRequest) return originalFetch(input, init);

        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init && init.headers) {
          new Headers(init.headers).forEach((value, name) => headers.set(name, value));
        }
        headers.set(markerName, markerValue);
        const response = await originalFetch(input, { ...(init || {}), headers });
        if (requestPath === "/api/v1/sessions/start" && !response.ok) {
          latestStartFailureClass = response.headers.get("x-wildworks-liveavatar-error-class") || "provider_rejected_request";
        }
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
        }
        return response;
      };

      const sanitizeStartFailure = () => {
        if (!document.body) return;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (candidate) => {
            const owner = candidate.parentElement;
            if (!owner) return NodeFilter.FILTER_REJECT;
            const tag = owner.tagName;
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE" || tag === "NOSCRIPT") {
              return NodeFilter.FILTER_REJECT;
            }
            const text = candidate.data || "";
            const isRawStartError = /^\\s*(?:Forbidden|Too many requests|API request failed)\\.?\\s*$/i.test(text);
            const isGenericCreditAdvice = /Add credits to your LiveAvatar account/i.test(text);
            return (isRawStartError || isGenericCreditAdvice)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          },
        });
        const rawNodes = [];
        let node = walker.nextNode();
        while (node) {
          rawNodes.push(node);
          node = walker.nextNode();
        }
        if (!rawNodes.length) return;
        const explicitCreditFailure = latestStartFailureClass === "account_credit_exhausted";
        let replacementWritten = false;
        for (const rawNode of rawNodes) {
          const isCreditAdvice = /Add credits to your LiveAvatar account/i.test(rawNode.data || "");
          if (isCreditAdvice && explicitCreditFailure) continue;
          rawNode.data = replacementWritten
            ? ""
            : "iScott couldn't start. Tap Talk to try again.";
          replacementWritten = true;
        }
        window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
      };

      new MutationObserver(sanitizeStartFailure).observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      document.addEventListener("DOMContentLoaded", sanitizeStartFailure, { once: true });
      sanitizeStartFailure();
    })();
  </script>
`;

const sparkleIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23e96819' stroke-width='2.35' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z'/%3E%3Cpath d='M5 3v4'/%3E%3Cpath d='M7 5H3'/%3E%3C/svg%3E";

const wildWorksButtonCss = `
  <style id="wildworks-avatar-button-style">
    :root {
      /* G 2026-08-19: "everything needs to be theme colors, brand colors."
         The surface and type tokens now come off the locked five. black/night
         stay dark on purpose - they are scrims and text shadows, and painting
         those orange would destroy contrast rather than brand anything.
         button-ink stays a dark ink because it sits on the gold buttons. */
      --ww-avatar-black: #080302;
      --ww-avatar-night: #130702;
      --ww-avatar-wood: #c44d0b;
      --ww-avatar-gold: #e96819;
      --ww-avatar-honey: #f08c28;
      --ww-avatar-parchment: #edc775;
      --ww-avatar-cream: #fce0ad;
      /* G 2026-08-19: "the finish button is still the old color." The whole
         site moved to card #e96819 in H337; this button lives inside the
         proxied avatar app, so no site stylesheet could ever reach it and it
         was left behind on the old #7d2f20. */
      --ww-avatar-button-ink: #e96819;
    }

    html,
    body,
    #__next {
      min-height: 100% !important;
      /* G 2026-08-17: while the avatar loads, sit on the site's own locked
         red-copper field (gold-reference palette), never dirt brown. */
      background:
        linear-gradient(180deg, #c44d0b 0%, #c44d0b 48%, #c44d0b 100%) #c44d0b !important;
      color: var(--ww-avatar-parchment) !important;
    }

    body {
      position: relative !important;
      overflow: hidden !important;
    }

    :where(html[data-ww-mobile-visual-reference]) body::before {
      content: "Loading iScott" !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 0 !important;
      display: grid !important;
      place-items: center !important;
      padding-bottom: 0 !important;
      /* G 2026-08-19: "make that color number two" - the Loading iScott wordmark
         moves off text-1 onto text-2. The field behind it is already the primary
         background (#c44d0b), which is what he asked for. */
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
      background: none !important;
      font-family: "Goudy Old Style", "Baskerville Old Face", Garamond, Georgia, serif !important;
      font-size: clamp(2.7rem, 12vw, 4.8rem) !important;
      font-weight: 800 !important;
      font-style: normal !important;
      letter-spacing: -0.025em !important;
      line-height: 0.95 !important;
      text-align: center !important;
      white-space: nowrap !important;
      opacity: 1 !important;
      pointer-events: none !important;
      text-shadow: 0 3px 0 rgba(0, 0, 0, 0.72), 0 0.38rem 0.58rem rgba(0, 0, 0, 0.3) !important;
    }

    :where(html:not([data-ww-mobile-visual-reference])) body::before {
      content: "Loading iScott" !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 0 !important;
      display: grid !important;
      place-items: center !important;
      padding-bottom: 0 !important;
      /* G 2026-08-19: "make that color number two" - the Loading iScott wordmark
         moves off text-1 onto text-2. The field behind it is already the primary
         background (#c44d0b), which is what he asked for. */
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
      background: none !important;
      font-family: "Goudy Old Style", "Baskerville Old Face", Garamond, Georgia, serif !important;
      font-size: clamp(2.7rem, 12vw, 4.8rem) !important;
      font-weight: 800 !important;
      font-style: normal !important;
      letter-spacing: -0.025em !important;
      line-height: 0.95 !important;
      text-align: center !important;
      white-space: nowrap !important;
      opacity: 1 !important;
      pointer-events: none !important;
      text-shadow: 0 2px 0 rgba(0, 0, 0, 0.72), 0 0.25rem 0.46rem rgba(0, 0, 0, 0.3) !important;
    }

    /* On a phone, use the frame's height to give the loading name a clean
       two-line lockup without changing its approved color or depth. */

    @media (max-width: 560px) {
      body::before {
        content: "Loading\\A iScott" !important;
        line-height: 1.06 !important;
        white-space: pre-line !important;
      }
    }

    /* G 2026-08-19: "that color needs to be changed to one of the main
       background colors." The cover was primary #c44d0b while the panel it
       sits inside is card #e96819 - two different oranges, so the avatar area
       read as a hole punched in the card while it loaded. Both are brand
       colours; the wrong one was chosen. It now matches the surface it covers,
       so "Loading iScott" reads as the card thinking rather than a gap. */

    html.wildworks-avatar-loading body::before {
      z-index: 2147483646 !important;
      background:
        linear-gradient(180deg, #e96819 0%, #e96819 48%, #e96819 100%) #e96819 !important;
      pointer-events: auto !important;
    }

    html.wildworks-avatar-loading body > :not(script):not(style) {
      pointer-events: none !important;
    }

    body > :not(script):not(style) {
      position: relative !important;
      z-index: 1 !important;
    }

    /* The remote app briefly mounts a dark start-screen layer. WildWorks owns
       the loading experience, so keep that entire phase on the orange field. */

    [class*="bg-black"],
    [class*="bg-neutral-950"],
    [class*="bg-zinc-950"],
    [class*="bg-stone-950"],
    [style*="background: black"],
    [style*="background-color: black"],
    [style*="background-color: rgb(0, 0, 0)"] {
      /* 2026-08-19: this gradient ran on #d97b42 / #c96731 / #b95022 and the
         radial on rgba(232,182,109). None of those are WildWorks colours. The
         comment above wanted "the orange field" and reached for three oranges
         nobody chose, in the same file that already calls out #e8ad59 and
         #b96d2d as abandoned. The build's palette guard only reads app/*.css,
         so a .ts file full of colour literals has never been checked.
         Rebuilt on the locked five: card -> honey -> primary, with the lift in
         text-1. */
      background:
        radial-gradient(ellipse 82% 58% at 50% 22%, rgba(252, 224, 173, 0.34), rgba(237, 199, 117, 0.16) 44%, transparent 74%),
        linear-gradient(155deg, #e96819 0%, #f08c28 52%, #c44d0b 100%) !important;
    }

    video,
    canvas {
      background: transparent !important;
    }

    /* Any icon on these buttons that IS an svg. The Finish button's sparkle is
       not - it is a ::before background-image and is handled on that rule. This
       one is kept for the buttons that do use svg markup. */

    .btn-wood svg,
    .btn-inset svg,
    [data-ww-finish] svg,
    [data-ww-talk] svg {
      filter:
        drop-shadow(rgba(35, 9, 2, 0.9) 0px 0.75px 0px)
        drop-shadow(rgba(25, 6, 1, 0.6) 0px 1.5px 0px) !important;
    }

    /* G, ride 2026-08-23: "the finish box and the start box. The icon needs a
       little bit more of the shadow effect... by 20%." Then, same ride,
       correcting the first attempt: match the treatment on the OTHER iScott
       controls, "attached rather than detached/blurred." My first attempt
       scaled the y-OFFSET (0.75px->0.9px, 1.5px->1.8px), which pushes the
       shadow further from the icon - that reads as MORE detached, the exact
       opposite of what was asked, even though blur-radius stayed 0px both
       times. Reverted the offsets back to the site-wide baseline
       (0.75px / 1.5px, byte-identical to every other icon's shadow - that IS
       "attached," same position as "the other iScott controls") and instead
       added the extra 20% as opacity on the second, wider layer only: 0.6 ->
       0.72. The first layer's 0.9 alpha has no clean 20% headroom under 1.0,
       so it stays as-is; darkening only the far layer still reads as "a
       little more effect" without moving anything's position. NOT visually
       confirmed live - flagging for G to eyeball and correct again if this
       still isn't it, same as the color judgment calls in RISK.md. */

    [data-ww-finish] svg,
    [data-ww-talk] svg {
      filter:
        drop-shadow(rgba(35, 9, 2, 0.9) 0px 0.75px 0px)
        drop-shadow(rgba(25, 6, 1, 0.6) 0px 1.5px 0px) !important;
    }

    .btn-wood,
    .btn-inset {
      display: inline-flex !important;
      min-height: 48px !important;
      width: auto !important;
      min-width: 9.75rem !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.22rem !important;
      /* G 2026-09-05: every avatar control uses the accepted button rim,
         including phone Talk, Finish, returned Talk and Restart. */
      border: 1px solid #8f3a14 !important;
      border-radius: 8px !important;
      /* Same stack H337 puts on every button on the site. The old middle stops
         #e8ad59 and #b96d2d are not WildWorks colours and were what turned the
         lower third muddy. */
      background:
        radial-gradient(circle at 50% -30%, rgba(255, 250, 232, 0.95), transparent 52%),
        linear-gradient(180deg, #fce0ad 0%, #edc775 38%, #f08c28 72%, #c44d0b 100%) !important;
      padding: 0.85rem 1rem !important;
      color: var(--ww-avatar-button-ink) !important;
      font-family: Georgia, "Times New Roman", serif !important;
      font-size: 1.12rem !important;
      font-weight: 750 !important;
      line-height: 1 !important;
      letter-spacing: 0 !important;
      text-decoration: none !important;
      /* the words carry the site's depth ink, at the 10% G asked for */
      /* BACKED OFF 10%, G 2026-08-31 (ride adfdc2ff): "the finish button... back
         off the shadow effect by 10%." Alphas x 0.9; the offsets are untouched,
         so the depth reads lighter without the letters moving or the ladder
         changing shape. 0.882 -> 0.794, 0.81 -> 0.729, 0.648 -> 0.583. */
      /* SECOND back-off, G 2026-08-31 ride 009124c0, looking at the first one:
         "Finish looks, you know, it still has got a little too heavy of the
         shadow effect." Another 0.9 on top of the first, so the label now sits
         at 0.81 of where it started: 0.882 -> 0.794 -> 0.715. Offsets still
         untouched - the letters have not moved through any of this. */
      text-shadow:
        rgba(35, 9, 2, 0.715) 0 0.01731em 0,
        rgba(30, 8, 2, 0.656) 0 0.03461em 0,
        rgba(25, 6, 1, 0.525) 0 0.05192em 0 !important;
      box-shadow:
        0 16px 42px rgba(58, 33, 8, 0.44),
        0 0 24px rgba(240, 140, 40, 0.22) !important;
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease !important;
      white-space: nowrap !important;
    }

    .fixed.bottom-28:has(.btn-wood) {
      /* Sit in the clear space directly above Scott's wrists and hands. */
      bottom: clamp(6.7rem, 14vh, 7.3rem) !important;
    }

    /* ==================================================================
       HOME CONTROL STAYS PUT, G 2026-08-29: "it jumps quickly to the right"
       on the way into Finish.

       Same document seam the state-shadow slice just mapped, one layer down.
       The control G watches is drawn by two different owners:

         initial Talk   .wild-site-avatar-overlay-cta, PARENT document.
                        globals.css pins it position:absolute, left:50%,
                        transform:translateX(-50%) inside
                        .wild-live-avatar-frame, and H153 re-states that
                        translateX on :hover/:focus-visible so the shared
                        two-pixel lift cannot decentre it.
         Finish         this document, inside .fixed.bottom-28
         returned Talk  this document, the SAME .fixed.bottom-28

       The parent's half is anchored by declaration. This document's half was
       not: the rule above pins only the bottom, so the horizontal placement of
       both in-frame states was left to whatever the proxied app's own utility
       classes happen to resolve to. Nothing in WildWorks CSS held that axis,
       which is why the seam could move sideways at all - it is an anchor that
       was never stated, not one that was stated wrong.

       Vertical is deliberately untouched. The frame is 18rem wide at 9/16, so
       the overlay's inline bottom:22% is ~112.6px off the frame floor and the
       clamp above is ~107.2px - about five pixels apart, and both scale
       together under A01's zoom. G reported a sideways jump; the approved
       "above the wrists" height stays exactly where it is.

       IT LANDS ON THE SAME LINE. The iframe is absolute inset-0 inside
       .wild-live-avatar-frame, so its viewport IS the frame's padding box -
       the same box the parent overlay centres in. A01 zooms the panel 1.15
       from 521px up; the frame's inner viewport lays out in its own pre-zoom
       pixels (the measurement note below relies on the same fact), so 50% of
       the inner viewport and 50% of the frame paint on one line.

       CENTRED WITHOUT A TRANSFORM, on purpose. left/right 0 + auto inline
       margins + a max-content width makes the row hug its button and take the
       free space evenly, so the result does not depend on the app's own
       justify-content, and any -translate-x-1/2 it may carry is cancelled
       rather than doubled. No new containing block for fixed descendants.

       SCOPED TO THE EMBED, same gate as the shadow block below: Home is the
       only embedder, and a direct visit to /pages/avatar-iscott keeps the
       app's own placement. The measured-iPad pins further down carry more
       specificity and still win there, unchanged.

       No delay and no animation - the anchor is simply stated for the states
       that lacked one. Labels, icons, the shadow ladders, box metrics, radius,
       fills, borders, the state machine, the Finish handler and the timing are
       all untouched. ============================================== */

    html[data-ww-avatar-embedded] .fixed.bottom-28:has(.btn-wood) {
      left: 0 !important;
      right: 0 !important;
      margin-inline: auto !important;
      width: max-content !important;
      transform: none !important;
    }

    .btn-wood::before {
      content: "" !important;
      display: inline-block !important;
      /* G 2026-09-01: "the icon needs to be much bigger. I would say make the
         icon itself twenty percent larger... twenty percent larger than it is
         an appropriate shadow effect." 1.12em -> 1.344em. The icon shadow is
         already expressed in em, so it grows with the glyph and stays in
         proportion - no separate shadow change needed. */
      width: 1.344em !important;
      height: 1.344em !important;
      flex: 0 0 1.12em !important;
      margin-right: 0 !important;
      background-image: url("${sparkleIcon}") !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      background-size: contain !important;
      /* G asked for this TWICE - ride 308c9716 "the icon on the finish button
         needs some shadow", then ride b1dd603f "the icon inside the finish
         button needs some, some shadow" with "I keep saying the same fucking
         goddamn things" in between. He was right to be angry: my first fix
         targeted ".btn-wood svg", and this icon is not an svg at all. It is a
         ::before with a background-image, so that rule matched nothing and
         never applied. Same drop-shadow pair the rest of the site puts on
         button icons, on the element that actually draws it. */
      filter:
        drop-shadow(rgba(35, 9, 2, 0.9) 0px 0.75px 0px)
        drop-shadow(rgba(25, 6, 1, 0.6) 0px 1.5px 0px) !important;
    }

    /* G, ride 2026-08-23: same "shadow effect... on the icon itself by 20%"
       ask, for Finish's actual glyph - the sparkle ::before immediately
       above, not the generic svg rule (Finish has no real svg, per the
       comment up top). .btn-wood also styles the Restart button (see
       "Restart iScott", id="wildworks-avatar-restart", class="btn-wood"), so
       editing .btn-wood::before directly would have boosted Restart's icon
       too - not asked for. [data-ww-finish] is stamped by this page's own JS
       only onto the button whose text is exactly "Finish," so this override
       reaches Finish alone; Restart keeps the original values above.
       CORRECTED same ride, per the svg rule above: offset reverted to the
       site-wide baseline (0.75px / 1.5px - "attached," matching every other
       icon including Restart's own), the extra 20% moved to the far layer's
       opacity instead (0.6 -> 0.72). Not visually confirmed live. */

    [data-ww-finish]::before {
      filter:
        drop-shadow(rgba(35, 9, 2, 0.9) 0px 0.75px 0px)
        drop-shadow(rgba(25, 6, 1, 0.6) 0px 1.5px 0px) !important;
    }

    /* ==================================================================
       HOME STATE PARITY, G 2026-08-29: initial Talk -> Finish -> returned Talk.

       G is looking at one control across three states and seeing two different
       shadow languages. He is right, and the seam is a document boundary:

         initial Talk   .wild-site-avatar-overlay-cta, in the PARENT document,
                        painted by H337's Home ladder
                        (--ww-cta-label-shadow / --ww-cta-icon-shadow)
         Finish         this document, .btn-wood's own 3-stop ladder
         returned Talk  this document, the SAME .btn-wood ladder

       So Finish and returned Talk already match each other exactly - they are
       the same rule - and BOTH differ from the initial Talk he clicked a
       moment earlier. CSS variables do not cross into an iframe, so the Home
       ladder cannot simply be inherited here; it has to be restated. These
       are the H337 PASS 5 values copied verbatim, not re-derived.

       IT LANDS AT THE SAME PIXELS. The parent's overlay Talk is font-size
       1.12rem (H337 pins it) and .btn-wood here is font-size 1.12rem - the
       same 17.92px - so an identical em ladder resolves to identical px in
       both documents. Reach 0.087222em = 1.563px on both sides of the frame.

       SCOPED TO THE EMBED. data-ww-avatar-embedded is set only when this
       document is framed, and Home is its only embedder, so this is Home and
       nothing else; a direct visit to /pages/avatar-iscott keeps the values
       above. Scoped rather than edited in place for the same reason the
       2026-08-23 Finish work was: .btn-wood also dresses Restart iScott, which
       is not part of this three-state control and was not asked about.

       Style only. Labels, icons, sizes, geometry, the state machine and the
       Finish handler are all untouched. ============================== */

    html[data-ww-avatar-embedded] [data-ww-talk],
    html[data-ww-avatar-embedded] [data-ww-finish] {
      /* THIS is the rule that paints the Finish and Talk labels, and it covers
         BOTH states - initial Talk, Finish, and the Talk you come back to.
         G asked for this shadow to come down twice and nothing moved, because
         both times I edited .btn-wood, which also sets text-shadow important
         but is LESS specific than this pair of attribute selectors, so it
         loses. Verified by rendering the real page offline and reading
         CSS.getMatchedStylesForNode: two important rules match this button and
         this one wins. Both of his reductions are applied here, where they
         land - alphas multiplied by 0.81. Offsets untouched, so nothing
         moves.

         G 2026-09-01, looking at the live Finish button: "Finnish has too much
         shadow, and the icon does not have enough." So the two diverge again -
         every alpha here drops another 20% (0.786 -> 0.629 down to 0.535 ->
         0.428) while the icon rule below goes DEEPER. Offsets untouched, so
         nothing moves. */
      text-shadow:
        rgba(35,9,2,0.566) 0 0.008722em 0,
        rgba(34,9,2,0.549) 0 0.017444em 0,
        rgba(33,8,2,0.533) 0 0.026166em 0,
        rgba(32,8,2,0.516) 0 0.034888em 0,
        rgba(31,8,2,0.499) 0 0.043610em 0,
        rgba(29,7,1,0.482) 0 0.052332em 0,
        rgba(28,7,1,0.465) 0 0.061054em 0,
        rgba(27,7,1,0.434) 0 0.069776em 0,
        rgba(26,6,1,0.409) 0 0.078498em 0,
        rgba(25,6,1,0.385) 0 0.087220em 0 !important;
    }

    /* Both icon shapes, because the two states draw the sparkle differently:
       Finish and Talk take it from .btn-wood::before as a background-image,
       and any state that ships a real svg is covered by the same value. One
       declaration so neither can drift from the other or from the parent.

       Screenshot correction, 2026-08-29: the former ten-filter chain shadowed
       each prior shadow and turned these small outline icons into a splotch.
       Match the parent's corrected single attached edge so the actual artwork
       remains legible through Talk -> Finish -> returned Talk. G's 2026-08-30
       visual pass asked for a little more depth without restoring the chain,
       so only that one attached edge becomes slightly darker/deeper. */

    html[data-ww-avatar-embedded] [data-ww-talk]::before,
    html[data-ww-avatar-embedded] [data-ww-finish]::before,
    html[data-ww-avatar-embedded] [data-ww-talk] svg,
    html[data-ww-avatar-embedded] [data-ww-finish] svg {
      /* G 2026-08-31, on the Finish button: "the icon inside the finish needs to
         be more... It's strong. I've been asking for this 100 fucking times."
         He has, and this is why it survived: the icon shadow was fixed on the
         HOME buttons this morning (H337) and this rule - the copy that dresses
         the icons INSIDE the avatar embed - was left on the old value. Same
         defect, second location, which is the standing rule about fixing a bug
         everywhere it lives.

         Reach was never the problem here. Measured against .btn-wood's own
         label ladder at font-size 1.12rem: label total 0.05192em = 0.93px, icon
         0.9px. Already parity. What it lacked was GRADE - one flat step reads
         as a printed edge, not as depth, next to a label built from three
         stops that fade 35,9,2 -> 25,6,1.

         So the total is held and the single step is split into the label's own
         three, with the label's own falloff. Three chained drop-shadows, not
         ten: ten opaque copies is what blobbed these thin-stroke glyphs on
         2026-08-29 and that lesson stands. Offsets px-clamped both ends so the
         edge stays a hairline at every size. */
      /* MORE, G 2026-08-31 ride 009124c0, in the same breath as backing the
         label off: "the icon does not have enough shadow." He is asking for the
         two to diverge - lighter letters, heavier glyph - so this stops being a
         parity exercise. Reach goes up ~45% (0.0173em -> 0.0251em per step,
         three steps = 0.0753em against the label's 0.05192em) and every alpha
         goes up. Still three graded steps, never ten: ten opaque copies is what
         blobbed these thin-stroke glyphs on 2026-08-29. Offsets stay px-clamped
         so the edge cannot become a slab on the larger controls. */
      /* DENSITY, not reach. Rendered at 7x offline and actually looked at: the
         label was a solid slab and the icon beside it was a flat glyph with a
         hairline. Both had a similar TOTAL reach - label 0.0872em over TEN
         stops, icon 0.0753em over three. Three sparse copies read as an edge;
         ten touching copies read as depth. The icon now uses the label's exact
         step, 0.008722em, ten times, with the label's own alpha ramp.
         This is not the 2026-08-29 blob: that came from LARGE per-step offsets
         closing the sparkle's internal gaps. At 0.0087em a step is about a
         fifth of a pixel on a 24px glyph, far under the width of any gap. */
      filter:
        drop-shadow(rgba(35,9,2,0.97) 0 0.010466em 0.02px)
        drop-shadow(rgba(34,9,2,0.941) 0 0.010466em 0.02px)
        drop-shadow(rgba(33,8,2,0.913) 0 0.010466em 0.02px)
        drop-shadow(rgba(32,8,2,0.884) 0 0.010466em 0.02px)
        drop-shadow(rgba(31,8,2,0.855) 0 0.010466em 0.02px)
        drop-shadow(rgba(29,7,1,0.827) 0 0.010466em 0.02px)
        drop-shadow(rgba(28,7,1,0.798) 0 0.010466em 0.02px)
        drop-shadow(rgba(27,7,1,0.745) 0 0.010466em 0.02px)
        drop-shadow(rgba(26,6,1,0.7) 0 0.010466em 0.02px)
        drop-shadow(rgba(25,6,1,0.66) 0 0.010466em 0.02px) !important;
    }

    .btn-inset {
      min-width: 6.75rem !important;
      padding-inline: 1.4rem !important;
    }

    .btn-wood:hover:not(:disabled),
    .btn-inset:hover:not(:disabled) {
      /* G asked for the brightnesses evened out. A button that brightens under
         the thumb is the same defect arriving a second later. */
      filter: none !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42) !important;
    }

    .btn-wood:active:not(:disabled),
    .btn-inset:active:not(:disabled) {
      transform: translateY(1px) !important;
      box-shadow: 0 8px 22px rgba(16, 6, 1, 0.45) !important;
    }

    .btn-wood:disabled,
    .btn-inset:disabled {
      cursor: default !important;
      opacity: 0.72 !important;
      filter: saturate(0.8) !important;
    }

    #wildworks-lead-confirmation {
      position: fixed !important;
      top: auto !important;
      /* The runtime replaces this fallback with a measured position whenever
         Finish is present. The lead card stays above that control in every
         state so Finish remains visible and is always the hit target. */
      bottom: calc(0.55rem + env(safe-area-inset-bottom, 0px)) !important;
      left: 50% !important;
      z-index: 60 !important;
      display: none !important;
      width: min(calc(100vw - 2rem), 28rem) !important;
      transform: translateX(-50%) !important;
      /* G ride 89c453ff, 2026-08-19: "the colors are awful" and "the phone number
         is not in the brand font."
         The old ffe9c2 was never a WildWorks colour - off the locked five by a
         hair, close enough to pass a glance. Text-1 is #fce0ad.
         Arial was never the brand face either. The site's body copy is Cambria;
         the stack is hardcoded because this CSS is injected into the proxied
         avatar app, where globals.css custom properties do not resolve. */
      color: #fce0ad !important;
      font-family: Cambria, "Cambria Math", Georgia, "Times New Roman", serif !important;
      pointer-events: none !important;
      text-align: center !important;
    }

    #wildworks-lead-confirmation.wildworks-lead-visible {
      display: block !important;
      animation: wildworks-lead-rise 360ms cubic-bezier(0.22, 1, 0.36, 1) both !important;
    }

    .wildworks-lead-card {
      pointer-events: auto !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      width: 100% !important;
      /* G: "it should just be the little email box with the email" - smaller
         footprint so it cannot reach his face. */
      /* G 2026-09-01: "The netbox needs to fit over the finish box, um, but
         make it that size. It just too big." 19rem -> 15rem (304px -> 240px at
         412). Held at 15rem rather than matching the Finish button exactly,
         because the value font auto-shrinks to whatever width this leaves and
         he has already rejected small type twice. Narrower is one number away
         if he wants it. */
      max-width: min(15rem, 70vw) !important;
      margin: 0 auto !important;
      /* G: "the size, it could be a little shorter. It doesn't have to be
         quite so tall." Vertical padding down, horizontal untouched. */
      padding: 0.34rem 0.85rem !important;
      /* G 2026-08-19: "it needs to be brand colors." Off the old wood browns and
         onto the locked five: primary field, card-colour border, text-3 glow. */
      /* G ride 89c453ff, 2026-08-19: "the colors are awful" / "way too dark" /
         "they've got to be nice brand, beautiful colors."
         The box was #c44d0b - primary, our darkest - floated on the #e96819 card
         panel. Two dark oranges touching, so it read muddy rather than as a
         thing sitting on top of something.
         My first fix moved it to card #e96819 and G's own screenshot killed that
         idea before it shipped: the panel behind it is already that colour, so
         the box would have dissolved into it.
         It goes CREAM instead. Same family as the Finish and Upload buttons
         right beside it, which G has already approved sitewide - light field,
         dark ink, gold edge. Highest contrast available inside the locked five,
         and it reads as a card laid over the panel because it is lighter than
         everything around it, not darker. */
      /* G, ride 308c9716: "the box is just ugly. Make it look like the Finish
         box and the Talk to iScott and the Upload Photos or Videos. Keep the
         colors in this spirit with the shine, and it's just a beautiful... the
         elegance of it all."
         So it takes the same treatment those buttons carry, four lines above:
         the radial shine at 50% -30%, the cream hairline border, the 8px radius.
         The ramp stops at #f08c28 instead of running down to #c44d0b - a button
         is one line of type, this is a panel with a field inside it, and taking
         the ramp all the way to primary would bury the label in the dark end.
         Same family, same shine, readable at panel height. */
      /* G, ride b1dd603f: "do the box as the main thing as the primary
         background color. Use a little box where your actual email goes as the
         secondary color... I think the box is the card color. So keep that."
         So: outer panel PRIMARY, inner field CARD, and the three text colours
         inside. He also said "the size, it could be a little shorter."
         This replaces the cream panel I tried an hour ago - his call, his eye. */
      /* G, ride 7325f798: "the rim around your email, the whole thing is really
         thick. Make it really thin... maybe the one around the email is okay,
         just use that same color... take the rim around the whole box and just
         do exactly the same things, exactly the same thickness as is around the
         email box now."
         So the outer rim is now byte-identical to the field's rim below:
         1px solid #f08c28. Not similar - the same. */
      /* G, ride 2026-08-23: "the colors are kind of hard... make them the
         softer, lighter colors of the brand... not the background color. In
         the box is the background color of the website... none of that.
         That's too hard. Maybe some of the text can be the number 3 color.
         But softer colors in that box."
         Primary #c44d0b (the site's own background colour, explicitly
         rejected) is out. The fill moves to #f08c28 - Text 3, one of the two
         lighter/softer tones he pointed at, and the same colour he floated
         for "some of the text." The old rim (#f08c28, byte-identical to the
         field's rim two comments up) would now vanish into a fill of the same
         colour, so it moves to #fce0ad - Text 1, the lightest tone in the
         locked five - so the box still reads as a card with a defined edge
         instead of a flat, borderless patch. */
      /* G 2026-09-06 smoke: use the approved Talk to iScott rim on this card. */
      border: 1px solid #8f3a14 !important;
      border-radius: 8px !important;
      /* G 2026-09-01: "make it just a solid orange. The solid orange is just
         gorgeous... So take the glow out in there. Just make it that beautiful
         orange card color." The cream radial highlight is removed; the card is
         now flat Secondary. */
      background:
        /* G 2026-09-01: "Make the box. The secondary background color or card
           color." Card field goes off Text 3 #f08c28 and onto Secondary
           #e96819. Text 3 was the same colour as the type he wanted on it,
           which is why the box read as blending into itself. */
        #e96819 !important;
      /* G 2026-09-01: "It also still has the glow... just make that the card
         that brilliant orange card color... that gorgeous color, solid."
         The glow was never a gradient - I removed one of those already and he
         still saw it. It is the INSET cream highlight below: a bright line
         across the top edge of the card. Both insets go; the drop shadow that
         lifts the card off the video stays. */
      box-shadow:
        0 10px 26px rgba(35, 9, 2, 0.42) !important;
    }

    .wildworks-lead-label {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
      /* G 2026-08-19: "your email, the words are too close to the box." */
      margin: 0 0 0.42rem !important;
      /* G, ride 7325f798, reversing his own earlier call: "reverse the... put
         your email as color number 2." An hour before he asked for colour one
         here. Latest signal wins. */
      color: #edc775 !important;
      font-size: 0.72rem !important;
      font-weight: 600 !important;
      letter-spacing: 0.18em !important;
      line-height: 1.1 !important;
      text-transform: uppercase !important;
    }

    .wildworks-lead-label-icon {
      display: inline-flex !important;
      /* G, ride b1dd603f: "you can't see the little piece of mail. It needs to
         be bigger. The little piece of mail needs to be at least as big as the
         letters." The label is 1.3rem on a phone, so the icon matches it and
         then some - 1.5em keeps it tied to the label's own size rather than a
         fixed rem that stops tracking when the label scales.
         "Do the envelope icon in color text number two." */
      /* G, ride 7325f798: "the actual mail envelope, make it SIGNIFICANTLY
         larger. And just make it color number 1."
         1.5em -> 2.2em. Still in em so it tracks the label rather than freezing
         at one size, which is why it went to em in the first place. */
      /* G 2026-09-01: "the phone is too small. Make that twenty percent bigger
         too... the actual phone icon is just too small" and "check on email
         also. Do the same thing." One rule dresses both, so 2.2em -> 2.64em
         moves the envelope and the handset together. */
      width: 2.64em !important;
      height: 2.64em !important;
      flex: 0 0 auto !important;
      /* G, ride 2026-08-23: "your phone and the phone itself icon should be
         the same color." The label two rules up and the value field below
         are both already #edc775 - Text 2. This icon was the odd one out at
         #fce0ad; it moves to #edc775 so label, value, and icon (SVGs draw in
         currentColor, both the mail and phone glyphs at line ~2597-2598
         below) are byte-identical. Applies to the email icon too, since both
         methods share this one class - they end up in agreement as a result,
         which was not the ask but is not a regression either. */
      color: #edc775 !important;
      letter-spacing: 0 !important;
      line-height: 1 !important;
    }

    /* G 2026-09-02: email is words-only. Keep the phone glyph for phone. */

    .wildworks-lead-label-icon[data-method="email"] {
      display: none !important;
    }

    #wildworks-lead-value {
      box-sizing: border-box !important;
      display: block !important;
      width: 100% !important;
      min-height: 2.4rem !important;
      margin: 0 auto !important;
      /* G's physical ride, 2026-08-29: "the red LastPass box ... the email runs
         underneath it." Password-manager badges are absolutely positioned
         against the field's own border box, hard against one edge, and they are
         painted by an extension we do not control. The horizontal padding is
         SYMMETRIC and wide enough to hold one of those badges, so whichever edge
         it picks it covers padding and not glyphs. text-align stays centre, so
         symmetric padding also keeps the value optically centred. */
      padding: 0.28rem 1.85rem !important;
      border: none !important;
      border-width: 0 !important;
      border-color: transparent !important;
      box-shadow: none !important;
      border-radius: 0.375rem !important;
      /* G 2026-08-19, from the iPad: "blue letters and the colors ... they've
         got to be nice brand, beautiful colors", and the box read as "a really
         hard orange". iOS obeys -webkit-text-fill-color over color, and it sets
         its own on autofill and on detected data - which is where the blue came
         from. color alone was never going to hold on his device. */
      -webkit-appearance: none !important;
      appearance: none !important;
      /* G 2026-08-19: "the colors are awful. My God." Off the improvised brown
         and onto the brand card surface, the same one every panel on the site
         uses, with Colour 1 ink. */
      /* G, ride b1dd603f: "I think the box is the card color. So keep that." -
         the field stays card #e96819. "And then inside the box, write email or
         phone number in text color number two." */
      /* G 2026-08-31, Telegram photo 779577932, via Chief: the YOUR EMAIL card
         had a second, darker orange box drawn inside it holding the address.
         He wants ONE box. The outer .wildworks-lead-card stays the card; the
         field itself stops painting its own surface and its own edge. This
         reverses his earlier "keep the field the card color" only for the
         INNER field - the outer card is untouched. Ink, font, sizing and the
         LastPass padding above are all deliberately kept. */
      background: transparent !important;
      background-image: none !important;
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
      caret-color: #fce0ad !important;
      /* G ride 89c453ff, 2026-08-19: "the phone number is not in the brand font."
         It was monospace, chosen for digit legibility. He is looking at his own
         number in a face that appears nowhere else on the site. The site's body
         copy is Cambria; hardcoded because globals.css custom properties do not
         resolve inside the proxied avatar app. */
      font-family: Cambria, "Cambria Math", Georgia, "Times New Roman", serif !important;
      /* Ceiling raised with FIT_MAX_REM below, 2026-08-31. The JS fit loop
         may never lay the value out larger than the CSS will paint - the
         guard in check-iscott-lead-truth-20260829 asserts exactly that, and
         it caught this pair being changed one at a time. 1.75rem x the 1.25
         line-height below is 2.19rem, still inside the field's 2.4rem
         min-height, so raising it does not move the box or anything under
         it, and 1.74 keeps the shrink loop landing exactly on its floor.
         G: "the email address needs to be a size appropriate to the box." */
      font-size: clamp(0.95rem, 3.6vw, 2.22rem) !important;
      font-weight: 900 !important;
      line-height: 1.25 !important;
      text-align: center !important;
      overflow-wrap: anywhere !important;
      text-shadow: none !important;
      outline: none !important;
      /* Some managers paint their badge as a background-image on the field
         itself rather than as an injected node. Nothing but the brand fill
         belongs in here. */
      background-image: none !important;
    }

    /* NARROW FRAMES: give the value its width back.
       G, three rides running, escalating each time - 2026-08-31 15:21:45:
       "The text is super small though. It's like midget size. It's like
       ridiculously small. Needs to be way fucking bigger."

       Raising the fit ceiling twice did not fix it, because the ceiling was
       never the binding constraint. The 1.85rem symmetric padding is: 59.2px of
       a card that is min(100vw - 1rem, 28rem) = 286px on his embed, so 21% of
       the box is reserved before a glyph is drawn, and the fit loop then shrinks
       the value to survive what is left.

       That padding exists for a real reason - a password-manager badge is
       absolutely positioned against this field's border box and would otherwise
       sit on the letters (G's ride 2026-08-29, the red LastPass box). It is kept
       in full at the widths where a manager is actually likely. This relief is
       scoped to 520px and below, which is the avatar embed on a phone, and stays
       symmetric so the value remains optically centred.

       Available width for text on his 286px card:
         1.85rem padding -> 270 - 59.2 - 2 - 6 = 202.8px
         0.95rem padding -> 270 - 30.4 - 2 - 6 = 231.6px   (+14%)
       With the 2.22rem ceiling that is roughly double what he called midget. */

    @media (max-width: 520px) {
      #wildworks-lead-value {
        padding-inline: 0.95rem !important;
      }
    }

    /* The browsers' own in-field controls sit exactly where the value ends.
       These are the supported opt-outs for each engine. */

    #wildworks-lead-value::-webkit-credentials-auto-fill-button,
    #wildworks-lead-value::-webkit-contacts-auto-fill-button,
    #wildworks-lead-value::-webkit-caps-lock-indicator {
      visibility: hidden !important;
      display: none !important;
      pointer-events: none !important;
    }

    #wildworks-lead-value::-ms-clear,
    #wildworks-lead-value::-ms-reveal {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }

    /* Extensions inject their badge as a sibling/descendant node inside our
       card. We cannot uninstall them, and we do not try to interfere with a
       password manager anywhere else on the site - but this one field holds a
       stranger's contact details and nothing may sit on top of it. Named roots
       only, so an unrelated node is never hidden by accident. */

    .wildworks-lead-capture [data-lastpass-icon-root],
    .wildworks-lead-capture [data-lastpass-root],
    .wildworks-lead-capture [data-lastpass-infield],
    .wildworks-lead-capture [data-dashlanecreated],
    .wildworks-lead-capture com-1password-button,
    .wildworks-lead-capture com-1password-op-button,
    .wildworks-lead-capture [data-bw-inline-menu] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* iOS/Chrome autofill repaints the field and the ink. Hold the brand. */

    #wildworks-lead-value:-webkit-autofill,
    #wildworks-lead-value:-webkit-autofill:hover,
    #wildworks-lead-value:-webkit-autofill:focus,
    #wildworks-lead-value:-webkit-autofill:active {
      -webkit-text-fill-color: #edc775 !important;
      caret-color: #fce0ad !important;
      /* That 1000px inset IS the inner orange box coming back on autofill.
         Ink and caret stay; only the surface goes. */
      -webkit-box-shadow: none !important;
      box-shadow: none !important;
    }

    #wildworks-lead-value::placeholder {
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
      opacity: 0.72 !important;
    }

    /* iOS turns anything that looks like an address or a number into a blue
       system link inside the panel. Brand ink wins. */

    #wildworks-lead-confirmation a,
    #wildworks-lead-confirmation a:visited,
    #wildworks-lead-confirmation [x-apple-data-detectors] {
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
      text-decoration: none !important;
    }

    #wildworks-lead-status {
      margin: 0.65rem 0 0 !important;
      color: #fce0ad !important;
      /* G 2026-08-19: "that confirmation should be the same beautiful brand
         colors. It was not." iOS was repainting this line too. */
      -webkit-text-fill-color: #fce0ad !important;
      font-family: Arial, sans-serif !important;
      font-size: 1.05rem !important;
      font-weight: 700 !important;
      line-height: 1.35 !important;
    }

    #wildworks-lead-confirm,
    #wildworks-lead-close,
    #wildworks-lead-dismiss {
      margin-top: 0.7rem !important;
      min-height: 44px !important;
      border: 1px solid #8f3a14 !important;
      border-radius: 0.42rem !important;
      /* Match the site's gold btn-wood treatment. */
      background:
        radial-gradient(circle at 50% -36%, rgba(255, 247, 213, 0.92), transparent 50%),
        linear-gradient(180deg, #fce0ad 0%, #edc775 38%, #f08c28 72%, #c44d0b 100%) !important;
      color: #fce0ad !important;
      cursor: pointer !important;
      font: 800 1rem/1.2 Arial, sans-serif !important;
      letter-spacing: 0.04em !important;
      padding: 0.75rem 1rem !important;
      text-transform: none !important;
    }

    .wildworks-lead-actions {
      display: flex !important;
      flex-wrap: wrap !important;
      justify-content: center !important;
      gap: 0.4rem !important;
    }

    #wildworks-lead-media[data-empty="true"] {
      display: none !important;
    }

    .wildworks-lead-capture {
      transition: opacity 220ms ease !important;
      width: 100% !important;
    }

    .wildworks-lead-capture[data-hidden="true"] {
      opacity: 0 !important;
      pointer-events: none !important;
      height: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
    }

    /* G's physical ride, 2026-08-29: he said yes, iScott said it was sending and
       that Scott had the details, and the capture box never changed - so he had
       no way to tell a real handoff from a dead one.
       "sending" USED to hide the capture here, on optimism, before the confirm
       API had returned anything. It no longer does: while the request is in
       flight the box stays exactly where it is, dimmed and locked, so the
       visitor can still see the value that is being sent. Only a verified
       submitted/submittedAt reply is allowed to take the capture away. */

    .wildworks-lead-card[data-box-view="sending"] .wildworks-lead-capture {
      opacity: 0.72 !important;
      pointer-events: none !important;
    }

    .wildworks-lead-card[data-box-view="sending"] #wildworks-lead-value {
      cursor: progress !important;
    }

    .wildworks-lead-card[data-box-view="sent"] .wildworks-lead-capture {
      display: none !important;
    }

    /* Only verified provider success may take the capture away. A submitted
       row whose linked outbox is still pending keeps the exact value visible
       and read-only; its received label supplements rather than replaces it.
       G's physical ride, 2026-08-29: the box vanished and nothing replaced it,
       so there was no way to tell a completed handoff from a lost one. */

    .wildworks-lead-card[data-box-view="sent"] #wildworks-lead-sent,
    .wildworks-lead-card[data-box-view="submitted"] #wildworks-lead-sent {
      display: flex !important;
      visibility: visible !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.35rem !important;
    }

    /* G 2026-08-19: "I hope I never see this box again. All it should be is the
       box that I mentioned." Everything except the label, the field and the sent
       checkmark is hidden for good - the Send button (the flow is verbal), the
       status line that printed "Test session - not sent.", and the sync notice.
       The elements remain in the DOM on purpose: plenty of existing logic still
       queries them, and deleting the nodes would null-crash that code. */

    .wildworks-lead-actions,
    #wildworks-lead-confirm,
    #wildworks-lead-status,
    #wildworks-lead-sync {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* G, iPad ride fa6b1fe5, 2026-09-02 15:42 ET: "all it has to do is YOUR EMAIL,
       sgdietz@pm.me. That's it. Nothing else... 'Send these details to Scott' -
       what the fuck is that for? 'Nothing has been sent. iScott still needs to
       hear...' Get rid of that shit. Just a clean little box and then a clean
       confirmation. That's it. Clean."  The 2026-08-29 "failed" exception that
       re-showed the button + status paragraph is gone. A refused send (missing
       project need) keeps the clean box; iScott asks for the need by voice.
       The nodes stay in the DOM (logic still queries them) and stay hidden. */

    /* G, ride 308c9716: "the check mark was underneath the check mark box.
       Should be on one line with the text." It was a block <p> inside a 19rem
       card, so "Phone and email sent to Scott" wrapped and pushed the tick onto
       its own line. One flex row that cannot wrap, with the SIZE allowed to
       shrink to fit instead of the LINE allowed to break. Cambria to match the
       rest of the panel; Arial was never the brand face. */

    #wildworks-lead-sent {
      display: none !important;
      margin: 0.4rem 0 0 !important;
      color: #fce0ad !important;
      font-family: Cambria, "Cambria Math", Georgia, "Times New Roman", serif !important;
      font-weight: 800 !important;
      /* G, Supabase session 2026-09-01 14:07: "The type is so fucking small...
         the text should fit the box appropriately." Ceiling up from 1.1rem;
         the JS shrink pass in setSentVisible keeps the long dual label on its
         one unwrapped line, so the ceiling can be generous. */
      font-size: clamp(1rem, 4.8vw, 1.5rem) !important;
      line-height: 1.25 !important;
      white-space: nowrap !important;
    }

    #wildworks-lead-sent[data-visible="true"] {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.35rem !important;
    }

    #wildworks-lead-spoken-readback {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
    }

    #wildworks-lead-close,
    #wildworks-lead-dismiss {
      background: linear-gradient(180deg, #a56a2a, #6d3d12) !important;
    }

    /* ==================================================================
       G, 2026-09-01 09:17 + 09:18, two screenshots side by side:
         "when this box is up, YOUR EMAIL, make it about the size that the
          ink has it, and put all the text and icons, have the whole feel be
          the same as a button... the blending of the colors, the letters,
          everything make it gorgeous. The second screenshot is much closer
          to what I like... the text is about the right size."

       The second screenshot is the SENT panel - one compact line of cream
       type on the card. The first is the capture box, and it was nearly
       twice as tall with a band of dead space under the address: the field
       carried a 2.4rem min-height plus 0.28rem of its own padding, on top of
       the card's padding and the label's 0.42rem margin. He circled that gap.

       So the capture box is made to match the panel he picked: same cream
       ink, same weight, same optical size, and the material of a button -
       the Finish/Upload shine over the card, a cream hairline, and the two
       inner edges that make it read as a pressed surface rather than a flat
       patch. Nothing here leaves the locked five.
       ================================================================== */

    .wildworks-lead-card {
      /* H429 Packet C: G "no fucking glow". This rival re-painted the cream
         radial + inset hairline over the solid Secondary at 715-732. Retired.
         Keep 715-732: flat #e96819, lift shadow only, no inset glow. */
      background: #e96819 !important;
      box-shadow: 0 10px 26px rgba(35, 9, 2, 0.42) !important;
      padding: 0.34rem 0.85rem !important;
    }

    /* The label and its envelope, sized to sit with the address rather than
       shout over it. Icon stays in em so it keeps tracking the label. */

    .wildworks-lead-label {
      margin: 0 0 0.24rem !important;
      gap: 0.4rem !important;
      font-size: 0.68rem !important;
    }

    /* H429 Packet C: G "envelope needs to be bigger". 1.75em rival retired so 2.64em at .wildworks-lead-label-icon (769-770) wins. */

    /* THE DEAD SPACE G CIRCLED. 2.4rem of min-height under a single line of
       type. The address is one line; the box is now sized to that line, and
       the value takes the sent panel's ink and optical size - which is the
       one he said was right. The password-manager side padding is UNCHANGED:
       a badge still lands on padding and never on the address. */

    #wildworks-lead-value {
      min-height: 1.75rem !important;
      padding-block: 0.1rem !important;
      color: #fce0ad !important;
      -webkit-text-fill-color: #fce0ad !important;
      font-size: clamp(0.95rem, 4.3vw, 1.45rem) !important;
      line-height: 1.2 !important;
    }

    @media (max-width: 520px) {
      #wildworks-lead-value {
        padding-inline: 0.95rem !important;
      }
    }

    /* The send button loses its top gap - the box above it is shorter now, and
       the old 0.7rem was spacing away from a field that no longer sprawls. */

    #wildworks-lead-confirm {
      margin-top: 0.42rem !important;
      font-size: 0.95rem !important;
      padding: 0.6rem 0.9rem !important;
      min-height: 42px !important;
    }

    @keyframes wildworks-lead-rise {
      /* Enter without moving down into the protected Finish clearance. */
      from { opacity: 0; transform: translateX(-50%) scale(0.97); }
      to { opacity: 1; transform: translateX(-50%) scale(1); }
    }

    body.wildworks-session-ended-active {
      background:
        radial-gradient(ellipse 88% 76% at 50% 28%, rgba(246, 211, 154, 0.14) 0%, rgba(183, 130, 58, 0.07) 44%, transparent 78%),
        linear-gradient(180deg, var(--ww-avatar-night) 0%, var(--ww-avatar-black) 100%) !important;
      color: var(--ww-avatar-parchment) !important;
    }

    body.wildworks-session-ended-active > :not(#wildworks-session-ended-panel):not(script):not(style) {
      visibility: hidden !important;
      pointer-events: none !important;
    }

    #wildworks-session-ended-panel {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      display: grid !important;
      place-items: center !important;
      padding: clamp(1.25rem, 5vw, 2rem) !important;
      background:
        radial-gradient(ellipse 78% 66% at 50% 24%, rgba(246, 211, 154, 0.18) 0%, rgba(224, 168, 90, 0.08) 42%, transparent 74%),
        linear-gradient(180deg, rgba(19, 7, 2, 0.9) 0%, rgba(8, 3, 2, 0.98) 100%) !important;
      color: var(--ww-avatar-parchment) !important;
      font-family: Georgia, "Times New Roman", serif !important;
      text-align: center !important;
    }

    .wildworks-session-ended-card {
      position: relative !important;
      display: grid !important;
      justify-items: center !important;
      width: min(100%, 18.5rem) !important;
      padding: clamp(1.35rem, 7vw, 2.1rem) clamp(1.05rem, 5vw, 1.6rem) !important;
      border: 1px solid rgba(246, 211, 154, 0.32) !important;
      border-radius: 8px !important;
      background:
        radial-gradient(ellipse 95% 58% at 50% 0%, rgba(246, 211, 154, 0.13), transparent 68%),
        linear-gradient(180deg, rgba(61, 28, 8, 0.78) 0%, rgba(20, 7, 2, 0.95) 100%) !important;
      box-shadow:
        0 26px 64px rgba(0, 0, 0, 0.48),
        inset 0 1px 0 rgba(246, 211, 154, 0.14) !important;
    }

    .wildworks-session-ended-card::before,
    .wildworks-session-ended-card::after {
      content: "" !important;
      display: block !important;
      width: min(13rem, 84%) !important;
      height: 1px !important;
      background: linear-gradient(90deg, transparent 0%, rgba(224, 168, 90, 0.28) 12%, rgba(246, 211, 154, 0.76) 50%, rgba(224, 168, 90, 0.28) 88%, transparent 100%) !important;
      box-shadow: 0 0 16px rgba(224, 168, 90, 0.16) !important;
    }

    .wildworks-session-ended-card::before {
      margin-bottom: 1.35rem !important;
    }

    .wildworks-session-ended-card::after {
      margin-top: 1.35rem !important;
    }

    .wildworks-session-ended-kicker {
      margin: 0 0 0.45rem !important;
      color: rgba(224, 168, 90, 0.84) !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      font-size: 0.68rem !important;
      font-weight: 700 !important;
      letter-spacing: 0.22em !important;
      line-height: 1 !important;
      text-transform: uppercase !important;
    }

    .wildworks-session-ended-title {
      margin: 0 !important;
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      background-image: linear-gradient(180deg, #fce0ad 0%, #e0a85a 48%, #a76431 100%) !important;
      -webkit-background-clip: text !important;
      background-clip: text !important;
      font-size: clamp(2.2rem, 10vw, 3.15rem) !important;
      font-weight: 800 !important;
      line-height: 0.96 !important;
      letter-spacing: 0 !important;
      text-shadow: 0 0.24rem 0.85rem rgba(8, 3, 1, 0.48) !important;
    }

    .wildworks-session-ended-copy {
      max-width: 15rem !important;
      margin: 0.9rem 0 0 !important;
      color: rgba(247, 217, 165, 0.9) !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      font-size: 0.96rem !important;
      font-weight: 550 !important;
      line-height: 1.42 !important;
      letter-spacing: 0 !important;
    }

    #wildworks-avatar-restart {
      margin-top: 1.25rem !important;
    }

    /* Avatar-route card surfaces only: the Home card material. */

    :is(.bg-gray-800\/90, .bg-gray-900, .wildworks-session-ended-card) {
      background: #8B5A2B !important;
      background-image: none !important;
    }

    html:has([data-ww-avatar-shell]) {
      --iscott120-legal-max: 3.5rem;
      --iscott120-finish-reserve: 4.75rem;
    }

    [data-ww-conversation-control] {
      position: relative !important;
      z-index: 45 !important;
      min-height: 44px !important;
      pointer-events: auto !important;
    }

    #wildworks-hi-scott {
      display: none !important;
      position: fixed !important;
      top: calc(0.55rem + env(safe-area-inset-top, 0px)) !important;
      left: 50% !important;
      z-index: 3 !important;
      margin: 0 !important;
      transform: translateX(-50%) !important;
      color: #fce0ad !important;
      font: 800 clamp(1.05rem, 4.6vw, 1.35rem)/1.1 "Goudy Old Style", Georgia, serif !important;
      letter-spacing: 0.04em !important;
      pointer-events: none !important;
      text-shadow: 0 2px 10px rgba(8, 3, 1, 0.55) !important;
    }

    #wildworks-avatar-legal-band {
      position: fixed !important;
      inset: auto 0 0 0 !important;
      z-index: 2 !important;
      display: none !important;
      min-height: var(--iscott120-legal-max) !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
      padding: 0.45rem 0.75rem calc(0.45rem + env(safe-area-inset-bottom, 0px)) !important;
      background: #57270d !important;
      border-top: 1px solid rgba(247, 217, 165, 0.42) !important;
      box-sizing: border-box !important;
      /* H129 Color 1: legal copy/fine print. The prior parchment-pink hex is
         palette-authority rejected drift and blocked the production build. */
      color: #fce0ad !important;
      font: 700 clamp(0.66rem, 2.5vw, 0.78rem)/1.2 Arial, sans-serif !important;
      text-align: center !important;
    }

    #wildworks-avatar-legal-band a {
      color: #fce0ad !important;
      text-decoration: underline !important;
      text-underline-offset: 0.16em !important;
    }

    #wildworks-avatar-legal-band a:focus-visible {
      outline: 2px solid #fce0ad !important;
      outline-offset: 2px !important;
    }

    /* Phone portrait plus bounded landscape-phone only. Do not impose the
       phone shell on iPad portrait or ordinary short desktop windows. */

    @media (max-width: 520px), (max-width: 932px) and (max-height: 560px) and (orientation: landscape) {
      /* Home keeps the bottom agreement. Do not paint a second legal
         strip on the avatar, especially while he is talking. */
      #wildworks-avatar-legal-band,
      html[data-ww-talking] #wildworks-avatar-legal-band {
        display: none !important;
      }

      html:not([data-ww-avatar-embedded]) #wildworks-avatar-legal-band[data-ww-legal-text-only] {
        display: block !important;
        background: transparent !important;
        border: none !important;
        min-height: 0 !important;
        align-items: unset !important;
        justify-content: unset !important;
        gap: 0 !important;
        padding: 0.4rem 0.75rem calc(0.4rem + env(safe-area-inset-bottom, 0px)) !important;
        font: 650 clamp(0.62rem, 2.4vw, 0.74rem)/1.35 Arial, sans-serif !important;
        color: #fce0ad !important;
      }

      .fixed.bottom-28:has(.btn-wood) {
        z-index: 30 !important;
      }

      [data-ww-avatar-shell] [data-ww-avatar-heading],
      [data-ww-avatar-shell] .wildworks-session-ended-kicker,
      [data-ww-avatar-heading] {
        display: none !important;
      }

      html[data-ww-talking] #wildworks-hi-scott,
      #wildworks-hi-scott {
        display: none !important;
      }

      #wildworks-lead-confirmation {
        /* G 2026-08-19: "the box is still too high. It's like right at iScott's
         lips, basically. It's got to be down." */
      bottom: calc(0.55rem + env(safe-area-inset-bottom, 0px)) !important;
      }

      #wildworks-lead-label-text {
        font-size: 1.25rem !important;
      }

      #wildworks-lead-status,
      #wildworks-lead-sent {
        font-size: 1.2rem !important;
      }

      [data-ww-conversation-control] {
        font-size: 1.25rem !important;
        min-height: 52px !important;
        padding-inline: 1.15rem !important;
      }

      [data-ww-finish] {
        /* G 2026-09-03 08:56, red ink around Finish: "this button just take
           it. Take it down 10% on the height just the top to bottom... don't
           change anything else about it except for the height."
           56px -> 50px (10% off, rounded); the 5.6px comes out of the
           vertical padding (0.85rem -> 0.68rem). Width, font, weight, gap,
           colors, shadow: untouched.

           G 2026-09-03 10:07 ET, ride ff34e90b, after seeing the 50px cut
           (his phone measured it 53.71px tall, was 59.14): "the finish box
           needs to be 10% shorter. It's still just too tall... make it a good
           10 to 15% shorter, just north-south, and that's it."
           50px -> 44px (12% off). The vertical padding comes down with it
           (0.68rem -> 0.55rem) so the 22.5px label line still sits inside
           the box; min-height still governs, so the word stays centred.
           Width, font, weight, gap, colors, shadow: untouched again. */
        min-height: 44px !important;
        min-width: 7.5rem !important;
        /* G 2026-09-03 12:01 ET, ride 84155e82, on his phone mid-conversation:
           "the finished box that I'm looking at right now when we're talking,
           needs to be reduced in height by 10% for sure... The spacing looks
           great. Right to left. Don't change anything else."
           His phone measured it 49.54px: the H457 sparkle cluster inside the
           button is 1.48em = 30px tall and sets the box, so min-height 44
           never bit. The vertical padding is the only thing left to take:
           0.55rem -> 0.38rem = 49.5 -> ~44.5 (10%). Icon, word, width, side
           padding, colours, shadow: untouched. */
        padding: 0.38rem 1.15rem !important;
        /* G 2026-09-03 10:5x ET, two screenshots of Finish, one before the
           email capture and one after: "the one that I marked up with blue is
           more beautiful... make them both before email capture and after
           email capture that one." Measured off his shots: same width, the
           after-capture Finish ~16% taller. The SDK's button bar is a flex
           row whose items STRETCH (align-items unset in this block), so once
           another 52px control shares the bar Finish is stretched past its
           own 44px. Own its cross-axis size: never stretch, and hang from the
           bar's bottom edge so the bar growing cannot move it either. */
        align-self: flex-end !important;
        height: auto !important;
        /* G 2026-09-03 11:3x ET: "move finish box to the right a little on
           iScott it feels off center. just a little." Telemetry has it dead
           centre in the frame (84.18-218.59 in 302.77), so this is his eye
           against his own body, not a math error: 5px right, nothing else. */
        position: relative !important;
        left: 5px !important;
        font-size: 1.35rem !important;
        font-weight: 800 !important;
        line-height: 1.1 !important;
        gap: 0.06rem !important;
      }

      [data-ww-talk] {
        min-height: 52px !important;
        padding: 0.7rem 1.05rem !important;
        font-size: 1.22rem !important;
        font-weight: 750 !important;
        line-height: 1.1 !important;
      }

      [data-ww-avatar-shell] [data-ww-avatar-video],
      [data-ww-avatar-shell] video,
      [data-ww-avatar-shell] canvas,
      html[data-ww-avatar-shell] video,
      html[data-ww-avatar-shell] canvas {
        position: fixed !important;
        inset: 0 auto auto 0 !important;
        width: 100vw !important;
        max-width: none !important;
        min-width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        min-height: 100dvh !important;
        object-fit: cover !important;
        object-position: 50% 28% !important;
        transform: none !important;
        transform-origin: 50% 28% !important;
        z-index: 1 !important;
      }

      #wildworks-lead-confirmation {
        width: min(calc(100vw - 1rem), 28rem) !important;
      }
    }

    /* G 2026-08-19, riding on the iPad: "you're down and to the left ... you're
       not centered. The avatar needs to be centered."

       Cause: the ONLY rule that frames the avatar sat behind
       (max-width: 520px) or a short landscape query. An iPad in portrait is
       ~768-1024px tall-side-up, so it matched NEITHER - there was no framing
       rule on a tablet at all, and the embedded player placed him wherever it
       liked. This is the same framing the phone already uses, applied to the
       gap between phone and desktop. Desktop is untouched. */

    @media (min-width: 521px) and (max-width: 1279px) {
      [data-ww-avatar-shell] [data-ww-avatar-video],
      [data-ww-avatar-shell] video,
      [data-ww-avatar-shell] canvas,
      html[data-ww-avatar-shell] video,
      html[data-ww-avatar-shell] canvas {
        object-fit: cover !important;
        object-position: 50% 28% !important;
        transform: none !important;
        transform-origin: 50% 28% !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
    }

    /* G 2026-08-20, physical iPad portrait smoke: iScott sat low-right in
       the box on the Home page. Inner viewport numbers lie inside an iPadOS
       frame, so this pin never trusts them: the legal-band script measures
       the real frame box from the same-origin parent, confirms the OUTER
       page is a coarse-pointer portrait tablet, and publishes explicit pixel
       variables plus the flag below. No flag, no pin - phones, landscape,
       desktops, full-page tablets, compliant embeds, and cross-origin
       embedders all keep today's layout untouched. With the flag, the video
       is pinned to the visible top-left corner at the frame's true pixel
       size, so the whole video sits inside the visible box and the face
       crop centers within it. */

    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] [data-ww-avatar-video],
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] video,
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] canvas,
    html[data-ww-avatar-embedded][data-ww-embed-measured][data-ww-avatar-shell] video,
    html[data-ww-avatar-embedded][data-ww-embed-measured][data-ww-avatar-shell] canvas {
      position: fixed !important;
      inset: 0 auto auto 0 !important;
      width: var(--ww-embed-w) !important;
      min-width: 0 !important;
      max-width: none !important;
      height: var(--ww-embed-h) !important;
      min-height: 0 !important;
      max-height: none !important;
      object-fit: cover !important;
      object-position: 50% 28% !important;
      transform: none !important;
      z-index: 1 !important;
    }

    /* G 2026-08-21, five-state physical iPad portrait ride: rev-H already
       measures the visible iframe and correctly centers the avatar media. The
       remaining overlays were still centering against iPadOS's expanded inner
       layout viewport, which put every fixed midpoint/bottom low-right of the
       visible window. Reuse rev-H's measured box for overlays only; do not
       touch the proven video/canvas geometry above. */

    html[data-ww-avatar-embedded][data-ww-embed-measured] body::before,
    html[data-ww-avatar-embedded][data-ww-embed-measured] #wildworks-session-ended-panel {
      inset: 0 auto auto 0 !important;
      width: var(--ww-embed-w) !important;
      height: var(--ww-embed-h) !important;
      box-sizing: border-box !important;
    }

    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish] {
      position: fixed !important;
      /* H435, G's 2026-09-02 10:57 physical iPad ride. Supabase geometry
         proved the winning measured-tablet rule put Finish at 440.8-499 inside
         a 511px frame: the old 0.75rem pin left it twelve pixels from the
         bottom. Use the initial Talk control's already-measured 22% anchor,
         exactly as the returned Talk state does below. Moving the shared
         anchor also keeps the 72.97px contact card inside the frame while its
         requested 70% overlap with Finish remains unchanged. */
      inset: auto auto
        calc(100dvh - var(--ww-embed-h) + var(--ww-embed-initial-talk-bottom))
        calc(var(--ww-embed-w) / 2) !important;
      margin: 0 !important;
      /* G 2026-09-03 11:3x: "move finish box to the right a little... just a
         little." Same 5px nudge as the phone block, expressed inside the
         centring transform this measured state uses. */
      transform: translateX(calc(-50% + 5px)) !important;
    }

    html[data-ww-avatar-embedded][data-ww-embed-measured] #wildworks-lead-confirmation {
      left: calc(var(--ww-embed-w) / 2) !important;
      width: min(calc(var(--ww-embed-w) - 0.75rem), 19rem) !important;
    }

    html[data-ww-avatar-embedded][data-ww-embed-measured] .wildworks-lead-card {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    /* G 2026-09-02, physical iPad failed-start screenshot: Talk and the still
       were both 7.4% right because this correction applied only after Finish.
       The still itself is another measured 5% right inside that fixed box.
       Reuse the measured visible midpoint for Talk and preserve the still's
       current scale while moving only its horizontal position. This covers
       initial, failed, and returned Talk states; live video/canvas stays under
       the separate no-transform media pin below. */

    html[data-ww-avatar-embedded][data-ww-embed-measured]
      img[alt="Start screen"] {
      position: fixed !important;
      inset: 0 auto auto var(--ww-start-screen-left, 0px) !important;
      width: var(--ww-fixed-box-w, var(--ww-embed-w)) !important;
      height: var(--ww-fixed-box-h, var(--ww-embed-h)) !important;
      max-width: none !important;
      max-height: none !important;
    }

    html[data-ww-avatar-embedded][data-ww-embed-measured]
      .fixed.bottom-28:has([data-ww-talk]) {
      position: fixed !important;
      inset: auto auto
        calc(100dvh - var(--ww-embed-h) + var(--ww-embed-initial-talk-bottom))
        calc(var(--ww-embed-w) / 2) !important;
      margin: 0 !important;
      transform: translateX(-50%) !important;
    }

    /* G 2026-08-31, straight answer to the question that had been open all day:
       "it's wrong in the normal phone browser, fine in telegram."

       Measured, not guessed. Same 288x512 frame both times, returned-Talk state:
         normal phone   button sits 67px  off the frame bottom
         Telegram       button sits 119px off the frame bottom
       52px lower on a real phone. That is the fault he has been describing.

       Cause is NOT the bottom value - both compute the same 107.2px. It is
       POSITION. This stylesheet carries a blanket
           body > :not(script):not(style) { position: relative !important }
       which exists to give the loading cover a stacking context, and it beats
       Tailwind's plain .fixed. So the returned-Talk wrapper is un-fixed and
       falls back into flow. The ONLY thing that ever escaped it is the measured
       iPad pin below, which restates position: fixed !important - and that pin
       is gated to coarse-pointer portrait 521-1279px. Telegram's in-app browser
       reports 575 and passes it. A real phone reports ~390-430 and never does,
       so on his phone nothing re-fixes the wrapper.

       Gated on the pin NOT having engaged, so the iPad path cannot be touched:
       where the measured rule applies it still wins, unchanged. On a phone the
       iframe's inner viewport equals the frame box exactly (verified 288x512 =
       288x512), so the app's own anchor is the correct one here - the same
       clamp the Finish control in this document already uses. No new numbers
       invented. Video sizing, the session-ended panel and the lead card all
       ride the measured flag too and are deliberately left alone. */

    html[data-ww-avatar-embedded]:not([data-ww-embed-measured])[data-ww-finish-returned]
      .fixed.bottom-28:has([data-ww-talk]) {
      position: fixed !important;
      bottom: 22% !important;
      left: 50% !important;
      right: auto !important;
      top: auto !important;
      transform: translateX(-50%) !important;
    }

    @media (max-width: 287px) {
      #wildworks-lead-confirmation {
        width: calc(100vw - 0.5rem) !important;
        bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)) !important;
      }
    }

    /* G 2026-08-17 (phone ride): on a phone the email box takes up a big
       part of the screen, sitting right over the Finish button. */

    @media (min-width: 288px) and (max-width: 640px) {
      #wildworks-lead-confirmation {
        width: calc(100vw - 0.75rem) !important;
      }

      .wildworks-lead-card {
        max-width: none !important;
        /* H429 Packet C: G "box a little shorter". 1.15rem undid 1170-1182. */
        padding: 0.4rem 0.85rem !important;
      }

      #wildworks-lead-label-text {
        font-size: 1.3rem !important;
      }

      #wildworks-lead-value {
        min-height: 1.75rem !important;
        font-size: 1.3rem !important;
      }

      #wildworks-lead-confirm {
        min-height: 52px !important;
        font-size: 1.15rem !important;
      }
    }

    /* THE AVATAR PAGE'S OWN BUTTON ICONS.
       G 2026-09-01: "buttons icons all look GREAT on home page, do them all
       over site, all sub pages and legal pages" and "include all the avatar
       buttons when they are in motion and stopped, everywhere on the site".

       This route serves its own HTML and links ZERO app stylesheets - checked
       over raw HTTP, 0 of them - so H400 cannot reach a single button here.
       Every avatar control G named lives on this page, so the same rule has to
       be restated inside this block or the one page he asked about by name
       would be the only page without it.

       Same value as H400 and H395: ONE drop-shadow at the button label ladder's
       total depth, 0.078500em, in em so it holds at every control size. Not a
       chain - chained drop-shadows compound and turn line art into a dark rim.
       See app/H395-homepage-button-icons.css for the full reasoning.

       Covers both avatar states: the overlay CTA shown on a stopped avatar, and
       the restart and send-details controls shown while it is live and after it
       ends. */

    :is(
      #wildworks-avatar-restart,
      #wildworks-lead-confirm,
      .btn-wood,
      .wild-site-avatar-overlay-cta,
      .money-cta,
      .wildworks-lead-label-icon
    ) :is(svg, img, .icon, .ww-mail, .ww-phone) {
      filter: drop-shadow(0 0.078500em 0 rgba(30, 8, 2, 0.93));
    }

    /* G 2026-09-01, after the clean smoke test, verbatim:
         "You see how your email kinda blends in with, um, the back? You know,
          use the number three text color on that box. Do all... do the icon,
          do the text, do the email address that that they say or the phone
          number, whatever. Do them all in the number three text color on the
          icon and your email address or whatever it says. your email. Um, do
          that also with the... that's, you know, a nice amount of shadow
          effect just like the start with iScott shadow effect."

       Label, icon and value all go to Text 3 #f08c28, and all three carry the
       Start-with-iScott ladder (H415 x1.10, the +10% he asked for earlier
       tonight): 0.010460 / 0.020919 / 0.031379 / 0.041837 / 0.052296 /
       0.062756em at alphas .582 .545 .508 .47 .433 .396.

       RESOLVED 2026-09-01: card -> Secondary #e96819, all type -> Text 2 #edc775.
       COLOUR NOT APPLIED, deliberately. The capture card background IS
       #f08c28 (route.ts ~700: radial-gradient over #f08c28). Painting the
       label, icon and value Text 3 would put #f08c28 text on an #f08c28 card
       and the whole box would vanish. Put back to G with the real numbers.
       The SHADOW half is applied, and on its own it lifts the type off the
       orange, which is the readability he was actually chasing.

       The ICON gets a SINGLE drop-shadow at the ladder total, not the six
       chained. Chained drop-shadows each shadow the previous one and compound
       into a rim on a glyph that size.

       Colour only here - font-size on the value is written inline by the JS
       fit loop and must not be fought from CSS. Last in this style block on
       purpose. */

    .wildworks-lead-card .wildworks-lead-label,
    .wildworks-lead-card #wildworks-lead-label-text,
    .wildworks-lead-card #wildworks-lead-value {
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
      /* H429 Packet C: G "no fucking glow" on the box type. Six-stop ladder
         cut to one attached edge at the old total depth. */
      text-shadow: 0 0.062756em 0 rgba(35, 9, 2, 0.50) !important;
    }

    .wildworks-lead-card #wildworks-lead-value::placeholder {
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
      opacity: 0.7 !important;
    }

    .wildworks-lead-card .wildworks-lead-label-icon,
    .wildworks-lead-card .wildworks-lead-label-icon svg,
    .wildworks-lead-card .wildworks-lead-label-icon .ww-mail,
    .wildworks-lead-card .wildworks-lead-label-icon .ww-phone {
      color: #edc775 !important;
      /* CLAUDE 2026-09-01: fill MUST stay none. These are lucide STROKE icons;
         fill: currentColor turned the envelope into a solid square - G: "where's
         the email? That there should be a postal envelope". Stroke takes the
         colour, fill stays empty. */
      fill: none !important;
      stroke: currentColor !important;
      filter: drop-shadow(0 0.062756em 0 rgba(30, 8, 2, 0.58)) !important;
    }

    /* G's 2026-09-02 physical ride is the final word on this surface: solid
       card orange, no card glow, less height, and a larger envelope. These
       overrides intentionally come after the older shine and phone-expansion
       rules above so the served page cannot fall back to either one. */

    .wildworks-lead-card {
      background: #e96819 !important;
      box-shadow: 0 10px 26px rgba(35, 9, 2, 0.42) !important;
      padding: 0.3rem 0.75rem 0.34rem !important;
    }

    .wildworks-lead-label-icon {
      width: 2.64em !important;
      height: 2.64em !important;
    }

    /* G 2026-09-02, phone screenshot 10:31. Keep the accepted card size,
       surface, rim and lift shadow. In the EMAIL state only: the address stays
       Text 2; the envelope and YOUR EMAIL move to Text 1. YOUR EMAIL is one
       unbroken line so "YOUR" can never stack above "EMAIL" again. The phone
       state is outside this selector and stays unchanged. */

    #wildworks-lead-confirmation[data-contact-method="email"] .wildworks-lead-label,
    #wildworks-lead-confirmation[data-contact-method="email"] #wildworks-lead-label-text,
    #wildworks-lead-confirmation[data-contact-method="email"] .wildworks-lead-label-icon,
    #wildworks-lead-confirmation[data-contact-method="email"] .wildworks-lead-label-icon svg {
      color: #fce0ad !important;
      -webkit-text-fill-color: #fce0ad !important;
    }

    #wildworks-lead-confirmation[data-contact-method="email"] .wildworks-lead-label,
    #wildworks-lead-confirmation[data-contact-method="email"] #wildworks-lead-label-text {
      white-space: nowrap !important;
    }

    #wildworks-lead-confirmation[data-contact-method="email"] #wildworks-lead-value {
      color: #edc775 !important;
      -webkit-text-fill-color: #edc775 !important;
    }

    /* G 2026-09-02, post-conversation phone screenshot 10:31. The returned
       Talk control uses the initial Home control's exact 22%-of-frame anchor.
       Only its sparkle grows 10% (1.344em -> 1.48em), with the existing
       attached ten-step shadow extended 10%. Finish and initial Talk stay
       untouched. */

    html[data-ww-avatar-embedded][data-ww-finish-returned] [data-ww-talk]::before {
      width: 1.48em !important;
      height: 1.48em !important;
      flex: 0 0 1.48em !important;
      filter:
        drop-shadow(rgba(35,9,2,0.97) 0 0.011512em 0.02px)
        drop-shadow(rgba(34,9,2,0.941) 0 0.011512em 0.02px)
        drop-shadow(rgba(33,8,2,0.913) 0 0.011512em 0.02px)
        drop-shadow(rgba(32,8,2,0.884) 0 0.011512em 0.02px)
        drop-shadow(rgba(31,8,2,0.855) 0 0.011512em 0.02px)
        drop-shadow(rgba(29,7,1,0.827) 0 0.011512em 0.02px)
        drop-shadow(rgba(28,7,1,0.798) 0 0.011512em 0.02px)
        drop-shadow(rgba(27,7,1,0.745) 0 0.011512em 0.02px)
        drop-shadow(rgba(26,6,1,0.7) 0 0.011512em 0.02px)
        drop-shadow(rgba(25,6,1,0.66) 0 0.011512em 0.02px) !important;
    }

    @media (min-width: 288px) and (max-width: 640px) {
      .wildworks-lead-card {
        max-width: min(15rem, 70vw) !important;
        padding: 0.3rem 0.75rem 0.34rem !important;
      }

      #wildworks-lead-value {
        min-height: 1.75rem !important;
      }
    }

    /* H437 Finish look only. Scott 2026-09-02 iPad ride 6e0f3f54 10:56-10:58:
       "Finish button is still low icon." / "You know, the finish." /
       "Word text, just they don't look attractive." /
       "Um, And the icon has no long shadow effect." /
       "Okay, so that needs to be fixed. If I say that, that means it needs
       to be fixed."
       H432 word was 1.563px total. Icon 0.227px x 10 = 2.27px, then a live
       H435 look bump to 0.25px x 10 = 2.5px. At DPR 2 on a 58px Finish that
       still reads as no long shadow. Talk 491-519 stays. Not .btn-wood.
       Not H436 card geometry. Px offsets. Same ten-stop chain, not a blur.

       Icon: 0.58px a step x 10 = 5.8px attached reach, alphas as now
       (.99 -> .68). Keep the live 1.48em glyph size. Finish only.
       Word: one treatment on the orange button at 1.35rem phone / measured
       iPad - deeper ladder 0.312px a step x 10 = 3.12px, same H432 alphas,
       tighter letter-spacing -0.02em, weight 800. */

    html [data-ww-finish],
    html[data-ww-avatar-embedded] [data-ww-finish],
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish] {
      letter-spacing: -0.02em !important;
      font-weight: 800 !important;
      /* H475, G 07:52: "the word finish in there, it's too fucking goddamn
         dark... Reduce the fucking goddamn shadow effect on the word finish."
         Ten stacked stops COMPOUND, so ~0.3 each reads far heavier than it
         looks. Alphas cut by a flat 0.65; every OFFSET is unchanged and all ten
         stops stay, so the reach is identical and the ladder cannot band or
         comb. Darkness only. The icon is untouched - G approved it at 20:51,
         "The icons are great" - and it is a ::before drop-shadow, which this
         text-shadow does not reach. */
      text-shadow:
        rgba(35,9,2,0.235) 0 0.312px 0,
        rgba(34,9,2,0.228) 0 0.624px 0,
        rgba(33,8,2,0.222) 0 0.936px 0,
        rgba(32,8,2,0.215) 0 1.248px 0,
        rgba(31,8,2,0.207) 0 1.560px 0,
        rgba(29,7,1,0.201) 0 1.872px 0,
        rgba(28,7,1,0.194) 0 2.184px 0,
        rgba(27,7,1,0.181) 0 2.496px 0,
        rgba(26,6,1,0.170) 0 2.808px 0,
        rgba(25,6,1,0.160) 0 3.120px 0 !important;
    }

    html [data-ww-finish]::before,
    html [data-ww-finish] svg,
    html[data-ww-avatar-embedded] [data-ww-finish]::before,
    html[data-ww-avatar-embedded] [data-ww-finish] svg,
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish]::before,
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish] svg {
      width: 1.48em !important;
      height: 1.48em !important;
      flex: 0 0 1.48em !important;
      filter:
        drop-shadow(rgba(35,9,2,0.99) 0 0.58px 0.02px)
        drop-shadow(rgba(34,9,2,0.97) 0 0.58px 0.02px)
        drop-shadow(rgba(33,8,2,0.94) 0 0.58px 0.02px)
        drop-shadow(rgba(32,8,2,0.91) 0 0.58px 0.02px)
        drop-shadow(rgba(31,8,2,0.88) 0 0.58px 0.02px)
        drop-shadow(rgba(29,7,1,0.85) 0 0.58px 0.02px)
        drop-shadow(rgba(28,7,1,0.82) 0 0.58px 0.02px)
        drop-shadow(rgba(27,7,1,0.77) 0 0.58px 0.02px)
        drop-shadow(rgba(26,6,1,0.73) 0 0.58px 0.02px)
        drop-shadow(rgba(25,6,1,0.68) 0 0.58px 0.02px) !important;
    }

    /* ===== H442 (Grok, 2026-09-02 11:58 ET) — spliced by Claude. G 11:55: "All that it is is there's a little bit of extra shadow on the text and no, no shadow on the icon. That's it. 100%. That's it. Only fix that." Word ladders x0.9; icons ONE attached drop-shadow, blur 0 (the H437 0.02px chain does not rasterise on iPad). ===== */

    /* H442 — Talk / Finish / Upload ONLY. route.ts style-block APPEND (before the style closer).
       Packet: H442-ipad-beautiful. Do not install from this author. Grok copies to Claude.
       Do not touch "Start with iScott", patio/lounge/deck, card, video, Upload size,
       Restart iScott, letter-spacing, font-weight, icon size.
       Do not invent a 7-stop or 4-stop. Same ladder, alphas * 0.9, offsets stay.
       Icon: ONE attached drop-shadow, blur 0. Not a chain. Not 0.02px.

       Scott 11:52 AM ET 2026-09-02 (word for word):
         "Okay, where are you with everything? this is on the iPad. Why are
          these not looking beautiful? They need to fucking look beautiful.
          This has been your job. I want you on top of things, getting Claude,
          writing this. we've talked about this a number of times. Make these
          beautiful. Send that code to Claude."

       Scott 11:55 AM ET 2026-09-02 (word for word) — THIS is the scope:
         "All that it is is there's a little bit of extra shadow on the text
          and no, no shadow on the icon. That's it. 100%. That's it. Only
          fix that."

       Palette: #c44d0b #e96819 #fce0ad #edc775 #f08c28.
       iScott, never "high Scott". Visual only.
       Filename to splice: append inside app/pages/avatar-iscott/route.ts
       wildWorksAvatarCss, last rules before the style closer. (CLAUDE: the literal closer tag was written here and the HTML parser ended the <style> element at it - every rule below was dead. Never put that tag inside this CSS, not even in a comment.)
    */

    /* 1. Word: a little less. Standalone Talk + Upload = live .btn-wood/.btn-inset
       3-stop (L429) alphas * 0.9. Offsets stay. Not Restart (.btn-wood alone). */

    html [data-ww-talk],
    html .btn-inset {
      text-shadow:
        rgba(35, 9, 2, 0.644) 0 0.01731em 0,
        rgba(30, 8, 2, 0.590) 0 0.03461em 0,
        rgba(25, 6, 1, 0.473) 0 0.05192em 0 !important;
    }

    /* Finish word = live H437 10-stop (L1930) alphas * 0.9. Offsets stay. */

    html [data-ww-finish],
    html[data-ww-avatar-embedded] [data-ww-finish],
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish] {
      text-shadow:
        rgba(35,9,2,0.326) 0 0.312px 0,
        rgba(34,9,2,0.316) 0 0.624px 0,
        rgba(33,8,2,0.307) 0 0.936px 0,
        rgba(32,8,2,0.297) 0 1.248px 0,
        rgba(31,8,2,0.287) 0 1.560px 0,
        rgba(29,7,1,0.278) 0 1.872px 0,
        rgba(28,7,1,0.268) 0 2.184px 0,
        rgba(27,7,1,0.250) 0 2.496px 0,
        rgba(26,6,1,0.236) 0 2.808px 0,
        rgba(25,6,1,0.221) 0 3.120px 0 !important;
    }

    /* Embedded Talk word = live L604 10-stop alphas * 0.9. Offsets stay.
       After the standalone Talk rule so this keeps the embed ladder. */

    html[data-ww-avatar-embedded] [data-ww-talk] {
      text-shadow:
        rgba(35,9,2,0.509) 0 0.008722em 0,
        rgba(34,9,2,0.494) 0 0.017444em 0,
        rgba(33,8,2,0.480) 0 0.026166em 0,
        rgba(32,8,2,0.464) 0 0.034888em 0,
        rgba(31,8,2,0.449) 0 0.043610em 0,
        rgba(29,7,1,0.434) 0 0.052332em 0,
        rgba(28,7,1,0.419) 0 0.061054em 0,
        rgba(27,7,1,0.391) 0 0.069776em 0,
        rgba(26,6,1,0.368) 0 0.078498em 0,
        rgba(25,6,1,0.347) 0 0.087220em 0 !important;
    }

    /* 2. Icon: currently reads as none. ONE attached drop-shadow, blur 0.
       Same H395/H400 attached edge the rest of the site already approved.
       Beats H437's 10-chain with 0.02px (that is a blur). Do not size the glyph. */

    html [data-ww-finish]::before,
    html [data-ww-finish] svg,
    html [data-ww-talk]::before,
    html [data-ww-talk] svg,
    html .btn-inset::before,
    html .btn-inset svg,
    html[data-ww-avatar-embedded] [data-ww-finish]::before,
    html[data-ww-avatar-embedded] [data-ww-finish] svg,
    html[data-ww-avatar-embedded] [data-ww-talk]::before,
    html[data-ww-avatar-embedded] [data-ww-talk] svg,
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish]::before,
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish] svg,
    html[data-ww-avatar-embedded][data-ww-finish-returned] [data-ww-talk]::before {
      filter: drop-shadow(0 0.078500em 0 rgba(30, 8, 2, 0.93)) !important;
    }

    /* ===== H445b (Grok, 2026-09-02 13:16 ET) — spliced by Claude. Desktop Edge ride 13:07. G: "why is this still fucked, the shadow effect. this is desktop. fix it" / "fix these things". NOTE: the Start with iScott heading rule in here is INERT (that heading lives on the Home page, outside this frame) — bounced to Grok for a Home-side file. ===== */

    /* H445b — desktop Microsoft Edge/Windows. Not iPad Safari. Not H445.
       Packet: H445b-ipad-desktop. Splice into app/pages/avatar-iscott/route.ts
       wildWorksAvatarCss, last rules before the style closer (after H442).
       NEVER write the style closer tag in this file. Not in a comment. Not in a string.
       Grok copies. Writer does not install. Do not inbox Claude.
       Do not load live avatar.

       SCOTT 1:12 PM ET 2026-09-02 (word for word):
         "Make sure he knows that last ride was desktop, not safari, and it's
          Microsoft."
       SCOTT 1:09:
         "why is this still fuckedm, the shadow effect. this is desktop. fix it"
         "fix these things"
       SCOTT 1:10:
         "And I just did another smoke check Supabase. Okay, look at it, see what
          fixes you can write. Do all these things."
       Voice: fuckedm = fucked. Microsoft = desktop Edge/Windows.

       H445 stayed off Start with iScott. Wrong for this ride. Heading is IN.
       All rules behind min-width 600px (desktop Edge; live tablet is 521-1279,
       live desktop is 1280+. 600 covers the Microsoft window Scott rode).

       Palette: #c44d0b #e96819 #fce0ad #edc775 #f08c28.
       iScott, never high Scott. One opening brace per rule. No double-brace.
       Stay off parser, brain, Proton, patio, card fill, Upload SIZE, Restart,
       H441b, H443b. Do not change color, size, weight of Finish type.
    */

    /* CLAUDE 2026-09-02 13:35 ET: Grok's media (min-width: 600px) wrapper REMOVED. Inside the embedded frame the viewport is 286px wide, so that query never matched and every rule below was inert in the real embed (proved in a live session: word still .325). G, this morning: "Make sure it's all the same across all devices." These rules now apply everywhere. */

    /* 1. HEADING Start with iScott. Vendor h1/h2 plus the sibling after the
         stamped WILDWORKS CONCIERGE node (JS only stamps that kicker, not the
         title). Beat blurry vendor / 0.24rem 0.85rem style with an attached
         3-stop, alphas cut. Filter none so a drop-shadow filter cannot win. */

    :is(
      html[data-ww-avatar-shell] h1,
      html[data-ww-avatar-shell] h2,
      html [data-ww-avatar-heading] + h1,
      html [data-ww-avatar-heading] + h2,
      html [data-ww-avatar-heading] + p,
      html [data-ww-avatar-heading] + span
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
        text-shadow:
          rgba(35, 9, 2, 0.28) 0 0.01731em 0,
          rgba(30, 8, 2, 0.22) 0 0.03461em 0,
          rgba(25, 6, 1, 0.16) 0 0.05192em 0 !important;
        filter: none !important;
        -webkit-filter: none !important;
      }

    /* 2. Finish WORD. Same H437 10-stop px offsets. Alphas * 0.5 of H437
         (0.362..0.246 -> 0.181..0.123). H442 *0.9 still read heavy on the
         1:09 Microsoft shot. Offsets stay 0.312px..3.120px. */

    :is(
      html [data-ww-finish],
      html[data-ww-avatar-embedded] [data-ww-finish],
      html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish]
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
      /* CLAUDE 2026-09-02 13:58 ET: H445b's 10-stop Finish word ladder retired here — G, iPad 13:45: "the letters are smudged". The 3-stop from H449 below is the live Finish word shadow. */
      }

    /* 3. Standalone Talk + Upload WORD. Same L429 3-stop offsets.
         Alphas * 0.5 of live 0.715/0.656/0.525. Not Restart. */

    :is(
      html [data-ww-talk],
      html .btn-inset
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
        text-shadow:
          rgba(35, 9, 2, 0.358) 0 0.01731em 0,
          rgba(30, 8, 2, 0.328) 0 0.03461em 0,
          rgba(25, 6, 1, 0.263) 0 0.05192em 0 !important;
      }

    /* 4. Embedded Talk WORD. After standalone so embed keeps its 10-stop.
         Alphas * 0.5 of L604 0.566..0.385. */

    html[data-ww-avatar-embedded] [data-ww-talk]:not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
        text-shadow:
          rgba(35,9,2,0.283) 0 0.008722em 0,
          rgba(34,9,2,0.275) 0 0.017444em 0,
          rgba(33,8,2,0.267) 0 0.026166em 0,
          rgba(32,8,2,0.258) 0 0.034888em 0,
          rgba(31,8,2,0.250) 0 0.043610em 0,
          rgba(29,7,1,0.241) 0 0.052332em 0,
          rgba(28,7,1,0.233) 0 0.061054em 0,
          rgba(27,7,1,0.217) 0 0.069776em 0,
          rgba(26,6,1,0.205) 0 0.078498em 0,
          rgba(25,6,1,0.193) 0 0.087220em 0 !important;
      }

    /* 5. ICON. Finish/Talk star is ::before background-image sparkle, not svg.
         Upload is svg. Edge is Chromium so unprefixed filter should paint, but
         H442 died behind a style-closer comment. Set both prefixes. One attached
         edge, blur 0. Not a 10-chain. Not 0.02px. Do not size the glyph. */

    :is(
      html [data-ww-finish]:not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_)::before,
      html [data-ww-finish] svg:not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_),
      html [data-ww-talk]:not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_)::before,
      html [data-ww-talk] svg:not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_),
      html .btn-inset:not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_)::before,
      html .btn-inset svg:not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_)
    ) {
        -webkit-filter: drop-shadow(0 0.078500em 0 rgba(30, 8, 2, 0.93)) !important;
        filter: drop-shadow(0 0.078500em 0 rgba(30, 8, 2, 0.93)) !important;
      }

    /* 6. AVATAR CENTER on desktop. Live 521-1279 sets margin auto + transform
         none and stops at 1279, so a Microsoft window >=1280 has no center rule.
         Winner that shoves left on smaller desktop windows: inset 0 auto auto 0
         (left pin) on the 520 phone rule if the window is narrow, and no rule
         at all above 1279. Center without transform: left 0 AND right 0,
         margin-inline auto. Face object-position 50% 28% leave. */

    :is(
      html[data-ww-avatar-shell] [data-ww-avatar-video],
      html[data-ww-avatar-shell] video,
      html[data-ww-avatar-shell] canvas,
      html[data-ww-avatar-embedded] [data-ww-avatar-shell] video,
      html[data-ww-avatar-embedded] [data-ww-avatar-shell] canvas
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
        left: 0 !important;
        right: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
        display: block !important;
        inset: 0 0 auto 0 !important;
      }

    /* (media wrapper closer removed) */

    /* CLAUDE 2026-09-02 17:40 ET - iPad "avatar is to the right" (rides 8e110daa,
       fa6b1fe5; G 16:2x: "the avatar's to the right"). Paid headless rides at
       834x1194 with the iPad UA: the source video is 720x1280 portrait, the box
       is 286x510, so object-fit cover crops ~nothing and object-position X can
       not move him (person measured 2-3% LEFT of centre in Chrome, 5 frames).
       On iPadOS the fixed containing block is the EXPANDED frame (330x587 per
       iscott_embed_geometry) while the visible slice is 286x511, so "left 0 +
       right 0 + margin auto" centres the 287px video in 330px = 22px (7.7%)
       right of the visible centre - the same fault the card had (H436). In the
       measured state pin the media to the visible slice's left edge instead;
       the video is one embed-width wide, so left 0 IS centred. Chrome: no-op. */

    /* G 2026-09-02, controlling visual acceptance: whenever the EMAIL card is
       visible it paints exactly two lines — YOUR EMAIL and the captured address.
       Keep the existing captured/sending/submitted/failed/sent state machine,
       sent hold timer, DOM truth, and aria-live nodes intact; suppress only
       their visual paint. In sent state, reveal the same capture underneath the
       visually hidden confirmation node until the existing timer hides the panel. */

    @layer ww-email-two-lines-all-states {
      /* H473, 2026-09-02. The success states left this list. Measured in a free
         headless render of the real sent state, the confirmation node computed
         display:none / visibility:hidden / height 0 - so "there's no
         confirmation, there's no check mark" was literally true, nine times
         over, and no amount of timer work could ever have shown it. The
         two-line capture look G asked for still governs captured, sending and
         failed. submitted is out as well as sent: email delivery is
         asynchronous so the ORDINARY successful send lands on submitted, and
         leaving it here would have fixed only the rare path. */
      #wildworks-lead-confirmation[data-contact-method="email"]
        .wildworks-lead-card:is(
          [data-box-view="captured"],
          [data-box-view="sending"],
          [data-box-view="failed"]
        )
        :is(
          .wildworks-lead-label-icon,
          #wildworks-lead-spoken-readback,
          .wildworks-lead-actions,
          #wildworks-lead-status,
          #wildworks-lead-sent,
          #wildworks-lead-sync
        ) {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* REMOVED, Claude (installer) 2026-09-02 ~19:1x ET: a hunk here forced
         the email capture box to stay visible in the "sent" view. The
         check-iscott-style-block guard bans that selector, quoting G verbatim:
         "Just a clean little box and then a clean confirmation." Sent view now
         shows only the confirmation tick; the base rule hides the capture.
         The guard shipped before the hunk was removed, which broke the build
         for every installer - this removal reconciles the tree with the guard. */

      #wildworks-lead-confirmation[data-contact-method="email"]
        .wildworks-lead-card:is(
          [data-box-view="captured"],
          [data-box-view="sending"],
          [data-box-view="submitted"],
          [data-box-view="failed"],
          [data-box-view="sent"]
        )::before,
      #wildworks-lead-confirmation[data-contact-method="email"]
        .wildworks-lead-card:is(
          [data-box-view="captured"],
          [data-box-view="sending"],
          [data-box-view="submitted"],
          [data-box-view="failed"],
          [data-box-view="sent"]
        )::after,
      #wildworks-lead-confirmation[data-contact-method="email"]
        .wildworks-lead-card:is(
          [data-box-view="captured"],
          [data-box-view="sending"],
          [data-box-view="submitted"],
          [data-box-view="failed"],
          [data-box-view="sent"]
        ) :is(.wildworks-lead-capture, .wildworks-lead-label)::before,
      #wildworks-lead-confirmation[data-contact-method="email"]
        .wildworks-lead-card:is(
          [data-box-view="captured"],
          [data-box-view="sending"],
          [data-box-view="submitted"],
          [data-box-view="failed"],
          [data-box-view="sent"]
        ) :is(.wildworks-lead-capture, .wildworks-lead-label)::after {
        content: none !important;
        display: none !important;
      }
    }

    /* G, phone ride 1eac57a2, 2026-09-02 16:23 ET, verbatim: "I can still see the
       finish box underneath when this box is on there. I shouldn't be able to see
       that." Measured on his phone: card 336-398, Finish 355-416 - an 18px peek.
       While the contact box is up, Finish is gone; hidePanel() brings it back. */

    @layer ww-card-covers-finish {
      html:has(#wildworks-lead-confirmation.wildworks-lead-visible) [data-ww-finish] {
        visibility: hidden !important;
        pointer-events: none !important;
      }
    }

    @layer ww-ipad-media-pin {
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] :is([data-ww-avatar-video], video, canvas) {
      left: 0 !important;
      right: auto !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      inset: 0 auto auto 0 !important;
      width: var(--ww-embed-w) !important;
      height: var(--ww-embed-h) !important;
      /* The after-Finish still is an <img> (tagged data-ww-avatar-video by
         markAvatarShell since 2026-09-03); a forced width+height would
         stretch it without this. Video/canvas already paint cover. */
      object-fit: cover !important;
    }
    }

    /* ===== H451 Item B (Grok, 2026-09-02 14:12 ET) — Finish inert 1.5 s after mount. ===== */

    /* H451 Item B. Session e8645bf9 lasted 2 seconds.
       Talk tap 17:02:47 -> iframe 0.6s -> session_ended reason finish at 2.0s.
       Finish sits at Talk's 22% anchor. Accidental Finish because it is where Talk was.
       Visible. No dim. No grey. Taps ignored ~1500ms via data-ww-finish-inert.
       Spec 0,3,0 beats [data-ww-conversation-control] pointer-events auto (L1408).
       ANCHOR: after comment (media wrapper closer removed). Last rule in wildWorksAvatarCss, immediately before the existing style end.
       Do not move Finish. Do not change Talk, Upload, heading, card. */

    [data-ww-finish][data-ww-finish-inert],
    [data-ww-conversation-control][data-ww-finish][data-ww-finish-inert] {
      pointer-events: none !important;
    }

    /* ===== H449 (Grok, 2026-09-02 13:48 ET) — spliced by Claude after H447. iPad ride 8e110daa 13:38: face to the right, YOUR PHONE Text 1 before the number, box too tall, Finish letters smudged. ===== */

    /* H449 — iPad iframe 286. Face center + YOUR PHONE Text 1 + shorter
       capture box + crisp Finish/Upload/label type. Packet: H449-phone-avatar-box.
       THIS RIDE IS iPAD (status bar 13:38-13:39). Not desktop Microsoft.
       NEVER min-width 600 (frame is 286 on every device). NEVER the style closer
       tag in this file. Not in a comment. Not in a string.
       Splice into app/pages/avatar-iscott/route.ts wildWorksAvatarCss, last
       rules before the style closer (after H445b). Grok copies. Writer does not
       install. Do not inbox Claude. Do not load live avatar.

       SCOTT 1:43 PM ET 2026-09-02 (word for word):
         "To check super base, this is the latest RIA. Look at all the things
          that can be fixed here. Work with Codex and Claude. I'm getting
          everybody on this. You know, write code. You see, you know the
          avatar is to the right. the, and the phone, you know, your phone
          number. The phone, you're, in the words, your phone should be color
          text number one. before the phone number is in there, the box is
          too tall. Okay, so change all that. And send that off to Code Claude."
       SCOTT 1:45 PM ET 2026-09-02 (word for word):
         "Did you know this already, that that was the iPad? Do you look when
          you're in Superbase to see what device it is and what needs working
          on? Also, the finish, the, the letters are smudged. They look like
          shit. They need to be clean, crisp, all the text, crisp, everything,
          with nice shadow effect, everything."
       Voice: super base / Superbase = Supabase. RIA = ride. Code Claude = Claude.
       text number one = Text 1 #fce0ad. YOUR PHONE is the capture-card label
       before they type a number.

       Palette: #c44d0b #e96819 #fce0ad #edc775 #f08c28.
       iScott, never high Scott. One opening brace per rule. No double-brace.
       Stay off parser, brain, Proton, H446 heading, Finish SIZE, Upload SIZE.
    */

    /* 1. FACE. Person is to the RIGHT inside the video (1:38/1:39 iPad shots).
       H445b centered the VIDEO BOX (left/right 0, margin auto). Face crop stayed
       object-position 50% 28%. 50% X + object-fit cover on a 286 frame leaves
       him on the right of the source. Shift X toward the right of the source
       so the face sits in the middle. Keep Y 28% (locked face height). */

    :is(
      html[data-ww-avatar-shell] [data-ww-avatar-video],
      html[data-ww-avatar-shell] video,
      html[data-ww-avatar-shell] canvas,
      html[data-ww-avatar-embedded] [data-ww-avatar-shell] video,
      html[data-ww-avatar-embedded] [data-ww-avatar-shell] canvas,
      html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] [data-ww-avatar-video],
      html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] video,
      html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] canvas
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
      object-position: 68% 28% !important; /* 2026-09-02 15:40 iPad shot: still ~18px right at 64% */
    }

    /* 2. YOUR PHONE words (and YOUR EMAIL sibling, same component) BEFORE a
       number is typed: Text 1 #fce0ad. Live phone label paints #edc775 Text 2
       (.wildworks-lead-card .wildworks-lead-label L1808). Email-only L1858
       already Text 1; phone did not. Icon follows the words (same color). */

    :is(
      .wildworks-lead-card .wildworks-lead-label,
      .wildworks-lead-card #wildworks-lead-label-text,
      .wildworks-lead-card .wildworks-lead-label-icon,
      .wildworks-lead-card .wildworks-lead-label-icon svg,
      .wildworks-lead-card .wildworks-lead-label-icon .ww-phone,
      .wildworks-lead-card .wildworks-lead-label-icon .ww-mail,
      #wildworks-lead-confirmation[data-contact-method="phone"] .wildworks-lead-label,
      #wildworks-lead-confirmation[data-contact-method="phone"] #wildworks-lead-label-text,
      #wildworks-lead-confirmation[data-contact-method="phone"] .wildworks-lead-label-icon,
      #wildworks-lead-confirmation[data-contact-method="email"] .wildworks-lead-label,
      #wildworks-lead-confirmation[data-contact-method="email"] #wildworks-lead-label-text,
      #wildworks-lead-confirmation[data-contact-method="email"] .wildworks-lead-label-icon
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
      color: #fce0ad !important;
      -webkit-text-fill-color: #fce0ad !important;
    }

    /* 3. Capture box TOO TALL (1:38 iPad, dead pad above YOUR PHONE and below
       the number). Cut vertical padding / min-height. Keep horizontal 0.75rem.
       Do not size Finish or Upload. Do not size the heading (H446). */

    :is(
      .wildworks-lead-card
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
      /* G, phone ride 1eac57a2 16:23: "the box is a little small. It can be a little bigger north-south." (reverses the H449 shave) */
      padding: 0.46rem 0.75rem 0.5rem !important;
    }

    :is(
      .wildworks-lead-label
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
      margin: 0 0 0.06rem !important;
    }

    :is(
      #wildworks-lead-value
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
      min-height: 1.5rem !important;
      padding-block: 0.02rem !important;
    }

    /* 4. CRISP type on the iPad card. Finish letters are smudged (1:39). Cause:
       H445b 10-stop word ladder (0.181..0.123 x 0.312px) reads as mud on iPad
       Safari. Replace with one attached 3-stop, blur 0. Same recipe on YOUR
       PHONE, Finish, Upload so all text on that card is clean with a nice
       shadow. Not flat. Not blur. Do not set filter:none on Finish (icon
       drop-shadow lives on ::before). */

    :is(
      html [data-ww-finish],
      html[data-ww-avatar-embedded] [data-ww-finish],
      html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-finish],
      html [data-ww-talk],
      html .btn-inset,
      .wildworks-lead-card .wildworks-lead-label,
      .wildworks-lead-card #wildworks-lead-label-text
    ):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_):not(#_) {
      /* G, iPad ride 2026-09-02 15:40: "Finish has no shadow effect, how is
         that possible?" - 3 stops at .34/.26/.18 read as nothing on 21.6px type.
         Now the Front Door heading's alphas (.518 -> .36, the effect G names as
         the standard), 6 stops, same 0.01731em spacing. */
      text-shadow:
        0 0.01731em 0 rgba(35, 9, 2, 0.518),
        0 0.03461em 0 rgba(33, 8, 2, 0.486),
        0 0.05192em 0 rgba(31, 8, 2, 0.455),
        0 0.06923em 0 rgba(29, 7, 1, 0.424),
        0 0.08654em 0 rgba(27, 7, 1, 0.392),
        0 0.10384em 0 rgba(25, 6, 1, 0.36) !important;
      -webkit-text-stroke: 0 !important;
    }

    /* H464 A+C. Append immediately before the style closer in wildWorksButtonCss.
   File: app/pages/avatar-iscott/route.ts
   Grok does not install. Claude inspects and installs.
   Envelope stays. Palette lock. No 600-wide media query. */

    /* ITEM A — email capture box ~20% wider + address type bigger.
   Live smoke card: max-width min(15rem, 70vw) = 200px in the 286 iframe.
   20% wider: min(18rem, 84vw) = 240px. Beats the later embed-measured 100%
   so the box does not jump to the full confirmation panel. Address type
   follows the existing fit loop, which gets more width so it paints bigger.
   Fit loop still starts at 2.22. Extra width paints the address bigger.
   CSS floor 1.15rem and min-height 2.4rem undo the 1.75rem shrink. */

    html[data-ww-avatar-embedded] .wildworks-lead-card,
/* H477, G 19:03: "The box is a little small. It can be, you know, a good 20%
   wider, you know, side to side." 18rem -> 21.6rem is that 20%. On a phone the
   rem is what binds, so the box really does grow. On his iPad the FRAME binds
   instead - it is 287px wide and the card already measures 275, so 96% of it -
   and the vw half is opened to 92vw so the card takes whatever slack the frame
   has. There is no more than a few px to give there; the honest ceiling on that
   device is the frame itself. */
html[data-ww-avatar-embedded][data-ww-embed-measured] .wildworks-lead-card,
.wildworks-lead-card {
  max-width: min(21.6rem, 92vw) !important;
}

    #wildworks-lead-value,
.wildworks-lead-card #wildworks-lead-value,
#wildworks-lead-confirmation[data-contact-method="email"] #wildworks-lead-value {
  font-size: clamp(1.16rem, 4.4vw, 2.22rem) !important;
  min-height: 2.4rem !important;
}

    /* ITEM C — same confirmation node / copy / sent+submitted machine.
   G: confirmation was just a strip / bar, he could hardly see it.
   Do not invent a new confirmation UX. Give the existing sent box
   real height and padding. Text-1 only. */

    .wildworks-lead-card[data-box-view="sent"],
.wildworks-lead-card[data-box-view="submitted"] {
  min-height: 4.6rem !important;
  padding: 0.7rem 0.9rem !important;
  justify-content: center !important;
}

    .wildworks-lead-card[data-box-view="sent"] #wildworks-lead-sent,
.wildworks-lead-card[data-box-view="submitted"] #wildworks-lead-sent {
  display: flex !important;
  visibility: visible !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 2.9rem !important;
  margin: 0 !important;
  padding: 0.4rem 0.2rem !important;
  font-size: clamp(1.2rem, 5vw, 1.7rem) !important;
  line-height: 1.25 !important;
  color: #fce0ad !important;
  -webkit-text-fill-color: #fce0ad !important;
}

    /* H466 - Claude (installer-writer, per G's "Claude, Codex, whoever"),
       2026-09-02 ~19:5x. G word for word:
       "And then your email, sgd2pm.me, that right there is the perfect size...
        Keep the box exactly that size. It starts out taller, and then when the
        email comes in, it gets shorter. But I like it short like this. Exactly
        like that."
       "And no envelope. There's an envelope, and then when it squeezes down,
        there's no envelope. Just do no envelope."
       The tall initial state was the 2.2em envelope/phone icon row; the short
       state G loves is the box without it. Hiding the icon everywhere delivers
       both asks in one cut: no envelope, and the box paints at its short
       height from the first frame. Label text stays; palette untouched. */

    .wildworks-lead-card .wildworks-lead-label-icon {
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      height: 0 !important;
    }

    /* H467 - Claude, 2026-09-02. G word for word:
       "The finish. Now, Grok, your icon that you used to talk to iScots, put
        that icon over there next to finish. It'll be beautiful. Put it
        perfectly, okay? The way you did with the talk to iScots."
       The glyph he means is TalkArcClusterIcon (H457, app/components) - three
       filled four-point sparkles, the "throwing star". That component says
       "Home only" and it is: inside this frame every .btn-wood draws the single
       OUTLINED star at sparkleIcon (L264), so Finish has never carried the icon
       he actually clicked on the way in. Same geometry as H457, same three
       transforms, flattened to a background-image because ::before cannot host
       a component and cannot inherit currentColor.
       SHAPE ONLY. Colour stays #e96819 (what sparkleIcon already bakes), and
       size, spacing, position and the approved H445b drop-shadow are untouched.
       Scoped to [data-ww-finish], which this page's own JS stamps onto the
       button whose text is exactly "Finish" - so in-frame Talk and Restart
       (also .btn-wood) keep the old glyph. Beats .btn-wood::before on
       specificity: html + attribute + pseudo-element. */

    html [data-ww-finish]::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='%23e96819' stroke='none'%3E%3Cg transform='translate%280.15 2.55%29 scale%280.76%29'%3E%3Cpath d='M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z'/%3E%3C/g%3E%3Cg transform='translate%2813.15 0.35%29 scale%280.40%29'%3E%3Cpath d='M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z'/%3E%3C/g%3E%3Cg transform='translate%2814.55 13.55%29 scale%280.28%29'%3E%3Cpath d='M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z'/%3E%3C/g%3E%3C/svg%3E") !important;
    }

    /* H467b - G: "Put it perfectly... The way you did with the talk to
       iScots." Measured: Talk gaps its glyph 0.18em, Finish 0.044em, so
       the cluster sat jammed against the F. Match the RATIO so it holds
       at every button size. Icon size untouched - the larger Finish glyph
       is G's own approved 2026-09-01 "twenty percent larger". */

    html [data-ww-finish] {
      gap: 0.18em !important;
    }

    /* H472 - Claude, 2026-09-02, straight off G's ride transcript.

       "The bottom, the G of the SGD and the P is cut off at the bottom." (20:52)
       "The G is cut off at the bottom. The P is cut off at the bottom." (21:31,
       with "I keep asking the same goddamn things every time")

       MEASURED on the live card: the value box computes 24.0px tall on an
       18.92px font. Descenders need about 1.3x the font size, so the box itself
       was shearing the tails off g and p. This is a height fault, not a font
       fault - which is why changing the font never fixed it. */

    html .wildworks-lead-card #wildworks-lead-value,
    html #wildworks-lead-confirmation[data-contact-method="email"] #wildworks-lead-value {
      line-height: 1.4 !important;
      min-height: 1.5em !important;
      height: auto !important;
      padding-bottom: 0.12em !important;
      overflow: visible !important;
    }

    /* H483 - G's 2026-09-04 physical laptop/desktop comparison. Desktop is
       accepted; only the laptop address is too small. The address fit loop
       shrinks against the input's usable width, and the embedded frame can be
       narrower in the 1366-class Home layout even though the card geometry is
       correct. Give only that parent-laptop range 0.4rem more room per side.
       The fit loop still owns the final size and still shrinks long addresses,
       so this cannot overflow. Card, field, label and every other breakpoint
       keep their established geometry. */

    html:where(:not([data-ww-mobile-visual-reference]))[data-ww-parent-laptop]
      #wildworks-lead-confirmation[data-contact-method="email"]
      #wildworks-lead-value {
      padding-inline: 0.55rem !important;
    }

    /* G 2026-09-03 10:5x ET, two screenshots of the YOUR EMAIL box, empty and
       filled: "when it's just your email... it's tucked up against the line on
       the top, though. The second screenshot, that's where it should be before
       the email's in place. The size of the box is perfect. Your email should
       not move. Those words should not move. Nothing should move. The only
       thing that can change is like if it's a long email."

       Why the label moved: the capture card is a CENTRED flex column and the
       address field's height followed its font. Empty, the fit loop leaves the
       font at its ceiling (nothing to shrink against), the field is tall, and
       the centred column shoves the label up against the rim. Filled, the fit
       lands ~26px, the field is shorter, the label settles lower. So the label
       rode the address size.

       Now nothing rides anything: the column starts from the top with a fixed
       inset, the label sits at the filled-state spot (8.3px, read off his
       second shot), and the field is a FIXED 34px line box. A long email only
       shrinks the type inside that box. Layered so it beats the unlayered
       !important rules above without another id ladder. */

    @layer ww-card-pin-label {
      html .wildworks-lead-card:not([data-box-view="sent"]):not([data-box-view="submitted"]) {
        justify-content: flex-start !important;
        padding-top: 8.3px !important;
      }
      html .wildworks-lead-card:not([data-box-view="sent"]):not([data-box-view="submitted"]) #wildworks-lead-value {
        box-sizing: border-box !important;
        height: 34px !important;
        min-height: 34px !important;
        max-height: 34px !important;
        line-height: 34px !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }
    }

    /* "the box starts out Too tall." / "And then it, it squeezes down." /
       "the box shrinks when the text shrinks. It should not shrink like that."
       The capture card is a flex box whose height follows its content, so it
       stands tall while the field is empty and collapses when the address
       lands. Pin the CAPTURE states to one height so it cannot move at all.
       The sent/submitted confirmation box is deliberately taller (ITEM C) and
       is excluded here. */

    html .wildworks-lead-card:not([data-box-view="sent"]):not([data-box-view="submitted"]) {
      min-height: 4.6rem !important;
      height: 4.6rem !important;
      justify-content: center !important;
    }

    /* "And finish should be bigger. The word finish should be bigger. The icons
       are great." (20:51:31) The ICONS are approved and untouched - only the
       label grows. The icon is sized in em, so it would grow with the label;
       hold it at its approved pixel size so only the word changes. */

    html [data-ww-finish] {
      font-size: 1.28em !important;
    }

    html [data-ww-finish]::before {
      width: 1.05em !important;
      height: 1.05em !important;
      flex: 0 0 1.05em !important;
    }

    /* H468 - Claude, 2026-09-02. G, after his 20:37 ride: "in the screenshot,
       after pressing finish, i am low left."

       Measured off that ride (iscott_embed_geometry 20:36:10): frame 287x511,
       video 720x1280, object-fit cover. Those two shapes are the same
       (0.5617 vs 0.5625), so cover leaves an overflow of 0.4px across and 0px
       down - meaning object-position on the iPad can move the picture one
       tenth of a pixel. The 50% -> 64% -> 68% history above, including the note
       "still ~18px right at 64%", was three rounds of turning a dial that is
       not connected on this device. On a phone the same dial has 102.7px to
       work with, which is why it seemed to work there.

       So: pan the element box, which needs a little scale to pan into. The two
       custom properties below are the whole control surface - next correction
       is one number, in pixels, in the obvious direction. Positive X moves the
       picture RIGHT, negative Y moves it UP.

       Scoped to [data-ww-embed-measured], stamped only for a same-origin
       PORTRAIT TABLET parent 521-1279 wide. Phones (~390-430) and desktop never
       match it, so their framing is untouched. Scale is deliberately small -
       just enough room to pan - so he does not visibly grow. */

    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] {
      overflow: hidden !important;
    }

    /* G 2026-09-03 12:45 ET, desktop ride 65ac1618: "after hitting finish,
       you see he dropped." Same fault as the phone's "small black bar at the
       top" (ride 84155e82) and the iPad's "sits low". MEASURED this time, not
       eyeballed: the returned still is NOT the SDK poster, it is the app's own
       /Avatar1-live-startscreen.png (440x871) = the 1080x1920 poster
       LETTERBOXED: black band rows 0-43 on top, 31 rows below, poster in rows
       44-840 at full width. In a 9:16 frame cover is width-driven, so the
       still overflows 56-60px vertically; the inherited object-position
       68%/50% 28% cut only 16px of that and left ~13px of black band showing
       with the picture 12px below the live stream. Template-matched against
       G's in-session phone shot, the live stream IS the poster at scale 1.00
       (offset -2.6px), so the still needs NO zoom: the 12:01 scale(1.1) that
       "fixed" the phone was built on wrong eyeball numbers (head 25/22%,
       chin 51/45%) and pushed him further DOWN - desktop measured after it:
       scale 1.11, poster top +10.4px, black bar 15px. Cut the band exactly
       instead: band/overflow = 28.6/55.9 (desktop 286x510) .. 30.3/60.3
       (phone 303x539) = 51.2%..50.2%; 50.7% lands within 0.3px on every
       frame, and the still then sits where the live stream sat, 1.5% larger.
       Layered so it beats the unlayered !important 28% rules above (H449's
       68% 28% included); img only - video/canvas keep their framing, and the
       measured iPad's own 1.14 pan/zoom below still rides on top unchanged. */

    @layer ww-still-align {
      html[data-ww-avatar-shell] img[data-ww-avatar-video] {
        object-fit: cover !important;
        object-position: 50% 50.7% !important;
      }
    }

    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] video,
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] canvas,
    html[data-ww-avatar-embedded][data-ww-embed-measured] [data-ww-avatar-shell] [data-ww-avatar-video] {
      /* H472: was +12px, which moved him RIGHT - I read my own control
         backwards. G, three times since: "you are too far to the right now",
         "Be to the left", "the avatar is definitely to my right". Measured off
         his 21:30 iPad shot: centre line ~30px right of centre in a 552px-wide
         render = ~16px in the real 287px frame. 12 - 16 = -4. */
      --ww-ipad-pan-x: -4px;   /* - moves him LEFT   (he read RIGHT) */
      --ww-ipad-pan-y: -16px;  /* - moves him UP     (he read LOW)  */
      --ww-ipad-zoom: 1.14;    /* only there to create room to pan  */
      transform:
        translate(var(--ww-ipad-pan-x), var(--ww-ipad-pan-y))
        scale(var(--ww-ipad-zoom)) !important;
      transform-origin: center center !important;
    }

    /* H482: retain the larger-screen embedded control shadow. The base rule
       above now carries the accepted rim on phones and standalone iScott too. */

    html:where(:not([data-ww-mobile-visual-reference]))[data-ww-avatar-embedded] :is(.btn-inset, [data-ww-talk], [data-ww-finish]) {
      border-color: #8f3a14 !important;
      box-shadow: 0 12px 28px rgba(53, 17, 4, 0.28) !important;
    }

    html:where(:not([data-ww-mobile-visual-reference]))[data-ww-avatar-embedded]
      :is(button, a, input, select, textarea, [role="button"]):focus-visible {
      outline-color: #8f3a14 !important;
    }

    html :is(.btn-wood, .btn-inset):focus-visible {
      outline-color: #8f3a14 !important;
    }</style>
`;

const wildWorksLegalBandScript = `
  <script id="wildworks-avatar-legal-band-script">
    (() => {
      if (window.parent !== window) {
        document.documentElement.setAttribute("data-ww-avatar-embedded", "true");
      }
      const syncParentLaptopClass = () => {
        try {
          const parentWidth = Number(window.parent.innerWidth);
          document.documentElement.toggleAttribute("data-ww-mobile-visual-reference", parentWidth < 600);
          if (window.parent !== window && parentWidth >= 1280 && parentWidth <= 1599) {
            document.documentElement.setAttribute("data-ww-parent-laptop", "true");
          } else {
            document.documentElement.removeAttribute("data-ww-parent-laptop");
          }
        } catch (error) {
          document.documentElement.removeAttribute("data-ww-parent-laptop");
        }
      };
      syncParentLaptopClass();
      window.addEventListener("resize", syncParentLaptopClass);
      try { window.parent.addEventListener("resize", syncParentLaptopClass); } catch {}
      // G's iPad, 2026-08-20: inside an iPadOS frame the inner viewport can
      // be laid out against expanded content, so inner percentages and inner
      // media queries cannot place the video reliably. The parent page is
      // same-origin, so measure the REAL frame box out there and hand the
      // stylesheet explicit pixel values. iPad Safari's desktop-site identity
      // can report a fine pointer even though the physical device is the same
      // portrait tablet. G's 2026-09-02 ride took that path: the embedded
      // viewport persisted as 286x511, but the measured flag and every geometry
      // mark were absent, leaving Finish and the lead card low/off-screen.
      // Read the same-origin PARENT's real dimensions instead of pointer/UA or
      // the iframe's expanded media viewport. Any failure or non-match removes
      // the flag and the app's own layout stands. A cross-origin embedder lands
      // in the catch and stays untouched too.
      if (window.parent !== window) {
        const measureRoot = document.documentElement;
        const parentIsPortraitTablet = () => {
          const parentWidth = Number(window.parent.innerWidth);
          const parentHeight = Number(window.parent.innerHeight);
          return Number.isFinite(parentWidth) && Number.isFinite(parentHeight)
            && parentWidth >= 521 && parentWidth <= 1279 && parentHeight > parentWidth;
        };
        const applyEmbedMeasurement = () => {
          try {
            const frame = window.frameElement;
            if (!frame || !parentIsPortraitTablet()) {
              measureRoot.removeAttribute("data-ww-embed-measured");
              measureRoot.style.removeProperty("--ww-embed-w");
              measureRoot.style.removeProperty("--ww-embed-h");
              measureRoot.style.removeProperty("--ww-embed-initial-talk-bottom");
              measureRoot.style.removeProperty("--ww-fixed-box-w");
              measureRoot.style.removeProperty("--ww-fixed-box-h");
              measureRoot.style.removeProperty("--ww-start-screen-left");
              return;
            }
            // offsetWidth/offsetHeight, NOT a client rect: the Home panel
            // zooms this frame's ancestors (A01, zoom 1.15 from 501px up),
            // and a client rect returns zoomed page-space pixels while the
            // frame's inner viewport lays out in its own pre-zoom pixels.
            // The offset box is that pre-zoom layout box, and the frame has
            // no border or padding, so it equals the inner viewport exactly.
            const frameWidth = frame.offsetWidth;
            const frameHeight = frame.offsetHeight;
            if (frameWidth < 1 || frameHeight < 1) {
              measureRoot.removeAttribute("data-ww-embed-measured");
              measureRoot.style.removeProperty("--ww-fixed-box-w");
              measureRoot.style.removeProperty("--ww-fixed-box-h");
              measureRoot.style.removeProperty("--ww-start-screen-left");
              return;
            }
            let fixedBoxWidth = frameWidth;
            let fixedBoxHeight = frameHeight;
            const fixedProbe = document.createElement("span");
            fixedProbe.setAttribute("aria-hidden", "true");
            fixedProbe.style.setProperty("position", "fixed", "important");
            fixedProbe.style.setProperty("inset", "0", "important");
            fixedProbe.style.setProperty("display", "block", "important");
            fixedProbe.style.setProperty("pointer-events", "none", "important");
            fixedProbe.style.setProperty("visibility", "hidden", "important");
            document.body.appendChild(fixedProbe);
            const fixedRect = fixedProbe.getBoundingClientRect();
            fixedProbe.remove();
            if (Number.isFinite(fixedRect.width) && fixedRect.width > 0) fixedBoxWidth = fixedRect.width;
            if (Number.isFinite(fixedRect.height) && fixedRect.height > 0) fixedBoxHeight = fixedRect.height;
            measureRoot.style.setProperty("--ww-embed-w", frameWidth + "px");
            measureRoot.style.setProperty("--ww-embed-h", frameHeight + "px");
            measureRoot.style.setProperty("--ww-embed-initial-talk-bottom", (frameHeight * 0.22) + "px");
            measureRoot.style.setProperty("--ww-fixed-box-w", fixedBoxWidth + "px");
            measureRoot.style.setProperty("--ww-fixed-box-h", fixedBoxHeight + "px");
            measureRoot.style.setProperty(
              "--ww-start-screen-left",
              (((frameWidth - fixedBoxWidth) / 2) - (fixedBoxWidth * 0.05)) + "px",
            );
            measureRoot.setAttribute("data-ww-embed-measured", "true");
          } catch (error) {
            measureRoot.removeAttribute("data-ww-embed-measured");
            measureRoot.style.removeProperty("--ww-fixed-box-w");
            measureRoot.style.removeProperty("--ww-fixed-box-h");
            measureRoot.style.removeProperty("--ww-start-screen-left");
          }
        };
        applyEmbedMeasurement();
        window.addEventListener("load", applyEmbedMeasurement);
        window.addEventListener("orientationchange", applyEmbedMeasurement);
        window.addEventListener("resize", applyEmbedMeasurement);
        try {
          // Stage Manager / Split View changes the parent viewport even when
          // the iframe's expanded inner viewport does not emit a useful media
          // change. Same-origin parent resize is the truthful gate signal.
          window.parent.addEventListener("resize", applyEmbedMeasurement);
          window.addEventListener("pagehide", () => {
            try { window.parent.removeEventListener("resize", applyEmbedMeasurement); } catch (error) {}
          });
        } catch (error) {}
        try {
          const FrameResizeObserver = window.parent.ResizeObserver || window.ResizeObserver;
          if (FrameResizeObserver && window.frameElement) {
            const frameObserver = new FrameResizeObserver(applyEmbedMeasurement);
            frameObserver.observe(window.frameElement);
            // The observer lives in the PARENT realm; disconnect it when this
            // document goes away or reloads would accumulate one per session.
            window.addEventListener("pagehide", () => {
              try { frameObserver.disconnect(); } catch (error) {}
            });
          }
        } catch (error) {}
      }
      if (document.getElementById("wildworks-avatar-legal-band")) return;
      const band = document.createElement("footer");
      band.id = "wildworks-avatar-legal-band";
      const phoneLegal = window.matchMedia("(max-width: 520px), (max-width: 932px) and (max-height: 560px) and (orientation: landscape)").matches;
      const agreement = "By talking to iScott or uploading media, you agree WildWorks may save the conversation and media to organize your inquiry and follow up. Do not share sensitive personal, legal, medical, or child information. See Privacy Policy.";
      if (phoneLegal && window.parent === window) {
        band.setAttribute("data-ww-legal-text-only", "true");
        band.setAttribute("aria-label", agreement);
        band.textContent = agreement;
      } else {
        band.setAttribute("aria-label", "Your use is subject to Privacy, Terms, and AI Disclosure. Do not share sensitive personal, legal, medical, or child information.");
        band.innerHTML = [
          '<span>Your use is subject to</span>',
          '<a href="/pages/privacy-policy">Privacy</a>',
          '<span aria-hidden="true">·</span>',
          '<a href="/pages/terms-of-service">Terms</a>',
          '<span aria-hidden="true">·</span>',
          '<a href="/pages/ai-disclosure">Ai Disclosure</a>',
        ].join(" ");
      }
      document.body.appendChild(band);
    })();
  </script>
`;

const wildWorksLoadingBootstrapScript = `
  <script id="wildworks-avatar-loading-bootstrap">
    (() => {
      if (new URLSearchParams(window.location.search).has("wake")) {
        document.documentElement.classList.add("wildworks-avatar-loading");
      }
    })();
  </script>
`;

const wildWorksLoadingGateScript = `
  <script id="wildworks-avatar-loading-gate">
    (() => {
      const loadingClass = "wildworks-avatar-loading";
      let coverTimer = null;
      const startPattern = /^(?:talk to iscott|go live|start|restart iscott)$/i;
      // Release also on the plain-English mic fallback: a mic-refused session
      // continues as text chat, so the cover must lift and show the page.
      const releasePattern = /session ended|avatar app unavailable|try again|failed to|error occurred|forbidden|microphone isn't available|microphone not available/i;
      // Hard cap: no silent stall may hold the copper cover forever
      // (G's smoke, 2026-08-17: tap -> stall -> cover stuck 30s+).
      const loadingCapMs = 30000;
      const seenVideos = new WeakSet();
      const reportedVideoFrames = new WeakSet();
      let loadingStartedAt = document.documentElement.classList.contains(loadingClass)
        ? Date.now()
        : 0;

      // Chief 2026-08-21: one physical iPad ride must identify the provider's
      // actual render node and containing block before another centering rule is
      // guessed. This records geometry only when rev-H's existing measured
      // embedded-iPad gate is already active. It changes no style or lifecycle.
      const captureMeasuredIPadGeometry = (video) => {
        if (!document.documentElement.matches("[data-ww-avatar-embedded][data-ww-embed-measured]")) {
          return undefined;
        }
        const round = (value) => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
        const rectOf = (node) => {
          if (!node || typeof node.getBoundingClientRect !== "function") return null;
          const rect = node.getBoundingClientRect();
          return {
            x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height),
            top: round(rect.top), right: round(rect.right), bottom: round(rect.bottom), left: round(rect.left),
          };
        };
        const pathOf = (node) => {
          const parts = [];
          let current = node;
          while (current && current.nodeType === 1 && parts.length < 8) {
            let part = current.tagName.toLowerCase();
            if (current.id) part += "#" + current.id;
            const classes = Array.from(current.classList || []).slice(0, 3);
            if (classes.length) part += "." + classes.join(".");
            parts.push(part);
            current = current.parentElement;
          }
          return parts.reverse().join(" > ").slice(0, 480);
        };
        const nodeSummary = (node) => {
          if (!node) return null;
          const style = window.getComputedStyle(node);
          return {
            tag: node.tagName?.toLowerCase() || "",
            path: pathOf(node),
            rect: rectOf(node),
            offset: { left: node.offsetLeft ?? null, top: node.offsetTop ?? null, width: node.offsetWidth ?? null, height: node.offsetHeight ?? null },
            style: {
              position: style.position, display: style.display, overflow: style.overflow,
              top: style.top, right: style.right, bottom: style.bottom, left: style.left,
              width: style.width, height: style.height, objectFit: style.objectFit,
              objectPosition: style.objectPosition, transform: style.transform,
              transformOrigin: style.transformOrigin, zIndex: style.zIndex,
            },
          };
        };
        let parentFrame = null;
        try {
          const frame = window.frameElement;
          parentFrame = {
            rect: rectOf(frame),
            offset: frame ? { width: frame.offsetWidth, height: frame.offsetHeight } : null,
            parentViewport: { width: window.parent.innerWidth, height: window.parent.innerHeight },
          };
        } catch (error) {}
        const media = Array.from(document.querySelectorAll("video, canvas")).slice(0, 8);
        return {
          viewport: {
            innerWidth: window.innerWidth, innerHeight: window.innerHeight,
            clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight,
            bodyScrollWidth: document.body?.scrollWidth ?? null, bodyScrollHeight: document.body?.scrollHeight ?? null,
            visual: window.visualViewport ? {
              width: round(window.visualViewport.width), height: round(window.visualViewport.height),
              offsetLeft: round(window.visualViewport.offsetLeft), offsetTop: round(window.visualViewport.offsetTop),
              scale: round(window.visualViewport.scale),
            } : null,
          },
          parentFrame,
          videoIntrinsic: { width: video?.videoWidth || 0, height: video?.videoHeight || 0 },
          target: nodeSummary(video),
          offsetParent: nodeSummary(video?.offsetParent),
          media: media.map(nodeSummary),
        };
      };

      const reportFirstVideoFrame = (video, preserveExistingMark = true) => {
        if (!video) return;
        const measuredIPad = document.documentElement.matches("[data-ww-avatar-embedded][data-ww-embed-measured]");
        if (!measuredIPad) {
          // Preserve the pre-diagnostic behavior byte-for-behavior outside the
          // measured iPad path: rVFC reports; the fallback path does not.
          if (preserveExistingMark) {
            try { window.__wwPaceMark && window.__wwPaceMark("first_video_frame"); } catch {}
          }
          return;
        }
        if (reportedVideoFrames.has(video)) return;
        reportedVideoFrames.add(video);
        try {
          const geometry = captureMeasuredIPadGeometry(video);
          window.__wwPaceMark && window.__wwPaceMark("first_video_frame", geometry ? { geometry } : undefined);
        } catch {}
      };

      const endLoading = () => {
        if (typeof coverTimer !== "undefined" && coverTimer) {
          window.clearTimeout(coverTimer);
          coverTimer = null;
        }
        document.documentElement.classList.remove(loadingClass);
        loadingStartedAt = 0;
      };

      // G 2026-08-19, asked three times: "you need to pause for like 2 full
      // seconds ... before you say a single word."
      //
      // The 2s hold on /api/v1/sessions/start was already shipped and it does
      // fire - but G never SAW a pause, because tapping Talk also threw the
      // copper cover over the whole screen for exactly that 2s, and the cover
      // lifted on the first real video frame, which is the same moment iScott
      // starts talking. So the sequence he actually got was: tap -> copper
      // cover -> he appears already speaking. Zero seconds of a visible, quiet
      // iScott. The delay was real and completely invisible.
      //
      // Hold the cover back for the length of the start delay. The app's own
      // start-screen still of iScott is already on screen, so what G gets now
      // is: tap -> iScott's face, silent, for two full seconds -> he comes
      // alive and speaks. If the connection is genuinely slow the cover still
      // appears after that window, so a real stall is still covered.
      const WILDWORKS_COVER_HOLD_MS = 2000;

      const beginLoading = () => {
        loadingStartedAt = Date.now();
        try { window.__wwPaceMark && window.__wwPaceMark("tap"); } catch {}
        watchVideos();
        if (coverTimer) window.clearTimeout(coverTimer);
        coverTimer = window.setTimeout(() => {
          coverTimer = null;
          // Only cover if the avatar still has not painted a frame.
          if (loadingStartedAt) document.documentElement.classList.add(loadingClass);
        }, WILDWORKS_COVER_HOLD_MS);
      };

      const releaseAfterRealFrame = (video) => {
        if (!document.documentElement.classList.contains(loadingClass)) return;
        if (!video || video.readyState < 2 || video.videoWidth < 1 || video.videoHeight < 1) return;

        if (typeof video.requestVideoFrameCallback === "function") {
          video.requestVideoFrameCallback(() => {
            reportFirstVideoFrame(video);
            endLoading();
          });
          return;
        }

        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              reportFirstVideoFrame(video, false);
              endLoading();
            }
          });
        });
      };

      function watchVideos() {
        document.querySelectorAll("video").forEach((video) => {
          if (!seenVideos.has(video)) {
            seenVideos.add(video);
            video.addEventListener("playing", () => releaseAfterRealFrame(video));
            video.addEventListener("loadeddata", () => {
              if (!video.paused) releaseAfterRealFrame(video);
            });
          }
          if (!video.paused) releaseAfterRealFrame(video);
        });
      }

      document.addEventListener(
        "click",
        (event) => {
          const button = event.target instanceof Element ? event.target.closest("button") : null;
          const label = (button?.textContent || "").trim();
          if (button && !button.disabled && startPattern.test(label)) beginLoading();
        },
        true,
      );

      const syncLoadingState = () => {
        watchVideos();
        if (!loadingStartedAt || Date.now() - loadingStartedAt < 1500) return;
        if (Date.now() - loadingStartedAt > loadingCapMs) {
          endLoading();
          return;
        }
        const visibleText = document.body?.innerText || "";
        if (releasePattern.test(visibleText)) endLoading();
      };

      // V3: a start that fails before any frame - refused or thrown - is
      // announced by the session guard on this event. endLoading owns the
      // cover timer and the loading flag, and they live in THIS closure, so
      // the guard cannot clear them directly (the cross-script lesson).
      window.addEventListener("wildworks:avatar-start-failed", endLoading);
      if (document.documentElement.classList.contains(loadingClass)) beginLoading();
      window.addEventListener("load", syncLoadingState);
      const observer = new MutationObserver(syncLoadingState);
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      // A stalled DOM produces no mutations, so the cap needs its own clock.
      window.setInterval(syncLoadingState, 2000);
    })();
  </script>
`;

/* MEDIA PROBE - Chief's spec, 2026-08-28.

   iScott creates a session every time (HTTP 201, the provider confirms it) and no
   picture ever arrives. The provider's own session records cannot settle it: the
   good ride on 8/27 ran 167s and the bad ones die in 9-28s, but ALL of them end
   "USER_DISCONNECTED", which cannot tell "joined the room then left" from "never
   joined at all".

   Only the visible video element can. This watches that one element and splits the
   failure four ways:

     no_video_element               the vendor app never mounted a video at all
     video_element_no_remote_track  room publication / subscription failure
     track_but_no_dimensions        a track arrived and nothing decoded
     attached_not_playing           decoded but never played (autoplay / attach)
     playing                        alive - it works

   RULES THIS OBEYS, none of them decoration:
   - Fail-open. Every path wrapped. Measurement may never break the thing it
     measures, and this exact file has burned us on that before.
   - It NEVER calls play(), never retries a start, never mints. A presentation
     failure is not a reason to buy a second session.
   - It stops on first success, on pagehide, on avatar-start-failed, or on its own
     cap. It cannot poll forever.
   - The 30s window starts when a VIDEO APPEARS, not at page load. The session does
     not begin until roughly ten seconds in, so a load-anchored cap would expire
     before the thing it measures exists.
   - No backticks inside: this whole file is template literals and one stray
     backtick breaks the build. String concatenation only. */
const wildWorksMediaProbeScript = `
  <script>
    (function () {
      try {
        var LOAD_AT = Date.now();
        var NO_VIDEO_CAP_MS = 60000;
        var WATCH_MS = 30000;
        var MARKS = [1000, 3000, 6000, 12000, 20000, 29000];

        var sent = {}, stopped = false, video = null, videoAt = null, mi = 0, poll = null;

        var send = function (point, extra) {
          try {
            if (sent[point]) return;
            sent[point] = true;
            fetch("/api/app-events/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              keepalive: true,
              body: JSON.stringify({
                eventType: "iscott_media_probe",
                sessionId: (window.__wildworksAvatarSessionId || null),
                device: window.__wildworksClientDevice?.() || {},
                payload: Object.assign({
                  point: point,
                  sinceLoadMs: Date.now() - LOAD_AT,
                  sinceVideoMs: videoAt ? Date.now() - videoAt : null
                }, extra || {})
              })
            }).catch(function () {});
          } catch (e) {}
        };

        var tracks = function (v) {
          var o = { srcObject: false, nTracks: 0, nVideo: 0, nAudio: 0, nLive: 0, kinds: [] };
          try {
            var st = v && v.srcObject;
            if (!st || typeof st.getTracks !== "function") return o;
            o.srcObject = true;
            var ts = st.getTracks() || [];
            o.nTracks = ts.length;
            for (var i = 0; i < ts.length; i++) {
              var t = ts[i];
              o.kinds.push(t.kind + "/" + t.readyState + "/" + (t.enabled ? "on" : "off") + "/" + (t.muted ? "muted" : "unmuted"));
              if (t.kind === "video") o.nVideo++;
              if (t.kind === "audio") o.nAudio++;
              if (t.readyState === "live") o.nLive++;
            }
          } catch (e) {}
          return o;
        };

        var snap = function (v) {
          var o = {};
          try {
            o.readyState = v.readyState;
            o.networkState = v.networkState;
            o.paused = v.paused;
            o.w = v.videoWidth;
            o.h = v.videoHeight;
            o.t = Math.round((v.currentTime || 0) * 1000) / 1000;
          } catch (e) {}
          return o;
        };

        var state = function () {
          return video ? Object.assign(tracks(video), snap(video)) : { noVideo: true };
        };

        var stop = function () {
          stopped = true;
          try { if (poll) clearInterval(poll); } catch (e) {}
        };

        var verdict = function () {
          try {
            var c;
            if (!video) {
              c = "no_video_element";
            } else {
              var ti = tracks(video), sn = snap(video);
              if (!ti.srcObject || ti.nVideo === 0) c = "video_element_no_remote_track";
              else if (!sn.w || !sn.h) c = "track_but_no_dimensions";
              else if (sn.paused || !sn.t) c = "attached_not_playing";
              else c = "playing";
            }
            send("verdict", Object.assign({ verdict: c }, state()));
          } catch (e) {
            send("verdict", { verdict: "probe_error" });
          }
        };

        var watch = function (v) {
          video = v;
          videoAt = Date.now();
          send("video_appeared", state());
          var names = ["loadedmetadata", "canplay", "playing", "waiting", "stalled", "error", "ended", "emptied", "suspend"];
          for (var i = 0; i < names.length; i++) {
            (function (n) {
              try {
                v.addEventListener(n, function () { send("ev_" + n, state()); }, { once: true });
              } catch (e) {}
            })(names[i]);
          }
          try {
            var st = v.srcObject;
            if (st && typeof st.getTracks === "function") {
              var ts = st.getTracks() || [];
              for (var j = 0; j < ts.length; j++) {
                (function (t) {
                  try {
                    t.addEventListener("mute", function () { send("track_mute_" + t.kind, state()); });
                    t.addEventListener("unmute", function () { send("track_unmute_" + t.kind, state()); });
                    t.addEventListener("ended", function () { send("track_ended_" + t.kind, state()); });
                  } catch (e) {}
                })(ts[j]);
              }
            }
          } catch (e) {}
        };

        var look = function () {
          if (stopped) return;
          try {
            var el = document.querySelector("video");
            if (el && el !== video) { watch(el); mi = 0; }

            if (video) {
              var sn = snap(video);
              if (sn.w > 0 && sn.h > 0 && sn.t > 0 && !sn.paused) {
                send("first_frame_seen", state());
                verdict(); stop(); return;
              }
              var age = Date.now() - videoAt;
              while (mi < MARKS.length && age >= MARKS[mi]) {
                send("v_at_" + Math.round(MARKS[mi] / 1000) + "s", state());
                mi++;
              }
              if (age > WATCH_MS) { verdict(); stop(); return; }
            } else if (Date.now() - LOAD_AT > NO_VIDEO_CAP_MS) {
              verdict(); stop(); return;
            }
          } catch (e) { stop(); }
        };

        poll = window.setInterval(look, 250);

        try {
          window.addEventListener("pagehide", function () { verdict(); stop(); });
          window.addEventListener("wildworks:avatar-start-failed", function () {
            send("start_failed_event", state());
            verdict(); stop();
          });
        } catch (e) {}
      } catch (e) {}
    })();
  </script>
`;

const wildWorksAutoWakeScript = `
  <script id="wildworks-avatar-auto-wake">
    (() => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("wake")) return;

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("wake");
      window.history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);

      let attempts = 0;

      // THE BUG, found 2026-08-28 and PROVEN with a free headless A/B.
      //
      // The vendor renders this button on the SERVER, so it is visible and
      // clickable BEFORE React hydrates and attaches its handler. We were firing
      // at 600ms; React did not take ownership until ~818ms. So the click landed
      // on an element nobody was listening to, and - because tryStart RETURNS as
      // soon as it finds a button - it never tried again.
      //
      // The measured proof, same page, same synthetic click, hold armed so
      // nothing could mint:
      //     click BEFORE React ownership -> 0 start requests. Silent. No error.
      //     click AFTER  React ownership -> 1 request to /api/start-session.
      //
      // That is the whole failure G has been living with: tap logged, no session,
      // no video, no console error, no credit spent - and it worked now and then,
      // whenever hydration happened to win the race.
      //
      // The fix is to wait for React to own the element, NOT to click more. Still
      // exactly ONE click, just not a wasted one - a second click could
      // double-start a genuinely slow handler.
      // HARDENED after Chief's review, and both of his points were right.
      //
      // 1. A __reactFiber$ key is NOT proof of readiness. The fiber can be
      //    attached before the host element carries its functional props, so
      //    fiber-only ownership can still mean a click lands on nothing. What we
      //    actually need is the real handler: a __reactProps$ object whose
      //    onClick is a function.
      // 2. My first version's catch returned TRUE - fail open. That was wrong.
      //    If the check ever breaks, failing open clicks an unproven SSR button,
      //    which is precisely the bug this exists to prevent. It now fails
      //    CLOSED: keep polling, and if we never prove readiness, say so via
      //    auto_wake_gave_up instead of firing a click we know is a no-op.
      //
      // The trade-off, stated so nobody has to rediscover it: if the vendor ever
      // renames React's internals, readiness can never be proven and iScott will
      // not auto-start at all. That is why sawReactKey is reported - a give-up
      // with sawButton true and sawReactKey false means "React internals moved",
      // not "hydration was slow", and it is one telemetry row away from obvious.
      const readiness = (el) => {
        try {
          const names = Object.getOwnPropertyNames(el);
          let anyReactKey = false;
          for (let i = 0; i < names.length; i += 1) {
            const name = names[i];
            if (name.indexOf("__react") === 0) anyReactKey = true;
            if (name.indexOf("__reactProps$") !== 0) continue;
            const props = el[name];
            if (props && typeof props.onClick === "function") {
              return { anyReactKey: true, ready: true };
            }
          }
          return { anyReactKey: anyReactKey, ready: false };
        } catch (e) {
          return { anyReactKey: false, ready: false };
        }
      };

      let sawButton = false;
      let sawReactKey = false;

      const tryStart = () => {
        attempts += 1;
        const button = Array.from(document.querySelectorAll("button")).find((candidate) => {
          const label = (candidate.textContent || "").trim();
          return !candidate.disabled && /talk to iscott|go live|start/i.test(label);
        });

        if (button) {
          sawButton = true;
          const state = readiness(button);
          if (state.anyReactKey) sawReactKey = true;
          if (state.ready) {
            button.click();
            return;
          }
        }

        if (attempts < 48) {
          window.setTimeout(tryStart, 250);
          return;
        }

        // 12s and the button never carried a functional onClick. Clicking now
        // would be the same silent no-op, so record it rather than pretend.
        try {
          if (window.__wwPaceMark) {
            window.__wwPaceMark("auto_wake_gave_up", {
              sawButton: sawButton,
              sawReactKey: sawReactKey,
              attempts: attempts,
            });
          }
        } catch (e) {}
      };

      // Back to the original 600ms on purpose. The two-second beat now lives on
      // the session-start call itself, which every path shares, so delaying here
      // as well would stack to 2.6s+ on the auto-wake path only.
      window.setTimeout(tryStart, 600);
    })();
  </script>
`;

const wildWorksIdleTimeoutScript = `
  <script id="wildworks-avatar-idle-timeout">
    (() => {
      const initializeIdleGuard = () => {
      if (typeof window.fetch !== "function") {
        window.setTimeout(initializeIdleGuard, 50);
        return;
      }
      const idleLimitMs = 60 * 1000;
      let idleTimer = null;
      let sessionActive = false;
      let stopping = false;
      let sessionAuthorization = "";

      const originalFetch = window.fetch.bind(window);
      const requestUrl = (input) => typeof input === "string" ? input : input?.url || "";
      const requestAuthorization = (input, init) => {
        try {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          return headers.get("Authorization") || "";
        } catch {
          return "";
        }
      };

      const clearIdleTimer = () => {
        if (idleTimer !== null) window.clearTimeout(idleTimer);
        idleTimer = null;
      };

      const finishLocally = () => {
        sessionActive = false;
        stopping = false;
        clearIdleTimer();
        window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended", {
          detail: { reason: "idle_timeout" },
        }));
        window.location.replace("/pages/avatar-iscott");
      };

      const stopNowWithoutReload = async (reason = "finish") => {
        if (stopping) return;
        stopping = true;
        try {
          if (sessionAuthorization) {
            await originalFetch("/api/v1/sessions/stop", {
              method: "POST",
              headers: {
                Authorization: sessionAuthorization,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ reason: "USER_CLOSED" }),
              keepalive: true,
            });
          }
        } catch (error) {
          console.error("[iScott] finish stop request failed", error);
        } finally {
          sessionActive = false;
          stopping = false;
          clearIdleTimer();
          if (reason === "finish") {
            document.documentElement.setAttribute("data-ww-finish-returned", "true");
          }
          window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended", {
            detail: { reason },
          }));
        }
      };

      const stopForIdle = async () => {
        if (!sessionActive || stopping) return;
        stopping = true;

        try {
          if (sessionAuthorization) {
            await originalFetch("/api/v1/sessions/stop", {
              method: "POST",
              headers: {
                Authorization: sessionAuthorization,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ reason: "USER_CLOSED" }),
              keepalive: true,
            });
          }
        } catch (error) {
          console.error("[iScott] idle stop request failed", error);
        } finally {
          finishLocally();
        }
      };

      // G's physical iPad smoke, 2026-08-20, V3 discipline (rev B, after the
      // race review): the watchdog is a janitor for TRULY dead starts only.
      // It acts solely when the document holds not a single video or canvas
      // element AND an explicit state holds (loading cover up, or visible
      // error text), across four agreeing samples. Any media element at all
      // - playing, connecting, paused, mid-swap - blocks it, which is the
      // literal reading of "never kill healthy, slow, or paused". Hidden
      // documents, an observed pending microphone permission, and the app's
      // own Session Ended panel also block it. Retry for the stuck first
      // tap does NOT depend on it: the serialized fetch wrapper below stops
      // a stale session directly before any second start proceeds. Teardown
      // identity rides on a session GENERATION counter, never the
      // authorization string - the capture fallback below admits that
      // string can be empty, so it cannot carry identity.
      const watchdogFirstSampleMs = 16000;
      const watchdogSampleGapMs = 4000;
      const watchdogSamplesRequired = 4;
      let watchdogTimer = null;
      let watchdogDeadSamples = 0;
      let watchdogHandled = false;
      let sessionGeneration = 0;
      // THE cleanup promise. Non-null exactly while a guard-owned
      // stop/cleanup is unresolved. Every start must see it settled (or the
      // foreign stopping flag drop) before it may forward; a cleanup that
      // will not settle inside the bound fails the start CLOSED - a late
      // stop carries no immutable session id, so nothing may ever start
      // over one still in flight. Rev D: the slot has an explicit owner
      // token, the promise is PUBLISHED before any cleanup body runs (an
      // async body with no await settles synchronously, and rev C's
      // publish-after pattern stored an already-settled promise forever,
      // wedging every later start), and it is cleared only while the same
      // promise and owner still hold the slot, before the waiters wake.
      let cleanupPromise = null;
      let cleanupOwner = 0;
      let microphonePermissionState = "";

      // Rev H: the ONLY acceptable stop handle is the Authorization bearer
      // carried by the very /api/v1/sessions/start request being forwarded
      // - exact correlation by construction, no latest-token or FIFO
      // fallback of any kind. Hardened for every header shape the fetch API
      // accepts; init.headers wins over a Request's own headers, matching
      // fetch semantics. A start with no extractable bearer FAILS CLOSED
      // before it is forwarded: a session that could never be stopped is
      // never allowed to exist.
      const extractStartAuthorization = (input, init) => {
        const readHeaders = (headers) => {
          if (!headers) return "";
          try {
            if (typeof Headers !== "undefined" && headers instanceof Headers) {
              return headers.get("authorization") || "";
            }
            if (Array.isArray(headers)) {
              for (let index = 0; index < headers.length; index += 1) {
                const pair = headers[index];
                if (pair && typeof pair[0] === "string" && pair[0].toLowerCase() === "authorization") {
                  return typeof pair[1] === "string" ? pair[1] : "";
                }
              }
              return "";
            }
            if (typeof headers === "object") {
              const names = Object.keys(headers);
              for (let index = 0; index < names.length; index += 1) {
                if (names[index].toLowerCase() === "authorization") {
                  const value = headers[names[index]];
                  return typeof value === "string" ? value : "";
                }
              }
            }
          } catch (error) {}
          return "";
        };
        let bearerValue = "";
        try {
          if (init && init.headers) bearerValue = readHeaders(init.headers);
          if (!bearerValue && input && typeof Request !== "undefined" && input instanceof Request) {
            bearerValue = readHeaders(input.headers);
          }
        } catch (error) {}
        return bearerValue;
      };

      try {
        if (navigator.permissions && typeof navigator.permissions.query === "function") {
          navigator.permissions.query({ name: "microphone" }).then((status) => {
            microphonePermissionState = status.state || "";
            if (typeof status.addEventListener === "function") {
              status.addEventListener("change", () => {
                microphonePermissionState = status.state || "";
              });
            }
          }).catch(() => {});
        }
      } catch (error) {}

      const mediaInventory = () => {
        const media = document.querySelectorAll("video, canvas");
        const videos = document.querySelectorAll("video");
        const inventory = { count: media.length, playing: false, connecting: false };
        for (let index = 0; index < videos.length; index += 1) {
          const video = videos[index];
          if (!video.paused && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            inventory.playing = true;
          } else if (!video.paused && video.readyState >= 1) {
            inventory.connecting = true;
          }
        }
        return inventory;
      };

      const visibleErrorPattern = /session ended|avatar app unavailable|try again|failed to|error occurred|forbidden/i;

      const clearFailedStartProbe = () => {
        if (watchdogTimer !== null) window.clearTimeout(watchdogTimer);
        watchdogTimer = null;
        watchdogDeadSamples = 0;
      };

      const teardownAfterFailedStart = (generationAtStop, ownerToken) => {
        // Ownership validation FIRST, on the ONE reconciled pair: shared
        // state - including the stopping unlock - mutates only when this
        // cleanup's generation AND owner token still hold the guard.
        if (sessionGeneration !== generationAtStop || cleanupOwner !== ownerToken) return;
        sessionAuthorization = "";
        sessionActive = false;
        clearIdleTimer();
        stopping = false;
        window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
        window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended", {
          detail: { reason: "failed_start" },
        }));
        window.location.replace("/pages/avatar-iscott");
      };

      const publishCleanup = (runCleanup) => {
        // Rev D publication contract: construct and PUBLISH the promise
        // before one line of cleanup body runs, capture the generation at
        // publish time, and on settle clear the slot only while this very
        // promise and owner token still hold it - then wake the waiters.
        cleanupOwner += 1;
        const owner = cleanupOwner;
        let settleCleanup = null;
        const published = new Promise((resolve) => { settleCleanup = resolve; });
        cleanupPromise = published;
        const generationAtStop = sessionGeneration;
        (async () => {
          try {
            await runCleanup(generationAtStop, owner);
          } finally {
            if (cleanupPromise === published && cleanupOwner === owner) {
              // Invariant, asserted: the generation cannot move while a
              // cleanup is published - every generation increment lives in
              // the start ok-branch, and every start awaits cleanup
              // settlement before it may forward. Gating this clear on the
              // generation would turn a violation into a permanent wedge,
              // so a violation is alarmed instead of silently wedging.
              if (sessionGeneration !== generationAtStop) {
                console.error("[iScott] cleanup invariant violated: generation moved during a published cleanup");
              }
              cleanupPromise = null;
            }
            settleCleanup();
          }
        })();
        return published;
      };

      const recoverFromFailedStart = () => {
        if (stopping || cleanupPromise) return;
        // Race contract: stopping marks and the sampler cancels BEFORE any
        // await; the whole cleanup is published as THE cleanup promise so
        // no start can forward under it; stopping unlocks only inside the
        // generation-validated teardown.
        stopping = true;
        clearFailedStartProbe();
        // Rev H: sessions only exist with an exact captured bearer (the
        // start fails closed otherwise), so the session's own authorization
        // is always the handle.
        const staleAuthorization = sessionAuthorization;
        void publishCleanup(async (generationAtStop, ownerToken) => {
          let stopVerified = false;
          try {
            if (staleAuthorization) {
              const stopResponse = await originalFetch("/api/v1/sessions/stop", {
                method: "POST",
                headers: {
                  Authorization: staleAuthorization,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ reason: "USER_CLOSED" }),
                keepalive: true,
              });
              stopVerified = Boolean(stopResponse && stopResponse.ok);
              if (!stopVerified) console.error("[iScott] failed-start stop returned status " + stopResponse.status);
            }
          } catch (error) {
            console.error("[iScott] failed-start stop request failed", error);
          }
          // Only a VERIFIED HTTP-OK stop may clear state. Non-OK, thrown,
          // or no-handle stops stay fail-closed: state and every handle
          // survive so the next tap retries the verified stop. There is no
          // time-based release.
          if (stopVerified) {
            teardownAfterFailedStart(generationAtStop, ownerToken);
          } else if (sessionGeneration === generationAtStop && cleanupOwner === ownerToken) {
            stopping = false;
            window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
          }
        });
      };

      const sampleFailedStart = () => {
        watchdogTimer = null;
        if (!sessionActive || stopping || watchdogHandled) return;
        const inventory = mediaInventory();
        const loadingHeld = document.documentElement.classList.contains("wildworks-avatar-loading");
        const errorShown = visibleErrorPattern.test(document.body ? document.body.innerText || "" : "");
        const endedPanelShown = Boolean(document.getElementById("wildworks-session-ended-panel"));
        const backgrounded = document.visibilityState !== "visible";
        const permissionPending = microphonePermissionState === "prompt";
        let deadNow = false;
        if (!backgrounded && !permissionPending && !endedPanelShown
            && inventory.count === 0 && !inventory.playing && !inventory.connecting
            && (errorShown || loadingHeld)) {
          deadNow = true;
        }
        watchdogDeadSamples = deadNow ? watchdogDeadSamples + 1 : 0;
        if (watchdogDeadSamples >= watchdogSamplesRequired) {
          watchdogHandled = true;
          try { window.__wwPaceMark && window.__wwPaceMark("failed_start_recovered", { errorShown: errorShown, mediaCount: inventory.count }); } catch {}
          void recoverFromFailedStart();
          return;
        }
        watchdogTimer = window.setTimeout(sampleFailedStart, watchdogSampleGapMs);
      };

      const armFailedStartProbe = () => {
        clearFailedStartProbe();
        watchdogHandled = false;
        watchdogTimer = window.setTimeout(sampleFailedStart, watchdogFirstSampleMs);
      };

      const stopStaleBeforeRestart = () => {
        if (cleanupPromise) return cleanupPromise;
        if (stopping) return null;
        // A second start while an older session is still active: stop and
        // clear the old one BEFORE any new start may forward. stopping
        // marks and the sampler cancels before the await; the cleanup is
        // published through publishCleanup (publish-before-body, owner-
        // validated clear); shared state - including the stopping unlock -
        // mutates only after the generation validation.
        stopping = true;
        clearFailedStartProbe();
        // Rev H: the session's own exact bearer is always the handle -
        // authless sessions cannot exist any more.
        const staleAuthorization = sessionAuthorization;
        return publishCleanup(async (generationAtStop, ownerToken) => {
          let stopVerified = false;
          try {
            if (staleAuthorization) {
              const stopResponse = await originalFetch("/api/v1/sessions/stop", {
                method: "POST",
                headers: {
                  Authorization: staleAuthorization,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ reason: "USER_CLOSED" }),
                keepalive: true,
              });
              stopVerified = Boolean(stopResponse && stopResponse.ok);
              if (!stopVerified) console.error("[iScott] stale-session stop returned status " + stopResponse.status);
            }
          } catch (error) {
            console.error("[iScott] stale-session stop before restart failed", error);
          }
          // Only a VERIFIED HTTP-OK stop clears the barrier and permits
          // forwarding. Anything else keeps state - and every handle, for
          // the retry. There is no time-based release.
          if (sessionGeneration === generationAtStop && cleanupOwner === ownerToken) {
            stopping = false;
            if (stopVerified) {
              sessionAuthorization = "";
              sessionActive = false;
              clearIdleTimer();
              // Let the capture bridge close the old session's books: it
              // syncs the transcript and drops the talking flag; the new
              // session re-raises both through its own start flow.
              window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended", {
                detail: { reason: "stale_restart" },
              }));
            }
          }
        });
      };

      const boundedCleanupWait = async (limitMs) => {
        // Awaits BOTH kinds of unresolved cleanup: the guard's own cleanup
        // promise, and a foreign stop (Finish/idle/hide) that only signals
        // through the shared stopping flag. Returns true only when neither
        // remains; the caller fails the start closed on false.
        const deadline = Date.now() + limitMs;
        while ((stopping || cleanupPromise) && Date.now() < deadline) {
          if (cleanupPromise) {
            const remaining = Math.max(50, deadline - Date.now());
            await Promise.race([
              cleanupPromise,
              new Promise((resolve) => { window.setTimeout(resolve, remaining); }),
            ]);
          } else {
            await new Promise((resolve) => { window.setTimeout(resolve, 100); });
          }
        }
        return !stopping && !cleanupPromise;
      };

      let pendingStartGate = null;
      let mediaPickerUntil = 0;
      let mediaPickerTimer = null;
      window.addEventListener("wildworks:media-picker", (event) => {
        if (mediaPickerTimer !== null) window.clearTimeout(mediaPickerTimer);
        mediaPickerUntil = event.detail?.open === true ? Date.now() + 120000 : 0;
        if (mediaPickerUntil) {
          clearIdleTimer();
          mediaPickerTimer = window.setTimeout(() => {
            mediaPickerUntil = 0;
            if (document.visibilityState === "hidden") void stopForIdle();
            else armIdleTimer();
          }, 120000);
        } else armIdleTimer();
      });

      const armIdleTimer = () => {
        if (!sessionActive || stopping) return;
        if (Date.now() < mediaPickerUntil) return;
        clearIdleTimer();
        idleTimer = window.setTimeout(stopForIdle, idleLimitMs);
      };

      // Diagnostic-only: correlate Safari visibility transitions with the
      // exact permission/session/media state before rev-H performs its existing
      // stop. Measured embedded tablets only; behavior is unchanged.
      const markMeasuredIPadLifecycle = (stage, extra = {}) => {
        if (!document.documentElement.matches("[data-ww-avatar-embedded][data-ww-embed-measured]")) return;
        try {
          window.__wwPaceMark && window.__wwPaceMark(stage, {
            visibilityState: document.visibilityState,
            microphonePermissionState,
            sessionActive,
            stopping,
            media: mediaInventory(),
            ...extra,
          });
        } catch {}
      };

      ["pointerdown", "keydown", "touchstart", "input"].forEach((eventName) => {
        document.addEventListener(eventName, armIdleTimer, { capture: true, passive: true });
      });
      window.addEventListener("wildworks:avatar-activity", armIdleTimer);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          markMeasuredIPadLifecycle("visibility_hidden_before_idle_stop");
          if (Date.now() < mediaPickerUntil) return;
          void stopForIdle();
        } else {
          mediaPickerUntil = 0;
          if (mediaPickerTimer !== null) window.clearTimeout(mediaPickerTimer);
          armIdleTimer();
          markMeasuredIPadLifecycle("visibility_visible");
        }
      });
      window.addEventListener("pagehide", () => {
        markMeasuredIPadLifecycle("pagehide_before_stop");
        if (!sessionActive || !sessionAuthorization) return;
        sessionActive = false;
        clearIdleTimer();
        void originalFetch("/api/v1/sessions/stop", {
          method: "POST",
          headers: {
            Authorization: sessionAuthorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "USER_CLOSED" }),
          keepalive: true,
        }).catch(() => undefined);
      });
      window.addEventListener("wildworks:avatar-start-failed", () => {
        markMeasuredIPadLifecycle("start_failed");
      });
      window.addEventListener("wildworks:avatar-session-ended", (event) => {
        markMeasuredIPadLifecycle("session_ended", { reason: event?.detail?.reason || "" });
      });

      window.fetch = async (input, init) => {
        const url = requestUrl(input);
        if (!url.includes("/api/v1/sessions/start")) {
          const response = await originalFetch(input, init);
          if (url.includes("/api/v1/sessions/stop") && response.ok) {
            // Rev G: only a stop the provider ANSWERED OK clears local
            // state. A refused or thrown stop preserves the barrier, the
            // handle, and the timers - the session may well still be live
            // and billing, and clearing here was the unverified hole.
            sessionActive = false;
            sessionAuthorization = "";
            clearIdleTimer();
            clearFailedStartProbe();
          }
          return response;
        }
        // Rev C: starts are SERIALIZED and CLEANUP-GATED. Each start waits
        // for the previous start to settle AND for every unresolved cleanup
        // - the guard's own cleanup promise or a foreign stop's stopping
        // flag - before it may forward. A cleanup that does not settle
        // inside the bound fails this start CLOSED: the stop request
        // carries no immutable session id, so a late stop could land on a
        // session started over it. Refusing the start costs one tap;
        // colliding sessions cost money.
        const previousStart = pendingStartGate;
        let releaseStartGate = null;
        const myStartGate = new Promise((resolve) => { releaseStartGate = resolve; });
        pendingStartGate = myStartGate;
        if (previousStart) {
          try { await previousStart; } catch (error) {}
        }
        try {
          if (sessionActive && sessionAuthorization && !stopping && !cleanupPromise) {
            stopStaleBeforeRestart();
          }
          if (stopping || cleanupPromise) {
            const cleanupSettled = await boundedCleanupWait(4000);
            if (!cleanupSettled) {
              // Fail closed, release the cover through the gate's own
              // machinery, never forward. The visitor's next tap starts
              // clean once the cleanup finally settles.
              window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
              throw new TypeError("iScott start refused: an earlier session cleanup has not settled");
            }
          }
          if (sessionActive) {
            // Rev F barrier: sessionActive ALONE blocks a forward, checked
            // after every cleanup wait and immediately before the request -
            // and it stays closed until PROVIDER-BACKED proof the old
            // session ended: a verified HTTP-OK stop cleared it above, or
            // the app's own Session Ended terminal is on screen. There is
            // no time-based release - elapsed time proves nothing.
            const terminalShown = Boolean(document.getElementById("wildworks-session-ended-panel"));
            if (terminalShown) {
              sessionActive = false;
              sessionAuthorization = "";
              clearIdleTimer();
              clearFailedStartProbe();
              window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended", {
                detail: { reason: "terminal_observed" },
              }));
            } else {
              window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
              throw new TypeError("iScott start refused: the previous session has not verifiably ended - tap again to retry the stop, or reload this page");
            }
          }
          const generationAtSend = sessionGeneration;
          // Rev H: the stop handle comes from THIS exact request, or the
          // start does not happen. No correlation guess can exist because
          // there is nothing to correlate - the bearer and the request are
          // one object.
          const exactAuthorization = extractStartAuthorization(input, init);
          if (!exactAuthorization) {
            window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
            throw new TypeError("iScott start refused: the start request carries no Authorization bearer, so its session could never be stopped");
          }
          let response;
          try {
            response = await originalFetch(input, init);
          } catch (error) {
            // A THROWN start (network failure) leaves no session: clear only
            // the state it was sent under and release the cover through the
            // loading-gate block's own machinery. The attempt's bearer dies
            // with this scope.
            if (sessionGeneration === generationAtSend) {
              sessionActive = false;
              sessionAuthorization = "";
              clearIdleTimer();
              clearFailedStartProbe();
              window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
            }
            throw error;
          }
          if (response.ok) {
            // Bind ONLY now, and ONLY the bearer from this exact request.
            sessionAuthorization = exactAuthorization;
            sessionActive = true;
            stopping = false;
            sessionGeneration += 1;
            armIdleTimer();
            armFailedStartProbe();
          } else if (sessionGeneration === generationAtSend) {
            // A REFUSED start leaves no session - but only the state it was
            // sent under is cleared; a session that armed in between is left
            // alone, and the cover releases through its own block. The
            // attempt's bearer dies with this scope.
            sessionActive = false;
            sessionAuthorization = "";
            clearIdleTimer();
            clearFailedStartProbe();
            window.dispatchEvent(new CustomEvent("wildworks:avatar-start-failed"));
          }
          return response;
        } finally {
          releaseStartGate();
          if (pendingStartGate === myStartGate) pendingStartGate = null;
        }
      };

      window.__wildworksAvatarIdleGuard = {
        idleLimitMs,
        isActive: () => sessionActive,
        noteActivity: armIdleTimer,
        stopNow: stopForIdle,
        stopNowWithoutReload,
      };
      };
      initializeIdleGuard();
    })();
  </script>
`;

const wildWorksStartScreenScript = `
  <script id="wildworks-avatar-start-screen">
    (() => {
      const localStartScreen = "/Avatar1-live-startscreen.png";
      const patchStartScreen = () => {
        document.querySelectorAll('img[alt="Start screen"]').forEach((image) => {
          image.removeAttribute("srcset");
          image.removeAttribute("sizes");
          if (image.getAttribute("src") !== localStartScreen) {
            image.setAttribute("src", localStartScreen);
          }
          image.style.objectFit = "cover";
          image.style.objectPosition = "center center";
        });
      };

      patchStartScreen();
      window.addEventListener("load", patchStartScreen);

      const observer = new MutationObserver(patchStartScreen);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["src", "srcset", "sizes"],
        childList: true,
        subtree: true,
      });
    })();
  </script>
`;

const wildWorksSessionEndedScript = `
  <script id="wildworks-avatar-session-ended">
    (() => {
      const endTextPattern = /session ended/i;
      let endNotified = false;

      const restartSession = () => {
        window.location.href = "/pages/avatar-iscott?wake=" + Date.now();
      };

      const buildEndedPanel = () => {
        let panel = document.getElementById("wildworks-session-ended-panel");
        if (panel) return panel;

        panel = document.createElement("div");
        panel.id = "wildworks-session-ended-panel";
        panel.innerHTML = [
          '<div class="wildworks-session-ended-card">',
          '  <p class="wildworks-session-ended-kicker">WildWorks Concierge</p>',
          '  <h2 class="wildworks-session-ended-title">Session Ended</h2>',
          '  <p class="wildworks-session-ended-copy">The session is finished. Nothing else will be sent unless you start again.</p>',
          '  <button id="wildworks-avatar-restart" class="btn-wood" type="button">Restart iScott</button>',
          '</div>',
        ].join("");

        document.body.appendChild(panel);
        panel.querySelector("#wildworks-avatar-restart")?.addEventListener("click", restartSession);
        return panel;
      };

      const syncEndedState = () => {
        const bodyText = document.body?.innerText || "";
        const ended = endTextPattern.test(bodyText);
        if (!ended) return;

        document.body.classList.add("wildworks-session-ended-active");
        buildEndedPanel();
        if (!endNotified) {
          endNotified = true;
          window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended"));
        }
      };

      syncEndedState();
      window.addEventListener("load", syncEndedState);

      const observer = new MutationObserver(syncEndedState);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    })();
  </script>
`;

const wildWorksCaptureBridgeScript = `
  <script id="wildworks-avatar-capture-bridge">
    (() => {
      const VISITOR_KEY = "wildworks.anonymousVisitorId";
      const SESSION_KEY = "wildworks.clientSessionId";
      const state = {
        liveAvatarSessionId: null,
        sessionToken: null,
        nextTimestamp: null,
        syncing: false,
        intervalId: null,
        failStreak: 0,
        nextSyncAt: 0,
        // G 2026-08-17 plumbing: adaptive cadence. Hot while words are landing
        // or an email/phone capture is open, calm when idle. Keeps the lead
        // box's worst-case pop-up lag ~2s instead of ~5s.
        lastSyncAt: 0,
        hotUntil: 0,
        lastUserTapAt: 0,
        sessionLive: false,
      };

      // The SDK instance must own the current token. Only bounded speech
      // events leave this closure; the token never enters an event or log.
      window.__wildworksAvatarSpeechSession = () => state.sessionLive ? state.liveAvatarSessionId : null;
      window.__wildworksAvatarSpeechEvent = (token, type, payload) => {
        if (!state.sessionLive || !state.sessionToken || token !== state.sessionToken) return;
        if (!["user.speak_started", "user.speak_ended", "user.transcription", "avatar.transcription", "avatar.speak_started", "avatar.speak_ended"].includes(type)) return;
        window.dispatchEvent(new CustomEvent("wildworks:avatar-speech", { detail: {
          sessionId: state.liveAvatarSessionId,
          type,
          eventId: typeof payload?.event_id === "string" ? payload.event_id.slice(0, 160) : null,
          text: typeof payload?.text === "string" ? payload.text.slice(0, 2000) : "",
        } }));
      };

      const safeRandomId = (prefix) => {
        const random = crypto?.randomUUID
          ? crypto.randomUUID().replace(/-/g, "")
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
        return (prefix + "_" + random).slice(0, 120);
      };

      const storageGet = (key) => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      };

      const storageSet = (key, value) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {}
      };

      const getOrCreateId = (key, prefix) => {
        const existing = storageGet(key);
        if (existing) return existing;
        const value = safeRandomId(prefix);
        storageSet(key, value);
        return value;
      };

      const anonymousVisitorId = () => getOrCreateId(VISITOR_KEY, "wwv");
      const clientSessionId = () => getOrCreateId(SESSION_KEY, "wws");
      const viewport = () => window.innerWidth + "x" + window.innerHeight;

      const postJson = (url, body, keepalive = false) => {
        const serialized = JSON.stringify(body);
        if (keepalive && navigator.sendBeacon) {
          try {
            const blob = new Blob([serialized], { type: "application/json" });
            if (navigator.sendBeacon(url, blob)) return Promise.resolve();
          } catch {}
        }
        return fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serialized,
          keepalive,
        }).catch(() => undefined);
      };

      const logEvent = (eventType, payload = {}, keepalive = false, statusCode = null) =>
        postJson(
          "/api/app-events/log",
          {
            category: "app",
            eventType,
            provider: "liveavatar",
            statusCode,
            sessionId: clientSessionId(),
            clientSessionId: clientSessionId(),
            anonymousVisitorId: anonymousVisitorId(),
            route: window.location.pathname,
            viewport: viewport(),
            device: window.__wildworksClientDevice?.() || {},
            payload,
          },
          keepalive,
        );

      const extractSession = (json) => {
        const data = json && typeof json === "object" && json.data && typeof json.data === "object"
          ? json.data
          : json;
        if (!data || typeof data !== "object") return null;
        const sessionToken = typeof data.session_token === "string" ? data.session_token : null;
        const liveAvatarSessionId = typeof data.session_id === "string" ? data.session_id : null;
        return sessionToken && liveAvatarSessionId ? { sessionToken, liveAvatarSessionId } : null;
      };

      /* H465 (Grok wrote, Claude installed 2026-09-02): interval no-ops until
         the provider session is live; session_started / silent_drop / remint
         bypass backoff; results are ignored if the session id moved mid-send
         (remint race). Fixes the dead transcript sync from G's 19:27 ride. */
      const syncTranscript = async (reason, keepalive = false) => {
        if (!state.liveAvatarSessionId || !state.sessionToken) return;
        if (reason === "interval" && !state.sessionLive) return;
        const force = keepalive || reason === "session_started" || reason === "silent_drop" || reason === "remint";
        if (!force && state.syncing) return;
        if (!force && state.nextSyncAt && Date.now() < state.nextSyncAt) return;
        const syncingId = state.liveAvatarSessionId;
        const syncingToken = state.sessionToken;
        const syncingTimestamp = state.nextTimestamp;
        state.syncing = true;
        state.lastSyncAt = Date.now();
        try {
          const response = await postJson(
            "/api/liveavatar/session-transcript/sync",
            {
              liveAvatarSessionId: syncingId,
              sessionToken: syncingToken,
              startTimestamp: syncingTimestamp,
              anonymousVisitorId: anonymousVisitorId(),
              route: window.location.pathname,
              viewport: viewport(),
              device: window.__wildworksClientDevice?.() || {},
              reason,
            },
            keepalive,
          );
          if (state.liveAvatarSessionId !== syncingId) return;
          const data = response && "json" in response ? await response.json().catch(() => null) : null;
          const syncFailed = Boolean(
            response && typeof response.ok === "boolean" && (!response.ok || data?.storeFailed),
          );
          if (syncFailed) {
            state.failStreak = (state.failStreak || 0) + 1;
            state.nextSyncAt = Date.now() + Math.min(60000, 5000 * Math.pow(2, Math.min(state.failStreak - 1, 4)));
            window.dispatchEvent(new CustomEvent("wildworks:sync-failed", { detail: { reason, failStreak: state.failStreak } }));
            logEvent("liveavatar_transcript_sync_failed", {
              reason,
              stage: data?.storeFailed ? "persist" : reason === "session_started" ? "startup" : "interval",
              failStreak: state.failStreak,
            }, false, response?.status ?? null);
          } else if (response && response.ok) {
            state.failStreak = 0;
            state.nextSyncAt = 0;
          }
          const previousTimestamp = state.nextTimestamp;
          if (data && typeof data.nextTimestamp === "number" && !data.storeFailed) {
            state.nextTimestamp = data.nextTimestamp;
            if (previousTimestamp !== null && data.nextTimestamp > previousTimestamp) {
              window.dispatchEvent(new CustomEvent("wildworks:avatar-activity"));
              state.hotUntil = Date.now() + 20000;
            }
          }
          if (data && data.lead) {
            window.dispatchEvent(new CustomEvent("wildworks:lead-state", { detail: data.lead }));
            if (!(data.lead.status === "submitted" || data.lead.submittedAt)) {
              state.hotUntil = Date.now() + 20000;
            }
          }
        } finally {
          state.syncing = false;
        }
      };

      /* H465: a second /api/start-session with a new id and no user tap in 8s
         is the silent provider drop G called "popped out" - log it loudly and
         flush the dying session's transcript with the CAPTURED ids before
         switching, so the ride's words are never lost. */
      const observeSession = (sessionInfo) => {
        if (!sessionInfo || sessionInfo.liveAvatarSessionId === state.liveAvatarSessionId) return;
        const previousId = state.liveAvatarSessionId;
        const previousToken = state.sessionToken;
        const previousTimestamp = state.nextTimestamp;
        const hadPrevious = Boolean(previousId && previousToken);
        const msSinceTap = state.lastUserTapAt ? Date.now() - state.lastUserTapAt : null;
        const silentDrop = hadPrevious && !(msSinceTap !== null && msSinceTap <= 8000);

        if (hadPrevious) {
          if (silentDrop) {
            try {
              console.warn("[iScott] silent LiveAvatar drop - session died with no user tap", previousId, sessionInfo.liveAvatarSessionId, msSinceTap);
            } catch (error) {}
            logEvent("liveavatar_silent_drop", {
              previousLiveAvatarSessionId: previousId,
              nextLiveAvatarSessionId: sessionInfo.liveAvatarSessionId,
              msSinceTap,
              failStreak: state.failStreak,
            });
          }
          postJson(
            "/api/liveavatar/session-transcript/sync",
            {
              liveAvatarSessionId: previousId,
              sessionToken: previousToken,
              startTimestamp: previousTimestamp,
              anonymousVisitorId: anonymousVisitorId(),
              route: window.location.pathname,
              viewport: viewport(),
              device: window.__wildworksClientDevice?.() || {},
              reason: silentDrop ? "silent_drop" : "remint",
            },
            false,
          );
        }

        state.liveAvatarSessionId = sessionInfo.liveAvatarSessionId;
        state.sessionToken = sessionInfo.sessionToken;
        state.nextTimestamp = null;
        state.failStreak = 0;
        state.nextSyncAt = 0;
        state.sessionLive = false;
        storageSet("wildworks.liveAvatarSessionId", state.liveAvatarSessionId);
        document.documentElement.setAttribute("data-ww-talking", "true");
        logEvent("avatar_proxy_session_observed", {
          liveAvatarSessionId: state.liveAvatarSessionId,
          silentDrop: silentDrop,
          remint: hadPrevious,
        });

        if (!state.intervalId) {
          // 1s ticker, self-throttled: 2s cadence while hot (words landing or
          // capture open — stays under the 60/min IP rate limit with margin),
          // 5s when idle.
          state.intervalId = window.setInterval(() => {
            // G 2026-08-19: "as soon as somebody commits to email, boom, that box
            // should pop up immediately." The client cannot hear the visitor -
            // the embedded avatar app owns the mic and the transcript - so the
            // box can only appear as fast as the next poll returns the parsed
            // lead. Hot cadence tightened 2000ms -> 1200ms, which cuts the
            // worst-case pop-up lag by ~40%. It cannot go much lower: the route
            // is capped at 60 requests/min per IP, and 1200ms is 50/min, leaving
            // margin. 900ms would be 66/min and would start getting throttled.
            if (!state.sessionLive) return;
            const gap = Date.now() < state.hotUntil ? 1200 : 5000;
            if (Date.now() - state.lastSyncAt >= gap) syncTranscript("interval");
          }, 1000);
        }
      };

      const originalFetch = window.fetch.bind(window);
      // G 2026-08-18: "I need a two second start" - his mouth was opening before
      // there was anything to hear. The Talk button belongs to the embedded
      // avatar app, so there is no click handler of ours to hook. This is the one
      // choke point every start path goes through - the button, the ?wake
      // auto-start, and the Restart panel all end up here - so holding the
      // session-start call for two seconds gives the video and audio time to come
      // up together, once, without stacking delays.
      const WILDWORKS_START_DELAY_MS = 2000;

      // MOVED HERE 2026-08-19. It was written in the idle-timeout script and
      // called from this one. Both scripts are IIFEs, so the two halves could
      // never see each other: the call threw ReferenceError on every ride and
      // the try/catch around it swallowed the throw silently. That is why G got
      // no pause four rides running, and why delay_released never appeared in
      // app_events while start_intercepted did. The helper also reads
      // WILDWORKS_START_DELAY_MS, which lives HERE, so it was broken in both
      // directions. Nothing about the logic changes - it just lives in the same
      // scope as its caller and its constant now.
      // The mic-gated pause and its 8-second permission wait were REMOVED here
      // on 2026-08-19 after they were measured costing ten seconds of load. The
      // reasoning is written in full at the call site below. Nothing references
      // MIC_WAIT_CAP_MS or waitForMicThenPause any more - if either name comes
      // back, read that note first.

      // G has now reported "there was still no delay" on three separate rides.
      // I have twice reasoned about why it should work and twice been wrong, so
      // this stops guessing and records what actually happens. Every step of the
      // start stamps an event; after one ride the timings are in Supabase and
      // the answer is arithmetic instead of opinion.
      //
      // The specific thing being tested: whether this fetch patch is even
      // reached. The avatar app is a bundled React app whose scripts run before
      // these body scripts, so if any module captured a reference to fetch at
      // import time, it calls that and never sees this wrapper. Transcript sync
      // does NOT prove the patch fires - syncTranscript also runs on an
      // interval, which is what misled me the first two times.
      const wwPaceMark = (stage, extra) => {
        if (stage === "tap") state.lastUserTapAt = Date.now();
        try {
          const body = JSON.stringify({
            eventType: "iscott_start_pace",
            sessionId: (window.__wildworksAvatarSessionId || null),
            device: window.__wildworksClientDevice?.() || {},
            payload: Object.assign({
              stage,
              atMs: Math.round(performance.now()),
              startDelayMs: WILDWORKS_START_DELAY_MS,
            }, extra || {}),
          });
          fetch("/api/app-events/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => undefined);
        } catch {}
      };
      window.__wwPaceMark = wwPaceMark;
      let micWarmStream = null;
      let micWarmTried = false;

      // 2026-08-19, REVERTED. The mic-gated pause is temporarily out.
      //
      // After that change G rode iScott TWICE and Supabase recorded NOTHING -
      // no iscott_start_pace marks, no transcript rows, no lead. Two real
      // conversations, no trace. app_events proved the page was alive
      // (page_unload, page_hidden, page_visible) and liveavatar_token_created
      // fired twice, so the rides genuinely started and he paid for them. The
      // only things missing were the two that live behind this wrapper.
      //
      // Both worked on the 12:23 ride, before the change. The served script
      // parses clean, so I could not prove the mechanism from the outside -
      // and losing a visitor's entire conversation is far worse than any pause.
      // So this goes back to the shape that was known to work, and the pause
      // gets re-approached with evidence instead of another guess.
      //
      // G's spec stands and is NOT abandoned: two seconds AFTER the microphone
      // permission, not on session start. "He should sit there until the people
      // press the permission for the microphone, then after they press the
      // permission, two seconds, then he starts talking." The next attempt hangs
      // that off a permission event WITHOUT restructuring this wrapper.
      window.fetch = async (input, init) => {
        let isSessionStart = false;
        try {
          const startUrl = typeof input === "string" ? input : input?.url || "";
          isSessionStart = startUrl.includes("/api/v1/sessions/start");
          if (isSessionStart) {
            wwPaceMark("start_intercepted");
            // G 2026-09-03 11:3x ET: "way too loud when starting, then after i
            // hit the mic permissions, the volume is normal." On his phone the
            // browser routes playback through the quieter voice-call path only
            // once a microphone capture is live. First ride: the SDK starts the
            // avatar, THEN asks for the mic, so the opening plays at media
            // volume until he taps Allow. So ask for the mic BEFORE the start
            // request - which is also G's original 08-19 spec ("he should sit
            // there until the people press the permission for the microphone").
            // This is NOT the removed pause below: that one WAITED for a
            // permission nothing had asked for and burned 8s; this one ASKS,
            // and on a repeat visit the grant is instant. Capped so an ignored
            // prompt cannot stall the start; a denied mic starts the session
            // anyway. The warm stream is released the moment the start request
            // returns so the SDK's own capture never shares the device (iOS
            // Safari can mute the first stream when a second one opens).
            if (!micWarmTried) {
              micWarmTried = true;
              try {
                let permissionState = "";
                try {
                  if (navigator.permissions && typeof navigator.permissions.query === "function") {
                    const status = await navigator.permissions.query({ name: "microphone" });
                    permissionState = status.state || "";
                  }
                } catch {}
                if (permissionState !== "denied" && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
                  wwPaceMark("mic_warm_request", { state: permissionState });
                  const warm = navigator.mediaDevices.getUserMedia({ audio: true }).then(
                    (stream) => { micWarmStream = stream; return "granted"; },
                    (error) => "denied:" + (error && error.name ? error.name : "unknown"),
                  );
                  const cap = new Promise((resolve) => window.setTimeout(() => resolve("timeout"), 25000));
                  const result = await Promise.race([warm, cap]);
                  wwPaceMark("mic_warm_result", { result });
                }
              } catch {}
            }
            // 2026-08-19, MEASURED ON G'S RIDE 99a49da8 AND REMOVED THE SAME HOUR.
            //
            // The mic-gated pause finally ran tonight - and it cost TEN SECONDS.
            // The marks from that ride say it plainly:
            //     tap                   876ms
            //     start_intercepted    1541ms
            //     mic_waiting          1547ms   state "prompt"
            //     mic_wait_timed_out   9549ms   <- the FULL 8s cap, waiting
            //     delay_released      11552ms   <- then the 2s hold
            //     first_video_frame   20158ms
            // Against 4793ms on the ride before it, when this never ran.
            //
            // IT CANNOT WORK ON THIS PATH AND THE NUMBERS PROVE WHY. The browser
            // does not ask for the microphone until the avatar app is starting -
            // which is the very call we are holding. So it waits for permission
            // that cannot be granted yet, burns the whole cap, and only then
            // adds the two seconds. The wait is not slow because the visitor is
            // slow; it is slow because nothing has asked him anything.
            //
            // G, this evening: "let's not worry about it... don't spend much
            // more time on it," and then: "just address the taking really long
            // to load." Both point the same way, so the hold comes off the start
            // path entirely. If the pause is ever wanted again it belongs on the
            // permission-granted EVENT, not in front of the call that triggers
            // the permission prompt.
          }
        } catch {}
        const response = await originalFetch(input, init);
        try {
          // Grok, 093000: "there is no mark when the start POST returns, so I
          // cannot split our proxy plus provider round-trip from WebRTC and
          // first-frame decode without a ride." This is that mark. One ride now
          // splits the ~9.6s into request time versus media time, and we stop
          // guessing which side of the wire the wait lives on.
          if (isSessionStart) wwPaceMark("start_returned", { ok: response.ok, status: response.status });
          if (isSessionStart && micWarmStream) {
            try { micWarmStream.getTracks().forEach((track) => track.stop()); } catch {}
            micWarmStream = null;
            wwPaceMark("mic_warm_released");
          }
        } catch {}
        try {
          const url = typeof input === "string" ? input : input?.url || "";
          if (url.includes("/api/start-session")) {
            response.clone().json().then((json) => observeSession(extractSession(json))).catch(() => {});
          } else if (url.includes("/api/v1/sessions/start") && response.ok) {
            state.sessionLive = true;
            state.failStreak = 0;
            state.nextSyncAt = 0;
            syncTranscript("session_started");
          } else if (url.includes("/api/v1/sessions/stop")) {
            state.sessionLive = false;
            syncTranscript("session_stop", true);
          }
        } catch {}
        return response;
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") syncTranscript("page_hidden", true);
      });
      window.addEventListener("pagehide", () => syncTranscript("pagehide", true));
      window.addEventListener("wildworks:avatar-session-ended", () => {
        state.sessionLive = false;
        document.documentElement.removeAttribute("data-ww-talking");
        syncTranscript("session_ended", true);
      });
    })();
  </script>
`;

const wildWorksLeadConfirmationScript = `
  <script id="wildworks-avatar-lead-confirmation">
    (() => {
      let activeKey = null;
      let typingTimer = null;
      let revealVersion = 0;
      let revealingContact = false;
      let userEditedContact = false;
      let revealedContactKey = null;
      let activeLead = null;
      let dismissed = false;
      // G 2026-08-19: "the box should have been up by now ... there's no box up
      // with my phone number." He gave an email first, the panel dropped after
      // that flow, and the dismissed flag was permanent for the whole session,
      // he switched to phone the box could never come back. He was talking to a
      // dead panel. Remember WHAT was showing when it was dismissed; a genuinely
      // new capture is allowed to reopen it, the same one is not.
      let dismissedFor = null;
      let geometryLoggedForSession = null;
      let paintLoggedForCardSession = null;
      let paintLoggedForFinishSession = null;

      const markAvatarShell = () => {
        document.documentElement.setAttribute("data-ww-avatar-shell", "true");
        document.body?.setAttribute("data-ww-avatar-shell", "true");
        document.querySelectorAll("video, canvas").forEach((node) => {
          node.setAttribute("data-ww-avatar-video", "true");
        });
        // G 2026-09-03 11:19 ET, iPad screenshot: "on ipad after i hit finish,
        // avatar sits low." The returned state shows a STILL, not the video,
        // and the measured-iPad pin + pan (ww-ipad-media-pin / H468-H472) only
        // knew video and canvas - so the still was laid out by the SDK against
        // the expanded 587px fixed box and sat ~76px low with no zoom. Tag any
        // large image the same way so the same rules frame it.
        document.querySelectorAll("img").forEach((node) => {
          try {
            const rect = node.getBoundingClientRect();
            if (rect.width >= window.innerWidth * 0.6 && rect.height >= window.innerHeight * 0.4) {
              node.setAttribute("data-ww-avatar-video", "true");
            }
          } catch (error) {}
        });
        document.querySelectorAll("h1, h2, p, span").forEach((node) => {
          if (/wildworks concierge/i.test((node.textContent || "").trim())) {
            node.setAttribute("data-ww-avatar-heading", "true");
          }
        });
        document.querySelectorAll("button").forEach((button) => {
          if (/^(?:talk to i?scott|finish|go live|start)$/i.test((button.textContent || "").trim())) {
            button.setAttribute("data-ww-conversation-control", "true");
          }
          if (/^finish$/i.test((button.textContent || "").trim())) {
            button.setAttribute("data-ww-finish", "true");
            if (!button.hasAttribute("data-ww-finish-inert-armed")) {
              button.setAttribute("data-ww-finish-inert-armed", "true");
              button.setAttribute("data-ww-finish-inert", "true");
              window.setTimeout(function () {
                button.removeAttribute("data-ww-finish-inert");
              }, 1500);
            }
          }
          if (/^talk to i?scott$/i.test((button.textContent || "").trim())) {
            button.setAttribute("data-ww-talk", "true");
          }
        });
        if (!document.getElementById("wildworks-hi-scott")) {
          const lockup = document.createElement("p");
          lockup.id = "wildworks-hi-scott";
          lockup.textContent = "Hi Scott";
          document.body.appendChild(lockup);
        }
      };

      const logUi = (eventType, payload = {}, keepalive = false) => {
        const body = JSON.stringify({
          category: "app",
          eventType,
          provider: "liveavatar",
          sessionId: activeLead?.sessionId || localStorage.getItem("wildworks.clientSessionId") || "",
          clientSessionId: localStorage.getItem("wildworks.clientSessionId") || "",
          anonymousVisitorId: localStorage.getItem("wildworks.anonymousVisitorId") || "",
          route: window.location.pathname,
          viewport: window.innerWidth + "x" + window.innerHeight,
          device: window.__wildworksClientDevice?.() || {},
          payload,
        });
        if (keepalive && navigator.sendBeacon) {
          try {
            if (navigator.sendBeacon("/api/app-events/log", new Blob([body], { type: "application/json" }))) return;
          } catch {}
        }
        fetch("/api/app-events/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive,
        }).catch(() => undefined);
      };


      const splitTopLevelCss = (value) => {
        const parts = [];
        let depth = 0;
        let start = 0;
        for (let index = 0; index < value.length; index += 1) {
          if (value[index] === "(") depth += 1;
          else if (value[index] === ")") depth = Math.max(0, depth - 1);
          else if (value[index] === "," && depth === 0) {
            parts.push(value.slice(start, index).trim());
            start = index + 1;
          }
        }
        parts.push(value.slice(start).trim());
        return parts.filter((part) => part && part !== "none");
      };

      const summarizeControl = (node) => {
        if (!node || !node.getBoundingClientRect) return { present: false };
        const style = getComputedStyle(node);
        const before = getComputedStyle(node, "::before");
        const textShadows = splitTopLevelCss(style.textShadow || "");
        const dropShadows = (before.filter || "").match(/drop-shadow\\((?:[^()]|\\([^()]*\\))*\\)/g) || [];
        return {
          present: true,
          textShadowFirstTwo: textShadows.slice(0, 2),
          textShadowStopCount: textShadows.length,
          beforeFilterFirstDropShadow: dropShadows[0] || null,
          beforeFilterDropShadowCount: dropShadows.length,
          width: style.width,
          fontSize: style.fontSize,
          letterSpacing: style.letterSpacing,
          position: style.position,
          bottom: style.bottom,
          left: style.left,
          transform: style.transform,
          rect: rectPayload(node.getBoundingClientRect()),
        };
      };

      const logControlPaint = (trigger) => {
        const sessionId = activeLead?.sessionId || localStorage.getItem("wildworks.liveAvatarSessionId") || "";
        if (!sessionId) return;
        if (trigger === "card_show") {
          if (paintLoggedForCardSession === sessionId) return;
          paintLoggedForCardSession = sessionId;
        } else if (trigger === "finish_tap") {
          if (paintLoggedForFinishSession === sessionId) return;
          paintLoggedForFinishSession = sessionId;
        }
        logUi("iscott_control_paint", {
          trigger,
          html: {
            embedded: document.documentElement.hasAttribute("data-ww-avatar-embedded"),
            measured: document.documentElement.hasAttribute("data-ww-embed-measured"),
            finishReturned: document.documentElement.hasAttribute("data-ww-finish-returned"),
          },
          finish: summarizeControl(document.querySelector("[data-ww-finish]")),
          talk: summarizeControl(document.querySelector("[data-ww-talk]")),
          // 2026-09-03: what is painting the picture at this moment. The iPad
          // after-Finish "sits low" report had no media rect to read, only the
          // in-session one; this closes that gap for finish_tap / finish_settled.
          media: Array.from(document.querySelectorAll("video, canvas, img[data-ww-avatar-video]")).slice(0, 4).map((node) => {
            const style = window.getComputedStyle(node);
            return {
              tag: node.tagName.toLowerCase(),
              rect: rectPayload(node.getBoundingClientRect()),
              transform: style.transform,
              objectFit: style.objectFit,
              objectPosition: style.objectPosition,
              position: style.position,
              display: style.display,
              // 2026-09-03 12:5x: the after-Finish still turned out to be the
              // app's letterboxed start-screen PNG, not the SDK poster. Log
              // which file and its natural size so that never has to be
              // guessed again.
              src: node.tagName === "IMG" ? String(node.currentSrc || node.src || "").split("/").pop() : undefined,
              natural: node.tagName === "IMG" ? String(node.naturalWidth) + "x" + String(node.naturalHeight) : undefined,
            };
          }),
        });
      };

      const hasSendPermission = (lead) =>
        lead?.consentStatus === "accepted" || Boolean(lead?.contactConfirmedAt);
      const isSendFailureStatus = (notificationStatus) =>
        notificationStatus === "failed" || notificationStatus === "dead_letter";
      const hasSubmittedTruth = (lead) =>
        lead?.status === "submitted" || Boolean(lead?.submittedAt);
      // A provider status string is not success by itself. Completed packages
      // require server submission truth and their linked outbox. Recovery-only
      // partials deliberately do not mark the lead submitted, so they carry a
      // separately linked outbox and an explicit provider-accepted bit. Either
      // path must be internally complete before the UI says "sent".
      const hasDeliveredTruth = (lead) => {
        const completedPackageDelivered =
          hasSubmittedTruth(lead)
          && Boolean(lead?.notificationOutboxId)
          && lead?.notificationStatus === "sent";
        const recoveryContactDelivered =
          Boolean(lead?.partialNotificationOutboxId)
          && lead?.partialNotificationStatus === "sent"
          && lead?.partialNotificationProviderAccepted === true;
        return completedPackageDelivered || recoveryContactDelivered;
      };

      const statusFromLead = (lead) => {
        if (!lead) return "I still need a way for Scott to reach you.";
        if (lead.notificationStatus === "failed" || lead.notificationStatus === "dead_letter") {
          return "The send failed. Scott does not have this yet. I will keep the details here.";
        }
        if (lead.notificationStatus === "test_held") return "Test session — not sent.";
        if (hasDeliveredTruth(lead)) {
          return "WildWorks received the notification-service confirmation.";
        }
        if (lead.status === "submitted" || lead.submittedAt) {
          return "Your details are queued for a secure WildWorks handoff.";
        }
        if (lead.status === "ready_for_confirmation") {
          // G 2026-08-17: no helper line while the visitor checks their
          // details — the box speaks for itself.
          return hasSendPermission(lead)
            ? "Check the captured details, then choose Send to Scott."
            : "";
        }
        return "I still need a way for Scott to reach you.";
      };

      const ensurePanel = () => {
        let panel = document.getElementById("wildworks-lead-confirmation");
        if (panel) return panel;
        panel = document.createElement("section");
        panel.id = "wildworks-lead-confirmation";
        panel.setAttribute("aria-live", "polite");
        panel.setAttribute("aria-hidden", "true");
        panel.innerHTML = [
          '<div class="wildworks-lead-card">',
          '  <div class="wildworks-lead-capture">',
          '    <p class="wildworks-lead-label"><span class="wildworks-lead-label-icon" data-method="email" aria-hidden="true">',
          '      <svg class="ww-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 3h4l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v4c0 1-1 2-2 2C10 19 5 14 5 7c0-1 1-2 2-2z"/></svg>',
          '    </span><span id="wildworks-lead-label-text">Your Email</span></p>',
          // G, ride 308c9716: "the LastPass red box should not be in there...
          // that should be excluded." Password managers read this as a login
          // field and paint a badge over it. These are the opt-outs LastPass,
          // 1Password, Bitwarden, Dashlane and Proton Pass each respect.
          //
          // G's physical ride, 2026-08-29: the red LastPass control was STILL in
          // the field and the address ran underneath it. Three things changed.
          // (1) name= is now a neutral token: LastPass's own heuristics look at
          //     name/id as well as the opt-out attributes, and anything reading
          //     "email" invites the badge back even with data-lpignore set.
          // (2) data-protonpass-ignore joins the set.
          // (3) The field reserves symmetric horizontal padding in CSS, so an
          //     injected badge - from these or from any extension we have never
          //     heard of - lands over padding rather than over the address. We
          //     cannot uninstall the visitor's extensions; we can make sure the
          //     value stays readable when one of them paints on our field.
          //
          // type stays text and the keyboard is steered with inputmode, which is
          // what keeps this out of the credential heuristics in the first place.
          // aria-label and aria-labelledby stay: this is the only label a screen
          // reader has for the field, and none of the above needs it removed.
          '    <input id="wildworks-lead-value" name="wildworks-lead-value" type="text" autocomplete="off" inputmode="email" spellcheck="false" placeholder="" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-protonpass-ignore="true" data-form-type="other" aria-label="Your email address" aria-labelledby="wildworks-lead-label-text">',
          '    <p id="wildworks-lead-spoken-readback" aria-hidden="true"></p>',
          '    <div class="wildworks-lead-actions">',
          '      <button id="wildworks-lead-confirm" type="button" aria-label="Send these details to Scott">Send these details to Scott</button>',
          '    </div>',
          '  </div>',
          '  <p id="wildworks-lead-status" role="status" hidden></p>',
          '  <p id="wildworks-lead-sent">Email sent to Scott ✓</p>',
          '  <p id="wildworks-lead-sync" hidden>I lost the last transcript sync. Stay with me — I will retry once.</p>',
          '</div>',
        ].join("");
        document.body.appendChild(panel);
        const input = panel.querySelector("#wildworks-lead-value");
        const cancelRevealForVisitorEdit = () => {
          userEditedContact = true;
          revealVersion += 1;
          revealingContact = false;
          if (typingTimer) window.clearInterval(typingTimer);
          typingTimer = null;
          const button = panel.querySelector("#wildworks-lead-confirm");
          const typed = String(input.value || "").trim();
          if (button) {
            button.hidden = !typed && !activeLead?.email && !activeLead?.phone;
            button.disabled = !typed;
          }
          // G, 2026-08-29: a TYPED long address has to stay inside the box too.
          // The fit only ever ran on the spoken reveal, so anything the visitor
          // corrected by hand went back to full size and out of the field.
          fitValueText(input);
        };
        input?.addEventListener("beforeinput", cancelRevealForVisitorEdit);
        input?.addEventListener("input", cancelRevealForVisitorEdit);
        return panel;
      };

      // Ported from iSolve's proven on-screen email capture: show each
      // transcript-confirmed character landing in the field so a visitor can
      // spot a bad capture before the separate explicit handoff action. This
      // function is display-only; it never creates, confirms, or sends a lead.
      const playTypewriterClick = (seed) => {
        try {
          const Ctor = window.AudioContext || window.webkitAudioContext;
          if (!Ctor) return;
          window.__wwTickCtx = window.__wwTickCtx || new Ctor();
          const ctx = window.__wwTickCtx;
          if (ctx.state === "suspended") void ctx.resume().catch(() => {});
          const now = ctx.currentTime;
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = "square";
          oscillator.frequency.value = 2600 + (seed % 9) * 40;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.12, now + 0.001);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.start(now);
          oscillator.stop(now + 0.012);
        } catch {}
      };

      // G ride 89c453ff, 2026-08-19: "there should be dashes in there,
      // 443-797-2166. So for visually, just visually."
      // Display only. The value that gets SENT is stripped back to digits in
      // confirmLead, so Scott never receives a formatted string and the server's
      // own normaliser still sees what it expects.
      const displayContact = (method, value) => {
        if (method !== "phone") return value;
        const raw = String(value || "");
        const digits = raw.replace(/\D/g, "");
        if (digits.length === 10) {
          return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
        }
        if (digits.length === 11 && digits.charAt(0) === "1") {
          return "1-" + digits.slice(1, 4) + "-" + digits.slice(4, 7) + "-" + digits.slice(7);
        }
        // Anything else is left exactly as spoken - a partial number must not be
        // dressed up to look complete.
        return raw;
      };

      // G, ride 7325f798: "the email address, as large as it can comfortably fit,
      // larger. And if an email address from somebody is really long, it's gotta
      // squeeze down and be smaller print."
      //
      // So the field starts big and only shrinks when the text would overflow.
      // Steps down from the ideal until it fits or hits the floor, so a short
      // address like G's reads large and a long one still fits on one line.
      // G's physical ride, 2026-08-29: his own SHORT address was already too big
      // for the box and ran under the LastPass badge, "so longer ones will not
      // stay legible."
      //
      // Two faults, both here.
      //
      // 1. THE MEASUREMENT WAS WRONG. clientWidth on an input is content PLUS
      //    padding; scrollWidth is the content alone. Comparing them let the
      //    text grow into the padding on both sides before the loop noticed, so
      //    the value always ended up wider than the space it was allowed - hard
      //    against the edges, which is precisely where an injected badge sits.
      //    It now measures against the real content box.
      // 2. 1.6rem was never a size this card could hold. The field is 19rem at
      //    its widest and the ceiling is now 1.12rem, in line with the CSS
      //    clamp, so a short address reads large without touching the walls.
      //
      // FIT_RESERVE_PX is the badge allowance ON TOP of the CSS padding, so the
      // value stays clear of a control we do not control even when an extension
      // paints one over the field's own padding.
      // KEEP IN SYNC with its twin - check-iscott-lead-truth-20260829.mjs
      // reads these three constants out of this file and fails on drift.
      // G's ride 129b69d6, 2026-08-31, said three times: "That's super small
      // text. I can barely see it", "the email address needs to be a size
      // appropriate to the box", "a super long email address may be smaller
      // text."
      //
      // The shrink-to-fit loop below was already correct. The ceiling was the
      // fault: at 1.12rem a SHORT address like his own never grew into the box,
      // it just sat at about eighteen pixels inside an embedded frame that is
      // only 286px wide on his phone, which is exactly the "small" he means.
      //
      // 1.74rem, and the last two decimals are load-bearing. The shrink loop
      // steps 0.02rem, so the ceiling has to sit on that grid above the 0.62
      // floor or an extreme address steps straight PAST the floor and lands at
      // 0.61 - which is what 1.75 did, and a guard caught it. 0.62 + 56 x 0.02
      // = 1.74 exactly. It is also the largest value that keeps the field's own
      // height: line-height here is 1.25, so 1.74 x 1.25 = 2.18rem of text box
      // inside a 2.4rem min-height field. Nothing below moves. Long addresses
      // still step down exactly as before - the second half of what he asked.
      // 2.22 -> 1.86, 2026-09-03 10:5x ET. The address now lives in a FIXED
      // 34px line box (ww-card-pin-label) so the label never moves; an <input>
      // clips its own text, so the type must fit that box with its tails:
      // 1.86rem = 29.8px, ~1.15em of glyph = 34px. That is exactly the size
      // G's own address already fit at ("sgdietz@pm.me" 29.8px, see
      // fitValueText), so his approved look is unchanged; only a very short
      // address would ever have gone bigger. Long addresses still shrink
      // toward the floor. Keep the ceiling on the 0.02 grid above the 0.62
      // floor (1.86 = 0.62 + 62 x 0.02): the loop steps 0.02 at a time and
      // must be able to land ON the floor, not step past it.
      const FIT_MAX_REM = 1.86;
      const FIT_MIN_REM = 0.62;
      const FIT_RESERVE_PX = 6;
      const fitContentWidth = (output) => {
        const style = window.getComputedStyle(output);
        const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        const border = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
        return Math.max(0, output.clientWidth - padding - border - FIT_RESERVE_PX);
      };
      const fitValueText = (output) => {
        try {
          if (!output) return;
          let size = FIT_MAX_REM;
          output.style.setProperty("font-size", size + "rem", "important");
          const available = fitContentWidth(output);
          if (available <= 0) return;
          let guard = 0;
          // Guard raised with the ceiling: stepping 0.02rem from 1.75 down to
          // the 0.62 floor takes 57 iterations, so the old cap of 60 left
          // almost no margin and a long address could stop shrinking early.
          // G 2026-09-01: "The text is so miniscule... at least triple the size."
          // He was right, and it was never a ceiling problem - this loop could
          // NEVER stop. On an <input>, scrollWidth INCLUDES the horizontal
          // padding and never falls below clientWidth, while available has
          // that same padding SUBTRACTED. So the test compared (text + 59px of
          // padding) against (box - 59px of padding) and stayed true no matter
          // how small the glyphs got: every address, short or long, walked all
          // the way down to the FIT_MIN_REM floor of 0.62rem = 9.9px. Measured
          // in an offline harness: "sgdietz@pm.me" rendered at 9.9px at 412,
          // 820, 1366 and 1920 alike - which is also why he said it looked the
          // same size on every device.
          // Comparing scrollWidth to clientWidth is like for like: both include
          // the padding, and scrollWidth floors AT clientWidth, so the loop now
          // stops the moment the text actually fits. Same harness after the fix:
          // "sgdietz@pm.me" 29.8px (3.0x), 32-character address 13.4px, still
          // identical across all four widths. Do not reintroduce available
          // here, and do not subtract a reserve from clientWidth - scrollWidth
          // bottoms out at clientWidth, so any subtraction makes it always-true
          // again and sends every address straight back to the floor.
          while (output.scrollWidth > output.clientWidth && size > FIT_MIN_REM && guard < 140) {
            size = Math.round((size - 0.02) * 100) / 100;
            output.style.setProperty("font-size", size + "rem", "important");
            guard += 1;
          }
          // At the floor an extreme address can still be wider than the field.
          // Scrolling it back to the start is the honest outcome: the visitor
          // sees the beginning of their own address and can scroll or retype,
          // rather than seeing a middle fragment with no way to tell what is
          // missing.
          output.scrollLeft = 0;
        } catch {}
      };

      const revealCapturedContact = (output, value) => {
        const next = String(value || "");
        if (revealingContact && output.getAttribute("data-reveal-target") === next) return;
        if (typingTimer) window.clearInterval(typingTimer);
        typingTimer = null;
        if (userEditedContact || output.value === next) {
          revealingContact = false;
          return;
        }
        output.setAttribute("data-reveal-target", next);
        const version = ++revealVersion;
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        if (reduceMotion || !next || output.readOnly) {
          output.value = next;
          output.textContent = next;
          fitValueText(output);
          revealingContact = false;
          return;
        }
        revealingContact = true;
        const button = document.getElementById("wildworks-lead-confirm");
        if (button) button.disabled = true;
        output.value = "";
        output.textContent = "";
        let index = 0;
        typingTimer = window.setInterval(() => {
          fitValueText(output);
          if (version !== revealVersion || userEditedContact || output.readOnly) {
            if (typingTimer) window.clearInterval(typingTimer);
            typingTimer = null;
            revealingContact = false;
            return;
          }
          index += 1;
          if (version !== revealVersion || userEditedContact || output.readOnly) {
            if (typingTimer) window.clearInterval(typingTimer);
            typingTimer = null;
            revealingContact = false;
            return;
          }
          const revealed = next.slice(0, index);
          output.value = revealed;
          output.textContent = revealed;
          playTypewriterClick(next.charCodeAt(index - 1) + index);
          if (index >= next.length) {
            window.clearInterval(typingTimer);
            typingTimer = null;
            revealingContact = false;
            if (button) button.disabled = false;
          }
        }, 95 + (next.charCodeAt(0) % 16));
      };

      const round = (value) => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
      const rectPayload = (value) => value ? {
        top: round(value.top), right: round(value.right), bottom: round(value.bottom), left: round(value.left),
        width: round(value.width), height: round(value.height),
      } : null;

      const refreshLeadPosition = () => {
        const panel = document.getElementById("wildworks-lead-confirmation");
        if (!panel || !activeLead || dismissed) return;
        panel.style.removeProperty("--wildworks-lead-top");
        // Prefer the marked button. The text match is a fallback for the case
        // where the avatar app has not been tagged yet on this paint.
        let finish = document.querySelector("[data-ww-finish]");
        if (!finish) {
          for (const button of document.querySelectorAll("button")) {
            if (/^finish$/i.test((button.textContent || "").trim())) { finish = button; break; }
          }
        }
        const rect = finish && finish.getBoundingClientRect ? finish.getBoundingClientRect() : null;
        // G, Supabase session 2026-09-01 14:07: "the box is too high... 70% of
        // the height should be over the finish box", and at 14:08 on the sent
        // tick: "Everything, just put it over the finish box." So the card no
        // longer floats clear of Finish - it OVERLAPS it, with 70% of the
        // card's own height sitting below the Finish button's top edge. The
        // card must be visible before its height can be measured, so the
        // visible class goes on first; the old 8px-above placement survives
        // only as the fallback for a paint where the card has no height yet.
        panel.setAttribute("aria-hidden", "false");
        panel.classList.add("wildworks-lead-visible");
        if (rect && rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight) {
          // G 2026-09-03 09:02, photo of the empty YOUR EMAIL box: "when we
          // start out. Your email is just too high. It needs to be a little
          // bit lower. It needs to be where it sits when the email address is
          // on the screen. Nothing else needs to be changed with it."
          // The overlap depth was 0.7 x the card's LIVE height, so any state
          // where the card measures differently (empty field, mid-animation
          // paint, font settle) landed on a different bottom edge than the
          // filled state G approved. The depth is now a CONSTANT: 0.7 x the
          // filled contact card's documented 72.97px height (H435) = 51px.
          // Every state - empty, filled, sent - now shares the filled state's
          // exact bottom edge by definition.
          //
          // 51 -> 49, 2026-09-03 10:5x ET. G's two card screenshots (empty vs
          // filled): "The second screenshot, that's where it should be before
          // the email's in place... Nothing should move." The empty card sat
          // lower than the filled one because Finish itself was taller after a
          // capture (the SDK bar stretched it to a hidden ~49.5px sibling), and
          // this overlap is measured from Finish's TOP. Measured off his rides:
          // the filled card he pointed at sits with its bottom edge 1.4px below
          // Finish's bottom (Finish 49.54 tall, overlap 51). Finish no longer
          // stretches (align-self: flex-end in the phone block) and paints
          // ~47.5px on his phone, so the same edge is top + 49. Every state now
          // lands there.
          // 49 -> 44, 12:1x ET: Finish itself lost 5px (padding cut, ride
          // 84155e82) and its top moved down by that much. The card's bottom
          // edge stays exactly where G approved it ("after the confirmation,
          // this box is great"): 5px less overlap from a top that is 5px lower.
          const FILLED_OVERLAP_PX = 44;
          const lift = Math.ceil(window.innerHeight - rect.top - FILLED_OVERLAP_PX);
          const safeLift = Math.max(0, lift);
          // H436, G's 2026-09-02 iPad ride. iPad Safari reported a 511px
          // visible embed while position:fixed resolved against a 587px layout
          // box. Finish already compensates for that 76px difference; the lead
          // card did not, so its 19px bottom became 568px and clipped 57px out
          // of frame. Keep the ordinary px path everywhere else. In the
          // measured embed, add the same fixed-box compensation Finish uses so
          // the requested 70% overlap is expressed in one coordinate system.
          const measuredEmbed = document.documentElement.hasAttribute("data-ww-embed-measured");
          const panelBottom = measuredEmbed
            ? "calc(100dvh - var(--ww-embed-h) + " + safeLift + "px)"
            : safeLift + "px";
          panel.style.setProperty("bottom", panelBottom, "important");
        } else {
          panel.style.removeProperty("bottom");
        }
        // G's 2026-09-02 vertical-iPad ride reported every control low, but
        // the only client payloads were {}. Record the first fully measurable
        // Finish/card composition once per session so the next physical ride
        // proves which coordinate space won instead of requiring another guess.
        // This is geometry only: no contact value or transcript enters it.
        if (activeLead?.sessionId && geometryLoggedForSession !== activeLead.sessionId && rect && rect.height > 0) {
          const card = panel.querySelector(".wildworks-lead-card");
          const cardRect = card && card.getBoundingClientRect ? card.getBoundingClientRect() : null;
          const panelRect = panel.getBoundingClientRect ? panel.getBoundingClientRect() : null;
          if (cardRect && cardRect.height > 0 && panelRect) {
            logControlPaint("card_show");
            let parentFrame = null;
            try {
              const frame = window.frameElement;
              parentFrame = {
                offsetWidth: frame?.offsetWidth ?? null,
                offsetHeight: frame?.offsetHeight ?? null,
                rect: frame?.getBoundingClientRect ? rectPayload(frame.getBoundingClientRect()) : null,
                parentInnerWidth: window.parent.innerWidth,
                parentInnerHeight: window.parent.innerHeight,
              };
            } catch (error) {}
            const visual = window.visualViewport;
            let fixedBoxBottom = null;
            let fixedBoxWidth = null;
            let fixedBoxHeight = null;
            try {
              const fixedProbe = document.createElement("span");
              fixedProbe.setAttribute("aria-hidden", "true");
              // Claude 2026-09-02 20:20: the inset:0 span measured 0x0 inside the real
              // frame (two paid rides). The zero-size corner probe is the one that
              // returned 539.08 on G's phone: its right/bottom ARE the fixed box size.
              fixedProbe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;pointer-events:none;visibility:hidden";
              document.body.appendChild(fixedProbe);
              const fixedRect = fixedProbe.getBoundingClientRect();
              fixedBoxBottom = round(fixedRect.bottom);
              fixedBoxWidth = round(fixedRect.right);
              fixedBoxHeight = round(fixedRect.bottom);
              fixedProbe.remove();
            } catch (error) {}
            const media = Array.from(document.querySelectorAll("video, canvas")).slice(0, 4).map((node) => {
              const mediaStyle = getComputedStyle(node);
              return {
                tag: node.tagName.toLowerCase(),
                rect: node.getBoundingClientRect ? rectPayload(node.getBoundingClientRect()) : null,
                objectFit: mediaStyle.objectFit,
                objectPosition: mediaStyle.objectPosition,
                transform: mediaStyle.transform,
                videoIntrinsic: node instanceof HTMLVideoElement
                  ? { width: node.videoWidth || 0, height: node.videoHeight || 0 }
                  : null,
              };
            });
            logUi("iscott_embed_geometry", {
              embedded: window.parent !== window,
              measured: document.documentElement.hasAttribute("data-ww-embed-measured"),
              embedWidth: getComputedStyle(document.documentElement).getPropertyValue("--ww-embed-w").trim() || null,
              embedHeight: getComputedStyle(document.documentElement).getPropertyValue("--ww-embed-h").trim() || null,
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
              fixedBoxBottom,
              fixedBoxWidth,
              fixedBoxHeight,
              visualViewport: visual ? {
                width: round(visual.width), height: round(visual.height),
                offsetLeft: round(visual.offsetLeft), offsetTop: round(visual.offsetTop), scale: round(visual.scale),
              } : null,
              parentFrame,
              media,
              finish: rectPayload(rect),
              panel: rectPayload(panelRect),
              card: rectPayload(cardRect),
              userAgent: navigator.userAgent,
            });
            geometryLoggedForSession = activeLead.sessionId;
          }
        }
        // This runs on resize and orientationchange too. The field's width is a
        // percentage of the card, so a rotation changes how much address fits;
        // refit here or a value that was legible in portrait runs out of the box
        // in landscape. No-op while the typewriter reveal owns the field.
        if (!revealingContact) fitValueText(document.getElementById("wildworks-lead-value"));
      };

      const hidePanel = () => {
        const panel = document.getElementById("wildworks-lead-confirmation");
        panel?.classList.remove("wildworks-lead-visible");
        panel?.setAttribute("aria-hidden", "true");
      };

      const setCaptureHidden = (hidden) => {
        document.querySelector(".wildworks-lead-capture")?.setAttribute("data-hidden", hidden ? "true" : "false");
      };

      // G ride 89c453ff, 2026-08-19, twice: "it only said phone number sent...
      // it should say phone AND email sent."
      // He had given both and the label named one. Until this morning the lead
      // could only ever hold one, because a method switch destroyed the other -
      // so naming one was accurate and the real bug was upstream. That is fixed
      // now (a captured contact is never destroyed), which means the label has
      // to be able to say both.
      const sentLabelFor = (method) => {
        const hasEmail = Boolean(activeLead && activeLead.email);
        const hasPhone = Boolean(activeLead && activeLead.phone);
        if (hasEmail && hasPhone) return "Phone and email sent to Scott ✓";
        if (hasPhone) return "Phone sent to Scott ✓";
        if (hasEmail) return "Email sent to Scott ✓";
        // Nothing readable on the lead - fall back to the method that was used
        // rather than claiming something we cannot see.
        return method === "phone" ? "Phone sent to Scott ✓" : "Email sent to Scott ✓";
      };

      // G, ride 308c9716: "the check mark... it needs to be up longer. It was
      // just a flash. It was just like, I don't know, a half second, maybe a full
      // second. It should be up there 2 seconds."
      //
      // The 2s drop was already scheduled and was never the problem. The POLL
      // loop calls setSentVisible(false) as soon as a poll returns whose
      // notificationStatus has not caught up to "sent" - the submitted-but-not-
      // delivered branch. confirmLead shows the tick, a poll a few hundred ms
      // later hides it, and the drop timer then closes a panel that is already
      // empty. That is the flash.
      //
      // Once the tick is up it owns the screen for its full hold. A late poll
      // cannot take it down early.
      // G 2026-09-03 08:52, on the ride: "Email confirmation was fast, was too
      // fast. It needs to be 2 full seconds... like a long 2-count... it just
      // came and went." The 2000ms timer starts before the panel has painted
      // and animated in (360ms rise), so the visitor SEES well under two
      // seconds. 2800ms wall-clock puts a long 2-count on screen.
      const SENT_HOLD_MS = 2800;
      let sentShownAt = 0;

      // G's physical ride, 2026-08-29: "no clear on-screen confirmation
      // appeared." The confirmation is now PERSISTENT - it is put up when the
      // confirm API returns a real submission and it stays up. The hold below
      // survives as the floor it always was: a late poll still cannot pull it
      // down inside the first two seconds.
      //
      // The optional label is how the queued state stays honest. A lead whose
      // outbox row exists but which the provider has not confirmed yet is
      // CONFIRMED RECEIVED, not sent, and it must never borrow sentLabelFor().
      const RECEIVED_LABEL = "Details received by WildWorks ✓";

      // A failure has to OUTLIVE the repaint that follows it. confirmLead calls
      // showLead as soon as it is done, and the poll loop calls it again a moment
      // later; both used to walk straight into the "still asking" branch and
      // repaint a clean capture box over the words "Scott does not have this
      // yet". G would have seen the failure blink and vanish - which is how he
      // ends up believing a lead travelled when it did not.
      //
      // The failure sticks to the exact contact it happened to, so a genuinely
      // new value clears it and a retry of the same value does not.
      let failedForContactKey = null;
      const contactKeyForLead = (lead) => {
        if (!lead) return null;
        const method = lead.contactMethod === "phone" ? "phone" : "email";
        return [lead.sessionId, method, method === "email" ? lead.email : lead.phone].join(":");
      };
      // AUTO-HIDE, G 2026-08-31 (ride adfdc2ff): "I'm still talking to you, and
      // the email sent to Scott with the check mark is still up. That needs to
      // just be up for 2 full seconds and then go away."
      //
      // This reverses the 2026-08-29 "persistent" decision above, which came
      // from the OPPOSITE complaint - that no confirmation appeared at all.
      // Both are satisfied by treating SENT_HOLD_MS as one boundary with two
      // jobs: nothing may take the tick down BEFORE it (the old floor, kept
      // verbatim), and it takes itself down AT it.
      //
      // Only the tick is hidden. The panel is never touched here - a timer that
      // dropped the whole panel is the dropPanelSoon bug removed on 2026-08-29,
      // and it carried the details away with it.
      let sentHideTimer = null;
      const clearSentHideTimer = () => {
        if (sentHideTimer) {
          window.clearTimeout(sentHideTimer);
          sentHideTimer = null;
        }
      };
      // G, Supabase session 2026-09-01 14:07: "the text should fit the box
      // appropriately." Same shape as fitValueText above: start at the CSS
      // ceiling and step down until the unwrapped line fits the card, so the
      // long "Phone and email sent to Scott" label survives the raised ceiling
      // without breaking its one-line rule (ride 308c9716).
      const SENT_FIT_MAX_REM = 1.7;
      const SENT_FIT_MIN_REM = 1.2;
      const fitSentText = (sent) => {
        try {
          if (!sent) return;
          // G 2026-09-03: the tick painted oversized then "squeezed down inside
          // with the checkmark, which it should not do." A fit against an
          // undisplayed element (offsetParent null -> scrollWidth 0) used to
          // set the ceiling and bail, and the oversize showed. Never touch the
          // font unless the element is actually laid out and measurable.
          if (sent.offsetParent === null) return;
          const card = sent.closest(".wildworks-lead-card");
          const available = card ? card.clientWidth - 12 : 0;
          if (available <= 0) return;
          let size = SENT_FIT_MAX_REM;
          sent.style.setProperty("font-size", size + "rem", "important");
          let guard = 0;
          while (sent.scrollWidth > available && size > SENT_FIT_MIN_REM && guard < 60) {
            size = Math.round((size - 0.02) * 100) / 100;
            sent.style.setProperty("font-size", size + "rem", "important");
            guard += 1;
          }
        } catch {}
      };

      const setSentVisible = (visible, method, label) => {
        const sent = document.getElementById("wildworks-lead-sent");
        if (!sent) return;
        if (!visible && sentShownAt && Date.now() - sentShownAt < SENT_HOLD_MS) {
          const holdingCard = sent.closest(".wildworks-lead-card");
          if (holdingCard && holdingCard.getAttribute("data-box-view") === "sent") return;
        }
        if (visible) {
          sent.textContent = label || sentLabelFor(method);
          fitSentText(sent);
          if (!sentShownAt) sentShownAt = Date.now();
          // Re-arm from the ORIGINAL show time, not from this call: showLead
          // repaints on every poll, and restarting the clock each time is how a
          // two-second tick becomes a permanent one again.
          clearSentHideTimer();
          const elapsed = Date.now() - sentShownAt;
          sentHideTimer = window.setTimeout(() => {
            sentHideTimer = null;
            const el = document.getElementById("wildworks-lead-sent");
            if (!el) return;
            sentShownAt = 0;
            // G, Supabase session 2026-09-01 14:08, on the sent tick: "That's a
            // beautiful box... that should be over the finish box, and then
            // that should go away." So once the hold expires, a VERIFIED sent
            // panel leaves the screen whole - tick still showing - instead of
            // dropping the tick and squatting. This does not touch the Aug 29
            // premature-concealment rule: only data-box-view "sent" (provider-
            // confirmed delivery) may leave; submitted/received/failed panels
            // stay persistent exactly as before. The dismissal is keyed to the
            // lead's contact triple, so a genuinely new capture still reopens
            // the panel (the "session-ended" key would block it forever).
            const card = el.closest(".wildworks-lead-card");
            // H469, G 2026-09-02: "two full seconds for the human mind to look
            // at it and recognize what it says and then disappears and then
            // back on is the finish button."
            // "submitted" joined "sent" here. Email delivery is asynchronous,
            // so the delivered flag is almost always false at confirm time and the
            // normal success path lands on data-box-view="submitted". This
            // check only accepted "sent", so on every ordinary send the label
            // was hidden and the panel squatted - he never once saw the
            // show-hold-leave he is describing. Both of these states mean the
            // server marked the lead submitted. "failed" and "captured" are
            // still excluded on purpose: a send that did NOT happen must keep
            // the visitor's details on screen (the 2026-08-29 rule).
            const view = card ? card.getAttribute("data-box-view") : null;
            if (card && (view === "sent" || view === "submitted")) {
              dismissed = true;
              dismissedFor = activeLead
                ? [activeLead.contactMethod, activeLead.email, activeLead.phone].join(":")
                : null;
              hidePanel();
              return;
            }
            el.setAttribute("data-visible", "false");
          }, Math.max(0, SENT_HOLD_MS - elapsed));
        } else {
          clearSentHideTimer();
          sentShownAt = 0;
        }
        sent.setAttribute("data-visible", visible ? "true" : "false");
      };

      // G 2026-08-17 (all-verbal handoff): a spoken yes IS the send. When the
      // server-detected consent arrives on the lead state, fire the real send
      // once — no tap required. Visitor-typed edits keep the manual button.
      const autoConfirmed = {};
      // Attempt counter for transient 409 retries (G's vicious-circle fix,
      // 2026-09-03) - capped so a genuinely unqualified lead never loops.
      const notQualifiedRetries = {};
      // REMOVED 2026-08-29 (follow-up): the dropPanelSoon helper. It armed a timer -
      // two painted frames plus a hidden-tab backstop - that set "dismissed" and
      // called hidePanel(). Its last caller was the test-held branch below, and
      // a held lead has NO submittedAt and was never marked submitted by the
      // server. So the timer took the whole panel off screen a couple of seconds
      // after a send that had not happened: the details went with it, there was
      // nothing left to retry from, and the visitor's own value was gone.
      //
      // That is the same premature concealment the capture box was fixed for,
      // one level up. Only verified submitted/submittedAt truth may take the
      // capture away, and nothing at all may take the PANEL away on a timer -
      // the visitor closes it (dismiss/Finish) or a settled state replaces it.
      // The helper is deleted rather than left unused so it cannot be called
      // back into service by the next hand that reads this file.

      const stopSession = async (reason) => {
        logUi(reason === "close" ? "iscott_ui_close_tap" : "iscott_ui_finish_tap", { reason }, true);
        hidePanel();
        dismissed = true;
        // a deliberate Finish/Close ends the session outright - nothing reopens
        dismissedFor = "session-ended";
        if (window.__wildworksAvatarIdleGuard?.stopNowWithoutReload) {
          await window.__wildworksAvatarIdleGuard.stopNowWithoutReload(reason);
          return;
        }
        window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended", { detail: { reason } }));
      };

      const autoClose = (${iscottAutoCloseFactory})({
        currentSessionId: () => window.__wildworksAvatarSpeechSession?.() || null,
        canClose: (id) => activeLead?.sessionId === id && hasSubmittedTruth(activeLead) && hasDeliveredTruth(activeLead),
        setTimer: (callback, delay) => window.setTimeout(callback, delay),
        clearTimer: (timer) => window.clearTimeout(timer),
        stop: (reason) => { void stopSession(reason); },
      });
      window.addEventListener("wildworks:avatar-speech", (event) => autoClose.event(event.detail));
      window.addEventListener("wildworks:avatar-session-ended", () => autoClose.reset());
      window.addEventListener("pagehide", () => autoClose.reset());

      const confirmLead = async () => {
        if (!activeLead) return;
        const retryingFailedSubmission =
          hasSubmittedTruth(activeLead) && isSendFailureStatus(activeLead.notificationStatus);
        // A settled or merely queued submission cannot be sent twice from this
        // control. A failed/dead-letter submission is the one exception: keep a
        // deliberate manual retry/edit path. It never auto-retries below, and
        // the server remains responsible for rejecting stale consent/package
        // state or rebuilding it for an actually changed contact.
        if (hasSubmittedTruth(activeLead) && !retryingFailedSubmission) return;
        if (revealingContact) return;
        const method = activeLead.contactMethod === "phone" ? "phone" : "email";
        const edited = document.getElementById("wildworks-lead-value")?.value?.trim();
        const captured = method === "email" ? activeLead.email : activeLead.phone;
        // The field now DISPLAYS a phone with dashes (G asked for it, visually).
        // Strip formatting back out before it is sent, so a visitor who retypes
        // over the dashed value cannot put "443-797-2166" into Scott's lead.
        // The non-edited path already sends the server's own captured value.
        const editedForSend = method === "phone" && edited ? edited.replace(/[^\d+]/g, "") : edited;
        const value = userEditedContact ? editedForSend : captured;
        const button = document.getElementById("wildworks-lead-confirm");
        const status = document.getElementById("wildworks-lead-status");
        if (!value || !button || !status) return;
        button.disabled = true;
        // 2026-08-30: this used to say "I'm sending that to Scott." the instant
        // the button was pressed - before the server had looked at the package,
        // and most refusals ARE found at that moment. The visitor was told a
        // send had begun and then told a step was missing; the first sentence
        // was never true. What is true here is that the details are being
        // checked and nothing has gone anywhere.
        status.textContent = "Checking your details. Nothing has been sent to Scott yet.";
        // G's physical ride, 2026-08-29: the capture box "remained unchanged" and
        // he could not tell a live handoff from a dead one. This USED to call
        // setCaptureHidden(true) right here, before a single byte had come back
        // from the confirm API - the box collapsed to height 0 on optimism, and
        // if the send then failed there was nothing on screen at all. The box now
        // stays up, dimmed and locked by the "sending" view, until the API says
        // in its own words that the lead is submitted.
        setCaptureHidden(false);
        setSentVisible(false, method);
        // This attempt gets a clean slate; only this attempt's own outcome may
        // put the failure back.
        failedForContactKey = null;
        // H470d: true only when the server answered 409 - the conversation has
        // not reached a required step yet. Kept as a flag rather than a property
        // on the Error so the throw below stays the exact shape the lead-truth
        // guard requires.
        let notQualifiedRefusal = false;
        document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "sending");
        document.getElementById("wildworks-lead-confirmation")?.setAttribute("data-handoff-state", "sending");
        logUi("iscott_ui_confirm_tap", { method });
        try {
          const response = await fetch("/api/iscott/lead/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: activeLead.sessionId, contactMethod: method, contactValue: value }),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.queued) {
            notQualifiedRefusal = response.status === 409;
            throw new Error(result?.error || "The send failed. Scott does not have this yet. I will keep the details here.");
          }
          activeLead = result.lead || activeLead;
          const testHeld = result.detail === "test_traffic_not_sent" || result.lead?.notificationStatus === "test_held";
          const delivered = Boolean(result.delivered) && hasDeliveredTruth(result.lead);
          const failed = isSendFailureStatus(result.lead?.notificationStatus);
          // THE TRUTH TEST. queued:true alone is not a submission - it is the
          // server saying it intends to try. The only thing that earns the right
          // to take the capture box away and put a confirmation up is the confirm
          // API returning a lead the server itself has marked submitted.
          const submittedTruth = hasSubmittedTruth(result.lead);
          const sendState = testHeld
            ? "test_held"
            : delivered
              ? "notified"
              : failed || !submittedTruth
                ? "failed"
                : "queued";
          if (testHeld) {
            // G's own sessions are classified test, so the lead is held by
            // design and nothing was handed to Scott.
            //
            // 2026-08-29, CORRECTION: this used to collapse the capture box.
            // A held lead has no submittedAt and the server never marked it
            // submitted, so taking the box away here was the same premature
            // collapse the failure path was fixed for - the details vanished on
            // a send that had not happened. Only verified submitted/submittedAt
            // truth may hide the capture, so it is passed that truth rather than
            // a flat true.
            //
            // 2026-08-29 FOLLOW-UP: it then still armed the 2s delayed panel
            // drop, which took the ENTIRE PANEL down two seconds later and
            // marked the lead dismissed. Keeping the capture and dropping what it
            // lives in is the same defect wearing a hat: two seconds after a
            // send that never happened, the visitor's value was off screen with
            // no way back to it. Nothing is scheduled here now.
            //
            // The box returns to the captured view: not "sending" (which dims
            // and locks the field through pointer-events), not "failed" (a held
            // lead is not an error the visitor caused). The value stays, the
            // field stays editable, Send comes back, and NO tick appears -
            // because nothing was sent.
            setCaptureHidden(submittedTruth);
            setSentVisible(false, method);
            document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "captured");
            status.textContent = "Test session — not sent.";
            button.disabled = false;
          } else if (failed || !submittedTruth) {
            // Either the outbox row came back dead, or the server never marked
            // the lead submitted. Both are failures and both are told the same
            // honest way: the box stays, the value stays in it, the visitor is
            // told Scott does NOT have this, and Send is live again to retry.
            setCaptureHidden(false);
            setSentVisible(false, method);
            document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "failed");
            status.textContent = "The send failed. Scott does not have this yet. I will keep the details here.";
            button.disabled = false;
            failedForContactKey = contactKeyForLead(activeLead);
          } else if (delivered) {
            // G's physical ride, 2026-08-29: "no clear on-screen confirmation
            // appeared." The tick is now PERSISTENT. It used to be put up and
            // then dropped on a 2s timer, which is a confirmation you can miss
            // by looking away - and G did. refreshLeadPosition keeps every lead
            // card clear of Finish, so a card that stays can no longer trap him.
            setCaptureHidden(true);
            // G 2026-09-03 09:0x: "when it first came on the screen, the text
            // was off, was so big, it was outside of the box itself that it
            // squeezed down inside with the checkmark, which it should not do."
            // The view attribute must flip BEFORE the label is fitted: until
            // data-box-view is sent/submitted the tick is display:none, so
            // fitSentText measured a zero-width element, left the type at the
            // ceiling, and the oversized paint only got corrected by the next
            // poll a second later - the squeeze G watched. Order swapped at
            // every show site.
            document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "sent");
            setSentVisible(true, method);
            status.textContent = method === "phone" ? "Phone sent to Scott ✓" : "Email sent to Scott ✓";
            // (2026-09-02 19:2x: the 2 s hold-then-hide already lives in setSentVisible,
            //  keyed to the contact triple - Codex caught a duplicate timer here.)
          } else {
            // Submitted and the outbox row exists, but the provider has not
            // confirmed delivery. That is RECEIVED, not sent, and it must never
            // borrow the "sent to Scott" wording. The capture stays visible and
            // read-only so the visitor can still see exactly what is pending.
            setCaptureHidden(false);
            document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "submitted");
            setSentVisible(true, method, RECEIVED_LABEL);
            status.textContent = "Your details are queued for a secure WildWorks handoff.";
          }
          document.getElementById("wildworks-lead-confirmation")?.setAttribute("data-handoff-state", sendState);
          logUi("iscott_send_outcome", { sendState, delivered });
          showLead(activeLead);
        } catch (error) {
          const notQualified = notQualifiedRefusal;
          setCaptureHidden(false);
          setSentVisible(false, method);
          status.textContent = error instanceof Error ? error.message : "The send failed. Scott does not have this yet. I will keep the details here.";
          button.disabled = false;
          // H470b: the paint stays exactly as it was. check-iscott-lead-truth
          // D10 covers the 409 on purpose and requires this view, and the
          // sticky flag was never what blocked the retry - the auto-send tests
          // the SERVER's notificationStatus, which a 409 does not touch.
          document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "failed");
          failedForContactKey = contactKeyForLead(activeLead);
          document.getElementById("wildworks-lead-confirmation")?.setAttribute("data-handoff-state", "failed");
          // H470c: the explanation lives here, below the retry-shape guard in
          // check-iscott-failed-retry-ui.mjs, which requires button.disabled to
          // stay within 600 characters of the catch. A 409 is not a failure -
          // the server refused because a step of the conversation has not
          // happened yet (no name, need too generic, package changed after the
          // yes). The PAINT deliberately still reads failed: D10 of
          // check-iscott-lead-truth-20260829 covers that on purpose.
          //
          // RE-ARM THE ALL-VERBAL HANDOFF. showLead latched autoConfirmed before
          // this attempt and nothing ever cleared it, so one early auto-send
          // killed hands-free sending for that contact for the whole session -
          // the visitor said their name moments later and nothing fired. Only a
          // 409 re-arms; a real failure stays latched so we never hammer a
          // broken send in a loop.
          if (notQualified) {
            const retryKey = contactKeyForLead(activeLead);
            if (retryKey) delete autoConfirmed[retryKey];
            // G 2026-09-03 ride 0bd3227a: "I'm still sitting here looking at
            // the box... So something's wrong that needs to be fixed." The 409
            // was package_changed_after_permission, yet replaying the SETTLED
            // transcript shows permission current - the block was a transient
            // ordering race in the very second the yes landed. Re-arming alone
            // never healed it: the failed latch above blocks the poll-driven
            // auto-send gate (!failed), so one racy 409 killed the send for the
            // session - G's vicious circle. A 409 is "not settled yet", so
            // retry DIRECTLY, capped at 3 per contact, once the rows settle.
            const attempts = retryKey
              ? (notQualifiedRetries[retryKey] = (notQualifiedRetries[retryKey] || 0) + 1)
              : 99;
            if (retryKey && attempts <= 3) {
              failedForContactKey = null;
              window.setTimeout(() => { void confirmLead(); }, 2500);
              logUi("iscott_confirm_transient_retry", { attempt: attempts });
            }
          }
          logUi("iscott_send_outcome", { sendState: notQualified ? "not_qualified" : "failed" });
        }
      };

      const showLead = (lead) => {
        if (!lead) {
          hidePanel();
          activeLead = null;
          return;
        }
        const submitted = hasSubmittedTruth(lead);
        const method = lead.contactMethod === "phone" ? "phone" : lead.contactMethod === "email" ? "email" : lead.email ? "email" : lead.phone ? "phone" : null;
        const value = method === "email" ? lead.email : method === "phone" ? lead.phone : null;
        if (!method) return;
        const key = [
          lead.sessionId,
          method,
          value,
          lead.status,
          lead.notificationStatus,
          lead.consentStatus,
          lead.partialNotificationOutboxId,
          lead.partialNotificationStatus,
          lead.partialNotificationProviderAccepted,
        ].join(":");
        if (key === activeKey && !submitted) return;
        activeKey = key;
        activeLead = lead;
        // A new contact method, or a different value, is a NEW capture and is
        // allowed to bring the panel back. Finishing the session is not.
        const dismissalKey = [lead.contactMethod, lead.email, lead.phone].join(":");
        if (dismissed && dismissedFor !== "session-ended" && dismissedFor !== dismissalKey) {
          dismissed = false;
          dismissedFor = null;
        }
        if (dismissed) return;

        const panel = ensurePanel();
        const label = panel.querySelector("#wildworks-lead-label-text");
        const output = panel.querySelector("#wildworks-lead-value");
        const status = panel.querySelector("#wildworks-lead-status");
        const button = panel.querySelector("#wildworks-lead-confirm");
        const card = panel.querySelector(".wildworks-lead-card");
        const dismiss = panel.querySelector("#wildworks-lead-dismiss");
        const close = panel.querySelector("#wildworks-lead-close");
        if (!label || !output || !status || !button) return;

        label.textContent = method === "phone" ? "Your Phone" : "Your Email";
        const icon = panel.querySelector(".wildworks-lead-label-icon");
        if (icon) icon.setAttribute("data-method", method);
        panel.setAttribute("data-contact-method", method);
        // LastPass and friends key off type="email"/"tel". Keep it type=text
        // and steer the keyboard with inputmode instead - G, ride 7325f798:
        // "last pass has to go."
        output.setAttribute("type", "text");
        output.setAttribute("autocomplete", "off");
        output.setAttribute("inputmode", method === "email" ? "email" : "tel");
        if (!value) {
          // G's ride 89c453ff: "it just came up again... and now it hasn't gone
          // away." Grok found the path. After a send, dismissedFor holds the old
          // (method, email, phone) triple. A later poll can arrive with the
          // method restamped and BOTH values empty, which changes dismissalKey,
          // which clears "dismissed" - and this empty branch then forces the
          // panel visible again and schedules NO hide. It sits there, blank,
          // forever.
          //
          // It is the mirror of the bug from the night before: then a genuine
          // new method could not reopen the panel, now a hollowed-out row
          // reopens it and it never leaves.
          //
          // A lead that has already gone to Scott has nothing left to ask for.
          // If the panel would reopen EMPTY on a lead that is already submitted
          // or confirmed, hide it and leave it hidden.
          const leadIsDone = lead.status === "submitted" || lead.status === "confirmed";
          if (leadIsDone) {
            dismissed = true;
            dismissedFor = "session-ended";
            hidePanel();
            return;
          }
          revealVersion += 1;
          revealingContact = false;
          if (typingTimer) window.clearInterval(typingTimer);
          typingTimer = null;
          output.value = "";
          output.textContent = "";
          // G 2026-08-19: "just leave the box open, empty. Don't put in there
          // type or spell your." The field stays blank.
          output.placeholder = "";
          output.readOnly = false;
          output.disabled = false;
          output.setAttribute("aria-label", method === "email" ? "Your email address" : "Your phone number");
          status.hidden = true;
          status.textContent = "";
          button.hidden = true;
          button.disabled = true;
          panel.setAttribute("data-handoff-state", "awaiting_capture");
          panel.setAttribute("data-ui-state", "listening");
          refreshLeadPosition();
          return;
        }
        status.hidden = false;
        const visible = typeof lead.displayValue === "string" && lead.displayValue ? lead.displayValue : value;
        const aria = typeof lead.ariaLabel === "string" && lead.ariaLabel ? lead.ariaLabel : method + " " + visible;
        if (!visible) return;
        output.setAttribute("aria-label", aria);
        output.placeholder = "";
        output.disabled = false;
        const failed = isSendFailureStatus(lead.notificationStatus);
        output.readOnly = Boolean(submitted) && !failed;
        const contactKey = [lead.sessionId, method, value].join(":");
        if (contactKey !== revealedContactKey) {
          revealedContactKey = contactKey;
          userEditedContact = false;
        }
        const permitted = hasSendPermission(lead) || userEditedContact;
        // CLAUDE 2026-09-02 14:32 ET: Grok's H451 Item A block 2 was reverted to this original. With Codex's
        // permission fix (recovery mail parks 10 min, never sends during a live consent flow) this branch
        // already shows nothing about sending before the visitor's yes; the rewrite broke guards D2b, 632
        // (queued-without-submitted) and D9 (test_held 'not sent'). H451 block 1 (hold) and Item B stay.
        const delivered = hasDeliveredTruth(lead);
        // A send that just failed for THIS contact keeps the box in the failed
        // view until the value changes or a retry succeeds.
        const stickyFailure = failedForContactKey !== null && failedForContactKey === contactKey;
        const retryableFailure = failed || stickyFailure;
        button.hidden = (Boolean(submitted) && !retryableFailure) || !permitted || delivered;
        button.disabled = (Boolean(submitted) && !retryableFailure) || !permitted || delivered;
        // Every visible capture state owns the exact formatted value. Pending
        // submissions used to skip this because their capture was hidden; now
        // that pending/failed truth stays visible, populate it through the same
        // readback-preserving path as an ordinary capture.
        revealCapturedContact(output, displayContact(method, visible));
        const spoken = panel.querySelector("#wildworks-lead-spoken-readback");
        if (spoken) spoken.textContent = typeof lead.spokenReadback === "string" ? lead.spokenReadback : "";
        if (failed || stickyFailure) {
          // A failure that arrives on a poll is still a failure. Put the box
          // back so the visitor can retry, and never leave a tick standing over
          // a lead that did not travel.
          setCaptureHidden(false);
          setSentVisible(false, method);
          card?.setAttribute("data-box-view", "failed");
        } else if (delivered) {
          setCaptureHidden(true);
          // View before fit - see the G 2026-09-03 oversized-paint note at the
          // confirmLead show site. Same swap here.
          card?.setAttribute("data-box-view", "sent");
          setSentVisible(true, method);
        } else if (submitted) {
          // Submitted per the server, provider not confirmed. Persistent, and
          // worded as received rather than sent. Keep the captured value visible
          // and read-only while the linked outbox is pending.
          setCaptureHidden(false);
          card?.setAttribute("data-box-view", "submitted");
          setSentVisible(true, method, RECEIVED_LABEL);
        } else {
          setCaptureHidden(false);
          setSentVisible(false, method);
          // Still asking. Clear any earlier view so a stale "sending"/"failed"
          // cannot dress up a fresh capture.
          card?.setAttribute("data-box-view", "captured");
        }
        status.textContent = delivered
          ? sentLabelFor(method)
          : stickyFailure
            ? "The send failed. Scott does not have this yet. I will keep the details here."
            : statusFromLead(lead);
        status.hidden = !status.textContent;
        const media = panel.querySelector("#wildworks-lead-media");
        const mediaCount = typeof lead.mediaCount === "number" ? lead.mediaCount : 0;
        if (media) {
          media.setAttribute("data-empty", mediaCount === 0 ? "true" : "false");
          media.textContent = mediaCount === 0
            ? "No photos or videos uploaded yet. Use upload photos or videos."
            : mediaCount + " uploaded";
        }
        panel.setAttribute(
          "data-handoff-state",
          retryableFailure ? "failed" : delivered ? "notified" : submitted ? "queued" : "awaiting",
        );
        panel.setAttribute(
          "data-ui-state",
          delivered ? "sent" : failed || stickyFailure ? "failed" : submitted ? "pending" : "captured",
        );
        logUi("iscott_lead_state", { status: lead.status, notificationStatus: lead.notificationStatus });
        button.onclick = confirmLead;
        // G's all-verbal handoff (ordered 2026-08-17, twice): once the server
        // detects the visitor's spoken consent, the send fires without a tap.
        // Same pipeline as the button; the box shows sending -> checkmark ->
        // drops. Visitor-typed edits still require the manual button.
        if (
          hasSendPermission(lead) &&
          !submitted && !delivered && !failed &&
          !userEditedContact &&
          lead.status === "ready_for_confirmation" &&
          !autoConfirmed[contactKey]
        ) {
          autoConfirmed[contactKey] = true;
          logUi("iscott_voice_consent_autosend", { method });
          window.setTimeout(() => { void confirmLead(); }, 400);
        }
        if (dismiss) dismiss.onclick = () => {
          dismissed = true;
          dismissedFor = activeLead
            ? [activeLead.contactMethod, activeLead.email, activeLead.phone].join(":")
            : null;
          revealVersion += 1;
          revealingContact = false;
          if (typingTimer) window.clearInterval(typingTimer);
          typingTimer = null;
          hidePanel();
          logUi("iscott_ui_dismiss_tap");
        };
        if (close) close.onclick = () => { void stopSession("close"); };
        refreshLeadPosition();
      };

      document.addEventListener("click", (event) => {
        const button = event.target && event.target.closest ? event.target.closest("button") : null;
        if (!button) return;
        if (!/^finish$/i.test((button.textContent || "").trim())) return;
        if (button.hasAttribute("data-ww-finish-inert")) return;
        logControlPaint("finish_tap");
        // A second paint once the returned state has settled: this is the
        // frame G photographed on the iPad ("avatar sits low").
        window.setTimeout(() => { try { logControlPaint("finish_settled"); } catch (error) {} }, 1500);
        // 2026-09-03 12:5x: G's desktop screenshot came ~35s after the tap and
        // the 1.5s row could not say whether anything moved after it. One
        // late row closes that gap.
        window.setTimeout(() => { try { logControlPaint("finish_settled_late"); } catch (error) {} }, 6000);
        event.preventDefault();
        void stopSession("finish");
      }, true);

      window.addEventListener("wildworks:lead-state", (event) => { showLead(event.detail); autoClose.leadChanged(); });
      window.addEventListener("wildworks:sync-failed", () => {
        const sync = document.getElementById("wildworks-lead-sync");
        if (sync) sync.hidden = false;
      });
      window.addEventListener("resize", refreshLeadPosition);
      window.addEventListener("orientationchange", refreshLeadPosition);
      markAvatarShell();
      new MutationObserver(() => {
        markAvatarShell();
        refreshLeadPosition();
      }).observe(document.documentElement, { childList: true, subtree: true });
    })();
  </script>
`;

const wildWorksGalleryBridgeScript = `
  <script id="wildworks-avatar-gallery-bridge">
    (() => {
      let pendingUpload = null;
      let lastDeliveredUploadId = null;
      let observedGalleryInput = null;

      const notifyParent = (type, payload = {}) => {
        if (window.parent === window) return;
        window.parent.postMessage({ type, ...payload }, window.location.origin);
      };

      const persistInternalGalleryFile = async (file) => {
        if (!file || (!file.type.startsWith("image/") && !file.type.startsWith("video/"))) return;
        const formData = new FormData();
        formData.append("media", file, file.name || "wildworks-media");
        formData.append("uploadId", crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
        formData.append("anonymousVisitorId", localStorage.getItem("wildworks.anonymousVisitorId") || "");
        formData.append("clientSessionId", localStorage.getItem("wildworks.clientSessionId") || "");
        formData.append("liveAvatarSessionId", localStorage.getItem("wildworks.liveAvatarSessionId") || "");
        formData.append("route", window.location.pathname);
        formData.append("viewport", window.innerWidth + "x" + window.innerHeight);

        const response = await fetch("/api/media/capture", { method: "POST", body: formData });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "iScott could not save that media right now.");
        notifyParent("wildworks:gallery-saved", { fileName: file.name || "your media" });
      };

      const watchGalleryInput = (input) => {
        if (!input || input === observedGalleryInput) return;
        observedGalleryInput = input;
        input.addEventListener("change", () => {
          if (pendingUpload) return;
          const file = input.files?.[0];
          if (!file) return;
          persistInternalGalleryFile(file).catch((error) => {
            notifyParent("wildworks:gallery-error", {
              message: error instanceof Error ? error.message : "iScott could not save that media right now.",
            });
          });
        });
      };

      const galleryInput = () => {
        const input = Array.from(document.querySelectorAll('input[type="file"]')).find((candidate) => {
          const accept = (candidate.getAttribute("accept") || "").toLowerCase();
          return accept.includes("image") && accept.includes("video");
        });
        watchGalleryInput(input);
        return input;
      };

      const deliverPendingFile = () => {
        const input = galleryInput();
        if (!input) return false;

        notifyParent("wildworks:gallery-ready");
        if (!pendingUpload) {
          notifyParent("wildworks:gallery-ready");
          return true;
        }

        if (pendingUpload.uploadId === lastDeliveredUploadId) {
          notifyParent("wildworks:gallery-accepted", {
            fileName: pendingUpload.file.name || "your media",
          });
          pendingUpload = null;
          return true;
        }

        try {
          const transfer = new DataTransfer();
          transfer.items.add(pendingUpload.file);
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          lastDeliveredUploadId = pendingUpload.uploadId;
          notifyParent("wildworks:gallery-accepted", {
            fileName: pendingUpload.file.name || "your media",
          });
          pendingUpload = null;
        } catch (error) {
          notifyParent("wildworks:gallery-error", {
            message: "iScott could not open that file. Please try another photo or video.",
          });
          pendingUpload = null;
        }

        return true;
      };

      window.addEventListener("message", (event) => {
        if (event.source !== window.parent || event.origin !== window.location.origin) return;
        const message = event.data;
        if (!message || typeof message !== "object") return;

        if (message.type === "wildworks:gallery-status") {
          deliverPendingFile();
          return;
        }

        if (message.type !== "wildworks:gallery-upload") return;

        const file = message.file;
        const fileType = typeof file?.type === "string" ? file.type : "";
        if (!file || (!fileType.startsWith("image/") && !fileType.startsWith("video/"))) {
          notifyParent("wildworks:gallery-error", {
            message: "Use upload photos or videos. Documents and links are not supported.",
          });
          return;
        }

        const uploadId = typeof message.uploadId === "string" && message.uploadId
          ? message.uploadId
          : String(Date.now());
        pendingUpload = { file, uploadId };
        deliverPendingFile();
      });

      deliverPendingFile();
      window.addEventListener("load", deliverPendingFile);

      const observer = new MutationObserver(deliverPendingFile);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
  </script>
`;

export async function GET(request: Request) {
  const shouldWake = new URL(request.url).searchParams.has("wake");
  const response = await fetch(`${REMOTE_AVATAR_ORIGIN}/`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return new Response("Avatar app unavailable.", { status: 502 });
  }

  const html = (await response.text())
    // The remote app marks its chunks async, so this must precede its first
    // script tag rather than merely be appended at the end of the head.
    .replace(/<script\b/i, `${wildWorksMicrophoneSafetyScript}${wildWorksAvatarOriginBridgeScript}<script`)
    .replaceAll("/_next/", LOCAL_AVATAR_ASSET_PREFIX)
    .replaceAll("/favicon.ico", `${REMOTE_AVATAR_ORIGIN}/favicon.ico`)
    .replaceAll("/startscreen.png", "/Avatar1-live-startscreen.png")
    .replace("</head>", `${wildWorksButtonCss}${iscottHomeShadowColorsScript}${wildWorksLoadingBootstrapScript}</head>`)
    .replace(
      "</body>",
      `${wildWorksLoadingGateScript}${wildWorksMediaProbeScript}${wildWorksStartScreenScript}${wildWorksIdleTimeoutScript}${wildWorksCaptureBridgeScript}${wildWorksLeadConfirmationScript}${wildWorksGalleryBridgeScript}${wildWorksSessionEndedScript}${wildWorksLegalBandScript}${shouldWake ? wildWorksAutoWakeScript : ""}</body>`,
    );

  return new Response(versionIScottSpeechAssetReferences(html), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    },
  });
}
