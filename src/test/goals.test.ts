import { describe, expect, it } from 'vitest'
import { blankFitnessDay, blankFood, blankMember, blankNutritionDay, blankWeek } from '@/lib/factory'
import { journeyProgress, overallScore, previousTargets, resolveGoals, totalProgress } from '@/lib/goals'
import type { Member } from '@/lib/types'

const WEEK = '2026-11-02'

function memberWithWeek(): Member {
  const member = blankMember('Rafey', '26', '80', '20')
  member.weeks[WEEK] = blankWeek()
  return member
}

describe('total goals', () => {
  it('matches the voice note: target 10,000, achieved 9,000 is 90% done, 10% left', () => {
    expect(totalProgress(10000, 9000)).toEqual({ achievedPct: 90, remainingPct: 10, overPct: 0 })
  })

  it('reports overshoot without going negative on what is left', () => {
    expect(totalProgress(2000, 2500)).toEqual({ achievedPct: 125, remainingPct: 0, overPct: 25 })
  })

  it('has no percentage until a target exists', () => {
    expect(totalProgress(null, 9000).achievedPct).toBeNull()
    expect(totalProgress(0, 9000).achievedPct).toBeNull()
  })
})

describe('journey goals (weight, body fat)', () => {
  it('measures distance covered, losing', () => {
    expect(journeyProgress(80, 72, 76).achievedPct).toBe(50)
  })

  it('measures distance covered, gaining', () => {
    expect(journeyProgress(60, 70, 65).achievedPct).toBe(50)
  })

  it('never reports negative progress when moving the wrong way', () => {
    expect(journeyProgress(80, 72, 82).achievedPct).toBe(0)
  })

  it('is complete on target even with no start', () => {
    expect(journeyProgress(null, 72, 72).achievedPct).toBe(100)
  })

  it('falls back to closeness when there is no start', () => {
    expect(journeyProgress(null, 75, 80).achievedPct).toBe(93.8)
  })
})

describe('resolveGoals', () => {
  it('rolls logged steps, burn and intake into the weekly goal automatically', () => {
    const member = memberWithWeek()
    const week = member.weeks[WEEK]
    week.fitness[1] = { ...blankFitnessDay(), steps: '4000', burn: '300' }
    week.fitness[2] = { ...blankFitnessDay(), steps: '5000', burn: '200' }
    week.nutrition[1] = {
      ...blankNutritionDay(),
      meals: { breakfast: [{ ...blankFood(), cal: '500' }], dinner: [{ ...blankFood(), cal: '700' }] },
    }
    member.goals.weekly[WEEK] = { steps: { target: '10000' }, intake: { target: '2400' } }

    const goals = resolveGoals(member, 'weekly', WEEK)
    const steps = goals.find((g) => g.metric.id === 'steps')!
    expect(steps.achieved).toBe(9000)
    expect(steps.progress).toEqual({ achievedPct: 90, remainingPct: 10, overPct: 0 })
    expect(goals.find((g) => g.metric.id === 'burn')!.achieved).toBe(500)
    expect(goals.find((g) => g.metric.id === 'intake')!.progress.achievedPct).toBe(50)
  })

  it('lets a typed achieved value override the logs', () => {
    const member = memberWithWeek()
    member.weeks[WEEK].fitness[1] = { ...blankFitnessDay(), steps: '100' }
    member.goals.weekly[WEEK] = { steps: { target: '10000', achieved: '9000' } }
    const steps = resolveGoals(member, 'weekly', WEEK)[0]
    expect(steps.isManual).toBe(true)
    expect(steps.autoAchieved).toBe(100)
    expect(steps.progress.achievedPct).toBe(90)
  })

  it('counts only the days inside the month for a monthly goal', () => {
    const member = blankMember('Rafey')
    // 26 Oct – 1 Nov 2026 straddles the month boundary. Sunday 1 Nov belongs to November.
    member.weeks['2026-10-26'] = blankWeek()
    member.weeks['2026-10-26'].fitness[6] = { ...blankFitnessDay(), steps: '1000' }
    member.weeks['2026-10-26'].fitness[7] = { ...blankFitnessDay(), steps: '2000' }
    member.weeks[WEEK] = blankWeek()
    member.weeks[WEEK].fitness[1] = { ...blankFitnessDay(), steps: '5000' }
    member.goals.monthly['2026-11'] = { steps: { target: '100000' } }
    expect(resolveGoals(member, 'monthly', '2026-11')[0].achieved).toBe(7000)
    expect(resolveGoals(member, 'monthly', '2026-10')[0].achieved).toBe(1000)
  })

  it('tracks weight from the last value before the period to the latest in it', () => {
    const member = blankMember('Rafey', '', '82')
    member.weeks['2026-10-26'] = { ...blankWeek(), physique: { weight: '80' } }
    member.weeks[WEEK] = { ...blankWeek(), physique: { weight: '79' } }
    member.goals.weekly[WEEK] = { weight: { target: '78' } }
    const weight = resolveGoals(member, 'weekly', WEEK).find((g) => g.metric.id === 'weight')!
    expect(weight.start).toBe(80)
    expect(weight.achieved).toBe(79)
    expect(weight.progress).toEqual({ achievedPct: 50, remainingPct: 50, overPct: 0 })
  })

  it('uses the profile as the starting point before any record exists', () => {
    const member = blankMember('Rafey', '', '82', '20')
    member.goals.weekly[WEEK] = { bf: { target: '15' } }
    const bf = resolveGoals(member, 'weekly', WEEK).find((g) => g.metric.id === 'bf')!
    expect(bf.start).toBe(20)
    expect(bf.progress.achievedPct).toBe(0)
  })
})

describe('summaries', () => {
  it('caps each goal at 100 so one big win cannot hide a miss', () => {
    const member = memberWithWeek()
    member.weeks[WEEK].fitness[1] = { ...blankFitnessDay(), steps: '20000', burn: '0' }
    member.goals.weekly[WEEK] = { steps: { target: '10000' }, burn: { target: '1000' } }
    expect(overallScore(resolveGoals(member, 'weekly', WEEK))).toEqual({ score: 50, active: 2, total: 5 })
  })

  it('finds the latest earlier targets to copy forward', () => {
    const member = memberWithWeek()
    member.goals.weekly['2026-10-19'] = { steps: { target: '70000' } }
    member.goals.weekly['2026-10-26'] = { steps: { achieved: '5' } }
    expect(previousTargets(member, 'weekly', WEEK)?.key).toBe('2026-10-19')
  })
})
