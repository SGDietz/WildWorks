export function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string },
  context: { routeType: string; renderSource?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { queueUnhandledServerAlert } = await import("./src/lib/wildworksOperationalAlerts");
  const digest = error && typeof error === "object" && "digest" in error
    ? String((error as { digest?: unknown }).digest ?? "")
    : undefined;
  queueUnhandledServerAlert({
    error,
    route: request.path,
    component: `Next ${context.routeType}${context.renderSource ? `/${context.renderSource}` : ""}`,
    correlationSource: digest,
  });
}
