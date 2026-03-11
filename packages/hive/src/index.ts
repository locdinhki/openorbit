#!/usr/bin/env node

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import { createDb } from './db/index.js'
import { migrateDb } from './db/migrate.js'
import { Store } from './store.js'
import { createRoutes } from './routes.js'
import { createWsServer } from './ws-server.js'

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
