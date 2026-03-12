#!/usr/bin/env node

import { Command } from 'commander'
import { writeConfig, readConfig } from './config.js'
import { ps } from './commands/ps.js'
import { exec } from './commands/exec.js'
import { tasks } from './commands/tasks.js'
import { alerts } from './commands/alerts.js'
import { update } from './commands/update.js'

const program = new Command()

program.name('hive-ctl').description('CLI for Open Hive fleet management').version('0.1.0')

// ── Config ──────────────────────────────────────────────────────────────

const configCmd = program.command('config').description('Manage hive-ctl configuration')

configCmd
  .command('set-url <url>')
  .description('Set the Hive server URL')
  .action((url: string) => {
    writeConfig({ url })
    console.log(`URL set to: ${url}`)
  })

configCmd
  .command('set-key <key>')
  .description('Set the API key')
  .action((key: string) => {
    writeConfig({ apiKey: key })
    console.log('API key saved')
  })

configCmd
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = readConfig()
    console.log(`URL:     ${config.url ?? '(not set)'}`)
    console.log(`API Key: ${config.apiKey ? config.apiKey.slice(0, 8) + '...' : '(not set)'}`)
  })

// ── Devices ─────────────────────────────────────────────────────────────

program
  .command('ps')
  .description('List all devices')
  .option('--online', 'Show online devices only')
  .action((opts) => ps(opts))

// ── Tasks ───────────────────────────────────────────────────────────────

program
  .command('exec <device> <command>')
  .description('Run a command on a device and wait for output')
  .action((device: string, command: string) => exec(device, command))

program
  .command('tasks')
  .description('List recent tasks')
  .option('--device <id>', 'Filter by device ID')
  .option('--status <status>', 'Filter by status')
  .action((opts) => tasks(opts))

// ── Alerts ──────────────────────────────────────────────────────────────

program
  .command('alerts')
  .description('List active alerts')
  .option('--all', 'Include resolved alerts')
  .action((opts) => alerts(opts))

// ── Updates ─────────────────────────────────────────────────────────────

program
  .command('update [device]')
  .description('Update a device or all devices')
  .option('--all', 'Update all outdated devices')
  .action((device: string | undefined, opts) => update(device, opts))

program.parse()
