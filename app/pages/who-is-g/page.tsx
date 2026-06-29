import AspectRatioImage from "../../components/AspectRatioImage";
import BrandText from "../../components/BrandText";

export default function WhoIsG() {
  return (
    <div className="wild-subpage wild-subpage--bio mx-auto lg:max-w-5xl py-4 discordSection discordSection--1">
      {/* Image constrained to same width as header separator line */}
      <section className="wild-subpage-hero relative mx-auto flex w-full items-center justify-center overflow-hidden px-4 sm:px-6">
        <AspectRatioImage
          src="/ww-art-wilds.jpeg"
          alt="Scott G. Dietz with WildWorks stonework"
          priority
          sizes="(max-width: 64rem) 100vw, 64rem"
        />
        <div className="absolute inset-0  pointer-events-none" aria-hidden />
      </section>

      <section className="wild-subpage-section wild-subpage-contact discordSection discordSection--2 mx-auto w-full px-4 pt-6 text-white sm:px-6 sm:pt-8 ">
        <div className="space-y-2 text-left text-sm leading-relaxed">
          <h1 className="text-2xl sm:text-3xl">Who is Scott G. Dietz?</h1>
          <p className="text-base">
            From 6 months old, Scott G. Dietz was raised in Bel Air, Maryland, just north of Baltimore City. His roots run deep in the area—both of his parents were born and raised in Baltimore City.
          </p>
          <p className="text-base">
            As a kid, Scott was impossible to control—undisciplined, restless, and constantly pushing boundaries. As he grew and matured, that same force became something powerful: explosive creative energy focused on creativity and building.
          </p>
          <p className="text-base">
            For more than 40 years, Scott has channeled that energy into the craft of stone. He is a fine artist, master stonemason, and relentless problem solver known for charging directly into the most complex and unconventional problems people face. His work blends creativity, craftsmanship, and engineering into rock art—stone landscapes designed to feel timeless, powerful, and naturally rooted in the land.
          </p>
          <h2 className="text-xl sm:text-2xl mt-6">A Life of Constant Reinvention</h2>
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
            His mindset is simple: <strong><b>Middle Age is Just the Beginning.</b></strong>
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

        <h2 className="mb-4 mt-6 text-center text-xl sm:text-2xl">Call or Text Directly:</h2>
        <a href="tel:+14437972166" className="wild-brand-phone block py-2 text-center text-4xl sm:py-4 sm:text-6xl min-h-[44px]">
          +1(443) 797-2166
        </a>
        <p className="wild-brand-cta-big py-6 text-center">Scott.</p>

        <p className="wild-brand-contact-note pt-4 text-center text-md sm:text-base">
          or DM Scott directly on X or WhatsApp
        </p>

        
        <div className="mt-4 flex justify-center gap-4">
          
          <a
            href="https://x.com/OfficialSGDietz"
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
            href="https://api.whatsapp.com/send?phone=14437972166"
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
