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

function providerConfigurationError(needsEmail: boolean, needsSms: boolean): string | null {
  if (needsEmail && (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)) {
    return "Email signup is being connected right now. Please call, text, or email Scott directly below.";
  }
  if (
    needsSms &&
    (!process.env.TWILIO_ACCOUNT_SID ||
      !process.env.TWILIO_AUTH_TOKEN ||
      (!process.env.TWILIO_MESSAGING_SERVICE_SID && !process.env.TWILIO_FROM_NUMBER))
  ) {
    return "Text signup is being connected right now. Please call or text Scott directly below.";
  }
  return null;
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
  return `<div style="font-family:Georgia,serif;color:#4b230f;line-height:1.55"><h1 style="color:#a94f24">Welcome to WildWorks</h1><p>Thank you for signing up for WildWorks updates. We will use this address only for the updates you selected.</p><p>To unsubscribe from email, <a href="mailto:Wildworks@pm.me?subject=Unsubscribe%20from%20WildWorks%20email">email WildWorks</a>. For help, call or text Scott at +1 (443) 797-2166.</p></div>`;
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

    const configError = providerConfigurationError(wants.email, wants.sms);
    if (configError) return Response.json({ error: configError }, { status: 503 });
    if (!isSupabaseAdminConfigured()) {
      return Response.json({ error: "The signup record is not configured yet. Please contact Scott directly below." }, { status: 503 });
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
      return Response.json({ error: "We could not save your signup. Please try again or contact Scott directly below." }, { status: 500 });
    }

    let resendMessageId: string | null = null;
    let twilioMessageId: string | null = null;
    try {
      if (wants.email && email) {
        const resend = new Resend(process.env.RESEND_API_KEY!);
        const emailResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: email,
          subject: "You’re on the WildWorks list",
          html: emailHtml(),
        });
        if (emailResult.error) throw new Error("resend_email_failed");
        resendMessageId = emailResult.data?.id ?? null;

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
      }

      if (wants.sms && phone) {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        const message = await client.messages.create({
          to: phone,
          body: "WildWorks: You’re signed up for the updates you selected. Reply STOP to opt out. Reply HELP for help.",
          ...(process.env.TWILIO_MESSAGING_SERVICE_SID
            ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
            : { from: process.env.TWILIO_FROM_NUMBER! }),
        });
        twilioMessageId = message.sid;
      }
    } catch (error) {
      await updateSignup(id, {
        email_delivery_status: wants.email ? "failed" : "not_requested",
        sms_delivery_status: wants.sms ? "failed" : "not_requested",
        delivery_error: error instanceof Error ? truncateUtf8String(error.message, 180) : "provider_delivery_failed",
      });
      console.error("marketing signup provider delivery failed");
      return Response.json({ error: "We could not send your confirmation. Please try again or contact Scott directly below." }, { status: 502 });
    }

    await updateSignup(id, {
      email_delivery_status: wants.email ? "sent" : "not_requested",
      sms_delivery_status: wants.sms ? "sent" : "not_requested",
      provider_message_ids: { resend: resendMessageId, twilio: twilioMessageId },
      delivered_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      message: wants.email && wants.sms
        ? "You’re signed up. Check your inbox and phone for confirmation."
        : wants.sms
          ? "You’re signed up. Check your phone for confirmation."
          : "You’re signed up. Check your inbox for confirmation.",
    });
  } catch {
    return Response.json({ error: "We could not complete your signup. Please try again or contact Scott directly below." }, { status: 500 });
  }
}
