import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="eyebrow inline-flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-[1.05] font-black tracking-tight md:text-5xl">
          <span className="text-gradient">{title}</span>
        </h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-xl leading-tight font-extrabold">
          <span aria-hidden className="h-5 w-1.5 rounded-full bg-brand-gradient glow" />
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass spotlight rounded-2xl p-4 md:p-5', className)} {...rest}>
      {children}
    </div>
  )
}

export function StatTile({
  label,
  value,
  note,
  className,
}: {
  label: string
  value: ReactNode
  note?: string
  className?: string
}) {
  return (
    <div className={cn('glass spotlight lift rounded-2xl p-4', className)}>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-display text-3xl leading-none font-black tabular-nums">{value}</div>
      {note && <div className="mt-2 text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="glass rounded-2xl border-dashed px-6 py-9 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
