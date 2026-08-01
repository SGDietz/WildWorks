import AspectRatioImage from "../../components/AspectRatioImage";
import BrandText from "../../components/BrandText";
import SubpageIScottCta from "../../components/SubpageIScottCta";

export default function WhoIsG() {
  return (
    <div className="wild-subpage wild-subpage--bio mx-auto lg:max-w-5xl py-4 discordSection discordSection--1">
      {/* Image constrained to same width as header separator line */}
      <section className="wild-subpage-hero relative mx-auto flex w-full items-center justify-center overflow-hidden px-4 sm:px-6">
        <AspectRatioImage
          src="/wildworks-home-banner-20260726.png"
          alt="Scott G. Dietz beside WildWorks natural stone steps and landscape"
          priority
          sizes="(max-width: 64rem) 100vw, 64rem"
        />
        <div className="absolute inset-0  pointer-events-none" aria-hidden />
      </section>

      <section className="wild-subpage-section wild-subpage-contact discordSection discordSection--2 mx-auto w-full px-4 pt-6 text-white sm:px-6 sm:pt-8 ">
        <div className="space-y-2 text-left text-sm leading-relaxed">
          <h1 className="text-2xl sm:text-3xl">Who is Scott G. Dietz?</h1>
          <p className="text-base">
            From 6 Months Old, Scott G. Dietz Was Raised in Bel Air, Maryland, Just North of Baltimore City. His Roots Run Deep in the Area—Both of His Parents Were Born and Raised in Baltimore City.
          </p>
          <p className="text-base">
            As a Kid, Scott Was Impossible to Control—Undisciplined, Restless, and Constantly Pushing Boundaries. As He Grew and Matured, That Same Force Became Something Powerful: Explosive Creative Energy Focused on Creativity and Building.
          </p>
          <p className="text-base">
            For More Than 40 Years, Scott Has Channeled That Energy Into the Craft of Stone. He is a Fine Artist, Master Stonemason, and Relentless Problem Solver Known for Charging Directly Into the Most Complex and Unconventional Problems People Face. His Work Blends Creativity, Craftsmanship, and Engineering Into Rock Art—Stone Landscapes Designed to Feel Timeless, Powerful, and Naturally Rooted in the Land.
          </p>
          <h2 className="text-xl sm:text-2xl mt-6">A Life of Constant Reinvention</h2>
          <p className="text-base">
            Scott Doesn&apos;t See Life as Something That Moves in Phases Where One Chapter Ends and Another Begins. For Him, Everything Stacks. New Interests, New Skills, New Ideas—They All Get Added Into the Mix.
          </p>
          <p className="text-base">
            In His Mid-Forties He Began Composing and Recording Music While Learning to Play Instruments, Developing a Particular Love for the Bass Guitar. In His Mid-Fifties He Stepped Onto a Stage for the First Time to Perform Stand-Up Comedy. At the Same Time He Continued Exploring Graphic Design, Technology, and a Wide Range of Creative and Technical Pursuits.
          </p>
          <p className="text-base">
            Scott is Constantly Studying, Learning, and Experimenting. He Understands That Ai is Reshaping the World and Believes the Right Response is to Learn How It Works, and Use the Technology as Another Tool for Creativity, Design, and Problem Solving.
          </p>
          <p className="text-base">
            His Mindset is Simple: <strong><b>Middle Age is Just the Beginning.</b></strong>
          </p>
          <p className="text-base">
            Scott is the First to Admit He Has Failed at More Things Than Most People Would Even Attempt to Begin (or Hasn&apos;t Succeeded Yet, Depending on Your Outlook). But Failure Has Never Been the End of the Story. When Something Doesn&apos;t Work, He Pivots, Restarts, and Fires Up His Creative Engines Once Again.
          </p>
          <p className="text-base">
            <BrandText>
              WildWorks Exists for One Reason: to Design and Build the World&apos;s Wildest Art, and Solve Problems That Others Simply Cannot.
            </BrandText>
          </p>

        {/* <div className="mt-6 space-y-2 text-left text-base leading-relaxed"> */}
          <p className="text-base">
            Based in Baltimore, Scott is Willing to Travel Anywhere on Earth to Create Extraordinary Stone Landscapes and Rock Art for People Who Wish to Own Exquisite One-of-a-Kind Things.
          </p>
          <p className="text-base">His Goals Are Simple and Ambitious:</p>
          <ol className="list-decimal list-outside pl-4 space-y-1 ">
            <li>
              To Become a Landscape Artist Whose Work Stands Among the Finest in the World. And...
            </li>
            <li>
              To Work with as Many People, to Help Them Solve as Many Problems, as is Humanly Possible.
            </li>
          </ol>
          <p className="text-base">Scott G. Dietz Believes Above Everything Else:</p>
          <p className="text-base">
            Keep Creating. Keep Building. Always Be Willing to Help Others Solve Their Problems. And Never Stop Getting Back Up.
          </p>
          <p className="text-base">
            If You Would Like a Work of Exquisite Art of Your Own, or Need Help Solving One or More Problems—
          </p>
        </div>

        <h2 className="mb-4 mt-6 text-center text-xl sm:text-2xl">Call or Text WildWorks:</h2>
        <a href="tel:+18776002474" aria-label="Call WildWorks at 1-877-600-2474" className="wild-brand-phone block py-2 text-center text-4xl sm:py-4 sm:text-6xl min-h-[44px]">
          Call Now
        </a>
        <SubpageIScottCta />
        <p className="wild-brand-cta-big py-6 text-center">Scott.</p>

        <p className="wild-brand-contact-note pt-4 text-center text-md sm:text-base">
          Or DM Scott Directly on X or WhatsApp
        </p>

        
        <div className="mt-4 flex justify-center gap-4">
          
          <a
            href="https://x.com/WildWorksArt"
            aria-label="X (Twitter)"
            className="wild-brand-social-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="currentColor"
              aria-hidden
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://api.whatsapp.com/send?phone=18776002474"
            aria-label="WhatsApp"
            className="wild-brand-social-link wild-brand-social-link--whatsapp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="currentColor"
              aria-hidden
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
        </div>
        
      </section>

    </div>
  );
}
