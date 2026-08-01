const DEFAULT_VOICE_BACKEND_TIMEOUT_MS = 2_500;

export function voiceBackendTimeoutMs(
  fallback = DEFAULT_VOICE_BACKEND_TIMEOUT_MS,
): number {
  const configured = Number(process.env.WILDWORKS_VOICE_BACKEND_TIMEOUT_MS);
  return Number.isFinite(configured)
    ? Math.min(10_000, Math.max(100, Math.floor(configured)))
    : fallback;
}

export function voiceBackendSignal(fallback?: number): AbortSignal {
  return AbortSignal.timeout(voiceBackendTimeoutMs(fallback));
}
