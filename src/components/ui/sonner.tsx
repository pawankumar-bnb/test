import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useResolvedTheme } from '@/lib/theme'

/**
 * Toasts sit over the header bar, where there are no fields. At the bottom they cover
 * inputs, and a click that lands on one sends focus back to the previous field, so
 * the next keystrokes go into the wrong box.
 */
export function Toaster(props: ToasterProps) {
  const theme = useResolvedTheme()
  return (
    <Sonner
      theme={theme}
      position="top-center"
      offset={12}
      mobileOffset={12}
      className="toaster group"
      toastOptions={{ className: 'glass-strong !rounded-2xl' }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--glass-border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
