import { flushSync } from 'react-dom'
import { create } from 'zustand'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const KEY = 'fittrack-theme'
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#e9f4ec', dark: '#04100a' }

const media =
  typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

const resolve = (preference: ThemePreference): ResolvedTheme =>
  preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference

function apply(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', THEME_COLOR[theme])
}

interface ThemeStore {
  preference: ThemePreference
  resolved: ResolvedTheme
  /** `from` is the point the new theme spreads out from, usually the button pressed. */
  setPreference: (preference: ThemePreference, from?: { x: number; y: number }) => void
}

export const useTheme = create<ThemeStore>((set, get) => {
  const initial = readPreference()
  return {
    preference: initial,
    resolved: resolve(initial),
    setPreference(preference, from) {
      try {
        localStorage.setItem(KEY, preference)
      } catch {
        // Not saved; the choice still applies for this visit.
      }
      const next = resolve(preference)
      const commit = () => {
        apply(next)
        set({ preference, resolved: next })
      }

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!from || reduced || next === get().resolved || !document.startViewTransition) {
        commit()
        return
      }

      const radius = Math.hypot(
        Math.max(from.x, window.innerWidth - from.x),
        Math.max(from.y, window.innerHeight - from.y),
      )
      const transition = document.startViewTransition(() => flushSync(commit))
      void transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${from.x}px ${from.y}px)`,
              `circle(${radius}px at ${from.x}px ${from.y}px)`,
            ],
          },
          {
            duration: 650,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
    },
  }
})

// Follow the device when the preference is "system".
media?.addEventListener('change', () => {
  const { preference } = useTheme.getState()
  if (preference !== 'system') return
  const resolved = resolve('system')
  apply(resolved)
  useTheme.setState({ resolved })
})

export const useResolvedTheme = () => useTheme((s) => s.resolved)
