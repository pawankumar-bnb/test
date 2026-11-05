import type { HubDoc } from '../types'

const KEY = 'rafey-hub-journal'

/**
 * Browsers may abort an IndexedDB write that is still running when a page closes,
 * while localStorage writes are synchronous and always land. So on page hide the
 * latest document is also written here, and replayed on the next load if it is
 * newer than what reached IndexedDB. Photos are not involved: they save on upload.
 */
export function writeJournal(doc: HubDoc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc))
  } catch {
    // Full or unavailable. The IndexedDB write is still attempted alongside this.
  }
}

export function readJournal(): HubDoc | null {
  try {
    const text = localStorage.getItem(KEY)
    return text ? (JSON.parse(text) as HubDoc) : null
  } catch {
    return null
  }
}

export function clearJournal() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

/** Whichever document has seen more edits. */
export function newestDoc(stored: HubDoc | undefined, journal: HubDoc | null) {
  if (!journal) return stored
  if (!stored) return journal
  return (journal.revision ?? 0) > (stored.revision ?? 0) ? journal : stored
}
