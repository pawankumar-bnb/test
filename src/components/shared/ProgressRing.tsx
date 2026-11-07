import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { CountUp, EASE_OUT } from '@/components/motion/motion'

/** Circular meter for a single headline percentage, drawn in the brand gradient with a soft glow. */
export function ProgressRing({
  value,
  size = 132,
  stroke = 11,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  label: string
}) {
  const id = useId()
  const reduced = useReducedMotion()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  const offset = circumference * (1 - clamped / 100)

  return (
    <div role="img" aria-label={`${label}: ${value}%`} className="relative shrink-0" style={{ width: size, height: size }}>
      <div aria-hidden className="absolute inset-[18%] rounded-full bg-primary/25 blur-2xl" />
      <svg width={size} height={size} className="relative -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bef264" />
            <stop offset="55%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${id}-g)`}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: EASE_OUT }}
          style={{ filter: 'drop-shadow(0 0 6px rgb(var(--glow) / 0.65))' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-4xl leading-none font-black tabular-nums">
          <CountUp value={value} />%
        </span>
      </div>
    </div>
  )
}
