import crypto from "node:crypto";
import { config } from "./config.js";
import { RenderedMessage, TalkEvent } from "./types.js";

function lowerHexDigest(input: Buffer, secret: string): string {
  return crypto.createHmac("sha256", secret).update(input).digest("hex").toLowerCase();
}

export function verifyIncomingSignature(rawBody: Buffer, randomHeader: string, signatureHeader: string): boolean {
  const payload = Buffer.concat([Buffer.from(randomHeader, "utf8"), rawBody]);
  const expected = lowerHexDigest(payload, config.nextcloudTalkBotSecret);
  const provided = signatureHeader.toLowerCase();

  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}

export function backendAllowed(headerValue: string | undefined): boolean {
  if (config.nextcloudTalkBackendAllowlist.length === 0) {
    return true;
  }
  if (!headerValue) {
    return false;
  }

  try {
    const host = new URL(headerValue).host;
    return config.nextcloudTalkBackendAllowlist.includes(host);
  } catch {
    return false;
  }
}

export function parseTalkEvent(input: unknown): TalkEvent | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const event = input as TalkEvent;
  if (!event.type) {
    return null;
  }
  return event;
}

export function extractTalkToken(event: TalkEvent): string | null {
  if (event.type === "Join" || event.type === "Leave") {
    return event.object?.id ?? null;
  }
  return event.target?.id ?? null;
}

export function isBotAuthored(event: TalkEvent): boolean {
  const actorType = event.actor?.type?.toLowerCase() ?? "";
  const actorId = event.actor?.id?.toLowerCase() ?? "";
  return actorType === "application" || actorId.startsWith("bots/");
}

function renderParameters(message: string, parameters: Record<string, { name?: string }>): string {
  return message.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const resolved = parameters[key]?.name;
    return resolved ?? `{${key}}`;
  });
}

export function parseMessageContent(content: string | undefined): RenderedMessage {
  if (!content) {
    return { raw: "", rendered: "" };
  }

  try {
    const parsed = JSON.parse(content) as {
      message?: string;
      parameters?: Record<string, { name?: string }>;
    };
    const raw = parsed.message ?? "";
    const rendered = renderParameters(raw, parsed.parameters ?? {});
    return { raw, rendered };
  } catch {
    return { raw: content, rendered: content };
  }
}

export function extractTopicMarker(text: string): string | undefined {
  const match = text.match(/#(?:topic|thema):([a-zA-Z0-9_-]+)/i);
  return match?.[1];
}

export function isMentionForBot(text: string): boolean {
  if (config.botMentionRegex.test(text)) {
    return true;
  }
  return new RegExp(`@?${config.botDisplayName}`, "i").test(text);
}

export function stripMention(text: string): string {
  return text.replace(config.botMentionRegex, "").trim();
}

export async function sendBotMessage(roomToken: string, message: string, replyTo?: string): Promise<void> {
  const endpoint = `${config.nextcloudBaseUrl}/ocs/v2.php/apps/spreed/api/v1/bot/${encodeURIComponent(roomToken)}/message`;
  const payload = {
    message,
    ...(replyTo ? { replyTo: Number(replyTo) || undefined } : {})
  };
  const body = JSON.stringify(payload);

  const random = crypto.randomBytes(32).toString("hex");
  const signature = lowerHexDigest(Buffer.from(`${random}${body}`, "utf8"), config.nextcloudTalkBotSecret);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "OCS-APIRequest": "true",
      "X-Nextcloud-Talk-Bot-Random": random,
      "X-Nextcloud-Talk-Bot-Signature": signature
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Nextcloud bot message failed: ${response.status} ${text}`);
  }
}
