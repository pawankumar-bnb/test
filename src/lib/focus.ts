import { addDays, dayIndexOf, fromDateKey, toDateKey, weekKeyOf } from './dates'
import { resolveGoals } from './goals'
import { formatNumber, nutritionDays, trainingDays, weekMacros, weekSteps } from './metrics'
import type { Member, WeekKey } from './types'
import { BODY_SLOTS, FACE_SLOTS } from './types'

const MIN_TRAINING_DAYS = 5
const PROTEIN_PER_DAY = 120
const STEPS_PER_DAY = 8000
/** How far a total may trail an even daily pace before it is worth a mention. */
const PACE_TOLERANCE_PCT = 15

const DEFAULT_FOCUS = [
  'Maintain training consistency and progressive overload.',
  'Keep nutrition close to your planned targets.',
  'Capture weekly physique and profile photos under consistent conditions.',
]

/** Rule-based next steps for a week, drawn from its logs and goals. */
export function smartFocus(member: Member, weekKey: WeekKey, now = new Date()) {
  const week = member.weeks[weekKey]
  const isCurrent = weekKey === weekKeyOf(now)
  const daysElapsed = isCurrent ? dayIndexOf(now) : 7
  const daysLeft = 7 - daysElapsed
  const focus: string[] = []

  for (const goal of resolveGoals(member, 'weekly', weekKey)) {
    const { metric, target, achieved, progress } = goal
    if (metric.kind !== 'total' || metric.limit || !target || progress.achievedPct === null) {
      continue
    }
    const expected = (daysElapsed / 7) * 100
    if (progress.achievedPct >= expected - PACE_TOLERANCE_PCT || !daysLeft) continue
    const perDay = Math.ceil((target - (achieved ?? 0)) / daysLeft)
    focus.push(
      `${metric.label} ${Math.round(progress.achievedPct)}% done with ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left. About ${formatNumber(perDay, 0)} a day gets you there.`,
    )
  }

  if (trainingDays(week) < Math.min(MIN_TRAINING_DAYS, daysElapsed)) {
    focus.push('Complete more strength-session logs across the week.')
  }
  if (weekMacros(week).pro / daysElapsed < PROTEIN_PER_DAY) {
    focus.push('Keep protein intake consistent day to day.')
  }
  if (weekSteps(week) / daysElapsed < STEPS_PER_DAY) {
    focus.push('Bring daily movement closer to your step target.')
  }
  if (!week?.physique.weight) focus.push('Update your weekly physique measurements.')

  return focus.length ? focus : DEFAULT_FOCUS
}

export interface ReadinessItem {
  label: string
  done: number
  total: number
}

export function reportReadiness(member: Member, weekKey: WeekKey): ReadinessItem[] {
  const week = member.weeks[weekKey]
  const count = (slots: readonly { id: string }[]) =>
    slots.filter(({ id }) => week?.photos[id as keyof typeof week.photos]).length
  const weekEnd = toDateKey(addDays(fromDateKey(weekKey), 6))
  const hasTest = member.fitnessTests.some((t) => t.date >= weekKey && t.date <= weekEnd)
  const goals = resolveGoals(member, 'weekly', weekKey)
  return [
    { label: 'Training days', done: trainingDays(week), total: 7 },
    { label: 'Nutrition days', done: nutritionDays(week), total: 7 },
    { label: 'Weekly goals set', done: goals.filter((g) => g.target !== null).length, total: goals.length },
    { label: 'Body photos', done: count(BODY_SLOTS), total: BODY_SLOTS.length },
    { label: 'Face photos', done: count(FACE_SLOTS), total: FACE_SLOTS.length },
    { label: 'Instagram analytics', done: week?.instagram.reach ? 1 : 0, total: 1 },
    { label: 'Fitness test this week', done: hasTest ? 1 : 0, total: 1 },
  ]
}
