import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECURE_TAILNET_HOST =
  process.env.WILDWORKS_SECURE_TAILNET_HOST?.trim().toLowerCase() ?? "";
const TAILNET_IP = process.env.WILDWORKS_TAILNET_IP?.trim() ?? "";

function hostnameFromHostHeader(host: string | null): string {
  if (!host) return "";
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function shouldRedirectToSecureTailnet(request: NextRequest): boolean {
  const hostname = hostnameFromHostHeader(request.headers.get("host"));
  const isTailnetDoor = Boolean(SECURE_TAILNET_HOST)
    && (hostname === SECURE_TAILNET_HOST || (Boolean(TAILNET_IP) && hostname === TAILNET_IP));
  return isTailnetDoor && request.headers.get("x-forwarded-proto") !== "https";
}

export function middleware(request: NextRequest) {
  if (!shouldRedirectToSecureTailnet(request)) return NextResponse.next();

  const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${SECURE_TAILNET_HOST}`);
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
