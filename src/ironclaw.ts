import { config } from "./config.js";

type IronclawWebhookResponse = {
  job_id?: string;
  status?: string;
};

type IronclawJobResponse = {
  status?: string;
  response?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enqueueIronclawMessage(input: {
  userId: string;
  message: string;
  conversationId: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const endpoint = `${config.ironclawBaseUrl}/webhook`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": config.ironclawWebhookSecret
    },
    body: JSON.stringify({
      user_id: input.userId,
      message: input.message,
      conversation_id: input.conversationId,
      metadata: input.metadata
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ironclaw webhook failed: ${response.status} ${text}`);
  }

  const parsed = (await response.json()) as IronclawWebhookResponse;
  if (!parsed.job_id) {
    throw new Error("Ironclaw webhook response does not include job_id");
  }
  return parsed.job_id;
}

export async function waitForIronclawResponse(jobId: string): Promise<string> {
  const endpoint = `${config.ironclawBaseUrl}/jobs/${encodeURIComponent(jobId)}`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < config.ironclawJobTimeoutMs) {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-Webhook-Secret": config.ironclawWebhookSecret
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ironclaw job status failed: ${response.status} ${text}`);
    }

    const parsed = (await response.json()) as IronclawJobResponse;
    if (parsed.status === "completed") {
      return parsed.response ?? "";
    }
    if (parsed.status === "failed") {
      throw new Error("Ironclaw job returned failed status");
    }

    await sleep(config.ironclawJobPollIntervalMs);
  }

  throw new Error(`Ironclaw job timed out after ${config.ironclawJobTimeoutMs}ms`);
}
