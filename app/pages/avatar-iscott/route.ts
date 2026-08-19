const REMOTE_AVATAR_ORIGIN = "https://live-avatar-web-sdk-demo.vercel.app";
const LOCAL_AVATAR_ASSET_PREFIX = "/pages/avatar-iscott-assets/_next/";

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

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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

const sparkleIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2388421f' stroke-width='2.35' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z'/%3E%3Cpath d='M5 3v4'/%3E%3Cpath d='M7 5H3'/%3E%3C/svg%3E";

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
      --ww-avatar-button-ink: #7d2f20;
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

    body::before {
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

    /* On a phone, use the frame's height to give the loading name a clean
       two-line lockup without changing its approved color or depth. */
    @media (max-width: 560px) {
      body::before {
        content: "Loading\\A iScott" !important;
        line-height: 1.06 !important;
        white-space: pre-line !important;
      }
    }

    html.wildworks-avatar-loading body::before {
      z-index: 2147483646 !important;
      background:
        linear-gradient(180deg, #c44d0b 0%, #c44d0b 48%, #c44d0b 100%) #c44d0b !important;
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
      gap: 0.22rem !important;
      border: 1px solid rgba(246, 211, 154, 0.36) !important;
      border-radius: 8px !important;
      background:
        radial-gradient(circle at 50% -36%, rgba(255, 247, 213, 0.92), transparent 50%),
        linear-gradient(180deg, #ffe7af 0%, #e8ad59 42%, #b96d2d 74%, #c44d0b 100%) !important;
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
      /* Sit in the clear space directly above Scott's wrists and hands. */
      bottom: clamp(6.7rem, 14vh, 7.3rem) !important;
    }

    .btn-wood::before {
      content: "" !important;
      display: inline-block !important;
      width: 1.12em !important;
      height: 1.12em !important;
      flex: 0 0 1.12em !important;
      margin-right: 0 !important;
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

    #wildworks-lead-confirmation {
      position: fixed !important;
      top: auto !important;
      /* G 2026-08-17 (rev 2): the box COVERS the Finish button while open —
         Finish comes back when the box drops after the checkmark. */
      /* G 2026-08-19: "it needs to be over the word Finish." The bottom edge was
         always right - the card was simply TALL, so it grew upward into his chin.
         Anchor restored; the card below is kept short instead. */
      bottom: calc(1.9rem + env(safe-area-inset-bottom, 0px)) !important;
      left: 50% !important;
      z-index: 60 !important;
      display: none !important;
      width: min(calc(100vw - 2rem), 28rem) !important;
      transform: translateX(-50%) !important;
      color: #ffe9c2 !important;
      font-family: Arial, Helvetica, sans-serif !important;
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
      max-width: min(19rem, 88vw) !important;
      margin: 0 auto !important;
      padding: 0.5rem 0.85rem !important;
      /* G 2026-08-19: "it needs to be brand colors." Off the old wood browns and
         onto the locked five: primary field, card-colour border, text-3 glow. */
      border: 2px solid #e96819 !important;
      border-radius: 1rem !important;
      background: #c44d0b !important;
      box-shadow:
        inset 0 1px 0 rgba(252, 224, 173, 0.30),
        0 0 28px rgba(240, 140, 40, 0.55) !important;
      backdrop-filter: blur(2px) !important;
    }

    .wildworks-lead-label {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
      margin: 0 !important;
      color: #edc775 !important;
      font-size: 0.72rem !important;
      font-weight: 600 !important;
      letter-spacing: 0.18em !important;
      line-height: 1.1 !important;
      text-transform: uppercase !important;
    }

    .wildworks-lead-label-icon {
      display: inline-flex !important;
      /* G 2026-08-19: "the little email icon should be a little bigger" */
      width: 1.35rem !important;
      height: 1.35rem !important;
      color: #edc775 !important;
      letter-spacing: 0 !important;
      line-height: 1 !important;
    }

    .wildworks-lead-label-icon[data-method="phone"] .ww-mail,
    .wildworks-lead-label-icon[data-method="email"] .ww-phone {
      display: none !important;
    }

    #wildworks-lead-value {
      box-sizing: border-box !important;
      display: block !important;
      width: 100% !important;
      min-height: 2.75rem !important;
      margin: 0 auto !important;
      padding: 0.28rem 0.5rem !important;
      border: 1px solid #f08c28 !important;
      border-radius: 0.375rem !important;
      background: rgba(196, 77, 11, 0.55) !important;
      color: #fce0ad !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      font-size: clamp(0.95rem, 3.6vw, 1.15rem) !important;
      font-weight: 900 !important;
      line-height: 1.25 !important;
      text-align: center !important;
      overflow-wrap: anywhere !important;
      text-shadow: none !important;
      outline: none !important;
    }

    #wildworks-lead-status {
      margin: 0.65rem 0 0 !important;
      color: #fce0ad !important;
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
      border: 1px solid rgba(246, 211, 154, 0.36) !important;
      border-radius: 0.42rem !important;
      /* Match the site's gold btn-wood treatment. */
      background:
        radial-gradient(circle at 50% -36%, rgba(255, 247, 213, 0.92), transparent 50%),
        linear-gradient(180deg, #ffe7af 0%, #e8ad59 42%, #b96d2d 74%, #c44d0b 100%) !important;
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

    .wildworks-lead-card[data-box-view="sending"] .wildworks-lead-capture,
    .wildworks-lead-card[data-box-view="sent"] .wildworks-lead-capture {
      display: none !important;
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

    #wildworks-lead-sent {
      display: none !important;
      margin: 0.4rem 0 0 !important;
      color: var(--ww-avatar-button-ink) !important;
      font: 800 1.15rem/1.3 Arial, sans-serif !important;
    }

    #wildworks-lead-sent[data-visible="true"] {
      display: block !important;
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

    @keyframes wildworks-lead-rise {
      from { opacity: 0; transform: translate(-50%, 0.75rem) scale(0.97); }
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
      outline: 2px solid #ffe7af !important;
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
        bottom: calc(1.9rem + env(safe-area-inset-bottom, 0px)) !important;
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
        min-height: 56px !important;
        min-width: 7.5rem !important;
        padding: 0.85rem 1.15rem !important;
        font-size: 1.35rem !important;
        font-weight: 800 !important;
        line-height: 1.1 !important;
        gap: 0.18rem !important;
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
        padding: 1.15rem 1rem !important;
      }

      #wildworks-lead-label-text {
        font-size: 1.3rem !important;
      }

      #wildworks-lead-value {
        min-height: 3.4rem !important;
        font-size: 1.3rem !important;
      }

      #wildworks-lead-confirm {
        min-height: 52px !important;
        font-size: 1.15rem !important;
      }
    }
  </style>
`;

const wildWorksLegalBandScript = `
  <script id="wildworks-avatar-legal-band-script">
    (() => {
      if (window.parent !== window) {
        document.documentElement.setAttribute("data-ww-avatar-embedded", "true");
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
      const startPattern = /^(?:talk to iscott|go live|start|restart iscott)$/i;
      // Release also on the plain-English mic fallback: a mic-refused session
      // continues as text chat, so the cover must lift and show the page.
      const releasePattern = /session ended|avatar app unavailable|try again|failed to|error occurred|microphone isn't available|microphone not available/i;
      // Hard cap: no silent stall may hold the copper cover forever
      // (G's smoke, 2026-08-17: tap -> stall -> cover stuck 30s+).
      const loadingCapMs = 30000;
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
        if (Date.now() - loadingStartedAt > loadingCapMs) {
          endLoading();
          return;
        }
        const visibleText = document.body?.innerText || "";
        if (releasePattern.test(visibleText)) endLoading();
      };

      if (document.documentElement.classList.contains(loadingClass)) beginLoading();
      window.addEventListener("load", syncLoadingState);
      const observer = new MutationObserver(syncLoadingState);
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      // A stalled DOM produces no mutations, so the cap needs its own clock.
      window.setInterval(syncLoadingState, 2000);
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

      const armIdleTimer = () => {
        if (!sessionActive || stopping) return;
        clearIdleTimer();
        idleTimer = window.setTimeout(stopForIdle, idleLimitMs);
      };

      ["pointerdown", "keydown", "touchstart", "input"].forEach((eventName) => {
        document.addEventListener(eventName, armIdleTimer, { capture: true, passive: true });
      });
      window.addEventListener("wildworks:avatar-activity", armIdleTimer);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void stopForIdle();
      });
      window.addEventListener("pagehide", () => {
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

      window.fetch = async (input, init) => {
        const url = requestUrl(input);
        const authorization = requestAuthorization(input, init);
        const response = await originalFetch(input, init);

        if (url.includes("/api/v1/sessions/start") && response.ok) {
          sessionAuthorization = authorization || sessionAuthorization;
          sessionActive = true;
          stopping = false;
          armIdleTimer();
        } else if (url.includes("/api/v1/sessions/stop")) {
          sessionActive = false;
          clearIdleTimer();
        }

        return response;
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
        if (!keepalive && state.nextSyncAt && Date.now() < state.nextSyncAt) return;
        state.syncing = true;
        state.lastSyncAt = Date.now();
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
            });
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

      const observeSession = (sessionInfo) => {
        if (!sessionInfo || sessionInfo.liveAvatarSessionId === state.liveAvatarSessionId) return;
        state.liveAvatarSessionId = sessionInfo.liveAvatarSessionId;
        state.sessionToken = sessionInfo.sessionToken;
        state.nextTimestamp = null;
        storageSet("wildworks.liveAvatarSessionId", state.liveAvatarSessionId);
        document.documentElement.setAttribute("data-ww-talking", "true");
        logEvent("avatar_proxy_session_observed", { liveAvatarSessionId: state.liveAvatarSessionId });

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
      window.fetch = async (input, init) => {
        try {
          const startUrl = typeof input === "string" ? input : input?.url || "";
          if (startUrl.includes("/api/v1/sessions/start")) {
            await new Promise((resolve) => window.setTimeout(resolve, WILDWORKS_START_DELAY_MS));
          }
        } catch {}
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
      window.addEventListener("wildworks:avatar-session-ended", () => {
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

      const markAvatarShell = () => {
        document.documentElement.setAttribute("data-ww-avatar-shell", "true");
        document.body?.setAttribute("data-ww-avatar-shell", "true");
        document.querySelectorAll("video, canvas").forEach((node) => {
          node.setAttribute("data-ww-avatar-video", "true");
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

      const hasSendPermission = (lead) =>
        lead?.consentStatus === "accepted" || Boolean(lead?.contactConfirmedAt);
      const isSendFailureStatus = (notificationStatus) =>
        notificationStatus === "failed" || notificationStatus === "dead_letter";

      const statusFromLead = (lead) => {
        if (!lead) return "I still need a way for Scott to reach you.";
        if (lead.notificationStatus === "failed" || lead.notificationStatus === "dead_letter") {
          return "The send failed. Scott does not have this yet. I will keep the details here.";
        }
        if (lead.notificationStatus === "test_held") return "Test session — not sent.";
        if ((lead.status === "submitted" || lead.submittedAt) && lead.notificationStatus === "sent") {
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
          '      <svg class="ww-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>',
          '      <svg class="ww-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 3h4l1 4-2 1a12 12 0 0 0 6 6l1-2 4 1v4c0 1-1 2-2 2C10 19 5 14 5 7c0-1 1-2 2-2z"/></svg>',
          '    </span><span id="wildworks-lead-label-text">Your Email</span></p>',
          '    <input id="wildworks-lead-value" type="email" autocomplete="email" inputmode="email" spellcheck="false" placeholder="type or spell your email" aria-label="Your email address" aria-labelledby="wildworks-lead-label-text">',
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

      const refreshLeadPosition = () => {
        const panel = document.getElementById("wildworks-lead-confirmation");
        if (!panel || !activeLead || dismissed) return;
        panel.style.removeProperty("--wildworks-lead-top");
        const buttons = document.querySelectorAll("button");
        let finish = null;
        for (const button of buttons) {
          if (/^finish$/i.test((button.textContent || "").trim())) {
            finish = button;
            break;
          }
        }
        const rect = finish && finish.getBoundingClientRect ? finish.getBoundingClientRect() : null;
        if (rect && rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight) {
          const lift = Math.round(window.innerHeight - rect.top + 12);
          panel.style.setProperty("bottom", lift + "px", "important");
        } else {
          panel.style.removeProperty("bottom");
        }
        panel.setAttribute("aria-hidden", "false");
        panel.classList.add("wildworks-lead-visible");
      };

      const hidePanel = () => {
        const panel = document.getElementById("wildworks-lead-confirmation");
        panel?.classList.remove("wildworks-lead-visible");
        panel?.setAttribute("aria-hidden", "true");
      };

      const setCaptureHidden = (hidden) => {
        document.querySelector(".wildworks-lead-capture")?.setAttribute("data-hidden", hidden ? "true" : "false");
      };

      const setSentVisible = (visible, method) => {
        const sent = document.getElementById("wildworks-lead-sent");
        if (!sent) return;
        sent.textContent = method === "phone" ? "Phone sent to Scott ✓" : "Email sent to Scott ✓";
        sent.setAttribute("data-visible", visible ? "true" : "false");
      };

      // G 2026-08-17: after the visitor confirms, show the check mark, then
      // the boxes drop on their own. One-way per session.
      const dropScheduled = {};
      // G 2026-08-17 (all-verbal handoff): a spoken yes IS the send. When the
      // server-detected consent arrives on the lead state, fire the real send
      // once — no tap required. Visitor-typed edits keep the manual button.
      const autoConfirmed = {};
      const dropPanelSoon = (ms) => {
        window.setTimeout(() => {
          dismissed = true;
          hidePanel();
        }, ms);
      };

      const stopSession = async (reason) => {
        logUi(reason === "close" ? "iscott_ui_close_tap" : "iscott_ui_finish_tap", { reason }, true);
        hidePanel();
        dismissed = true;
        if (window.__wildworksAvatarIdleGuard?.stopNowWithoutReload) {
          await window.__wildworksAvatarIdleGuard.stopNowWithoutReload(reason);
          return;
        }
        window.dispatchEvent(new CustomEvent("wildworks:avatar-session-ended", { detail: { reason } }));
      };

      const confirmLead = async () => {
        if (!activeLead || activeLead.status === "submitted" || activeLead.submittedAt) return;
        if (revealingContact) return;
        const method = activeLead.contactMethod === "phone" ? "phone" : "email";
        const edited = document.getElementById("wildworks-lead-value")?.value?.trim();
        const captured = method === "email" ? activeLead.email : activeLead.phone;
        const value = userEditedContact ? edited : captured;
        const button = document.getElementById("wildworks-lead-confirm");
        const status = document.getElementById("wildworks-lead-status");
        if (!value || !button || !status) return;
        button.disabled = true;
        status.textContent = "I'm sending that to Scott.";
        setCaptureHidden(true);
        setSentVisible(false, method);
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
          if (!response.ok || !result?.queued) throw new Error(result?.error || "The send failed. Scott does not have this yet. I will keep the details here.");
          activeLead = result.lead || activeLead;
          const testHeld = result.detail === "test_traffic_not_sent" || result.lead?.notificationStatus === "test_held";
          const delivered = Boolean(result.delivered) && result.lead?.notificationStatus === "sent";
          const failed = isSendFailureStatus(result.lead?.notificationStatus);
          const sendState = testHeld ? "test_held" : delivered ? "notified" : failed ? "failed" : "queued";
          if (testHeld) {
            // G's own sessions are classified test, so the lead is held by
            // design. He never wants the panel to sit there explaining that, so
            // it clears on the same 2s beat as a real send - but it deliberately
            // does NOT show the checkmark, because nothing was actually sent.
            setCaptureHidden(true);
            setSentVisible(false, method);
            status.textContent = "Test session — not sent.";
            dropPanelSoon(2000);
          } else if (failed) {
            setCaptureHidden(false);
            setSentVisible(false, method);
            document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "failed");
            status.textContent = "The send failed. Scott does not have this yet. I will keep the details here.";
            button.disabled = false;
          } else if (delivered) {
            setCaptureHidden(true);
            setSentVisible(true, method);
            document.querySelector(".wildworks-lead-card")?.setAttribute("data-box-view", "sent");
            status.textContent = method === "phone" ? "Phone sent to Scott ✓" : "Email sent to Scott ✓";
            dropPanelSoon(2000);  // G 2026-08-19: hold the checkmark 2s, then drop
          } else {
            setCaptureHidden(true);
            setSentVisible(false, method);
            status.textContent = "Your details are queued for a secure WildWorks handoff.";
            dropPanelSoon(6000);
          }
          document.getElementById("wildworks-lead-confirmation")?.setAttribute("data-handoff-state", sendState);
          logUi("iscott_send_outcome", { sendState, delivered });
          showLead(activeLead);
        } catch (error) {
          setCaptureHidden(false);
          setSentVisible(false, method);
          status.textContent = error instanceof Error ? error.message : "The send failed. Scott does not have this yet. I will keep the details here.";
          button.disabled = false;
          document.getElementById("wildworks-lead-confirmation")?.setAttribute("data-handoff-state", "failed");
          logUi("iscott_send_outcome", { sendState: "failed" });
        }
      };

      const showLead = (lead) => {
        if (!lead) {
          hidePanel();
          activeLead = null;
          return;
        }
        const submitted = lead.status === "submitted" || lead.submittedAt;
        const method = lead.contactMethod === "phone" ? "phone" : lead.contactMethod === "email" ? "email" : lead.email ? "email" : lead.phone ? "phone" : null;
        const value = method === "email" ? lead.email : method === "phone" ? lead.phone : null;
        if (!method) return;
        const key = [lead.sessionId, method, value, lead.status, lead.notificationStatus, lead.consentStatus].join(":");
        if (key === activeKey && !submitted) return;
        activeKey = key;
        activeLead = lead;
        if (dismissed) return;

        const panel = ensurePanel();
        const label = panel.querySelector("#wildworks-lead-label-text");
        const output = panel.querySelector("#wildworks-lead-value");
        const status = panel.querySelector("#wildworks-lead-status");
        const button = panel.querySelector("#wildworks-lead-confirm");
        const dismiss = panel.querySelector("#wildworks-lead-dismiss");
        const close = panel.querySelector("#wildworks-lead-close");
        if (!label || !output || !status || !button) return;

        label.textContent = method === "phone" ? "Your Phone" : "Your Email";
        const icon = panel.querySelector(".wildworks-lead-label-icon");
        if (icon) icon.setAttribute("data-method", method);
        panel.setAttribute("data-contact-method", method);
        output.setAttribute("type", method === "email" ? "email" : "tel");
        output.setAttribute("autocomplete", method === "email" ? "email" : "tel");
        if (!value) {
          revealVersion += 1;
          revealingContact = false;
          if (typingTimer) window.clearInterval(typingTimer);
          typingTimer = null;
          output.value = "";
          output.textContent = "";
          output.placeholder = method === "email" ? "type or spell your email" : "type or say your phone number";
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
        output.readOnly = Boolean(submitted);
        const contactKey = [lead.sessionId, method, value].join(":");
        if (contactKey !== revealedContactKey) {
          revealedContactKey = contactKey;
          userEditedContact = false;
        }
        const permitted = hasSendPermission(lead) || userEditedContact;
        const delivered = lead.notificationStatus === "sent";
        const failed = isSendFailureStatus(lead.notificationStatus);
        button.hidden = Boolean(submitted) || !permitted || delivered;
        button.disabled = Boolean(submitted) || !permitted || delivered;
        const spoken = panel.querySelector("#wildworks-lead-spoken-readback");
        if (spoken) spoken.textContent = typeof lead.spokenReadback === "string" ? lead.spokenReadback : "";
        if (delivered) {
          setCaptureHidden(true);
          setSentVisible(true, method);
          if (!dropScheduled[contactKey]) {
            dropScheduled[contactKey] = true;
            dropPanelSoon(2000);  // G 2026-08-19: same 2s beat on the typed path
          }
        } else if (submitted && !failed) {
          setCaptureHidden(true);
          setSentVisible(false, method);
        } else {
          setCaptureHidden(false);
          setSentVisible(false, method);
          revealCapturedContact(output, visible);
        }
        status.textContent = delivered
          ? (method === "phone" ? "Phone sent to Scott ✓" : "Email sent to Scott ✓")
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
          lead.notificationStatus === "sent" ? "notified" : submitted ? "queued" : "awaiting",
        );
        panel.setAttribute(
          "data-ui-state",
          delivered ? "sent" : failed ? "failed" : submitted ? "pending" : "captured",
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
        event.preventDefault();
        void stopSession("finish");
      }, true);

      window.addEventListener("wildworks:lead-state", (event) => showLead(event.detail));
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
    .replace(/<script\b/i, `${wildWorksMicrophoneSafetyScript}<script`)
    .replaceAll("/_next/", LOCAL_AVATAR_ASSET_PREFIX)
    .replaceAll("/favicon.ico", `${REMOTE_AVATAR_ORIGIN}/favicon.ico`)
    .replaceAll("/startscreen.png", "/Avatar1-live-startscreen.png")
    .replace("</head>", `${wildWorksButtonCss}${wildWorksLoadingBootstrapScript}</head>`)
    .replace(
      "</body>",
      `${wildWorksLoadingGateScript}${wildWorksStartScreenScript}${wildWorksIdleTimeoutScript}${wildWorksCaptureBridgeScript}${wildWorksLeadConfirmationScript}${wildWorksGalleryBridgeScript}${wildWorksSessionEndedScript}${wildWorksLegalBandScript}${shouldWake ? wildWorksAutoWakeScript : ""}</body>`,
    );

  return new Response(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    },
  });
}
