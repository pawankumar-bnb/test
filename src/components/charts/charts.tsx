import { type ReactElement, type ReactNode, cloneElement } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from '@/lib/metrics'

/**
 * Categorical slots validated for colour-blind separation and contrast on each
 * surface. Series keep their slot across every chart; single-series charts use slot 0.
 */
const THEMES = {
  dark: {
    surface: '#11161b',
    grid: '#232c34',
    axis: '#93a0aa',
    text: '#f2f5f7',
    muted: '#a4afb8',
    tooltip: '#1b2229',
    accent: '#d8ff45',
    series: ['#82a31a', '#3f8fe6', '#d4722a', '#9d70ec', '#0f9d83'],
  },
  light: {
    surface: '#ffffff',
    grid: '#e4e7e2',
    axis: '#5d666d',
    text: '#101214',
    muted: '#5d666d',
    tooltip: '#ffffff',
    accent: '#4d7c0f',
    series: ['#4d7c0f', '#1d6fd1', '#c2570c', '#7c4dd6', '#0f8a6a'],
  },
} as const

export type ChartTheme = keyof typeof THEMES

export interface ChartSeries {
  key: string
  name: string
  /** Fixed categorical slot, so a series keeps its colour wherever it appears. */
  slot?: number
}

type Row = Record<string, string | number | null>

interface ChartProps {
  title: string
  subtitle?: string
  data: Row[]
  xKey?: string
  series: ChartSeries[]
  unit?: string
  theme?: ChartTheme
  height?: number
  emptyText?: string
  /** Horizontal target line, labelled in the subtitle by the caller. */
  target?: number | null
}

/** One tick style per axis: compact only when the axis actually reaches 10,000. */
function tickFormatter(data: Row[], series: ChartSeries[]) {
  const peak = Math.max(
    0,
    ...data.flatMap((row) =>
      series.map((s) => (typeof row[s.key] === 'number' ? (row[s.key] as number) : 0)),
    ),
  )
  return peak >= 10000
    ? (value: number) => `${formatNumber(value / 1000, 1)}K`
    : (value: number) => formatNumber(value, 1)
}

function hasValues(data: Row[], series: ChartSeries[]) {
  return data.some((row) =>
    series.some((s) => typeof row[s.key] === 'number' && (row[s.key] as number) !== 0),
  )
}

function ChartTooltip({
  active,
  label,
  payload,
  unit,
  theme,
}: {
  active?: boolean
  label?: string | number
  payload?: readonly { name?: string | number; value?: unknown; color?: string }[]
  unit?: string
  theme: ChartTheme
}) {
  const t = THEMES[theme]
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: t.tooltip, borderColor: t.grid, color: t.text }}
    >
      <div className="mb-1" style={{ color: t.muted }}>
        {label}
      </div>
      {payload.map((item) => (
        <div key={String(item.name)} className="flex items-center gap-2 py-0.5">
          <span className="h-0.5 w-3 rounded" style={{ background: item.color }} aria-hidden />
          <span className="font-semibold tabular-nums">
            {formatNumber(item.value as number)}
            {unit ? ` ${unit}` : ''}
          </span>
          <span style={{ color: t.muted }}>{item.name}</span>
        </div>
      ))}
    </div>
  )
}

function Legend({ series, theme, mark }: { series: ChartSeries[]; theme: ChartTheme; mark: 'line' | 'bar' }) {
  const t = THEMES[theme]
  if (series.length < 2) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: t.muted }}>
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={mark === 'line' ? 'h-0.5 w-3.5 rounded' : 'size-2.5 rounded-[3px]'}
            style={{ background: t.series[s.slot ?? i] }}
          />
          {s.name}
        </li>
      ))}
    </ul>
  )
}

function ChartFrame({
  title,
  subtitle,
  theme,
  children,
}: {
  title: string
  subtitle?: string
  theme: ChartTheme
  children: ReactNode
}) {
  return (
    <figure
      className={
        theme === 'dark'
          ? 'chart-frame m-0 rounded-xl border border-border bg-card p-4'
          : 'chart-frame m-0 rounded-lg border border-[#dfe2dc] bg-white p-3'
      }
    >
      <figcaption className="mb-3">
        <div className={theme === 'dark' ? 'text-sm font-semibold' : 'text-xs font-semibold text-[#101214]'}>
          {title}
        </div>
        {subtitle && (
          <div className={theme === 'dark' ? 'text-xs text-muted-foreground' : 'text-[10px] text-[#5d666d]'}>
            {subtitle}
          </div>
        )}
      </figcaption>
      {children}
    </figure>
  )
}

function Empty({ text, height, theme }: { text: string; height: number; theme: ChartTheme }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed text-center text-xs"
      style={{ height, borderColor: THEMES[theme].grid, color: THEMES[theme].muted }}
    >
      {text}
    </div>
  )
}

/** Fits two charts side by side on A4. */
const REPORT_CHART_WIDTH = 340

/**
 * On screen a chart tracks its container. The report is a printed sheet, and a chart
 * measured for the screen would run off the paper, so it gets a fixed size instead.
 */
function ChartArea({
  theme,
  height,
  children,
}: {
  theme: ChartTheme
  height: number
  children: ReactElement<{ width?: number; height?: number }>
}) {
  if (theme === 'light') {
    return (
      <div className="fixed-chart">
        {cloneElement(children, { width: REPORT_CHART_WIDTH, height })}
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  )
}

const axisProps = (theme: ChartTheme) => ({
  stroke: THEMES[theme].axis,
  tick: { fill: THEMES[theme].axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
})

/**
 * Lines rather than areas: these axes do not start at zero, and a filled area
 * would make a small change in weight look like a large one.
 */
export function LineTrendChart({
  title,
  subtitle,
  data,
  xKey = 'label',
  series,
  unit,
  theme = 'dark',
  height = 200,
  emptyText = 'Add records to see this trend.',
}: ChartProps) {
  const t = THEMES[theme]
  const single = series.length === 1
  return (
    <ChartFrame title={title} subtitle={subtitle} theme={theme}>
      {!hasValues(data, series) ? (
        <Empty text={emptyText} height={height} theme={theme} />
      ) : (
        <>
          <ChartArea theme={theme} height={height}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke={t.grid} />
              <XAxis dataKey={xKey} {...axisProps(theme)} />
              <YAxis
                {...axisProps(theme)}
                width={52}
                domain={['auto', 'auto']}
                tickFormatter={tickFormatter(data, series)}
              />
              {theme === 'dark' && (
                <Tooltip
                  cursor={{ stroke: t.axis, strokeWidth: 1 }}
                  content={(props) => <ChartTooltip {...props} unit={unit} theme={theme} />}
                />
              )}
              {series.map((s, i) => {
                const color = single && theme === 'dark' ? t.accent : t.series[s.slot ?? i]
                return (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={color}
                    strokeWidth={2}
                    connectNulls
                    isAnimationActive={false}
                    dot={{ r: 4, fill: color, stroke: t.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: color, stroke: t.surface, strokeWidth: 2 }}
                  />
                )
              })}
            </LineChart>
          </ChartArea>
          <Legend series={series} theme={theme} mark="line" />
        </>
      )}
    </ChartFrame>
  )
}

/** Daily amounts. Multiple series must share a unit: scales are never mixed on one axis. */
export function DailyBarChart({
  title,
  subtitle,
  data,
  xKey = 'label',
  series,
  unit,
  theme = 'dark',
  height = 200,
  emptyText = 'Log a few days to see this chart.',
  target,
}: ChartProps) {
  const t = THEMES[theme]
  return (
    <ChartFrame title={title} subtitle={subtitle} theme={theme}>
      {!hasValues(data, series) ? (
        <Empty text={emptyText} height={height} theme={theme} />
      ) : (
        <>
          <ChartArea theme={theme} height={height}>
            <BarChart data={data} barGap={2} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke={t.grid} />
              <XAxis dataKey={xKey} {...axisProps(theme)} />
              <YAxis {...axisProps(theme)} width={52} tickFormatter={tickFormatter(data, series)} />
              {theme === 'dark' && (
                <Tooltip
                  cursor={{ fill: t.grid, fillOpacity: 0.4 }}
                  content={(props) => <ChartTooltip {...props} unit={unit} theme={theme} />}
                />
              )}
              {typeof target === 'number' && <ReferenceLine y={target} stroke={t.axis} />}
              {series.map((s, i) => {
                const color =
                  series.length === 1 && theme === 'dark' ? t.accent : t.series[s.slot ?? i]
                return (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    fill={color}
                    maxBarSize={24}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                )
              })}
            </BarChart>
          </ChartArea>
          <Legend series={series} theme={theme} mark="bar" />
        </>
      )}
    </ChartFrame>
  )
}
