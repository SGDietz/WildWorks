import type { SafeLogger } from "./types.ts";

export interface VoiceMaintenanceOptions {
  endpointUrl: string;
  secret: string;
  timeoutMs: number;
  intervalMs: number;
  logger: SafeLogger;
  fetchImpl?: typeof fetch;
  random?: () => number;
  initialDelayMs?: number;
}

export async function runVoiceMaintenanceOnce(
  options: Pick<VoiceMaintenanceOptions, "endpointUrl" | "secret" | "timeoutMs"> & {
    fetchImpl?: typeof fetch;
  },
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)(options.endpointUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${options.secret}` },
      redirect: "error",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs one maintenance request at a time. The next timer is created only after
 * the current request settles, so a slow endpoint cannot create overlaps.
 */
export class VoiceMaintenanceScheduler {
  private readonly options: VoiceMaintenanceOptions;
  private readonly random: () => number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private failures = 0;

  constructor(options: VoiceMaintenanceOptions) {
    this.options = options;
    this.random = options.random ?? Math.random;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(this.options.initialDelayMs ?? 1_000);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    const jitter = 0.9 + Math.min(1, Math.max(0, this.random())) * 0.2;
    this.timer = setTimeout(() => void this.tick(), Math.round(delayMs * jitter));
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    if (this.stopped) return;
    const ok = await runVoiceMaintenanceOnce(this.options);
    if (this.stopped) return;
    if (ok) {
      if (this.failures > 0) this.options.logger.info("voice_maintenance_recovered");
      this.failures = 0;
      this.schedule(this.options.intervalMs);
      return;
    }

    this.failures = Math.min(this.failures + 1, 8);
    this.options.logger.warn("voice_maintenance_failed", { failures: this.failures });
    const backoffMs = Math.min(
      this.options.intervalMs,
      30_000 * 2 ** (this.failures - 1),
    );
    this.schedule(backoffMs);
  }
}
