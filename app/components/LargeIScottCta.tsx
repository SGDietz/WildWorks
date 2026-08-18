import type { MouseEventHandler } from "react";
import { Sparkles } from "lucide-react";

type LargeIScottCtaProps = {
  className?: string;
  href?: string;
  label?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function LargeIScottCta({
  className = "",
  href = "#talk-to-iscott",
  label = "Talk to iScott",
  onClick,
}: LargeIScottCtaProps) {
  return (
    <div className={`wild-home-phone-iscott-test${className ? ` ${className}` : ""}`}>
      <a
        href={href}
        className="wild-home-phone-iscott-test__button"
        onClick={onClick}
        aria-label={label}
      >
        <Sparkles aria-hidden />
        <span>{label}</span>
      </a>
    </div>
  );
}
