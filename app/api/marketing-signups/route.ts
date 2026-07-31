import { assertAllowedOrigin, truncateUtf8String } from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "../../../src/lib/supabaseAdmin";
import { Resend } from "resend";
import twilio from "twilio";

type SignupChannel = "email" | "sms" | "both";

const SIGNUP_CONSENT_VERSION = "2026-07-29";
const CHANNELS = new Set<SignupChannel>(["email", "sms", "both"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? truncateUtf8String(value.trim(), max) : "";
}

function normalizeEmail(value: unknown): string | null {
  const email = cleanText(value, 254).toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function normalizeUsPhone(value: unknown): string | null {
  const digits = cleanText(value, 40).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function requestedChannels(channel: SignupChannel) {
  return {
    email: channel === "email" || channel === "both",
    sms: channel === "sms" || channel === "both",
  };
}

function emailProviderReady(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function smsProviderReady(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
  );
}

async function updateSignup(id: string, patch: Record<string, unknown>) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  return fetch(`${url}/rest/v1/marketing_signups?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
}

async function insertSignup(row: Record<string, unknown>) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  return fetch(`${url}/rest/v1/marketing_signups`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
}

function emailHtml() {
  return `<div style="font-family:Georgia,serif;color:#4b230f;line-height:1.55"><h1 style="color:#a94f24">Welcome to WildWorks</h1><p>Thank you for signing up for WildWorks updates. We will use this address only for the updates you selected.</p><p>To unsubscribe from email, <a href="mailto:Wildworks@pm.me?subject=Unsubscribe%20from%20WildWorks%20email">email WildWorks</a>. For help, call WildWorks at 1-877-600-2474.</p></div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function signupNotificationHtml(args: { channel: SignupChannel; email: string | null; phone: string | null; sourcePath: string }) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>New WildWorks signup</h2><p><strong>Selection:</strong> ${escapeHtml(args.channel)}</p><p><strong>Email:</strong> ${args.email ? escapeHtml(args.email) : "—"}</p><p><strong>Mobile:</strong> ${args.phone ? escapeHtml(args.phone) : "—"}</p><p><strong>Source:</strong> ${escapeHtml(args.sourcePath)}</p></div>`;
}

export async function POST(request: Request) {
  const originError = assertAllowedOrigin(request);
  if (originError) return originError;

  const rateLimitError = await checkRateLimit(request);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const channel = cleanText(body?.channel, 12) as SignupChannel;
    const honeypot = cleanText(body?.companyWebsite, 120);
    const sourcePath = cleanText(body?.sourcePath, 180) || "/";

    if (honeypot) return Response.json({ ok: true, message: "You’re signed up." });
    if (!CHANNELS.has(channel)) {
      return Response.json({ error: "Choose Email, SMS, or Both before joining the list." }, { status: 400 });
    }
    if (body?.consent !== true) {
      return Response.json({ error: "Please confirm that you agree to receive the updates you selected." }, { status: 400 });
    }

    const wants = requestedChannels(channel);
    const email = normalizeEmail(body?.email);
    const phone = normalizeUsPhone(body?.phone);
    if (wants.email && !email) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (wants.sms && !phone) {
      return Response.json({ error: "Enter a valid 10-digit US mobile number." }, { status: 400 });
    }

    if (!isSupabaseAdminConfigured()) {
      return Response.json({ error: "The signup record is not configured yet. Please contact WildWorks directly below." }, { status: 503 });
    }

    const id = crypto.randomUUID();
    const record = {
      id,
      email,
      phone_e164: phone,
      email_opt_in: wants.email,
      sms_opt_in: wants.sms,
      consent_version: SIGNUP_CONSENT_VERSION,
      consented_at: new Date().toISOString(),
      source_path: sourcePath,
      email_delivery_status: wants.email ? "pending" : "not_requested",
      sms_delivery_status: wants.sms ? "pending" : "not_requested",
    };
    const insertResult = await insertSignup(record);
    if (!insertResult.ok) {
      console.error("marketing signup persistence failed", insertResult.status);
      return Response.json({ error: "We could not save your signup. Please try again or contact WildWorks directly below." }, { status: 500 });
    }

    let resendMessageId: string | null = null;
    let twilioMessageId: string | null = null;
    let emailStatus = wants.email ? "pending" : "not_requested";
    let smsStatus = wants.sms ? "pending" : "not_requested";
    const deliveryErrors: string[] = [];

    if (wants.email && email && emailProviderReady()) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY!);
        const emailResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: email,
          subject: "You’re on the WildWorks list",
          html: emailHtml(),
        });
        if (emailResult.error) throw new Error("resend_email_failed");
        resendMessageId = emailResult.data?.id ?? null;
        emailStatus = "sent";

        const notifyAddress = process.env.WILDWORKS_SIGNUP_NOTIFY_EMAIL;
        if (notifyAddress) {
          const notification = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: notifyAddress,
            subject: "New WildWorks signup",
            html: signupNotificationHtml({ channel, email, phone, sourcePath }),
          });
          if (notification.error) console.error("marketing signup internal notification failed");
        }
      } catch {
        emailStatus = "failed";
        deliveryErrors.push("email_delivery_failed");
        console.error("marketing signup email delivery failed");
      }
    }

    if (wants.sms && phone && smsProviderReady()) {
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        const message = await client.messages.create({
          to: phone,
          body: "WildWorks: You’re signed up for the updates you selected. Reply STOP to opt out. Reply HELP for help.",
          ...(process.env.TWILIO_MESSAGING_SERVICE_SID
            ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
            : { from: process.env.TWILIO_FROM_NUMBER! }),
        });
        twilioMessageId = message.sid;
        smsStatus = "sent";
      } catch {
        smsStatus = "failed";
        deliveryErrors.push("sms_delivery_failed");
        console.error("marketing signup SMS delivery failed");
      }
    }

    await updateSignup(id, {
      email_delivery_status: emailStatus,
      sms_delivery_status: smsStatus,
      provider_message_ids: { resend: resendMessageId, twilio: twilioMessageId },
      delivery_error: deliveryErrors.length ? deliveryErrors.join(",") : null,
      delivered_at: emailStatus === "sent" || smsStatus === "sent" ? new Date().toISOString() : null,
    });

    const hasPendingDelivery = emailStatus === "pending" || smsStatus === "pending";
    const hasFailedDelivery = emailStatus === "failed" || smsStatus === "failed";
    return Response.json({
      ok: true,
      message: hasPendingDelivery || hasFailedDelivery
        ? "You're on the WildWorks list. We saved the contact information and choices you provided."
        : wants.email && wants.sms
          ? "You’re signed up. Check your inbox and phone for confirmation."
          : wants.sms
            ? "You’re signed up. Check your phone for confirmation."
            : "You’re signed up. Check your inbox for confirmation.",
    }, { status: hasPendingDelivery || hasFailedDelivery ? 202 : 200 });
  } catch {
    return Response.json({ error: "We could not complete your signup. Please try again or contact WildWorks directly below." }, { status: 500 });
  }
}
