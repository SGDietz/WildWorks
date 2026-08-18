export type IscottSalesIntent = "website_offer" | "land_offer" | "why_scott" | "prior_work";

export const ISCOTT_SALES_COPY = {
  website_offer:
    "Scott can brand your company, and build a fully furnished AI-driven website to sell your brand. He knows that work. If that is what you need, he can actually help you.",
  land_offer:
    "Scott is a problem solver. He loves solving people's problems — land, build, the hard stuff — any way he can. He is extremely capable. Tell me what you are up against.",
  why_scott:
    "Because he knows his work, deeply. He can genuinely help you. He is a problem solver — he loves solving people's problems, in any way. He is extremely capable. That is why you go with Scott.",
  prior_work:
    "He knows his work. This WildWorks site is his. I will not invent a list of other clients. If you want a website, he can brand your company and build a fully furnished AI-driven website to sell your brand — talk to him.",
} as const;

export function selectIscottSalesIntent(text: string): IscottSalesIntent | null {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/\b(?:done\s+anything\s+before|before\s+this\s+(?:one|site)|prior\s+work|other\s+clients?|portfolio)\b/i.test(normalized)) return "prior_work";
  if (/\b(?:why\s+(?:go\s+with|pick|choose|hire)\s+scott|why\s+scott)\b/i.test(normalized)) return "why_scott";
  if (/\b(?:website|web\s*site|brand(?:ing)?\s+(?:my|our|a)\s+company|ai[- ]driven)\b/i.test(normalized)) return "website_offer";
  if (/\b(?:land|property|pond|stone|yard|outdoor)\b/i.test(normalized) && !/\b(?:website|web\s*site)\b/i.test(normalized)) return "land_offer";
  return null;
}

export function selectIscottSalesCopy(text: string): string | null {
  const intent = selectIscottSalesIntent(text);
  return intent ? ISCOTT_SALES_COPY[intent] : null;
}

export function iscottSalesCopyContextBlock(): string {
  return [
    "When the visitor asks about a website or branding a company, answer exactly:", ISCOTT_SALES_COPY.website_offer,
    "When the visitor asks why go with Scott, answer exactly:", ISCOTT_SALES_COPY.why_scott,
    "When the visitor asks if he has done work before this site, answer exactly:", ISCOTT_SALES_COPY.prior_work,
    "When they need land or a build and did not ask for a site, answer exactly:", ISCOTT_SALES_COPY.land_offer,
    "Do not add years, named clients, guarantees, or outcomes G did not supply.",
  ].join(" ");
}
