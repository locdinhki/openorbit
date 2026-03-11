// ============================================================================
// Simple cron expression parser (minute hour dom month dow)
// Supports: numbers, *, */N, comma-separated values
// ============================================================================

interface CronFields {
  minutes: number[]
  hours: number[]
  daysOfMonth: number[]
  months: number[]
  daysOfWeek: number[]
}

function parseField(field: string, min: number, max: number): number[] {
  const values: number[] = []
  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.push(i)
    } else if (part.startsWith('*/')) {
      const step = parseInt(part.slice(2))
      for (let i = min; i <= max; i += step) values.push(i)
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      for (let i = a; i <= b; i++) values.push(i)
    } else {
      values.push(parseInt(part))
    }
  }
  return values
}

function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5)
    throw new Error(`Invalid cron expression: "${expression}" (need 5 fields)`)
  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    daysOfMonth: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    daysOfWeek: parseField(parts[4], 0, 6)
  }
}

function matches(date: Date, fields: CronFields): boolean {
  return (
    fields.minutes.includes(date.getMinutes()) &&
    fields.hours.includes(date.getHours()) &&
    fields.daysOfMonth.includes(date.getDate()) &&
    fields.months.includes(date.getMonth() + 1) &&
    fields.daysOfWeek.includes(date.getDay())
  )
}

/**
 * Find the next time a cron expression matches, starting from `after`.
 * Scans minute-by-minute up to 366 days ahead.
 */
export function getNextRun(expression: string, after: Date = new Date()): Date {
  const fields = parseCron(expression)
  const candidate = new Date(after)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1) // start from next minute

  const limit = 366 * 24 * 60 // max minutes to scan
  for (let i = 0; i < limit; i++) {
    if (matches(candidate, fields)) return candidate
    candidate.setMinutes(candidate.getMinutes() + 1)
  }

  throw new Error(`No match found for cron "${expression}" within 366 days`)
}

/**
 * Validate a cron expression. Returns null if valid, error string if not.
 */
export function validateCron(expression: string): string | null {
  try {
    parseCron(expression)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid cron expression'
  }
}
