import { Printer, RotateCcw, Stamp } from 'lucide-react'
import type { ReactNode } from 'react'
import { DailyBarChart, LineTrendChart } from '@/components/charts/charts'
import { PageHeader } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { DAY_LONG, DAY_SHORT, addDays, fromDateKey, isoWeekNumber, monthKeyOfWeek, monthLabel, toDateKey, weekRangeLabel } from '@/lib/dates'
import { resolveGoals, type ResolvedGoal } from '@/lib/goals'
import {
  dayBurn,
  dayMacros,
  daySteps,
  formatNumber,
  num,
  physiqueTimeline,
  round1,
  valueAsOf,
  weekBurn,
  weekMacros,
  weekSteps,
  withUnit,
} from '@/lib/metrics'
import { usePhotoUrl } from '@/lib/photos'
import type { DayIndex, Member, PhotoRef, SupplementColumn, WeekData } from '@/lib/types'
import { BODY_SLOTS, CONTENT_SLOTS, DAY_INDEXES, FACE_SLOTS, INSTAGRAM_FIELDS, SUPPLEMENT_SLOTS, TEST_PHOTO_SLOTS } from '@/lib/types'
import { mutate, useMember, useSelectedWeek, useWeekData, weekDraft } from '@/store/hub'

const TH = 'border-b border-[#101214] p-1.5 text-left text-[11px] font-semibold text-[#3f474d]'
const TD = 'border-b border-[#dfe2dc] p-1.5 align-top text-xs tabular-nums'

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-section mt-6">
      <h2 className="mb-2 font-display text-xl font-bold tracking-tight text-[#101214] uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Boxes({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-[#dfe2dc] bg-white p-2.5">
          <div className="text-[11px] text-[#5d666d]">{label}</div>
          <div className="mt-0.5 text-base font-bold text-[#101214] tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  )
}

function ReportPhoto({ photo, label, aspect = 'aspect-[3/4]' }: { photo?: PhotoRef; label: string; aspect?: string }) {
  const url = usePhotoUrl(photo?.id)
  return (
    <div className={`${aspect} flex items-center justify-center overflow-hidden rounded-lg bg-[#e8eae6] p-1 text-center text-[11px] text-[#5d666d]`}>
      {url ? <img src={url} alt={label} className="size-full object-contain" /> : label}
    </div>
  )
}

function GoalsTable({ title, goals }: { title: string; goals: ResolvedGoal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[#101214]">
        <caption className="mb-1 text-left text-xs font-semibold">{title}</caption>
        <thead>
          <tr>
            {['Goal', 'Target', 'Achieved', '% achieved', '% left'].map((h) => (
              <th key={h} scope="col" className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {goals.map((g) => (
            <tr key={g.metric.id}>
              <th scope="row" className={`${TD} text-left font-medium`}>
                {g.metric.label}
              </th>
              <td className={TD}>{withUnit(g.target, g.metric.unit)}</td>
              <td className={TD}>{withUnit(g.achieved, g.metric.unit)}</td>
              <td className={TD}>{g.progress.achievedPct === null ? '—' : `${formatNumber(g.progress.achievedPct)}%`}</td>
              <td className={TD}>{g.progress.remainingPct === null ? '—' : `${formatNumber(g.progress.remainingPct)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function doseSummary(week: WeekData, day: DayIndex, column: SupplementColumn) {
  const doses = week.nutrition[day]?.supplements[column.id]
  const parts = SUPPLEMENT_SLOTS.flatMap(({ id, label }) => {
    const dose = doses?.[id]?.trim()
    return dose ? [`${label[0]}: ${dose}`] : []
  })
  return parts.join(', ') || '—'
}

function SupplementsTable({ member, week }: { member: Member; week: WeekData }) {
  const columns = member.supplements.filter((c) =>
    DAY_INDEXES.some((d) =>
      Object.values(week.nutrition[d]?.supplements[c.id] ?? {}).some((dose) => dose?.trim()),
    ),
  )
  if (!columns.length) return <p className="text-xs text-[#5d666d]">No supplements logged this week.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[#101214]">
        <caption className="mb-1 text-left text-[11px] text-[#5d666d]">B: breakfast, L: lunch, D: dinner</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Day
            </th>
            {columns.map((c, i) => (
              <th key={c.id} scope="col" className={TH}>
                {c.name.trim() || `Supplement ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_INDEXES.map((d) => (
            <tr key={d}>
              <th scope="row" className={`${TD} text-left font-medium`}>
                {DAY_LONG[d - 1]}
              </th>
              {columns.map((c) => (
                <td key={c.id} className={TD}>
                  {doseSummary(week, d, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportPage() {
  const member = useMember()
  const key = useSelectedWeek()
  const week = useWeekData()
  const macros = weekMacros(week)
  const physique = week.physique
  const month = monthKeyOfWeek(key)
  const weekEnd = toDateKey(addDays(fromDateKey(key), 6))
  const test =
    member.fitnessTests.find((t) => t.date >= key && t.date <= weekEnd) ??
    member.fitnessTests.find((t) => t.date <= weekEnd)

  function finalize(finalized: boolean) {
    mutate((m) => {
      const draft = weekDraft(m, key)
      draft.finalized = finalized
      draft.finalizedAt = finalized ? new Date().toLocaleString('en-GB') : null
    })
  }

  const days = DAY_INDEXES.map((d) => {
    const m = dayMacros(week.nutrition[d])
    const fitness = week.fitness[d]
    return {
      label: DAY_SHORT[d - 1],
      cal: m.cal,
      pro: m.pro,
      carb: m.carb,
      fat: m.fat,
      fiber: m.fiber,
      burn: dayBurn(fitness),
      steps: daySteps(fitness),
      cardio: fitness?.cardio.reduce((sum, x) => sum + (num(x.duration) ?? 0), 0) ?? 0,
    }
  })

  const timeline = physiqueTimeline(member).map(({ key: k, physique: p }) => ({
    label: `W${isoWeekNumber(k)}`,
    weight: num(p.weight),
    bf: num(p.bf),
    lean: num(p.lean),
    waist: num(p.waist),
    hip: num(p.hip),
    chest: num(p.chest),
    neck: num(p.neck),
  }))

  const pair = (a?: string, b?: string) => `${a || '—'} / ${b || '—'} cm`
  const cm = (v?: string) => (v ? `${v} cm` : '—')

  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="Weekly report"
          title="Report"
          description="A clean sheet for your nutritionist, model mentor and performance trainer. Print it or save it as a PDF."
          actions={
            <>
              {week.finalized ? (
                <Button variant="outline" onClick={() => finalize(false)}>
                  <RotateCcw aria-hidden />
                  Reopen
                </Button>
              ) : (
                <Button variant="outline" onClick={() => finalize(true)}>
                  <Stamp aria-hidden />
                  Finalize week
                </Button>
              )}
              <Button onClick={() => window.print()}>
                <Printer aria-hidden />
                Print / save PDF
              </Button>
            </>
          }
        />
      </div>

      <article className="report-paper rounded-2xl bg-[#f6f7f3] p-5 text-[#101214] md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#101214] pb-3">
          <div>
            <h1 className="font-display text-3xl leading-none font-bold tracking-tight uppercase">
              Rafey: weekly personal performance report
            </h1>
            <p className="mt-1 text-sm text-[#5d666d]">
              {member.name} · Week {isoWeekNumber(key)} · {weekRangeLabel(key)}
            </p>
          </div>
          <div className="text-right text-sm text-[#5d666d]">
            <div className="font-semibold text-[#101214]">{week.finalized ? 'Finalized' : 'Draft'}</div>
            {week.finalizedAt}
          </div>
        </header>

        <div className="mt-4">
          <Boxes
            items={[
              ['Calories burned', withUnit(weekBurn(week), 'kcal')],
              ['Steps', formatNumber(weekSteps(week), 0)],
              ['Calories intake', withUnit(round1(macros.cal), 'kcal')],
              ['Protein', withUnit(round1(macros.pro), 'g')],
              ['Carbs', withUnit(round1(macros.carb), 'g')],
              ['Fat', withUnit(round1(macros.fat), 'g')],
              ['Fiber', withUnit(round1(macros.fiber), 'g')],
              ['Body fat', withUnit(valueAsOf(member, 'bf', key), '%')],
            ]}
          />
        </div>

        <ReportSection title="Goals">
          <div className="grid gap-4 lg:grid-cols-2">
            <GoalsTable title={`Week ${isoWeekNumber(key)}`} goals={resolveGoals(member, 'weekly', key)} />
            <GoalsTable title={monthLabel(month)} goals={resolveGoals(member, 'monthly', month)} />
          </div>
        </ReportSection>

        <ReportSection title="Fitness: daily activity">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Day', 'Strength', 'Cardio', 'Calories', 'Steps'].map((h) => (
                    <th key={h} scope="col" className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_INDEXES.map((d) => {
                  const f = week.fitness[d]
                  return (
                    <tr key={d}>
                      <th scope="row" className={`${TD} text-left font-medium`}>
                        {DAY_LONG[d - 1]}
                      </th>
                      <td className={TD}>{f?.type || '—'}</td>
                      <td className={TD}>{f?.cardio.map((x) => x.activity).filter(Boolean).join(', ') || '—'}</td>
                      <td className={TD}>{f?.burn || '—'}</td>
                      <td className={TD}>{f?.steps ? formatNumber(num(f.steps), 0) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection title="Nutrition: daily totals">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Day', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber'].map((h) => (
                    <th key={h} scope="col" className={TH}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_INDEXES.map((d) => {
                  const m = dayMacros(week.nutrition[d])
                  return (
                    <tr key={d}>
                      <th scope="row" className={`${TD} text-left font-medium`}>
                        {DAY_LONG[d - 1]}
                      </th>
                      <td className={TD}>{formatNumber(round1(m.cal))}</td>
                      <td className={TD}>{formatNumber(round1(m.pro))} g</td>
                      <td className={TD}>{formatNumber(round1(m.carb))} g</td>
                      <td className={TD}>{formatNumber(round1(m.fat))} g</td>
                      <td className={TD}>{formatNumber(round1(m.fiber))} g</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection title="Supplements">
          <SupplementsTable member={member} week={week} />
        </ReportSection>

        <ReportSection title="Physique">
          <Boxes
            items={[
              ['Weight', withUnit(valueAsOf(member, 'weight', key), 'kg')],
              ['BP', physique.bp || '—'],
              ['BMI', physique.bmi || '—'],
              ['Body fat', withUnit(valueAsOf(member, 'bf', key), '%')],
              ['Lean mass', physique.lean ? `${physique.lean} kg` : '—'],
              ['Chest', cm(physique.chest)],
              ['Arm L / R', pair(physique.armL, physique.armR)],
              ['Forearm L / R', pair(physique.foreL, physique.foreR)],
              ['Abdomen', cm(physique.abd)],
              ['Waist', cm(physique.waist)],
              ['Hip', cm(physique.hip)],
              ['Thigh L / R', pair(physique.thighL, physique.thighR)],
              ['Calf L / R', pair(physique.calfL, physique.calfR)],
              ['Neck', cm(physique.neck)],
            ]}
          />
        </ReportSection>

        <ReportSection title="Fitness test">
          <Boxes
            items={[
              ['Test date', test?.date || '—'],
              ['Resting HR', test?.rhr || '—'],
              ['BP', test?.bp || '—'],
              ['Rockport time', test?.rockTime || '—'],
              ['VO2max', test?.vo2 || '—'],
              ['YMCA HR', test?.stepHr || '—'],
              ['Press', test?.press || '—'],
              ['Squat', test?.squat || '—'],
            ]}
          />
        </ReportSection>

        <ReportSection title="Fitness test progress photos">
          <div className="grid grid-cols-4 gap-2">
            {TEST_PHOTO_SLOTS.map(({ id, label }) => (
              <ReportPhoto key={id} label={label} photo={test?.photos[id]} />
            ))}
          </div>
        </ReportSection>

        <ReportSection title="Body profiles">
          <div className="grid grid-cols-4 gap-2">
            {BODY_SLOTS.map(({ id, label }) => (
              <ReportPhoto key={id} label={label} photo={week.photos[id]} />
            ))}
          </div>
        </ReportSection>

        <ReportSection title="Face profiles">
          <div className="grid grid-cols-4 gap-2">
            {FACE_SLOTS.map(({ id, label }) => (
              <ReportPhoto key={id} label={label} photo={week.photos[id]} />
            ))}
          </div>
        </ReportSection>

        <ReportSection title="Instagram">
          <Boxes
            items={INSTAGRAM_FIELDS.map(({ key: k, label, unit }) => [
              label,
              week.instagram[k] ? `${week.instagram[k]}${unit}` : '—',
            ])}
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CONTENT_SLOTS.map(({ id, label }) => (
              <ReportPhoto key={id} label={label} aspect="aspect-[4/5]" photo={week.content[id]?.photo} />
            ))}
          </div>
        </ReportSection>

        <ReportSection title="Performance graphs">
          <div className="grid gap-2 md:grid-cols-2 print:grid-cols-2">
            <LineTrendChart theme="light" height={140} title="Weight" subtitle="By week, kg" unit="kg" data={timeline} series={[{ key: 'weight', name: 'Weight' }]} />
            <LineTrendChart theme="light" height={140} title="Body fat" subtitle="By week, %" unit="%" data={timeline} series={[{ key: 'bf', name: 'Body fat' }]} />
            <LineTrendChart
              theme="light"
              height={148}
              title="Measurements"
              subtitle="By week, cm"
              unit="cm"
              data={timeline}
              series={[
                { key: 'waist', name: 'Waist', slot: 0 },
                { key: 'hip', name: 'Hip', slot: 1 },
                { key: 'chest', name: 'Chest', slot: 2 },
                { key: 'neck', name: 'Neck', slot: 3 },
              ]}
            />
            <DailyBarChart theme="light" height={148} title="Calories burned" subtitle="Daily, kcal" unit="kcal" data={days} series={[{ key: 'burn', name: 'Calories burned' }]} />
            <DailyBarChart theme="light" height={148} title="Calories intake" subtitle="Daily, kcal" unit="kcal" data={days} series={[{ key: 'cal', name: 'Calories' }]} />
            <DailyBarChart theme="light" height={148} title="Protein" subtitle="Daily, grams" unit="g" data={days} series={[{ key: 'pro', name: 'Protein' }]} />
            <DailyBarChart
              theme="light"
              height={148}
              title="Macro pattern"
              subtitle="Daily carbs, fat and fiber, grams"
              unit="g"
              data={days}
              series={[
                { key: 'carb', name: 'Carbs', slot: 0 },
                { key: 'fat', name: 'Fat', slot: 1 },
                { key: 'fiber', name: 'Fiber', slot: 2 },
              ]}
            />
            <DailyBarChart theme="light" height={148} title="Cardio minutes" subtitle="Daily total" unit="min" data={days} series={[{ key: 'cardio', name: 'Cardio' }]} />
          </div>
        </ReportSection>

        <footer className="mt-6 text-center text-[11px] text-[#5d666d]">
          Private weekly progress report. Prepared for nutritionist, model mentor and performance trainer.
        </footer>
      </article>
    </>
  )
}
