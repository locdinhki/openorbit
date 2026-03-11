import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import type { Store } from './store.js'
import type { AuthMessage, ResultMessage } from './types.js'
import { v4 as uuid } from 'uuid'

const HEARTBEAT_INTERVAL = 30_000
const HEARTBEAT_TIMEOUT = 90_000

export function createWsServer(
  httpServer: Server,
  store: Store
): {
  wss: WebSocketServer
  dispatchTaskToDevice: (
    deviceId: string,
    taskId: string,
    instruction: Record<string, unknown>
  ) => boolean
} {
  const wss = new WebSocketServer({ server: httpServer })

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

        const pending = await store.getQueuedTasksForDevice(deviceId!)
        ws.send(JSON.stringify({ type: 'heartbeat-ack', pendingTasks: pending.length }))
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
      }
    }
  }, HEARTBEAT_INTERVAL)

  wss.on('close', () => clearInterval(heartbeatChecker))

  return {
    wss,
    dispatchTaskToDevice: (
      deviceId: string,
      taskId: string,
      instruction: Record<string, unknown>
    ) => {
      const conn = store.getConnection(deviceId)
      if (!conn) return false
      dispatchTask(conn.ws, taskId, instruction, store)
      return true
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
