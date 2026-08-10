import type { CSSProperties } from "react";

type PhoneNumberLineProps = {
  className?: string;
  callText?: string;
  desktopCallText?: string;
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
  desktopCallText,
  emphasizeCallText = false,
  showCallToday = true,
}: PhoneNumberLineProps) {
  return (
    <div className={`wild-phone-number-line ${className}`.trim()}>
      <a
        href="tel:+14437972166"
        aria-label="Call WildWorks at 1+443-797-2166"
        style={iScottDepthEffect}
      >
        1+443-797-2166
      </a>
      {showCallToday ? (
        desktopCallText ? (
          <>
            <span
              className={`wild-phone-number-line__call-today wild-phone-number-line__call-today--desktop${emphasizeCallText ? " wild-phone-number-line__call-today--emphasis" : ""}`}
              style={iScottDepthEffect}
            >
              {desktopCallText}
            </span>
            <span
              className={`wild-phone-number-line__call-today wild-phone-number-line__call-today--mobile${emphasizeCallText ? " wild-phone-number-line__call-today--emphasis" : ""}`}
              style={iScottDepthEffect}
            >
              {callText}
            </span>
          </>
        ) : (
          <span
            className={`wild-phone-number-line__call-today${emphasizeCallText ? " wild-phone-number-line__call-today--emphasis" : ""}`}
            style={iScottDepthEffect}
          >
            {callText}
          </span>
        )
      ) : null}
    </div>
  );
}
