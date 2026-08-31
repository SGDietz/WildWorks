import { assertAllowedOrigin, isSafeTranscriptionSessionId } from "../../../../../src/lib/apiRouteSecurity";
import { confirmAndSubmitIScottLead } from "../../../../../src/lib/iscottLeadCapture";
import { changedPackageStatusCopy, leadNotQualifiedReason } from "../../../../../src/lib/iscottLeadParsing";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import { logServerTelemetryEvent } from "../../../../../src/lib/serverTelemetryCapture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = assertAllowedOrigin(request);
  if (originError) return originError;
  const rateLimitError = await checkRateLimit(request, {
    prefix: "iscott-lead-confirm",
    perMinute: 12,
    perDay: 100,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const contactMethod = body?.contactMethod === "phone"
      ? "phone"
      : body?.contactMethod === "email"
        ? "email"
        : null;
    const contactValue = typeof body?.contactValue === "string" ? body.contactValue.trim() : "";

    if (!isSafeTranscriptionSessionId(sessionId)) {
      return Response.json({ ok: false, error: "Invalid session." }, { status: 400 });
    }
    if (!contactMethod || !contactValue) {
      return Response.json({ ok: false, error: "Choose email or phone and confirm the value." }, { status: 400 });
    }

    const result = await confirmAndSubmitIScottLead({
      sessionId,
      contactMethod,
      contactValue,
    });
    const isTestHeld = result.detail === "test_traffic_not_sent";
    const isDeliveryFailure = result.lead?.notificationStatus === "failed"
      || result.lead?.notificationStatus === "dead_letter";
    const requestSucceeded = result.queued && !isDeliveryFailure;
    await logServerTelemetryEvent({
      request,
      eventType: isTestHeld
        ? "iscott_lead_test_held"
        : isDeliveryFailure
          ? "iscott_lead_email_failed"
        : result.delivered
          ? "iscott_lead_email_sent"
          : "iscott_lead_email_queued",
      severity: requestSucceeded || isTestHeld ? "low" : "high",
      provider: isTestHeld ? "local" : "resend",
      sessionId,
      route: "/api/iscott/lead/confirm",
      statusCode: requestSucceeded ? 200 : 503,
      userVisibleState: isTestHeld
        ? "test_not_sent"
        : isDeliveryFailure
          ? "delivery_failed"
        : result.delivered
          ? "sent"
          : result.queued
            ? "saved_for_delivery"
            : "delivery_failed",
      payload: {
        contactMethod,
        queued: result.queued,
        delivered: result.delivered,
        failed: isDeliveryFailure,
        detail: result.detail,
      },
    });
    return Response.json(
      {
        ok: requestSucceeded,
        failed: isDeliveryFailure,
        ...(isDeliveryFailure
          ? { error: "The send failed. Scott does not have this yet. I will keep the details here." }
          : {}),
        ...result,
      },
      { status: requestSucceeded ? 200 : 503 },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    // A lead that has not earned a send is not a server fault and must never be
    // reported as one. 400 = the value in this request is wrong. 409 = the
    // conversation is not finished yet, so there is nothing to send.
    const isValidation = detail === "invalid_email" || detail === "invalid_phone";
    // 2026-08-29. This used to read the refusal out of the Error's MESSAGE -
    // startsWith("lead_not_qualified:") and then slice off the rest as the
    // reason. A visitor's status code and the words on their screen therefore
    // depended on free-form prose: any message shaped like that became a 409,
    // and a reason string that drifted by a character fell through to generic
    // wording. The reason is a typed field on the refusal now, validated against
    // the known blockers, so anything else is still an honest 500.
    const qualificationReason = leadNotQualifiedReason(error);
    const statusCode = isValidation ? 400 : qualificationReason ? 409 : 500;
    await logServerTelemetryEvent({
      request,
      eventType: isValidation || qualificationReason
        ? "iscott_lead_confirmation_validation_failed"
        : "iscott_lead_confirmation_failed",
      severity: isValidation || qualificationReason ? "low" : "high",
      provider: "supabase",
      route: "/api/iscott/lead/confirm",
      statusCode,
      userVisibleState: qualificationReason ? "not_qualified" : undefined,
      payload: { detail },
    });
    // A 409 is not an error the visitor caused - it is a step of the
    // conversation that has not happened yet. Every one of these names the
    // MISSING STEP, says plainly that nothing was sent, and points at what to do
    // next. The capture box stays up and Send stays live behind them, so the
    // visitor can finish the step and try again without retyping anything.
    //
    // Written as an exhaustive map rather than a ternary ladder: the reason is a
    // typed union now, so every blocker is required to have its own words here
    // and a new one cannot be added upstream without this file being made to say
    // something about it.
    const MISSING_STEP_COPY: Record<NonNullable<typeof qualificationReason>, string> = {
      "missing_full_name":
        "Nothing has been sent. iScott still needs your name — say it, then choose Send to Scott again.",
      "generic_project_need":
        "Nothing has been sent. iScott still needs to hear, in your own words, what you want Scott to help with — say that, then choose Send to Scott again.",
      "missing_contact":
        "Nothing has been sent. iScott still needs a way for Scott to reach you.",
      "contact_mismatch":
        "Nothing has been sent. That does not match the contact iScott has — say it again, let iScott read it back, then choose Send to Scott.",
      "no_exact_contact_consent":
        "Nothing has been sent. iScott has not read that back to you and heard you confirm it yet — ask iScott to read it back, say yes, then choose Send to Scott.",
      "consent_not_accepted":
        "Nothing has been sent. iScott does not have your permission to send this yet — say yes when iScott asks, then choose Send to Scott.",
      "contact_not_confirmed":
        "Nothing has been sent. iScott does not have your permission to send this yet — say yes when iScott asks, then choose Send to Scott.",
      // 2026-08-30. The visitor DID say yes - to a different package. Their name,
      // what they want, or the way to reach them changed after that yes, so the
      // permission no longer covers what would be sent. Kept as one definition
      // shared with the panel copy so the words on screen and the words in the
      // 409 can never drift apart.
      "package_changed_after_permission": changedPackageStatusCopy(),
    };
    const qualificationError = qualificationReason ? MISSING_STEP_COPY[qualificationReason] : null;
    const userError = detail === "invalid_email"
      ? "That email address does not look complete. Please correct it."
      : detail === "invalid_phone"
        ? "That phone number does not look complete. Please correct it."
        : qualificationError
          ?? "iScott saved the conversation, but could not finish the handoff yet.";
    return Response.json({ ok: false, error: userError }, { status: statusCode });
  }
}
