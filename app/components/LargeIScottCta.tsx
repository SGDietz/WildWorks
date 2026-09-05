"use client";

import TalkArcClusterIcon from "./TalkArcClusterIcon";
import { useLayoutEffect, useRef, type MouseEventHandler } from "react";

type LargeIScottCtaProps = {
  className?: string;
  href?: string;
  label?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  referenceIcon?: boolean;
};

export default function LargeIScottCta({
  className = "",
  href = "#talk-to-iscott",
  label = "Talk to iScott",
  onClick,
}: LargeIScottCtaProps) {
  const buttonRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button || label !== "Talk to iScott") return;
    const setScale = (width: number) => {
      button.style.setProperty("--ww-iscott-clone-scale", String(width / 339.015625));
    };
    setScale(parseFloat(getComputedStyle(button).width));
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width));
    observer.observe(button);
    return () => observer.disconnect();
  }, [label]);

  return (
    <div className={`wild-home-phone-iscott-test${className ? ` ${className}` : ""}`}>
      <a
        ref={buttonRef}
        href={href}
        className={`wild-home-phone-iscott-test__button${label === "Talk to iScott" ? " wild-large-iscott-talk" : ""}`}
        onClick={onClick}
        aria-label={label}
      >
        {label === "Talk to iScott" ? (
          <span className="wild-iscott-clone-surface" aria-hidden="true">
            <TalkArcClusterIcon />
            <span className="wild-iscott-clone-label">{label}</span>
          </span>
        ) : (
          <>
            <TalkArcClusterIcon />
            <span>{label}</span>
          </>
        )}
      </a>
    </div>
  );
}
