import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ww-iscott-speech-truth-"));
const fileUrl = (name) => pathToFileURL(path.join(temp, name)).href;
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

/**
 * A negative fixture must be REJECTED. If a mutated source still satisfies a
 * contract, the contract is decorative: it would pass on the pre-fix path too.
 */
const rejects = (label, run) => {
  let rejected = false;
  try {
    run();
  } catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error;
    rejected = true;
  }
  assert.equal(rejected, true, `negative fixture must be rejected: ${label}`);
};

/** Every mutation must actually change the source, or the fixture proves nothing. */
const mutate = (source, from, to) => {
  assert.equal(source.includes(from), true, `fixture anchor missing from source: ${from}`);
  return source.replace(from, to);
};

try {
  // ---------------------------------------------------------------------
  // 1. Contracts, written so each one can be re-run against a mutated source.
  // ---------------------------------------------------------------------

  function assertPolicyModuleContract(source) {
    // The prohibition itself. It is absolute rather than state-dependent
    // because the provider has no authenticated, changing delivery state
    // during the session.
    assert.match(
      source,
      /Never say or imply that you are sending, preparing to send, or have sent/,
      "policy must forbid the positive send claim in every tense",
    );
    assert.match(
      source,
      /Never say or imply that Scott has the details/,
      "policy must forbid the completed-handoff claim",
    );
    assert.match(
      source,
      /The on-screen WildWorks lead card is the only authority/,
      "policy must name the lead card as the only delivery-truth channel",
    );
    // Honesty invariant. Nothing inside this checkout can observe the stored
    // provider context, so the module must not read as a working guard.
    assert.match(
      source,
      /deliberately[\s*]+inert until a separately authorized provider-context change installs it/,
      "policy module must disclose that supplying the variable is inert until provider activation",
    );
  }

  function assertStartSessionContract(source) {
    assert.match(
      source,
      /dynamic_variables:\s*iscottHandoffTruthDynamicVariables\(\)/,
      "start-session must supply the handoff-truth dynamic variables to the provider",
    );
    assert.match(
      source,
      /handoffTruthProviderPlaceholderActivationVerified:\s*false/,
      "start-session telemetry must record provider placeholder activation as unverified",
    );
    assert.doesNotMatch(
      source,
      /handoffTruthProviderPlaceholderActivationVerified:\s*true/,
      "nothing local can verify provider activation, so this flag must never be asserted true here",
    );
    assert.match(
      source,
      /STAGED \/ INERT until the stored LiveAvatar context contains/,
      "start-session must state that the staged variable is not yet a speech guard",
    );
  }

  function assertSyncDetectionContract(source) {
    assert.match(source, /allowedIscottSpeech/);
    assert.match(source, /result\.reason === "false_handoff_claim"/);
    assert.match(source, /iscottSpeechClaimsSendingNow\(row\.message\)/);
    assert.match(source, /iscottSpeechClaimsVisibleNow\(row\.message\)/);
    // The sending-now detector still consults the persisted handoff truth,
    // because the phrase becomes truthful the instant the visitor's details
    // are actually delivered. The visible-now detector is different: the
    // provider cannot observe the browser UI, so it can never truthfully
    // assert that the confirmation card is up right this instant. Gating
    // visible-now on mayClaimHandoffSent would let the exact ride phrase
    // through after a real handoff, which is the bug this file exists to
    // prevent from returning.
    assert.match(
      source,
      /iscottSpeechClaimsSendingNow\(row\.message\) && !mayClaimHandoffSent\(speechTruth\)/,
    );
    assert.doesNotMatch(
      source,
      /iscottSpeechClaimsVisibleNow\(row\.message\) && !mayClaimHandoffSent\(speechTruth\)/,
      "visible-now must not be gated on persisted truth - provider cannot see the browser",
    );
    assert.match(source, /eventType: "iscott_false_handoff_speech_detected"/);
    assert.match(source, /falseHandoffSpeechDetected: falseHandoffSpeech\.length/);
    assert.doesNotMatch(
      source,
      /eventType: "iscott_false_handoff_speech_detected"[\s\S]{0,500}(?:message|transcript):/,
      "false-claim telemetry must not include raw speech",
    );
    // Honesty invariant. This route runs after the visitor has already heard
    // the sentence; it must never be read as the pre-speech guard.
    assert.match(
      source,
      /Detection only: provider speech has already happened/,
      "the sync route must state that its check is detection, not prevention",
    );
  }

  // Line endings are normalized so the fixture anchors below are stable on a
  // CRLF checkout as well as an LF one.
  const readSource = async (rel) =>
    (await fs.readFile(path.join(root, rel), "utf8")).replace(/\r\n/g, "\n");

  const policySource = await readSource("src/lib/iscottRuntimeSpeechTruth.ts");
  const routeSource = await readSource("app/api/start-session/route.ts");
  const syncSource = await readSource("app/api/liveavatar/session-transcript/sync/route.ts");

  assertPolicyModuleContract(policySource);
  assertStartSessionContract(routeSource);
  assertSyncDetectionContract(syncSource);

  // ---------------------------------------------------------------------
  // 2. Source negative fixtures - each pre-fix shape must be rejected.
  // ---------------------------------------------------------------------

  rejects("policy drops the positive-send prohibition", () =>
    assertPolicyModuleContract(mutate(
      policySource,
      '  "Never say or imply that you are sending, preparing to send, or have sent a visitor\'s details.",\n',
      "",
    )));

  rejects("policy drops the lead-card authority sentence", () =>
    assertPolicyModuleContract(mutate(
      policySource,
      '  "The on-screen WildWorks lead card is the only authority for saved, queued, failed, or delivered status.",\n',
      "",
    )));

  rejects("policy drops the inertness disclosure and reads as a working guard", () =>
    assertPolicyModuleContract(mutate(
      policySource,
      "deliberately\n * inert until a separately authorized provider-context change installs it.",
      "active.",
    )));

  rejects("start-session stops sending the handoff-truth variables", () =>
    assertStartSessionContract(mutate(
      routeSource,
      "    dynamic_variables: iscottHandoffTruthDynamicVariables(),\n",
      "",
    )));

  rejects("start-session claims provider activation it cannot verify", () =>
    assertStartSessionContract(mutate(
      routeSource,
      "handoffTruthProviderPlaceholderActivationVerified: false",
      "handoffTruthProviderPlaceholderActivationVerified: true",
    )));

  rejects("start-session goes silent about activation", () =>
    assertStartSessionContract(mutate(
      routeSource,
      "        handoffTruthProviderPlaceholderActivationVerified: false,\n",
      "",
    )));

  rejects("start-session drops the staged/inert disclosure", () =>
    assertStartSessionContract(mutate(
      routeSource,
      "STAGED / INERT until the stored LiveAvatar context contains",
      "Truth policy for the stored LiveAvatar context",
    )));

  rejects("sync route stops classifying false handoff claims", () =>
    assertSyncDetectionContract(mutate(
      syncSource,
      'return result.reason === "false_handoff_claim"',
      "return false",
    )));

  rejects("sync route stops consulting the progressive-send detector", () =>
    assertSyncDetectionContract(mutate(
      syncSource,
      "          || (iscottSpeechClaimsSendingNow(row.message) && !mayClaimHandoffSent(speechTruth))\n",
      "",
    )));

  rejects("sync route stops consulting the on-screen/visible-now detector", () =>
    assertSyncDetectionContract(mutate(
      syncSource,
      "          || iscottSpeechClaimsVisibleNow(row.message);",
      "          ;",
    )));

  rejects("sync route re-adds a persisted-truth gate on the visible-now claim", () =>
    assertSyncDetectionContract(mutate(
      syncSource,
      "|| iscottSpeechClaimsVisibleNow(row.message);",
      "|| (iscottSpeechClaimsVisibleNow(row.message) && !mayClaimHandoffSent(speechTruth));",
    )));

  rejects("sync route stops reporting detections", () =>
    assertSyncDetectionContract(mutate(
      syncSource,
      'eventType: "iscott_false_handoff_speech_detected"',
      'eventType: "iscott_speech_noted"',
    )));

  rejects("sync route leaks raw speech into false-claim telemetry", () =>
    assertSyncDetectionContract(mutate(
      syncSource,
      "          count: falseHandoffSpeech.length,",
      "          count: falseHandoffSpeech.length,\n          message: falseHandoffSpeech[0].message,",
    )));

  rejects("sync route drops the detection-is-not-prevention disclosure", () =>
    assertSyncDetectionContract(mutate(
      syncSource,
      "Detection only: provider speech has already happened",
      "Guard: false handoff speech is blocked",
    )));

  // ---------------------------------------------------------------------
  // 3. Policy module behaviour.
  // ---------------------------------------------------------------------

  await fs.writeFile(path.join(temp, "policy.mjs"), transpile(policySource), "utf8");
  const policy = await import(fileUrl("policy.mjs"));

  assert.equal(
    policy.ISCOTT_HANDOFF_TRUTH_CONTEXT_PLACEHOLDER,
    "${wildworks_handoff_truth_policy}",
  );
  const variables = policy.iscottHandoffTruthDynamicVariables();
  assert.deepEqual(Object.keys(variables), [policy.ISCOTT_HANDOFF_TRUTH_DYNAMIC_VARIABLE]);
  assert.equal(
    variables[policy.ISCOTT_HANDOFF_TRUTH_DYNAMIC_VARIABLE],
    policy.ISCOTT_HANDOFF_TRUTH_POLICY,
  );
  assert.match(policy.ISCOTT_HANDOFF_TRUTH_POLICY, /never say or imply that you are sending/i);
  assert.match(policy.ISCOTT_HANDOFF_TRUTH_POLICY, /have sent/i);
  assert.match(policy.ISCOTT_HANDOFF_TRUTH_POLICY, /Scott has the details/i);
  assert.match(policy.ISCOTT_HANDOFF_TRUTH_POLICY, /delivery succeeded/i);
  assert.match(policy.ISCOTT_HANDOFF_TRUTH_POLICY, /follow up/i);
  assert.match(policy.ISCOTT_HANDOFF_TRUTH_POLICY, /lead card is the only authority/i);
  assert.equal(policy.iscottSpeechClaimsSendingNow("I'm sending that to Scott now."), true);
  assert.equal(policy.iscottSpeechClaimsSendingNow("I am not sending that to Scott."), false);

  // Focused positive/negative coverage for the on-screen/visible-now claim.
  // G's 2026-09-02 ride surfaced the recency phrasing; the other positives
  // are the shapes iScott has produced when narrating a card that had
  // already transitioned away.
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("Perfect—it's on my screen now."),
    true,
    "the exact ride phrase must be flagged",
  );
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("Got it—it's on my screen now. How should Scott reach out?"),
    true,
  );
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("I have your email on my screen, and it will be passed."),
    true,
  );
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("I'm seeing a confirmation on screen right now."),
    true,
  );
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("Your phone number is on my screen."),
    true,
  );
  // Ordinary conversation must not be swept in - the guard exists to stop
  // one false claim, not to mute iScott.
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("Tell me about your project."),
    false,
  );
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("I can see you're excited about the branding."),
    false,
  );
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("Would you like to leave a way for Scott to reach you?"),
    false,
  );
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("Scott's landscape work is on display in Timonium."),
    false,
  );
  // A visitor's own remark echoed back is never the false claim - iScott
  // does not say "my number is on the screen" about themselves.
  assert.equal(
    policy.iscottSpeechClaimsVisibleNow("My number is on the screen."),
    false,
  );

  // ---------------------------------------------------------------------
  // 4. The route really does hand the variables to the provider, and really
  //    does refuse to represent provider activation as verified.
  // ---------------------------------------------------------------------

  const stubs = {
    secrets: `export const API_KEY="test-key"; export const API_URL="https://provider.invalid"; export const AVATAR_ID="avatar-id"; export const CONTEXT_ID="context-id"; export const LANGUAGE="en"; export const VOICE_ID="voice-id";`,
    telemetry: `export async function logServerTelemetryEvent(event){ globalThis.__speechTruthTelemetry.push(event); } export async function logIScottOriginRejection(){}`,
    security: `export function assertAllowedOrigin(){ return null; }`,
    rateLimit: `export async function checkCriticalRateLimit(){ return null; }`,
  };
  for (const [name, source] of Object.entries(stubs)) {
    await fs.writeFile(path.join(temp, `${name}.mjs`), source, "utf8");
  }

  const routeOutput = transpile(routeSource)
    .replace('from "../liveavatar/secrets"', `from "${fileUrl("secrets.mjs")}"`)
    .replace('from "../../../src/lib/serverTelemetryCapture"', `from "${fileUrl("telemetry.mjs")}"`)
    .replace('from "../../../src/lib/iscottOriginTelemetry"', `from "${fileUrl("telemetry.mjs")}"`)
    .replace('from "../../../src/lib/apiRouteSecurity"', `from "${fileUrl("security.mjs")}"`)
    .replace('from "../../../src/lib/rateLimit"', `from "${fileUrl("rateLimit.mjs")}"`)
    .replace('from "../../../src/lib/iscottRuntimeSpeechTruth"', `from "${fileUrl("policy.mjs")}"`);
  await fs.writeFile(path.join(temp, "route.mjs"), routeOutput, "utf8");

  globalThis.__speechTruthTelemetry = [];
  let providerPayload = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    providerPayload = JSON.parse(init.body);
    return Response.json({
      code: 1000,
      data: { session_id: "session-id", session_token: "session-token" },
    });
  };
  try {
    const route = await import(fileUrl("route.mjs"));
    const response = await route.POST(new Request("https://wildworks.ai/api/start-session", {
      method: "POST",
      headers: { origin: "https://wildworks.ai" },
    }));
    assert.equal(response.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerPayload.mode, "FULL");
  assert.deepEqual(providerPayload.dynamic_variables, variables);
  assert.equal(providerPayload.avatar_persona.context_id, "context-id");
  assert.equal(
    globalThis.__speechTruthTelemetry.at(-1)?.payload?.handoffTruthProviderPlaceholderActivationVerified,
    false,
    "source telemetry must not represent provider activation as verified",
  );

  // ---------------------------------------------------------------------
  // 5. The speech/truth decision matrix: which claims are blocked, which are
  //    allowed, and what ordinary conversation must never be touched by any
  //    of it.
  // ---------------------------------------------------------------------

  const salesSource = await readSource("src/lib/iscottSalesCopy.ts");
  await fs.writeFile(path.join(temp, "sales.mjs"), transpile(salesSource), "utf8");
  const parsingSource = await readSource("src/lib/iscottLeadParsing.ts");
  const parsingOutput = transpile(parsingSource)
    .replace('from "./iscottSalesCopy"', `from "${fileUrl("sales.mjs")}"`);
  await fs.writeFile(path.join(temp, "parsing.mjs"), parsingOutput, "utf8");
  const { allowedIscottSpeech, mayClaimHandoffSent } = await import(fileUrl("parsing.mjs"));

  const LINKED_OUTBOX = "22222222-2222-4222-8222-222222222222";
  const SUBMITTED_AT = "2026-08-29T00:00:00.000Z";

  // Every server-derived truth state in which iScott may NOT claim a handoff.
  const unauthorizedTruth = {
    nothing_captured: {
      status: "capturing", submittedAt: null, notificationStatus: null, notificationOutboxId: null,
    },
    awaiting_permission: {
      status: "ready_for_confirmation", submittedAt: null, notificationStatus: null, notificationOutboxId: null,
    },
    queued_not_submitted: {
      status: "ready_for_confirmation", submittedAt: null, notificationStatus: "queued", notificationOutboxId: LINKED_OUTBOX,
    },
    submitted_but_only_queued: {
      status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "queued", notificationOutboxId: LINKED_OUTBOX,
    },
    sent_without_outbox_link: {
      status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "sent", notificationOutboxId: null,
    },
    sent_with_blank_outbox_link: {
      status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "sent", notificationOutboxId: "   ",
    },
    sent_with_non_uuid_outbox_link: {
      status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "sent", notificationOutboxId: "outbox-1",
    },
    delivery_failed: {
      status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "failed", notificationOutboxId: LINKED_OUTBOX,
    },
    dead_letter: {
      status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "dead_letter", notificationOutboxId: LINKED_OUTBOX,
    },
    test_held: {
      status: "submitted", submittedAt: SUBMITTED_AT, notificationStatus: "test_held", notificationOutboxId: LINKED_OUTBOX,
    },
  };

  // The only state that authorizes a positive claim.
  const deliveredTruth = {
    status: "submitted",
    submittedAt: SUBMITTED_AT,
    notificationStatus: "sent",
    notificationOutboxId: LINKED_OUTBOX,
  };

  const positiveHandoffClaims = [
    "I sent your information to Scott.",
    "I've sent your details over to Scott.",
    "I'm sending your details to Scott now.",
    "Got it! I'm preparing the handoff now.",
    "Scott has your details.",
    "Scott will follow up.",
    "The confirmation box should disappear now.",
  ];

  // Ordinary, non-handoff conversation. None of this may ever be blocked, in
  // any truth state - the guard exists to stop one false claim, not to make
  // iScott mute.
  const ordinaryConversation = [
    "What are you trying to build?",
    "Tell me about the deck and the timeline.",
    "Scott builds these systems himself.",
    "I can show you the projects gallery.",
    "Would you like to leave a way for Scott to reach you?",
  ];

  // The gate exactly as the shipping code composes it. `fns` exists so a
  // fixture can re-run the entire matrix against a MUTATED parsing module.
  const gateBlocks = (text, truth, claimsSendingNow, fns) =>
    fns.allowedIscottSpeech(text, truth).reason === "false_handoff_claim"
    || (claimsSendingNow(text) && !fns.mayClaimHandoffSent(truth));

  const realFns = { allowedIscottSpeech, mayClaimHandoffSent };

  function assertMatrix(claimsSendingNow, fns = realFns) {
    for (const [name, truth] of Object.entries(unauthorizedTruth)) {
      assert.equal(
        fns.mayClaimHandoffSent(truth),
        false,
        `server truth "${name}" must not authorize a handoff claim`,
      );
      for (const phrase of positiveHandoffClaims) {
        assert.equal(
          gateBlocks(phrase, truth, claimsSendingNow, fns),
          true,
          `blocked false claim required: "${phrase}" under truth "${name}"`,
        );
      }
    }

    assert.equal(
      fns.mayClaimHandoffSent(deliveredTruth),
      true,
      "submitted + sent + linked outbox is the authorized state",
    );
    for (const phrase of positiveHandoffClaims) {
      assert.equal(
        gateBlocks(phrase, deliveredTruth, claimsSendingNow, fns),
        false,
        `allowed truthful claim required: "${phrase}" under authenticated delivery`,
      );
    }

    for (const truth of [...Object.values(unauthorizedTruth), deliveredTruth]) {
      for (const phrase of ordinaryConversation) {
        assert.equal(
          fns.allowedIscottSpeech(phrase, truth).allowed,
          true,
          `ordinary conversation must stay untouched: "${phrase}"`,
        );
        assert.equal(
          gateBlocks(phrase, truth, claimsSendingNow, fns),
          false,
          `ordinary conversation must never be flagged: "${phrase}"`,
        );
      }
    }
  }

  assertMatrix(policy.iscottSpeechClaimsSendingNow);

  // Focused visible-now behaviour: the provider cannot observe the browser,
  // so a visible-now claim is a false claim regardless of delivery truth.
  // The composite mirrors the shipping sync route exactly - visible-now is
  // ungated, sending-now still consults the persisted truth.
  const visibleNowComposite = (text, truth) =>
    allowedIscottSpeech(text, truth).reason === "false_handoff_claim"
    || (policy.iscottSpeechClaimsSendingNow(text) && !mayClaimHandoffSent(truth))
    || policy.iscottSpeechClaimsVisibleNow(text);

  const visibleNowPhrases = [
    "Perfect—it's on my screen now.",
    "I have your email on my screen.",
    "I'm seeing a confirmation on screen right now.",
    "Your phone number is on my screen.",
  ];

  for (const phrase of visibleNowPhrases) {
    for (const [name, truth] of Object.entries(unauthorizedTruth)) {
      assert.equal(
        visibleNowComposite(phrase, truth),
        true,
        `visible-now must be rejected BEFORE delivery ("${name}"): "${phrase}"`,
      );
    }
    assert.equal(
      visibleNowComposite(phrase, deliveredTruth),
      true,
      `visible-now must remain rejected AFTER delivery truth: "${phrase}"`,
    );
  }

  // 2026-08-30. The progressive form was folded into the canonical
  // avatarSpeechClaimsHandoffSent in src/lib/iscottLeadParsing.ts, so the
  // sync route's hand-ORed detector is now defence in depth rather than the
  // only thing standing up. Proving that is a two-part obligation, and BOTH
  // halves have to stay here or the guard quietly becomes decorative again.

  // (a) The canonical gate carries it alone: stub the route's detector out
  //     entirely and the matrix must still hold.
  assertMatrix(() => false);

  // (b) ...and it is genuinely the canonical gate doing the work. Neuter the
  //     progressive alternation in the parsing source itself and the matrix
  //     must collapse. Without this, (a) would pass just as happily if the
  //     alternation were deleted tomorrow.
  const neuteredParsing = transpile(mutate(
    parsingSource,
    String.raw`) sending\b[\s\S]{0,100}`,
    String.raw`) __never_matches__\b[\s\S]{0,100}`,
  )).replace('from "./iscottSalesCopy"', `from "${fileUrl("sales.mjs")}"`);
  await fs.writeFile(path.join(temp, "parsing-neutered.mjs"), neuteredParsing, "utf8");
  const neutered = await import(fileUrl("parsing-neutered.mjs"));
  rejects("canonical gate without the progressive-send alternation", () =>
    assertMatrix(() => false, {
      allowedIscottSpeech: neutered.allowedIscottSpeech,
      mayClaimHandoffSent: neutered.mayClaimHandoffSent,
    }));

  console.log("iScott staged runtime speech-truth checks passed");
} finally {
  delete globalThis.__speechTruthTelemetry;
  await fs.rm(temp, { recursive: true, force: true });
}
