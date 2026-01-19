/**
 * Ethereum Same-Chain Privacy Types
 *
 * Type definitions for Ethereum privacy operations including transfers,
 * scanning, claiming, and EIP-5564 announcements.
 *
 * @packageDocumentation
 */

import type { HexString, StealthAddress, StealthMetaAddress } from '@sip-protocol/types'
import type { EthereumNetwork } from './constants'

// ─── Privacy Levels ─────────────────────────────────────────────────────────

/**
 * Ethereum privacy level for transactions
 */
export type EthereumPrivacyLevel = 'transparent' | 'shielded' | 'compliant'

// ─── Announcement Types ─────────────────────────────────────────────────────

/**
 * EIP-5564 stealth address announcement
 *
 * Emitted when a sender creates a stealth address payment.
 * Recipients scan these to find incoming payments.
 */
export interface EthereumAnnouncement {
  /** EIP-5564 scheme ID (1 for secp256k1) */
  schemeId: number
  /** Stealth address that received the funds */
  stealthAddress: HexString
  /** Caller/sender who made the announcement */
  caller: HexString
  /** Ephemeral public key (compressed secp256k1, 33 bytes) */
  ephemeralPublicKey: HexString
  /** View tag for efficient filtering (0-255) */
  viewTag: number
  /** Optional metadata (token info, amount commitment, etc.) */
  metadata?: HexString
  /** Transaction hash where the announcement was made */
  txHash?: HexString
  /** Block number of the announcement */
  blockNumber?: number
  /** Log index within the block */
  logIndex?: number
  /** Timestamp of the block (unix seconds) */
  timestamp?: number
}

/**
 * Parsed EIP-5564 announcement metadata
 */
export interface AnnouncementMetadata {
  /** Token contract address (zero address for native ETH) */
  tokenAddress?: HexString
  /** Amount commitment (Pedersen commitment of the amount) */
  amountCommitment?: HexString
  /** Blinding factor hash (for commitment verification) */
  blindingHash?: HexString
  /** Additional arbitrary data */
  extraData?: HexString
}

// ─── Transfer Types ─────────────────────────────────────────────────────────

/**
 * Parameters for building a private Ethereum transfer
 */
export interface EthereumPrivateTransferParams {
  /** Recipient's stealth meta-address (or encoded string) */
  recipientMetaAddress: StealthMetaAddress | string
  /** Amount in wei (for native ETH) or smallest units (for tokens) */
  amount: bigint
  /** Token contract address (omit for native ETH) */
  tokenContract?: HexString
  /** Privacy level */
  privacyLevel?: EthereumPrivacyLevel
  /** Network to use */
  network?: EthereumNetwork
  /** Custom gas limit */
  gasLimit?: bigint
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint
  /** Optional memo/reference */
  memo?: string
}

/**
 * Built transaction ready for signing
 */
export interface EthereumShieldedTransferBuild {
  /** Stealth address to send to */
  stealthAddress: StealthAddress
  /** Ethereum address derived from stealth public key */
  stealthEthAddress: HexString
  /** Ephemeral public key for recipient scanning */
  ephemeralPublicKey: HexString
  /** View tag for efficient filtering */
  viewTag: number
  /** Shared secret (for debugging, should be discarded) */
  sharedSecret?: HexString
  /** Amount commitment (if privacy level is shielded/compliant) */
  amountCommitment?: HexString
  /** Blinding factor (if privacy level is shielded/compliant) */
  blindingFactor?: HexString
  /** Transaction data for the transfer */
  transferTx: {
    to: HexString
    value: bigint
    data?: HexString
  }
  /** Transaction data for the announcement */
  announcementTx: {
    to: HexString
    value: bigint
    data: HexString
  }
  /** Estimated gas for both transactions */
  estimatedGas: bigint
}

/**
 * Result of a private Ethereum transfer
 */
export interface EthereumPrivateTransferResult {
  /** Transaction hash of the transfer */
  transferTxHash: HexString
  /** Transaction hash of the announcement */
  announcementTxHash: HexString
  /** Stealth address that received the funds */
  stealthAddress: StealthAddress
  /** Ethereum address derived from stealth public key */
  stealthEthAddress: HexString
  /** Ephemeral public key for recipient scanning */
  ephemeralPublicKey: HexString
  /** View tag */
  viewTag: number
  /** Block number of the transfer */
  blockNumber?: number
  /** Gas used */
  gasUsed?: bigint
}

// ─── Scan Types ─────────────────────────────────────────────────────────────

/**
 * Parameters for scanning for incoming Ethereum payments
 */
export interface EthereumScanParams {
  /** Viewing private key for scanning */
  viewingPrivateKey: HexString
  /** Spending public key for address verification */
  spendingPublicKey: HexString
  /** Network to scan */
  network?: EthereumNetwork
  /** RPC URL (overrides default for network) */
  rpcUrl?: string
  /** Start block number (optional, for incremental scanning) */
  fromBlock?: number
  /** End block number (optional, defaults to 'latest') */
  toBlock?: number | 'latest'
  /** Maximum announcements to process */
  limit?: number
  /** Token contract to filter for (omit for all tokens + ETH) */
  tokenContract?: HexString
  /** Custom announcer contract address (overrides default) */
  announcerAddress?: HexString
}

/**
 * Result of scanning for Ethereum payments
 */
export interface EthereumScanResult {
  /** Detected payments */
  payments: EthereumDetectedPayment[]
  /** Last scanned block number */
  lastBlockNumber: number
  /** Total announcements scanned */
  scannedCount: number
  /** Time taken in milliseconds */
  scanTimeMs: number
}

/**
 * A detected Ethereum payment
 */
export interface EthereumDetectedPayment {
  /** Stealth address that received the payment */
  stealthAddress: StealthAddress
  /** Ethereum address derived from stealth public key */
  stealthEthAddress: HexString
  /** Amount received (in wei or token smallest units) */
  amount?: bigint
  /** Amount commitment (if hidden) */
  amountCommitment?: HexString
  /** Transaction hash */
  txHash: HexString
  /** Block number */
  blockNumber: number
  /** Token contract (undefined for native ETH) */
  tokenContract?: HexString
  /** Timestamp of the transaction (unix seconds) */
  timestamp?: number
  /** Log index */
  logIndex?: number
}

// ─── Claim Types ────────────────────────────────────────────────────────────

/**
 * Parameters for claiming a stealth payment
 */
export interface EthereumClaimParams {
  /** Stealth address to claim from */
  stealthAddress: StealthAddress
  /** Ephemeral public key from the announcement */
  ephemeralPublicKey: HexString
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Spending private key */
  spendingPrivateKey: HexString
  /** Destination address to receive funds */
  destinationAddress: HexString
  /** Network */
  network?: EthereumNetwork
  /** RPC URL (overrides default) */
  rpcUrl?: string
  /** Token contract for ERC-20 claims (omit for native ETH) */
  tokenContract?: HexString
  /** Amount to claim (defaults to full balance) */
  amount?: bigint
  /** Gas limit */
  gasLimit?: bigint
}

/**
 * Built claim transaction ready for signing
 */
export interface EthereumClaimBuild {
  /** Stealth Ethereum address */
  stealthEthAddress: HexString
  /** Derived stealth private key */
  stealthPrivateKey: HexString
  /** Destination address */
  destinationAddress: HexString
  /** Amount to claim */
  amount: bigint
  /** Transaction data */
  tx: {
    to: HexString
    value: bigint
    data?: HexString
  }
  /** Estimated gas */
  estimatedGas: bigint
}

/**
 * Result of claiming a stealth payment
 */
export interface EthereumClaimResult {
  /** Transaction hash */
  txHash: HexString
  /** Amount claimed */
  amount: bigint
  /** Destination address */
  destinationAddress: HexString
  /** Gas used */
  gasUsed?: bigint
  /** Block number */
  blockNumber?: number
}

// ─── Balance Types ──────────────────────────────────────────────────────────

/**
 * Balance query result for a stealth address
 */
export interface EthereumStealthBalance {
  /** Stealth Ethereum address */
  address: HexString
  /** Native ETH balance in wei */
  ethBalance: bigint
  /** Token balances (contract address -> balance) */
  tokenBalances: Map<HexString, bigint>
  /** Whether the address has any balance */
  hasBalance: boolean
}

// ─── Viewing Key Types ──────────────────────────────────────────────────────

/**
 * Ethereum viewing key export format
 */
export interface EthereumViewingKeyExport {
  /** Version of the export format */
  version: 1
  /** Chain identifier */
  chain: 'ethereum'
  /** Network */
  network: EthereumNetwork
  /** Viewing public key (for sharing with auditors) */
  viewingPublicKey: HexString
  /** Spending public key (for address verification) */
  spendingPublicKey: HexString
  /** Label/description */
  label?: string
  /** Creation timestamp (ISO 8601) */
  createdAt: string
  /** Expiration timestamp (ISO 8601, optional) */
  expiresAt?: string
}

/**
 * Viewing key with private component (for recipient)
 */
export interface EthereumViewingKeyPair {
  /** Public viewing key (share with auditors) */
  publicKey: HexString
  /** Private viewing key (keep secret) */
  privateKey: HexString
  /** Associated spending public key */
  spendingPublicKey: HexString
  /** Label */
  label?: string
}

// ─── Gas Estimation Types ───────────────────────────────────────────────────

/**
 * Gas estimate for Ethereum privacy operations
 */
export interface EthereumGasEstimate {
  /** Estimated gas units */
  gasLimit: bigint
  /** Current gas price (for legacy txs) */
  gasPrice?: bigint
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint
  /** Estimated cost in wei */
  estimatedCost: bigint
  /** Estimated cost in ETH (string for precision) */
  estimatedCostEth: string
}

// ─── Registry Types ─────────────────────────────────────────────────────────

/**
 * EIP-5564 stealth meta-address registry entry
 */
export interface RegistryEntry {
  /** Registered stealth meta-address */
  metaAddress: StealthMetaAddress
  /** Encoded meta-address string */
  encoded: string
  /** Block number when registered */
  registeredAt: number
  /** Transaction hash of registration */
  txHash: HexString
}

// ─── Event Types ────────────────────────────────────────────────────────────

/**
 * Announcement event from EIP-5564 contract
 */
export interface AnnouncementEvent {
  /** Event log */
  log: {
    address: HexString
    topics: HexString[]
    data: HexString
    blockNumber: number
    transactionHash: HexString
    logIndex: number
  }
  /** Parsed announcement */
  announcement: EthereumAnnouncement
}

// ─── Commitment Types ───────────────────────────────────────────────────────

/**
 * Secp256k1-based Pedersen commitment for Ethereum
 */
export interface EthereumPedersenCommitment {
  /** The commitment point C = v*G + r*H (compressed secp256k1, 33 bytes) */
  commitment: HexString
  /** The blinding factor r (32 bytes, secret) */
  blinding: HexString
}

/**
 * ERC-20 token commitment with amount and token info
 */
export interface ERC20TokenCommitment extends EthereumPedersenCommitment {
  /** ERC-20 token contract address */
  tokenContract: HexString
  /** Token decimals */
  decimals: number
  /** Original amount in smallest units */
  amountRaw?: bigint
}

// ─── Adapter State Types ────────────────────────────────────────────────────

/**
 * State of the Ethereum privacy adapter
 */
export interface EthereumPrivacyAdapterState {
  /** Current network */
  network: EthereumNetwork
  /** RPC URL being used */
  rpcUrl: string
  /** Chain ID */
  chainId: number
  /** Default privacy level */
  defaultPrivacyLevel: EthereumPrivacyLevel
  /** Number of scan recipients registered */
  scanRecipientCount: number
  /** Last scanned block */
  lastScannedBlock?: number
  /** Whether connected to RPC */
  isConnected: boolean
}

// ─── Utility Types ──────────────────────────────────────────────────────────

/**
 * Scan recipient for payment detection
 */
export interface EthereumScanRecipient {
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Spending public key */
  spendingPublicKey: HexString
  /** Optional label */
  label?: string
}

/**
 * Detected payment with full context
 */
export interface EthereumDetectedPaymentResult {
  /** The detected payment */
  payment: EthereumDetectedPayment
  /** The recipient that matched */
  recipient: EthereumScanRecipient
  /** Derived stealth private key (for claiming) */
  stealthPrivateKey: HexString
}
