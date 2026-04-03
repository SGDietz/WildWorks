"use client";

export default function AnimationBackground() {
  return (
    <iframe
      src="/1.html"
      title="Background animation"
      className="absolute inset-x-0 top-0 h-screen w-full border-0"
      style={{ zIndex: 0, pointerEvents: "none" }}
      aria-hidden
    />
  );
}
