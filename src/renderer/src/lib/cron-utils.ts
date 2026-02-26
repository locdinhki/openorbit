// ============================================================================
// OpenOrbit — Cron Expression Utilities
// ============================================================================

export interface CronPreset {
  label: string
  value: string
}

export const CRON_PRESETS: CronPreset[] = [
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 4 hours', value: '0 */4 * * *' },
  { label: 'Daily at 8:00 AM', value: '0 8 * * *' },
  { label: 'Daily at 9:00 AM', value: '0 9 * * *' },
  { label: 'Weekdays at 8:00 AM', value: '0 8 * * 1-5' },
  { label: 'Weekdays at 9:00 AM', value: '0 9 * * 1-5' },
  { label: 'Weekly on Monday', value: '0 9 * * 1' }
]

const DAYS_MAP: Record<string, string> = {
  '0': 'Sun',
  '1': 'Mon',
  '2': 'Tue',
  '3': 'Wed',
  '4': 'Thu',
  '5': 'Fri',
  '6': 'Sat',
  '7': 'Sun'
}

function formatTime(h: number, m: number): string {
  const mm = m.toString().padStart(2, '0')
  const period = h < 12 ? 'AM' : 'PM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:${mm} ${period}`
}

function formatDayRange(dow: string): string {
  if (dow === '*') return ''
  if (dow === '1-5') return 'Weekdays'
  if (dow === '0,6' || dow === '6,0') return 'Weekends'

  return dow
    .split(',')
    .map((d) => {
      if (d.includes('-')) {
        const [start, end] = d.split('-')
        return `${DAYS_MAP[start] ?? start}-${DAYS_MAP[end] ?? end}`
      }
      return DAYS_MAP[d] ?? d
    })
    .join(', ')
}

const MONTHS_MAP: Record<string, string> = {
  '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr',
  '5': 'May', '6': 'Jun', '7': 'Jul', '8': 'Aug',
  '9': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function formatDayOfMonth(dom: string): string {
  return dom
    .split(',')
    .map((d) => {
      if (d.includes('-')) {
        const [start, end] = d.split('-')
        return `${ordinal(parseInt(start))}–${ordinal(parseInt(end))}`
      }
      return ordinal(parseInt(d))
    })
    .join(', ')
}

function formatMonth(m: string): string {
  if (m.startsWith('*/')) return `every ${m.slice(2)} months`
  return m
    .split(',')
    .map((v) => {
      if (v.includes('-')) {
        const [start, end] = v.split('-')
        return `${MONTHS_MAP[start] ?? start}–${MONTHS_MAP[end] ?? end}`
      }
      return MONTHS_MAP[v] ?? v
    })
    .join(', ')
}

/** Convert a cron expression to a human-readable string */
export function cronToHuman(expr: string): string {
  // Check presets first
  const preset = CRON_PRESETS.find((p) => p.value === expr)
  if (preset) return preset.label

  const parts = expr.split(' ')
  if (parts.length !== 5) return expr

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Every N minutes
  if (minute.startsWith('*/') && hour === '*') {
    return `Every ${minute.slice(2)} minutes`
  }

  // Every N hours
  if (minute === '0' && hour.startsWith('*/')) {
    return `Every ${hour.slice(2)} hours`
  }

  // Specific time
  if (!minute.includes('*') && !hour.includes('*') && !hour.includes('/')) {
    const h = parseInt(hour, 10)
    const m = parseInt(minute, 10)
    const time = formatTime(h, m)

    const parts: string[] = []

    // Day-of-month
    if (dayOfMonth !== '*') {
      parts.push(formatDayOfMonth(dayOfMonth))
    }

    // Month
    if (month !== '*') {
      parts.push(formatMonth(month))
    }

    // Day-of-week
    const dow = formatDayRange(dayOfWeek)
    if (dow) parts.push(dow)

    parts.push(`at ${time}`)

    // If no date qualifiers, it's daily
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      return `Daily at ${time}`
    }

    return parts.join(' ')
  }

  return expr
}

/** Format a relative time string from an ISO date */
export function timeAgo(isoDate: string | null): string {
  if (!isoDate) return 'Never'

  const date = new Date(isoDate)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

/** Basic cron expression validation (5-field format) */
export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  // Basic check: each field should match common cron patterns
  const fieldPattern = /^(\*|[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)(\/[0-9]+)?$/
  return parts.every((p) => fieldPattern.test(p))
}
