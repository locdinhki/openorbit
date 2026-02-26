#!/usr/bin/env node
// ============================================================================
// OpenOrbit MCP Server
//
// Standalone process that exposes OpenOrbit capabilities as MCP tools.
// Connects to the OpenOrbit RPC server as a WebSocket client and bridges
// MCP tool calls to JSON-RPC method calls.
//
// Usage:
//   npx openorbit-mcp              # stdio transport (for Claude Desktop)
//   npx openorbit-mcp --sse 18791  # SSE transport (for remote access)
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { RPCBridge, readToken, DEFAULT_PORT } from './rpc-bridge'
import { registerTools } from './tools'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const host = getArg(args, '--host') ?? '127.0.0.1'
  const port = parseInt(getArg(args, '--port') ?? String(DEFAULT_PORT), 10)
  const tokenPath = getArg(args, '--token-path')

  // Read auth token
  let token: string
  try {
    token = readToken(tokenPath)
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }

  // Connect to OpenOrbit RPC server
  const rpc = new RPCBridge({ token, host, port })
  try {
    await rpc.connect()
    console.error(`Connected to OpenOrbit RPC server at ${host}:${port}`)
  } catch (err) {
    console.error(`Failed to connect to OpenOrbit at ${host}:${port}:`, (err as Error).message)
    process.exit(1)
  }

  // Create MCP server
  const server = new McpServer({
    name: 'openorbit',
    version: '1.0.0'
  })

  // Register all tools
  registerTools(server, rpc)

  // Start with stdio transport (default for Claude Desktop)
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('OpenOrbit MCP server running (stdio transport)')

  // Cleanup on exit
  process.on('SIGINT', () => {
    rpc.close()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    rpc.close()
    process.exit(0)
  })
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return undefined
  return args[idx + 1]
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
