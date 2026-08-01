export type EmailNotificationKind =
  | "ai_failure_routed_to_voicemail"
  | "voicemail_ready"
  | "voicemail_failed";

export interface EmailNotificationEvent {
  kind: EmailNotificationKind;
  occurredAt: string;
  reason:
    | "ai_disabled"
    | "ai_error"
    | "ai_limit"
    | "ai_timeout"
    | "caller_choice"
    | "caller_requested_person"
    | "invalid_menu_input"
    | "menu_timeout"
    | "recording_failed"
    | "voicemail_recorded";
  /** Opaque provider reference only. Never include caller data or transcript text. */
  voicemailReference?: string;
}

/**
 * Provider-neutral seam. The scaffold intentionally supplies no implementation,
 * recipient, credentials, or external network call.
 */
export interface EmailNotificationPublisher {
  publish(event: EmailNotificationEvent): Promise<void>;
}
