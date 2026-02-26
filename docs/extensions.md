# Extensions Guide

OpenOrbit is built on an extension architecture. All major functionality — AI providers, job search, messaging — lives in extensions under `packages/extensions/`. This guide covers every extension and the standalone MCP server package.

---

## Extension Architecture

Extensions are discovered from `packages/extensions/*/package.json` via the `openorbit` manifest field. Built-in extensions are statically imported as `preloadedModules` in `src/main/index.ts` (required because electron-vite bundles TypeScript).

Extensions activate alphabetically on startup. Each implements `ExtensionMainAPI` with an `activate(ctx: ExtensionContext)` method that receives:
- `ctx.db` — SQLite database instance
- `ctx.log` — scoped logger
- `ctx.services.ai` — AI provider registry
- `ctx.services.browser` — browser session manager
- `ctx.services.scheduler` — task scheduler
- `ctx.ipc` — IPC handler registration

---

## AI Provider Extensions

OpenOrbit supports multiple AI backends through the `AIProvider` interface. Providers register with the `AIProviderRegistry` and are consumed via the `AIService` facade. The first configured provider that registers becomes the default.

All AI providers map `ModelTier` to concrete models:
- **fast** — cheapest/fastest model (for bulk operations)
- **standard** — balanced model (for most tasks)
- **premium** — most capable model (for complex analysis)

### ext-ai-claude-sdk (Claude via Max Plan)

| Field | Value |
|-------|-------|
| **ID** | `ext-ai-claude-sdk` |
| **Display Name** | Claude (Max Plan) |
| **Package** | `@openorbit/ext-ai-claude-sdk` |
| **Cost** | $0 — uses Max plan subscription |

**What it does:** Routes all AI processing through the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), using the Claude Max plan subscription. No API key needed — auth is inherited from the Claude Code CLI login.

**Capabilities:** streaming, tool calling (via MCP), multi-turn chat

**Model Mapping:**
| Tier | Model |
|------|-------|
| fast | haiku |
| standard | sonnet |
| premium | opus |

**Prerequisites:**
1. Install Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
2. Log in with a Max plan: run `claude` and complete the login flow

**Setup:** No manual configuration. Activates automatically on startup and checks for the CLI.

**Verify:** Check app logs for `"Claude Agent SDK provider registered (Max plan)"`. If the CLI is not found, it falls back to ext-ai-claude.

**How it becomes default:** Extensions activate alphabetically. `ext-ai-claude-sdk` comes before `ext-ai-claude`, so it registers first. The API key provider remains as a fallback.

**Notes:**
- Spawns a Claude Code subprocess per `query()` call (~1-2s startup overhead)
- Strips `CLAUDECODE=1` env var to prevent conflicts when developing inside Claude Code
- Agent SDK doesn't accept message arrays — multi-turn chat serializes history into the prompt with role markers

---

### ext-ai-claude (Claude via API Key)

| Field | Value |
|-------|-------|
| **ID** | `ext-ai-claude` |
| **Display Name** | Claude (Anthropic) |
| **Package** | `@openorbit/ext-ai-claude` |
| **Cost** | Per-token billing via Anthropic API |

**What it does:** AI provider using the Anthropic SDK (`@anthropic-ai/sdk`) with direct API key authentication. Supports multiple API keys with rotation and failover.

**Capabilities:** streaming, tool calling, vision

**Model Mapping:**
| Tier | Primary Model | Failover |
|------|---------------|----------|
| fast | claude-haiku-4-5 | claude-sonnet-4-5 |
| standard | claude-sonnet-4-5 | — |
| premium | claude-opus-4-6 | claude-sonnet-4-5 |

**Prerequisites:**
- Anthropic API key(s)

**Setup:**

Set your API key in OpenOrbit settings:

| Setting Key | Description |
|-------------|-------------|
| `anthropic_api_key` | Single API key |
| `anthropic_api_keys` | JSON array of keys for rotation (e.g., `["sk-ant-...", "sk-ant-..."]`) |

**Features:**
- **Key rotation:** On rate limit (429), automatically rotates to the next key
- **Retry with backoff:** Up to 3 attempts per model, with exponential backoff on timeouts
- **Model failover:** If primary model exhausts retries, falls back to next model in chain
- **Usage tracking:** All requests logged to `api_usage` table with token counts, latency, and success/failure

---

### ext-ai-openai (OpenAI / GPT)

| Field | Value |
|-------|-------|
| **ID** | `ext-ai-openai` |
| **Display Name** | OpenAI (GPT) |
| **Package** | `@openorbit/ext-ai-openai` |
| **Cost** | Per-token billing via OpenAI API |

**What it does:** AI provider using the OpenAI API (via native `fetch`, no SDK dependency). Supports GPT-4o, GPT-4o-mini, and o1 models.

**Capabilities:** streaming, tool calling, vision

**Model Mapping:**
| Tier | Primary Model | Failover |
|------|---------------|----------|
| fast | gpt-4o-mini | gpt-4o |
| standard | gpt-4o | — |
| premium | o1 | gpt-4o |

**Prerequisites:**
- OpenAI API key

**Setup:**

| Setting Key | Description |
|-------------|-------------|
| `openai_api_key` | Your OpenAI API key (starts with `sk-`) |

**Features:**
- Same retry/failover pattern as ext-ai-claude
- Uses native `fetch()` instead of the OpenAI SDK (smaller bundle)
- Usage tracking via `api_usage` table

---

### ext-ai-ollama (Local LLMs via Ollama)

| Field | Value |
|-------|-------|
| **ID** | `ext-ai-ollama` |
| **Display Name** | Ollama (Local) |
| **Package** | `@openorbit/ext-ai-ollama` |
| **Cost** | $0 — runs locally |

**What it does:** AI provider for local LLMs via Ollama. Auto-discovers installed models and maps them to tiers. No API key, no internet required.

**Capabilities:** streaming only (no tool calling, no vision)

**Default Model Mapping:**
| Tier | Default Model |
|------|---------------|
| fast | llama3.2:3b |
| standard | llama3.1:8b |
| premium | llama3.1:70b |

**Prerequisites:**
1. Install Ollama: [ollama.com](https://ollama.com)
2. Pull at least one model: `ollama pull llama3.1:8b`
3. Ensure Ollama server is running (starts automatically on install)

**Setup:**

| Setting Key | Default | Description |
|-------------|---------|-------------|
| `ollama_base_url` | `http://localhost:11434` | Ollama server URL |
| `ollama_model_fast` | `llama3.2:3b` | Override fast tier model |
| `ollama_model_standard` | `llama3.1:8b` | Override standard tier model |
| `ollama_model_premium` | `llama3.1:70b` | Override premium tier model |

**Notes:**
- `isConfigured()` returns true only after successfully connecting to Ollama and discovering models
- Models list is populated dynamically from Ollama's `/api/tags` endpoint
- Good for privacy-sensitive use or offline scenarios

---

## Feature Extensions

### ext-jobs (Job Search)

| Field | Value |
|-------|-------|
| **ID** | `ext-jobs` |
| **Display Name** | Job Search |
| **Package** | `@openorbit/ext-jobs` |

**What it does:** End-to-end job search and application automation. Discovers jobs across platforms, analyzes them with AI, and automates applications.

**Capabilities:**
- Multi-platform job extraction (LinkedIn, Indeed, Upwork)
- AI-powered job analysis with match scoring
- Automated application submission
- Interactive Claude chat for job questions
- Scheduled extraction runs via the core scheduler
- Action logging with browser snapshots

**IPC Channels:** 42 channels covering jobs, profiles, automation, chat, applications, action log, and memory.

**Database Tables:** 4 tables (`search_profiles`, `jobs`, `action_logs`, `answer_templates`) — created via extension migration on first activation.

**Prerequisites:**
- At least one AI provider configured (for job analysis and chat)
- Search profiles created via the UI (keywords, location, platform)

**Setup:** No manual configuration needed. Activates automatically on startup. Create search profiles through the UI to start finding jobs.

**Supported Platforms:**

| Platform | Search | Apply | Status |
|----------|--------|-------|--------|
| LinkedIn | Yes | Yes | Built-in |
| Indeed | Yes | Yes | Built-in |
| Upwork | Yes | Yes | Built-in |
| Dice | — | — | Schema-ready |
| Wellfound | — | — | Schema-ready |
| Glassdoor | — | — | Schema-ready |

**Key Integration Points:**
- `ctx.services.ai` — for job analysis (JobAnalyzer) and chat (ChatHandler)
- `ctx.services.browser` — for browser automation (extraction + applications)
- `ctx.services.scheduler` — registers `extraction` task type for scheduled runs

---

### ext-telegram (Telegram Bot)

| Field | Value |
|-------|-------|
| **ID** | `ext-telegram` |
| **Display Name** | Telegram Bot |
| **Package** | `@openorbit/ext-telegram` |

**What it does:** Always-on messaging interface to control OpenOrbit from your phone via Telegram. Supports slash commands, natural language queries via Claude, and inline keyboard buttons for job approve/reject.

**Prerequisites:**
- Telegram account
- OpenOrbit desktop app running

**Setup:**

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

| Setting Key | Value |
|-------------|-------|
| `telegram.bot-token` | Your bot token from BotFather |
| `telegram.authorized-chat-ids` | Your chat ID (comma-separated for multiple users) |

Or use the extension's IPC channel:
```
ext-telegram:config-set { token: "BOT_TOKEN", "authorized-chat-ids": "123456789" }
```

#### Step 4: Restart OpenOrbit

The bot starts automatically. Check logs for `"ext-telegram: bot started"`.

**Commands:**

| Command | Description |
|---------|-------------|
| `/jobs` | List new jobs |
| `/approved` | List approved jobs |
| `/applied` | List applied jobs |
| `/profiles` | List search profiles |
| `/status` | Automation status summary |
| `/log` | Recent action log |
| `/help` | Show all commands |

Natural language also works: "any new jobs?", "approve the stripe one", "what's the status?"

**IPC Channels:**

| Channel | Description |
|---------|-------------|
| `ext-telegram:config-get` | Get bot token, authorized chat IDs, enabled status |
| `ext-telegram:config-set` | Update bot configuration |
| `ext-telegram:status` | Bot running/stopped/error status |

**Security:**
- Only chat IDs in `telegram.authorized-chat-ids` can interact with the bot
- If no IDs are configured, all messages are accepted (for initial setup only)
- All AI processing runs through the Max plan (zero API cost)

---

## Standalone Packages

### openorbit-mcp (MCP Server)

| Field | Value |
|-------|-------|
| **Package** | `@openorbit/mcp-server` |
| **Binary** | `openorbit-mcp` |
| **Location** | `packages/mcp-server/` |

**What it does:** Exposes OpenOrbit capabilities as MCP tools so Claude Desktop, Claude Code, and other MCP clients can interact with your job search through natural language.

**Architecture:** Standalone Node.js process (not inside Electron). Connects to the RPC server as a WebSocket client, same as the CLI and mobile app.

**Prerequisites:**
- OpenOrbit desktop app running (RPC server on port 18790)
- Node.js installed

**Setup:**

#### For Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

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

Replace `/path/to/openorbit` with the actual path to your OpenOrbit checkout.

**CLI Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | RPC server host |
| `--port` | `18790` | RPC server port |
| `--token-path` | Platform default | Custom path to RPC auth token |

Token path defaults:
- macOS: `~/Library/Application Support/openorbit/rpc-token`
- Linux: `~/.config/openorbit/rpc-token`

**Available Tools:**

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

**Verify:** After configuring, restart Claude Desktop. The 10 OpenOrbit tools should appear. Try asking: "List my new jobs" or "What's the automation status?"

---

## Remote Access (Tailscale)

Not an extension, but a network configuration that enables all remote access scenarios (MCP, Telegram, mobile app).

**What it does:** Makes the RPC server accessible from your phone when away from home, using Tailscale's encrypted mesh VPN.

**Prerequisites:**
- Tailscale account (free for personal use)

**Setup:**

1. **Install Tailscale** on your Mac (`brew install tailscale`) and phone (App Store / Google Play)
2. **Sign in** with the same Tailscale account on both devices
3. **Configure bind host** in OpenOrbit settings:

| Setting Key | Value | Description |
|-------------|-------|-------------|
| `rpc.bind-host` | `0.0.0.0` | Listen on all interfaces |

4. **Restart OpenOrbit** — the RPC server binds to the configured host

**Verify:** OpenOrbit auto-detects the tailnet IP and includes it in the pairing QR code. Connect from your phone (on cellular, not WiFi) using the tailnet URL.

**Security:**
- All traffic encrypted via WireGuard (Tailscale)
- Token auth still required (same UUID token as localhost)
- Only devices on your tailnet can reach the IP
- No public internet exposure, no port forwarding needed

---

## Extension Activation Order

Extensions activate alphabetically, which determines provider priority:

1. `ext-ai-claude` — registers Claude API key provider
2. `ext-ai-claude-sdk` — registers Claude Max plan provider (becomes default if configured)
3. `ext-ai-ollama` — registers Ollama local provider
4. `ext-ai-openai` — registers OpenAI provider
5. `ext-jobs` — registers job search IPC handlers + scheduler task
6. `ext-telegram` — starts Telegram bot (if configured)

The first AI provider that reports `isConfigured() === true` and registers becomes the default. Since ext-ai-claude-sdk activates before ext-ai-claude, the Max plan provider takes priority when available.
