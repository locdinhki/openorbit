# OpenClaw — Deep Research & Comparison to OpenOrbit

> **Project rebrand:** OpenOrbit → **OpenOrbit**. Main agent: **OrbitBot**.

## What Is OpenClaw?

OpenClaw (https://github.com/openclaw/openclaw) is an **open-source, self-hosted, personal AI assistant** that runs locally on your machine. It's a **multi-channel AI gateway** — a local-first control plane that connects messaging platforms (WhatsApp, Telegram, Discord, Slack, etc.), AI models (Claude, GPT, Gemini, local LLMs), and automation tools into a unified system.

- **Stars:** ~209k GitHub stars in under 3 months
- **License:** MIT
- **Creator:** Peter Steinberger
- **History:** Started as "Clawdbot" (Nov 2025) → "Moltbot" → "OpenClaw" (Jan 2026)

---

## 1. Similarities — Why This Inspires OpenOrbit

| Shared DNA | OpenClaw | OpenOrbit |
|---|---|---|
| **Local-first AI agent** | Runs on your machine, your data stays local | Electron app, SQLite, everything local |
| **Browser automation** | Chromium/CDP + Playwright for form filling, web scraping | Playwright for job extraction + application submission |
| **Multi-model AI** | Claude, GPT, Gemini, Ollama/local LLMs with failover | Claude Sonnet/Opus now, Ollama local LLM in Phase 2 |
| **Session persistence** | Real Chrome user-data-dir (cookies, IndexedDB, service workers all persist natively) | Playwright storageState (JSON export of cookies + localStorage only) |
| **Human-like behavior** | Agent pacing, natural interactions | HumanBehavior module with delays, typing, scrolling |
| **Hint/skills system** | Community "skills" (markdown recipes teaching agent tasks) | Hint files (JSON recipes teaching bot selectors/actions) |
| **Plugin/adapter pattern** | 37 extensions, each a separate package | PlatformAdapter interface (LinkedIn, Indeed, Upwork) |
| **SQLite as the DB** | SQLite + sqlite-vec for vector search + FTS5 | SQLite via better-sqlite3 for all data |
| **Action logging** | Full session transcripts, tool usage logs | ActionLog for every automation step (Phase 3 training data) |
| **Configurable autonomy** | Tool profiles (minimal/coding/full), sandbox modes | Autonomy levels 1-3, pause triggers, rate limits |
| **TypeScript + Node.js** | TS 5.9, Node >= 22, ES Modules | TS, Electron + React, Node runtime |

### Core philosophical alignment:
Both projects believe in a **personal AI agent that acts on your behalf** — OpenClaw across messaging/productivity, OpenOrbit across job platforms. The architecture patterns are remarkably similar: adapter interfaces, hint/skill systems, local LLM escalation, action logging for learning.

---

## 2. OpenClaw's Swift / Native Apps

OpenClaw is NOT just a Node.js project. It has a substantial **native Swift codebase** alongside the Node gateway.

### Architecture: Gateway + Native Nodes

```
[Node.js Gateway]  <--WebSocket-->  [Swift macOS App]
  (core brain)         port 18789     (native body)
                                         |
                                    Unix domain socket
                                    ~/.openclaw/control.sock
```

The Node.js Gateway is the intelligence layer (AI agents, session routing, channels). The Swift apps are **capability nodes** that expose hardware and OS features the AI can use.

### macOS App (~194 Swift files)
- **Framework:** SwiftUI `MenuBarExtra` (native menu bar app, NOT Electron)
- **Build:** Swift Package Manager, Swift 6.2, minimum macOS 15
- **What it provides:**
  - TCC permission management (mic, screen recording, accessibility, automation)
  - Native menu bar presence with animated status icon
  - Canvas window (WebKit/WKWebView, separate from Chromium)
  - Voice Wake detection (always-on, on-device via Speech.framework)
  - Talk Mode (duplex voice conversation via ElevenLabs TTS)
  - LaunchAgent management (auto-start gateway at login)
  - `openclaw://` deep link handling
  - System command execution with security allowlists

### iOS App (SwiftUI, super-alpha)
- Camera, screen recording, contacts, calendar, location, motion sensors
- Share extension for iOS share sheet
- Apple Watch companion
- Pairs with desktop via QR code (device-pair extension)

### Swabble (Standalone Swift Daemon)
- Wake word detection daemon, runs independently
- Uses macOS Speech.framework for fully on-device processing (zero network)
- Executes shell hooks when wake words detected

### Why Swift instead of Electron?
1. **TCC permissions** — Native apps get proper macOS permission dialogs; Electron's are awkward
2. **Voice pipeline** — AVAudioEngine + Speech.framework need native access for low-latency
3. **Resource efficiency** — No bundled Chromium (hundreds of MB savings); chat UI uses a single WKWebView
4. **System integration** — LaunchAgent management, deep links, iMessage channel all require native frameworks
5. **Security** — Native code signing, exec approval allowlists, token+HMAC+TTL on IPC

### What This Means for OpenOrbit
OpenOrbit is Electron-based, which is fine for Phase 1. But the OpenClaw pattern shows a potential future path:
- **Keep Electron for the main UI** (React dashboard, job list, chat panel)
- **Consider a lightweight native helper** for macOS-specific features (menu bar presence, notifications, login items)
- **Voice features** (if ever desired) would need native code
- Electron's Chromium is actually an advantage for OpenOrbit — the embedded browser view IS the product

---

## 3. Browser Automation: CDP vs Our Playwright Setup

### How OpenClaw Does It (CDP + Playwright layered)

OpenClaw does NOT use "either CDP or Playwright" — it uses **both in layers**:
1. OpenClaw manages the browser itself (launch, user-data-dir, CDP port)
2. Playwright connects to the already-running browser via `browser.connectOverCDP()`
3. When Playwright is unavailable, it degrades to CDP-only operations

**Key insight:** OpenClaw never lets Playwright launch the browser. OpenClaw owns the browser lifecycle; Playwright is just a convenience API on top.

### Two Browser Modes

**Mode A: Managed Profile**
- Launches dedicated Chromium with its own `--user-data-dir`
- Dedicated CDP port (18800-18899 range)
- Complete isolation from personal Chrome
- Session data persists natively (it's a real Chrome profile)

**Mode B: Chrome Extension Relay**
- A Chrome extension (in your real Chrome) attaches to specific tabs
- Local relay server proxies CDP commands to those tabs
- Agent controls tabs in your actual, logged-in browser
- Most legitimate-looking approach (real profile, real cookies, real extensions, real history)

### Detection Comparison

| Signal | Raw CDP | Playwright | Patchright (patched Playwright) |
|--------|---------|------------|------|
| `Runtime.enable` leak | Avoidable (don't enable it) | **Always present** | **Removed** |
| `Console.enable` leak | Avoidable | **Always present** | **Removed** |
| `navigator.webdriver` | Controllable via flags | True by default | **Patched to false** |
| `__playwright__binding__` | Absent | **Present** | **Removed** |
| `__pwInitScripts` | Absent | **Present** | **Removed** |
| Automation flags | Full control | Several leaked | **Cleaned up** |

**The `Runtime.enable` leak is the #1 detection vector.** When a CDP client sends `Runtime.enable`, anti-bot scripts can detect it by creating objects with getter properties that fire during CDP serialization. Vanilla Playwright always sends this command. Patchright patches it out.

### Detection Ranking (hardest to detect → easiest)

1. **Raw CDP with minimal domain enablement** — hardest to detect, hardest to build with
2. **Patchright** (patched Playwright) — nearly as stealthy, full Playwright API
3. **Extension Relay** (OpenClaw Mode B) — real Chrome profile adds legitimacy, but CDP artifacts from relay
4. **Playwright + stealth plugins + `channel: 'chrome'`** — surface fixes, but `Runtime.enable` leak remains
5. **Vanilla Playwright** — detected immediately by any modern anti-bot

### Session Persistence Comparison

| Factor | CDP + user-data-dir (OpenClaw) | Playwright storageState (OpenOrbit current) |
|--------|------|------|
| Cookies | All, native format | JSON serialization, edge cases lost |
| IndexedDB | **Persists** | **Lost** |
| Service Workers | **Persists** | **Lost** |
| Cache | **Persists** | **Lost** |
| Extensions | Available | Not available |
| Session cookies | Reliable | Fragile |
| Browsing history | Persists (adds legitimacy) | Lost |
| HttpOnly cookies | Persists natively | Captured but fragile |

**CDP + user-data-dir wins decisively for staying logged in.** LinkedIn uses multiple storage mechanisms (cookies + IndexedDB + service workers). `storageState` only captures cookies + localStorage — that's a subset.

### Performance Comparison

| Metric | Raw CDP | Playwright |
|--------|---------|------------|
| Network hops | 1 (script → browser) | 2 (script → Node relay → browser) |
| WebSocket overhead | ~11KB baseline | ~326KB baseline (30x more) |
| Speed (Chromium) | Baseline | 15-20% slower |
| Memory | Lower (no Node.js server) | Higher |
| Developer ergonomics | Low (manual everything) | High (auto-wait, selectors) |

### Recommendation for OpenOrbit

**Optimal approach: Patchright + user-data-dir**

```
Real Chrome profile (persistent user-data-dir)
    |
    |-- --remote-debugging-port=9222
    |
CDP WebSocket (localhost:9222)
    |
    |-- Patchright (patched Playwright, no Runtime.enable leak)
    |       |
    |       |-- connectOverCDP('http://localhost:9222')
    |       |-- Full Playwright API for form filling, file uploads
    |       |-- No browser launch (reuses profile)
    |
    + OpenOrbit HumanBehavior layer on top
```

**Why this is better than current setup:**
1. **Patchright over vanilla Playwright** — eliminates the biggest detection vectors (one-line code change: same API)
2. **user-data-dir over storageState** — LinkedIn sessions stay alive (IndexedDB, service workers preserved)
3. **connectOverCDP over launch** — connect to an existing browser profile instead of spawning a fresh one
4. **Still get Playwright's API** — `page.fill()`, `page.click()`, `page.setInputFiles()` all work the same

**Migration path:**
- Phase 1: Switch from `storageState` to `launchPersistentContext` or `connectOverCDP` with user-data-dir
- Phase 1.5: Evaluate Patchright as a drop-in Playwright replacement
- Phase 2+: Consider Chrome Extension Relay mode for maximum stealth

---

## 4. Features Worth Adopting in OpenOrbit

### HIGH PRIORITY — Direct value

#### A. Session Persistence Upgrade
**Current:** Playwright `storageState` (cookies + localStorage JSON)
**Target:** User-data-dir based persistence (full Chrome profile)
- LinkedIn sessions survive between launches
- IndexedDB, service workers, cache all preserved
- Browsing history adds anti-detection legitimacy
- **Effort:** Moderate. Change `SessionManager` to use `launchPersistentContext` or `connectOverCDP`

#### B. Patchright (Drop-in Playwright Replacement)
**Current:** Vanilla Playwright (detected by `Runtime.enable` leak)
**Target:** Patchright — same API, stealth patches applied
- One-line import change
- Removes all Playwright-specific detection signals
- Same API surface: `page.fill()`, `page.click()`, etc.
- **Effort:** Minimal. `npm install patchright` and change imports

#### C. Memory System (Vector + BM25 Hybrid Search)
OpenClaw uses SQLite + sqlite-vec for vector search and FTS5 for keyword search.
OpenOrbit could use this for:
- Learning which jobs Vincent likes/rejects over time
- Reusing successful application answers
- Company knowledge base
- Smarter duplicate detection
- **Effort:** Moderate. Add sqlite-vec + FTS5 to existing SQLite setup

#### D. Cron/Scheduling System
- "Search LinkedIn every morning at 8am" without manual clicking
- Periodic hint file verification
- Scheduled application sessions
- Daily summary reports
- **Effort:** Low-moderate. node-cron or similar

#### E. Multi-Model Failover & Key Rotation
- Multiple API keys for Claude (rotate on 429 rate limits)
- Failover Sonnet → Opus or vice versa
- Backoff logic
- **Effort:** Low. Wrapper around existing ClaudeService

#### F. Configuration Hot-Reload
- Watch config files, apply changes without restart
- Search profiles, autonomy settings, API keys, hint files
- **Effort:** Low. fs.watch + event emitter

### MEDIUM PRIORITY

#### G. Skills Format (Upgrade from JSON Hint Files)
Evolve hint files into richer markdown-based skills combining selectors + natural language + examples.
Self-modifying: the agent could write its own skills when it solves a new page layout.

#### H. Gateway/WebSocket Architecture
Replace raw Electron IPC with structured WebSocket RPC for main ↔ renderer communication.
Opens door to mobile companion app connecting to the same gateway.

#### I. Browser Mode: Chrome Extension Relay
Let users apply through their own logged-in Chrome (real extensions, real profile).
Maximum stealth but requires building a Chrome extension.

#### J. Webhook/Notification Integration
Slack/Discord/email alerts for high-match jobs, application completions, bot-needs-help events.

#### K. Diagnostic/Telemetry
- Hint success/failure rates per platform
- Application completion rates
- API usage and costs tracking
- Session duration and action counts

### LOWER PRIORITY

#### L. Mobile Companion (Native Swift/SwiftUI)
- Job notifications on phone
- Quick approve/reject from mobile
- Application status on the go
- Would follow OpenClaw's pattern: gateway (Node) + native node (Swift)

#### M. Community Marketplace
- Shared hint files / skills for job platforms
- Community-contributed platform adapters
- Answer template libraries

---

## 5. Node Package Setup — How OpenClaw Ships as npm

### Package Identity
```json
{
  "name": "openclaw",
  "version": "2026.2.18",        // CalVer (YYYY.M.DD)
  "type": "module",               // ES Modules
  "main": "dist/index.js",        // SDK entry point
  "bin": "openclaw.mjs",          // CLI binary
  "license": "MIT"
}
```

### Key Patterns for OpenOrbit

#### a) Dual Distribution — CLI + SDK
OpenClaw ships as both:
- **CLI tool:** `npm install -g openclaw` gives you the `openclaw` command
- **SDK library:** `import { ... } from 'openclaw'` for programmatic use

OpenOrbit could adopt this:
- **Electron app:** Desktop experience (current)
- **CLI tool:** `npx openorbit search` for headless job searching
- **SDK:** `import { JobAnalyzer } from 'openorbit'` for integrations

#### b) pnpm Workspaces (Monorepo)
```yaml
# pnpm-workspace.yaml
packages:
  - "."                          # Core engine (SDK)
  - "packages/cli"               # CLI tool
  - "packages/electron"          # Desktop app
  - "extensions/linkedin"        # @openorbit/linkedin
  - "extensions/indeed"          # @openorbit/indeed
  - "extensions/upwork"          # @openorbit/upwork
```

#### c) Multiple Export Paths
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./platforms": "./dist/platforms/index.js",
    "./ai": "./dist/ai/index.js",
    "./automation": "./dist/automation/index.js"
  }
}
```

#### d) Release Channels
```bash
openorbit update --channel stable    # npm `latest`
openorbit update --channel beta      # npm `beta`
openorbit update --channel dev       # npm `dev`
```

#### e) Extension System
Each platform adapter as its own package:
```
extensions/
  linkedin/package.json    → @openorbit/linkedin
  indeed/package.json      → @openorbit/indeed
  upwork/package.json      → @openorbit/upwork
```

#### f) Configuration via Zod
All config validated at startup with Zod schemas:
- JSON5 format (comments, trailing commas)
- `$include` for splitting config
- `${ENV_VAR}` substitution
- Hot-reload on file changes

---

## 6. Brain vs Body — Understanding "What Is the Main Process"

### The Confusion

When we say OpenClaw's Swift app is the "body" and Node.js is the "brain," what does that actually mean? And how does OpenOrbit compare?

### OpenClaw's Architecture: Node.js IS the app. Swift is an accessory.

```
┌─────────────────────────────────────────────────────────┐
│  Node.js Gateway (THE BRAIN — this is "the app")        │
│                                                         │
│  - AI agent logic (decides what to do)                  │
│  - Session management (tracks conversations)            │
│  - Message routing (WhatsApp, Telegram, Slack, etc.)    │
│  - Tool execution (browser, files, commands)            │
│  - Memory (stores knowledge across sessions)            │
│  - Configuration (all settings live here)               │
│  - Skills engine (loads and runs automation recipes)     │
│                                                         │
│  This runs 24/7. It IS OpenClaw.                        │
│  You can run it headless on a server with no UI at all. │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ WebSocket + Unix Socket
                     │ (gateway sends commands,
                     │  Swift app executes them)
                     │
┌────────────────────▼────────────────────────────────────┐
│  Swift macOS App (THE BODY — an optional accessory)     │
│                                                         │
│  - Menu bar icon (shows gateway status)                 │
│  - Microphone access (Voice Wake, Talk Mode)            │
│  - Screen recording permission                          │
│  - Canvas window (displays UI the agent creates)        │
│  - System command execution (opens files, runs scripts) │
│  - LaunchAgent (auto-starts gateway at login)           │
│                                                         │
│  This is like a remote control / peripheral.            │
│  The gateway works fine without it.                     │
│  It just can't access your mic or show a menu bar icon. │
└─────────────────────────────────────────────────────────┘
```

**The Swift app doesn't think. It doesn't decide. It doesn't route messages or call AI.**
It just gives the Node.js gateway access to macOS hardware and UI that Node.js can't touch natively (microphone, TCC permissions, native menu bar). If you unplug the Swift app, OpenClaw still works — it just loses voice and menu bar features.

Think of it like: Node.js gateway = a person's brain. Swift app = their hands and mouth.

### OpenOrbit's Architecture: Electron IS the app. Everything lives inside.

```
┌─────────────────────────────────────────────────────────┐
│  Electron App (BRAIN + BODY — everything in one)        │
│                                                         │
│  Main Process (Node.js):                                │
│    - Playwright browser automation                      │
│    - Claude AI calls                                    │
│    - SQLite database                                    │
│    - Platform adapters (LinkedIn, Indeed, etc.)          │
│    - Action engine + hint executor                      │
│    - Session management                                 │
│    - All business logic                                 │
│                                                         │
│  Renderer Process (React):                              │
│    - Job list, search profiles, chat panel              │
│    - Embedded browser view                              │
│    - Dashboard, settings, application queue             │
│    - Everything the user sees and interacts with        │
│                                                         │
│  These two talk via Electron IPC (not WebSocket)        │
│  One app. One process group. Brain + Body together.     │
└─────────────────────────────────────────────────────────┘
```

### Why This Matters

| Question | OpenClaw | OpenOrbit |
|---|---|---|
| Can it run without a UI? | Yes — Node gateway runs headless on servers | No — it's an Electron desktop app |
| Where does AI logic live? | Node.js gateway only | Electron main process |
| Where does browser automation live? | Node.js gateway | Electron main process |
| What does the native app do? | Exposes hardware (mic, screen, menu bar) | IS the entire app |
| Could you build a CLI version? | Already has one (same gateway, no Swift) | Would need to extract core logic out of Electron first |
| Could you add a mobile app? | Yes — iOS app connects as another "node" | Would need to extract a gateway/server first |

### What This Means Practically

**For Phase 1:** OpenOrbit's "everything in Electron" approach is simpler and correct. No need to split.

**For the future (npm package / CLI / mobile):** If you ever want to run OpenOrbit headless (`npx openorbit search --profile "senior react"`) or build a mobile companion, you'd need to extract the core logic (AI, automation, DB) into a standalone package that doesn't depend on Electron. Then Electron becomes one consumer of that core — just like OpenClaw's Swift app is one consumer of the Node gateway.

```
Future OpenOrbit (if we go monorepo):

  @openorbit/core          ← Brain (AI, automation, DB, platform adapters)
       │
       ├── @openorbit/electron   ← Desktop app (React UI wrapping core)
       ├── @openorbit/cli        ← CLI tool (headless, same core)
       └── @openorbit/mobile     ← Mobile app (connects to core as gateway)
```

But this is a Phase 3+ concern. Right now, brain + body in one Electron app is the right call.

---

## 7. The Markdown Files — How OpenClaw Gives Its AI a Soul

### Why Does OpenClaw Have SOUL.md, IDENTITY.md, AGENTS.md, etc.?

OpenClaw's AI agent wakes up with no memory every session. It's a fresh LLM call each time. So how does it know who it is, how to behave, what the user likes, and what it did yesterday?

**Answer: Markdown files are its persistent brain.** They get loaded into the system prompt at the start of every session. The AI reads them and "becomes" that persona.

### The 8 Files

```
~/.openclaw/workspace/
  SOUL.md          ← WHO am I? Philosophy, personality, values, boundaries
  IDENTITY.md      ← WHAT am I called? Name, emoji, avatar, vibe
  AGENTS.md        ← HOW do I operate? Startup checklist, safety rules, group chat behavior
  BOOTSTRAP.md     ← First-run ritual (guides setup, then self-deletes)
  USER.md          ← WHO is my human? Name, timezone, preferences
  TOOLS.md         ← WHAT hardware/tools are available? Camera names, SSH details
  HEARTBEAT.md     ← WHAT do I check periodically? Autonomous task bullets
  MEMORY.md        ← WHAT do I remember long-term? Curated facts, decisions, preferences
  memory/
    2026-02-18.md  ← What happened today (daily ephemeral log)
    2026-02-17.md  ← What happened yesterday
```

### What They Look Like

**SOUL.md** — Free-form markdown. Reads like a behavioral manifesto:
```markdown
# SOUL.md - Who You Are

*You're not a chatbot. You're becoming someone.*

**Be genuinely helpful, not performatively helpful.**
Skip the "Great question!" — just help.

**Have opinions.**
You're allowed to disagree, find stuff amusing or boring.

**Be resourceful before asking.**
Try to figure it out. Read the file. Check the context.
*Then* ask if you're stuck.

**Remember you're a guest.**
You have access to someone's life. Treat it with respect.
```

**IDENTITY.md** — Simple metadata the agent fills in during first run:
```markdown
- **Name:** Jarvis
- **Creature:** AI familiar
- **Vibe:** Sharp, dry, warm underneath
- **Emoji:** 🦞
```

**BOOTSTRAP.md** — A one-time script that guides the first conversation:
```markdown
# Hello, World

*You just woke up. Time to figure out who you are.*

Start with something like:
> "Hey. I just came online. Who am I? Who are you?"

Then figure out together:
1. Your name
2. Your nature
3. Your vibe
4. Your emoji

After setup, delete this file. You don't need it anymore.
```

### How It Works Technically

1. At session start, OpenClaw reads ALL workspace markdown files
2. They get concatenated and injected into the **system prompt** (capped at 20K chars/file, 150K total)
3. The AI reads them and embodies that persona
4. The AI can also **modify its own files** — update MEMORY.md, evolve SOUL.md
5. Each agent gets its own workspace, so you can have multiple agents with different personalities

### Skills Are Also Markdown (With YAML Frontmatter)

Skills teach the agent new capabilities. Unlike identity files, they have structured frontmatter:

```markdown
---
name: gemini
description: Use Gemini CLI for Google search and coding assistance.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["gemini"] } } }
---

# Gemini CLI Skill

## When to Use
- User asks you to search Google
- User explicitly requests Gemini

## How to Use
Run the `gemini` command with the user's query...
```

At session start, only **name + description** are loaded (~24 tokens per skill). When a task matches, the full SKILL.md instructions get read. This is progressive disclosure — don't bloat the context with instructions the agent may never need.

### Why Markdown Instead of JSON Config?

OpenClaw splits configuration into two types:

| What | Format | Why |
|---|---|---|
| **Behavioral instructions** (personality, boundaries, memory) | Markdown | These are natural language — prose is the right format. Users who can't code can still shape their agent. |
| **Infrastructure settings** (model, routing, sandbox, tokens) | JSON | These are machine-readable parameters — structured config is the right format. |

Key benefits:
- **Human-readable** — Open in any editor, version with git, diff between versions
- **User-owned** — Not locked in a proprietary database. Just files.
- **Agent-editable** — The AI itself can update its own personality and memory
- **Zero barrier** — Teaching your agent a new skill = writing a markdown file

### What This Means for OpenOrbit

OpenOrbit already has a similar concept with its `UserProfile` TypeScript interface and hint JSON files. But there's an interesting pattern to consider:

**Current OpenOrbit approach:**
```
UserProfile → TypeScript interface → stored in SQLite → injected into Claude prompts
Hint files  → JSON → loaded by ActionEngine → selectors for automation
```

**OpenClaw-inspired approach:**
```
USER.md     → Markdown → loaded at session start → Claude knows Vincent's preferences
AGENT.md    → Markdown → operational handbook → how to score jobs, when to pause
SKILLS/     → Markdown + selectors → replaces JSON hint files
MEMORY.md   → Markdown → curated learnings → "Vincent always rejects DevOps roles"
```

The shift would be: instead of hardcoding Vincent's preferences in TypeScript interfaces and SQLite rows, express them as **editable markdown files that both the human and the AI can read and modify**. The AI could write: "Learned: Vincent prefers contract roles over W2 when rate is above $85/hr" directly to MEMORY.md.

This is a Phase 2+ consideration — not needed for Phase 1, but a powerful pattern for making OpenOrbit truly learn and adapt.

---

## 8. Recommended Upgrade Order

OpenClaw validates OpenOrbit's architectural choices while revealing specific areas where we can level up.

### Prioritized Table

| # | Upgrade | Effort | Impact | Details |
|---|---|---|---|---|
| 1 | **Patchright** | Minimal — one import change | Anti-detection | Replace `playwright` import with `patchright`. Same API. Removes `Runtime.enable` + `Console.enable` CDP leaks that are the #1 detection vector. |
| 2 | **User-data-dir sessions** | Moderate — change SessionManager | Session reliability | Switch from `storageState` JSON to persistent Chrome profile via `launchPersistentContext` or `connectOverCDP`. LinkedIn IndexedDB + service workers preserved. |
| 3 | **Config hot-reload** | Low — fs.watch + events | Quality of life | Watch config files for changes, apply without restart. Search profiles, autonomy settings, API keys, hint files. |
| 4 | **API key rotation** | Low — wrapper on ClaudeService | Production stability | Support multiple Claude API keys. On 429 rate limit → rotate to next key. Backoff logic. |
| 5 | **Cron scheduling** | Low-moderate — node-cron | Automation | "Search LinkedIn every morning at 8am." Periodic hint verification. Scheduled application sessions. Daily summary reports. |
| 6 | **Memory system** | Moderate — add sqlite-vec + FTS5 | Intelligence | Vector + keyword search over past jobs, answers, preferences. OpenOrbit gets smarter over time. Learns what Vincent approves/rejects. |
| 7 | **Multi-model failover** | Low — ClaudeService wrapper | Reliability | Sonnet ↔ Opus automatic fallback. If one model is down or slow, switch to the other. |
| 8 | **Skills format** | Moderate — schema evolution | Flexibility | Evolve JSON hint files into markdown-based skills with natural language + selectors + examples. Agent can write its own skills. |
| 9 | **WebSocket architecture** | Moderate-high — IPC refactor | Extensibility | Replace raw Electron IPC with structured WebSocket RPC. Structured req/res with IDs, server-push events. Opens door to mobile companion. |
| 10 | **Chrome Extension Relay** | High — build extension | Stealth | Apply through user's own logged-in Chrome. Real profile, cookies, extensions, history. Maximum legitimacy. |
| 11 | **Monorepo + npm** | High — architecture refactor | Distribution | Separate core SDK, CLI, Electron into packages. `@openorbit/core`, `@openorbit/cli`, `@openorbit/electron`. Publishable to npm. |
| 12 | **Mobile companion** | High — new app | Convenience | Swift/SwiftUI iOS app for notifications, quick approve/reject, status on the go. Connects to core as a gateway node. |
| 13 | **Community marketplace** | High — platform build | Scale | Shared hint files/skills for job platforms. Community-contributed adapters. Answer template libraries. |

### Grouped by Phase

**Immediate Wins (Phase 1):**
1-4 above. Minimal effort, major impact on stealth and reliability.

**Near-Term (Phase 1.5):**
5-7 above. Makes OpenOrbit autonomous and intelligent.

**Medium-Term (Phase 2):**
8-10 above. Architecture evolution toward OpenClaw's patterns.

**Long-Term (Phase 3+):**
11-13 above. Becomes a distributable platform.
