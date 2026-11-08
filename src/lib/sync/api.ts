import type { PullResponse, PushChange, PushResponse } from '../../../worker/src/protocol'

export type SyncErrorKind = 'offline' | 'unauthorized' | 'not_found' | 'full' | 'server'

export class SyncError extends Error {
  readonly kind: SyncErrorKind
  constructor(kind: SyncErrorKind, message: string = kind) {
    super(message)
    this.kind = kind
  }
}

const KIND_BY_STATUS: Record<number, SyncErrorKind> = { 401: 'unauthorized', 403: 'full', 404: 'not_found' }

/** Talks to the Fit Track sync Worker. Everything it sends is already encrypted. */
export function syncApi(baseUrl: string, token: string, fetchImpl: typeof fetch = (...args) => fetch(...args)) {
  async function call(path: string, init: RequestInit = {}) {
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, ...init.headers },
      })
    } catch {
      throw new SyncError('offline', 'No connection to the sync service.')
    }
    if (response.ok) return response
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new SyncError(KIND_BY_STATUS[response.status] ?? 'server', body.error ?? `HTTP ${response.status}`)
  }

  const missingIsNull = async <T>(request: Promise<T>) => {
    try {
      return await request
    } catch (error) {
      if (error instanceof SyncError && error.kind === 'not_found') return null
      throw error
    }
  }

  return {
    vaultExists: async () => (await missingIsNull(call('/v1/vault'))) !== null,
    createVault: async () => void (await call('/v1/vault', { method: 'POST' })),
    pull: async (since: number) => (await (await call(`/v1/records?since=${since}`)).json()) as PullResponse,
    push: async (changes: PushChange[]) =>
      (await (
        await call('/v1/records', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ changes }),
        })
      ).json()) as PushResponse,
    putPhoto: async (id: string, bytes: Uint8Array<ArrayBuffer>) =>
      void (await call(`/v1/photos/${id}`, { method: 'PUT', body: bytes })),
    getPhoto: async (id: string) => {
      const response = await missingIsNull(call(`/v1/photos/${id}`))
      return response ? new Uint8Array(await response.arrayBuffer()) : null
    },
    deletePhoto: async (id: string) => void (await call(`/v1/photos/${id}`, { method: 'DELETE' })),
  }
}

export type SyncApi = ReturnType<typeof syncApi>
