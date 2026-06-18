import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret, tryDecryptSecret } from '@/lib/crypto'

describe('crypto (secrets at rest)', () => {
  it('round-trips a secret', () => {
    const plain = 'buffer-access-token-12345'
    expect(decryptSecret(encryptSecret(plain))).toBe(plain)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same')
    const b = encryptSecret('same')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same')
    expect(decryptSecret(b)).toBe('same')
  })

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const blob = encryptSecret('secret')
    const parts = blob.split('.')
    // flip a character in the data segment
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A')
    expect(() => decryptSecret(parts.join('.'))).toThrow()
  })

  it('tryDecryptSecret returns null for null/garbage', () => {
    expect(tryDecryptSecret(null)).toBeNull()
    expect(tryDecryptSecret('not-a-ciphertext')).toBeNull()
  })
})
