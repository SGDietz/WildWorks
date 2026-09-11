import { Phone } from "lucide-react";

export default function SubpageCallCta() {
  return (
    <div className="wild-subpage-iscott-cta">
      <a
        href="tel:+18552532727"
        aria-label="Call WildWorks at 855-253-2727"
        className="money-cta money-cta--primary"
      >
        <Phone aria-hidden className="h-5 w-5" />
        <span>Call Now</span>
      </a>
    </div>
  );
}
