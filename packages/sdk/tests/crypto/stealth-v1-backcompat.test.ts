/**
 * SIP:1 legacy back-compat tests
 *
 * Proves that funds announced under the pre-flip (swapped-scheme) SIP:1 format
 * remain claimable after the canonical EIP-5564 flip, via the preserved V1
 * functions and the version-routed dispatcher.
 *
 * The fixture below was captured from the pre-flip generator (verified offline:
 * derivedPrivateKey * G == stealth.address) before the curve flip landed.
 */

import { describe, it, expect } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519'
import {
  deriveEd25519StealthPrivateKeyV1,
  checkEd25519StealthAddressV1,
  deriveStealthPrivateKeyV1,
} from '../../src/stealth'
import type { StealthAddress, HexString } from '@sip-protocol/types'

const V1_FIXTURE = {
  spendingPrivateKey: '0x4c19dd3a1b6491ec8896fc2c5456dca5899e3bad6b71842c079d1896ff5f03a4' as HexString,
  viewingPrivateKey: '0x3ecbc0c983f2285057824aa6eddd56371cac60480f4efdabe6ddda57d106f070' as HexString,
  stealth: {
    address: '0xea30a9070a0e7e9c8e640d2166649ae490d7ee991c00988cf940b124308de1fd' as HexString,
    ephemeralPublicKey: '0x4bc9a3a65ee8e28ed1d5779098fb34f8e2725cbcdc8d39119321085548df962a' as HexString,
    viewTag: 134,
  } satisfies StealthAddress,
}

const ED25519_L = 2n ** 252n + 27742317777372353535851937790883648493n

describe('SIP:1 legacy back-compat', () => {
  it('deriveEd25519StealthPrivateKeyV1 recovers the legacy stealth private key', () => {
    const { privateKey } = deriveEd25519StealthPrivateKeyV1(
      V1_FIXTURE.stealth,
      V1_FIXTURE.spendingPrivateKey,
      V1_FIXTURE.viewingPrivateKey,
    )
    const scalar = leToBig(hexBytes(privateKey)) % ED25519_L
    const pub = ed25519.ExtendedPoint.BASE.multiply(scalar).toRawBytes()
    expect('0x' + Buffer.from(pub).toString('hex')).toBe(V1_FIXTURE.stealth.address)
  })

  it('deriveStealthPrivateKeyV1 dispatcher routes ed25519 to the V1 derivation', () => {
    const { privateKey } = deriveStealthPrivateKeyV1(
      V1_FIXTURE.stealth,
      V1_FIXTURE.spendingPrivateKey,
      V1_FIXTURE.viewingPrivateKey,
    )
    const scalar = leToBig(hexBytes(privateKey)) % ED25519_L
    const pub = ed25519.ExtendedPoint.BASE.multiply(scalar).toRawBytes()
    expect('0x' + Buffer.from(pub).toString('hex')).toBe(V1_FIXTURE.stealth.address)
  })

  it('checkEd25519StealthAddressV1 detects the legacy payment (full wallet)', () => {
    expect(
      checkEd25519StealthAddressV1(
        V1_FIXTURE.stealth,
        V1_FIXTURE.spendingPrivateKey,
        V1_FIXTURE.viewingPrivateKey,
      ),
    ).toBe(true)
  })
})

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
