import { CopyPlus, Plus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { DailyBarChart } from '@/components/charts/charts'
import { DayTabs, useDaySelection } from '@/components/shared/DayTabs'
import { CellInput } from '@/components/shared/fields'
import { PageHeader, Panel, SectionHeading, StatTile } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { DAY_LONG, DAY_SHORT, dateOfDay, formatDayMonth, shiftWeek } from '@/lib/dates'
import { blankFood, blankSupplement } from '@/lib/factory'
import {
  dayMacros,
  formatNumber,
  hasFoodLogged,
  hasSupplementDose,
  type Macros,
  round1,
  weekMacros,
} from '@/lib/metrics'
import type {
  DayIndex,
  FoodItem,
  MealId,
  NutritionDay,
  SupplementColumn,
  SupplementDoses,
  SupplementSlot,
  WeekKey,
} from '@/lib/types'
import { DAY_INDEXES, MEALS, SUPPLEMENT_SLOTS } from '@/lib/types'
import { mutate, mutateWithUndo, nutritionDraft, useMember, useSelectedWeek, useWeekData } from '@/store/hub'

const MACRO_FIELDS = [
  { key: 'cal', label: 'Calories', short: 'kcal' },
  { key: 'pro', label: 'Protein', short: 'Protein' },
  { key: 'carb', label: 'Carbs', short: 'Carbs' },
  { key: 'fat', label: 'Fat', short: 'Fat' },
  { key: 'fiber', label: 'Fiber', short: 'Fiber' },
] as const

const FOOD_GRID =
  'grid grid-cols-5 gap-2 md:grid-cols-[minmax(0,1fr)_repeat(5,4.75rem)_2.25rem] md:items-center'

function FoodRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: FoodItem
  index: number
  onChange: (key: keyof FoodItem, value: string) => void
  onRemove: () => void
}) {
  const name = item.name.trim() || `Food item ${index + 1}`
  return (
    <div className={FOOD_GRID}>
      <div className="col-span-4 md:col-span-1">
        <CellInput
          label={`Food item ${index + 1}`}
          placeholder="Food item"
          value={item.name}
          onChange={(v) => onChange('name', v)}
        />
      </div>
      {MACRO_FIELDS.map(({ key, label, short }) => (
        <label key={key} className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[11px] text-muted-foreground md:hidden">{short}</span>
          <CellInput
            numeric
            label={`${label} for ${name}`}
            value={item[key]}
            onChange={(v) => onChange(key, v)}
            className="px-1.5 text-center md:px-2"
          />
        </label>
      ))}
      <div className="col-start-5 row-start-1 flex justify-end md:col-start-auto md:row-start-auto">
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={onRemove}>
          <X aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function MealCard({
  meal,
  items,
  week,
  day,
}: {
  meal: { id: MealId; label: string }
  items: FoodItem[]
  week: WeekKey
  day: DayIndex
}) {
  const edit = (recipe: (foods: FoodItem[]) => void) =>
    mutate((m) => {
      const draft = nutritionDraft(m, week, day)
      recipe((draft.meals[meal.id] ??= []))
    })

  const kcal = items.reduce((sum, item) => sum + (parseFloat(item.cal) || 0), 0)

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-lg font-extrabold">{meal.label}</h3>
          {kcal > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatNumber(round1(kcal))} kcal
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => edit((foods) => void foods.push(blankFood()))}>
          <Plus aria-hidden />
          Add food
        </Button>
      </div>

      {items.length > 0 && (
        <div className="mt-3 flex flex-col gap-3 md:gap-2">
          <div className={`${FOOD_GRID} hidden text-[11px] text-muted-foreground md:grid`} aria-hidden>
            <span>Food item</span>
            {MACRO_FIELDS.map(({ key, short }) => (
              <span key={key} className="text-center">
                {short}
              </span>
            ))}
            <span />
          </div>
          {items.map((item, index) => (
            <FoodRow
              key={item.id}
              item={item}
              index={index}
              onChange={(key, value) =>
                edit((foods) => {
                  const target = foods.find((f) => f.id === item.id)
                  if (target) target[key] = value
                })
              }
              onRemove={() =>
                mutateWithUndo(`${item.name.trim() || 'Food item'} removed`, (m) => {
                  const foods = nutritionDraft(m, week, day).meals[meal.id]
                  if (foods) foods.splice(foods.findIndex((f) => f.id === item.id), 1)
                })
              }
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

const hasDose = (doses: SupplementDoses | undefined) =>
  Boolean(doses && Object.values(doses).some((dose) => dose?.trim()))

/** Rows are meals, columns are supplements. The plus at the end of the header adds a column. */
function SupplementGrid({
  week,
  day,
  nutrition,
}: {
  week: WeekKey
  day: DayIndex
  nutrition: NutritionDay | undefined
}) {
  const member = useMember()
  const pendingFocus = useRef<string | null>(null)
  const headerInputs = useRef(new Map<string, HTMLInputElement>())

  const columns = member.supplements.filter(
    (column) => !column.archived || hasDose(nutrition?.supplements[column.id]),
  )

  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    const input = headerInputs.current.get(id)
    input?.focus()
    input?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [columns.length])

  function addColumn() {
    const column = blankSupplement()
    pendingFocus.current = column.id
    mutate((m) => void m.supplements.push(column))
  }

  function rename(id: string, name: string) {
    mutate((m) => {
      const column = m.supplements.find((c) => c.id === id)
      if (column) column.name = name
    })
  }

  function setDose(columnId: string, slot: SupplementSlot, value: string) {
    mutate((m) => {
      const draft = nutritionDraft(m, week, day)
      ;(draft.supplements[columnId] ??= {})[slot] = value
    })
  }

  function removeColumn(column: SupplementColumn, position: number) {
    const name = column.name.trim() || `Supplement ${position + 1}`
    mutateWithUndo(`${name} removed from your stack`, (m) => {
      const hasHistory = Object.values(m.weeks).some((w) =>
        Object.values(w.nutrition).some((d) => hasDose(d?.supplements[column.id])),
      )
      const index = m.supplements.findIndex((c) => c.id === column.id)
      if (hasHistory) m.supplements[index].archived = true // past days keep their record
      else m.supplements.splice(index, 1)
    })
  }

  function copyYesterday() {
    const sourceWeek = day === 1 ? shiftWeek(week, -1) : week
    const sourceDay = (day === 1 ? 7 : day - 1) as DayIndex
    const source = member.weeks[sourceWeek]?.nutrition[sourceDay]
    if (!hasSupplementDose(source)) {
      toast(`Nothing logged on ${DAY_LONG[sourceDay - 1]} to copy.`)
      return
    }
    mutateWithUndo(`Copied supplements from ${DAY_LONG[sourceDay - 1]}`, (m) => {
      nutritionDraft(m, week, day).supplements = JSON.parse(JSON.stringify(source!.supplements))
    })
  }

  const stickyLeft = 'sticky left-0 z-10 bg-card-solid/85 backdrop-blur-md'
  const stickyRight = 'sticky right-0 z-10 bg-card-solid/85 backdrop-blur-md'

  return (
    <section aria-labelledby="supplements-heading" className="mt-8">
      <SectionHeading
        title="Supplements"
        description="One column per supplement. Press + to add more. Your columns carry over to every day."
        actions={
          <Button variant="outline" size="sm" onClick={copyYesterday}>
            <CopyPlus aria-hidden />
            Same as yesterday
          </Button>
        }
      />
      <h3 id="supplements-heading" className="sr-only">
        Supplements for {DAY_LONG[day - 1]}
      </h3>
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Supplement doses for {DAY_LONG[day - 1]} by breakfast, lunch and dinner
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={`${stickyLeft} w-28 border-r border-b border-border p-3 text-left text-xs font-medium text-muted-foreground`}
              >
                Meal
              </th>
              {columns.map((column, i) => (
                <th key={column.id} scope="col" className="min-w-40 border-b border-border p-2 font-normal">
                  <div className="flex items-center gap-1">
                    <CellInput
                      ref={(el: HTMLInputElement | null) => {
                        if (el) headerInputs.current.set(column.id, el)
                        else headerInputs.current.delete(column.id)
                      }}
                      label={`Name of supplement ${i + 1}`}
                      placeholder={`Supplement ${i + 1}`}
                      value={column.name}
                      onChange={(v) => rename(column.id, v)}
                      className="font-semibold"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${column.name.trim() || `supplement ${i + 1}`}`}
                      onClick={() => removeColumn(column, i)}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                </th>
              ))}
              <th scope="col" className={`${stickyRight} w-14 border-b border-l border-border p-2`}>
                <Button size="icon-sm" aria-label="Add supplement column" onClick={addColumn}>
                  <Plus aria-hidden />
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {SUPPLEMENT_SLOTS.map((slot, rowIndex) => {
              const last = rowIndex === SUPPLEMENT_SLOTS.length - 1
              const edge = last ? '' : 'border-b border-border'
              return (
                <tr key={slot.id}>
                  <th
                    scope="row"
                    className={`${stickyLeft} ${edge} border-r border-border p-3 text-left font-display text-base font-extrabold`}
                  >
                    {slot.label}
                  </th>
                  {columns.map((column, i) => (
                    <td key={column.id} className={`${edge} p-2`}>
                      <CellInput
                        label={`${column.name.trim() || `Supplement ${i + 1}`} at ${slot.label.toLowerCase()}`}
                        placeholder="Dose"
                        value={nutrition?.supplements[column.id]?.[slot.id] ?? ''}
                        onChange={(v) => setDose(column.id, slot.id, v)}
                      />
                    </td>
                  ))}
                  <td className={`${stickyRight} ${edge} border-l border-border`} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MacroTiles({ day, week }: { day: Macros; week: Macros }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {MACRO_FIELDS.map(({ key, label }, i) => {
        const unit = key === 'cal' ? ' kcal' : ' g'
        return (
          <StatTile
            key={key}
            className={i === 0 ? 'col-span-2 sm:col-span-1' : undefined}
            label={label}
            value={`${formatNumber(round1(day[key]))}${unit}`}
            note={`Week ${formatNumber(round1(week[key]))}${unit}`}
          />
        )
      })}
    </div>
  )
}

export function NutritionPage() {
  const week = useSelectedWeek()
  const data = useWeekData()
  const [day, setDay] = useDaySelection(week)
  const nutrition = data.nutrition[day]

  const chartData = DAY_INDEXES.map((d) => {
    const macros = dayMacros(data.nutrition[d])
    return { label: DAY_SHORT[d - 1], cal: macros.cal, pro: macros.pro, carb: macros.carb, fat: macros.fat, fiber: macros.fiber }
  })

  return (
    <>
      <PageHeader
        eyebrow="Nutrition"
        title="Daily food log"
        description="Add as many foods as you need in each meal. Calories and macros roll up into daily and weekly totals."
      />

      <DayTabs
        week={week}
        value={day}
        onChange={setDay}
        label="Day of the week"
        isLogged={(d) => hasFoodLogged(data.nutrition[d]) || hasSupplementDose(data.nutrition[d])}
      />

      <SectionHeading title={`${DAY_LONG[day - 1]} totals`} description={formatDayMonth(dateOfDay(week, day))} />
      <MacroTiles day={dayMacros(nutrition)} week={weekMacros(data)} />

      <div className="mt-6 flex flex-col gap-3">
        {MEALS.map((meal) => (
          <MealCard key={meal.id} meal={meal} week={week} day={day} items={nutrition?.meals[meal.id] ?? []} />
        ))}
      </div>

      <SupplementGrid week={week} day={day} nutrition={nutrition} />

      <section className="mt-8">
        <SectionHeading title="This week" />
        <div className="grid gap-3 lg:grid-cols-2">
          <DailyBarChart title="Calories" subtitle="Daily intake, kcal" unit="kcal" data={chartData} series={[{ key: 'cal', name: 'Calories' }]} />
          <DailyBarChart title="Protein" subtitle="Daily intake, grams" unit="g" data={chartData} series={[{ key: 'pro', name: 'Protein' }]} />
          <div className="lg:col-span-2">
            <DailyBarChart
              title="Macro pattern"
              subtitle="Daily carbs, fat and fiber, grams"
              unit="g"
              data={chartData}
              series={[
                { key: 'carb', name: 'Carbs', slot: 0 },
                { key: 'fat', name: 'Fat', slot: 1 },
                { key: 'fiber', name: 'Fiber', slot: 2 },
              ]}
            />
          </div>
        </div>
      </section>
    </>
  )
}
