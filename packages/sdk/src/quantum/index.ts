/**
 * Quantum-Resistant Cryptography Module
 *
 * Provides post-quantum security for SIP Protocol using hash-based signatures.
 *
 * ## Features
 *
 * - **Winternitz One-Time Signatures (WOTS)**: 128-bit post-quantum security
 * - **Shielded Vaults**: Privacy + quantum resistance combined
 * - **Key Management**: Automatic tracking to prevent dangerous key reuse
 *
 * ## Security Model
 *
 * ```
 * ┌─────────────────────────────────────────────────────┐
 * │ Layer 3: COMPLIANCE (Viewing Keys)                 │
 * │   - Selective disclosure to auditors               │
 * ├─────────────────────────────────────────────────────┤
 * │ Layer 2: PRIVACY (SIP)                             │
 * │   - Hidden sender/amount/recipient                 │
 * ├─────────────────────────────────────────────────────┤
 * │ Layer 1: QUANTUM RESISTANCE (Winternitz)           │
 * │   - 128-bit post-quantum security                  │
 * │   - Hash-based (no ECC vulnerabilities)            │
 * └─────────────────────────────────────────────────────┘
 * ```
 *
 * ## Quick Start
 *
 * ```typescript
 * import { WinternitzVaultAdapter, generateWinternitzKeypair } from '@sip-protocol/sdk/quantum'
 *
 * // Generate quantum-safe keypair
 * const keypair = generateWinternitzKeypair()
 * console.log('Merkle root:', keypair.merkleRoot)
 *
 * // Create adapter for vault operations
 * const adapter = new WinternitzVaultAdapter({
 *   connection: new Connection('https://api.mainnet-beta.solana.com'),
 * })
 *
 * // Open shielded vault
 * const { vault, wotsKeypair } = await adapter.openVault({
 *   amount: 1_000_000_000n,
 *   recipientMetaAddress: { spendingPublicKey, viewingPublicKey },
 *   payer: wallet.publicKey,
 *   signTransaction: wallet.signTransaction,
 * })
 * ```
 *
 * @module quantum
 */

// ─── WOTS (Winternitz One-Time Signatures) ────────────────────────────────────

export {
  // Keypair generation
  generateWinternitzKeypair,
  generateWinternitzKeypairFromSeed,

  // Signing and verification
  wotsSign,
  wotsSignHash,
  wotsVerify,
  wotsVerifyWithRoot,

  // Merkle tree
  computeMerkleRoot,

  // Key management
  WotsKeyManager,

  // Serialization
  serializeKeypair,
  deserializeKeypair,
  serializeSignature,
  deserializeSignature,

  // Constants
  WOTS_W,
  WOTS_CHAINS,
  WOTS_ITERATIONS,
  CHAIN_SIZE,
  KEY_SIZE,
  MERKLE_ROOT_SIZE,

  // Types
  type WinternitzKeypair,
  type WotsSignature,
  type WotsKeyState,
} from './wots'

// ─── Winternitz Vault Adapter ─────────────────────────────────────────────────

export {
  // Adapter
  WinternitzVaultAdapter,
  createWinternitzVaultAdapter,

  // Constants
  WINTERNITZ_PROGRAM_ID,
  VAULT_ACCOUNT_SIZE,

  // Types
  type ShieldedVault,
  type ShieldedVaultMetadata,
  type OpenVaultParams,
  type SplitVaultParams,
  type CloseVaultParams,
  type ScanVaultsParams,
  type WinternitzVaultConfig,
} from './winternitz-vault'
