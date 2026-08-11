import type { MouseEventHandler } from "react";
import { Sparkles } from "lucide-react";

type LargeIScottCtaProps = {
  className?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function LargeIScottCta({
  className = "",
  href = "#talk-to-iscott",
  onClick,
}: LargeIScottCtaProps) {
  return (
    <div className={`wild-home-phone-iscott-test${className ? ` ${className}` : ""}`}>
      <a
        href={href}
        className="wild-home-phone-iscott-test__button"
        onClick={onClick}
        aria-label="Talk to iScott"
      >
        <Sparkles aria-hidden />
        <span>Talk to iScott</span>
      </a>
    </div>
  );
}
