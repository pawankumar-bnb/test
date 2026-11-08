import { Plus, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { EnduranceHistory, StrengthHistory } from '@/components/fitness-test/history'
import { EnduranceTest, StrengthTest } from '@/components/fitness-test/sections'
import { confirmAction } from '@/components/shared/confirm'
import { Field } from '@/components/shared/fields'
import { EmptyState, PageHeader, Panel, SectionHeading } from '@/components/shared/page'
import { PhotoSlot } from '@/components/shared/PhotoSlot'
import { Button } from '@/components/ui/button'
import { formatDate, fromDateKey, todayKey } from '@/lib/dates'
import { blankFitnessTest } from '@/lib/factory'
import { carryForward, redateTest } from '@/lib/fitness-test'
import { valueAsOf } from '@/lib/metrics'
import { deletePhoto } from '@/lib/photos'
import type { FitnessTest, FitnessTestKey, Member, PhotoRef } from '@/lib/types'
import { FITNESS_TEST_SECTIONS, TEST_PHOTO_SLOTS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { mutate, useMember, useSelectedWeek } from '@/store/hub'

const dateLabel = (date: string) => (date ? formatDate(fromDateKey(date)) : 'No date')

function History({ tests, activeId, onSelect }: { tests: FitnessTest[]; activeId?: string; onSelect: (id: string) => void }) {
  const columns: { label: string; value: (t: FitnessTest) => string }[] = [
    { label: 'Resting HR', value: (t) => t.rhr || '—' },
    { label: 'BP', value: (t) => t.bp || '—' },
    { label: 'Weight / body fat', value: (t) => `${t.weight || '—'} kg / ${t.bf || '—'}%` },
    { label: 'Rockport', value: (t) => t.rockTime || '—' },
    { label: 'VO2max', value: (t) => t.vo2 || '—' },
    { label: 'Strength PRs', value: (t) => String(t.strength.filter((e) => e.pr.trim()).length || '—') },
    {
      label: 'Endurance',
      value: (t) => String(t.endurance.filter((e) => e.time.trim() || e.distance.trim() || e.hr.trim()).length || '—'),
    },
  ]
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="sr-only">Fitness test history, newest first</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="p-3 font-medium">
              Date
            </th>
            {columns.map((c) => (
              <th key={c.label} scope="col" className="p-3 font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.id} className="border-b border-border last:border-0">
              <th scope="row" className="p-1 text-left font-normal whitespace-nowrap">
                <Button
                  variant="link"
                  size="sm"
                  className={cn(test.id !== activeId && 'text-foreground')}
                  onClick={() => onSelect(test.id)}
                >
                  {dateLabel(test.date)}
                </Button>
              </th>
              {columns.map((c) => (
                <td key={c.label} className="p-3 whitespace-nowrap tabular-nums">
                  {c.value(test)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FitnessTestPage() {
  const member = useMember()
  const week = useSelectedWeek()
  const tests = member.fitnessTests
  const [selectedId, setSelectedId] = useState<string | undefined>(tests[0]?.id)
  const test = tests.find((t) => t.id === selectedId) ?? tests[0]

  const edit = (recipe: (draft: FitnessTest, member: Member) => void) =>
    mutate((m) => {
      const draft = m.fitnessTests.find((t) => t.id === test?.id)
      if (draft) recipe(draft, m)
    })

  function addTest() {
    const date = todayKey()
    const sections = carryForward(tests, date)
    const created = blankFitnessTest(
      date,
      String(valueAsOf(member, 'weight', week) ?? ''),
      String(valueAsOf(member, 'bf', week) ?? ''),
      sections,
    )
    mutate((m) => void m.fitnessTests.unshift(created))
    setSelectedId(created.id)
    const carried = sections.strength.length + sections.endurance.length
    if (carried) {
      const prs = sections.strength.filter((e) => e.prevPr).length
      toast.success(
        `Brought over ${carried} exercise${carried === 1 ? '' : 's'} from your last test` +
          (prs ? `, with ${prs} Previous PR${prs === 1 ? '' : 's'} locked in.` : '.'),
      )
    }
  }

  async function removeTest() {
    if (!test) return
    const ok = await confirmAction({
      title: 'Delete this fitness test?',
      description: `The record from ${dateLabel(test.date)}, with its strength and endurance results and photos, will be removed. Later tests keep the Previous PRs they already carried over. This cannot be undone.`,
      confirmLabel: 'Delete test',
    })
    if (!ok) return
    const photos = Object.values(test.photos) as PhotoRef[]
    mutate((m) => {
      m.fitnessTests = m.fitnessTests.filter((t) => t.id !== test.id)
    })
    setSelectedId(undefined)
    await Promise.all(photos.map(deletePhoto))
  }

  return (
    <>
      <PageHeader
        eyebrow="Fitness assessment"
        title="Fitness test & history"
        description="Structured from your Wild Fit assessment sheet. Each test stays on record, so you can compare over time."
        actions={
          <Button onClick={addTest}>
            <Plus aria-hidden />
            New fitness test
          </Button>
        }
      />

      {!test ? (
        <EmptyState
          title="No fitness tests yet"
          description="Start your first assessment to record it here."
          action={<Button onClick={addTest}>Start a test</Button>}
        />
      ) : (
        <>
          <Panel className="flex flex-wrap items-end justify-between gap-3">
            <Field
              label="Test date"
              type="date"
              value={test.date}
              onChange={(v) => edit((t, m) => redateTest(m.fitnessTests, t, v))}
              className="w-full sm:w-56"
            />
            <Button variant="ghost" onClick={removeTest}>
              <Trash2 aria-hidden />
              Delete test
            </Button>
          </Panel>

          {FITNESS_TEST_SECTIONS.map((section) => (
            <Fragment key={section.title}>
              <section className="mt-6">
                <SectionHeading title={section.title} />
                <Panel className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {section.fields.map((field) => (
                    <Field
                      key={field.key}
                      label={field.label}
                      numeric={'numeric' in field}
                      placeholder={'placeholder' in field ? field.placeholder : undefined}
                      value={test[field.key as FitnessTestKey] ?? ''}
                      onChange={(v) => edit((t) => void (t[field.key as FitnessTestKey] = v))}
                    />
                  ))}
                </Panel>
              </section>
              {/* Muscular endurance sits where it did on the assessment sheet, now in two parts. */}
              {section.title === 'YMCA step-up test' && (
                <>
                  <StrengthTest test={test} tests={tests} />
                  <EnduranceTest test={test} tests={tests} />
                </>
              )}
            </Fragment>
          ))}

          <section className="mt-6">
            <SectionHeading
              title="Progress photos"
              description="Front, back, left and right for this test. The full image is kept."
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {TEST_PHOTO_SLOTS.map(({ id, label }) => (
                <PhotoSlot
                  key={id}
                  label={label}
                  photo={test.photos[id]}
                  onChange={(photo) =>
                    edit((t) => {
                      if (photo) t.photos[id] = photo
                      else delete t.photos[id]
                    })
                  }
                />
              ))}
            </div>
          </section>

          <section className="mt-8">
            <SectionHeading title="History" description="Select a date to open that record." />
            <History tests={tests} activeId={test.id} onSelect={setSelectedId} />
          </section>

          <StrengthHistory tests={tests} activeId={test.id} onSelect={setSelectedId} />
          <EnduranceHistory tests={tests} activeId={test.id} onSelect={setSelectedId} />
        </>
      )}
    </>
  )
}
