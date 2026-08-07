import type { CSSProperties } from "react";

type PhoneNumberLineProps = {
  className?: string;
  callText?: string;
  emphasizeCallText?: boolean;
  showCallToday?: boolean;
};

// The sitewide rule resolves this variable inside its !important text-shadow.
// Set it locally so the phone lettering uses the identical depth recipe as
// the approved "iScott is the Front Door" title.
const iScottDepthEffect = {
  "--ww-home-copy-text-effect": "var(--ww-home-wordmark-text-effect)",
} as CSSProperties;

export default function PhoneNumberLine({
  className = "",
  callText = "Call WildWorks Today!",
  emphasizeCallText = false,
  showCallToday = true,
}: PhoneNumberLineProps) {
  return (
    <div className={`wild-phone-number-line ${className}`.trim()}>
      <a
        href="tel:+18776002474"
        aria-label="Call WildWorks at 1-877-600-2474"
        style={iScottDepthEffect}
      >
        1+877-600-2474
      </a>
      {showCallToday ? (
        <span
          className={`wild-phone-number-line__call-today${emphasizeCallText ? " wild-phone-number-line__call-today--emphasis" : ""}`}
          style={iScottDepthEffect}
        >
          {callText}
        </span>
      ) : null}
    </div>
  );
}
