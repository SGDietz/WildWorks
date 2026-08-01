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
    <footer id="footer" className="bg-transparent text-[#f7d9a5] max-[450px]:pb-16 mt-6 discordSection discordSection--2">
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
        className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12"
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
          <motion.p className="wild-footer-contact-cta__kicker" variants={fadeInUp}>
            Your Project Starts Here
          </motion.p>
          <motion.h2 className="wild-footer-contact-cta__title" variants={fadeInUp}>
            Let&apos;s Talk About Your Space.
          </motion.h2>
          <motion.p className="wild-footer-contact-cta__copy" variants={fadeInUp}>
            Talk to iScott or Scott About What You Dream of Having.
          </motion.p>
          <motion.p className="wild-footer-contact-cta__prompt" variants={fadeInUp}>
            Start the Conversation Now
          </motion.p>
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
              <span>Text Scott</span>
            </motion.a>
            <motion.a href="mailto:Wildworks@pm.me" className="money-cta money-cta--primary" whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Mail aria-hidden className="h-5 w-5" />
              <span>Email Scott</span>
            </motion.a>
            <motion.a
              href="https://api.whatsapp.com/send?phone=18776002474"
              aria-label="DM Scott on WhatsApp"
              className="money-cta money-cta--primary"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span>DM Scott on WhatsApp</span>
            </motion.a>
            <motion.a
              href="https://x.com/WildWorksArt"
              aria-label="DM Scott on X"
              className="money-cta money-cta--primary"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>DM Scott on X</span>
            </motion.a>
          </motion.div>
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
          <p className="wild-footer-business-identity">
            WildWorks.ai is a Wyoming-registered trade name of DietzX LLC.
          </p>
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
            href="tel:+18776002474"
            className={mobileBrandLink}
            aria-label="Call WildWorks at 1-877-600-2474"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="sr-only">Phone</span>
          </motion.a>
          <motion.a
            href="mailto:Wildworks@pm.me"
            className={mobileBrandLink}
            aria-label="Email"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="sr-only">Email</span>
          </motion.a>
          <motion.a
            href="https://api.whatsapp.com/send?phone=18776002474"
            className={mobileBrandLink}
            aria-label="WhatsApp"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span className="sr-only">WhatsApp</span>
          </motion.a>
          <motion.a
            href="https://x.com/WildWorksArt"
            className={mobileBrandLink}
            aria-label="X (Twitter)"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="sr-only">X</span>
          </motion.a>
        </div>
      </div>
    </footer>
  );
}
