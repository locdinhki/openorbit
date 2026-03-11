#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadConfig } from './config.js'
import { Executor } from './executor.js'
import { collectHardwareInfo } from './hardware-id.js'
import { startLocalApi } from './local-api.js'
import { connectToHive } from './connection.js'
import type { Instruction } from './types.js'

const args = process.argv.slice(2)

// ── Parse CLI args ──────────────────────────────────────────────────────────

let configPath: string | undefined
let testFile: string | undefined
let showInfo = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' || args[i] === '-c') configPath = args[++i]
  else if (args[i] === '--test' || args[i] === '-t') testFile = args[++i]
  else if (args[i] === '--info') showInfo = true
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`hive-minion — Dumb worker agent for the Open Hive network

Usage:
  hive-minion                     Start the agent (connects to hive + local API)
  hive-minion --test <file.json>  Run instructions from a JSON file locally
  hive-minion --info              Print hardware info and exit
  hive-minion --config <path>     Use a specific config file

Options:
  -c, --config <path>   Path to config.json
  -t, --test <file>     Run instructions from JSON file (no network)
  --info                Print hardware info as JSON and exit
  -h, --help            Show this help`)
    process.exit(0)
  }
}

// ── Load config ─────────────────────────────────────────────────────────────

const config = loadConfig(configPath)
const executor = new Executor(config.allowedOps, config.maxOutputBytes)

// ── --info mode ─────────────────────────────────────────────────────────────

if (showInfo) {
  const info = collectHardwareInfo()
  console.log(JSON.stringify(info, null, 2))
  process.exit(0)
}

// ── --test mode ─────────────────────────────────────────────────────────────

if (testFile) {
  const filePath = resolve(testFile)
  console.log(`[test] Running instructions from ${filePath}\n`)

  const raw = readFileSync(filePath, 'utf-8')
  const instructions: Instruction[] = JSON.parse(raw)

  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i]
    console.log(`[test] Instruction ${i + 1}/${instructions.length}: ${instruction.type}`)

    try {
      const result = await executor.execute(instruction)
      console.log(`[test] Result:`, JSON.stringify(result, null, 2))
    } catch (err) {
      console.error(`[test] Error:`, err instanceof Error ? err.message : err)
    }
    console.log()
  }

  process.exit(0)
}

// ── Agent mode ──────────────────────────────────────────────────────────────

console.log(`[minion] Starting ${config.deviceName}`)

const hardwareInfo = collectHardwareInfo()
console.log(`[minion] Hardware ID: ${hardwareInfo.hardwareId}`)
console.log(`[minion] Platform: ${hardwareInfo.platform} ${hardwareInfo.arch}`)
console.log(`[minion] OS: ${hardwareInfo.os}`)

// Start local API if enabled
if (config.localApi.enabled) {
  startLocalApi(config, executor, hardwareInfo)
}

// Connect to hive if API key is configured
if (config.apiKey) {
  connectToHive(config, executor, hardwareInfo)
} else {
  console.log(`[minion] No API key configured — running in local API mode only`)
}

console.log(`[minion] Ready.`)
