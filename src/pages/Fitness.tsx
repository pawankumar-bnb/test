import { Plus, X } from 'lucide-react'
import { DailyBarChart } from '@/components/charts/charts'
import { DayTabs, useDaySelection } from '@/components/shared/DayTabs'
import { CellInput, Field } from '@/components/shared/fields'
import { EmptyState, PageHeader, Panel, SectionHeading, StatTile } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { DAY_LONG, DAY_SHORT, dateOfDay, formatDayMonth } from '@/lib/dates'
import { blankCardio, blankExercise } from '@/lib/factory'
import { dayBurn, daySteps, formatNumber, hasActivity, num, trainingDays, weekBurn, weekSteps } from '@/lib/metrics'
import type { CardioEntry, DayIndex, Exercise, FitnessDay, WeekKey } from '@/lib/types'
import { DAY_INDEXES } from '@/lib/types'
import { fitnessDraft, mutate, mutateWithUndo, useSelectedWeek, useWeekData } from '@/store/hub'

function ExerciseCard({ exercise, index, week, day }: { exercise: Exercise; index: number; week: WeekKey; day: DayIndex }) {
  const name = exercise.name.trim() || `Exercise ${index + 1}`

  const edit = (recipe: (target: Exercise) => void) =>
    mutate((m) => {
      const target = fitnessDraft(m, week, day).strength.find((x) => x.id === exercise.id)
      if (target) recipe(target)
    })

  return (
    <Panel>
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-center font-display text-lg font-semibold text-muted-foreground tabular-nums">
          {index + 1}
        </span>
        <CellInput
          label={`Exercise ${index + 1} name`}
          placeholder="Exercise name"
          value={exercise.name}
          onChange={(v) => edit((x) => void (x.name = v))}
          className="font-semibold"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${name}`}
          onClick={() =>
            mutateWithUndo(`${name} removed`, (m) => {
              const list = fitnessDraft(m, week, day).strength
              list.splice(list.findIndex((x) => x.id === exercise.id), 1)
            })
          }
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {exercise.sets.map((set, s) => (
          <fieldset key={s} className="min-w-0 rounded-lg border border-border p-2">
            <legend className="px-1 text-xs text-muted-foreground">Set {s + 1}</legend>
            <div className="grid grid-cols-2 gap-1.5">
              <CellInput
                numeric
                label={`${name} set ${s + 1} weight in kg`}
                placeholder="kg"
                value={set.w}
                onChange={(v) => edit((x) => void (x.sets[s].w = v))}
                className="px-1.5 text-center"
              />
              <CellInput
                numeric
                label={`${name} set ${s + 1} reps`}
                placeholder="reps"
                value={set.r}
                onChange={(v) => edit((x) => void (x.sets[s].r = v))}
                className="px-1.5 text-center"
              />
            </div>
          </fieldset>
        ))}
      </div>
    </Panel>
  )
}

const CARDIO_FIELDS = [
  { key: 'duration', label: 'Duration (min)' },
  { key: 'distance', label: 'Distance (km)' },
  { key: 'calories', label: 'Calories' },
  { key: 'hr', label: 'Avg HR' },
] as const

const CARDIO_GRID =
  'grid grid-cols-4 gap-2 md:grid-cols-[minmax(0,1fr)_repeat(4,6rem)_2.25rem] md:items-center'

function CardioRow({ row, index, week, day }: { row: CardioEntry; index: number; week: WeekKey; day: DayIndex }) {
  const name = row.activity.trim() || `Cardio ${index + 1}`
  const set = (key: keyof CardioEntry, value: string) =>
    mutate((m) => {
      const target = fitnessDraft(m, week, day).cardio.find((x) => x.id === row.id)
      if (target) target[key] = value
    })

  return (
    <div className={CARDIO_GRID}>
      <div className="col-span-3 md:col-span-1">
        <CellInput
          label={`Cardio ${index + 1} activity`}
          placeholder="Running / Cycling / Rowing"
          value={row.activity}
          onChange={(v) => set('activity', v)}
        />
      </div>
      {CARDIO_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[11px] text-muted-foreground md:hidden">{label}</span>
          <CellInput
            numeric
            label={`${label} for ${name}`}
            value={row[key]}
            onChange={(v) => set(key, v)}
            className="px-1.5 text-center"
          />
        </label>
      ))}
      <div className="col-start-4 row-start-1 flex justify-end md:col-start-auto md:row-start-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${name}`}
          onClick={() =>
            mutateWithUndo(`${name} removed`, (m) => {
              const list = fitnessDraft(m, week, day).cardio
              list.splice(list.findIndex((x) => x.id === row.id), 1)
            })
          }
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  )
}

export function FitnessPage() {
  const week = useSelectedWeek()
  const data = useWeekData()
  const [day, setDay] = useDaySelection(week)
  const fitness = data.fitness[day]

  const setField = (key: 'type' | 'burn' | 'steps' | 'notes', value: string) =>
    mutate((m) => {
      fitnessDraft(m, week, day)[key] = value
    })

  const addTo = (list: 'strength' | 'cardio') =>
    mutate((m) => {
      const draft: FitnessDay = fitnessDraft(m, week, day)
      if (list === 'strength') draft.strength.push(blankExercise())
      else draft.cardio.push(blankCardio())
    })

  const chartData = DAY_INDEXES.map((d) => {
    const f = data.fitness[d]
    return {
      label: DAY_SHORT[d - 1],
      exercises: f?.strength.filter((x) => x.name.trim()).length ?? 0,
      cardio: f?.cardio.reduce((sum, x) => sum + (num(x.duration) ?? 0), 0) ?? 0,
      burn: dayBurn(f),
      steps: daySteps(f),
    }
  })

  return (
    <>
      <PageHeader
        eyebrow="Fitness workout"
        title="Strength + endurance"
        description="Log every exercise with up to six sets of weight and reps, plus any cardio."
      />

      <DayTabs
        week={week}
        value={day}
        onChange={setDay}
        label="Day of the week"
        isLogged={(d) => hasActivity(data.fitness[d])}
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile label="Training days" value={`${trainingDays(data)}/7`} />
        <StatTile label="Week burn" value={formatNumber(weekBurn(data), 0)} note="kcal" />
        <StatTile label="Week steps" value={formatNumber(weekSteps(data), 0)} />
      </div>

      <SectionHeading title={DAY_LONG[day - 1]} description={formatDayMonth(dateOfDay(week, day))} />
      <Panel className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Session / focus"
          placeholder="Push / Pull / Legs"
          value={fitness?.type ?? ''}
          onChange={(v) => setField('type', v)}
        />
        <Field label="Calories burned" numeric unit="kcal" value={fitness?.burn ?? ''} onChange={(v) => setField('burn', v)} />
        <Field label="Steps" numeric value={fitness?.steps ?? ''} onChange={(v) => setField('steps', v)} />
        <Field
          label="Notes"
          placeholder="PR / recovery / observation"
          value={fitness?.notes ?? ''}
          onChange={(v) => setField('notes', v)}
        />
      </Panel>

      <section className="mt-8">
        <SectionHeading
          title="Strength session"
          actions={
            <Button onClick={() => addTo('strength')}>
              <Plus aria-hidden />
              Add exercise
            </Button>
          }
        />
        {fitness?.strength.length ? (
          <div className="flex flex-col gap-3">
            {fitness.strength.map((exercise, i) => (
              <ExerciseCard key={exercise.id} exercise={exercise} index={i} week={week} day={day} />
            ))}
          </div>
        ) : (
          <EmptyState title="No exercises logged" description="Add your first exercise for this day." />
        )}
      </section>

      <section className="mt-8">
        <SectionHeading
          title="Endurance / cardio"
          actions={
            <Button variant="outline" onClick={() => addTo('cardio')}>
              <Plus aria-hidden />
              Add cardio
            </Button>
          }
        />
        {fitness?.cardio.length ? (
          <Panel className="flex flex-col gap-3 md:gap-2">
            <div className={`${CARDIO_GRID} hidden text-[11px] text-muted-foreground md:grid`} aria-hidden>
              <span>Activity</span>
              {CARDIO_FIELDS.map(({ key, label }) => (
                <span key={key} className="text-center">
                  {label}
                </span>
              ))}
              <span />
            </div>
            {fitness.cardio.map((row, i) => (
              <CardioRow key={row.id} row={row} index={i} week={week} day={day} />
            ))}
          </Panel>
        ) : (
          <EmptyState title="No cardio logged" description="Add a run, ride or row." />
        )}
      </section>

      <section className="mt-8">
        <SectionHeading title="This week" />
        <div className="grid gap-3 lg:grid-cols-2">
          <DailyBarChart title="Calories burned" subtitle="Daily, kcal" unit="kcal" data={chartData} series={[{ key: 'burn', name: 'Calories burned' }]} />
          <DailyBarChart title="Steps" subtitle="Daily total" data={chartData} series={[{ key: 'steps', name: 'Steps' }]} />
          <DailyBarChart title="Cardio minutes" subtitle="Daily total" unit="min" data={chartData} series={[{ key: 'cardio', name: 'Cardio' }]} />
          <DailyBarChart title="Strength exercises" subtitle="Named exercises per day" data={chartData} series={[{ key: 'exercises', name: 'Exercises' }]} />
        </div>
      </section>
    </>
  )
}
