import { ChevronLeft, ChevronRight, CopyPlus } from 'lucide-react'
import { useState } from 'react'
import { Field } from '@/components/shared/fields'
import { GOAL_ICONS, GoalMeter, goalStatus, goalValueLine, toneClass } from '@/components/shared/goals'
import { EmptyState, PageHeader, Panel } from '@/components/shared/page'
import { ProgressRing } from '@/components/shared/ProgressRing'
import { Segmented } from '@/components/shared/Segmented'
import { Button } from '@/components/ui/button'
import {
  isoWeekNumber,
  monthKeyOfWeek,
  monthLabel,
  shiftMonth,
  shiftWeek,
  weekRangeLabel,
} from '@/lib/dates'
import { overallScore, previousTargets, resolveGoals, type ResolvedGoal } from '@/lib/goals'
import { formatNumber, withUnit } from '@/lib/metrics'
import type { GoalEntry, GoalMetricId, GoalPeriod } from '@/lib/types'
import { cn } from '@/lib/utils'
import { mutate, mutateWithUndo, useHub, useMember, useSelectedWeek } from '@/store/hub'

function GoalCard({ goal, period, periodKey }: { goal: ResolvedGoal; period: GoalPeriod; periodKey: string }) {
  const { metric, entry, progress } = goal
  const Icon = GOAL_ICONS[metric.id]
  const status = goalStatus(goal)

  function update(field: keyof GoalEntry, value: string) {
    mutate((m) => {
      const sets = m.goals[period]
      const set = (sets[periodKey] ??= {})
      const target = (set[metric.id as GoalMetricId] ??= {})
      target[field] = value
    })
  }

  const achievedHint = goal.isManual
    ? 'Typed in. Clear it to use your logs.'
    : metric.kind === 'total'
      ? 'Filled from your logs. Type to override.'
      : 'From your latest Physique record.'

  const perDay =
    metric.kind === 'total' && goal.target
      ? `About ${formatNumber(goal.target / goal.days, 0)} a day`
      : undefined

  return (
    <Panel className="flex flex-col gap-4" data-goal-card={metric.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-extrabold">{metric.label}</h3>
            <p className="truncate text-sm text-muted-foreground">{goalValueLine(goal)}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div data-goal-pct className="font-display text-3xl leading-none font-black tabular-nums">
            {progress.achievedPct === null ? '—' : `${formatNumber(progress.achievedPct)}%`}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">achieved</div>
        </div>
      </div>

      <div>
        <GoalMeter goal={goal} />
        <div className="mt-1.5 flex justify-between text-xs">
          <span className={cn('font-medium', toneClass[status.tone])}>{status.text}</span>
          {perDay && <span className="text-muted-foreground">{perDay}</span>}
        </div>
      </div>

      <div className={cn('grid gap-3', metric.kind === 'journey' ? 'grid-cols-3' : 'grid-cols-2')}>
        {metric.kind === 'journey' && (
          <Field
            label="Start"
            numeric
            unit={metric.unit}
            value={entry.start ?? ''}
            placeholder={goal.autoStart === null ? '' : String(goal.autoStart)}
            onChange={(v) => update('start', v)}
          />
        )}
        <Field
          label="Target"
          numeric
          unit={metric.unit}
          value={entry.target ?? ''}
          onChange={(v) => update('target', v)}
        />
        <Field
          label="Achieved"
          numeric
          unit={metric.unit}
          value={entry.achieved ?? ''}
          placeholder={goal.autoAchieved === null ? '' : String(goal.autoAchieved)}
          onChange={(v) => update('achieved', v)}
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{achievedHint}</p>
    </Panel>
  )
}

export function GoalsPage() {
  const member = useMember()
  const week = useSelectedWeek()
  const setWeek = useHub((s) => s.setWeek)
  const [period, setPeriod] = useState<GoalPeriod>('weekly')
  const [month, setMonth] = useState(() => monthKeyOfWeek(week))

  const key = period === 'weekly' ? week : month
  const goals = resolveGoals(member, period, key)
  const summary = overallScore(goals)
  const noun = period === 'weekly' ? 'week' : 'month'
  const previous = previousTargets(member, period, key)
  const hasTargets = goals.some((g) => g.target !== null)

  const label = period === 'weekly' ? `Week ${isoWeekNumber(week)}` : monthLabel(month)
  const sublabel = period === 'weekly' ? weekRangeLabel(week) : 'Calendar month'

  function step(delta: number) {
    if (period === 'weekly') setWeek(shiftWeek(week, delta))
    else setMonth(shiftMonth(month, delta))
  }

  function copyPrevious() {
    if (!previous) return
    mutateWithUndo(`Copied targets from the last ${noun}`, (m) => {
      const sets = m.goals[period]
      const set = (sets[key] ??= {})
      for (const [id, entry] of Object.entries(previous.set)) {
        if (entry?.target) (set[id as GoalMetricId] ??= {}).target = entry.target
      }
    })
  }

  return (
    <>
      <PageHeader
        eyebrow="Goals"
        title={period === 'weekly' ? 'Weekly goals' : 'Monthly goals'}
        description="Set a target for each measure. Achieved fills in from what you log, then shows how much is done and how much is left."
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

      <Panel className="aurora mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          {summary ? (
            <ProgressRing value={summary.score} size={104} stroke={9} label={`${label} goal score`} />
          ) : null}
          <div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Previous ${noun}`} onClick={() => step(-1)}>
                <ChevronLeft aria-hidden />
              </Button>
              <span className="font-display text-2xl font-black" aria-live="polite">
                {label}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label={`Next ${noun}`} onClick={() => step(1)}>
                <ChevronRight aria-hidden />
              </Button>
            </div>
            <p className="px-2 text-sm text-muted-foreground">
              {sublabel}
              {summary ? ` · ${summary.active} of ${summary.total} goals active` : ''}
            </p>
          </div>
        </div>
        {!hasTargets && previous && (
          <Button variant="outline" onClick={copyPrevious}>
            <CopyPlus aria-hidden />
            Use last {noun}'s targets
          </Button>
        )}
      </Panel>

      {!hasTargets && !previous && (
        <div className="mb-4">
          <EmptyState
            title={`No targets for this ${noun} yet`}
            description="Type a target into any card below to start tracking it."
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((goal) => (
          <GoalCard key={goal.metric.id} goal={goal} period={period} periodKey={key} />
        ))}
      </div>

      <Panel className="mt-4">
        <h2 className="font-semibold">How weight and body fat are scored</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These measure how far you have moved from Start towards Target. Starting at{' '}
          {withUnit(80, 'kg')} with a target of {withUnit(76, 'kg')}, reaching {withUnit(78, 'kg')} is
          50% achieved. Start fills in from your last record before this {noun}, and you can type over
          it.
        </p>
      </Panel>
    </>
  )
}
