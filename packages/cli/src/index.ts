#!/usr/bin/env node
import { Command } from 'commander'
import { RPCClient, readToken } from './rpc-client'
import { registerSkillsCommand } from './commands/skills'
import { registerAdaptersCommand } from './commands/adapters'
import { registerTemplatesCommand } from './commands/templates'

const program = new Command()

program
  .name('openorbit')
  .description('OpenOrbit CLI — control the automation engine from your terminal')
  .version('1.0.0')

// --- helper: create connected client ---

async function withClient<T>(fn: (client: RPCClient) => Promise<T>): Promise<T> {
  const token = readToken()
  const client = new RPCClient({ token })
  try {
    await client.connect()
    return await fn(client)
  } finally {
    client.close()
  }
}

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

// --- status ---

program
  .command('status')
  .description('Show current automation status')
  .action(async () => {
    const status = await withClient((c) => c.call('automation.status'))
    printJson(status)
  })

// --- search ---

program
  .command('search [profileId]')
  .description('Start job extraction (all enabled profiles or a specific one)')
  .action(async (profileId?: string) => {
    const result = await withClient((c) =>
      c.call('automation.start', profileId ? { profileId } : {})
    )
    printJson(result)
  })

// --- analyze ---

program
  .command('analyze')
  .description('List extracted jobs pending review')
  .option('--status <status>', 'Filter by status (new, reviewed, approved, rejected)', 'new')
  .option('--limit <n>', 'Max results', '20')
  .action(async (opts) => {
    const result = await withClient((c) =>
      c.call('jobs.list', {
        filters: { status: opts.status, limit: parseInt(opts.limit, 10) }
      })
    )
    printJson(result)
  })

// --- apply ---

program
  .command('apply [jobId]')
  .description('Apply to approved jobs (all approved, or a specific job by ID)')
  .action(async (jobId?: string) => {
    if (jobId) {
      // Approve the specific job first, then start
      await withClient(async (c) => {
        await c.call('jobs.approve', { id: jobId })
        return c.call('automation.start', {})
      }).then(printJson)
    } else {
      const result = await withClient((c) => c.call('automation.start', {}))
      printJson(result)
    }
  })

// --- schedule ---

program
  .command('schedule')
  .description('List all configured schedules')
  .action(async () => {
    const result = await withClient((c) => c.call('schedules.list'))
    printJson(result)
  })

// --- export ---

program
  .command('export')
  .description('Export jobs to JSON')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Max results', '1000')
  .action(async (opts) => {
    const filters: Record<string, unknown> = { limit: parseInt(opts.limit, 10) }
    if (opts.status) filters['status'] = opts.status
    const result = await withClient((c) => c.call('jobs.list', { filters }))
    printJson(result)
  })

// --- stop ---

program
  .command('stop')
  .description('Stop the running automation')
  .action(async () => {
    const result = await withClient((c) => c.call('automation.stop'))
    printJson(result)
  })

// --- community marketplace ---

registerSkillsCommand(program)
registerAdaptersCommand(program)
registerTemplatesCommand(program, withClient)

// --- relay ---

const relayCmd = program
  .command('relay')
  .description('Manage the Chrome extension relay')

relayCmd
  .command('status')
  .description('Show attached relay tabs')
  .action(async () => {
    const result = await withClient((c) => c.call('relay.status'))
    printJson(result)
  })

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
