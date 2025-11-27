/**
 * Asset and chain types for SIP Protocol
 */

import type { ChainId } from './stealth'
import type { HexString } from './crypto'

/**
 * Token/asset identifier
 */
export interface Asset {
  /** Chain the asset is on */
  chain: ChainId
  /** Token symbol (e.g., 'SOL', 'ETH', 'USDC') */
  symbol: string
  /** Token contract address (null for native tokens) */
  address: HexString | null
  /** Number of decimals */
  decimals: number
}

/**
 * Common token definitions
 */
export const NATIVE_TOKENS: Record<ChainId, Asset> = {
  solana: { chain: 'solana', symbol: 'SOL', address: null, decimals: 9 },
  ethereum: { chain: 'ethereum', symbol: 'ETH', address: null, decimals: 18 },
  near: { chain: 'near', symbol: 'NEAR', address: null, decimals: 24 },
  zcash: { chain: 'zcash', symbol: 'ZEC', address: null, decimals: 8 },
  polygon: { chain: 'polygon', symbol: 'MATIC', address: null, decimals: 18 },
  arbitrum: { chain: 'arbitrum', symbol: 'ETH', address: null, decimals: 18 },
  optimism: { chain: 'optimism', symbol: 'ETH', address: null, decimals: 18 },
  base: { chain: 'base', symbol: 'ETH', address: null, decimals: 18 },
}

/**
 * Amount with asset information
 */
export interface AssetAmount {
  asset: Asset
  /** Amount in smallest unit (e.g., lamports, wei) */
  amount: bigint
}

/**
 * Input specification for an intent
 */
export interface IntentInput {
  /** The asset being sent */
  asset: Asset
  /** Amount in smallest unit */
  amount: bigint
  /** Source address (transparent mode only) */
  sourceAddress?: string
}

/**
 * Output specification for an intent
 */
export interface IntentOutput {
  /** The desired output asset */
  asset: Asset
  /** Minimum acceptable amount */
  minAmount: bigint
  /** Maximum acceptable slippage (0-1, e.g., 0.01 = 1%) */
  maxSlippage: number
}
