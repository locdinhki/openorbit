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

### ext-db-viewer (Database Viewer)

| Field | Value |
|-------|-------|
| **ID** | `ext-db-viewer` |
| **Display Name** | Database |
| **Package** | `@openorbit/ext-db-viewer` |

**What it does:** Full-featured database viewer and editor for the app's SQLite database. Browse schemas, view/edit data with pagination and filtering, run raw SQL (dev mode), and import/export tables.

**Capabilities:**
- Schema browser — tables, columns, indexes, row counts
- Data grid — sortable, filterable, paginated (up to 500 rows/page)
- Inline cell editing + full-record editor modal
- SQL console (dev mode only) — parameterized queries, history
- CSV and JSON import/export with column mapping
- Dev mode toggle gates destructive operations

**IPC Channels:** 13 channels covering schema inspection, data access, CRUD, SQL execution, dev mode, and import/export.

| Channel | Description |
|---------|-------------|
| `ext-db-viewer:schema-tables` | List all tables with row counts |
| `ext-db-viewer:schema-columns` | Column definitions for a table |
| `ext-db-viewer:schema-indexes` | Index info for a table |
| `ext-db-viewer:table-data` | Query data with pagination, sorting, filtering |
| `ext-db-viewer:record-update` | Update record by primary key |
| `ext-db-viewer:record-insert` | Insert new record |
| `ext-db-viewer:record-delete` | Delete record (dev mode required) |
| `ext-db-viewer:sql-execute` | Run raw SQL (dev mode required) |
| `ext-db-viewer:dev-mode` | Get/set developer mode flag |
| `ext-db-viewer:export-table` | Export table to CSV or JSON |
| `ext-db-viewer:import-select` | File picker for import |
| `ext-db-viewer:import-preview` | Parse and preview import with column matching |
| `ext-db-viewer:import-execute` | Execute import with column mapping (transactional) |

**Database Tables:** None — introspects existing tables via `sqlite_master` and `PRAGMA` queries. Stores dev-mode flag in the core `settings` table.

**UI Contributions:**
- **Sidebar** — table list with schema drill-down
- **Workspace** — data grid with filters, pagination, inline editing
- **Panel** — SQL console with query history

**Setup:** No configuration needed. Activates on startup. Toggle dev mode in the sidebar to unlock SQL console and delete operations.

---

### ext-zillow (Zillow Property Data)

| Field | Value |
|-------|-------|
| **ID** | `ext-zillow` |
| **Display Name** | Zillow |
| **Package** | `@openorbit/ext-zillow` |

**What it does:** Scrapes Zillow Zestimate values for property addresses using headless browser automation (Patchright). Caches results locally for fast re-lookups. Provides the scraping engine that ext-ghl uses for ARV enrichment.

**Capabilities:**
- Address-to-Zestimate lookup via Zillow.com scraping
- Local SQLite cache with deduplication
- Cache management (list, delete, purge)
- Real-time scrape progress push events
- Cross-extension API consumed by ext-ghl

**IPC Channels:** 6 channels.

| Channel | Description |
|---------|-------------|
| `ext-zillow:search` | Scrape Zillow for address and cache result |
| `ext-zillow:get-arv` | Cache-first ARV lookup |
| `ext-zillow:cache-list` | List cached lookups |
| `ext-zillow:cache-delete` | Delete single cache entry |
| `ext-zillow:cache-purge` | Delete all cache entries |
| `ext-zillow:scrape-progress` | Push: real-time scraping status |

**Database Tables:** 1 table (`arv_cache`) — stores address, Zestimate, Zillow URL, errors, and timestamp. Indexed on `(address1, city, state, postal_code)`.

**How the Scraper Works:**
1. Constructs Zillow URL from address components
2. Navigates via Patchright (headless Chrome with anti-detection)
3. If on a search results page, clicks the first property card
4. Extracts Zestimate via DOM TreeWalker (validates $10K–$10M range)
5. Caches result and returns

**UI Contributions:**
- **Sidebar** — address form + recent lookups list
- **Workspace** — Zestimate display with Zillow link

**Prerequisites:**
- Patchright browser (managed by core's SessionManager)

**Setup:** No configuration needed. Activates on startup.

---

### ext-ghl (GoHighLevel CRM)

| Field | Value |
|-------|-------|
| **ID** | `ext-ghl` |
| **Display Name** | GoHighLevel |
| **Package** | `@openorbit/ext-ghl` |

**What it does:** Full CRM integration with GoHighLevel. Syncs contacts, pipelines, opportunities, conversations, and calendars. Includes AI-powered chat with tool calling, daily briefings, and automated Zillow ARV enrichment for real estate contacts.

**Capabilities:**
- Contact sync and CRUD
- Pipeline board with opportunity management
- Conversation threads (send SMS/Email)
- Calendar and event viewing
- AI chat with 6 CRM tools (agentic loop)
- Daily briefing generation
- ARV enrichment automation (cross-extension with ext-zillow)

**IPC Channels:** 30 channels.

| Group | Channels | Description |
|-------|----------|-------------|
| Settings | `settings-get`, `settings-set`, `connection-test` | API token and location ID management |
| Contacts | `contacts-list`, `contacts-get`, `contacts-create`, `contacts-update`, `contacts-delete`, `contacts-sync` | Full contact CRUD + bulk sync |
| Pipelines | `pipelines-list` | List pipelines with stages |
| Opportunities | `opps-list`, `opps-get`, `opps-create`, `opps-update`, `opps-update-status`, `opps-delete`, `opps-sync` | Deal management + status transitions |
| Conversations | `convs-list`, `convs-get`, `convs-messages`, `convs-send` | Message threads + send SMS/Email |
| Calendars | `cals-list`, `cal-events-list` | Calendar and event queries |
| AI Chat | `chat-send`, `chat-clear` | Agentic CRM assistant |
| ARV Enrichment | `arv-enrich-start`, `arv-enrich-status` | Zillow Zestimate automation |
| Custom Fields | `custom-fields-list` | GHL custom field definitions |
| Push Events | `sync-progress`, `arv-enrich-progress` | Real-time progress to renderer |

All channels prefixed with `ext-ghl:`.

**Database Tables:** 4 tables across 2 migrations.

| Table | Migration | Purpose |
|-------|-----------|---------|
| `ghl_contacts` | V1 | Synced contacts with address, tags, custom fields |
| `ghl_opportunities` | V1 | Pipeline deals with status (open/won/lost/abandoned) |
| `ghl_pipelines` | V1 | Pipelines with stages (JSON) |
| `ghl_arv_runs` | V2 | ARV enrichment run history |

**GHL SDK:** Custom SDK with 5 resource classes — Contacts, Opportunities, Calendars, Conversations, CustomFields. Wraps the GHL REST API (`services.leadconnectorhq.com`).

**AI Chat Tools:**

| Tool | Description |
|------|-------------|
| `list_contacts` | Search contacts by name/email/phone/company |
| `get_contact` | Fetch full contact details |
| `list_opportunities` | List pipeline deals (filter by status) |
| `list_calendar_events` | Get appointments by date range |
| `list_conversations` | Get recent conversations |
| `list_pipelines` | Get all pipelines and stages |

**Scheduler Tasks:**
- `ghl-daily-briefing` — AI-generated summary of today's events, conversations, and deals
- `ghl-arv-enrichment` — Bulk Zillow Zestimate lookup for pipeline contacts (writes to GHL custom field)

**UI Contributions:**
- **Sidebar** — 4-tab nav (Contacts, Pipeline, Conversations, Calendars) + connection settings
- **Workspace** — contact/opportunity detail views
- **Panel** — AI chat interface

**Prerequisites:**
- GoHighLevel account with API token and Location ID
- ext-zillow installed (for ARV enrichment)
- At least one AI provider configured (for chat and briefings)

**Setup:**

| Setting Key | Description |
|-------------|-------------|
| `ghl.api-token` | GoHighLevel API Bearer token |
| `ghl.location-id` | GHL Location ID for your workspace |

---

## Messaging Gateway Extensions

Messaging gateways provide remote access to OpenOrbit from mobile devices. Each gateway connects to a different messaging platform but shares the same core pattern: direct commands for quick actions, natural language via Claude Agent SDK for everything else, and voice message transcription via OpenAI Whisper.

**Common Features Across All Gateways:**
- Direct commands: `/jobs`, `/approved`, `/applied`, `/profiles`, `/status`, `/log`, `/help`, `approve N`, `reject N`
- AI-powered natural language queries via Claude Agent SDK (Sonnet)
- Voice message transcription (requires `voice.openai-api-key` setting)
- Authorization allowlists (optional — empty = allow all)
- Memory context awareness across conversations
- Read from ext-jobs data (jobs, profiles, action logs, applications)

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

**Platform-Specific:**
- Inline keyboard buttons for approve/reject on job listings
- Rich text formatting with Telegram markdown
- Message limit: 4096 characters (auto-chunked)

---

### ext-discord (Discord Bot)

| Field | Value |
|-------|-------|
| **ID** | `ext-discord` |
| **Display Name** | Discord Bot |
| **Package** | `@openorbit/ext-discord` |
| **Dependency** | `discord.js` ^14.18.0 |

**What it does:** Discord DM bot gateway for remote job search control. Processes direct messages only (ignores channels). Supports slash commands, rich embeds with approve/reject buttons, and voice message transcription.

**Prerequisites:**
- Discord account
- Discord bot created via [Developer Portal](https://discord.com/developers/applications) with Message Content Intent enabled

**Setup:**

| Setting Key | Description |
|-------------|-------------|
| `discord.bot-token` | Discord bot token from Developer Portal |
| `discord.authorized-user-ids` | Comma-separated Discord user IDs (empty = allow all) |
| `voice.openai-api-key` | OpenAI API key for voice transcription (optional) |

**IPC Channels:** 3 channels.

| Channel | Description |
|---------|-------------|
| `ext-discord:config-get` | Get bot token, authorized user IDs, connection status |
| `ext-discord:config-set` | Update bot config and restart |
| `ext-discord:status` | Bot connected/disconnected status |

**Platform-Specific:**
- Rich embeds with color-coded job status (green=new, blue=approved, red=rejected)
- Approve/Reject action buttons on job listings
- Slash command registration with Discord
- DM-only (group/channel messages ignored)
- Message limit: 2000 characters (auto-chunked)

---

### ext-imessage (iMessage Bot)

| Field | Value |
|-------|-------|
| **ID** | `ext-imessage` |
| **Display Name** | iMessage Bot |
| **Package** | `@openorbit/ext-imessage` |

**What it does:** iMessage bot gateway via BlueBubbles bridge. Receives messages through a local webhook server, processes them with AI, and replies via the BlueBubbles API. macOS only.

**Prerequisites:**
- macOS with iMessage configured
- [BlueBubbles](https://bluebubbles.app/) server running on the same Mac (or accessible on network)

**Setup:**

| Setting Key | Description |
|-------------|-------------|
| `imessage.server-url` | BlueBubbles server URL (e.g., `http://192.168.1.100:1234`) |
| `imessage.password` | BlueBubbles API password |
| `imessage.authorized-handles` | Comma-separated phone numbers/emails (e.g., `+15551234567,user@icloud.com`) |
| `imessage.webhook-port` | Local webhook port (default: `18792`) |
| `voice.openai-api-key` | OpenAI API key for voice transcription (optional) |

**IPC Channels:** 3 channels.

| Channel | Description |
|---------|-------------|
| `ext-imessage:config-get` | Get server URL, password, authorized handles |
| `ext-imessage:config-set` | Update config and restart webhook server |
| `ext-imessage:status` | Webhook server running status |

**Platform-Specific:**
- Webhook-based: runs local HTTP server to receive BlueBubbles webhooks
- Plain text formatting (no markdown/embeds in iMessage)
- DM-only (group messages ignored, self-messages filtered)
- Typing indicator support
- Message limit: 4000 characters (auto-chunked)

---

### ext-whatsapp (WhatsApp Bot)

| Field | Value |
|-------|-------|
| **ID** | `ext-whatsapp` |
| **Display Name** | WhatsApp Bot |
| **Package** | `@openorbit/ext-whatsapp` |
| **Dependency** | `@whiskeysockets/baileys` ^6.7.18 |

**What it does:** WhatsApp bot gateway via Baileys (reverse-engineered WhatsApp Web client). Connects over WebSocket, authenticates via QR code scan, and processes DMs with AI.

**Prerequisites:**
- WhatsApp account on your phone
- Ability to scan QR code during initial pairing

**Setup:**

| Setting Key | Description |
|-------------|-------------|
| `whatsapp.authorized-numbers` | Comma-separated phone numbers in E.164 format (e.g., `15551234567`) |
| `whatsapp.data-dir` | Credential storage directory (default: `{storagePath}/whatsapp-auth`) |
| `voice.openai-api-key` | OpenAI API key for voice transcription (optional) |

**IPC Channels:** 3 channels + 1 push event.

| Channel | Description |
|---------|-------------|
| `ext-whatsapp:config-get` | Get authorized numbers, data dir, connection status |
| `ext-whatsapp:config-set` | Update config and restart client |
| `ext-whatsapp:status` | Connection status |
| `ext-whatsapp:qr-code` | Push: QR code for WhatsApp Web pairing |

**Platform-Specific:**
- QR code pairing (first run or re-auth)
- Persistent credentials via Baileys multi-file auth state
- Auto-reconnect with exponential backoff (up to 60s)
- WhatsApp `*bold*` text formatting
- Read receipts after processing
- DM-only (group messages ignored)
- Message limit: 4000 characters (auto-chunked)

---

## Standalone Packages

### web-ui (Web Interface)

| Field | Value |
|-------|-------|
| **Package** | `@openorbit/web-ui` |
| **Location** | `packages/web-ui/` |
| **Port** | 18791 (HTTP) |

**What it does:** Mobile-first web interface served directly by OpenOrbit. Provides chat, job management, and automation control from any browser — phone, tablet, or laptop. Connects to the existing RPC WebSocket server (port 18790) for all data and AI operations.

**Architecture:** Vite + React 19 SPA with Zustand state management. Built to `packages/web-ui/dist/` and served as static files by a Node.js HTTP server in the Electron main process. Uses browser-native WebSocket to connect to the RPC server.

**Views:**

| View | Description |
|------|-------------|
| **Chat** (default) | Message input + history, loads via `chat.send` / `chat.history` / `chat.clear` RPC methods |
| **Jobs** | Filterable job list (All/New/Approved/Applied/Rejected), approve/reject buttons on new jobs |
| **Status** | Automation running/paused/stopped indicator, start/stop/pause controls, disconnect button |

**Connection:**
- Login screen with WebSocket URL + token input
- Auto-detect from URL hash: `http://host:18791#wsUrl=ws://host:18790&token=TOKEN`
- Credentials persisted in browser localStorage for auto-reconnect
- Default WS URL derived from current page hostname

**RPC Methods (added for web chat):**

| Method | Description |
|--------|-------------|
| `chat.send` | Send message, receive AI response (optionally scoped to a job) |
| `chat.history` | Get conversation history |
| `chat.clear` | Clear conversation |

Existing RPC methods (`jobs.list`, `jobs.approve`, `jobs.reject`, `automation.start`, `automation.stop`, `automation.status`) are reused as-is.

**Server-Side Components:**
- `src/main/web-server.ts` — Node.js `http.createServer` (zero new deps), MIME type handling, SPA fallback
- Binds to `0.0.0.0` on port 18791 (accessible from other devices on the network)
- Web URL included in pairing info: `http://<localIp>:18791`

**Prerequisites:**
- OpenOrbit desktop app running (RPC server on port 18790)

**Setup:** No configuration needed. The web server starts automatically alongside the RPC server. Open `http://localhost:18791` in any browser, enter the RPC token, and connect.

**Mobile Access:** Open `http://<your-ip>:18791` from any device on the same network. With Tailscale, accessible from anywhere on your tailnet.

---

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
5. `ext-db-viewer` — registers database viewer IPC handlers
6. `ext-discord` — starts Discord bot (if configured)
7. `ext-ghl` — registers GoHighLevel CRM handlers + scheduler tasks
8. `ext-imessage` — starts iMessage webhook server (if configured)
9. `ext-jobs` — registers job search IPC handlers + scheduler task
10. `ext-telegram` — starts Telegram bot (if configured)
11. `ext-whatsapp` — starts WhatsApp client (if configured)
12. `ext-zillow` — registers Zillow scraper IPC handlers

The first AI provider that reports `isConfigured() === true` and registers becomes the default. Since ext-ai-claude-sdk activates before ext-ai-claude, the Max plan provider takes priority when available.
