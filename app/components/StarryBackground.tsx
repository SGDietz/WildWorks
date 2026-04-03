"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

const STAR_COUNT = 480;
const MIN_DURATION = 100;
const MAX_DURATION = 200;
const MOVE_DISTANCE = 2200;
const ANGLE_DEG = 60;

const ANGLE_RAD = (ANGLE_DEG * Math.PI) / 180;
const MOVE_X = MOVE_DISTANCE * Math.cos(ANGLE_RAD);
const MOVE_Y = -MOVE_DISTANCE * Math.sin(ANGLE_RAD);

const TWINKLE_CHANCE = 0.28;
const TWINKLE_DURATION_MIN = 2;
const TWINKLE_DURATION_MAX = 5;

function getRandom(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createStars() {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const opacity = getRandom(0.35, 0.85);
    const twinkle = Math.random() < TWINKLE_CHANCE;
    return {
      id: i,
      left: getRandom(0, 100),
      top: getRandom(0, 100),
      size: getRandom(1, 2.5),
      opacity,
      duration: getRandom(MIN_DURATION, MAX_DURATION),
      phase: getRandom(0, 1),
      twinkle,
      twinkleDuration: twinkle ? getRandom(TWINKLE_DURATION_MIN, TWINKLE_DURATION_MAX) : 0,
      twinkleDelay: twinkle ? getRandom(0, 4) : 0,
    };
  });
}

type Star = ReturnType<typeof createStars>[number];

/** ms between meteors when idle — kept fairly rare vs. typical Grok-style pages */
const SHOOTING_STAR_GAP_MIN = 12_000;
const SHOOTING_STAR_GAP_MAX = 36_000;

type MeteorParams = {
  id: string;
  leftPct: number;
  topPct: number;
  angleDeg: number;
  lengthPx: number;
  travelPx: number;
  duration: number;
};

function createMeteorParams(): MeteorParams {
  const angleDeg = getRandom(30, 52);
  const travelPx = getRandom(480, 880);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    leftPct: getRandom(-12, 62),
    topPct: getRandom(-10, 28),
    angleDeg,
    lengthPx: getRandom(100, 200),
    travelPx,
    duration: getRandom(0.5, 0.9),
  };
}

function ShootingStar({
  params,
  onComplete,
}: {
  params: MeteorParams;
  onComplete: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rad = (params.angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * params.travelPx;
      const dy = Math.sin(rad) * params.travelPx;

      gsap.set(el, { x: 0, y: 0, opacity: 0 });
      gsap
        .timeline({
          onComplete,
          defaults: { ease: "none" },
        })
        .to(el, { opacity: 0.95, duration: 0.07, ease: "power2.out" }, 0)
        .to(
          el,
          { x: dx, y: dy, duration: params.duration, ease: "power1.in" },
          0
        )
        .to(
          el,
          {
            opacity: 0,
            duration: params.duration * 0.42,
            ease: "power2.in",
          },
          params.duration * 0.34
        );
    },
    { scope: wrapperRef, dependencies: [params.id] }
  );

  return (
    <div
      ref={wrapperRef}
      className="absolute will-change-[transform,opacity]"
      style={{
        left: `${params.leftPct}%`,
        top: `${params.topPct}%`,
        pointerEvents: "none",
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: `${params.lengthPx}px`,
          height: "2px",
          transform: `rotate(${params.angleDeg}deg)`,
          transformOrigin: "0 50%",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.98) 0%, rgba(210,230,255,0.45) 42%, transparent 100%)",
          boxShadow:
            "0 0 10px 2px rgba(255,255,255,0.25), 0 0 4px 1px rgba(200,220,255,0.35)",
        }}
      />
    </div>
  );
}

export default function StarryBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement[]>([]);
  const [stars, setStars] = useState<Star[] | null>(null);
  const [meteor, setMeteor] = useState<MeteorParams | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setStars(createStars());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (meteor !== null) return;
    const delay = getRandom(SHOOTING_STAR_GAP_MIN, SHOOTING_STAR_GAP_MAX);
    const t = window.setTimeout(() => setMeteor(createMeteorParams()), delay);
    return () => clearTimeout(t);
  }, [meteor]);

  useGSAP(
    () => {
      if (!stars) return;
      starsRef.current.forEach((el, i) => {
        if (!el) return;
        const config = stars[i];
        const startX = config.phase * MOVE_X;
        const startY = config.phase * MOVE_Y;
        const firstSegmentDuration = (1 - config.phase) * config.duration;
        gsap.set(el, { x: startX, y: startY });
        gsap.to(el, {
          x: MOVE_X,
          y: MOVE_Y,
          duration: firstSegmentDuration,
          ease: "none",
          onComplete: () => {
            const tl = gsap.timeline({ repeat: -1, repeatDelay: 0 });
            tl.set(el, { x: 0, y: 0 }, 0).to(el, {
              x: MOVE_X,
              y: MOVE_Y,
              duration: config.duration,
              ease: "none",
            });
          },
        });

        if (config.twinkle && config.twinkleDuration > 0) {
          gsap.fromTo(
            el,
            { opacity: config.opacity },
            {
              opacity: 1,
              duration: config.twinkleDuration / 2,
              yoyo: true,
              repeat: -1,
              ease: "sine.inOut",
              delay: config.twinkleDelay,
            }
          );
        }
      });
    },
    { scope: containerRef, dependencies: [stars] }
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[1] bg-black/30"
      aria-hidden
      style={{ pointerEvents: "none" }}
    >
      {stars?.map((star, i) => (
        <div
          key={star.id}
          ref={(el) => {
            if (el) starsRef.current[i] = el;
          }}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            boxShadow: `0 0 ${star.size * 2}px ${star.size}px rgba(255,255,255,${star.opacity * 0.5})`,
          }}
        />
      ))}
      {meteor ? (
        <ShootingStar
          key={meteor.id}
          params={meteor}
          onComplete={() => setMeteor(null)}
        />
      ) : null}
    </div>
  );
}
