import { MAX_PUSH_BYTES, MAX_PUSH_RECORDS, type PushChange, type RemoteRecord } from '../../../worker/src/protocol'
import { docPhotoIds } from '../backup'
import type { KeyValueStore, StorageAdapter } from '../storage/adapter'
import type { HubDoc } from '../types'
import { SyncError, syncApi, type SyncApi } from './api'
import { deriveKeys, generateCode, normalizeCode, openPhoto, openText, sealPhoto, sealText, type SyncKeys } from './crypto'
import { merge3 } from './merge'
import { canonical, docToRecords, recordsToDoc, type RecordMap } from './records'

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncSnapshot {
  status: SyncStatus
  code: string | null
  lastSyncedAt: number | null
  error: string | null
  /** Photos still uploading, which matters on the first sync of a big library. */
  photosLeft: number
}

export const IDLE: SyncSnapshot = { status: 'off', code: null, lastSyncedAt: null, error: null, photosLeft: 0 }

/** What this device last agreed with the server about one record. `json: null` is a deletion. */
interface Base {
  v: number
  json: string | null
}

interface SyncState {
  code: string
  /** Server sequence number already pulled. */
  cursor: number
  base: Record<string, Base>
  /** Photos known to be in the cloud. */
  uploaded: string[]
}

export interface SyncHost {
  getDoc(): HubDoc
  /** Takes the document with other devices' changes merged in, and saves it here. */
  applyDoc(doc: HubDoc): void
}

export interface EngineOptions {
  host: SyncHost
  local: StorageAdapter & KeyValueStore
  baseUrl: string
  fetch?: typeof fetch
  onChange?: (snapshot: SyncSnapshot) => void
}

export const STATE_KEY = 'sync-state'
export const DELETES_KEY = 'sync-photo-deletes'

function latestByKey(records: RemoteRecord[]) {
  const latest = new Map<string, RemoteRecord>()
  for (const record of records) {
    const seen = latest.get(record.key)
    if (!seen || seen.version < record.version) latest.set(record.key, record)
  }
  return [...latest.values()]
}

function messageFor(error: unknown) {
  if (error instanceof SyncError) {
    if (error.kind === 'unauthorized' || error.kind === 'not_found') return 'The sync service no longer recognises this code.'
    if (error.kind === 'full') return 'The sync service is full.'
    return 'The sync service had a problem. It will try again shortly.'
  }
  console.error('Sync failed', error)
  return 'Synced data could not be read on this device.'
}

export class SyncEngine {
  private state: SyncState | null = null
  private keys: SyncKeys | null = null
  private api: SyncApi | null = null
  private running: Promise<void> | null = null
  private again = false
  private photoFetches = new Map<string, Promise<Blob | undefined>>()
  private readonly options: EngineOptions
  snapshot: SyncSnapshot = IDLE

  constructor(options: EngineOptions) {
    this.options = options
  }

  get linked() {
    return this.state !== null
  }

  private update(patch: Partial<SyncSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.options.onChange?.(this.snapshot)
  }

  private async connect(code: string) {
    this.keys = await deriveKeys(code)
    this.api = syncApi(this.options.baseUrl, this.keys.token, this.options.fetch)
  }

  private persist(state = this.state) {
    if (state !== this.state) return Promise.resolve()
    return this.options.local.setValue(STATE_KEY, state ?? undefined)
  }

  /** Picks up the link this device saved earlier. */
  async load() {
    const saved = await this.options.local.getValue<SyncState>(STATE_KEY)
    if (!saved) return false
    await this.connect(saved.code)
    this.state = saved
    this.update({ status: 'syncing', code: saved.code })
    return true
  }

  /** First device: makes a new code. The next sync uploads everything here. */
  async create() {
    const code = generateCode()
    await this.connect(code)
    await this.api!.createVault()
    this.state = { code, cursor: 0, base: {}, uploaded: [] }
    await this.persist()
    this.update({ code, status: 'syncing' })
    return code
  }

  /** Another device: what is on this device is replaced by the synced copy. */
  async link(input: string): Promise<'linked' | 'not_found' | 'invalid'> {
    const code = normalizeCode(input)
    if (!code) return 'invalid'
    await this.connect(code)
    if (!(await this.api!.vaultExists())) {
      this.keys = null
      this.api = null
      return 'not_found'
    }
    const { records, cursor } = await this.pullAll(0)
    const base: Record<string, Base> = {}
    const values: RecordMap = new Map()
    for (const record of latestByKey(records)) {
      const json = record.deleted || record.data === null ? null : await openText(this.keys!.key, record.data)
      base[record.key] = { v: record.version, json }
      if (json !== null) values.set(record.key, JSON.parse(json))
    }
    // An empty vault (its first device is still uploading) keeps this device's data.
    const doc = values.size ? recordsToDoc(values, this.options.host.getDoc()) : this.options.host.getDoc()
    this.state = { code, cursor, base, uploaded: [...docPhotoIds(doc)] }
    await this.persist()
    if (values.size) {
      this.options.host.applyDoc(doc)
      const keep = docPhotoIds(doc)
      for (const id of await this.options.local.listPhotoIds()) {
        if (!keep.has(id)) await this.options.local.deletePhoto(id)
      }
    }
    this.update({ code, status: 'syncing' })
    return 'linked'
  }

  /** Stops syncing on this device. Its data stays here, and the cloud copy is untouched. */
  async unlink() {
    this.state = null
    this.keys = null
    this.api = null
    await this.options.local.setValue(STATE_KEY, undefined)
    await this.options.local.setValue(DELETES_KEY, undefined)
    this.update(IDLE)
  }

  /** One full round: take in other devices' changes, then send this device's. Safe to call any time. */
  sync(): Promise<void> {
    if (!this.state) return Promise.resolve()
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.run().finally(() => {
      this.running = null
      if (this.again && this.state) void this.sync()
    })
    return this.running
  }

  private async run() {
    const state = this.state!
    this.update({ status: 'syncing', error: null })
    try {
      do {
        this.again = false
        await this.pull(state)
        await this.uploadPhotos(state)
        await this.push(state)
        await this.flushPhotoDeletes(state)
      } while (this.again && this.state === state)
      await this.persist(state)
      if (this.state === state) this.update({ status: 'synced', lastSyncedAt: Date.now(), photosLeft: 0 })
    } catch (error) {
      await this.persist(state).catch(() => {})
      if (this.state !== state) return
      const offline = error instanceof SyncError && error.kind === 'offline'
      this.update({ status: offline ? 'offline' : 'error', error: offline ? null : messageFor(error) })
    }
  }

  private async pullAll(since: number) {
    const records: RemoteRecord[] = []
    let cursor = since
    for (;;) {
      const page = await this.api!.pull(cursor)
      records.push(...page.records)
      cursor = page.seq
      if (!page.more) return { records, cursor }
    }
  }

  private async pull(state: SyncState) {
    const { records, cursor } = await this.pullAll(state.cursor)
    if (records.length) await this.applyRemote(state, records)
    state.cursor = cursor
  }

  /** Brings other devices' versions in, merging with anything changed here meanwhile. */
  private async applyRemote(state: SyncState, records: RemoteRecord[]) {
    const fresh = latestByKey(records).filter((r) => r.version > (state.base[r.key]?.v ?? 0))
    if (!fresh.length) return
    const opened = await Promise.all(
      fresh.map(async (record) => ({
        record,
        json: record.deleted || record.data === null ? null : await openText(this.keys!.key, record.data),
      })),
    )
    // Nothing waits from here to applyDoc, so an edit made in the meantime cannot be lost.
    const doc = this.options.host.getDoc()
    const local = docToRecords(doc)
    let changed = false
    for (const { record, json } of opened) {
      const base = state.base[record.key]
      const mine = local.get(record.key)
      const mineJson = mine === undefined ? null : canonical(mine)
      const theirs = json === null ? undefined : JSON.parse(json)
      const next =
        mineJson === (base?.json ?? null)
          ? theirs
          : merge3(base?.json ? JSON.parse(base.json) : undefined, mine, theirs)
      state.base[record.key] = { v: record.version, json }
      const nextJson = next === undefined ? null : canonical(next)
      if (nextJson !== mineJson) {
        changed = true
        if (next === undefined) local.delete(record.key)
        else local.set(record.key, next)
      }
      // The merge kept something of this device's, so it still has to go up.
      if (nextJson !== json) this.again = true
    }
    if (changed) this.options.host.applyDoc(recordsToDoc(local, doc))
  }

  /** Photos go before the records that mention them, so no device sees a missing photo. */
  private async uploadPhotos(state: SyncState) {
    const uploaded = new Set(state.uploaded)
    const waiting = [...docPhotoIds(this.options.host.getDoc())].filter((id) => !uploaded.has(id))
    let left = waiting.length
    if (left) this.update({ photosLeft: left })
    for (const id of waiting) {
      const blob = await this.options.local.getPhoto(id)
      // Not on this device means it came from another one, so the cloud has it already.
      if (blob) await this.api!.putPhoto(id, await sealPhoto(this.keys!.key, blob))
      uploaded.add(id)
      state.uploaded = [...uploaded]
      this.update({ photosLeft: --left })
      if (left % 5 === 0) await this.persist(state)
    }
  }

  private async push(state: SyncState) {
    const local = docToRecords(this.options.host.getDoc())
    const pending: { key: string; base: number; json: string | null }[] = []
    for (const [key, value] of local) {
      const json = canonical(value)
      const base = state.base[key]
      if (base?.json !== json) pending.push({ key, base: base?.v ?? 0, json })
    }
    for (const [key, base] of Object.entries(state.base)) {
      if (base.json !== null && !local.has(key)) pending.push({ key, base: base.v, json: null })
    }

    let batch: (PushChange & { json: string | null })[] = []
    let bytes = 0
    const send = async () => {
      if (!batch.length) return
      const sent = batch
      batch = []
      bytes = 0
      const { results } = await this.api!.push(sent.map(({ key, base, deleted, data }) => ({ key, base, deleted, data })))
      const conflicts: RemoteRecord[] = []
      results.forEach((result, i) => {
        if (result.ok) state.base[result.key] = { v: result.version, json: sent[i].json }
        else if (result.current.version > sent[i].base) conflicts.push(result.current)
        else {
          // The server has an older version than expected: send again on top of what it has.
          state.base[result.key] = { v: result.current.version, json: null }
          this.again = true
        }
      })
      if (conflicts.length) await this.applyRemote(state, conflicts)
    }

    for (const item of pending) {
      const data = item.json === null ? null : await sealText(this.keys!.key, item.json)
      const size = (data?.length ?? 0) + item.key.length + 64
      if (batch.length >= MAX_PUSH_RECORDS || (batch.length && bytes + size > MAX_PUSH_BYTES * 0.9)) await send()
      batch.push({ key: item.key, base: item.base, deleted: data === null, data, json: item.json })
      bytes += size
    }
    await send()
  }

  private async flushPhotoDeletes(state: SyncState) {
    const ids = (await this.options.local.getValue<string[]>(DELETES_KEY)) ?? []
    if (!ids.length) return
    const done = new Set<string>()
    for (const id of ids) {
      await this.api!.deletePhoto(id)
      done.add(id)
    }
    state.uploaded = state.uploaded.filter((id) => !done.has(id))
    const now = (await this.options.local.getValue<string[]>(DELETES_KEY)) ?? []
    await this.options.local.setValue(DELETES_KEY, now.filter((id) => !done.has(id)))
  }

  /** A photo was deleted here; the next sync removes the cloud copy. */
  async queuePhotoDelete(id: string) {
    if (!this.state) return
    const ids = (await this.options.local.getValue<string[]>(DELETES_KEY)) ?? []
    if (!ids.includes(id)) await this.options.local.setValue(DELETES_KEY, [...ids, id])
  }

  /** Photos download when first shown, then stay on this device. */
  fetchPhoto(id: string): Promise<Blob | undefined> {
    const api = this.api
    const keys = this.keys
    if (!this.state || !api || !keys) return Promise.resolve(undefined)
    let pending = this.photoFetches.get(id)
    if (!pending) {
      pending = (async () => {
        try {
          const bytes = await api.getPhoto(id)
          if (!bytes) return undefined
          const blob = await openPhoto(keys.key, bytes)
          await this.options.local.putPhoto(id, blob)
          return blob
        } catch {
          return undefined
        } finally {
          this.photoFetches.delete(id)
        }
      })()
      this.photoFetches.set(id, pending)
    }
    return pending
  }
}
