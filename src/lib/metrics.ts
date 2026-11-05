import { dayIndexOf, weekKeyOf } from './dates'
import type {
  DayIndex,
  FitnessDay,
  Member,
  NutritionDay,
  Physique,
  PhysiqueKey,
  WeekData,
  WeekKey,
} from './types'
import { DAY_INDEXES, MEALS } from './types'

export function num(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const n = parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

export const round1 = (n: number) => Math.round(n * 10) / 10

export interface Macros {
  cal: number
  pro: number
  carb: number
  fat: number
  fiber: number
}

const MACRO_KEYS = ['cal', 'pro', 'carb', 'fat', 'fiber'] as const
const zeroMacros = (): Macros => ({ cal: 0, pro: 0, carb: 0, fat: 0, fiber: 0 })

export function dayMacros(day: NutritionDay | undefined): Macros {
  const total = zeroMacros()
  if (!day) return total
  for (const { id } of MEALS) {
    for (const item of day.meals[id] ?? []) {
      for (const key of MACRO_KEYS) total[key] += num(item[key]) ?? 0
    }
  }
  return total
}

export function weekMacros(week: WeekData | undefined): Macros {
  const total = zeroMacros()
  for (const d of DAY_INDEXES) {
    const macros = dayMacros(week?.nutrition[d])
    for (const key of MACRO_KEYS) total[key] += macros[key]
  }
  return total
}

export const dayBurn = (day: FitnessDay | undefined) => num(day?.burn) ?? 0
export const daySteps = (day: FitnessDay | undefined) => num(day?.steps) ?? 0

export const weekBurn = (week: WeekData | undefined) =>
  DAY_INDEXES.reduce((sum, d) => sum + dayBurn(week?.fitness[d]), 0)
export const weekSteps = (week: WeekData | undefined) =>
  DAY_INDEXES.reduce((sum, d) => sum + daySteps(week?.fitness[d]), 0)

export const hasTraining = (day: FitnessDay | undefined) =>
  Boolean(
    day &&
      (day.strength.some((x) => x.name.trim()) ||
        day.cardio.some((x) => x.activity.trim() || num(x.duration))),
  )

export const hasActivity = (day: FitnessDay | undefined) =>
  hasTraining(day) || dayBurn(day) > 0 || daySteps(day) > 0

export const trainingDays = (week: WeekData | undefined) =>
  DAY_INDEXES.filter((d) => hasTraining(week?.fitness[d])).length

export const nutritionDays = (week: WeekData | undefined) =>
  DAY_INDEXES.filter((d) => dayMacros(week?.nutrition[d]).cal > 0).length

export const hasFoodLogged = (day: NutritionDay | undefined) =>
  Boolean(day && MEALS.some(({ id }) => (day.meals[id] ?? []).some((f) => f.name.trim())))

export const hasSupplementDose = (day: NutritionDay | undefined) =>
  Boolean(
    day &&
      Object.values(day.supplements).some((doses) =>
        Object.values(doses).some((dose) => dose?.trim()),
      ),
  )

/** Steps, burn and intake summed over any set of calendar days. */
export function totalsForDates(member: Member, dates: Date[]) {
  let steps = 0
  let burn = 0
  let intake = 0
  for (const date of dates) {
    const week = member.weeks[weekKeyOf(date)]
    if (!week) continue
    const day: DayIndex = dayIndexOf(date)
    steps += daySteps(week.fitness[day])
    burn += dayBurn(week.fitness[day])
    intake += dayMacros(week.nutrition[day]).cal
  }
  return { steps, burn, intake }
}

/** Weeks holding a physique record, oldest first. */
export function physiqueTimeline(member: Member) {
  return Object.keys(member.weeks)
    .sort()
    .map((key): { key: WeekKey; physique: Physique } => ({
      key,
      physique: member.weeks[key].physique,
    }))
    .filter(({ physique }) => Object.values(physique).some((v) => v?.trim()))
}

function latestPhysiqueValue(
  member: Member,
  field: PhysiqueKey,
  accepts: (key: WeekKey) => boolean,
) {
  const keys = Object.keys(member.weeks).sort().reverse()
  for (const key of keys) {
    if (!accepts(key)) continue
    const value = num(member.weeks[key].physique[field])
    if (value !== null) return value
  }
  return null
}

/** Latest measurement in or before the given week, falling back to the profile. */
export function valueAsOf(member: Member, field: 'weight' | 'bf', week: WeekKey) {
  return latestPhysiqueValue(member, field, (key) => key <= week) ?? num(member[field])
}

/** Latest measurement strictly before the given week, falling back to the profile. */
export function valueBefore(member: Member, field: 'weight' | 'bf', week: WeekKey) {
  return latestPhysiqueValue(member, field, (key) => key < week) ?? num(member[field])
}

export const formatNumber = (value: number | null | undefined, maxDigits = 1) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('en-IN', { maximumFractionDigits: maxDigits })

export const withUnit = (value: number | null | undefined, unit: string) => {
  const text = formatNumber(value)
  if (text === '—' || !unit) return text
  return unit === '%' ? `${text}%` : `${text} ${unit}`
}
