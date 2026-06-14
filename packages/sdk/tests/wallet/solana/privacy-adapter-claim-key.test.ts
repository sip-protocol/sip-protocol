/**
 * Privacy Solana wallet adapter — deriveClaimKey signing-path guard.
 *
 * `PrivacySolanaWalletAdapter.deriveClaimKey` returns `ClaimResult.privateKey`
 * as a RAW ed25519 scalar (little-endian), NOT a 32-byte Keypair seed. Building
 * a `Keypair` from it (`new Keypair(...)` / `Keypair.fromSecretKey(...)`)
 * produces INVALID signatures. The sanctioned path is `signEd25519WithScalar`.
 *
 * This file uses REAL crypto (no module mock) so the derived scalar genuinely
 * round-trips: a signature made with the scalar must verify against the
 * stealth public key the same call returns. It locks in the correct signing
 * path and guards against a regression that re-introduces the seed footgun.
 */

import { describe, it, expect, vi } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519'
import { hexToBytes } from '@noble/hashes/utils'
import type { HexString, StealthMetaAddress } from '@sip-protocol/types'
import { PrivacySolanaWalletAdapter } from '../../../src/wallet/solana/privacy-adapter'
import { signEd25519WithScalar } from '../../../src/chains/solana/stealth-signer'
import { generateEd25519StealthAddress } from '../../../src/stealth'

// Minimal mock Solana provider (the adapter requires a connected provider to
// construct, but deriveClaimKey itself only needs the imported stealth keys).
const createMockProvider = () => ({
  isConnected: true,
  publicKey: {
    toBase58: () => 'DemoWallet111111111111111111111111111111111',
    toBytes: () => new Uint8Array(32),
    toString: () => 'DemoWallet111111111111111111111111111111111',
  },
  connect: vi.fn().mockResolvedValue({
    publicKey: { toBase58: () => 'DemoWallet111111111111111111111111111111111' },
  }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  signMessage: vi.fn(),
  signTransaction: vi.fn(),
  signAndSendTransaction: vi.fn(),
  signAllTransactions: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
})

/**
 * Build an adapter holding a real ed25519 stealth meta-address, plus a real
 * ephemeral public key + view tag derived for that meta-address (so the address
 * deriveClaimKey reconstructs is internally consistent with the keys).
 */
function buildAdapterWithRealKeys() {
  // Real 32-byte ed25519 seeds for spending + viewing.
  const spendingSeed = ed25519.utils.randomPrivateKey()
  const viewingSeed = ed25519.utils.randomPrivateKey()

  const spendingPublicKey = ed25519.getPublicKey(spendingSeed)
  const viewingPublicKey = ed25519.getPublicKey(viewingSeed)

  const toHex = (b: Uint8Array): HexString =>
    `0x${Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')}` as HexString

  const metaAddress: StealthMetaAddress = {
    chain: 'solana',
    spendingKey: toHex(spendingPublicKey),
    viewingKey: toHex(viewingPublicKey),
  }

  const adapter = new PrivacySolanaWalletAdapter({
    provider: createMockProvider(),
    metaAddress,
    spendingPrivateKey: toHex(spendingSeed),
    viewingPrivateKey: toHex(viewingSeed),
  })

  // Generate a real stealth announcement (ephemeral key + view tag) FOR this
  // meta-address using the canonical generator.
  const { stealthAddress } = generateEd25519StealthAddress(metaAddress)

  return {
    adapter,
    ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
    viewTag: stealthAddress.viewTag,
  }
}

describe('PrivacySolanaWalletAdapter.deriveClaimKey signing path', () => {
  it('deriveClaimKey scalar signs correctly via signEd25519WithScalar (not a Keypair seed)', () => {
    const { adapter, ephemeralPublicKey, viewTag } = buildAdapterWithRealKeys()

    const claim = adapter.deriveClaimKey(ephemeralPublicKey, viewTag)

    const msg = new TextEncoder().encode('hello sip')
    const sig = signEd25519WithScalar(msg, hexToBytes(claim.privateKey.slice(2)))
    const pub = hexToBytes(claim.publicKey.slice(2))

    expect(ed25519.verify(sig, msg, pub)).toBe(true)
  })
})
