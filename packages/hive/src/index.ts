#!/usr/bin/env node

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import jwt from 'jsonwebtoken'
import { createDb } from './db/index.js'
import { migrateDb } from './db/migrate.js'
import { Store } from './store.js'
import { createRoutes } from './routes.js'
import { createWsServer } from './ws-server.js'
import { createPtyRelay } from './pty-relay.js'
import { TriggerEngine } from './trigger-engine.js'
import { WorkflowRunner } from './workflow-runner.js'
import { getNextRun } from './cron.js'
import { DashboardHub, createDashboardWs } from './dashboard-hub.js'
import { HealthCheckRunner } from './health-check-runner.js'
import { buildPrometheusText } from './prometheus.js'
import { generateFleetReport, sendReportToTelegram } from './fleet-report-generator.js'

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

import crypto from 'node:crypto'

const PORT = parseInt(process.env.PORT ?? '8080')
const CONTROLLER_API_KEY = process.env.CONTROLLER_API_KEY ?? ''
const DATABASE_URL = process.env.OPENHIVE_DB_URL
const JWT_SECRET = process.env.JWT_SECRET ?? crypto.randomBytes(32).toString('hex')

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

  // Dashboard Hub — real-time push to dashboard WS clients
  const dashboardHub = new DashboardHub()

  // Trigger engine ref — set after ws-server provides dispatchTaskToDevice
  const triggerRef: { engine?: TriggerEngine } = {}

  // WebSocket server (minion connections)
  const { dispatchTaskToDevice, sendToDevice, onDeviceMessage, alertEngine } = createWsServer(
    httpServer,
    store,
    triggerRef,
    dashboardHub
  )

  // Wire dashboardHub into alertEngine
  alertEngine.dashboardHub = dashboardHub

  // Dashboard WS endpoint (/api/ws/dashboard)
  createDashboardWs(httpServer, dashboardHub, store, CONTROLLER_API_KEY, JWT_SECRET)

  // PTY relay (dashboard → minion terminal sessions)
  createPtyRelay(httpServer, sendToDevice, onDeviceMessage, CONTROLLER_API_KEY)

  // Trigger engine — event-driven automation (created after ws-server)
  const workflowRunner = new WorkflowRunner(store, dispatchTaskToDevice)
  const sendTelegram = async (text: string): Promise<void> => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!botToken || !chatId) return
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      })
    } catch (err) {
      console.error('[triggers] Telegram send failed:', err instanceof Error ? err.message : err)
    }
  }
  const triggerEngine = new TriggerEngine(store, dispatchTaskToDevice, workflowRunner, sendTelegram)
  triggerRef.engine = triggerEngine
  alertEngine.triggerEngine = triggerEngine

  // Bootstrap default admin on first boot
  const userCount = await store.userCount()
  if (userCount === 0) {
    const adminUser = process.env.ADMIN_USERNAME ?? 'admin'
    const adminPass = process.env.ADMIN_PASSWORD ?? (CONTROLLER_API_KEY || 'admin')
    await store.createUser({ username: adminUser, password: adminPass, role: 'admin' })
    console.log(`[hive] Created default admin user: ${adminUser}`)
  }

  // REST routes (with dashboardHub for task.created broadcast)
  app.use(createRoutes(store, dispatchTaskToDevice, CONTROLLER_API_KEY, JWT_SECRET, dashboardHub))

  // ── Prometheus /metrics endpoint ──────────────────────────────────────────
  app.get('/metrics', async (req, res) => {
    // Optional bearer token auth
    const metricsToken = process.env.METRICS_TOKEN
    if (metricsToken) {
      const auth = req.headers.authorization
      const token = auth?.replace(/^Bearer\s+/i, '')
      if (token !== metricsToken) {
        res.status(403).send('Forbidden')
        return
      }
    }
    try {
      const text = await buildPrometheusText(store)
      res.set('Content-Type', 'text/plain; version=0.0.4')
      res.send(text)
    } catch (err) {
      console.error('[metrics] Prometheus build error:', err)
      res.status(500).send('Internal error')
    }
  })

  // ── Fleet Report generation endpoint ──────────────────────────────────────
  app.post('/api/reports/generate', express.json(), async (req, res) => {
    // Check auth — accept CONTROLLER_API_KEY or valid JWT
    const auth = req.headers.authorization
    const token = auth?.replace(/^Bearer\s+/i, '')
    let authed = !CONTROLLER_API_KEY // dev mode = no auth
    if (token) {
      if (CONTROLLER_API_KEY && token === CONTROLLER_API_KEY) authed = true
      try {
        jwt.verify(token, JWT_SECRET)
        authed = true
      } catch {
        // not a valid JWT
      }
    }
    if (!authed) {
      res.status(403).json({ error: 'Invalid API key' })
      return
    }
    try {
      const report = await generateFleetReport(store)
      await sendReportToTelegram(report.content)
      res.status(201).json(report)
    } catch (err) {
      console.error('[fleet-report] Generation error:', err)
      res.status(500).json({ error: 'Report generation failed' })
    }
  })

  // Dashboard SPA — serve static files, fallback to index.html
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const dashboardDir = resolve(__dirname, 'dashboard')
  if (existsSync(dashboardDir)) {
    app.use(express.static(dashboardDir))
    // SPA fallback: serve index.html for non-API routes
    app.get('/{*path}', (req, res) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/minion/') ||
        req.path === '/metrics'
      ) {
        res.status(404).json({ error: 'Not found' })
        return
      }
      res.sendFile(resolve(dashboardDir, 'index.html'))
    })
    console.log('[hive] Dashboard serving from', dashboardDir)
  }

  // Health check runner
  const healthCheckRunner = new HealthCheckRunner(
    store,
    alertEngine,
    dashboardHub,
    dispatchTaskToDevice
  )
  healthCheckRunner.start()

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

  // Daily fleet report scheduler
  const reportTime = process.env.REPORT_TIME ?? '08:00'
  const [reportHour, reportMinute] = reportTime.split(':').map(Number)
  setInterval(async () => {
    const now = new Date()
    if (now.getHours() === reportHour && now.getMinutes() === (reportMinute ?? 0)) {
      try {
        console.log('[fleet-report] Generating daily report...')
        const report = await generateFleetReport(store)
        await sendReportToTelegram(report.content)
        console.log(`[fleet-report] Daily report ${report.id} generated and sent`)
      } catch (err) {
        console.error('[fleet-report] Daily report error:', err)
      }
    }
  }, 60_000) // check every minute

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
