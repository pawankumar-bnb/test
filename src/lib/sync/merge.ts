import { canonical } from './records'

/**
 * Three-way merge of one record edited on two devices since they last agreed (`base`).
 * Each side keeps the parts it changed. Lists of items with an `id` (exercises, foods,
 * supplements, tests) merge item by item, so additions on both sides survive. When both
 * sides changed the very same value, this device's edit wins. An item edited on one side
 * and deleted on the other is kept, so no typing is lost. `undefined` means absent.
 */
export function merge3(base: unknown, local: unknown, remote: unknown): unknown {
  if (same(local, remote)) return local
  if (same(base, local)) return remote
  if (same(base, remote)) return local
  if (local === undefined) return remote
  if (remote === undefined) return local

  if (isObject(local) && isObject(remote)) {
    const b = isObject(base) ? base : undefined
    const out: Record<string, unknown> = {}
    for (const key of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const merged = merge3(b?.[key], local[key], remote[key])
      if (merged !== undefined) out[key] = merged
    }
    return out
  }

  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : []
    if (idList(local) && idList(remote) && idList(b)) return mergeById(b, local, remote)
    if (local.length === remote.length) {
      const sameShape = b.length === local.length ? b : []
      return local.map((item, i) => merge3(sameShape[i], item, remote[i]))
    }
  }
  return local
}

type WithId = { id: string }

function mergeById(base: WithId[], local: WithId[], remote: WithId[]) {
  const baseById = new Map(base.map((item) => [item.id, item]))
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteIds = new Set(remote.map((item) => item.id))
  const out: unknown[] = []
  // Remote order first, then anything added only here, in this device's order.
  for (const item of remote) {
    const merged = merge3(baseById.get(item.id), localById.get(item.id), item)
    if (merged !== undefined) out.push(merged)
  }
  for (const item of local) {
    if (remoteIds.has(item.id)) continue
    const merged = merge3(baseById.get(item.id), item, undefined)
    if (merged !== undefined) out.push(merged)
  }
  return out
}

const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && canonical(a) === canonical(b))

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** Every item has an id. An empty list counts, so “all removed here” still merges by id. */
const idList = (list: unknown[]): list is WithId[] => list.every((item) => isObject(item) && typeof item.id === 'string')
