import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import BrandText from "./BrandText";

// Restored footer iScott panel (G `doit`, 2026-08-17): the full framed
// presentation from Home's mid-page panel, at rest — kicker, title, resting
// image, gold Talk control, disclosure. The Talk control follows the
// established click-to-wake route; no provider session starts on page load.
export default function FooterIScottPanel() {
  return (
    <div className="money-panel wild-iscott-panel wild-iscott-panel--footer mx-auto w-full max-w-[26rem]">
      <p className="money-panel-kicker">
        <BrandText>WildWorks Concierge</BrandText>
      </p>
      <h2 className="wild-start-title" aria-label="Start with iScott">
        <span className="wild-start-title__start">Start</span>{" "}
        <span className="wild-start-title__with">with</span>{" "}
        <span className="wild-start-title__name">iScott</span>
      </h2>
      <div className="mx-auto flex w-full justify-center px-2 py-3 sm:px-4">
        <div className="wild-live-avatar-frame relative aspect-[9/16] w-full max-w-[20rem] min-h-[300px] overflow-hidden rounded-lg">
          <Image
            src="/Avatar1-live-startscreen.png"
            alt="iScott"
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
          <a
            href="/pages/Home?wake-iscott=1#talk-to-iscott"
            className="money-cta money-cta--primary wild-site-avatar-overlay-cta"
            aria-label="Talk to iScott"
            style={{ pointerEvents: "auto", bottom: "22%" }}
          >
            <Sparkles aria-hidden className="h-5 w-5" />
            <span>Talk to iScott</span>
          </a>
        </div>
      </div>
      <p className="wild-iscott-disclosure mt-3 text-center text-xs font-semibold leading-relaxed">
        By talking to iScott or uploading media, you agree WildWorks may save
        the conversation and media to organize your inquiry and follow up. Do
        not share sensitive personal, legal, medical, or child information.
        See{" "}
        <Link href="/pages/privacy-policy" className="underline decoration-[#fce0ad] underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
