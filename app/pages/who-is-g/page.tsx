import AspectRatioImage from "../../components/AspectRatioImage";
import BrandText from "../../components/BrandText";
import SubpageCallCta from "../../components/SubpageCallCta";
import SubpageIScottCta from "../../components/SubpageIScottCta";

export default function WhoIsG() {
  return (
    <div className="wild-subpage wild-subpage--bio mx-auto lg:max-w-5xl py-4 discordSection discordSection--1">
      {/* Image constrained to same width as header separator line */}
      <section className="wild-subpage-hero relative mx-auto flex w-full items-center justify-center overflow-hidden px-4 sm:px-6">
        <AspectRatioImage
          src="/Potter-20260801-b.png"
          alt="Scott G. Dietz beside WildWorks natural stone steps and landscape"
          className="object-cover object-center scale-[1.04]"
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
          <h2 className="wild-bio-reinvention-heading text-2xl sm:text-3xl mt-6">A Life of Constant Reinvention</h2>
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

        <h2 className="mb-4 mt-6 text-center text-xl sm:text-2xl">Start the Conversation:</h2>
        <SubpageIScottCta />
        <SubpageCallCta />
        <p className="wild-brand-cta-big py-6 text-center">Scott.</p>
      </section>

    </div>
  );
}
