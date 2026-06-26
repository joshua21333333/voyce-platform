import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

// Envelope encryption for integration secrets at rest (Buffer/Beehiiv/Notion/Slack
// tokens). AES-256-GCM with a per-value random IV and an authentication tag, so a
// tampered ciphertext fails to decrypt rather than returning garbage.
//
// The data key is derived from ENCRYPTION_KEY via SHA-256, which lets the operator
// supply any sufficiently random secret (hex, base64, or passphrase) and always get
// a valid 32-byte key. Rotate by re-encrypting stored values under a new key.

function dataKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set — refusing to encrypt/decrypt integration secrets. ' +
        'Set ENCRYPTION_KEY in the environment before connecting any publishing integration.',
    )
  }
  return createHash('sha256').update(raw).digest()
}

const PREFIX = 'v1'

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.')
}

export function decryptSecret(blob: string): string {
  const [version, ivB64, tagB64, encB64] = blob.split('.')
  if (version !== PREFIX || !ivB64 || !tagB64 || !encB64) {
    throw new Error('Malformed ciphertext — expected v1.<iv>.<tag>.<data>')
  }
  const decipher = createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64url')), decipher.final()]).toString('utf8')
}

// Non-throwing read helper for optional secret columns.
export function tryDecryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null
  try {
    return decryptSecret(blob)
  } catch {
    return null
  }
}
