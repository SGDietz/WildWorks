import LegalPage from "../../components/LegalPage";

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Disclaimer"
      description="Important limits on website information, project examples, iScott responses, property guidance, resale discussion, safety, permitting, estimates, and design/build decisions."
      sections={[
        {
          title: "Informational Website",
          children: (
            <p>
              This website provides general information about WildWorks, design, landscaping, stonework,
              building, art, problem solving, resale preparation, iScott intake, and related ideas. It is not
              engineering, architecture, legal, permitting, safety, real estate, tax, financial, appraisal,
              insurance, or medical advice.
            </p>
          ),
        },
        {
          title: "Project Examples Are Not Guarantees",
          children: (
            <p>
              Photos, videos, stories, examples, design concepts, resale discussions, and descriptions of past
              projects do not guarantee a particular result, price, buyer reaction, resale value, timeline,
              permit outcome, contractor performance, material availability, or project outcome for another
              property.
            </p>
          ),
        },
        {
          title: "Site Conditions Matter",
          children: (
            <p>
              Landscape and construction work depends on real-world conditions, including drainage, grade,
              soil, utilities, structure, access, slopes, load, fire safety, weather, materials, maintenance,
              local code, permits, inspections, and contractor execution.
            </p>
          ),
        },
        {
          title: "No Work Should Start From Website Content Alone",
          children: (
            <p>
              Do not begin construction, demolition, excavation, grading, fireplace work, retaining wall work,
              drainage work, electrical work, gas work, structural work, tree work, or similar activity based
              only on website content, iScott, text messages, photos, or preliminary conversations. Confirm
              permits, utility marking, inspections, safety requirements, and qualified professional
              involvement before work begins.
            </p>
          ),
        },
        {
          title: "iScott and Automated Responses",
          children: (
            <p>
              iScott and other automated features may be useful for intake, organization, brainstorming, and
              follow-up, but responses may be incomplete, inaccurate, outdated, or unsuitable for a particular
              property. Final project judgment requires review by the real Scott and, where needed, licensed
              professionals, inspectors, utility locators, or local authorities.
            </p>
          ),
        },
        {
          title: "Estimates, Pricing, and Availability",
          children: (
            <p>
              Any online price range, rough estimate, timeline, material idea, availability statement, or
              suggested path is preliminary unless included in a written WildWorks agreement. Costs and timing
              can change based on scope, conditions, materials, labor, travel, weather, permitting, and
              contractor or supplier availability.
            </p>
          ),
        },
        {
          title: "Resale and Buyer Reaction",
          children: (
            <p>
              WildWorks may discuss curb appeal, buyer psychology, staging, presentation, and ways a property
              might become more attractive. WildWorks does not guarantee sale price, appraisal value, buyer
              behavior, market timing, inspection outcome, financing outcome, or real estate result.
            </p>
          ),
        },
        {
          title: "No Emergency Channel",
          children: (
            <p>
              This website, iScott, email, SMS/text, social media, WhatsApp, and voicemail are not emergency
              channels. For immediate danger, fire, injury, utility strike, collapse, unsafe structure,
              flooding, gas smell, or similar emergencies, contact emergency services or the appropriate
              local authority.
            </p>
          ),
        },
        {
          title: "Contact",
          children: (
            <p>
              Questions about this disclaimer can be sent to Wildworks@pm.me or raised directly with Scott at
              +1(443) 797-2166.
            </p>
          ),
        },
      ]}
    />
  );
}
