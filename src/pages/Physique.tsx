import { LineTrendChart } from '@/components/charts/charts'
import { Field } from '@/components/shared/fields'
import { EmptyState, PageHeader, Panel, SectionHeading } from '@/components/shared/page'
import { PhotoSlot } from '@/components/shared/PhotoSlot'
import { Button } from '@/components/ui/button'
import { fromDateKey, formatDayMonth, isoWeekNumber } from '@/lib/dates'
import { num, physiqueTimeline } from '@/lib/metrics'
import type { BodySlot, PhysiqueKey } from '@/lib/types'
import { BODY_SLOTS, FACE_SLOTS, PHYSIQUE_FIELDS } from '@/lib/types'
import { mutate, useHub, useMember, useSelectedWeek, useWeekData, weekDraft } from '@/store/hub'

const HISTORY_COLUMNS: { key: PhysiqueKey; label: string; unit: string }[] = [
  { key: 'weight', label: 'Weight', unit: ' kg' },
  { key: 'bf', label: 'Body fat', unit: '%' },
  { key: 'lean', label: 'Lean mass', unit: ' kg' },
  { key: 'chest', label: 'Chest', unit: ' cm' },
  { key: 'waist', label: 'Waist', unit: ' cm' },
  { key: 'hip', label: 'Hip', unit: ' cm' },
  { key: 'neck', label: 'Neck', unit: ' cm' },
]

export function PhysiquePage() {
  const member = useMember()
  const week = useSelectedWeek()
  const data = useWeekData()
  const setWeek = useHub((s) => s.setWeek)
  const timeline = physiqueTimeline(member)

  const setField = (key: PhysiqueKey, value: string) =>
    mutate((m) => {
      weekDraft(m, week).physique[key] = value
    })

  const setPhoto = (slot: BodySlot, photo: (typeof data.photos)[BodySlot]) =>
    mutate((m) => {
      const photos = weekDraft(m, week).photos
      if (photo) photos[slot] = photo
      else delete photos[slot]
    })

  const chartData = timeline.map(({ key, physique }) => ({
    label: `W${isoWeekNumber(key)}`,
    weight: num(physique.weight),
    bf: num(physique.bf),
    lean: num(physique.lean),
    waist: num(physique.waist),
    hip: num(physique.hip),
    chest: num(physique.chest),
    neck: num(physique.neck),
  }))

  return (
    <>
      <PageHeader
        eyebrow="Physique"
        title="Body profile & measurements"
        description="Measurements save to the selected week and build your history automatically."
      />

      <section>
        <SectionHeading title={`Week ${isoWeekNumber(week)} measurements`} />
        <Panel className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {PHYSIQUE_FIELDS.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              unit={field.unit}
              numeric={!('text' in field)}
              placeholder={'text' in field ? '116/72' : undefined}
              value={data.physique[field.key] ?? ''}
              onChange={(v) => setField(field.key, v)}
            />
          ))}
        </Panel>
      </section>

      <section className="mt-8">
        <SectionHeading title="Body profiles" description="The full image is kept. Use the same light and pose each week." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BODY_SLOTS.map(({ id, label }) => (
            <PhotoSlot key={id} label={label} photo={data.photos[id]} onChange={(p) => setPhoto(id, p)} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading title="Face profiles" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {FACE_SLOTS.map(({ id, label }) => (
            <PhotoSlot key={id} label={label} photo={data.photos[id]} onChange={(p) => setPhoto(id, p)} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading title="Trends" />
        <div className="grid gap-3 lg:grid-cols-3">
          <LineTrendChart title="Weight" subtitle="By week, kg" unit="kg" data={chartData} series={[{ key: 'weight', name: 'Weight' }]} />
          <LineTrendChart title="Body fat" subtitle="By week, %" unit="%" data={chartData} series={[{ key: 'bf', name: 'Body fat' }]} />
          <LineTrendChart title="Lean mass" subtitle="By week, kg" unit="kg" data={chartData} series={[{ key: 'lean', name: 'Lean mass' }]} />
          <div className="lg:col-span-3">
            <LineTrendChart
              title="Measurements"
              subtitle="By week, cm"
              unit="cm"
              data={chartData}
              series={[
                { key: 'waist', name: 'Waist', slot: 0 },
                { key: 'hip', name: 'Hip', slot: 1 },
                { key: 'chest', name: 'Chest', slot: 2 },
                { key: 'neck', name: 'Neck', slot: 3 },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading title="History" description="Select a week to open it." />
        {timeline.length === 0 ? (
          <EmptyState title="No measurements yet" description="Your weekly records will appear here." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Physique history, newest first</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="p-3 font-medium">
                    Week
                  </th>
                  {HISTORY_COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className="p-3 font-medium whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...timeline].reverse().map(({ key, physique }) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <th scope="row" className="p-1 text-left font-normal whitespace-nowrap">
                      <Button variant={key === week ? 'link' : 'ghost'} size="sm" onClick={() => setWeek(key)}>
                        Week {isoWeekNumber(key)} · {formatDayMonth(fromDateKey(key))}
                      </Button>
                    </th>
                    {HISTORY_COLUMNS.map((c) => (
                      <td key={c.key} className="p-3 whitespace-nowrap tabular-nums">
                        {physique[c.key] ? `${physique[c.key]}${c.unit}` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
