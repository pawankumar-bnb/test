import { Check, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, Menu } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Ambient } from '@/components/brand/Ambient'
import { LogoMark, Wordmark } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/brand/ThemeToggle'
import { EASE_OUT } from '@/components/motion/motion'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { isoWeekNumber, shiftWeek, weekKeyOf, weekRangeLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useHub, useMember, useSelectedWeek } from '@/store/hub'
import { NAV_ITEMS, PRIMARY_MOBILE, SECONDARY_MOBILE } from './nav'

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex min-w-0 items-center gap-3" aria-label="Fit Track, home">
      <LogoMark className={cn('transition-transform duration-300 group-hover:-rotate-6', compact && 'size-9')} />
      <span className="min-w-0 leading-none">
        <Wordmark height={compact ? 18 : 22} />
        {!compact && (
          <span className="mt-1.5 block text-[11px] font-medium whitespace-nowrap text-muted-foreground">
            Performance Hub
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
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground',
        saveState === 'saved' && 'text-primary',
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
      <Button variant="ghost" size="icon-sm" aria-label="Previous week" onClick={() => setWeek(shiftWeek(week, -1))}>
        <ChevronLeft aria-hidden />
      </Button>
      <div className="min-w-0 px-1 text-center leading-tight" aria-live="polite">
        <div className="font-display text-base font-extrabold whitespace-nowrap">Week {isoWeekNumber(week)}</div>
        <div className="text-[11px] whitespace-nowrap text-muted-foreground">{weekRangeLabel(week)}</div>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Next week" onClick={() => setWeek(shiftWeek(week, 1))}>
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
  const initial = (member.name.trim()[0] ?? 'R').toUpperCase()
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 p-3 lg:block">
      <div className="glass-strong flex h-full flex-col rounded-3xl p-4">
        <div className="px-1 py-1">
          <Brand />
        </div>
        <nav aria-label="Main" className="mt-7 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-200',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 -z-10 rounded-xl bg-brand-gradient glow"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent/60 p-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-lg font-extrabold text-primary-foreground glow">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{member.name}</div>
            <div className="text-[11px] leading-tight text-muted-foreground">Built for the runway</div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

function MobileDock() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const inMore = SECONDARY_MOBILE.some((item) => item.to === pathname)

  const item = (active: boolean) =>
    cn(
      'relative flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-colors duration-200',
      active ? 'text-primary-foreground' : 'text-muted-foreground',
    )
  const pill = (
    <motion.span
      layoutId="dock-active"
      className="absolute inset-1 -z-10 rounded-xl bg-brand-gradient glow"
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    />
  )

  return (
    <>
      <nav
        aria-label="Main"
        className="no-print glass-strong fixed inset-x-3 z-40 flex rounded-2xl p-1 lg:hidden"
        style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {PRIMARY_MOBILE.map(({ to, label, short, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => item(isActive)}>
            {({ isActive }) => (
              <>
                {isActive && pill}
                <Icon className="size-5" aria-hidden />
                {short ?? label}
              </>
            )}
          </NavLink>
        ))}
        <button type="button" className={item(inMore)} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          {inMore && pill}
          <Menu className="size-5" aria-hidden />
          More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="glass-strong rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="font-display text-xl font-extrabold">More</SheetTitle>
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
                    'flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold',
                    isActive ? 'bg-brand-gradient text-primary-foreground glow' : 'hover:bg-accent',
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

/** Feeds the pointer position to the card under it, for the spotlight glow. */
function useSpotlight() {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const card = (event.target as Element | null)?.closest?.('.spotlight') as HTMLElement | null
      if (!card) return
      const box = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${event.clientX - box.left}px`)
      card.style.setProperty('--my', `${event.clientY - box.top}px`)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => document.removeEventListener('pointermove', onMove)
  }, [])
}

export function AppShell() {
  const { pathname } = useLocation()
  useSpotlight()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="print-reset relative flex min-h-dvh">
      <Ambient />
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="no-print sr-only z-50 rounded-md bg-brand-gradient px-3 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="print-reset flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-30 px-3 pt-3">
          <div className="glass-strong mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 rounded-2xl px-3 md:px-4">
            <div className="lg:hidden">
              <Brand compact />
            </div>
            <WeekSwitcher />
            <div className="flex items-center gap-1">
              <SaveStatus />
              <ThemeToggle className="lg:hidden" />
            </div>
          </div>
        </div>
        <main
          id="main"
          tabIndex={-1}
          className="print-reset mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-32 outline-none md:px-6 lg:pb-12"
        >
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
      <MobileDock />
    </div>
  )
}
