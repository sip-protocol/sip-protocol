/**
 * @solana/kit Compatibility Bridge
 *
 * Provides type converters and utilities for bridging between
 * @solana/web3.js and @solana/kit during incremental migration.
 *
 * This module enables file-by-file migration while keeping all tests passing.
 *
 * @module chains/solana/kit-compat
 */

import {
  address as kitAddress,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  type Address,
  type Rpc,
  type RpcSubscriptions,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  type Blockhash,
  type Commitment as KitCommitment,
} from '@solana/kit'
import {
  fromLegacyPublicKey,
  fromLegacyKeypair,
  fromLegacyTransactionInstruction,
  fromVersionedTransaction,
} from '@solana/compat'
import {
  Connection,
  PublicKey,
  Keypair,
  type Commitment,
  type TransactionInstruction,
  type VersionedTransaction,
} from '@solana/web3.js'

// ─── Type Re-exports ─────────────────────────────────────────────────────────

export type {
  Address,
  Rpc,
  RpcSubscriptions,
  SolanaRpcApi,
  SolanaRpcSubscriptionsApi,
  Blockhash,
}

// ─── Address Converters ──────────────────────────────────────────────────────

/**
 * Convert a web3.js PublicKey to a kit Address
 *
 * @param pubkey - web3.js PublicKey or string
 * @returns kit Address
 *
 * @example
 * ```typescript
 * const pubkey = new PublicKey('1234..5678')
 * const addr = toAddress(pubkey)
 * ```
 */
export function toAddress(pubkey: PublicKey | string): Address {
  if (typeof pubkey === 'string') {
    return kitAddress(pubkey)
  }
  return fromLegacyPublicKey(pubkey)
}

/**
 * Convert a kit Address to a web3.js PublicKey
 *
 * @param addr - kit Address (string)
 * @returns web3.js PublicKey
 *
 * @example
 * ```typescript
 * const addr: Address = '1234..5678'
 * const pubkey = toPublicKey(addr)
 * ```
 */
export function toPublicKey(addr: Address): PublicKey {
  return new PublicKey(addr)
}

/**
 * Create a kit Address from a base58 string
 *
 * @param base58 - Base58 encoded address
 * @returns kit Address
 */
export function createAddress(base58: string): Address {
  return kitAddress(base58)
}

// ─── Keypair Converters ──────────────────────────────────────────────────────

/**
 * Convert a web3.js Keypair to a kit CryptoKeyPair
 *
 * @param keypair - web3.js Keypair
 * @returns Promise<CryptoKeyPair>
 *
 * @example
 * ```typescript
 * const keypair = Keypair.generate()
 * const cryptoKeyPair = await toKeyPair(keypair)
 * ```
 */
export async function toKeyPair(keypair: Keypair): Promise<CryptoKeyPair> {
  return fromLegacyKeypair(keypair)
}

// ─── Instruction Converters ──────────────────────────────────────────────────

/**
 * Convert a web3.js TransactionInstruction to kit instruction format
 *
 * @param instruction - web3.js TransactionInstruction
 * @returns kit instruction
 */
export function toKitInstruction(instruction: TransactionInstruction) {
  return fromLegacyTransactionInstruction(instruction)
}

// ─── Transaction Converters ──────────────────────────────────────────────────

/**
 * Convert a web3.js VersionedTransaction to kit format
 *
 * @param transaction - web3.js VersionedTransaction
 * @returns kit transaction
 */
export function toKitTransaction(transaction: VersionedTransaction) {
  return fromVersionedTransaction(transaction)
}

// ─── RPC Client Factory ──────────────────────────────────────────────────────

/**
 * Dual RPC client that provides both kit's modern RPC and legacy Connection
 *
 * This allows gradual migration - use rpc for new code, legacyConnection for
 * code that still depends on web3.js patterns.
 */
export interface DualRpcClient {
  /** Modern kit RPC client */
  rpc: Rpc<SolanaRpcApi>
  /** Modern kit RPC subscriptions client */
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>
  /** Legacy web3.js Connection for backward compatibility */
  legacyConnection: Connection
  /** HTTP endpoint */
  endpoint: string
  /** WebSocket endpoint */
  wsEndpoint: string
}

/**
 * Create a dual RPC client that provides both kit and legacy Connection
 *
 * @param endpoint - HTTP RPC endpoint
 * @param wsEndpoint - WebSocket endpoint (optional, derived from HTTP if not provided)
 * @param commitment - Default commitment level
 * @returns DualRpcClient with both modern and legacy APIs
 *
 * @example
 * ```typescript
 * const client = createDualRpcClient('https://api.devnet.solana.com')
 *
 * // Use kit's modern API
 * const { value: balance } = await client.rpc.getBalance(addr).send()
 *
 * // Use legacy Connection when needed
 * const balance2 = await client.legacyConnection.getBalance(pubkey)
 * ```
 */
export function createDualRpcClient(
  endpoint: string,
  wsEndpoint?: string,
  commitment: Commitment = 'confirmed'
): DualRpcClient {
  // Derive WebSocket endpoint if not provided
  const derivedWsEndpoint = wsEndpoint ?? deriveWsEndpoint(endpoint)

  // Create kit RPC clients
  const rpc = createSolanaRpc(endpoint)
  const rpcSubscriptions = createSolanaRpcSubscriptions(derivedWsEndpoint)

  // Create legacy Connection
  const legacyConnection = new Connection(endpoint, {
    commitment,
    wsEndpoint: derivedWsEndpoint,
  })

  return {
    rpc,
    rpcSubscriptions,
    legacyConnection,
    endpoint,
    wsEndpoint: derivedWsEndpoint,
  }
}

/**
 * Derive WebSocket endpoint from HTTP endpoint
 */
function deriveWsEndpoint(httpEndpoint: string): string {
  const url = new URL(httpEndpoint)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

// ─── Commitment Conversion ───────────────────────────────────────────────────

/**
 * Convert web3.js Commitment to kit Commitment
 * Both use the same string literals, so this is mainly for type safety
 */
export function toKitCommitment(commitment: Commitment): KitCommitment {
  return commitment as KitCommitment
}

// ─── Blockhash Utilities ─────────────────────────────────────────────────────

/**
 * Create a typed Blockhash from a string
 */
export function createBlockhash(hash: string): Blockhash {
  return hash as Blockhash
}

/**
 * Convert kit blockhash response to legacy format
 */
export function toBlockhashInfo(kitResponse: {
  value: { blockhash: Blockhash; lastValidBlockHeight: bigint }
}): { blockhash: string; lastValidBlockHeight: number } {
  return {
    blockhash: kitResponse.value.blockhash,
    lastValidBlockHeight: Number(kitResponse.value.lastValidBlockHeight),
  }
}

// ─── Amount Conversion ───────────────────────────────────────────────────────

/**
 * Lamports per SOL constant
 * Replace LAMPORTS_PER_SOL from web3.js
 */
export const LAMPORTS_PER_SOL = 1_000_000_000n

/**
 * Convert SOL to lamports (bigint)
 */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * Number(LAMPORTS_PER_SOL)))
}

/**
 * Convert lamports to SOL (number)
 */
export function lamportsToSol(lamports: bigint | number): number {
  return Number(lamports) / Number(LAMPORTS_PER_SOL)
}

// ─── Type Guards ─────────────────────────────────────────────────────────────

/**
 * Check if a value is a kit Address
 */
export function isAddress(value: unknown): value is Address {
  return typeof value === 'string' && value.length >= 32 && value.length <= 44
}

/**
 * Check if a value is a web3.js PublicKey
 */
export function isPublicKey(value: unknown): value is PublicKey {
  return value instanceof PublicKey
}

// ─── Migration Helpers ───────────────────────────────────────────────────────

/**
 * Normalize an address input to both formats
 * Useful during migration when code may receive either type
 */
export function normalizeAddress(input: PublicKey | Address | string): {
  address: Address
  publicKey: PublicKey
  base58: string
} {
  let base58: string
  if (input instanceof PublicKey) {
    base58 = input.toBase58()
  } else {
    base58 = input
  }

  return {
    address: kitAddress(base58),
    publicKey: new PublicKey(base58),
    base58,
  }
}

/**
 * Create kit-compatible RPC response helpers
 */
export const RpcHelpers = {
  /**
   * Extract value from kit RPC response
   * kit returns { value: T, context: { slot } }
   */
  getValue<T>(response: { value: T }): T {
    return response.value
  },

  /**
   * Extract slot from kit RPC response context
   */
  getSlot(response: { context: { slot: bigint } }): bigint {
    return response.context.slot
  },

  /**
   * Convert bigint slot to number (for legacy compatibility)
   */
  getSlotNumber(response: { context: { slot: bigint } }): number {
    return Number(response.context.slot)
  },
}
