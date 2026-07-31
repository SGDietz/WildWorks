import type { ReactNode } from "react";
import Link from "next/link";
import BrandText from "./BrandText";
import { legalNavItems } from "../lib/legalRoutes";

type LegalSection = {
  title: string;
  children: ReactNode;
};

type LegalPageProps = {
  title: string;
  description: string;
  sections: LegalSection[];
};

const lastUpdated = "July 31, 2026";

export default function LegalPage({ title, description, sections }: LegalPageProps) {
  return (
    <main className="wild-home wild-legal-home min-h-screen">
      <section className="wild-section wild-legal-section discordSection discordSection--2">
        <div className="wild-legal-wrap mx-auto grid max-w-5xl gap-8 px-4 py-6 sm:px-6 lg:py-10">
          <nav className="wild-legal-topbar" aria-label="Legal navigation">
            <Link href="/pages/Home">Home</Link>
            {legalNavItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="wild-legal-hero grid gap-2 text-center">
            <h1 className="wild-section-title wild-line-title wild-legal-title">
              <BrandText>{title}</BrandText>
            </h1>
            <p
              className="wild-legal-deck mx-auto max-w-3xl text-base leading-7 sm:text-lg"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              <BrandText>{description}</BrandText>
            </p>
            <div className="wild-legal-meta-row" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
              <span>Last Updated: {lastUpdated}</span>
              <span>Project Agreement Still Controls</span>
            </div>
            <p
              className="wild-legal-note mx-auto max-w-3xl text-sm leading-6"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              <BrandText>
                These details explain how this website and WildWorks communications are intended to work.
                They are not legal advice and do not replace a written project agreement.
              </BrandText>
            </p>
          </div>

          <div className="grid gap-5">
            {sections.map((section) => (
              <section
                key={section.title}
                className="wild-legal-card"
              >
                <h2 className="wild-legal-card-title mb-3 text-2xl font-bold leading-tight sm:text-3xl">
                  <BrandText>{section.title}</BrandText>
                </h2>
                <div
                  className="legal-copy wild-legal-copy grid gap-3 text-base leading-7"
                  style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  <BrandText>{section.children}</BrandText>
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
