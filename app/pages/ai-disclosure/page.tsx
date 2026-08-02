import LegalPage from "../../components/LegalPage";

export default function AiDisclosurePage() {
  return (
    <LegalPage
      title="Ai Disclosure"
      description="How WildWorks uses iScott, avatar intake, assisted organization, human review, uploaded photos, and automated communications."
      sections={[
        {
          title: "iScott and Assisted Intake",
          children: (
            <>
              <p>
                iScott is an assisted intake and conversation tool. It is designed to help visitors explain
                what they want designed, built, fixed, priced, discussed, or understood before speaking with
                the real Scott.
              </p>
              <p>
                iScott and related tools may ask questions, organize context, summarize your goals, help frame
                project options, and route information for follow-up.
              </p>
            </>
          ),
        },
        {
          title: "Human Review",
          children: (
            <>
              <p>
                Assisted tools can support intake and planning, but final WildWorks judgment comes from the
                real Scott and, when needed, qualified contractors, engineers, inspectors, permit offices,
                utility locators, or other local professionals.
              </p>
              <p>
                No iScott or automated response creates a contract, final design, construction instruction,
                quote, guarantee, professional opinion, or permission to begin work.
              </p>
            </>
          ),
        },
        {
          title: "Automated Output Can Be Wrong",
          children: (
            <p>
              Assisted or Ai-generated responses can be inaccurate, incomplete, biased, outdated, or unsuitable
              for a particular property. Do not rely on automated responses as the final word for safety,
              engineering, drainage, structural work, utilities, permitting, law, pricing, resale value,
              construction, or contractor decisions.
            </p>
          ),
        },
        {
          title: "Photos, Videos, and Property Details",
          children: (
            <>
              <p>
                Photos, videos, measurements, drawings, and property details submitted to WildWorks may be
                reviewed by humans and processed by assisted systems to understand site conditions, aesthetics,
                obstacles, opportunities, and project goals.
              </p>
              <p>
                Automated review cannot replace an in-person site inspection where conditions, safety, grade,
                drainage, structure, utilities, code, access, or construction details matter.
              </p>
            </>
          ),
        },
        {
          title: "Automated and Assisted Communications",
          children: (
            <p>
              WildWorks may use assisted tools to draft, sort, summarize, personalize, or schedule
              communications, including email, SMS/text, project follow-up, and marketing. Important
              commitments still require human review and, where appropriate, written agreement.
            </p>
          ),
        },
        {
          title: "No Sensitive Information",
          children: (
            <p>
              Do not submit passwords, banking details, Social Security numbers, medical information, private
              legal documents, confidential third-party information, or other sensitive personal information
              through iScott or ordinary website tools.
            </p>
          ),
        },
        {
          title: "Content Created with Ai",
          children: (
            <p>
              WildWorks may use assisted tools to help create website text, design concepts, summaries,
              mockups, images, internal notes, marketing drafts, and project explanations. WildWorks aims to
              use those tools honestly and not to mislead visitors about what is human-made, automated,
              conceptual, or final.
            </p>
          ),
        },
        {
          title: "Contact",
          children: (
            <p>
              Questions about iScott or assisted tools can be sent to hello@wildworks.ai or raised by calling
              WildWorks at 1-877-600-2474.
            </p>
          ),
        },
      ]}
    />
  );
}
