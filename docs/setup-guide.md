# Nextcloud Talk Bridge Setup Guide

This guide explains how to configure the bridge, connect it to Nextcloud Talk, and
wire it to Ironclaw.

## 1. Target architecture

- Nextcloud Talk sends webhook events to the bridge in CT300.
- The bridge verifies the Talk webhook signature.
- Mentioned messages are forwarded to Ironclaw over the built-in HTTP webhook channel.
- Ironclaw returns a job response, and the bridge posts the final reply back to Talk.

## 2. Bridge service prerequisites

On CT300 you need:

- Debian 12 or newer.
- Node.js 20 or newer.
- A writable data directory at `/var/lib/talkbridge`.
- A service account `talkbridge`.
- Outbound network access to:
  - `https://next.cloud.kiga-gramschatz.de`
  - `https://ironclaw.cloud.kiga-gramschatz.de`

## 3. Bridge environment file

The bridge reads `/etc/nextcloud-talk-bridge/nextcloud-talk-bridge.env`.

Minimum values:

```bash
PORT=8787
LOG_LEVEL=info
NEXTCLOUD_BASE_URL=https://next.cloud.kiga-gramschatz.de
NEXTCLOUD_TALK_BOT_SECRET=<shared-bot-secret>
NEXTCLOUD_TALK_BACKEND_ALLOWLIST=next.cloud.kiga-gramschatz.de
BOT_DISPLAY_NAME=IronClaw
BOT_MENTION_REGEX=@ironclaw
IRONCLAW_BASE_URL=https://ironclaw.cloud.kiga-gramschatz.de
IRONCLAW_WEBHOOK_SECRET=<ironclaw-webhook-secret>
IRONCLAW_JOB_POLL_INTERVAL_MS=1500
IRONCLAW_JOB_TIMEOUT_MS=180000
DATA_DIR=/var/lib/talkbridge/data
```

Notes:

- `NEXTCLOUD_TALK_BOT_SECRET` must match the secret used when installing the bot.
- `IRONCLAW_WEBHOOK_SECRET` must match Ironclaw's HTTP Webhook secret.
- `NEXTCLOUD_TALK_BACKEND_ALLOWLIST` should contain the Nextcloud host that sends the webhook.

## 4. Deploy the bridge to CT300

The deployment script is [deployment/ct300_update.sh](../deployment/ct300_update.sh).

Recommended env variables for the deployment run:

- `NEXTCLOUD_TALK_BRIDGE_REPO_URL=https://github.com/marten-lucas/nextcloud-talk-bridge`
- `NEXTCLOUD_TALK_BRIDGE_REPO_REF=main`

Run:

```bash
cd deployment
./ct300_update.sh
```

## 5. Configure Ironclaw

Use Ironclaw's built-in HTTP Webhook channel for the first version.

Suggested Ironclaw settings:

- Enable HTTP Webhook.
- Bind the HTTP listener to `127.0.0.1` or an internal address if the bridge and Ironclaw share a private network.
- Set a dedicated webhook secret.
- Keep the bridge and Ironclaw secrets separate.

Suggested request shape from the bridge to Ironclaw:

```json
{
  "user_id": "nc:users/ada-lovelace",
  "message": "hello",
  "conversation_id": "nextcloud-talk-room-123",
  "metadata": {
    "source": "nextcloud-talk",
    "event_type": "Create",
    "room_token": "nextcloud-room-token"
  }
}
```

Important behavior:

- Only messages containing the mention marker should be forwarded.
- The bridge should map each Talk room token to a persistent Ironclaw conversation id.
- Later topic routing can derive additional conversation ids from `#topic:<name>` or `#thema:<name>`.

## 6. Configure Nextcloud Talk

Install the bot from the Nextcloud admin shell or as a privileged admin command.

Example using `occ`:

```bash
sudo -u www-data php occ talk:bot:install \
  --feature webhook \
  --feature response \
  "IronClaw" \
  "<shared-bot-secret>" \
  "https://talk-bridge.cloud.kiga-gramschatz.de/nextcloud/talk/webhook" \
  "IronClaw agent bridge"
```

If you want the bot to be set up only once and not be editable by moderators, add `--no-setup`.

After installation:

- Open a Talk room.
- Add the bot to the room.
- Confirm that the bridge receives the `Join` event.

## 7. Configure the webhook response flow

The bridge expects these Talk headers on incoming requests:

- `X-Nextcloud-Talk-Signature`
- `X-Nextcloud-Talk-Random`
- `X-Nextcloud-Talk-Backend`

The bridge will reject requests when:

- The signature is missing or invalid.
- The backend host is not in the allowlist.
- The payload is not a valid Talk event.

## 8. Test sequence

Use this order for the first end-to-end test:

1. Start the bridge on CT300.
2. Confirm `GET /healthz` returns 200.
3. Install the Nextcloud Talk bot.
4. Invite the bot to a test room.
5. Send a message containing `@ironclaw`.
6. Verify that Ironclaw receives a webhook request.
7. Verify that the bridge posts the final response back into the Talk room.

## 9. Operational notes

- Keep mention-only mode for the first rollout.
- Do not enable attachment handling in V1.
- Do not enable voice transcription in V1.
- Keep Nextcloud and Ironclaw secrets out of logs.
- Store the bridge data directory on persistent storage so room mappings survive restarts.

## 10. Later YunoHost redirect integration

When your YunoHost redirect app is ready, point the public hostname to CT300:8787 and let YunoHost terminate TLS.

Suggested public hostname:

- `talk-bridge.cloud.kiga-gramschatz.de`
