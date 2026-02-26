// ============================================================================
// GHL SDK — Facade class (ported from go-high-level-connector)
// ============================================================================

export { GHLClient, GHLError } from './client'
export type { GHLClientConfig } from './client'

export { Contacts } from './resources/contacts'
export { Opportunities } from './resources/opportunities'
export { Calendars } from './resources/calendars'
export { Conversations } from './resources/conversations'
export { CustomFields } from './resources/custom-fields'

export * from './types'

import { GHLClient, type GHLClientConfig } from './client'
import { Contacts } from './resources/contacts'
import { Opportunities } from './resources/opportunities'
import { Calendars } from './resources/calendars'
import { Conversations } from './resources/conversations'
import { CustomFields } from './resources/custom-fields'

export class GoHighLevel {
  public client: GHLClient
  public contacts: Contacts
  public opportunities: Opportunities
  public calendars: Calendars
  public conversations: Conversations
  public customFields: CustomFields

  constructor(config: GHLClientConfig) {
    this.client = new GHLClient(config)
    this.contacts = new Contacts(this.client)
    this.opportunities = new Opportunities(this.client)
    this.calendars = new Calendars(this.client)
    this.conversations = new Conversations(this.client)
    this.customFields = new CustomFields(this.client)
  }
}
