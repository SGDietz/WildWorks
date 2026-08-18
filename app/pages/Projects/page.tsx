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
      <p className="wild-projects-click-note">Click to Enlarge</p>
      <p className="wild-projects-page-intro">
        WildWorks Designs and Builds Complete Outdoor Environments. Each Project is Shaped Around the Land and How its Owners Want to Live.
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
