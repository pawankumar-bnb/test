import { animate, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react'
import { formatNumber } from '@/lib/metrics'

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Fades and lifts content in as it scrolls into view, with an optional stagger. */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: ReactNode
  index?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  )
}

/** Counts up to a number. Shows the final value at once when motion is reduced. */
export function CountUp({
  value,
  format = (n: number) => formatNumber(n, 0),
  duration = 1,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const reduced = useReducedMotion()
  const formatRef = useRef(format)

  useLayoutEffect(() => {
    formatRef.current = format
  })

  useEffect(() => {
    const node = ref.current
    if (!node || reduced) return
    const controls = animate(shown.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v
        node.textContent = formatRef.current(v)
      },
    })
    return () => controls.stop()
  }, [value, duration, reduced])

  // While animating, the text is written directly; rendering a constant keeps React from overwriting it.
  return <span ref={ref}>{reduced ? format(value) : format(0)}</span>
}
