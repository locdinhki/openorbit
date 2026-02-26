import { useState, useEffect } from 'react'
import { ipc } from '../../lib/ipc-client'
import type { Calendar } from '../../../main/sdk/types'
import CalendarEvents from './CalendarEvents'

export default function CalendarList(): React.JSX.Element {
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null)

  useEffect(() => {
    async function loadCalendars(): Promise<void> {
      setLoading(true)
      const res = await ipc.calendars.list()
      if (res.success && res.data) {
        setCalendars(res.data)
      }
      setLoading(false)
    }
    loadCalendars()
  }, [])

  if (selectedCalendarId) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-[var(--cos-border)] flex items-center gap-2">
          <button
            onClick={() => setSelectedCalendarId(null)}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer text-xs"
          >
            &larr;
          </button>
          <span className="text-xs font-medium text-[var(--cos-text-primary)]">
            {calendars.find((c) => c.id === selectedCalendarId)?.name ?? 'Events'}
          </span>
        </div>
        <CalendarEvents calendarId={selectedCalendarId} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
        Loading calendars...
      </div>
    )
  }

  if (calendars.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
        No calendars found
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {calendars.map((cal) => (
        <button
          key={cal.id}
          onClick={() => setSelectedCalendarId(cal.id)}
          className="w-full px-3 py-2 text-left hover:bg-[var(--cos-bg-hover)] cursor-pointer transition-colors border-b border-[var(--cos-border)]"
        >
          <div className="text-xs font-medium text-[var(--cos-text-primary)]">{cal.name}</div>
          {cal.description && (
            <div className="text-[10px] text-[var(--cos-text-muted)] truncate">
              {cal.description}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
