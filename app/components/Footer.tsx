"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, type CSSProperties, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquareText, Phone, Send } from "lucide-react";
import TalkArcClusterIcon from "./TalkArcClusterIcon";
import BrandText from "./BrandText";
import PhoneNumberLine from "./PhoneNumberLine";
import { SIGNUP_CHANNEL_OPTIONS } from "../../src/lib/marketingConsent.mjs";
import LargeIScottCta from "./LargeIScottCta";
import FooterIScottPanel from "./FooterIScottPanel";
import { isLegalRoute, legalNavItems } from "../lib/legalRoutes";
import { mainNavigationTabs, normalizeMainNavigationPath } from "../lib/mainNavigation";
import {
  FOOTER_STONEWORK_LINE_END,
  FOOTER_STONEWORK_LINE_START,
} from "../lib/wildworksCopy";

const SCROLL_THRESHOLD = 80;

const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const viewportReplay = { once: true, amount: 0.2 };
type SignupChannel = "email" | "sms" | "both";

// The shared footer is intentionally one step quieter than the primary page
// actions. Keeping the override on the footer scopes the material to every
// route without changing the buttons G already approved elsewhere.
const footerButtonTone = {
  "--ww-approved-button-material":
    "radial-gradient(circle at 50% -42%, rgba(255, 239, 198, 0.48), transparent 52%), linear-gradient(180deg, #f0ca86 0%, #d89a4d 42%, #aa602d 74%, #7c3114 100%)",
  "--ww-button-gradient": "var(--ww-approved-button-material)",
  "--ww-button-gradient-primary": "var(--ww-approved-button-material)",
  "--ww-home-talk-exact-gold": "var(--ww-approved-button-material)",
  "--ww-home-original-spirit-button": "var(--ww-approved-button-material)",
  "--ww-original-spirit-button": "var(--ww-approved-button-material)",
  "--ww-footer-button-sample": "var(--ww-approved-button-material)",
  "--ww-legal-original-spirit-button": "var(--ww-approved-button-material)",
} as CSSProperties;

export default function Footer() {
  const pathname = usePathname();
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [signupChannel, setSignupChannel] = useState<SignupChannel>("email");
  const [signupStatus, setSignupStatus] = useState("");
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const lastScrollY = useRef(0);
  const mobileBrandLink = "wild-footer-mobile-link";
  const usesAbFooter = ["/pages/The-ruins", "/pages/who-is-g"].includes(pathname);
  const isLegalPage = isLegalRoute(pathname);
  const isSixPageLegalRoute = legalNavItems.some((item) => item.href === pathname);
  // G 2026-08-18: the closing iScott block goes on all five main pages, not
  // just Home. Driven off mainNavigationTabs so the nav, the swipe order and
  // this block can never drift apart. normalize maps "/" onto /pages/Home.
  const isMainNavigationPage = mainNavigationTabs.some(
    (tab) => tab.href === normalizeMainNavigationPath(pathname),
  );
  const requiresEmail = signupChannel === "email" || signupChannel === "both";
  const requiresPhone = signupChannel === "sms" || signupChannel === "both";

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // G 2026-08-18: only Email and SMS are offered. "both" is retired from the UI
  // but still accepted by /api/marketing-signups so a stale tab keeps working.
  const signupOptions: Array<{
    id: SignupChannel;
    label: string;
    icon: typeof Mail;
  }> = SIGNUP_CHANNEL_OPTIONS.map(({ id, label }) => ({
    id: id as SignupChannel,
    label,
    icon: id === "email" ? Mail : MessageSquareText,
  }));

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    setIsSignupSubmitting(true);
    setSignupStatus("");

    try {
      const formData = new FormData(form);
      const response = await fetch("/api/marketing-signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: signupChannel,
          email: formData.get("email"),
          phone: formData.get("phone"),
          consentServiceUpdates: formData.get("consentServiceUpdates") === "on",
          consentMarketing: formData.get("consentMarketing") === "on",
          companyWebsite: formData.get("companyWebsite"),
          sourcePath: window.location.pathname,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        setSignupStatus(result.error ?? "We could not complete your signup. Please try again or contact Scott directly below.");
        return;
      }

      form.reset();
      setSignupStatus(result.message ?? "You’re signed up. Please check your inbox or phone for confirmation.");
    } catch {
      setSignupStatus("We could not reach the signup service. Please try again or contact Scott directly below.");
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY ?? document.documentElement.scrollTop;
      if (y > lastScrollY.current && y > SCROLL_THRESHOLD) {
        setShowMobileBar(true);
      } else if (y < lastScrollY.current) {
        setShowMobileBar(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The six detail legal routes retain only the standard copyright and legal
  // navigation. Marketing, contact, iScott and mobile-contact UI stays absent.
  if (isSixPageLegalRoute) {
    return (
      <footer id="footer" className="wild-footer--legal wild-footer--legal-minimal">
        <div
          className="wild-footer-closing mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 px-4 py-2 text-center text-sm text-[#fce0ad] sm:px-6"
          style={{ width: "100%", maxWidth: "none" }}
        >
          <span
            className="wild-legal-minimal-copyright"
            style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
          >
            &copy;2026 <BrandText>WildWorks</BrandText>. All Rights Reserved.
          </span>
        </div>
        <div className="wild-footer-legal-row mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-2 text-center text-sm text-[#fce0ad] sm:flex-row sm:px-6 sm:text-left">
          <span className="wild-footer-legal-links flex flex-wrap justify-center gap-x-3 gap-y-2 sm:text-sm">
            {legalNavItems.map((item) => (
              <Link key={item.href} href={item.href} className="wild-legal-minimal-link">
                {item.label}
              </Link>
            ))}
          </span>
        </div>
      </footer>
    );
  }

  return (
    <footer
      id="footer"
      className={`bg-transparent text-[#fce0ad] max-[450px]:pb-16 mt-6 discordSection discordSection--2${pathname === "/pages/who-is-g" ? " wild-footer--bio" : ""}${isLegalPage ? " wild-footer--legal" : ""}`}
      style={footerButtonTone}
    >
      <style>{`
        body .wild-footer-mobile-strip.wild-footer-mobile-strip {
          border-top-color: rgba(252, 224, 173, 0.5) !important;
          background: linear-gradient(180deg, #e96819, #c44d0b) !important;
          color: #fce0ad !important;
          -webkit-text-fill-color: #fce0ad !important;
          box-shadow: 0 -8px 24px rgba(89, 31, 6, 0.22) !important;
        }

        body .wild-footer-mobile-strip .wild-footer-mobile-strip-inner {
          background: radial-gradient(ellipse at 50% 0%, rgba(252, 224, 173, 0.2), transparent 72%) !important;
        }

        body .wild-footer-mobile-strip .wild-footer-mobile-link.wild-footer-mobile-link {
          border-color: rgba(252, 224, 173, 0.72) !important;
          background:
            radial-gradient(circle at 34% 24%, rgba(252, 224, 173, 0.34), transparent 48%),
            linear-gradient(180deg, #fce0ad 0%, #edc775 55%, #e96819 100%) !important;
          /* Grok's patch put cream ink here too, but this button's background
             is now the LIGHT cream->gold ramp above - cream on cream is
             invisible. Primary ink, same as every other light button. */
          color: #c44d0b !important;
          -webkit-text-fill-color: #c44d0b !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 238, 194, 0.5),
            0 4px 12px rgba(92, 31, 6, 0.2) !important;
        }
      `}</style>
      <motion.div
        className="wild-footer-main mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12"
        variants={stagger}
        initial="initial"
        whileInView="animate"
        viewport={viewportReplay}
      >
        <div className="wild-signup-system">
          <div className="wild-signup-panel">
            <motion.h3
              className="wild-signup-title"
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
              variants={fadeInUp}
            >
              Sign Up for Email or SMS
            </motion.h3>
            <motion.form
              className="wild-signup-form"
              variants={fadeInUp}
              onSubmit={handleSignupSubmit}
            >
              <fieldset className="wild-signup-choice" aria-label="Choose email or SMS">
                {signupOptions.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`wild-signup-choice-button${signupChannel === id ? " is-active" : ""}`}
                    aria-pressed={signupChannel === id}
                    onClick={() => {
                      setSignupChannel(id);
                      setSignupStatus("");
                    }}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </fieldset>

              <div className="wild-signup-fields">
                <label className="sr-only" aria-hidden="true">
                  Company website
                  <input
                    type="text"
                    name="companyWebsite"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
                {requiresEmail ? (
                  <label className="wild-signup-field">
                    <span>
                      Email Address
                    </span>
                    <input
                      type="email"
                      name="email"
                      required={requiresEmail}
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </label>
                ) : null}

                {requiresPhone ? (
                  <label className="wild-signup-field">
                    <span>
                      Mobile Number
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      required={requiresPhone}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="Your mobile number"
                    />
                  </label>
                ) : null}
              </div>

              <label className="wild-signup-consent">
                <input type="checkbox" name="consentServiceUpdates" />
                <span>
                  Optional: send me non-marketing service messages about project follow-up, scheduling,
                  reminders, and service updates at the contact information provided.
                </span>
              </label>

              <label className="wild-signup-consent">
                <input type="checkbox" name="consentMarketing" />
                <span>
                  Optional: send me WildWorks marketing messages about design ideas, offers, and news at the
                  contact information provided.
                </span>
              </label>

              <p className="wild-signup-consent wild-signup-consent--disclosure">
                <span>
                  Both boxes are optional and neither is required to submit this form. If you tick a box and
                  select SMS, WildWorks may send recurring text messages to the mobile number provided.
                  Message frequency varies. Message and data rates may apply. Reply HELP for help and STOP to
                  opt out. Consent is not a condition of purchase.
                </span>
              </p>

              <div className="wild-signup-action-row">
                <motion.button
                  type="submit"
                  className="money-cta money-cta--primary wild-signup-submit"
                  disabled={isSignupSubmitting}
                  aria-busy={isSignupSubmitting}
                  style={{
                    fontFamily: "var(--font-geist-sans), sans-serif",
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Send aria-hidden className="h-4 w-4" />
                  <span>{isSignupSubmitting ? "Signing You Up…" : "Join the List"}</span>
                </motion.button>
              </div>

              {signupStatus ? (
                <p className="wild-signup-status" role="status" aria-live="polite">
                  {signupStatus}
                </p>
              ) : null}

              <p className="wild-signup-fine-print">
                You can unsubscribe from emails at any time and opt out of texts by replying STOP
                where supported. See the{" "}
                <Link href="/pages/terms-of-service" className="underline decoration-[#edc775] underline-offset-4 hover:text-[#fce0ad]">
                  Terms of Service
                </Link>
                ,{" "}
                <Link href="/pages/privacy-policy" className="underline decoration-[#edc775] underline-offset-4 hover:text-[#fce0ad]">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/pages/communications" className="underline decoration-[#edc775] underline-offset-4 hover:text-[#fce0ad]">
                  Communications Policy
                </Link>
                .
              </p>
            </motion.form>
          </div>
        </div>

        <div
          className={`wild-footer-contact-card-region${usesAbFooter ? " wild-footer-contact-card-region--a" : ""}`}
        >
        {isSixPageLegalRoute ? (
          <LargeIScottCta
            className="wild-home-phone-iscott-test--legal-return"
            href="/pages/Home"
            label="Return to WildWorks"
          />
        ) : null}
        <div className="wild-footer-contact-cta mt-12 sm:mt-16">
          <motion.h2
            className="wild-footer-contact-cta__title"
            variants={fadeInUp}
            style={{ marginTop: 0, whiteSpace: "normal" }}
          >
            Let&apos;s Talk About Your Dream Project
          </motion.h2>
          <motion.div className="wild-footer-contact-cta__actions" variants={fadeInUp}>
            <motion.a href="/pages/Home?wake-iscott=1#talk-to-iscott" className="money-cta money-cta--primary" aria-label="Start with iScott" data-iscott-start-cta="" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <TalkArcClusterIcon />
              <span>Start with iScott</span>
            </motion.a>
            <motion.a href="tel:+14437972166" aria-label="Call WildWorks at 1+443 797 2166" className="money-cta money-cta--primary" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Phone aria-hidden className="h-5 w-5" />
              <span>Call Now</span>
            </motion.a>
            <motion.a href="sms:+14437972166" className="money-cta money-cta--primary" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <MessageSquareText aria-hidden className="h-5 w-5" />
              <span>Text Now</span>
            </motion.a>
            <motion.a href="mailto:hello@wildworks.ai" className="money-cta money-cta--primary" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Mail aria-hidden className="h-5 w-5" />
              <span>Email Now</span>
            </motion.a>
          </motion.div>
          <motion.p
            className="wild-footer-contact-cta__kicker"
            variants={fadeInUp}
            style={{ marginTop: "1.35rem", whiteSpace: "normal" }}
          >
            <span className="wild-footer-contact-cta__kicker-line">Start the</span>{" "}
            <span className="wild-footer-contact-cta__kicker-line">Conversation Now</span>
          </motion.p>
        </div>
        </div>
      </motion.div>

      {/* Copyright bar - left and right */}
      <motion.div
        className={`wild-footer-final-region${usesAbFooter ? " wild-footer-closing-region--a" : ""}`}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.5 }}
      >
        <div className="wild-footer-phone-iscott-group">
          {/* G `doit` 2026-08-17: full framed iScott panel replaces the lone
              closing Talk button — Home first, other main pages after tweaks.
              G 2026-08-18: "exactly like that" on all five — the tweaks landed. */}
          {isMainNavigationPage ? (
            <>
              <FooterIScottPanel />
              {/* G 2026-08-17: the big Talk button rides under the panel too —
                  one more push toward iScott. */}
              <LargeIScottCta
                className="wild-home-phone-iscott-test--footer-closing"
                href="/pages/Home?wake-iscott=1#talk-to-iscott"
                label="Start with iScott"
              />
            </>
          ) : (
            <LargeIScottCta
              className="wild-home-phone-iscott-test--footer-closing"
              href="/pages/Home?wake-iscott=1#talk-to-iscott"
            />
          )}
          {isMainNavigationPage ? (
            /* G 2026-08-17: under the footer panel — "OR Call WildWorks
               Today!" first, phone number underneath. */
            <PhoneNumberLine
              className="wild-phone-number-line--footer-closing"
              callText="Or Call Today!"
              desktopCallText="Or Call WildWorks Today!"
              emphasizeCallText
              callTextFirst
            />
          ) : (
            <PhoneNumberLine
              className={`wild-phone-number-line--footer-closing${isLegalPage ? " wild-phone-number-line--legal" : ""}`}
              callText="Call Today!"
              desktopCallText="Call WildWorks Today!"
              emphasizeCallText
            />
          )}
        </div>
          <div
            className="wild-footer-closing mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 px-4 py-2 text-center text-sm text-[#edc775] sm:px-6"
            style={{ width: "100%", maxWidth: "none" }}
          >
          <motion.button
            type="button"
            aria-label="Back to top"
            className="wild-footer-top-button wild-footer-top-button--closing"
            style={{ width: "4.125rem", height: "4.125rem", flex: "0 0 4.125rem" }}
            onClick={scrollToTop}
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              aria-hidden
              className="wild-footer-double-rise"
              viewBox="0 0 80 80"
              fill="none"
              style={{ width: "100%", height: "100%" }}
            >
              <path
                className="wild-footer-double-rise__stripes"
                d="M23 41 40 24l17 17M23 54l17-17 17 17"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
          <p className="wild-footer-stonework-note">
            <span>{FOOTER_STONEWORK_LINE_START}</span>{" "}
            <span className="wild-footer-stonework-note__second-line">
              {FOOTER_STONEWORK_LINE_END}
            </span>
          </p>
          <a
            className="wild-footer-aiasap-link"
            href="https://aiasap.ai/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {"Discover What’s Possible With "}
            <span className="wild-footer-aiasap-wordmark">aiASAP</span>
          </a>
          <span
            className="wild-footer-copyright"
            style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
          >
            &copy;2026 <BrandText>WildWorks</BrandText>. All Rights Reserved.
          </span>
        </div>

          <div className="wild-footer-legal-row mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 py-2 text-center text-sm text-[#edc775] sm:flex-row sm:px-6 sm:text-left">
          <span className="wild-footer-legal-links flex flex-wrap justify-center gap-x-3 gap-y-2 sm:text-sm">
            {legalNavItems.map((item) => (
              <Link key={item.href} href={item.href} className="wild-footer-legal-link">
                {item.label}
              </Link>
            ))}
          </span>
        </div>
      </motion.div>

      {/* Mobile-only contact strip: visible when width < 450px; shows on scroll down, hides on scroll up */}
      <div
        className="wild-footer-mobile-strip fixed bottom-0 left-0 right-0 z-50 hidden max-[450px]:block transition-transform duration-300 ease-out"
        style={{ transform: showMobileBar ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="wild-footer-mobile-strip-inner flex items-center justify-around px-2 py-4">
          <motion.a
            href="tel:+14437972166"
            className={mobileBrandLink}
            aria-label="Call Now"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Phone aria-hidden className="h-6 w-6" />
            <span className="sr-only">Call Now</span>
          </motion.a>
          <motion.a
            href="mailto:hello@wildworks.ai"
            className={mobileBrandLink}
            aria-label="Email Now"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Mail aria-hidden className="h-6 w-6" />
            <span className="sr-only">Email Now</span>
          </motion.a>
          <motion.a
            href="sms:+14437972166"
            className={mobileBrandLink}
            aria-label="Text Now"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageSquareText aria-hidden className="h-6 w-6" />
            <span className="sr-only">Text Now</span>
          </motion.a>
        </div>
      </div>
    </footer>
  );
}
