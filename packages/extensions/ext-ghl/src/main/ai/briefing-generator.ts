// ============================================================================
// ext-ghl — Daily Briefing Generator
// ============================================================================

import type { AIService } from '@openorbit/core/ai/provider-types'
import type { GoHighLevel } from '../sdk/index'
import type { GhlOpportunitiesRepo } from '../db/opportunities-repo'

export class BriefingGenerator {
  constructor(
    private ai: AIService,
    private ghl: () => GoHighLevel,
    private oppsRepo: GhlOpportunitiesRepo,
    private locationId: () => string
  ) {}

  async generate(): Promise<string> {
    const locId = this.locationId()
    const ghl = this.ghl()

    // Fetch data in parallel
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

    const [eventsRes, convsRes, opps] = await Promise.all([
      ghl.calendars.getEvents(locId, { startTime: todayStart, endTime: todayEnd }),
      ghl.conversations.list(locId, { limit: 20 }),
      this.oppsRepo.list({ status: 'open' })
    ])

    const events = eventsRes.events
    const conversations = convsRes.conversations

    const dataContext = [
      `Today's Calendar Events (${events.length}):`,
      ...events.map(
        (e) =>
          `  - ${e.title ?? 'Untitled'} at ${new Date(e.startTime).toLocaleTimeString()} (${e.status})`
      ),
      '',
      `Recent Conversations (${conversations.length}):`,
      ...conversations.slice(0, 10).map((c) => {
        const unread = c.unreadCount ? ` [${c.unreadCount} unread]` : ''
        return `  - ${c.contactId}: "${c.lastMessageBody?.slice(0, 50) ?? 'no message'}"${unread}`
      }),
      '',
      `Open Opportunities (${opps.length}):`,
      ...opps
        .slice(0, 20)
        .map((o) => `  - ${o.name}: $${o.monetary_value?.toLocaleString() ?? 0} [${o.status}]`)
    ].join('\n')

    const response = await this.ai.complete({
      systemPrompt:
        'Create a concise daily briefing from the CRM data below. Use bullet points. Focus on what needs attention today.',
      userMessage: dataContext,
      tier: 'standard',
      task: 'ghl-briefing'
    })

    return response.content
  }
}
