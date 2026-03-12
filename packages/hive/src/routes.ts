import { Router, json } from 'express'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { Store } from './store.js'
import type { TaskStatus } from './types.js'
import type { devices } from './db/schema.js'
import { getNextRun, validateCron } from './cron.js'
import { WorkflowRunner } from './workflow-runner.js'
import crypto from 'node:crypto'
import type { DashboardHub } from './dashboard-hub.js'

// User info attached to authenticated requests
interface AuthUser {
  id: string
  username: string
  role: string
}

// Use a WeakMap to associate user info with requests (avoids global augmentation)
const requestUsers = new WeakMap<Request, AuthUser>()

function setReqUser(req: Request, user: AuthUser): void {
  requestUsers.set(req, user)
}

function getReqUser(req: Request): AuthUser | undefined {
  return requestUsers.get(req)
}

const SENSITIVE_FIELDS = ['password', 'apiKey', 'token', 'secret', 'passwordHash']

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = value
    }
  }
  return result
}

export function createRoutes(
  store: Store,
  dispatchTaskToDevice: (
    deviceId: string,
    taskId: string,
    instruction: Record<string, unknown>
  ) => boolean,
  controllerApiKey: string,
  jwtSecret: string,
  dashboardHub?: DashboardHub
): Router {
  const workflowRunner = new WorkflowRunner(store, dispatchTaskToDevice)
  const router = Router()
  router.use(json())

  // ── Auth middleware ────────────────────────────────────────────────────

  /**
   * Authenticates requests via:
   * 1. JWT token (from login endpoint)
   * 2. Legacy CONTROLLER_API_KEY (backwards compatibility for ext-hive, hive-ctl)
   * 3. Dev mode (no key set = unauthenticated)
   */
  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    // Dev mode — no auth configured
    if (!controllerApiKey && !jwtSecret) {
      next()
      return
    }

    const auth = req.headers.authorization
    if (!auth) {
      res.status(401).json({ error: 'Missing Authorization header' })
      return
    }
    const token = auth.replace(/^Bearer\s+/i, '')

    // Try legacy API key first
    if (controllerApiKey && token === controllerApiKey) {
      // Machine-to-machine auth — treat as admin
      setReqUser(req, { id: 'api-key', username: 'api-key', role: 'admin' })
      next()
      return
    }

    // Try JWT
    try {
      const payload = jwt.verify(token, jwtSecret) as {
        id: string
        username: string
        role: string
      }
      setReqUser(req, { id: payload.id, username: payload.username, role: payload.role })
      next()
    } catch {
      res.status(403).json({ error: 'Invalid or expired token' })
    }
  }

  /**
   * Role guard — must be used after requireAuth.
   * Allows the specified role and all roles above it (admin > operator > viewer).
   */
  function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = getReqUser(req)
      if (!user) {
        // Dev mode — no auth
        next()
        return
      }
      if (!roles.includes(user.role)) {
        res.status(403).json({ error: 'Insufficient permissions' })
        return
      }
      next()
    }
  }

  /**
   * Audit middleware — logs state-changing API calls after successful response.
   */
  function audit(action: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          store
            .createAuditEntry({
              userId: getReqUser(req)?.id,
              action,
              targetId: String(req.params.id ?? req.params.deviceId ?? ''),
              payload: redact(req.body) as Record<string, unknown>,
              ip: Array.isArray(req.ip) ? req.ip[0] : req.ip
            })
            .catch((err) =>
              console.error('[audit] Failed to write:', err instanceof Error ? err.message : err)
            )
        }
      })
      next()
    }
  }

  // ── Auth endpoints ──────────────────────────────────────────────────────

  router.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' })
    }

    const user = await store.verifyUserPassword(username, password)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, {
      expiresIn: '24h'
    })

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    })
  })

  router.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: getReqUser(req) })
  })

  // ── User Management (admin only) ────────────────────────────────────────

  router.get('/api/users', requireAuth, requireRole('admin'), async (_req, res) => {
    const userList = await store.listUsers()
    res.json(
      userList.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt
      }))
    )
  })

  router.post(
    '/api/users',
    requireAuth,
    requireRole('admin'),
    audit('user.create'),
    async (req, res) => {
      const { username, password, role } = req.body
      if (!username || !password || !role) {
        return res.status(400).json({ error: 'username, password, and role required' })
      }
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'role must be admin, operator, or viewer' })
      }
      const existing = await store.getUserByUsername(username)
      if (existing) {
        return res.status(409).json({ error: 'Username already exists' })
      }
      const user = await store.createUser({ username, password, role })
      res.status(201).json({
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      })
    }
  )

  router.patch(
    '/api/users/:id',
    requireAuth,
    requireRole('admin'),
    audit('user.update'),
    async (req, res) => {
      const id = String(req.params.id)
      const existing = await store.getUser(id)
      if (!existing) return res.status(404).json({ error: 'User not found' })

      const updates: { role?: string; password?: string } = {}
      if (req.body.role !== undefined) {
        if (!['admin', 'operator', 'viewer'].includes(req.body.role)) {
          return res.status(400).json({ error: 'role must be admin, operator, or viewer' })
        }
        updates.role = req.body.role
      }
      if (req.body.password !== undefined) updates.password = req.body.password

      const updated = await store.updateUser(id, updates)
      if (!updated) return res.status(404).json({ error: 'User not found' })
      res.json({
        id: updated.id,
        username: updated.username,
        role: updated.role,
        createdAt: updated.createdAt,
        lastLoginAt: updated.lastLoginAt
      })
    }
  )

  router.delete(
    '/api/users/:id',
    requireAuth,
    requireRole('admin'),
    audit('user.delete'),
    async (req, res) => {
      const id = String(req.params.id)
      // Prevent deleting yourself
      if (getReqUser(req)?.id === id) {
        return res.status(400).json({ error: 'Cannot delete your own account' })
      }
      await store.deleteUser(id)
      res.json({ success: true })
    }
  )

  // ── Audit Log (admin only) ──────────────────────────────────────────────

  router.get('/api/audit-log', requireAuth, requireRole('admin'), async (req, res) => {
    const userId = req.query.userId as string | undefined
    const action = req.query.action as string | undefined
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0
    const entries = await store.listAuditLog({ userId, action, limit, offset })
    res.json(entries)
  })

  // ── Health ─────────────────────────────────────────────────────────────

  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() })
  })

  // ── Minion update info (public — no auth required) ─────────────────────

  router.get('/minion/latest', (_req, res) => {
    const version = process.env.MINION_LATEST_VERSION
    const downloadUrl = process.env.MINION_DOWNLOAD_URL
    const checksum = process.env.MINION_CHECKSUM ?? ''

    if (!version || !downloadUrl) {
      return res.status(404).json({ error: 'No minion update configured' })
    }

    res.json({ version, downloadUrl, checksum })
  })

  // Dispatch self-update to a single device
  router.post(
    '/api/minion/update/:deviceId',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('minion.update'),
    async (req, res) => {
      const deviceId = String(req.params.deviceId)
      const device = await store.getDevice(deviceId)
      if (!device) return res.status(404).json({ error: 'Device not found' })

      const version = process.env.MINION_LATEST_VERSION
      const downloadUrl = process.env.MINION_DOWNLOAD_URL
      const checksum = process.env.MINION_CHECKSUM ?? ''
      if (!version || !downloadUrl) {
        return res
          .status(503)
          .json({ error: 'MINION_LATEST_VERSION and MINION_DOWNLOAD_URL env vars not set' })
      }

      const instruction = { type: 'self-update', version, downloadUrl, checksum }
      const task = await store.createTask({
        targetDevice: deviceId,
        instruction,
        priority: 'high'
      })
      dispatchTaskToDevice(deviceId, task.id, instruction)
      res.status(201).json(task)
    }
  )

  // Dispatch self-update to all online minions
  router.post(
    '/api/minion/update-all',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('minion.update-all'),
    async (_req, res) => {
      const version = process.env.MINION_LATEST_VERSION
      const downloadUrl = process.env.MINION_DOWNLOAD_URL
      const checksum = process.env.MINION_CHECKSUM ?? ''
      if (!version || !downloadUrl) {
        return res
          .status(503)
          .json({ error: 'MINION_LATEST_VERSION and MINION_DOWNLOAD_URL env vars not set' })
      }

      const allDevices = await store.listDevices()
      const online = allDevices.filter((d) => d.status === 'online' && d.type === 'minion')

      const instruction = { type: 'self-update', version, downloadUrl, checksum }
      const tasks = await Promise.all(
        online.map(async (d) => {
          const task = await store.createTask({
            targetDevice: d.id,
            instruction,
            priority: 'high'
          })
          dispatchTaskToDevice(d.id, task.id, instruction)
          return task
        })
      )

      res.status(201).json({ version, deviceCount: tasks.length, tasks })
    }
  )

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

  router.post(
    '/api/devices',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('device.create'),
    async (req, res) => {
      const { id, name, type, hardwareId, capabilities, locationTag } = req.body
      if (!id || !name) return res.status(400).json({ error: 'id and name required' })

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

      res.status(201).json({ ...sanitizeDevice(device), apiKey })
    }
  )

  // ── Tasks ──────────────────────────────────────────────────────────────

  router.post(
    '/api/tasks',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('task.create'),
    async (req, res) => {
      const { targetDevice, priority, instruction } = req.body
      if (!instruction || !instruction.type) {
        return res.status(400).json({ error: 'instruction with type required' })
      }

      const task = await store.createTask({ targetDevice, priority, instruction })
      dashboardHub?.broadcast('task.created', { task })

      if (targetDevice) {
        dispatchTaskToDevice(targetDevice, task.id, instruction)
      }

      res.status(201).json(task)
    }
  )

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

  router.post(
    '/api/schedules',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('schedule.create'),
    async (req, res) => {
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
    }
  )

  router.put(
    '/api/schedules/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('schedule.update'),
    async (req, res) => {
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
    }
  )

  router.delete(
    '/api/schedules/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('schedule.delete'),
    async (req, res) => {
      await store.deleteSchedule(String(req.params.id))
      res.json({ success: true })
    }
  )

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

  router.post(
    '/api/workflows',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('workflow.create'),
    async (req, res) => {
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
    }
  )

  router.delete(
    '/api/workflows/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('workflow.delete'),
    async (req, res) => {
      await store.deleteWorkflow(String(req.params.id))
      res.json({ success: true })
    }
  )

  // ── Workflow Runs ──────────────────────────────────────────────────────

  router.get('/api/workflows/:id/runs', requireAuth, async (req, res) => {
    const runs = await store.listWorkflowRuns(String(req.params.id))
    res.json(runs)
  })

  router.post(
    '/api/workflows/:id/run',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('workflow.run'),
    async (req, res) => {
      const workflow = await store.getWorkflow(String(req.params.id))
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' })

      const run = await store.createWorkflowRun(workflow.id)
      workflowRunner.run(run.id, workflow.steps)
      res.status(201).json(run)
    }
  )

  router.get('/api/workflow-runs/:id', requireAuth, async (req, res) => {
    const run = await store.getWorkflowRun(String(req.params.id))
    if (!run) return res.status(404).json({ error: 'Run not found' })
    const stepRuns = await store.getWorkflowStepRuns(run.id)
    res.json({ ...run, stepRuns })
  })

  // ── Device Groups ──────────────────────────────────────────────────────

  router.get('/api/groups', requireAuth, async (_req, res) => {
    const groups = await store.listGroups()
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

  router.post(
    '/api/groups',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('group.create'),
    async (req, res) => {
      const { name, description, tagFilter } = req.body
      if (!name || !tagFilter) {
        return res.status(400).json({ error: 'name and tagFilter required' })
      }
      const group = await store.createGroup({ name, description, tagFilter })
      res.status(201).json(group)
    }
  )

  router.delete(
    '/api/groups/:id',
    requireAuth,
    requireRole('admin'),
    audit('group.delete'),
    async (req, res) => {
      await store.deleteGroup(String(req.params.id))
      res.json({ success: true })
    }
  )

  // Broadcast
  router.post(
    '/api/groups/:id/broadcast',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('group.broadcast'),
    async (req, res) => {
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
    }
  )

  // ── Device Metrics ─────────────────────────────────────────────────────

  router.get('/api/metrics/:deviceId', requireAuth, async (req, res) => {
    const deviceId = String(req.params.deviceId)
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 60
    const metrics = await store.getMetrics(deviceId, limit)
    res.json(metrics.reverse())
  })

  // ── Alert Rules ────────────────────────────────────────────────────────

  router.get('/api/alert-rules', requireAuth, async (_req, res) => {
    const rules = await store.listAlertRules()
    res.json(rules)
  })

  router.post(
    '/api/alert-rules',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('alert-rule.create'),
    async (req, res) => {
      const { name, deviceId, metric, threshold } = req.body
      if (!name || !metric || threshold === undefined) {
        return res.status(400).json({ error: 'name, metric, and threshold required' })
      }
      if (!['cpu', 'mem', 'offline'].includes(metric)) {
        return res.status(400).json({ error: 'metric must be cpu, mem, or offline' })
      }
      const rule = await store.createAlertRule({
        name,
        deviceId: deviceId || undefined,
        metric,
        threshold: Number(threshold)
      })
      res.status(201).json(rule)
    }
  )

  router.delete(
    '/api/alert-rules/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('alert-rule.delete'),
    async (req, res) => {
      await store.deleteAlertRule(String(req.params.id))
      res.json({ success: true })
    }
  )

  // ── Alerts ─────────────────────────────────────────────────────────────

  router.get('/api/alerts', requireAuth, async (req, res) => {
    const deviceId = req.query.deviceId as string | undefined
    const activeOnly = req.query.active === 'true'
    const alertList = await store.listAlerts({ deviceId, activeOnly })
    res.json(alertList)
  })

  router.post(
    '/api/alerts/:id/resolve',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('alert.resolve'),
    async (req, res) => {
      await store.resolveAlert(String(req.params.id))
      res.json({ success: true })
    }
  )

  // ── Task Templates ──────────────────────────────────────────────────────

  router.get('/api/templates', requireAuth, async (_req, res) => {
    const list = await store.listTemplates()
    res.json(list)
  })

  router.post(
    '/api/templates',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('template.create'),
    async (req, res) => {
      const { name, description, deviceId, instruction } = req.body
      if (!name || !instruction || !instruction.type) {
        return res.status(400).json({ error: 'name and instruction with type required' })
      }
      const tpl = await store.createTemplate({ name, description, deviceId, instruction })
      res.status(201).json(tpl)
    }
  )

  router.delete(
    '/api/templates/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('template.delete'),
    async (req, res) => {
      await store.deleteTemplate(String(req.params.id))
      res.json({ success: true })
    }
  )

  router.post(
    '/api/templates/:id/run',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('template.run'),
    async (req, res) => {
      const template = await store.getTemplate(String(req.params.id))
      if (!template) return res.status(404).json({ error: 'Template not found' })

      const targetDevice = (req.body.deviceId as string) || template.deviceId
      if (!targetDevice) {
        return res.status(400).json({ error: 'deviceId required (template has no default device)' })
      }

      const task = await store.createTask({
        targetDevice,
        instruction: template.instruction
      })
      dispatchTaskToDevice(targetDevice, task.id, template.instruction)
      res.status(201).json(task)
    }
  )

  // ── Webhooks ──────────────────────────────────────────────────────────

  // Public endpoint — no auth, token in URL
  router.post('/webhooks/:token', async (req, res) => {
    const webhook = await store.getWebhookByToken(String(req.params.token))
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' })

    const payload = req.body as Record<string, unknown>
    let resultId: string | undefined

    try {
      switch (webhook.action) {
        case 'task': {
          const deviceId = webhook.deviceId || (payload.deviceId as string)
          const instruction = (payload.instruction as Record<string, unknown>) || {
            type: 'exec',
            command: (payload.command as string) || 'echo "webhook triggered"'
          }
          if (!deviceId) {
            return res.status(400).json({ error: 'No deviceId configured or provided' })
          }
          const task = await store.createTask({ targetDevice: deviceId, instruction })
          dispatchTaskToDevice(deviceId, task.id, instruction)
          resultId = task.id
          break
        }
        case 'workflow': {
          const workflow = await store.getWorkflow(webhook.actionId)
          if (!workflow) return res.status(404).json({ error: 'Linked workflow not found' })
          const run = await store.createWorkflowRun(workflow.id)
          workflowRunner.run(run.id, workflow.steps)
          resultId = run.id
          break
        }
        case 'template': {
          const template = await store.getTemplate(webhook.actionId)
          if (!template) return res.status(404).json({ error: 'Linked template not found' })
          const deviceId = webhook.deviceId || template.deviceId || (payload.deviceId as string)
          if (!deviceId) {
            return res.status(400).json({ error: 'No deviceId available' })
          }
          const task = await store.createTask({
            targetDevice: deviceId,
            instruction: template.instruction
          })
          dispatchTaskToDevice(deviceId, task.id, template.instruction)
          resultId = task.id
          break
        }
      }
    } catch (err) {
      console.error('[webhook] Error:', err instanceof Error ? err.message : err)
      return res.status(500).json({ error: 'Webhook action failed' })
    }

    await store.createWebhookCall({ webhookId: webhook.id, payload, resultId })
    res.json({ ok: true, resultId })
  })

  router.get('/api/webhooks', requireAuth, async (_req, res) => {
    const list = await store.listWebhooks()
    res.json(list)
  })

  router.post(
    '/api/webhooks',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('webhook.create'),
    async (req, res) => {
      const { name, action, actionId, deviceId } = req.body
      if (!name || !action || !actionId) {
        return res.status(400).json({ error: 'name, action, and actionId required' })
      }
      if (!['task', 'workflow', 'template'].includes(action)) {
        return res.status(400).json({ error: 'action must be task, workflow, or template' })
      }
      const token = crypto.randomBytes(24).toString('hex')
      const webhook = await store.createWebhook({ name, token, action, actionId, deviceId })
      res.status(201).json(webhook)
    }
  )

  router.delete(
    '/api/webhooks/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('webhook.delete'),
    async (req, res) => {
      await store.deleteWebhook(String(req.params.id))
      res.json({ success: true })
    }
  )

  router.get('/api/webhooks/:id/calls', requireAuth, async (req, res) => {
    const calls = await store.listWebhookCalls(String(req.params.id))
    res.json(calls)
  })

  // ── Triggers ──────────────────────────────────────────────────────────

  router.get('/api/triggers', requireAuth, async (_req, res) => {
    const list = await store.listTriggers()
    res.json(list)
  })

  router.post(
    '/api/triggers',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('trigger.create'),
    async (req, res) => {
      const { name, condition, conditionParams, action, actionParams, cooldownS } = req.body
      if (!name || !condition || !action || !actionParams) {
        return res.status(400).json({ error: 'name, condition, action, and actionParams required' })
      }
      const validConditions = [
        'alert.fired',
        'alert.resolved',
        'device.online',
        'device.offline',
        'metric.threshold'
      ]
      if (!validConditions.includes(condition)) {
        return res
          .status(400)
          .json({ error: `condition must be one of: ${validConditions.join(', ')}` })
      }
      const validActions = ['run_workflow', 'run_template', 'exec_command', 'send_telegram']
      if (!validActions.includes(action)) {
        return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` })
      }
      const trigger = await store.createTrigger({
        name,
        condition,
        conditionParams,
        action,
        actionParams,
        cooldownS
      })
      res.status(201).json(trigger)
    }
  )

  router.patch(
    '/api/triggers/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('trigger.update'),
    async (req, res) => {
      const id = String(req.params.id)
      const existing = await store.getTrigger(id)
      if (!existing) return res.status(404).json({ error: 'Trigger not found' })
      const updates: { enabled?: boolean } = {}
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled
      const updated = await store.updateTrigger(id, updates)
      res.json(updated)
    }
  )

  router.delete(
    '/api/triggers/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('trigger.delete'),
    async (req, res) => {
      await store.deleteTrigger(String(req.params.id))
      res.json({ success: true })
    }
  )

  router.get('/api/triggers/:id/runs', requireAuth, async (req, res) => {
    const runs = await store.listTriggerRuns(String(req.params.id))
    res.json(runs)
  })

  // ── Health Checks ──────────────────────────────────────────────────────

  router.get('/api/health-checks', requireAuth, async (req, res) => {
    const deviceId = req.query.deviceId as string | undefined
    const checks = await store.listHealthChecks(deviceId ? { deviceId } : undefined)
    const enriched = await Promise.all(
      checks.map(async (c) => {
        const latest = await store.getLatestHealthCheckResult(c.id)
        return {
          ...c,
          lastStatus: latest?.status ?? null,
          lastCheckedAt: latest?.checkedAt ?? null
        }
      })
    )
    res.json(enriched)
  })

  router.post(
    '/api/health-checks',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('health-check.create'),
    async (req, res) => {
      const {
        deviceId,
        name,
        type,
        url,
        expectedStatus,
        expectedBody,
        command,
        expectedExit,
        runFrom,
        intervalS,
        timeoutS
      } = req.body
      if (!deviceId || !name || !type) {
        return res.status(400).json({ error: 'deviceId, name, and type required' })
      }
      if (!['http', 'command'].includes(type)) {
        return res.status(400).json({ error: 'type must be http or command' })
      }
      const check = await store.createHealthCheck({
        deviceId,
        name,
        type,
        url,
        expectedStatus,
        expectedBody,
        command,
        expectedExit,
        runFrom,
        intervalS,
        timeoutS
      })
      res.status(201).json(check)
    }
  )

  router.patch(
    '/api/health-checks/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('health-check.update'),
    async (req, res) => {
      const id = String(req.params.id)
      const existing = await store.getHealthCheck(id)
      if (!existing) return res.status(404).json({ error: 'Health check not found' })
      const updates: { enabled?: boolean; intervalS?: number; timeoutS?: number; name?: string } =
        {}
      if (req.body.enabled !== undefined) updates.enabled = req.body.enabled
      if (req.body.intervalS !== undefined) updates.intervalS = req.body.intervalS
      if (req.body.timeoutS !== undefined) updates.timeoutS = req.body.timeoutS
      if (req.body.name !== undefined) updates.name = req.body.name
      const updated = await store.updateHealthCheck(id, updates)
      res.json(updated)
    }
  )

  router.delete(
    '/api/health-checks/:id',
    requireAuth,
    requireRole('admin', 'operator'),
    audit('health-check.delete'),
    async (req, res) => {
      await store.deleteHealthCheck(String(req.params.id))
      res.json({ success: true })
    }
  )

  router.get('/api/health-checks/:id/results', requireAuth, async (req, res) => {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20
    const results = await store.getHealthCheckResults(String(req.params.id), limit)
    res.json(results)
  })

  // ── Fleet Reports ──────────────────────────────────────────────────────

  router.get('/api/reports', requireAuth, async (_req, res) => {
    const reports = await store.listFleetReports()
    res.json(reports)
  })

  router.get('/api/reports/:id', requireAuth, async (req, res) => {
    const report = await store.getFleetReport(String(req.params.id))
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json(report)
  })

  // POST /api/reports/generate is wired in index.ts (needs AI + store access)

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
