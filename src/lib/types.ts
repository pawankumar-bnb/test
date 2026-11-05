/** Monday of the week, as YYYY-MM-DD. Unique across years, unlike a bare week number. */
export type WeekKey = string
/** Calendar month, as YYYY-MM. */
export type MonthKey = string
/** 1 = Monday … 7 = Sunday. */
export type DayIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const DAY_INDEXES: DayIndex[] = [1, 2, 3, 4, 5, 6, 7]

export interface PhotoRef {
  id: string
  name: string
  type: string
  size: number
}

export interface SetEntry {
  w: string
  r: string
}

export const SETS_PER_EXERCISE = 6

export interface Exercise {
  id: string
  name: string
  sets: SetEntry[]
}

export interface CardioEntry {
  id: string
  activity: string
  duration: string
  distance: string
  calories: string
  hr: string
}

export interface FitnessDay {
  type: string
  burn: string
  steps: string
  notes: string
  strength: Exercise[]
  cardio: CardioEntry[]
}

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'preWorkout', label: 'Pre-workout' },
  { id: 'postWorkout', label: 'Post-workout' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'other', label: 'Other / snacks' },
] as const

export type MealId = (typeof MEALS)[number]['id']

export interface FoodItem {
  id: string
  name: string
  cal: string
  pro: string
  carb: string
  fat: string
  fiber: string
}

export const SUPPLEMENT_SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
] as const

export type SupplementSlot = (typeof SUPPLEMENT_SLOTS)[number]['id']
export type SupplementDoses = Partial<Record<SupplementSlot, string>>

/** A column of the supplement grid. Shared by every day so the stack is set up once. */
export interface SupplementColumn {
  id: string
  name: string
  /** Removed from the stack; still shown on days that already hold a dose. */
  archived?: boolean
}

export interface NutritionDay {
  meals: Partial<Record<MealId, FoodItem[]>>
  /** Keyed by SupplementColumn.id. */
  supplements: Record<string, SupplementDoses>
}

export const PHYSIQUE_FIELDS = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'bp', label: 'Blood pressure', unit: '', text: true },
  { key: 'bmi', label: 'BMI', unit: '' },
  { key: 'bf', label: 'Body fat', unit: '%' },
  { key: 'lean', label: 'Lean mass', unit: 'kg' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'armL', label: 'Arm left', unit: 'cm' },
  { key: 'armR', label: 'Arm right', unit: 'cm' },
  { key: 'foreL', label: 'Forearm left', unit: 'cm' },
  { key: 'foreR', label: 'Forearm right', unit: 'cm' },
  { key: 'abd', label: 'Abdominal', unit: 'cm' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hip', label: 'Hip', unit: 'cm' },
  { key: 'thighL', label: 'Thigh left', unit: 'cm' },
  { key: 'thighR', label: 'Thigh right', unit: 'cm' },
  { key: 'calfL', label: 'Calf left', unit: 'cm' },
  { key: 'calfR', label: 'Calf right', unit: 'cm' },
  { key: 'neck', label: 'Neck', unit: 'cm' },
] as const

export type PhysiqueKey = (typeof PHYSIQUE_FIELDS)[number]['key']
export type Physique = Partial<Record<PhysiqueKey, string>>

export const BODY_SLOTS = [
  { id: 'front', label: 'Front profile' },
  { id: 'left', label: 'Left profile' },
  { id: 'right', label: 'Right profile' },
  { id: 'back', label: 'Back profile' },
] as const

export const FACE_SLOTS = [
  { id: 'faceFront', label: 'Front face selfie' },
  { id: 'faceLeft', label: 'Left face selfie' },
  { id: 'faceRight', label: 'Right face selfie' },
] as const

export const CONTENT_SLOTS = [
  { id: 'content1', label: 'Front profile / look' },
  { id: 'content2', label: 'Main Instagram page' },
  { id: 'content3', label: 'Additional weekly post' },
] as const

export const TEST_PHOTO_SLOTS = [
  { id: 'ftFront', label: 'Front progress photo' },
  { id: 'ftBack', label: 'Back progress photo' },
  { id: 'ftLeft', label: 'Left progress photo' },
  { id: 'ftRight', label: 'Right progress photo' },
] as const

export type BodySlot = (typeof BODY_SLOTS)[number]['id'] | (typeof FACE_SLOTS)[number]['id']
export type ContentSlotId = (typeof CONTENT_SLOTS)[number]['id']
export type TestPhotoSlot = (typeof TEST_PHOTO_SLOTS)[number]['id']

export interface ContentSlot {
  photo?: PhotoRef
  caption: string
}

export const INSTAGRAM_FIELDS = [
  { key: 'followers', label: 'Followers', unit: '' },
  { key: 'reach', label: 'Accounts reached', unit: '' },
  { key: 'visits', label: 'Profile visits', unit: '' },
  { key: 'count', label: 'Content published', unit: '' },
  { key: 'eng', label: 'Engagement', unit: '%' },
] as const

export type InstagramKey = (typeof INSTAGRAM_FIELDS)[number]['key']
export type InstagramWeek = Partial<Record<InstagramKey | 'notes', string>>

export interface WeekData {
  fitness: Partial<Record<DayIndex, FitnessDay>>
  nutrition: Partial<Record<DayIndex, NutritionDay>>
  physique: Physique
  instagram: InstagramWeek
  photos: Partial<Record<BodySlot, PhotoRef>>
  content: Partial<Record<ContentSlotId, ContentSlot>>
  finalized: boolean
  finalizedAt: string | null
}

export const FITNESS_TEST_SECTIONS = [
  {
    title: 'Assessment record',
    fields: [
      { key: 'rhr', label: 'Resting heart rate (BPM)', numeric: true },
      { key: 'bp', label: 'Blood pressure', placeholder: '116/72' },
      { key: 'pulse', label: 'Pulse', numeric: true },
      { key: 'bpCat', label: 'BP category' },
    ],
  },
  {
    title: 'Body measurements (cm)',
    fields: [
      { key: 'armR', label: 'Arm right', numeric: true },
      { key: 'armL', label: 'Arm left', numeric: true },
      { key: 'calfR', label: 'Calf right', numeric: true },
      { key: 'calfL', label: 'Calf left', numeric: true },
      { key: 'foreR', label: 'Forearm right', numeric: true },
      { key: 'foreL', label: 'Forearm left', numeric: true },
      { key: 'thighR', label: 'Mid-thigh right', numeric: true },
      { key: 'thighL', label: 'Mid-thigh left', numeric: true },
      { key: 'chest', label: 'Chest', numeric: true },
      { key: 'abd', label: 'Abdomen', numeric: true },
      { key: 'hip', label: 'Hips', numeric: true },
      { key: 'waist', label: 'Waist', numeric: true },
      { key: 'neck', label: 'Neck', numeric: true },
    ],
  },
  {
    title: 'Cardio-respiratory fitness: Rockport 1 mile test',
    fields: [
      { key: 'rockTime', label: 'Time' },
      { key: 'rockDist', label: 'Distance' },
      { key: 'rockPulse', label: 'Pulse' },
      { key: 'vo2', label: 'VO2max' },
      { key: 'rockCat', label: 'Fitness category' },
    ],
  },
  {
    title: 'YMCA step-up test',
    fields: [
      { key: 'stepHr', label: 'Heart rate (BPM)' },
      { key: 'stepCat', label: 'Fitness category' },
    ],
  },
  {
    title: 'Muscular endurance',
    fields: [
      { key: 'press', label: 'Push-ups / DB press / barbell press' },
      { key: 'squat', label: 'Weighted / bodyweight squats' },
      { key: 'lat', label: 'Lat-pulldown / TRX pull-ups' },
    ],
  },
  {
    title: 'Flexibility',
    fields: [
      { key: 'quad', label: 'Quadriceps' },
      { key: 'ham', label: 'Hamstring' },
      { key: 'hipFlex', label: 'Hip-flexors' },
      { key: 'shoulder', label: 'Shoulder mobility' },
      { key: 'sit', label: 'Sit & reach' },
    ],
  },
] as const

export type FitnessTestKey =
  (typeof FITNESS_TEST_SECTIONS)[number]['fields'][number]['key']

export type FitnessTest = {
  id: string
  date: string
  weight: string
  bf: string
  photos: Partial<Record<TestPhotoSlot, PhotoRef>>
} & Partial<Record<FitnessTestKey, string>>

export type GoalMetricId = 'steps' | 'burn' | 'intake' | 'weight' | 'bf'

export interface GoalEntry {
  target?: string
  /** Manual override. Empty means “use what the logs say”. */
  achieved?: string
  /** Weight and body fat only: where the period started. Empty means auto. */
  start?: string
}

export type GoalSet = Partial<Record<GoalMetricId, GoalEntry>>
export type GoalPeriod = 'weekly' | 'monthly'

export interface Member {
  id: string
  name: string
  age: string
  weight: string
  bf: string
  createdAt: string
  weeks: Record<WeekKey, WeekData>
  fitnessTests: FitnessTest[]
  supplements: SupplementColumn[]
  goals: {
    weekly: Record<WeekKey, GoalSet>
    monthly: Record<MonthKey, GoalSet>
  }
}

export interface HubDoc {
  schema: 2
  /** Counts every edit, so two copies of the document can be ordered. */
  revision: number
  activeId: string
  members: Record<string, Member>
  lastBackupAt: string | null
  /** Set once the first-run “bring your old data” prompt has been dealt with. */
  importPromptDismissed: boolean
}
