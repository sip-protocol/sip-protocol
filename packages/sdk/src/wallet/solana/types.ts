/**
 * Solana Wallet Types
 *
 * Type definitions for Solana wallet integration.
 * These types match the interface of injected Solana wallet providers
 * like Phantom, Solflare, and Backpack.
 */

import type { HexString } from '@sip-protocol/types'

/**
 * Solana public key interface
 * Matches @solana/web3.js PublicKey
 */
export interface SolanaPublicKey {
  toBase58(): string
  toBytes(): Uint8Array
  toString(): string
}

/**
 * Solana transaction interface
 * Matches @solana/web3.js Transaction
 */
export interface SolanaTransaction {
  /** Transaction signature after signing */
  signature?: Uint8Array
  /** Serialized transaction */
  serialize(): Uint8Array
  /** Add signature to transaction */
  addSignature(pubkey: SolanaPublicKey, signature: Uint8Array): void
}

/**
 * Solana versioned transaction (v0)
 * Matches @solana/web3.js VersionedTransaction
 */
export interface SolanaVersionedTransaction {
  serialize(): Uint8Array
  signatures: Uint8Array[]
}

/**
 * Solana send options
 */
export interface SolanaSendOptions {
  /** Skip preflight transaction checks */
  skipPreflight?: boolean
  /** Preflight commitment level */
  preflightCommitment?: 'processed' | 'confirmed' | 'finalized'
  /** Maximum retries */
  maxRetries?: number
}

/**
 * Solana connection interface for RPC calls
 */
export interface SolanaConnection {
  /** Get account balance in lamports */
  getBalance(publicKey: SolanaPublicKey): Promise<number>
  /** Get token account balance */
  getTokenAccountBalance(publicKey: SolanaPublicKey): Promise<{
    value: { amount: string; decimals: number }
  }>
  /** Get latest blockhash */
  getLatestBlockhash(): Promise<{
    blockhash: string
    lastValidBlockHeight: number
  }>
  /** Send raw transaction */
  sendRawTransaction(
    rawTransaction: Uint8Array,
    options?: SolanaSendOptions
  ): Promise<string>
  /** Confirm transaction */
  confirmTransaction(
    signature: string,
    commitment?: 'processed' | 'confirmed' | 'finalized'
  ): Promise<{ value: { err: unknown } }>
}

/**
 * Injected Solana wallet provider interface
 * This is what Phantom/Solflare/etc inject into window
 */
export interface SolanaWalletProvider {
  /** Provider is Phantom */
  isPhantom?: boolean
  /** Provider is Solflare */
  isSolflare?: boolean
  /** Provider is Backpack */
  isBackpack?: boolean
  /** Public key when connected */
  publicKey: SolanaPublicKey | null
  /** Whether wallet is connected */
  isConnected: boolean
  /** Connect to wallet */
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: SolanaPublicKey }>
  /** Disconnect from wallet */
  disconnect(): Promise<void>
  /** Sign a message */
  signMessage(message: Uint8Array, encoding?: 'utf8'): Promise<{ signature: Uint8Array }>
  /** Sign a transaction */
  signTransaction<T extends SolanaTransaction | SolanaVersionedTransaction>(
    transaction: T
  ): Promise<T>
  /** Sign multiple transactions */
  signAllTransactions<T extends SolanaTransaction | SolanaVersionedTransaction>(
    transactions: T[]
  ): Promise<T[]>
  /** Sign and send transaction */
  signAndSendTransaction<T extends SolanaTransaction | SolanaVersionedTransaction>(
    transaction: T,
    options?: SolanaSendOptions
  ): Promise<{ signature: string }>
  /** Event handling */
  on(event: 'connect' | 'disconnect' | 'accountChanged', handler: (...args: unknown[]) => void): void
  off(event: 'connect' | 'disconnect' | 'accountChanged', handler: (...args: unknown[]) => void): void
}

/**
 * Solana wallet name/type
 */
export type SolanaWalletName = 'phantom' | 'solflare' | 'backpack' | 'generic'

/**
 * Solana network/cluster
 */
export type SolanaCluster = 'mainnet-beta' | 'testnet' | 'devnet' | 'localnet'

/**
 * Solana adapter configuration
 */
export interface SolanaAdapterConfig {
  /** Wallet to connect to */
  wallet?: SolanaWalletName
  /** Solana cluster/network */
  cluster?: SolanaCluster
  /** RPC endpoint URL */
  rpcEndpoint?: string
  /** Custom wallet provider (for testing) */
  provider?: SolanaWalletProvider
  /** Custom connection (for testing) */
  connection?: SolanaConnection
}

/**
 * Solana-specific unsigned transaction
 */
export interface SolanaUnsignedTransaction {
  /** The Solana transaction object */
  transaction: SolanaTransaction | SolanaVersionedTransaction
  /** Whether this is a versioned transaction */
  isVersioned?: boolean
  /** Send options */
  sendOptions?: SolanaSendOptions
}

/**
 * Extended signature with Solana-specific data
 */
export interface SolanaSignature {
  /** Raw signature bytes */
  signature: HexString
  /** Solana public key (base58) */
  publicKey: HexString
  /** Base58 encoded signature (Solana standard) */
  base58Signature?: string
}

/**
 * Get the injected Solana wallet provider
 */
export function getSolanaProvider(wallet: SolanaWalletName = 'phantom'): SolanaWalletProvider | undefined {
  if (typeof window === 'undefined') return undefined

  const win = window as unknown as {
    phantom?: { solana?: SolanaWalletProvider }
    solflare?: SolanaWalletProvider
    backpack?: { solana?: SolanaWalletProvider }
    solana?: SolanaWalletProvider
  }

  switch (wallet) {
    case 'phantom':
      return win.phantom?.solana
    case 'solflare':
      return win.solflare
    case 'backpack':
      return win.backpack?.solana
    case 'generic':
    default:
      // Try to find any available provider
      return win.phantom?.solana ?? win.solflare ?? win.backpack?.solana ?? win.solana
  }
}

/**
 * Detect which Solana wallets are installed
 */
export function detectSolanaWallets(): SolanaWalletName[] {
  if (typeof window === 'undefined') return []

  const detected: SolanaWalletName[] = []
  const win = window as unknown as {
    phantom?: { solana?: SolanaWalletProvider }
    solflare?: SolanaWalletProvider
    backpack?: { solana?: SolanaWalletProvider }
  }

  if (win.phantom?.solana) detected.push('phantom')
  if (win.solflare) detected.push('solflare')
  if (win.backpack?.solana) detected.push('backpack')

  return detected
}

/**
 * Convert Solana public key to hex string
 */
export function solanaPublicKeyToHex(pubkey: SolanaPublicKey): HexString {
  const bytes = pubkey.toBytes()
  return ('0x' + Buffer.from(bytes).toString('hex')) as HexString
}

/**
 * Convert base58 string to hex
 */
export function base58ToHex(base58: string): HexString {
  // Simple base58 alphabet
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const ALPHABET_MAP: Record<string, number> = {}
  for (let i = 0; i < ALPHABET.length; i++) {
    ALPHABET_MAP[ALPHABET[i]] = i
  }

  let result = 0n
  for (const char of base58) {
    const value = ALPHABET_MAP[char]
    if (value === undefined) throw new Error(`Invalid base58 character: ${char}`)
    result = result * 58n + BigInt(value)
  }

  let hex = result.toString(16)
  // Pad to even length
  if (hex.length % 2 !== 0) hex = '0' + hex
  // Handle leading zeros
  for (let i = 0; i < base58.length && base58[i] === '1'; i++) {
    hex = '00' + hex
  }

  return ('0x' + hex) as HexString
}
