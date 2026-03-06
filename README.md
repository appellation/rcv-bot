# RCV Bot

A Discord app that creates ranked-choice polls, collects votes via interactive components, and tabulates results using Instant Runoff Voting (IRV). Runs as a Cloudflare Worker — no server required.

## How it works

1. Run `/createpoll` with a question and 2–5 options → a poll embed appears with **Vote** and **Close Poll** buttons
2. Users click **🗳️ Vote** → a private step-by-step ranking UI appears (dropdown per rank position)
3. The poll creator clicks **🔒 Close Poll** → IRV runs and the winner is announced with a round-by-round breakdown

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A [Discord application](https://discord.com/developers/applications)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your Discord application

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Create a new application (or use an existing one)
2. Go to **General Information** and copy the **Application ID** and **Public Key**
3. Go to **Bot**, click **Reset Token**, and copy the bot token
4. Under **Bot → Privileged Gateway Intents**, no intents are needed (this bot uses interactions only)

### 3. Create the Cloudflare KV namespace

```bash
npx wrangler kv namespace create RCV_KV
npx wrangler kv namespace create RCV_KV --preview
```

Each command prints a namespace ID. Paste them into `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "RCV_KV", id = "<production-id>", preview_id = "<preview-id>" }
]
```

### 4. Fill in `.dev.vars`

This file holds your local secrets and is used by both `wrangler dev` and `npm run register`. It is already gitignored.

```ini
DISCORD_PUBLIC_KEY=<from General Information>
DISCORD_TOKEN=<bot token from Bot page>
DISCORD_APPLICATION_ID=<from General Information>
```

Optionally add `DISCORD_GUILD_ID` to target a specific guild when registering commands (instant propagation; global commands take up to 1 hour):

```ini
DISCORD_GUILD_ID=<your guild id>
```

### 5. Store production secrets

```bash
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_TOKEN
```

Enter the same values from step 2 when prompted. These are stored encrypted in Cloudflare and are separate from `.dev.vars`.

Also update `wrangler.toml` with your application ID:

```toml
[vars]
DISCORD_APPLICATION_ID = "your-application-id-here"
```

### 6. Register the slash command

This only needs to be run once (or again whenever you change the command definition). Credentials are read from `.dev.vars` automatically.

```bash
npm run register
```

### 7. Deploy

```bash
npm run deploy
```

Copy the `*.workers.dev` URL from the output.

### 8. Connect Discord to your Worker

In the Discord Developer Portal, go to **General Information** and paste your Worker URL into **Interactions Endpoint URL**, then click **Save Changes**. Discord will send a verification ping — if your Worker responds correctly, the URL is accepted.

### 9. Invite the bot to your server

Go to **OAuth2 → URL Generator**, select the following scopes:

- `applications.commands`
- `bot`

No bot permissions are required. Copy the generated URL and open it in your browser to add the bot to your server.

## Development

### Run locally

```bash
npm run dev
```

This starts a local Worker via `wrangler dev`. To receive real Discord interactions locally, you need to expose the server publicly. The easiest way is [Cloudflare's built-in tunnel](https://developers.cloudflare.com/workers/testing/local-development/#use-wrangler-dev-with-a-cloudflare-tunnel):

```bash
npx wrangler dev --remote
```

Or use [ngrok](https://ngrok.com/):

```bash
ngrok http 8787
```

Then update the Interactions Endpoint URL in the Discord Developer Portal to your tunnel URL.

### Local secrets

`.dev.vars` is loaded automatically by both `wrangler dev` and `npm run register` (via `env-cmd`). Keep all three values populated:

```ini
DISCORD_PUBLIC_KEY=...
DISCORD_TOKEN=...
DISCORD_APPLICATION_ID=...
```

### Project structure

```
src/
  index.ts      Worker entry point — verifies signatures, routes interactions
  types.ts      TypeScript interfaces for Discord and app data
  verify.ts     Ed25519 signature verification (native Web Crypto API)
  utils.ts      Response helpers: jsonResponse, ephemeralMessage, updateMessage
  poll.ts       KV read/write for polls, votes, and in-progress voting state
  rcv.ts        Instant Runoff Voting algorithm and result formatter
  commands.ts   /createpoll slash command handler
  vote.ts       Voting flow: Vote button → rank select menus → submit
  close.ts      Close Poll button handler — runs IRV and posts results
scripts/
  register.ts   One-time slash command registration via Discord REST API
```

### KV key schema

| Key | Contents |
|-----|----------|
| `poll:{pollId}` | Poll metadata (question, options, creator, status) |
| `vote:{pollId}:{userId}` | Submitted vote — ordered list of option indices |
| `voting:{pollId}:{userId}` | In-progress vote state, expires after 30 minutes |

### Interaction routing

Component `custom_id` values follow the pattern `action:pollId[:step]`:

| custom_id | Triggered by |
|-----------|-------------|
| `vote:{pollId}` | Vote button on the poll message |
| `rank:{pollId}:{step}` | Rank select menu (step = 0-based rank position) |
| `done:{pollId}` | "Submit vote now" button |
| `close:{pollId}` | Close Poll button (creator-only, enforced server-side) |
