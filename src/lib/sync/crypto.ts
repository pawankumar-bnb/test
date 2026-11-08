/**
 * The sync code is the only secret. From it each device derives a login token for the
 * server and a separate AES key, so everything is encrypted before it leaves the
 * device and the server never holds anything it can read.
 */

/** Crockford base32: no I, L, O or U, so the code is easy to read out and type. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
/** 20 characters, 100 bits: far beyond guessing, short enough to type once per device. */
export const CODE_LENGTH = 20

export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return [...bytes].map((b) => ALPHABET[b & 31]).join('')
}

/** Accepts the code however it was typed: any case, with or without dashes or spaces. */
export function normalizeCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  if (code.length !== CODE_LENGTH || [...code].some((c) => !ALPHABET.includes(c))) return null
  return code
}

export const formatCode = (code: string) => code.match(/.{1,4}/g)!.join('-')

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const SALT = encoder.encode('fit-track-sync-v1')

export interface SyncKeys {
  /** Sent to the server, which stores only a hash of it. */
  token: string
  /** Never leaves the device. */
  key: CryptoKey
}

export async function deriveKeys(code: string): Promise<SyncKeys> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(code), 'HKDF', false, ['deriveBits', 'deriveKey'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode('auth') },
    material,
    256,
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: encoder.encode('encrypt') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { token: toBase64(new Uint8Array(bits), true), key }
}

export function toBase64(bytes: Uint8Array, url = false) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const text = btoa(binary)
  return url ? text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : text
}

export function fromBase64(text: string) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function encrypt(key: CryptoKey, plain: Uint8Array<ArrayBuffer>) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))
  const out = new Uint8Array(iv.length + sealed.length)
  out.set(iv)
  out.set(sealed, iv.length)
  return out
}

async function decrypt(key: CryptoKey, data: Uint8Array<ArrayBuffer>) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12)))
}

export const sealText = async (key: CryptoKey, text: string) => toBase64(await encrypt(key, encoder.encode(text)))

export const openText = async (key: CryptoKey, data: string) => decoder.decode(await decrypt(key, fromBase64(data)))

/** The photo's type travels inside the encrypted bytes. */
export async function sealPhoto(key: CryptoKey, blob: Blob) {
  const type = encoder.encode(blob.type || 'application/octet-stream')
  const body = new Uint8Array(await blob.arrayBuffer())
  const plain = new Uint8Array(2 + type.length + body.length)
  plain[0] = type.length >> 8
  plain[1] = type.length & 0xff
  plain.set(type, 2)
  plain.set(body, 2 + type.length)
  return encrypt(key, plain)
}

export async function openPhoto(key: CryptoKey, data: Uint8Array<ArrayBuffer>) {
  const plain = await decrypt(key, data)
  const length = (plain[0] << 8) | plain[1]
  return new Blob([plain.slice(2 + length)], { type: decoder.decode(plain.slice(2, 2 + length)) })
}
