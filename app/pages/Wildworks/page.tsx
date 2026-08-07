import Link from "next/link";
import BrandText from "../../components/BrandText";
import { legalNavItems } from "../../lib/legalRoutes";

const legalPages = [
  {
    title: "Privacy Policy",
    href: "/pages/privacy-policy",
    body: "How WildWorks handles contact information, project details, photos, iScott intake, email, text, phone, cookies, analytics, vendors, and privacy choices.",
  },
  {
    title: "Terms of Service",
    href: "/pages/terms-of-service",
    body: "The basic rules for website use, project submissions, communications, iScott, ownership, third-party services, and when a project becomes a written agreement.",
  },
  {
    title: "Disclaimer",
    href: "/pages/disclaimer",
    body: "Limits on website information, project examples, safety, permits, resale claims, iScott responses, estimates, and construction guidance.",
  },
  {
    title: "Communications",
    href: "/pages/communications",
    body: "How WildWorks may use email marketing, SMS/text, phone, social platforms, iScott follow-up, opt-outs, and transactional messages.",
  },
  {
    title: "Accessibility",
    href: "/pages/accessibility",
    body: "WildWorks' accessibility statement and how visitors can report barriers or request another way to access the same information.",
  },
  {
    title: "Ai Disclosure",
    href: "/pages/ai-disclosure",
    body: "How iScott, avatar intake, assisted organization, automated output, uploaded photos, communications, and human review work on the WildWorks website.",
  },
];

export default function WildworksLegalIndex() {
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
              Terms, Privacy, and Website Details
            </h1>
            <p
              className="wild-legal-deck mx-auto max-w-3xl text-base leading-7 sm:text-lg"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              Practical website terms, privacy language, communications rules, accessibility information,
              disclaimers, and iScott disclosure for <BrandText>WildWorks.Live</BrandText>.
            </p>
            <p
              className="wild-legal-copy mx-auto max-w-3xl text-base leading-7"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              <BrandText>WildWorks.ai</BrandText> is a Wyoming-registered trade name of DietzX LLC.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {legalPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="wild-legal-card wild-legal-index-card no-underline"
              >
                <span className="wild-legal-card-title mb-3 text-2xl font-bold leading-tight sm:text-3xl">
                  {page.title}
                </span>
                <span
                  className="wild-legal-copy text-base leading-7"
                  style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  <BrandText>{page.body}</BrandText>
                </span>
                <span className="wild-legal-index-cta">Open Details</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
