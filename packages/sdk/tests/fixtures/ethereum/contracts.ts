/**
 * Ethereum Contract Fixtures
 *
 * Mock contract definitions for EIP-5564 Stealth Address Announcer
 * and common ERC-20 tokens for testing.
 */

import type { HexString } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockERC20Token {
  /** Human-readable name */
  name: string
  /** Token symbol */
  symbol: string
  /** Decimal places */
  decimals: number
  /** Contract address */
  address: HexString
  /** Total supply in smallest unit */
  totalSupply: bigint
  /** Whether this is a test token (not real) */
  isTestToken: boolean
}

export interface MockTokenBalance {
  /** Token reference */
  token: MockERC20Token
  /** Balance in smallest unit */
  balance: bigint
}

export interface StealthAnnouncerContract {
  /** Contract address */
  address: HexString
  /** EIP-5564 scheme ID supported */
  schemeId: number
  /** Network chain ID */
  chainId: number
  /** Contract name */
  name: string
}

export interface StealthAnnouncement {
  /** Scheme ID (1 = secp256k1) */
  schemeId: number
  /** Stealth address receiving the payment */
  stealthAddress: HexString
  /** Ephemeral public key for deriving shared secret */
  ephemeralPubKey: HexString
  /** View tag for efficient scanning */
  viewTag: number
  /** Optional metadata (encrypted or plaintext) */
  metadata: HexString
  /** Transaction hash of the announcement */
  txHash: HexString
  /** Block number */
  blockNumber: number
  /** Log index within the block */
  logIndex: number
}

// ─── ERC-20 Token Definitions ─────────────────────────────────────────────────

/**
 * USDC - Circle USD Stablecoin (Mainnet)
 */
export const USDC: MockERC20Token = {
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as HexString,
  totalSupply: 50_000_000_000n * 10n ** 6n, // 50B
  isTestToken: false,
}

/**
 * USDT - Tether USD (Mainnet)
 */
export const USDT: MockERC20Token = {
  name: 'Tether USD',
  symbol: 'USDT',
  decimals: 6,
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7' as HexString,
  totalSupply: 80_000_000_000n * 10n ** 6n, // 80B
  isTestToken: false,
}

/**
 * DAI - MakerDAO Stablecoin (Mainnet)
 */
export const DAI: MockERC20Token = {
  name: 'Dai Stablecoin',
  symbol: 'DAI',
  decimals: 18,
  address: '0x6b175474e89094c44da98b954eedeac495271d0f' as HexString,
  totalSupply: 5_000_000_000n * 10n ** 18n, // 5B
  isTestToken: false,
}

/**
 * WETH - Wrapped Ether (Mainnet)
 */
export const WETH: MockERC20Token = {
  name: 'Wrapped Ether',
  symbol: 'WETH',
  decimals: 18,
  address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' as HexString,
  totalSupply: 3_000_000n * 10n ** 18n, // 3M
  isTestToken: false,
}

/**
 * UNI - Uniswap Token (Mainnet)
 */
export const UNI: MockERC20Token = {
  name: 'Uniswap',
  symbol: 'UNI',
  decimals: 18,
  address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' as HexString,
  totalSupply: 1_000_000_000n * 10n ** 18n, // 1B
  isTestToken: false,
}

// ─── Test Token Definitions ───────────────────────────────────────────────────

/**
 * Test USDC for local/testnet testing
 */
export const TEST_USDC: MockERC20Token = {
  name: 'Test USD Coin',
  symbol: 'tUSDC',
  decimals: 6,
  address: '0x1234567890123456789012345678901234567890' as HexString,
  totalSupply: 1_000_000_000n * 10n ** 6n,
  isTestToken: true,
}

/**
 * Test token with 18 decimals
 */
export const TEST_TOKEN_18: MockERC20Token = {
  name: 'Test Token 18',
  symbol: 'TT18',
  decimals: 18,
  address: '0x2345678901234567890123456789012345678901' as HexString,
  totalSupply: 1_000_000n * 10n ** 18n,
  isTestToken: true,
}

/**
 * Test token with 0 decimals (NFT-like)
 */
export const TEST_TOKEN_0: MockERC20Token = {
  name: 'Test Token 0',
  symbol: 'TT0',
  decimals: 0,
  address: '0x3456789012345678901234567890123456789012' as HexString,
  totalSupply: 10_000n,
  isTestToken: true,
}

/**
 * Test token with 8 decimals (BTC-like)
 */
export const TEST_TOKEN_8: MockERC20Token = {
  name: 'Test Token 8',
  symbol: 'TT8',
  decimals: 8,
  address: '0x4567890123456789012345678901234567890123' as HexString,
  totalSupply: 21_000_000n * 10n ** 8n,
  isTestToken: true,
}

// ─── Token Collections ────────────────────────────────────────────────────────

export const mainnetTokens = [USDC, USDT, DAI, WETH, UNI] as const

export const testTokens = [TEST_USDC, TEST_TOKEN_18, TEST_TOKEN_0, TEST_TOKEN_8] as const

export const allTokens = [...mainnetTokens, ...testTokens] as const

// ─── EIP-5564 Stealth Announcer Contracts ─────────────────────────────────────

/**
 * EIP-5564 Stealth Meta-Address Registry (Mainnet)
 * Note: This is a placeholder address - use actual deployed address when available
 */
export const MAINNET_ANNOUNCER: StealthAnnouncerContract = {
  address: '0x55649e01b5df198d18d95b5cc5051630cffd41ff' as HexString, // Canonical EIP-5564 address
  schemeId: 1,
  chainId: 1,
  name: 'EIP-5564 Stealth Meta-Address Registry',
}

/**
 * Sepolia Testnet Announcer
 */
export const SEPOLIA_ANNOUNCER: StealthAnnouncerContract = {
  address: '0x55649e01b5df198d18d95b5cc5051630cffd41ff' as HexString,
  schemeId: 1,
  chainId: 11155111,
  name: 'EIP-5564 Stealth Meta-Address Registry (Sepolia)',
}

/**
 * Local/Anvil Test Announcer
 */
export const LOCAL_ANNOUNCER: StealthAnnouncerContract = {
  address: '0x5fbdb2315678afecb367f032d93f642f64180aa3' as HexString, // First Anvil deployment address
  schemeId: 1,
  chainId: 31337, // Anvil/Hardhat default
  name: 'EIP-5564 Local Test Announcer',
}

/**
 * Arbitrum One Announcer
 */
export const ARBITRUM_ANNOUNCER: StealthAnnouncerContract = {
  address: '0x55649e01b5df198d18d95b5cc5051630cffd41ff' as HexString,
  schemeId: 1,
  chainId: 42161,
  name: 'EIP-5564 Stealth Meta-Address Registry (Arbitrum)',
}

/**
 * Optimism Announcer
 */
export const OPTIMISM_ANNOUNCER: StealthAnnouncerContract = {
  address: '0x55649e01b5df198d18d95b5cc5051630cffd41ff' as HexString,
  schemeId: 1,
  chainId: 10,
  name: 'EIP-5564 Stealth Meta-Address Registry (Optimism)',
}

/**
 * Base Announcer
 */
export const BASE_ANNOUNCER: StealthAnnouncerContract = {
  address: '0x55649e01b5df198d18d95b5cc5051630cffd41ff' as HexString,
  schemeId: 1,
  chainId: 8453,
  name: 'EIP-5564 Stealth Meta-Address Registry (Base)',
}

/**
 * Polygon Announcer
 */
export const POLYGON_ANNOUNCER: StealthAnnouncerContract = {
  address: '0x55649e01b5df198d18d95b5cc5051630cffd41ff' as HexString,
  schemeId: 1,
  chainId: 137,
  name: 'EIP-5564 Stealth Meta-Address Registry (Polygon)',
}

export const announcerContracts = {
  mainnet: MAINNET_ANNOUNCER,
  sepolia: SEPOLIA_ANNOUNCER,
  local: LOCAL_ANNOUNCER,
  arbitrum: ARBITRUM_ANNOUNCER,
  optimism: OPTIMISM_ANNOUNCER,
  base: BASE_ANNOUNCER,
  polygon: POLYGON_ANNOUNCER,
} as const

// ─── Mock Announcement Factory ────────────────────────────────────────────────

let announcementIndex = 0

/**
 * Create a mock stealth announcement
 */
export function createMockAnnouncement(params: {
  stealthAddress: HexString
  ephemeralPubKey: HexString
  viewTag: number
  metadata?: HexString
  blockNumber?: number
}): StealthAnnouncement {
  announcementIndex++

  return {
    schemeId: 1,
    stealthAddress: params.stealthAddress,
    ephemeralPubKey: params.ephemeralPubKey,
    viewTag: params.viewTag,
    metadata: params.metadata || ('0x' as HexString),
    txHash: ('0x' + announcementIndex.toString(16).padStart(64, '0')) as HexString,
    blockNumber: params.blockNumber || 1000000 + announcementIndex,
    logIndex: 0,
  }
}

/**
 * Create a batch of mock announcements
 */
export function createMockAnnouncementBatch(
  count: number,
  baseParams: {
    stealthAddress: HexString
    ephemeralPubKey: HexString
  }
): StealthAnnouncement[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAnnouncement({
      ...baseParams,
      viewTag: i % 256,
      blockNumber: 1000000 + i,
    })
  )
}

// ─── Token Balance Utilities ──────────────────────────────────────────────────

/**
 * Create mock token balances for an account
 */
export function createMockTokenBalances(
  tokens: MockERC20Token[],
  balances: bigint[]
): MockTokenBalance[] {
  return tokens.map((token, i) => ({
    token,
    balance: balances[i] || 0n,
  }))
}

/**
 * Pre-configured token balances for Alice
 */
export const aliceTokenBalances: MockTokenBalance[] = [
  { token: TEST_USDC, balance: 10_000n * 10n ** 6n }, // 10,000 USDC
  { token: TEST_TOKEN_18, balance: 1_000n * 10n ** 18n }, // 1,000 tokens
]

/**
 * Pre-configured token balances for Bob
 */
export const bobTokenBalances: MockTokenBalance[] = [
  { token: TEST_USDC, balance: 5_000n * 10n ** 6n }, // 5,000 USDC
  { token: TEST_TOKEN_18, balance: 500n * 10n ** 18n }, // 500 tokens
]

// ─── Amount Utilities ─────────────────────────────────────────────────────────

/**
 * Convert human-readable amount to raw token amount
 */
export function toRawAmount(amount: number | string, decimals: number): bigint {
  const [whole, fraction = ''] = String(amount).split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + paddedFraction)
}

/**
 * Convert raw token amount to human-readable string
 */
export function fromRawAmount(rawAmount: bigint, decimals: number): string {
  const str = rawAmount.toString().padStart(decimals + 1, '0')
  const whole = str.slice(0, -decimals) || '0'
  const fraction = str.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/**
 * Format token amount with symbol
 */
export function formatTokenAmount(token: MockERC20Token, rawAmount: bigint): string {
  return `${fromRawAmount(rawAmount, token.decimals)} ${token.symbol}`
}

/**
 * Parse token amount string to raw amount
 */
export function parseTokenAmount(token: MockERC20Token, amountStr: string): bigint {
  return toRawAmount(amountStr.replace(token.symbol, '').trim(), token.decimals)
}

// ─── Contract ABI Fragments ───────────────────────────────────────────────────

/**
 * EIP-5564 Announcer ABI (minimal)
 */
export const ANNOUNCER_ABI = [
  {
    type: 'event',
    name: 'Announcement',
    inputs: [
      { name: 'schemeId', type: 'uint256', indexed: true },
      { name: 'stealthAddress', type: 'address', indexed: true },
      { name: 'caller', type: 'address', indexed: true },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'metadata', type: 'bytes' },
    ],
  },
  {
    type: 'function',
    name: 'announce',
    inputs: [
      { name: 'schemeId', type: 'uint256' },
      { name: 'stealthAddress', type: 'address' },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

/**
 * ERC-20 ABI (minimal)
 */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const
