// Embedded verbatim in the owned avatar page and exercised with fake event
// streams/timers. No provider request, transcript storage or paint lives here.
export const iscottAutoCloseFactory = String.raw`(options) => {
  let sessionId = null;
  let lastAssistantText = "";
  let declined = false;
  let closingText = false;
  let startedAfterDecline = false;
  let endedAfterDecline = false;
  let userSpeaking = false;
  let avatarSpeaking = false;
  let timer = null;
  let stopping = false;
  const seen = new Set();
  const cancelTimer = () => { if (timer !== null) options.clearTimer(timer); timer = null; };
  const cancelClose = () => {
    cancelTimer(); declined = false; closingText = false;
    startedAfterDecline = false; endedAfterDecline = false;
  };
  const reset = () => {
    cancelClose(); sessionId = null; lastAssistantText = "";
    userSpeaking = false; avatarSpeaking = false; stopping = false; seen.clear();
  };
  const eligible = () => sessionId && options.currentSessionId() === sessionId
    && options.canClose(sessionId) && declined && closingText
    && startedAfterDecline && endedAfterDecline && !userSpeaking && !avatarSpeaking && !stopping;
  const maybeClose = () => {
    if (!eligible() || timer !== null) return;
    // A brief chance to continue AFTER actual speech-ended, never a TTS guess.
    timer = options.setTimer(() => {
      timer = null;
      if (!eligible()) return;
      stopping = true;
      options.stop("post-handoff-goodbye");
    }, 1200);
  };
  const isDecline = (text) => /^(?:(?:um+|uh+|okay|ok|well|so)[,.\s]+)*(?:no(?:pe)?(?:[,.!\s]+(?:i(?:'m| am) (?:good|all set)|thanks|thank you))?|i(?:'m| am) (?:good|all set)|that(?:'s| is) (?:all|it)|nothing else|no thanks|no thank you)(?:[,.!\s]+(?:thanks|thank you))?[.!\s]*$/i.test(text);
  const isFollowupQuestion = (text) => /\b(?:anything else|any (?:other|more) questions|is that all)\b/i.test(text);
  const isClosing = (text) => !/\?\s*$/.test(text)
    && /\b(?:welcome|thank|goodbye|bye|have a (?:great|good|nice))\b/i.test(text)
    && /\b(?:(?:look|browse|explore).{0,60}site|come back.{0,90}(?:question|anytime|any time))\b/i.test(text);
  const event = (detail) => {
    if (!detail || !detail.sessionId || detail.sessionId !== options.currentSessionId()) return;
    if (sessionId !== detail.sessionId) { reset(); sessionId = detail.sessionId; }
    const type = detail.type;
    const key = detail.eventId ? type + ":" + detail.eventId : null;
    if (key && seen.has(key)) return;
    if (key) { seen.add(key); if (seen.size > 256) seen.delete(seen.values().next().value); }
    if (type === "user.speak_started") { cancelClose(); userSpeaking = true; }
    else if (type === "user.speak_ended") { userSpeaking = false; maybeClose(); }
    else if (type === "user.transcription") {
      cancelClose();
      const text = String(detail.text || "").replaceAll("’", "'").trim();
      // Delivery can arrive after the spoken goodbye. Remember the intent;
      // eligible() still requires this session's delivered handoff to stop.
      declined = Boolean(isFollowupQuestion(lastAssistantText) && isDecline(text));
    } else if (type === "avatar.transcription") {
      lastAssistantText = String(detail.text || "").trim();
      if (declined) { closingText = isClosing(lastAssistantText); if (!closingText) cancelTimer(); }
      maybeClose();
    } else if (type === "avatar.speak_started") {
      cancelTimer(); avatarSpeaking = true;
      if (declined) { startedAfterDecline = true; endedAfterDecline = false; }
    } else if (type === "avatar.speak_ended") {
      avatarSpeaking = false;
      if (declined && startedAfterDecline) endedAfterDecline = true;
      maybeClose();
    }
  };
  return { event, reset, leadChanged: maybeClose };
}`;
