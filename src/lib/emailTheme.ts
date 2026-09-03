/**
 * WildWorks owner-email theme. H434.
 *
 * Scott (word for word), 2026-09-02 10:46 AM ET:
 *   "If it's a new one, it's not nearly as attractive as I would like. Make it
 *    mostly the orange card color, the secondary color, the card color. I mean,
 *    that is just not attractive. It needs to be much more attractive."
 *   "Primary background  #c44d0b
 *    Secondary / card    #e96819
 *    Text 1              #fce0ad
 *    Text 2              #edc775
 *    Text 3              #f08c28 I want these emails to be beautiful, that I
 *    get, from Wildworks, and in the brand colors."
 *   "This is the look on my phone. It's just awful of the email"
 *
 * H433 painted the page Primary #c44d0b. Gmail Android 10:39 (session 90328d60)
 * was a dark brick. H434: the body IS Secondary / card #e96819 edge to edge.
 * Primary #c44d0b is a thin kicker strip only, so Text 3 sits on primary and
 * is not body on the card. Text 1 stays type. No sixth. No cream-as-background.
 *
 * Claude H433 light edit kept: color-scheme / supported-color-schemes light
 * metas, plus bgcolor on tables (and body).
 *
 * One shell. Owner mail transposes through it:
 *   iscott_lead (complete + INCOMPLETE), voice_lead, voicemail,
 *   telemetry_message, telemetry_digest.
 * Visitor receipt stays off.
 *
 * Email clients strip <style> and ignore CSS variables. Tables + inline only.
 */

export const THEME = {
  pageBg: "#c44d0b",
  cardBg: "#e96819",
  text1: "#fce0ad",
  text2: "#edc775",
  text3: "#f08c28",
} as const;

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?\d[\d().\s-]{8,}\d/g;

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

/** Mailto with Text 1 so Gmail/Proton cannot paint magenta. */
export function emailMailto(address: string): string {
  const clean = address.trim();
  return `<a href="mailto:${escapeHtml(clean)}" style="color:${THEME.text1} !important;font-weight:700;text-decoration:underline">${escapeHtml(clean)}</a>`;
}

export function emailLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${THEME.text1} !important;font-weight:700;text-decoration:underline">${escapeHtml(label)}</a>`;
}

/** Escape copy, then wrap emails (and tel-looking runs) so auto-link cannot invent a sixth color. */
export function emailPaintedCopy(text: string): string {
  const escaped = escapeHtml(text);
  const withMail = escaped.replace(EMAIL_RE, (match) => emailMailto(match));
  return withMail.replace(PHONE_RE, (match) => {
    if (match.includes("@")) return match;
    const href = match.replace(/[^\d+]/g, "");
    if (href.replace(/\D/g, "").length < 10) return match;
    return `<a href="tel:${escapeHtml(href)}" style="color:${THEME.text1} !important;font-weight:700;text-decoration:underline">${escapeHtml(match)}</a>`;
  });
}

function kickerOnPrimary(text: string): string {
  return `<p style="margin:0;padding:0;color:${THEME.text3};font-family:${SANS};font-size:11px;line-height:1.3;font-weight:800;letter-spacing:.18em;text-transform:uppercase">${escapeHtml(text)}</p>`;
}

function labelOnCard(text: string): string {
  return `<p style="margin:0;padding:0;color:${THEME.text2};font-family:${SANS};font-size:11px;line-height:1.3;font-weight:800;letter-spacing:.18em;text-transform:uppercase">${escapeHtml(text)}</p>`;
}

/**
 * The one shell every owner email is built from.
 * Phone 390 first. Body fill is Secondary / card #e96819 (mostly the card
 * color). Primary #c44d0b is a thin kicker strip only. No dark page gutter
 * around a nested card (that was the 10:39 brick). 600px is the same fill.
 */
export function emailShell(args: {
  title: string;
  heading: string;
  eyebrow?: string;
  bodyHtml: string;
  maxWidth?: number;
}): string {
  const width = args.maxWidth ?? 560;
  const kicker = args.eyebrow
    ? `<tr><td align="left" bgcolor="${THEME.pageBg}" style="padding:10px 16px;background:${THEME.pageBg}">${kickerOnPrimary(args.eyebrow)}</td></tr>`
    : "";
  return [
    `<!doctype html><html><head><meta charset="utf-8">`,
    // CLAUDE light edit 2026-09-02 (H433 review, HOLD 3): keep light rendering.
    // bgcolor backs up inline backgrounds in clients that strip style.
    `<meta name="color-scheme" content="light">`,
    `<meta name="supported-color-schemes" content="light">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${escapeHtml(args.title)}</title></head>`,
    `<body bgcolor="${THEME.cardBg}" style="margin:0;padding:0;background:${THEME.cardBg};color:${THEME.text1};font-family:${SANS};-webkit-text-size-adjust:100%">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${THEME.cardBg}" style="background:${THEME.cardBg}">`,
    `<tr><td align="center" bgcolor="${THEME.cardBg}" style="padding:0;background:${THEME.cardBg}">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${THEME.cardBg}" style="max-width:${width}px;width:100%;background:${THEME.cardBg}">`,
    kicker,
    `<tr><td bgcolor="${THEME.cardBg}" style="background:${THEME.cardBg};padding:18px 16px 14px">`,
    `<h1 style="margin:0;font-family:${SERIF};font-size:24px;line-height:1.2;font-weight:700;color:${THEME.text1}">${escapeHtml(args.heading)}</h1>`,
    `</td></tr>`,
    `<tr><td bgcolor="${THEME.cardBg}" style="background:${THEME.cardBg};padding:0 16px 24px">${args.bodyHtml}</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");
}

export function emailSubheading(text: string): string {
  return `<h2 style="margin:20px 0 10px;font-family:${SERIF};font-size:18px;line-height:1.25;color:${THEME.text1}">${escapeHtml(text)}</h2>`;
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${SANS};font-size:16px;line-height:1.5;color:${THEME.text1}">${html}</p>`;
}

/** Section with Text 2 label + Text 1 hairline. No inner primary fill. */
export function emailSection(args: { label: string; html: string }): string {
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">`,
    `<tr><td style="padding:12px 0 8px;border-top:2px solid ${THEME.text1}">${labelOnCard(args.label)}</td></tr>`,
    `<tr><td>${args.html}</td></tr>`,
    `</table>`,
  ].join("");
}

export function emailCallout(args: { label?: string; html: string }): string {
  if (args.label) {
    return emailSection({ label: args.label, html: emailParagraph(args.html) });
  }
  return emailParagraph(args.html);
}

/** Phone-first stacked rows. Label Text 2, value Text 1. Emails become mailto. */
export function emailRows(rows: Array<[string, string | null | undefined]>): string {
  const live = rows.filter(([, value]) => Boolean(value));
  if (!live.length) return "";
  const body = live
    .map(([label, value]) => {
      const raw = String(value);
      EMAIL_RE.lastIndex = 0;
      const painted = EMAIL_RE.test(raw) ? emailMailto(raw.trim()) : emailPaintedCopy(raw);
      EMAIL_RE.lastIndex = 0;
      return [
        `<tr><td style="padding:10px 0 2px;color:${THEME.text2};font-family:${SANS};font-size:11px;line-height:1.3;font-weight:700;letter-spacing:.14em;text-transform:uppercase">${escapeHtml(label)}</td></tr>`,
        `<tr><td style="padding:0 0 12px;color:${THEME.text1};font-family:${SANS};font-size:16px;line-height:1.4;font-weight:700">${painted}</td></tr>`,
      ].join("");
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">${body}</table>`;
}

/** Full-width Text 1 outline. Fill is the card, same as the page. */
export function emailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:block;width:100%;box-sizing:border-box;margin:8px 0 10px;padding:14px 12px;border-radius:8px;border:2px solid ${THEME.text1};background:${THEME.cardBg};color:${THEME.text1} !important;text-decoration:none;font-family:${SANS};font-weight:700;font-size:15px;line-height:1.2;text-align:center">${escapeHtml(label)}</a>`;
}

export function emailPre(text: string): string {
  return `<div style="white-space:pre-wrap;margin:0;padding:0;font-family:${SANS};font-size:15px;line-height:1.5;color:${THEME.text1}">${escapeHtml(text)}</div>`;
}
