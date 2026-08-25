import { iscottSalesCopyContextBlock } from "./iscottSalesCopy";

const PROJECT_NEED_PATTERN = /\b(?:i|we)\s+(?:want|wanted|need|needed|would like|am looking|are looking)\s+(?:to\s+)?([^.!?]{3,260})/i;

// G, 2026-08-23, looking at a real lead: the summary line just quoted his own
// spoken disfluency verbatim ("a cascading, you know, I want like a stream
// and..."). Strip filler words and a restarted "I want" clause the same way
// extractLocation already strips "uh"/"um" - deterministic cleanup of what was
// said, never inventing new wording.
function stripSpokenProjectFiller(text: string): string {
  return text
    .replace(/,?\s*\byou know\b,?\s*/gi, " ")
    .replace(/\b(?:um+|uh+|er|ah)\b,?\s*/gi, " ")
    .replace(/\bi(?:'d| would)?\s+(?:want|wanted|need|needed|would like)\s+(?:to\s+)?like\b\s*(?:an?\s+)?/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractProjectNeed(text: string): string | null {
  const match = text.match(PROJECT_NEED_PATTERN);
  if (!match?.[1]) return null;
  const candidate = stripSpokenProjectFiller(match[1].replace(/\s+/g, " ").trim());
  if (/^(?:talk|speak|know|ask|say)\b/i.test(candidate)) return null;
  if (isCoachingOrPersonaNeed(candidate)) return null;
  // Grok, 2026-08-19: the lead for session 6f3a7caa carried project_need
  // "Tell my phone number". G was operating the contact flow, not describing a
  // project, and Scott would have opened that lead to read it as the job.
  // Anything that is only about the mechanics of being contacted is not a need.
  if (/\b(?:phone number|email address|e-?mail|contact (?:info|information|details)|reach me|get in touch|call me|text me)\b/i.test(candidate)) {
    return null;
  }
  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

export function isCoachingOrPersonaNeed(candidate: string): boolean {
  const normalized = candidate.replace(/\s+/g, " ").trim();
  return /^(?:you|i ?scott)\b/i.test(normalized)
    || /\b(?:you to be|super positive|salesman|persona|what you should say|you need to say)\b/i.test(normalized)
    || /\b(?:can (?:build|create|help you build) your (?:brand|site|website|business)|what do you most need solved|pain point|quickest way to making money)\b/i.test(normalized);
}

const NAME_STOP =
  /^(?:going|here|interested|looking|trying|just|not|gonna|wanna|doing|calling|the|this|that|email|phone|okay|yeah)$/i;

function titleNameWords(value: string): string {
  return value.replace(/\b[\p{L}]/gu, (letter) => letter.toUpperCase());
}

export function extractSpokenNameAndPlace(text: string): { name: string | null; location: string | null } {
  const match = text.match(
    /\b(?:(?:my name is|my name's|call me|i(?:'m| am))\s+)?([\p{L}][\p{L}'-]*)\s+from\s+([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,3})(?=\s*[.!?,]|$)/iu,
  );
  if (!match?.[1] || !match[2]) return { name: null, location: null };
  const name = match[1].trim();
  const place = match[2].replace(/[.,!?;:]+$/g, "").trim();
  if (NAME_STOP.test(name) || name.length < 2 || name.length > 40) return { name: null, location: null };
  if (/^(?:here|there|work|home|scratch|the)$/i.test(place) || place.length < 2 || place.length > 80) {
    return { name: titleNameWords(name), location: null };
  }
  return { name: titleNameWords(name), location: titleLocationWords(place) };
}

export function extractSpokenFullName(text: string): string | null {
  const fromPlace = extractSpokenNameAndPlace(text).name;
  if (fromPlace) return fromPlace;
  const named = text.match(
    /\b(?:my name is|my name's|call me)\s+([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,3})/iu,
  );
  const spoken = named
    ? named[1]
    : text.match(/\b(?:i(?:'m| am))\s+([\p{L}][\p{L}'-]*)(?=\s*(?:,|and\b|in\b|from\b|[.!?]|$)|\s*$)/iu)?.[1];
  if (!spoken) return null;
  const candidate = spoken
    .split(/\b(?:and|but|from|in)\b/i)[0]
    .replace(/[.,!?;:]+$/g, "")
    .trim();
  if (candidate.length < 2 || candidate.length > 90) return null;
  if (NAME_STOP.test(candidate)) {
    return null;
  }
  return titleNameWords(candidate);
}

export function preferProjectNeed(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  const currentLooksIncomplete = /(?:[,;:\-]|\b(?:a|an|and|my|or|the|to|uh|um))\s*$/i.test(current);
  const currentLooksGeneric = /^(?:some\s+)?(?:landscap(?:e|ing)|yard\s+work|outdoor\s+work|work\s+(?:outside|outdoors)|a\s+project)$/i
    .test(current.trim());
  const nextIsMoreSpecific = next.length > current.length && (
    currentLooksIncomplete ||
    currentLooksGeneric ||
    next.split(/\s+/).length >= current.split(/\s+/).length + 2
  );
  return nextIsMoreSpecific ? next : current;
}

export function detectsAcceptedFollowUp(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /^(?:yes|yeah|sure|please|go ahead)\b.{0,120}\b(?:pass|send|share|contact|email|call|reach|follow)\b|\b(?:you|scott)\s+(?:can|may)\s+(?:email|call|contact|reach)\s+me\b|\b(?:contact|reach|follow up with)\s+me\b|\b(?:yes|yeah|sure|correct|right)\b.{0,100}\b(?:permission|consent|authorize|authorized|contact|follow[- ]?up)\b|\b(?:permission|consent)\b.{0,100}\b(?:yes|yeah|sure|given|grant|granted|accept|accepted|agree|agreed)\b|\b(?:i\s+)?(?:give|gave|have given|had (?:already )?given|grant|granted)\s+(?:you\s+)?(?:explicit\s+)?(?:permission|consent)\b/i.test(normalized);
}

export function detectsSimpleAffirmation(text: string): boolean {
  const t = text.trim();
  // G live rides 2026-08-17: real yeses arrive with filler ("And, but yes,
  // that email is correct." / "I already confirmed it.") — count them.
  if (/^(?:(?:and|but|um+|uh|okay|ok|all\s?right|alright|well|good|so)[,.]?\s+)*(?:yes|yeah|yep|correct|right|that(?:'s| is) right|you got it|exactly)\b/i.test(t)) {
    return true;
  }
  return /\b(?:that(?:'s| is)?\s+(?:email|number|phone)?\s*(?:is\s+)?correct\b|i\s+(?:already\s+)?confirmed(?:\s+it)?\b|it(?:'s| is)\s+confirmed\b)/i.test(t);
}

const AVATAR_STUB_RE =
  /^(?:i|got|just let|before i send|i have your phone|how should scott reach out to)$/i;

const USER_FRAGMENT_RE =
  /^(?:um+,?\s*okay,?\s*so|you know, people may not know how to|i'?m|so in other words, you know,|they should be|you know, brand\.?|did you mention scott kim\??)$/i;

export function isIncompleteAvatarUtterance(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^(?:okay|ok|all right|alright|got it|yes|no|thanks?|sure|yep|yeah)$/i.test(trimmed)) {
    return false;
  }
  if (AVATAR_STUB_RE.test(trimmed)) return true;
  if (/\b(?:how should scott reach out to|i have your phone)$/i.test(trimmed)) return true;
  if (/^it seems\.?$/i.test(trimmed)) return true;
  if (/^it sounds\.?$/i.test(trimmed)) return true;
  if (/^i understand\.?\s*if(?:\s+you need to close the session, that's)?$/i.test(trimmed)) return true;
  if (/[,:]\s*$/.test(trimmed) && trimmed.split(/\s+/).length <= 8 && /^(?:i understand|it seems|it sounds)\b/i.test(trimmed)) {
    return true;
  }
  return false;
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

// G 2026-08-19: this function invented "of@bm.me.so" out of the sentence
// "instead of @bm.me. So it should be", and iScott mailed the lead there, so G
// never got it. The old version collapsed whitespace around EVERY literal "@"
// and ".", including punctuation that was just prose - which glued the previous
// word onto the address ("instead of" -> "of@") and swallowed the next sentence
// as a TLD (". So" -> ".so").
//
// Only the SPOKEN words pull their neighbours together. A literal @ or . that
// was already in the text keeps the spacing it came with, so an address that is
// merely being talked about can no longer be harvested out of a sentence.
const SPOKEN_AT = "\u0001";
const SPOKEN_DOT = "\u0002";
const SPOKEN_UNDERSCORE = "\u0003";
const SPOKEN_DASH = "\u0004";

export function normalizeSpokenEmail(text: string): string {
  const marked = text
    .toLowerCase()
    .replace(/\b(?:at sign|at)\b/g, SPOKEN_AT)
    .replace(/\b(?:dot|period)\b/g, SPOKEN_DOT)
    .replace(/\bunderscore\b/g, SPOKEN_UNDERSCORE)
    .replace(/\b(?:dash|hyphen)\b/g, SPOKEN_DASH);
  return marked
    .replace(new RegExp("\\s*" + SPOKEN_AT + "\\s*", "g"), "@")
    .replace(new RegExp("\\s*" + SPOKEN_DOT + "\\s*", "g"), ".")
    .replace(new RegExp("\\s*" + SPOKEN_UNDERSCORE + "\\s*", "g"), "_")
    .replace(new RegExp("\\s*" + SPOKEN_DASH + "\\s*", "g"), "-");
}

// Words that only ever appear as a TLD because a sentence carried on. G's ride
// produced ".so" from "... .me. So it should be". Belt and braces behind the
// normaliser above.
const SENTENCE_TAIL_TLD = /\.(?:so|and|but|then|now|because|however|also|though|instead|which|that)$/i;

export function extractEmail(text: string): string | null {
  const direct = text.match(EMAIL_PATTERN)?.[0];
  const spoken = normalizeSpokenEmail(text).match(EMAIL_PATTERN)?.[0];
  let email = (direct ?? spoken)?.toLowerCase().slice(0, 254) ?? null;
  if (email && SENTENCE_TAIL_TLD.test(email)) {
    const trimmed = email.replace(SENTENCE_TAIL_TLD, "");
    email = EMAIL_PATTERN.test(trimmed) ? trimmed : null;
  }
  return email;
}

function spellEmailToken(value: string): string {
  const spoken: string[] = [];
  let run = "";
  const flush = () => {
    if (!run) return;
    spoken.push([...run].join("-"));
    run = "";
  };
  for (const ch of value) {
    if (/[a-z0-9]/i.test(ch)) {
      run += ch.toLowerCase();
      continue;
    }
    flush();
    if (ch === ".") spoken.push("dot");
    else if (ch === "-") spoken.push("dash");
    else if (ch === "_") spoken.push("underscore");
    else if (ch === "+") spoken.push("plus");
  }
  flush();
  return spoken.join(" ");
}

export function formatSpokenEmailForReadback(email: string): string {
  const valid = extractEmail(email);
  if (!valid) return "";
  const at = valid.indexOf("@");
  if (at < 1) return "";
  return `${spellEmailToken(valid.slice(0, at))} at ${spellEmailToken(valid.slice(at + 1))}`;
}

export function iscottEmailReadbackPrompt(email: string): string | null {
  const spoken = formatSpokenEmailForReadback(email);
  if (!spoken) return null;
  return `Your email address is ${spoken}. Would you like me to send these details to Scott now?`;
}

export function formatSpokenPhoneForReadback(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  // G 2026-08-19: "I want him to be clear" - never one unbroken run of digits.
  // Speak it in groups with a comma between them so iScott pauses where a person
  // would, and lead with the country code when the number carries one.
  const speak = (chunk: string) => [...chunk].join("-");
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  const country = digits.slice(0, digits.length - national.length);
  const groups = national.length === 10
    ? [national.slice(0, 3), national.slice(3, 6), national.slice(6)]
    : [national];
  const spokenNational = groups.map(speak).join(", ");
  // G 2026-08-19: "do not do Plus 1 though, take that out, just numbers."
  return country ? `${speak(country)}, ${spokenNational}` : spokenNational;
}

export function visitorChoseContactMethod(text: string): "email" | "phone" | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/\b(?:email|e-mail|phone|call|telephone)\s+or\s+(?:email|e-mail|phone|call|telephone)\b/i.test(normalized)) {
    return null;
  }
  // G 2026-08-19: this used to reject ANY line containing "reach out", which
  // swallowed the visitor's own answer - "I would like for Scott to reach out by
  // email" - so the capture box never opened. Reject only a line actually SHAPED
  // like the question; a line offering both methods is already rejected above.
  // KEEP IN SYNC with its twin - check-iscott-method-choice.mjs fails on drift.
  if (/\?\s*$/.test(normalized)
    && /\b(?:how should|how would|would you like|should scott|which do you prefer|best way)\b/i.test(normalized)) {
    return null;
  }
  if (/\b(?:or\s+text|text\s+me|by\s+text|via\s+sms|sms|phone|call|telephone)\b/i.test(normalized)
    && !/\b(?:e-?mail)\b/i.test(normalized)) {
    return "phone";
  }
  if (/\bas soon as i\b|\bemail box\b|\bstupid\b.{0,40}\bbox\b/i.test(normalized)) {
    return null;
  }
  if (/\b(?:e-?mail(?:'s| is)?\s+fine|prefer\s+(?:an?\s+)?e-?mail|by\s+e-?mail|use\s+e-?mail|e-?mail)\b/i.test(normalized)) {
    return "email";
  }
  return null;
}

export function sendingToGCopy(): string {
  return "I'm sending that to G.";
}

export function sentToGCopy(method: "email" | "phone"): string {
  return method === "phone" ? "Phone sent to G ✓" : "Email sent to G ✓";
}

export function classifyPublicInterest(texts: string[]): "website" | "landscaping" | "none" {
  const joined = texts.join(" ").toLowerCase();
  if (/\b(?:website|web site|brand your company|ai[- ]driven website)\b/i.test(joined)) return "website";
  if (/\b(?:landscap\w*|hardscape|yard|garden|stonework|patio|pool)\b/i.test(joined)) return "landscaping";
  return "none";
}

function titleLocationWords(value: string): string {
  return value.replace(/\b[\p{L}]/gu, (letter) => letter.toUpperCase());
}

export function extractLocation(text: string): string | null {
  const fromPlace = extractSpokenNameAndPlace(text).location;
  if (fromPlace) return fromPlace;
  const match = text.match(
    /\b(?:i(?:'m| am)|we(?:'re| are)|located|based)\s+in\s+([^.!?]{2,120})/i,
  );
  if (!match?.[1]) return null;
  const matchIndex = match.index ?? 0;
  const prefix = text.slice(Math.max(0, matchIndex - 28), matchIndex).toLowerCase();
  if (/when\s+i\s+(?:say|tell)|if\s+i\s+say/.test(prefix)) return null;
  let candidate = match[1]
    .split(/,\s*(?:you|you're|you are|we|we're|i)\b/i)[0]
    .split(/\b(?:where(?:'s| is)|and then|but)\b/i)[0]
    .replace(/^(?:the\s+)?/i, "")
    .replace(/[,:;\s]+$/g, "")
    .trim();
  candidate = candidate
    .replace(/^(?:it|uh|um|er|ah|like|you know)(?:\s*,\s*|\s+)+/ig, "")
    .replace(/\b(?:uh|um|er|ah)\b[, ]*/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^,\s*/, "")
    .trim();
  if (candidate.length < 2 || candidate.length > 120) return null;
  if (/^(?:it|uh|um)$/i.test(candidate)) return null;
  if (/\b(?:you're|you are|scott|home territory|great)\b/i.test(candidate)) return null;
  return titleLocationWords(candidate);
}

export function shouldParseLeadFacts(text: string): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || isPureFillerUtterance(trimmed)) return false;
  if (visitorChoseContactMethod(trimmed)) return true;
  if (extractEmail(trimmed) || extractSpokenFullName(trimmed) || extractLocation(trimmed)) return true;
  if (shouldHoldUserFragment(trimmed)) return false;
  return looksCompleteUtterance(trimmed) || trimmed.split(/\s+/).length >= 4;
}

export function mergeAssistantRetry(previous: string, next: string): string | null {
  const a = previous.trim();
  const b = next.trim();
  if (!a || !b) return null;
  const normalize = (value: string) => value.toLowerCase().replace(/[.]+$/g, "").trim();
  const al = normalize(a);
  const bl = normalize(b);
  if (bl.startsWith(al) || al.startsWith(bl)) return a.length >= b.length ? a : b;
  if (/\byour email address is\b/i.test(a) && /\byour email address is\b/i.test(b)) return b;
  if (/\bpreparing (?:to send|the handoff)\b/i.test(a) && /\bpreparing (?:to send|the handoff)\b/i.test(b)) return b;
  return null;
}

export function assignTranscriptArrival<T extends {
  la_absolute_timestamp?: number;
  laAbsoluteTimestamp?: number | null;
  metadata?: Record<string, unknown>;
}>(rows: T[]): T[] {
  return rows.map((row, index) => ({
    ...row,
    metadata: {
      ...(row.metadata ?? {}),
      arrival_index: index,
      original_absolute_timestamp: row.la_absolute_timestamp ?? row.laAbsoluteTimestamp ?? null,
    },
  }));
}

export function nextFreeTranscriptTimestamp(start: number, taken: Set<number>): number {
  let timestamp = Math.floor(start);
  while (taken.has(timestamp)) timestamp += 1;
  taken.add(timestamp);
  return timestamp;
}

export function originalTranscriptTimestamp(row: {
  laAbsoluteTimestamp?: number | null;
  la_absolute_timestamp?: number;
  metadata?: Record<string, unknown>;
}): number | null {
  const original = row.metadata?.original_absolute_timestamp;
  if (typeof original === "number" && Number.isFinite(original)) return original;
  if (typeof row.laAbsoluteTimestamp === "number") return row.laAbsoluteTimestamp;
  if (typeof row.la_absolute_timestamp === "number") return row.la_absolute_timestamp;
  return null;
}

export function correlateTranscriptTurns<T extends {
  role: "user" | "assistant";
  metadata?: Record<string, unknown>;
}>(rows: T[]): T[] {
  let pair = 0;
  let openUser = false;
  return rows.map((row) => {
    if (row.role === "user") {
      if (!openUser) pair += 1;
      openUser = true;
    } else {
      if (!openUser) pair += 1;
      openUser = false;
    }
    return {
      ...row,
      metadata: {
        ...(row.metadata ?? {}),
        turn_pair_id: pair,
      },
    };
  });
}

export function collectBargeInEvents(
  sessionId: string,
  rows: Array<{ role: string; message: string; laAbsoluteTimestamp?: number | null }>,
  anonymousVisitorId?: string | null,
): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (previous.role !== "assistant" || current.role !== "user") continue;
    const incomplete = isIncompleteAvatarUtterance(previous.message);
    const previousAt = previous.laAbsoluteTimestamp ?? null;
    const currentAt = current.laAbsoluteTimestamp ?? null;
    const overlapped = previousAt !== null && currentAt !== null && currentAt <= previousAt;
    if (!incomplete && !overlapped) continue;
    events.push({
      session_id: sessionId,
      anonymous_visitor_id: anonymousVisitorId ?? null,
      category: "iscott_barge_in",
      signal: current.message.slice(0, 700),
      source_text: previous.message.slice(0, 1000),
      confidence: 0.8,
      payload: {
        assistant_timestamp: previousAt,
        user_timestamp: currentAt,
        assistant_incomplete: incomplete,
      },
    });
  }
  return events;
}

export function providerConfidenceFromRow(row: { metadata?: Record<string, unknown> }): number | null {
  const value = row.metadata?.stt_confidence ?? row.metadata?.confidence;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function shouldHoldUserFragment(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (USER_FRAGMENT_RE.test(trimmed)) return true;
  if (trimmed.length < 8 && !/^(?:yes|no|ok|yep|6)$/i.test(trimmed)) return true;
  return false;
}

export function mergeUserFragments(previous: string, next: string): string {
  const a = previous.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  if (b.toLowerCase().startsWith(a.toLowerCase())) return b;
  return `${a} ${b}`.replace(/\s+/g, " ").trim();
}

type TranscriptTurn = {
  role: "user" | "assistant";
  message: string;
  laAbsoluteTimestamp: number | null;
};

export type CompactedTurn = TranscriptTurn & {
  quality: "final" | "partial" | "stt_suspect";
  sttNote?: string | null;
};

export function suspectSttCorrection(text: string): string | null {
  if (/\bdid you mention scott kim\b/i.test(text)) {
    return "Possible STT of “Scott can” / “Scott can build”";
  }
  return null;
}

export function isPureFillerUtterance(text: string): boolean {
  return /^(?:um+,?\s*okay,?\s*so|you know,|i'?m)$/i.test(text.trim());
}

export function isSiteQualityOrDisplayTalk(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /\b(?:this website|how smart it is|beautiful aesthetics|this is the display|everything positive|what were you saying)\b/i.test(normalized);
}

export function looksCompleteUtterance(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || shouldHoldUserFragment(trimmed) || isPureFillerUtterance(trimmed)) return false;
  if (isSendConfirmationReply(trimmed) || detectsSimpleAffirmation(trimmed)) return true;
  return /[.!?]"?$/.test(trimmed);
}

export function distillVisitorProjectOffer(texts: string[]): string | null {
  const blob = texts.join(" ").replace(/\s+/g, " ");
  if (isCoachingOrPersonaNeed(blob) && !/\b(?:brand|logo|artwork|website)\b/i.test(blob)) return null;
  const parts: string[] = [];
  if (/\bbrand(?:ing)?\b/i.test(blob)) parts.push("branding");
  if (/\blogo\b/i.test(blob)) parts.push("logo");
  if (/\bartwork\b/i.test(blob)) parts.push("artwork");
  if (/\bwebsite\b/i.test(blob)) parts.push("website");
  if (parts.length === 0) return null;
  return `Website and ${parts.join("/")} makeover${/\bstart to finish\b/i.test(blob) ? ", start to finish" : ""}`;
}

export function extractOperatorSiteNote(texts: string[]): string | null {
  return texts.some((text) => isSiteQualityOrDisplayTalk(text))
    ? "Website display and aesthetics quality"
    : null;
}

export function isOperatorSalesLanguage(text: string): boolean {
  return /\b(?:scott can really help you|put scott in contact with you|bounce ideas off|website scott can build|fully a-?i-?driven website|what you should say|you need to say|incredibly capable|he would love to help you)\b/i.test(text);
}

export function isOperatorPromptEcho(text: string): boolean {
  return /\bwould you like for me to put scott in contact with you\b/i.test(text);
}

export function extractContactPreference(text: string): "sms" | "voice" | "email" | null {
  if (/\b(?:or\s+text|text\s+me|by\s+text|via\s+sms|sms)\b/i.test(text)) return "sms";
  if (/\b(?:phone call|give me a (?:phone )?call|call me)\b/i.test(text)) return "voice";
  if (/\b(?:e-?mail)\b/i.test(text) && !/\btext\b/i.test(text)) return "email";
  return null;
}

export function detectsContactReadBackCorrect(text: string): boolean {
  return /\b(?:phone number|email|number)\s+is\s+correct\b|\bthat(?:'s| is) the (?:right )?(?:number|email)\b/i.test(text);
}

export function normalizeAssistantReadBackSpacing(text: string): string {
  return text.replace(/(\d)(Would you like)/g, "$1 $2").replace(/(\])(Would you like)/g, "$1 $2");
}

export function maskContactForDisplay(value: string, method: "email" | "phone"): string {
  if (method === "email") {
    const at = value.indexOf("@");
    if (at < 2) return "•••";
    return `${value[0]}•••${value.slice(at)}`;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `•••-•••-${digits.slice(-4)}`;
}

export function formatLeadContactDisplay(
  method: "email" | "phone",
  value: string,
): { visible: string; checkable: string; ariaLabel: string } {
  const visible = maskContactForDisplay(value, method);
  return {
    visible,
    checkable: value,
    ariaLabel: `${method} ${value}`,
  };
}

export function leadHasSendPermission(lead: {
  consentStatus?: string | null;
  contactConfirmedAt?: string | null;
}): boolean {
  return lead.consentStatus === "accepted" || Boolean(lead.contactConfirmedAt);
}

export function capturedAwaitingPermissionCopy(): string {
  // G 2026-08-17: no helper line under the capture box — removed.
  return "";
}

export function sendReadyStatusCopy(): string {
  return "Check the captured details, then choose Send to Scott.";
}

export function confirmingHandoffStatusCopy(): string {
  return "Sending these details to Scott. He does not have them yet.";
}

export function collectOperatorPromptEchoEvents(
  sessionId: string,
  rows: Array<{ role: string; message: string; laAbsoluteTimestamp?: number | null }>,
  anonymousVisitorId?: string | null,
): Array<Record<string, unknown>> {
  return rows
    .filter((row) => row.role === "assistant" && isOperatorPromptEcho(row.message))
    .map((row) => ({
      session_id: sessionId,
      anonymous_visitor_id: anonymousVisitorId ?? null,
      category: "iscott_operator_prompt_instruction",
      signal: row.message.slice(0, 700),
      source_text: row.message.slice(0, 1000),
      confidence: 0.95,
      payload: { la_absolute_timestamp: row.laAbsoluteTimestamp ?? null },
    }));
}

export function visitorProjectNeedFromRows(
  texts: string[],
): { projectNeed: string | null; operatorServiceScript: string | null } {
  const operatorTexts = texts.filter((text) => isOperatorSalesLanguage(text) || isCoachingOrPersonaNeed(text));
  const visitorTexts = texts.filter((text) => !isOperatorSalesLanguage(text) && !isCoachingOrPersonaNeed(text));
  let projectNeed: string | null = null;
  for (const text of visitorTexts) {
    projectNeed = preferProjectNeed(projectNeed, extractProjectNeed(text));
  }
  // G's ride 89c453ff, 2026-08-19. Scott was mailed
  // "A website and then I What type is he good with, you know, coming up with
  // original ideas" - two half sentences welded across a transcript break.
  //
  // Replaying the real turns showed the value was CLEAN ("Website and website
  // makeover") for the first five, then broke on the sixth. The sixth is where G
  // started talking about the screen - no 2-second delay, the box is too dark,
  // it is not over the finish button. That flips sessionLooksLikeOperatorQa, and
  // this branch was returning the raw per-turn accumulation while handing the
  // distilled value to operatorServiceScript instead. The good answer had been
  // computed and was being thrown away.
  //
  // Both branches now prefer the distilled offer. A ride where G is testing is
  // still a ride where Scott has to read the job.
  // NARROWED, same day, after check-iscott-lead-parser caught it: the two
  // conditions below are NOT the same thing and must not share an answer.
  //
  //   operatorTexts.length > 0  = G is FEEDING iScott lines. WW-23 says that can
  //                               never become the job. Leave it exactly as it was.
  //   sessionLooksLikeOperatorQa = G is TESTING while a real need is buried in
  //                               his own words. That is G's ride 89c453ff, and
  //                               there the distilled answer must survive.
  const operatorIsScripting = operatorTexts.length > 0;
  if (sessionLooksLikeOperatorQa(texts) || operatorIsScripting) {
    return {
      projectNeed: operatorIsScripting
        ? projectNeed
        : distillVisitorProjectOffer(visitorTexts) ?? projectNeed,
      operatorServiceScript: distillVisitorProjectOffer(texts),
    };
  }
  return {
    projectNeed: distillVisitorProjectOffer(visitorTexts) ?? projectNeed,
    operatorServiceScript: null,
  };
}

export function prepareForwardTranscriptRows<T extends {
  role: "user" | "assistant";
  message: string;
  la_absolute_timestamp: number;
  metadata?: Record<string, unknown>;
}>(rows: T[]): T[] {
  const out: T[] = [];
  for (const row of rows) {
    if (row.role === "assistant") {
      const message = normalizeAssistantReadBackSpacing(row.message);
      const last = out[out.length - 1];
      if (last?.role === "assistant" && mergeAssistantRetry(last.message, message)) {
        last.metadata = {
          ...(last.metadata ?? {}),
          superseded_by_retry: true,
        };
      }
      out.push({
        ...row,
        message,
        metadata: {
          ...(row.metadata ?? {}),
          completeness: isIncompleteAvatarUtterance(message) ? "partial" : "final",
        },
      });
      continue;
    }
    const text = row.message.trim();
    if (!text) continue;
    const last = out[out.length - 1];
    const lastOpen = last?.role === "user" && !looksCompleteUtterance(last.message);
    const continues = /^[a-z]/.test(text);
    if (last?.role === "user" && (lastOpen || continues)) {
      last.message = mergeUserFragments(last.message, text);
      last.metadata = {
        ...(last.metadata ?? {}),
        completeness: looksCompleteUtterance(last.message) ? "final" : "partial",
        merged_forward: true,
      };
      continue;
    }
    if (isPureFillerUtterance(text)) continue;
    out.push({
      ...row,
      message: text,
      metadata: {
        ...(row.metadata ?? {}),
        completeness: looksCompleteUtterance(text) ? "final" : "partial",
      },
    });
  }
  return correlateTranscriptTurns(
    assignTranscriptArrival(out.filter((row) => row.role !== "user" || !isPureFillerUtterance(row.message))),
  );
}

export const VISIBLE_UPLOAD_CONTROL_LABEL = "upload photos or videos";

export function isUnsupportedMediaRequest(text: string): boolean {
  return /\b(?:documents?|pdfs?|links?|urls?|dropbox|google drive)\b/i.test(text);
}

export function allowedUploadGuidanceSpeech(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (/\bgreat idea\b/i.test(normalized) && isUnsupportedMediaRequest(normalized)
    && !/\b(?:can't|cannot|not supported|photos or videos only)\b/i.test(normalized)) {
    return false;
  }
  return true;
}

export function uploadGuidanceNamesVisibleControl(text: string): boolean {
  return new RegExp(VISIBLE_UPLOAD_CONTROL_LABEL.replace(/\s+/g, "\\s+"), "i").test(text);
}

export function detectsFollowUpAcceptance(
  rows: Array<{ role: string; message: string }>,
): boolean {
  for (let index = 1; index < rows.length; index += 1) {
    const prompt = rows[index - 1];
    const reply = rows[index];
    if (prompt.role !== "assistant" || reply.role !== "user") continue;
    if (!/\b(?:put scott in contact|reach out to you|follow(?:ing)? up)\b/i.test(prompt.message)) continue;
    if (isUiOnlyAffirmation(reply.message) || isSendCommandConsent(reply.message)) continue;
    if (detectsSimpleAffirmation(reply.message) || detectsAcceptedFollowUp(reply.message)) return true;
  }
  return false;
}

export const FIVE_STANDARD_VIEWPORTS = [
  { name: "desktop", width: 1920, height: 1080 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "ipad-landscape", width: 1180, height: 820 },
  { name: "ipad-portrait", width: 820, height: 1180 },
  { name: "mobile", width: 412, height: 915 },
] as const;

export const OBSERVED_NARROW_VIEWPORT = {
  name: "observed-narrow",
  width: 287,
  height: 511,
} as const;

export function allRequiredIscottViewports(): Array<{ name: string; width: number; height: number }> {
  return [...FIVE_STANDARD_VIEWPORTS, OBSERVED_NARROW_VIEWPORT];
}

export function leadCardTypePx(viewportWidth: number): { label: number; status: number; buttonMin: number } {
  const narrow = viewportWidth <= 520;
  const label = Math.min(narrow ? 24 : 20, Math.max(narrow ? 20 : 18, viewportWidth * 0.042));
  return { label, status: narrow ? 20 : 16.8, buttonMin: 44 };
}

export function syncFailedUserCopy(): string {
  return "I lost the last transcript sync. Stay with me — I will retry once.";
}

export function identityBoundaryContext(): string {
  return [
    "You are iScott, Scott's digital twin at WildWorks. You are not Scott in the flesh. Ask one question at a time. Never ask name and location in the same question. Say Scott, never the WildWorks team. Do not say Scott only builds websites to sell services. Not everybody sells services. Scott can create your brand, logos, and artwork, and can build an AI-native site. He helps with two things: what you most need solved, and the quickest way to making money. Ask one of those, then wait. Never say it sounds like or it seems like. Do not promise you already sent details, that Scott has them, or that he will be in touch unless notification_status is sent. When speaking an email, say each character with dashes between letters, say at for @, and say dot for periods. Example shape: a-b-c at e-x-a-m-p-l-e dot c-o-m. Never change the stored email. After a real capture, read back only that spoken form, then ask if Scott should get the details. After the visitor confirms send, you may say I'm sending that to Scott. Do not say sent or delivered until notification_status is sent. When the visitor chooses email or phone, show the capture box immediately, empty, and wait for the address or number. Name the visible upload photos or videos control for photos and videos only. Do not offer documents or links.",
    iscottSalesCopyContextBlock(),
  ].join(" ");
}

export function emptyMediaState(count: number): { count: number; visible: string } {
  return {
    count,
    visible: count === 0 ? "No photos or videos uploaded yet. Use upload photos or videos." : `${count} uploaded`,
  };
}

export function helperVsFullBoundary(): {
  helperOwns: string[];
  fullCanDiverge: true;
} {
  return {
    helperOwns: ["lead row", "overlay card", "notification hold", "transcript filter"],
    fullCanDiverge: true,
  };
}

export function compactTranscriptRows(
  rows: Array<{ role: string; message: string; laAbsoluteTimestamp?: number | null }>,
): CompactedTurn[] {
  const out: CompactedTurn[] = [];
  for (const row of rows) {
    const role = row.role === "assistant" ? "assistant" : "user";
    const text = row.message.trim();
    if (!text) continue;
    if (role === "assistant") {
      if (isIncompleteAvatarUtterance(text)) continue;
      const last = out[out.length - 1];
      if (last?.role === "assistant") {
        const merged = mergeAssistantRetry(last.message, text);
        if (merged) {
          last.message = merged;
          continue;
        }
      }
      out.push({
        role,
        message: text,
        laAbsoluteTimestamp: row.laAbsoluteTimestamp ?? null,
        quality: "final",
      });
      continue;
    }
    const sttNote = suspectSttCorrection(text);
    const last = out[out.length - 1];
    const lastOpen = last?.role === "user" && !looksCompleteUtterance(last.message);
    const continues = /^[a-z]/.test(text)
      || (last?.role === "user" && /\b(?:brand|logo|artwork|scott can)\b/i.test(last.message)
        && /\b(?:brand|logo|artwork|scott can|build your)\b/i.test(text));
    if (last?.role === "user" && (lastOpen || continues)) {
      last.message = mergeUserFragments(last.message, text);
      if (sttNote) {
        last.quality = "stt_suspect";
        last.sttNote = sttNote;
      } else if (!looksCompleteUtterance(last.message) && last.quality !== "stt_suspect") {
        last.quality = "partial";
      } else if (last.quality !== "stt_suspect") {
        last.quality = "final";
      }
      continue;
    }
    if (isPureFillerUtterance(text) && !sttNote) continue;
    out.push({
      role: "user",
      message: text,
      laAbsoluteTimestamp: row.laAbsoluteTimestamp ?? null,
      quality: sttNote ? "stt_suspect" : shouldHoldUserFragment(text) ? "partial" : "final",
      sttNote,
    });
  }
  return out.filter((row) => row.role !== "user" || !isPureFillerUtterance(row.message) || row.quality === "stt_suspect");
}

export function sessionLooksLikeOperatorQa(texts: string[]): boolean {
  return texts.some((text) =>
    /\b(?:super positive salesman|what you should say|confirm handoff|finish button|this is a test|reading glasses|you to be like)\b/i.test(
      text,
    )
    || /\b(?:email box|stupid\b.{0,40}\bbox|as soon as i say|opening line|they need to be closer|wildworks concierge|i solve your problems|avatar needs to be bigger|confirm the details|install these changes|no finish button|clone of the code|just bring that code)\b/i.test(
      text,
    )
    || /\bbox is (?:fucked|too small|covering|in the way)\b/i.test(text)
    || /\bi,?\s*scott debee\b/i.test(text),
  );
}

export function isUiOnlyAffirmation(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /\b(?:finish|button|text size|too small|box|upload)\b/i.test(normalized)
    && !/\bsend\b/i.test(normalized);
}

export function isSendCommandConsent(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || isUiOnlyAffirmation(normalized)) return false;
  // Negation wins: "don't send my info" is never consent.
  if (/\b(?:don'?t|do not|never|stop)\b[^.!?]{0,30}\bsend\b/i.test(normalized)) return false;
  // G live ride 2026-08-17 ("Okay, yeah, send it, send that, send my
  // information to the WildWorks team." registered NO consent): accept
  // wildworks-team targets, filler before the yes, and the plain imperative.
  return (
    (/\bsend\b[^.!?]{0,60}?\bto\s+(?:the\s+)?(?:wildworks(?:\s+team)?|scott)\b/i.test(normalized)
      && /\b(?:yes|yeah|okay|ok)\b/i.test(normalized))
    || /\bsend\s+(?:my|the)\s+(?:information|info|details|email|lead)\b/i.test(normalized)
    || /^(?:(?:um+|uh|okay|ok|all\s?right|alright|well|so)[,.]?\s+)*(?:yes|yeah)[,.]?\s+send\b/i.test(normalized)
  );
}

export function isSendConfirmationReply(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized || isUiOnlyAffirmation(normalized)) return false;
  if (isSendCommandConsent(normalized)) return true;
  if (detectsSimpleAffirmation(normalized)) return true;
  return false;
}

export function mayClaimHandoffSent(args: {
  status?: string | null;
  submittedAt?: string | null;
  notificationStatus?: string | null;
  notificationOutboxId?: string | null;
}): boolean {
  if (args.notificationStatus === "failed" || args.notificationStatus === "dead_letter") return false;
  if (args.notificationStatus === "test_held") return false;
  return (args.status === "submitted" || Boolean(args.submittedAt))
    && args.notificationStatus === "sent"
    && (args.notificationOutboxId === undefined || Boolean(args.notificationOutboxId));
}

export function mergeLeadTranscriptHistory(
  existing: Array<{ role?: string; message?: string; timestamp?: number | null; laAbsoluteTimestamp?: number | null }>,
  incoming: Array<{ role: string; message: string; laAbsoluteTimestamp?: number | null }>,
): Array<{ role: "user" | "assistant"; message: string; laAbsoluteTimestamp: number | null }> {
  const out: Array<{ role: "user" | "assistant"; message: string; laAbsoluteTimestamp: number | null }> = [];
  const seen = new Set<string>();
  const push = (role: string, message: string, timestamp: number | null) => {
    const normalizedRole = role === "assistant" ? "assistant" : "user";
    const text = message.trim();
    if (!text) return;
    const key = `${normalizedRole}\0${timestamp ?? "none"}\0${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ role: normalizedRole, message: text, laAbsoluteTimestamp: timestamp });
  };
  for (const row of existing) {
    if (typeof row.message !== "string") continue;
    push(String(row.role ?? "user"), row.message, row.timestamp ?? row.laAbsoluteTimestamp ?? null);
  }
  for (const row of incoming) {
    push(row.role, row.message, row.laAbsoluteTimestamp ?? null);
  }
  return out;
}

export function formatLeadTranscript(
  rows: Array<{ role: string; message: string; laAbsoluteTimestamp?: number | null }>,
): { transcript_text: string; transcript_snapshot: Array<{ role: string; message: string; timestamp: number | null; quality?: string }> } {
  const snapshot = compactTranscriptRows(rows).map((row) => ({
    role: row.role,
    message: row.role === "assistant" ? normalizeAssistantReadBackSpacing(row.message) : row.message,
    timestamp: row.laAbsoluteTimestamp,
    quality: row.quality,
  }));
  return {
    transcript_text: snapshot
      .map((row) => `${row.role === "assistant" ? "iSCOTT" : "VISITOR"}: ${row.message}`)
      .join("\n\n"),
    transcript_snapshot: snapshot,
  };
}

export function leadPanelStatusCopy(args: {
  status?: string | null;
  submittedAt?: string | null;
  notificationStatus?: string | null;
  notificationOutboxId?: string | null;
  consentStatus?: string | null;
  contactConfirmedAt?: string | null;
}): string {
  if (args.notificationStatus === "failed" || args.notificationStatus === "dead_letter") {
    return "The send failed. Scott does not have this yet. I will keep the details here.";
  }
  if (args.notificationStatus === "test_held") {
    return "Test session — not sent.";
  }
  if (mayClaimHandoffSent(args)) {
    return "WildWorks received the notification-service confirmation.";
  }
  if (args.status === "submitted" || args.submittedAt) {
    return "Your details are queued for a secure WildWorks handoff.";
  }
  if (args.status === "ready_for_confirmation") {
    return leadHasSendPermission(args) ? sendReadyStatusCopy() : capturedAwaitingPermissionCopy();
  }
  return "I still need a way for Scott to reach you.";
}

const SEND_CONFIRMATION_WINDOW_SECONDS = 90;

// iScott reads emails back SPELLED ("S-G-D-I-E-T-Z@P-M dot M-E"). Collapse
// that form so spelled mentions still count as mentioning the contact value.
function collapseSpelledContact(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+dot\s+/g, ".")
    .replace(/\s+at\s+/g, "@")
    .replace(/[-\s]+/g, "");
}

function messageMentionsContact(message: string, contactValue: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim().toLowerCase();
  const contact = contactValue.trim().toLowerCase();
  if (!contact) return false;
  return normalized.includes(contact)
    || collapseSpelledContact(message).includes(contact.replace(/\s+/g, ""));
}

function isContactReadBack(message: string, contactValue: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim().toLowerCase();
  const contact = contactValue.trim().toLowerCase();
  if (!contact || !messageMentionsContact(message, contactValue)) return false;
  return /\b(?:i have your|your (?:email|phone)|is that (?:the )?right|does that look right)\b/i.test(normalized);
}

function isDirectContactSendPrompt(message: string, contactMethod: "email" | "phone", contactValue: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim().toLowerCase();
  const contact = contactValue.trim().toLowerCase();
  const mentionsContact = Boolean(contact) && messageMentionsContact(message, contactValue);
  const label = contactMethod === "email" ? "email" : "phone";
  const asksSendNow =
    new RegExp(
      `\\b(?:would you like me to|may i|should i|do you want me to|want me to)\\s+send\\s+(?:it|this|these details|your details|them)\\s+to\\s+(?:the\\s+)?(?:wildworks\\s+team|scott)\\b`,
      "i",
    ).test(normalized)
    || /\bsend\s+(?:it|this|these details|your details|them)\s+(?:directly\s+)?to\s+scott\b/i.test(normalized);
  // The brain's scripted permission ask ("May Scott contact you at that
  // email address...?") is a send prompt too — a yes to it is consent.
  const asksContactPermission =
    /\bmay\s+(?:i\s+have\s+)?scott\s+(?:contact|call|reach|email)\s+you\b/i.test(normalized)
    || /\bcan\s+scott\s+(?:contact|call|reach|email)\s+you\b/i.test(normalized);
  if (asksContactPermission && (mentionsContact || normalized.includes(label) || /\b(?:that|this)\s+(?:email|number|phone)\b/i.test(normalized))) {
    return true;
  }
  // G's ride b1dd603f, 2026-08-19 16:39. THIS COST A LEAD.
  //
  // iScott asked "Perfect! May I send these details to Scott?" and G answered
  // "Yes." The lead never went. consent_status stayed "unknown",
  // contact_confirmed_at stayed null, the auto-send condition was never met, and
  // iScott then TOLD him "Scott has your details and will follow up" - a send he
  // had not earned, on a lead that was still sitting at ready_for_confirmation.
  //
  // The rule contradicted itself. asksSendNow above deliberately accepts "these
  // details" as a valid phrasing - it is listed right there in the pattern - and
  // then this line demanded the SAME message also name the address or contain
  // the literal word "email". "May I send these details to Scott?" has neither,
  // so a perfectly clear question followed by a clear yes registered as nothing.
  //
  // asksSendNow is already specific: it requires may-i/should-i/want-me-to, plus
  // send, plus it/this/these details/your details/them, plus to Scott or the
  // WildWorks team. That whole shape IS the send prompt. Nothing about it is
  // ambiguous enough to need a second confirmation that the contact was named.
  if (asksSendNow) return true;
  return mentionsContact && isContactReadBack(message, contactValue) && asksSendNow;
}

export function avatarSpeechClaimsHandoffSent(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return (
    /\b(?:i sent|i've sent|i have sent|we sent)\b[\s\S]{0,80}\b(?:scott|wildworks|team|details|information)\b/i.test(normalized)
    || /\bpreparing (?:to send|the handoff)\b/i.test(normalized)
    || /\bscott (?:has|already has) (?:the|your) (?:information|details)\b/i.test(normalized)
    || /\b(?:i will send|i'll send|we will send)\b[\s\S]{0,80}\b(?:your details|the details|them|it)\s+(?:directly|over)\b/i.test(normalized)
    || /\b(?:he'll|he will|scott will)\s+(?:be in touch|reach out|follow up|review your request)\b/i.test(normalized)
    || /\b(?:confirmation )?box should disappear\b/i.test(normalized)
  );
}

export function allowedAvatarHandoffSpeech(
  text: string,
  lead: {
    status?: string | null;
    submittedAt?: string | null;
    notificationStatus?: string | null;
    notificationOutboxId?: string | null;
  },
): boolean {
  return allowedIscottSpeech(text, lead).allowed;
}

export function saysTeamNotScott(text: string): boolean {
  return /\b(?:wildworks\s+team|the team)\b/i.test(text) && !/\bscott\b/i.test(text);
}

export function claimsUploadReceived(text: string): boolean {
  return /\b(?:i (?:got|have|received) (?:your )?(?:photo|video|upload|file))\b/i.test(text);
}

export function allowedIscottSpeech(
  text: string,
  lead: {
    status?: string | null;
    submittedAt?: string | null;
    notificationStatus?: string | null;
    notificationOutboxId?: string | null;
  },
  extras?: { mediaCount?: number },
): { allowed: boolean; reason: string | null } {
  if (saysTeamNotScott(text)) return { allowed: false, reason: "say_scott_not_team" };
  if (avatarSpeechClaimsHandoffSent(text) && !mayClaimHandoffSent(lead)) {
    return { allowed: false, reason: "false_handoff_claim" };
  }
  if (claimsUploadReceived(text) && !(extras?.mediaCount && extras.mediaCount > 0)) {
    return { allowed: false, reason: "false_upload_claim" };
  }
  if (!allowedUploadGuidanceSpeech(text)) {
    return { allowed: false, reason: "unsupported_upload_guidance" };
  }
  if (genericPassAlongForbidden(text)) {
    return { allowed: false, reason: "generic_pass_along" };
  }
  return { allowed: true, reason: null };
}

export function stateAwareTapCopy(lead: {
  status?: string | null;
  submittedAt?: string | null;
  notificationStatus?: string | null;
  notificationOutboxId?: string | null;
}): string {
  return leadPanelStatusCopy(lead);
}

export function frustrationRecoveryScript(): string {
  return "I hear you. I will not say Scott has this until the send is confirmed. Tell me the next correction.";
}

export function isProfanityEscalation(text: string): boolean {
  return /\b(?:fuck|shit|damn it|goddamn|asshole|what the hell)\b/i.test(text);
}

const SPECIFIC_FEEDBACK_PATTERNS: RegExp[] = [
  /\b(?:too small|bigger|finish|concierge|typewriter|email box|button|viewport|reading glasses|you said|don't say|do not say|wrong|box is)\b/i,
  /\b(?:should(?:n't| not)? (?:be|say|come|pop|go|show|start|stop|move)|needs? to (?:be|say|go|move|come)|has to (?:be|say|go)|it(?:'s| is) got to)\b/i,
  /\b(?:no,|nope|that(?:'s| is) (?:not|wrong|incorrect)|not right|not correct|incorrect|that(?:'s| is) not what)\b/i,
  /\b(?:too fast|too slow|slow down|speed up|say it (?:slower|again)|a little slower|you repeated|you said it (?:twice|again))\b/i,
  /\b(?:move (?:it|that|the)|lower|higher|closer|further|bigger|smaller|too (?:big|wide|narrow|low|high))\b/i,
  /\b(?:that(?:'s| is)? not my|my (?:email|phone|name) is|spell it|let me (?:correct|redo|try again)|start over)\b/i,
];

export function isSpecificFeedback(text: string): boolean {
  return SPECIFIC_FEEDBACK_PATTERNS.some((pattern) => pattern.test(text));
}

export function genericPassAlongForbidden(text: string): boolean {
  return /\bpass along your feedback\b/i.test(text) && !isSpecificFeedback(text);
}

export function completeCloseGuidance(): string {
  return "Use Finish to stop this session. Use Close if you want the page to end. Scott does not have your details unless the status says the notification service confirmed.";
}

export function reliableCloseSentence(): string {
  return "The session is finished. Nothing else will be sent unless you start again.";
}

export function spokenPreferenceSignal(text: string): boolean {
  return Boolean(extractContactPreference(text))
    || /\b(?:prefer|i like|i want the)\b/i.test(text);
}

export function replayIscott76Session(
  turns: Array<{ n?: number; role: string; text: string; timestamp?: number | null }>,
): {
  turnCount: number;
  fullName: string | null;
  location: string | null;
  emailExtracted: boolean;
  contactMethodEmail: boolean;
  canonicalOmitsClips: boolean;
  snapshotKeepsSession: boolean;
  georgeSurvivesLateBatch: boolean;
  cannotClaimSent: boolean;
  cannotClaimPreparing: boolean;
} {
  const rows = turns.map((turn) => ({
    role: turn.role === "assistant" ? "assistant" as const : "user" as const,
    message: turn.text,
    laAbsoluteTimestamp: turn.timestamp ?? null,
  }));
  const canon = formatLeadTranscript(rows);
  const userTexts = rows.filter((row) => row.role === "user").map((row) => row.message);
  let fullName: string | null = null;
  let location: string | null = null;
  let email: string | null = null;
  for (const text of userTexts) {
    fullName = extractSpokenFullName(text) ?? fullName;
    location = extractLocation(text) ?? location;
    email = extractEmail(text) ?? email;
  }
  const late = mergeLeadTranscriptHistory(canon.transcript_snapshot, rows.slice(-2));
  const lateCanon = formatLeadTranscript(late);
  const unsubmitted = { status: "ready_for_confirmation", notificationStatus: null };
  return {
    turnCount: turns.length,
    fullName,
    location,
    emailExtracted: Boolean(email),
    contactMethodEmail: userTexts.some((text) => /\bemail\b/i.test(text)),
    canonicalOmitsClips: !/(?:^|\n)iSCOTT: It seems(?:\n|$)/.test(canon.transcript_text)
      && !/(?:^|\n)iSCOTT: It sounds(?:\n|$)/.test(canon.transcript_text),
    snapshotKeepsSession: canon.transcript_snapshot.length > 2,
    georgeSurvivesLateBatch: lateCanon.transcript_snapshot.some((row) => /George/.test(row.message)),
    cannotClaimSent: !allowedAvatarHandoffSpeech(
      "Perfect! Scott has your information and will follow up with you",
      unsubmitted,
    ),
    cannotClaimPreparing: !allowedAvatarHandoffSpeech("I'm preparing the handoff now.", unsubmitted),
  };
}

export function evaluateIScottCaptureSlice(args: {
  rows: TranscriptTurn[];
  contactMethod: "email" | "phone";
  contactValue: string;
  createdAt?: string;
}): {
  fullName: string | null;
  projectNeed: string | null;
  shouldConfirm: boolean;
  consentStatus: "unknown" | "accepted";
  contactConfirmed: boolean;
  transcript_text: string;
  mayClaimSent: boolean;
  operatorNote: string | null;
  followUpAccepted: boolean;
  contactReadBackCorrect: boolean;
  contactPreference: "sms" | "voice" | "email" | null;
  operatorPromptEcho: boolean;
  salesLanguage: boolean;
  operatorServiceScript: string | null;
} {
  const compacted = compactTranscriptRows(args.rows);
  const userTexts = compacted.filter((row) => row.role === "user").map((row) => row.message);
  let fullName: string | null = null;
  let contactPreference: "sms" | "voice" | "email" | null = null;
  for (const text of userTexts) {
    fullName = extractSpokenFullName(text) ?? fullName;
    contactPreference = extractContactPreference(text) ?? contactPreference;
  }
  const need = visitorProjectNeedFromRows(userTexts);
  const projectNeed = need.projectNeed;
  const createdAt = args.createdAt ?? new Date().toISOString();
  const isPostRollout = Date.parse(createdAt) >= Date.parse("2026-08-16T17:30:00.000Z");
  const shouldConfirm =
    isPostRollout &&
    detectsContextualContactSendConfirmation(args.rows, args.contactMethod, args.contactValue);
  const transcript = formatLeadTranscript(args.rows);
  return {
    fullName,
    projectNeed,
    shouldConfirm,
    consentStatus: shouldConfirm ? "accepted" : "unknown",
    contactConfirmed: shouldConfirm,
    transcript_text: transcript.transcript_text,
    mayClaimSent: false,
    operatorNote: extractOperatorSiteNote(userTexts),
    followUpAccepted: detectsFollowUpAcceptance(args.rows),
    contactReadBackCorrect: userTexts.some((text) => detectsContactReadBackCorrect(text)),
    contactPreference,
    operatorPromptEcho: args.rows.some((row) => row.role === "assistant" && isOperatorPromptEcho(row.message)),
    salesLanguage: args.rows.some((row) => isOperatorSalesLanguage(row.message)),
    operatorServiceScript: need.operatorServiceScript,
  };
}

export function detectsContextualContactSendConfirmation(
  rows: TranscriptTurn[],
  contactMethod: "email" | "phone",
  contactValue: string,
): boolean {
  let lastPromptAt: number | null = null;
  let sawSendPrompt = false;
  let sawReadBack = false;
  for (const row of rows) {
    if (row.role === "assistant") {
      if (isDirectContactSendPrompt(row.message, contactMethod, contactValue)) {
        sawSendPrompt = true;
        lastPromptAt = row.laAbsoluteTimestamp;
      } else if (isContactReadBack(row.message, contactValue)) {
        sawReadBack = true;
      }
      continue;
    }
    if (row.role !== "user") continue;
    if (isUiOnlyAffirmation(row.message)) continue;
    // G's ride 7325f798, 2026-08-19 13:46. THE SECOND LEAD LOST THE SAME DAY.
    //
    // He said, in one breath: "so the email's correct. Send the email to Scott."
    // isSendCommandConsent reads that as an explicit command - correctly. Then
    // this line threw it away, because it also demanded that iScott had ASKED
    // first. In that ride iScott never asked, and the only read-back he had done
    // was of a MIS-HEARD address (S-G-D-I-E-Z) before G corrected it, so it did
    // not match the stored contact either. Both flags were false. A direct
    // instruction from the visitor registered as nothing, the row stayed at
    // ready_for_confirmation, and iScott told him "Perfect! I'm sending that to
    // Scott." G then said, on the recording: "it should fire immediately... it's
    // been a full minute. And nothing."
    //
    // THE COMMAND IS THE CONSENT. Being asked first is one way to get consent,
    // not the only way. isSendCommandConsent is already narrow - it requires the
    // verb, a WildWorks/Scott target or an explicit my/the information|details|
    // email, it refuses UI-only affirmations, and negation wins outright, so
    // "don't send my info" can never reach here. Nothing about "send the email
    // to Scott" needs iScott's permission to count.
    //
    // The prompt-and-affirmation path below is untouched: a plain "yes" still
    // requires that something was actually asked, and still inside the window.
    if (isSendCommandConsent(row.message)) {
      return true;
    }
    if (
      sawSendPrompt &&
      detectsSimpleAffirmation(row.message) &&
      lastPromptAt !== null &&
      row.laAbsoluteTimestamp !== null &&
      row.laAbsoluteTimestamp >= lastPromptAt &&
      row.laAbsoluteTimestamp - lastPromptAt <= SEND_CONFIRMATION_WINDOW_SECONDS
    ) {
      return true;
    }
  }
  return false;
}

// G, 2026-08-19: "I definitely want to qualify leads. iScott can definitely
// further probe people with questions on how serious they are, and then you guys
// can put that in the report."
//
// Deterministic on purpose. This reads what the VISITOR actually said and quotes
// it back; it never scores a stranger on a hunch. Scott is going to ring these
// people, and a lead labelled "hot" on a guess wastes his afternoon worse than
// one labelled "unknown" honestly.
//
// Every field is either the visitor's own words or null. Null means "they did not
// say", which is real information and is reported as such.
export type LeadQualification = {
  timeline: string | null;
  budget: string | null;
  ownership: string | null;
  competing: string | null;
  readiness: "ready" | "planning" | "early" | "unknown";
  signals: string[];
};

const QUAL_PATTERNS: Array<{
  key: "timeline" | "budget" | "ownership" | "competing";
  re: RegExp;
}> = [
  { key: "timeline", re: /\b(?:as soon as possible|asap|right away|immediately|this (?:week|month|spring|summer|fall|autumn|winter|year)|next (?:week|month|spring|summer|fall|year)|within (?:a|the|\d+)\s*(?:week|weeks|month|months)|by (?:spring|summer|fall|autumn|winter|christmas|the end of[^.!?]{0,24})|in the spring|in the fall|no rush|not in a hurry|just (?:looking|browsing|starting)|down the road|someday|eventually)\b/i },
  { key: "budget", re: /\b(?:budget|\$\s?\d[\d,]*|\d+\s*(?:k\b|thousand)|price range|ballpark|how much|afford|spend(?:ing)?\b|quote|estimate|financing)\b/i },
  { key: "ownership", re: /\b(?:my (?:house|home|property|yard|backyard|land|place)|we own|i own|our (?:house|home|property|yard)|just bought|closing on|renting|landlord|hoa\b)\b/i },
  { key: "competing", re: /\b(?:another (?:contractor|company|quote|bid)|other (?:contractors|companies|quotes|bids)|shopping around|comparing|second opinion|already (?:have|got) a quote|talked to (?:a|another|some) (?:contractor|builder|landscaper))\b/i },
];

// Wording that means the visitor is ready to move, versus wording that means they
// are a long way off. Kept separate from the patterns above so a "no rush" cannot
// be mistaken for a timeline commitment.
const READY_NOW = /\b(?:as soon as possible|asap|right away|immediately|this (?:week|month)|ready to (?:go|start|book)|when can (?:he|scott|you) (?:start|come)|need (?:this|it) done)\b/i;
const EARLY_ONLY = /\b(?:just (?:looking|browsing|curious|starting)|no rush|not in a hurry|down the road|someday|eventually|next year|thinking about)\b/i;

export function summariseLeadQualification(
  visitorTexts: string[],
  extra?: { hasRealProject?: boolean },
): LeadQualification {
  const clean = visitorTexts
    .map((t) => (t || "").replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 2);
  const joined = clean.join(" ");

  const found: Record<string, string | null> = {
    timeline: null, budget: null, ownership: null, competing: null,
  };
  const signals: string[] = [];

  for (const { key, re } of QUAL_PATTERNS) {
    for (const line of clean) {
      const m = line.match(re);
      if (!m) continue;
      // Quote the visitor's sentence, not the matched fragment - Scott needs the
      // context, and a bare keyword is how a lead gets misread.
      const quote = line.length > 160 ? `${line.slice(0, 157)}...` : line;
      found[key] = quote;
      signals.push(`${key}: "${quote}"`);
      break;
    }
  }

  const readyNow = READY_NOW.test(joined);
  const earlyOnly = EARLY_ONLY.test(joined);
  let readiness: LeadQualification["readiness"] = "unknown";
  if (readyNow && !earlyOnly) readiness = "ready";
  else if (earlyOnly && !readyNow) readiness = "early";
  else if (found.timeline || found.budget || found.ownership) readiness = "planning";
  // G, 2026-08-23, on a real lead marked "NOT ESTABLISHED" after he described a
  // specific project in detail and said yes immediately: "planning" already
  // means "real project, no date named" - this tier just never checked whether
  // one was actually described. A lead only reaches this email after consent is
  // confirmed elsewhere, so a real, specific project on its own is the same
  // honest signal as timeline/budget/ownership, not a guess.
  else if (extra?.hasRealProject) readiness = "planning";

  return {
    timeline: found.timeline,
    budget: found.budget,
    ownership: found.ownership,
    competing: found.competing,
    readiness,
    signals,
  };
}

// Pull the VISITOR lines back out of a rendered transcript so the email can
// qualify without needing the raw rows. Anything that is not clearly a visitor
// line is ignored rather than guessed at.
export function visitorLinesFromTranscript(transcript: string): string[] {
  return (transcript || "")
    .split(/\r?\n/)
    .filter((line) => /^VISITOR:/i.test(line.trim()))
    .map((line) => line.replace(/^\s*VISITOR:\s*/i, "").trim())
    .filter(Boolean);
}
