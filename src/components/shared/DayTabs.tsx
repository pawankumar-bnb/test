import { motion } from 'motion/react'
import { type KeyboardEvent, useId, useRef, useState } from 'react'
import {
  DAY_LONG,
  DAY_SHORT,
  dateOfDay,
  dayIndexOf,
  formatDayNumber,
  toDateKey,
  todayKey,
  weekKeyOf,
} from '@/lib/dates'
import type { DayIndex, WeekKey } from '@/lib/types'
import { DAY_INDEXES } from '@/lib/types'
import { cn } from '@/lib/utils'

const defaultDay = (week: WeekKey): DayIndex => (week === weekKeyOf() ? dayIndexOf() : 1)

/** Opens on today in the current week and on Monday anywhere else. */
export function useDaySelection(week: WeekKey) {
  const [picked, setPicked] = useState<{ week: WeekKey; day: DayIndex } | null>(null)
  const day = picked?.week === week ? picked.day : defaultDay(week)
  const setDay = (next: DayIndex) => setPicked({ week, day: next })
  return [day, setDay] as const
}

export function DayTabs({
  week,
  value,
  onChange,
  isLogged,
  label,
}: {
  week: WeekKey
  value: DayIndex
  onChange: (day: DayIndex) => void
  isLogged: (day: DayIndex) => boolean
  label: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()
  const today = todayKey()

  function onKeyDown(event: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = (((value - 1 + step + 7) % 7) + 1) as DayIndex
    onChange(next)
    refs.current[next - 1]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="isolate mb-6 grid grid-cols-7 gap-1.5 md:gap-2" onKeyDown={onKeyDown}>
      {DAY_INDEXES.map((d) => {
        const date = dateOfDay(week, d)
        const isToday = toDateKey(date) === today
        const selected = d === value
        const logged = isLogged(d)
        return (
          <button
            key={d}
            ref={(el) => {
              refs.current[d - 1] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            aria-label={`${DAY_LONG[d - 1]} ${formatDayNumber(date)}${isToday ? ', today' : ''}${logged ? ', logged' : ''}`}
            onClick={() => onChange(d)}
            className={cn(
              'relative flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-2xl text-center transition-colors duration-200',
              selected ? 'text-primary-foreground' : 'glass spotlight text-foreground',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-day`}
                className="absolute inset-0 -z-10 rounded-2xl bg-brand-gradient glow"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className={cn('text-[11px] font-semibold', !selected && 'text-muted-foreground')}>
              {DAY_SHORT[d - 1]}
            </span>
            <span className="font-display text-xl leading-none font-black tabular-nums">
              {formatDayNumber(date)}
            </span>
            {logged && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-2 right-2 size-1.5 rounded-full',
                  selected ? 'bg-primary-foreground' : 'bg-primary shadow-[0_0_8px_rgb(var(--glow))]',
                )}
              />
            )}
            {isToday && !selected && (
              <span aria-hidden className="absolute inset-x-4 bottom-1.5 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        )
      })}
    </div>
  )
}
