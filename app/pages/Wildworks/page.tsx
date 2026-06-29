import Link from "next/link";
import BrandText from "../../components/BrandText";

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
    body: "How WildWorks may use email marketing, SMS/text, phone, WhatsApp, social platforms, iScott follow-up, opt-outs, and transactional messages.",
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
    <main className="wild-home min-h-screen">
      <section className="wild-section wild-legal-section discordSection discordSection--2">
        <div className="wild-legal-wrap mx-auto grid max-w-5xl gap-7 px-4 py-4 sm:px-6">
          <div className="wild-legal-hero grid gap-2 text-center">
            <h1 className="wild-section-title wild-line-title wild-legal-title text-[#f7d9a5]">
              Policies and Disclosures
            </h1>
            <p
              className="wild-legal-deck mx-auto max-w-2xl text-base leading-7 text-[rgba(246,211,154,0.78)] sm:text-lg"
              style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
            >
              Practical website terms, privacy language, communications rules, accessibility information,
              disclaimers, and iScott disclosure for <BrandText>WildWorks.Live</BrandText>.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {legalPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="grid rounded-lg border border-[rgba(232,182,109,0.2)] bg-[rgba(38,16,5,0.58)] p-5 no-underline shadow-[0_18px_52px_rgba(16,6,1,0.28)] transition-[filter,transform] hover:brightness-110 sm:p-6"
              >
                <span className="mb-3 text-2xl font-bold leading-tight text-[#e8b66d] sm:text-3xl">
                  {page.title}
                </span>
                <span
                  className="text-base leading-7 text-[rgba(246,211,154,0.78)]"
                  style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                >
                  <BrandText>{page.body}</BrandText>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
