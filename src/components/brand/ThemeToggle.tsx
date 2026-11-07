import { Moon, Sun } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const resolved = useTheme((s) => s.resolved)
  const setPreference = useTheme((s) => s.setPreference)
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect()
        setPreference(next, { x: box.left + box.width / 2, y: box.top + box.height / 2 })
      }}
      className={cn(
        'relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl text-foreground transition-colors duration-200 hover:bg-accent',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolved}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex"
        >
          {resolved === 'dark' ? <Moon className="size-5" aria-hidden /> : <Sun className="size-5" aria-hidden />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
