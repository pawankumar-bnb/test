import { backupFileName, createBackupBlob } from './backup'
import type { StorageAdapter } from './storage/adapter'
import type { HubDoc } from './types'

/** Saves a backup file of everything, photos included. Returns how many photos were missing. */
export async function downloadBackup(doc: HubDoc, storage: StorageAdapter) {
  const { blob, missing } = await createBackupBlob(doc, storage)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFileName()
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return missing
}
