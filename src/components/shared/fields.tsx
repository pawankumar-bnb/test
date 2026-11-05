import { useId, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/** Keeps digits and one decimal point, so "7." survives while typing 7.5. */
export function sanitizeNumber(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '')
}

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: ReactNode
  unit?: string
  className?: string
  numeric?: boolean
  type?: string
  disabled?: boolean
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  unit,
  className,
  numeric,
  type = 'text',
  disabled,
}: FieldProps) {
  const id = useId()
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          inputMode={numeric ? 'decimal' : undefined}
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(numeric ? sanitizeNumber(e.target.value) : e.target.value)}
          className={cn('h-11 tabular-nums', unit && 'pr-12')}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: Pick<FieldProps, 'label' | 'value' | 'onChange' | 'placeholder' | 'className'>) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-24"
      />
    </div>
  )
}

/** A label-less input for dense rows. The accessible name comes from `label`. */
export function CellInput({
  label,
  value,
  onChange,
  numeric,
  className,
  ...rest
}: {
  label: string
  value: string
  onChange: (value: string) => void
  numeric?: boolean
} & Omit<ComponentProps<typeof Input>, 'onChange' | 'value'>) {
  return (
    <Input
      aria-label={label}
      autoComplete="off"
      inputMode={numeric ? 'decimal' : undefined}
      value={value}
      onChange={(e) => onChange(numeric ? sanitizeNumber(e.target.value) : e.target.value)}
      className={cn('h-11 tabular-nums md:h-10', className)}
      {...rest}
    />
  )
}
