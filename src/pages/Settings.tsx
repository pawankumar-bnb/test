import { Check, Download, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { confirmAction } from '@/components/shared/confirm'
import { Field } from '@/components/shared/fields'
import { PageHeader, Panel, SectionHeading } from '@/components/shared/page'
import { Segmented } from '@/components/shared/Segmented'
import { Button } from '@/components/ui/button'
import { applyBackup, backupFileName, createBackupBlob, memberPhotoIds, parseBackup } from '@/lib/backup'
import { formatDate } from '@/lib/dates'
import { blankMember } from '@/lib/factory'
import { storageEstimate } from '@/lib/storage/indexeddb'
import { type ThemePreference, useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { mutate, storage, useHub, useMember } from '@/store/hub'

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function Profile() {
  const member = useMember()
  const set = (key: 'name' | 'age' | 'weight' | 'bf', value: string) =>
    mutate((m) => {
      m[key] = value
    })
  return (
    <section>
      <SectionHeading title="Profile" description="Weight and body fat here are your starting point before any Physique record." />
      <Panel className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Field label="Name" value={member.name} onChange={(v) => set('name', v)} />
        <Field label="Age" numeric value={member.age} onChange={(v) => set('age', v)} />
        <Field label="Starting weight" numeric unit="kg" value={member.weight} onChange={(v) => set('weight', v)} />
        <Field label="Starting body fat" numeric unit="%" value={member.bf} onChange={(v) => set('bf', v)} />
      </Panel>
    </section>
  )
}

function Appearance() {
  const preference = useTheme((s) => s.preference)
  const setPreference = useTheme((s) => s.setPreference)
  return (
    <section className="mt-8">
      <SectionHeading title="Appearance" description="System follows your phone or computer's light and dark setting." />
      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold">Theme</span>
        <Segmented<ThemePreference>
          label="Theme"
          value={preference}
          onChange={(value) => setPreference(value)}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Panel>
    </section>
  )
}

function Members() {
  const doc = useHub((s) => s.doc)
  const [name, setName] = useState('')
  const members = Object.values(doc.members)

  function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    const member = blankMember(trimmed)
    mutate((_, draft) => {
      draft.members[member.id] = member
      draft.activeId = member.id
    })
    setName('')
    toast.success(`Switched to ${trimmed}`)
  }

  async function remove(id: string) {
    const member = doc.members[id]
    const ok = await confirmAction({
      title: `Delete ${member.name}'s profile?`,
      description: 'All of their logs, goals and photos on this device will be removed. This cannot be undone.',
      confirmLabel: 'Delete profile',
    })
    if (!ok) return
    const photoIds = memberPhotoIds(member)
    mutate((_, draft) => {
      delete draft.members[id]
      if (draft.activeId === id) draft.activeId = Object.keys(draft.members)[0]
    })
    await Promise.all(photoIds.map((photoId) => storage.deletePhoto(photoId)))
  }

  return (
    <section className="mt-8">
      <SectionHeading title="Members" description="Each profile keeps its own logs, goals and supplement columns." />
      <Panel>
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const active = member.id === doc.activeId
            return (
              <li
                key={member.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border p-3',
                  active ? 'border-primary/50 bg-accent glow' : 'border-border',
                )}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{member.name || 'Unnamed'}</div>
                  <div className="text-xs text-muted-foreground">{active ? 'Open now' : `${Object.keys(member.weeks).length} weeks logged`}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!active && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => mutate((_, draft) => void (draft.activeId = member.id))}
                    >
                      Open
                    </Button>
                  )}
                  {members.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${member.name}`}
                      onClick={() => void remove(member.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Field label="New member name" className="flex-1" value={name} onChange={setName} />
          <Button type="submit" variant="outline" disabled={!name.trim()} className="h-11">
            <Plus aria-hidden />
            Add
          </Button>
        </form>
      </Panel>
    </section>
  )
}

function DataPanel() {
  const doc = useHub((s) => s.doc)
  const persistent = useHub((s) => s.persistent)
  const replaceDoc = useHub((s) => s.replaceDoc)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [usage, setUsage] = useState<number | null>(null)

  useEffect(() => {
    void storageEstimate().then(({ usage: used }) => setUsage(used))
  }, [doc])

  async function download() {
    setBusy('backup')
    try {
      const { blob, missing } = await createBackupBlob(doc, storage)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName()
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      mutate((_, draft) => void (draft.lastBackupAt = new Date().toISOString()))
      if (missing) toast.warning(`Backup created, but ${missing} photo(s) could not be found.`)
      else toast.success('Backup downloaded. Keep the file somewhere safe.')
    } catch (error) {
      console.error(error)
      toast.error('The backup could not be created.')
    } finally {
      setBusy(null)
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return
    setBusy('restore')
    try {
      const parsed = parseBackup(await file.text())
      const names = Object.values(parsed.doc.members).map((m) => m.name).join(', ')
      const ok = await confirmAction({
        title: 'Replace everything with this backup?',
        description: `This loads ${names} from ${parsed.source === 'v14' ? 'the old tracker' : 'a hub backup'}${parsed.exportedAt ? ` made on ${formatDate(parsed.exportedAt)}` : ''}, along with ${parsed.photos.length} photo(s). What is on this device now will be replaced.`,
        confirmLabel: 'Replace my data',
      })
      if (!ok) return
      await applyBackup(parsed, storage)
      replaceDoc(parsed.doc)
      toast.success('Backup restored.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That backup could not be restored.')
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <section className="mt-8">
      <SectionHeading title="Your data" />
      <Panel className="flex flex-col gap-4">
        <div className="flex gap-3 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-muted-foreground">
            Everything saves automatically in this browser on this device. It is never uploaded, so
            nobody else who opens the link can see it, and it does not sync to your other devices.
            Use a backup to move data or keep it safe.
          </p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Last backup</dt>
            <dd className="font-medium">
              {doc.lastBackupAt ? formatDate(new Date(doc.lastBackupAt)) : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Space used</dt>
            <dd className="font-medium">{usage === null ? '—' : formatBytes(usage)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Protected from browser cleanup</dt>
            <dd className="flex items-center gap-1 font-medium">
              {persistent ? (
                <>
                  <Check className="size-4 text-primary" aria-hidden /> Yes
                </>
              ) : (
                'Not yet, keep regular backups'
              )}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void download()} disabled={busy !== null}>
            <Download aria-hidden />
            {busy === 'backup' ? 'Preparing…' : 'Download backup'}
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy !== null}>
            <Upload aria-hidden />
            {busy === 'restore' ? 'Restoring…' : 'Restore backup'}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Choose a backup file"
            className="hidden"
            onChange={(e) => void restore(e.target.files?.[0])}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Restore also accepts backups from the old single-file tracker (v14).
        </p>
      </Panel>
    </section>
  )
}

export function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Profile & data" />
      <Profile />
      <Appearance />
      <Members />
      <DataPanel />
    </>
  )
}
