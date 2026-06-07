import { describe, it, expect } from 'vitest'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '../../src/stealth'
import type { ChainId, HexString } from '@sip-protocol/types'

describe('secp256k1 canonical EIP-5564', () => {
  it('detects view-only (viewing-private + spending-PUBLIC)', () => {
    const { metaAddress, viewingPrivateKey } = generateStealthMetaAddress('ethereum' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    expect(checkStealthAddress(stealthAddress, viewingPrivateKey, metaAddress.spendingKey)).toBe(true)
  })

  it('does NOT detect with the wrong viewing key', () => {
    const a = generateStealthMetaAddress('ethereum' as ChainId)
    const b = generateStealthMetaAddress('ethereum' as ChainId)
    const { stealthAddress } = generateStealthAddress(a.metaAddress)
    expect(checkStealthAddress(stealthAddress, b.viewingPrivateKey, a.metaAddress.spendingKey)).toBe(false)
  })

  it('recovered key controls the address (both privates)', () => {
    const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress('ethereum' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    const { privateKey } = deriveStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
    const pub = secp256k1.getPublicKey(hb(privateKey), true)
    expect('0x' + Buffer.from(pub).toString('hex')).toBe(stealthAddress.address)
  })
})

function hb(h: HexString): Uint8Array {
  const s = h.slice(2)
  const o = new Uint8Array(s.length / 2)
  for (let i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16)
  return o
}
