import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Toasts sit over the header bar, where there are no fields. At the bottom they cover
 * inputs, and a click that lands on one sends focus back to the previous field, so
 * the next keystrokes go into the wrong box.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      offset={8}
      mobileOffset={8}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
