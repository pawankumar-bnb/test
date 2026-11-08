/**
 * The sync protocol, shared by the Worker and the site. Kept free of Cloudflare and
 * browser types so both sides, and the tests, can import it.
 */

/** A record as the server holds it. `data` is encrypted on the device, base64. */
export interface RemoteRecord {
  key: string
  version: number
  seq: number
  deleted: boolean
  data: string | null
}

export interface PullResponse {
  records: RemoteRecord[]
  /** Pass back as `since` next time. */
  seq: number
  /** More records are waiting; pull again straight away. */
  more: boolean
}

export interface PushChange {
  key: string
  /** The version this change was made on top of; 0 for a record the device has never seen. */
  base: number
  deleted: boolean
  data: string | null
}

export type PushResult =
  | { key: string; ok: true; version: number }
  | { key: string; ok: false; current: RemoteRecord }

export interface PushResponse {
  results: PushResult[]
}

/** D1 on the free plan allows 50 queries per request, so pushes go in batches. */
export const MAX_PUSH_RECORDS = 40
export const MAX_PUSH_BYTES = 900_000
export const PULL_PAGE = 400
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024

export const KEY_PATTERN = /^[a-z]+(:[A-Za-z0-9._%~-]+){0,3}$/
export const PHOTO_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** What the server keeps; D1 in production, memory in tests. */
export interface VaultStore {
  vaultExists(vault: string): Promise<boolean>
  /** Creates the vault unless the server already holds `limit` vaults. */
  createVault(vault: string, limit: number): Promise<'created' | 'exists' | 'full'>
  pull(vault: string, since: number, limit: number): Promise<PullResponse>
  push(vault: string, changes: PushChange[]): Promise<PushResponse>
}

export interface PhotoStore {
  put(key: string, bytes: ArrayBuffer): Promise<void>
  get(key: string): Promise<ArrayBuffer | null>
  delete(key: string): Promise<void>
}

/** A reference implementation; the D1 store must behave the same way. */
export function memoryVaultStore(): VaultStore & { dump(vault: string): RemoteRecord[] } {
  const vaults = new Map<string, { seq: number; records: Map<string, RemoteRecord> }>()
  return {
    dump: (vault) => [...(vaults.get(vault)?.records.values() ?? [])],
    async vaultExists(vault) {
      return vaults.has(vault)
    },
    async createVault(vault, limit) {
      if (vaults.has(vault)) return 'exists'
      if (vaults.size >= limit) return 'full'
      vaults.set(vault, { seq: 0, records: new Map() })
      return 'created'
    },
    async pull(vault, since, limit) {
      const v = vaults.get(vault)!
      const all = [...v.records.values()].filter((r) => r.seq > since).sort((a, b) => a.seq - b.seq)
      const page = all.slice(0, limit).map((r) => ({ ...r }))
      const more = all.length > limit
      return { records: page, more, seq: more ? page[page.length - 1].seq : v.seq }
    },
    async push(vault, changes) {
      const v = vaults.get(vault)!
      const results: PushResult[] = changes.map((change) => {
        const current = v.records.get(change.key)
        if ((current?.version ?? 0) !== change.base) return { key: change.key, ok: false, current: { ...current! } }
        const next: RemoteRecord = {
          key: change.key,
          version: change.base + 1,
          seq: ++v.seq,
          deleted: change.deleted,
          data: change.deleted ? null : change.data,
        }
        v.records.set(change.key, next)
        return { key: change.key, ok: true, version: next.version }
      })
      return { results }
    },
  }
}

export function memoryPhotoStore(): PhotoStore & { size: () => number } {
  const photos = new Map<string, ArrayBuffer>()
  return {
    size: () => photos.size,
    async put(key, bytes) {
      photos.set(key, bytes.slice(0))
    },
    async get(key) {
      return photos.get(key)?.slice(0) ?? null
    },
    async delete(key) {
      photos.delete(key)
    },
  }
}
