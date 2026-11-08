import type {
  CardioEntry,
  Exercise,
  FitnessDay,
  FitnessTest,
  FoodItem,
  HubDoc,
  Member,
  NutritionDay,
  SupplementColumn,
  WeekData,
} from './types'
import { SETS_PER_EXERCISE } from './types'

export const newId = () => crypto.randomUUID()

export const blankExercise = (): Exercise => ({
  id: newId(),
  name: '',
  sets: Array.from({ length: SETS_PER_EXERCISE }, () => ({ w: '', r: '' })),
})

export const blankCardio = (): CardioEntry => ({
  id: newId(),
  activity: '',
  duration: '',
  distance: '',
  calories: '',
  hr: '',
})

export const blankFitnessDay = (): FitnessDay => ({
  type: '',
  burn: '',
  steps: '',
  notes: '',
  strength: [],
  cardio: [],
})

export const blankFood = (): FoodItem => ({
  id: newId(),
  name: '',
  cal: '',
  pro: '',
  carb: '',
  fat: '',
  fiber: '',
})

export const blankNutritionDay = (): NutritionDay => ({ meals: {}, supplements: {} })

export const blankSupplement = (): SupplementColumn => ({ id: newId(), name: '' })

export const blankWeek = (): WeekData => ({
  fitness: {},
  nutrition: {},
  physique: {},
  instagram: {},
  photos: {},
  content: {},
  finalized: false,
  finalizedAt: null,
})

export const blankFitnessTest = (
  date: string,
  weight: string,
  bf: string,
  sections: Pick<FitnessTest, 'strength' | 'endurance'> = { strength: [], endurance: [] },
): FitnessTest => ({
  id: newId(),
  date,
  weight,
  bf,
  photos: {},
  ...sections,
})

export const STARTER_SUPPLEMENT_COLUMNS = 3

export function blankMember(name: string, age = '', weight = '', bf = ''): Member {
  return {
    id: newId(),
    name,
    age,
    weight,
    bf,
    createdAt: new Date().toISOString(),
    weeks: {},
    fitnessTests: [],
    supplements: Array.from({ length: STARTER_SUPPLEMENT_COLUMNS }, blankSupplement),
    goals: { weekly: {}, monthly: {} },
  }
}

export function blankDoc(): HubDoc {
  const member = blankMember('Rafey')
  return {
    schema: 2,
    revision: 0,
    activeId: member.id,
    members: { [member.id]: member },
    lastBackupAt: null,
    importPromptDismissed: false,
  }
}
