import { describe, expect, it } from 'vitest'
import {
  dayIndexOf,
  isoWeekNumber,
  legacyWeekToKey,
  monthKeyOfWeek,
  shiftMonth,
  shiftWeek,
  toDateKey,
  weekKeyOf,
  weekRangeLabel,
} from '@/lib/dates'

describe('weeks', () => {
  it('starts weeks on Monday', () => {
    expect(weekKeyOf(new Date(2026, 10, 5))).toBe('2026-11-02')
    expect(weekKeyOf(new Date(2026, 10, 8))).toBe('2026-11-02')
    expect(weekKeyOf(new Date(2026, 10, 9))).toBe('2026-11-09')
    expect(dayIndexOf(new Date(2026, 10, 8))).toBe(7)
  })

  it('keeps the local date near midnight', () => {
    expect(toDateKey(new Date(2026, 10, 5, 0, 30))).toBe('2026-11-05')
  })

  it('numbers weeks per ISO-8601', () => {
    expect(isoWeekNumber('2026-11-02')).toBe(45)
    expect(isoWeekNumber('2025-12-29')).toBe(1)
    expect(isoWeekNumber('2021-01-04')).toBe(1)
    expect(isoWeekNumber('2020-12-28')).toBe(53)
  })

  it('moves across year boundaries', () => {
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('labels ranges', () => {
    expect(weekRangeLabel('2026-11-02')).toBe('2 – 8 Nov 2026')
    expect(weekRangeLabel('2026-11-30')).toBe('30 Nov – 6 Dec 2026')
  })

  it('assigns a split week to the month holding its Thursday', () => {
    expect(monthKeyOfWeek('2026-10-26')).toBe('2026-10')
    expect(monthKeyOfWeek('2026-11-30')).toBe('2026-12')
  })
})

describe('legacy week numbers', () => {
  it('maps a v14 week number to its Monday', () => {
    expect(legacyWeekToKey(45, new Date(2026, 10, 5))).toBe('2026-11-02')
  })

  it('places a week after the backup date in the previous year', () => {
    expect(legacyWeekToKey(50, new Date(2027, 0, 20))).toBe('2026-12-07')
    expect(legacyWeekToKey(3, new Date(2027, 0, 20))).toBe('2027-01-11')
  })
})
