import type { HubDoc } from '../types'

/**
 * Everything the app needs from persistence. Today this is the browser's IndexedDB.
 * When login arrives, a cloud adapter implements this same interface and the rest
 * of the app stays untouched.
 */
export interface StorageAdapter {
  loadDoc(): Promise<HubDoc | undefined>
  saveDoc(doc: HubDoc): Promise<void>
  putPhoto(id: string, blob: Blob): Promise<void>
  getPhoto(id: string): Promise<Blob | undefined>
  deletePhoto(id: string): Promise<void>
  listPhotoIds(): Promise<string[]>
}

/** Small values this device keeps for itself, such as its sync settings. */
export interface KeyValueStore {
  getValue<T>(key: string): Promise<T | undefined>
  setValue(key: string, value: unknown): Promise<void>
}
