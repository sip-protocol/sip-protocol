import { describe, it, expect } from 'vitest'
import { deriveStealthKeys, normalizeDomain, deriveSeed } from '../src/derive'
import { sha256 } from '@noble/hashes/sha2'
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils'

// Mock signer: returns deterministic "signature" = sha256(label || message)
const mockSigner = (label: string) => ({
  signMessage: async (msg: Uint8Array) => {
    return sha256(new Uint8Array([...utf8ToBytes(label), ...msg]))
  },
})

describe('normalizeDomain', () => {
  it('lowercases', () => {
    expect(normalizeDomain('RECTOR.sol')).toBe('rector.sol')
  })

  it('strips trailing dot', () => {
    expect(normalizeDomain('rector.sol.')).toBe('rector.sol')
  })

  it('handles already-normalized', () => {
    expect(normalizeDomain('rector.sol')).toBe('rector.sol')
  })

  it('handles subdomain', () => {
    expect(normalizeDomain('AUDITOR.Rector.sol')).toBe('auditor.rector.sol')
  })
})

describe('deriveSeed', () => {
  it('produces 32-byte seed', () => {
    const sig = new Uint8Array(64).fill(1)
    expect(deriveSeed(sig, 'spending')).toHaveLength(32)
  })

  it('spending and viewing seeds differ for same signature', () => {
    const sig = new Uint8Array(64).fill(1)
    const sp = bytesToHex(deriveSeed(sig, 'spending'))
    const vw = bytesToHex(deriveSeed(sig, 'viewing'))
    expect(sp).not.toBe(vw)
  })
})

describe('deriveStealthKeys', () => {
  it('produces 32-byte spending and viewing pubkeys', async () => {
    const wallet = mockSigner('alice')
    const keys = await deriveStealthKeys(wallet, 'rector.sol')
    expect(keys.spending).toHaveLength(32)
    expect(keys.viewing).toHaveLength(32)
  })

  it('is deterministic for same (wallet, domain)', async () => {
    const wallet = mockSigner('alice')
    const a = await deriveStealthKeys(wallet, 'rector.sol')
    const b = await deriveStealthKeys(wallet, 'rector.sol')
    expect(bytesToHex(a.spending)).toBe(bytesToHex(b.spending))
    expect(bytesToHex(a.viewing)).toBe(bytesToHex(b.viewing))
  })

  it('produces different keys for different domains (per-domain uniqueness)', async () => {
    const wallet = mockSigner('alice')
    const a = await deriveStealthKeys(wallet, 'rector.sol')
    const b = await deriveStealthKeys(wallet, 'sipher.sol')
    expect(bytesToHex(a.spending)).not.toBe(bytesToHex(b.spending))
    expect(bytesToHex(a.viewing)).not.toBe(bytesToHex(b.viewing))
  })

  it('produces different keys for different wallets', async () => {
    const a = await deriveStealthKeys(mockSigner('alice'), 'rector.sol')
    const b = await deriveStealthKeys(mockSigner('bob'), 'rector.sol')
    expect(bytesToHex(a.spending)).not.toBe(bytesToHex(b.spending))
  })

  it('normalizes domain before signing', async () => {
    const wallet = mockSigner('alice')
    const a = await deriveStealthKeys(wallet, 'rector.sol')
    const b = await deriveStealthKeys(wallet, 'RECTOR.SOL')
    expect(bytesToHex(a.spending)).toBe(bytesToHex(b.spending))
  })
})
