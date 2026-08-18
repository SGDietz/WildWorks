import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { notifyFirstPublicMessageByEmail } from "../src/lib/voiceEmailNotifications";

loadEnvConfig(process.cwd());

const smokeMode = process.env.WILDWORKS_RUN_VIP_ISCOTT_SMOKE;
if (smokeMode !== "VERIFY" && smokeMode !== "SEND") {
  throw new Error("Refusing to run: set WILDWORKS_RUN_VIP_ISCOTT_SMOKE=VERIFY or SEND.");
}

const configuredRecipient =
  process.env.WILDWORKS_LEAD_NOTIFY_EMAIL ||
  process.env.WILDWORKS_VOICE_NOTIFY_EMAIL ||
  process.env.WILDWORKS_SIGNUP_NOTIFY_EMAIL ||
  "Scott@WildWorks.ai";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredRecipient)) {
  throw new Error("Refusing to send: the configured owner recipient is invalid.");
}
if (smokeMode === "VERIFY") {
  console.log(JSON.stringify({ testOnly: true, configuredOwnerRecipientValid: true, readyToSend: false }));
  process.exit(0);
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to send from a production environment.");
}

async function main() {
  const testId = `vip-iscott-smoke-${randomUUID()}`;
  const result = await notifyFirstPublicMessageByEmail({
    sessionId: `test-${randomUUID()}`,
    message: "TEST ONLY: I am considering landscaping and a website refresh.",
    route: "/_controlled-vip-iscott-smoke",
    receivedAt: new Date(),
    testOnly: true,
    testId,
    metadata: { controlledSmoke: true },
  });

  console.log(JSON.stringify({
    testOnly: true,
    outboxStatus: result.outboxStatus,
    queued: result.queued,
    delivered: result.delivered,
    deduplicated: result.deduplicated,
    detail: result.detail,
  }));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "VIP iScott smoke failed.");
  process.exitCode = 1;
});
