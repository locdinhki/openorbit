import { Router, json } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { Store } from './store.js'
import type { TaskStatus } from './types.js'
import type { devices } from './db/schema.js'
import { getNextRun, validateCron } from './cron.js'
import { WorkflowRunner } from './workflow-runner.js'

export function createRoutes(
  store: Store,
  dispatchTaskToDevice: (
    deviceId: string,
    taskId: string,
    instruction: Record<string, unknown>
  ) => boolean,
  controllerApiKey: string
): Router {
  const workflowRunner = new WorkflowRunner(store, dispatchTaskToDevice)
  const router = Router()
  router.use(json())

  // ── Auth middleware ────────────────────────────────────────────────────

  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!controllerApiKey) {
      next()
      return
    }
    const auth = req.headers.authorization
    if (!auth) {
      res.status(401).json({ error: 'Missing Authorization header' })
      return
    }
    const token = auth.replace(/^Bearer\s+/i, '')
    if (token !== controllerApiKey) {
      res.status(403).json({ error: 'Invalid API key' })
      return
    }
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
    const device = await store.getDevice(String(req.params.id))
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
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined
    const taskList = await store.listTasks({
      status: status as TaskStatus | undefined,
      deviceId,
      limit
    })
    res.json(taskList)
  })

  router.get('/api/tasks/:id', requireAuth, async (req, res) => {
    const task = await store.getTask(String(req.params.id))
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const results = await store.getResults(task.id)
    res.json({ ...task, results })
  })

  // ── Schedules ────────────────────────────────────────────────────────

  router.get('/api/schedules', requireAuth, async (req, res) => {
    const deviceId = req.query.deviceId as string | undefined
    const list = await store.listSchedules(deviceId ? { deviceId } : undefined)
    res.json(list)
  })

  router.get('/api/schedules/:id', requireAuth, async (req, res) => {
    const schedule = await store.getSchedule(String(req.params.id))
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' })
    res.json(schedule)
  })

  router.post('/api/schedules', requireAuth, async (req, res) => {
    const { deviceId, name, instruction, cronExpression } = req.body
    if (!deviceId || !name || !instruction || !cronExpression) {
      return res
        .status(400)
        .json({ error: 'deviceId, name, instruction, and cronExpression required' })
    }

    const cronError = validateCron(cronExpression)
    if (cronError) return res.status(400).json({ error: cronError })

    const nextRunAt = getNextRun(cronExpression)
    const schedule = await store.createSchedule({
      deviceId,
      name,
      instruction,
      cronExpression,
      nextRunAt
    })
    res.status(201).json(schedule)
  })

  router.put('/api/schedules/:id', requireAuth, async (req, res) => {
    const id = String(req.params.id)
    const existing = await store.getSchedule(id)
    if (!existing) return res.status(404).json({ error: 'Schedule not found' })

    const updates: Record<string, unknown> = {}
    if (req.body.name !== undefined) updates.name = req.body.name
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled
    if (req.body.instruction !== undefined) updates.instruction = req.body.instruction
    if (req.body.cronExpression !== undefined) {
      const cronError = validateCron(req.body.cronExpression)
      if (cronError) return res.status(400).json({ error: cronError })
      updates.cronExpression = req.body.cronExpression
      updates.nextRunAt = getNextRun(req.body.cronExpression)
    }

    const updated = await store.updateSchedule(id, updates)
    res.json(updated)
  })

  router.delete('/api/schedules/:id', requireAuth, async (req, res) => {
    await store.deleteSchedule(String(req.params.id))
    res.json({ success: true })
  })

  // ── Workflows ─────────────────────────────────────────────────────────

  router.get('/api/workflows', requireAuth, async (_req, res) => {
    const list = await store.listWorkflows()
    res.json(list)
  })

  router.get('/api/workflows/:id', requireAuth, async (req, res) => {
    const workflow = await store.getWorkflow(String(req.params.id))
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' })
    res.json(workflow)
  })

  router.post('/api/workflows', requireAuth, async (req, res) => {
    const { name, description, steps } = req.body
    if (!name || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'name and non-empty steps array required' })
    }
    for (const [i, step] of steps.entries()) {
      if (!step.name || !step.deviceId || !step.instruction?.type) {
        return res
          .status(400)
          .json({ error: `Step ${i}: name, deviceId, and instruction.type required` })
      }
    }
    const workflow = await store.createWorkflow({ name, description, steps })
    res.status(201).json(workflow)
  })

  router.delete('/api/workflows/:id', requireAuth, async (req, res) => {
    await store.deleteWorkflow(String(req.params.id))
    res.json({ success: true })
  })

  // ── Workflow Runs ──────────────────────────────────────────────────────

  router.get('/api/workflows/:id/runs', requireAuth, async (req, res) => {
    const runs = await store.listWorkflowRuns(String(req.params.id))
    res.json(runs)
  })

  router.post('/api/workflows/:id/run', requireAuth, async (req, res) => {
    const workflow = await store.getWorkflow(String(req.params.id))
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' })

    const run = await store.createWorkflowRun(workflow.id)
    workflowRunner.run(run.id, workflow.steps)
    res.status(201).json(run)
  })

  router.get('/api/workflow-runs/:id', requireAuth, async (req, res) => {
    const run = await store.getWorkflowRun(String(req.params.id))
    if (!run) return res.status(404).json({ error: 'Run not found' })
    const stepRuns = await store.getWorkflowStepRuns(run.id)
    res.json({ ...run, stepRuns })
  })

  // ── Device Groups ──────────────────────────────────────────────────────

  router.get('/api/groups', requireAuth, async (_req, res) => {
    const groups = await store.listGroups()
    // Enrich with member count
    const enriched = await Promise.all(
      groups.map(async (g) => {
        const members = await store.getGroupMembers(g)
        const online = members.filter((d) => d.status === 'online').length
        return { ...g, memberCount: members.length, onlineCount: online }
      })
    )
    res.json(enriched)
  })

  router.get('/api/groups/:id', requireAuth, async (req, res) => {
    const group = await store.getGroup(String(req.params.id))
    if (!group) return res.status(404).json({ error: 'Group not found' })
    const members = await store.getGroupMembers(group)
    res.json({ ...group, members: members.map(sanitizeDevice) })
  })

  router.post('/api/groups', requireAuth, async (req, res) => {
    const { name, description, tagFilter } = req.body
    if (!name || !tagFilter) {
      return res.status(400).json({ error: 'name and tagFilter required' })
    }
    const group = await store.createGroup({ name, description, tagFilter })
    res.status(201).json(group)
  })

  router.delete('/api/groups/:id', requireAuth, async (req, res) => {
    await store.deleteGroup(String(req.params.id))
    res.json({ success: true })
  })

  // Broadcast: dispatch a task to all online members of a group
  router.post('/api/groups/:id/broadcast', requireAuth, async (req, res) => {
    const group = await store.getGroup(String(req.params.id))
    if (!group) return res.status(404).json({ error: 'Group not found' })

    const { instruction, priority } = req.body
    if (!instruction || !instruction.type) {
      return res.status(400).json({ error: 'instruction with type required' })
    }

    const members = await store.getOnlineGroupMembers(group)
    if (members.length === 0) {
      return res.status(409).json({ error: 'No online members in group' })
    }

    const tasks = await Promise.all(
      members.map(async (device) => {
        const task = await store.createTask({
          targetDevice: device.id,
          instruction,
          priority: priority ?? 'normal'
        })
        dispatchTaskToDevice(device.id, task.id, instruction)
        return task
      })
    )

    res.status(201).json({ groupId: group.id, taskCount: tasks.length, tasks })
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
