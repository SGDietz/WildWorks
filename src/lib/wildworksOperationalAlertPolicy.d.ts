export type OperationalAlert = {
  category: string;
  component: string;
  route: string;
  correlationId: string;
  summary: string;
};
export function compactSafeText(value: unknown, max?: number): string;
export function safeRoute(value: unknown): string;
export function correlationId(value: unknown): string;
export function classifyOperationalTelemetryEvent(args: Record<string, unknown>): OperationalAlert | null;
export function formatOperationalAlert(args: OperationalAlert, timestamp?: string): string;
export function classifySupabaseOperationalFailure(args: Record<string, unknown>): OperationalAlert;
