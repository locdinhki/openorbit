import { Router, json } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { Store } from './store.js'
import type { TaskStatus } from './types.js'
import type { devices } from './db/schema.js'

export function createRoutes(
  store: Store,
  dispatchTaskToDevice: (
    deviceId: string,
    taskId: string,
    instruction: Record<string, unknown>
  ) => boolean,
  controllerApiKey: string
): Router {
  const router = Router()
  router.use(json())

  // ── Auth middleware ────────────────────────────────────────────────────

  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!controllerApiKey) return next() // No key = dev mode
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'Missing Authorization header' })
    const token = auth.replace(/^Bearer\s+/i, '')
    if (token !== controllerApiKey) return res.status(403).json({ error: 'Invalid API key' })
    next()
  }

  // ── Health ─────────────────────────────────────────────────────────────

  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() })
  })

  // ── Devices ────────────────────────────────────────────────────────────

  router.get('/api/devices', requireAuth, async (_req, res) => {
    const deviceList = await store.listDevices()
    res.json(deviceList.map(sanitizeDevice))
  })

  router.get('/api/devices/:id', requireAuth, async (req, res) => {
    const device = await store.getDevice(req.params.id)
    if (!device) return res.status(404).json({ error: 'Device not found' })
    res.json(sanitizeDevice(device))
  })

  router.post('/api/devices', requireAuth, async (req, res) => {
    const { id, name, type, hardwareId, capabilities, locationTag } = req.body
    if (!id || !name) return res.status(400).json({ error: 'id and name required' })

    // Generate API key for this device
    const apiKey = generateApiKey()
    const device = await store.registerDevice({
      id,
      hardwareId: hardwareId ?? '',
      name,
      type: type ?? 'minion',
      apiKey,
      capabilities,
      locationTag
    })

    // Return the API key once — it's hashed in DB and won't be retrievable later
    res.status(201).json({ ...sanitizeDevice(device), apiKey })
  })

  // ── Tasks ──────────────────────────────────────────────────────────────

  router.post('/api/tasks', requireAuth, async (req, res) => {
    const { targetDevice, priority, instruction } = req.body
    if (!instruction || !instruction.type) {
      return res.status(400).json({ error: 'instruction with type required' })
    }

    const task = await store.createTask({ targetDevice, priority, instruction })

    // Try to dispatch immediately if target is online
    if (targetDevice) {
      dispatchTaskToDevice(targetDevice, task.id, instruction)
    }

    res.status(201).json(task)
  })

  router.get('/api/tasks', requireAuth, async (req, res) => {
    const status = req.query.status as string | undefined
    const deviceId = req.query.deviceId as string | undefined
    const taskList = await store.listTasks({ status: status as TaskStatus | undefined, deviceId })
    res.json(taskList)
  })

  router.get('/api/tasks/:id', requireAuth, async (req, res) => {
    const task = await store.getTask(req.params.id)
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const results = await store.getResults(task.id)
    res.json({ ...task, results })
  })

  return router
}

function sanitizeDevice(
  d: typeof devices.$inferSelect
): Omit<typeof devices.$inferSelect, 'apiKeyHash'> {
  const { apiKeyHash: _apiKeyHash, ...rest } = d
  return rest
}

function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let key = 'hive_'
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}
