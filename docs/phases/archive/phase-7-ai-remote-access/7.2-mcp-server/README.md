# 7.2: MCP Server

**Effort:** Medium | **Status:** Complete

## Background

The Model Context Protocol (MCP) allows AI assistants like Claude to interact with external tools. By exposing OpenOrbit's capabilities as MCP tools, Claude on any device (Desktop app, phone browser, claude.ai) can natively query jobs, control automation, and manage applications — all through natural language.

Since the user has a Claude Max plan, Claude access on all devices is already paid for. The MCP server is the bridge that makes OpenOrbit's RPC endpoints available as Claude tools.

## How It Works

```
Claude (Desktop / Phone / Web)
    |
    |-- MCP Protocol (stdio or HTTP/SSE)
    |       |
    |       |-- openorbit-mcp (standalone Node.js process)
    |               |
    |               |-- WebSocket JSON-RPC client
    |               |       |
    |               |       |-- OpenOrbit RPC Server (localhost:18790)
    |               |               |
    |               |               |-- jobs.list, automation.start, etc.
```

The MCP server is a **standalone process** (not inside Electron). It connects to the RPC server as a client, just like the CLI and mobile app.

## Tasks

### Package Scaffold
- [x] Create `packages/mcp-server/` with `package.json` (bin: `openorbit-mcp`)
- [x] Dependency: `@modelcontextprotocol/sdk`, `ws`, `zod`

### RPC Bridge (`rpc-bridge.ts`)
- [x] Reuse `RPCClient` pattern from `packages/cli/src/rpc-client.ts`
- [x] Connect to `ws://127.0.0.1:18790`, authenticate with token
- [x] Read token from `~/.config/openorbit/rpc-token` (same as CLI)
- [x] Auto-reconnect on disconnect

### MCP Tool Definitions (`tools.ts`)
- [x] `list_jobs` — List jobs with optional status/platform filter
- [x] `get_job` — Get job details by ID
- [x] `approve_job` — Approve a job for application
- [x] `reject_job` — Reject a job
- [x] `start_automation` — Start job search automation
- [x] `stop_automation` — Stop automation
- [x] `get_status` — Get current automation status
- [x] `list_profiles` — List search profiles
- [x] `list_applications` — List applied applications
- [x] `get_action_log` — Get recent action log

### Transport Modes
- [x] **stdio** (default): For Claude Desktop. Entry in `~/.claude/claude_desktop_config.json`
- [ ] **HTTP/SSE** (optional): For remote Claude access. Requires 7.4 remote access.

## Tool Definition Pattern

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const server = new McpServer({ name: 'openorbit', version: '1.0.0' })

server.tool('list_jobs', 'List discovered jobs with optional filters', {
  status: z.enum(['new', 'reviewed', 'approved', 'rejected', 'applied']).optional()
    .describe('Filter by job status'),
  platform: z.string().optional()
    .describe('Filter by platform (linkedin, indeed, upwork)'),
  limit: z.number().default(20)
    .describe('Maximum number of jobs to return'),
}, async (args) => {
  const result = await rpcClient.call('jobs.list', { filters: args })
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
})

server.tool('approve_job', 'Approve a job for application submission', {
  jobId: z.string().describe('The job ID to approve'),
}, async (args) => {
  await rpcClient.call('jobs.approve', { id: args.jobId })
  return { content: [{ type: 'text', text: `Job ${args.jobId} approved` }] }
})
```

## Setup

### 1. Build the MCP server

```bash
cd packages/mcp-server
npm run build   # or: npx tsc
```

### 2. Ensure OpenOrbit is running

The MCP server connects to OpenOrbit's RPC server (localhost:18790). The desktop app must be running.

### 3. Add to Claude Desktop

Edit `~/.claude/claude_desktop_config.json` (or the Claude Desktop settings UI):

```json
{
  "mcpServers": {
    "openorbit": {
      "command": "node",
      "args": ["/path/to/openorbit/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 4. Add to Claude Code

In your project's `.mcp.json` or global Claude Code config:

```json
{
  "mcpServers": {
    "openorbit": {
      "command": "node",
      "args": ["/path/to/openorbit/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `127.0.0.1` | RPC server host to connect to |
| `--port` | `18790` | RPC server port |
| `--token-path` | Platform default | Path to RPC auth token file |

### Verify

Once configured, restart Claude Desktop. You should see 10 OpenOrbit tools available (list_jobs, approve_job, etc.).

## Success Criteria

- [x] `openorbit-mcp` starts and connects to RPC server
- [x] All 10 tools registered and callable from Claude Desktop
- [x] `list_jobs` returns formatted job data through Claude
- [x] `approve_job` / `reject_job` update job state on desktop
- [x] `start_automation` / `stop_automation` control automation from Claude
