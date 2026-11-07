import type { DayIndex, MonthKey, WeekKey } from './types'

export const DAY_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date. toISOString() would give yesterday before 05:30 in IST. */
export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayKey = () => toDateKey(new Date())

export function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export const fromDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d || 1)
}

export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

export const weekKeyOf = (d: Date = new Date()): WeekKey => toDateKey(mondayOf(d))

export const shiftWeek = (key: WeekKey, delta: number): WeekKey =>
  toDateKey(addDays(fromDateKey(key), delta * 7))

export const dayIndexOf = (d: Date = new Date()) => (((d.getDay() + 6) % 7) + 1) as DayIndex

export const dateOfDay = (key: WeekKey, day: DayIndex) => addDays(fromDateKey(key), day - 1)

/** ISO-8601 week number. Rounded because a DST change makes a week 1 hour short. */
export function isoWeekNumber(key: WeekKey) {
  const monday = fromDateKey(key)
  const thursday = addDays(monday, 3)
  const firstMonday = mondayOf(new Date(thursday.getFullYear(), 0, 4))
  return Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const dayOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric' })
const longDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatDate = (d: Date) => longDate.format(d)
export const formatDayMonth = (d: Date) => dayMonth.format(d)
export const formatDayNumber = (d: Date) => dayOnly.format(d)

export function weekRangeLabel(key: WeekKey, { year = true }: { year?: boolean } = {}) {
  const start = fromDateKey(key)
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const endLabel = year ? longDate.format(end) : dayMonth.format(end)
  return `${sameMonth ? dayOnly.format(start) : dayMonth.format(start)} – ${endLabel}`
}

export const monthKeyOf = (d: Date = new Date()): MonthKey =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

/** The month a week belongs to, taken from its Thursday so a split week lands in its larger half. */
export const monthKeyOfWeek = (key: WeekKey): MonthKey =>
  monthKeyOf(addDays(fromDateKey(key), 3))

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number)
  return monthKeyOf(new Date(y, m - 1 + delta, 1))
}

export function monthLabel(key: MonthKey) {
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  )
}

export function datesInMonth(key: MonthKey) {
  const [y, m] = key.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return Array.from({ length: days }, (_, i) => new Date(y, m - 1, i + 1))
}

export const datesInWeek = (key: WeekKey) =>
  Array.from({ length: 7 }, (_, i) => addDays(fromDateKey(key), i))

/**
 * v14 stored weeks as a bare number counted from the Monday on or before 1 January.
 * The year is recovered from when the backup was taken: a week that would land in
 * the future at that moment must belong to the year before.
 */
export function legacyWeekToKey(week: number, reference: Date): WeekKey {
  const inYear = (year: number) =>
    addDays(mondayOf(new Date(year, 0, 1)), (week - 1) * 7)
  const candidate = inYear(reference.getFullYear())
  return toDateKey(
    candidate > mondayOf(reference) ? inYear(reference.getFullYear() - 1) : candidate,
  )
}
