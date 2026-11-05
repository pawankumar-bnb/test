import { ArrowRight, CircleCheck, CircleDashed, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DailyBarChart } from '@/components/charts/charts'
import { Field } from '@/components/shared/fields'
import { GOAL_ICONS, GoalMeter, goalStatus, goalValueLine, toneClass } from '@/components/shared/goals'
import { Panel, SectionHeading, StatTile } from '@/components/shared/page'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { Segmented } from '@/components/shared/Segmented'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DAY_LONG,
  DAY_SHORT,
  dayIndexOf,
  formatDate,
  fromDateKey,
  isoWeekNumber,
  monthKeyOfWeek,
  monthLabel,
  todayKey,
  weekKeyOf,
  weekRangeLabel,
} from '@/lib/dates'
import { reportReadiness, smartFocus } from '@/lib/focus'
import { overallScore, resolveGoals, type ResolvedGoal } from '@/lib/goals'
import {
  dayBurn,
  dayMacros,
  daySteps,
  formatNumber,
  round1,
  valueAsOf,
  weekBurn,
  weekMacros,
  weekSteps,
  withUnit,
} from '@/lib/metrics'
import type { GoalPeriod } from '@/lib/types'
import { DAY_INDEXES } from '@/lib/types'
import { cn } from '@/lib/utils'
import { fitnessDraft, mutate, useHub, useMember, useSelectedWeek, useWeekData } from '@/store/hub'

function GoalTile({ goal }: { goal: ResolvedGoal }) {
  const Icon = GOAL_ICONS[goal.metric.id]
  const status = goalStatus(goal)
  const pct = goal.progress.achievedPct
  return (
    <Link
      to="/goals"
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:border-muted-foreground/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Icon className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{goal.metric.label}</span>
        </span>
      </div>
      <div className="font-display text-3xl leading-none font-bold tabular-nums">
        {pct === null ? '—' : `${formatNumber(pct)}%`}
      </div>
      <GoalMeter goal={goal} />
      <div className="min-h-8 text-xs leading-4">
        <div className="truncate text-muted-foreground">{goalValueLine(goal)}</div>
        <div className={cn('font-medium', toneClass[status.tone])}>{status.text}</div>
      </div>
    </Link>
  )
}

function WelcomeCard() {
  const dismiss = () => mutate((_, doc) => void (doc.importPromptDismissed = true))
  return (
    <Panel className="mb-4 flex flex-col gap-3 border-primary/40 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">Have data in the old tracker file?</h2>
        <p className="text-sm text-muted-foreground">
          Press Backup Data in the old file, then restore that backup here. Everything comes across, photos included.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link to="/settings" className={buttonVariants()}>
          Restore backup
        </Link>
        <Button variant="ghost" onClick={dismiss}>
          Start fresh
        </Button>
      </div>
    </Panel>
  )
}

function TodayCard() {
  const member = useMember()
  const key = weekKeyOf()
  const today = dayIndexOf()
  const week = member.weeks[key]
  const fitness = week?.fitness[today]
  const macros = dayMacros(week?.nutrition[today])

  const set = (field: 'steps' | 'burn', value: string) =>
    mutate((m) => {
      fitnessDraft(m, key, today)[field] = value
    })

  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold uppercase">Today</h2>
        <span className="text-sm text-muted-foreground">{DAY_LONG[today - 1]}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Steps" numeric value={fitness?.steps ?? ''} onChange={(v) => set('steps', v)} />
        <Field label="Calories burned" numeric unit="kcal" value={fitness?.burn ?? ''} onChange={(v) => set('burn', v)} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Calories in</dt>
          <dd className="font-semibold tabular-nums">{formatNumber(round1(macros.cal))} kcal</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Protein</dt>
          <dd className="font-semibold tabular-nums">{formatNumber(round1(macros.pro))} g</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/nutrition" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Log food
        </Link>
        <Link to="/fitness" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Log workout
        </Link>
      </div>
    </Panel>
  )
}

export function Dashboard() {
  const member = useMember()
  const week = useSelectedWeek()
  const data = useWeekData()
  const showWelcome = useHub(
    (s) => !s.doc.importPromptDismissed && Object.keys(s.doc.members[s.doc.activeId].weeks).length === 0,
  )
  const [period, setPeriod] = useState<GoalPeriod>('weekly')

  const isCurrent = week === weekKeyOf()
  const month = monthKeyOfWeek(week)
  const goals = resolveGoals(member, period, period === 'weekly' ? week : month)
  const summary = overallScore(goals)
  const weeklyGoals = period === 'weekly' ? goals : resolveGoals(member, 'weekly', week)
  const stepsTarget = weeklyGoals.find((g) => g.metric.id === 'steps')?.target

  const macros = weekMacros(data)
  const focus = smartFocus(member, week)
  const readiness = reportReadiness(member, week)

  const chartData = DAY_INDEXES.map((d) => ({
    label: DAY_SHORT[d - 1],
    intake: dayMacros(data.nutrition[d]).cal,
    burn: dayBurn(data.fitness[d]),
    steps: daySteps(data.fitness[d]),
  }))

  const snapshot = [
    { label: 'Weight', value: withUnit(valueAsOf(member, 'weight', week), 'kg'), note: 'Physique' },
    { label: 'Body fat', value: withUnit(valueAsOf(member, 'bf', week), '%'), note: 'Physique' },
    { label: 'Calories burned', value: withUnit(weekBurn(data), 'kcal'), note: 'Fitness' },
    { label: 'Steps', value: formatNumber(weekSteps(data), 0), note: 'Fitness' },
    { label: 'Calories intake', value: withUnit(round1(macros.cal), 'kcal'), note: 'Nutrition' },
    { label: 'Protein', value: withUnit(round1(macros.pro), 'g'), note: 'Nutrition' },
    { label: 'Carbs', value: withUnit(round1(macros.carb), 'g'), note: 'Nutrition' },
    { label: 'Fat', value: withUnit(round1(macros.fat), 'g'), note: 'Nutrition' },
    { label: 'Fiber', value: withUnit(round1(macros.fiber), 'g'), note: 'Nutrition' },
  ]

  return (
    <>
      {showWelcome && <WelcomeCard />}

      <section className="runway relative mb-6 flex flex-col gap-6 overflow-hidden rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
        <div className="min-w-0">
          <p className="eyebrow">{isCurrent ? 'Current week · Monday to Sunday' : 'Past or planned week'}</p>
          <h1 className="mt-2 font-display text-7xl leading-[0.85] font-bold tracking-tight uppercase md:text-8xl">
            Week {isoWeekNumber(week)}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {weekRangeLabel(week)}
            {isCurrent && ` · Today is ${DAY_LONG[dayIndexOf() - 1]}, ${formatDate(fromDateKey(todayKey()))}`}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link to="/report" className={buttonVariants()}>
              Open weekly report
              <ArrowRight aria-hidden />
            </Link>
            <Link to="/goals" className={buttonVariants({ variant: 'outline' })}>
              Set goals
            </Link>
          </div>
        </div>
        {summary && (
          <div className="flex shrink-0 items-center gap-4">
            <ProgressRing value={summary.score} label={`${period === 'weekly' ? 'Weekly' : 'Monthly'} goal score`} />
            <div className="text-sm">
              <div className="font-semibold">{period === 'weekly' ? 'Weekly' : 'Monthly'} goal score</div>
              <div className="text-muted-foreground">
                {summary.active} of {summary.total} goals active
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionHeading
          title="Goals"
          description={period === 'weekly' ? `Week ${isoWeekNumber(week)}` : monthLabel(month)}
          actions={
            <Segmented
              label="Goal period"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          }
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {goals.map((goal) => (
            <GoalTile key={goal.metric.id} goal={goal} />
          ))}
        </div>
      </section>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {isCurrent && <TodayCard />}
        <div className={cn('rounded-xl border border-primary/30 bg-primary/5 p-5', isCurrent ? 'lg:col-span-2' : 'lg:col-span-3')}>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase">
            <Sparkles className="size-5 text-primary" aria-hidden />
            Smart focus
          </h2>
          <p className="text-sm text-muted-foreground">From this week's logs and goals.</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {focus.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="mb-8">
        <SectionHeading title="Weekly snapshot" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {snapshot.map((tile) => (
            <StatTile key={tile.label} {...tile} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <SectionHeading title="This week by day" />
        <div className="grid gap-3 lg:grid-cols-2">
          <DailyBarChart
            title="Calories in and out"
            subtitle="Intake against burned, kcal"
            unit="kcal"
            data={chartData}
            series={[
              { key: 'intake', name: 'Intake', slot: 0 },
              { key: 'burn', name: 'Burned', slot: 2 },
            ]}
          />
          <DailyBarChart
            title="Steps"
            subtitle={stepsTarget ? `Line marks ${formatNumber(stepsTarget / 7, 0)} a day, your weekly target spread evenly` : 'Daily total'}
            data={chartData}
            series={[{ key: 'steps', name: 'Steps' }]}
            target={stepsTarget ? stepsTarget / 7 : undefined}
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Report readiness" description="What the weekly report still needs." />
        <Panel className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {readiness.map((item) => {
            const complete = item.done >= item.total
            const Icon = complete ? CircleCheck : CircleDashed
            return (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <Icon className={cn('size-4 shrink-0', complete ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.done}/{item.total}
                </span>
              </div>
            )
          })}
        </Panel>
      </section>
    </>
  )
}
