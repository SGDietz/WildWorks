import type { ReactNode } from "react";
import BrandText from "./BrandText";

type LegalSection = {
  title: string;
  children: ReactNode;
};

type LegalPageProps = {
  title: string;
  description: string;
  sections: LegalSection[];
};

const effectiveDate = "June 10, 2026";

export default function LegalPage({ title, description, sections }: LegalPageProps) {
  return (
    <main className="wild-home min-h-screen">
      <section className="wild-section wild-legal-section discordSection discordSection--2">
        <div className="wild-legal-wrap mx-auto grid max-w-4xl gap-7 px-4 py-4 sm:px-6">
          <div className="wild-legal-hero grid gap-2 text-center">
            <h1 className="wild-section-title wild-line-title wild-legal-title text-[#f7d9a5]">
              <BrandText>{title}</BrandText>
            </h1>
            <p
              className="wild-legal-deck mx-auto max-w-2xl text-base leading-7 text-[rgba(246,211,154,0.78)] sm:text-lg"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              <BrandText>{description}</BrandText>
            </p>
            <p
              className="wild-legal-date text-sm font-bold tracking-[0.18em] text-[#a76431] uppercase"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              Effective Date: {effectiveDate}
            </p>
            <p
              className="wild-legal-note mx-auto max-w-2xl text-sm leading-6 text-[rgba(246,211,154,0.66)]"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              <BrandText>
                These policies explain how this website and WildWorks communications are intended to work.
                They are not legal advice and do not replace a written project agreement.
              </BrandText>
            </p>
          </div>

          <div className="grid gap-5">
            {sections.map((section) => (
              <section
                key={section.title}
                className="wild-legal-card rounded-lg border border-[rgba(232,182,109,0.2)] bg-[rgba(38,16,5,0.58)] p-5 shadow-[0_18px_52px_rgba(16,6,1,0.28)] sm:p-6"
              >
                <h2 className="wild-legal-card-title mb-3 text-2xl font-bold leading-tight text-[#e8b66d] sm:text-3xl">
                  <BrandText>{section.title}</BrandText>
                </h2>
                <div
                  className="legal-copy wild-legal-copy grid gap-3 text-base leading-7 text-[rgba(246,211,154,0.78)]"
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
