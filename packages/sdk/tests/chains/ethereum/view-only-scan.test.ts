/**
 * EVM view-only stealth scanning (#1104)
 *
 * Detection must work with the viewing PRIVATE key + spending PUBLIC key only — never the
 * spending private key (which is needed to claim, not to detect). Before this, the only
 * EVM scan path (`checkEthereumStealthByEthAddress` / `scanAnnouncements`) required the
 * spending private key, defeating the compliance/delegation property #1099 restored.
 */

import { describe, it, expect } from 'vitest'
import {
  generateEthereumStealthMetaAddress,
  generateEthereumStealthAddress,
  stealthPublicKeyToEthAddress,
  checkEthereumStealthByEthAddress,
  checkEthereumStealthByEthAddressViewOnly,
  createMainnetEthereumPrivacyAdapter,
} from '../../../src/chains/ethereum'
import type { EthereumAnnouncement } from '../../../src/chains/ethereum'

function fixture() {
  const meta = generateEthereumStealthMetaAddress()
  const { stealthAddress } = generateEthereumStealthAddress(meta.metaAddress)
  const stealthEthAddress = stealthPublicKeyToEthAddress(stealthAddress.address)
  return { meta, stealthAddress, stealthEthAddress }
}

describe('checkEthereumStealthByEthAddressViewOnly (#1104)', () => {
  it('detects a generated payment with viewing private + spending public only', () => {
    const { meta, stealthAddress, stealthEthAddress } = fixture()

    const detected = checkEthereumStealthByEthAddressViewOnly(
      stealthEthAddress,
      stealthAddress.ephemeralPublicKey,
      stealthAddress.viewTag,
      meta.metaAddress.spendingKey, // spending PUBLIC key
      meta.viewingPrivateKey
    )

    expect(detected).toBe(true)
  })

  it('returns false for the wrong viewing key', () => {
    const { meta, stealthAddress, stealthEthAddress } = fixture()
    const other = generateEthereumStealthMetaAddress()

    expect(
      checkEthereumStealthByEthAddressViewOnly(
        stealthEthAddress,
        stealthAddress.ephemeralPublicKey,
        stealthAddress.viewTag,
        meta.metaAddress.spendingKey,
        other.viewingPrivateKey
      )
    ).toBe(false)
  })

  it('returns false for the wrong spending public key', () => {
    const { meta, stealthAddress, stealthEthAddress } = fixture()
    const other = generateEthereumStealthMetaAddress()

    expect(
      checkEthereumStealthByEthAddressViewOnly(
        stealthEthAddress,
        stealthAddress.ephemeralPublicKey,
        stealthAddress.viewTag,
        other.metaAddress.spendingKey,
        meta.viewingPrivateKey
      )
    ).toBe(false)
  })

  it('agrees with the spending-private-key path on the same payment', () => {
    const { meta, stealthAddress, stealthEthAddress } = fixture()

    const viaPrivate = checkEthereumStealthByEthAddress(
      stealthEthAddress,
      stealthAddress.ephemeralPublicKey,
      stealthAddress.viewTag,
      meta.spendingPrivateKey,
      meta.viewingPrivateKey
    )
    const viaViewOnly = checkEthereumStealthByEthAddressViewOnly(
      stealthEthAddress,
      stealthAddress.ephemeralPublicKey,
      stealthAddress.viewTag,
      meta.metaAddress.spendingKey,
      meta.viewingPrivateKey
    )

    expect(viaPrivate).not.toBeNull() // private path returns the derived key
    expect(viaViewOnly).toBe(true)
  })
})

describe('EthereumPrivacyAdapter.scanAnnouncementsViewOnly (#1104)', () => {
  function announcementFor(stealthEthAddress: string, ephemeralPublicKey: string, viewTag: number): EthereumAnnouncement {
    return {
      schemeId: 1,
      stealthAddress: stealthEthAddress as `0x${string}`,
      caller: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      ephemeralPublicKey: ephemeralPublicKey as `0x${string}`,
      viewTag,
      txHash: '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`,
      blockNumber: 1,
      logIndex: 0,
    }
  }

  it('detects an incoming payment without the spending private key, and returns no private key', () => {
    const { meta, stealthAddress, stealthEthAddress } = fixture()
    const adapter = createMainnetEthereumPrivacyAdapter()

    // Register a VIEW-ONLY recipient — no spending private key.
    adapter.addScanRecipient({
      viewingPrivateKey: meta.viewingPrivateKey,
      spendingPublicKey: meta.metaAddress.spendingKey,
      label: 'auditor',
    })

    const results = adapter.scanAnnouncementsViewOnly([
      announcementFor(stealthEthAddress, stealthAddress.ephemeralPublicKey, stealthAddress.viewTag),
    ])

    expect(results).toHaveLength(1)
    expect(results[0].payment.stealthEthAddress.toLowerCase()).toBe(stealthEthAddress.toLowerCase())
    expect(results[0]).not.toHaveProperty('stealthPrivateKey')
  })

  it('does not detect announcements for an unrelated recipient', () => {
    const { stealthAddress, stealthEthAddress } = fixture()
    const other = generateEthereumStealthMetaAddress()
    const adapter = createMainnetEthereumPrivacyAdapter()

    adapter.addScanRecipient({
      viewingPrivateKey: other.viewingPrivateKey,
      spendingPublicKey: other.metaAddress.spendingKey,
    })

    const results = adapter.scanAnnouncementsViewOnly([
      announcementFor(stealthEthAddress, stealthAddress.ephemeralPublicKey, stealthAddress.viewTag),
    ])

    expect(results).toHaveLength(0)
  })
})
