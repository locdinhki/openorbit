// ============================================================================
// ext-ghl — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { EXT_GHL_IPC } from '../ipc-channels'
import { extGhlSchemas } from '../ipc-schemas'
import { GoHighLevel } from './sdk/index'
import { GhlContactsRepo } from './db/contacts-repo'
import { GhlOpportunitiesRepo } from './db/opportunities-repo'
import { GhlPipelinesRepo } from './db/pipelines-repo'
import { GhlChatHandler } from './ai/ghl-chat-handler'
import { ArvEnrichmentRunner, ArvRunsRepo } from './automation/arv-enrichment'

let ghlClient: GoHighLevel | null = null

function getSettings(): SettingsRepo {
  return new SettingsRepo()
}

function getGhlClient(): GoHighLevel {
  if (!ghlClient) {
    const settings = getSettings()
    const token = settings.get('ghl.api-token') as string | null
    if (!token) throw new Error('GHL API token not configured')
    ghlClient = new GoHighLevel({ apiToken: token })
  }
  return ghlClient
}

function getLocationId(): string {
  const settings = getSettings()
  const locationId = settings.get('ghl.location-id') as string | null
  if (!locationId) throw new Error('GHL location ID not configured')
  return locationId
}

function resetGhlClient(): void {
  ghlClient = null
}

export function registerExtGhlHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx
  const contactsRepo = new GhlContactsRepo(db)
  const oppsRepo = new GhlOpportunitiesRepo(db)
  const pipelinesRepo = new GhlPipelinesRepo(db)

  // AI Chat handler (lazy — depends on AI service being available)
  let chatHandler: GhlChatHandler | null = null
  function getChatHandler(): GhlChatHandler {
    if (!chatHandler) {
      chatHandler = new GhlChatHandler(
        ctx.services.ai,
        contactsRepo,
        oppsRepo,
        pipelinesRepo,
        () => getGhlClient(),
        () => getLocationId()
      )
    }
    return chatHandler
  }

  // ===== Settings =====

  ipc.handle(EXT_GHL_IPC.SETTINGS_GET, extGhlSchemas['ext-ghl:settings-get'], () => {
    try {
      const settings = getSettings()
      const token = settings.get('ghl.api-token') as string | null
      const locationId = settings.get('ghl.location-id') as string | null
      return {
        success: true,
        data: {
          token: token ? `${token.slice(0, 8)}...${token.slice(-4)}` : null,
          hasToken: !!token,
          locationId
        }
      }
    } catch (err) {
      log.error('Failed to get settings', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_GHL_IPC.SETTINGS_SET,
    extGhlSchemas['ext-ghl:settings-set'],
    (_event, { token, locationId }) => {
      try {
        const settings = getSettings()
        if (token !== undefined) settings.set('ghl.api-token', token)
        if (locationId !== undefined) settings.set('ghl.location-id', locationId)
        resetGhlClient()
        return { success: true, data: { saved: true } }
      } catch (err) {
        log.error('Failed to save settings', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.CONNECTION_TEST, extGhlSchemas['ext-ghl:connection-test'], async () => {
    try {
      const ghl = getGhlClient()
      const locationId = getLocationId()
      // Test by fetching contacts with limit 1
      const result = await ghl.contacts.list(locationId, { limit: 1 })
      return {
        success: true,
        data: {
          connected: true,
          contactCount: result.meta?.total ?? result.contacts.length
        }
      }
    } catch (err) {
      log.error('Connection test failed', err)
      return errorToResponse(err)
    }
  })

  // ===== Contacts =====

  ipc.handle(
    EXT_GHL_IPC.CONTACTS_LIST,
    extGhlSchemas['ext-ghl:contacts-list'],
    (_event, { query, limit, offset }) => {
      try {
        const contacts = contactsRepo.list({ query, limit, offset })
        return { success: true, data: contacts }
      } catch (err) {
        log.error('Failed to list contacts', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.CONTACTS_GET, extGhlSchemas['ext-ghl:contacts-get'], (_event, { id }) => {
    try {
      const contact = contactsRepo.getById(id)
      if (!contact) return { success: false, error: 'Contact not found', code: 'NOT_FOUND' }
      return { success: true, data: contact }
    } catch (err) {
      log.error('Failed to get contact', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_GHL_IPC.CONTACTS_CREATE,
    extGhlSchemas['ext-ghl:contacts-create'],
    async (_event, { contact }) => {
      try {
        const ghl = getGhlClient()
        const locationId = getLocationId()
        const { contact: created } = await ghl.contacts.create({ ...contact, locationId })
        contactsRepo.upsert(created)
        return { success: true, data: created }
      } catch (err) {
        log.error('Failed to create contact', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_GHL_IPC.CONTACTS_UPDATE,
    extGhlSchemas['ext-ghl:contacts-update'],
    async (_event, { id, data }) => {
      try {
        const ghl = getGhlClient()
        const { contact: updated } = await ghl.contacts.update(id, data)
        contactsRepo.upsert(updated)
        return { success: true, data: updated }
      } catch (err) {
        log.error('Failed to update contact', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_GHL_IPC.CONTACTS_DELETE,
    extGhlSchemas['ext-ghl:contacts-delete'],
    async (_event, { id }) => {
      try {
        const ghl = getGhlClient()
        await ghl.contacts.delete(id)
        contactsRepo.delete(id)
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete contact', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.CONTACTS_SYNC, extGhlSchemas['ext-ghl:contacts-sync'], async () => {
    try {
      const ghl = getGhlClient()
      const locationId = getLocationId()
      let synced = 0
      let skip = 0

      while (true) {
        const { contacts, meta } = await ghl.contacts.list(locationId, { limit: 100, skip })
        for (const contact of contacts) {
          contactsRepo.upsert(contact)
          synced++
        }
        ipc.push(EXT_GHL_IPC.SYNC_PROGRESS, { type: 'contacts', synced, total: meta?.total })
        if (contacts.length < 100) break
        skip += 100
      }

      return { success: true, data: { synced } }
    } catch (err) {
      log.error('Failed to sync contacts', err)
      return errorToResponse(err)
    }
  })

  // ===== Pipelines =====

  ipc.handle(EXT_GHL_IPC.PIPELINES_LIST, extGhlSchemas['ext-ghl:pipelines-list'], () => {
    try {
      return { success: true, data: pipelinesRepo.list() }
    } catch (err) {
      log.error('Failed to list pipelines', err)
      return errorToResponse(err)
    }
  })

  // ===== Opportunities =====

  ipc.handle(
    EXT_GHL_IPC.OPPS_LIST,
    extGhlSchemas['ext-ghl:opps-list'],
    (_event, { pipelineId, status }) => {
      try {
        return { success: true, data: oppsRepo.list({ pipelineId, status }) }
      } catch (err) {
        log.error('Failed to list opportunities', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.OPPS_GET, extGhlSchemas['ext-ghl:opps-get'], (_event, { id }) => {
    try {
      const opp = oppsRepo.getById(id)
      if (!opp) return { success: false, error: 'Opportunity not found', code: 'NOT_FOUND' }
      return { success: true, data: opp }
    } catch (err) {
      log.error('Failed to get opportunity', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_GHL_IPC.OPPS_CREATE,
    extGhlSchemas['ext-ghl:opps-create'],
    async (_event, { opportunity }) => {
      try {
        const ghl = getGhlClient()
        const locationId = getLocationId()
        const { opportunity: created } = await ghl.opportunities.create({
          ...opportunity,
          locationId
        })
        oppsRepo.upsert(created)
        return { success: true, data: created }
      } catch (err) {
        log.error('Failed to create opportunity', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_GHL_IPC.OPPS_UPDATE,
    extGhlSchemas['ext-ghl:opps-update'],
    async (_event, { id, data }) => {
      try {
        const ghl = getGhlClient()
        const { opportunity: updated } = await ghl.opportunities.update(id, data)
        oppsRepo.upsert(updated)
        return { success: true, data: updated }
      } catch (err) {
        log.error('Failed to update opportunity', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_GHL_IPC.OPPS_UPDATE_STATUS,
    extGhlSchemas['ext-ghl:opps-update-status'],
    async (_event, { id, status }) => {
      try {
        const ghl = getGhlClient()
        const { opportunity: updated } = await ghl.opportunities.updateStatus(id, status)
        oppsRepo.upsert(updated)
        return { success: true, data: updated }
      } catch (err) {
        log.error('Failed to update opportunity status', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_GHL_IPC.OPPS_DELETE,
    extGhlSchemas['ext-ghl:opps-delete'],
    async (_event, { id }) => {
      try {
        const ghl = getGhlClient()
        await ghl.opportunities.delete(id)
        oppsRepo.delete(id)
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete opportunity', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.OPPS_SYNC, extGhlSchemas['ext-ghl:opps-sync'], async () => {
    try {
      const ghl = getGhlClient()
      const locationId = getLocationId()

      // Sync pipelines first
      const { pipelines } = await ghl.opportunities.getPipelines(locationId)
      for (const pipeline of pipelines) {
        pipelinesRepo.upsert(pipeline)
      }

      // Then sync opportunities
      let synced = 0
      let skip = 0

      while (true) {
        const { opportunities, meta } = await ghl.opportunities.list(locationId, {
          limit: 100,
          skip
        })
        for (const opp of opportunities) {
          oppsRepo.upsert(opp)
          synced++
        }
        ipc.push(EXT_GHL_IPC.SYNC_PROGRESS, { type: 'opportunities', synced, total: meta?.total })
        if (opportunities.length < 100) break
        skip += 100
      }

      return { success: true, data: { synced, pipelines: pipelines.length } }
    } catch (err) {
      log.error('Failed to sync opportunities', err)
      return errorToResponse(err)
    }
  })

  // ===== Conversations (live API) =====

  ipc.handle(
    EXT_GHL_IPC.CONVS_LIST,
    extGhlSchemas['ext-ghl:convs-list'],
    async (_event, { limit, contactId }) => {
      try {
        const ghl = getGhlClient()
        const locationId = getLocationId()
        const result = await ghl.conversations.list(locationId, { limit, contactId })
        return { success: true, data: result.conversations }
      } catch (err) {
        log.error('Failed to list conversations', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.CONVS_GET, extGhlSchemas['ext-ghl:convs-get'], async (_event, { id }) => {
    try {
      const ghl = getGhlClient()
      const result = await ghl.conversations.get(id)
      return { success: true, data: result.conversation }
    } catch (err) {
      log.error('Failed to get conversation', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_GHL_IPC.CONVS_MESSAGES,
    extGhlSchemas['ext-ghl:convs-messages'],
    async (_event, { conversationId, limit }) => {
      try {
        const ghl = getGhlClient()
        const result = await ghl.conversations.getMessages(conversationId, { limit })
        return { success: true, data: result.messages }
      } catch (err) {
        log.error('Failed to get messages', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_GHL_IPC.CONVS_SEND,
    extGhlSchemas['ext-ghl:convs-send'],
    async (_event, { contactId, type, message, subject }) => {
      try {
        const ghl = getGhlClient()
        const result = await ghl.conversations.sendMessage({
          type,
          contactId,
          message,
          subject
        })
        return { success: true, data: result }
      } catch (err) {
        log.error('Failed to send message', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Calendars (live API) =====

  ipc.handle(EXT_GHL_IPC.CALS_LIST, extGhlSchemas['ext-ghl:cals-list'], async () => {
    try {
      const ghl = getGhlClient()
      const locationId = getLocationId()
      const result = await ghl.calendars.list(locationId)
      return { success: true, data: result.calendars }
    } catch (err) {
      log.error('Failed to list calendars', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_GHL_IPC.CAL_EVENTS_LIST,
    extGhlSchemas['ext-ghl:cal-events-list'],
    async (_event, { calendarId, startTime, endTime }) => {
      try {
        const ghl = getGhlClient()
        const locationId = getLocationId()
        const result = await ghl.calendars.getEvents(locationId, { calendarId, startTime, endTime })
        return { success: true, data: result.events }
      } catch (err) {
        log.error('Failed to list calendar events', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== AI Chat =====

  ipc.handle(
    EXT_GHL_IPC.CHAT_SEND,
    extGhlSchemas['ext-ghl:chat-send'],
    async (_event, { message }) => {
      try {
        const handler = getChatHandler()
        const response = await handler.sendMessage(message)
        return { success: true, data: response }
      } catch (err) {
        log.error('Chat send failed', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.CHAT_CLEAR, extGhlSchemas['ext-ghl:chat-clear'], () => {
    try {
      getChatHandler().clearHistory()
      return { success: true, data: { cleared: true } }
    } catch (err) {
      log.error('Chat clear failed', err)
      return errorToResponse(err)
    }
  })

  // ===== ARV Enrichment =====

  const arvRunner = new ArvEnrichmentRunner(
    () => getGhlClient(),
    () => getLocationId(),
    () => ctx.services.browser.getSession(),
    db,
    (progress) => {
      ipc.push(EXT_GHL_IPC.ARV_ENRICH_PROGRESS, progress)
    }
  )

  ipc.handle(
    EXT_GHL_IPC.ARV_ENRICH_START,
    extGhlSchemas['ext-ghl:arv-enrich-start'],
    async (_event, { pipelineName, arvFieldName, force }) => {
      try {
        if (arvRunner.isRunning()) {
          return {
            success: false,
            error: 'ARV enrichment is already running',
            code: 'ALREADY_RUNNING'
          }
        }
        await ctx.services.browser.ensureReady()
        // Run in background — don't await
        const resultPromise = arvRunner.run({
          pipelineName: pipelineName ?? 'Ready for SMS',
          arvFieldName: arvFieldName ?? 'ARV',
          force: force ?? false
        })
        resultPromise.catch((err) => {
          log.error('ARV enrichment background error', err)
        })
        return { success: true, data: { started: true, runId: arvRunner.getCurrentRunId() } }
      } catch (err) {
        log.error('Failed to start ARV enrichment', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_GHL_IPC.ARV_ENRICH_STATUS, extGhlSchemas['ext-ghl:arv-enrich-status'], () => {
    try {
      const runsRepo = new ArvRunsRepo(db)
      const running = runsRepo.getRunning()
      const recentRuns = runsRepo.listRecent(5)
      return {
        success: true,
        data: {
          isRunning: arvRunner.isRunning(),
          currentRunId: arvRunner.getCurrentRunId(),
          currentRun: running,
          recentRuns
        }
      }
    } catch (err) {
      log.error('Failed to get ARV enrichment status', err)
      return errorToResponse(err)
    }
  })

  // ===== Custom Fields =====

  ipc.handle(
    EXT_GHL_IPC.CUSTOM_FIELDS_LIST,
    extGhlSchemas['ext-ghl:custom-fields-list'],
    async () => {
      try {
        const ghl = getGhlClient()
        const locationId = getLocationId()
        const result = await ghl.customFields.list(locationId)
        return { success: true, data: result.customFields }
      } catch (err) {
        log.error('Failed to list custom fields', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-ghl IPC handlers registered (28 channels)')
}
