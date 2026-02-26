# Phase 7: AI Remote Access

**Theme:** AI-powered remote control from phone. Use Claude Max plan for all AI processing at zero additional cost.

**Effort:** High | **Depends on:** Phase 5 (RPC), Phase 6 (mobile, extension) | **Status:** Complete

## Why This Phase

OpenOrbit runs on a home Mac. With Phases 5-6 providing WebSocket RPC and a mobile companion, the infrastructure for remote access exists. What's missing: an AI layer that understands natural language and translates it into app actions, accessible from a phone via Claude's native interfaces or messaging apps.

OpenClaw (100k+ stars) validated the pattern: local Gateway + messaging channels + AI agent. OpenOrbit already has the Gateway (RPC server, port 18790). This phase adds the AI brain and phone-friendly interfaces.

Key insight: the Claude Max plan subscription includes Agent SDK access for local development. By routing AI through the Agent SDK instead of the Anthropic API, all processing is covered by the existing subscription — $0 additional cost.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 7.1 | [Claude Agent SDK](7.1-claude-agent-sdk/) | High | New AI provider using Agent SDK + Max plan (replaces API-based provider as default) |
| 7.2 | [MCP Server](7.2-mcp-server/) | Medium | Expose OpenOrbit as MCP tools for Claude Desktop/phone/web |
| 7.3 | [Telegram Bot](7.3-telegram-bot/) | Medium | Always-on messaging bot for phone access via Telegram |
| 7.4 | [Remote Access](7.4-remote-access/) | Low | Tailscale integration for phone access outside LAN |

## Architecture Overview

```
Phone
  ├── Claude app/web ──→ MCP Server ──→ RPC Server ──→ OpenOrbit
  ├── Telegram ─────────→ ext-telegram ──→ Agent SDK ──→ OpenOrbit
  └── iOS Companion ───→ RPC Server ──→ OpenOrbit (existing)

Home Mac
  ├── OpenOrbit (Electron)
  │     ├── ext-ai-claude-sdk (default AI provider, Max plan)
  │     ├── ext-telegram (bot gateway)
  │     └── RPC Server (port 18790)
  ├── openorbit-mcp (standalone, connects to RPC)
  └── Tailscale (network, optional)
```

## Success Criteria

- [x] All AI processing uses Max plan via Agent SDK (zero API cost)
- [x] Claude Desktop can control OpenOrbit via MCP tools
- [x] Telegram bot responds to natural language job queries from phone
- [x] RPC server accessible from phone via Tailscale
