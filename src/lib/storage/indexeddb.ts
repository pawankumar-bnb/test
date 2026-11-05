import { type IDBPDatabase, openDB } from 'idb'
import type { HubDoc } from '../types'
import type { StorageAdapter } from './adapter'

const DB_NAME = 'rafey-performance-hub'
const DOC_KEY = 'doc'

let connection: Promise<IDBPDatabase> | null = null

function db() {
  connection ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('kv')
      database.createObjectStore('photos')
    },
  })
  return connection
}

export const indexedDbAdapter: StorageAdapter = {
  async loadDoc() {
    return (await db()).get('kv', DOC_KEY) as Promise<HubDoc | undefined>
  },
  async saveDoc(doc) {
    await (await db()).put('kv', doc, DOC_KEY)
  },
  async putPhoto(id, blob) {
    await (await db()).put('photos', blob, id)
  },
  async getPhoto(id) {
    return (await db()).get('photos', id) as Promise<Blob | undefined>
  },
  async deletePhoto(id) {
    await (await db()).delete('photos', id)
  },
  async listPhotoIds() {
    return (await (await db()).getAllKeys('photos')) as string[]
  },
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage() {
  try {
    if (await navigator.storage?.persisted?.()) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export async function storageEstimate() {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) ?? {}
    return { usage, quota }
  } catch {
    return { usage: 0, quota: 0 }
  }
}
