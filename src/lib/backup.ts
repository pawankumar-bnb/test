import { LEGACY_STORAGE_KEY, migrateV14 } from './migrate-v14'
import type { StorageAdapter } from './storage/adapter'
import type { ContentSlot, HubDoc, Member, PhotoRef } from './types'

const APP_NAME = 'Rafey Personal Performance Hub'
const BACKUP_VERSION = 2

interface BackupPhoto {
  id: string
  dataUrl: string
}

export interface ParsedBackup {
  doc: HubDoc
  photos: BackupPhoto[]
  source: 'v15' | 'v14'
  exportedAt: Date | null
}

function memberPhotoRefs(member: Member): PhotoRef[] {
  const refs: PhotoRef[] = []
  for (const week of Object.values(member.weeks)) {
    refs.push(...(Object.values(week.photos) as PhotoRef[]))
    for (const slot of Object.values(week.content) as ContentSlot[]) {
      if (slot.photo) refs.push(slot.photo)
    }
  }
  for (const test of member.fitnessTests) refs.push(...(Object.values(test.photos) as PhotoRef[]))
  return refs
}

export const memberPhotoIds = (member: Member) => memberPhotoRefs(member).map((ref) => ref.id)

export const docPhotoIds = (doc: HubDoc) =>
  new Set(Object.values(doc.members).flatMap(memberPhotoIds))

export async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

export async function dataUrlToBlob(dataUrl: string) {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('A photo in this backup is damaged.')
  const meta = dataUrl.slice(5, comma)
  const type = meta.split(';')[0] || 'application/octet-stream'
  const body = dataUrl.slice(comma + 1)
  if (!meta.includes('base64')) return new Blob([decodeURIComponent(body)], { type })
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** Built from parts so a large photo library never becomes one giant string. */
export async function createBackupBlob(doc: HubDoc, storage: StorageAdapter) {
  const parts: BlobPart[] = [
    `{"app":${JSON.stringify(APP_NAME)},"backupVersion":${BACKUP_VERSION},`,
    `"exportedAt":${JSON.stringify(new Date().toISOString())},`,
    `"doc":${JSON.stringify(doc)},"photos":[`,
  ]
  let first = true
  let missing = 0
  for (const id of docPhotoIds(doc)) {
    const blob = await storage.getPhoto(id)
    if (!blob) {
      missing++
      continue
    }
    parts.push(`${first ? '' : ','}${JSON.stringify({ id, dataUrl: await blobToDataUrl(blob) })}`)
    first = false
  }
  parts.push(']}')
  return { blob: new Blob(parts, { type: 'application/json' }), missing }
}

export function backupFileName(now = new Date()) {
  const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-')
  return `RAFEY_HUB_BACKUP_${stamp}.json`
}

function isDoc(value: unknown): value is HubDoc {
  const doc = value as HubDoc | null
  return Boolean(doc && doc.schema === 2 && doc.members && doc.members[doc.activeId])
}

/** Accepts backups from this site and from the v14 single-file tracker. */
export function parseBackup(text: string): ParsedBackup {
  let payload: any // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('This file is not a valid backup: it could not be read as JSON.')
  }

  const exportedAt = payload?.exportedAt ? new Date(payload.exportedAt) : null
  const validDate = exportedAt && !Number.isNaN(exportedAt.getTime()) ? exportedAt : null

  if (isDoc(payload?.doc)) {
    const photos = Array.isArray(payload.photos) ? (payload.photos as BackupPhoto[]) : []
    return { doc: payload.doc, photos, source: 'v15', exportedAt: validDate }
  }

  const legacyText = payload?.localStorage?.[LEGACY_STORAGE_KEY]
  if (typeof legacyText === 'string') {
    let legacy
    try {
      legacy = JSON.parse(legacyText)
    } catch {
      throw new Error('The tracker data inside this backup is damaged.')
    }
    const { doc, photos } = migrateV14(legacy, validDate ?? new Date())
    return { doc, photos, source: 'v14', exportedAt: validDate }
  }

  throw new Error('This is not a Rafey Hub backup file.')
}

/** Photos are written first and old ones removed last, so a failure leaves current data intact. */
export async function applyBackup(parsed: ParsedBackup, storage: StorageAdapter) {
  const before = await storage.listPhotoIds()
  const incoming = new Set<string>()
  for (const photo of parsed.photos) {
    await storage.putPhoto(photo.id, await dataUrlToBlob(photo.dataUrl))
    incoming.add(photo.id)
  }
  await storage.saveDoc(parsed.doc)
  for (const id of before) {
    if (!incoming.has(id)) await storage.deletePhoto(id)
  }
}
