import { useState, useEffect } from 'react'
import { ipc } from '../../lib/ipc-client'
import type { CalendarEvent } from '../../../main/sdk/types'
import Badge from '@renderer/components/shared/Badge'
import Button from '@renderer/components/shared/Button'

interface Props {
  calendarId: string
}

type DateFilter = 'today' | 'week' | 'all'

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  confirmed: 'success',
  cancelled: 'error',
  'no-show': 'warning'
}

export default function CalendarEvents({ calendarId }: Props): React.JSX.Element {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')

  useEffect(() => {
    async function loadEvents(): Promise<void> {
      setLoading(true)
      const now = new Date()
      let startTime: string | undefined
      let endTime: string | undefined

      if (dateFilter === 'today') {
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
      } else if (dateFilter === 'week') {
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()
      }

      const res = await ipc.calendars.events({ calendarId, startTime, endTime })
      if (res.success && res.data) {
        setEvents(res.data)
      }
      setLoading(false)
    }
    loadEvents()
  }, [calendarId, dateFilter])

  const filters: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'all', label: 'All' }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Date Filter */}
      <div className="px-3 py-2 flex gap-1 border-b border-[var(--cos-border)]">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={dateFilter === f.key ? 'primary' : 'ghost'}
            onClick={() => setDateFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Events */}
      {loading ? (
        <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
          No events
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {events.map((event) => {
            const start = new Date(event.startTime)
            const end = new Date(event.endTime)
            const duration = Math.round((end.getTime() - start.getTime()) / 60000)
            const status = event.appoinmentStatus ?? event.status

            return (
              <div
                key={event.id}
                className="px-3 py-2 border-b border-[var(--cos-border)] hover:bg-[var(--cos-bg-hover)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--cos-text-primary)]">
                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <Badge variant={statusVariant[status] ?? 'default'}>{status}</Badge>
                </div>
                {event.title && (
                  <div className="text-xs text-[var(--cos-text-secondary)] mt-0.5">
                    {event.title}
                  </div>
                )}
                <div className="text-[10px] text-[var(--cos-text-muted)] mt-0.5">
                  {duration} min · {start.toLocaleDateString()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
