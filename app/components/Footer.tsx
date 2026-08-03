"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowUp, CheckCircle2, Mail, MessageSquareText, Phone, Send, Sparkles } from "lucide-react";
import BrandText from "./BrandText";
import { isLegalRoute, legalNavItems } from "../lib/legalRoutes";

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

export default function Footer() {
  const pathname = usePathname();
  const [showMobileBar, setShowMobileBar] = useState(false);
  const [signupChannel, setSignupChannel] = useState<SignupChannel>("email");
  const [signupStatus, setSignupStatus] = useState("");
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const lastScrollY = useRef(0);
  const mobileBrandLink = "wild-footer-mobile-link";
  const requiresEmail = signupChannel === "email" || signupChannel === "both";
  const requiresPhone = signupChannel === "sms" || signupChannel === "both";

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signupOptions: Array<{
    id: SignupChannel;
    label: string;
    icon: typeof Mail;
  }> = [
    { id: "email", label: "Email", icon: Mail },
    { id: "sms", label: "SMS", icon: MessageSquareText },
    { id: "both", label: "Both", icon: CheckCircle2 },
  ];

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
          consent: formData.get("consent") === "on",
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

  return (
    <footer
      id="footer"
      className={`bg-transparent text-[#f7d9a5] max-[450px]:pb-16 mt-6 discordSection discordSection--2${pathname === "/pages/who-is-g" ? " wild-footer--bio" : ""}`}
    >
      <style>{`
        body .wild-footer-mobile-strip.wild-footer-mobile-strip {
          border-top-color: rgba(247, 217, 165, 0.5) !important;
          background: linear-gradient(180deg, rgba(203, 98, 45, 0.98), rgba(174, 67, 27, 0.98)) !important;
          color: #a94f24 !important;
          -webkit-text-fill-color: #a94f24 !important;
          box-shadow: 0 -8px 24px rgba(89, 31, 6, 0.22) !important;
        }

        body .wild-footer-mobile-strip .wild-footer-mobile-strip-inner {
          background: radial-gradient(ellipse at 50% 0%, rgba(255, 202, 124, 0.2), transparent 72%) !important;
        }

        body .wild-footer-mobile-strip .wild-footer-mobile-link.wild-footer-mobile-link {
          border-color: rgba(247, 217, 165, 0.72) !important;
          background:
            radial-gradient(circle at 34% 24%, rgba(255, 232, 178, 0.34), transparent 48%),
            linear-gradient(180deg, #eaa15e 0%, #d76f35 55%, #c15426 100%) !important;
          color: #a94f24 !important;
          -webkit-text-fill-color: #a94f24 !important;
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
              <fieldset className="wild-signup-choice" aria-label="Choose email, SMS, or both">
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
                      Email Address <strong>*</strong>
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
                      Mobile Number <strong>*</strong>
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
                <input type="checkbox" name="consent" required />
                <span>
                  I agree to receive the WildWorks updates I selected. If I select SMS or Both, WildWorks may
                  send recurring text messages about project follow-up, scheduling, reminders, design ideas,
                  offers, and service updates to the mobile number provided. Message frequency varies. Message
                  and data rates may apply. Reply HELP for help and STOP to opt out. Consent is not a condition
                  of purchase.
                </span>
              </label>

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
                <Link href="/pages/terms-of-service" className="underline decoration-[#e8b66d] underline-offset-4 hover:text-[#f7d9a5]">
                  Terms of Service
                </Link>
                ,{" "}
                <Link href="/pages/privacy-policy" className="underline decoration-[#e8b66d] underline-offset-4 hover:text-[#f7d9a5]">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/pages/communications" className="underline decoration-[#e8b66d] underline-offset-4 hover:text-[#f7d9a5]">
                  Communications Policy
                </Link>
                .
              </p>
            </motion.form>
          </div>
        </div>

        <div className="wild-footer-contact-cta mt-12 sm:mt-16">
          <motion.h2
            className="wild-footer-contact-cta__title"
            variants={fadeInUp}
            style={{ marginTop: 0, whiteSpace: "normal" }}
          >
            Let&apos;s Talk About Your Dream Project.
          </motion.h2>
          <motion.div className="wild-footer-contact-cta__actions" variants={fadeInUp}>
            <motion.a href="/pages/Home#talk-to-iscott" className="money-cta money-cta--primary" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Sparkles aria-hidden className="h-5 w-5" />
              <span>Talk to iScott</span>
            </motion.a>
            <motion.a href="tel:+18776002474" aria-label="Call WildWorks at 1-877-600-2474" className="money-cta money-cta--primary" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Phone aria-hidden className="h-5 w-5" />
              <span>Call Now</span>
            </motion.a>
            <motion.a href="sms:+18776002474" className="money-cta money-cta--primary" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
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
            style={{ marginTop: "1.15rem", whiteSpace: "normal" }}
          >
            Start the Conversation Now
          </motion.p>
        </div>
      </motion.div>

      {/* Copyright bar - left and right */}
      <motion.div
        className=""
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportReplay}
        transition={{ duration: 0.5 }}
      >
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 px-4 py-2 text-center text-sm text-[#e8b66d] sm:px-6">
          <motion.button
            type="button"
            aria-label="Back to top"
            className="wild-footer-top-button wild-footer-top-button--closing"
            onClick={scrollToTop}
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowUp aria-hidden className="h-5 w-5" />
          </motion.button>
          {!isLegalRoute(pathname) ? (
            <p className="wild-footer-stonework-note">
              All Stonework on This Site Was Created by WildWorks, Not AI-Generated.
            </p>
          ) : null}
          <span
            style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
          >
            &copy; 2026 <BrandText>WildWorks</BrandText>. All Rights Reserved.
          </span>
        </div>

          <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2  px-4 py-2 text-center text-sm text-[#e8b66d] sm:flex-row sm:px-6 sm:text-left">
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
            href="/pages/Home#talk-to-iscott"
            className={mobileBrandLink}
            aria-label="Talk to iScott"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles aria-hidden className="h-6 w-6" />
            <span className="sr-only">Talk to iScott</span>
          </motion.a>
          <motion.a
            href="tel:+18776002474"
            className={mobileBrandLink}
            aria-label="Call Now"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Phone aria-hidden className="h-6 w-6" />
            <span className="sr-only">Call Now</span>
          </motion.a>
          <motion.a
            href="sms:+18776002474"
            className={mobileBrandLink}
            aria-label="Text Now"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageSquareText aria-hidden className="h-6 w-6" />
            <span className="sr-only">Text Now</span>
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
        </div>
      </div>
    </footer>
  );
}
