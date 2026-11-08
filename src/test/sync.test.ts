import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { handle } from '../../worker/src/handler'
import { memoryPhotoStore, memoryVaultStore } from '../../worker/src/protocol'
import { blankDoc, blankFitnessTest, blankFood, blankWeek } from '@/lib/factory'
import type { KeyValueStore, StorageAdapter } from '@/lib/storage/adapter'
import { formatCode, normalizeCode } from '@/lib/sync/crypto'
import { SyncEngine } from '@/lib/sync/engine'
import { merge3 } from '@/lib/sync/merge'
import { canonical, docToRecords, recordsToDoc } from '@/lib/sync/records'
import type { HubDoc, Member } from '@/lib/types'

const WEEK = '2026-11-02'

function server(maxVaults = 3) {
  const vaults = memoryVaultStore()
  const photos = memoryPhotoStore()
  let online = true
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!online) throw new TypeError('Failed to fetch')
    return handle(new Request(input, init), { vaults, photos, allowedOrigins: [], maxVaults })
  }) as typeof fetch
  return { vaults, photos, fetchImpl, setOnline: (value: boolean) => void (online = value) }
}

function localStore(): StorageAdapter & KeyValueStore & { photos: Map<string, Blob> } {
  const photos = new Map<string, Blob>()
  const values = new Map<string, unknown>()
  return {
    photos,
    loadDoc: async () => undefined,
    saveDoc: async () => {},
    putPhoto: async (id, blob) => void photos.set(id, blob),
    getPhoto: async (id) => photos.get(id),
    deletePhoto: async (id) => void photos.delete(id),
    listPhotoIds: async () => [...photos.keys()],
    getValue: async <T,>(key: string) => structuredClone(values.get(key)) as T | undefined,
    setValue: async (key, value) => void (value === undefined ? values.delete(key) : values.set(key, structuredClone(value))),
  }
}

function device(srv: ReturnType<typeof server>, doc: HubDoc = blankDoc()) {
  const local = localStore()
  const host = {
    doc,
    getDoc: () => host.doc,
    applyDoc: (next: HubDoc) => void (host.doc = next),
  }
  const engine = new SyncEngine({ host, local, baseUrl: 'https://sync.test', fetch: srv.fetchImpl })
  const edit = (recipe: (member: Member) => void) => {
    host.doc = produce(host.doc, (draft) => recipe(draft.members[draft.activeId]))
  }
  return { host, local, engine, edit, member: () => host.doc.members[host.doc.activeId] }
}

const food = (name: string) => ({ ...blankFood(), name, cal: '100' })

function withData() {
  return produce(blankDoc(), (draft) => {
    const member = draft.members[draft.activeId]
    member.weeks[WEEK] = blankWeek()
    member.weeks[WEEK].nutrition[1] = { meals: { breakfast: [food('Oats')] }, supplements: { s1: { breakfast: '5 g' } } }
    member.supplements[0].name = 'Creatine'
    member.fitnessTests.push({ ...blankFitnessTest('2026-11-03', '75', '14'), vo2: '48' })
  })
}

describe('sync codes', () => {
  it('reads back however they are typed', () => {
    const code = 'K7QFM2XAP9TRW3HCB6NE'
    expect(normalizeCode(formatCode(code).toLowerCase())).toBe(code)
    expect(normalizeCode(' k7qf m2xa p9tr w3hc b6ne ')).toBe(code)
    expect(normalizeCode('K7QF-M2XA')).toBeNull()
  })
})

describe('records', () => {
  it('splits the document and puts it back together unchanged', () => {
    const doc = withData()
    const back = recordsToDoc(docToRecords(doc), doc)
    expect(canonical(back)).toBe(canonical(doc))
  })
})

describe('merge', () => {
  it('keeps both sides’ changes to different fields', () => {
    expect(merge3({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 3 })).toEqual({ a: 2, b: 3 })
  })
  it('merges lists by id, keeping additions from both sides', () => {
    const base = [{ id: 'x', n: 1 }]
    expect(merge3(base, [...base, { id: 'l', n: 2 }], [...base, { id: 'r', n: 3 }])).toEqual([
      { id: 'x', n: 1 },
      { id: 'r', n: 3 },
      { id: 'l', n: 2 },
    ])
  })
  it('drops what one side deleted, unless the other side edited it', () => {
    const base = [{ id: 'x', n: 1 }, { id: 'y', n: 1 }]
    expect(merge3(base, [{ id: 'y', n: 1 }], [{ id: 'x', n: 1 }, { id: 'y', n: 1 }, { id: 'z', n: 1 }])).toEqual([
      { id: 'y', n: 1 },
      { id: 'z', n: 1 },
    ])
    expect(merge3(base, [{ id: 'y', n: 1 }], [{ id: 'x', n: 9 }, { id: 'y', n: 1 }])).toEqual([
      { id: 'x', n: 9 },
      { id: 'y', n: 1 },
    ])
  })
  it('adds to a list this side emptied', () => {
    expect(merge3([{ id: 'x' }], [], [{ id: 'x' }, { id: 'r' }])).toEqual([{ id: 'r' }])
  })
  it('prefers this device when both changed the same value', () => {
    expect(merge3({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 2 })
  })
})

describe('two devices', () => {
  async function pair() {
    const srv = server()
    const phone = device(srv, withData())
    phone.local.photos.set('photo-front-1', new Blob(['front-bytes'], { type: 'image/jpeg' }))
    phone.edit((m) => {
      m.weeks[WEEK].photos.front = { id: 'photo-front-1', name: 'front.jpg', type: 'image/jpeg', size: 11 }
    })
    const code = await phone.engine.create()
    await phone.engine.sync()
    const laptop = device(srv)
    expect(await laptop.engine.link(formatCode(code))).toBe('linked')
    return { srv, phone, laptop, code }
  }

  it('a linked device gets the same data and photos', async () => {
    const { phone, laptop } = await pair()
    expect(canonical(laptop.host.doc.members)).toBe(canonical(phone.host.doc.members))
    expect(laptop.engine.snapshot.status).toBe('syncing')
    const blob = await laptop.engine.fetchPhoto('photo-front-1')
    expect(await blob?.text()).toBe('front-bytes')
    expect(blob?.type).toBe('image/jpeg')
    expect(laptop.local.photos.has('photo-front-1')).toBe(true)
  })

  it('the server only ever holds encrypted data', async () => {
    const { srv, code } = await pair()
    const records = srv.vaults.dump(await vaultId(code))
    const text = JSON.stringify(records)
    expect(records.length).toBeGreaterThan(0)
    for (const secret of ['Oats', 'Creatine', '5 g', 'front.jpg', '48']) expect(text).not.toContain(secret)
  })

  it('edits on one device reach the other', async () => {
    const { phone, laptop } = await pair()
    phone.edit((m) => void m.weeks[WEEK].nutrition[1]!.meals.breakfast!.push(food('Eggs')))
    await phone.engine.sync()
    await laptop.engine.sync()
    expect(laptop.member().weeks[WEEK].nutrition[1]!.meals.breakfast!.map((f) => f.name)).toEqual(['Oats', 'Eggs'])
  })

  it('offline edits to the same week on both devices are merged, nothing lost', async () => {
    const { srv, phone, laptop } = await pair()
    srv.setOnline(false)
    phone.edit((m) => void m.weeks[WEEK].nutrition[1]!.meals.breakfast!.push(food('Eggs')))
    laptop.edit((m) => {
      m.weeks[WEEK].nutrition[1]!.supplements.s1.dinner = '3 g'
      m.weeks[WEEK].physique.weight = '74.5'
    })
    await phone.engine.sync()
    expect(phone.engine.snapshot.status).toBe('offline')
    srv.setOnline(true)
    await phone.engine.sync()
    await laptop.engine.sync()
    await phone.engine.sync()
    for (const d of [phone, laptop]) {
      const week = d.member().weeks[WEEK]
      expect(week.nutrition[1]!.meals.breakfast!.map((f) => f.name)).toEqual(['Oats', 'Eggs'])
      expect(week.nutrition[1]!.supplements.s1).toEqual({ breakfast: '5 g', dinner: '3 g' })
      expect(week.physique.weight).toBe('74.5')
    }
    expect(canonical(laptop.host.doc.members)).toBe(canonical(phone.host.doc.members))
  })

  it('new weeks and tests from both devices all survive', async () => {
    const { phone, laptop } = await pair()
    phone.edit((m) => void (m.weeks['2026-11-09'] = { ...blankWeek(), physique: { weight: '74' } }))
    laptop.edit((m) => void m.fitnessTests.unshift(blankFitnessTest('2026-12-01', '', '')))
    await laptop.engine.sync()
    await phone.engine.sync()
    await laptop.engine.sync()
    for (const d of [phone, laptop]) {
      expect(d.member().weeks['2026-11-09'].physique.weight).toBe('74')
      expect(d.member().fitnessTests.map((t) => t.date)).toEqual(['2026-12-01', '2026-11-03'])
    }
  })

  it('deletions reach the other device', async () => {
    const { phone, laptop } = await pair()
    laptop.edit((m) => void (m.fitnessTests = []))
    await laptop.engine.sync()
    await phone.engine.sync()
    expect(phone.member().fitnessTests).toEqual([])
  })

  it('a deleted photo leaves the cloud', async () => {
    const { srv, phone, laptop } = await pair()
    expect(srv.photos.size()).toBe(1)
    phone.edit((m) => void delete m.weeks[WEEK].photos.front)
    await phone.local.deletePhoto('photo-front-1')
    await phone.engine.queuePhotoDelete('photo-front-1')
    await phone.engine.sync()
    expect(srv.photos.size()).toBe(0)
    await laptop.engine.sync()
    expect(laptop.member().weeks[WEEK].photos.front).toBeUndefined()
  })

  it('a device that was offline catches up after many changes', async () => {
    const { phone, laptop } = await pair()
    for (let i = 0; i < 120; i++) {
      const key = `2027-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + Math.floor(i / 12)).padStart(2, '0')}`
      phone.edit((m) => void (m.weeks[key] = { ...blankWeek(), physique: { weight: String(70 + i / 10) } }))
    }
    await phone.engine.sync()
    await laptop.engine.sync()
    expect(Object.keys(laptop.member().weeks)).toHaveLength(121)
    expect(canonical(laptop.host.doc.members)).toBe(canonical(phone.host.doc.members))
  })

  it('survives a restart: the link and pending changes are kept', async () => {
    const { srv, phone, laptop } = await pair()
    srv.setOnline(false)
    phone.edit((m) => void (m.name = 'Rafey K'))
    await phone.engine.sync()
    // Same device storage, new engine, as after closing and reopening the site.
    const reopened = new SyncEngine({ host: phone.host, local: phone.local, baseUrl: 'https://sync.test', fetch: srv.fetchImpl })
    expect(await reopened.load()).toBe(true)
    srv.setOnline(true)
    await reopened.sync()
    await laptop.engine.sync()
    expect(laptop.member().name).toBe('Rafey K')
  })

  it('a wrong code is refused and changes nothing', async () => {
    const { srv } = await pair()
    const other = device(srv)
    const before = canonical(other.host.doc)
    expect(await other.engine.link('ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ')).toBe('not_found')
    expect(await other.engine.link('nope')).toBe('invalid')
    expect(canonical(other.host.doc)).toBe(before)
    expect(other.engine.linked).toBe(false)
  })

  it('turning sync off keeps this device’s data', async () => {
    const { phone } = await pair()
    await phone.engine.unlink()
    expect(phone.engine.linked).toBe(false)
    expect(phone.member().fitnessTests).toHaveLength(1)
    expect(await phone.local.getValue('sync-state')).toBeUndefined()
  })

  it('the server takes only a few sync codes, so strangers cannot use it for storage', async () => {
    const srv = server(1)
    await device(srv).engine.create()
    await expect(device(srv).engine.create()).rejects.toMatchObject({ kind: 'full' })
  })
})

async function vaultId(code: string) {
  const { deriveKeys } = await import('@/lib/sync/crypto')
  const { token } = await deriveKeys(code)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
