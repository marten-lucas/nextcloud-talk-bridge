# nextcloud-talk-bridge

Small bridge service for Nextcloud Talk bot webhooks and Ironclaw HTTP webhook.

## What V1 does

- Verifies Nextcloud Talk webhook signatures (`X-Nextcloud-Talk-Signature` + `X-Nextcloud-Talk-Random`).
- Handles `Join` and `Create` events.
- Mention-only processing (`@ironclaw` by default).
- Maintains persistent room-to-conversation mapping in local JSON storage.
- Sends incoming messages to Ironclaw HTTP webhook channel.
- Polls Ironclaw job status and posts final response back to Nextcloud Talk Bot API.

## V1 limitations

- Attachment and voice processing is intentionally not implemented yet.
- Topic routing is marker-based only (`#topic:<name>` or `#thema:<name>`).

## Local run

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Health endpoint:

```bash
curl http://127.0.0.1:8787/healthz
```

## Nextcloud bot setup (OCC)

The bot must include at least features `webhook` and `response`.

```bash
sudo -u www-data php occ talk:bot:install \
  --feature webhook \
  --feature response \
  "IronClaw" \
  "<BOT_SECRET_MIN_40_CHARS>" \
  "https://talk-bridge.example.tld/nextcloud/talk/webhook" \
  "Ironclaw agent bridge"
```

## Deployment on CT300

This workspace includes `deployment/ct300_update.sh` to deploy this repository into CT300.

Default GitHub remote for the bridge:

`https://github.com/marten-lucas/nextcloud-talk-bridge`

Expected environment variables (in `deployment/.env` or `deployment/.env.e2e`):

- `NEXTCLOUD_TALK_BRIDGE_REPO_URL`
- `NEXTCLOUD_TALK_BRIDGE_REPO_REF` (default `main`)
- `CT300_BRIDGE_ENV_B64` (base64 of bridge `.env` content)

Example:

```bash
cd deployment
./ct300_update.sh
```

## YunoHost integration (later)

When your YunoHost redirect/proxy app is ready, route a public host (for example
`talk-bridge.cloud.kiga-gramschatz.de`) to CT300:`8787` and keep TLS termination
on YunoHost.

## Setup guide

See [docs/setup-guide.md](docs/setup-guide.md) for the full configuration and
integration steps for Nextcloud, Ironclaw, and CT300.
