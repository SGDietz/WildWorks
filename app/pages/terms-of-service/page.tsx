import Link from "next/link";
import LegalPage from "../../components/LegalPage";

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The basic rules for using the WildWorks website, submitting project information, contacting iScott, receiving communications, and starting a project conversation."
      sections={[
        {
          title: "Acceptance of These Terms",
          children: (
            <p>
              By using this website, submitting information, contacting WildWorks, using iScott, clicking
              links, or requesting follow-up, you agree to these Terms of Service, the Privacy Policy, the
              Communications Policy, the Disclaimer, the Accessibility Statement, and the Ai Disclosure.
            </p>
          ),
        },
        {
          title: "Website Use",
          children: (
            <p>
              You agree to use this website only for lawful purposes and in a way that does not damage,
              disrupt, overload, scrape, reverse engineer, attack, interfere with, or misuse the website,
              WildWorks systems, WildWorks content, iScott, or other visitors.
            </p>
          ),
        },
        {
          title: "No Project Contract Until Written Agreement",
          children: (
            <>
              <p>
                Website content, iScott responses, calls, emails, texts, social media posts, project
                discussions, examples, rough estimates, and preliminary recommendations are not a binding
                project contract.
              </p>
              <p>
                Project scope, pricing, deposits, materials, timeline, responsibilities, approvals, change
                orders, warranties, ownership, and payment terms are binding only when confirmed in a written
                agreement between WildWorks and the client.
              </p>
            </>
          ),
        },
        {
          title: "Project Information and Site Conditions",
          children: (
            <>
              <p>
                You are responsible for submitting accurate information and for telling WildWorks about known
                site conditions, hazards, restrictions, permits, utilities, easements, drainage, grade, soil,
                structures, access, HOA rules, local codes, budget limits, and timing constraints.
              </p>
              <p>
                Landscape, design, construction, repair, resale-preparation, and problem-solving work depends
                on real-world conditions. Online review and photo review can start the conversation, but they
                do not replace site evaluation where safety, code, utilities, structure, drainage, or permits
                matter.
              </p>
            </>
          ),
        },
        {
          title: "Communications and Marketing",
          children: (
            <>
              <p>
                By submitting contact information, you authorize WildWorks to respond about your inquiry and
                related services. WildWorks may send emails, texts, calls, reminders, offers, project updates,
                and follow-up communications as described in the{" "}
                <Link className="underline decoration-[#e8b66d] underline-offset-4" href="/pages/communications">
                  Communications Policy
                </Link>
                .
              </p>
              <p>
                You may opt out of marketing communications. Opting out of marketing does not prevent
                WildWorks from sending necessary transactional, project, safety, legal, payment, appointment,
                or service-related communications.
              </p>
            </>
          ),
        },
        {
          title: "iScott and Automated Tools",
          children: (
            <>
              <p>
                iScott and related tools may help with intake, organization, brainstorming, drafting,
                summary, project routing, marketing, and follow-up. Automated output can be wrong and should
                not be treated as final professional advice, a quote, or a construction instruction.
              </p>
              <p>
                Additional details are in the{" "}
                <Link className="underline decoration-[#e8b66d] underline-offset-4" href="/pages/ai-disclosure">
                  Ai Disclosure
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          title: "Intellectual Property",
          children: (
            <>
              <p>
                The website, text, photos, designs, graphics, logos, videos, project images, page layouts,
                brand elements, and WildWorks concepts are owned by WildWorks or used with permission unless
                otherwise stated.
              </p>
              <p>
                You may link to this website. You may not copy, scrape, republish, sell, train a model on,
                modify, or use WildWorks content for commercial purposes without written permission.
              </p>
            </>
          ),
        },
        {
          title: "Submitted Materials",
          children: (
            <>
              <p>
                When you submit photos, videos, measurements, drawings, messages, or project information, you
                give WildWorks permission to review, process, store, copy, and use those materials to evaluate
                your inquiry, communicate with you, prepare project-related responses, and operate the
                business.
              </p>
              <p>
                You represent that you have the right to submit those materials and that your submission does
                not violate another person&apos;s privacy, intellectual property, confidentiality, or other
                rights.
              </p>
            </>
          ),
        },
        {
          title: "Third-Party Services",
          children: (
            <p>
              The website may link to or use third-party services, including hosting, analytics, email,
              SMS/text, phone, social platforms, WhatsApp, payment tools, scheduling tools, maps, storage,
              automation, and media services. WildWorks is not responsible for third-party websites, policies,
              outages, security, content, or practices.
            </p>
          ),
        },
        {
          title: "Payments, Deposits, and Project Work",
          children: (
            <p>
              Payment terms, deposits, refund terms, cancellation terms, travel expenses, materials, labor,
              subcontractor costs, and project responsibilities are governed by the written project agreement,
              invoice, or other written confirmation for that specific job.
            </p>
          ),
        },
        {
          title: "Disclaimers and Limitation of Liability",
          children: (
            <>
              <p>
                The website and iScott are provided as informational tools. To the fullest extent allowed by
                law, WildWorks disclaims liability for damages arising from website use, reliance on general
                information, automated output, third-party services, marketing messages, or project decisions
                made without a written WildWorks agreement.
              </p>
              <p>
                More project-specific limits are in the{" "}
                <Link className="underline decoration-[#e8b66d] underline-offset-4" href="/pages/disclaimer">
                  Disclaimer
                </Link>
                .
              </p>
            </>
          ),
        },
        {
          title: "Changes to These Terms",
          children: (
            <p>
              WildWorks may update these terms. Continued use of the website after an update means you accept
              the updated terms.
            </p>
          ),
        },
        {
          title: "Contact",
          children: (
            <p>
              Questions about these terms can be sent to Wildworks@pm.me or raised directly with Scott at
              +1(443) 797-2166.
            </p>
          ),
        },
      ]}
    />
  );
}
