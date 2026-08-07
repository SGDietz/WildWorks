import AspectRatioImage from "../../components/AspectRatioImage";
import BrandText from "../../components/BrandText";

export default function WhoIsG() {
  return (
    <div className="wild-subpage wild-subpage--bio mx-auto lg:max-w-5xl py-4 discordSection discordSection--1">
      {/* Image constrained to same width as header separator line */}
      <section className="wild-subpage-hero relative mx-auto flex w-full items-center justify-center overflow-hidden px-4 sm:px-6">
        <AspectRatioImage
          src="/wildworks-home-banner-20260726.png"
          alt="WildWorks natural stone steps and landscape with the artist standing beside the work"
          className="object-cover object-center scale-[1.04]"
          priority
          sizes="(max-width: 64rem) 100vw, 64rem"
        />
        <div className="absolute inset-0  pointer-events-none" aria-hidden />
      </section>

      <div className="wild-ab-band wild-tone--a wild-ab-band--intro">
      <section className="wild-subpage-section discordSection discordSection--2 mx-auto w-full px-4 pt-6 text-white sm:px-6 sm:pt-8 ">
        <div className="space-y-2 text-left text-sm leading-relaxed">
          <h1 id="ww-bio-primary-heading" className="text-2xl sm:text-3xl">Who is Scott G. Dietz?</h1>
          <p className="text-base">
            From 6 months old, Scott G. Dietz was raised in Bel Air, Maryland, just north of Baltimore City. His roots run deep in the area—both of his parents were born and raised in Baltimore City.
          </p>
          <p className="text-base">
            As a kid, Scott was impossible to control—undisciplined, restless, and constantly pushing boundaries. As he grew and matured, that same force became something powerful: explosive creative energy focused on creativity and building.
          </p>
          <p className="text-base">
            For more than 40 years, Scott has channeled that energy into the craft of stone. He is a fine artist, master stonemason, and relentless problem solver known for charging directly into the most complex and unconventional problems people face. His work blends creativity, craftsmanship, and engineering into rock art—stone landscapes designed to feel timeless, powerful, and naturally rooted in the land.
          </p>
        </div>
      </section>
      </div>

      <div className="wild-ab-band wild-tone--b">
      <section className="wild-subpage-section wild-subpage-contact discordSection discordSection--2 mx-auto w-full px-4 py-4 text-white sm:px-6">
        <div className="space-y-2 text-left text-sm leading-relaxed">
          <h2 className="wild-bio-reinvention-heading text-2xl sm:text-3xl">A Life of Constant Reinvention</h2>
          <p className="text-base">
            Scott doesn&apos;t see life as something that moves in phases where one chapter ends and another begins. For him, everything stacks. New interests, new skills, new ideas—they all get added into the mix.
          </p>
          <p className="text-base">
            In his mid-forties he began composing and recording music while learning to play instruments, developing a particular love for the bass guitar. In his mid-fifties he stepped onto a stage for the first time to perform stand-up comedy. At the same time he continued exploring graphic design, technology, and a wide range of creative and technical pursuits.
          </p>
          <p className="text-base">
            Scott is constantly studying, learning, and experimenting. He understands that Ai is reshaping the world and believes the right response is to learn how it works, and use the technology as another tool for creativity, design, and problem solving.
          </p>
          <p className="text-base">
            His mindset is simple:{" "}
            <span className="wild-bio-mindset-line">Life Begins at Middle Age</span>
          </p>
          <p className="text-base">
            Scott is the first to admit he has failed at more things than most people would even attempt to begin (or hasn&apos;t succeeded yet, depending on your outlook). But failure has never been the end of the story. When something doesn&apos;t work, he pivots, restarts, and fires up his creative engines once again.
          </p>
          <p className="text-base">
            <BrandText>
              WildWorks exists for one reason: to design and build the world&apos;s wildest art, and solve problems that others simply cannot.
            </BrandText>
          </p>

        {/* <div className="mt-6 space-y-2 text-left text-base leading-relaxed"> */}
          <p className="text-base">
            Based in Baltimore, Scott is willing to travel anywhere on Earth to create extraordinary stone landscapes and rock art for people who wish to own exquisite one-of-a-kind things.
          </p>
          <p className="text-base">His goals are simple and ambitious:</p>
          <ol className="list-decimal list-outside pl-4 space-y-1 ">
            <li>
              To become a landscape artist whose work stands among the finest in the world. And...
            </li>
            <li>
              To work with as many people, to help them solve as many problems, as is humanly possible.
            </li>
          </ol>
          <p className="text-base">Scott G. Dietz believes above everything else:</p>
          <p className="text-base">
            Keep creating. Keep building. Always be willing to help others solve their problems. And never stop getting back up.
          </p>
          <p className="text-base">
            If you would like a work of exquisite art of your own, or need help solving one or more problems—
          </p>
        </div>

      </section>
      </div>

    </div>
  );
}
