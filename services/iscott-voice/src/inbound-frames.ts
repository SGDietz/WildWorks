export type InboundFrameHandler = (raw: string) => Promise<void>;

function frameType(raw: string): string | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("type" in value)) return undefined;
    const type = (value as { type?: unknown }).type;
    return typeof type === "string" ? type : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Holds every post-connect frame behind completion of the first (required
 * setup) frame. Prompts then run in arrival order, while interrupts and relay
 * errors can abort an active prompt after setup has finished.
 */
export class SerializedInboundFrames {
  private readonly handle: InboundFrameHandler;
  private open = true;
  private first = true;
  private setupBarrier: Promise<void> = Promise.resolve();
  private promptTail: Promise<void> = Promise.resolve();

  constructor(handle: InboundFrameHandler) {
    this.handle = handle;
  }

  enqueue(raw: string): Promise<void> {
    if (!this.open) return Promise.resolve();

    if (this.first) {
      this.first = false;
      const firstTask = this.runIfOpen(raw);
      this.setupBarrier = firstTask.then(
        () => undefined,
        () => this.close(),
      );
      return firstTask;
    }

    if (frameType(raw) === "prompt") {
      const promptTask = this.promptTail
        .then(() => this.setupBarrier)
        .then(() => this.runIfOpen(raw));
      this.promptTail = promptTask.then(
        () => undefined,
        () => this.close(),
      );
      return promptTask;
    }

    const task = this.setupBarrier.then(() => this.runIfOpen(raw));
    void task.catch(() => this.close());
    return task;
  }

  close(): void {
    this.open = false;
  }

  private async runIfOpen(raw: string): Promise<void> {
    if (!this.open) return;
    await this.handle(raw);
  }
}
