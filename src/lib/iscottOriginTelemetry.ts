import { logServerTelemetryEvent } from "./serverTelemetryCapture";
import {
  WILDWORKS_AVATAR_REQUEST_HEADER,
  WILDWORKS_AVATAR_REQUEST_VALUE,
} from "./apiRouteSecurity";

export async function logIScottOriginRejection(request: Request, route: string): Promise<void> {
  const origin = request.headers.get("origin");
  await logServerTelemetryEvent({
    request,
    eventType: "liveavatar_origin_rejected",
    severity: "high",
    provider: "liveavatar",
    route,
    statusCode: 403,
    payload: {
      origin,
      host: request.headers.get("host"),
      xForwardedProto: request.headers.get("x-forwarded-proto"),
      originState: origin === null ? "missing" : origin === "null" ? "opaque" : "present",
      refererPresent: request.headers.has("referer"),
      fetchSite: request.headers.get("sec-fetch-site") || "missing",
      avatarMarkerPresent:
        request.headers.get(WILDWORKS_AVATAR_REQUEST_HEADER) === WILDWORKS_AVATAR_REQUEST_VALUE,
    },
  });
}
