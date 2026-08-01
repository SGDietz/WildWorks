import { createServer, type IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { loadConfig } from "./config.ts";
import { ConversationSession } from "./core.ts";
import { SerializedInboundFrames } from "./inbound-frames.ts";
import { DailyBudget, SupabaseDailyBudget, type UsageBudget } from "./limits.ts";
import { logger } from "./logger.ts";
import { OpenAiCompatibleClient } from "./llm.ts";
import { loadPhonePersona } from "./persona.ts";
import { canonicalRequestUrl, verifyTwilioSignature } from "./security.ts";
import { GracefulCallDrain, type DrainingCall } from "./shutdown.ts";
import { HmacRuntimeEventPublisher } from "./runtime-events.ts";
import { VoiceMaintenanceScheduler } from "./maintenance.ts";
import type { OutboundSink } from "./types.ts";

const config = loadConfig();
const systemMessage = loadPhonePersona();
const budget: UsageBudget =
  config.budgetBackend === "supabase"
    ? new SupabaseDailyBudget({
        maxCalls: config.dailyMaxCalls,
        maxPrompts: config.dailyMaxPrompts,
        maxOutputChars: config.dailyMaxOutputChars,
        supabaseUrl: config.supabaseUrl,
        serviceRoleKey: config.supabaseServiceRoleKey,
        rpcName: config.supabaseBudgetRpc,
        timeoutMs: config.budgetTimeoutMs,
      })
    : new DailyBudget({
        maxCalls: config.dailyMaxCalls,
        maxPrompts: config.dailyMaxPrompts,
        maxOutputChars: config.dailyMaxOutputChars,
      });
const llm = config.aiEnabled
  ? new OpenAiCompatibleClient({
      endpointUrl: config.llmEndpointUrl,
      apiKey: config.llmApiKey,
      model: config.llmModel,
      timeoutMs: config.llmTimeoutMs,
    })
  : undefined;
const eventPublisher = config.voiceEventUrl
  ? new HmacRuntimeEventPublisher({
      endpointUrl: config.voiceEventUrl,
      secret: config.voiceEventSecret,
      timeoutMs: config.voiceEventTimeoutMs,
      maxAttempts: config.voiceEventMaxAttempts,
      retryBaseMs: config.voiceEventRetryBaseMs,
      logger,
    })
  : undefined;
const drain = new GracefulCallDrain();
const maintenance = config.voiceMaintenanceUrl && config.voiceCronSecret
  ? new VoiceMaintenanceScheduler({
      endpointUrl: config.voiceMaintenanceUrl,
      secret: config.voiceCronSecret,
      timeoutMs: config.voiceMaintenanceTimeoutMs,
      intervalMs: config.voiceMaintenanceIntervalMs,
      logger,
    })
  : undefined;

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    if (!drain.isAccepting()) {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, acceptingCalls: false }));
      return;
    }
    void Promise.all([
      budget.healthCheck(),
      ...(eventPublisher ? [eventPublisher.healthCheck()] : []),
    ]).then(
      () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true, acceptingCalls: true }));
      },
      () => {
        logger.error("dependency_healthcheck_failed");
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: false, acceptingCalls: false }));
      },
    );
    return;
  }
  response.writeHead(404).end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 65_536 });
let shutdownPromise: Promise<void> | undefined;

function rejectUpgrade(socket: import("node:stream").Duplex, status: number): void {
  socket.write(
    `HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : "Service Unavailable"}\r\nConnection: close\r\n\r\n`,
  );
  socket.destroy();
}

server.on("upgrade", (request: IncomingMessage, socket, head) => {
  if (!drain.isAccepting() || !request.url) {
    rejectUpgrade(socket, 503);
    return;
  }
  const signatureHeader = request.headers["x-twilio-signature"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const requestUrl = canonicalRequestUrl(request.url, config.publicWssUrl);
  if (
    !verifyTwilioSignature({
      canonicalUrl: config.publicWssUrl,
      requestUrl,
      signature,
      authToken: config.twilioAuthToken,
    })
  ) {
    logger.warn("upgrade_rejected");
    rejectUpgrade(socket, 401);
    return;
  }
  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit("connection", websocket, request);
  });
});

wss.on("connection", (websocket) => {
  const sink: OutboundSink = {
    send: (message) => {
      if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify(message));
    },
    close: (code = 1000, reason = "complete") => websocket.close(code, reason),
  };
  const session = new ConversationSession({
    config,
    sink,
    budget,
    logger,
    systemMessage,
    ...(llm ? { llm } : {}),
    ...(eventPublisher ? { eventPublisher } : {}),
  });
  const call: DrainingCall = {
    handoffToBusinessVoicemail: () => session.handoffToBusinessVoicemail("service_shutdown"),
    closeTransport: () => websocket.terminate(),
  };

  if (!drain.register(call)) {
    session.handoffToBusinessVoicemail("service_shutdown");
    setTimeout(() => websocket.terminate(), config.shutdownHandoffGraceMs).unref();
    return;
  }

  const inbound = new SerializedInboundFrames((raw) => session.handleRaw(raw));
  const closeSession = (): void => {
    inbound.close();
    session.close();
    drain.unregister(call);
  };

  websocket.on("message", (data, isBinary) => {
    if (isBinary) {
      sink.close(1003, "text_frames_only");
      return;
    }
    void inbound.enqueue(data.toString("utf8")).catch(() => {
      inbound.close();
      logger.error("inbound_frame_failed");
      session.handoffToBusinessVoicemail("inbound_frame_failed");
    });
  });
  websocket.on("close", closeSession);
  websocket.on("error", () => {
    logger.warn("websocket_error");
    closeSession();
  });
});

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function closeWebSocketServer(): Promise<void> {
  return new Promise((resolve) => wss.close(() => resolve()));
}

async function shutdown(signal: string): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    drain.stopAccepting();
    maintenance?.stop();
    logger.info("shutdown_started", { activeCalls: drain.activeCount(), signal });
    const httpClosed = closeHttpServer();
    await drain.drain({
      maxDrainMs: config.callMaxSeconds * 1_000,
      handoffGraceMs: config.shutdownHandoffGraceMs,
    });
    await httpClosed;
    await closeWebSocketServer();
    logger.info("shutdown_complete");
  })();
  return shutdownPromise;
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
server.listen(config.port, config.host, () => {
  maintenance?.start();
  logger.info("service_listening", {
    aiEnabled: config.aiEnabled,
    budgetBackend: config.budgetBackend,
    port: config.port,
  });
});
