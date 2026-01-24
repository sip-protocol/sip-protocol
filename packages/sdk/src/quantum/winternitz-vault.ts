/**
 * Winternitz Vault Integration for Quantum-Resistant Storage
 *
 * Combines SIP's privacy layer (stealth addresses, Pedersen commitments,
 * viewing keys) with Winternitz vaults for post-quantum security.
 *
 * ## Security Model
 *
 * ```
 * Layer 3: COMPLIANCE (Viewing Keys)
 *   └── Selective disclosure to auditors
 * Layer 2: PRIVACY (SIP)
 *   └── Hidden sender/amount/recipient
 * Layer 1: QUANTUM RESISTANCE (Winternitz)
 *   └── 128-bit post-quantum security
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { WinternitzVaultAdapter } from '@sip-protocol/sdk/quantum'
 *
 * const adapter = new WinternitzVaultAdapter({
 *   connection: new Connection('https://api.mainnet-beta.solana.com'),
 * })
 *
 * // Open quantum-safe vault
 * const vault = await adapter.openVault({
 *   amount: 1_000_000_000n,
 *   recipient: recipientMetaAddress,
 *   viewingKey: auditorKey,
 * })
 *
 * // Send from vault (creates new vaults)
 * const { recipientVault, changeVault } = await adapter.send({
 *   fromVault: vault,
 *   toRecipient: bobMetaAddress,
 *   amount: 500_000_000n,
 * })
 * ```
 *
 * @module quantum/winternitz-vault
 */

import { PublicKey, Connection, Transaction } from '@solana/web3.js'
import { keccak_256 } from '@noble/hashes/sha3'
import type { HexString } from '@sip-protocol/types'
import {
  generateWinternitzKeypair,
  wotsSign,
  wotsVerify,
  WotsKeyManager,
  type WinternitzKeypair,
  type WotsSignature,
} from './wots'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Shielded vault combining privacy + quantum resistance
 */
export interface ShieldedVault {
  // === Winternitz Layer ===
  /** WOTS public key merkle root (32 bytes) */
  wotsMerkleRoot: Uint8Array
  /** Vault PDA on Solana */
  vaultAddress: PublicKey
  /** Balance in lamports */
  balance: bigint

  // === SIP Privacy Layer ===
  /** One-time stealth address */
  stealthAddress: {
    address: HexString
    ephemeralPublicKey: HexString
    viewTag: number
  }
  /** Pedersen commitment hiding the balance */
  balanceCommitment: {
    value: HexString
    blindingFactor: HexString
  }
  /** Encrypted metadata for viewing key holders */
  encryptedMetadata?: {
    ciphertext: HexString
    nonce: HexString
    viewingKeyHash: HexString
  }

  // === Vault State ===
  /** Vault status */
  status: 'active' | 'spent'
  /** Creation timestamp */
  createdAt: number
  /** Chain identifier */
  chain: 'solana'
}

/**
 * Decrypted vault metadata (visible to viewing key holders)
 */
export interface ShieldedVaultMetadata {
  /** Actual balance */
  balance: bigint
  /** Blinding factor for commitment verification */
  blindingFactor: HexString
  /** Original sender (if disclosed) */
  sender?: HexString
  /** Purpose/memo */
  memo?: string
  /** Timestamp */
  timestamp: number
}

/**
 * Parameters for opening a vault
 */
export interface OpenVaultParams {
  /** Amount in lamports */
  amount: bigint
  /** Recipient stealth meta-address */
  recipientMetaAddress: {
    spendingPublicKey: HexString
    viewingPublicKey: HexString
  }
  /** Viewing key for compliance (optional) */
  viewingKey?: HexString
  /** Payer for transaction */
  payer: PublicKey
  /** Transaction signer */
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
}

/**
 * Parameters for splitting a vault
 */
export interface SplitVaultParams {
  /** Source vault */
  vault: ShieldedVault
  /** Amount to send */
  splitAmount: bigint
  /** Split recipient meta-address */
  splitRecipient: {
    spendingPublicKey: HexString
    viewingPublicKey: HexString
  }
  /** Refund recipient meta-address (usually self) */
  refundRecipient: {
    spendingPublicKey: HexString
    viewingPublicKey: HexString
  }
  /** WOTS private key for source vault */
  wotsPrivateKey: Uint8Array
  /** Viewing key */
  viewingKey?: HexString
  /** Payer for transaction */
  payer: PublicKey
  /** Transaction signer */
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
}

/**
 * Parameters for closing a vault
 */
export interface CloseVaultParams {
  /** Vault to close */
  vault: ShieldedVault
  /** Recipient meta-address */
  recipient: {
    spendingPublicKey: HexString
    viewingPublicKey: HexString
  }
  /** WOTS private key */
  wotsPrivateKey: Uint8Array
  /** Viewing key */
  viewingKey?: HexString
  /** Payer */
  payer: PublicKey
  /** Transaction signer */
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
}

/**
 * Vault scan parameters
 */
export interface ScanVaultsParams {
  /** Spending private key */
  spendingPrivateKey: HexString
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Vaults to scan */
  vaults: ShieldedVault[]
}

/**
 * Adapter configuration
 */
export interface WinternitzVaultConfig {
  /** Solana connection */
  connection: Connection
  /** Winternitz program ID (if deployed) */
  programId?: PublicKey
  /** Enable debug logging */
  debug?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default Winternitz program ID (placeholder - update with actual deployment)
 */
export const WINTERNITZ_PROGRAM_ID = new PublicKey(
  'WntrVt1111111111111111111111111111111111111'
)

/**
 * Vault account size
 */
export const VAULT_ACCOUNT_SIZE = 256

// ─── WinternitzVaultAdapter ───────────────────────────────────────────────────

/**
 * Quantum-resistant vault adapter
 *
 * Integrates Winternitz vaults with SIP privacy primitives.
 */
export class WinternitzVaultAdapter {
  private connection: Connection
  private programId: PublicKey
  private keyManager: WotsKeyManager
  private debug: boolean

  constructor(config: WinternitzVaultConfig) {
    this.connection = config.connection
    this.programId = config.programId ?? WINTERNITZ_PROGRAM_ID
    this.keyManager = new WotsKeyManager()
    this.debug = config.debug ?? false
  }

  /**
   * Generate a fresh Winternitz keypair for a new vault
   */
  generateKeypair(): WinternitzKeypair {
    const keypair = generateWinternitzKeypair()
    this.keyManager.register(keypair)
    return keypair
  }

  /**
   * Derive vault PDA from merkle root
   */
  deriveVaultAddress(merkleRoot: Uint8Array): PublicKey {
    const [vaultAddress] = PublicKey.findProgramAddressSync(
      [merkleRoot],
      this.programId
    )
    return vaultAddress
  }

  /**
   * Open a new shielded vault (mock implementation)
   *
   * In production, this would interact with the deployed Winternitz program.
   */
  async openVault(params: OpenVaultParams): Promise<{
    vault: ShieldedVault
    wotsKeypair: WinternitzKeypair
  }> {
    const {
      amount,
      recipientMetaAddress,
      viewingKey,
      payer: _payer,
      signTransaction: _signTransaction,
    } = params

    // Note: payer and signTransaction are used in production to send transactions
    void _payer
    void _signTransaction

    // Generate WOTS keypair
    const wotsKeypair = this.generateKeypair()
    const vaultAddress = this.deriveVaultAddress(wotsKeypair.merkleRoot)

    // Generate stealth address for recipient
    const stealthAddress = this.generateMockStealthAddress(recipientMetaAddress)

    // Generate Pedersen commitment
    const commitment = this.generateMockCommitment(amount)

    // Encrypt metadata if viewing key provided
    let encryptedMetadata: ShieldedVault['encryptedMetadata']
    if (viewingKey) {
      encryptedMetadata = this.encryptMetadata(
        { balance: amount, blindingFactor: commitment.blindingFactor, timestamp: Date.now() },
        viewingKey
      )
    }

    // Create vault (mock - would send transaction in production)
    if (this.debug) {
      console.log(`[WinternitzVault] Opening vault at ${vaultAddress.toBase58()}`)
      console.log(`[WinternitzVault] Amount: ${amount} lamports`)
    }

    // In production: Build and send transaction to Winternitz program
    // const ix = WinternitzProgram.openVault({ merkleRoot, lamports: amount })
    // const tx = new Transaction().add(ix)
    // await this.sendTransaction(tx, signTransaction)

    const vault: ShieldedVault = {
      wotsMerkleRoot: wotsKeypair.merkleRoot,
      vaultAddress,
      balance: amount,
      stealthAddress,
      balanceCommitment: commitment,
      encryptedMetadata,
      status: 'active',
      createdAt: Date.now(),
      chain: 'solana',
    }

    return { vault, wotsKeypair }
  }

  /**
   * Split vault into two destinations
   */
  async splitVault(params: SplitVaultParams): Promise<{
    splitVault: ShieldedVault
    refundVault: ShieldedVault
    signature: WotsSignature
  }> {
    const {
      vault,
      splitAmount,
      splitRecipient,
      refundRecipient,
      wotsPrivateKey,
      viewingKey,
      payer,
      signTransaction,
    } = params

    // Validate
    if (vault.status !== 'active') {
      throw new Error('Vault is not active')
    }

    if (splitAmount > vault.balance) {
      throw new Error(`Split amount ${splitAmount} exceeds balance ${vault.balance}`)
    }

    // Check key not already used
    if (!this.keyManager.canUse(vault.wotsMerkleRoot)) {
      throw new Error('WOTS key already used - cannot split vault')
    }

    // Create split vault
    const splitResult = await this.openVault({
      amount: splitAmount,
      recipientMetaAddress: splitRecipient,
      viewingKey,
      payer,
      signTransaction,
    })

    // Create refund vault
    const refundAmount = vault.balance - splitAmount
    const refundResult = await this.openVault({
      amount: refundAmount,
      recipientMetaAddress: refundRecipient,
      viewingKey,
      payer,
      signTransaction,
    })

    // Sign split message with WOTS
    const message = this.buildSplitMessage(
      splitResult.vault.vaultAddress,
      refundResult.vault.vaultAddress,
      splitAmount
    )

    // Mark key as used BEFORE signing (critical for security)
    await this.keyManager.markUsed(
      vault.wotsMerkleRoot,
      `split:${splitResult.vault.vaultAddress.toBase58()}`
    )

    const signature = wotsSign(wotsPrivateKey, message)

    if (this.debug) {
      console.log(`[WinternitzVault] Split vault: ${splitAmount} + ${refundAmount}`)
    }

    // Mark original vault as spent
    vault.status = 'spent'

    return {
      splitVault: splitResult.vault,
      refundVault: refundResult.vault,
      signature,
    }
  }

  /**
   * Close vault and send all funds to recipient
   */
  async closeVault(params: CloseVaultParams): Promise<{
    recipientVault: ShieldedVault
    signature: WotsSignature
  }> {
    const {
      vault,
      recipient,
      wotsPrivateKey,
      viewingKey,
      payer,
      signTransaction,
    } = params

    // Validate
    if (vault.status !== 'active') {
      throw new Error('Vault is not active')
    }

    if (!this.keyManager.canUse(vault.wotsMerkleRoot)) {
      throw new Error('WOTS key already used - cannot close vault')
    }

    // Create recipient vault
    const recipientResult = await this.openVault({
      amount: vault.balance,
      recipientMetaAddress: recipient,
      viewingKey,
      payer,
      signTransaction,
    })

    // Sign close message
    const message = this.buildCloseMessage(recipientResult.vault.vaultAddress)

    // Mark key as used
    await this.keyManager.markUsed(
      vault.wotsMerkleRoot,
      `close:${recipientResult.vault.vaultAddress.toBase58()}`
    )

    const signature = wotsSign(wotsPrivateKey, message)

    if (this.debug) {
      console.log(`[WinternitzVault] Closed vault: ${vault.balance} lamports`)
    }

    // Mark original vault as spent
    vault.status = 'spent'

    return {
      recipientVault: recipientResult.vault,
      signature,
    }
  }

  /**
   * Scan for vaults belonging to a keypair
   */
  scanVaults(params: ScanVaultsParams): ShieldedVault[] {
    const { spendingPrivateKey, viewingPrivateKey, vaults } = params

    const matchedVaults: ShieldedVault[] = []

    for (const vault of vaults) {
      // Check view tag first (97% rejection rate)
      if (!this.checkViewTag(vault.stealthAddress, viewingPrivateKey)) {
        continue
      }

      // Full stealth check
      if (this.checkStealthOwnership(vault.stealthAddress, spendingPrivateKey, viewingPrivateKey)) {
        matchedVaults.push(vault)
      }
    }

    return matchedVaults
  }

  /**
   * Verify signature for a vault operation
   */
  verifySignature(
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: WotsSignature
  ): boolean {
    return wotsVerify(publicKey, message, signature)
  }

  /**
   * Get key manager for tracking WOTS key usage
   */
  getKeyManager(): WotsKeyManager {
    return this.keyManager
  }

  /**
   * Estimate transaction cost
   */
  estimateOpenCost(): bigint {
    // Rent for vault account + transaction fee
    const rentExemption = 890880n // ~0.00089 SOL for 256 bytes
    const txFee = 5000n
    return rentExemption + txFee
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  private generateMockStealthAddress(_metaAddress: {
    spendingPublicKey: HexString
    viewingPublicKey: HexString
  }): ShieldedVault['stealthAddress'] {
    // In production, use generateEd25519StealthAddress with _metaAddress
    const ephemeral = keccak_256(new TextEncoder().encode(Date.now().toString()))
    return {
      address: `0x${Buffer.from(ephemeral).toString('hex')}`,
      ephemeralPublicKey: `0x${Buffer.from(ephemeral).toString('hex')}`,
      viewTag: ephemeral[0],
    }
  }

  private generateMockCommitment(amount: bigint): {
    value: HexString
    blindingFactor: HexString
  } {
    // In production, use commit() from crypto module
    const blinding = keccak_256(new TextEncoder().encode(Math.random().toString()))
    const commitment = keccak_256(
      new Uint8Array([...this.bigintToBytes(amount), ...blinding])
    )
    return {
      value: `0x${Buffer.from(commitment).toString('hex')}`,
      blindingFactor: `0x${Buffer.from(blinding).toString('hex')}`,
    }
  }

  private encryptMetadata(
    metadata: Partial<ShieldedVaultMetadata>,
    viewingKey: HexString
  ): ShieldedVault['encryptedMetadata'] {
    // In production, use XChaCha20-Poly1305
    const data = JSON.stringify(metadata)
    const nonce = keccak_256(new TextEncoder().encode(Date.now().toString())).slice(0, 24)
    const ciphertext = new TextEncoder().encode(data) // Mock - not actually encrypted

    return {
      ciphertext: `0x${Buffer.from(ciphertext).toString('hex')}`,
      nonce: `0x${Buffer.from(nonce).toString('hex')}`,
      viewingKeyHash: `0x${Buffer.from(keccak_256(this.hexToBytes(viewingKey))).toString('hex')}`,
    }
  }

  private buildSplitMessage(
    splitVault: PublicKey,
    refundVault: PublicKey,
    amount: bigint
  ): Uint8Array {
    const data = new Uint8Array(96)
    data.set(splitVault.toBytes(), 0)
    data.set(refundVault.toBytes(), 32)
    data.set(this.bigintToBytes(amount), 64)
    return keccak_256(data)
  }

  private buildCloseMessage(recipientVault: PublicKey): Uint8Array {
    return keccak_256(recipientVault.toBytes())
  }

  private checkViewTag(
    _stealthAddress: ShieldedVault['stealthAddress'],
    _viewingKey: HexString
  ): boolean {
    // Mock view tag check - in production, verify view tag matches
    return true
  }

  private checkStealthOwnership(
    _stealthAddress: ShieldedVault['stealthAddress'],
    _spendingKey: HexString,
    _viewingKey: HexString
  ): boolean {
    // Mock ownership check - in production, use checkEd25519StealthAddress
    return true
  }

  private bigintToBytes(value: bigint): Uint8Array {
    const bytes = new Uint8Array(32)
    let v = value
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(v & 0xffn)
      v >>= 8n
    }
    return bytes
  }

  private hexToBytes(hex: HexString): Uint8Array {
    const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(cleaned.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a Winternitz vault adapter
 *
 * @example
 * ```typescript
 * const adapter = createWinternitzVaultAdapter({
 *   connection: new Connection('https://api.mainnet-beta.solana.com'),
 * })
 *
 * const { vault, wotsKeypair } = await adapter.openVault({
 *   amount: 1_000_000_000n,
 *   recipientMetaAddress: { spendingPublicKey, viewingPublicKey },
 *   payer: wallet.publicKey,
 *   signTransaction: wallet.signTransaction,
 * })
 * ```
 */
export function createWinternitzVaultAdapter(
  config: WinternitzVaultConfig
): WinternitzVaultAdapter {
  return new WinternitzVaultAdapter(config)
}
