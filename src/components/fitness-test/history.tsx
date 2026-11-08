import { HeartPulse, Route, Timer, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeading } from '@/components/shared/page'
import { formatDate, fromDateKey } from '@/lib/dates'
import { enduranceHistory, prChange, strengthHistory } from '@/lib/fitness-test'
import { formatNumber } from '@/lib/metrics'
import type { FitnessTest } from '@/lib/types'
import { cn } from '@/lib/utils'

const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

const STICKY = 'sticky left-0 z-10 bg-card-solid/90 backdrop-blur-md'

/** A column per test, newest first. The header opens that test. */
function TestColumnHeader({ test, active, onSelect }: { test: FitnessTest; active: boolean; onSelect: (id: string) => void }) {
  const date = test.date ? fromDateKey(test.date) : null
  return (
    <th scope="col" className={cn('p-0 align-bottom font-medium', active && 'bg-primary/10')}>
      <button
        type="button"
        onClick={() => onSelect(test.id)}
        aria-current={active ? 'true' : undefined}
        aria-label={`Open the ${date ? formatDate(date) : 'undated'} test`}
        className="flex min-h-11 w-full cursor-pointer flex-col items-start justify-end px-3 py-2 text-left whitespace-nowrap transition-colors hover:text-primary"
      >
        <span className={cn('text-xs font-bold', active ? 'text-primary' : 'text-foreground')}>
          {date ? monthYear.format(date) : 'No date'}
        </span>
        <span className="text-[11px] text-muted-foreground">{date ? dayMonth.format(date) : '—'}</span>
      </button>
    </th>
  )
}

function Table({ caption, head, children }: { caption: string; head: ReactNode; children: ReactNode }) {
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="glass rounded-2xl px-5 py-6 text-sm text-muted-foreground">{children}</p>
}

export function StrengthHistory({ tests, activeId, onSelect }: { tests: FitnessTest[]; activeId?: string; onSelect: (id: string) => void }) {
  const { columns, rows } = strengthHistory(tests)
  return (
    <section className="mt-8">
      <SectionHeading
        title="Strength PR history"
        description="Every test's PRs, month by month and newest first. Each record stays here for good."
      />
      {!rows.length ? (
        <Empty>Current PRs you log will build a month-by-month record here.</Empty>
      ) : (
        <Table
          caption="Strength PRs by test, newest first"
          head={
            <>
              <th scope="col" className={cn(STICKY, 'p-3 font-medium')}>
                Exercise
              </th>
              <th scope="col" className="p-3 font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  <Trophy className="size-3.5 text-primary" aria-hidden />
                  Best
                </span>
              </th>
              {columns.map((test) => (
                <TestColumnHeader key={test.id} test={test} active={test.id === activeId} onSelect={onSelect} />
              ))}
            </>
          }
        >
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border last:border-0">
              <th scope="row" className={cn(STICKY, 'max-w-48 p-3 text-left font-semibold')}>
                {row.name}
              </th>
              <td className="p-3 font-bold whitespace-nowrap text-primary tabular-nums">{row.best || '—'}</td>
              {row.values.map((value, i) => {
                const older = row.values.slice(i + 1).find(Boolean)
                const change = value && older ? prChange(value, older) : null
                return (
                  <td
                    key={columns[i].id}
                    className={cn('p-3 whitespace-nowrap tabular-nums', columns[i].id === activeId && 'bg-primary/10')}
                  >
                    <span className={cn(!value && 'text-muted-foreground')}>{value || '—'}</span>
                    {change !== null && change !== 0 && (
                      <span className={cn('ml-1.5 text-[11px] font-bold', change > 0 ? 'text-success' : 'text-warning')}>
                        {change > 0 ? '+' : '−'}
                        {formatNumber(Math.abs(change))}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

export function EnduranceHistory({ tests, activeId, onSelect }: { tests: FitnessTest[]; activeId?: string; onSelect: (id: string) => void }) {
  const { columns, rows } = enduranceHistory(tests)
  return (
    <section className="mt-8">
      <SectionHeading title="Endurance history" description="Time, distance and heart rate from every test, newest first." />
      {!rows.length ? (
        <Empty>Endurance results you log will be kept here test by test.</Empty>
      ) : (
        <Table
          caption="Endurance results by test, newest first"
          head={
            <>
              <th scope="col" className={cn(STICKY, 'p-3 font-medium')}>
                Exercise
              </th>
              {columns.map((test) => (
                <TestColumnHeader key={test.id} test={test} active={test.id === activeId} onSelect={onSelect} />
              ))}
            </>
          }
        >
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border last:border-0">
              <th scope="row" className={cn(STICKY, 'max-w-48 p-3 text-left align-top font-semibold')}>
                {row.name}
              </th>
              {row.values.map((entry, i) => (
                <td
                  key={columns[i].id}
                  className={cn('p-3 align-top text-xs whitespace-nowrap tabular-nums', columns[i].id === activeId && 'bg-primary/10')}
                >
                  {entry ? (
                    <ul className="flex flex-col gap-1">
                      {[
                        { icon: Timer, value: entry.time.trim(), label: 'Time' },
                        { icon: Route, value: entry.distance.trim(), label: 'Distance' },
                        { icon: HeartPulse, value: entry.hr.trim() && `${entry.hr.trim()} bpm`, label: 'Heart rate' },
                      ]
                        .filter((part) => part.value)
                        .map(({ icon: Icon, value, label }) => (
                          <li key={label} className="flex items-center gap-1.5">
                            <Icon className="size-3.5 text-primary" aria-hidden />
                            <span className="sr-only">{label}: </span>
                            {value}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}
