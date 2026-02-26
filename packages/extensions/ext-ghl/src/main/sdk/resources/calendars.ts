import type { GHLClient } from '../client'
import type {
  CalendarEventListResponse,
  CalendarListResponse,
  CalendarResponse,
  CreateCalendarInput,
  FreeSlotsResponse,
  UpdateCalendarInput
} from '../types'

export class Calendars {
  constructor(private client: GHLClient) {}

  list(locationId: string): Promise<CalendarListResponse> {
    return this.client.get<CalendarListResponse>('/calendars/', { locationId })
  }

  get(calendarId: string): Promise<CalendarResponse> {
    return this.client.get<CalendarResponse>(`/calendars/${calendarId}`)
  }

  create(data: CreateCalendarInput): Promise<CalendarResponse> {
    return this.client.post<CalendarResponse>('/calendars/', data)
  }

  update(calendarId: string, data: UpdateCalendarInput): Promise<CalendarResponse> {
    return this.client.put<CalendarResponse>(`/calendars/${calendarId}`, data)
  }

  delete(calendarId: string): Promise<void> {
    return this.client.delete<void>(`/calendars/${calendarId}`)
  }

  getFreeSlots(
    calendarId: string,
    startDate: string,
    endDate: string,
    timezone?: string
  ): Promise<FreeSlotsResponse> {
    const query: Record<string, string> = { startDate, endDate }
    if (timezone) query.timezone = timezone
    return this.client.get<FreeSlotsResponse>(`/calendars/${calendarId}/free-slots`, query)
  }

  getEvents(
    locationId: string,
    params?: { calendarId?: string; startTime?: string; endTime?: string }
  ): Promise<CalendarEventListResponse> {
    const query: Record<string, string> = { locationId }
    if (params?.calendarId) query.calendarId = params.calendarId
    if (params?.startTime) query.startTime = params.startTime
    if (params?.endTime) query.endTime = params.endTime
    return this.client.get<CalendarEventListResponse>('/calendars/events', query)
  }
}
