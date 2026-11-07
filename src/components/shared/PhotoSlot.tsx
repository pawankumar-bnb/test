import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { PhotoError, deletePhoto, savePhoto, usePhotoUrl } from '@/lib/photos'
import type { PhotoRef } from '@/lib/types'
import { cn } from '@/lib/utils'
import { confirmAction } from './confirm'

export function PhotoSlot({
  label,
  photo,
  onChange,
  aspect = 'aspect-[3/4]',
}: {
  label: string
  photo: PhotoRef | undefined
  onChange: (photo: PhotoRef | undefined) => void
  aspect?: string
}) {
  const url = usePhotoUrl(photo?.id)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  async function upload(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const next = await savePhoto(file)
      onChange(next)
      await deletePhoto(photo)
      toast.success(`${label} saved`)
    } catch (error) {
      toast.error(error instanceof PhotoError ? error.message : 'That image could not be saved.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    const ok = await confirmAction({
      title: `Delete ${label.toLowerCase()}?`,
      description: 'This photo will be removed from this device. This cannot be undone.',
      confirmLabel: 'Delete photo',
    })
    if (!ok) return
    onChange(undefined)
    await deletePhoto(photo)
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-field backdrop-blur-sm transition-colors duration-200 hover:border-primary/50',
          photo ? 'border-border' : 'border-dashed border-border',
          aspect,
        )}
      >
        {photo && url ? (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label={`View ${label.toLowerCase()} full size`}
            className="size-full cursor-zoom-in"
          >
            <img src={url} alt={label} className="size-full object-contain" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex size-full cursor-pointer flex-col items-center justify-center gap-2 p-3 text-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {busy ? (
              <LoaderCircle className="size-6 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-6" aria-hidden />
            )}
            <span>{busy ? 'Saving…' : 'Upload photo'}</span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{label}</span>
        {photo && (
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => input.current?.click()}
              disabled={busy}
              aria-label={`Replace ${label.toLowerCase()}`}
            >
              Replace
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={remove}
              aria-label={`Delete ${label.toLowerCase()}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Choose ${label.toLowerCase()}`}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{label}</DialogTitle>
          {url && <img src={url} alt={label} className="max-h-[75vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
