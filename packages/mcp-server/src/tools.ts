// ============================================================================
// OpenOrbit MCP Server — Tool Definitions
//
// Registers MCP tools that map to OpenOrbit RPC endpoints.
// Each tool delegates to the RPCBridge for actual execution.
// ============================================================================

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { RPCBridge } from './rpc-bridge'

export function registerTools(server: McpServer, rpc: RPCBridge): void {
  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  server.tool(
    'list_jobs',
    'List discovered jobs with optional filters',
    {
      status: z
        .enum(['new', 'reviewed', 'approved', 'rejected', 'applied', 'skipped'])
        .optional()
        .describe('Filter by job status'),
      platform: z.string().optional().describe('Filter by platform (linkedin, indeed, upwork)'),
      limit: z.number().default(20).describe('Maximum number of jobs to return')
    },
    async (args) => {
      const result = await rpc.call('jobs.list', { filters: args })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'get_job',
    'Get detailed information about a specific job',
    {
      id: z.string().describe('The job ID')
    },
    async (args) => {
      const result = await rpc.call('jobs.get', { id: args.id })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'approve_job',
    'Approve a job for application submission',
    {
      id: z.string().describe('The job ID to approve')
    },
    async (args) => {
      await rpc.call('jobs.approve', { id: args.id })
      return { content: [{ type: 'text' as const, text: `Job ${args.id} approved for application.` }] }
    }
  )

  server.tool(
    'reject_job',
    'Reject a job (skip it)',
    {
      id: z.string().describe('The job ID to reject')
    },
    async (args) => {
      await rpc.call('jobs.reject', { id: args.id })
      return { content: [{ type: 'text' as const, text: `Job ${args.id} rejected.` }] }
    }
  )

  // -------------------------------------------------------------------------
  // Automation
  // -------------------------------------------------------------------------

  server.tool(
    'start_automation',
    'Start job search automation',
    {
      profileId: z.string().optional().describe('Search profile ID to use')
    },
    async (args) => {
      const result = await rpc.call('automation.start', args)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'stop_automation',
    'Stop the running automation',
    {},
    async () => {
      await rpc.call('automation.stop')
      return { content: [{ type: 'text' as const, text: 'Automation stopped.' }] }
    }
  )

  server.tool(
    'get_status',
    'Get current automation status and metrics',
    {},
    async () => {
      const result = await rpc.call('automation.status')
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // -------------------------------------------------------------------------
  // Profiles & Applications
  // -------------------------------------------------------------------------

  server.tool(
    'list_profiles',
    'List all search profiles',
    {},
    async () => {
      const result = await rpc.call('profiles.list')
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    'list_applications',
    'List submitted applications',
    {
      platform: z.string().optional().describe('Filter by platform'),
      limit: z.number().default(20).describe('Maximum number to return')
    },
    async (args) => {
      const result = await rpc.call('applications.list-applied', args)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // -------------------------------------------------------------------------
  // Action Log
  // -------------------------------------------------------------------------

  server.tool(
    'get_action_log',
    'Get recent action log entries',
    {
      limit: z.number().default(20).describe('Maximum number of entries to return')
    },
    async (args) => {
      const result = await rpc.call('action-log.list', { limit: args.limit })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )
}
