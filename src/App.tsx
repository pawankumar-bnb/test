import { useEffect } from 'react'
import { RouterProvider, createHashRouter, useRouteError } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ConfirmHost } from '@/components/shared/confirm'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { useHub } from '@/store/hub'

/** Shown instead of a blank screen if a page throws. Saved data is unaffected. */
function PageError() {
  const error = useRouteError()
  console.error(error)
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-6 text-center" role="alert">
      <div className="max-w-sm">
        <h1 className="font-display text-3xl font-bold uppercase">This page hit a problem</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your saved data is safe. Reload to try again.
        </p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  )
}

const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

// Hash routes need no server rewrite rules, so deep links work on GitHub Pages.
const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      {
        errorElement: <PageError />,
        children: [
          { index: true, ...page(() => import('@/pages/Dashboard'), 'Dashboard') },
          { path: 'goals', ...page(() => import('@/pages/Goals'), 'GoalsPage') },
          { path: 'fitness', ...page(() => import('@/pages/Fitness'), 'FitnessPage') },
          { path: 'fitness-test', ...page(() => import('@/pages/FitnessTest'), 'FitnessTestPage') },
          { path: 'nutrition', ...page(() => import('@/pages/Nutrition'), 'NutritionPage') },
          { path: 'physique', ...page(() => import('@/pages/Physique'), 'PhysiquePage') },
          { path: 'instagram', ...page(() => import('@/pages/Instagram'), 'InstagramPage') },
          { path: 'report', ...page(() => import('@/pages/Report'), 'ReportPage') },
          { path: 'settings', ...page(() => import('@/pages/Settings'), 'SettingsPage') },
          { path: '*', ...page(() => import('@/pages/Dashboard'), 'Dashboard') },
        ],
      },
    ],
  },
])

export function App() {
  const status = useHub((s) => s.status)
  const init = useHub((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <span className="font-display text-xl tracking-widest text-muted-foreground uppercase">
          Loading your hub
        </span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center" role="alert">
        <div className="max-w-sm">
          <h1 className="font-display text-3xl font-bold uppercase">Storage unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This browser is blocking local storage, so nothing can be saved here. Private browsing
            windows often do this. Please open the hub in a normal window.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <ConfirmHost />
      <Toaster />
    </>
  )
}
