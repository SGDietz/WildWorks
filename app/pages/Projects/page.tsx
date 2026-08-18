import ProjectsGallery from "../../components/ProjectsGallery";
import LargeIScottCta from "../../components/LargeIScottCta";
import PhoneNumberLine from "../../components/PhoneNumberLine";

export default function ProjectsPage() {
  return (
    <div className="wild-subpage wild-subpage--projects discordSection discordSection--1">
      <h1 className="wild-projects-page-title">WildWorks Projects</h1>
      <ProjectsGallery />
      <p className="wild-projects-page-intro">
        WildWorks Designs And Builds Complete Outdoor Environments. Each Project Is Shaped Around The Land And How Its Owners Want To Live.
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
