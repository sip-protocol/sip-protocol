/**
 * Solana canonical (SIP:2) scan round-trip tests
 *
 * Closes the test gap that hid the EIP-5564 role-swap bug: an end-to-end
 * send -> announce -> parse -> VIEW-ONLY detect path. Detection here uses only
 * the viewing PRIVATE key + the spending PUBLIC key (no spending private key),
 * which was cryptographically impossible under the pre-flip swapped scheme.
 */

import { describe, it, expect } from 'vitest'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../../src/stealth'
import { createAnnouncementMemo, parseAnnouncement } from '../../../src/chains/solana/types'
import type { ChainId } from '@sip-protocol/types'

describe('Solana canonical SIP:2 scan round-trip', () => {
  it('send -> announce (SIP:2) -> parse -> view-only detect', () => {
    const { metaAddress, viewingPrivateKey } = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)

    // Sender publishes a canonical SIP:2 announcement
    const memo = createAnnouncementMemo(
      ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey),
      stealthAddress.viewTag.toString(16).padStart(2, '0'),
      ed25519PublicKeyToSolanaAddress(stealthAddress.address),
    )
    expect(memo.startsWith('SIP:2:')).toBe(true)

    const ann = parseAnnouncement(memo)
    expect(ann).not.toBeNull()
    expect(ann!.version).toBe('2')

    // Recipient scans VIEW-ONLY: viewing PRIVATE + spending PUBLIC only
    const detected = checkEd25519StealthAddress(
      stealthAddress,
      viewingPrivateKey,
      metaAddress.spendingKey,
    )
    expect(detected).toBe(true)
  })

  it('does NOT detect a payment for a different recipient (view-only)', () => {
    const a = generateStealthMetaAddress('solana' as ChainId)
    const b = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(a.metaAddress)
    expect(
      checkEd25519StealthAddress(stealthAddress, b.viewingPrivateKey, a.metaAddress.spendingKey),
    ).toBe(false)
  })

  it('still parses a legacy SIP:1 announcement and reports version "1"', () => {
    const legacy = 'SIP:1:11111111111111111111111111111111:0a'
    const ann = parseAnnouncement(legacy)
    expect(ann).not.toBeNull()
    expect(ann!.version).toBe('1')
  })
})
