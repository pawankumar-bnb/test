import { Flame, Footprints, Percent, Scale, Utensils, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { EASE_OUT } from '@/components/motion/motion'
import type { ResolvedGoal } from '@/lib/goals'
import { formatNumber, withUnit } from '@/lib/metrics'
import type { GoalMetricId } from '@/lib/types'
import { cn } from '@/lib/utils'

export const GOAL_ICONS: Record<GoalMetricId, LucideIcon> = {
  steps: Footprints,
  burn: Flame,
  intake: Utensils,
  weight: Scale,
  bf: Percent,
}

export type GoalTone = 'muted' | 'good' | 'warning'

export function goalStatus(goal: ResolvedGoal): { text: string; tone: GoalTone } {
  const { achievedPct, remainingPct, overPct } = goal.progress
  if (achievedPct === null) return { text: 'No target set', tone: 'muted' }
  if (overPct > 0) {
    return goal.metric.limit
      ? { text: `${formatNumber(overPct)}% over target`, tone: 'warning' }
      : { text: `Beaten by ${formatNumber(overPct)}%`, tone: 'good' }
  }
  if (achievedPct >= 100) return { text: 'Target reached', tone: 'good' }
  return { text: `${formatNumber(remainingPct)}% left`, tone: 'muted' }
}

export const toneClass: Record<GoalTone, string> = {
  muted: 'text-muted-foreground',
  good: 'text-success',
  warning: 'text-warning',
}

/** “9,000 of 10,000 kcal” for totals, “76 kg, target 72 kg” for body values. */
export function goalValueLine(goal: ResolvedGoal) {
  const { metric, achieved, target } = goal
  if (metric.kind === 'journey') {
    if (target === null) return achieved === null ? 'Not recorded yet' : `Now ${withUnit(achieved, metric.unit)}`
    return `${withUnit(achieved, metric.unit)} now, target ${withUnit(target, metric.unit)}`
  }
  if (target === null) return `${withUnit(achieved, metric.unit)} logged`
  return `${formatNumber(achieved)} of ${withUnit(target, metric.unit)}`
}

export function GoalMeter({ goal, className }: { goal: ResolvedGoal; className?: string }) {
  const pct = goal.progress.achievedPct ?? 0
  const warn = goal.metric.limit && goal.progress.overPct > 0
  const done = !warn && pct >= 100
  return (
    <div
      role="progressbar"
      aria-label={`${goal.metric.label} progress`}
      aria-valuenow={Math.min(100, pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2.5 overflow-hidden rounded-full bg-muted', className)}
    >
      <motion.div
        className={cn(
          'relative h-full rounded-full',
          warn
            ? 'stripes bg-warning'
            : done
              ? 'bg-success-gradient'
              : 'bg-[linear-gradient(90deg,var(--grad-from),var(--grad-mid),var(--grad-to))]',
        )}
        initial={false}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        style={{ boxShadow: warn ? undefined : `0 0 12px rgb(var(${done ? '--success-glow' : '--glow'}) / 0.55)` }}
      >
        {done && <span aria-hidden className="shine absolute inset-0 rounded-full" />}
      </motion.div>
    </div>
  )
}
