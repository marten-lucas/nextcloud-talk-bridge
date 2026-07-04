import path from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}=${value}`);
  }
  return parsed;
}

function envList(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const config = {
  port: envNumber("PORT", 8787),
  logLevel: process.env.LOG_LEVEL ?? "info",

  nextcloudBaseUrl: requireEnv("NEXTCLOUD_BASE_URL").replace(/\/$/, ""),
  nextcloudTalkBotSecret: requireEnv("NEXTCLOUD_TALK_BOT_SECRET"),
  nextcloudTalkBackendAllowlist: envList("NEXTCLOUD_TALK_BACKEND_ALLOWLIST", []),

  botDisplayName: process.env.BOT_DISPLAY_NAME ?? "IronClaw",
  botMentionRegex: new RegExp(process.env.BOT_MENTION_REGEX ?? "@ironclaw", "i"),

  ironclawBaseUrl: requireEnv("IRONCLAW_BASE_URL").replace(/\/$/, ""),
  ironclawWebhookSecret: requireEnv("IRONCLAW_WEBHOOK_SECRET"),
  ironclawJobPollIntervalMs: envNumber("IRONCLAW_JOB_POLL_INTERVAL_MS", 1500),
  ironclawJobTimeoutMs: envNumber("IRONCLAW_JOB_TIMEOUT_MS", 180000),

  dataDir: path.resolve(process.env.DATA_DIR ?? "./data")
};
