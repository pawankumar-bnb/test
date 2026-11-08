import { produce } from 'immer'
import { toast } from 'sonner'
import { create } from 'zustand'
import { weekKeyOf } from '@/lib/dates'
import { blankDoc, blankFitnessDay, blankNutritionDay, blankWeek } from '@/lib/factory'
import { upgradeDoc } from '@/lib/fitness-test'
import type { StorageAdapter } from '@/lib/storage/adapter'
import { indexedDbAdapter, requestPersistentStorage } from '@/lib/storage/indexeddb'
import { clearJournal, newestDoc, readJournal, writeJournal } from '@/lib/storage/journal'
import type { DayIndex, HubDoc, Member, WeekData, WeekKey } from '@/lib/types'

export const storage: StorageAdapter = indexedDbAdapter

const SAVE_DELAY_MS = 300
const UNDO_WINDOW_MS = 6000
const EMPTY_WEEK: WeekData = Object.freeze(blankWeek())

type SaveState = 'saved' | 'saving' | 'error'

interface HubStore {
  status: 'loading' | 'ready' | 'error'
  doc: HubDoc
  week: WeekKey
  saveState: SaveState
  persistent: boolean
  init: () => Promise<void>
  setWeek: (week: WeekKey) => void
  /** The one write path: edits the active member, then autosaves. */
  mutate: (recipe: (member: Member, doc: HubDoc) => void) => void
  /** Replaces the whole document, used by undo and restore. */
  replaceDoc: (doc: HubDoc) => void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
let dirty = false
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('rafey-hub')

async function flushSave() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (!dirty) return
  dirty = false
  try {
    await storage.saveDoc(useHub.getState().doc)
    clearJournal()
    channel?.postMessage('saved')
    if (!dirty) useHub.setState({ saveState: 'saved' })
  } catch (error) {
    dirty = true
    useHub.setState({ saveState: 'error' })
    console.error('Autosave failed', error)
    toast.error('Could not save to this browser. Download a backup from Settings to be safe.')
  }
}

/** A fixed delay from the first unsaved edit, so steady typing cannot put the save off. */
function scheduleSave() {
  dirty = true
  useHub.setState({ saveState: 'saving' })
  saveTimer ??= setTimeout(flushSave, SAVE_DELAY_MS)
}

/** The page may be about to die: secure the latest edits synchronously first. */
function saveBeforeHiding() {
  if (!dirty) return
  writeJournal(useHub.getState().doc)
  void flushSave()
}

export const useHub = create<HubStore>((set, get) => ({
  status: 'loading',
  doc: blankDoc(),
  week: weekKeyOf(),
  saveState: 'saved',
  persistent: false,

  async init() {
    try {
      const saved = await storage.loadDoc()
      const doc = newestDoc(saved, readJournal())
      const upgraded = doc ? upgradeDoc(doc) : false
      if (doc) set({ doc })
      // Saved straight back when it came from the journal or needed upgrading.
      if (doc !== saved || upgraded) await storage.saveDoc(get().doc)
      clearJournal()
      set({ status: 'ready' })
    } catch (error) {
      console.error('Could not open browser storage', error)
      set({ status: 'error' })
      return
    }
    set({ persistent: await requestPersistentStorage() })
  },

  setWeek: (week) => set({ week }),

  mutate(recipe) {
    set((state) => ({
      doc: produce(state.doc, (draft) => {
        recipe(draft.members[draft.activeId], draft)
        draft.revision = (draft.revision ?? 0) + 1
      }),
    }))
    scheduleSave()
  },

  replaceDoc(doc) {
    set((state) => ({ doc: { ...doc, revision: (state.doc.revision ?? 0) + 1 } }))
    scheduleSave()
  },
}))

// Another tab saved: pick up its changes unless this tab has edits of its own in flight.
channel?.addEventListener('message', async () => {
  if (dirty) return
  const doc = await storage.loadDoc()
  if (!doc || dirty) return
  upgradeDoc(doc)
  useHub.setState({ doc })
})

// A closing or backgrounded tab must not lose the last keystrokes.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', saveBeforeHiding)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveBeforeHiding()
  })
}

export const useMember = () => useHub((s) => s.doc.members[s.doc.activeId])
export const useSelectedWeek = () => useHub((s) => s.week)
export const useWeekData = () =>
  useHub((s) => s.doc.members[s.doc.activeId].weeks[s.week] ?? EMPTY_WEEK)

export const mutate = (recipe: (member: Member, doc: HubDoc) => void) =>
  useHub.getState().mutate(recipe)

/** Makes a change that can be taken back from the toast it raises. */
export function mutateWithUndo(message: string, recipe: (member: Member, doc: HubDoc) => void) {
  const before = useHub.getState().doc
  mutate(recipe)
  toast(message, {
    duration: UNDO_WINDOW_MS,
    action: { label: 'Undo', onClick: () => useHub.getState().replaceDoc(before) },
  })
}

export const weekDraft = (member: Member, key: WeekKey) => (member.weeks[key] ??= blankWeek())

export const fitnessDraft = (member: Member, key: WeekKey, day: DayIndex) =>
  (weekDraft(member, key).fitness[day] ??= blankFitnessDay())

export const nutritionDraft = (member: Member, key: WeekKey, day: DayIndex) =>
  (weekDraft(member, key).nutrition[day] ??= blankNutritionDay())
