/**
 * WildWorks email theme.
 *
 * G, 2026-08-25: "All emails from WildWorks should be theme colors."
 *
 * Before this, every email invented its own browns and creams - #f6ead5,
 * #fffaf0, #d2a667, #a44b20, #6f2f12, #35180a, #75583e, #4a2410, #f9edd6,
 * #fff4e2, #e2c18b, #f4e2c2, #9a461c, #6d3012, #8d3e18, #6d5a49, #fff7df,
 * #4b230f, #a94f24. Seventeen-plus off-brand colours, none of them the five
 * locked ones. Everything an email paints now comes out of THEME below.
 *
 * THE FIVE ARE LOCKED (G, 2026-08-20 and again 2026-08-24 with roles). Never
 * add a sixth, never tint one, never swap which role a hex plays. If a design
 * need cannot be met with these five, surface the trade-off to G rather than
 * inventing a colour here.
 *
 * Contrast note, so nobody "fixes" it later: Text 3 (#f08c28) is an orange on
 * an orange card (#e96819) and is NOT readable as body copy. It is used here
 * only for rules, borders and accent edges. Copy is Text 1, labels are Text 2.
 * That keeps the roles intact AND keeps the mail legible.
 *
 * Email clients strip <style> blocks and do not support CSS variables, so
 * every value is inlined at call time. Do not refactor these into classes.
 */

export const THEME = {
  /** Primary background - the area around the card. */
  pageBg: "#c44d0b",
  /** Secondary / card - the panel the content sits on. */
  cardBg: "#e96819",
  /** Text 1 - body copy and headings. */
  text1: "#fce0ad",
  /** Text 2 - labels, meta, secondary lines. */
  text2: "#edc775",
  /** Text 3 - accent only: rules, borders, bullets. Not body copy. */
  text3: "#f08c28",
} as const;

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

/**
 * The one shell every WildWorks email is built from.
 * `bodyHtml` is trusted, pre-escaped markup from the helpers below.
 */
export function emailShell(args: {
  title: string;
  heading: string;
  eyebrow?: string;
  bodyHtml: string;
  maxWidth?: number;
}): string {
  const eyebrow = args.eyebrow
    ? `<p style="margin:0 0 6px;color:${THEME.text2};font-family:${SANS};font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">${escapeHtml(args.eyebrow)}</p>`
    : "";
  return [
    `<!doctype html><html><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${escapeHtml(args.title)}</title></head>`,
    `<body style="margin:0;padding:0;background:${THEME.pageBg};color:${THEME.text1};font-family:${SANS}">`,
    `<div style="max-width:${args.maxWidth ?? 720}px;margin:0 auto;padding:28px 18px">`,
    `<div style="background:${THEME.cardBg};border:1px solid ${THEME.text3};border-radius:12px;padding:26px">`,
    eyebrow,
    `<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:28px;line-height:1.2;color:${THEME.text1}">${escapeHtml(args.heading)}</h1>`,
    args.bodyHtml,
    `</div></div></body></html>`,
  ].join("");
}

/** A section heading inside the card. */
export function emailSubheading(text: string): string {
  return `<h2 style="margin:24px 0 10px;font-family:${SERIF};font-size:20px;color:${THEME.text1}">${escapeHtml(text)}</h2>`;
}

/** A normal paragraph. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${THEME.text1}">${html}</p>`;
}

/** A callout block - summary, warning, anything that needs to stand off. */
export function emailCallout(args: { label?: string; html: string }): string {
  const label = args.label
    ? `<p style="margin:0 0 6px;color:${THEME.text2};font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">${escapeHtml(args.label)}</p>`
    : "";
  return `<div style="margin:0 0 22px;padding:16px 18px;background:${THEME.pageBg};border-left:4px solid ${THEME.text3};border-radius:8px">${label}<p style="margin:0;font-size:15px;line-height:1.55;color:${THEME.text1}">${args.html}</p></div>`;
}

/** Label/value rows. Labels are Text 2, values are Text 1. */
export function emailRows(rows: Array<[string, string | null | undefined]>): string {
  const live = rows.filter(([, value]) => Boolean(value));
  if (!live.length) return "";
  const body = live
    .map(
      ([label, value]) =>
        `<tr><td style="width:150px;padding:7px 12px 7px 0;color:${THEME.text2};font-size:14px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;color:${THEME.text1};font-size:14px;font-weight:600;white-space:pre-wrap">${escapeHtml(String(value))}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">${body}</table>`;
}

/** A button. Dark ground so Text 1 stays readable on it. */
export function emailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 16px;border-radius:7px;background:${THEME.pageBg};border:1px solid ${THEME.text3};color:${THEME.text1};text-decoration:none;font-weight:700;font-size:14px">${escapeHtml(label)}</a>`;
}

/** An inline link inside copy. */
export function emailLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${THEME.text1};font-weight:700;text-decoration:underline">${escapeHtml(label)}</a>`;
}

/** Preformatted block - transcripts, digests, anything already line-broken. */
export function emailPre(text: string): string {
  return `<div style="white-space:pre-wrap;background:${THEME.pageBg};border:1px solid ${THEME.text3};border-radius:8px;padding:16px;font-family:${SANS};font-size:14px;line-height:1.55;color:${THEME.text1}">${escapeHtml(text)}</div>`;
}
