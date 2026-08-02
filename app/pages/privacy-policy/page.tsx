import Link from "next/link";
import LegalPage from "../../components/LegalPage";

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="How WildWorks collects, uses, shares, protects, and responds to information submitted through this website, iScott, email, text, phone, WhatsApp, social media, and project conversations."
      sections={[
        {
          title: "Business Identity",
          children: (
            <p>
              For purposes of this Privacy Policy, &ldquo;WildWorks&rdquo; means DietzX LLC operating under its
              Wyoming-registered trade name WildWorks.ai.
            </p>
          ),
        },
        {
          title: "Information WildWorks Collects",
          children: (
            <>
              <p>
                WildWorks may collect information you choose to provide, including your name, email address,
                phone number, mailing address, project address or approximate location, budget range, timing,
                design goals, property concerns, photos, videos, measurements, messages, call notes, and
                other project details.
              </p>
              <p>
                WildWorks may collect website and device information such as IP address, browser type, pages
                visited, referral source, approximate location, cookies, form activity, analytics data, and
                other technical information used to operate, secure, and improve the website.
              </p>
              <p>
                If you use iScott, contact forms, email, phone, SMS/text, WhatsApp, X, social media, or
                another platform, WildWorks may receive and store the information you provide through those
                tools or platforms.
              </p>
            </>
          ),
        },
        {
          title: "How Information is Used",
          children: (
            <>
              <p>
                WildWorks uses information to respond to inquiries, understand project needs, review photos,
                prepare for conversations, schedule calls, provide design or problem-solving guidance,
                prepare estimates or proposals, manage active projects, and keep business records.
              </p>
              <p>
                WildWorks may use contact information for email marketing, text message marketing, phone
                follow-up, reminders, project updates, educational content, offers, and audience building,
                subject to applicable consent and opt-out rules.
              </p>
              <p>
                WildWorks may also use information to operate the website, improve iScott and intake
                workflows, prevent misuse, protect the business, comply with legal obligations, and enforce
                agreements.
              </p>
            </>
          ),
        },
        {
          title: "iScott, Automation, and Uploaded Content",
          children: (
            <>
              <p>
                Information submitted through iScott or other automated tools may be processed to organize
                project context, summarize requests, identify likely next steps, and help WildWorks respond
                more efficiently.
              </p>
              <p>
                By submitting photos, videos, drawings, measurements, messages, or project details, you
                confirm that you have the right to share them with WildWorks and authorize WildWorks to
                review, process, store, and use them to evaluate and respond to your inquiry.
              </p>
              <p>
                Do not submit passwords, banking information, Social Security numbers, medical information,
                private legal documents, children&apos;s information, or other sensitive personal data through
                the website, iScott, email, text, or public messaging tools unless WildWorks specifically
                requests it through an appropriate secure process.
              </p>
            </>
          ),
        },
        {
          title: "Sharing and Service Providers",
          children: (
            <>
              <p>
                WildWorks does not sell personal information to unrelated third-party sellers. WildWorks may
                share information with vendors that help operate hosting, analytics, forms, email, SMS/text
                messaging, phone, scheduling, CRM, storage, security, automation, payment, project review, and
                communications.
              </p>
              <p>
                WildWorks may share information with contractors, suppliers, consultants, inspectors,
                engineers, permit offices, utility locators, or other project participants when reasonably
                needed to evaluate, price, plan, or perform a requested project.
              </p>
              <p>
                WildWorks may disclose information if required by law, to protect rights or safety, to collect
                amounts owed, to investigate misuse, or as part of a business transfer, reorganization, or
                similar transaction.
              </p>
              <p>
                All the above categories exclude text messaging originator opt-in data and consent; this
                information won&apos;t be shared with any third parties.
              </p>
            </>
          ),
        },
        {
          title: "Cookies, Analytics, and Advertising Tools",
          children: (
            <>
              <p>
                The website may use cookies, pixels, analytics tools, advertising tools, and similar
                technologies to operate the site, measure traffic, understand visitor behavior, improve
                performance, personalize communications, and measure marketing campaigns.
              </p>
              <p>
                Browser settings may allow you to block or delete cookies. Some website features may work
                differently if cookies or similar technologies are disabled.
              </p>
              <p>
                Third-party analytics, advertising, video, social media, messaging, or embedded tools may
                collect information under their own policies. WildWorks does not control every setting or use
                by those third-party platforms.
              </p>
            </>
          ),
        },
        {
          title: "Email, Text, Phone, and Marketing Choices",
          children: (
            <>
              <p>
                Email, SMS/text, phone, WhatsApp, and social-media communication practices are explained in
                the{" "}
                <Link className="underline decoration-[#e8b66d] underline-offset-4" href="/pages/communications">
                  Communications Policy
                </Link>
                . You can unsubscribe from marketing emails through the unsubscribe method in the email or by
                contacting WildWorks. You can opt out of marketing texts by replying STOP where supported or
                by contacting WildWorks directly.
              </p>
              <p>
                Opting out of marketing does not stop necessary transactional, project, appointment, payment,
                legal, safety, or service-related communications.
              </p>
            </>
          ),
        },
        {
          title: "Data Retention and Security",
          children: (
            <>
              <p>
                WildWorks keeps information for as long as reasonably needed to respond to inquiries, manage
                project conversations, operate the website, maintain business records, comply with legal
                obligations, resolve disputes, enforce agreements, and protect the business.
              </p>
              <p>
                No website, email system, messaging platform, or automated tool can guarantee perfect
                security. WildWorks uses reasonable measures to protect submitted information, but visitors
                should avoid sending sensitive information through ordinary website and messaging tools.
              </p>
            </>
          ),
        },
        {
          title: "Your Choices and Requests",
          children: (
            <>
              <p>
                You may ask WildWorks to update, delete, or stop using contact information by emailing
                hello@wildworks.ai. WildWorks may need to keep certain information for project records, legal
                compliance, dispute resolution, fraud prevention, security, or other legitimate business
                reasons.
              </p>
              <p>
                If a privacy law gives you additional rights based on where you live, WildWorks will respond
                as required by that law.
              </p>
            </>
          ),
        },
        {
          title: "Children",
          children: (
            <p>
              This website is intended for adults and property decision-makers. WildWorks does not knowingly
              collect personal information from children under 13. If you believe a child submitted personal
              information, contact WildWorks so it can be reviewed and removed where appropriate.
            </p>
          ),
        },
        {
          title: "Contact",
          children: (
            <p>
              Privacy questions can be sent to hello@wildworks.ai or raised by calling WildWorks at
              1-877-600-2474.
            </p>
          ),
        },
      ]}
    />
  );
}
