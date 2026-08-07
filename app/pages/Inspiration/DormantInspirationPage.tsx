"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AspectRatioImage from "../../components/AspectRatioImage";

gsap.registerPlugin(ScrollTrigger);

export default function DormantInspirationPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const ctx = gsap.context(() => {
        const duration = 1;
        const ease = "power3.out";

        // Hero: scale + fade in
        gsap.from(".inspiration-hero-wrap", {
          scale: 1.08,
          opacity: 0,
          duration: duration + 0.2,
          ease,
          delay: 0.15,
        });

        gsap.from(".inspiration-hero-image", {
          scale: 1.2,
          opacity: 0,
          duration: duration + 0.5,
          ease: "power2.out",
          delay: 0.2,
        });
        gsap.from(".inspiration-hero-image-inner", {
          clipPath: "inset(0 0 100% 0)",
          duration: 1.4,
          ease: "power3.inOut",
          delay: 0.35,
        });

        // Text: replay whenever visible (on enter and on enter back)
        const textTriggerActions = "restart none restart none";

        // First section title — character split
        const titleSection = document.querySelector(".inspiration-title-section");
        if (titleSection) {
          gsap.from(".inspiration-title-char", {
            scrollTrigger: {
              trigger: titleSection,
              start: "top 85%",
              end: "bottom 15%",
              toggleActions: textTriggerActions,
            },
            y: 28,
            opacity: 0,
            duration: 0.5,
            stagger: 0.03,
            ease,
          });
          gsap.from(".inspiration-title-line", {
            scrollTrigger: {
              trigger: titleSection,
              start: "top 85%",
              end: "bottom 15%",
              toggleActions: textTriggerActions,
            },
            scaleX: 0,
            opacity: 0,
            duration: 0.9,
            ease,
            delay: 0.4,
          });
        }

        // First block of text — stagger paragraphs
        gsap.from(".inspiration-intro .inspiration-p", {
          scrollTrigger: {
            trigger: ".inspiration-intro",
            start: "top 82%",
            end: "bottom 15%",
            toggleActions: textTriggerActions,
          },
          y: 28,
          opacity: 0,
          duration: 0.7,
          stagger: 0.12,
          ease,
        });

        // Section headings
        gsap.utils.toArray<HTMLElement>(".inspiration-heading").forEach((el) => {
          const line = el.nextElementSibling?.classList.contains("inspiration-heading-line")
            ? el.nextElementSibling
            : null;
          gsap.from(el, {
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              end: "bottom 15%",
              toggleActions: textTriggerActions,
            },
            y: 48,
            opacity: 0,
            rotationX: -8,
            transformPerspective: 800,
            duration: 1,
            ease: "power2.out",
          });
          if (line) {
            gsap.from(line, {
              scrollTrigger: {
                trigger: line,
                start: "top 90%",
                end: "bottom 15%",
                toggleActions: textTriggerActions,
              },
              scaleX: 0,
              opacity: 0,
              duration: 0.7,
              ease,
              delay: 0.15,
            });
          }
        });

        // Text blocks (paragraphs)
        gsap.utils.toArray<HTMLElement>(".inspiration-text-block").forEach((block) => {
          const pars = block.querySelectorAll("p");
          gsap.from(pars, {
            scrollTrigger: {
              trigger: block,
              start: "top 85%",
              end: "bottom 15%",
              toggleActions: textTriggerActions,
            },
            y: 22,
            opacity: 0,
            duration: 0.65,
            stagger: 0.08,
            ease,
          });
        });

        // Scroll-triggered: image reveals — only on first time in view (initial load)
        gsap.utils.toArray<HTMLElement>(".inspiration-image-wrap").forEach((wrap, i) => {
          const inner = wrap.querySelector<HTMLElement>(".inspiration-image-inner");
          const isEven = i % 2 === 0;
          if (inner) {
            gsap.from(inner, {
              scrollTrigger: {
                trigger: wrap,
                start: "top 88%",
                toggleActions: "play none none none",
              },
              clipPath: isEven
                ? "inset(0 0 100% 0)"
                : "inset(100% 0 0 0)",
              duration: 1.1,
              ease: "power3.out",
            });
          }
          gsap.from(wrap, {
            scrollTrigger: {
              trigger: wrap,
              start: "top 90%",
              toggleActions: "play none none none",
            },
            y: 56,
            scale: 0.96,
            opacity: 0,
            duration: 1.05,
            ease: "power2.out",
          });
        });

        // Final CTA section
        const ctaSection = document.querySelector(".inspiration-cta");
        const ctaTrigger = {
          trigger: ctaSection,
          start: "top 82%" as const,
          end: "bottom 10%",
          toggleActions: textTriggerActions,
        };
        if (ctaSection) {
          gsap.from(ctaSection.querySelector(".inspiration-cta-title"), {
            scrollTrigger: ctaTrigger,
            y: 32,
            scale: 0.97,
            opacity: 0,
            duration: 1,
            ease: "power2.out",
          });
          gsap.from(ctaSection.querySelector(".inspiration-cta-title-line"), {
            scrollTrigger: ctaTrigger,
            scaleX: 0,
            opacity: 0,
            duration: 0.75,
            delay: 0.2,
            ease,
          });
          gsap.from(ctaSection.querySelectorAll(".inspiration-cta-p"), {
            scrollTrigger: ctaTrigger,
            y: 20,
            opacity: 0,
            duration: 0.6,
            stagger: 0.06,
            delay: 0.15,
            ease,
          });
          gsap.from(ctaSection.querySelector(".inspiration-cta-phone"), {
            scrollTrigger: ctaTrigger,
            scale: 0.96,
            opacity: 0,
            duration: 0.8,
            delay: 0.4,
            ease,
          });
          gsap.from(ctaSection.querySelector(".inspiration-cta-name"), {
            scrollTrigger: ctaTrigger,
            y: 20,
            opacity: 0,
            duration: 0.7,
            delay: 0.5,
            ease,
          });
          gsap.from(ctaSection.querySelector(".inspiration-cta-socials"), {
            scrollTrigger: ctaTrigger,
            y: 16,
            opacity: 0,
            duration: 0.6,
            delay: 0.6,
            ease,
          });
          gsap.from(ctaSection.querySelector(".inspiration-cta-dm"), {
            scrollTrigger: ctaTrigger,
            opacity: 0,
            duration: 0.5,
            delay: 0.75,
            ease,
          });
        }
      }, containerRef);

      return () => ctx.revert();
    },
    { scope: containerRef, dependencies: [] }
  );

  return (
    <div
      ref={containerRef}
      className="discordSection discordSection--1 mx-auto lg:max-w-5xl py-4"
    >
      <section className="inspiration-hero-wrap relative flex w-full mx-auto items-center justify-center overflow-hidden px-4 sm:px-6">
        <div className="inspiration-hero-image relative w-full max-w-5xl overflow-hidden rounded-sm">
          <div className="inspiration-hero-image-inner relative w-full h-full">
            <AspectRatioImage
              src="/LewFrenchInspiration-2.png"
              alt="Lew French inspiration — stone craftsmanship"
              priority
              sizes="(max-width: 64rem) 100vw, 64rem"
            />
          </div>
        </div>
      </section>

      <section className="discordSection discordSection--2 mx-auto w-full px-4 py-4 text-white sm:px-6 sm:py-6">
        <div className="inspiration-title-section flex flex-col items-center mb-4">
          <h2
            className="inspiration-main-title flex flex-wrap items-center justify-center text-2xl text-center px-4 z-10 pointer-events-none sm:px-6 sm:text-4xl"
            style={{ fontFamily: "var(--font-serif), serif" }}
            aria-label="Inspiration: Lew French"
          >
            {"Inspiration: Lew French".split("").map((char, i) => (
              <span
                key={`${i}-${char}`}
                className="inspiration-title-char inline-block"
                style={{
                  color: ["#ffffff", "#e8e0d5", "#d4c4b0", "#f5f0e8"][i % 4],
                }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </h2>
          <span className="inspiration-title-line mt-3 block h-px w-[120px] origin-center bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        </div>
        <div className="inspiration-intro">
          <p className="inspiration-p text-base py-2">
            Project Wildfire Draws Direct Inspiration from the Work of Master Stone Artisan{" "}
            <strong>Lew French</strong> of{" "}
            <a
              href="https://lewfrenchstone.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/60 underline-offset-2 hover:decoration-white"
            >
              LewFrenchStone.com
            </a>
            .
          </p>
          <p className="inspiration-p text-base py-2">
            As You Can See in the Photo Above, Lew is a True Artist of Natural Stone. His Eye for Proportion, Balance, and Flow is Exceptional—I Hold His Work in the Highest Regard.
          </p>
        </div>
        <h2 className="inspiration-heading text-2xl pt-2">How It Started</h2>
        <span className="inspiration-heading-line block h-0.5 w-16 bg-white/60 origin-left mb-1" />
        <div className="inspiration-text-block">
          <p className="text-base py-2">
            Over More Than 15 Years, We Had Built Nearly Everything Around a Couple in Lutherville, Md&apos;s Home: the Front Masonry Porch, 2 Walks, Planting Beds, Landscape Lighting Front and Back, and the Rear Bluestone Patio with Natural Stone Seat Wall. As I Walk Around the House Today, I Look with Pride, as Everything We Had Built Was Beautiful Artwork That Settled in with No Trip Hazards or Visual Blemishes.
          </p>
          <p className="text-base py-2">
            In the Fall of 2025 the Husband Had a Friend Send Him a Picture of an Outdoor Fireplace That the Friend Built Himself. Large Scale, About the Same Dimensions as Project Wildfire (14 ft Wide x 14ish ft Tall). The Wife, Knowing That the Husband Loved to Sit Outside on the Patio We Had Built for Them and Smoke His Cigars, Said, &quot;Why Don&apos;t You Have Scott Build One for You.&quot; As He Was Currently Sitting Around a Small Metal Firepit, She Felt Like He Earned an Upgrade.
          </p>
          <p className="text-base py-2">
            The Husband Reached Out to Me, Sent Me the Picture His Friend Had Sent Him. I Sent Him a Link of Lew&apos;s Fireplace, and Asked What He Thought of That Style. We Had Not Yet Agreed to a Price, But He Said, &quot;Put Us Into Your Schedule.&quot;
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex max-w-6xl mx-auto items-center justify-center overflow-hidden px-4 sm:px-6 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/McNulty-Sketch-Cr.jpg"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural living space"
            priority
            sizes="(max-width: 64rem) 100vw, 64rem"
          />
        </div>
      </section>

      <section className="discordSection discordSection--3 mx-auto w-full px-4 py-2 text-white sm:px-6 sm:py-4">
        <h2 className="inspiration-heading text-2xl font-bold">Design: Sketch</h2>
        <span className="inspiration-heading-line block h-0.5 w-16 bg-white/60 origin-left mb-1" />
        <div className="inspiration-text-block">
          <p className="text-base py-2">
            I Had Transitioned to CAD Years Earlier and Hadn&apos;t Done a Hand Rendering in Nearly a Decade. Because of the Complexity of the Design, I Felt Like Picking Up a Pencil and Sketching.
          </p>
          <p className="text-base py-2">
            Truly, I Felt Like the Ideas Just Flowed Out of Me Almost on Auto Pilot, It Was Almost Effortless, with Very Little Thinking. I Do Many Other Types of Art, Including Music, Stand-Up Comedy, Graphic Design, and Generally These Things Are Painstaking, Iteration After Iteration, Seriously Heavy Brain Work That Takes Days and Months to Get Right. But to My Amazement, in About 2 Hours, I Had Something I Really Liked, the Design Above.
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex max-w-6xl mx-auto items-center justify-center overflow-hidden px-4 mt-2 sm:px-6 sm:mt-4 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/McNultyDesign-2.png"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural living space"
            priority
            sizes="(max-width: 64rem) 100vw, 64rem"
          />
        </div>
      </section>

      <section className="discordSection discordSection--4 space-y-2 mx-auto w-full px-4 py-4 text-white sm:px-6 sm:py-6 leading-[1]">
        <h2 className="inspiration-heading text-2xl font-bold">Stone Purchasing</h2>
        <span className="inspiration-heading-line block h-0.5 w-16 bg-white/60 origin-left mb-1" />
        <div className="inspiration-text-block">
          <p className="text-base ">
            The Day After I Got the Go Ahead, I Started Stone Hunting.
          </p>
          <p className="text-base ">
            Sourcing the Stone Was Tricky. All of the Larger Pieces Were to Be One-of-a-Kind, Selected Individually for How Well They Fit Into the Actual Design. Finding These Stones Was Going to Take Patience, Experience, Traveling, and None Were Going to Come Cheap.
          </p>
          <p className="text-base ">
            I Visited Numerous Retailers and Quarries, and Took Every Stone in the Design and Did My Best to Find It in Reality. The High Horizontal Stone in the Original Design Was Drawn at Almost 12 Feet Wide. I Couldn&apos;t Find Anything That Big, But I Found a Stone 10&apos; with Cutouts on Each End. I Found the Other Stones, Literally One at a Time, from Various Sources, and Then Erased and Redrew the Design with the New Stones in Place, Above.
          </p>
          <p className="text-base ">
            This Was Version 2.0 That I Showed the Clients, By Text. I Was Not Happy with It, Thought Something Was Missing.
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex w-full mx-auto items-center justify-center overflow-hidden px-4 mt-2 sm:px-6 sm:mt-4 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/20260103_204542-2-high.png"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural living space"
            priority
            sizes="(max-width: 64rem) 100vw, 64rem"
          />
        </div>
      </section>

      <section className="discordSection discordSection--2 mx-auto w-full px-4 py-2 text-white sm:px-6 sm:py-4">
        <div className="inspiration-text-block">
          <p className="text-base">
            I Took About 2 Hours, and Started Into More Curved Outer Edges. I Abandoned the Concept After Numerous Iterations, as I Just Could Not Get Anything to Look Pleasing. As I Look at It Now Upon Writing This, This Style of Design Could Perhaps Be Magnificent for a Future Build. King Cobra.
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex w-full mx-auto items-center justify-center overflow-hidden px-4 mt-2 sm:px-6 sm:mt-4 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/20251222_082817-1-2-high.png"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural living space"
            priority
            sizes="(max-width: 64rem) 100vw, 64rem"
          />
        </div>
      </section>

      <section className="discordSection discordSection--3 inspiration-cta mx-auto w-full px-4 py-4 text-white sm:px-6 sm:py-6">
        <div className="inspiration-text-block">
          <p className="text-base ">
            I Realized That We Had a Pallet of 3 Superstepper Stones, Massive, Chunky, and Two of Them Might Be Perfect to Cantilever Out as Shoulders and Be Quite the Spectacular Finishing Touch to the Entire Project.
          </p>
          <p className="text-base "></p>
          <p className="text-base ">
            As I Write This, We Are at the Point in the Build Where We Need to Actually Figure Out How to Engineer Building Them Into the Firestack, and Do So in a Way That is Durable and Will Last. Certainly, Everyone is Going to Want to Climb Up, and Stand and Sit on Them (I&apos;ll Be First).
          </p>
          <p className="text-base ">
            For All Its Imperfections, Above is the Final Design. We Shall See How Close We Come to This After the Build!
          </p>
        </div>
        <h2 className="inspiration-cta-title pt-6 pb-2 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif), serif" }}>
          Project Wildfire
        </h2>
        <span className="inspiration-cta-title-line block h-1 w-24 bg-white/80 origin-left my-2" />
        <div>
          <p className="inspiration-cta-p text-base ">
            Is an Original, Hand-Built Outdoor Fireplace, in No Way a Reproduction. It is a Custom Stone Structure Built in My Own Voice—Shaped By Decades of Creative Experience—While Openly Acknowledging the Influence of a Craftsman Whose Work Continues to Inspire Me.
          </p>
          <p className="inspiration-cta-p text-base ">
            As Isaac Newton Wrote, &quot;If I Have Seen Further, It is By Standing on the Shoulders of Giants.&quot;
          </p>
          <p className="inspiration-cta-p text-base ">
            Right Now, I&apos;m Proudly Standing on Lew French&apos;s Shoulders.
          </p>
          <p className="inspiration-cta-p text-base ">
            If You Would Like a Fireplace Along These Lines, Inside or Outside of Your Home, Please Feel Free to Call Now:
          </p>
        </div>

        <a
          href="tel:+18776002474"
          className="inspiration-cta-phone block pt-4 mt-2 text-4xl text-center text-white/90 sm:mt-4 sm:text-5xl min-h-[44px] mb-6 sm:mb-10 transition-opacity hover:opacity-90"
        >
          1-877-600-2474
        </a>
        <h1 className="inspiration-cta-name text-center text-5xl sm:text-6xl mb-6 sm:mb-12">Scott</h1>

        <div className="inspiration-cta-socials mt-8 flex justify-center gap-4 sm:mt-10">
          <a
            href="https://x.com/WildWorksArt"
            aria-label="X (Twitter)"
            className="flex h-12 w-12 items-center justify-center text-[#FFFFFF] transition-opacity hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
        <p className="inspiration-cta-dm pt-4 text-center text-sm text-white/90 sm:text-base">
          Or DM Me Directly on X
        </p>
      </section>
    </div>
  );
}
