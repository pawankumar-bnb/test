import { describe, expect, it } from 'vitest'
import { blankFitnessTest, blankMember } from '@/lib/factory'
import {
  blankEndurance,
  blankStrength,
  carryForward,
  enduranceHistory,
  fillPrevious,
  isLocked,
  previousEndurance,
  previousPr,
  prChange,
  redateTest,
  strengthHistory,
  upgradeDoc,
  upgradeMember,
} from '@/lib/fitness-test'
import type { FitnessTest, HubDoc } from '@/lib/types'

function test(date: string, strength: [string, string][] = [], endurance: [string, string, string, string][] = []) {
  const t = blankFitnessTest(date, '', '')
  t.strength = strength.map(([name, pr]) => ({ ...blankStrength(name), pr, sets: '3', reps: '10' }))
  t.endurance = endurance.map(([name, time, distance, hr]) => ({ ...blankEndurance(name), time, distance, hr }))
  return t
}

describe('previous PR', () => {
  const sep = test('2026-09-05', [['Bench press', '60']])
  const oct = test('2026-10-04', [['bench  PRESS', '65'], ['Squat', '']])
  const tests = [oct, sep]

  it('comes from the latest earlier test, matching names loosely', () => {
    expect(previousPr(tests, 'Bench press', '2026-11-03')).toEqual({ value: '65', from: '2026-10-04' })
    expect(previousPr(tests, 'Bench press', '2026-10-04')).toEqual({ value: '60', from: '2026-09-05' })
  })

  it('ignores tests on the same day or later, and unknown exercises', () => {
    expect(previousPr(tests, 'Bench press', '2026-09-05')).toBeNull()
    expect(previousPr(tests, 'Deadlift', '2026-11-03')).toBeNull()
  })

  it('keeps the record through a month the exercise was skipped', () => {
    const nov = test('2026-11-03', [['Bench press', '']])
    fillPrevious([nov, oct, sep], nov, nov.strength[0])
    const dec = carryForward([nov, oct, sep], '2026-12-01')
    expect(dec.strength[0]).toMatchObject({ name: 'Bench press', prevPr: '65', prevFrom: '2026-10-04', pr: '' })
  })
})

describe('a new test', () => {
  const oct = test('2026-10-04', [['Bench press', '65'], ['Pull-ups', '12']], [['Plank', '2:30', '', '120']])
  const sep = test('2026-09-05', [['Bench press', '60']])

  it('starts with last time’s exercises, sets and reps, and locked Previous PRs', () => {
    const { strength, endurance } = carryForward([oct, sep], '2026-11-03')
    expect(strength.map((e) => [e.name, e.sets, e.reps, e.prevPr, e.pr])).toEqual([
      ['Bench press', '3', '10', '65', ''],
      ['Pull-ups', '3', '10', '12', ''],
    ])
    expect(strength.every(isLocked)).toBe(true)
    expect(endurance).toMatchObject([{ name: 'Plank', time: '', distance: '', hr: '' }])
  })

  it('is empty when there is nothing to carry', () => {
    expect(carryForward([], '2026-11-03')).toEqual({ strength: [], endurance: [] })
  })
})

describe('locking', () => {
  it('never replaces a Previous PR that is already there', () => {
    const oct = test('2026-10-04', [['Bench press', '65']])
    const nov = test('2026-11-03', [['Bench press', '70']])
    nov.strength[0].prevPr = '50'
    fillPrevious([nov, oct], nov, nov.strength[0])
    expect(nov.strength[0].prevPr).toBe('50')
  })

  it('fills an empty one once the exercise is named', () => {
    const oct = test('2026-10-04', [['Bench press', '65']])
    const nov = test('2026-11-03')
    nov.strength.push(blankStrength('Bench press'))
    fillPrevious([nov, oct], nov, nov.strength[0])
    expect(nov.strength[0]).toMatchObject({ prevPr: '65', prevFrom: '2026-10-04' })
  })

  it('stays locked when the earlier test is later changed or deleted', () => {
    const oct = test('2026-10-04', [['Bench press', '65']])
    const nov = blankFitnessTest('2026-11-03', '', '', carryForward([oct], '2026-11-03'))
    oct.strength[0].pr = '99'
    expect(nov.strength[0].prevPr).toBe('65')
  })

  it('is looked up again only when a date change makes it no longer previous', () => {
    const sep = test('2026-09-05', [['Bench press', '60']])
    const oct = test('2026-10-04', [['Bench press', '65']])
    const nov = blankFitnessTest('2026-11-03', '', '', carryForward([oct, sep], '2026-11-03'))
    const tests = [nov, oct, sep]
    redateTest(tests, nov, '2026-11-20')
    expect(nov.strength[0]).toMatchObject({ prevPr: '65', prevFrom: '2026-10-04' })
    redateTest(tests, nov, '2026-09-20')
    expect(nov.strength[0]).toMatchObject({ prevPr: '60', prevFrom: '2026-09-05' })
    redateTest(tests, nov, '2026-08-01')
    expect(nov.strength[0]).toMatchObject({ prevPr: '', prevFrom: '' })
    redateTest(tests, nov, '')
    expect(nov.strength[0]).toMatchObject({ prevPr: '', prevFrom: '' })
    redateTest(tests, nov, '2026-11-20')
    expect(nov.strength[0]).toMatchObject({ prevPr: '65', prevFrom: '2026-10-04' })
  })

  it('keeps everything while the date is cleared', () => {
    const oct = test('2026-10-04', [['Bench press', '65']])
    const nov = blankFitnessTest('2026-11-03', '', '', carryForward([oct], '2026-11-03'))
    redateTest([nov, oct], nov, '')
    expect(nov.strength[0]).toMatchObject({ prevPr: '65', prevFrom: '2026-10-04' })
  })
})

describe('change', () => {
  it('compares numbers and ignores text', () => {
    expect(prChange('70', '65')).toBe(5)
    expect(prChange('62.5 kg', '65')).toBe(-2.5)
    expect(prChange('', '65')).toBeNull()
    expect(prChange('AMRAP', '65')).toBeNull()
  })
})

describe('history', () => {
  const tests: FitnessTest[] = [
    test('2026-10-04', [['Bench press', '65'], ['Pull-ups', '12']], [['Plank', '2:30', '', '120']]),
    test('2026-11-03', [['bench press', '70']], [['Plank', '', '', ''], ['Run', '12:00', '2 km', '160']]),
    test('2026-09-05', [['Bench press', '60']]),
  ]

  it('lays strength PRs out month by month, newest first, with the best', () => {
    const { columns, rows } = strengthHistory(tests)
    expect(columns.map((t) => t.date)).toEqual(['2026-11-03', '2026-10-04', '2026-09-05'])
    expect(rows).toMatchObject([
      { name: 'bench press', values: ['70', '65', '60'], best: '70' },
      { name: 'Pull-ups', values: ['', '12', ''], best: '12' },
    ])
  })

  it('lays endurance results out the same way, skipping empty entries', () => {
    const { columns, rows } = enduranceHistory(tests)
    expect(columns.map((t) => t.date)).toEqual(['2026-11-03', '2026-10-04'])
    expect(rows.map((r) => [r.name, r.values.map((v) => v?.time ?? null)])).toEqual([
      ['Run', ['12:00', null]],
      ['Plank', [null, '2:30']],
    ])
    expect(previousEndurance(tests, 'plank', '2026-11-03')).toMatchObject({ date: '2026-10-04', entry: { time: '2:30' } })
  })
})

describe('saved data from before', () => {
  function legacyMember() {
    const member = blankMember('Rafey')
    const make = (date: string, press: string, squat: string) =>
      ({ ...blankFitnessTest(date, '', ''), press, squat, strength: undefined, endurance: undefined }) as unknown as FitnessTest
    member.fitnessTests = [make('2026-11-03', '38', '45'), make('2026-10-04', '30', '')]
    return member
  }

  it('turns the old fixed fields into strength entries with Previous PRs', () => {
    const member = legacyMember()
    expect(upgradeMember(member)).toBe(true)
    const [nov, oct] = member.fitnessTests
    expect(nov).not.toHaveProperty('press')
    expect(nov.endurance).toEqual([])
    expect(nov.strength.map((e) => [e.name, e.pr, e.prevPr, e.prevFrom])).toEqual([
      ['Push-ups / DB press / barbell press', '38', '30', '2026-10-04'],
      ['Weighted / bodyweight squats', '45', '', ''],
    ])
    expect(oct.strength.map((e) => [e.name, e.pr, e.prevPr])).toEqual([['Push-ups / DB press / barbell press', '30', '']])
  })

  it('leaves current data alone', () => {
    const member = legacyMember()
    upgradeMember(member)
    const before = JSON.stringify(member)
    const doc = { members: { [member.id]: member } } as unknown as HubDoc
    expect(upgradeDoc(doc)).toBe(false)
    expect(JSON.stringify(member)).toBe(before)
  })
})
