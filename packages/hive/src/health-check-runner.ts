// ============================================================================
// Health Check Runner — periodic probes with alert integration
// ============================================================================

import type { Store, HealthCheck } from './store.js'
import type { AlertEngine } from './alert-engine.js'
import type { DashboardHub } from './dashboard-hub.js'

const CHECK_INTERVAL = 30_000 // evaluate every 30s which checks are due

interface CheckState {
  lastRun: number // timestamp of last run
}

export class HealthCheckRunner {
  private states = new Map<string, CheckState>()
  private timer: ReturnType<typeof setInterval> | null = null
  private dispatchTaskToDevice: (
    deviceId: string,
    taskId: string,
    instruction: Record<string, unknown>
  ) => boolean

  constructor(
    private store: Store,
    private alertEngine: AlertEngine,
    private dashboardHub: DashboardHub | undefined,
    dispatch: (deviceId: string, taskId: string, instruction: Record<string, unknown>) => boolean
  ) {
    this.dispatchTaskToDevice = dispatch
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), CHECK_INTERVAL)
    console.log('[health-checks] Runner started')
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async tick(): Promise<void> {
    try {
      const checks = await this.store.getEnabledHealthChecks()
      const now = Date.now()

      for (const check of checks) {
        const state = this.states.get(check.id)
        const intervalMs = check.intervalS * 1000
        if (state && now - state.lastRun < intervalMs) continue

        this.states.set(check.id, { lastRun: now })
        this.runCheck(check).catch((err) => {
          console.error(`[health-checks] Error running check ${check.id}:`, err)
        })
      }
    } catch (err) {
      console.error('[health-checks] Tick error:', err)
    }
  }

  private async runCheck(check: HealthCheck): Promise<void> {
    if (check.runFrom === 'hive' && check.type === 'http') {
      await this.runHttpFromHive(check)
    } else {
      // Run on device — dispatch a task
      await this.runOnDevice(check)
    }
  }

  /** HTTP check executed from the hive server directly */
  private async runHttpFromHive(check: HealthCheck): Promise<void> {
    const start = Date.now()
    let status: 'pass' | 'fail' = 'pass'
    let error: string | undefined

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), check.timeoutS * 1000)

      const res = await fetch(check.url!, { signal: controller.signal })
      clearTimeout(timeout)

      if (check.expectedStatus && res.status !== check.expectedStatus) {
        status = 'fail'
        error = `Expected status ${check.expectedStatus}, got ${res.status}`
      }

      if (status === 'pass' && check.expectedBody) {
        const body = await res.text()
        if (!body.includes(check.expectedBody)) {
          status = 'fail'
          error = `Response body does not contain "${check.expectedBody}"`
        }
      }
    } catch (err) {
      status = 'fail'
      error = err instanceof Error ? err.message : String(err)
    }

    const durationMs = Date.now() - start
    await this.recordResult(check, status, durationMs, error)
  }

  /** Run check on the device by dispatching a task */
  private async runOnDevice(check: HealthCheck): Promise<void> {
    let instruction: Record<string, unknown>

    if (check.type === 'http') {
      instruction = {
        type: 'http',
        method: 'GET',
        url: check.url!,
        timeout: check.timeoutS * 1000
      }
    } else {
      instruction = {
        type: 'exec',
        command: check.command!,
        timeout: check.timeoutS * 1000
      }
    }

    const task = await this.store.createTask({
      targetDevice: check.deviceId,
      instruction,
      priority: 'normal'
    })
    this.dispatchTaskToDevice(check.deviceId, task.id, instruction)

    // Poll for result (up to timeout + 5s buffer)
    const deadline = Date.now() + (check.timeoutS + 5) * 1000
    let resolved = false
    while (Date.now() < deadline && !resolved) {
      await new Promise((r) => setTimeout(r, 2000))
      const t = await this.store.getTask(task.id)
      if (!t || t.status === 'queued' || t.status === 'dispatched' || t.status === 'running')
        continue

      resolved = true
      const results = await this.store.getResults(task.id)
      const result = results[0]

      if (t.status === 'completed') {
        let status: 'pass' | 'fail' = 'pass'
        let error: string | undefined

        if (check.type === 'http' && result?.result) {
          const r = result.result as Record<string, unknown>
          const statusCode = r.statusCode as number | undefined
          if (check.expectedStatus && statusCode !== check.expectedStatus) {
            status = 'fail'
            error = `Expected status ${check.expectedStatus}, got ${statusCode}`
          }
        } else if (check.type === 'command' && result?.result) {
          const r = result.result as Record<string, unknown>
          const exitCode = r.exitCode as number | undefined
          if (exitCode !== (check.expectedExit ?? 0)) {
            status = 'fail'
            error = `Exit code ${exitCode} (expected ${check.expectedExit ?? 0})`
          }
        }

        await this.recordResult(check, status, parseInt(result?.durationMs ?? '0', 10) || 0, error)
      } else {
        await this.recordResult(check, 'fail', 0, result?.error ?? `Task ${t.status}`)
      }
    }

    if (!resolved) {
      await this.recordResult(check, 'fail', 0, 'Timed out waiting for device response')
    }
  }

  private async recordResult(
    check: HealthCheck,
    status: 'pass' | 'fail',
    durationMs: number,
    error?: string
  ): Promise<void> {
    await this.store.addHealthCheckResult({
      checkId: check.id,
      status,
      durationMs,
      error
    })

    // Get device name for alert messages
    const device = await this.store.getDevice(check.deviceId)
    const deviceName = device?.name ?? check.deviceId

    if (status === 'fail') {
      console.log(`[health-checks] FAIL: ${check.name} on ${deviceName} — ${error}`)
      // Fire alert (reuse the checkOffline-style pattern with a synthetic "health" alert)
      // For simplicity, use Telegram directly
      await this.sendTelegram(`🔴 Health Check Failed\n"${check.name}" on ${deviceName}: ${error}`)
    } else {
      // Check if previous result was a fail — if so, recovery
      const history = await this.store.getHealthCheckResults(check.id, 2)
      if (history.length >= 2 && history[1].status === 'fail') {
        console.log(`[health-checks] RECOVERED: ${check.name} on ${deviceName}`)
        await this.sendTelegram(
          `✅ Health Check Recovered\n"${check.name}" on ${deviceName} is passing again`
        )
      }
    }
  }

  private async sendTelegram(text: string): Promise<void> {
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
      console.error(
        '[health-checks] Telegram send failed:',
        err instanceof Error ? err.message : err
      )
    }
  }
}
