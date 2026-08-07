import LegalPage from "../../components/LegalPage";

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="Accessibility Statement"
      description="WildWorks wants this website to be usable by as many people as possible and welcomes reports about accessibility barriers."
      sections={[
        {
          title: "Commitment",
          children: (
            <p>
              WildWorks is working to make this website usable, readable, and navigable for visitors using a
              range of devices, browsers, assistive technologies, screen readers, keyboard navigation, touch,
              voice input, and other input methods.
            </p>
          ),
        },
        {
          title: "Ongoing Work",
          children: (
            <p>
              Accessibility is an ongoing process. WildWorks aims to improve text clarity, color contrast,
              keyboard access, focus visibility, image descriptions, captions where practical, responsive
              layout, link clarity, heading structure, form labels, error messages, and compatibility with
              assistive technologies.
            </p>
          ),
        },
        {
          title: "Design and Media",
          children: (
            <p>
              WildWorks is a visual design and project portfolio site, so images, video, galleries, avatar
              tools, and project examples are important parts of the experience. WildWorks will make
              reasonable efforts to provide meaningful text, labels, or alternate access when a visual or
              interactive feature creates a barrier.
            </p>
          ),
        },
        {
          title: "Third-Party Tools",
          children: (
            <p>
              Some features may depend on third-party platforms, embedded media, social platforms, messaging
              tools, maps, forms, or iScott/avatar services. WildWorks does not fully control those systems,
              but will make a reasonable effort to provide another way to access the same information or start
              the same conversation.
            </p>
          ),
        },
        {
          title: "Feedback",
          children: (
            <p>
              If you have trouble using any part of this website, contact hello@wildworks.ai or call WildWorks at
              1-877-600-2474. Please describe the page, the issue, your browser or device, and the assistive
              technology involved if applicable.
            </p>
          ),
        },
        {
          title: "Alternative Access",
          children: (
            <p>
              If a website feature does not work for you, WildWorks will make a reasonable effort to provide
              the same information or service through email, phone, text, or another practical
              channel.
            </p>
          ),
        },
      ]}
    />
  );
}
