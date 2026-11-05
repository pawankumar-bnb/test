import { describe, expect, it } from 'vitest'
import { applyBackup, createBackupBlob, parseBackup } from '@/lib/backup'
import { blankDoc, blankWeek } from '@/lib/factory'
import { migrateV14 } from '@/lib/migrate-v14'
import { resolveGoals } from '@/lib/goals'
import type { StorageAdapter } from '@/lib/storage/adapter'
import type { HubDoc } from '@/lib/types'

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function memoryStorage(): StorageAdapter & { photos: Map<string, Blob> } {
  const photos = new Map<string, Blob>()
  let doc: HubDoc | undefined
  return {
    photos,
    loadDoc: async () => doc,
    saveDoc: async (next) => void (doc = next),
    putPhoto: async (id, blob) => void photos.set(id, blob),
    getPhoto: async (id) => photos.get(id),
    deletePhoto: async (id) => void photos.delete(id),
    listPhotoIds: async () => [...photos.keys()],
  }
}

/** The exact shape v14 keeps in localStorage. */
const legacyDb = {
  active: 'm_1',
  members: {
    m_1: {
      name: 'Rafey',
      age: 27,
      weight: 74.5,
      bf: 14,
      created: '2026-09-01T10:00:00.000Z',
      weeks: {
        45: {
          fitness: {
            1: {
              type: 'Push',
              burn: '450',
              steps: '11000',
              notes: 'PR',
              strength: [
                { name: 'Bench', sets: { 1: { w: '60', r: '10' }, 2: { w: '65', r: '8' } } },
              ],
              cardio: [{ activity: 'Run', duration: '20', distance: '3', calories: '200', hr: '140' }],
            },
          },
          nutrition: {
            1: {
              0: { 0: { name: 'Oats', cal: '300', pro: '12', carb: '50', fat: '6', fiber: '8' } },
              4: { 0: { name: 'Chicken', cal: '500', pro: '45', carb: '10', fat: '20', fiber: '2' } },
            },
          },
          physique: { week: 45, weight: '74', bf: '13.5', waist: '80' },
          fitnessTest: {
            date: '2026-11-03',
            rhr: '58',
            vo2: '48',
            weight: '74',
            bf: '13.5',
            photos: { ftFront: { src: PIXEL, name: 'front.png', type: 'image/png', size: 70 } },
          },
          instagram: { followers: '1200', reach: '5000', notes: 'Good week' },
          photos: { front: PIXEL },
          content: { content1: PIXEL, content1_cap: 'Runway look' },
          finalized: true,
          finalizedAt: '11/4/2026',
        },
        44: { fitness: {}, nutrition: {}, physique: {}, fitnessTest: {}, instagram: {}, photos: {}, content: {} },
      },
      physiqueHistory: [
        { week: 45, weight: '74', bf: '13.5' },
        { week: 44, weight: '75', bf: '14' },
      ],
      fitnessHistory: [
        {
          date: '2026-11-03',
          rhr: '58',
          vo2: '48',
          weight: '74',
          bf: '13.5',
          photos: { ftFront: { src: PIXEL, name: 'front.png', type: 'image/png', size: 70 } },
        },
      ],
    },
  },
}

const v14Backup = JSON.stringify({
  app: 'Rafey Personal Performance Hub',
  backupVersion: 1,
  exportedAt: '2026-11-05T12:00:00.000Z',
  localStorage: { rafey_personal_hub_v9: JSON.stringify(legacyDb) },
})

describe('v14 migration', () => {
  const { doc, photos } = migrateV14(legacyDb, new Date(2026, 10, 5))
  const member = doc.members.m_1
  const week = member.weeks['2026-11-02']

  it('keeps the profile', () => {
    expect(member).toMatchObject({ name: 'Rafey', age: '27', weight: '74.5', bf: '14' })
  })

  it('maps numbered weeks to dated ones', () => {
    expect(Object.keys(member.weeks).sort()).toEqual(['2026-10-26', '2026-11-02'])
  })

  it('carries training across', () => {
    const day = week.fitness[1]!
    expect(day).toMatchObject({ type: 'Push', burn: '450', steps: '11000', notes: 'PR' })
    expect(day.strength[0].name).toBe('Bench')
    expect(day.strength[0].sets[1]).toEqual({ w: '65', r: '8' })
    expect(day.strength[0].sets).toHaveLength(6)
    expect(day.cardio[0]).toMatchObject({ activity: 'Run', hr: '140' })
  })

  it('maps meal indexes to named meals', () => {
    const day = week.nutrition[1]!
    expect(day.meals.breakfast![0]).toMatchObject({ name: 'Oats', cal: '300' })
    expect(day.meals.dinner![0]).toMatchObject({ name: 'Chicken', pro: '45' })
    expect(day.meals.lunch).toBeUndefined()
  })

  it('backfills physique from history', () => {
    expect(member.weeks['2026-10-26'].physique).toMatchObject({ weight: '75', bf: '14' })
  })

  it('merges the week copy and history copy of a test into one record', () => {
    expect(member.fitnessTests).toHaveLength(1)
    expect(member.fitnessTests[0]).toMatchObject({ date: '2026-11-03', vo2: '48' })
    expect(member.fitnessTests[0].photos.ftFront?.name).toBe('front.png')
  })

  it('stores an image used in several places once', () => {
    expect(photos).toHaveLength(1)
    expect(week.photos.front?.id).toBe(photos[0].id)
    expect(week.content.content1).toMatchObject({ caption: 'Runway look' })
  })

  it('keeps instagram and finalized state', () => {
    expect(week.instagram).toMatchObject({ followers: '1200', notes: 'Good week' })
    expect(week.finalized).toBe(true)
  })

  it('starts migrated profiles with an empty supplement grid and working goals', () => {
    expect(member.supplements).toHaveLength(3)
    expect(resolveGoals(member, 'weekly', '2026-11-02')[0].autoAchieved).toBe(11000)
  })
})

describe('backups', () => {
  it('imports a real v14 backup file end to end', async () => {
    const parsed = parseBackup(v14Backup)
    expect(parsed.source).toBe('v14')
    const store = memoryStorage()
    await applyBackup(parsed, store)
    expect(store.photos.size).toBe(1)
    expect((await store.loadDoc())?.members.m_1.name).toBe('Rafey')
  })

  it('round-trips data and photos through its own format', async () => {
    const doc = blankDoc()
    const member = doc.members[doc.activeId]
    const ref = { id: 'p1', name: 'a.png', type: 'image/png', size: 3 }
    member.weeks['2026-11-02'] = { ...blankWeek(), photos: { front: ref } }
    member.supplements[0].name = 'Creatine'

    const source = memoryStorage()
    await source.putPhoto('p1', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
    await source.putPhoto('orphan', new Blob(['x']))

    const { blob, missing } = await createBackupBlob(doc, source)
    expect(missing).toBe(0)

    const parsed = parseBackup(await blob.text())
    expect(parsed.source).toBe('v15')
    expect(parsed.photos.map((p) => p.id)).toEqual(['p1'])

    const target = memoryStorage()
    await target.putPhoto('stale', new Blob(['old']))
    await applyBackup(parsed, target)

    expect([...target.photos.keys()]).toEqual(['p1'])
    const restored = await target.photos.get('p1')!.arrayBuffer()
    expect([...new Uint8Array(restored)]).toEqual([1, 2, 3])
    expect((await target.loadDoc())?.members[doc.activeId].supplements[0].name).toBe('Creatine')
  })

  it('rejects files that are not backups, with a useful message', () => {
    expect(() => parseBackup('not json')).toThrow(/valid backup/)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Rafey Hub backup/)
  })
})
