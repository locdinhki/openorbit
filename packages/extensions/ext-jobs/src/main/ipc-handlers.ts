// ============================================================================
// ext-jobs — IPC Handler Registration
//
// All handlers are registered through the extension's scoped IPC host,
// which enforces the `ext-jobs:` channel prefix.
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { getCoreEventBus } from '@openorbit/core/automation/core-events'
import { MemoryRepo } from '@openorbit/core/db/memory-repo'
import type { MemoryCategory } from '@openorbit/core/db/memory-repo'
import { JobAnalyzer } from '@openorbit/core/ai/job-analyzer'
import { JobsChatHandler } from './ai/jobs-chat-handler'
import { AutomationCoordinator } from './automation/automation-coordinator'
import { ProfilesRepo } from './db/profiles-repo'
import { JobsRepo } from './db/jobs-repo'
import { ActionLogRepo } from './db/action-log-repo'
import { AnswersRepo } from './db/answers-repo'
import { ChatSessionsRepo } from './db/chat-sessions-repo'
import { EXT_JOBS_IPC } from '../ipc-channels'
import { extJobsSchemas } from '../ipc-schemas'

let coordinator: AutomationCoordinator | null = null

function getCoordinator(ctx: ExtensionContext): AutomationCoordinator {
  if (!coordinator) {
    const sessionManager = ctx.services.browser.getSession()
    coordinator = new AutomationCoordinator(ctx.db, sessionManager)
  }
  return coordinator
}

export function getExtJobsCoordinator(ctx: ExtensionContext): AutomationCoordinator {
  return getCoordinator(ctx)
}

export function registerExtJobsHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx

  // Bridge CoreEventBus → ext-jobs push channels
  const bus = getCoreEventBus()
  bus.on('automation:status', (status) => {
    try {
      ipc.push(EXT_JOBS_IPC.AUTOMATION_STATUS_PUSH, status)
    } catch {
      /* window may be closed */
    }
  })
  bus.on('jobs:new', (job) => {
    try {
      ipc.push(EXT_JOBS_IPC.JOBS_NEW, job)
    } catch {
      /* window may be closed */
    }
  })
  bus.on('application:progress', (data) => {
    try {
      ipc.push(EXT_JOBS_IPC.APPLICATION_PROGRESS, data)
    } catch {
      /* window may be closed */
    }
  })
  bus.on('application:pause-question', (data) => {
    try {
      ipc.push(EXT_JOBS_IPC.APPLICATION_PAUSE_QUESTION, data)
    } catch {
      /* window may be closed */
    }
  })
  bus.on('application:complete', (data) => {
    try {
      ipc.push(EXT_JOBS_IPC.APPLICATION_COMPLETE, data)
    } catch {
      /* window may be closed */
    }
  })

  // --- Profiles ---

  const profilesRepo = new ProfilesRepo(db)

  ipc.handle(EXT_JOBS_IPC.PROFILES_LIST, extJobsSchemas['ext-jobs:profiles-list'], () => {
    try {
      return { success: true, data: profilesRepo.list() }
    } catch (err) {
      log.error('Failed to list profiles', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_JOBS_IPC.PROFILES_CREATE,
    extJobsSchemas['ext-jobs:profiles-create'],
    (_event, { profile }) => {
      try {
        const created = profilesRepo.insert(profile)
        return { success: true, data: created }
      } catch (err) {
        log.error('Failed to create profile', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.PROFILES_UPDATE,
    extJobsSchemas['ext-jobs:profiles-update'],
    (_event, { id, updates }) => {
      try {
        profilesRepo.update(id, updates)
        const updated = profilesRepo.getById(id)
        return { success: true, data: updated }
      } catch (err) {
        log.error('Failed to update profile', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.PROFILES_DELETE,
    extJobsSchemas['ext-jobs:profiles-delete'],
    (_event, { id }) => {
      try {
        profilesRepo.delete(id)
        return { success: true }
      } catch (err) {
        log.error('Failed to delete profile', err)
        return errorToResponse(err)
      }
    }
  )

  // --- Jobs ---

  const jobsRepo = new JobsRepo(db)
  const actionLogRepo = new ActionLogRepo(db)

  ipc.handle(EXT_JOBS_IPC.LIST, extJobsSchemas['ext-jobs:list'], (_event, { filters }) => {
    try {
      const jobs = jobsRepo.list(filters as Parameters<JobsRepo['list']>[0])
      return { success: true, data: jobs }
    } catch (err) {
      log.error('Failed to list jobs', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(EXT_JOBS_IPC.UPDATE, extJobsSchemas['ext-jobs:update'], (_event, { id, updates }) => {
    try {
      if (updates.status) {
        jobsRepo.updateStatus(id, updates.status as Parameters<JobsRepo['updateStatus']>[1])
      }
      const job = jobsRepo.getById(id)
      return { success: true, data: job }
    } catch (err) {
      log.error('Failed to update job', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(EXT_JOBS_IPC.APPROVE, extJobsSchemas['ext-jobs:approve'], (_event, { id }) => {
    try {
      jobsRepo.updateStatus(id, 'approved')
      return { success: true }
    } catch (err) {
      log.error('Failed to approve job', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(EXT_JOBS_IPC.REJECT, extJobsSchemas['ext-jobs:reject'], (_event, { id }) => {
    try {
      jobsRepo.updateStatus(id, 'rejected')
      return { success: true }
    } catch (err) {
      log.error('Failed to reject job', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(EXT_JOBS_IPC.DELETE, extJobsSchemas['ext-jobs:delete'], (_event, { id }) => {
    try {
      jobsRepo.delete(id)
      return { success: true }
    } catch (err) {
      log.error('Failed to delete job', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(EXT_JOBS_IPC.REFETCH, extJobsSchemas['ext-jobs:refetch'], async () => {
    try {
      if (!ctx.services.browser.isInitialized()) {
        return { success: false, error: 'Browser not connected. Launch the browser first.' }
      }
      const coord = getCoordinator(ctx)
      const result = await coord.refetchDescriptions()
      return { success: true, data: result }
    } catch (err) {
      log.error('Failed to refetch descriptions', err)
      return errorToResponse(err)
    }
  })

  // --- Automation ---

  ipc.handle(
    EXT_JOBS_IPC.AUTOMATION_START,
    extJobsSchemas['ext-jobs:automation-start'],
    async (_event, { profileId }) => {
      try {
        await ctx.services.browser.ensureReady()

        const coord = getCoordinator(ctx)

        if (coord.isRunning()) {
          return { success: false, error: 'Automation already running' }
        }

        if (profileId) {
          coord.startProfile(profileId).catch((err) => {
            log.error('Profile run failed', err)
          })
        } else {
          coord.startAll().catch((err) => {
            log.error('Run all failed', err)
          })
        }

        return { success: true }
      } catch (err) {
        log.error('Failed to start automation', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_JOBS_IPC.AUTOMATION_STOP, extJobsSchemas['ext-jobs:automation-stop'], () => {
    try {
      if (coordinator) {
        coordinator.stop()
      }
      return { success: true }
    } catch (err) {
      log.error('Failed to stop automation', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(EXT_JOBS_IPC.AUTOMATION_PAUSE, extJobsSchemas['ext-jobs:automation-pause'], () => {
    try {
      if (coordinator) {
        coordinator.pause()
      }
      return { success: true }
    } catch (err) {
      log.error('Failed to pause automation', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(EXT_JOBS_IPC.AUTOMATION_STATUS, extJobsSchemas['ext-jobs:automation-status'], () => {
    return coordinator
      ? coordinator.getStatus()
      : {
          state: 'idle',
          jobsExtracted: 0,
          jobsAnalyzed: 0,
          applicationsSubmitted: 0,
          actionsPerMinute: 0,
          errors: []
        }
  })

  // --- Chat ---

  const memoryRepo = new MemoryRepo()
  const answersRepo = new AnswersRepo(db)
  const sessionsRepo = new ChatSessionsRepo(db)
  const chatHandler = new JobsChatHandler(
    ctx.services.ai,
    jobsRepo,
    profilesRepo,
    actionLogRepo,
    answersRepo,
    memoryRepo
  )
  chatHandler.setSessionsRepo(sessionsRepo)
  const jobAnalyzer = new JobAnalyzer(ctx.services.ai)

  ipc.handle(
    EXT_JOBS_IPC.CHAT_SEND,
    extJobsSchemas['ext-jobs:chat-send'],
    async (_event, { message, selectedJobId }) => {
      try {
        const selectedJob = selectedJobId ? jobsRepo.getById(selectedJobId) : null
        const response = await chatHandler.sendMessage(message, selectedJob)
        return { success: true, data: response }
      } catch (err) {
        log.error('Chat failed', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.CHAT_ANALYZE_JOB,
    extJobsSchemas['ext-jobs:chat-analyze'],
    async (_event, { jobId }) => {
      try {
        const job = jobsRepo.getById(jobId)
        if (!job) {
          return { success: false, error: 'Job not found' }
        }

        const analysis = await jobAnalyzer.analyze(job)

        jobsRepo.updateAnalysis(jobId, {
          matchScore: analysis.matchScore,
          matchReasoning: analysis.reasoning,
          summary: analysis.summary,
          redFlags: analysis.redFlags,
          highlights: analysis.highlights
        })
        jobsRepo.updateStatus(jobId, 'reviewed')

        const updated = jobsRepo.getById(jobId)
        return { success: true, data: updated }
      } catch (err) {
        log.error('Job analysis failed', err)
        return errorToResponse(err)
      }
    }
  )

  // --- Sessions ---

  ipc.handle(
    EXT_JOBS_IPC.SESSIONS_LIST,
    extJobsSchemas['ext-jobs:sessions-list'],
    (_event, { limit }) => {
      try {
        return { success: true, data: sessionsRepo.list(limit) }
      } catch (err) {
        log.error('Failed to list sessions', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.SESSIONS_CREATE,
    extJobsSchemas['ext-jobs:sessions-create'],
    (_event, { title }) => {
      try {
        const session = sessionsRepo.create(title)
        chatHandler.clearHistory()
        chatHandler.setActiveSessionId(session.id)
        return { success: true, data: session }
      } catch (err) {
        log.error('Failed to create session', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.SESSIONS_LOAD,
    extJobsSchemas['ext-jobs:sessions-load'],
    (_event, { sessionId }) => {
      try {
        chatHandler.loadSession(sessionId)
        const messages = sessionsRepo.getMessages(sessionId)
        return { success: true, data: messages }
      } catch (err) {
        log.error('Failed to load session', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.SESSIONS_DELETE,
    extJobsSchemas['ext-jobs:sessions-delete'],
    (_event, { sessionId }) => {
      try {
        if (chatHandler.getActiveSessionId() === sessionId) {
          chatHandler.clearHistory()
        }
        sessionsRepo.delete(sessionId)
        return { success: true }
      } catch (err) {
        log.error('Failed to delete session', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.SESSIONS_RENAME,
    extJobsSchemas['ext-jobs:sessions-rename'],
    (_event, { sessionId, title }) => {
      try {
        sessionsRepo.rename(sessionId, title)
        return { success: true }
      } catch (err) {
        log.error('Failed to rename session', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_JOBS_IPC.CHAT_CLEAR, extJobsSchemas['ext-jobs:chat-clear'], () => {
    try {
      chatHandler.clearHistory()
      return { success: true }
    } catch (err) {
      log.error('Failed to clear chat', err)
      return errorToResponse(err)
    }
  })

  // --- Application ---

  ipc.handle(
    EXT_JOBS_IPC.APPLICATION_START,
    extJobsSchemas['ext-jobs:application-start'],
    async (_event, { jobId }) => {
      try {
        await ctx.services.browser.ensureReady()

        const coord = getCoordinator(ctx)

        if (coord.isRunning()) {
          return { success: false, error: 'Automation already running' }
        }

        if (jobId) {
          const job = jobsRepo.getById(jobId)
          if (!job) {
            return { success: false, error: 'Job not found' }
          }
          if (job.status !== 'approved') {
            return { success: false, error: 'Job must be approved before applying' }
          }
        }

        coord.applyToApproved().catch((err) => {
          log.error('Apply batch failed', err)
        })

        return { success: true }
      } catch (err) {
        log.error('Failed to start application', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.APPLICATION_ANSWER,
    extJobsSchemas['ext-jobs:application-answer'],
    (_event, { answer }) => {
      try {
        if (coordinator) {
          coordinator.resolveAnswer(answer)
        }
        return { success: true }
      } catch (err) {
        log.error('Failed to submit answer', err)
        return errorToResponse(err)
      }
    }
  )

  // --- Action Log ---

  ipc.handle(
    EXT_JOBS_IPC.ACTION_LOG_LIST,
    extJobsSchemas['ext-jobs:action-log-list'],
    (_event, { limit }) => {
      try {
        const entries = actionLogRepo.getRecent(limit ?? 50)
        return { success: true, data: entries }
      } catch (err) {
        log.error('Failed to list action log', err)
        return errorToResponse(err)
      }
    }
  )

  // --- Memory ---

  ipc.handle(
    EXT_JOBS_IPC.MEMORY_SEARCH,
    extJobsSchemas['ext-jobs:memory-search'],
    (_event, { query, category, limit }) => {
      try {
        const results = memoryRepo.search(query, {
          category: category as MemoryCategory | undefined,
          limit
        })
        return { success: true, data: results }
      } catch (err) {
        log.error('Memory search failed', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.MEMORY_ADD,
    extJobsSchemas['ext-jobs:memory-add'],
    (_event, { category, content, source, confidence, metadata }) => {
      try {
        const fact = memoryRepo.addFact(
          category as MemoryCategory,
          content,
          source,
          confidence,
          metadata as Record<string, unknown> | undefined
        )
        return { success: true, data: fact }
      } catch (err) {
        log.error('Memory add failed', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.MEMORY_DELETE,
    extJobsSchemas['ext-jobs:memory-delete'],
    (_event, { id }) => {
      try {
        memoryRepo.deleteFact(id)
        return { success: true }
      } catch (err) {
        log.error('Memory delete failed', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_JOBS_IPC.MEMORY_LIST,
    extJobsSchemas['ext-jobs:memory-list'],
    (_event, { category, limit }) => {
      try {
        if (category) {
          const facts = memoryRepo.getByCategory(category as MemoryCategory, limit)
          return { success: true, data: facts }
        }
        const facts = memoryRepo.listAll(limit)
        return { success: true, data: facts }
      } catch (err) {
        log.error('Memory list failed', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-jobs IPC handlers registered')
}

export async function cleanupExtJobs(): Promise<void> {
  if (coordinator) {
    coordinator.stop()
    coordinator = null
  }
  // Session manager is owned by the shell — ext-jobs does not close it
}
