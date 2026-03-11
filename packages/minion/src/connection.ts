import WebSocket from 'ws'
import { cpus, loadavg, freemem, totalmem } from 'node:os'
import type { MinionConfig, Instruction, HardwareInfo } from './types.js'
import type { Executor } from './executor.js'
import { MINION_VERSION } from './version.js'

function collectMetrics(): {
  cpuPercent: number
  memPercent: number
  memUsedMb: number
  memTotalMb: number
} {
  const load = loadavg()[0]
  const numCpus = cpus().length
  const cpuPercent = Math.min(100, Math.round((load / numCpus) * 100))
  const free = freemem()
  const total = totalmem()
  const memPercent = Math.round((1 - free / total) * 100)
  const memUsedMb = Math.round((total - free) / 1024 / 1024)
  const memTotalMb = Math.round(total / 1024 / 1024)
  return { cpuPercent, memPercent, memUsedMb, memTotalMb }
}

const BACKOFF_STEPS = [5_000, 10_000, 30_000, 60_000] // cap at 60s

export function connectToHive(
  config: MinionConfig,
  executor: Executor,
  hardwareInfo: HardwareInfo
): { close(): void } {
  let ws: WebSocket | null = null
  let retryCount = 0
  let intentionalClose = false

  function connect(): void {
    console.log(`[hive] Connecting to ${config.hiveUrl}...`)
    ws = new WebSocket(config.hiveUrl)

    ws.on('open', () => {
      console.log(`[hive] Connected`)
      retryCount = 0

      // Send auth message
      ws!.send(
        JSON.stringify({
          type: 'auth',
          apiKey: config.apiKey,
          hardwareId: hardwareInfo.hardwareId,
          deviceInfo: hardwareInfo,
          version: MINION_VERSION
        })
      )
    })

    ws.on('message', async (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        console.error('[hive] Invalid JSON from hive')
        return
      }

      // Auth response
      if (msg.type === 'auth-ok') {
        console.log(`[hive] Authenticated as ${msg.deviceId}`)
        startHeartbeat()
        return
      }

      // Auth error (connection will be closed by hive)
      if (msg.error) {
        console.error(`[hive] Error: ${msg.error}`)
        return
      }

      // Heartbeat ack
      if (msg.type === 'heartbeat-ack') {
        return
      }

      // Instruction from hive
      if (msg.messageId && msg.taskId && msg.instruction) {
        const instruction = msg.instruction as Instruction
        console.log(`[hive] Received task ${msg.taskId}: ${instruction.type}`)

        try {
          const result = await executor.execute(instruction)
          ws?.send(
            JSON.stringify({
              messageId: msg.messageId,
              taskId: msg.taskId,
              status: 'completed',
              result
            })
          )
          console.log(`[hive] Task ${msg.taskId} completed`)
        } catch (err) {
          ws?.send(
            JSON.stringify({
              messageId: msg.messageId,
              taskId: msg.taskId,
              status: 'error',
              error: err instanceof Error ? err.message : String(err)
            })
          )
          console.error(
            `[hive] Task ${msg.taskId} failed:`,
            err instanceof Error ? err.message : err
          )
        }
      }
    })

    ws.on('close', (code, reason) => {
      console.log(`[hive] Disconnected (code: ${code}, reason: ${reason.toString() || 'none'})`)
      stopHeartbeat()

      if (!intentionalClose) {
        const delay = BACKOFF_STEPS[Math.min(retryCount, BACKOFF_STEPS.length - 1)]
        retryCount++
        console.log(`[hive] Reconnecting in ${delay / 1000}s...`)
        setTimeout(connect, delay)
      }
    })

    ws.on('error', (err) => {
      console.error(`[hive] WebSocket error:`, err.message)
      // 'close' event will fire after this, triggering reconnect
    })
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  function startHeartbeat(): void {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now(),
            version: MINION_VERSION,
            metrics: collectMetrics()
          })
        )
      }
    }, 30_000)
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  connect()

  return {
    close() {
      intentionalClose = true
      stopHeartbeat()
      ws?.close()
    }
  }
}
