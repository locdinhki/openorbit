import type { Command } from 'commander'
import { SkillsManager, getDataDir } from '../skills-manager'

export function registerSkillsCommand(program: Command): void {
  const skills = program.command('skills').description('Manage community skills')

  skills
    .command('list')
    .description('List installed community skills')
    .action(() => {
      const mgr = new SkillsManager()
      const installed = mgr.list()
      if (installed.length === 0) {
        console.log('No community skills installed.')
        console.log(`Install with: openorbit skills install @community/<name>`)
      } else {
        console.log('Installed community skills:')
        for (const name of installed) {
          console.log(`  ${name}`)
        }
      }
    })

  skills
    .command('install <name>')
    .description('Download and install a community skill (e.g. @community/glassdoor)')
    .option('--data-dir <path>', 'Override data directory', getDataDir())
    .action(async (name: string, opts: { dataDir: string }) => {
      const mgr = new SkillsManager(opts.dataDir)
      console.log(`Installing ${name}…`)
      try {
        const meta = await mgr.install(name)
        console.log(`✓ Installed ${meta.name} v${meta.version}`)
        console.log(`  ${meta.description}`)
        console.log(`  Targets: ${meta.platform}`)
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    })

  skills
    .command('remove <name>')
    .description('Uninstall a community skill')
    .option('--data-dir <path>', 'Override data directory', getDataDir())
    .action((name: string, opts: { dataDir: string }) => {
      const mgr = new SkillsManager(opts.dataDir)
      try {
        mgr.remove(name)
        console.log(`✓ Removed ${name}`)
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    })

  skills
    .command('search [query]')
    .description('Search available skills in the registry')
    .action(async (query?: string) => {
      const mgr = new SkillsManager()
      console.log('Fetching registry…')
      try {
        const registry = await mgr.fetchRegistry()
        let results = registry.skills
        if (query) {
          const q = query.toLowerCase()
          results = results.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.platform.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q)
          )
        }
        if (results.length === 0) {
          console.log('No matching skills found.')
        } else {
          console.log(`Found ${results.length} skill(s):`)
          for (const s of results) {
            console.log(`\n  ${s.name} v${s.version}`)
            console.log(`    ${s.description}`)
            console.log(`    Platform: ${s.platform}  Author: ${s.author}`)
          }
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
    })

  skills
    .command('publish')
    .description('Publish a skill to the community registry (opens contribution instructions)')
    .action(() => {
      console.log('To publish a skill to the OpenOrbit community registry:')
      console.log('')
      console.log(
        '1. Fork https://github.com/openorbit/skills-registry'
      )
      console.log('2. Add your skill YAML file to the skills/ directory')
      console.log('3. Add an entry to index.json with your skill metadata')
      console.log('4. Open a Pull Request — automated checks will validate your skill')
      console.log('')
      console.log('Skill format docs: https://github.com/openorbit/skills-registry#format')
    })
}
