import { create } from 'zustand'
import { indexedDbAdapter } from '../storage/indexeddb'
import { IDLE, SyncEngine, type SyncHost, type SyncSnapshot } from './engine'

/** Where the sync Worker lives. Unset means this build has no sync. */
export const SYNC_URL: string | undefined = import.meta.env.VITE_SYNC_URL || undefined

export const useSync = create<SyncSnapshot & { available: boolean }>(() => ({ ...IDLE, available: Boolean(SYNC_URL) }))

const PULL_EVERY_MS = 15_000
const PUSH_AFTER_MS = 1_200

let engine: SyncEngine | null = null
let leader = false
let pushTimer: ReturnType<typeof setTimeout> | undefined

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('fittrack-sync')

type Message =
  | { type: 'status'; snapshot: SyncSnapshot }
  | { type: 'hello' }
  | { type: 'nudge' }
  | { type: 'reload'; discard: boolean }

const post = (message: Message) => channel?.postMessage(message)

/** Set by a tab that is about to replace this device's data; see reloadEverywhere. */
let discardOnReload = false
export const shouldDiscardUnsaved = () => discardOnReload

channel?.addEventListener('message', (event: MessageEvent<Message>) => {
  const message = event.data
  if (message.type === 'reload') {
    discardOnReload = message.discard
    location.reload()
  } else if (message.type === 'status' && !leader) {
    useSync.setState(message.snapshot)
  } else if (message.type === 'hello' && leader && engine) {
    post({ type: 'status', snapshot: engine.snapshot })
  } else if (message.type === 'nudge' && leader) {
    scheduleSync()
  }
})

export function syncEngine(host: SyncHost) {
  engine ??= new SyncEngine({
    host,
    local: indexedDbAdapter,
    baseUrl: SYNC_URL ?? '',
    onChange: (snapshot) => {
      useSync.setState(snapshot)
      if (leader) post({ type: 'status', snapshot })
    },
  })
  return engine
}

function scheduleSync(delay = PUSH_AFTER_MS) {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void engine?.sync(), delay)
}

/** Only one tab per browser talks to the server; the others follow it. */
function runAsLeader() {
  const run = () => {
    leader = true
    void engine!.sync()
    setInterval(() => {
      if (document.visibilityState === 'visible') void engine!.sync()
    }, PULL_EVERY_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void engine!.sync()
    })
    window.addEventListener('online', () => void engine!.sync())
  }
  if (!navigator.locks) return run()
  void navigator.locks.request('fittrack-sync-leader', () => {
    run()
    return new Promise(() => {})
  })
  post({ type: 'hello' })
}

/** Called once the local document is open. */
export async function startSync(host: SyncHost) {
  if (!SYNC_URL) return
  const linked = await syncEngine(host).load()
  if (linked) runAsLeader()
}

/** Something changed on this device. */
export function notifyLocalChange() {
  if (leader) scheduleSync()
  else if (engine?.linked) post({ type: 'nudge' })
}

/** The Sync now button. Another tab may be the one talking to the server. */
export function syncNow() {
  if (leader) void engine?.sync()
  else post({ type: 'nudge' })
}

export const cloudPhoto = (id: string) => engine?.fetchPhoto(id) ?? Promise.resolve(undefined)

export async function queueCloudPhotoDelete(id: string) {
  await engine?.queuePhotoDelete(id)
  notifyLocalChange()
}

/**
 * Linking or unlinking changes what every open tab should show, so all of them reload.
 * `discard` drops other tabs' unsaved typing, for when this device's data is replaced.
 */
export function reloadEverywhere(toast: string, discard: boolean) {
  sessionStorage.setItem(SYNC_TOAST_KEY, toast)
  post({ type: 'reload', discard })
  location.reload()
}

export const SYNC_TOAST_KEY = 'fittrack-sync-toast'
