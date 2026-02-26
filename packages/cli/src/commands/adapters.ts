import type { Command } from 'commander'
import { discoverAdapters } from '@openorbit/core/platforms/adapter-registry'

export function registerAdaptersCommand(program: Command): void {
  const adapters = program.command('adapters').description('Manage community platform adapters')

  adapters
    .command('list')
    .description('List discovered @openorbit/* adapter packages in node_modules')
    .option('--node-modules <path>', 'Root directory containing node_modules')
    .action(async (opts: { nodeModules?: string }) => {
      const found = await discoverAdapters(opts.nodeModules)
      if (found.length === 0) {
        console.log('No community platform adapters found.')
        console.log('')
        console.log('Install adapters with npm:')
        console.log('  npm install @openorbit/glassdoor')
        console.log('')
        console.log('Community adapters must have "openorbit-adapter" in their package.json keywords.')
      } else {
        console.log(`Found ${found.length} adapter(s):`)
        for (const adapter of found) {
          console.log(`\n  ${adapter.name} v${adapter.version}`)
          if (adapter.description) console.log(`    ${adapter.description}`)
          if (adapter.platform) console.log(`    Platform: ${adapter.platform}`)
        }
      }
    })
}
