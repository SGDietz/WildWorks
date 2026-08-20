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
      <p className="wild-projects-click-note">Click On Any Image For The 98 Picture Carousel</p>
      {/* G 2026-08-19: "much larger, like double the size of that font and
          maybe three or four lines. Do three lines and do colors one two three."
          Split into three spans so each line can carry its own brand colour -
          one element cannot be three colours. Wording unchanged. */}
      <p className="wild-projects-page-intro">
        <span className="wild-projects-page-intro__line wild-projects-page-intro__line--one">
          <span className="wild-projects-page-intro__part--a">WildWorks Designs and Builds</span>
          {" "}
          <span className="wild-projects-page-intro__part--b">Complete Outdoor Environments.</span>
        </span>
        <span className="wild-projects-page-intro__line wild-projects-page-intro__line--two">Each Project is Shaped Around the Land</span>
        <span className="wild-projects-page-intro__line wild-projects-page-intro__line--three">and How its Owners Want to Live.</span>
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
