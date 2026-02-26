# 10.4: Discord

**Effort:** Medium | **Status:** Not started

## Background

Discord is widely used by developers and tech workers. A Discord bot provides a familiar interface for controlling OpenOrbit, with rich features like embeds, buttons, and slash commands. Unlike Telegram's long polling, Discord uses a persistent gateway WebSocket connection via [discord.js](https://discord.js.org/).

Reference: [OpenClaw Discord channel](https://docs.openclaw.ai/channels/discord)

## How It Works

```
Phone / Desktop (Discord app)
    |
    |-- Discord servers
    |       |
    |       |-- Discord Gateway (WebSocket)
    |               |
    |               |-- discord.js client (inside Electron main process)
    |                       |
    |                       |-- ext-discord (inside Electron main process)
    |                               |
    |                               |-- AI Gateway (shared pattern)
    |                               |       |-- Memory read/write
    |                               |       |-- AI provider query()
    |                               |       |-- In-process data access
    |                               |
    |                               |-- Discord features
    |                                       |-- Slash commands
    |                                       |-- Button components (approve/reject)
    |                                       |-- Rich embeds for job listings
    |                                       |-- DM-only (no guild/server interaction)
```

Discord.js maintains a persistent WebSocket connection to the Discord Gateway. Messages arrive in real-time via event handlers. Discord supports rich interactive components (buttons, dropdowns) that Telegram also supports but iMessage and WhatsApp do not.

## Tasks

### Extension Scaffold
- [ ] Create `packages/extensions/ext-discord/` with standard structure
- [ ] `package.json` with `openorbit` manifest (`id: ext-discord`)
- [ ] Dependency: `discord.js`
- [ ] Register as preloaded module in shell bootstrap

### Discord Client (`discord-client.ts`)
- [ ] Initialize discord.js `Client` with required intents (`Guilds`, `GuildMessages`, `DirectMessages`, `MessageContent`)
- [ ] Login with bot token from settings
- [ ] Message event handler → forward DMs to AI Gateway
- [ ] Ignore guild (server) messages for MVP (DM-only)
- [ ] Send text messages with Discord Markdown
- [ ] Send embeds for rich job listings
- [ ] Button components for approve/reject actions
- [ ] Slash command registration (`/jobs`, `/status`, `/approved`, `/help`)
- [ ] Interaction handler for button clicks and slash commands
- [ ] Graceful shutdown on extension deactivation

### AI Gateway (`ai-gateway.ts`)
- [ ] Same pattern as ext-telegram: direct commands + AI fallback
- [ ] Uses shared `extractAndSaveMemories()` from 10.1
- [ ] Uses shared `MemoryContextBuilder.buildChatContext()` from 10.1
- [ ] Creates repos from `ctx.db` (in-process, no RPC hop)
- [ ] Direct commands via slash commands and text: `/jobs`, `/approved`, `/status`, `/log`, `/help`

### Authorization
- [ ] Authorized user ID allowlist in settings (`discord.authorized-user-ids`)
- [ ] Format: Discord user IDs (snowflakes, e.g., `123456789012345678`)
- [ ] Reject DMs from unauthorized users (ephemeral reply: "Not authorized")
- [ ] Allow all if no IDs configured (initial setup mode)

### Settings IPC
- [ ] `ext-discord:config-get` — get bot token, authorized user IDs, status
- [ ] `ext-discord:config-set` — update configuration
- [ ] `ext-discord:status` — connected/disconnected/error

### Response Formatting (`formatters.ts`)
- [ ] Discord embeds for job listings (title, company, score as fields, color-coded by status)
- [ ] Button rows for approve/reject (same UX as Telegram inline keyboards)
- [ ] Slash command responses (ephemeral for sensitive data)
- [ ] Discord Markdown: `**bold**`, `*italic*`, `` `code` ``, `> quote`
- [ ] 2000-char message limit (chunk if needed)

### Slash Commands
- [ ] `/jobs` — list new jobs (embed with buttons)
- [ ] `/approved` — list approved jobs
- [ ] `/applied` — list applied jobs
- [ ] `/status` — automation status summary
- [ ] `/profiles` — list search profiles
- [ ] `/log` — recent action log
- [ ] `/help` — show all commands

## Extension Structure

```
packages/extensions/ext-discord/
├── package.json
├── src/
│   ├── main/
│   │   ├── index.ts                      # Activate: start Discord client
│   │   ├── discord-client.ts             # discord.js client, login, message handling
│   │   ├── ai-gateway.ts                 # Direct commands + AI fallback
│   │   ├── formatters.ts                 # Embeds, buttons, Discord Markdown
│   │   └── commands.ts                   # Slash command definitions + registration
│   └── renderer/
│       └── index.ts                      # Empty (no UI)
```

## Setup

### 1. Create a Discord bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application", name it (e.g., "OpenOrbit")
3. Go to **Bot** tab → click "Add Bot"
4. Enable **Message Content Intent** under Privileged Gateway Intents
5. Copy the **bot token**

### 2. Invite the bot

1. Go to **OAuth2** → **URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Read Message History`
4. Copy the generated URL and open it to add the bot to a server (needed for slash commands to register, but interaction will be via DM)

### 3. Get your Discord user ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your name → Copy User ID

### 4. Configure in OpenOrbit

| Setting Key | Value | Example |
|-------------|-------|---------|
| `discord.bot-token` | Bot token from Developer Portal | `MTIz...` |
| `discord.authorized-user-ids` | Comma-separated Discord user IDs | `123456789012345678` |

### 5. Restart OpenOrbit

Check logs for `"ext-discord: bot logged in as OpenOrbit#1234"`.

### 6. Test it

DM the bot on Discord. Try `/jobs` or type "any new jobs?"

## Discord-Specific Advantages

- **Buttons** — approve/reject buttons on job embeds (like Telegram, unlike iMessage/WhatsApp)
- **Embeds** — rich formatted job cards with fields, colors, and thumbnails
- **Slash commands** — native Discord UI with autocomplete, descriptions, and parameter hints
- **Cross-platform** — Discord runs on iOS, Android, macOS, Windows, Linux, and web
- **No phone number** — only a Discord account needed

## Key Considerations

- **Message Content Intent** — required privileged intent; must be enabled in Developer Portal
- **2000-char limit** — shorter than other channels; may need more aggressive chunking
- **Slash command sync** — commands register globally (can take up to 1 hour to propagate) or guild-specific (instant)
- **Rate limits** — Discord enforces strict rate limits; discord.js handles queuing automatically
- **Bot must be in a guild** — slash commands require guild membership, even if interaction is via DM

## Security

- Only authorized Discord user IDs can interact via DM
- Bot token stored in OpenOrbit settings DB (not environment variables)
- No guild message processing (DM-only reduces attack surface)
- Slash command responses can be ephemeral (only visible to the invoker)

## Success Criteria

- [ ] Bot logs in and shows online status
- [ ] Slash commands registered and working (/jobs, /status, etc.)
- [ ] DM messages forwarded to AI Gateway
- [ ] Natural language queries return AI-powered responses
- [ ] Job embeds with approve/reject buttons
- [ ] Button interactions trigger approve/reject actions
- [ ] Memory extraction works (reads and writes facts)
- [ ] Only authorized users can interact
- [ ] All tests pass
