import { assertAllowedOrigin, truncateUtf8String } from "../../../../src/lib/apiRouteSecurity";
import { logIScottOriginRejection } from "../../../../src/lib/iscottOriginTelemetry";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { logServerTelemetryEvent } from "../../../../src/lib/serverTelemetryCapture";
import { getSupabaseAdminConfig, isSupabaseAdminConfigured } from "../../../../src/lib/supabaseAdmin";

const INTAKE_MEDIA_BUCKET = process.env.SUPABASE_INTAKE_MEDIA_BUCKET || "wildworks-intake-media";
const MAX_MEDIA_BYTES = Number(process.env.WILDWORKS_MAX_MEDIA_BYTES || 50 * 1024 * 1024);

// 2026-08-24. Was `media.type.startsWith("image/")`, which trusts a label the
// browser supplies and happily accepts image/svg+xml - an SVG is a document that
// can carry script, not a picture. Explicit list, and svg is not on it.
const ALLOWED_MEDIA_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
] as const;

/** Does the file actually START like the type it claims to be? */
function looksLikeDeclaredType(bytes: Uint8Array, mime: string): boolean {
  const at = (i: number) => bytes[i] ?? -1;
  const ascii = (off: number, text: string) =>
    [...text].every((ch, i) => at(off + i) === ch.charCodeAt(0));
  switch (mime) {
    case "image/jpeg":
      return at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
    case "image/png":
      return at(0) === 0x89 && ascii(1, "PNG");
    case "image/gif":
      return ascii(0, "GIF8");
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "video/mp4":
    case "video/quicktime":
      return ascii(4, "ftyp");
    case "video/webm":
      return at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3;
    default:
      return false;
  }
}

export const dynamic = "force-dynamic";

function cleanText(value: FormDataEntryValue | null, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}

function safePathSegment(value: string | null | undefined, fallback: string) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function supabaseHeaders(serviceRoleKey: string, contentType = "application/json") {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": contentType,
  };
}

async function ensurePrivateMediaBucket(url: string, serviceRoleKey: string) {
  const existing = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(INTAKE_MEDIA_BUCKET)}`, {
    method: "GET",
    headers: supabaseHeaders(serviceRoleKey),
    cache: "no-store",
  });
  if (existing.ok) return;
  const existingDetail = await existing.text().catch(() => "");
  const bucketMissing =
    existing.status === 404 ||
    (existing.status === 400 && /(?:bucket not found|\"statusCode\"\s*:\s*\"?404\"?)/i.test(existingDetail));
  if (!bucketMissing) {
    throw new Error(`Supabase media bucket check failed (${existing.status})`);
  }

  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify({
      id: INTAKE_MEDIA_BUCKET,
      name: INTAKE_MEDIA_BUCKET,
      public: false,
      file_size_limit: MAX_MEDIA_BYTES,
      allowed_mime_types: ALLOWED_MEDIA_TYPES,
    }),
  });
  if (!created.ok && created.status !== 409) {
    throw new Error(`Supabase media bucket creation failed (${created.status})`);
  }
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request, {
    trustedSameOriginMarker: {
      name: "x-wildworks-avatar-request",
      value: "same-origin-v1",
    },
  });
  if (originErr) {
    await logIScottOriginRejection(request, "/api/media/capture").catch(() => undefined);
    return originErr;
  }
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    if (!isSupabaseAdminConfigured()) {
      await logServerTelemetryEvent({ request, eventType: "supabase_configuration_failed", severity: "critical", provider: "supabase", route: "/api/media/capture", statusCode: 503 });
      return Response.json({ error: "Supabase media storage is not configured." }, { status: 503 });
    }

    // Check the declared length BEFORE parsing. formData() buffers the whole
    // upload, so the old order read a 2 GB body and only then said it was too big.
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_BYTES) {
      return Response.json(
        { error: `That file is larger than the ${Math.floor(MAX_MEDIA_BYTES / 1024 / 1024)} MB upload limit.` },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const media = formData.get("media");
    if (!(media instanceof File)) {
      return Response.json({ error: "A photo or video file is required." }, { status: 400 });
    }
    if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(media.type)) {
      return Response.json({ error: "Only photo and video files are accepted." }, { status: 415 });
    }
    if (media.size <= 0 || media.size > MAX_MEDIA_BYTES) {
      return Response.json(
        { error: `That file is larger than the ${Math.floor(MAX_MEDIA_BYTES / 1024 / 1024)} MB upload limit.` },
        { status: 413 },
      );
    }

    const anonymousVisitorId = cleanText(formData.get("anonymousVisitorId"), 160);
    const clientSessionId = cleanText(formData.get("clientSessionId"), 160);
    const liveAvatarSessionId = cleanText(formData.get("liveAvatarSessionId"), 160);
    const uploadId = cleanText(formData.get("uploadId"), 160) || crypto.randomUUID();
    const route = cleanText(formData.get("route"), 220);
    const viewport = cleanText(formData.get("viewport"), 40);
    const now = new Date();
    const originalName = media.name || (media.type.startsWith("video/") ? "video" : "photo");
    const objectPath = [
      "intake",
      now.toISOString().slice(0, 10),
      safePathSegment(anonymousVisitorId, "anonymous"),
      safePathSegment(clientSessionId, "no-client-session"),
      `${now.getTime()}-${safePathSegment(uploadId, crypto.randomUUID())}-${safePathSegment(originalName, "media")}`,
    ].join("/");

    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    await ensurePrivateMediaBucket(url, serviceRoleKey);
    const bytes = await media.arrayBuffer();

    // Last word on what this file is: its own first bytes, not its label.
    if (!looksLikeDeclaredType(new Uint8Array(bytes.slice(0, 16)), media.type)) {
      return Response.json(
        { error: "That file does not look like the kind of file it says it is." },
        { status: 415 },
      );
    }
    const uploadResponse = await fetch(
      `${url}/storage/v1/object/${encodeURIComponent(INTAKE_MEDIA_BUCKET)}/${objectPath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      {
        method: "POST",
        headers: {
          ...supabaseHeaders(serviceRoleKey, media.type || "application/octet-stream"),
          "x-upsert": "false",
        },
        body: bytes,
      },
    );
    if (!uploadResponse.ok) {
      const detail = truncateUtf8String(await uploadResponse.text().catch(() => ""), 1200);
      await logServerTelemetryEvent({
        request,
        eventType: "iscott_media_store_failed",
        severity: "high",
        provider: "supabase",
        sessionId: liveAvatarSessionId || clientSessionId,
        anonymousVisitorId,
        route,
        statusCode: uploadResponse.status,
        payload: { originalName, mimeType: media.type, sizeBytes: media.size, detail },
      });
      return Response.json({ error: "iScott could not save that media right now." }, { status: 502 });
    }

    const metadata = {
      capturedAt: now.toISOString(),
      bucket: INTAKE_MEDIA_BUCKET,
      objectPath,
      uploadId,
      originalName,
      mimeType: media.type,
      sizeBytes: media.size,
      anonymousVisitorId,
      clientSessionId,
      liveAvatarSessionId,
      route,
      viewport,
    };
    const metadataResponse = await fetch(
      `${url}/storage/v1/object/${encodeURIComponent(INTAKE_MEDIA_BUCKET)}/${objectPath
        .split("/")
        .map(encodeURIComponent)
        .join("/")}.metadata.json`,
      {
        method: "POST",
        headers: {
          ...supabaseHeaders(serviceRoleKey),
          "x-upsert": "false",
        },
        body: JSON.stringify(metadata),
      },
    );

    const mediaRowResponse = metadataResponse.ok
      ? await fetch(`${url}/rest/v1/iscott_media?on_conflict=upload_id`, {
          method: "POST",
          headers: {
            ...supabaseHeaders(serviceRoleKey),
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify([{
            session_id: liveAvatarSessionId || null,
            anonymous_visitor_id: anonymousVisitorId,
            client_session_id: clientSessionId,
            upload_id: uploadId,
            bucket: INTAKE_MEDIA_BUCKET,
            object_path: objectPath,
            original_name: originalName,
            mime_type: media.type || "application/octet-stream",
            size_bytes: media.size,
            source_route: route,
            viewport,
            metadata,
          }]),
        })
      : null;

    const mediaRecordSaved = Boolean(mediaRowResponse?.ok);

    await logServerTelemetryEvent({
      request,
      eventType: metadataResponse.ok && mediaRecordSaved ? "iscott_media_saved" : "iscott_media_metadata_failed",
      severity: metadataResponse.ok && mediaRecordSaved ? "low" : "high",
      provider: "supabase",
      sessionId: liveAvatarSessionId || clientSessionId,
      anonymousVisitorId,
      route,
      statusCode: metadataResponse.ok && mediaRecordSaved
        ? 201
        : mediaRowResponse?.status ?? metadataResponse.status,
      userVisibleState: metadataResponse.ok && mediaRecordSaved ? "saved" : "file_saved_metadata_failed",
      payload: {
        ...metadata,
        storageMetadataSaved: metadataResponse.ok,
        mediaRecordSaved,
      },
    });

    if (!metadataResponse.ok || !mediaRecordSaved) {
      return Response.json(
        { error: "The media file was saved, but its intake record could not be completed." },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      fileName: originalName,
      mediaType: media.type.startsWith("video/") ? "video" : "photo",
      sizeBytes: media.size,
      uploadId,
    });
  } catch (error) {
    console.error("Error saving iScott media:", error instanceof Error ? error.message : "unknown error");
    await logServerTelemetryEvent({
      request,
      eventType: "iscott_media_capture_exception",
      severity: "high",
      provider: "supabase",
      route: "/api/media/capture",
      statusCode: 502,
    });
    return Response.json(
      { error: "iScott could not save that media right now." },
      { status: 502 },
    );
  }
}
