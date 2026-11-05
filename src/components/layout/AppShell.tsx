import { Check, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { isoWeekNumber, shiftWeek, weekKeyOf, weekRangeLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useHub, useMember, useSelectedWeek } from '@/store/hub'
import { NAV_ITEMS, PRIMARY_MOBILE, SECONDARY_MOBILE } from './nav'

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Rafey Performance Hub, home">
      <img src="./favicon.svg" alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg" />
      <span className="min-w-0 leading-none">
        <span className="block truncate font-display text-lg font-bold tracking-wider uppercase">
          Rafey
        </span>
        {!compact && (
          <span className="block truncate text-[11px] tracking-wide text-muted-foreground">
            Personal Performance Hub
          </span>
        )}
      </span>
    </Link>
  )
}

function SaveStatus() {
  const saveState = useHub((s) => s.saveState)
  const content = {
    saved: { icon: <Check className="size-3.5" aria-hidden />, text: 'Saved' },
    saving: { icon: <LoaderCircle className="size-3.5 animate-spin" aria-hidden />, text: 'Saving' },
    error: { icon: <CircleAlert className="size-3.5" aria-hidden />, text: 'Not saved' },
  }[saveState]
  return (
    <span
      role="status"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground',
        saveState === 'error' && 'text-destructive',
      )}
    >
      {content.icon}
      <span className="hidden sm:inline">{content.text}</span>
    </span>
  )
}

function WeekSwitcher() {
  const week = useSelectedWeek()
  const setWeek = useHub((s) => s.setWeek)
  const current = weekKeyOf()
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous week"
        onClick={() => setWeek(shiftWeek(week, -1))}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <div className="min-w-0 px-1 text-center leading-tight" aria-live="polite">
        <div className="font-display text-base font-semibold tracking-wide whitespace-nowrap uppercase">
          Week {isoWeekNumber(week)}
        </div>
        <div className="text-[11px] whitespace-nowrap text-muted-foreground">{weekRangeLabel(week)}</div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next week"
        onClick={() => setWeek(shiftWeek(week, 1))}
      >
        <ChevronRight aria-hidden />
      </Button>
      {week !== current && (
        <Button variant="outline" size="sm" onClick={() => setWeek(current)} className="ml-1">
          This week
        </Button>
      )}
    </div>
  )
}

function Sidebar() {
  const member = useMember()
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card/60 p-4 lg:flex">
      <div className="px-2 py-1">
        <Brand />
      </div>
      <nav aria-label="Main" className="mt-6 flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 border-t border-border px-2 pt-3">
        <div className="truncate text-sm font-semibold">{member.name}</div>
        <div className="text-xs text-muted-foreground">Built for the runway. Driven by discipline.</div>
      </div>
    </aside>
  )
}

function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const inMore = SECONDARY_MOBILE.some((item) => item.to === pathname)
  const itemClass = (active: boolean) =>
    cn(
      'flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150',
      active ? 'text-primary' : 'text-muted-foreground',
    )

  return (
    <>
      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {PRIMARY_MOBILE.map(({ to, label, short, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => itemClass(isActive)}>
            <Icon className="size-5" aria-hidden />
            {short ?? label}
          </NavLink>
        ))}
        <button
          type="button"
          className={itemClass(inMore)}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <Menu className="size-5" aria-hidden />
          More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="font-display text-xl uppercase">More</SheetTitle>
            <SheetDescription className="sr-only">Other sections of the hub</SheetDescription>
          </SheetHeader>
          <nav aria-label="More sections" className="grid gap-1 px-4 pb-4">
            {SECONDARY_MOBILE.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                    isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function AppShell() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="print-reset flex min-h-dvh">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="no-print sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="print-reset flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 md:px-6">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <WeekSwitcher />
            <SaveStatus />
          </div>
        </div>
        <main
          id="main"
          tabIndex={-1}
          key={pathname}
          className="page-enter print-reset mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 outline-none md:px-6 lg:pb-12"
        >
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
