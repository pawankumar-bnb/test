import { downloadBackup } from '../download-backup'
import type { HubDoc } from '../types'
import { saveNow, storage, useHub } from '@/store/hub'
import { SyncError } from './api'
import { reloadEverywhere, syncEngine } from './runtime'

const host = {
  getDoc: () => useHub.getState().doc,
  applyDoc: (doc: HubDoc) => useHub.getState().replaceDoc(doc),
}

export function syncErrorMessage(error: unknown) {
  if (error instanceof SyncError) {
    if (error.kind === 'offline') return 'No connection to the sync service. Check the internet and try again.'
    if (error.kind === 'full') return 'The sync service already holds the most codes it allows.'
  }
  console.error(error)
  return 'Something went wrong while setting up sync. Please try again.'
}

/** First device: creates the code. Everything here uploads after the page reloads. */
export async function turnOnSync() {
  await saveNow()
  await syncEngine(host).create()
  reloadEverywhere('Sync is on. Your data is uploading now.', false)
}

/** True when this device holds anything worth keeping a copy of before it is replaced. */
export function deviceHasData() {
  return Object.values(useHub.getState().doc.members).some((m) => Object.keys(m.weeks).length || m.fitnessTests.length)
}

/** Saves a backup of this device, then gives the browser a moment to take the file before the page reloads. */
export async function backupThisDevice() {
  await downloadBackup(useHub.getState().doc, storage)
  await new Promise((resolve) => setTimeout(resolve, 1500))
}

/** Another device: replaces what is here with the synced copy. */
export async function linkThisDevice(code: string) {
  await saveNow()
  const result = await syncEngine(host).link(code)
  if (result !== 'linked') return result
  await saveNow()
  reloadEverywhere('This device is synced. It now shows the same data as your other devices.', true)
  return result
}

export async function turnOffSync() {
  await syncEngine(host).unlink()
  reloadEverywhere('Sync is off on this device. Its data stays here.', false)
}
