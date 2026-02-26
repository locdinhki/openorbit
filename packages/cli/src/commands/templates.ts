import type { Command } from 'commander'
import type { RPCClient } from '../rpc-client'
import {
  anonymizeAnswers,
  formatContributionPreview,
  buildContributionPayload,
  type RawAnswer
} from '../answer-templates'

export function registerTemplatesCommand(
  program: Command,
  withClient: <T>(fn: (client: RPCClient) => Promise<T>) => Promise<T>
): void {
  const templates = program
    .command('templates')
    .description('Browse and contribute answer templates')

  templates
    .command('list')
    .description('Browse community answer templates')
    .option('--question <text>', 'Filter by question text')
    .action(async (opts: { question?: string }) => {
      console.log('Community answer templates are available at:')
      console.log('  https://github.com/openorbit/skills-registry/tree/main/templates')
      if (opts.question) {
        console.log(`\nSearch for "${opts.question}" in the templates directory.`)
      }
      console.log('')
      console.log('To contribute your own templates, run:')
      console.log('  openorbit templates contribute')
    })

  templates
    .command('contribute')
    .description('Anonymize and preview recent application answers for contribution')
    .option('--limit <n>', 'Number of recent answers to include', '20')
    .option('--platform <platform>', 'Filter by platform (e.g. linkedin, indeed)')
    .option('--note <text>', 'Optional note about these answers')
    .action(async (opts: { limit: string; platform?: string; note?: string }) => {
      let actionLog: unknown
      try {
        actionLog = await withClient((c) =>
          c.call('action-log.list', { limit: parseInt(opts.limit, 10) })
        )
      } catch (err) {
        console.error('Could not connect to OpenOrbit. Is the app running?')
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }

      // Extract answer data from action log
      const entries = (actionLog as { data?: unknown[] })?.data ?? []
      const rawAnswers: RawAnswer[] = []
      for (const entry of entries) {
        const e = entry as Record<string, unknown>
        if (e['type'] !== 'answer') continue
        if (opts.platform && e['platform'] !== opts.platform) continue
        rawAnswers.push({
          question: String(e['question'] ?? ''),
          answer: String(e['answer'] ?? ''),
          platform: typeof e['platform'] === 'string' ? e['platform'] : undefined
        })
      }

      if (rawAnswers.length === 0) {
        console.log('No application answers found in the action log.')
        console.log('Run some applications first, then contribute your answers.')
        return
      }

      const results = anonymizeAnswers(rawAnswers)
      const preview = formatContributionPreview(results)
      console.log(preview)

      const templates = results.map((r) => r.template)
      const payload = buildContributionPayload(templates, { note: opts.note })

      console.log('=== To Contribute ===')
      console.log('')
      console.log('1. Create a new GitHub Gist at https://gist.github.com/')
      console.log('2. Paste the following JSON as the file content:')
      console.log('')
      console.log(payload)
      console.log('')
      console.log('3. Open an issue at https://github.com/openorbit/skills-registry/issues')
      console.log('   with the Gist link to submit your templates for review.')
    })
}
