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
        <span className="wild-projects-page-intro__line wild-projects-page-intro__line--three">and How its Owners Want to Live.</span>
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
          maxWidth: "64rem",
          padding: "0 1rem",
          textAlign: "center",
          fontFamily: '"Playfair Display", "Libre Baskerville", Georgia, serif',
          fontWeight: 700,
          // Must stay SUBORDINATE to the intro headline at every width. On a
          // 375px phone the intro drops to 28px, and a 1.75rem floor made this
          // exactly the same size - it read as a second headline. Roughly 70%
          // of the intro across the range instead.
          fontSize: "clamp(1.3rem, 2.6vw, 2.3rem)",
          lineHeight: 1.14,
          textWrap: "balance",
          textShadow:
            "rgba(35,9,2,0.582) 0 0.008914em 0, rgba(34,9,2,0.555) 0 0.017829em 0," +
            " rgba(32,8,2,0.529) 0 0.026743em 0, rgba(31,8,2,0.502) 0 0.035658em 0," +
            " rgba(29,7,1,0.476) 0 0.044571em 0, rgba(28,7,1,0.449) 0 0.053486em 0," +
            " rgba(26,6,1,0.423) 0 0.062400em 0, rgba(25,6,1,0.396) 0 0.071314em 0",
        }}
      >
        <span style={{ color: "#fce0ad" }}>These Are Finished Places.</span>
        <span style={{ color: "#edc775" }}>Stone, Fire, Water, Garden. Open Any Picture.</span>
        <span style={{ color: "#f08c28" }}>Then Tell iScott Which Feeling You Want on Your Land.</span>
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
