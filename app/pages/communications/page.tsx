import LegalPage from "../../components/LegalPage";

export default function CommunicationsPage() {
  return (
    <LegalPage
      title="Communications Policy"
      description="How WildWorks may contact visitors and clients by email, SMS/text, phone, WhatsApp, social platforms, iScott follow-up, and related marketing or project channels."
      sections={[
        {
          title: "Contact Permission",
          children: (
            <>
              <p>
                When you submit contact information through this website, iScott, a form, email, phone, SMS,
                WhatsApp, X, social media, or another channel, you authorize WildWorks to contact you about
                your inquiry, project, photos, goals, budget, timing, and related WildWorks services.
              </p>
              <p>
                WildWorks may respond through the same channel you used or through another contact method you
                provided, including email, phone, text message, WhatsApp, social direct message, or future
                WildWorks communication tools.
              </p>
            </>
          ),
        },
        {
          title: "Marketing Emails",
          children: (
            <>
              <p>
                If you sign up for emails, submit a project inquiry, request information, or otherwise provide
                your email address, WildWorks may send marketing emails, project education, service updates,
                design ideas, offers, reminders, event notices, website updates, and follow-up messages.
              </p>
              <p>
                Marketing emails should identify WildWorks as the sender, use accurate header information,
                avoid intentionally misleading subject lines, and provide a reasonable way to unsubscribe from
                future marketing emails.
              </p>
              <p>
                Commercial email campaigns should include WildWorks contact information, including a current
                postal mailing address or another legally permitted address format, in the message footer when
                required by law.
              </p>
              <p>
                You may unsubscribe from marketing email at any time. WildWorks may still send necessary
                transactional or relationship emails about active inquiries, projects, appointments, payments,
                legal notices, safety issues, or service matters.
              </p>
            </>
          ),
        },
        {
          title: "SMS and Text Messages",
          children: (
            <>
              <p>
                If you provide a mobile number and agree to receive texts, WildWorks may send SMS or text
                messages about project follow-up, scheduling, reminders, service updates, offers, promotions,
                and other WildWorks communications.
              </p>
              <p>
                Consent to receive marketing texts is not required to buy services from WildWorks. Message
                frequency may vary. Message and data rates may apply. Carriers are not liable for delayed or
                undelivered messages.
              </p>
              <p>
                WildWorks text consent applies to WildWorks communications about WildWorks services, project
                follow-up, design ideas, offers, and related property conversations. WildWorks does not treat
                one consent as permission for unrelated third-party sellers to text you.
              </p>
              <p>
                Reply HELP for help and STOP to opt out of marketing texts. You may also request help or text
                opt-out by emailing Wildworks@pm.me or calling WildWorks at 1-877-600-2474.
              </p>
            </>
          ),
        },
        {
          title: "Phone Calls, Voicemail, and Automated Contact",
          children: (
            <>
              <p>
                WildWorks may call or leave voicemail messages when you provide a phone number or request a
                call. Calls may relate to project review, scheduling, follow-up, service updates, marketing,
                or other WildWorks business.
              </p>
              <p>
                If WildWorks uses autodialed, prerecorded, artificial voice, or similar automated calling or
                texting technology for marketing, WildWorks will seek consent as required by applicable law.
              </p>
              <p>
                You can ask WildWorks not to call or text a number. WildWorks may still contact you where
                legally permitted or required for active projects, safety, legal, payment, or service matters.
              </p>
            </>
          ),
        },
        {
          title: "WhatsApp, X, Social Media, and Third-Party Platforms",
          children: (
            <>
              <p>
                If you contact WildWorks through WhatsApp, X, Instagram, Facebook, direct message, or another
                third-party platform, WildWorks may respond through that platform and may keep records of the
                communication.
              </p>
              <p>
                Those platforms have their own terms, privacy practices, delivery rules, blocking tools, and
                notification settings. WildWorks does not control third-party platform policies or outages.
              </p>
            </>
          ),
        },
        {
          title: "iScott and Assisted Follow-Up",
          children: (
            <>
              <p>
                WildWorks may use iScott and other assisted tools to help organize inquiries, draft replies,
                summarize project details, categorize leads, schedule follow-up, and personalize
                communications.
              </p>
              <p>
                Assisted communications are still WildWorks communications. Important project decisions,
                pricing, construction commitments, legal terms, and final design/build judgments require
                human review and, where needed, written agreement.
              </p>
            </>
          ),
        },
        {
          title: "Opt-Out and Revocation",
          children: (
            <>
              <p>
                You may opt out of marketing communications at any time. For email, use the unsubscribe
                method in the email or contact WildWorks. For texts, reply STOP where supported or contact
                WildWorks. For calls, tell WildWorks not to call that number.
              </p>
              <p>
                WildWorks will make reasonable efforts to honor opt-out requests promptly. Email opt-out
                requests may take up to 10 business days to process. Text and call revocation requests will
                be handled as required by applicable law and platform capabilities.
              </p>
              <p>
                Opting out of one channel may not automatically opt you out of every other channel unless you
                clearly ask WildWorks to stop all non-essential marketing contact.
              </p>
            </>
          ),
        },
        {
          title: "No Emergency Channel",
          children: (
            <p>
              This website, iScott, email, SMS/text, social media, WhatsApp, and voicemail are not emergency
              channels. For immediate safety issues, utility strikes, fire, collapse, injury, dangerous site
              conditions, or other emergencies, contact emergency services or the appropriate local authority.
            </p>
          ),
        },
        {
          title: "Contact",
          children: (
            <p>
              Communication requests, opt-outs, and questions can be sent to Wildworks@pm.me or raised by
              calling WildWorks at 1-877-600-2474.
            </p>
          ),
        },
      ]}
    />
  );
}
