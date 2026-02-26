// ============================================================================
// GHL API Types — ported verbatim from go-high-level-connector test project
// ============================================================================

// ── Contacts ──

export interface Contact {
  id: string
  locationId: string
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  companyName?: string
  address1?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  website?: string
  timezone?: string
  tags?: string[]
  source?: string
  customFields?: CustomFieldValue[]
  dateAdded?: string
  dateUpdated?: string
  dateOfBirth?: string
  dnd?: boolean
  assignedTo?: string
}

export interface CustomFieldValue {
  id: string
  value: unknown
}

export interface CreateContactInput {
  locationId: string
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  companyName?: string
  address1?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  website?: string
  timezone?: string
  tags?: string[]
  source?: string
  customFields?: CustomFieldValue[]
  dnd?: boolean
  assignedTo?: string
}

export interface UpdateContactInput extends Partial<Omit<CreateContactInput, 'locationId'>> {}

export interface ContactListResponse {
  contacts: Contact[]
  meta?: PaginationMeta
}

export interface ContactResponse {
  contact: Contact
}

// ── Opportunities ──

export interface Opportunity {
  id: string
  name: string
  monetaryValue?: number
  pipelineId: string
  pipelineStageId: string
  assignedTo?: string
  status: string
  source?: string
  contactId: string
  locationId: string
  dateAdded?: string
  dateUpdated?: string
  customFields?: CustomFieldValue[]
}

export interface CreateOpportunityInput {
  pipelineId: string
  locationId: string
  name: string
  pipelineStageId: string
  status: 'open' | 'won' | 'lost' | 'abandoned'
  contactId: string
  monetaryValue?: number
  assignedTo?: string
  source?: string
  customFields?: CustomFieldValue[]
}

export interface UpdateOpportunityInput extends Partial<
  Omit<CreateOpportunityInput, 'locationId'>
> {}

export interface OpportunityListResponse {
  opportunities: Opportunity[]
  meta?: PaginationMeta
}

export interface OpportunityResponse {
  opportunity: Opportunity
}

export interface Pipeline {
  id: string
  name: string
  locationId: string
  stages: PipelineStage[]
}

export interface PipelineStage {
  id: string
  name: string
  position: number
}

// ── Calendars ──

export interface Calendar {
  id: string
  locationId: string
  name: string
  description?: string
  slug?: string
  widgetSlug?: string
  calendarType?: string
  widgetType?: string
  eventTitle?: string
  eventColor?: string
  meetingLocation?: string
  slotDuration?: number
  slotInterval?: number
  slotBuffer?: number
  isActive?: boolean
  teamMembers?: TeamMember[]
}

export interface TeamMember {
  userId: string
  priority?: number
  meetingLocation?: string
}

export interface CalendarEvent {
  id: string
  calendarId: string
  locationId: string
  contactId: string
  title?: string
  status: string
  appoinmentStatus?: string
  assignedUserId?: string
  notes?: string
  startTime: string
  endTime: string
  dateAdded?: string
  dateUpdated?: string
}

export interface FreeSlot {
  slots: string[]
}

export interface CreateCalendarInput {
  locationId: string
  name: string
  description?: string
  slug?: string
  widgetSlug?: string
  calendarType?: string
  widgetType?: string
  eventTitle?: string
  eventColor?: string
  meetingLocation?: string
  slotDuration?: number
  slotInterval?: number
  slotBuffer?: number
  teamMembers?: TeamMember[]
}

export interface UpdateCalendarInput extends Partial<Omit<CreateCalendarInput, 'locationId'>> {}

export interface CalendarListResponse {
  calendars: Calendar[]
}

export interface CalendarResponse {
  calendar: Calendar
}

export interface CalendarEventListResponse {
  events: CalendarEvent[]
}

export interface FreeSlotsResponse {
  [date: string]: FreeSlot
}

// ── Conversations ──

export interface Conversation {
  id: string
  locationId: string
  contactId: string
  assignedTo?: string
  lastMessageBody?: string
  lastMessageDate?: string
  lastMessageType?: string
  type?: string
  unreadCount?: number
  starred?: boolean
  inbox?: boolean
  dateAdded?: string
  dateUpdated?: string
}

export interface Message {
  id: string
  conversationId: string
  locationId: string
  contactId: string
  body?: string
  type: string
  direction: 'inbound' | 'outbound'
  status?: string
  dateAdded?: string
  attachments?: string[]
}

export interface SendMessageInput {
  type: 'SMS' | 'Email' | 'WhatsApp' | 'GMB' | 'IG' | 'FB' | 'Live_Chat' | 'Custom'
  contactId: string
  message?: string
  subject?: string
  html?: string
  attachments?: string[]
  emailFrom?: string
  emailTo?: string
  emailCc?: string[]
  emailBcc?: string[]
}

export interface CreateConversationInput {
  locationId: string
  contactId: string
}

export interface ConversationListResponse {
  conversations: Conversation[]
}

export interface ConversationResponse {
  conversation: Conversation
}

export interface MessageListResponse {
  messages: Message[]
  nextPage?: string
}

export interface MessageResponse {
  message: Message
  conversationId: string
  messageId: string
}

// ── Custom Fields ──

export interface CustomFieldDef {
  id: string
  name: string
  fieldKey?: string
  dataType: string
  position?: number
  placeholder?: string
}

export interface CreateCustomFieldInput {
  name: string
  dataType: string
  placeholder?: string
  position?: number
}

export interface CustomFieldListResponse {
  customFields: CustomFieldDef[]
}

export interface CustomFieldResponse {
  customField: CustomFieldDef
}

// ── Shared ──

export interface PaginationMeta {
  total?: number
  count?: number
  currentPage?: number
  nextPage?: number
  prevPage?: number
  nextPageUrl?: string
  startAfter?: string
  startAfterId?: string
}

export interface SearchParams {
  locationId?: string
  query?: string
  limit?: number
  skip?: number
  [key: string]: string | number | boolean | undefined
}
