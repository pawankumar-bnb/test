import markUrl from '@/assets/logo-mark.png'
import wordmarkUrl from '@/assets/logo-wordmark.png'
import { cn } from '@/lib/utils'

/** Aspect ratio of the wordmark stencil, so its box always fits the letters. */
const WORDMARK_RATIO = 569 / 120

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={markUrl}
      alt=""
      width={40}
      height={40}
      draggable={false}
      className={cn('size-10 shrink-0 rounded-[11px] shadow-[0_6px_18px_-6px_rgb(var(--glow)/0.7)]', className)}
    />
  )
}

/** The “Fit Track” lettering, coloured per theme through a stencil. */
export function Wordmark({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Fit Track"
      className={cn('wordmark', className)}
      style={{
        height,
        width: Math.round(height * WORDMARK_RATIO),
        WebkitMaskImage: `url(${wordmarkUrl})`,
        maskImage: `url(${wordmarkUrl})`,
      }}
    />
  )
}

export { markUrl, wordmarkUrl }
