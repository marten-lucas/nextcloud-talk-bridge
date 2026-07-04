import express, { Request, Response } from "express";
import { config } from "./config.js";
import { enqueueIronclawMessage, waitForIronclawResponse } from "./ironclaw.js";
import {
  backendAllowed,
  extractTalkToken,
  extractTopicMarker,
  isBotAuthored,
  isMentionForBot,
  parseMessageContent,
  parseTalkEvent,
  sendBotMessage,
  stripMention,
  verifyIncomingSignature
} from "./nextcloud.js";
import { MappingStore } from "./store.js";
import { TalkEvent } from "./types.js";

const app = express();
const store = new MappingStore(config.dataDir);

app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "nextcloud-talk-bridge" });
});

app.post(
  "/nextcloud/talk/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response) => {
    try {
      const signature = String(req.header("X-Nextcloud-Talk-Signature") ?? "").trim();
      const random = String(req.header("X-Nextcloud-Talk-Random") ?? "").trim();
      const backend = req.header("X-Nextcloud-Talk-Backend") ?? undefined;

      if (!signature || !random) {
        res.status(401).json({ ok: false, error: "Missing signature headers" });
        return;
      }
      if (!backendAllowed(backend)) {
        res.status(401).json({ ok: false, error: "Backend origin not allowed" });
        return;
      }

      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("", "utf8");
      if (!verifyIncomingSignature(rawBody, random, signature)) {
        res.status(401).json({ ok: false, error: "Invalid signature" });
        return;
      }

      const parsedJson = JSON.parse(rawBody.toString("utf8"));
      const event = parseTalkEvent(parsedJson);
      if (!event) {
        res.status(400).json({ ok: false, error: "Invalid event payload" });
        return;
      }

      const token = extractTalkToken(event);
      if (!token) {
        res.status(202).json({ ok: true, ignored: "Event without room token" });
        return;
      }

      if (event.type === "Join") {
        await handleJoin(event, token);
        res.status(200).json({ ok: true, handled: "join" });
        return;
      }

      if (event.type !== "Create") {
        res.status(202).json({ ok: true, ignored: `Unsupported event type: ${event.type}` });
        return;
      }

      setImmediate(() => {
        void handleCreate(event, token).catch((error: unknown) => {
          console.error("create_event_failed", error);
        });
      });

      res.status(200).json({ ok: true, queued: "create" });
    } catch (error) {
      console.error("webhook_handler_failed", error);
      res.status(500).json({ ok: false, error: "Internal error" });
    }
  }
);

async function handleJoin(event: TalkEvent, roomToken: string): Promise<void> {
  const mapping = await store.ensureRoom(roomToken);
  await enqueueIronclawMessage({
    userId: "nc:system",
    message: `[system] Nextcloud Talk room joined: ${event.object?.name ?? roomToken}`,
    conversationId: mapping.defaultConversationId,
    metadata: {
      source: "nextcloud-talk",
      event_type: "Join",
      room_token: roomToken
    }
  });
}

async function handleCreate(event: TalkEvent, roomToken: string): Promise<void> {
  if (isBotAuthored(event)) {
    return;
  }

  const messageObject = event.object;
  const messageId = messageObject?.id;
  const parsed = parseMessageContent(messageObject?.content);
  const text = parsed.rendered.trim();
  if (!text) {
    return;
  }

  if (!isMentionForBot(text)) {
    return;
  }

  const topicKey = extractTopicMarker(text);
  const conversationId = await store.conversationFor(roomToken, topicKey);
  const cleanPrompt = stripMention(text);

  const jobId = await enqueueIronclawMessage({
    userId: `nc:${event.actor?.id ?? "unknown"}`,
    message: cleanPrompt || text,
    conversationId,
    metadata: {
      source: "nextcloud-talk",
      event_type: "Create",
      room_token: roomToken,
      message_id: messageId,
      actor_id: event.actor?.id,
      actor_name: event.actor?.name,
      topic_key: topicKey ?? null
    }
  });

  const responseText = await waitForIronclawResponse(jobId);
  if (!responseText.trim()) {
    return;
  }

  await sendBotMessage(roomToken, responseText, messageId);
}

app.listen(config.port, () => {
  console.log(`nextcloud-talk-bridge listening on :${config.port}`);
});
