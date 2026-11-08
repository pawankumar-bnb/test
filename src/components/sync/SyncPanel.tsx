import { Cloud, CloudAlert, CloudCheck, CloudOff, Copy, Eye, EyeOff, KeyRound, LoaderCircle, RefreshCw, Smartphone } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { confirmAction } from '@/components/shared/confirm'
import { Panel, SectionHeading } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  backupThisDevice,
  deviceHasData,
  linkThisDevice,
  syncErrorMessage,
  turnOffSync,
  turnOnSync,
} from '@/lib/sync/actions'
import { formatCode, normalizeCode } from '@/lib/sync/crypto'
import { syncNow, useSync } from '@/lib/sync/runtime'
import { cn } from '@/lib/utils'

const EXAMPLE = 'K7QF-M2XA-P9TR-W3HC-B6NE'

export function relativeTime(at: number, now = Date.now()) {
  const seconds = Math.round((now - at) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Re-renders now and then, so "2 min ago" stays true. */
function useNow(every = 30_000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return now
}

function StatusLine() {
  const { status, lastSyncedAt, error, photosLeft } = useSync()
  const now = useNow()
  const line = {
    off: { icon: Cloud, text: 'Sync is off', tone: '' },
    syncing: {
      icon: LoaderCircle,
      text: photosLeft > 0 ? `Uploading photos: ${photosLeft} left` : 'Syncing…',
      tone: 'text-primary',
    },
    synced: { icon: CloudCheck, text: `Synced${lastSyncedAt ? ` · ${relativeTime(lastSyncedAt, now)}` : ''}`, tone: 'text-success' },
    offline: {
      icon: CloudOff,
      text: "Offline. Changes are saved on this device and sync when you're back online.",
      tone: 'text-warning',
    },
    error: { icon: CloudAlert, text: error ?? 'Sync had a problem.', tone: 'text-destructive' },
  }[status]
  const Icon = line.icon
  return (
    <p role="status" className={cn('flex items-center gap-2 text-sm font-semibold', line.tone)}>
      <Icon className={cn('size-4 shrink-0', status === 'syncing' && 'animate-spin')} aria-hidden />
      {line.text}
    </p>
  )
}

function LinkedView({ code }: { code: string }) {
  const [shown, setShown] = useState(false)
  const pretty = formatCode(code)

  async function copy() {
    try {
      await navigator.clipboard.writeText(pretty)
      toast.success('Sync code copied.')
    } catch {
      setShown(true)
      toast('Select the code to copy it.')
    }
  }

  async function off() {
    const ok = await confirmAction({
      title: 'Turn off sync on this device?',
      description:
        'This device keeps its data but stops getting changes from your other devices. The synced copy and your other devices are not affected, and you can link again later with the code.',
      confirmLabel: 'Turn off sync',
    })
    if (ok) await turnOffSync()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusLine />
        <Button variant="outline" size="sm" onClick={syncNow}>
          <RefreshCw aria-hidden />
          Sync now
        </Button>
      </div>

      <div className="rounded-2xl border border-dashed border-primary/40 bg-accent/40 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <KeyRound className="size-3.5 text-primary" aria-hidden />
          Your sync code
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code
            data-sync-code={shown ? pretty : undefined}
            className="min-w-0 font-mono text-lg font-bold tracking-wider break-all select-all sm:text-xl"
            aria-label={shown ? `Sync code ${pretty.split('').join(' ')}` : 'Sync code, hidden'}
          >
            {shown ? pretty : pretty.replace(/[0-9A-Z]/g, '•')}
          </code>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
              {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              {shown ? 'Hide' : 'Show'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void copy()}>
              <Copy aria-hidden />
              Copy
            </Button>
          </div>
        </div>
        <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
          <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            On your other phone, laptop or browser, open Settings, choose <strong>I have a code</strong> and type this
            code. Anyone with it can see and change your data, so keep it private.
          </span>
        </p>
      </div>

      <div>
        <Button variant="ghost" onClick={() => void off()} className="-ml-2.5">
          Turn off sync on this device
        </Button>
      </div>
    </div>
  )
}

function UnlinkedView() {
  const [mode, setMode] = useState<'choose' | 'link'>('choose')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState<'on' | 'link' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const inputId = useId()

  async function on() {
    setBusy('on')
    setProblem(null)
    try {
      await turnOnSync()
    } catch (error) {
      setProblem(syncErrorMessage(error))
      setBusy(null)
    }
  }

  async function link(event: FormEvent) {
    event.preventDefault()
    setProblem(null)
    const code = normalizeCode(input)
    if (!code) {
      setProblem(`A sync code has 20 letters and numbers, like ${EXAMPLE}.`)
      return
    }
    if (deviceHasData()) {
      const ok = await confirmAction({
        title: "Replace this device's data with the synced copy?",
        description:
          'This device will show exactly what is synced to the code, and what is on it now is replaced. A backup file of this device downloads first, just in case.',
        confirmLabel: 'Download backup and link',
      })
      if (!ok) return
    }
    setBusy('link')
    try {
      if (deviceHasData()) await backupThisDevice()
      const result = await linkThisDevice(code)
      if (result === 'not_found') {
        setProblem('No synced data uses that code. Check it on the device where sync is on.')
        setBusy(null)
      }
    } catch (error) {
      setProblem(syncErrorMessage(error))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        See the same data on your phone, laptop and any browser. Turn sync on here, then enter the code on your other
        devices. Everything is encrypted with your code before it leaves the device, so only someone with the code can
        read it.
      </p>

      {mode === 'choose' ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void on()} disabled={busy !== null}>
            {busy === 'on' ? <LoaderCircle className="animate-spin" aria-hidden /> : <Cloud aria-hidden />}
            {busy === 'on' ? 'Turning on…' : 'Turn on sync'}
          </Button>
          <Button variant="outline" onClick={() => setMode('link')} disabled={busy !== null}>
            <KeyRound aria-hidden />I have a code
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void link(e)} className="flex flex-col gap-2">
          <Label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
            Sync code from your other device
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={inputId}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setProblem(null)
              }}
              placeholder={EXAMPLE}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              aria-invalid={problem ? true : undefined}
              className="h-11 max-w-sm flex-1 basis-64 font-mono tracking-wider uppercase"
            />
            <Button type="submit" disabled={busy !== null || !input.trim()} className="h-11">
              {busy === 'link' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              {busy === 'link' ? 'Linking…' : 'Link this device'}
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setMode('choose')} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {problem && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
    </div>
  )
}

export function SyncPanel() {
  const { available, code } = useSync()
  return (
    <section className="mb-8">
      <SectionHeading title="Sync across devices" />
      <Panel>
        {!available ? (
          <p className="text-sm text-muted-foreground">Sync is not set up on this copy of the site.</p>
        ) : code ? (
          <LinkedView code={code} />
        ) : (
          <UnlinkedView />
        )}
      </Panel>
    </section>
  )
}
