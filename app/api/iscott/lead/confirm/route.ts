import { assertAllowedOrigin, isSafeTranscriptionSessionId } from "../../../../../src/lib/apiRouteSecurity";
import { confirmAndSubmitIScottLead } from "../../../../../src/lib/iscottLeadCapture";
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
    await logServerTelemetryEvent({
      request,
      eventType: isTestHeld
        ? "iscott_lead_test_held"
        : result.delivered
          ? "iscott_lead_email_sent"
          : "iscott_lead_email_queued",
      severity: result.queued || isTestHeld ? "low" : "high",
      provider: isTestHeld ? "local" : "resend",
      sessionId,
      route: "/api/iscott/lead/confirm",
      statusCode: result.queued ? 200 : 503,
      userVisibleState: isTestHeld
        ? "test_not_sent"
        : result.delivered
          ? "sent"
          : result.queued
            ? "saved_for_delivery"
            : "delivery_failed",
      payload: {
        contactMethod,
        queued: result.queued,
        delivered: result.delivered,
        detail: result.detail,
      },
    });
    return Response.json({ ok: result.queued, ...result }, { status: result.queued ? 200 : 503 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    await logServerTelemetryEvent({
      request,
      eventType: "iscott_lead_confirmation_failed",
      severity: "high",
      provider: "supabase",
      route: "/api/iscott/lead/confirm",
      statusCode: 500,
      payload: { detail },
    });
    const userError = detail === "invalid_email"
      ? "That email address does not look complete. Please correct it."
      : detail === "invalid_phone"
        ? "That phone number does not look complete. Please correct it."
        : "iScott saved the conversation, but could not finish the handoff yet.";
    return Response.json({ ok: false, error: userError }, { status: 500 });
  }
}
