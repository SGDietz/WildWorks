import { Phone } from "lucide-react";

export default function SubpageCallCta() {
  return (
    <div className="wild-subpage-iscott-cta">
      <a
        href="tel:+14437972166"
        aria-label="Call WildWorks at 1+443 797 2166"
        className="money-cta money-cta--primary"
      >
        <Phone aria-hidden className="h-5 w-5" />
        <span>Call Now</span>
      </a>
    </div>
  );
}
