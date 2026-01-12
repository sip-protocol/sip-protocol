/**
 * PrivacyCash SDK Type Definitions
 *
 * Type definitions for the `privacycash` npm package.
 * These types are based on the SDK's public API.
 *
 * @see https://github.com/Privacy-Cash/privacy-cash-sdk
 */

/**
 * Supported pool sizes for SOL deposits (in lamports)
 */
export const SOL_POOL_SIZES = {
  /** 0.1 SOL pool */
  SMALL: BigInt(100_000_000),
  /** 1 SOL pool */
  MEDIUM: BigInt(1_000_000_000),
  /** 10 SOL pool */
  LARGE: BigInt(10_000_000_000),
  /** 100 SOL pool */
  WHALE: BigInt(100_000_000_000),
} as const

/**
 * Supported pool sizes for USDC deposits (in smallest units, 6 decimals)
 */
export const USDC_POOL_SIZES = {
  /** 10 USDC pool */
  SMALL: BigInt(10_000_000),
  /** 100 USDC pool */
  MEDIUM: BigInt(100_000_000),
  /** 1,000 USDC pool */
  LARGE: BigInt(1_000_000_000),
  /** 10,000 USDC pool */
  WHALE: BigInt(10_000_000_000),
} as const

/**
 * Supported pool sizes for USDT deposits (in smallest units, 6 decimals)
 */
export const USDT_POOL_SIZES = {
  /** 10 USDT pool */
  SMALL: BigInt(10_000_000),
  /** 100 USDT pool */
  MEDIUM: BigInt(100_000_000),
  /** 1,000 USDT pool */
  LARGE: BigInt(1_000_000_000),
  /** 10,000 USDT pool */
  WHALE: BigInt(10_000_000_000),
} as const

/**
 * All supported SOL pool amounts as array
 */
export const SOL_POOL_AMOUNTS = [
  SOL_POOL_SIZES.SMALL,
  SOL_POOL_SIZES.MEDIUM,
  SOL_POOL_SIZES.LARGE,
  SOL_POOL_SIZES.WHALE,
] as const

/**
 * All supported SPL pool amounts as array
 */
export const SPL_POOL_AMOUNTS = [
  USDC_POOL_SIZES.SMALL,
  USDC_POOL_SIZES.MEDIUM,
  USDC_POOL_SIZES.LARGE,
  USDC_POOL_SIZES.WHALE,
] as const

/**
 * Supported SPL tokens for PrivacyCash
 */
export type PrivacyCashSPLToken = 'USDC' | 'USDT'

/**
 * SPL token mint addresses on Solana mainnet
 */
export const SPL_TOKEN_MINTS: Record<PrivacyCashSPLToken, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
}

/**
 * Configuration for PrivacyCash SDK connection
 */
export interface PrivacyCashConfig {
  /** Solana RPC endpoint URL */
  rpcUrl: string
  /** Network type */
  network: 'mainnet-beta' | 'devnet'
  /** Optional relayer URL for withdrawals */
  relayerUrl?: string
}

/**
 * Deposit parameters for SOL
 */
export interface DepositParams {
  /** Amount to deposit (must match a pool size) */
  amount: bigint
  /** Sender's keypair or wallet adapter */
  wallet: unknown
}

/**
 * Deposit parameters for SPL tokens
 */
export interface DepositSPLParams extends DepositParams {
  /** SPL token type */
  token: PrivacyCashSPLToken
}

/**
 * Withdrawal parameters for SOL
 */
export interface WithdrawParams {
  /** Amount to withdraw (must match deposit amount) */
  amount: bigint
  /** Recipient address */
  recipient: string
  /** ZK proof note from deposit */
  note: string
}

/**
 * Withdrawal parameters for SPL tokens
 */
export interface WithdrawSPLParams extends WithdrawParams {
  /** SPL token type */
  token: PrivacyCashSPLToken
}

/**
 * Deposit result
 */
export interface DepositResult {
  /** Transaction signature */
  signature: string
  /** Secret note for withdrawal (must be saved!) */
  note: string
  /** Pool the deposit went into */
  poolSize: bigint
}

/**
 * Withdrawal result
 */
export interface WithdrawResult {
  /** Transaction signature */
  signature: string
  /** Amount withdrawn */
  amount: bigint
}

/**
 * Pool information
 */
export interface PoolInfo {
  /** Pool size (deposit amount) */
  size: bigint
  /** Current number of deposits in pool (anonymity set) */
  depositors: number
  /** Total liquidity in pool */
  liquidity: bigint
  /** Whether pool has sufficient liquidity for withdrawal */
  withdrawable: boolean
}

/**
 * Private balance information
 */
export interface PrivateBalance {
  /** Total private balance */
  total: bigint
  /** Breakdown by pool size */
  byPool: Array<{
    poolSize: bigint
    count: number
    amount: bigint
  }>
}

/**
 * PrivacyCash SDK interface (mocked for type safety)
 *
 * The actual SDK requires Node 24+ and is not directly imported.
 * This interface defines the expected API for our adapter.
 */
export interface IPrivacyCashSDK {
  /** Initialize connection */
  connect(config: PrivacyCashConfig): Promise<void>

  /** Deposit SOL into privacy pool */
  deposit(params: DepositParams): Promise<DepositResult>

  /** Withdraw SOL from privacy pool */
  withdraw(params: WithdrawParams): Promise<WithdrawResult>

  /** Get private SOL balance */
  getPrivateBalance(address: string): Promise<PrivateBalance>

  /** Deposit SPL token into privacy pool */
  depositSPL(params: DepositSPLParams): Promise<DepositResult>

  /** Withdraw SPL token from privacy pool */
  withdrawSPL(params: WithdrawSPLParams): Promise<WithdrawResult>

  /** Get private SPL token balance */
  getPrivateBalanceSpl(
    address: string,
    token: PrivacyCashSPLToken
  ): Promise<PrivateBalance>

  /** Get pool information */
  getPoolInfo(size: bigint, token?: PrivacyCashSPLToken): Promise<PoolInfo>
}

/**
 * Find the closest matching pool size for an amount
 *
 * @param amount - The desired amount
 * @param isSOL - Whether this is SOL (true) or SPL token (false)
 * @returns The matching pool size or undefined if no match
 */
export function findMatchingPoolSize(
  amount: bigint,
  isSOL: boolean
): bigint | undefined {
  const pools = isSOL ? SOL_POOL_AMOUNTS : SPL_POOL_AMOUNTS
  return pools.find(pool => pool === amount)
}

/**
 * Find the nearest pool size for an amount (for estimation)
 *
 * @param amount - The desired amount
 * @param isSOL - Whether this is SOL (true) or SPL token (false)
 * @returns The nearest pool size
 */
export function findNearestPoolSize(amount: bigint, isSOL: boolean): bigint {
  const pools = isSOL ? SOL_POOL_AMOUNTS : SPL_POOL_AMOUNTS

  let nearest = pools[0]
  let minDiff = amount > nearest ? amount - nearest : nearest - amount

  for (const pool of pools) {
    const diff = amount > pool ? amount - pool : pool - amount
    if (diff < minDiff) {
      minDiff = diff
      nearest = pool
    }
  }

  return nearest
}

/**
 * Check if an amount matches any supported pool size
 *
 * @param amount - The amount to check
 * @param isSOL - Whether this is SOL (true) or SPL token (false)
 * @returns True if amount matches a pool size
 */
export function isValidPoolAmount(amount: bigint, isSOL: boolean): boolean {
  return findMatchingPoolSize(amount, isSOL) !== undefined
}

/**
 * Get all available pool sizes for a token type
 *
 * @param isSOL - Whether this is SOL (true) or SPL token (false)
 * @returns Array of pool sizes
 */
export function getAvailablePoolSizes(isSOL: boolean): readonly bigint[] {
  return isSOL ? SOL_POOL_AMOUNTS : SPL_POOL_AMOUNTS
}
