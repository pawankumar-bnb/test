import { useEffect, useState } from 'react'
import { storage } from '@/store/hub'
import { newId } from './factory'
import type { PhotoRef } from './types'

const MAX_PHOTO_BYTES = 25 * 1024 * 1024

export class PhotoError extends Error {}

/** The original file is kept untouched, so the full image is preserved. */
export async function savePhoto(file: File): Promise<PhotoRef> {
  if (!file.type.startsWith('image/')) throw new PhotoError('Please choose an image file.')
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError('Please choose an image under 25 MB.')
  try {
    const bitmap = await createImageBitmap(file)
    bitmap.close()
  } catch {
    throw new PhotoError(
      'This browser cannot display that image format. Please use a JPG, PNG or WEBP.',
    )
  }
  const ref: PhotoRef = { id: newId(), name: file.name, type: file.type, size: file.size }
  await storage.putPhoto(ref.id, file)
  return ref
}

export const deletePhoto = (ref: PhotoRef | undefined) =>
  ref ? storage.deletePhoto(ref.id) : Promise.resolve()

export function usePhotoUrl(id: string | undefined) {
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null)

  useEffect(() => {
    if (!id) return
    let objectUrl: string | null = null
    let cancelled = false
    void storage.getPhoto(id).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setLoaded({ id, url: objectUrl })
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  return id && loaded?.id === id ? loaded.url : null
}
