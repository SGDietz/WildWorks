const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";
const LOCAL_AVATAR_ASSET_PREFIX = "/pages/avatar-iscott-assets/_next/";

export const dynamic = "force-dynamic";

const sparkleIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2388421f' stroke-width='2.35' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z'/%3E%3Cpath d='M5 3v4'/%3E%3Cpath d='M7 5H3'/%3E%3C/svg%3E";

const wildWorksButtonCss = `
  <style id="wildworks-avatar-button-style">
    :root {
      --ww-avatar-black: #080302;
      --ww-avatar-night: #130702;
      --ww-avatar-wood: #3d1c08;
      --ww-avatar-gold: #b7823a;
      --ww-avatar-honey: #e0a85a;
      --ww-avatar-parchment: #f3cf92;
      --ww-avatar-cream: #f7d9a5;
      --ww-avatar-button-ink: #7d2f20;
    }

    html,
    body,
    #__next {
      min-height: 100% !important;
      background:
        radial-gradient(ellipse 94% 62% at 50% 0%, rgba(255, 231, 175, 0.32), transparent 66%),
        radial-gradient(ellipse 90% 70% at 50% 100%, rgba(200, 121, 54, 0.28), transparent 72%),
        linear-gradient(155deg, #cf7140 0%, #bd5929 52%, #a54219 100%) !important;
      color: var(--ww-avatar-parchment) !important;
    }

    body {
      position: relative !important;
      overflow: hidden !important;
    }

    body::before {
      content: "Loading iScott" !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 0 !important;
      display: grid !important;
      place-items: center !important;
      padding-bottom: 0 !important;
      color: #f7d9a5 !important;
      -webkit-text-fill-color: #f7d9a5 !important;
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

    /* On a phone, use the frame's height to give the loading name a clean
       two-line lockup without changing its approved color or depth. */
    @media (max-width: 560px) {
      body::before {
        content: "Loading\\A iScott" !important;
        line-height: 0.9 !important;
        white-space: pre-line !important;
      }
    }

    html.wildworks-avatar-loading body::before {
      z-index: 2147483646 !important;
      background:
        radial-gradient(ellipse 94% 62% at 50% 0%, rgba(255, 231, 175, 0.32), transparent 66%),
        radial-gradient(ellipse 90% 70% at 50% 100%, rgba(200, 121, 54, 0.28), transparent 72%),
        linear-gradient(155deg, #cf7140 0%, #bd5929 52%, #a54219 100%) !important;
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
      background:
        radial-gradient(ellipse 82% 58% at 50% 22%, rgba(255, 231, 175, 0.34), rgba(232, 182, 109, 0.16) 44%, transparent 74%),
        linear-gradient(155deg, #d97b42 0%, #c96731 52%, #b95022 100%) !important;
    }

    video,
    canvas {
      background: transparent !important;
    }

    .btn-wood,
    .btn-inset {
      display: inline-flex !important;
      min-height: 48px !important;
      width: auto !important;
      min-width: 9.75rem !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.55rem !important;
      border: 1px solid rgba(246, 211, 154, 0.36) !important;
      border-radius: 8px !important;
      background:
        radial-gradient(circle at 50% -36%, rgba(255, 247, 213, 0.92), transparent 50%),
        linear-gradient(180deg, #ffe7af 0%, #e8ad59 42%, #b96d2d 74%, #71350f 100%) !important;
      padding: 0.85rem 1rem !important;
      color: var(--ww-avatar-button-ink) !important;
      font-family: Georgia, "Times New Roman", serif !important;
      font-size: 1.12rem !important;
      font-weight: 750 !important;
      line-height: 1 !important;
      letter-spacing: 0 !important;
      text-decoration: none !important;
      text-shadow: none !important;
      box-shadow:
        0 16px 42px rgba(20, 7, 1, 0.42),
        0 0 24px rgba(224, 168, 90, 0.18),
        inset 0 1px 0 rgba(255, 247, 218, 0.78),
        inset 0 -1px 0 rgba(72, 28, 6, 0.46) !important;
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease !important;
      white-space: nowrap !important;
    }

    .fixed.bottom-28:has(.btn-wood) {
      bottom: clamp(8.15rem, 18vh, 8.75rem) !important;
    }

    .btn-wood::before {
      content: "" !important;
      display: inline-block !important;
      width: 1.12em !important;
      height: 1.12em !important;
      flex: 0 0 1.12em !important;
      margin-right: 0.05rem !important;
      background-image: url("${sparkleIcon}") !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
      background-size: contain !important;
    }

    .btn-inset {
      min-width: 6.75rem !important;
      padding-inline: 1.4rem !important;
    }

    .btn-wood:hover:not(:disabled),
    .btn-inset:hover:not(:disabled) {
      filter: saturate(1.08) brightness(1.02) !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 232, 190, 0.38) !important;
    }

    .btn-wood:active:not(:disabled),
    .btn-inset:active:not(:disabled) {
      transform: translateY(1px) !important;
      box-shadow: 0 8px 22px rgba(16, 6, 1, 0.45), inset 0 1px 0 rgba(255, 232, 190, 0.28) !important;
    }

    .btn-wood:disabled,
    .btn-inset:disabled {
      cursor: default !important;
      opacity: 0.72 !important;
      filter: saturate(0.8) !important;
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
      background-image: linear-gradient(180deg, #f7d9a5 0%, #e0a85a 48%, #a76431 100%) !important;
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
  </style>
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
      const startPattern = /^(?:talk to iscott|go live|start|restart iscott)$/i;
      const releasePattern = /session ended|avatar app unavailable|try again|failed to|error occurred/i;
      const seenVideos = new WeakSet();
      let loadingStartedAt = document.documentElement.classList.contains(loadingClass)
        ? Date.now()
        : 0;

      const endLoading = () => {
        document.documentElement.classList.remove(loadingClass);
        loadingStartedAt = 0;
      };

      const beginLoading = () => {
        loadingStartedAt = Date.now();
        document.documentElement.classList.add(loadingClass);
        watchVideos();
      };

      const releaseAfterRealFrame = (video) => {
        if (!document.documentElement.classList.contains(loadingClass)) return;
        if (!video || video.readyState < 2 || video.videoWidth < 1 || video.videoHeight < 1) return;

        if (typeof video.requestVideoFrameCallback === "function") {
          video.requestVideoFrameCallback(() => endLoading());
          return;
        }

        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
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
        const visibleText = document.body?.innerText || "";
        if (releasePattern.test(visibleText)) endLoading();
      };

      if (document.documentElement.classList.contains(loadingClass)) beginLoading();
      window.addEventListener("load", syncLoadingState);
      const observer = new MutationObserver(syncLoadingState);
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    })();
  </script>
`;

const wildWorksAutoWakeScript = `
  <script id="wildworks-avatar-auto-wake">
    (() => {
      const params = new URLSearchParams(window.location.search);
      if (!params.has("wake")) return;

      let attempts = 0;
      const tryStart = () => {
        attempts += 1;
        const button = Array.from(document.querySelectorAll("button")).find((candidate) => {
          const label = (candidate.textContent || "").trim();
          return !candidate.disabled && /talk to iscott|go live|start/i.test(label);
        });

        if (button) {
          button.click();
          return;
        }

        if (attempts < 48) {
          window.setTimeout(tryStart, 250);
        }
      };

      window.setTimeout(tryStart, 600);
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
          '  <p class="wildworks-session-ended-copy">Thank You for Talking with iScott.</p>',
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

      const logEvent = (eventType, payload = {}, keepalive = false) =>
        postJson(
          "/api/app-events/log",
          {
            category: "app",
            eventType,
            provider: "liveavatar",
            sessionId: clientSessionId(),
            clientSessionId: clientSessionId(),
            anonymousVisitorId: anonymousVisitorId(),
            route: window.location.pathname,
            viewport: viewport(),
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

      const syncTranscript = async (reason, keepalive = false) => {
        if (!state.liveAvatarSessionId || !state.sessionToken || state.syncing) return;
        state.syncing = true;
        try {
          const response = await postJson(
            "/api/liveavatar/session-transcript/sync",
            {
              liveAvatarSessionId: state.liveAvatarSessionId,
              sessionToken: state.sessionToken,
              startTimestamp: state.nextTimestamp,
              anonymousVisitorId: anonymousVisitorId(),
              route: window.location.pathname,
              viewport: viewport(),
              reason,
            },
            keepalive,
          );
          const data = response && "json" in response ? await response.json().catch(() => null) : null;
          if (data && typeof data.nextTimestamp === "number") {
            state.nextTimestamp = data.nextTimestamp;
          }
        } finally {
          state.syncing = false;
        }
      };

      const observeSession = (sessionInfo) => {
        if (!sessionInfo || sessionInfo.liveAvatarSessionId === state.liveAvatarSessionId) return;
        state.liveAvatarSessionId = sessionInfo.liveAvatarSessionId;
        state.sessionToken = sessionInfo.sessionToken;
        state.nextTimestamp = null;
        storageSet("wildworks.liveAvatarSessionId", state.liveAvatarSessionId);
        logEvent("avatar_proxy_session_observed", { liveAvatarSessionId: state.liveAvatarSessionId });

        if (!state.intervalId) {
          state.intervalId = window.setInterval(() => syncTranscript("interval"), 30000);
        }
      };

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const response = await originalFetch(input, init);
        try {
          const url = typeof input === "string" ? input : input?.url || "";
          if (url.includes("/api/start-session")) {
            response.clone().json().then((json) => observeSession(extractSession(json))).catch(() => {});
          } else if (url.includes("/api/v1/sessions/start") && response.ok) {
            syncTranscript("session_started");
          } else if (url.includes("/api/v1/sessions/stop")) {
            syncTranscript("session_stop", true);
          }
        } catch {}
        return response;
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") syncTranscript("page_hidden", true);
      });
      window.addEventListener("pagehide", () => syncTranscript("pagehide", true));
      window.addEventListener("wildworks:avatar-session-ended", () => syncTranscript("session_ended", true));
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
            message: "Please choose a photo or video file.",
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
    .replaceAll("/_next/", LOCAL_AVATAR_ASSET_PREFIX)
    .replaceAll("/favicon.ico", `${REMOTE_AVATAR_ORIGIN}/favicon.ico`)
    .replaceAll("/startscreen.png", "/Avatar1-live-startscreen.png")
    .replace("</head>", `${wildWorksButtonCss}${wildWorksLoadingBootstrapScript}</head>`)
    .replace(
      "</body>",
      `${wildWorksLoadingGateScript}${wildWorksStartScreenScript}${wildWorksCaptureBridgeScript}${wildWorksGalleryBridgeScript}${wildWorksSessionEndedScript}${shouldWake ? wildWorksAutoWakeScript : ""}</body>`,
    );

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    },
  });
}
