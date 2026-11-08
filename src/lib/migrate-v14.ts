import { legacyWeekToKey } from './dates'
import { upgradeMember } from './fitness-test'
import {
  blankCardio,
  blankExercise,
  blankFood,
  blankFitnessDay,
  blankMember,
  blankNutritionDay,
  blankWeek,
  newId,
} from './factory'
import type {
  BodySlot,
  ContentSlotId,
  DayIndex,
  FitnessTest,
  HubDoc,
  InstagramWeek,
  MealId,
  Member,
  Physique,
  PhotoRef,
  TestPhotoSlot,
  WeekData,
  WeekKey,
} from './types'
import { BODY_SLOTS, CONTENT_SLOTS, DAY_INDEXES, FACE_SLOTS, MEALS, PHYSIQUE_FIELDS, SETS_PER_EXERCISE, TEST_PHOTO_SLOTS } from './types'

/* The v14 single-file tracker: loosely-typed JSON living in localStorage. */
type Loose = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const LEGACY_STORAGE_KEY = 'rafey_personal_hub_v9'

/** Photos pulled out of the legacy JSON, where they lived inline as data URLs. */
export interface ExtractedPhoto {
  id: string
  dataUrl: string
}

export interface MigrationResult {
  doc: HubDoc
  photos: ExtractedPhoto[]
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

const TEST_FIELD_KEYS = [
  'rhr', 'bp', 'pulse', 'bpCat', 'armR', 'armL', 'calfR', 'calfL', 'foreR', 'foreL', 'thighR',
  'thighL', 'chest', 'abd', 'hip', 'waist', 'neck', 'rockTime', 'rockDist', 'rockPulse', 'vo2',
  'rockCat', 'stepHr', 'stepCat', 'press', 'squat', 'lat', 'quad', 'ham', 'hipFlex', 'shoulder',
  'sit',
] as const

function photoStore() {
  const byContent = new Map<string, ExtractedPhoto>()
  return {
    /** The same image repeats across week and history records; keep one copy. */
    add(dataUrl: unknown, name = 'photo', declaredType = '', declaredSize = 0): PhotoRef | undefined {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return undefined
      let photo = byContent.get(dataUrl)
      if (!photo) {
        photo = { id: newId(), dataUrl }
        byContent.set(dataUrl, photo)
      }
      const type = declaredType || dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg'
      const size = declaredSize || Math.round((dataUrl.length * 3) / 4)
      return { id: photo.id, name, type, size }
    },
    all: () => [...byContent.values()],
  }
}

type Photos = ReturnType<typeof photoStore>

function migrateFitnessDay(raw: Loose) {
  const day = blankFitnessDay()
  day.type = str(raw.type)
  day.burn = str(raw.burn)
  day.steps = str(raw.steps)
  day.notes = str(raw.notes)
  day.strength = (Array.isArray(raw.strength) ? raw.strength : []).map((row: Loose) => {
    const exercise = blankExercise()
    exercise.name = str(row.name)
    for (let s = 1; s <= SETS_PER_EXERCISE; s++) {
      exercise.sets[s - 1] = { w: str(row.sets?.[s]?.w), r: str(row.sets?.[s]?.r) }
    }
    return exercise
  })
  day.cardio = (Array.isArray(raw.cardio) ? raw.cardio : []).map((row: Loose) => ({
    ...blankCardio(),
    activity: str(row.activity),
    duration: str(row.duration),
    distance: str(row.distance),
    calories: str(row.calories),
    hr: str(row.hr),
  }))
  return day
}

function migrateNutritionDay(raw: Loose) {
  const day = blankNutritionDay()
  MEALS.forEach(({ id }, index) => {
    const items = Object.values((raw[index] ?? {}) as Loose) as Loose[]
    const foods = items
      .map((row) => ({
        ...blankFood(),
        name: str(row?.name),
        cal: str(row?.cal),
        pro: str(row?.pro),
        carb: str(row?.carb),
        fat: str(row?.fat),
        fiber: str(row?.fiber),
      }))
      .filter((f) => f.name || f.cal || f.pro || f.carb || f.fat || f.fiber)
    if (foods.length) day.meals[id as MealId] = foods
  })
  return day
}

function migratePhysique(raw: Loose | undefined) {
  const physique: Physique = {}
  for (const { key } of PHYSIQUE_FIELDS) {
    const value = str(raw?.[key])
    if (value) physique[key] = value
  }
  return physique
}

function migrateWeek(raw: Loose, photos: Photos): WeekData {
  const week = blankWeek()
  for (const d of DAY_INDEXES) {
    const fitness = raw.fitness?.[d]
    if (fitness) week.fitness[d as DayIndex] = migrateFitnessDay(fitness)
    const nutrition = raw.nutrition?.[d]
    if (nutrition) week.nutrition[d as DayIndex] = migrateNutritionDay(nutrition)
  }
  week.physique = migratePhysique(raw.physique)

  const ig = raw.instagram ?? {}
  const instagram: InstagramWeek = {}
  for (const key of ['followers', 'reach', 'visits', 'count', 'eng', 'notes'] as const) {
    if (str(ig[key])) instagram[key] = str(ig[key])
  }
  week.instagram = instagram

  for (const { id, label } of [...BODY_SLOTS, ...FACE_SLOTS]) {
    const ref = photos.add(raw.photos?.[id], `${label}.jpg`)
    if (ref) week.photos[id as BodySlot] = ref
  }
  for (const { id, label } of CONTENT_SLOTS) {
    const ref = photos.add(raw.content?.[id], `${label}.jpg`)
    const caption = str(raw.content?.[`${id}_cap`])
    if (ref || caption) week.content[id as ContentSlotId] = { photo: ref, caption }
  }

  week.finalized = Boolean(raw.finalized)
  week.finalizedAt = raw.finalizedAt ? str(raw.finalizedAt) : null
  return week
}

/** Keeps the old fixed fields as they were; upgradeMember turns them into entries after de-duplication. */
function migrateTest(raw: Loose, photos: Photos): FitnessTest {
  const test: FitnessTest = {
    id: newId(),
    date: str(raw.date),
    weight: str(raw.weight),
    bf: str(raw.bf),
    photos: {},
    strength: [],
    endurance: [],
  }
  const fields = test as unknown as Record<string, string>
  for (const key of TEST_FIELD_KEYS) {
    if (str(raw[key])) fields[key] = str(raw[key])
  }
  for (const { id } of TEST_PHOTO_SLOTS) {
    const photo = raw.photos?.[id]
    const ref = photos.add(photo?.src, photo?.name || `${id}.jpg`, photo?.type, photo?.size)
    if (ref) test.photos[id as TestPhotoSlot] = ref
  }
  return test
}

/** Same record saved twice (a week's copy and its history entry) must not appear twice. */
const testSignature = (test: FitnessTest) => {
  const { id: _id, photos: _photos, ...fields } = test
  return JSON.stringify(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)))
}

function migrateMember(id: string, raw: Loose, reference: Date, photos: Photos): Member {
  const member = blankMember(str(raw.name) || 'Rafey', str(raw.age), str(raw.weight), str(raw.bf))
  member.id = id
  member.createdAt = str(raw.created) || member.createdAt

  const keyFor = (week: unknown): WeekKey => legacyWeekToKey(Number(week), reference)

  for (const [wk, week] of Object.entries((raw.weeks ?? {}) as Loose)) {
    if (!Number.isFinite(Number(wk))) continue
    member.weeks[keyFor(wk)] = migrateWeek(week as Loose, photos)
  }

  // History rows can outlive their week's copy, so backfill rather than overwrite.
  for (const row of (Array.isArray(raw.physiqueHistory) ? raw.physiqueHistory : []) as Loose[]) {
    if (!Number.isFinite(Number(row.week))) continue
    const key = keyFor(row.week)
    member.weeks[key] ??= blankWeek()
    if (!Object.keys(member.weeks[key].physique).length) {
      member.weeks[key].physique = migratePhysique(row)
    }
  }

  const tests = new Map<string, FitnessTest>()
  const remember = (rawTest: Loose) => {
    const test = migrateTest(rawTest, photos)
    const fields = test as unknown as Record<string, string | undefined>
    const hasContent =
      test.date || TEST_FIELD_KEYS.some((key) => fields[key]) || Object.keys(test.photos).length
    if (!hasContent) return
    const signature = testSignature(test)
    const existing = tests.get(signature)
    if (existing) existing.photos = { ...test.photos, ...existing.photos }
    else tests.set(signature, test)
  }
  for (const row of (Array.isArray(raw.fitnessHistory) ? raw.fitnessHistory : []) as Loose[]) {
    remember(row)
  }
  for (const week of Object.values((raw.weeks ?? {}) as Loose) as Loose[]) {
    if (week.fitnessTest && Object.keys(week.fitnessTest).length) remember(week.fitnessTest)
  }
  member.fitnessTests = [...tests.values()].sort((a, b) => b.date.localeCompare(a.date))
  upgradeMember(member)

  return member
}

/** Reads the object stored under the v14 localStorage key. */
export function migrateV14(legacy: Loose, exportedAt: Date = new Date()): MigrationResult {
  const photos = photoStore()
  const members: Record<string, Member> = {}
  for (const [id, raw] of Object.entries((legacy.members ?? {}) as Loose)) {
    members[id] = migrateMember(id, raw as Loose, exportedAt, photos)
  }
  const ids = Object.keys(members)
  if (!ids.length) throw new Error('This backup does not contain any member profiles.')
  return {
    doc: {
      schema: 2,
      revision: 0,
      activeId: members[legacy.active] ? legacy.active : ids[0],
      members,
      lastBackupAt: null,
      importPromptDismissed: true,
    },
    photos: photos.all(),
  }
}
