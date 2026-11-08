import { newId } from './factory'
import { num } from './metrics'
import type { EnduranceEntry, FitnessTest, HubDoc, Member, StrengthEntry } from './types'

/** Exercises match across tests by name, ignoring case and spacing. */
export const exerciseKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

export const blankStrength = (name = ''): StrengthEntry => ({
  id: newId(),
  name,
  sets: '',
  reps: '',
  pr: '',
  prevPr: '',
  prevFrom: '',
})

export const blankEndurance = (name = ''): EnduranceEntry => ({
  id: newId(),
  name,
  time: '',
  distance: '',
  hr: '',
})

const newestFirst = (tests: FitnessTest[]) => [...tests].sort((a, b) => b.date.localeCompare(a.date))

/** Tests dated strictly before `date`, newest first. Undated tests never count as history. */
function earlierTests(tests: FitnessTest[], date: string, excludeId?: string) {
  if (!date) return []
  return newestFirst(tests).filter((t) => t.id !== excludeId && t.date && t.date < date)
}

export interface PrSource {
  value: string
  /** Date of the test the value was recorded in. */
  from: string
}

/**
 * The best PR known before `date`: the latest earlier test that recorded one for this
 * exercise. A test where it was skipped passes on the Previous PR it carried, so a
 * missed month does not lose the record.
 */
export function previousPr(tests: FitnessTest[], name: string, date: string, excludeId?: string): PrSource | null {
  const key = exerciseKey(name)
  if (!key) return null
  for (const test of earlierTests(tests, date, excludeId)) {
    for (const entry of test.strength) {
      if (exerciseKey(entry.name) !== key) continue
      if (entry.pr.trim()) return { value: entry.pr.trim(), from: test.date }
      if (entry.prevPr.trim()) return { value: entry.prevPr.trim(), from: entry.prevFrom || test.date }
    }
  }
  return null
}

/** The latest earlier result for an endurance exercise, for side-by-side comparison. */
export function previousEndurance(tests: FitnessTest[], name: string, date: string, excludeId?: string) {
  const key = exerciseKey(name)
  if (!key) return null
  for (const test of earlierTests(tests, date, excludeId)) {
    const entry = test.endurance.find(
      (e) => exerciseKey(e.name) === key && (e.time.trim() || e.distance.trim() || e.hr.trim()),
    )
    if (entry) return { entry, date: test.date }
  }
  return null
}

/** A Previous PR is locked once it came from an earlier test. */
export const isLocked = (entry: StrengthEntry) => Boolean(entry.prevFrom)

/**
 * Fills a Previous PR that is still empty. A value already there, locked or typed by
 * hand, is never replaced.
 */
export function fillPrevious(tests: FitnessTest[], test: FitnessTest, entry: StrengthEntry) {
  if (entry.prevPr.trim()) return
  const source = previousPr(tests, entry.name, test.date, test.id)
  if (!source) return
  entry.prevPr = source.value
  entry.prevFrom = source.from
}

/**
 * A test's date moved. A locked Previous PR that now comes from the same day or later
 * is no longer “previous”, so only those are looked up again; empty ones are filled if
 * the new date has an earlier record. A cleared date changes nothing until a new one is set.
 */
export function redateTest(tests: FitnessTest[], test: FitnessTest, date: string) {
  test.date = date
  if (!date) return
  for (const entry of test.strength) {
    if (entry.prevFrom && entry.prevFrom >= date) {
      entry.prevPr = ''
      entry.prevFrom = ''
    }
    fillPrevious(tests, test, entry)
  }
}

/**
 * A new test starts with the exercises of the latest one before it: the same sets and
 * reps, each Previous PR filled in and locked, and empty results to log.
 */
export function carryForward(tests: FitnessTest[], date: string) {
  const template = earlierTests(tests, date)[0] ?? newestFirst(tests).find((t) => t.date <= date || !date)
  const strength: StrengthEntry[] = []
  const endurance: EnduranceEntry[] = []
  if (!template) return { strength, endurance }

  const seen = new Set<string>()
  for (const entry of template.strength) {
    const key = exerciseKey(entry.name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const next = { ...blankStrength(entry.name.trim()), sets: entry.sets, reps: entry.reps }
    const source = previousPr(tests, entry.name, date)
    if (source) {
      next.prevPr = source.value
      next.prevFrom = source.from
    }
    strength.push(next)
  }
  const seenEndurance = new Set<string>()
  for (const entry of template.endurance) {
    const key = exerciseKey(entry.name)
    if (!key || seenEndurance.has(key)) continue
    seenEndurance.add(key)
    endurance.push(blankEndurance(entry.name.trim()))
  }
  return { strength, endurance }
}

/** Positive when the new number is higher. Null when either side is not a number. */
export function prChange(current: string, previous: string) {
  const a = num(current)
  const b = num(previous)
  return a === null || b === null ? null : Math.round((a - b) * 100) / 100
}

/* ---------- History, month by month ---------- */

export interface StrengthHistoryRow {
  key: string
  name: string
  /** Same order as the columns, newest first. Empty when not tested that time. */
  values: string[]
  best: string
}

/** Tests with strength results, newest first, and one row per exercise. */
export function strengthHistory(tests: FitnessTest[]) {
  const columns = newestFirst(tests).filter((t) => t.strength.some((e) => e.name.trim() && e.pr.trim()))
  const rows = new Map<string, StrengthHistoryRow>()
  columns.forEach((test, i) => {
    for (const entry of test.strength) {
      const key = exerciseKey(entry.name)
      if (!key || !entry.pr.trim()) continue
      let row = rows.get(key)
      if (!row) {
        // Columns run newest first, so the first spelling met is the latest one.
        row = { key, name: entry.name.trim(), values: columns.map(() => ''), best: '' }
        rows.set(key, row)
      }
      row.values[i] ||= entry.pr.trim()
    }
  })
  for (const row of rows.values()) {
    let best: number | null = null
    for (const value of row.values) {
      const n = num(value)
      if (n !== null && (best === null || n > best)) {
        best = n
        row.best = value
      }
    }
  }
  return { columns, rows: [...rows.values()] }
}

export interface EnduranceHistoryRow {
  key: string
  name: string
  values: (EnduranceEntry | null)[]
}

export function enduranceHistory(tests: FitnessTest[]) {
  const filled = (e: EnduranceEntry) => e.name.trim() && (e.time.trim() || e.distance.trim() || e.hr.trim())
  const columns = newestFirst(tests).filter((t) => t.endurance.some(filled))
  const rows = new Map<string, EnduranceHistoryRow>()
  columns.forEach((test, i) => {
    for (const entry of test.endurance) {
      if (!filled(entry)) continue
      const key = exerciseKey(entry.name)
      let row = rows.get(key)
      if (!row) {
        row = { key, name: entry.name.trim(), values: columns.map(() => null) }
        rows.set(key, row)
      }
      row.values[i] ??= entry
    }
  })
  return { columns, rows: [...rows.values()] }
}

/* ---------- Upgrading saved data ---------- */

/** The three fixed boxes the old Muscular endurance section had. */
const LEGACY_FIELDS = [
  ['press', 'Push-ups / DB press / barbell press'],
  ['squat', 'Weighted / bodyweight squats'],
  ['lat', 'Lat-pulldown / TRX pull-ups'],
] as const

type LegacyTest = FitnessTest & Partial<Record<(typeof LEGACY_FIELDS)[number][0], string>>

/**
 * Brings tests saved before the strength and endurance sections existed up to date.
 * The old fixed results become strength entries, so they carry into the next test as
 * Previous PRs. Safe to run on data that is already current. Returns whether anything
 * changed.
 */
export function upgradeMember(member: Member) {
  let changed = false
  const converted: StrengthEntry[] = []
  for (const test of member.fitnessTests as LegacyTest[]) {
    if (!test.strength || !test.endurance) changed = true
    test.strength ??= []
    test.endurance ??= []
    for (const [key, label] of LEGACY_FIELDS) {
      if (!(key in test)) continue
      changed = true
      const value = test[key]?.trim()
      delete test[key]
      if (!value) continue
      const entry = { ...blankStrength(label), pr: value }
      test.strength.push(entry)
      converted.push(entry)
    }
  }
  if (!converted.length) return changed
  const owner = new Map<string, FitnessTest>()
  for (const test of member.fitnessTests) for (const entry of test.strength) owner.set(entry.id, test)
  // Oldest first, so each month's Previous PR is settled before the next one reads it.
  for (const entry of [...converted].sort((a, b) => owner.get(a.id)!.date.localeCompare(owner.get(b.id)!.date))) {
    fillPrevious(member.fitnessTests, owner.get(entry.id)!, entry)
  }
  return true
}

/** Upgrades a freshly loaded document in place. Returns whether anything changed. */
export function upgradeDoc(doc: HubDoc) {
  let changed = false
  for (const member of Object.values(doc.members)) changed = upgradeMember(member) || changed
  return changed
}
