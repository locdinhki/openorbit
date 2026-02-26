import type { RPCServer } from './rpc-server'
import type { AutomationCoordinator } from '@openorbit/core/automation/automation-coordinator'
import { JobsRepo } from '@openorbit/core/db/jobs-repo'
import { ProfilesRepo } from '@openorbit/core/db/profiles-repo'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { SchedulesRepo } from '@openorbit/core/db/schedules-repo'
import { ApplicationsRepo } from '@openorbit/core/db/applications-repo'
import { ActionLogRepo } from '@openorbit/core/db/action-log-repo'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('RPC-Handlers')

export interface RPCHandlerContext {
  getCoordinator: () => AutomationCoordinator
}

/**
 * Register all JSON-RPC method handlers on the server.
 * Mirrors the IPC surface but accessible from CLI/external tools.
 */
export function registerRPCHandlers(server: RPCServer, ctx: RPCHandlerContext): void {
  const jobsRepo = new JobsRepo()
  const profilesRepo = new ProfilesRepo()
  const settingsRepo = new SettingsRepo()
  const schedulesRepo = new SchedulesRepo()
  const applicationsRepo = new ApplicationsRepo()
  const actionLogRepo = new ActionLogRepo()

  // --- automation ---

  server.register('automation.start', async (params) => {
    const profileId = typeof params['profileId'] === 'string' ? params['profileId'] : undefined
    const coord = ctx.getCoordinator()
    if (coord.isRunning()) {
      return { success: false, error: 'Automation already running' }
    }
    const run = profileId ? coord.startProfile(profileId) : coord.startAll()
    run.catch((err) => log.error('RPC automation run failed', err))
    return { success: true }
  })

  server.register('automation.stop', () => {
    ctx.getCoordinator().stop()
    return { success: true }
  })

  server.register('automation.pause', () => {
    ctx.getCoordinator().pause()
    return { success: true }
  })

  server.register('automation.status', () => {
    return ctx.getCoordinator().getStatus()
  })

  // --- jobs ---

  server.register('jobs.list', (params) => {
    const filters = (params['filters'] ?? {}) as Parameters<JobsRepo['list']>[0]
    return { success: true, data: jobsRepo.list(filters) }
  })

  server.register('jobs.get', (params) => {
    const id = String(params['id'])
    return { success: true, data: jobsRepo.getById(id) }
  })

  server.register('jobs.approve', (params) => {
    const id = String(params['id'])
    jobsRepo.updateStatus(id, 'approved')
    return { success: true }
  })

  server.register('jobs.reject', (params) => {
    const id = String(params['id'])
    jobsRepo.updateStatus(id, 'rejected')
    return { success: true }
  })

  server.register('jobs.update', (params) => {
    const id = String(params['id'])
    const updates = params['updates'] as Parameters<JobsRepo['updateStatus']>[1] | undefined
    if (updates) jobsRepo.updateStatus(id, updates)
    return { success: true, data: jobsRepo.getById(id) }
  })

  // --- applications ---

  server.register('applications.list-applied', (params) => {
    const platform = typeof params['platform'] === 'string' ? params['platform'] : undefined
    const limit = typeof params['limit'] === 'number' ? params['limit'] : undefined
    return { success: true, data: applicationsRepo.listApplied({ platform, limit }) }
  })

  // --- profiles ---

  server.register('profiles.list', () => {
    return { success: true, data: profilesRepo.list() }
  })

  // --- settings ---

  server.register('settings.get', (params) => {
    const key = String(params['key'])
    return { success: true, data: settingsRepo.get(key) }
  })

  server.register('settings.set', (params) => {
    const key = String(params['key'])
    const value = String(params['value'])
    settingsRepo.set(key, value)
    return { success: true }
  })

  // --- schedules ---

  server.register('schedules.list', () => {
    return { success: true, data: schedulesRepo.list() }
  })

  // --- action log ---

  server.register('action-log.list', (params) => {
    const limit = typeof params['limit'] === 'number' ? params['limit'] : 50
    return { success: true, data: actionLogRepo.getRecent(limit) }
  })

  // --- relay ---

  server.register('relay.status', () => {
    return { success: true, data: { attachedTabs: server.getRelayTabIds() } }
  })

  log.info('RPC handlers registered')
}
