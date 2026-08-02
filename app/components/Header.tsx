"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { isLegalRoute } from "../lib/legalRoutes";

const showInspirationSubpage = false;

const navTabs = [
  { label: "HOME", href: "/pages/Home" },
  { label: "WILDFIRE", href: "/pages/Wildfire" },
  ...(showInspirationSubpage ? [{ label: "INSPIRATION", href: "/pages/Inspiration" }] : []),
  { label: "THE RUINS", href: "/pages/The-ruins" },
  { label: "I SELL", href: "/pages/I-sell" },
  { label: "BIO", href: "/pages/who-is-g" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const legalRoute = isLegalRoute(pathname);

  return (
    <header className="wild-site-header bg-transparent discordSection discordSection--1">
      {/* Mobile: primary navigation stays on the leading/left side. */}
      <div className="hidden min-h-[56px] items-center justify-start px-4 max-[500px]:flex">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="wild-mobile-menu-button wild-mobile-menu-trigger fixed left-4 top-3 z-40 flex h-10 w-10 items-center justify-center rounded transition-opacity hover:opacity-90"
          aria-label="Open menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="wild-mobile-navigation"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Legal pages keep their purpose-built desktop legal navigation. */}
      {!legalRoute && (
        <div className="mx-auto hidden flex-col items-center pb-0 pt-4 min-[501px]:flex sm:gap-4 sm:pt-10">
          <nav className="w-[60%] pt-4 sm:mx-auto sm:px-6 sm:pb-2 sm:pt-12">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-3">
              {navTabs.map((tab) => {
                const isActive =
                  tab.href === "/pages/Home"
                    ? pathname === "/" || pathname === "/pages/Home"
                    : pathname.startsWith(tab.href);
                return (
                  <motion.div
                    key={tab.href}
                    className="inline-flex"
                    whileHover={{ scale: 1.08, y: -3 }}
                    whileTap={{ scale: 0.98, y: 0 }}
                  >
                    <Link
                      href={tab.href}
                      className={`wild-nav-link inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded px-1 py-1 text-xs font-normal
                      uppercase tracking-wide transition-colors sm:px-2 sm:py-1 sm:text-sm ${
                        isActive
                          ? "wild-nav-link--active border"
                          : ""
                      }`}
                      style={{ fontFamily: "var(--font-serif), serif" }}
                    >
                      {tab.label}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* Separator: hide on mobile (hamburger only), show on desktop */}
      {/* <div
        className="mx-auto hidden w-[80%] border-b px-4 min-[501px]:block sm:px-6"
        style={{ borderColor: "#222222" }}
      /> */}

      {/* Full-screen mobile menu overlay (like second image) */}
      {mobileMenuOpen && (
        <div
          id="wild-mobile-navigation"
          className="wild-mobile-menu fixed inset-0 z-50 flex flex-col max-[500px]:flex min-[501px]:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Keep close in the same leading/left position as the menu trigger. */}
          <div className="flex min-h-[56px] items-center justify-start border-b px-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="wild-mobile-menu-button flex h-10 w-10 items-center justify-center rounded transition-opacity hover:opacity-80"
              aria-label="Close menu"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* HOME label (light grey, centered) */}
          {/* Vertical nav links: white, uppercase, centered, generous spacing */}
          <nav className="flex flex-1 flex-col items-center justify-start gap-8 py-10">
            {navTabs.map((tab) => (
              <motion.div
                key={tab.href}
                whileHover={{ scale: 1.08, y: -3 }}
                whileTap={{ scale: 0.98, y: 0 }}
              >
                <Link
                  href={tab.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="wild-mobile-nav-link text-lg font-normal uppercase tracking-wide transition-opacity hover:opacity-85"
                  style={{ fontFamily: "var(--font-serif), serif" }}
                >
                  {tab.label}
                </Link>
              </motion.div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
