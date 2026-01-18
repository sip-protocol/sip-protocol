/**
 * SPL Token Fixtures
 *
 * Mock token mint addresses and account data for testing.
 * Includes common tokens (USDC, USDT) and test-specific mints.
 */

// ── Token Types ────────────────────────────────────────────────────────────

export interface MockTokenMint {
  /** Token name */
  name: string
  /** Token symbol */
  symbol: string
  /** Mint address (Solana base58) */
  address: string
  /** Decimal places */
  decimals: number
  /** Is this a stablecoin? */
  isStable: boolean
  /** Token authority (null for immutable) */
  authority: string | null
  /** Total supply (optional) */
  supply?: bigint
}

export interface MockTokenAccount {
  /** Token account address */
  address: string
  /** Owner wallet address */
  owner: string
  /** Mint address */
  mint: string
  /** Balance in raw units */
  balance: bigint
  /** Delegate (if any) */
  delegate: string | null
  /** Delegated amount */
  delegatedAmount: bigint
  /** Is account frozen? */
  isFrozen: boolean
}

// ── Well-Known Token Mints ─────────────────────────────────────────────────

/**
 * USDC on Solana (real mainnet address for reference)
 */
export const USDC: MockTokenMint = {
  name: 'USD Coin',
  symbol: 'USDC',
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  decimals: 6,
  isStable: true,
  authority: null,
  supply: 30_000_000_000_000_000n, // 30 billion
}

/**
 * USDT on Solana (real mainnet address for reference)
 */
export const USDT: MockTokenMint = {
  name: 'Tether USD',
  symbol: 'USDT',
  address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  decimals: 6,
  isStable: true,
  authority: null,
  supply: 20_000_000_000_000_000n, // 20 billion
}

/**
 * Wrapped SOL
 */
export const WSOL: MockTokenMint = {
  name: 'Wrapped SOL',
  symbol: 'WSOL',
  address: 'So11111111111111111111111111111111111111112',
  decimals: 9,
  isStable: false,
  authority: null,
}

/**
 * BONK (meme coin for testing small decimals)
 */
export const BONK: MockTokenMint = {
  name: 'Bonk',
  symbol: 'BONK',
  address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  decimals: 5,
  isStable: false,
  authority: null,
}

// ── Test-Specific Token Mints ──────────────────────────────────────────────

/**
 * Test USDC (devnet)
 */
export const TEST_USDC: MockTokenMint = {
  name: 'Test USDC',
  symbol: 'tUSDC',
  address: 'TestUSDC1111111111111111111111111111111111111',
  decimals: 6,
  isStable: true,
  authority: 'TestAuthority111111111111111111111111111111',
  supply: 1_000_000_000_000_000n,
}

/**
 * Test token with 9 decimals (like SOL)
 */
export const TEST_TOKEN_9: MockTokenMint = {
  name: 'Test Token 9',
  symbol: 'TT9',
  address: 'TestToken911111111111111111111111111111111111',
  decimals: 9,
  isStable: false,
  authority: 'TestAuthority111111111111111111111111111111',
  supply: 100_000_000_000_000_000n,
}

/**
 * Test token with 0 decimals (NFT-like)
 */
export const TEST_TOKEN_0: MockTokenMint = {
  name: 'Test NFT Token',
  symbol: 'TNFT',
  address: 'TestNFT01111111111111111111111111111111111111',
  decimals: 0,
  isStable: false,
  authority: 'TestAuthority111111111111111111111111111111',
  supply: 10000n,
}

/**
 * Test token with 18 decimals (ERC20-like)
 */
export const TEST_TOKEN_18: MockTokenMint = {
  name: 'Test Token 18',
  symbol: 'TT18',
  address: 'TestToken18111111111111111111111111111111111',
  decimals: 18,
  isStable: false,
  authority: 'TestAuthority111111111111111111111111111111',
  supply: 1_000_000_000_000_000_000_000_000_000n,
}

// ── Token Collections ──────────────────────────────────────────────────────

/**
 * All mainnet tokens
 */
export const mainnetTokens = {
  USDC,
  USDT,
  WSOL,
  BONK,
} as const

/**
 * All test tokens
 */
export const testTokens = {
  TEST_USDC,
  TEST_TOKEN_9,
  TEST_TOKEN_0,
  TEST_TOKEN_18,
} as const

/**
 * All tokens combined
 */
export const allTokens = {
  ...mainnetTokens,
  ...testTokens,
} as const

// ── Mock Token Account Helpers ─────────────────────────────────────────────

/**
 * Create a mock token account
 */
export function createMockTokenAccount(
  owner: string,
  mint: MockTokenMint,
  balance: bigint,
  options: {
    address?: string
    delegate?: string
    delegatedAmount?: bigint
    isFrozen?: boolean
  } = {}
): MockTokenAccount {
  return {
    address: options.address ?? `TokenAcct${owner.slice(0, 20)}${mint.symbol}`,
    owner,
    mint: mint.address,
    balance,
    delegate: options.delegate ?? null,
    delegatedAmount: options.delegatedAmount ?? 0n,
    isFrozen: options.isFrozen ?? false,
  }
}

/**
 * Create mock token accounts for a wallet with multiple tokens
 */
export function createWalletTokenAccounts(
  owner: string,
  balances: Array<{ mint: MockTokenMint; balance: bigint }>
): MockTokenAccount[] {
  return balances.map(({ mint, balance }, index) =>
    createMockTokenAccount(owner, mint, balance, {
      address: `TokenAcct${index}${owner.slice(0, 10)}${mint.symbol}`,
    })
  )
}

// ── Pre-built Token Account Fixtures ───────────────────────────────────────

import { aliceKeypair, bobKeypair, charlieKeypair } from './keypairs'

/**
 * Alice's token accounts
 */
export const aliceTokenAccounts = createWalletTokenAccounts(aliceKeypair.address, [
  { mint: USDC, balance: 10_000_000_000n }, // 10,000 USDC
  { mint: USDT, balance: 5_000_000_000n }, // 5,000 USDT
  { mint: TEST_USDC, balance: 100_000_000_000n }, // 100,000 test USDC
])

/**
 * Bob's token accounts
 */
export const bobTokenAccounts = createWalletTokenAccounts(bobKeypair.address, [
  { mint: USDC, balance: 500_000_000n }, // 500 USDC
  { mint: TEST_USDC, balance: 1_000_000_000n }, // 1,000 test USDC
])

/**
 * Charlie's token accounts
 */
export const charlieTokenAccounts = createWalletTokenAccounts(charlieKeypair.address, [
  { mint: USDC, balance: 2_000_000_000n }, // 2,000 USDC
  { mint: BONK, balance: 1_000_000_000_000n }, // 10,000,000 BONK
])

// ── Token Amount Utilities ─────────────────────────────────────────────────

/**
 * Convert human-readable amount to raw token units
 */
export function toRawAmount(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * 10 ** decimals))
}

/**
 * Convert raw token units to human-readable amount
 */
export function fromRawAmount(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals
}

/**
 * Format token amount with symbol
 */
export function formatTokenAmount(amount: bigint, mint: MockTokenMint): string {
  const human = fromRawAmount(amount, mint.decimals)
  return `${human.toLocaleString()} ${mint.symbol}`
}

/**
 * Parse token amount string (e.g., "100 USDC")
 */
export function parseTokenAmount(amountStr: string): { amount: bigint; mint: MockTokenMint } | null {
  const match = amountStr.match(/^([\d,.]+)\s*(\w+)$/)
  if (!match) return null

  const [, numStr, symbol] = match
  const amount = parseFloat(numStr.replace(/,/g, ''))

  // Find mint by symbol
  const mint = Object.values(allTokens).find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
  )
  if (!mint) return null

  return {
    amount: toRawAmount(amount, mint.decimals),
    mint,
  }
}

// ── Token Validation ───────────────────────────────────────────────────────

/**
 * Check if an address is a known token mint
 */
export function isKnownMint(address: string): boolean {
  return Object.values(allTokens).some((t) => t.address === address)
}

/**
 * Get token info by mint address
 */
export function getTokenByAddress(address: string): MockTokenMint | undefined {
  return Object.values(allTokens).find((t) => t.address === address)
}

/**
 * Get token info by symbol
 */
export function getTokenBySymbol(symbol: string): MockTokenMint | undefined {
  return Object.values(allTokens).find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
  )
}
