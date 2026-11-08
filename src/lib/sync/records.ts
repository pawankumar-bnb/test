import { blankMember } from '../factory'
import type { FitnessTest, HubDoc, Member, WeekData } from '../types'

/**
 * The document syncs as many small records rather than one big file: one per member,
 * per week and per fitness test. Two devices editing different weeks never touch the
 * same record, and a change uploads only what it touched.
 */
export type RecordMap = Map<string, unknown>

type MemberMeta = Omit<Member, 'weeks' | 'fitnessTests'>

/** Settings that belong to this device rather than to the data. */
export type DeviceFields = Pick<HubDoc, 'activeId' | 'revision' | 'lastBackupAt' | 'importPromptDismissed'>

const part = (id: string) => encodeURIComponent(id).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

export function docToRecords(doc: HubDoc): RecordMap {
  const records: RecordMap = new Map()
  for (const member of Object.values(doc.members)) {
    const { weeks, fitnessTests, ...meta } = member
    const id = part(member.id)
    records.set(`member:${id}`, meta)
    for (const [week, data] of Object.entries(weeks)) records.set(`week:${id}:${part(week)}`, data)
    for (const test of fitnessTests) records.set(`test:${id}:${part(test.id)}`, test)
  }
  return records
}

export function recordsToDoc(records: RecordMap, device: DeviceFields): HubDoc {
  const members: Record<string, Member> = {}
  const byKeyId = new Map<string, Member>()
  for (const [key, value] of records) {
    const [kind, id] = key.split(':')
    if (kind !== 'member') continue
    const meta = value as MemberMeta
    const member: Member = { ...meta, weeks: {}, fitnessTests: [] }
    byKeyId.set(id, member)
  }
  for (const [key, value] of records) {
    const [kind, memberId, itemId] = key.split(':')
    const member = byKeyId.get(memberId)
    // A week or test whose member was deleted elsewhere goes with it.
    if (!member || !itemId) continue
    if (kind === 'week') member.weeks[decodeURIComponent(itemId)] = value as WeekData
    if (kind === 'test') member.fitnessTests.push(value as FitnessTest)
  }
  const ordered = [...byKeyId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  for (const member of ordered) {
    member.fitnessTests.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    members[member.id] = member
  }
  if (!ordered.length) {
    const member = blankMember('Rafey')
    members[member.id] = member
  }
  return {
    schema: 2,
    revision: device.revision,
    activeId: members[device.activeId] ? device.activeId : Object.keys(members)[0],
    members,
    lastBackupAt: device.lastBackupAt,
    importPromptDismissed: device.importPromptDismissed,
  }
}

/** JSON with object keys sorted, so equal content always gives equal text. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v !== undefined) out[key] = sortKeys(v)
    }
    return out
  }
  return value
}
