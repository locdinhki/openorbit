// ============================================================================
// OpenOrbit Shell — IPC Handlers (shell-only)
// Extension handlers are registered via their own activate() methods.
// ============================================================================

import { BrowserWindow } from 'electron'
import { networkInterfaces } from 'os'
import { IPC } from '@openorbit/core/ipc-channels'
import { ipcSchemas } from '@openorbit/core/ipc-schemas'
import { errorToResponse } from '@openorbit/core/errors'
import { getLogPath } from '@openorbit/core/utils/logger'
import { SessionManager } from '@openorbit/core/automation/session-manager'
import { AutomationCoordinator } from '@openorbit/core/automation/automation-coordinator'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import type { AIService } from '@openorbit/core/ai/provider-types'
import type { SkillService } from '@openorbit/core/skills/skill-types'
import type { Scheduler } from '@openorbit/core/automation/scheduler'
import type { Updater } from './updater'
import { validatedHandle } from './ipc-validation'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('IPC')

// --- Singletons (shared with Scheduler, TrayManager, RPC) ---

let sessionManager: SessionManager | null = null
let coordinator: AutomationCoordinator | null = null
let updater: Updater | null = null
let aiService: AIService | null = null
let scheduler: Scheduler | null = null
let skillService: SkillService | null = null

function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager()
  }
  return sessionManager
}

function getCoordinator(): AutomationCoordinator {
  if (!coordinator) {
    coordinator = new AutomationCoordinator(getSessionManager())
  }
  return coordinator
}

export function getActiveSessionManager(): SessionManager | null {
  return sessionManager
}

export function getOrCreateSessionManager(): SessionManager {
  return getSessionManager()
}

export function getActiveCoordinator(): AutomationCoordinator {
  return getCoordinator()
}

export function setUpdater(u: Updater): void {
  updater = u
}

export interface PairingContext {
  wsUrl: string
  token: string
}

export function getLocalIp(): string {
  const ifaces = networkInterfaces()
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address
      }
    }
  }
  return '127.0.0.1'
}

/**
 * Detect Tailscale tailnet IP by scanning network interfaces for
 * the CGNAT range (100.64.0.0/10) that Tailscale uses.
 */
export function getTailscaleIp(): string | null {
  const ifaces = networkInterfaces()
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        // Tailscale uses 100.64.0.0/10 (CGNAT range: 100.64.0.0 - 100.127.255.255)
        const parts = info.address.split('.').map(Number)
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {
          return info.address
        }
      }
    }
  }
  return null
}

export function resolvePairingInfo(pairing?: PairingContext): {
  wsUrl: string
  token: string
  tailnetUrl?: string
  webUrl?: string
} {
  const tailscaleIp = getTailscaleIp()
  const localIp = getLocalIp()
  const port = pairing?.wsUrl ? new URL(pairing.wsUrl.replace('ws://', 'http://')).port : '18790'

  return {
    wsUrl: pairing?.wsUrl ?? `ws://${localIp}:18790`,
    token: pairing?.token ?? '',
    ...(tailscaleIp ? { tailnetUrl: `ws://${tailscaleIp}:${port}` } : {}),
    webUrl: `http://${localIp}:18791`
  }
}

export function setAIService(service: AIService): void {
  aiService = service
}

export function setScheduler(s: Scheduler): void {
  scheduler = s
}

export function setSkillService(s: SkillService): void {
  skillService = s
}

export function registerIPCHandlers(mainWindow: BrowserWindow, pairing?: PairingContext): void {
  // --- Session ---

  validatedHandle(IPC.SESSION_INIT, ipcSchemas['session:init'], async () => {
    try {
      const sm = getSessionManager()
      await sm.init()
      return { success: true, hasExistingSession: sm.hasExistingSession() }
    } catch (err) {
      log.error('Failed to init session', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SESSION_STATUS, ipcSchemas['session:status'], () => {
    const sm = sessionManager
    return {
      initialized: sm?.isInitialized() ?? false,
      hasExistingSession: sm?.hasExistingSession() ?? false
    }
  })

  validatedHandle(IPC.SESSION_LOGIN, ipcSchemas['session:login'], async (_event, { platform }) => {
    try {
      const sm = getSessionManager()
      if (!sm.isInitialized()) {
        await sm.init()
      }

      const page = await sm.getPage()

      const loginUrls: Record<string, string> = {
        linkedin: 'https://www.linkedin.com/login',
        indeed: 'https://secure.indeed.com/account/login',
        upwork: 'https://www.upwork.com/ab/account-security/login'
      }

      const url = loginUrls[platform]
      if (!url) {
        return { success: false, error: `Unknown platform: ${platform}` }
      }

      await page.goto(url, { waitUntil: 'domcontentloaded' })
      log.info(`Navigated to ${platform} login page — waiting for user to log in`)

      return { success: true, platform, message: 'Login page opened. Log in manually.' }
    } catch (err) {
      log.error('Failed to open login page', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SESSION_SAVE, ipcSchemas['session:save'], () => {
    return { success: true }
  })

  validatedHandle(IPC.SESSION_CLOSE, ipcSchemas['session:close'], async () => {
    try {
      if (sessionManager) {
        await sessionManager.close()
        sessionManager = null
      }
      return { success: true }
    } catch (err) {
      log.error('Failed to close session', err)
      return errorToResponse(err)
    }
  })

  // --- Browser Navigation ---

  validatedHandle(IPC.BROWSER_NAVIGATE, ipcSchemas['browser:navigate'], async (_event, { url }) => {
    try {
      const sm = sessionManager
      if (!sm?.isInitialized()) {
        return { success: false, error: 'Session not initialized' }
      }
      const page = await sm.getPage()
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await sm.saveSession()
      return { success: true, url: page.url() }
    } catch (err) {
      log.error('Failed to navigate', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.BROWSER_SCREENSHOT, ipcSchemas['browser:screenshot'], async () => {
    try {
      const sm = sessionManager
      if (!sm?.isInitialized()) {
        return { success: false, error: 'Session not initialized' }
      }
      const page = await sm.getPage()
      const buffer = await page.screenshot({ type: 'png' })
      return { success: true, data: buffer.toString('base64') }
    } catch (err) {
      log.error('Failed to take screenshot', err)
      return errorToResponse(err)
    }
  })

  // --- Screencast (live browser view) ---

  validatedHandle(IPC.SCREENCAST_START, ipcSchemas['screencast:start'], async (_event, opts) => {
    try {
      const sm = sessionManager
      if (!sm?.isInitialized()) {
        return { success: false, error: 'Session not initialized' }
      }
      if (sm.getMode() === 'relay') {
        return { success: false, error: 'Live view not supported in relay mode' }
      }

      const platform = opts.platform
      const frameOpts = {
        quality: opts.quality,
        maxWidth: opts.maxWidth,
        maxHeight: opts.maxHeight,
        everyNthFrame: opts.everyNthFrame
      }

      if (platform) {
        const coord = getCoordinator()
        const pages = coord.getPages()
        const page = pages.get(platform)
        if (!page) {
          return { success: false, error: `No active page for platform: ${platform}` }
        }
        await sm.startScreencastForPlatform(platform, page, {
          ...frameOpts,
          onFrame: (frame) => {
            try {
              mainWindow.webContents.send(IPC.SCREENCAST_FRAME, frame)
            } catch {
              sm.stopScreencastForPlatform(platform).catch(() => {})
            }
          }
        })
      } else {
        await sm.startScreencast({
          ...frameOpts,
          onFrame: (frame) => {
            try {
              mainWindow.webContents.send(IPC.SCREENCAST_FRAME, { ...frame, platform: 'default' })
            } catch {
              sm.stopScreencast().catch(() => {})
            }
          }
        })
      }

      return { success: true }
    } catch (err) {
      log.error('Failed to start screencast', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SCREENCAST_STOP, ipcSchemas['screencast:stop'], async (_event, opts) => {
    try {
      const sm = sessionManager
      if (!sm?.isScreencasting()) {
        return { success: true }
      }
      if (opts.platform) {
        await sm.stopScreencastForPlatform(opts.platform)
      } else {
        await sm.stopAllScreencasts()
      }
      return { success: true }
    } catch (err) {
      log.error('Failed to stop screencast', err)
      return errorToResponse(err)
    }
  })

  // --- Settings ---

  const settingsRepo = new SettingsRepo()

  validatedHandle(IPC.SETTINGS_GET, ipcSchemas['settings:get'], (_event, { key }) => {
    try {
      const value = settingsRepo.get(key)
      return { success: true, data: value }
    } catch (err) {
      log.error('Failed to get setting', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SETTINGS_UPDATE, ipcSchemas['settings:update'], (_event, { key, value }) => {
    try {
      settingsRepo.set(key, value)
      if (key === 'anthropic_api_key' && aiService) {
        // Reset cached clients on all providers that support it
        for (const info of aiService.listProviders()) {
          const provider = aiService.getProvider(info.id)
          if (provider?.resetClient) provider.resetClient()
        }
      }
      return { success: true }
    } catch (err) {
      log.error('Failed to update setting', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SETTINGS_LOG_PATH, ipcSchemas['settings:log-path'], () => {
    return { success: true, data: getLogPath() }
  })

  // --- Updates ---

  validatedHandle(IPC.UPDATE_DOWNLOAD, ipcSchemas['update:download'], () => {
    try {
      if (updater) {
        updater.downloadUpdate()
      }
      return { success: true }
    } catch (err) {
      log.error('Failed to start update download', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.UPDATE_INSTALL, ipcSchemas['update:install'], () => {
    try {
      if (updater) {
        updater.installUpdate()
      }
      return { success: true }
    } catch (err) {
      log.error('Failed to install update', err)
      return errorToResponse(err)
    }
  })

  // --- RPC Pairing ---

  validatedHandle(IPC.RPC_PAIRING_INFO, ipcSchemas['rpc:pairing-info'], () => {
    try {
      const info = resolvePairingInfo(pairing)
      return { success: true, data: info }
    } catch (err) {
      log.error('Failed to get pairing info', err)
      return errorToResponse(err)
    }
  })

  // --- AI Provider Registry ---

  validatedHandle(IPC.AI_PROVIDERS, ipcSchemas['ai:providers'], () => {
    try {
      if (!aiService)
        return { success: false, error: 'AI service not initialized', code: 'AI_NOT_READY' }
      return { success: true, data: aiService.listProviders() }
    } catch (err) {
      log.error('Failed to list AI providers', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.AI_SET_DEFAULT, ipcSchemas['ai:set-default'], (_event, { providerId }) => {
    try {
      if (!aiService)
        return { success: false, error: 'AI service not initialized', code: 'AI_NOT_READY' }
      aiService.setDefault(providerId)
      settingsRepo.set('ai.default-provider', providerId)
      return { success: true }
    } catch (err) {
      log.error('Failed to set default AI provider', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(
    IPC.AI_COMPLETE,
    ipcSchemas['ai:complete'],
    async (_event, { providerId, ...request }) => {
      try {
        if (!aiService)
          return { success: false, error: 'AI service not initialized', code: 'AI_NOT_READY' }
        const result = await aiService.complete(request, providerId)
        return { success: true, data: result }
      } catch (err) {
        log.error('AI completion failed', err)
        return errorToResponse(err)
      }
    }
  )

  validatedHandle(
    IPC.AI_CHAT,
    ipcSchemas['ai:chat'],
    async (_event, { providerId, ...request }) => {
      try {
        if (!aiService)
          return { success: false, error: 'AI service not initialized', code: 'AI_NOT_READY' }
        const result = await aiService.chat(request, providerId)
        return { success: true, data: result }
      } catch (err) {
        log.error('AI chat failed', err)
        return errorToResponse(err)
      }
    }
  )

  validatedHandle(
    IPC.AI_STREAM,
    ipcSchemas['ai:stream'],
    async (_event, { providerId, ...request }) => {
      try {
        if (!aiService)
          return { success: false, error: 'AI service not initialized', code: 'AI_NOT_READY' }
        if (!aiService.stream)
          return { success: false, error: 'Streaming not supported', code: 'NOT_SUPPORTED' }

        // Stream chunks pushed to renderer via IPC push events
        const result = await aiService.stream(
          request,
          (chunk) => {
            try {
              mainWindow.webContents.send(IPC.AI_STREAM_CHUNK, chunk)
            } catch {
              /* window may be closed */
            }
          },
          providerId
        )
        return { success: true, data: result }
      } catch (err) {
        log.error('AI stream failed', err)
        return errorToResponse(err)
      }
    }
  )

  // --- Schedules ---

  validatedHandle(IPC.SCHEDULE_LIST, ipcSchemas['schedule:list'], () => {
    try {
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
      return { success: true, data: scheduler.listSchedules() }
    } catch (err) {
      log.error('Failed to list schedules', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SCHEDULE_CREATE, ipcSchemas['schedule:create'], (_event, input) => {
    try {
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
      const created = scheduler.createSchedule(input)
      return { success: true, data: created }
    } catch (err) {
      log.error('Failed to create schedule', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SCHEDULE_UPDATE, ipcSchemas['schedule:update'], (_event, { id, updates }) => {
    try {
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
      const updated = scheduler.updateSchedule(id, updates)
      return { success: true, data: updated }
    } catch (err) {
      log.error('Failed to update schedule', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SCHEDULE_DELETE, ipcSchemas['schedule:delete'], (_event, { id }) => {
    try {
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
      scheduler.deleteSchedule(id)
      return { success: true }
    } catch (err) {
      log.error('Failed to delete schedule', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SCHEDULE_TOGGLE, ipcSchemas['schedule:toggle'], (_event, { id, enabled }) => {
    try {
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
      const updated = scheduler.toggleSchedule(id, enabled)
      return { success: true, data: updated }
    } catch (err) {
      log.error('Failed to toggle schedule', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SCHEDULER_TOOLS, ipcSchemas['scheduler:tools'], () => {
    try {
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
      return { success: true, data: scheduler.listTools() }
    } catch (err) {
      log.error('Failed to list scheduler tools', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(IPC.SCHEDULE_TRIGGER, ipcSchemas['schedule:trigger'], async (_event, { id }) => {
    try {
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
      await scheduler.triggerNow(id)
      return { success: true }
    } catch (err) {
      log.error('Failed to trigger schedule', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(
    IPC.SCHEDULE_RUNS,
    ipcSchemas['schedule:runs'],
    (_event, { scheduleId, limit, offset }) => {
      try {
        if (!scheduler) return { success: false, error: 'Scheduler not initialized' }
        return { success: true, data: scheduler.listRuns(scheduleId, limit, offset) }
      } catch (err) {
        log.error('Failed to list schedule runs', err)
        return errorToResponse(err)
      }
    }
  )

  // -------------------------------------------------------------------------
  // Skills
  // -------------------------------------------------------------------------

  validatedHandle(IPC.SKILL_LIST, ipcSchemas['skill:list'], (_event, { category }) => {
    try {
      if (!skillService) return { success: false, error: 'Skill service not initialized' }
      return { success: true, data: skillService.listSkills(category) }
    } catch (err) {
      log.error('Failed to list skills', err)
      return errorToResponse(err)
    }
  })

  validatedHandle(
    IPC.SKILL_EXECUTE,
    ipcSchemas['skill:execute'],
    async (_event, { skillId, input }) => {
      try {
        if (!skillService) return { success: false, error: 'Skill service not initialized' }
        const result = await skillService.execute(skillId, input ?? {})
        return { success: true, data: result }
      } catch (err) {
        log.error('Skill execution failed', err)
        return errorToResponse(err)
      }
    }
  )

  validatedHandle(IPC.SKILL_INFO, ipcSchemas['skill:info'], (_event, { skillId }) => {
    try {
      if (!skillService) return { success: false, error: 'Skill service not initialized' }
      const skills = skillService.listSkills()
      const info = skills.find((s) => s.id === skillId)
      if (!info) return { success: false, error: `Skill "${skillId}" not found` }
      return { success: true, data: info }
    } catch (err) {
      log.error('Failed to get skill info', err)
      return errorToResponse(err)
    }
  })

  log.info('Shell IPC handlers registered')
}

export async function cleanupSession(): Promise<void> {
  if (coordinator) {
    coordinator.stop()
    coordinator = null
  }
  if (sessionManager) {
    await sessionManager.close()
    sessionManager = null
  }
}
