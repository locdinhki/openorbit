# 7.3: Telegram Bot Gateway

**Effort:** Medium | **Status:** Complete

## Background

From the OpenClaw pattern: messaging channels (WhatsApp, Telegram, Discord) are the most natural phone interface for controlling a desktop AI agent. No custom mobile app needed — just text the bot.

Telegram is the ideal first channel: free Bot API, no business verification, long polling (no webhook server), rich markdown formatting, and inline keyboards for approve/reject actions.

## How It Works

```
Phone (Telegram app)
    |
    |-- Telegram Bot API (HTTPS, long polling)
    |       |
    |       |-- ext-telegram (inside Electron main process)
    |               |
    |               |-- AI Gateway
    |               |       |
    |               |       |-- Agent SDK query() with system prompt
    |               |       |-- In-process MCP tools (list_jobs, approve, etc.)
    |               |       |-- Claude interprets intent, calls tools, formats response
    |               |
    |               |-- Direct access to repos/services (in-process, no RPC hop)
```

Unlike the MCP server (7.2) which bridges via RPC, the Telegram bot runs **inside** the Electron app as an extension. It has direct access to repos and services — no WebSocket overhead.

## Tasks

### Extension Scaffold
- [x] Create `packages/extensions/ext-telegram/` with standard structure
- [x] `package.json` with `openorbit` manifest (`id: ext-telegram`)
- [x] Register as preloaded module in shell bootstrap

### Telegram Bot (`telegram-bot.ts`)
- [x] Connect to Telegram Bot API using long polling (no webhook needed)
- [x] Bot token stored in settings DB (user creates via @BotFather)
- [x] Authorized chat ID whitelist (security — only respond to owner)
- [x] Parse incoming text messages, forward to AI Gateway
- [x] Send responses back as Telegram messages (Markdown formatting)
- [x] Support inline keyboards for job approve/reject buttons

### AI Gateway (`ai-gateway.ts`)
- [x] Create in-process MCP server with OpenOrbit tools via `createSdkMcpServer()`
- [x] Per message: call Agent SDK `query()` with system prompt + tools
- [x] System prompt: "You are OpenOrbit, a job search assistant. Use the provided tools to help the user manage their job search."
- [x] Max 5 turns per message (prevent runaway loops)
- [x] Model: sonnet (good balance of speed and quality for chat)

### In-Process MCP Tools
- [x] Same tool set as 7.2 (list_jobs, approve, get_status, etc.)
- [x] But calling repos/services directly instead of going through RPC
- [x] Accept `ExtensionContext` dependencies via constructor injection

### Response Formatters (`formatters.ts`)
- [x] Format job list as Telegram message (title, company, match score)
- [x] Format automation status as dashboard-style message
- [x] Format errors as user-friendly messages
- [x] Truncate long responses to fit Telegram's 4096 char message limit

### Settings IPC
- [x] `ext-telegram:config-get` — get bot token, authorized chat IDs, enabled status
- [x] `ext-telegram:config-set` — update configuration
- [x] `ext-telegram:status` — bot running/stopped/error

## Example Interactions

```
User: "any new jobs today?"
Bot:  📋 3 new jobs found today:

      1. Senior Frontend Engineer — Stripe
         Match: 92% | Remote | $180-220k
         [Approve] [Reject] [Details]

      2. Full Stack Developer — Vercel
         Match: 87% | Remote | $160-200k
         [Approve] [Reject] [Details]

      3. React Developer — Linear
         Match: 85% | San Francisco | $170-210k
         [Approve] [Reject] [Details]

User: "approve the stripe one"
Bot:  ✅ Approved: Senior Frontend Engineer at Stripe
      It will be included in the next application batch.

User: "start searching"
Bot:  🚀 Automation started with profile "Software Engineer"
      I'll notify you when new jobs are found.

User: "status"
Bot:  📊 Automation Status: Running
      • Jobs extracted: 47
      • Jobs analyzed: 43
      • Applications submitted: 8
      • Running for: 2h 15m
```

## Setup

### 1. Create a Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a name (e.g., "OpenOrbit") and username (e.g., "openorbit_bot")
4. Copy the bot token (looks like `123456789:ABCdefGHIjklMNO...`)

### 2. Get your Telegram chat ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It replies with your numeric chat ID (e.g., `123456789`)

### 3. Configure in OpenOrbit

Set these values in the OpenOrbit settings DB (via the settings UI or CLI):

| Setting Key | Value | Example |
|-------------|-------|---------|
| `telegram.bot-token` | Bot token from BotFather | `123456789:ABCdef...` |
| `telegram.authorized-chat-ids` | Comma-separated chat IDs | `123456789,987654321` |

Or use the extension's IPC channels programmatically:

```typescript
// Via renderer IPC
await ipc.invoke('ext-telegram:config-set', {
  token: 'YOUR_BOT_TOKEN',
  'authorized-chat-ids': '123456789'
})
```

### 4. Restart OpenOrbit

The bot starts automatically on app launch if a token is configured. Check logs for `"ext-telegram: bot started"`.

### 5. Test it

Send a message to your bot on Telegram:
- `/help` — see available commands
- `/jobs` — list new jobs
- `/status` — automation status
- Or just type naturally: "any new jobs today?"

## Success Criteria

- [x] Bot connects to Telegram and responds to messages
- [x] Natural language queries ("any new jobs?") return formatted job lists
- [x] Inline keyboard buttons trigger approve/reject actions
- [ ] Automation start/stop works from Telegram (deferred — requires cross-extension coordinator sharing)
- [x] Only authorized chat IDs can interact (security)
- [x] All AI processing through Max plan (zero API cost)
