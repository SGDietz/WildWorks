export interface DrainingCall {
  handoffToBusinessVoicemail(reason: "service_shutdown"): void;
  closeTransport(): void;
}

export interface DrainOptions {
  maxDrainMs: number;
  handoffGraceMs: number;
}

/** Coordinates Render SIGTERM draining without exposing any telephone target. */
export class GracefulCallDrain {
  private accepting = true;
  private readonly calls = new Set<DrainingCall>();
  private emptyWaiters = new Set<() => void>();

  isAccepting(): boolean {
    return this.accepting;
  }

  activeCount(): number {
    return this.calls.size;
  }

  register(call: DrainingCall): boolean {
    if (!this.accepting) return false;
    this.calls.add(call);
    return true;
  }

  unregister(call: DrainingCall): void {
    this.calls.delete(call);
    if (this.calls.size === 0) {
      for (const resolve of this.emptyWaiters) resolve();
      this.emptyWaiters.clear();
    }
  }

  stopAccepting(): void {
    this.accepting = false;
  }

  async drain(options: DrainOptions): Promise<void> {
    this.stopAccepting();
    if (this.calls.size === 0) return;

    await this.waitForEmpty(options.maxDrainMs);
    if (this.calls.size === 0) return;

    for (const call of [...this.calls]) {
      call.handoffToBusinessVoicemail("service_shutdown");
    }
    await this.waitForEmpty(options.handoffGraceMs);
    for (const call of [...this.calls]) call.closeTransport();
  }

  private async waitForEmpty(timeoutMs: number): Promise<void> {
    if (this.calls.size === 0) return;
    let resolveEmpty: (() => void) | undefined;
    const empty = new Promise<void>((resolve) => {
      resolveEmpty = resolve;
      this.emptyWaiters.add(resolve);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
      timer.unref?.();
    });
    await Promise.race([empty, timeout]);
    if (timer) clearTimeout(timer);
    if (resolveEmpty) this.emptyWaiters.delete(resolveEmpty);
  }
}
