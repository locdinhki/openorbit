# Phase 7: Setup Guide

How to set up each component of the AI Remote Access system.

---

## 1. Claude Agent SDK Provider (ext-ai-claude-sdk)

**What it does:** Routes all AI processing through your Claude Max plan subscription at zero additional API cost.

### Prerequisites

- Claude Code CLI installed: `npm install -g @anthropic-ai/claude-code`
- Logged in with a Max plan: run `claude` and complete the login flow

### Setup

No manual configuration needed. The extension activates automatically on app startup and checks for the Claude CLI.

### Verify

- Check app logs for: `"Claude Agent SDK provider registered (Max plan)"`
- If Claude CLI is not found, the log will show a warning and fall back to ext-ai-claude (API key provider)

### How It Works

- Activates before ext-ai-claude (alphabetical order), becoming the default AI provider
- All AI features (chat, job analysis, answer generation) route through the Max plan
- Strips `CLAUDECODE=1` env var to avoid conflicts when developing inside Claude Code
- Model mapping: fast → haiku, standard → sonnet, premium → opus

---

## 2. MCP Server (openorbit-mcp)

**What it does:** Exposes OpenOrbit capabilities as MCP tools so Claude Desktop, Claude Code, and other MCP clients can interact with your job search.

### Prerequisites

- OpenOrbit desktop app running (RPC server on port 18790)
- Node.js installed

### Setup

#### For Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openorbit": {
      "command": "node",
      "args": ["/path/to/openorbit/packages/mcp-server/src/index.ts"],
      "env": {}
    }
  }
}
```

Replace `/path/to/openorbit` with the actual path to your OpenOrbit checkout.

#### For Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "openorbit": {
      "command": "node",
      "args": ["/path/to/openorbit/packages/mcp-server/src/index.ts"]
    }
  }
}
```

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | RPC server host |
| `--port` | `18790` | RPC server port |
| `--token-path` | Platform default | Custom path to RPC auth token |

Token path defaults:
- macOS: `~/Library/Application Support/openorbit/rpc-token`
- Linux: `~/.config/openorbit/rpc-token`

### Available Tools

| Tool | Description |
|------|-------------|
| `list_jobs` | List jobs with optional status/platform filter |
| `get_job` | Get job details by ID |
| `approve_job` | Approve a job for application |
| `reject_job` | Reject a job |
| `start_automation` | Start job search automation |
| `stop_automation` | Stop automation |
| `get_status` | Get current automation status |
| `list_profiles` | List search profiles |
| `list_applications` | List submitted applications |
| `get_action_log` | Get recent action log entries |

### Verify

After configuring, restart Claude Desktop. The 10 OpenOrbit tools should appear. Try asking: "List my new jobs" or "What's the automation status?"

---

## 3. Telegram Bot (ext-telegram)

**What it does:** Provides an always-on messaging interface to control OpenOrbit from your phone via Telegram.

### Prerequisites

- Telegram account
- OpenOrbit desktop app running

### Setup

#### Step 1: Create a Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a display name (e.g., "OpenOrbit")
4. Choose a username (e.g., "my_openorbit_bot")
5. BotFather replies with a **bot token** — copy it

#### Step 2: Get your chat ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It replies with your numeric chat ID (e.g., `123456789`)

#### Step 3: Configure in OpenOrbit

Set these settings in the app:

| Setting Key | Value |
|-------------|-------|
| `telegram.bot-token` | Your bot token from BotFather |
| `telegram.authorized-chat-ids` | Your chat ID (comma-separated for multiple users) |

You can set these via the extension IPC:

```
ext-telegram:config-set { token: "BOT_TOKEN", "authorized-chat-ids": "123456789" }
```

#### Step 4: Restart OpenOrbit

The bot starts automatically. Check logs for `"ext-telegram: bot started"`.

### Commands

| Command | Description |
|---------|-------------|
| `/jobs` | List new jobs |
| `/approved` | List approved jobs |
| `/applied` | List applied jobs |
| `/profiles` | List search profiles |
| `/status` | Automation status summary |
| `/log` | Recent action log |
| `/help` | Show all commands |

You can also type naturally: "any new jobs?", "approve the stripe one", "what's the status?"

### Security

- Only chat IDs in `telegram.authorized-chat-ids` can interact with the bot
- If no IDs are configured, all messages are accepted (for initial setup)
- All AI processing runs through the Max plan (no extra cost)

---

## 4. Remote Access (Tailscale)

**What it does:** Makes OpenOrbit accessible from your phone when away from home, using Tailscale's encrypted mesh VPN.

### Prerequisites

- Tailscale account (free for personal use)

### Setup

#### Step 1: Install Tailscale

**Mac:**
```bash
brew install tailscale
```
Or download from [tailscale.com/download](https://tailscale.com/download)

**Phone:**
- iOS: [App Store](https://apps.apple.com/app/tailscale/id1470499037)
- Android: [Google Play](https://play.google.com/store/apps/details?id=com.tailscale.ipn)

#### Step 2: Sign in on both devices

Use the same Tailscale account. Both devices get tailnet IPs (100.x.x.x range).

#### Step 3: Configure bind host

Set the RPC bind host in OpenOrbit settings:

| Setting Key | Value | Description |
|-------------|-------|-------------|
| `rpc.bind-host` | `0.0.0.0` | Listen on all interfaces |

Or set it to your specific tailnet IP for more restrictive binding.

#### Step 4: Restart OpenOrbit

The RPC server binds to the configured host. OpenOrbit auto-detects the tailnet IP and includes it in the pairing QR code.

### Verify

1. Connect your phone to cellular (not home WiFi)
2. Ensure Tailscale is connected on both devices
3. Scan the pairing QR code — the `tailnetUrl` field should show `ws://100.x.x.x:18790`
4. The companion app connects via the tailnet URL

### Security

- All traffic encrypted via WireGuard (Tailscale)
- Token auth still required (same UUID token as localhost)
- Only devices on your tailnet can reach the IP
- No public internet exposure, no port forwarding needed
