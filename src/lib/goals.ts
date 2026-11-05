import { datesInMonth, datesInWeek, fromDateKey, monthKeyOf, weekKeyOf } from './dates'
import { num, round1, totalsForDates, valueAsOf, valueBefore } from './metrics'
import type { GoalEntry, GoalMetricId, GoalPeriod, GoalSet, Member } from './types'

export interface GoalMetric {
  id: GoalMetricId
  label: string
  unit: string
  /**
   * total: adds up over the period, so achieved ÷ target.
   * journey: a body value moving from a start towards a target, so distance covered ÷ distance planned.
   */
  kind: 'total' | 'journey'
  /** True where passing the target is a warning rather than a win. */
  limit?: boolean
}

export const GOAL_METRICS: GoalMetric[] = [
  { id: 'steps', label: 'Steps', unit: '', kind: 'total' },
  { id: 'burn', label: 'Calories burned', unit: 'kcal', kind: 'total' },
  { id: 'intake', label: 'Calories intake', unit: 'kcal', kind: 'total', limit: true },
  { id: 'weight', label: 'Weight', unit: 'kg', kind: 'journey' },
  { id: 'bf', label: 'Body fat', unit: '%', kind: 'journey' },
]

export interface Progress {
  /** Share of the target reached, may exceed 100. Null until there is enough to compute it. */
  achievedPct: number | null
  /** Share still to go, never below zero. */
  remainingPct: number | null
  overPct: number
}

const EMPTY_PROGRESS: Progress = { achievedPct: null, remainingPct: null, overPct: 0 }

function toProgress(pct: number): Progress {
  const achievedPct = round1(Math.max(0, pct))
  return {
    achievedPct,
    remainingPct: round1(Math.max(0, 100 - achievedPct)),
    overPct: round1(Math.max(0, achievedPct - 100)),
  }
}

export function totalProgress(target: number | null, achieved: number | null): Progress {
  if (!target || target <= 0) return EMPTY_PROGRESS
  return toProgress(((achieved ?? 0) / target) * 100)
}

export function journeyProgress(
  start: number | null,
  target: number | null,
  current: number | null,
): Progress {
  if (target === null || current === null) return EMPTY_PROGRESS
  if (current === target) return toProgress(100)
  // Without a usable start there is no distance to measure, so show closeness to target.
  if (start === null || start === target) {
    return toProgress((Math.min(current, target) / Math.max(current, target)) * 100)
  }
  return toProgress(((start - current) / (start - target)) * 100)
}

export interface ResolvedGoal {
  metric: GoalMetric
  entry: GoalEntry
  target: number | null
  achieved: number | null
  autoAchieved: number | null
  isManual: boolean
  start: number | null
  autoStart: number | null
  progress: Progress
  /** Days in the period, used for the “≈ per day” hint on totals. */
  days: number
}

export function periodDates(period: GoalPeriod, key: string) {
  return period === 'weekly' ? datesInWeek(key) : datesInMonth(key)
}

/** Monday of the last week that begins inside the period; the reference point for body values. */
function periodWeekBounds(period: GoalPeriod, key: string) {
  const dates = periodDates(period, key)
  return {
    first: weekKeyOf(dates[0]),
    last: weekKeyOf(dates[dates.length - 1]),
  }
}

export function resolveGoals(member: Member, period: GoalPeriod, key: string): ResolvedGoal[] {
  const set: GoalSet =
    (period === 'weekly' ? member.goals.weekly[key] : member.goals.monthly[key]) ?? {}
  const dates = periodDates(period, key)
  const totals = totalsForDates(member, dates)
  const { first, last } = periodWeekBounds(period, key)

  return GOAL_METRICS.map((metric) => {
    const entry = set[metric.id] ?? {}
    const target = num(entry.target)
    const manual = num(entry.achieved)

    if (metric.kind === 'total') {
      const autoAchieved = totals[metric.id as 'steps' | 'burn' | 'intake']
      const achieved = manual ?? autoAchieved
      return {
        metric,
        entry,
        target,
        achieved,
        autoAchieved,
        isManual: manual !== null,
        start: null,
        autoStart: null,
        progress: totalProgress(target, achieved),
        days: dates.length,
      }
    }

    const field = metric.id as 'weight' | 'bf'
    const autoAchieved = valueAsOf(member, field, last)
    const autoStart = valueBefore(member, field, first)
    const achieved = manual ?? autoAchieved
    const start = num(entry.start) ?? autoStart
    return {
      metric,
      entry,
      target,
      achieved,
      autoAchieved,
      isManual: manual !== null,
      start,
      autoStart,
      progress: journeyProgress(start, target, achieved),
      days: dates.length,
    }
  })
}

/** Mean completion across the goals that have a target. Over-achievement does not offset a miss. */
export function overallScore(goals: ResolvedGoal[]) {
  const active = goals.filter((g) => g.progress.achievedPct !== null)
  if (!active.length) return null
  const sum = active.reduce((acc, g) => acc + Math.min(100, g.progress.achievedPct ?? 0), 0)
  return { score: Math.round(sum / active.length), active: active.length, total: goals.length }
}

/** Key of the goal period that holds today, for the “this week / this month” shortcut. */
export const currentPeriodKey = (period: GoalPeriod) =>
  period === 'weekly' ? weekKeyOf(new Date()) : monthKeyOf(new Date())

/** Most recent earlier period with at least one target, for “copy last targets”. */
export function previousTargets(member: Member, period: GoalPeriod, key: string) {
  const sets = period === 'weekly' ? member.goals.weekly : member.goals.monthly
  const earlier = Object.keys(sets)
    .filter((k) => k < key)
    .sort()
    .reverse()
  for (const k of earlier) {
    const set = sets[k]
    if (Object.values(set).some((entry) => entry?.target?.trim())) return { key: k, set }
  }
  return null
}

export const periodStartDate = (period: GoalPeriod, key: string) =>
  period === 'weekly' ? fromDateKey(key) : periodDates(period, key)[0]
