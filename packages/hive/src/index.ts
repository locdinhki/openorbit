#!/usr/bin/env node

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createDb } from './db/index.js'
import { migrateDb } from './db/migrate.js'
import { Store } from './store.js'
import { createRoutes } from './routes.js'
import { createWsServer } from './ws-server.js'
import { getNextRun } from './cron.js'

// ── Load env file if present ────────────────────────────────────────────────

function loadEnv(): void {
  // Check for .env in hive package, then root
  for (const dir of [process.cwd(), resolve(process.cwd(), '../..')]) {
    try {
      const envFile = readFileSync(resolve(dir, '.env'), 'utf-8')
      for (const line of envFile.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx < 0) continue
        const key = trimmed.slice(0, eqIdx)
        const val = trimmed.slice(eqIdx + 1)
        if (!process.env[key]) process.env[key] = val
      }
    } catch {
      // env file not found
    }
  }
}

loadEnv()

// ── Config ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '8080')
const CONTROLLER_API_KEY = process.env.CONTROLLER_API_KEY ?? ''
const DATABASE_URL = process.env.OPENHIVE_DB_URL

if (!DATABASE_URL) {
  console.error('[hive] FATAL: OPENHIVE_DB_URL not set')
  process.exit(1)
}

// ── Boot ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Run migrations
  console.log('[hive] Running database migrations...')
  await migrateDb(DATABASE_URL!)

  // Connect to DB
  const { db } = createDb(DATABASE_URL!)
  const store = new Store(db)

  // Mark all devices as offline on startup (clean slate)
  const allDevices = await store.listDevices()
  for (const d of allDevices) {
    if (d.status === 'online') await store.setDeviceOffline(d.id)
  }

  const app = express()
  const httpServer = createServer(app)

  // WebSocket server
  const { dispatchTaskToDevice } = createWsServer(httpServer, store)

  // REST routes
  app.use(createRoutes(store, dispatchTaskToDevice, CONTROLLER_API_KEY))

  // Dashboard SPA — serve static files, fallback to index.html
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const dashboardDir = resolve(__dirname, 'dashboard')
  if (existsSync(dashboardDir)) {
    app.use(express.static(dashboardDir))
    // SPA fallback: serve index.html for non-API routes
    app.get('/{*path}', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/minion/')) {
        res.status(404).json({ error: 'Not found' })
        return
      }
      res.sendFile(resolve(dashboardDir, 'index.html'))
    })
    console.log('[hive] Dashboard serving from', dashboardDir)
  }

  // Metrics pruner — delete records older than 7 days, run every hour
  setInterval(async () => {
    try {
      await store.pruneMetrics()
    } catch (err) {
      console.error('[metrics] Prune error:', err)
    }
  }, 60 * 60_000)

  // Schedule evaluator — check every 60s for due schedules
  setInterval(async () => {
    try {
      const due = await store.getDueSchedules()
      for (const schedule of due) {
        const task = await store.createTask({
          targetDevice: schedule.deviceId,
          instruction: schedule.instruction as Record<string, unknown>,
          priority: 'normal'
        })
        dispatchTaskToDevice(
          schedule.deviceId,
          task.id,
          schedule.instruction as Record<string, unknown>
        )
        const nextRunAt = getNextRun(schedule.cronExpression)
        await store.markScheduleRan(schedule.id, nextRunAt)
        console.log(
          `[scheduler] Dispatched task ${task.id} for schedule "${schedule.name}" → next run ${nextRunAt.toISOString()}`
        )
      }
    } catch (err) {
      console.error('[scheduler] Error:', err)
    }
  }, 60_000)

  httpServer.listen(PORT, () => {
    console.log(`[hive] Listening on port ${PORT}`)
    if (!CONTROLLER_API_KEY) {
      console.log(
        `[hive] WARNING: No CONTROLLER_API_KEY set — REST API is unauthenticated (dev mode)`
      )
    }
    console.log(`[hive] Ready.`)
  })
}

main().catch((err) => {
  console.error('[hive] Failed to start:', err)
  process.exit(1)
})
