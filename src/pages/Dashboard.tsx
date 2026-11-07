import { ArrowRight, CircleCheck, CircleDashed, Dumbbell, PartyPopper, Sparkles, Target, Utensils } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { LogoMark } from '@/components/brand/Logo'
import { DailyBarChart } from '@/components/charts/charts'
import { CountUp, Reveal } from '@/components/motion/motion'
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
  greeting,
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
  nutritionDays,
  round1,
  trainingDays,
  valueAsOf,
  weekBurn,
  weekMacros,
  weekSteps,
} from '@/lib/metrics'
import type { GoalPeriod } from '@/lib/types'
import { DAY_INDEXES } from '@/lib/types'
import { cn } from '@/lib/utils'
import { fitnessDraft, mutate, useHub, useMember, useSelectedWeek, useWeekData } from '@/store/hub'

const decimal = (n: number) => formatNumber(n, 1)

function GoalTile({ goal }: { goal: ResolvedGoal }) {
  const Icon = GOAL_ICONS[goal.metric.id]
  const status = goalStatus(goal)
  const pct = goal.progress.achievedPct
  const reached = status.tone === 'good'
  return (
    <Link
      to="/goals"
      className="glass spotlight lift group flex h-full flex-col gap-2.5 rounded-2xl p-4 transition-transform duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="truncate">{goal.metric.label}</span>
        </span>
        {reached && <PartyPopper className="float size-4 shrink-0 text-primary" aria-label="Target reached" />}
      </div>
      <div className="font-display text-3xl leading-none font-black tabular-nums">
        {pct === null ? '—' : <><CountUp value={pct} format={decimal} />%</>}
      </div>
      <GoalMeter goal={goal} />
      <div className="min-h-8 text-xs leading-4">
        <div className="truncate text-muted-foreground">{goalValueLine(goal)}</div>
        <div className={cn('font-semibold', toneClass[status.tone])}>{status.text}</div>
      </div>
    </Link>
  )
}

function WelcomeCard() {
  const dismiss = () => mutate((_, doc) => void (doc.importPromptDismissed = true))
  return (
    <Panel className="mb-5 flex flex-col gap-3 border-primary/40 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-lg font-extrabold">Have data in the old tracker file?</h2>
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
    <Panel className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-black">Today</h2>
        <span className="text-sm font-medium text-muted-foreground">{DAY_LONG[today - 1]}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Steps" numeric value={fitness?.steps ?? ''} onChange={(v) => set('steps', v)} />
        <Field label="Calories burned" numeric unit="kcal" value={fitness?.burn ?? ''} onChange={(v) => set('burn', v)} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-accent/70 p-3">
          <dt className="text-xs text-muted-foreground">Calories in</dt>
          <dd className="font-display text-lg font-extrabold tabular-nums">{formatNumber(round1(macros.cal))} kcal</dd>
        </div>
        <div className="rounded-xl bg-accent/70 p-3">
          <dt className="text-xs text-muted-foreground">Protein</dt>
          <dd className="font-display text-lg font-extrabold tabular-nums">{formatNumber(round1(macros.pro))} g</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/nutrition" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Utensils aria-hidden />
          Log food
        </Link>
        <Link to="/fitness" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Dumbbell aria-hidden />
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
  const firstName = member.name.trim().split(/\s+/)[0] || 'there'

  const chartData = DAY_INDEXES.map((d) => ({
    label: DAY_SHORT[d - 1],
    intake: dayMacros(data.nutrition[d]).cal,
    burn: dayBurn(data.fitness[d]),
    steps: daySteps(data.fitness[d]),
  }))

  const weight = valueAsOf(member, 'weight', week)
  const bf = valueAsOf(member, 'bf', week)
  const snapshot: { label: string; value: number | null; unit: string; note: string; digits?: number }[] = [
    { label: 'Weight', value: weight, unit: ' kg', note: 'Physique', digits: 1 },
    { label: 'Body fat', value: bf, unit: '%', note: 'Physique', digits: 1 },
    { label: 'Calories burned', value: weekBurn(data), unit: ' kcal', note: 'Fitness' },
    { label: 'Steps', value: weekSteps(data), unit: '', note: 'Fitness' },
    { label: 'Calories intake', value: round1(macros.cal), unit: ' kcal', note: 'Nutrition' },
    { label: 'Protein', value: round1(macros.pro), unit: ' g', note: 'Nutrition', digits: 1 },
    { label: 'Carbs', value: round1(macros.carb), unit: ' g', note: 'Nutrition', digits: 1 },
    { label: 'Fat', value: round1(macros.fat), unit: ' g', note: 'Nutrition', digits: 1 },
    { label: 'Fiber', value: round1(macros.fiber), unit: ' g', note: 'Nutrition', digits: 1 },
  ]

  const chips = [
    { icon: Dumbbell, text: `${trainingDays(data)}/7 training days` },
    { icon: Utensils, text: `${nutritionDays(data)}/7 nutrition days` },
    { icon: Target, text: summary ? `${summary.active}/${summary.total} goals active` : 'No goals set yet' },
  ]

  return (
    <>
      {showWelcome && <WelcomeCard />}

      <section className="glass aurora relative mb-8 flex flex-col gap-8 rounded-3xl p-6 md:flex-row md:items-center md:justify-between md:p-9">
        <div className="min-w-0">
          <p className="eyebrow">{isCurrent ? `${greeting()}, ${firstName}` : 'Past or planned week'}</p>
          <h1 className="mt-2 font-display text-6xl leading-[0.9] font-black tracking-tight md:text-8xl">
            <span className="text-gradient glow-text">Week {isoWeekNumber(week)}</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {weekRangeLabel(week)}
            {isCurrent && ` · Today is ${DAY_LONG[dayIndexOf() - 1]}, ${formatDate(fromDateKey(todayKey()))}`}
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {chips.map(({ icon: Icon, text }, i) => (
              <li
                key={text}
                className="glass float flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ animationDelay: `${i * -2}s` }}
              >
                <Icon className="size-3.5 text-primary" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link to="/report" className={buttonVariants({ size: 'lg' })}>
              Open weekly report
              <ArrowRight aria-hidden />
            </Link>
            <Link to="/goals" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Set goals
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-5 self-center">
          {summary ? (
            <>
              <ProgressRing value={summary.score} size={168} stroke={13} label={`${period === 'weekly' ? 'Weekly' : 'Monthly'} goal score`} />
              <div className="text-sm">
                <div className="font-display text-lg font-extrabold">{period === 'weekly' ? 'Weekly' : 'Monthly'} goal score</div>
                <div className="text-muted-foreground">Average across active goals</div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <LogoMark className="float size-24 rounded-[26px]" />
              <Link to="/goals" className="text-sm font-semibold text-primary hover:underline">
                Set targets to see your score
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mb-9">
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
          {goals.map((goal, i) => (
            <Reveal key={goal.metric.id} index={i} className="h-full">
              <GoalTile goal={goal} />
            </Reveal>
          ))}
        </div>
      </section>

      <div className="mb-9 grid gap-4 lg:grid-cols-3">
        {isCurrent && (
          <Reveal>
            <TodayCard />
          </Reveal>
        )}
        <Reveal index={1} className={isCurrent ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <Panel className="h-full border-primary/30">
            <h2 className="flex items-center gap-2 font-display text-2xl font-black">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground glow">
                <Sparkles className="size-5" aria-hidden />
              </span>
              Smart focus
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">From this week's logs and goals.</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm">
              {focus.map((item) => (
                <li key={item} className="flex gap-2.5 rounded-xl bg-accent/60 p-3">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgb(var(--glow))]" />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>

      <section className="mb-9">
        <SectionHeading title="Weekly snapshot" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {snapshot.map((tile, i) => (
            <Reveal key={tile.label} index={i}>
              <StatTile
                label={tile.label}
                note={tile.note}
                value={
                  tile.value === null ? (
                    '—'
                  ) : (
                    <>
                      <CountUp value={tile.value} format={(n) => formatNumber(n, tile.digits ?? 0)} />
                      <span className="ml-0.5 text-lg font-bold text-muted-foreground">{tile.unit}</span>
                    </>
                  )
                }
              />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mb-9">
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
        <Panel className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {readiness.map((item) => {
            const complete = item.done >= item.total
            const Icon = complete ? CircleCheck : CircleDashed
            return (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <Icon className={cn('size-4 shrink-0', complete ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="font-semibold text-muted-foreground tabular-nums">
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
