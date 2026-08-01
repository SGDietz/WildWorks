import type { EmailNotificationEvent } from "./notifications.ts";

export const CONSENT_MENU_PROMPT =
  "iScott is WildWorks' AI assistant, not the real Scott. If you continue, your conversation will be transcribed and may be stored by WildWorks to understand your inquiry and follow up. Do not share sensitive personal, legal, medical, financial, or child information. Press 1 to consent and talk to iScott. Press 2 to leave a recorded WildWorks voicemail.";

export type CallFlowState =
  | "new"
  | "awaiting_consent"
  | "ai_active"
  | "voicemail_active"
  | "complete";

export type VoicemailReason =
  | "ai_disabled"
  | "ai_error"
  | "ai_limit"
  | "ai_timeout"
  | "caller_choice"
  | "caller_requested_person"
  | "invalid_menu_input"
  | "menu_timeout";

export type CallFlowEvent =
  | { type: "call_started" }
  | { type: "dtmf"; digit: string }
  | { type: "menu_timeout" }
  | {
      type: "ai_failed";
      reason: "ai_error" | "ai_limit" | "ai_timeout" | "caller_requested_person";
    }
  | { type: "ai_completed" }
  | { type: "voicemail_recorded"; voicemailReference: string }
  | { type: "voicemail_failed" };

export type CallFlowAction =
  | { type: "play_consent_menu"; prompt: string }
  | { type: "start_ai" }
  | { type: "start_voicemail"; reason: VoicemailReason }
  | { type: "request_email_notification"; event: EmailNotificationEvent }
  | { type: "end_call" };

export interface CallFlowOptions {
  aiEnabled: boolean;
  maxMenuAttempts?: number;
  now?: () => Date;
}

export class CallFlowController {
  private readonly aiEnabled: boolean;
  private readonly maxMenuAttempts: number;
  private readonly now: () => Date;
  private state: CallFlowState = "new";
  private menuAttempts = 0;

  constructor(options: CallFlowOptions) {
    this.aiEnabled = options.aiEnabled;
    this.maxMenuAttempts = options.maxMenuAttempts ?? 2;
    this.now = options.now ?? (() => new Date());
    if (!Number.isSafeInteger(this.maxMenuAttempts) || this.maxMenuAttempts < 1) {
      throw new Error("Invalid maxMenuAttempts");
    }
  }

  currentState(): CallFlowState {
    return this.state;
  }

  dispatch(event: CallFlowEvent): CallFlowAction[] {
    if (this.state === "new") {
      if (event.type !== "call_started") return [];
      this.state = "awaiting_consent";
      return [{ type: "play_consent_menu", prompt: CONSENT_MENU_PROMPT }];
    }

    if (this.state === "awaiting_consent") {
      if (event.type === "menu_timeout") return this.startVoicemail("menu_timeout");
      if (event.type !== "dtmf") return [];
      if (event.digit === "1") {
        if (!this.aiEnabled) {
          return this.startVoicemail("ai_disabled", true);
        }
        this.state = "ai_active";
        return [{ type: "start_ai" }];
      }
      if (event.digit === "2") return this.startVoicemail("caller_choice");

      this.menuAttempts += 1;
      if (this.menuAttempts >= this.maxMenuAttempts) {
        return this.startVoicemail("invalid_menu_input");
      }
      return [{ type: "play_consent_menu", prompt: CONSENT_MENU_PROMPT }];
    }

    if (this.state === "ai_active") {
      if (event.type === "ai_failed") {
        return this.startVoicemail(event.reason, true);
      }
      if (event.type === "ai_completed") {
        this.state = "complete";
        return [{ type: "end_call" }];
      }
      return [];
    }

    if (this.state === "voicemail_active") {
      if (event.type === "voicemail_recorded") {
        const reference = event.voicemailReference.trim();
        if (!reference || reference.length > 200) {
          return this.finishWithVoicemailFailure();
        }
        this.state = "complete";
        return [
          {
            type: "request_email_notification",
            event: {
              kind: "voicemail_ready",
              occurredAt: this.now().toISOString(),
              reason: "voicemail_recorded",
              voicemailReference: reference,
            },
          },
          { type: "end_call" },
        ];
      }
      if (event.type === "voicemail_failed") return this.finishWithVoicemailFailure();
    }

    return [];
  }

  private startVoicemail(reason: VoicemailReason, notifyAiFailure = false): CallFlowAction[] {
    this.state = "voicemail_active";
    const actions: CallFlowAction[] = [{ type: "start_voicemail", reason }];
    if (notifyAiFailure) {
      actions.push({
        type: "request_email_notification",
        event: {
          kind: "ai_failure_routed_to_voicemail",
          occurredAt: this.now().toISOString(),
          reason,
        },
      });
    }
    return actions;
  }

  private finishWithVoicemailFailure(): CallFlowAction[] {
    this.state = "complete";
    return [
      {
        type: "request_email_notification",
        event: {
          kind: "voicemail_failed",
          occurredAt: this.now().toISOString(),
          reason: "recording_failed",
        },
      },
      { type: "end_call" },
    ];
  }
}
