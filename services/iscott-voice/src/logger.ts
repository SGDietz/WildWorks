import type { SafeLogFields, SafeLogger } from "./types.ts";

function write(level: string, event: string, fields: SafeLogFields = {}): void {
  // Only callers supplying allow-listed, non-content metadata should use fields.
  process.stdout.write(`${JSON.stringify({ level, event, ...fields })}\n`);
}

export const logger: SafeLogger = {
  info: (event, fields) => write("info", event, fields),
  warn: (event, fields) => write("warn", event, fields),
  error: (event, fields) => write("error", event, fields),
};
