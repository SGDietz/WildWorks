export type HealthNotice = { fingerprint: string; at: string; healthy: boolean };

/** Survives server restarts via the health observation stored in app_events. */
export function nextHealthNotice(args: {
  findings: string[]; daily: boolean; previous: HealthNotice | null; now: number;
}): HealthNotice | null {
  const healthy = args.findings.length === 0;
  const fingerprint = JSON.stringify([...args.findings].sort());
  const previous = args.previous;
  const elapsed = previous ? args.now - Date.parse(previous.at) : Infinity;
  const changed = previous?.fingerprint !== fingerprint;
  if (healthy) return null;
  if (!changed && elapsed < 24 * 60 * 60_000) {
    return null;
  }
  return { fingerprint, at: new Date(args.now).toISOString(), healthy };
}
