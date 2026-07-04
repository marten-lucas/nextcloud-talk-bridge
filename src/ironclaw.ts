import { config } from "./config.js";

type IronclawWebhookResponse = {
  status?: string;
  response?: string;
  message_id?: string;
};

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
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: input.userId,
      content: input.message,
      thread_id: input.conversationId,
      // Current Ironclaw HTTP channel accepts body secret for compatibility.
      secret: config.ironclawWebhookSecret,
      wait_for_response: true,
      metadata: input.metadata
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ironclaw webhook failed: ${response.status} ${text}`);
  }

  const parsed = (await response.json()) as IronclawWebhookResponse;
  if (parsed.status !== "accepted") {
    throw new Error(`Ironclaw webhook returned unexpected status: ${parsed.status ?? "unknown"}`);
  }
  return parsed.response ?? "";
}
