import { handle } from './handler'
import type { PhotoStore, PullResponse, PushResult, RemoteRecord, VaultStore } from './protocol'

interface Env {
  DB: D1Database
  /** Photos go to R2 when it is bound, otherwise to KV (no card needed, 1 GB free). */
  PHOTOS?: R2Bucket
  PHOTOS_KV?: KVNamespace
  ALLOWED_ORIGINS: string
  MAX_VAULTS: string
}

interface Row {
  key: string
  version: number
  seq: number
  deleted: number
  data: string | null
}

const toRecord = (row: Row): RemoteRecord => ({
  key: row.key,
  version: row.version,
  seq: row.seq,
  deleted: Boolean(row.deleted),
  data: row.data,
})

/**
 * Each write takes the next sequence number for its vault and only applies when the
 * device saw the latest version; otherwise the device is handed the current record to
 * merge with. The batch runs as one transaction.
 */
const UPSERT = `
  INSERT INTO records (vault, key, version, seq, deleted, data)
  VALUES (?1, ?2, ?3 + 1, (SELECT seq FROM vaults WHERE id = ?1) - ?6, ?4, ?5)
  ON CONFLICT (vault, key) DO UPDATE SET
    version = records.version + 1, seq = excluded.seq, deleted = excluded.deleted, data = excluded.data
  WHERE records.version = ?3`

function d1Store(db: D1Database): VaultStore {
  return {
    async vaultExists(vault) {
      return Boolean(await db.prepare('SELECT 1 FROM vaults WHERE id = ?').bind(vault).first())
    },
    async createVault(vault, limit) {
      if (await this.vaultExists(vault)) return 'exists'
      const count = (await db.prepare('SELECT COUNT(*) AS n FROM vaults').first<{ n: number }>())?.n ?? 0
      if (count >= limit) return 'full'
      await db.prepare('INSERT OR IGNORE INTO vaults (id, created_at, seq) VALUES (?, ?, 0)').bind(vault, Date.now()).run()
      return 'created'
    },
    async pull(vault, since, limit): Promise<PullResponse> {
      const [rows, head] = await db.batch([
        db
          .prepare('SELECT key, version, seq, deleted, data FROM records WHERE vault = ? AND seq > ? ORDER BY seq LIMIT ?')
          .bind(vault, since, limit + 1),
        db.prepare('SELECT seq FROM vaults WHERE id = ?').bind(vault),
      ])
      const records = (rows.results as Row[]).map(toRecord)
      const more = records.length > limit
      const page = records.slice(0, limit)
      const headSeq = (head.results[0] as { seq: number } | undefined)?.seq ?? 0
      return { records: page, more, seq: more ? page[page.length - 1].seq : headSeq }
    },
    async push(vault, changes) {
      const n = changes.length
      const results = await db.batch([
        db.prepare('UPDATE vaults SET seq = seq + ? WHERE id = ?').bind(n, vault),
        ...changes.map((c, i) => db.prepare(UPSERT).bind(vault, c.key, c.base, c.deleted ? 1 : 0, c.data, n - 1 - i)),
      ])
      const conflicted = changes.filter((_, i) => !results[i + 1].meta.changes)
      const current = new Map<string, RemoteRecord>()
      if (conflicted.length) {
        const marks = conflicted.map(() => '?').join(',')
        const { results: rows } = await db
          .prepare(`SELECT key, version, seq, deleted, data FROM records WHERE vault = ? AND key IN (${marks})`)
          .bind(vault, ...conflicted.map((c) => c.key))
          .all<Row>()
        for (const row of rows) current.set(row.key, toRecord(row))
      }
      return {
        results: changes.map((c, i): PushResult => {
          if (results[i + 1].meta.changes) return { key: c.key, ok: true, version: c.base + 1 }
          return {
            key: c.key,
            ok: false,
            current: current.get(c.key) ?? { key: c.key, version: 0, seq: 0, deleted: true, data: null },
          }
        }),
      }
    },
  }
}

function photoStore(env: Env): PhotoStore {
  if (env.PHOTOS) {
    const bucket = env.PHOTOS
    return {
      put: async (key, bytes) => void (await bucket.put(key, bytes)),
      get: async (key) => (await (await bucket.get(key))?.arrayBuffer()) ?? null,
      delete: (key) => bucket.delete(key),
    }
  }
  if (env.PHOTOS_KV) {
    const kv = env.PHOTOS_KV
    return {
      put: (key, bytes) => kv.put(key, bytes),
      get: (key) => kv.get(key, 'arrayBuffer'),
      delete: (key) => kv.delete(key),
    }
  }
  throw new Error('No photo storage is bound: add PHOTOS (R2) or PHOTOS_KV (KV).')
}

export default {
  fetch(request, env) {
    return handle(request, {
      vaults: d1Store(env.DB),
      photos: photoStore(env),
      allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
      maxVaults: Number(env.MAX_VAULTS) || 3,
    })
  },
} satisfies ExportedHandler<Env>
