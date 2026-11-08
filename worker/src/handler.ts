import {
  KEY_PATTERN,
  MAX_PHOTO_BYTES,
  MAX_PUSH_BYTES,
  MAX_PUSH_RECORDS,
  PHOTO_ID_PATTERN,
  PULL_PAGE,
  type PhotoStore,
  type PushChange,
  TOKEN_PATTERN,
  type VaultStore,
} from './protocol'

export interface HandlerOptions {
  vaults: VaultStore
  photos: PhotoStore
  allowedOrigins: string[]
  maxVaults: number
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fail = (status: number, error: string) => json({ error }, status)

async function vaultIdFor(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

function validChanges(value: unknown): value is PushChange[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PUSH_RECORDS) return false
  const keys = new Set<string>()
  return value.every((c: PushChange) => {
    const ok =
      c &&
      typeof c.key === 'string' &&
      c.key.length <= 300 &&
      KEY_PATTERN.test(c.key) &&
      !keys.has(c.key) &&
      Number.isInteger(c.base) &&
      c.base >= 0 &&
      typeof c.deleted === 'boolean' &&
      (c.deleted ? c.data === null : typeof c.data === 'string')
    keys.add(c.key)
    return ok
  })
}

async function route(request: Request, url: URL, options: HandlerOptions): Promise<Response> {
  if (url.pathname === '/' || url.pathname === '/v1/health') return json({ ok: true })

  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!TOKEN_PATTERN.test(token)) return fail(401, 'unauthorized')
  const vault = await vaultIdFor(token)

  if (url.pathname === '/v1/vault') {
    if (request.method === 'GET') {
      return (await options.vaults.vaultExists(vault)) ? json({ exists: true }) : fail(404, 'not_found')
    }
    if (request.method === 'POST') {
      const outcome = await options.vaults.createVault(vault, options.maxVaults)
      if (outcome === 'full') return fail(403, 'vault_limit')
      return json({ created: outcome === 'created' }, outcome === 'created' ? 201 : 200)
    }
    return fail(405, 'method_not_allowed')
  }

  if (!(await options.vaults.vaultExists(vault))) return fail(404, 'not_found')

  if (url.pathname === '/v1/records') {
    if (request.method === 'GET') {
      const since = Number(url.searchParams.get('since') ?? '0')
      if (!Number.isInteger(since) || since < 0) return fail(400, 'bad_since')
      return json(await options.vaults.pull(vault, since, PULL_PAGE))
    }
    if (request.method === 'POST') {
      const length = Number(request.headers.get('content-length') ?? '0')
      if (length > MAX_PUSH_BYTES) return fail(413, 'too_large')
      const text = await request.text()
      if (text.length > MAX_PUSH_BYTES) return fail(413, 'too_large')
      let body: { changes?: unknown }
      try {
        body = JSON.parse(text)
      } catch {
        return fail(400, 'bad_json')
      }
      if (!validChanges(body.changes)) return fail(400, 'bad_changes')
      return json(await options.vaults.push(vault, body.changes))
    }
    return fail(405, 'method_not_allowed')
  }

  const photo = url.pathname.match(/^\/v1\/photos\/([^/]+)$/)
  if (photo) {
    const id = photo[1]
    if (!PHOTO_ID_PATTERN.test(id)) return fail(400, 'bad_photo_id')
    const key = `${vault}/${id}`
    if (request.method === 'PUT') {
      const length = Number(request.headers.get('content-length') ?? '0')
      if (length > MAX_PHOTO_BYTES) return fail(413, 'too_large')
      const bytes = await request.arrayBuffer()
      if (!bytes.byteLength || bytes.byteLength > MAX_PHOTO_BYTES) return fail(413, 'too_large')
      await options.photos.put(key, bytes)
      return json({ ok: true })
    }
    if (request.method === 'GET') {
      const bytes = await options.photos.get(key)
      if (!bytes) return fail(404, 'not_found')
      return new Response(bytes, {
        headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable' },
      })
    }
    if (request.method === 'DELETE') {
      await options.photos.delete(key)
      return json({ ok: true })
    }
    return fail(405, 'method_not_allowed')
  }

  return fail(404, 'not_found')
}

/** The whole API. Cloudflare-specific wiring lives in index.ts. */
export async function handle(request: Request, options: HandlerOptions): Promise<Response> {
  const cors = corsHeaders(request.headers.get('origin'), options.allowedOrigins)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  let response: Response
  try {
    response = await route(request, new URL(request.url), options)
  } catch (error) {
    console.error(error)
    response = fail(500, 'server_error')
  }
  for (const [name, value] of Object.entries(cors)) response.headers.set(name, value)
  return response
}
