import { describe, it, expect } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '../../src/stealth'
import type { ChainId, HexString } from '@sip-protocol/types'

describe('ed25519 canonical EIP-5564', () => {
  it('detects with viewing-private + spending-PUBLIC only (view-only)', () => {
    const { metaAddress, viewingPrivateKey } = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    // canonical view-only signature: (addr, viewingPrivateKey, spendingPublicKey)
    expect(checkStealthAddress(stealthAddress, viewingPrivateKey, metaAddress.spendingKey)).toBe(true)
  })

  it('does NOT detect with the wrong viewing key', () => {
    const a = generateStealthMetaAddress('solana' as ChainId)
    const b = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(a.metaAddress)
    expect(checkStealthAddress(stealthAddress, b.viewingPrivateKey, a.metaAddress.spendingKey)).toBe(false)
  })

  it('spend key requires BOTH privates and controls the address', () => {
    const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    const { privateKey } = deriveStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
    const scalar = leToBig(hexBytes(privateKey)) % ED25519_L
    const pub = ed25519.ExtendedPoint.BASE.multiply(scalar).toRawBytes()
    expect('0x' + Buffer.from(pub).toString('hex')).toBe(stealthAddress.address)
  })
})

const ED25519_L = 2n ** 252n + 27742317777372353535851937790883648493n
function hexBytes(h: HexString): Uint8Array {
  const s = h.slice(2)
  const o = new Uint8Array(s.length / 2)
  for (let i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16)
  return o
}
function leToBig(b: Uint8Array): bigint {
  let r = 0n
  for (let i = b.length - 1; i >= 0; i--) r = (r << 8n) | BigInt(b[i])
  return r
}
