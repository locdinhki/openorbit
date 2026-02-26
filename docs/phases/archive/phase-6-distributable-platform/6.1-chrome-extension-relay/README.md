# 6.1: Chrome Extension Relay (COMPLETE ✓)

**Effort:** High | **Status:** Complete

## Background

From [OpenClaw Analysis Section 3](../../research/openclaw-analysis.md) (Mode B): A Chrome extension in the user's real Chrome attaches to specific tabs and relays CDP commands. The agent controls tabs in the user's actual, logged-in browser. Maximum stealth.

## How It Works

```
User's real Chrome (logged into LinkedIn, etc.)
    |
    |-- OpenOrbit Chrome Extension (Manifest V3)
    |       |
    |       |-- Attaches to LinkedIn tab via chrome.debugger API
    |       |-- Forwards CDP commands to/from OpenOrbit
    |
    |-- WebSocket connection to OpenOrbit
    |       |
    |       |-- OpenOrbit core sends automation commands
    |       |-- Extension executes in real browser context
```

## Tasks

### Chrome Extension
- [x] Build Manifest V3 extension:
  - `chrome.debugger` API for CDP access
  - Popup UI: "Enable Relay" button per tab
  - Background service worker for WebSocket connection
  - Permission: `debugger`, `tabs`, `activeTab`

### Relay Protocol
- [x] WebSocket connection from extension to OpenOrbit's WS server (Phase 5.1)
- [x] Forward CDP commands (click, type, navigate) from core to extension
- [x] Forward DOM snapshots and screenshots from extension to core
- [x] Authentication: same token-based auth as WebSocket RPC

### Integration
- [x] Core's SessionManager detects relay mode vs managed browser mode
- [x] When relay is active, skip Patchright entirely — use the extension's CDP channel
- [x] No user-data-dir needed — user is already logged in

## Advantages Over Managed Browser

| Signal | Managed Browser | Extension Relay |
|--------|----------------|-----------------|
| Browser fingerprint | New profile | Real profile |
| Cookies | Persistent but separate | User's actual cookies |
| Extensions | None | User's real extensions |
| History | Empty or minimal | Full browsing history |
| Detection risk | Low (with Patchright) | Minimal |

## Success Criteria

- [x] Chrome extension installable from local package
- [x] Can relay automation commands to a LinkedIn tab
- [x] No Playwright/Patchright artifacts detectable
- [x] User's existing login session used directly
