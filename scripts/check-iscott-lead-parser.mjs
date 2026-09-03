import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/iscottLeadParsing.ts");
const source = await fs.readFile(sourcePath, "utf8");
const salesSource = await fs.readFile(path.resolve("src/lib/iscottSalesCopy.ts"), "utf8");
const salesOutput = ts.transpileModule(salesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const salesPath = path.resolve(".next/iscottSalesCopy.mjs");
await fs.mkdir(path.dirname(salesPath), { recursive: true });
await fs.writeFile(salesPath, salesOutput, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace('from "./iscottSalesCopy"', 'from "./iscottSalesCopy.mjs"');
const tempPath = path.resolve(".next/iscott-lead-parsing-check.mjs");
await fs.mkdir(path.dirname(tempPath), { recursive: true });
await fs.writeFile(tempPath, output, "utf8");
const {
  detectsAcceptedFollowUp,
  detectsContextualContactSendConfirmation,
  detectsSimpleAffirmation,
  extractProjectNeed,
  extractSpokenFullName,
  formatLeadTranscript,
  evaluateIScottCaptureSlice,
  allowedAvatarHandoffSpeech,
  isSendConfirmationReply,
  isSendCommandConsent,
  leadPanelStatusCopy,
  mayClaimHandoffSent,
  preferProjectNeed,
  sessionLooksLikeOperatorQa,
  isIncompleteAvatarUtterance,
  shouldHoldUserFragment,
  mergeUserFragments,
  compactTranscriptRows,
  distillVisitorProjectOffer,
  extractOperatorSiteNote,
  suspectSttCorrection,
  extractContactPreference,
  detectsContactReadBackCorrect,
  detectsFollowUpAcceptance,
  normalizeAssistantReadBackSpacing,
  maskContactForDisplay,
  isOperatorSalesLanguage,
  isOperatorPromptEcho,
  isUnsupportedMediaRequest,
  allowedUploadGuidanceSpeech,
  uploadGuidanceNamesVisibleControl,
  VISIBLE_UPLOAD_CONTROL_LABEL,
  prepareForwardTranscriptRows,
  visitorProjectNeedFromRows,
  collectOperatorPromptEchoEvents,
  formatLeadContactDisplay,
  FIVE_STANDARD_VIEWPORTS,
  OBSERVED_NARROW_VIEWPORT,
  allRequiredIscottViewports,
  mergeLeadTranscriptHistory,
  leadCardTypePx,
  syncFailedUserCopy,
  identityBoundaryContext,
  emptyMediaState,
  helperVsFullBoundary,
  extractEmail,
  extractLocation,
  formatSpokenEmailForReadback,
  shouldParseLeadFacts,
  mergeAssistantRetry,
  assignTranscriptArrival,
  correlateTranscriptTurns,
  collectBargeInEvents,
  providerConfidenceFromRow,
  originalTranscriptTimestamp,
  normalizeSpokenEmail,
  confirmingHandoffStatusCopy,
  leadHasSendPermission,
  capturedAwaitingPermissionCopy,
  sendReadyStatusCopy,
  allowedIscottSpeech,
  saysTeamNotScott,
  claimsUploadReceived,
  stateAwareTapCopy,
  frustrationRecoveryScript,
  replayIscott76Session,
  isProfanityEscalation,
  isSpecificFeedback,
  genericPassAlongForbidden,
  completeCloseGuidance,
  reliableCloseSentence,
  spokenPreferenceSignal,
  visitorChoseContactMethod,
  nextFreeTranscriptTimestamp,
  evaluateExactContactSendConsent,
  detectsExactContactSendConfirmation,
  isExactContactReadback,
  isSpecificProjectNeed,
  isMeaningfulVisitorName,
  sameContactValue,
  normalizedContactValue,
  leadNotQualifiedReason,
  LeadNotQualifiedError,
  evaluateIScottLeadSendQualification,
  nextIScottLeadQuestion,
  iscottLeadGatherOrder,
} = await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
const adapterSource = await fs.readFile(path.resolve("src/lib/telemetryEventAdapter.ts"), "utf8");
const adapterOut = ts.transpileModule(adapterSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const adapterPath = path.resolve(".next/telemetry-adapter-check.mjs");
await fs.writeFile(adapterPath, adapterOut, "utf8");
const { adaptAppEvent, detectProductSchema } = await import(`${pathToFileURL(adapterPath).href}?v=${Date.now()}`);

assert.equal(detectsAcceptedFollowUp("Okay"), false);
assert.equal(detectsSimpleAffirmation("Okay"), false);
const email = "visitor@example.com";
const directPrompt = `I have your email as ${email}. Would you like me to send these details to the WildWorks team now?`;
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: directPrompt, laAbsoluteTimestamp: 1_000 },
    { role: "user", message: "Yes", laAbsoluteTimestamp: 1_020 },
  ], "email", email),
  true,
);
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: `I have your email as ${email}.`, laAbsoluteTimestamp: 1_000 },
    { role: "user", message: "Yes", laAbsoluteTimestamp: 1_020 },
  ], "email", email),
  false,
);
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: directPrompt, laAbsoluteTimestamp: 1_000 },
    { role: "user", message: "Yes", laAbsoluteTimestamp: 1_100 },
  ], "email", email),
  false,
);
assert.equal(
  detectsAcceptedFollowUp("Explicit permission... Yes, and I had already given you permission"),
  true,
);
assert.equal(detectsAcceptedFollowUp("Yes, you may contact me about this project"), true);
assert.equal(detectsAcceptedFollowUp("I had already given you permission to contact me"), true);
assert.equal(
  preferProjectNeed("Some landscaping", extractProjectNeed("I want a pool and a waterfall out back")),
  "A pool and a waterfall out back",
);

const phone = "4105550101";
const phonePrompt = `I have your phone number as ${phone}. Would you like me to send these details to the WildWorks team now?`;
assert.equal(isSendConfirmationReply("Send them to Scott. Yes."), true);
assert.equal(isSendConfirmationReply("Send it to Scott, yes"), true);
assert.equal(isSendConfirmationReply("Yes, send it."), true);
assert.equal(isSendConfirmationReply("Yes."), true);
assert.equal(isSendConfirmationReply("Yes, the Finish button is small."), false);
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: phonePrompt, laAbsoluteTimestamp: 1_000 },
    { role: "user", message: "Send them to Scott. Yes.", laAbsoluteTimestamp: 1_003 },
  ], "phone", phone),
  true,
);
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: phonePrompt, laAbsoluteTimestamp: 1_000 },
    { role: "user", message: "Yes, send it.", laAbsoluteTimestamp: 1_002 },
  ], "phone", phone),
  true,
);
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: "The Finish control is small.", laAbsoluteTimestamp: 1_000 },
    { role: "user", message: "Yes, the Finish button is small.", laAbsoluteTimestamp: 1_002 },
  ], "phone", phone),
  false,
);

assert.equal(extractSpokenFullName("I'm Gregory, and I'm in Atlanta, Georgia."), "Gregory");
assert.equal(extractSpokenFullName("My name is Scott Dietz"), "Scott Dietz");
assert.equal(extractSpokenFullName("I'm going to Atlanta"), null);
assert.equal(extractSpokenFullName("I'm here"), null);
assert.equal(extractSpokenFullName("I'm John from Johnsville."), "John");
assert.equal(extractSpokenFullName("George from Georgia."), "George");
assert.equal(extractLocation("I'm John from Johnsville."), "Johnsville");
assert.equal(extractLocation("George from Georgia."), "Georgia");
assert.equal(
  extractProjectNeed("No, I want you to be like a super positive salesman."),
  null,
);
assert.equal(
  extractProjectNeed("I want a pool and a waterfall out back"),
  "A pool and a waterfall out back",
);

const transcript = formatLeadTranscript([
  { role: "user", message: "Hey, buddy.", laAbsoluteTimestamp: 1 },
  { role: "assistant", message: "Hi, I'm iScott.", laAbsoluteTimestamp: 2 },
]);
assert.match(transcript.transcript_text, /VISITOR: Hey, buddy\./);
assert.match(transcript.transcript_text, /iSCOTT: Hi, I'm iScott\./);
assert.equal(transcript.transcript_snapshot.length, 2);

assert.equal(mayClaimHandoffSent({ status: "ready_for_confirmation", notificationStatus: null }), false);
assert.equal(mayClaimHandoffSent({ status: "submitted", notificationStatus: "queued" }), false);
assert.equal(mayClaimHandoffSent({ status: "submitted", notificationStatus: "sent" }), false);
for (const notificationOutboxId of [null, undefined, "", "   ", "outbox-id", "not-a-linked-uuid"]) {
  assert.equal(
    mayClaimHandoffSent({ status: "submitted", notificationStatus: "sent", notificationOutboxId }),
    false,
    `sent truth fails closed for unlinked outbox id: ${String(notificationOutboxId)}`,
  );
}
const LINKED_OUTBOX_ID = "11111111-1111-4111-8111-111111111111";
assert.equal(
  mayClaimHandoffSent({
    status: "submitted",
    notificationStatus: "sent",
    notificationOutboxId: LINKED_OUTBOX_ID,
  }),
  true,
);
assert.equal(
  leadPanelStatusCopy({ status: "ready_for_confirmation" }),
  "",
  "G 2026-08-17: awaiting card shows no helper line",
);
assert.doesNotMatch(
  leadPanelStatusCopy({ status: "ready_for_confirmation" }),
  /sent/i,
);

const trafficSource = await fs.readFile(path.resolve("src/lib/iscottTrafficResolve.ts"), "utf8");
const trafficOut = ts.transpileModule(trafficSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const trafficPath = path.resolve(".next/iscott-traffic-check.mjs");
await fs.writeFile(trafficPath, trafficOut, "utf8");
const {
  canDispatchFirstPublicMessageAlert,
  canDispatchIScottLeadNotification,
  isPublicLeadAlertEligible,
  resolveTrafficClassification,
} = await import(`${pathToFileURL(trafficPath).href}?v=${Date.now()}`);
assert.equal(resolveTrafficClassification({}).trafficClass, "public");
assert.equal(resolveTrafficClassification({ anonymousVisitorId: "codex-session" }).trafficClass, "test");
assert.equal(resolveTrafficClassification({ anonymousVisitorId: "ww-test-smoke-1" }).trafficClass, "test");
assert.equal(resolveTrafficClassification({ anonymousVisitorId: "ww-owner-smoke-1" }).trafficClass, "owner");
assert.equal(
  resolveTrafficClassification({
    explicitLabel: { trafficClass: "owner", reason: "label", confidence: 1 },
  }).trafficClass,
  "owner",
);
assert.equal(isPublicLeadAlertEligible("public"), true);
assert.equal(isPublicLeadAlertEligible("owner"), false);
assert.equal(isPublicLeadAlertEligible("test"), false);
assert.equal(canDispatchIScottLeadNotification({ trafficClass: "public" }), true);
assert.equal(canDispatchIScottLeadNotification({ sessionId: "codex-smoke-1" }), false);
assert.equal(canDispatchIScottLeadNotification({ visitorId: "ww-test-smoke-1" }), false);
// G 2026-08-19: owner leads now DO dispatch, so he gets a real checkmark on his
// own smoke tests. The mail goes to his own inbox either way. Automated "test"
// identifiers above stay blocked.
assert.equal(canDispatchIScottLeadNotification({ sessionId: "ww-owner-smoke-1" }), true);
assert.equal(
  canDispatchIScottLeadNotification({ trafficClass: "public", sessionId: "ww-test-smoke-1" }),
  false,
);
assert.match(
  leadPanelStatusCopy({ status: "confirmed", notificationStatus: "test_held" }),
  /Test session — not sent/,
);
assert.equal(
  mayClaimHandoffSent({ status: "confirmed", notificationStatus: "test_held" }),
  false,
);

const captureSrc = await fs.readFile(path.resolve("src/lib/iscottLeadCapture.ts"), "utf8");
const notifyAt = captureSrc.indexOf("await notifyIScottLeadByEmail");
const gateAt = captureSrc.indexOf("canDispatchIScottLeadNotification");
assert.ok(gateAt >= 0 && notifyAt > gateAt, "notify must run only after the public-traffic gate");
assert.match(captureSrc, /ISCOTT_TEST_HELD_STATUS/);
assert.match(
  await fs.readFile(path.resolve("app/api/iscott/lead/confirm/route.ts"), "utf8"),
  /test_traffic_not_sent/,
);

const auditedRide = evaluateIScottCaptureSlice({
  createdAt: "2026-08-16T20:43:30.000Z",
  contactMethod: "phone",
  contactValue: phone,
  rows: [
    { role: "user", message: "I'm Gregory, and I'm in Atlanta, Georgia.", laAbsoluteTimestamp: 1 },
    { role: "user", message: "No, I want you to be like a super positive salesman.", laAbsoluteTimestamp: 2 },
    { role: "assistant", message: phonePrompt, laAbsoluteTimestamp: 3 },
    { role: "user", message: "Send them to Scott. Yes.", laAbsoluteTimestamp: 6 },
    {
      role: "assistant",
      message: "Yes, I sent your information to Scott, and he will be in touch with you.",
      laAbsoluteTimestamp: 10,
    },
  ],
});
assert.equal(auditedRide.fullName, "Gregory");
assert.equal(auditedRide.projectNeed, null);
assert.equal(auditedRide.shouldConfirm, true, "WW-1 T65 Send them to Scott. Yes. must confirm");
assert.equal(auditedRide.consentStatus, "accepted", "WW-6 consent after T65");
assert.equal(auditedRide.contactConfirmed, true, "WW-7 contact_confirmed after T65");
assert.match(auditedRide.transcript_text, /VISITOR: Send them to Scott\. Yes\./);
assert.equal(auditedRide.mayClaimSent, false, "WW-2/4/5/8 no sent claim before outbox sent");

const unsubmitted = { status: "ready_for_confirmation", notificationStatus: null };
const submittedSent = {
  status: "submitted",
  notificationStatus: "sent",
  notificationOutboxId: LINKED_OUTBOX_ID,
};
assert.equal(
  allowedAvatarHandoffSpeech("Yes, I sent your information to Scott", unsubmitted),
  false,
  "WW-2 T87 sent-claim blocked without notification_status=sent",
);
assert.equal(
  allowedAvatarHandoffSpeech(
    "The confirmation box should disappear now.",
    unsubmitted,
  ),
  false,
  "WW-3 T87 disappear-claim blocked until submitted",
);
assert.equal(
  allowedAvatarHandoffSpeech("Got it! I'm preparing the handoff now.", unsubmitted),
  false,
  "WW-4 T66 preparing-handoff blocked without sent receipt",
);
assert.equal(
  allowedAvatarHandoffSpeech(
    "I will send your details directly to him.",
    unsubmitted,
  ),
  false,
  "WW-5 T64 future-send promise blocked before submit",
);
assert.equal(
  allowedAvatarHandoffSpeech("Yes, I sent your information to Scott", submittedSent),
  true,
  "WW-2 sent-claim allowed only after notification_status=sent",
);
assert.doesNotMatch(
  leadPanelStatusCopy(unsubmitted),
  /sent/i,
  "WW-9 awaiting card must not say sent",
);
assert.equal(
  leadPanelStatusCopy(unsubmitted),
  "",
  "WW-9 awaiting card stays silent until submit (G removed helper line 2026-08-17)",
);

const liveUnixPrompt = 1_786_913_245;
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: phonePrompt, laAbsoluteTimestamp: liveUnixPrompt },
    { role: "user", message: "Send them to Scott. Yes.", laAbsoluteTimestamp: liveUnixPrompt + 5 },
  ], "phone", phone),
  true,
  "WW-1 T64/T65 adjacent consent within 90s unix-second window",
);
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: phonePrompt, laAbsoluteTimestamp: liveUnixPrompt },
    { role: "user", message: "Yes.", laAbsoluteTimestamp: liveUnixPrompt + 91 },
  ], "phone", phone),
  false,
  "WW-1 consent window does not accept a 91s-late bare yes",
);
assert.equal(
  detectsContextualContactSendConfirmation([
    { role: "assistant", message: phonePrompt, laAbsoluteTimestamp: liveUnixPrompt },
    { role: "user", message: "Send them to Scott. Yes.", laAbsoluteTimestamp: liveUnixPrompt + 91 },
  ], "phone", phone),
  true,
  "WW-1 explicit send-to-Scott command still confirms after UI delay",
);

const overlay = await fs.readFile(path.resolve("app/pages/avatar-iscott/route.ts"), "utf8");
assert.match(overlay, /data-handoff-state/);
assert.match(overlay, /Check the captured details, then choose Send to Scott/);
assert.doesNotMatch(overlay, /Confirm the details before Scott gets them/);
assert.match(overlay, /upload photos or videos/);
assert.match(overlay, /I lost the last transcript sync/);
assert.match(overlay, /Your details are queued for a secure WildWorks handoff/);
assert.doesNotMatch(overlay, /I sent your information/);
assert.match(
  overlay,
  /lead\.status === "submitted" \|\| lead\.submittedAt/,
  "WW-3 overlay hide only after submitted",
);
assert.match(
  overlay,
  /panel\?\.classList\.remove\("wildworks-lead-visible"\)/,
  "WW-3 hide removes visible class",
);
assert.match(
  overlay,
  /#wildworks-lead-confirmation \{\s*[\s\S]*?display: none !important/,
  "WW-3 default overlay is hidden",
);

// G 2026-08-19 reversed L21: "There is no tap... you want to just say yes.
// Yes. Do that." Spoken permission now completes the send instead of unlocking
// a button the visitor could not see.
assert.match(
  captureSrc,
  /consent_status === "accepted"[\s\S]{0,400}confirmAndSubmitIScottLead/,
  "spoken permission auto-submits",
);
assert.match(
  captureSrc,
  /alreadyHandled[\s\S]{0,400}confirmAndSubmitIScottLead/,
  "auto-submit never re-fires on an already sent or queued lead",
);
assert.match(captureSrc, /notification_outbox_id: notification\.outboxId/, "WW-8 outbox written on notify");
assert.match(
  captureSrc,
  /notification_status: ISCOTT_TEST_HELD_STATUS/,
  "WW-10 test/owner never dispatch",
);
assert.equal(
  canDispatchIScottLeadNotification({ trafficClass: "public", visitorId: "ww-owner-smoke-1" }),
  true,
  "WW-10 owner prefix still resolves owner - and owner now dispatches (G 2026-08-19)",
);
assert.equal(
  canDispatchIScottLeadNotification({ trafficClass: "public", sessionId: "codex-76row-retest" }),
  false,
  "L95/96 prefixed session cannot enqueue lead mail",
);
assert.equal(
  canDispatchIScottLeadNotification({ trafficClass: "public", visitorId: "ww-test-smoke-1" }),
  false,
  "L95/96 ww-test- visitor cannot enqueue lead mail",
);
assert.equal(
  canDispatchIScottLeadNotification({
    trafficClass: "public",
    operatorQa: true,
  }),
  false,
  "L95 public row plus operator QA cannot notify",
);
assert.equal(
  canDispatchIScottLeadNotification({ trafficClass: "public" }),
  true,
  "L96 public path remains open without prefix or QA",
);
const unlabeledPublic = resolveTrafficClassification({});
assert.equal(unlabeledPublic.reason, "unlabeled_nonbot");
assert.equal(
  canDispatchFirstPublicMessageAlert({
    classification: unlabeledPublic,
    sessionId: "plain-uuid-session",
  }),
  false,
  "L96 unlabeled first-public-message is held — that is how the 76-row ride leaked",
);
assert.equal(
  canDispatchFirstPublicMessageAlert({
    classification: { trafficClass: "public", reason: "explicit_identity_label", confidence: 1 },
  }),
  true,
  "L96 explicit public identity still allows first-public-message",
);
assert.equal(
  sessionLooksLikeOperatorQa(["I need a pool in Atlanta", "Email is fine."]),
  false,
  "L95 real visitor contact talk is not operator QA",
);
assert.equal(
  sessionLooksLikeOperatorQa(["I want to finish my backyard"]),
  false,
  "L95 finish-a-project is not operator QA",
);
assert.equal(
  sessionLooksLikeOperatorQa(["Okay, when I say email is fine, Boom, the email box, the finish."]),
  true,
  "L95 76-row email-box critique is operator QA",
);
assert.equal(
  sessionLooksLikeOperatorQa(["So, like, right now, I, I, there's no finish button. I, I can't hit finish."]),
  true,
  "L95 76-row missing Finish is operator QA",
);
assert.equal(
  sessionLooksLikeOperatorQa(["The code is written for this. It's almost perfect. Just bring that code into here."]),
  true,
  "L95 76-row isolve-clone coaching is operator QA",
);
assert.match(
  captureSrc,
  /operatorQa[\s\S]{0,400}canDispatchIScottLeadNotification/,
  "L95/96 confirm rereads operator QA before notify",
);
assert.match(
  await fs.readFile(path.resolve("app/api/liveavatar/session-transcript/sync/route.ts"), "utf8"),
  /canDispatchFirstPublicMessageAlert/,
  "L96 first-public-message uses the held/unlabeled gate",
);

assert.equal(isSendCommandConsent("Send them to Scott. Yes."), true);
assert.equal(isSendCommandConsent("Yes, the Finish button is small."), false);
assert.equal(
  sessionLooksLikeOperatorQa(["I want you to be like a super positive salesman"]),
  true,
  "WW-10 operator coaching is owner QA",
);
assert.equal(sessionLooksLikeOperatorQa(["I need a pool in Atlanta"]), false);

const interleavedRide = [
  { role: "assistant", message: phonePrompt, laAbsoluteTimestamp: liveUnixPrompt },
  { role: "user", message: "The Finish button is too small.", laAbsoluteTimestamp: liveUnixPrompt + 20 },
  { role: "user", message: "Yes, the box covers his face.", laAbsoluteTimestamp: liveUnixPrompt + 40 },
  {
    role: "assistant",
    message: "I can send these details directly to Scott now.",
    laAbsoluteTimestamp: liveUnixPrompt + 120,
  },
  { role: "user", message: "Send them to Scott. Yes.", laAbsoluteTimestamp: liveUnixPrompt + 125 },
];
assert.equal(
  detectsContextualContactSendConfirmation(interleavedRide, "phone", phone),
  true,
  "WW-1 T49-T65 UI critique must not kill send-to-Scott consent",
);
assert.equal(
  evaluateIScottCaptureSlice({
    createdAt: "2026-08-16T20:43:30.000Z",
    contactMethod: "phone",
    contactValue: phone,
    rows: interleavedRide,
  }).shouldConfirm,
  true,
);

assert.match(
  captureSrc,
  /sessionLooksLikeOperatorQa/,
  "WW-10 operator QA forces owner hold before notify",
);

assert.equal(isIncompleteAvatarUtterance("I"), true, "WW-11 lone I is a stub");
assert.equal(isIncompleteAvatarUtterance("How should Scott reach out to"), true, "WW-12 clipped contact ask");
assert.equal(isIncompleteAvatarUtterance("I have your phone"), true, "WW-13 clipped read-back");
assert.equal(isIncompleteAvatarUtterance("Okay"), false);
assert.equal(shouldHoldUserFragment("Um, okay, so"), true, "WW-14 filler fragment");
assert.equal(shouldHoldUserFragment("I'm"), true, "WW-16");
assert.equal(
  mergeUserFragments("You know, people may not know how to", "use the site."),
  "You know, people may not know how to use the site.",
  "WW-15 merge split UX complaint",
);

const w2Rows = [
  { role: "user", message: "Um, okay, so", laAbsoluteTimestamp: 1 },
  { role: "user", message: "The word finish and the icon in the button is a little small.", laAbsoluteTimestamp: 2 },
  { role: "user", message: "You know, people may not know how to", laAbsoluteTimestamp: 3 },
  { role: "user", message: "turn you off when they need to.", laAbsoluteTimestamp: 4 },
  { role: "assistant", message: "I", laAbsoluteTimestamp: 5 },
  { role: "user", message: "I'm", laAbsoluteTimestamp: 6 },
  { role: "user", message: "But how you doing?", laAbsoluteTimestamp: 7 },
  { role: "user", message: "So in other words, you know,", laAbsoluteTimestamp: 8 },
  { role: "user", message: "They should be", laAbsoluteTimestamp: 9 },
  { role: "assistant", message: "It sounds like you have some feedback about the interface.", laAbsoluteTimestamp: 10 },
  { role: "user", message: "You know, brand.", laAbsoluteTimestamp: 11 },
  { role: "user", message: "Did you mention Scott Kim?", laAbsoluteTimestamp: 12 },
  { role: "user", message: "build your brand for you.", laAbsoluteTimestamp: 13 },
  { role: "user", message: "Help me with branding. So yeah, that's another thing. Scott can completely", laAbsoluteTimestamp: 14 },
  { role: "user", message: "No, I want you to be like a", laAbsoluteTimestamp: 15 },
  { role: "user", message: "super positive salesman. Scott, he", laAbsoluteTimestamp: 16 },
  { role: "user", message: "completely build your brand.", laAbsoluteTimestamp: 17 },
  { role: "user", message: "Do all your text.", laAbsoluteTimestamp: 18 },
  { role: "user", message: "Do all your artwork.", laAbsoluteTimestamp: 19 },
  { role: "user", message: "Build your logo.", laAbsoluteTimestamp: 20 },
  { role: "user", message: "Do everything start to finish.", laAbsoluteTimestamp: 21 },
  { role: "user", message: "You can see on this website", laAbsoluteTimestamp: 22 },
  { role: "user", message: "How, you know, how", laAbsoluteTimestamp: 23 },
  { role: "user", message: "How smart it is.", laAbsoluteTimestamp: 24 },
  { role: "user", message: "the beautiful aesthetics.", laAbsoluteTimestamp: 25 },
  { role: "user", message: "And this, this is the display. Right?", laAbsoluteTimestamp: 26 },
  { role: "assistant", message: "How should Scott reach out to", laAbsoluteTimestamp: 27 },
  { role: "assistant", message: "I have your phone", laAbsoluteTimestamp: 28 },
  { role: "user", message: "I'm Gregory, and I'm in Atlanta, Georgia.", laAbsoluteTimestamp: 29 },
];
const compacted = compactTranscriptRows(w2Rows);
const compactText = compacted.map((row) => row.message);
assert.equal(compactText.includes("I"), false, "WW-11 lone I omitted from lead package");
assert.equal(compactText.includes("How should Scott reach out to"), false, "WW-12 clipped ask omitted");
assert.equal(compactText.includes("I have your phone"), false, "WW-13 clipped read-back omitted");
assert.equal(compactText.includes("Um, okay, so"), false, "WW-14 filler dropped");
assert.ok(
  compactText.some((text) => /people may not know how to turn you off/.test(text)),
  "WW-15 T5+T6 merged",
);
assert.equal(compactText.includes("I'm"), false, "WW-16 lone I'm dropped");
assert.ok(
  compactText.some((text) => /So in other words, you know, They should be/.test(text)),
  "WW-17/18 T10+T11 merged as one partial",
);
assert.ok(
  compactText.some((text) => /brand/i.test(text) && /Scott Kim|Scott can/i.test(text)),
  "WW-19/21 brand fragments reconstructed",
);
assert.equal(
  suspectSttCorrection("Did you mention Scott Kim?"),
  "Possible STT of “Scott can” / “Scott can build”",
  "WW-20 Scott Kim flagged",
);
assert.ok(
  compacted.some((row) => row.quality === "stt_suspect"),
  "WW-20 compacted turn carries stt_suspect",
);
const w2Slice = evaluateIScottCaptureSlice({
  createdAt: "2026-08-16T20:43:30.000Z",
  contactMethod: "phone",
  contactValue: phone,
  rows: w2Rows,
});
assert.equal(w2Slice.fullName, "Gregory");
assert.equal(extractProjectNeed("No, I want you to be like a super positive salesman."), null, "WW-22 coaching is not project need");
assert.equal(w2Slice.projectNeed, null, "WW-23 operator sales script is not visitor project_need");
assert.doesNotMatch(w2Slice.projectNeed ?? "", /salesman|branding/i, "WW-23 coaching excluded from project need");
const needSplit = visitorProjectNeedFromRows(compacted.filter((row) => row.role === "user").map((row) => row.message));
assert.equal(needSplit.projectNeed, null, "WW-23 production splitter keeps visitor need empty");
assert.match(needSplit.operatorServiceScript ?? "", /logo|artwork|branding/i, "WW-23 script stays in operator lane");
assert.equal(
  extractOperatorSiteNote(compacted.filter((row) => row.role === "user").map((row) => row.message)),
  "Website display and aesthetics quality",
  "WW-24 site-quality fragments collapse to one operator note",
);
assert.doesNotMatch(w2Slice.transcript_text, /^iSCOTT: I$/m, "WW-11 not in lead transcript text");

const syncSrc = await fs.readFile(
  path.resolve("app/api/liveavatar/session-transcript/sync/route.ts"),
  "utf8",
);
assert.match(syncSrc, /prepareForwardTranscriptRows/, "L20 diagnostic persist uses forward prepare");
assert.match(syncSrc, /prepareForwardTranscriptRows/, "WW-65 completeness applied in forward prepare");

const overlayCss = await fs.readFile(path.resolve("app/pages/avatar-iscott/route.ts"), "utf8");
assert.match(overlayCss, /Send these details to Scott/, "WW-37 named send control");
assert.match(overlayCss, /min-height: 44px/, "WW-38 touch target");
assert.match(overlayCss, /font-size: 1\.05rem/, "WW-38 readable status type");
assert.equal(visitorChoseContactMethod("or text"), "phone", "WW-31 text/SMS preference is phone");
assert.match(captureSrc, /visitorChoseContactMethod/, "WW-31 method choice uses visitor helper");

assert.equal(isOperatorSalesLanguage("you know, do a video chat where we bounce ideas off of each other"), true, "WW-25/28 sales language classified");
assert.equal(isOperatorPromptEcho("Would you like for me to put Scott in contact with you?"), true, "WW-29 prompt echo");
assert.match(source, /iscott_operator_prompt_instruction/, "WW-29 audit category written");
assert.equal(
  detectsFollowUpAcceptance([
    { role: "assistant", message: "Would you like for me to put Scott in contact with you?" },
    { role: "user", message: "Yes, definitely." },
  ]),
  true,
  "WW-30 follow-up accepted",
);
assert.equal(
  evaluateIScottCaptureSlice({
    createdAt: "2026-08-16T20:43:30.000Z",
    contactMethod: "phone",
    contactValue: phone,
    rows: [
      { role: "assistant", message: "Would you like for me to put Scott in contact with you?", laAbsoluteTimestamp: 1 },
      { role: "user", message: "Yes, definitely.", laAbsoluteTimestamp: 2 },
    ],
  }).consentStatus,
  "unknown",
  "WW-30 follow-up is not send consent",
);
assert.equal(extractContactPreference("Or text."), "sms", "WW-31 text preference");
assert.equal(extractContactPreference("Oh, he can give me a phone call."), "voice", "WW-32 voice preference");
assert.match(overlayCss, /data-contact-method/, "WW-32 icon/method attribute");
assert.match(overlayCss, /class="ww-phone"/, "WW-32 phone icon is present");
assert.match(overlayCss, /icon\.setAttribute\("data-method", method\)/, "WW-32 selects the phone icon");
assert.equal(maskContactForDisplay("4105550101", "phone"), "•••-•••-0101", "WW-33 masked display helper");
assert.equal(
  normalizeAssistantReadBackSpacing(`I have your phone number as ${phone}Would you like me to send these details to the WildWorks team now?`),
  `I have your phone number as ${phone} Would you like me to send these details to the WildWorks team now?`,
  "WW-34 space before Would you like",
);
assert.equal(isSendConfirmationReply("Yes, the Finish button is small."), false, "WW-35 UI yes is not send consent");
assert.equal(detectsContactReadBackCorrect("the phone number is correct"), true, "WW-39 read-back correct");
assert.equal(
  evaluateIScottCaptureSlice({
    createdAt: "2026-08-16T20:43:30.000Z",
    contactMethod: "phone",
    contactValue: phone,
    rows: [
      { role: "assistant", message: `I have your phone number as ${phone}. Would you like me to send these details to the WildWorks team now?`, laAbsoluteTimestamp: 1 },
      { role: "user", message: "the phone number is correct", laAbsoluteTimestamp: 2 },
    ],
  }).shouldConfirm,
  false,
  "WW-39 correct number is not send consent",
);
assert.equal(VISIBLE_UPLOAD_CONTROL_LABEL, "upload photos or videos", "WW-44 visible control name");
assert.equal(uploadGuidanceNamesVisibleControl("Use the upload photos or videos control."), true, "WW-44 unaided label");
assert.equal(isUnsupportedMediaRequest("Can I send documents and links?"), true, "WW-45 docs/links unsupported");
assert.equal(
  allowedUploadGuidanceSpeech("That's a great idea!"),
  true,
);
assert.equal(
  allowedUploadGuidanceSpeech("That's a great idea! Send me those documents."),
  false,
);
assert.match(overlayCss, /Documents and links are not supported/, "WW-45 gallery rejects docs/links");
const startSession = await fs.readFile(path.resolve("app/api/start-session/route.ts"), "utf8");
assert.match(startSession, /mode: "FULL"/);
assert.doesNotMatch(startSession, /allowedUploadGuidanceSpeech/, "WW-46 no local FULL speech suppressor");

const forward = prepareForwardTranscriptRows([
  { role: "user", message: "Um, okay, so", la_absolute_timestamp: 3 },
  { role: "user", message: "The word finish and the icon in the button is a little small.", la_absolute_timestamp: 4 },
  { role: "user", message: "You know, people may not know how to", la_absolute_timestamp: 5 },
  { role: "user", message: "turn you off when they need to.", la_absolute_timestamp: 6 },
  { role: "user", message: "I'm", la_absolute_timestamp: 8 },
  { role: "user", message: "So in other words, you know,", la_absolute_timestamp: 10 },
  { role: "user", message: "They should be", la_absolute_timestamp: 11 },
  { role: "user", message: "You know, brand.", la_absolute_timestamp: 13 },
  { role: "assistant", message: `I have your phone number as ${phone}Would you like me to send these details to the WildWorks team now?`, la_absolute_timestamp: 48 },
]);
assert.equal(forward.some((row) => row.message === "Um, okay, so"), false, "WW-14 raw filler not inserted");
assert.ok(
  forward.some((row) => /people may not know how to turn you off/.test(row.message) && row.metadata?.merged_forward),
  "WW-15 raw merge before insert",
);
assert.equal(forward.some((row) => row.message === "I'm"), false, "WW-16 raw I'm dropped");
assert.ok(
  forward.some((row) => /So in other words, you know, They should be/.test(row.message)),
  "WW-17/18 raw T10+T11 merged",
);
assert.ok(
  forward.some((row) => /brand/i.test(row.message) && row.metadata?.completeness),
  "WW-19 raw brand fragment has completeness",
);
assert.match(
  forward.find((row) => row.role === "assistant")?.message ?? "",
  new RegExp(`${phone} Would you like`),
  "WW-34 raw assistant spacing before persist",
);
assert.equal(
  normalizeAssistantReadBackSpacing(`I have your phone number as ${phone}Would you like me to send`),
  `I have your phone number as ${phone} Would you like me to send`,
  "WW-34 candidate row transform",
);
assert.match(syncSrc, /prepareForwardTranscriptRows/, "WW-14-19/34 sync uses forward prepare");

const echoEvents = collectOperatorPromptEchoEvents(
  "sess-1",
  [
    { role: "user", message: "Yes, definitely.", laAbsoluteTimestamp: 42 },
    {
      role: "assistant",
      message: "Absolutely! Would you like for me to put Scott in contact with you?",
      laAbsoluteTimestamp: 41,
    },
  ],
  "visitor-1",
);
assert.equal(echoEvents.length, 1, "WW-29 assistant row produces echo payload");
assert.equal(echoEvents[0].category, "iscott_operator_prompt_instruction");
assert.match(String(echoEvents[0].source_text), /put Scott in contact/);
assert.equal(echoEvents[0].session_id, "sess-1");
assert.match(captureSrc, /collectOperatorPromptEchoEvents\(sessionId, rows/, "WW-29 production insert uses collector on all rows");
assert.match(captureSrc, /insertExtractionEvents\(args\.sessionId, rows/, "WW-29 caller passes merged history rows");

const display = formatLeadContactDisplay("phone", "4105550101");
assert.equal(display.visible, "•••-•••-0101", "L116 transcript/notify mask still exists");
assert.equal(display.checkable, "4105550101", "L71 owner card checkable value is full");
assert.match(display.ariaLabel, /4105550101/, "L71 owner aria names the checkable value");
assert.doesNotMatch(display.visible, /4105550101/);
assert.match(overlayCss, /lead\.displayValue/, "L71 overlay paints displayValue");
assert.match(overlayCss, /lead\.ariaLabel/, "L71 overlay uses ariaLabel");
// Shape updated 2026-08-19, intent unchanged. G asked for dashes in the
// displayed phone number ("443-797-2166 ... just visually"), so the confirmed
// captured value now passes through displayContact() on its way to the field.
// It is still the CAPTURED value that drives the reveal - that is what this
// assertion exists to protect - and confirmLead strips the formatting back out
// before anything is sent, so Scott never receives a dashed string.
assert.match(overlayCss, /<input id="wildworks-lead-value"/, "L70/72 email is an immediate editable field");
assert.match(overlayCss, /revealCapturedContact\(output, displayContact\(method, visible\)\)/, "L71/73 captured value uses the iSolve-style reveal");
assert.match(overlayCss, /window\.setInterval/, "L71/73 characters land progressively");
assert.match(overlayCss, /revealVersion/, "L71/73 a newer capture cancels an older reveal");
assert.doesNotMatch(overlayCss, /oscillator\.frequency\.value = 720/, "L74 typing ticks are gone");
assert.doesNotMatch(overlayCss, /\/@\|\\d\{7,\}\/\.test\(visible\)/, "L71 @ no longer hides the email");
assert.doesNotMatch(overlayCss, /Preparing your handoff/, "L39 tap does not claim preparing");
// L22, restated 2026-08-30. The tap copy used to announce a send at the moment
// the button was pressed, ahead of the server's answer. Both the panel string
// and the library string now say what is true of every outcome that can follow:
// the details are being checked, and nothing has been sent.
assert.match(
  overlayCss,
  /status\.textContent = "Checking your details\. Nothing has been sent to Scott yet\.";/,
  "L22 tap copy checks the details and claims no send",
);
assert.equal(
  confirmingHandoffStatusCopy(),
  "Checking your details. Nothing has been sent to Scott yet.",
);
assert.doesNotMatch(
  confirmingHandoffStatusCopy(),
  /\bsending\b/i,
  "no pre-send copy may claim a send is under way",
);
assert.equal(
  capturedAwaitingPermissionCopy(),
  "",
  "G 2026-08-17: helper line removed",
);
assert.equal(
  sendReadyStatusCopy(),
  "Check the captured details, then choose Send to Scott.",
);
assert.equal(leadHasSendPermission({ consentStatus: "unknown" }), false, "L21 no send before permission");
assert.equal(leadHasSendPermission({ consentStatus: "accepted" }), true, "L21 accepted permission unlocks Send");
assert.match(captureSrc, /displayValue: display\?\.checkable \?\? raw/, "L71 toState sends the full checkable value");
assert.match(captureSrc, /maskedValue: display\?\.visible/, "L116 masked copy remains for non-card surfaces");
assert.match(captureSrc, /formatLeadContactDisplay\(method, raw\)/, "WW-33 toState uses display helper");
assert.match(captureSrc, /operator_site_note: extractOperatorSiteNote/, "WW-24 production metadata");
assert.match(captureSrc, /iscott-operator-site-note/, "WW-24 feedback event path");
assert.match(overlayCss, /lead\.status === "submitted" \|\| lead\.submittedAt/, "WW-47/48 box hide still state-gated");

const isolveEvent = adaptAppEvent({ event: "surface_focused", context: { input: "user" } });
assert.equal(detectProductSchema({ event: "surface_focused", context: {} }), "isolve");
assert.equal(detectProductSchema({ event_type: "liveavatar_transcript_synced", payload: {} }), "wildworks");
assert.equal(isolveEvent.nameField, "event");
assert.equal(isolveEvent.bodyField, "context");
const wwEvent = adaptAppEvent({ event_type: "liveavatar_transcript_sync_failed", payload: { stage: "persist" } });
assert.equal(wwEvent.nameField, "event_type");
assert.equal(wwEvent.bodyField, "payload");
assert.equal(wwEvent.name, "liveavatar_transcript_sync_failed");
assert.doesNotMatch(
  await fs.readFile(path.resolve("app/api/liveavatar/session-transcript/sync/route.ts"), "utf8"),
  /notifyFirstPublicMessageByEmail\(\{[\s\S]{0,200}closeout/,
  "WW closeout does not expand first-public-message email",
);

assert.match(overlayCss, /aria-live", "polite"/, "WW-57 aria-live polite");
assert.match(overlayCss, /aria-hidden", "true"/, "WW-57 hidden until shown");
assert.match(overlayCss, /aria-hidden", "false"/, "WW-57 shown state");
assert.match(overlayCss, /role="status"/, "WW-57 status live region");
assert.match(overlayCss, /id="wildworks-lead-confirm"[\s\S]*Send these details to Scott/, "WW-57 named send control");
assert.match(overlayCss, /aria-labelledby="wildworks-lead-label-text"/, "WW-57 value labelled by contact label");

// H434, G's 2026-09-02 10:31 phone screenshots. The accepted card geometry
// stays fixed while the email parts split into their requested palette roles;
// returned Talk uses the initial Home overlay's exact 22%-of-frame anchor.
assert.match(
  overlayCss,
  /#wildworks-lead-confirmation\[data-contact-method="email"\] #wildworks-lead-label-text,[\s\S]{0,260}color: #fce0ad !important/,
  "H434 YOUR EMAIL uses Text 1",
);
assert.match(
  overlayCss,
  /#wildworks-lead-confirmation\[data-contact-method="email"\] #wildworks-lead-value \{[\s\S]{0,120}color: #edc775 !important/,
  "H434 email address uses Text 2",
);
assert.match(overlayCss, /#wildworks-lead-label-text \{\s*white-space: nowrap !important;/, "H434 YOUR EMAIL stays on one line");
assert.match(
  overlayCss,
  /:not\(\[data-ww-embed-measured\]\)\[data-ww-finish-returned\][\s\S]{0,180}bottom: 22% !important/,
  "H434 phone returned Talk uses the initial 22% anchor",
);
assert.match(overlayCss, /--ww-embed-initial-talk-bottom", \(frameHeight \* 0\.22\)/, "H434 measured iPad publishes the same initial anchor");
assert.match(
  overlayCss,
  /\[data-ww-finish-returned\] \[data-ww-talk\]::before \{[\s\S]{0,160}width: 1\.48em !important;[\s\S]{0,500}0\.011512em/,
  "H434 returned Talk icon is modestly larger with a stronger attached shadow",
);
assert.match(
  overlayCss,
  /\[data-ww-avatar-embedded\]\[data-ww-embed-measured\] \[data-ww-finish\] \{[\s\S]{0,700}calc\(100dvh - var\(--ww-embed-h\) \+ var\(--ww-embed-initial-talk-bottom\)\)/,
  "H435 measured iPad Finish uses the initial 22% anchor",
);
assert.match(
  overlayCss,
  /html \[data-ww-finish\]::before,[\s\S]{0,650}width: 1\.48em !important;[\s\S]{0,650}0 0\.58px/, // CLAUDE 2026-09-02: H437 (Grok) lengthened the Finish icon ladder 0.25px -> 0.58px a step on G's "no long shadow effect"; glyph stays 1.48em

  "H435 Finish icon is 10% larger with a 10% longer attached shadow",
);
assert.match(overlayCss, /button\.onclick = confirmLead/, "WW-57 confirm is the focused action control");

assert.equal(FIVE_STANDARD_VIEWPORTS.length, 5, "L79 five standards");
assert.deepEqual(
  FIVE_STANDARD_VIEWPORTS.map((view) => [view.width, view.height]),
  [[1920, 1080], [1366, 768], [1180, 820], [820, 1180], [412, 915]],
  "L79 exact required viewports",
);
assert.equal(OBSERVED_NARROW_VIEWPORT.width, 287, "L78 observed width");
assert.equal(OBSERVED_NARROW_VIEWPORT.height, 511, "L78 observed height");
assert.equal(allRequiredIscottViewports().length, 6, "L78+L79 six proof sizes");
for (const view of allRequiredIscottViewports()) {
  const type = leadCardTypePx(view.width);
  assert.ok(type.label >= 18, `L79/107 ${view.name} label`);
  assert.ok(type.status >= 16, `L79/107 ${view.name} status`);
  assert.equal(type.buttonMin, 44, `L79/107 ${view.name} touch`);
}
assert.match(syncFailedUserCopy(), /retry once/, "WW-50 visible sync recovery");
assert.match(identityBoundaryContext(), /not Scott in the flesh/, "WW-40 identity boundary");
assert.match(emptyMediaState(0).visible, /upload photos or videos/, "WW-44/51 empty media names control");
assert.equal(helperVsFullBoundary().fullCanDiverge, true, "WW-63 FULL can still diverge");
assert.ok(helperVsFullBoundary().helperOwns.includes("lead row"), "WW-63 helper owns lead");
assert.equal(collectOperatorPromptEchoEvents("s1", [
  { role: "assistant", message: "Would you like for me to put Scott in contact with you?", laAbsoluteTimestamp: 1 },
]).length, 1, "WW-25/29 operator prompt instruction event");
assert.equal(allowedUploadGuidanceSpeech("That's a great idea! Send me the PDF."), false, "WW-45/46 docs not encouraged");
assert.equal(uploadGuidanceNamesVisibleControl("Use upload photos or videos"), true, "WW-44 visible label");
assert.match(overlayCss, /aria-label="Send these details to Scott"/, "WW-37 aria name");

assert.equal(isIncompleteAvatarUtterance("It seems"), true, "L25 It seems is a clip");
assert.equal(isIncompleteAvatarUtterance("It sounds"), true, "L26 It sounds is a clip");
assert.equal(isIncompleteAvatarUtterance("I understand. If"), true, "L27 I understand. If is a clip");
assert.equal(
  isIncompleteAvatarUtterance("I understand. If you need to close the session, that's"),
  true,
  "L27 close-session clip",
);
assert.equal(
  isIncompleteAvatarUtterance("I understand your frustration, George. I'll make sure to pass along your feedback."),
  false,
  "complete I-understand sentence is not a clip",
);
const clipForward = prepareForwardTranscriptRows([
  { role: "assistant", message: "It seems", la_absolute_timestamp: 65 },
  { role: "assistant", message: "It sounds", la_absolute_timestamp: 71 },
  { role: "assistant", message: "I understand. If", la_absolute_timestamp: 73 },
  { role: "user", message: "Okay.", la_absolute_timestamp: 74 },
]);
assert.equal(clipForward.length, 4, "L20 diagnostic keeps clip rows");
assert.ok(
  clipForward.filter((row) => row.role === "assistant").every((row) => row.metadata?.completeness === "partial"),
  "L23-24 clips are partial not final",
);
const clipCanon = formatLeadTranscript(clipForward.map((row) => ({
  role: row.role,
  message: row.message,
  laAbsoluteTimestamp: row.la_absolute_timestamp,
})));
assert.doesNotMatch(clipCanon.transcript_text, /It seems/, "L21 canonical omits clip");

const replay76 = JSON.parse(
  await fs.readFile(path.resolve("tests/fixtures/iscott-76-row-replay.json"), "utf8"),
);
assert.equal(replay76.turns.length, 76, "L102 exact 76-row fixture");
assert.ok(replay76.turns.some((row) => row.text === "It seems"), "L25 fixture has It seems");
assert.ok(replay76.turns.some((row) => row.text === "It sounds"), "L26 fixture has It sounds");
assert.ok(
  replay76.turns.some((row) => /^I understand\. If/.test(row.text)),
  "L27 fixture has I understand clips",
);
assert.doesNotMatch(JSON.stringify(replay76), /@/, "L102 fixture has no raw emails");

assert.equal(
  extractLocation("Uh, my name is George and I'm in it, uh, Orlando, Florida."),
  "Orlando, Florida",
  "L34 spoken filler is not part of location",
);
assert.equal(extractLocation("I'm in it"), null, "L29 incomplete location is not stored");
assert.equal(extractLocation("I'm in Atlanta, Georgia."), "Atlanta, Georgia");
assert.equal(
  extractEmail("My email address is visitor-name@example.com"),
  "visitor-name@example.com",
  "L35 hyphen in local part is preserved",
);
assert.equal(
  extractEmail("visitor dash name at example dot com"),
  "visitor-name@example.com",
  "L35 spoken dash becomes hyphen",
);
assert.equal(
  formatSpokenEmailForReadback("sg-dietz@example.com"),
  "s-g dash d-i-e-t-z at e-x-a-m-p-l-e dot c-o-m",
  "L36 local read-back spells letters with dashes",
);
assert.equal(
  formatSpokenEmailForReadback("abc@example.com"),
  "a-b-c at e-x-a-m-p-l-e dot c-o-m",
  "L36 Chief example shape",
);
assert.match(identityBoundaryContext(), /dashes between letters/, "L36 local FULL instruction names dash speech");
assert.equal(shouldParseLeadFacts("S-G-D-"), false, "L29 letter-stub is not lead facts");
assert.equal(shouldParseLeadFacts("Um, okay, so"), false, "L30 filler waits for stabilization");
assert.equal(
  shouldParseLeadFacts("Uh, my name is George and I'm in it, uh, Orlando, Florida."),
  true,
  "L30 complete name+location may parse",
);
assert.equal(
  mergeAssistantRetry("I understand. If", "I understand. If you need to close the session, that's"),
  "I understand. If you need to close the session, that's",
  "L28 prefix retry keeps the longer assistant turn",
);
assert.equal(
  mergeAssistantRetry("Your email address is a@b.com.", "Your email address is a@b.com. Would you like me to send these details to the WildWorks team now?"),
  "Your email address is a@b.com. Would you like me to send these details to the WildWorks team now?",
  "L28 repeated email read-back collapses to the last complete ask",
);
const retryCanon = formatLeadTranscript([
  { role: "assistant", message: "Your email address is visitor@example.com.", laAbsoluteTimestamp: 10 },
  { role: "assistant", message: "Your email address is visitor@example.com. Would you like me to send these details to the WildWorks team now?", laAbsoluteTimestamp: 12 },
]);
assert.equal(
  retryCanon.transcript_snapshot.filter((row) => row.role === "assistant").length,
  1,
  "L28 canonical keeps one assistant retry",
);
const ordered = assignTranscriptArrival([
  { role: "user", message: "One", la_absolute_timestamp: 50 },
  { role: "user", message: "Two", la_absolute_timestamp: 50 },
]);
assert.equal(ordered[0].metadata.arrival_index, 0, "L33 first arrival is 0");
assert.equal(ordered[1].metadata.arrival_index, 1, "L33 colliding second keeps later arrival");
assert.equal(ordered[0].metadata.original_absolute_timestamp, 50, "L18 original time preserved");
assert.equal(originalTranscriptTimestamp(ordered[1]), 50, "L19 canonical time is original not shifted");
const paired = correlateTranscriptTurns([
  { role: "user", message: "Hi" },
  { role: "user", message: "Still me" },
  { role: "assistant", message: "Hello" },
]);
assert.equal(paired[0].metadata.turn_pair_id, paired[1].metadata.turn_pair_id, "L32 split user stays one pair");
assert.equal(paired[2].metadata.turn_pair_id, paired[0].metadata.turn_pair_id, "L32 next assistant shares the pair");
const barges = collectBargeInEvents("sess-barge", [
  { role: "assistant", message: "It seems", laAbsoluteTimestamp: 71 },
  { role: "user", message: "No stopping it.", laAbsoluteTimestamp: 71 },
]);
assert.equal(barges.length, 1, "L31 overlapped clip is a barge-in");
assert.equal(barges[0].category, "iscott_barge_in");
assert.match(captureSrc, /collectBargeInEvents\(sessionId, rows/, "L31 production insert records barge-in");
assert.equal(providerConfidenceFromRow({ metadata: {} }), null, "L37 no local provider confidence field");
assert.match(
  await fs.readFile(path.resolve("supabase/migrations/202608170001_iscott120_transcript_arrival_index.sql"), "utf8"),
  /arrival_index/,
  "L18/19/33 code-only arrival migration exists",
);
assert.match(syncSrc, /original_absolute_timestamp/, "L18/33 capture uses original event time");
assert.match(syncSrc, /Legacy uniqueness offset only/, "L19 uniqueness increment is labeled leftover");
assert.equal(normalizeSpokenEmail("name dash test at example dot com").includes("name-test@example.com"), true);

const replayRows = replay76.turns.map((row) => ({
  role: row.role,
  message: row.text,
  laAbsoluteTimestamp: row.timestamp,
}));
const replayCanon = formatLeadTranscript(replayRows);
assert.doesNotMatch(replayCanon.transcript_text, /(?:^|\n)iSCOTT: It seems(?:\n|$)/, "L21/28 replay omits It seems");
assert.doesNotMatch(replayCanon.transcript_text, /(?:^|\n)iSCOTT: It sounds(?:\n|$)/, "L21/28 replay omits It sounds");
assert.ok(
  replayRows.some((row) => extractLocation(row.message) === "Orlando, Florida"),
  "L34 76-row fixture location is Orlando, Florida",
);
assert.equal(
  allowedAvatarHandoffSpeech(
    "I'm preparing the handoff now.",
    { status: "ready_for_confirmation", notificationStatus: null },
  ),
  false,
  "L28 replay preparing-claim stays blocked without sent receipt",
);

const firstCanon = formatLeadTranscript(replayRows);
const lateBatch = mergeLeadTranscriptHistory(firstCanon.transcript_snapshot, [
  { role: "assistant", message: "I understand. If you need to close the session, that's", laAbsoluteTimestamp: 1786925682 },
  { role: "user", message: "Okay.", laAbsoluteTimestamp: 1786925683 },
]);
const mergedCanon = formatLeadTranscript(lateBatch);
assert.ok(
  mergedCanon.transcript_snapshot.some((row) => /George/.test(row.message)),
  "L91/92 a late clip batch must not erase earlier lead turns",
);
assert.ok(mergedCanon.transcript_snapshot.length > 2, "L91 complete snapshot is more than the last two rows");
assert.match(captureSrc, /mergeLeadTranscriptHistory/, "L91/92 production capture merges prior snapshot");

assert.equal(saysTeamNotScott("The team will follow up."), true, "L38 team without Scott is blocked");
assert.equal(saysTeamNotScott("Scott will follow up."), false, "L38 Scott wording is allowed");
assert.equal(
  allowedIscottSpeech("I'm preparing the handoff now.", {
    status: "ready_for_confirmation",
    notificationStatus: null,
  }).allowed,
  false,
  "L39/103 preparing is blocked without send",
);
assert.equal(
  allowedIscottSpeech("I sent your information to Scott.", {
    status: "ready_for_confirmation",
    notificationStatus: null,
  }).reason,
  "false_handoff_claim",
  "L40/103 false sent claim is blocked",
);
assert.equal(
  allowedIscottSpeech("Scott has your information.", {
    status: "submitted",
    submittedAt: "2026-08-16T00:00:00Z",
    notificationStatus: "queued",
    notificationOutboxId: LINKED_OUTBOX_ID,
  }).allowed,
  false,
  "L41/44 outbox without sent receipt cannot claim follow-up",
);
assert.equal(
  allowedIscottSpeech("I got your photo.", { status: "capturing" }, { mediaCount: 0 }).reason,
  "false_upload_claim",
  "L42 false upload claim is blocked",
);
assert.equal(claimsUploadReceived("I received your video."), true);
assert.equal(
  allowedIscottSpeech("I sent your information to Scott.", {
    status: "submitted",
    submittedAt: "2026-08-16T00:00:00Z",
    notificationStatus: "sent",
    notificationOutboxId: LINKED_OUTBOX_ID,
  }).allowed,
  true,
  "L43/44 sent plus outbox may claim",
);
assert.equal(
  stateAwareTapCopy({ status: "ready_for_confirmation" }),
  "",
  "L22 ready state has no copy at all (G removed helper line 2026-08-17)",
);
assert.equal(
  stateAwareTapCopy({ status: "ready_for_confirmation", consentStatus: "accepted" }),
  "Check the captured details, then choose Send to Scott.",
  "L21 permission shows the Send instruction",
);
assert.equal(
  stateAwareTapCopy({ notificationStatus: "failed" }),
  "The send failed. Scott does not have this yet. I will keep the details here.",
  "L97 failed send is visible",
);
assert.match(frustrationRecoveryScript(), /I will not say Scott has this/, "L46 frustration script");
assert.equal(isProfanityEscalation("What the hell, the box is too small."), true, "L47 profanity escalation");
assert.equal(isSpecificFeedback("The Finish button is too small."), true, "L48 specific feedback");
assert.equal(
  genericPassAlongForbidden("I understand your frustration. I'll pass along your feedback."),
  true,
  "L49 generic pass-along is forbidden",
);
assert.match(completeCloseGuidance(), /Use Finish to stop this session/, "L57 close guidance");
assert.equal(
  reliableCloseSentence(),
  "The session is finished. Nothing else will be sent unless you start again.",
  "L58 close sentence",
);
assert.equal(spokenPreferenceSignal("I prefer email."), true, "L94 spoken preference");

// 26-26 (G ride 8e8dff86ae, 2026-08-17) supersedes L68/L69: the box is the
// simple iSolve field only. No Hide, no Close session, no pre-capture essay.
assert.doesNotMatch(overlayCss, /id="wildworks-lead-close"/, "26-26 Close session control stays gone");
assert.doesNotMatch(overlayCss, /id="wildworks-lead-dismiss"/, "26-26 Hide control stays gone");
assert.doesNotMatch(overlayCss, />Close session</, "26-26 Close label stays gone");
assert.doesNotMatch(overlayCss, />Hide</, "26-26 Hide label stays gone");
assert.doesNotMatch(overlayCss, /Tell iScott your email\. It will appear here/, "26-26 essay status stays gone");
assert.match(overlayCss, /id="wildworks-lead-status" role="status" hidden/, "26-26 status starts hidden");
assert.match(overlayCss, /stopNowWithoutReload/, "L67 Finish stops without reload");
assert.match(overlayCss, /\^finish\$/, "L67 Finish click is intercepted");
assert.doesNotMatch(overlayCss, /positionAboveConversationControl/, "L64 do not measure Finish to place the card");
assert.match(overlayCss, /z-index: 60 !important/, "L63/66 card COVERS Finish while open (G rev 2, 2026-08-17)");
// G 2026-08-19: "the box is still too high. It's like right at iScott's lips."
// The INTENT of this guard is unchanged - the card sits LOW, over the Finish
// zone and never over his face - only the number moved further down.
assert.match(overlayCss, /bottom: calc\(0\.55rem/, "L65/77 card sits down over the Finish zone, not over the face");
assert.match(overlayCss, /data-empty="true"/, "L76 empty media is marked");
assert.match(overlayCss, /#wildworks-lead-media\[data-empty="true"\]/, "L76 empty media hidden");
assert.match(overlayCss, /iscott_ui_confirm_tap/, "L85 confirm tap log");
assert.match(overlayCss, /iscott_ui_finish_tap/, "L86 Finish tap log");
assert.match(overlayCss, /iscott_ui_close_tap/, "L87 close tap log");
assert.match(overlayCss, /iscott_lead_state/, "L88 lead-state log");
assert.match(overlayCss, /iscott_send_outcome/, "L90 send outcome log");
assert.match(overlayCss, /data-ww-avatar-shell/, "L59/61 avatar shell marked");
assert.match(overlayCss, /data-ww-avatar-heading/, "L60 Concierge heading marked for hide");
assert.match(overlayCss, /The session is finished\. Nothing else will be sent unless you start again/, "L58 ended copy");
assert.match(overlayCss, /wildworks:sync-failed/, "L101 visible sync recovery event");
assert.match(captureSrc, /iscott-visitor-correction/, "L93 every explicit correction is stored");
assert.match(captureSrc, /frustration_escalation/, "L47 escalation stored on lead");
assert.match(captureSrc, /insertExtractionEvents\(args\.sessionId, rows/, "L93/94 extraction uses merged history");
assert.match(
  await fs.readFile(path.resolve("app/api/liveavatar/session-transcript/sync/route.ts"), "utf8"),
  /reason === "session_stop"/,
  "L99 ended_at only on a real stop",
);
assert.match(
  await fs.readFile(path.resolve("supabase/migrations/202608170002_iscott120_error_log_usable.sql"), "utf8"),
  /iscott_error_log/,
  "L98 code-only usable error table",
);
assert.equal(
  allowedAvatarHandoffSpeech("Scott has your information.", {
    status: "ready_for_confirmation",
    notificationStatus: null,
  }),
  false,
  "L103 speech-state contradiction on 76-row claim",
);
assert.equal(
  allowedAvatarHandoffSpeech(
    "Yes, I sent your information to Scott, and he will be in touch with you.",
    { status: "ready_for_confirmation", notificationStatus: null },
  ),
  false,
  "90-row false sent-plus-follow-up is blocked",
);
assert.equal(
  allowedAvatarHandoffSpeech(
    "I'll send your information over to Scott and he'll be in touch with you soon.",
    { status: "ready_for_confirmation", notificationStatus: null },
  ),
  false,
  "58-row false follow-up is blocked",
);
assert.match(overlayCss, /hidePanel\(\);\s*dismissed = true/, "90-row Finish hides the lead box");
assert.match(identityBoundaryContext(), /Ask one question at a time/, "58-row one-at-a-time instruction");
assert.match(identityBoundaryContext(), /Not everybody sells services/, "tonight's opening: brand, not only sell services");
assert.match(identityBoundaryContext(), /Never say it sounds like/, "tonight's clip: no It sounds like");
assert.match(identityBoundaryContext(), /show the capture box immediately/, "visitor email/phone choice opens the box");
assert.match(overlayCss, /gap: 0\.22rem !important/, "Finish icon sits closer to the word");
assert.equal(nextFreeTranscriptTimestamp(10, new Set([10, 11])), 12, "store collision is session-wide not per-role");
const transcriptSyncRoute = await fs.readFile(
  path.resolve("app/api/liveavatar/session-transcript/sync/route.ts"),
  "utf8",
);
assert.doesNotMatch(
  transcriptSyncRoute,
  /on_conflict=session_id,role,la_absolute_timestamp/,
  "transcript storage no longer targets the removed three-column uniqueness key",
);
assert.match(transcriptSyncRoute, /storeFailed = true/, "storage failure remains visible to the client");
assert.match(
  transcriptSyncRoute,
  /processIScottTranscriptRows[\s\S]*?storeFailed,/,
  "in-memory rows still reach lead capture when transcript persistence fails",
);
assert.doesNotMatch(
  await fs.readFile(path.resolve("app/H256-iscott-mobile-legal-band.css"), "utf8"),
  /#talk-to-iscott > \.wild-iscott-disclosure[\s\S]{0,160}display:\s*none/,
  "Home bottom disclosure stays visible; it is not hidden for the avatar band",
);
assert.match(
  overlayCss,
  /html\[data-ww-talking\] #wildworks-avatar-legal-band/,
  "talking avatar does not paint a second legal band",
);
assert.match(overlayCss, /failStreak/, "sync backs off after store failures");
assert.match(overlayCss, /<input id="wildworks-lead-value"/, "L104 contact journey still has the editable email");
assert.match(overlayCss, /button\.onclick = confirmLead/, "L104 confirm still submits");
assert.match(overlayCss, /id="wildworks-lead-confirm"/, "L105 Finish/contact chrome keeps confirm");

const replay102 = replayIscott76Session(replay76.turns);
assert.equal(replay102.turnCount, 76, "L102 exact 76 turns");
assert.equal(replay102.fullName, "George", "L102/110 name from the 76-row ride");
assert.equal(replay102.location, "Orlando, Florida", "L102/34 location from the 76-row ride");
assert.equal(replay102.contactMethodEmail, true, "L102/113 email method was spoken");
assert.equal(replay102.canonicalOmitsClips, true, "L102 canonical omits It seems / It sounds");
assert.equal(replay102.snapshotKeepsSession, true, "L102 snapshot is not the last two rows");
assert.equal(replay102.georgeSurvivesLateBatch, true, "L102/91 late batch does not erase George");
assert.equal(replay102.cannotClaimSent, true, "L102/40 unsubmitted ride cannot claim sent");
assert.equal(replay102.cannotClaimPreparing, true, "L102/39 unsubmitted ride cannot claim preparing");

/* ------------------------------------------------------------------ *
 * QUALIFICATION AND THE EXACT-CONTACT CONSENT GATE, 2026-08-29.
 *
 * Scott is going to ring these people. A package only leaves WildWorks
 * carrying a name he can say, a job he can quote, and a contact the visitor
 * read back and said yes to. Everything below drives the real functions.
 * ------------------------------------------------------------------ */

const QEMAIL = "visitor@example.com";
const QOTHER = "someone.else@example.com";
const QREADBACK = `I have your email as ${QEMAIL}. Did I get that right?`;
const QASK = "May I send these details to Scott?";
const qualifiedBase = {
  fullName: "Jennifer Mcallister",
  projectNeed: "A pool and a waterfall out back",
  contactMethod: "email",
  contactValue: QEMAIL,
  consentStatus: "accepted",
  contactConfirmedAt: "2026-08-29T15:00:00.000Z",
};

// Q1. A SPECIFIC PROJECT. "Landscaping" is a category, not a job Scott can
//     quote, and null means the visitor never said - which is a block, not a
//     thing to guess at.
for (const generic of [null, "", "landscaping", "Some landscaping", "help", "A project", "work", "Info"]) {
  assert.equal(isSpecificProjectNeed(generic), false, `"${generic}" must not qualify as a project need`);
}
for (const real of [
  "A pool and a waterfall out back",
  "Website and branding/logo makeover",
  "A patio rebuilt in flagstone",
]) {
  assert.equal(isSpecificProjectNeed(real), true, `"${real}" is a job Scott can act on`);
}
assert.equal(
  isSpecificProjectNeed("You to be like a super positive salesman"),
  false,
  "coaching iScott is never the visitor's project",
);
assert.equal(isSpecificProjectNeed("My phone number"), false, "contact mechanics are not a project");

// Q1b. CORRECTED 2026-08-29. The generic block only ever matched a WHOLE phrase,
//      so stacking two vague words walked straight through it. Every line here
//      is a real thing a visitor says that Scott cannot quote from.
for (const vague of [
  "Some landscaping",
  "some help",
  "Help with a project",
  "A landscaping project",
  "a landscaping job",
  "some yard work",
  "help with my yard",
  "a project done",
  "some work done",
  "the landscaping",
  "some information",
  "a quote",
]) {
  assert.equal(
    isSpecificProjectNeed(vague),
    false,
    `"${vague}" is a category, not a job Scott can act on`,
  );
}
// Q1b-direct. FOLLOW-UP 2026-08-29. The block below used to be asserted ONLY
// through extractProjectNeed, and the extractor strips the "I want" off the
// front - so the gate was never actually asked about a sentence carrying its
// own pronoun. Handed one DIRECTLY, "I want some landscaping" had "i" as its
// single non-scaffold token and passed as a job Scott could quote. A pronoun is
// grammar: it says WHO is asking, never WHAT the work is. Same for the verb.
//
// These call isSpecificProjectNeed on the raw sentence, no extractor in the
// way, which is also how the confirm API sees a stored project_need column.
for (const direct of [
  "I want some landscaping",
  "I need some help",
  "I need help with a project",
  "We want a landscaping project",
  "A landscaping project",
  // and the same lines as they actually arrive, with terminal punctuation
  "I want some landscaping.",
  "I need some help.",
  "I need help with a project.",
  "We want a landscaping project.",
  // the pronouns the fix added, each carrying nothing but scaffold behind it
  "They want a landscaping job",
  "He needs some yard work",
  "My project",
  "I just want a quote",
]) {
  assert.equal(
    isSpecificProjectNeed(direct),
    false,
    `"${direct}" asked directly must not qualify - grammar is not detail`,
  );
}
// Q1b-uncertainty. Apostrophes used to split "don't" into "don" + "t";
// "don" then looked like the one concrete word in an otherwise empty answer.
// Politeness, timing and adverb padding must not turn uncertainty or a bare
// category into a job Scott can quote.
for (const direct of [
  "I don't know",
  "I don’t know",
  "I dont know",
  "I do not know",
  "I'm not sure",
  "I am unsure",
  "I have no idea",
  "No clue yet",
  "I don't know what kind of project yet",
  "Honestly, I probably don't know right now",
  "Could you please help me sometime",
  "I just need landscaping soon",
  "We probably want a project eventually",
  "Maybe later",
]) {
  assert.equal(
    isSpecificProjectNeed(direct),
    false,
    `"${direct}" carries uncertainty or padding, not a concrete project need`,
  );
}
// A pronoun in front of a REAL job is still a real job. The fix must not have
// bought its strictness by refusing sentences people genuinely say.
for (const direct of [
  "I want a pool and a waterfall out back",
  "We need the driveway repaved",
  "I need help with a retaining wall",
  "My patio is sinking",
  "I'm not sure of the style, but I need a patio rebuilt",
  "Maybe later, a pool with a waterfall",
  "Please quote a flagstone path",
  "We probably need better drainage in the back yard",
]) {
  assert.equal(
    isSpecificProjectNeed(direct),
    true,
    `"${direct}" carries a concrete word Scott can quote from`,
  );
}
// And the same sentences as the visitor actually speaks them, through the real
// extractor, so the block cannot be true only for hand-written fixtures.
for (const spoken of [
  "I want some landscaping.",
  "I need some help.",
  "I need help with a project.",
  "We want a landscaping project.",
]) {
  assert.equal(
    isSpecificProjectNeed(extractProjectNeed(spoken)),
    false,
    `"${spoken}" must not qualify as a project need`,
  );
}
// The detail is what makes it a job. One concrete word is enough.
for (const real of [
  "Some landscaping around a new pool",
  "Help with a retaining wall by the driveway",
  "A landscaping project with a stone firepit",
  "I want the yard regraded so it stops flooding",
]) {
  assert.equal(isSpecificProjectNeed(real), true, `"${real}" carries something Scott can quote`);
}

// Q1c. A NAME SCOTT CAN OPEN A CALL WITH. Blank values, placeholders, contact
//      values and field labels all block until iScott gathers a real name.
//      2026-08-30: a legitimate single word is a name. The one-token rule that
//      used to sit here refused "Cher" and "Solveig" - real answers from real
//      visitors - and sent iScott back to ask again.
for (const real of ["Solveig Hansen", "Cher Bono", "Jennifer Mcallister", "Mary-Anne O'Neill", "Jean-Luc Picard"]) {
  assert.equal(isMeaningfulVisitorName(real), true, `"${real}" is a real name`);
}
for (const placeholder of [
  null, undefined, "", "   ", "a", "N/A", "n/a", "none", "unknown", "test", "Testing",
  "visitor", "Guest", "anonymous", "someone", "no name", "First Last", "my name",
  "asdf", "qwerty", "xxx", "1234", "???", "idk",
]) {
  assert.equal(
    isMeaningfulVisitorName(placeholder),
    false,
    `"${placeholder}" must not pass as the visitor's name`,
  );
}
// The gate and the gather order both read the same rule.
assert.equal(
  evaluateIScottLeadSendQualification({ ...qualifiedBase, fullName: "test" }).blockers.includes("missing_full_name"),
  true,
  "a placeholder name blocks the send",
);
assert.equal(
  evaluateIScottLeadSendQualification({ ...qualifiedBase, fullName: "Solveig" }).blockers.includes("missing_full_name"),
  false,
  "a legitimate one-word name is a name and does not block the send",
);
assert.notEqual(
  nextIScottLeadQuestion({ fullName: "Solveig", projectNeed: "A pool and a waterfall out back" }).step,
  "full_name",
  "iScott does not ask again for a name the visitor has already given",
);
assert.equal(
  evaluateIScottLeadSendQualification({ ...qualifiedBase, fullName: "visitor" }).blockers.includes("missing_full_name"),
  true,
  "a one-word placeholder still blocks the send",
);
assert.equal(
  nextIScottLeadQuestion({ fullName: "N/A", projectNeed: "A pool and a waterfall out back" }).step,
  "full_name",
  "iScott asks again rather than accepting a placeholder",
);

// Q2. THE READ-BACK. Exact means exact - the stored value, literally or in
//     iScott's spelled form, and nothing else riding along with it.
assert.equal(isExactContactReadback(QREADBACK, "email", QEMAIL), true, "a plain read-back of the held address");
assert.equal(
  isExactContactReadback(
    "Let me spell that out: V-I-S-I-T-O-R at E-X-A-M-P-L-E dot C-O-M. Did I hear that right?",
    "email",
    QEMAIL,
  ),
  true,
  "iScott's spelled read-back is the same read-back",
);
assert.equal(
  isExactContactReadback(`I have your email as ${QOTHER}. Did I get that right?`, "email", QEMAIL),
  false,
  "a read-back of some OTHER address is not a read-back of this one",
);
assert.equal(
  isExactContactReadback("I have your email. Did I get that right?", "email", QEMAIL),
  false,
  "a read-back that never says the address is not exact",
);
assert.equal(
  isExactContactReadback("I have your phone number as 4-4-3, 5-5-5, 0-1-4-2. Did I get that right?", "phone", "4435550142"),
  true,
  "a number spoken in groups is still an exact read-back",
);

// Q3. READ-BACK, THEN THE SEND QUESTION, THEN AN ADJACENT YES. This is the
//     only shape a plain "Yes." may travel on.
{
  const consent = evaluateExactContactSendConsent(
    [
      { role: "assistant", message: QREADBACK, laAbsoluteTimestamp: 40 },
      { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 43 },
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 46 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 48 },
    ],
    "email",
    QEMAIL,
  );
  assert.equal(consent.consented, true, "read-back then ask then yes is send consent");
  assert.equal(consent.reason, "readback_prompt_affirmation");
}

// Q4. A GENERIC ASK WITH NO EXACT READ-BACK. The yes is real; it is just not
//     attached to any address anyone confirmed, so it may not send.
{
  const consent = evaluateExactContactSendConsent(
    [
      { role: "assistant", message: "Perfect!", laAbsoluteTimestamp: 40 },
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 46 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 48 },
    ],
    "email",
    QEMAIL,
  );
  assert.equal(consent.consented, false, "a generic ASK + Yes must not send");
  assert.equal(consent.reason, "no_exact_contact_readback");
  // The broad detector still calls it a yes. The two rules are deliberately
  // different questions, and only the strict one opens the door.
  assert.equal(
    detectsContextualContactSendConfirmation(
      [
        { role: "assistant", message: QASK, laAbsoluteTimestamp: 46 },
        { role: "user", message: "Yes.", laAbsoluteTimestamp: 48 },
      ],
      "email",
      QEMAIL,
    ),
    true,
    "evaluateContactSendConsent is unchanged - it still reads a yes as a yes",
  );
}

// Q5. A READ-BACK THAT DRIFTED TOO FAR FROM THE QUESTION cannot be spent on it.
//
// UPDATED 2026-08-31. This case used to end in "Yes, that's right." followed by
// small talk and expect a refusal. It now consents, deliberately, and the
// original sequence is kept below as Q5b to show why.
//
// "Yes, that's right." is the visitor confirming the read-back, and a
// confirmation re-anchors it - distance from a read-back is only a proxy for
// "could this value have gone stale", and the visitor answering that directly
// settles it. Three of G's four rides on 2026-08-31 died on the old rule while
// he confirmed his address and then talked about the UI; he told us so in the
// session: "I did not receive a confirmation email which you were supposed to
// send." See scripts/check-iscott-readback-reanchor.mjs.
//
// Q5a. DRIFT WITH NO CONFIRMATION still cannot be spent. Nobody ever said the
//      address was right, so there is nothing to re-anchor and the read-back
//      ages out exactly as before.
assert.equal(
  evaluateExactContactSendConsent(
    [
      { role: "assistant", message: QREADBACK, laAbsoluteTimestamp: 10 },
      { role: "user", message: "Scott has done work near me.", laAbsoluteTimestamp: 12 },
      { role: "assistant", message: "He has, all over Baltimore.", laAbsoluteTimestamp: 14 },
      { role: "user", message: "That sounds good.", laAbsoluteTimestamp: 16 },
      { role: "user", message: "How long has he been at it?", laAbsoluteTimestamp: 18 },
      { role: "user", message: "And does he travel?", laAbsoluteTimestamp: 20 },
      { role: "user", message: "What about winter work?", laAbsoluteTimestamp: 22 },
      { role: "user", message: "Interesting.", laAbsoluteTimestamp: 24 },
      { role: "user", message: "Alright then.", laAbsoluteTimestamp: 26 },
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 28 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 30 },
    ],
    "email",
    QEMAIL,
  ).reason,
  "readback_too_far_from_prompt",
);

// Q5b. THE SAME DRIFT, but the visitor confirmed the read-back first. This is
//      the shape that lost G three leads, and it must now go through.
assert.equal(
  evaluateExactContactSendConsent(
    [
      { role: "assistant", message: QREADBACK, laAbsoluteTimestamp: 10 },
      { role: "user", message: "Yes, that's right.", laAbsoluteTimestamp: 12 },
      { role: "assistant", message: "Scott has built gardens all over Baltimore.", laAbsoluteTimestamp: 14 },
      { role: "user", message: "That sounds good.", laAbsoluteTimestamp: 16 },
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 18 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 20 },
    ],
    "email",
    QEMAIL,
  ).consented,
  true,
);

// Q6. A CHANGED CONTACT kills the read-back and the consent that stood on it.
{
  const consent = evaluateExactContactSendConsent(
    [
      { role: "assistant", message: QREADBACK, laAbsoluteTimestamp: 10 },
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 12 },
      { role: "user", message: `Actually use ${QOTHER} instead.`, laAbsoluteTimestamp: 14 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 16 },
    ],
    "email",
    QEMAIL,
  );
  assert.equal(consent.consented, false, "a yes cannot be spent on an address the visitor replaced");
  assert.equal(consent.reason, "contact_changed_after_consent");
}

// Q7. THE SEND COMMAND, CORRECTED 2026-08-29.
//
//     This gate used to accept ANY explicit command anywhere in the transcript,
//     with no read-back at all - and "Yes, send it to Scott." is a phrase
//     iScott's own prompting invites. So the strict rule could be satisfied by a
//     sentence that never named an address, which is the broad rule wearing the
//     strict rule's name.
//
//     A command is still permission and iScott still does not have to have asked
//     first. What it may no longer do is stand in for the read-back.

// Q7a. Read-back, then the command. ACCEPTED - this is the shape ride 7325f798
//      should have had, and the one the gather order now produces.
{
  const consent = evaluateExactContactSendConsent(
    [
      { role: "assistant", message: QREADBACK, laAbsoluteTimestamp: 10 },
      { role: "user", message: "Yes, send it to Scott.", laAbsoluteTimestamp: 12 },
    ],
    "email",
    QEMAIL,
  );
  assert.equal(consent.consented, true, "a command sitting on the exact read-back is consent");
  assert.equal(consent.reason, "send_command");
}

// Q7b. The command ALONE, with nothing read back. REFUSED. Nobody has confirmed
//      which address it is about, and G's rides are full of addresses that were
//      mis-heard once and corrected later.
{
  const consent = evaluateExactContactSendConsent(
    [{ role: "user", message: "Yes, send it to Scott.", laAbsoluteTimestamp: 10 }],
    "email",
    QEMAIL,
  );
  assert.equal(consent.consented, false, "a bare command may not mint consent on its own");
  assert.equal(consent.reason, "no_exact_contact_readback");
}

// Q7c. RIDE 7325f798's ACTUAL SHAPE: a read-back of the WRONG address, the
//      visitor's correction, then the command - and no second read-back. The
//      corrected address has never been said back to them, so it is refused.
{
  const consent = evaluateExactContactSendConsent(
    [
      { role: "assistant", message: `I have your email as ${QOTHER}. Did I get that right?`, laAbsoluteTimestamp: 10 },
      { role: "user", message: `No, that's not right. It's ${QEMAIL}.`, laAbsoluteTimestamp: 12 },
      { role: "user", message: "Yes, send it to Scott.", laAbsoluteTimestamp: 14 },
    ],
    "email",
    QEMAIL,
  );
  assert.equal(consent.consented, false, "a correction is not a read-back of the correction");
  assert.equal(consent.reason, "no_exact_contact_readback");
}

// Q7d. A COMPLETE, ACCEPTED ride on the OLD address, and then the visitor
//      changes it. Neither address may be sent to: the old one lost the lead,
//      the new one never earned it.
{
  const changed = [
    { role: "assistant", message: `I have your email as ${QOTHER}. Did I get that right?`, laAbsoluteTimestamp: 10 },
    { role: "user", message: "Yes, send it to Scott.", laAbsoluteTimestamp: 12 },
    { role: "user", message: `Actually use ${QEMAIL} instead.`, laAbsoluteTimestamp: 14 },
  ];
  const forOld = evaluateExactContactSendConsent(changed, "email", QOTHER);
  assert.equal(forOld.consented, false, "consent on the replaced address dies with it");
  assert.equal(forOld.reason, "contact_changed_after_consent");
  const forNew = evaluateExactContactSendConsent(changed, "email", QEMAIL);
  assert.equal(forNew.consented, false, "and the new address inherits nothing");
  assert.equal(forNew.reason, "no_exact_contact_readback");
}

// Q7e. A command spoken BEFORE there is any contact at all. There is nothing to
//      have read back yet, so there is nothing to consent to.
{
  const consent = evaluateExactContactSendConsent(
    [
      { role: "user", message: "Yes, send my details to Scott.", laAbsoluteTimestamp: 10 },
      { role: "assistant", message: "What is the best email address for you?", laAbsoluteTimestamp: 12 },
      { role: "user", message: `It's ${QEMAIL}.`, laAbsoluteTimestamp: 14 },
    ],
    "email",
    QEMAIL,
  );
  assert.equal(consent.consented, false, "a command before the contact exists is not consent for it");
  assert.equal(consent.reason, "no_exact_contact_readback");
}

// Q7f. The broad detector is deliberately unchanged - it still answers "did the
//      visitor say yes to a send?" and it still says yes to all of the above.
//      Only the strict gate opens the door.
assert.equal(
  detectsContextualContactSendConfirmation(
    [{ role: "user", message: "Yes, send it to Scott.", laAbsoluteTimestamp: 10 }],
    "email",
    QEMAIL,
  ),
  true,
  "evaluateContactSendConsent still reads a command as a command",
);

assert.equal(
  detectsExactContactSendConfirmation(
    [
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 10 },
      { role: "user", message: "No, don't send my information.", laAbsoluteTimestamp: 12 },
    ],
    "email",
    QEMAIL,
  ),
  false,
  "a refusal is never consent under the strict rule either",
);

// Q8. THE WHOLE GATE. Every field is required and each names its own blocker.
assert.equal(evaluateIScottLeadSendQualification(qualifiedBase).qualified, true, "a complete lead qualifies");
for (const [override, blocker] of [
  [{ fullName: null }, "missing_full_name"],
  [{ fullName: "   " }, "missing_full_name"],
  [{ contactValue: null }, "missing_contact"],
  [{ contactMethod: null }, "missing_contact"],
  [{ consentStatus: "unknown" }, "consent_not_accepted"],
  [{ consentStatus: "declined" }, "consent_not_accepted"],
  [{ contactConfirmedAt: null }, "contact_not_confirmed"],
  [{ requestedContactValue: QOTHER }, "contact_mismatch"],
]) {
  const result = evaluateIScottLeadSendQualification({ ...qualifiedBase, ...override });
  assert.equal(result.qualified, false, `${blocker} must block the send`);
  assert.ok(result.blockers.includes(blocker), `expected blocker ${blocker}, got ${result.blockers.join(",")}`);
}
// G, 2026-09-02 16:47 ET chose (a): "Send anyway. Email says project need: not stated yet." His word, verbatim: "a". iPad ride fa6b1fe5 was refused for a missing need after name + email + "Yes".
for (const need of [null, "", "Landscaping"]) {
  const r = evaluateIScottLeadSendQualification({ ...qualifiedBase, projectNeed: need });
  assert.equal(r.qualified, true, `a missing or generic need no longer blocks the send (need=${JSON.stringify(need)})`);
  assert.equal(r.blockers.includes("generic_project_need"), false);
}
assert.equal(
  evaluateIScottLeadSendQualification({ ...qualifiedBase, requestedContactValue: QEMAIL.toUpperCase() }).qualified,
  true,
  "the same address in different case is the same address",
);
assert.equal(sameContactValue("phone", "+1 (443) 555-0142", "4435550142"), true, "phone comparison is by digits");
assert.equal(sameContactValue("phone", "4435550142", "4435550143"), false);

// Q8b. ONE definition of "the same contact", 2026-08-29. Every idempotency
//      comparison in the lead pipeline asks this function, so the formatting
//      variants a real visitor produces have to collapse here or they collapse
//      nowhere - and the ones that are genuinely different must stay different.
for (const [method, a, b, same, why] of [
  ["phone", "(443) 555-0142", "443.555.0142", true, "punctuation is not a different phone"],
  ["phone", "+1 443 555 0142", "4435550142", true, "a country code is not a different phone"],
  ["phone", "443 555 0142", "  4435550142  ", true, "surrounding space is not a different phone"],
  ["phone", "4435550142", "4435550143", false, "one different digit IS a different phone"],
  ["email", "Visitor@Example.COM", "visitor@example.com", true, "case is not a different mailbox"],
  ["email", " visitor@example.com ", "visitor@example.com", true, "stray space is not a different mailbox"],
  ["email", "visitor @ example.com", "visitor@example.com", true, "spoken spacing is not a different mailbox"],
  ["email", "visitor@example.com", "someone.else@example.com", false, "a different address IS different"],
  ["email", "", "visitor@example.com", false, "a blank is never the same as a real address"],
  ["email", "", "", false, "two blanks are not the same contact"],
  ["phone", "5550142", "5550142", false, "a value too short to be a phone is not a contact at all"],
]) {
  assert.equal(sameContactValue(method, a, b), same, `${why}: ${a} / ${b}`);
  assert.equal(sameContactValue(method, b, a), same, `and the comparison is symmetric: ${a} / ${b}`);
}
assert.equal(normalizedContactValue("phone", "+1 (443) 555-0142"), "4435550142");
assert.equal(normalizedContactValue("email", " Visitor @ Example.com "), "visitor@example.com");
assert.equal(normalizedContactValue("email", "   "), null, "a blank normalizes to no contact, not to an empty key");
assert.equal(normalizedContactValue("phone", "12345"), null, "too few digits is not a phone");

// Q8b2. THE DEAD BRANCH, 2026-08-29. The send-prompt rule ended on a line that
//       could only be reached with asksSendNow already false, so it was a
//       constant false dressed as a rule about read-backs. Removing it changed
//       nothing, and this is the case it pretended to decide: a turn that reads
//       the address back but asks no send question opens no prompt, so the yes
//       that follows it is not permission to mail anybody.
assert.equal(
  evaluateExactContactSendConsent(
    [
      { role: "assistant", message: `I have your email as ${QEMAIL}. Is that right?`, laAbsoluteTimestamp: 10 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 12 },
    ],
    "email",
    QEMAIL,
  ).consented,
  false,
  "a read-back with no send question behind it is not consent to send",
);

// Q8c. THE TYPED REFUSAL. The reason a lead was blocked is data, not a prefix
//      on a sentence. It still SAYS the old words, because telemetry and logs
//      have been reading them for a week, but nothing downstream has to parse
//      them to decide what the visitor is told.
{
  const refusal = new LeadNotQualifiedError({
    reason: "no_exact_contact_consent",
    blockers: ["no_exact_contact_consent", "consent_not_accepted"],
  });
  assert.ok(refusal instanceof Error, "a refusal is still an Error, so every existing catch still works");
  assert.equal(refusal.message, "lead_not_qualified:no_exact_contact_consent", "the logged wording is unchanged");
  assert.equal(refusal.reason, "no_exact_contact_consent", "and the reason is a field, not a substring");
  assert.deepEqual(refusal.blockers, ["no_exact_contact_consent", "consent_not_accepted"]);
  assert.equal(leadNotQualifiedReason(refusal), "no_exact_contact_consent");
}
// Nothing else is a refusal. A plain Error whose message merely LOOKS like one
// used to be read as a 409; it is a server fault again, which is the truth.
for (const notARefusal of [
  new Error("lead_not_qualified:no_exact_contact_consent"),
  new Error("lead_not_qualified:something_invented"),
  new Error("boom"),
  { leadNotQualified: true, reason: "something_invented" },
  { leadNotQualified: true },
  { reason: "missing_full_name" },
  null,
  undefined,
  "lead_not_qualified:missing_contact",
]) {
  assert.equal(
    leadNotQualifiedReason(notARefusal),
    null,
    `only a typed refusal carrying a known blocker is a refusal: ${String(notARefusal)}`,
  );
}

// Q9. The gate reads the TRANSCRIPT too when it is given one, so a lead whose
//     stored consent came from somewhere else still cannot ride a generic yes.
assert.equal(
  evaluateIScottLeadSendQualification({
    ...qualifiedBase,
    rows: [
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 10 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 12 },
    ],
  }).reason,
  "no_exact_contact_consent",
);
assert.equal(
  evaluateIScottLeadSendQualification({
    ...qualifiedBase,
    rows: [
      { role: "assistant", message: QREADBACK, laAbsoluteTimestamp: 10 },
      { role: "assistant", message: QASK, laAbsoluteTimestamp: 12 },
      { role: "user", message: "Yes.", laAbsoluteTimestamp: 14 },
    ],
  }).qualified,
  true,
);

// Q10. ONE ITEM AT A TIME, in order, and never a question about something we
//      already know. G has asked for this on every ride.
assert.deepEqual(
  iscottLeadGatherOrder(),
  ["full_name", "project_need", "contact_method", "contact_value", "contact_readback", "send_permission"],
);
const gatherWalk = [
  [{}, "full_name"],
  [{ fullName: "Jennifer Mcallister" }, "project_need"],
  [{ fullName: "Jennifer Mcallister", projectNeed: "Landscaping" }, "project_need"],
  [{ fullName: "Jennifer Mcallister", projectNeed: "A pool and a waterfall out back" }, "contact_method"],
  [{ fullName: "Jennifer Mcallister", projectNeed: "A pool and a waterfall out back", contactMethod: "email" }, "contact_value"],
  [{ fullName: "Jennifer Mcallister", projectNeed: "A pool and a waterfall out back", contactMethod: "email", contactValue: QEMAIL }, "contact_readback"],
  [{ fullName: "Jennifer Mcallister", projectNeed: "A pool and a waterfall out back", contactMethod: "email", contactValue: QEMAIL, contactReadBack: true }, "send_permission"],
  [{ fullName: "Jennifer Mcallister", projectNeed: "A pool and a waterfall out back", contactMethod: "email", contactValue: QEMAIL, contactReadBack: true, consentStatus: "accepted" }, "ready"],
];
for (const [state, step] of gatherWalk) {
  const next = nextIScottLeadQuestion(state);
  assert.equal(next.step, step, `expected the next missing item to be ${step}`);
  if (step === "ready") {
    assert.equal(next.question, null, "a qualified lead has nothing left to ask");
    continue;
  }
  assert.ok(next.question, `${step} must produce a question`);
  assert.equal(
    (next.question.match(/\?/g) || []).length,
    1,
    `${step} must ask exactly one question, got "${next.question}"`,
  );
  assert.doesNotMatch(next.question, /\band your\b|\band the\b/i, `${step} must not stack two asks`);
}
// The read-back question the gather step produces is one the gate accepts.
{
  const readback = nextIScottLeadQuestion({
    fullName: "Jennifer Mcallister",
    projectNeed: "A pool and a waterfall out back",
    contactMethod: "email",
    contactValue: QEMAIL,
  }).question;
  assert.equal(
    isExactContactReadback(readback, "email", QEMAIL),
    true,
    "the read-back iScott is told to say must satisfy the read-back rule",
  );
}

// Q11. The shipping code actually asks the gate on both send paths.
assert.match(
  captureSrc,
  /evaluateIScottLeadSendQualification[\s\S]{0,600}confirmAndSubmitIScottLead/,
  "auto-send is gated on qualification",
);
assert.match(
  captureSrc,
  /throw new LeadNotQualifiedError\(/,
  "confirmAndSubmitIScottLead refuses an unqualified lead with a TYPED refusal",
);
assert.doesNotMatch(
  captureSrc,
  /throw new Error\(`lead_not_qualified/,
  "the refusal must not be a string somebody downstream has to parse",
);
assert.doesNotMatch(
  captureSrc,
  /consent_status: "accepted"/,
  "the confirm path must never write consent it did not read",
);
assert.match(
  captureSrc,
  /const now = existing\.contact_confirmed_at;/,
  "the confirm path must never mint a contact confirmation",
);

// H453 (2026-09-02): project_need is the visitor's wording, never the synthesized service label.
{
  const brandWords = visitorProjectNeedFromRows(["Can he help me build my brand?"]);
  assert.notEqual(brandWords.projectNeed, "Website and branding makeover", "H453: the canned label must never be the job");
  assert.ok(brandWords.projectNeed && /build my brand/i.test(brandWords.projectNeed), `H453: visitor words survive (got ${brandWords.projectNeed})`);
  const landWords = visitorProjectNeedFromRows(["I want to sell land, landscaping, me, my work."]);
  assert.ok(landWords.projectNeed && /sell land/i.test(landWords.projectNeed), `H453: visitor words survive (got ${landWords.projectNeed})`);
  const scriptOnly = visitorProjectNeedFromRows(["You need to say Scott can build your brand.", "Build your logo."]);
  // Operator scripting: the synthesized label must never be the job; a line that reads as a plain
  // visitor request ("Build your logo.") keeps the pre-H453 behaviour (accumulated visitor wording).
  assert.notEqual(scriptOnly.projectNeed, "Website and branding makeover", "H453: canned label never the job under scripting");
  assert.match(scriptOnly.operatorServiceScript ?? "", /brand|logo/i, "H453: the script still lands in operator_service_script");
}
console.log("iScott lead parser check OK.");
