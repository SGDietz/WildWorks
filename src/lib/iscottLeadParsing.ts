import { iscottSalesCopyContextBlock } from "./iscottSalesCopy";

// HOW PEOPLE ACTUALLY ANSWER "what do you need?", 2026-08-31.
//
// This used to be one pattern: I/we + want|need|would like|am looking. It threw
// away most of a real conversation. Measured against G's own rides:
//
//   "I'd like to have him build one for me."       -> null   (contraction)
//   "I'm interested in a website."                 -> null   (contraction)
//   "Him to build my brand and website"            -> null   (bare answer)
//   "Build me a website and a logo."               -> null   (imperative)
//
// Two of his four rides on 2026-08-31 captured his address, locked consent, and
// still could not qualify because the job was never extracted from sentences
// that plainly stated it. G: "yes, loosen it."
//
// The contraction gap was the biggest single hole. "I'd" and "I'm" are how
// almost everyone says this out loud, and neither was listed.
//
// Loosening the EXTRACTOR is safe in a way that loosening the gate would not
// be: isSpecificProjectNeed still runs on whatever comes out, and still refuses
// generic text, coaching/persona answers, contact mechanics and operator sales
// language. This only decides which words to hand it.
const PROJECT_NEED_PATTERNS: RegExp[] = [
  // Fragmented LiveAvatar speech can put a sentence stop after a contact
  // preface: "I want Scott to reach out. to me to help me build a digital
  // company...". Recover the substantive clause instead of treating the
  // contact action as the job.
  /\bhelp\s+(?:me|us)\s+((?:build|make|design|create|redo|rebuild|launch)\s+[^.!?]{3,260})/i,
  // Direct answer to "what are you looking to accomplish?": "To build
  // brands." There is no subject because the question already supplied it.
  /^((?:to\s+)?(?:build|make|design|create|redo|rebuild|launch)\s+[^.!?]{3,260})[.!?]*$/i,
  // I want / I need / I'd like / I'm looking for / I'm interested in / we ...
  /\b(?:i|we)\s*(?:'|’)?\s*(?:want|wanted|need|needed|would\s+like|d\s+like|am\s+looking|m\s+looking|are\s+looking|re\s+looking|am\s+interested|m\s+interested|am\s+after|m\s+after|ve\s+been\s+wanting)\b\s*(?:to\s+|for\s+|in\s+)?([^.!?]{3,260})/i,
  // "Him to build my brand" / "Scott to redo the patio" - the bare answer to
  // iScott's own question, where the subject is him and not the visitor.
  /\b(?:him|scott|iscott|you)\s+to\s+((?:build|make|design|create|do|redo|rebuild|help)[^.!?]{3,260})/i,
  // Straight imperative: "Build me a website and a logo."
  /\b(?:build|make|design|create|do)\s+(?:me|us)\s+([^.!?]{3,260})/i,
  // "Can you build me a site" / "could you design a logo"
  // 2026-09-01. "help" was missing here, and it is the single most common verb
  // a visitor reaches for. G opened ride 3414643a with "can he help me build my
  // brand?" - his answer, in his first breath - and this pattern did not hear
  // it, which is WHY the project need was still empty later when the error echo
  // walked in and took the slot. The sibling pattern above has always had it.
  /\b(?:can|could|would)\s+(?:you|he|scott)\s+((?:build|make|design|create|do|redo|rebuild|redesign|help)[^.!?]{3,260})/i,
];

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
    .replace(/^(?:like|so|well)\b[\s,.-]*/i, "")
    // H453 (Codex spec, applied by Claude 2026-09-02): "a website and then I What type..." (89c453ff) is
    // the visitor's "a website" plus a restarted clause welded across a transcript break. Cut the tail.
    .replace(/\s+\band then i\b.*$/i, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

// Grok, 2026-08-19: the lead for session 6f3a7caa carried project_need
// "Tell my phone number". G was operating the contact flow, not describing a
// project, and Scott would have opened that lead to read it as the job.
// Anything that is only about the mechanics of being contacted is not a need.
const CONTACT_MECHANICS_NEED =
  /\b(?:phone number|email address|e-?mail|contact (?:info|information|details)|contact me|reach me|reach out|get in touch|call me|text me)\b/i;

// 2026-09-01. THE ECHO TRAP - the fault that cost G's ride 3414643a and locked
// the lead box in a loop no visitor could ever escape.
//
// The confirm route refused the send and put its OWN words on screen:
//   "Nothing has been sent. iScott still needs to hear, in your own words, what
//    you want Scott to help with - say that, then choose Send to Scott again."
//
// G did the most natural thing a confused person does with a box they do not
// understand. He READ IT OUT LOUD, and asked what it meant.
//
// PROJECT_NEED_PATTERNS then matched its own copy inside his reading of it -
// "Scott to help with, say that, then choose Send to Scott again" - and stored
// THAT as project_need. The gate refused it as generic, printed the same box
// again, and the trap closed: every attempt to ask about the error re-armed the
// error. His real answer, given in his first breath, was already gone.
//
// A visitor reading our own screen back to us is never a visitor describing
// their project, granting permission, or giving their name. This is the
// visitor-side twin of isOperatorPromptEcho, and it is deliberately built from
// distinctive multi-word phrases that only ever appear in OUR copy, so ordinary
// speech cannot trip it.
const APP_SCREEN_COPY_FRAGMENTS: string[] = [
  // the 409 missing-step panel, every branch
  "nothing has been sent",
  "nothing has been sent to scott yet",
  "iscott still needs",
  "in your own words what you want scott to help with",
  "then choose send to scott",
  "choose send to scott again",
  "say it then choose send to scott",
  "does not match the contact iscott has",
  "let iscott read it back",
  "let iscott read the new details back",
  "has not read that back to you",
  "does not have your permission to send this yet",
  "say yes when iscott asks",
  "still needs a way for scott to reach you",
  "your details changed after you gave permission",
  // delivery failure and validation copy
  "the send failed",
  "scott does not have this yet",
  "i will keep the details here",
  "does not look complete please correct it",
  "that email address does not look complete",
  "that phone number does not look complete",
  // in-flight status copy
  "checking your details",
  "saved the conversation but could not finish the handoff",
];

function normaliseForScreenCopy(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/[‐-―]/g, " ")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// True when this turn is quoting the app's own on-screen words back at us.
export function isAppScreenCopyEcho(text: string): boolean {
  const normalised = normaliseForScreenCopy(text ?? "");
  if (!normalised) return false;
  return APP_SCREEN_COPY_FRAGMENTS.some((fragment) => normalised.includes(fragment));
}

export function extractProjectNeed(text: string): string | null {
  // The screen's own words are not the visitor's project. See the trap above.
  if (isAppScreenCopyEcho(text)) return null;
  let best: string | null = null;
  for (const pattern of PROJECT_NEED_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const candidate = stripSpokenProjectFiller(match[1].replace(/\s+/g, " ").trim());
    if (/^(?:talk|speak|know|ask|say)\b/i.test(candidate)) continue;
    if (isCoachingOrPersonaNeed(candidate)) continue;
    if (CONTACT_MECHANICS_NEED.test(candidate)) continue;
    const normalized = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    best = preferProjectNeed(best, normalized);
  }
  return best;
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

/**
 * "<name> from <place>", with or without an introduction cue.
 *
 * G's ride 129b69d6, 2026-08-31: he gave his name as "Scott" and the package
 * reached him carrying the name "Information". The sentence that did it was
 *
 *     "I mean, you could have gotten more information from me, but it's..."
 *
 * The old pattern made the whole cue group optional and then matched ANY
 * "<word> from <word>," anywhere in a sentence, so it read "information from
 * me," as name=Information, place=me. "me" was not in the rejected-place list,
 * so it sailed through, and the capture layer then treated it as a correction
 * and REPLACED the real name.
 *
 * The bare, cueless form still has to work - "Scott from Timonium." is exactly
 * how someone answers "what's your name?" - so it is kept, but ANCHORED to the
 * start of the utterance (after optional hesitation words). An introduction is
 * the first thing out of your mouth; a stray "X from Y" eleven words deep is
 * not one. Cued forms stay matchable anywhere.
 *
 * Pronouns are also refused as places, which independently kills "from me",
 * "from you", "from them".
 */
export function extractSpokenNameAndPlace(text: string): { name: string | null; location: string | null } {
  const NAME_WORD = "([\\p{L}][\\p{L}'-]*)";
  const PLACE_WORDS = "([\\p{L}][\\p{L}'-]*(?:\\s+[\\p{L}][\\p{L}'-]*){0,3})";
  const TAIL = "(?=\\s*[.!?,]|$)";
  // Cued: an explicit introduction, allowed anywhere in the turn.
  const cued = new RegExp(
    "\\b(?:my name is|my name's|call me|i(?:'m| am))\\s+" + NAME_WORD + "\\s+from\\s+" + PLACE_WORDS + TAIL,
    "iu",
  );
  // Bare: no cue, so it only counts when it OPENS the turn.
  const bare = new RegExp(
    "^\\s*(?:(?:uh|um|er|ah|oh|well|hi|hey|hello|yeah|yes)[,\\s]+)*" +
      NAME_WORD + "\\s+from\\s+" + PLACE_WORDS + TAIL,
    "iu",
  );
  const match = text.match(cued) ?? text.match(bare);
  if (!match?.[1] || !match[2]) return { name: null, location: null };
  const name = match[1].trim();
  const place = match[2].replace(/[.,!?;:]+$/g, "").trim();
  if (NAME_STOP.test(name) || name.length < 2 || name.length > 40) return { name: null, location: null };
  // A pronoun is never a place. "from me" is the one that cost a real lead.
  if (
    /^(?:here|there|work|home|scratch|the|me|you|us|them|him|her|it|myself|yourself|someone|anyone|everyone|somebody|anybody|everybody)$/i.test(
      place,
    ) ||
    place.length < 2 ||
    place.length > 80
  ) {
    return { name: titleNameWords(name), location: null };
  }
  return { name: titleNameWords(name), location: titleLocationWords(place) };
}

export function extractSpokenFullName(text: string, previousAssistantText?: string | null): string | null {
  const fromPlace = extractSpokenNameAndPlace(text).name;
  if (fromPlace) return fromPlace;
  const askedForName = typeof previousAssistantText === "string" &&
    /\b(?:what(?:'s| is)\s+your\s+(?:full\s+)?name|(?:could|can|would)\s+you\s+(?:please\s+)?(?:share|tell\s+me)\s+(?:your\s+)?(?:full\s+)?name|please\s+(?:share|tell\s+me)\s+(?:your\s+)?(?:full\s+)?name)\b/i
      .test(previousAssistantText.replace(/\s+/g, " ").trim());
  const named = text.match(
    /\b(?:my name is|my name's|call me)\s+(?:(?:um+|uh+|erm+|hmm+|well|okay|ok|yeah|yes)[,.!?;:\s-]+)*([\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){0,3})/iu,
  );
  const directSpoken = text.match(
    /\b(?:i(?:'m| am))\s+([\p{L}][\p{L}'-]*)(?=\s*(?:,|and\b|in\b|from\b|[.!?]|$)|\s*$)/iu,
  )?.[1];
  const contextualSpoken = askedForName
    ? text.match(/\bit(?:'s| is)\s+([\p{L}][\p{L}'-]*)(?=\s*(?:,|and\b|in\b|from\b|[.!?]|$)|\s*$)/iu)?.[1]
    : null;
  const spoken = named
    ? named[1]
    : directSpoken ?? contextualSpoken;
  // G's 2026-09-02 vertical-iPad ride answered iScott's direct name question
  // with "Scott. And the box? ...". A bare answer is not an introduction, so
  // the old cue-only extractor discarded it and the complete handoff remained
  // blocked on full_name. Bare leading words count only when the immediately
  // preceding assistant turn actually asks for the visitor's name. This keeps
  // normal sentences beginning with a person's name out of the name field.
  const bareAnswer = !spoken && askedForName
    ? text.replace(/^(?:(?:um+|uh+|well|okay|ok|all\s*right|alright)[,.]?\s+)*/i, "").match(
        /^([\p{L}][\p{L}'’.-]*(?:\s+(?!(?:and|but)\b)[\p{L}][\p{L}'’.-]*){0,3})(?=\s*(?:[.!?;,]|\b(?:and|but)\b|$))/iu,
      )?.[1] ?? null
    : null;
  if (bareAnswer && /\b(?:box|button|screen|field|label|finish|upload|email|phone|number|off[- ]?screen)\b/i.test(bareAnswer)) {
    return null;
  }
  if (contextualSpoken && /\b(?:low|dark|perfect|small|broken|off|box|button|screen|field|label|finish|upload|email|phone|number)\b/i.test(contextualSpoken)) {
    return null;
  }
  const candidate = (spoken ?? bareAnswer)
    ?.split(/\b(?:and|but|from|in)\b/i)[0]
    .replace(/[.,!?;:]+$/g, "")
    .trim();
  if (!candidate) return null;
  const cleanedCandidate = candidate
    .split(/\b(?:and|but|from|in)\b/i)[0]
    .replace(/[.,!?;:]+$/g, "")
    .trim();
  if (cleanedCandidate.length < 2 || cleanedCandidate.length > 90) return null;
  if (NAME_STOP.test(cleanedCandidate)) {
    return null;
  }
  const titled = titleNameWords(cleanedCandidate);
  return isMeaningfulVisitorName(titled) ? titled : null;
}

export function preferProjectNeed(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current) return next;
  // 2026-09-01. Our own screen copy is never a project need, wherever it
  // reaches this function from - including a value already POISONED in the
  // database by an earlier ride, which is how G's row still held
  // "...then choose Send to Scott again" this morning.
  if (isAppScreenCopyEcho(next)) return current;
  if (isAppScreenCopyEcho(current)) return next;
  // 2026-09-01. Before today the ONLY test below was length, so the longest
  // string won outright. That is how a visitor reading our own refusal box out
  // loud could overwrite a real answer with our own copy. A need that qualifies
  // is never traded for one that does not, whatever its length.
  const currentQualifies = isSpecificProjectNeed(current);
  const nextQualifies = isSpecificProjectNeed(next);
  if (currentQualifies && !nextQualifies) return current;
  if (!currentQualifies && nextQualifies) return next;
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
  // 2026-09-01. THE NINE-WORD LIST THAT ATE THREE LEADS.
  //
  // iScott asked G "May Scott contact you at that email address?" and he said
  // "Perfect. Yes." - as clean a yes as English has. It registered as nothing,
  // because the filler list below was nine words long and "perfect" was not one
  // of them, so the yes never sat at the start of the turn. Three of his last
  // four leads died holding his real address for exactly this reason.
  //
  // People do not answer a yes/no question with a bare yes. They answer with a
  // reaction and THEN the yes. Every word added here is pure acknowledgement -
  // it carries no agreement of its own, so it cannot manufacture a consent that
  // was not given. It is widened in ALL THREE regexes on purpose: the negation
  // guard and the reversal guard have to see exactly what the yes matcher sees,
  // or "Perfect. Yeah, but hold on" would become consent.
  // NEGATION WINS, AND IT IS CHECKED FIRST.
  //
  // This guard exists because of what the next block had to accept. "yet" is
  // now a yes token, and "not yet" is one of the most natural refusals in
  // English. Without this line, the fix for a missed yes would have started
  // manufacturing consent out of a plain no - far worse than the bug it
  // repairs. Same for "don't send that yet" and "hold on".
  if (
    /^(?:(?:and|but|um+|uh|okay|ok|all\s?right|alright|well|good|so|perfect|great|awesome|excellent|cool|nice|sweet|fantastic|wonderful|brilliant|lovely|beautiful|gotcha|got\s+it|sounds\s+good|very\s+good|thanks|thank\s+you)[,.!]?\s+)*(?:no|nope|nah|not|don'?t|do not|hold on|hang on|wait|stop)\b/i.test(t)
  ) {
    return false;
  }
  // G live rides 2026-08-17: real yeses arrive with filler ("And, but yes,
  // that email is correct." / "I already confirmed it.") - count them.
  //
  // G live ride ae10ba06, 2026-08-29 19:00 ET. THIS COST A LEAD.
  //
  // iScott asked "May I send these details to Scott?" and G answered "Yep."
  // The transcriber wrote "Yet." Every token on the old list was a spelling
  // of a WORD; none was a spelling of a MIS-HEARING, and voice is the only
  // way anyone ever answers this question. The row froze at
  // ready_for_confirmation, no mail was ever built, and iScott told him
  // "Scott has your details and will follow up" regardless.
  //
  // "ya" excludes "ya know" - that is filler in front of a sentence, not an
  // answer to anything.
  // REVERSAL AFTER THE YES. Grok caught this on 2026-08-30 and he was right:
  // the negation guard above is START-anchored, so it only sees a refusal that
  // OPENS the turn. Every one of these opens with a real yes token and then
  // takes it straight back -
  //
  //   "yeah, but hold on"   "yeah no"   "sure, later"   "yes, wait"
  //   "sure, only if Scott calls first"
  //
  // and all of them would have registered as clean consent. A yes that is
  // immediately qualified is not a yes; it is a question nobody has asked yet.
  // Ordering matters: this runs AFTER the yes matched, so "And, but yes, that
  // email is correct." survives - its "but" sits in the filler BEFORE the yes,
  // and the remainder carries no reversal.
  if (/^(?:(?:and|but|um+|uh|okay|ok|all\s?right|alright|well|good|so|perfect|great|awesome|excellent|cool|nice|sweet|fantastic|wonderful|brilliant|lovely|beautiful|gotcha|got\s+it|sounds\s+good|very\s+good|thanks|thank\s+you)[,.!]?\s+)*(?:yes|yeah|yep|yup|yet|ya|yah|sure|absolutely|definitely|affirmative|of\s+course|correct|right|exactly)\b[\s\S]*\b(?:but|wait|hold\s+on|hang\s+on|later|actually|unless|though|only\s+if|as\s+long\s+as|no|not|don'?t|never|stop)\b/i.test(t)) {
    return false;
  }
  if (
    /^(?:(?:and|but|um+|uh|okay|ok|all\s?right|alright|well|good|so|perfect|great|awesome|excellent|cool|nice|sweet|fantastic|wonderful|brilliant|lovely|beautiful|gotcha|got\s+it|sounds\s+good|very\s+good|thanks|thank\s+you)[,.!]?\s+)*(?:yes|yeah|yep|yup|yet|ya(?!\s*know)|yah|sure|absolutely|definitely|affirmative|of\s+course|go\s+ahead|do\s+it|please\s+do|send\s+it|correct|right|that(?:'s| is) right|you got it|exactly)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(?:that(?:'s| is)?\s+(?:email|number|phone)?\s*(?:is\s+)?correct\b|i\s+(?:already\s+)?confirmed(?:\s+it)?\b|it(?:'s| is)\s+confirmed\b)/i.test(t)) {
    return true;
  }
  // G live ride cad6a3dd, 2026-09-03 13:11 ET. THIS COST THE SEND.
  // iScott asked "May Scott contact you at that email address?" and G answered
  // "That's fantastic." Every word above treats those positives as FILLER that
  // must be followed by a yes-core, so a purely enthusiastic answer registered
  // nothing: consent froze at unknown, no confirmation ever appeared ("dead
  // air"), while the avatar still said "Okay, I'm sending that email to Scott."
  // A whole turn that is NOTHING BUT positive exclamation, in the consent-answer
  // slot, is a yes. The negation and reversal guards above have already run,
  // and the $ anchor means one trailing doubt-word breaks the match.
  return /^(?:(?:and|but|um+|uh|oh|okay|ok|all\s?right|alright|well|so|wow)[,.!]?\s+)*(?:that(?:'s| is|\s+sounds?|\s+would\s+be)\s+)?(?:fantastic|great|awesome|perfect|wonderful|excellent|brilliant|beautiful|lovely|amazing|terrific|sweet|cool|love\s+it|i(?:'d| would)\s+love\s+(?:it|that))[,.!\s]*$/i.test(t);
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
  // 2026-09-01. G's 14:06 ride cut iScott off three times: "Got", "I", and
  // "Absolutely! Scott can create stunning landscapes,". The first two are
  // caught by AVATAR_STUB_RE. The third was NOT: the trailing-comma rule above
  // only fires for utterances that OPEN with "i understand" / "it seems" /
  // "it sounds", so a normal sentence chopped mid-clause scored as complete and
  // never raised a barge-in event.
  //
  // An assistant turn that ends on a comma, colon or semicolon is unfinished
  // regardless of how it started - the avatar does not close a turn on a
  // dangling clause. Detection only: this raises an `iscott_barge_in` telemetry
  // event, it does not change what iScott says or does. The word-count and
  // opener limits are deliberately NOT applied here, since the whole failure
  // was a long, ordinary sentence.
  if (/[,:;]\s*$/.test(trimmed)) return true;
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
    .replace(new RegExp("\\s*" + SPOKEN_DASH + "\\s*", "g"), "-")
    // A deliberately spelled address arrives as isolated letters or read-back
    // dashes. Collapse only the three runs touching @ and dot; a preceding
    // one-letter prose word (or the "s" in "that's") must not join the local
    // part.
    .replace(/(?<!['’])\b[a-z0-9]\b(?:[\s,-]+\b[a-z0-9]\b)+(?=\s*@)/gi, (run) =>
      (run.match(/[a-z0-9]/gi) ?? []).join(""))
    .replace(/(?<=@)\s*\b[a-z0-9]\b(?:[\s,-]+\b[a-z0-9]\b)+(?=\s*\.)/gi, (run) =>
      (run.match(/[a-z0-9]/gi) ?? []).join(""))
    .replace(/(?<=\.)\s*\b[a-z0-9]\b(?:[\s,-]+\b[a-z0-9]\b)+/gi, (run) =>
      (run.match(/[a-z0-9]/gi) ?? []).join(""));
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
  // Talking about the visible field is not choosing a contact method. Keep
  // this before the broad phone/email branches: f1163ff3 said "the box ...
  // your phone" while correcting the UI and briefly flipped the live field.
  if (/\b(?:email|phone|capture)\s+box\b|\bbox\b[\s\S]{0,40}\b(?:email|phone)\b|\b(?:email|phone)\b[\s\S]{0,40}\b(?:box|words?|label|glow)\b/i.test(normalized)) {
    return null;
  }
  // A physical-phone complaint is also not a contact-method choice. Keep the
  // phrase narrow so "Phone. My number is on the screen." remains a valid
  // answer; the screen alone is not evidence of UI commentary.
  if (/\b(?:throw(?:ing)?|threw|drop(?:ped|ping)?|broke|broken|lost|where did)\b[\s\S]{0,40}\bphone\b/i.test(normalized)) {
    return null;
  }
  // G's desktop ride 1cc18a84, 2026-09-03 15:46 ET: "Um, can I call you Scott?"
  // opened the YOUR PHONE box two minutes before any contact talk - "I haven't
  // said anything about wanting to do phone number or email" / "take the box
  // down. Because we haven't gotten there yet." Calling SOMEONE something, or
  // asking what to call them, is not asking to be phoned. A bare "call me" is
  // still a phone choice; "call me Scott" is a name.
  if (!/\b(?:phone|telephone|sms|text\s+me|by\s+text|or\s+text)\b/i.test(normalized)
    && (/\b(?:call|calling|called)\s+(?:you|him|her|it|them|this|that|yourself|himself|herself|iscott|scott)\b|\bwhat\s+(?:do|should|can|would)\s+i\s+call\b/i.test(normalized)
      || /\b[Cc]all me [A-Z][a-z]+\b/.test(normalized))) {
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

/**
 * Did the visitor confirm the read-back?
 *
 * G's ride 129b69d6, 2026-08-31. iScott spelled the address and asked "Did I
 * hear that exactly right?" G answered
 *
 *     "But yes, you, you said it correctly."
 *
 * and this returned FALSE, because the old pattern accepted only two shapes -
 * "<field> is correct" and "that's the right <field>" - both of which require
 * the visitor to NAME THE FIELD back. Nobody talks like that. Not one line in
 * that entire ride matched, so contact_readback_correct stayed false, consent
 * never locked, the package never qualified, and G received an "INCOMPLETE
 * iScott lead" email for a lead where he had given his name, his address, and
 * an explicit yes.
 *
 * This is the same fault as the "Yet." bug fixed the previous night: a
 * whitelist narrower than human speech, sitting on the path a real lead has to
 * cross. Widened to the ordinary ways people say "you got it", with the refusal
 * check FIRST so a correction can never be read as a confirmation.
 */
// Did this turn tell us the read-back was WRONG? Deliberately narrow, and only
// consulted while a read-back is the freshest thing that happened (see the call
// site), so an unrelated "no" later in the ride - "no, I don't have photos" -
// can never reach it.
//
// Why it exists: before 2026-08-31 a visitor could answer "Did I hear that
// exactly right?" with "No, that's not right at all", and the send prompt two
// turns later would still anchor to that dead read-back and take a yes. The
// lead went to Scott carrying an address its owner had just disowned.
export function deniesContactReadBack(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/^(?:no|nope|nah)\b/i.test(normalized)) return true;
  return /\b(?:not (?:right|correct|it|quite)|isn't (?:right|correct|it)|that's wrong|incorrect|you got (?:that|it) wrong|wrong (?:email|address|number)|not my (?:email|address|number))\b/i.test(normalized);
}

export function detectsContactReadBackCorrect(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  // REFUSALS FIRST. "no that's wrong", "not correct", "that's not right",
  // "almost right" - none of these are a confirmation, and several of them
  // contain the very words the positive patterns look for.
  if (
    /\b(?:not|isn't|isnt|ain't|aint|wasn't|wrong|incorrect|nope|nah|almost|nearly|close but|other way)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }
  if (/^\s*no\b/i.test(normalized)) return false;
  // The original two shapes, kept verbatim so nothing that used to pass stops.
  if (
    /\b(?:phone number|email|number)\s+is\s+correct\b|\bthat(?:'s| is) the (?:right )?(?:number|email)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  // ANSWERS TO THE QUESTION ITSELF. G's ride 009124c0, 2026-08-31: iScott asked
  // "Did I hear that exactly right?" and G answered "You did." - which is the
  // most natural answer there is, and it returned false, so consent never
  // locked and the lead died holding a confirmed phone number.
  //
  // The list widened this morning accepts "you SAID/GOT/READ/HAVE/HEARD it
  // right". It requires a verb from that set AND a "right/correct" after it.
  // "You did." carries neither. A question of the form "did I ...?" is answered
  // by echoing the auxiliary, so that echo has to count on its own.
  if (/^(?:\s*(?:yes|yeah|yep|yup|ok|okay)[,.\s]+)*you (?:did|do|have)\b/i.test(normalized)) {
    return true;
  }
  // G, ride f1163ff3: "Yes, perfect. And you sent it back. Perfect."
  // This directly answered iScott's exact-address read-back. "sent/spelled/
  // repeated" are common descriptions of that act; an affirmative followed by
  // perfect/great/correct is the equally ordinary short form.
  if (/^(?:yes|yeah|yep|yup|ok|okay)[,.!\s]+(?:perfect|great|correct)\b/i.test(normalized)) {
    return true;
  }
  // How people actually answer "did I hear that right?"
  return /\b(?:that(?:'s| is) (?:it|right|correct)|you (?:said|got|read|have|heard|sent|spelled|repeated) (?:it|that|them)?\s*(?:right|correct|correctly|perfectly)?|said it correctly|got it right|read it right|heard it right|exactly right|perfectly|spot on|correct|right)\b/i.test(
    normalized,
  );
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

// WHAT THE VISITOR IS TOLD WHILE THE SEND IS BEING DECIDED, 2026-08-30.
//
// The old line here said "Sending these details to Scott." It was put on screen
// the moment the button was pressed, before the server had looked at the package
// at all - and most of the time a refused package is exactly what the server
// finds. The visitor was told a send had started, then told a step was missing.
// The first of those two sentences was never true.
//
// Nothing is claimed now that has not happened. The details are being CHECKED,
// and nothing has been sent - which is the truth for every outcome this line can
// be followed by.
export function checkingDetailsStatusCopy(): string {
  return "Checking your details. Nothing has been sent to Scott yet.";
}

// Kept as the name the panel and its checks already use. One string, one truth.
export function confirmingHandoffStatusCopy(): string {
  return checkingDetailsStatusCopy();
}

// A package that changed after the visitor gave permission is not refused
// because anything is wrong with it - it is simply not the package they agreed
// to, so the agreement has to be asked for again.
export function changedPackageStatusCopy(): string {
  return "Nothing has been sent. Your details changed after you gave permission — let iScott read the new details back, say yes, then choose Send to Scott.";
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
  const visitorTexts = texts.filter((text) => !isOperatorSalesLanguage(text) && !isCoachingOrPersonaNeed(text) && !isAppScreenCopyEcho(text));
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
  // H453 (Codex spec, applied by Claude 2026-09-02). G, three rides on 09-02 (b0c50885, 90328d60,
  // 8e110daa) were mailed the synthesized label "Website and branding makeover" instead of his words.
  // project_need is the visitor's extracted wording ONLY. The synthesized service summary belongs in
  // operator_service_script and must never replace the words used in the lead row or owner email.
  // If no visitor wording was extracted, stay null so qualification fails closed.
  const operatorServiceScript =
    sessionLooksLikeOperatorQa(texts) || operatorIsScripting
      ? distillVisitorProjectOffer(texts)
      : null;
  return {
    projectNeed,
    operatorServiceScript,
  };
}

export function visitorProjectAreaFromRows(texts: string[]): string | null {
  const safe = texts.filter(
    (text) => !isOperatorSalesLanguage(text) && !isCoachingOrPersonaNeed(text) && !isAppScreenCopyEcho(text),
  );
  let area: string | null = null;
  for (const text of safe) {
    const match = text.match(/\b(back\s*yard|front\s*yard|side\s*yard|whole property|entire property|garden|patio)\b/i);
    if (!match) continue;
    const normalized = match[1].replace(/\s+/g, " ").toLowerCase();
    area = normalized === "back yard" ? "backyard"
      : normalized === "front yard" ? "front yard"
        : normalized === "side yard" ? "side yard"
          : normalized;
  }
  return area;
}

function projectDetailKey(value: string): string {
  return value.toLowerCase()
    .replace(/\b(?:a|an|the|to|for|me|us|my|our|make|build|create|design|do|help)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function visitorProjectDetailsFromRows(texts: string[]): string[] {
  const safe = texts.filter(
    (text) => !isOperatorSalesLanguage(text) && !isCoachingOrPersonaNeed(text) && !isAppScreenCopyEcho(text),
  );
  const details: string[] = [];
  for (const text of safe) {
    const pieces = text.split(/[.!?]+/).map((piece) => piece.trim()).filter(Boolean);
    for (const piece of pieces) {
      const followUp = piece.match(/\b(?:like\s+)?with\s+([^.!?]{3,260})/i)?.[1] ?? null;
      const followUpDetail = followUp
        ? stripSpokenProjectFiller(followUp.replace(/\s+/g, " ").trim())
        : null;
      const detail = extractProjectNeed(piece) ?? (
        followUpDetail && isSpecificProjectNeed(followUpDetail) && !CONTACT_MECHANICS_NEED.test(followUpDetail)
          ? followUpDetail.charAt(0).toUpperCase() + followUpDetail.slice(1)
          : null
      );
      if (!detail || !isSpecificProjectNeed(detail)) continue;
      const cleaned = detail
        .replace(/\bscott\b/gi, "Scott")
        .replace(/\ba ruins\b/gi, "ruins")
        .replace(/\s+/g, " ")
        .trim();
      const key = projectDetailKey(cleaned);
      if (!key) continue;
      if (details.some((existing) => {
        const existingKey = projectDetailKey(existing);
        if (existingKey === key || existingKey.includes(key) || key.includes(existingKey)) return true;
        const words = key.split(" ");
        return words.length <= 2 && words.every((word) => existingKey.split(" ").includes(word));
      })) continue;
      details.push(cleaned);
      if (details.length === 8) return details;
    }
  }
  return details;
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
  // Explaining the permission rule is not granting permission. G's vertical-
  // iPad ride 6db41665 said "People have to give their permission first, then
  // that fires the send to Scott." The broad imperative detector below saw
  // "send ... to Scott" and treated that policy explanation as the command,
  // four seconds before G's actual yes. Keep first-person permission and real
  // imperatives valid; reject only general/second-person prerequisite talk.
  const explainsPermissionPrerequisite =
    /\b(?:people|visitors?|customers?|they)\b[^.!?]{0,80}\b(?:permission|consent)\b/i.test(normalized)
    || /\byou\s+(?:need|must|have to)\b[^.!?]{0,60}\b(?:permission|consent)\b/i.test(normalized);
  if (explainsPermissionPrerequisite && /\bsend\b/i.test(normalized)) return false;
  // G live ride 2026-08-17 ("Okay, yeah, send it, send that, send my
  // information to the WildWorks team." registered NO consent): accept
  // wildworks-team targets, filler before the yes, and the plain imperative.
  return (
    // A PLAIN IMPERATIVE IS CONSENT. G's ride 009124c0, 2026-08-31: the old
    // shape required a "yes/yeah/okay" token to sit alongside "send ... to
    // Scott", so the bare command "send that to Scott" - which is a clearer
    // instruction than any of those words - did not register. Someone telling
    // you to do a thing has consented to the thing. The negation guard above
    // still owns "don't send", and it runs first.
    /\b(?:send|forward|pass|give)\b[^.!?]{0,60}?\bto\s+(?:the\s+)?(?:wildworks(?:\s+team)?|scott)\b/i.test(normalized)
    || /\bsend\s+(?:my|the|that|this|it|them|those)\s*(?:information|info|details|email|lead|number|phone)?\b/i.test(normalized)
    || /^(?:(?:um+|uh|okay|ok|all\s?right|alright|well|so)[,.]?\s+)*(?:yes|yeah)[,.]?\s+send\b/i.test(normalized)
    // "you have my permission" is explicit consent in words, with no verb at all.
    || /\byou have my permission\b/i.test(normalized)
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
  const linkedOutboxId = typeof args.notificationOutboxId === "string"
    ? args.notificationOutboxId
    : "";
  const hasLinkedOutbox = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(linkedOutboxId);
  return (args.status === "submitted" || Boolean(args.submittedAt))
    && args.notificationStatus === "sent"
    && hasLinkedOutbox;
}

// A SPOKEN LINE IS A MOMENT, NOT A STRING. G's desktop rides 1cc18a84 and
// f2815084, 2026-09-03: the transcript sync deduped incoming rows by role +
// words alone, so the second "Yes." of a session (the one answering "May Scott
// contact you...") was discarded as a repeat of the first (the one answering
// "Did I hear that exactly right?"), the permission never reached the lead,
// and the send never happened - while the avatar, which heard it, said the
// send line. The same words at a DIFFERENT time are a different line. The
// provider's absolute timestamp decides; the tolerance absorbs the provider
// re-stamping a line by a second or two between two syncs.
export const TRANSCRIPT_REPEAT_TOLERANCE_SECONDS = 2;

export function isRepeatedTranscriptMoment(
  seenAt: number[] | undefined,
  at: number,
  toleranceSeconds: number = TRANSCRIPT_REPEAT_TOLERANCE_SECONDS,
): boolean {
  if (!seenAt || seenAt.length === 0) return false;
  // A candidate with no clock cannot be placed in time; the only safe reading
  // of "same words, no time" is the old one - a repeat.
  if (!Number.isFinite(at)) return true;
  return seenAt.some((seen) => !Number.isFinite(seen) || Math.abs(seen - at) <= toleranceSeconds);
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
  // G's ride 0bd3227a, 2026-09-03 13:31 ET. THIS COST THE SEND, and it is the
  // "it was working earlier" bug G has hit over and over: the stored snapshot
  // is COMPACTED (consecutive visitor fragments joined into one row, filler and
  // cut-off avatar lines dropped), while the incoming rows are the raw
  // transcript. A raw fragment never matches its compacted row's key, so every
  // fragment spoken BEFORE the permission was appended AFTER the whole stored
  // history - behind the yes. On that ride "And, uh, you know, I want him to
  // build up- I want him to help me build" (spoken 43 seconds before the
  // permission) landed at index 33 behind the yes at index 19, parsed as a new
  // project need, and the send was refused as package_changed_after_permission.
  // 65ac1618 an hour earlier carried nine such ghosts and passed only because
  // none of them happened to parse as a need. Replayed with the real code
  // (scripts/check-iscott-ride-0bd3227a-replay.mjs).
  //
  // A raw row that is already REPRESENTED in the stored history is not new:
  // same role, its time falls inside a stored row's span (that row's timestamp
  // up to the next stored row's), and the stored text contains it. Filler and
  // cut-off avatar lines that compaction dropped on purpose are old for the
  // same reason - their time sits inside history - and stay dropped instead of
  // being resurrected behind the permission. The last stored row has no known
  // end, so only its own second counts as its span: anything later is new and
  // goes where it always went, after history.
  const stored = out.slice();
  const flat = (value: string) => value.replace(/\s+/g, "").toLowerCase();
  const spanEnd = (index: number): number => {
    for (let next = index + 1; next < stored.length; next += 1) {
      const at = stored[next].laAbsoluteTimestamp;
      if (at !== null) return at;
    }
    return (stored[index].laAbsoluteTimestamp ?? 0) + 1;
  };
  const alreadyRepresented = (role: "user" | "assistant", text: string, timestamp: number | null): boolean => {
    if (timestamp === null) return false;
    const needle = flat(text);
    if (!needle) return true;
    for (let index = 0; index < stored.length; index += 1) {
      const start = stored[index].laAbsoluteTimestamp;
      if (start === null || timestamp < start || timestamp >= spanEnd(index)) continue;
      if (stored[index].role === role && flat(stored[index].message).includes(needle)) return true;
      if (role === "user" ? isPureFillerUtterance(text) : isIncompleteAvatarUtterance(text)) return true;
    }
    return false;
  };
  for (const row of incoming) {
    const role = row.role === "assistant" ? "assistant" : "user";
    if (alreadyRepresented(role, row.message, row.laAbsoluteTimestamp ?? null)) continue;
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
  // 2026-08-29. The line that used to sit here read
  //   return mentionsContact && isContactReadBack(...) && asksSendNow;
  // one line below `if (asksSendNow) return true`, so it could only ever be
  // reached with asksSendNow already false. It was a provably constant false
  // wearing the shape of a rule, and it read as though a read-back could still
  // rescue a turn that is not a send prompt. Written plainly instead: no
  // decision changes, and the last line no longer lies about what it does.
  return false;
}

export function avatarSpeechClaimsHandoffSent(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return (
    /\b(?:i sent|i've sent|i have sent|we sent)\b[\s\S]{0,80}\b(?:scott|wildworks|team|details|information)\b/i.test(normalized)
    || /\bpreparing (?:to send|the handoff)\b/i.test(normalized)
    // G live ride ae10ba06, 2026-08-29. iScott said "I'm sending that to
    // Scott." - the PROGRESSIVE form - while the lead sat unconfirmed. Every
    // pattern above describes a send already finished or still promised; none
    // describes one supposedly happening right now, so the canonical gate
    // waved the exact sentence through. The sync route caught it only because
    // it ORs in iscottSpeechClaimsSendingNow by hand; any other caller of
    // allowedIscottSpeech was unprotected. Same pattern, lifted verbatim.
    || /\b(?:i(?:'|’)?m|i am|we(?:'|’)?re|we are) sending\b[\s\S]{0,100}\b(?:scott|wildworks|your details|the details|information)\b/i.test(normalized)
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
  // Same rule the pipeline stamps consent on, so a replay of a real ride can
  // never report a consent the live code would not have stored.
  const shouldConfirm =
    isPostRollout &&
    detectsExactContactSendConfirmation(args.rows, args.contactMethod, args.contactValue);
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

const LITERAL_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g;
// Long enough to be a real number, loose enough to survive dashes, dots,
// spaces and parentheses. Anything shorter than ten digits is discarded below.
const LITERAL_PHONE_RE = /\+?\d[\d\s().-]{8,20}\d/g;

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

// Is a DIFFERENT contact value of this method sitting in this turn? Used to
// notice that the address on the table has changed, so a prompt, a read-back or
// a yes that belonged to the old value cannot be spent on the new one.
function mentionsDifferentContactValue(
  message: string,
  contactMethod: "email" | "phone",
  contactValue: string,
): boolean {
  // Compared on the same normalized key every other contact comparison uses, so
  // "the address changed" can never mean "the visitor said it with different
  // spacing". A candidate we cannot normalize - a five-digit number, a blank -
  // is not a contact at all and never counts as a different one.
  const target = normalizedContactValue(contactMethod, contactValue);
  if (!target) return false;
  const found = contactMethod === "email"
    ? message.toLowerCase().match(LITERAL_EMAIL_RE) ?? []
    : message.match(LITERAL_PHONE_RE) ?? [];
  if (found.some((candidate) => {
    const value = normalizedContactValue(contactMethod, candidate);
    return value !== null && value !== target;
  })) {
    return true;
  }
  // A number can be CHANGED in words as easily as it can be read back in them.
  // Once spokenDigitRuns taught the read-back check to hear "four four three,
  // seven nine seven...", this had to learn the same alphabet or the two would
  // disagree: a visitor correcting their number out loud would have been heard
  // as saying nothing, and the consent given for the OLD number would have
  // survived a correction and mailed Scott the wrong one.
  if (contactMethod !== "phone") return false;
  return spokenDigitRuns(message).some((run) => {
    const value = normalizedContactValue("phone", run);
    return value !== null && value !== target;
  });
}

export type ContactSendConsent = {
  consented: boolean;
  reason:
    | "send_command"
    | "prompt_then_affirmation"
    | "no_send_prompt"
    | "affirmation_not_adjacent"
    | "affirmation_outside_window"
    | "contact_changed_after_consent"
    | "contact_not_read_back";
};

// G's physical ride, 2026-08-29. iScott read the address back, asked "May I send
// these details to Scott?", G answered a plain "Yes." - and nothing was sent.
//
// The old rule required BOTH turns to carry a LiveAvatar absolute timestamp.
// laAbsoluteTimestamp is nullable the whole way down this pipe (the sync route
// falls back to a column that is itself nullable, and merged history rows store
// "none"), so on any turn that arrived without one the plain-yes path was dead
// code - the send prompt was recognised, the yes was recognised, and the
// conjunction was still false.
//
// The binding that actually matters is ORDER, not the clock: the yes has to be
// the visitor's very next substantive turn after the question. That is enforced
// here for every session. The 90-second window is still enforced on top of it
// whenever both timestamps exist, so the "yes" 100 seconds later still fails.
//
// It is also bound to the CONTACT. A different address or number appearing in
// the conversation clears any prompt, read-back or consent that came before it,
// so a yes can never be spent on a value the visitor has since changed.
export function evaluateContactSendConsent(
  rows: TranscriptTurn[],
  contactMethod: "email" | "phone",
  contactValue: string,
): ContactSendConsent {
  let lastPromptAt: number | null = null;
  let sawSendPrompt = false;
  let sawReadBack = false;
  let promptNamedContact = false;
  let userTurnsSincePrompt = 0;
  // A value other than the one we now hold has been spoken and not yet
  // superseded by the current one.
  let contactSuperseded = false;
  let accepted: "send_command" | "prompt_then_affirmation" | null = null;
  let refusalReason: ContactSendConsent["reason"] = "no_send_prompt";

  const resetPrompt = () => {
    sawSendPrompt = false;
    lastPromptAt = null;
    promptNamedContact = false;
    userTurnsSincePrompt = 0;
  };

  for (const row of rows) {
    if (messageMentionsContact(row.message, contactValue)) {
      contactSuperseded = false;
    } else if (mentionsDifferentContactValue(row.message, contactMethod, contactValue)) {
      contactSuperseded = true;
      sawReadBack = false;
      if (accepted) refusalReason = "contact_changed_after_consent";
      accepted = null;
      resetPrompt();
    }

    if (row.role === "assistant") {
      if (isDirectContactSendPrompt(row.message, contactMethod, contactValue)) {
        sawSendPrompt = true;
        lastPromptAt = row.laAbsoluteTimestamp;
        promptNamedContact = messageMentionsContact(row.message, contactValue);
        userTurnsSincePrompt = 0;
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
    if (isSendCommandConsent(row.message)) {
      accepted = "send_command";
      resetPrompt();
      continue;
    }
    if (!sawSendPrompt) continue;
    userTurnsSincePrompt += 1;
    if (!detectsSimpleAffirmation(row.message)) continue;
    if (userTurnsSincePrompt > 1) {
      // The visitor said something else first. Whatever this yes belongs to, it
      // is not the send question.
      refusalReason = "affirmation_not_adjacent";
      continue;
    }
    if (contactSuperseded && !promptNamedContact && !sawReadBack) {
      // A value we do not hold is the last one anybody said out loud. Nothing
      // has read the current one back, so this yes is not consent for it.
      refusalReason = "contact_not_read_back";
      continue;
    }
    if (
      lastPromptAt !== null &&
      row.laAbsoluteTimestamp !== null &&
      (row.laAbsoluteTimestamp < lastPromptAt ||
        row.laAbsoluteTimestamp - lastPromptAt > SEND_CONFIRMATION_WINDOW_SECONDS)
    ) {
      refusalReason = "affirmation_outside_window";
      continue;
    }
    accepted = "prompt_then_affirmation";
    resetPrompt();
  }

  return accepted
    ? { consented: true, reason: accepted }
    : { consented: false, reason: refusalReason };
}

export function detectsContextualContactSendConfirmation(
  rows: TranscriptTurn[],
  contactMethod: "email" | "phone",
  contactValue: string,
): boolean {
  return evaluateContactSendConsent(rows, contactMethod, contactValue).consented;
}

// ---------------------------------------------------------------------------
// QUALIFICATION, AND THE EXACT-CONTACT CONSENT GATE
//
// G, 2026-08-29. A lead only earns a send when four things are true and every
// one of them came out of the visitor's mouth: a full name, a specific project
// in their own words, the contact we are HOLDING RIGHT NOW read back exactly,
// and an explicit yes to the send question sitting right next to it.
//
// evaluateContactSendConsent above is untouched and still answers the broad
// question - "did the visitor say yes to a send?". This gate answers the
// narrower one that actually opens the door: "was that yes attached to THIS
// contact, after we read THIS contact back, on a lead Scott can act on?"
//
// A generic "May I send these details to Scott?" answered "Yes." is a real yes
// and stays a real yes. It is simply not, on its own, enough to mail a
// stranger's name and address to Scott - nobody has confirmed WHICH address the
// yes was about, and G's rides are full of addresses that were mis-heard once
// and corrected later.
//
// 2026-08-29, CORRECTION. This gate used to carry a blanket exception: any
// explicit send COMMAND was accepted on its own, anywhere in the transcript,
// with no read-back at all. That exception was the whole gate - "Yes, send it to
// Scott." is a phrase iScott's own prompting invites, so the strict rule could
// be satisfied by a sentence that never named an address, and the broad rule was
// back in charge without saying so.
//
// The lesson of ride 7325f798 is kept where it belongs: a command is still
// permission, and iScott does not have to have ASKED first. What a command
// cannot do any more is stand in for the read-back. It has to sit immediately on
// an exact read-back of the value we are holding right now, or on a send prompt
// that is itself anchored to that read-back. A command spoken before any
// read-back, or after the address changed, is refused - the visitor is telling
// us to send something nobody has confirmed the spelling of.
// ---------------------------------------------------------------------------

// How far the read-back may sit from the send question. Zero means the question
// follows it directly; two allows the visitor's "yes, that's right" in between,
// which is the shape of every real ride.
// How many visitor turns may sit between iScott reading the contact back and
// the moment permission is given. Raised from 2 to 6 on 2026-08-31.
//
// Two was too tight for how anyone actually talks. G's ride 15:20 measured:
//
//   [6] ASSISTANT  ...four four three, seven nine seven, two one six six.
//                  Did I hear that exactly right?
//   [7] USER       You did.
//   [8] USER       The text is super small though. It's like midget size...
//   [9] USER       God damn it.
//   [10] USER      Yes, send that to Scott. You have my permission.
//
// A UI complaint and a swear were enough to age the read-back out, so an
// explicit "you have my permission" was thrown away and Scott never got the
// lead. Neither turn touches the contact, and neither could.
//
// This counter is not what keeps consent honest, and it never was. Three other
// guards do that, and all of them stay: any turn naming a DIFFERENT value
// clears consent, the read-back and the prompt outright; an explicit denial of
// the read-back clears it; and evaluateLeadPackageChronology invalidates
// permission if the name, the job or the contact moves after it was given. Six
// turns of digression is still bounded, and it matches how G speaks - which is
// the only speech we have real transcripts of.
const READBACK_TO_PROMPT_MAX_TURNS = 6;

const CONTACT_READBACK_SHAPE =
  /\b(?:i have your|your (?:email|phone|number)|read (?:that|it) back|reading (?:that|it) back|spell (?:that|it) out|spelled (?:that|it) out|did i (?:get|hear) (?:that|it)|is that (?:the )?right|does that look right|is that correct)\b/i;

// Did this turn say the CURRENT contact, exactly? Literal, or iScott's spelled
// email form, or - the case messageMentionsContact alone cannot see - a phone
// number spoken in groups, "4-4-3, 5-5-5, 0-1-4-2", where the commas he pauses
// on sit between the digits. The digits themselves still have to match exactly.
// SPOKEN NUMBER WORDS -> DIGITS.
//
// G's ride 2026-08-31 15:20 died here and it is worth spelling out, because
// nobody did anything wrong:
//
//   [5] USER      Yes. 443-797-2166.
//   [6] ASSISTANT Got it. That's four four three, seven nine seven, two one
//                 six six. Did I hear that exactly right?
//   [7] USER      You did.
//
// messageSpeaksContactExactly compares digits, and strips everything that is
// not one - so that read-back reduced to an empty string, no read-back was
// ever registered, and the consent walk refused with no_exact_contact_readback.
// The lead sat in the table holding his phone number and Scott was never told.
//
// The system prompt tells iScott exactly how to speak an EMAIL back ("say each
// character with dashes between letters, say at for @") and there is a
// collapser for that form above. It says nothing at all about phone numbers,
// so iScott improvises words and nothing downstream can read them. Rather than
// dictate a format to the model - which only holds until it drifts - this
// reads whatever it says.
//
// Returns the digit RUNS found in the text. Runs, not one string: an unknown
// word ends a run, so "four four three" in one sentence and "seven nine seven"
// in the next never fuse into a number nobody said.
const SPOKEN_DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0", o: "0", nought: "0", naught: "0",
  one: "1", won: "1",
  two: "2", to: "2", too: "2",
  three: "3", four: "4", for: "4", fore: "4",
  five: "5", six: "6", seven: "7", eight: "8", ate: "8", nine: "9",
};
// Words that may sit inside a spoken number without breaking it.
const SPOKEN_NUMBER_FILLER: ReadonlySet<string> = new Set([
  "um", "uh", "er", "and", "dash", "hyphen", "comma", "dot", "point",
  "thats", "that", "s", "is", "it", "its", "the", "number", "area", "code",
]);
const SPOKEN_TENS: Record<string, string> = {
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
  twenty: "2", thirty: "3", forty: "4", fourty: "4", fifty: "5",
  sixty: "6", seventy: "7", eighty: "8", ninety: "9",
};

const SPOKEN_REPEATERS: Record<string, number> = { double: 2, triple: 3, tripple: 3 };

export function spokenDigitRuns(text: string): string[] {
  const tokens = String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const runs: string[] = [];
  let current = "";
  let repeat = 1;
  const flush = () => {
    if (current) runs.push(current);
    current = "";
    repeat = 1;
  };
  for (const token of tokens) {
    if (/^[0-9]+$/.test(token)) {
      current += token.repeat(repeat);
      repeat = 1;
      continue;
    }
    const digit = SPOKEN_DIGIT_WORDS[token];
    if (digit !== undefined) {
      current += digit.repeat(repeat);
      repeat = 1;
      continue;
    }
    if (SPOKEN_REPEATERS[token] !== undefined) {
      repeat = SPOKEN_REPEATERS[token];
      continue;
    }
    // "four hundred forty three" -> 443. Only the shapes a person actually
    // speaks a phone number in; this is not a general number parser.
    if (token === "hundred" || token === "thousand") continue;
    if (SPOKEN_TENS[token] !== undefined) {
      current += SPOKEN_TENS[token];
      repeat = 1;
      continue;
    }
    if (SPOKEN_NUMBER_FILLER.has(token)) continue;
    flush();
  }
  flush();
  return runs;
}

function messageSpeaksContactExactly(
  message: string,
  contactMethod: "email" | "phone",
  contactValue: string,
): boolean {
  if (messageMentionsContact(message, contactValue)) return true;
  if (contactMethod !== "phone") return false;
  const target = phoneDigits(contactValue);
  if (!target) return false;
  if (message.replace(/\D/g, "").includes(target)) return true;
  // iScott often reads a number back in words. See spokenDigitRuns above.
  return spokenDigitRuns(message).some((run) => run.includes(target));
}

// An assistant turn that repeats the CURRENT contact and asks the visitor to
// confirm it. Exact by construction, and a turn that also carries some other
// address is not a read-back of this one.
export function isExactContactReadback(
  message: string,
  contactMethod: "email" | "phone",
  contactValue: string,
): boolean {
  if (!contactValue.trim()) return false;
  if (!messageSpeaksContactExactly(message, contactMethod, contactValue)) return false;
  if (mentionsDifferentContactValue(message, contactMethod, contactValue)) return false;
  return CONTACT_READBACK_SHAPE.test(message.replace(/\s+/g, " ").trim());
}

/** A confirmed assistant read-back outranks an earlier chopped STT fragment. */
export function confirmedEmailCandidateFromReadBack(rows: TranscriptTurn[]): string | null {
  let pending: string | null = null;
  let confirmed: string | null = null;
  for (const row of rows) {
    if (row.role === "assistant") {
      const candidate = extractEmail(row.message);
      pending = candidate && CONTACT_READBACK_SHAPE.test(row.message.replace(/\s+/g, " ").trim())
        ? candidate
        : null;
      continue;
    }
    if (row.role !== "user") continue;
    const userEmail = extractEmail(row.message);
    if (confirmed && userEmail && !sameContactValue("email", confirmed, userEmail)) {
      confirmed = null;
    }
    if (!pending) continue;
    if (deniesContactReadBack(row.message)) {
      if (confirmed && sameContactValue("email", confirmed, pending)) confirmed = null;
      pending = null;
      continue;
    }
    if (detectsContactReadBackCorrect(row.message)) {
      confirmed = pending;
    }
    pending = null;
  }
  return confirmed;
}

// THE ONE DEFINITION OF "the same way to reach this person", 2026-08-29.
//
// Every idempotency comparison in the lead pipeline has to agree on this, and
// several of them used to compare raw strings with ===. "+1 (443) 555-0142" and
// "4435550142" are one phone; "Visitor@Example.com" and "visitor@example.com"
// are one mailbox; a spoken address that arrives with a stray space is the same
// mailbox again. Compared literally, the same contact reads as a different one -
// which is how a second identical package reaches Scott, and how a lead that was
// already sent looks unsent to the next turn of the conversation.
//
// Null means "no usable value", never "equal to nothing": two absent contacts
// are not the same contact, so callers cannot accidentally suppress a send by
// comparing two blanks.
export function normalizedContactValue(
  contactMethod: "email" | "phone",
  value: string | null | undefined,
): string | null {
  // Defensive about the input type, not just its shape: some of these values
  // come out of a free-form JSON metadata column, and a comparison that throws
  // inside the capture pipeline would take a visitor's whole turn down with it.
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (contactMethod === "phone") {
    const digits = phoneDigits(text);
    return digits.length >= 10 ? digits : null;
  }
  return text.replace(/\s+/g, "").toLowerCase();
}

export function sameContactValue(
  contactMethod: "email" | "phone",
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizedContactValue(contactMethod, a);
  const right = normalizedContactValue(contactMethod, b);
  return left !== null && right !== null && left === right;
}

export type ExactContactSendConsent = {
  consented: boolean;
  reason:
    | "send_command"
    | "readback_prompt_affirmation"
    | "no_send_prompt"
    | "no_exact_contact_readback"
    | "readback_too_far_from_prompt"
    | "affirmation_not_adjacent"
    | "affirmation_outside_window"
    | "contact_changed_after_consent";
  // WHERE in the transcript the permission was given, or null if it never was.
  // 2026-08-30: reported so the package-chronology rule below can ask the one
  // question this function was never asked - was the package the visitor said
  // yes to still the package we are holding? Nothing about the consent decision
  // itself changes; this is the same walk, reporting where it landed.
  acceptedIndex: number | null;
};

export function evaluateExactContactSendConsent(
  rows: TranscriptTurn[],
  contactMethod: "email" | "phone",
  contactValue: string,
): ExactContactSendConsent {
  let accepted: "send_command" | "readback_prompt_affirmation" | null = null;
  let acceptedIndex: number | null = null;
  let refusal: ExactContactSendConsent["reason"] = "no_send_prompt";
  // How many SUBSTANTIVE turns ago the current contact was read back, or null
  // if it never was. Counted in turns rather than row indexes: a visitor
  // breaking off to say the Finish button is too small is not distance between
  // the read-back and the yes, and on G's rides it always sits right there.
  let sinceReadback: number | null = null;
  let promptOpen = false;
  let promptAt: number | null = null;
  let promptAnchored = false;
  let userTurnsSincePrompt = 0;

  const clearPrompt = () => {
    promptOpen = false;
    promptAt = null;
    promptAnchored = false;
    userTurnsSincePrompt = 0;
  };
  const stepAwayFromReadback = () => {
    if (sinceReadback !== null) sinceReadback += 1;
  };

  for (const [index, row] of rows.entries()) {
    // A value we do not hold has been spoken. Every read-back, question and yes
    // that belonged to the old one dies with it - consent is never inherited by
    // an address the visitor has since changed.
    if (
      mentionsDifferentContactValue(row.message, contactMethod, contactValue) &&
      !messageSpeaksContactExactly(row.message, contactMethod, contactValue)
    ) {
      if (accepted || promptOpen || sinceReadback !== null) {
        refusal = "contact_changed_after_consent";
      }
      accepted = null;
      acceptedIndex = null;
      sinceReadback = null;
      clearPrompt();
      continue;
    }

    if (row.role === "assistant") {
      const namesContact =
        messageSpeaksContactExactly(row.message, contactMethod, contactValue) &&
        !mentionsDifferentContactValue(row.message, contactMethod, contactValue);
      if (isDirectContactSendPrompt(row.message, contactMethod, contactValue)) {
        // A send question that repeats the address IS its own read-back.
        if (namesContact) sinceReadback = 0;
        else stepAwayFromReadback();
        promptOpen = true;
        promptAt = row.laAbsoluteTimestamp;
        promptAnchored = sinceReadback !== null && sinceReadback <= READBACK_TO_PROMPT_MAX_TURNS;
        if (!promptAnchored) {
          refusal = sinceReadback === null
            ? "no_exact_contact_readback"
            : "readback_too_far_from_prompt";
        }
        userTurnsSincePrompt = 0;
        continue;
      }
      if (isExactContactReadback(row.message, contactMethod, contactValue)) sinceReadback = 0;
      else stepAwayFromReadback();
      continue;
    }

    if (row.role !== "user") continue;
    if (isUiOnlyAffirmation(row.message)) continue;
    // Whether the read-back is the freshest thing that has happened, captured
    // BEFORE the step below moves it. The denial check further down needs to
    // know this turn is the answer to the read-back question, not a stray "no"
    // from later in the ride.
    const answeringTheReadback = sinceReadback === 0;
    stepAwayFromReadback();
    // THE VISITOR RE-CONFIRMING THE READ-BACK RE-ANCHORS IT.
    // G's rides 13:19 and 17:32 on 2026-08-31 both died here, and both were
    // his fault in no way at all:
    //
    //   [ 9] ASSISTANT  That's S-G-D-I-E-T-Z at P-M dot M-E. Did I hear that
    //                   exactly right?
    //   [10] USER       You did, and you said it perfectly. That's great. But
    //                   the lettering is so small...
    //   [11..15] USER   (six more turns about how the box should size text)
    //   [16] USER       Yes, that is correct, iScott.
    //   [17] ASSISTANT  Just to confirm, may I send these details to Scott now?
    //   [18] USER       Yes.
    //
    // Every one of those middle turns stepped the read-back one further away,
    // so by the time the send question arrived sinceReadback was 8, the prompt
    // was never anchored, and the answer at [18] was discarded:
    // readback_too_far_from_prompt. Scott never got the lead, and G told us so
    // in the same session - "I did not receive a confirmation email."
    //
    // Distance from the read-back is a proxy for one thing: could the value
    // have gone stale between iScott saying it and the visitor agreeing to
    // send it. When the visitor states outright that we said it correctly,
    // that proxy has been answered directly and the distance is zero again.
    // So a confirmation re-anchors, exactly as a fresh read-back would.
    //
    // This can only ever re-anchor a read-back that already happened for the
    // value we are holding right now. A bare yes with no read-back behind it
    // still anchors nothing, and any turn naming a DIFFERENT value clears
    // consent, the read-back and the prompt at the top of this loop before
    // reaching here.
    if (sinceReadback !== null && detectsContactReadBackCorrect(row.message)) {
      sinceReadback = 0;
    } else if (answeringTheReadback && deniesContactReadBack(row.message)) {
      // The visitor answered the read-back question with "no". The value we
      // hold is not the value they gave, so there is nothing here for a send
      // prompt to anchor to and nothing a later yes may agree to. Only a fresh
      // read-back of a corrected value can open this again.
      // Guarded on answeringTheReadback so this only ever reads the answer to
      // a read-back that just happened, never an unrelated "no" later on.
      sinceReadback = null;
      clearPrompt();
      continue;
    }
    if (promptOpen) userTurnsSincePrompt += 1;

    const command = isSendCommandConsent(row.message);
    const affirmation = detectsSimpleAffirmation(row.message);
    if (!command && !affirmation) continue;

    // TWO ways a visitor turn may carry permission, and both of them are tied to
    // a read-back of the value we are holding at this moment.
    //   1. it answers a send question that was itself anchored to the read-back
    //   2. it is an explicit command sitting immediately on the read-back
    const answersAnchoredPrompt = promptOpen && promptAnchored && userTurnsSincePrompt === 1;
    // An explicit command does not become ambiguous with age. It remains tied
    // to the last undenied exact read-back; a changed contact or a denial clears
    // sinceReadback above. Only bare affirmations retain the adjacency window.
    const commandsOnTheReadback = command && sinceReadback !== null;
    if (!answersAnchoredPrompt && !commandsOnTheReadback) {
      // A contact change is the most specific thing that can be wrong here and
      // it must not be overwritten by a vaguer reason further down the ride.
      if (refusal !== "contact_changed_after_consent") {
        if (sinceReadback === null) refusal = "no_exact_contact_readback";
        else if (userTurnsSincePrompt > 1) refusal = "affirmation_not_adjacent";
        else refusal = "readback_too_far_from_prompt";
      }
      continue;
    }
    if (
      answersAnchoredPrompt &&
      promptAt !== null &&
      row.laAbsoluteTimestamp !== null &&
      (row.laAbsoluteTimestamp < promptAt ||
        row.laAbsoluteTimestamp - promptAt > SEND_CONFIRMATION_WINDOW_SECONDS)
    ) {
      refusal = "affirmation_outside_window";
      continue;
    }
    accepted = answersAnchoredPrompt ? "readback_prompt_affirmation" : "send_command";
    acceptedIndex = index;
    clearPrompt();
  }

  return accepted
    ? { consented: true, reason: accepted, acceptedIndex }
    : { consented: false, reason: refusal, acceptedIndex: null };
}

export function detectsExactContactSendConfirmation(
  rows: TranscriptTurn[],
  contactMethod: "email" | "phone",
  contactValue: string,
): boolean {
  return evaluateExactContactSendConsent(rows, contactMethod, contactValue).consented;
}

// A need Scott can act on. "Landscaping" is not a job; "a pool and a waterfall
// out back" is. Null means the visitor never said, which blocks the send rather
// than being guessed at.
const GENERIC_NEED =
  /^(?:some\s+|a\s+|an\s+|the\s+)?(?:landscap(?:e|ing)|yard\s*work|outdoor\s*work|work\s*(?:outside|outdoors)|projects?|jobs?|help|assistance|stuff|things?|work|something|anything|info(?:rmation)?|quotes?|estimates?|to\s+talk|to\s+chat|talk|chat)$/i;

// 2026-08-29, CORRECTION. GENERIC_NEED above only ever matched a WHOLE phrase,
// so the moment two generic words were stacked the block fell open: "I need help
// with a project", "A landscaping project" and "I need some help" all sailed
// through and would have been mailed to Scott as the job.
//
// A need is only concrete if it contains at least one word that is not scaffold.
// Every token below is either grammar, a bare service CATEGORY, or a placeholder
// noun for work in general - none of them tells Scott anything he can quote. A
// real need always drags in a word from outside this list ("pool", "waterfall",
// "patio", "flagstone", "website", "logo"), which is exactly the detail that
// makes it worth his afternoon.
const NEED_SCAFFOLD_TOKENS = new Set([
  // grammar and hedging
  "a", "an", "the", "some", "any", "my", "our", "your", "their", "his", "her",
  "of", "with", "for", "on", "in", "at", "to", "and", "or", "just", "really",
  "maybe", "please", "kind", "sort", "type", "bit", "little", "few", "more",
  "new", "get", "getting", "got", "do", "doing", "done", "have", "having",
  "need", "needs", "want", "wants", "like", "about", "around", "up", "out",
  // 2026-08-29 FOLLOW-UP. The list above had no pronouns on it, so the gate was
  // only ever strict about a need that had already been through
  // extractProjectNeed - which strips the "I want" off the front. Asked
  // DIRECTLY, "I want some landscaping" and "We want a landscaping project"
  // carried "i" and "we" as their one non-scaffold token and passed as jobs
  // Scott could quote. A pronoun is grammar. It says who is asking, never what
  // the work is.
  "i", "we", "you", "he", "she", "it", "they", "me", "us", "him", "them",
  "mine", "ours", "yours", "hers", "theirs", "myself", "ourselves", "itself",
  "this", "that", "these", "those", "here", "there", "who", "whom", "whose",
  "what", "which", "whatever", "when", "where", "why", "how",
  // Keep contractions whole when tokenising. A contraction is request grammar,
  // never the concrete object or result that makes the request actionable.
  "i'm", "im", "i've", "ive", "i'd", "id", "i'll", "ill",
  "we're", "weve", "we've", "we'd", "we'll", "you're", "you've", "you'd", "you'll",
  "they're", "they've", "they'd", "they'll", "he's", "he'd", "he'll", "she's", "she'd", "she'll",
  // auxiliaries, modals, and the verbs that only ever open a request
  "am", "is", "are", "was", "were", "be", "been", "being", "does", "did",
  "has", "had", "will", "shall", "would", "could", "should", "can", "may",
  "might", "must", "let", "gonna", "wanna", "looking", "seeking", "interested",
  // conjunctions, hedges, and spoken filler
  "if", "then", "so", "but", "because", "also", "too", "very", "quite",
  "okay", "ok", "yes", "yeah", "no", "nope", "um", "uh", "er", "ah",
  "know", "not", "sure", "unsure", "certain", "uncertain", "unknown", "clue",
  "don't", "dont", "doesn't", "doesnt", "didn't", "didnt", "can't", "cant",
  "couldn't", "couldnt", "wouldn't", "wouldnt", "shouldn't", "shouldnt",
  "won't", "wont", "isn't", "isnt", "aren't", "arent", "wasn't", "wasnt",
  "weren't", "werent", "haven't", "havent", "hasn't", "hasnt", "hadn't", "hadnt",
  "idk", "dunno", "perhaps", "probably", "possibly", "basically", "actually",
  "honestly", "simply", "generally", "thank", "thanks", "kindly",
  "now", "today", "tonight", "tomorrow", "later", "soon", "sometime", "whenever",
  "yet", "currently", "eventually", "asap", "immediately", "quickly", "right",
  // service categories, which are not jobs
  "landscape", "landscapes", "landscaped", "landscaping", "yard", "yards",
  "lawn", "lawns", "garden", "gardens", "gardening", "outdoor", "outdoors",
  // placeholder nouns for "work"
  "project", "projects", "job", "jobs", "work", "works", "working",
  "help", "helping", "assistance", "service", "services", "stuff", "thing",
  "things", "something", "anything", "everything", "idea", "ideas",
  "info", "information", "quote", "quotes", "estimate", "estimates",
  "talk", "chat", "question", "questions",
]);

function needCarriesConcreteDetail(text: string): boolean {
  const tokens = (text
    .toLowerCase()
    .replaceAll("’", "'")
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [])
    // One-character grammar fragments still carry no project detail. Keeping
    // apostrophe contractions whole avoids turning "don't" into the false
    // concrete token "don" while preserving real words such as pool or patio.
    .filter((token) => token.length > 1);
  if (tokens.length === 0) return false;
  return tokens.some((token) => !NEED_SCAFFOLD_TOKENS.has(token));
}

export function isSpecificProjectNeed(need: string | null | undefined): boolean {
  const text = (need ?? "").replace(/\s+/g, " ").replace(/[.!?,;:\s]+$/g, "").trim();
  if (!text) return false;
  if (text.split(/\s+/).length < 2) return false;
  if (GENERIC_NEED.test(text)) return false;
  if (!needCarriesConcreteDetail(text)) return false;
  if (isCoachingOrPersonaNeed(text)) return false;
  if (CONTACT_MECHANICS_NEED.test(text)) return false;
  if (isOperatorSalesLanguage(text)) return false;
  return true;
}

// A name Scott can open a phone call with. 2026-08-29, CORRECTION: the gate
// asked only whether the field was non-blank, so "test", "n/a" and "visitor"
// counted as a name and a placeholder lead could reach him.
//
// 2026-08-30, SECOND CORRECTION. The rule then went too far the other way and
// required two tokens, so a visitor who answers "Cher", "Solveig" or "Li" - the
// only name they use - could never finish. A legitimate single-word name is a
// name. What the gate is actually for is refusing values that are NOT names:
// placeholders, contact values, and field labels. Those are all still refused,
// one token or four, and iScott still ASKS for the full name (see
// nextIScottLeadQuestion) - it simply no longer discards a real answer.
const PLACEHOLDER_NAME =
  /^(?:n\/?a|na|none|nil|null|nobody|no\s*name|unknown|unnamed|anon(?:ymous)?|visitor|guest|user|customer|client|someone|somebody|me|you|him|her|them|it|test(?:ing|er)?|test\s+test|demo|sample|example|asdf+|qwerty|abc+|xyz|x+|first\s+last|full\s+name|my\s+name|name|idk|not\s+sure|dunno|hello|hi|hey)$/i;

const CONTACT_OR_FIELD_LABEL_NAME =
  /^(?:(?:my|your|the|best|preferred|primary|alternate|alternative|home|work|mobile)\s+)*(?:e-?mail(?:\s+address)?|phone(?:\s+number)?|telephone(?:\s+number)?|cell(?:\s+(?:phone|number))?|contact(?:\s+(?:information|info|details|method|preference))?|address|first\s+name|last\s+name|name\s+field|best\s+time\s+to\s+call|call\s+me|reach\s+me|contact\s+me|do\s+not\s+(?:call|contact)|not\s+provided|rather\s+not\s+say|prefer\s+not\s+to\s+say|no\s+preference)$/i;

const SPOKEN_DIGIT_NAME_WORDS = new Set([
  "zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
]);

// Words that answer "I'm ___" without ever being a name. The two-token rule used
// to hide these; with a single word now acceptable they have to be refused on
// their own merits, because extractSpokenFullName reads "I'm ready" the same way
// it reads "I'm Cher". Every entry is a state, a feeling, or an activity - never
// something a person is called.
const NON_NAME_WORDS = new Set([
  "ready", "curious", "interested", "listening", "waiting", "wondering", "hoping",
  "thinking", "looking", "calling", "asking", "trying", "checking", "browsing",
  "kidding", "joking", "guessing", "sorry", "fine", "good", "great", "okay", "well",
  "back", "here", "there", "done", "finished", "busy", "happy", "glad", "excited",
  "confused", "lost", "new", "old", "sure", "unsure", "human", "real", "afraid",
  "tired", "serious", "kidding-me", "in", "out", "up", "down", "yes", "no",
]);

const NAME_FILLER_WORDS = new Set([
  "um", "umm", "uh", "uhh", "erm", "hmm", "hm", "well", "okay", "ok",
  "yeah", "yep", "yes", "no", "nope", "alright", "right", "so", "like",
]);

export function isMeaningfulVisitorName(name: string | null | undefined): boolean {
  const text = (name ?? "")
    .replace(/^[\s.,!?;:'"“”‘’…-]+|[\s.,!?;:'"“”‘’…-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 2 || text.length > 90) return false;
  // A contact value belongs in the contact field, never in the salutation.
  // Keep this ahead of the name-shaped character check so the rule is direct
  // and cannot regress when accepted punctuation changes later.
  if (extractEmail(text)) return false;
  const contactDigits = text.replace(/\D/g, "");
  if (contactDigits.length >= 7) return false;
  // Has to read like a name: letters, not a number or a row of punctuation.
  if (!/\p{L}{2}/u.test(text)) return false;
  if (!/^[\p{L}][\p{L}'’.\- ]*$/u.test(text)) return false;
  if (PLACEHOLDER_NAME.test(text)) return false;
  if (CONTACT_OR_FIELD_LABEL_NAME.test(text)) return false;
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length === 0) return false;
  if (words.every((word) => NAME_FILLER_WORDS.has(word))) return false;
  // A number read out loud is a contact value, not a name - one digit word or
  // ten of them.
  if (words.every((word) => SPOKEN_DIGIT_NAME_WORDS.has(word))) return false;
  if (words.every((word) => NON_NAME_WORDS.has(word))) return false;
  // The stop words the spoken-name extractor already refuses, checked again
  // here because a name can also arrive from a typed field or a legacy row.
  if (text.split(" ").every((word) => NAME_STOP.test(word))) return false;
  return true;
}

// ---------------------------------------------------------------------------
// THE PACKAGE, AND WHEN PERMISSION BELONGS TO IT. 2026-08-30.
//
// What the visitor gives permission for is not "a send" in the abstract. It is
// one PACKAGE: the name Scott will say, the job he will quote, and the contact
// he will use. The exact-read-back rule above already binds a yes to the CONTACT
// it was spoken over. Nothing bound it to the other two, so a visitor could say
// yes over a confirmed address and then correct their name, or describe a
// different job entirely, and the old yes still opened the door - Scott would be
// mailed a package nobody had agreed to.
//
// The rule is chronological and it is simple: permission counts only if it was
// given AFTER the last material change to every field of the package. A change
// afterwards - name, intent, or contact - takes the permission down with it and
// the visitor has to be asked again.
//
// MATERIAL is doing real work in that sentence. Saying the same thing again in a
// different shape is not a change: "sgdietz@pm.me" and "SGDietz@PM.me ", "+1
// (443) 555-0142" and "4435550142", "Mary-Anne" and "mary anne", "A pool and a
// waterfall" and "a pool and a waterfall." are each ONE answer said twice.
// Filling in more of the same answer is not a change either - "George" becoming
// "George Smith", or "a pool" becoming "a pool and a waterfall", is the visitor
// finishing a sentence, not changing their mind. Treating either as a change
// would tear down permission the visitor genuinely gave, which is its own way of
// losing a lead.
// ---------------------------------------------------------------------------

export type LeadPackageField = "name" | "intent" | "contact";

export type LeadPackage = {
  fullName?: string | null;
  projectNeed?: string | null;
  contactMethod?: "email" | "phone" | null;
  contactValue?: string | null;
};

function normalizedPackageText(value: string | null | undefined): string | null {
  const text = typeof value === "string" ? value : "";
  const normalized = text
    .replaceAll("’", "'")
    .toLowerCase()
    // Punctuation is how a sentence is written down, never what it says.
    .replace(/[.,!?;:'"()\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized : null;
}

export function normalizedPackageName(value: string | null | undefined): string | null {
  return normalizedPackageText(value);
}

export function normalizedPackageIntent(value: string | null | undefined): string | null {
  return normalizedPackageText(value);
}

// Is `next` the same answer as `previous`, or the same answer with more of it
// filled in? Compared on whole words so "george" is a completion of nothing and
// "george smith" is a completion of "george", while "georgina" is neither.
function isSameOrFullerAnswer(previous: string, next: string): boolean {
  if (previous === next) return true;
  const from = previous.split(" ");
  const to = next.split(" ");
  const [shorter, longer] = from.length <= to.length ? [from, to] : [to, from];
  return shorter.every((word, index) => longer[index] === word);
}

export function leadPackageFieldChanged(
  field: LeadPackageField,
  previous: string | null | undefined,
  next: string | null | undefined,
  contactMethod?: "email" | "phone" | null,
): boolean {
  if (field === "contact") {
    const method = contactMethod === "phone" ? "phone" : "email";
    const before = normalizedContactValue(method, previous);
    const after = normalizedContactValue(method, next);
    if (before === null && after === null) return false;
    if (before === null || after === null) return true;
    return before !== after;
  }
  const before = normalizedPackageText(previous);
  const after = normalizedPackageText(next);
  if (before === null && after === null) return false;
  if (before === null || after === null) return true;
  return !isSameOrFullerAnswer(before, after);
}

export function materialLeadPackageChanges(
  previous: LeadPackage,
  next: LeadPackage,
): LeadPackageField[] {
  const changes: LeadPackageField[] = [];
  if (leadPackageFieldChanged("name", previous.fullName, next.fullName)) changes.push("name");
  if (leadPackageFieldChanged("intent", previous.projectNeed, next.projectNeed)) changes.push("intent");
  const method = next.contactMethod ?? previous.contactMethod ?? null;
  const methodChanged = Boolean(previous.contactMethod && next.contactMethod && previous.contactMethod !== next.contactMethod);
  if (methodChanged || leadPackageFieldChanged("contact", previous.contactValue, next.contactValue, method)) {
    changes.push("contact");
  }
  return changes;
}

// Which step of the package is still missing. Ordered the way iScott gathers, so
// the first entry is the one thing to ask for next.
export function missingLeadPackageFields(pkg: LeadPackage): LeadPackageField[] {
  const missing: LeadPackageField[] = [];
  if (!isMeaningfulVisitorName(pkg.fullName)) missing.push("name");
  if (!isSpecificProjectNeed(pkg.projectNeed)) missing.push("intent");
  const method = pkg.contactMethod === "email" || pkg.contactMethod === "phone" ? pkg.contactMethod : null;
  if (!method || !(pkg.contactValue ?? "").trim()) missing.push("contact");
  return missing;
}

export function isCompleteLeadPackage(pkg: LeadPackage): boolean {
  return missingLeadPackageFields(pkg).length === 0;
}

export type LeadPackageChronology = {
  // Where the visitor's permission sits in these rows, or null if no permission
  // was ever given for the contact we hold.
  permissionIndex: number | null;
  // Where the package last changed under it, or null if it never did.
  lastMaterialChangeIndex: number | null;
  // Fields that changed at or after the permission turn. Empty when permission
  // is still current - or when there is no permission to be stale.
  staleFields: LeadPackageField[];
  // Permission exists AND nothing material has changed since it was given.
  permissionCurrent: boolean;
  packageComplete: boolean;
  missingFields: LeadPackageField[];
};

export function evaluateLeadPackageChronology(args: {
  rows: TranscriptTurn[];
  fullName?: string | null;
  projectNeed?: string | null;
  contactMethod?: "email" | "phone" | null;
  contactValue?: string | null;
}): LeadPackageChronology {
  const method = args.contactMethod === "email" || args.contactMethod === "phone"
    ? args.contactMethod
    : null;
  const contactValue = (args.contactValue ?? "").trim();
  const packageComplete = isCompleteLeadPackage({
    fullName: args.fullName,
    projectNeed: args.projectNeed,
    contactMethod: method,
    contactValue,
  });
  const missingFields = missingLeadPackageFields({
    fullName: args.fullName,
    projectNeed: args.projectNeed,
    contactMethod: method,
    contactValue,
  });
  const consent = method && contactValue
    ? evaluateExactContactSendConsent(args.rows, method, contactValue)
    : null;
  const permissionIndex = consent?.consented ? consent.acceptedIndex : null;

  // The package as the TRANSCRIPT built it, turn by turn. Only the visitor's own
  // turns move it: iScott repeating an address back is not the visitor changing
  // it, and a lead field that was never spoken out loud (a typed correction, a
  // legacy row) simply has no chronology here and cannot invalidate anything.
  const changedAt: Record<LeadPackageField, number | null> = { name: null, intent: null, contact: null };
  let heardName: string | null = null;
  let heardIntent: string | null = null;

  for (const [index, row] of args.rows.entries()) {
    if (row.role !== "user") continue;
    const previousAssistantText = args.rows[index - 1]?.role === "assistant"
      ? args.rows[index - 1].message
      : null;
    const spokenName = extractSpokenFullName(row.message, previousAssistantText);
    if (spokenName && isMeaningfulVisitorName(spokenName)) {
      if (heardName === null || leadPackageFieldChanged("name", heardName, spokenName)) {
        changedAt.name = index;
      }
      heardName = heardName === null
        ? spokenName
        : (normalizedPackageText(spokenName)?.length ?? 0) > (normalizedPackageText(heardName)?.length ?? 0)
          ? spokenName
          : heardName;
    }
    const spokenIntent = extractProjectNeed(row.message);
    if (spokenIntent && isSpecificProjectNeed(spokenIntent)) {
      // G, 2026-09-02 16:47 ET, chose (a) to "(a) Send anyway. Email says project need: not stated yet." His word, verbatim: "a".
      // The FIRST time a need is heard is a fill, not a change: permission given
      // before it stays current. Only a need that REPLACES an earlier one is
      // material.
      if (heardIntent !== null && leadPackageFieldChanged("intent", heardIntent, spokenIntent)) {
        changedAt.intent = index;
      }
      heardIntent = preferProjectNeed(heardIntent, spokenIntent);
    }
    if (method && contactValue) {
      const saysCurrent = messageSpeaksContactExactly(row.message, method, contactValue);
      const saysOther = mentionsDifferentContactValue(row.message, method, contactValue);
      // Only a DIFFERENT value moves the contact. Saying the value we already
      // hold - "just to be sure, my number is 443-555-0142" - is the visitor
      // confirming, not changing, and the exact-read-back rule above already
      // refuses a yes that was given before the current value was ever spoken.
      if (saysOther && !saysCurrent) changedAt.contact = index;
    }
  }

  // Consent authorizes Scott to contact the visitor at the confirmed method
  // and value. Learning or correcting the visitor's name later improves the
  // owner package but does not change what contact the visitor authorized.
  // Intent and contact changes remain material and still require fresh consent.
  const consentMaterialFields: LeadPackageField[] = ["intent", "contact"];
  const changeIndexes = consentMaterialFields
    .map((field) => changedAt[field])
    .filter((value): value is number => value !== null);
  const lastMaterialChangeIndex = changeIndexes.length ? Math.max(...changeIndexes) : null;
  const staleFields = permissionIndex === null
    ? []
    : consentMaterialFields.filter((field) => {
        const at = changedAt[field];
        return at !== null && at >= permissionIndex;
      });
  return {
    permissionIndex,
    lastMaterialChangeIndex,
    staleFields,
    permissionCurrent: permissionIndex !== null && staleFields.length === 0,
    packageComplete,
    missingFields,
  };
}

export type LeadSendBlocker =
  | "missing_full_name"
  | "generic_project_need"
  | "missing_contact"
  | "contact_mismatch"
  | "consent_not_accepted"
  | "contact_not_confirmed"
  | "no_exact_contact_consent"
  | "package_changed_after_permission";

export type LeadSendQualification = {
  qualified: boolean;
  blockers: LeadSendBlocker[];
  reason: LeadSendBlocker | "qualified";
};

const LEAD_SEND_BLOCKERS: ReadonlySet<string> = new Set<LeadSendBlocker>([
  "missing_full_name",
  "generic_project_need",
  "missing_contact",
  "contact_mismatch",
  "consent_not_accepted",
  "contact_not_confirmed",
  "no_exact_contact_consent",
  "package_changed_after_permission",
]);

export function isLeadSendBlocker(value: unknown): value is LeadSendBlocker {
  return typeof value === "string" && LEAD_SEND_BLOCKERS.has(value);
}

// A REFUSAL IS DATA, 2026-08-29. The confirm route used to recognise a blocked
// lead by testing whether an Error's message began with "lead_not_qualified:"
// and slicing the reason out of the rest of the string. A visitor's HTTP status
// - and the words they were shown - therefore hung on free-form prose: any
// message that happened to start that way became a 409, and a reason spelled
// even slightly differently fell through to the generic wording.
//
// The reason travels as a typed field now. The message keeps its exact old
// wording so telemetry, logs and the existing checks read the same as before.
export class LeadNotQualifiedError extends Error {
  readonly leadNotQualified = true;
  readonly reason: LeadSendBlocker;
  readonly blockers: LeadSendBlocker[];

  constructor(qualification: { reason: LeadSendBlocker; blockers?: LeadSendBlocker[] }) {
    super(`lead_not_qualified:${qualification.reason}`);
    this.name = "LeadNotQualifiedError";
    this.reason = qualification.reason;
    this.blockers = qualification.blockers?.length ? [...qualification.blockers] : [qualification.reason];
  }
}

// Read structurally rather than with instanceof: a route and a library can end
// up in two module instances of the same file, and a genuine refusal must never
// become a 500 because two copies of one class exist. An object that carries the
// brand but not a reason we know is NOT treated as a refusal - an unrecognised
// reason has no visitor-safe wording behind it, so it stays a server fault.
export function leadNotQualifiedReason(error: unknown): LeadSendBlocker | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { leadNotQualified?: unknown; reason?: unknown };
  if (candidate.leadNotQualified !== true) return null;
  return isLeadSendBlocker(candidate.reason) ? candidate.reason : null;
}

// The one gate both send paths ask. Auto-send passes the transcript rows so the
// read-back rule is enforced live; the confirm API passes what is STORED, so a
// direct call can only spend consent the conversation already earned.
export function evaluateIScottLeadSendQualification(args: {
  fullName?: string | null;
  projectNeed?: string | null;
  contactMethod?: "email" | "phone" | null;
  contactValue?: string | null;
  requestedContactValue?: string | null;
  consentStatus?: string | null;
  contactConfirmedAt?: string | null;
  rows?: TranscriptTurn[];
}): LeadSendQualification {
  const blockers: LeadSendBlocker[] = [];
  // G, 2026-08-30 said a missing name must not stop a lead reaching him.
  // It no longer does - but the answer was NOT to delete this blocker. It
  // also drives iScott's "still needs your name" prompt and the lead-card
  // copy, so removing it would stop him ever ASKING for a name at all.
  // The guarantee G actually wanted lives in the partial-lead notification
  // in iscottLeadCapture.ts: anything holding an email or a phone is mailed
  // to him regardless of name, consent or qualification. Strict here,
  // nothing lost there.
  if (!isMeaningfulVisitorName(args.fullName)) blockers.push("missing_full_name");
  // G, 2026-09-02 16:47 ET, chose (a) to "(a) Send anyway. Email says project need: not stated yet." His word, verbatim: "a".
  // iPad ride fa6b1fe5: name + email + "Yes" and the send was REFUSED for a
  // missing project need, while the brain spoke the permitted sending line.
  // The need is optional now: consent + confirmed contact sends. The owner
  // email says "Project: not stated yet" and iScott still asks by voice.
  // ("generic_project_need" stays in the type: old rows and receipts name it.)

  const method = args.contactMethod === "email" || args.contactMethod === "phone"
    ? args.contactMethod
    : null;
  const held = (args.contactValue ?? "").trim();
  if (!method || !held) {
    blockers.push("missing_contact");
  } else if (
    args.requestedContactValue !== undefined &&
    args.requestedContactValue !== null &&
    !sameContactValue(method, held, args.requestedContactValue)
  ) {
    // Somebody asked us to send to a value the lead does not hold.
    blockers.push("contact_mismatch");
  }

  if (args.consentStatus !== "accepted") blockers.push("consent_not_accepted");
  if (!(args.contactConfirmedAt ?? "").trim()) blockers.push("contact_not_confirmed");

  if (args.rows && method && held) {
    // One walk of the transcript answers both questions: was permission given
    // for THIS contact, and was the package still this package when it was
    // given? A lead with no permission at all is told that and nothing more -
    // "you changed something" would be nonsense when there is nothing to change
    // it out from under.
    const chronology = evaluateLeadPackageChronology({
      rows: args.rows,
      fullName: args.fullName,
      projectNeed: args.projectNeed,
      contactMethod: method,
      contactValue: held,
    });
    if (chronology.permissionIndex === null) blockers.push("no_exact_contact_consent");
    else if (!chronology.permissionCurrent) blockers.push("package_changed_after_permission");
  }

  return { qualified: blockers.length === 0, blockers, reason: blockers[0] ?? "qualified" };
}

// ONE ITEM AT A TIME. G has said it on every ride: never stack two asks into one
// question. This is the deterministic order the qualification gate needs filled
// in, and it never asks for something already known.
export type IScottLeadGatherStep =
  | "full_name"
  | "project_need"
  | "contact_method"
  | "contact_value"
  | "contact_readback"
  | "send_permission"
  | "ready";

export function iscottLeadGatherOrder(): IScottLeadGatherStep[] {
  return ["full_name", "project_need", "contact_method", "contact_value", "contact_readback", "send_permission"];
}

export function nextIScottLeadQuestion(args: {
  fullName?: string | null;
  projectNeed?: string | null;
  contactMethod?: "email" | "phone" | null;
  contactValue?: string | null;
  contactReadBack?: boolean;
  consentStatus?: string | null;
}): { step: IScottLeadGatherStep; question: string | null } {
  const name = (args.fullName ?? "").replace(/\s+/g, " ").trim();
  if (!isMeaningfulVisitorName(name)) {
    return { step: "full_name", question: "What is your full name?" };
  }
  if (!isSpecificProjectNeed(args.projectNeed)) {
    return {
      step: "project_need",
      question: `${name}, in your own words, what is the one thing you want Scott to help you with?`,
    };
  }
  const method = args.contactMethod === "email" || args.contactMethod === "phone"
    ? args.contactMethod
    : null;
  if (!method) {
    return { step: "contact_method", question: "Should Scott reach you by email or by phone?" };
  }
  const value = (args.contactValue ?? "").trim();
  if (!value) {
    return {
      step: "contact_value",
      question: method === "email"
        ? "What is the best email address for you?"
        : "What is the best phone number for you?",
    };
  }
  if (!args.contactReadBack) {
    const spoken = method === "email"
      ? formatSpokenEmailForReadback(value)
      : formatSpokenPhoneForReadback(value);
    return {
      step: "contact_readback",
      question: spoken
        ? `I have your ${method === "email" ? "email" : "phone number"} as ${spoken}. Did I get that right?`
        : `Would you say that ${method === "email" ? "address" : "number"} once more for me?`,
    };
  }
  if (args.consentStatus !== "accepted") {
    return { step: "send_permission", question: "May I send these details to Scott now?" };
  }
  return { step: "ready", question: null };
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
