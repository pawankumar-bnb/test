import { Lock, Plus, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CellInput } from '@/components/shared/fields'
import { Panel, SectionHeading } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, fromDateKey } from '@/lib/dates'
import {
  blankEndurance,
  blankStrength,
  fillPrevious,
  isLocked,
  prChange,
  previousEndurance,
  previousPr,
} from '@/lib/fitness-test'
import { formatNumber } from '@/lib/metrics'
import type { EnduranceEntry, FitnessTest, Member, StrengthEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { mutate, mutateWithUndo } from '@/store/hub'

const testLabel = (date: string) => (date ? formatDate(fromDateKey(date)) : 'an earlier test')

/** Edits one test of the active member. */
function editTest(testId: string, recipe: (test: FitnessTest, member: Member) => void) {
  mutate((m) => {
    const test = m.fitnessTests.find((t) => t.id === testId)
    if (test) recipe(test, m)
  })
}

/** Small caption above a field on narrow screens; wide screens show a header row instead. */
function Cell({ label, wideFrom, children, className }: { label: ReactNode; wideFrom: 'md' | 'xl'; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span
        className={cn(
          'flex h-5 items-center justify-between gap-1 text-[11px] text-muted-foreground',
          wideFrom === 'md' ? 'md:hidden' : 'xl:hidden',
        )}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

function ChangeBadge({ entry, className }: { entry: StrengthEntry; className?: string }) {
  if (!entry.pr.trim()) return null
  const change = prChange(entry.pr, entry.prevPr)
  if (change === null) {
    if (entry.prevPr.trim()) return null
    return <span className={cn('rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-muted-foreground', className)}>First</span>
  }
  const up = change > 0
  const label = change === 0 ? 'Same' : `${up ? '+' : '−'}${formatNumber(Math.abs(change))}`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
        up && 'bg-success/15 text-success',
        change < 0 && 'bg-warning/15 text-warning',
        change === 0 && 'bg-accent text-muted-foreground',
        className,
      )}
      aria-label={change === 0 ? 'Same as previous PR' : `${up ? 'Up' : 'Down'} ${formatNumber(Math.abs(change))} on previous PR`}
    >
      {up && <TrendingUp className="size-3" aria-hidden />}
      {change < 0 && <TrendingDown className="size-3" aria-hidden />}
      {label}
    </span>
  )
}

/* ---------- Strength ---------- */

const STRENGTH_GRID =
  'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-2 xl:grid-cols-[1.75rem_minmax(0,1fr)_4.5rem_4.5rem_8rem_8rem_4.5rem_2.5rem]'

function PreviousPrCell({ entry, name, onChange }: { entry: StrengthEntry; name: string; onChange: (value: string) => void }) {
  if (!isLocked(entry)) {
    return (
      <CellInput
        label={`Previous PR for ${name}`}
        placeholder="Optional"
        value={entry.prevPr}
        onChange={onChange}
      />
    )
  }
  const source = testLabel(entry.prevFrom)
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Input
          readOnly
          value={entry.prevPr}
          aria-label={`Previous PR for ${name}, from the ${source} test. Locked.`}
          title={`From your ${source} test. Locked so it cannot be overwritten.`}
          className="h-11 cursor-default border-dashed bg-accent/50 pr-8 font-semibold tabular-nums focus-visible:ring-2 md:h-10"
        />
        <Lock className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
      <span className="truncate text-[11px] text-muted-foreground" aria-hidden>
        {source}
      </span>
    </div>
  )
}

function StrengthRow({
  entry,
  index,
  test,
  tests,
  autoFocus,
}: {
  entry: StrengthEntry
  index: number
  test: FitnessTest
  tests: FitnessTest[]
  autoFocus: boolean
}) {
  const name = entry.name.trim() || `Exercise ${index + 1}`
  const set = (key: 'name' | 'sets' | 'reps' | 'pr' | 'prevPr', value: string) =>
    editTest(test.id, (t) => {
      const target = t.strength.find((x) => x.id === entry.id)
      if (target) target[key] = value
    })

  /** Once named, an exercise picks up its Previous PR from earlier tests. */
  function lookUpPrevious() {
    if (entry.prevPr.trim() || !previousPr(tests, entry.name, test.date, test.id)) return
    editTest(test.id, (t, m) => {
      const target = t.strength.find((x) => x.id === entry.id)
      if (target) fillPrevious(m.fitnessTests, t, target)
    })
  }

  return (
    <li className={STRENGTH_GRID} data-strength-row>
      <span className="flex h-11 items-center justify-center font-display text-base font-bold text-muted-foreground tabular-nums md:h-10">
        {index + 1}
      </span>
      <CellInput
        label={`Exercise ${index + 1} name`}
        placeholder="Exercise name"
        value={entry.name}
        autoFocus={autoFocus}
        onChange={(v) => set('name', v)}
        onBlur={lookUpPrevious}
        className="font-semibold"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        className="mt-0.5 xl:order-last"
        aria-label={`Remove ${name}`}
        onClick={() =>
          mutateWithUndo(`${name} removed`, (m) => {
            const list = m.fitnessTests.find((t) => t.id === test.id)?.strength
            const at = list?.findIndex((x) => x.id === entry.id) ?? -1
            if (list && at >= 0) list.splice(at, 1)
          })
        }
      >
        <X aria-hidden />
      </Button>
      <div className="col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:contents">
        <Cell label="Sets" wideFrom="xl">
          <CellInput numeric label={`Sets for ${name}`} value={entry.sets} onChange={(v) => set('sets', v)} className="text-center" />
        </Cell>
        <Cell label="Reps" wideFrom="xl">
          <CellInput
            inputMode="numeric"
            label={`Reps for ${name}`}
            value={entry.reps}
            onChange={(v) => set('reps', v)}
            className="text-center"
          />
        </Cell>
        <Cell label="Previous PR" wideFrom="xl">
          <PreviousPrCell entry={entry} name={name} onChange={(v) => set('prevPr', v)} />
        </Cell>
        <Cell
          label={
            <>
              Current PR
              <ChangeBadge entry={entry} />
            </>
          }
          wideFrom="xl"
        >
          <CellInput
            label={`Current PR for ${name}`}
            placeholder="e.g. 70 kg"
            value={entry.pr}
            onChange={(v) => set('pr', v)}
            className="font-semibold"
          />
        </Cell>
        <div className="hidden h-10 items-center xl:flex">
          <ChangeBadge entry={entry} />
        </div>
      </div>
    </li>
  )
}

export function StrengthTest({ test, tests }: { test: FitnessTest; tests: FitnessTest[] }) {
  const [focusId, setFocusId] = useState<string>()

  function add() {
    const entry = blankStrength()
    editTest(test.id, (t) => void t.strength.push(entry))
    setFocusId(entry.id)
  }

  return (
    <section className="mt-6">
      <SectionHeading
        title="Strength test"
        description="Previous PR fills in from your last test and stays locked. Log today's best in Current PR."
      />
      <Panel>
        {test.strength.length > 0 ? (
          <>
            <div className={cn(STRENGTH_GRID, 'mb-2 hidden text-[11px] font-medium text-muted-foreground xl:grid')} aria-hidden>
              <span />
              <span>Exercise</span>
              <span className="text-center">Sets</span>
              <span className="text-center">Reps</span>
              <span className="inline-flex items-center gap-1">
                Previous PR <Lock className="size-3" />
              </span>
              <span>Current PR</span>
              <span>Change</span>
              <span />
            </div>
            <ol className="flex flex-col gap-4 xl:gap-2.5">
              {test.strength.map((entry, i) => (
                <StrengthRow
                  key={entry.id}
                  entry={entry}
                  index={i}
                  test={test}
                  tests={tests}
                  autoFocus={entry.id === focusId}
                />
              ))}
            </ol>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No exercises yet. Add the lifts you test each month; the next test brings them back with these PRs as
            Previous PR.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={add} className="mt-4">
          <Plus aria-hidden />
          Add exercise
        </Button>
      </Panel>
    </section>
  )
}

/* ---------- Endurance ---------- */

const ENDURANCE_GRID =
  'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-2 md:grid-cols-[1.75rem_minmax(0,1fr)_7rem_7rem_7rem_2.5rem]'

const ENDURANCE_FIELDS = [
  { key: 'time', label: 'Time', placeholder: 'mm:ss', inputMode: undefined },
  { key: 'distance', label: 'Distance', placeholder: 'km / m', inputMode: undefined },
  { key: 'hr', label: 'Heart rate', placeholder: 'bpm', inputMode: 'numeric' },
] as const

function lastTimeSummary(entry: EnduranceEntry) {
  return [entry.time.trim(), entry.distance.trim(), entry.hr.trim() && `${entry.hr.trim()} bpm`].filter(Boolean).join(' · ')
}

function EnduranceRow({
  entry,
  index,
  test,
  tests,
  autoFocus,
}: {
  entry: EnduranceEntry
  index: number
  test: FitnessTest
  tests: FitnessTest[]
  autoFocus: boolean
}) {
  const name = entry.name.trim() || `Exercise ${index + 1}`
  const last = previousEndurance(tests, entry.name, test.date, test.id)
  const set = (key: 'name' | 'time' | 'distance' | 'hr', value: string) =>
    editTest(test.id, (t) => {
      const target = t.endurance.find((x) => x.id === entry.id)
      if (target) target[key] = value
    })

  return (
    <li className={ENDURANCE_GRID} data-endurance-row>
      <span className="flex h-11 items-center justify-center font-display text-base font-bold text-muted-foreground tabular-nums md:h-10">
        {index + 1}
      </span>
      <CellInput
        label={`Endurance exercise ${index + 1} name`}
        placeholder="Exercise name"
        value={entry.name}
        autoFocus={autoFocus}
        onChange={(v) => set('name', v)}
        className="font-semibold"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        className="mt-0.5 md:order-last"
        aria-label={`Remove ${name}`}
        onClick={() =>
          mutateWithUndo(`${name} removed`, (m) => {
            const list = m.fitnessTests.find((t) => t.id === test.id)?.endurance
            const at = list?.findIndex((x) => x.id === entry.id) ?? -1
            if (list && at >= 0) list.splice(at, 1)
          })
        }
      >
        <X aria-hidden />
      </Button>
      <div className="col-span-3 grid grid-cols-3 gap-2 md:contents">
        {ENDURANCE_FIELDS.map(({ key, label, placeholder, inputMode }) => (
          <Cell key={key} label={label} wideFrom="md">
            <CellInput
              label={`${label} for ${name}`}
              placeholder={placeholder}
              inputMode={inputMode}
              value={entry[key]}
              onChange={(v) => set(key, v)}
              className="text-center"
            />
          </Cell>
        ))}
      </div>
      {last && (
        <p className="col-span-3 -mt-0.5 pl-9 text-xs text-muted-foreground md:order-last md:col-span-full">
          Last test ({testLabel(last.date)}): <span className="font-semibold text-foreground">{lastTimeSummary(last.entry)}</span>
        </p>
      )}
    </li>
  )
}

export function EnduranceTest({ test, tests }: { test: FitnessTest; tests: FitnessTest[] }) {
  const [focusId, setFocusId] = useState<string>()

  function add() {
    const entry = blankEndurance()
    editTest(test.id, (t) => void t.endurance.push(entry))
    setFocusId(entry.id)
  }

  return (
    <section className="mt-6">
      <SectionHeading
        title="Endurance test"
        description="Time, distance and heart rate for each exercise. Your last test's numbers show underneath to compare."
      />
      <Panel>
        {test.endurance.length > 0 ? (
          <>
            <div className={cn(ENDURANCE_GRID, 'mb-2 hidden text-[11px] font-medium text-muted-foreground md:grid')} aria-hidden>
              <span />
              <span>Exercise</span>
              {ENDURANCE_FIELDS.map(({ key, label }) => (
                <span key={key} className="text-center">
                  {label}
                </span>
              ))}
              <span />
            </div>
            <ol className="flex flex-col gap-4 md:gap-2.5">
              {test.endurance.map((entry, i) => (
                <EnduranceRow
                  key={entry.id}
                  entry={entry}
                  index={i}
                  test={test}
                  tests={tests}
                  autoFocus={entry.id === focusId}
                />
              ))}
            </ol>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No exercises yet. Add runs, rows, planks or anything you time, and track them test by test.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={add} className="mt-4">
          <Plus aria-hidden />
          Add exercise
        </Button>
      </Panel>
    </section>
  )
}
