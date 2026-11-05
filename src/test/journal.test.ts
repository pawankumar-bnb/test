import { describe, expect, it } from 'vitest'
import { blankDoc } from '@/lib/factory'
import { newestDoc } from '@/lib/storage/journal'

const at = (revision: number) => ({ ...blankDoc(), revision })

describe('choosing between IndexedDB and the page-close journal', () => {
  it('prefers the journal when the last write did not reach IndexedDB', () => {
    const journal = at(9)
    expect(newestDoc(at(5), journal)).toBe(journal)
  })

  it('ignores a stale journal left behind by another tab', () => {
    const stored = at(9)
    expect(newestDoc(stored, at(5))).toBe(stored)
  })

  it('handles either side being absent', () => {
    const doc = at(1)
    expect(newestDoc(undefined, doc)).toBe(doc)
    expect(newestDoc(doc, null)).toBe(doc)
    expect(newestDoc(undefined, null)).toBeUndefined()
  })
})
