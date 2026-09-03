import ProjectsGallery from "../../components/ProjectsGallery";
import LargeIScottCta from "../../components/LargeIScottCta";
import PhoneNumberLine from "../../components/PhoneNumberLine";

export default function ProjectsPage() {
  return (
    <div className="wild-subpage wild-subpage--projects discordSection discordSection--1">
      <h1 className="wild-projects-page-title">WildWorks Projects</h1>
      <ProjectsGallery />
      {/* G 2026-08-18: the grid does not look clickable, same problem the
          Wildfire carousel had. */}
      <p className="wild-projects-click-note">Click On Any Image To Enlarge</p>
      {/* G 2026-08-19: "much larger, like double the size of that font and
          maybe three or four lines. Do three lines and do colors one two three."
          Split into three spans so each line can carry its own brand colour -
          one element cannot be three colours. Wording unchanged. */}
      <p className="wild-projects-page-intro">
        <span className="wild-projects-page-intro__line wild-projects-page-intro__line--one">
          <span className="wild-projects-page-intro__part--a">
            WildWorks Designs <span className="wild-projects-page-intro__and-builds">and Builds</span>
          </span>
          {" "}
          <span className="wild-projects-page-intro__part--b">Complete Outdoor Environments.</span>
        </span>
        <span className="wild-projects-page-intro__line wild-projects-page-intro__line--two">Each Project is Shaped Around the Land</span>
        {/* G 2026-08-25: the sitewide colour-3 rule paints this line with
            `text-shadow: var(--ww-color3-full-shadow) !important`, and its :is()
            outranks a 6000-id selector - specificity cannot win, and feeding it
            the variable inline did not win either. So take the text OUT of that
            rule's reach: the outer span keeps the class (and therefore the
            colour), while the words live in an inner span that the colour-3
            selector does not match, carrying the reference stack. This is the
            same shape that already works for "and Builds". The global variable
            and the iScott sales title are untouched. */}
        <span className="wild-projects-page-intro__line wild-projects-page-intro__line--three">
          {/* G 2026-09-03 11:5x ET: "does not sound very personal... take out
              its and put in how the owners." */}
          <span className="wild-projects-page-intro__three-ink">and How the Owners Want to Live.</span>
        </span>
      </p>
      {/* 2026-08-24 (G): Projects had two lines of copy and nothing telling a
          buyer what to do next. One kicker only - no invented captions. */}
      {/* 2026-08-24 (G): "that should be much bigger... its own separate thing...
          first line first colour, second line second colour... use the colours
          appropriately." Inline because this page's ID-stack cannot be beaten by
          a new class. Order 4 comes from H338's `click-note ~ p` rule. */}
      <p
        className="wild-projects-page-kicker"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.1em",
          margin: "1.15rem auto 0",
          // Widened 64rem -> 70rem, 2026-08-25: with the four lines held on
          // nowrap, line four measured 1022px inside a 1024px box at 1440px+.
          // Two pixels is not enough headroom if the serif falls back to a
          // different face on someone's device, and an overflow would break
          // the four-line rhythm G asked for.
          maxWidth: "70rem",
          padding: "0 1rem",
          textAlign: "center",
          fontFamily: '"Playfair Display", "Libre Baskerville", Georgia, serif',
          fontWeight: 700,
          // G 2026-08-25: "this text should be larger... have it match the text
          // above... have it be that big." Now MATCHES the intro headline at
          // every width (this reverses the 2026-08-24 "stay subordinate" call).
          // The var is defined in H339 so the phone value can differ; the
          // fallback is the desktop intro size.
          fontSize: "var(--ww-projects-kicker-size, clamp(2.6rem, 4.3vw, 3.65rem))",
          lineHeight: 1.14,
          textWrap: "balance",
          textShadow:
            "rgba(35,9,2,0.582) 0 0.008914em 0, rgba(34,9,2,0.555) 0 0.017829em 0," +
            " rgba(32,8,2,0.529) 0 0.026743em 0, rgba(31,8,2,0.502) 0 0.035658em 0," +
            " rgba(29,7,1,0.476) 0 0.044571em 0, rgba(28,7,1,0.449) 0 0.053486em 0," +
            " rgba(26,6,1,0.423) 0 0.062400em 0, rgba(25,6,1,0.396) 0 0.071314em 0",
        }}
      >
        {/* G 2026-08-25 (second pass): "those five lines... don't look balanced
            with the four lines above... They need to be probably four lines, a
            little bit wider each... you have them almost all the same width. It
            should not be almost all the same width... first line text colour
            one, second line two, third line three, fourth line back to colour
            one. Make this balanced across all devices."
            FOUR explicit lines, deliberately increasing in width so the block
            has the same ragged rhythm as the intro above it. Colours and the
            no-wrap that holds these breaks on every device live in H339 - an
            inline colour cannot win here, a sitewide rule forces
            -webkit-text-fill-color cream over every span. */}
        {/* G 2026-09-03 11:09 ET, phone screenshot: "these are finished, and
            then that's the first line. And then spaces, stone, fire is the
            second line, then water and garden the third line. And then the
            second set is open any picture first line, then tell iScott second
            line, which feeling you third line, then want on your land fourth
            line. Keep all the text colors the same here." And: "see it's off
            to the right" - the fourth span was nowrap and wider than a phone.
            The FOUR spans and their H339 colours are untouched for desktop
            (brs hidden from 521px, H441b). On phones H481 makes the spans
            inline so "Spaces." can share a line with "Stone, Fire,", and the
            phone-only brs below put every break exactly where he said. Each
            phone line is one span, or two spans of the same colour. */}
        <span className="wild-projects-page-kicker__line">These Are Finished<br className="ww-phone-br" /> Spaces.</span>{" "}
        <span className="wild-projects-page-kicker__line">Stone, Fire,<br className="ww-phone-br" /> Water &amp; Garden.</span>
        <br className="ww-phone-br" />
        <span className="wild-projects-page-kicker__line">Open Any Picture,<br className="ww-phone-br" /> Then Tell iScott</span>
        <br className="ww-phone-br" />
        <span className="wild-projects-page-kicker__line">Which Feeling You<br className="ww-phone-br" /> Want on Your Land.</span>
      </p>
      <div className="wild-projects-home-contact">
        <PhoneNumberLine
          className="wild-phone-number-line--home-footer"
          showCallToday={false}
        />
        <LargeIScottCta href="/pages/Home?wake-iscott=1#talk-to-iscott" />
      </div>
    </div>
  );
}
