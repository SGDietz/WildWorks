// H457 (Grok, 2026-09-02): the Talk to iScott icon. G: "It's more like a throwing star... The one that
// you gave me has nice arcing... Give me something more interesting." Three filled four-point sparkles,
// one large + two smaller (option 2). Rendered twice inside the H417 duplicate-glyph wrap: a shadow copy
// offset by translateY (attached edge, no filter) under a face copy in currentColor. Home only.
export default function TalkArcClusterIcon() {
  const glyph = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="none" aria-hidden="true" className="ww-talk-arc-cluster h-5 w-5">
          <g transform="translate(0.15 2.55) scale(0.76)"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /></g>
          <g transform="translate(13.15 0.35) scale(0.40)"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /></g>
          <g transform="translate(14.55 13.55) scale(0.28)"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /></g>
    </svg>
  );
  return (
    <span className="ww-home-btn-icon" aria-hidden="true">
      <span className="ww-home-btn-icon__shadow">{glyph}</span>
      <span className="ww-home-btn-icon__face">{glyph}</span>
    </span>
  );
}
