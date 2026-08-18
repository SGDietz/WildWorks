"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { isLegalRoute } from "../lib/legalRoutes";
import { mainNavigationTabs } from "../lib/mainNavigation";

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
          className="wild-mobile-menu-button wild-mobile-menu-trigger fixed left-4 top-3 z-40 flex h-12 w-12 items-center justify-center rounded-xl"
          aria-label="Open menu"
          aria-haspopup="true"
          aria-expanded={mobileMenuOpen}
          aria-controls="wild-mobile-navigation"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.75"
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
        <div className="mx-auto hidden flex-col items-center pb-0 pt-3 min-[501px]:flex sm:gap-0 sm:pt-5">
          <nav id="wild-primary-navigation" aria-label="Primary navigation" className="w-full max-w-2xl px-4 pt-1 sm:mx-auto sm:px-6 sm:pb-1 sm:pt-2">
            <ul className="flex flex-wrap items-center justify-center gap-2" role="list">
              {mainNavigationTabs.map((tab) => {
                const isActive =
                  tab.href === "/pages/Home"
                    ? pathname === "/" || pathname === "/pages/Home"
                    : pathname.startsWith(tab.href);
                return (
                  <li key={tab.href} className="inline-flex">
                    <Link
                      href={tab.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`wild-nav-link inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg px-3 py-2 text-xs font-normal
                      uppercase tracking-wide sm:text-sm ${
                        isActive
                          ? "wild-nav-link--active"
                          : ""
                      }`}
                      style={{ fontFamily: "var(--font-serif), serif" }}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
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
              className="wild-mobile-menu-button flex h-12 w-12 items-center justify-center rounded-xl"
              aria-label="Close menu"
              aria-controls="wild-mobile-navigation"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.75}
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
            {mainNavigationTabs.map((tab) => (
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
