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
            Project Wildfire draws direct inspiration from the work of master stone artisan{" "}
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
            As you can see in the photo above, Lew is a true artist of natural stone. His eye for proportion, balance, and flow is exceptional—I hold his work in the highest regard.
          </p>
        </div>
        <h2 className="inspiration-heading text-2xl pt-2">How It Started</h2>
        <span className="inspiration-heading-line block h-0.5 w-16 bg-white/60 origin-left mb-1" />
        <div className="inspiration-text-block">
          <p className="text-base py-2">
            Over more than 15 years, we had built nearly everything around a couple in Lutherville, Md&apos;s home: the front masonry porch, 2 walks, planting beds, landscape lighting front and back, and the rear bluestone patio with natural stone seat wall. As I walk around the house today, I look with pride, as everything we had built was beautiful artwork that settled in with no trip hazards or visual blemishes.
          </p>
          <p className="text-base py-2">
            In the fall of 2025 the husband had a friend send him a picture of an outdoor fireplace that the friend built himself. Large scale, about the same dimensions as Project Wildfire (14 ft wide x 14ish ft tall). The wife, knowing that the husband loved to sit outside on the patio we had built for them and smoke his cigars, said, &quot;Why don&apos;t you have Scott build one for you.&quot; As he was currently sitting around a small metal firepit, she felt like he earned an upgrade.
          </p>
          <p className="text-base py-2">
            The husband reached out to me, sent me the picture his friend had sent him. I sent him a link of Lew&apos;s Fireplace, and asked what he thought of that style. We had not yet agreed to a price, but he said, &quot;Put us into your schedule.&quot;
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex max-w-6xl mx-auto items-center justify-center overflow-hidden px-4 sm:px-6 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/McNulty-Sketch-Cr.jpg"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural landscaping"
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
            I had transitioned to CAD years earlier and hadn&apos;t done a hand rendering in nearly a decade. Because of the complexity of the design, I felt like picking up a pencil and sketching.
          </p>
          <p className="text-base py-2">
            Truly, I felt like the ideas just flowed out of me almost on auto pilot, it was almost effortless, with very little thinking. I do many other types of art, including music, stand-up comedy, graphic design, and generally these things are painstaking, iteration after iteration, seriously heavy brain work that takes days and months to get right. But to my amazement, in about 2 hours, I had something I really liked, the design above.
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex max-w-6xl mx-auto items-center justify-center overflow-hidden px-4 mt-2 sm:px-6 sm:mt-4 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/McNultyDesign-2.png"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural landscaping"
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
            The day after I got the go ahead, I started stone hunting.
          </p>
          <p className="text-base ">
            Sourcing the stone was tricky. All of the larger pieces were to be one-of-a-kind, selected individually for how well they fit into the actual design. Finding these stones was going to take patience, experience, traveling, and none were going to come cheap.
          </p>
          <p className="text-base ">
            I visited numerous retailers and quarries, and took every stone in the design and did my best to find it in reality. The high horizontal stone in the original design was drawn at almost 12 feet wide. I couldn&apos;t find anything that big, but I found a stone 10&apos; with cutouts on each end. I found the other stones, literally one at a time, from various sources, and then erased and redrew the design with the new stones in place, above.
          </p>
          <p className="text-base ">
            This was Version 2.0 that I showed the clients, by text. I was not happy with it, thought something was missing.
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex w-full mx-auto items-center justify-center overflow-hidden px-4 mt-2 sm:px-6 sm:mt-4 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/20260103_204542-2-high.png"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural landscaping"
            priority
            sizes="(max-width: 64rem) 100vw, 64rem"
          />
        </div>
      </section>

      <section className="discordSection discordSection--2 mx-auto w-full px-4 py-2 text-white sm:px-6 sm:py-4">
        <div className="inspiration-text-block">
          <p className="text-base">
            I took about 2 hours, and started into more curved outer edges. I abandoned the concept after numerous iterations, as I just could not get anything to look pleasing. As I look at it now upon writing this, this style of design could perhaps be magnificent for a future build. King Cobra.
          </p>
        </div>
      </section>

      <section className="inspiration-image-wrap relative flex w-full mx-auto items-center justify-center overflow-hidden px-4 mt-2 sm:px-6 sm:mt-4 rounded-sm">
        <div className="inspiration-image-inner relative w-full overflow-hidden rounded-sm">
          <AspectRatioImage
            src="/20251222_082817-1-2-high.png"
            alt="WildWorks — Stone staircase and pathway leading to a rustic house with natural landscaping"
            priority
            sizes="(max-width: 64rem) 100vw, 64rem"
          />
        </div>
      </section>

      <section className="discordSection discordSection--3 inspiration-cta mx-auto w-full px-4 py-4 text-white sm:px-6 sm:py-6">
        <div className="inspiration-text-block">
          <p className="text-base ">
            I realized that we had a pallet of 3 superstepper stones, massive, chunky, and two of them might be perfect to cantilever out as shoulders and be quite the spectacular finishing touch to the entire project.
          </p>
          <p className="text-base "></p>
          <p className="text-base ">
            As I write this, we are at the point in the build where we need to actually figure out how to engineer building them into the firestack, and do so in a way that is durable and will last. Certainly, everyone is going to want to climb up, and stand and sit on them (I&apos;ll be first).
          </p>
          <p className="text-base ">
            For all its imperfections, above is the final design. We shall see how close we come to this after the build!
          </p>
        </div>
        <h2 className="inspiration-cta-title pt-6 pb-2 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif), serif" }}>
          Project Wildfire
        </h2>
        <span className="inspiration-cta-title-line block h-1 w-24 bg-white/80 origin-left my-2" />
        <div>
          <p className="inspiration-cta-p text-base ">
            Is an original, hand-built outdoor fireplace, in no way a reproduction. It is a custom stone structure built in my own voice—shaped by decades of creative experience—while openly acknowledging the influence of a craftsman whose work continues to inspire me.
          </p>
          <p className="inspiration-cta-p text-base ">
            As Isaac Newton wrote, &quot;If I have seen further, it is by standing on the shoulders of giants.&quot;
          </p>
          <p className="inspiration-cta-p text-base ">
            Right now, I&apos;m proudly standing on Lew French&apos;s shoulders.
          </p>
          <p className="inspiration-cta-p text-base ">
            If you would like a Fireplace along these lines, inside or outside of your home, please feel free to call me on my cell:
          </p>
        </div>

        <a
          href="tel:+14437972166"
          className="inspiration-cta-phone block pt-4 mt-2 text-4xl text-center text-white/90 sm:mt-4 sm:text-5xl min-h-[44px] mb-6 sm:mb-10 transition-opacity hover:opacity-90"
        >
          +1(443) 797-2166
        </a>
        <h1 className="inspiration-cta-name text-center text-5xl sm:text-6xl mb-6 sm:mb-12">Scott</h1>

        <div className="inspiration-cta-socials mt-8 flex justify-center gap-4 sm:mt-10">
          <a
            href="https://x.com/OfficialSGDietz"
            aria-label="X (Twitter)"
            className="flex h-12 w-12 items-center justify-center text-[#FFFFFF] transition-opacity hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://api.whatsapp.com/send?phone=14437972166"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#25D366] text-white transition-opacity hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>
        </div>
        <p className="inspiration-cta-dm pt-4 text-center text-sm text-white/90 sm:text-base">
          or DM Me directly on X or WhatsApp
        </p>
      </section>
    </div>
  );
}
