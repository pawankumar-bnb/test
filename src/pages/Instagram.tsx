import { LineTrendChart } from '@/components/charts/charts'
import { Field, TextAreaField } from '@/components/shared/fields'
import { PageHeader, Panel, SectionHeading } from '@/components/shared/page'
import { PhotoSlot } from '@/components/shared/PhotoSlot'
import { isoWeekNumber } from '@/lib/dates'
import { num } from '@/lib/metrics'
import type { ContentSlotId, InstagramKey, PhotoRef } from '@/lib/types'
import { CONTENT_SLOTS, INSTAGRAM_FIELDS } from '@/lib/types'
import { mutate, useMember, useSelectedWeek, useWeekData, weekDraft } from '@/store/hub'

export function InstagramPage() {
  const member = useMember()
  const week = useSelectedWeek()
  const data = useWeekData()

  const set = (key: InstagramKey | 'notes', value: string) =>
    mutate((m) => {
      weekDraft(m, week).instagram[key] = value
    })

  const editSlot = (id: ContentSlotId, patch: { photo?: PhotoRef | undefined; caption?: string }) =>
    mutate((m) => {
      const content = weekDraft(m, week).content
      const slot = (content[id] ??= { caption: '' })
      Object.assign(slot, patch)
    })

  const trend = Object.keys(member.weeks)
    .sort()
    .map((key) => ({
      label: `W${isoWeekNumber(key)}`,
      followers: num(member.weeks[key].instagram.followers),
      reach: num(member.weeks[key].instagram.reach),
    }))
    .filter((row) => row.followers !== null || row.reach !== null)

  return (
    <>
      <PageHeader eyebrow="Instagram" title="Weekly reach & content" description="Track this week's numbers and the posts that go with them." />

      <Panel className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {INSTAGRAM_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            unit={field.unit}
            numeric
            value={data.instagram[field.key] ?? ''}
            onChange={(v) => set(field.key, v)}
          />
        ))}
      </Panel>

      <section className="mt-8">
        <SectionHeading title="Weekly photo & content slots" />
        <div className="grid gap-4 sm:grid-cols-3">
          {CONTENT_SLOTS.map(({ id, label }) => (
            <div key={id} className="flex flex-col gap-3">
              <PhotoSlot
                label={label}
                aspect="aspect-[4/5]"
                photo={data.content[id]?.photo}
                onChange={(photo) => editSlot(id, { photo })}
              />
              <Field
                label="Caption / purpose"
                value={data.content[id]?.caption ?? ''}
                onChange={(caption) => editSlot(id, { caption })}
              />
            </div>
          ))}
        </div>
      </section>

      <TextAreaField
        className="mt-6"
        label="Notes"
        value={data.instagram.notes ?? ''}
        onChange={(v) => set('notes', v)}
      />

      <section className="mt-8">
        <SectionHeading title="Trends" />
        <div className="grid gap-3 lg:grid-cols-2">
          <LineTrendChart title="Followers" subtitle="By week" data={trend} series={[{ key: 'followers', name: 'Followers' }]} />
          <LineTrendChart title="Accounts reached" subtitle="By week" data={trend} series={[{ key: 'reach', name: 'Reach' }]} />
        </div>
      </section>
    </>
  )
}
