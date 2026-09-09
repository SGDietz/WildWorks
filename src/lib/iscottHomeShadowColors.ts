// G, 2026-09-07: "Finish the entire homepage. Everything, all black".
// The avatar is a separate document. Recolor its EXISTING shadow declarations
// only when embedded in Home. G: one effect only, x=0, y>=0, black.
export const iscottHomeShadowColorsScript = String.raw`
<script id="wildworks-home-shadow-colors">
(() => {
  // Grok H525 parent boot (carries H524's Home-only iframe boundary).
  (function wwParentHomeBoot(){
    try {
      if (window.parent && window.parent !== window) {
        var doc = window.parent.document;
        if (doc && doc.querySelector && doc.querySelector("#top.wild-home") && !doc.querySelector(".wild-legal-home")) {
          document.documentElement.classList.add("ww-parent-is-home");
        }
      }
    } catch (e) { /* cross-origin: leave standalone */ }
  })();
  if (!document.documentElement.classList.contains('ww-parent-is-home')) return;

  // H537: match the refined site buttons only when this document is embedded
  // in Home. The existing pseudo-element paints the Talk/Finish/Restart icon.
  // Keep status text, artwork, box shadows and standalone iScott unchanged.
  const controlPaint = document.createElement('style');
  controlPaint.dataset.wwHomeControlPaint = 'true';
  controlPaint.textContent = '@layer ww-home-control-paint {' +
    'html.ww-parent-is-home button.btn-wood::before {' +
    'filter:drop-shadow(0 1.25px 0 #000)!important;}' +
    '}';
  document.head.appendChild(controlPaint);

  const blackColors = value => value.replace(
    /(?:rgba?|hsla?|hwb|oklab|oklch|lab|lch|color)\([^()]*\)|#[\da-f]{3,8}\b|[a-z_-][\w-]*/gi,
    token => CSS.supports('color', token) ? '#000' : token,
  );
  const topDown = value => {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === '(') depth++;
      if (value[i] === ')') depth--;
      if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; }
    }
    parts.push(value.slice(start));
    const directed = parts.map(part => {
      let coordinate = 0;
      return part.replace(/(^|\s)(-?(?:\d*\.)?\d+)(px|em|rem|ex|ch|vw|vh|vmin|vmax)?(?=\s|$)/gi,
        (token, space, number, unit = '') => {
          coordinate++;
          if (coordinate === 1) return space + '0' + unit;
          if (coordinate === 2) return space + Math.abs(Number(number)) + unit;
          return token;
        });
    });
    // Keep one existing shadow, rather than layering several shadows.
    // The deepest existing stop retains the visible downward extent.
    const extent = part => {
      const lengths = [...part.replace(/#000\b/g, '').matchAll(/(?:^|\s)(-?(?:\d*\.)?\d+)(?:px|em|rem|ex|ch|vw|vh|vmin|vmax)?(?=\s|$)/gi)].map(m => Number(m[1]));
      return Math.abs(lengths[1] || 0) + (lengths[2] || 0);
    };
    return directed.reduce((best, part) => extent(part) > extent(best) ? part : best).trim();
  };
  const blackDropShadows = value => {
    let result = '', cursor = 0;
    const shadows = [];
    const finish = tail => {
      const rest = (result + tail).trim();
      return shadows.length ? ((rest === 'none' ? '' : rest + ' ') + 'drop-shadow(' + topDown(shadows.join(',')) + ')').trim() : value;
    };
    while (cursor < value.length) {
      const match = /drop-shadow\s*\(/i.exec(value.slice(cursor));
      if (!match) return finish(value.slice(cursor));
      const start = cursor + match.index;
      const body = start + match[0].length;
      let end = body, depth = 1;
      while (end < value.length && depth) {
        if (value[end] === '(') depth++;
        if (value[end] === ')') depth--;
        end++;
      }
      result += value.slice(cursor, start);
      shadows.push(topDown(blackColors(value.slice(body, end - 1))));
      cursor = end;
    }
    return finish('');
  };
  const recolorStyle = style => {
    for (const name of Array.from(style)) {
      const value = style.getPropertyValue(name);
      let black = value;
      if (name === 'text-shadow' || name === 'box-shadow') black = topDown(blackColors(value));
      else if (name === 'filter' || name === '-webkit-filter') black = blackDropShadows(value);
      // A complete shadow-valued token cannot be a text/icon foreground color.
      // Never recolor a shared single-color palette variable.
      else if (name.startsWith('--') && /shadow/i.test(name) && /-?[\d.]+(?:px|em|rem)\b/.test(value)) {
        black = value.includes('drop-shadow(') ? blackDropShadows(value) : topDown(blackColors(value));
      }
      if (black !== value) style.setProperty(name, black, style.getPropertyPriority(name));
    }
  };
  const recolorRules = rules => {
    for (const rule of rules) {
      if (rule.style) recolorStyle(rule.style);
      if (rule.cssRules) recolorRules(rule.cssRules);
      if (rule.styleSheet) {
        try { recolorRules(rule.styleSheet.cssRules); } catch {}
      }
    }
  };
  let frame = 0;
  const options = { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] };
  const paint = () => {
    observer.disconnect();
    for (const sheet of document.styleSheets) {
      try { recolorRules(sheet.cssRules); } catch {}
    }
    for (const element of document.querySelectorAll('[style]')) recolorStyle(element.style);
    for (const control of document.querySelectorAll('button.btn-wood')) {
      control.style.setProperty('text-shadow', '0 1.25px 0 #000', 'important');
    }
    observer.observe(document.documentElement, options);
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(paint);
  };
  const observer = new MutationObserver(schedule);
  paint();
  document.addEventListener('DOMContentLoaded', paint, { once: true });
  document.addEventListener('load', schedule, true);
  document.addEventListener('pointerover', schedule, true);
  document.addEventListener('focusin', schedule, true);
  window.addEventListener('resize', schedule);
})();
</script>
`;
