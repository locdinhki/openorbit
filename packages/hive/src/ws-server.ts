import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import type { Store } from './store.js'
import { AlertEngine } from './alert-engine.js'
import type { TriggerEngine } from './trigger-engine.js'
import type { AuthMessage, ResultMessage } from './types.js'
import { v4 as uuid } from 'uuid'

const HEARTBEAT_INTERVAL = 30_000
const HEARTBEAT_TIMEOUT = 90_000

type DeviceMessageHandler = (deviceId: string, msg: Record<string, unknown>) => void

export function createWsServer(
  httpServer: Server,
  store: Store,
  triggerRef?: { engine?: TriggerEngine }
): {
  wss: WebSocketServer
  alertEngine: AlertEngine
  dispatchTaskToDevice: (
    deviceId: string,
    taskId: string,
    instruction: Record<string, unknown>
  ) => boolean
  sendToDevice: (deviceId: string, msg: Record<string, unknown>) => boolean
  onDeviceMessage: (handler: DeviceMessageHandler) => void
} {
  const alertEngine = new AlertEngine(store)
  const wss = new WebSocketServer({ server: httpServer })
  const deviceMessageHandlers: DeviceMessageHandler[] = []

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress ?? 'unknown'
    console.log(`[ws] New connection from ${ip}`)

    let authenticated = false
    let deviceId: string | undefined

    // First message must be auth
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, 'Auth timeout')
      }
    }, 10_000)

    ws.on('message', async (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      // ── Auth ────────────────────────────────────────────────────────────
      if (!authenticated) {
        if (msg.type !== 'auth') {
          ws.close(4002, 'First message must be auth')
          return
        }

        const authMsg = msg as unknown as AuthMessage
        const device = await store.getDeviceByApiKey(authMsg.apiKey)

        if (!device) {
          ws.close(4003, 'Invalid API key')
          return
        }

        // Verify hardware ID matches if device has one, adopt on first connect
        if (device.hardwareId && authMsg.hardwareId !== device.hardwareId) {
          ws.close(4004, 'Hardware ID mismatch')
          return
        }
        if (!device.hardwareId && authMsg.hardwareId) {
          await store.updateDeviceHardwareId(device.id, authMsg.hardwareId)
          console.log(`[ws] Adopted hardware ID for ${device.id}: ${authMsg.hardwareId}`)
        }

        authenticated = true
        deviceId = device.id
        clearTimeout(authTimeout)

        await store.setDeviceOnline(device.id, ip, authMsg.deviceInfo as Record<string, unknown>)
        store.addConnection({ deviceId: device.id, ws, lastHeartbeat: new Date() })

        // Record minion version if provided
        if (typeof (msg as Record<string, unknown>).version === 'string') {
          store
            .setDeviceVersion(device.id, (msg as Record<string, unknown>).version as string)
            .catch(() => {})
        }

        // Resolve any open offline alerts for this device
        alertEngine.resolveOffline(device.id, device.name).catch(() => {})

        // Fire device.online triggers
        triggerRef?.engine
          ?.evaluate({
            type: 'device.online',
            deviceId: device.id,
            deviceName: device.name
          })
          .catch(() => {})

        ws.send(JSON.stringify({ type: 'auth-ok', deviceId: device.id }))
        console.log(`[ws] Device ${device.id} authenticated from ${ip}`)

        // Dispatch any queued tasks
        const queued = await store.getQueuedTasksForDevice(device.id)
        for (const task of queued) {
          await dispatchTask(ws, task.id, task.instruction as Record<string, unknown>, store)
        }

        return
      }

      // ── Heartbeat ───────────────────────────────────────────────────────
      if (msg.type === 'heartbeat') {
        const conn = store.getConnection(deviceId!)
        if (conn) conn.lastHeartbeat = new Date()

        // Update minion version if included in heartbeat
        if (typeof msg.version === 'string') {
          store.setDeviceVersion(deviceId!, msg.version as string).catch(() => {})
        }

        // Save metrics + check alert thresholds
        if (msg.metrics && typeof msg.metrics === 'object') {
          const m = msg.metrics as Record<string, number>
          store
            .saveMetrics(deviceId!, {
              cpuPercent: m.cpuPercent ?? 0,
              memPercent: m.memPercent ?? 0,
              memUsedMb: m.memUsedMb ?? 0,
              memTotalMb: m.memTotalMb ?? 0
            })
            .then((saved) => {
              const device = store.getConnection(deviceId!)
              if (saved && device) {
                return store.getDevice(deviceId!).then((d) => {
                  if (d) {
                    alertEngine.checkMetrics(deviceId!, d.name, {
                      cpuPercent: m.cpuPercent ?? 0,
                      memPercent: m.memPercent ?? 0
                    })
                    triggerRef?.engine
                      ?.evaluateMetric(deviceId!, d.name, {
                        cpuPercent: m.cpuPercent ?? 0,
                        memPercent: m.memPercent ?? 0
                      })
                      .catch(() => {})
                  }
                })
              }
            })
            .catch(() => {})
        }

        const pending = await store.getQueuedTasksForDevice(deviceId!)
        ws.send(JSON.stringify({ type: 'heartbeat-ack', pendingTasks: pending.length }))
        return
      }

      // ── PTY output / close from minion → forward to relay handlers ────
      if (msg.type === 'pty-output' || msg.type === 'pty-close') {
        for (const handler of deviceMessageHandlers) {
          handler(deviceId!, msg)
        }
        return
      }

      // ── Task result ─────────────────────────────────────────────────────
      if (msg.messageId && msg.taskId) {
        const result = msg as unknown as ResultMessage
        await handleResult(result, deviceId!, store)
        return
      }
    })

    ws.on('close', async () => {
      if (deviceId) {
        console.log(`[ws] Device ${deviceId} disconnected`)
        store.removeConnection(deviceId)
        await store.setDeviceOffline(deviceId)
        const device = await store.getDevice(deviceId)
        if (device) {
          alertEngine.checkOffline(deviceId, device.name).catch(() => {})
          triggerRef?.engine
            ?.evaluate({
              type: 'device.offline',
              deviceId,
              deviceName: device.name
            })
            .catch(() => {})
        }
      }
    })

    ws.on('error', (err) => {
      console.error(`[ws] Error from ${deviceId ?? ip}:`, err.message)
    })
  })

  // Heartbeat checker — mark devices offline if no heartbeat
  const heartbeatChecker = setInterval(async () => {
    const now = Date.now()
    const deviceList = await store.listDevices()
    for (const device of deviceList) {
      if (device.status !== 'online') continue
      const conn = store.getConnection(device.id)
      if (!conn) continue
      if (now - conn.lastHeartbeat.getTime() > HEARTBEAT_TIMEOUT) {
        console.log(`[ws] Device ${device.id} heartbeat timeout`)
        conn.ws.close(4005, 'Heartbeat timeout')
        store.removeConnection(device.id)
        await store.setDeviceOffline(device.id)
        alertEngine.checkOffline(device.id, device.name).catch(() => {})
        triggerRef?.engine
          ?.evaluate({
            type: 'device.offline',
            deviceId: device.id,
            deviceName: device.name
          })
          .catch(() => {})
      }
    }
  }, HEARTBEAT_INTERVAL)

  wss.on('close', () => clearInterval(heartbeatChecker))

  return {
    wss,
    alertEngine,
    dispatchTaskToDevice: (
      deviceId: string,
      taskId: string,
      instruction: Record<string, unknown>
    ) => {
      const conn = store.getConnection(deviceId)
      if (!conn) return false
      dispatchTask(conn.ws, taskId, instruction, store)
      return true
    },
    sendToDevice: (deviceId: string, msg: Record<string, unknown>) => {
      const conn = store.getConnection(deviceId)
      if (!conn) return false
      conn.ws.send(JSON.stringify(msg))
      return true
    },
    onDeviceMessage: (handler: DeviceMessageHandler) => {
      deviceMessageHandlers.push(handler)
    }
  }
}

async function dispatchTask(
  ws: WebSocket,
  taskId: string,
  instruction: Record<string, unknown>,
  store: Store
): Promise<void> {
  const msg = {
    messageId: uuid(),
    taskId,
    instruction
  }
  ws.send(JSON.stringify(msg))
  await store.updateTaskStatus(taskId, 'dispatched')
  console.log(`[ws] Dispatched task ${taskId}`)
}

async function handleResult(result: ResultMessage, deviceId: string, store: Store): Promise<void> {
  const status = result.status === 'completed' ? 'success' : 'error'
  await store.addResult({
    taskId: result.taskId,
    deviceId,
    status,
    result: result.result as Record<string, unknown>,
    error: result.error
  })
  await store.updateTaskStatus(
    result.taskId,
    result.status === 'completed' ? 'completed' : 'failed'
  )
  console.log(`[ws] Result for task ${result.taskId}: ${result.status}`)
}
