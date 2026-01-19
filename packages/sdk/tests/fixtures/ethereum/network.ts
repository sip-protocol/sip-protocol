/**
 * Ethereum Network Configuration Fixtures
 *
 * Configuration for Anvil, Hardhat, and testnet connections
 * for local and CI testing environments.
 */

import type { HexString } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkConfig {
  /** Human-readable name */
  name: string
  /** Chain ID */
  chainId: number
  /** RPC URL */
  rpcUrl: string
  /** Block explorer URL (optional) */
  explorerUrl?: string
  /** Native currency symbol */
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  /** Whether this is a test network */
  isTestnet: boolean
  /** Average block time in milliseconds */
  blockTime: number
}

export interface AnvilConfig extends NetworkConfig {
  /** Fork URL (if forking mainnet) */
  forkUrl?: string
  /** Fork block number */
  forkBlockNumber?: number
  /** Mnemonic for deterministic accounts */
  mnemonic: string
  /** Number of accounts to generate */
  accountCount: number
  /** Default balance per account (in ETH) */
  defaultBalance: string
  /** Auto-mine blocks */
  autoMine: boolean
  /** Block gas limit */
  blockGasLimit: number
}

export interface HardhatConfig extends NetworkConfig {
  /** Hardhat network settings */
  hardhat: {
    loggingEnabled: boolean
    mining: {
      auto: boolean
      interval: number
    }
    accounts: {
      mnemonic: string
      count: number
      accountsBalance: string
    }
  }
}

export interface MockRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: { code: number; message: string }
}

// ─── Network Configurations ───────────────────────────────────────────────────

/**
 * Local Anvil network configuration
 */
export const ANVIL_CONFIG: AnvilConfig = {
  name: 'Anvil Local',
  chainId: 31337,
  rpcUrl: 'http://127.0.0.1:8545',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  isTestnet: true,
  blockTime: 0, // Instant mining
  mnemonic: 'test test test test test test test test test test test junk',
  accountCount: 10,
  defaultBalance: '10000', // 10,000 ETH
  autoMine: true,
  blockGasLimit: 30_000_000,
}

/**
 * Local Hardhat network configuration
 */
export const HARDHAT_CONFIG: HardhatConfig = {
  name: 'Hardhat Local',
  chainId: 31337,
  rpcUrl: 'http://127.0.0.1:8545',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  isTestnet: true,
  blockTime: 0,
  hardhat: {
    loggingEnabled: false,
    mining: {
      auto: true,
      interval: 0,
    },
    accounts: {
      mnemonic: 'test test test test test test test test test test test junk',
      count: 10,
      accountsBalance: '10000000000000000000000', // 10,000 ETH in wei
    },
  },
}

/**
 * Sepolia testnet configuration
 */
export const SEPOLIA_CONFIG: NetworkConfig = {
  name: 'Sepolia',
  chainId: 11155111,
  rpcUrl: 'https://rpc.sepolia.org',
  explorerUrl: 'https://sepolia.etherscan.io',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'SEP',
    decimals: 18,
  },
  isTestnet: true,
  blockTime: 12000, // ~12 seconds
}

/**
 * Ethereum Mainnet configuration (for reference/forking)
 */
export const MAINNET_CONFIG: NetworkConfig = {
  name: 'Ethereum Mainnet',
  chainId: 1,
  rpcUrl: 'https://eth.llamarpc.com',
  explorerUrl: 'https://etherscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  isTestnet: false,
  blockTime: 12000,
}

/**
 * Arbitrum One configuration
 */
export const ARBITRUM_CONFIG: NetworkConfig = {
  name: 'Arbitrum One',
  chainId: 42161,
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  explorerUrl: 'https://arbiscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  isTestnet: false,
  blockTime: 250, // ~250ms
}

/**
 * Optimism configuration
 */
export const OPTIMISM_CONFIG: NetworkConfig = {
  name: 'Optimism',
  chainId: 10,
  rpcUrl: 'https://mainnet.optimism.io',
  explorerUrl: 'https://optimistic.etherscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  isTestnet: false,
  blockTime: 2000, // ~2 seconds
}

/**
 * Base configuration
 */
export const BASE_CONFIG: NetworkConfig = {
  name: 'Base',
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  explorerUrl: 'https://basescan.org',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  isTestnet: false,
  blockTime: 2000,
}

/**
 * Polygon configuration
 */
export const POLYGON_CONFIG: NetworkConfig = {
  name: 'Polygon',
  chainId: 137,
  rpcUrl: 'https://polygon-rpc.com',
  explorerUrl: 'https://polygonscan.com',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  isTestnet: false,
  blockTime: 2000,
}

export const networkConfigs = {
  anvil: ANVIL_CONFIG,
  hardhat: HARDHAT_CONFIG,
  sepolia: SEPOLIA_CONFIG,
  mainnet: MAINNET_CONFIG,
  arbitrum: ARBITRUM_CONFIG,
  optimism: OPTIMISM_CONFIG,
  base: BASE_CONFIG,
  polygon: POLYGON_CONFIG,
} as const

// ─── Mock RPC Handlers ────────────────────────────────────────────────────────

export type SyncMockRpcHandler = (method: string, params: unknown[]) => MockRpcResponse
export type AsyncMockRpcHandler = (method: string, params: unknown[]) => Promise<MockRpcResponse>
export type MockRpcHandler = SyncMockRpcHandler | AsyncMockRpcHandler

/**
 * Default mock RPC responses
 */
export const defaultMockResponses: Record<string, (params: unknown[]) => unknown> = {
  eth_chainId: () => '0x7a69', // 31337 in hex
  eth_blockNumber: () => '0xf4240', // 1000000
  eth_gasPrice: () => '0x4a817c800', // 20 gwei
  eth_getBalance: () => '0x56bc75e2d63100000', // 100 ETH
  eth_getTransactionCount: () => '0x0',
  eth_estimateGas: () => '0x5208', // 21000
  eth_call: () => '0x',
  eth_sendRawTransaction: () => '0x' + '1'.repeat(64),
  eth_getTransactionReceipt: (params: unknown[]) => ({
    transactionHash: params[0],
    blockNumber: '0xf4240',
    blockHash: '0x' + '2'.repeat(64),
    from: '0x' + '3'.repeat(40),
    to: '0x' + '4'.repeat(40),
    status: '0x1',
    gasUsed: '0x5208',
    logs: [],
  }),
  eth_getLogs: () => [],
  net_version: () => '31337',
  web3_clientVersion: () => 'MockClient/v1.0.0',
}

/**
 * Create a mock RPC handler with default responses
 */
export function createMockRpcHandler(
  overrides?: Partial<Record<string, (params: unknown[]) => unknown>>
): SyncMockRpcHandler {
  const handlers = { ...defaultMockResponses, ...overrides }

  return (method: string, params: unknown[]): MockRpcResponse => {
    const handler = handlers[method]
    if (handler) {
      return {
        jsonrpc: '2.0',
        id: 1,
        result: handler(params),
      }
    }
    return {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32601, message: `Method not found: ${method}` },
    }
  }
}

/**
 * Create a mock RPC handler that simulates network latency
 */
export function createMockRpcHandlerWithLatency(
  latencyMs: number,
  overrides?: Partial<Record<string, (params: unknown[]) => unknown>>
): MockRpcHandler {
  const baseHandler = createMockRpcHandler(overrides)

  return async (method: string, params: unknown[]): Promise<MockRpcResponse> => {
    await new Promise(resolve => setTimeout(resolve, latencyMs))
    return baseHandler(method, params)
  }
}

// ─── Block Fixtures ───────────────────────────────────────────────────────────

export interface MockBlock {
  number: HexString
  hash: HexString
  parentHash: HexString
  timestamp: HexString
  gasLimit: HexString
  gasUsed: HexString
  baseFeePerGas: HexString
  transactions: HexString[]
}

/**
 * Create a mock block
 */
export function createMockBlock(blockNumber: number, txCount = 0): MockBlock {
  const txs = Array.from({ length: txCount }, (_, i) =>
    ('0x' + (blockNumber * 1000 + i).toString(16).padStart(64, '0')) as HexString
  )

  return {
    number: ('0x' + blockNumber.toString(16)) as HexString,
    hash: ('0x' + blockNumber.toString(16).padStart(64, '0')) as HexString,
    parentHash: ('0x' + (blockNumber - 1).toString(16).padStart(64, '0')) as HexString,
    timestamp: ('0x' + Math.floor(Date.now() / 1000).toString(16)) as HexString,
    gasLimit: '0x1c9c380' as HexString, // 30M
    gasUsed: ('0x' + (txCount * 21000).toString(16)) as HexString,
    baseFeePerGas: '0x4a817c800' as HexString, // 20 gwei
    transactions: txs,
  }
}

// ─── Transaction Fixtures ─────────────────────────────────────────────────────

export interface MockTransaction {
  hash: HexString
  nonce: HexString
  from: HexString
  to: HexString
  value: HexString
  gasPrice: HexString
  gas: HexString
  input: HexString
  blockNumber: HexString
  blockHash: HexString
  transactionIndex: HexString
}

export interface MockTransactionReceipt {
  transactionHash: HexString
  blockNumber: HexString
  blockHash: HexString
  from: HexString
  to: HexString
  status: '0x1' | '0x0'
  gasUsed: HexString
  cumulativeGasUsed: HexString
  logs: MockLog[]
  logsBloom: HexString
}

export interface MockLog {
  address: HexString
  topics: HexString[]
  data: HexString
  blockNumber: HexString
  transactionHash: HexString
  logIndex: HexString
}

/**
 * Create a mock ETH transfer transaction
 */
export function createMockEthTransfer(params: {
  from: HexString
  to: HexString
  value: bigint
  nonce?: number
  blockNumber?: number
}): MockTransaction {
  return {
    hash: ('0x' + Math.random().toString(16).slice(2).padStart(64, '0')) as HexString,
    nonce: ('0x' + (params.nonce || 0).toString(16)) as HexString,
    from: params.from,
    to: params.to,
    value: ('0x' + params.value.toString(16)) as HexString,
    gasPrice: '0x4a817c800' as HexString,
    gas: '0x5208' as HexString,
    input: '0x' as HexString,
    blockNumber: ('0x' + (params.blockNumber || 1000000).toString(16)) as HexString,
    blockHash: ('0x' + (params.blockNumber || 1000000).toString(16).padStart(64, '0')) as HexString,
    transactionIndex: '0x0' as HexString,
  }
}

/**
 * Create a mock transaction receipt
 */
export function createMockReceipt(
  tx: MockTransaction,
  success = true,
  logs: MockLog[] = []
): MockTransactionReceipt {
  return {
    transactionHash: tx.hash,
    blockNumber: tx.blockNumber,
    blockHash: tx.blockHash,
    from: tx.from,
    to: tx.to,
    status: success ? '0x1' : '0x0',
    gasUsed: tx.gas,
    cumulativeGasUsed: tx.gas,
    logs,
    logsBloom: ('0x' + '0'.repeat(512)) as HexString,
  }
}

// ─── Stealth Announcement Log Fixtures ────────────────────────────────────────

/**
 * EIP-5564 Announcement event topic
 * keccak256("Announcement(uint256,address,address,bytes,bytes)")
 */
export const ANNOUNCEMENT_EVENT_TOPIC = '0x5f0eab8057630ba7676c49b4f1bb5c54e05b6d6d2d9f7d0f7b79c11c9f03ff9e' as HexString

/**
 * Create a mock Announcement log
 */
export function createMockAnnouncementLog(params: {
  contractAddress: HexString
  schemeId: number
  stealthAddress: HexString
  caller: HexString
  ephemeralPubKey: HexString
  viewTag: number
  blockNumber?: number
}): MockLog {
  // Encode schemeId as topic (indexed)
  const schemeIdTopic = ('0x' + params.schemeId.toString(16).padStart(64, '0')) as HexString
  // Encode stealthAddress as topic (indexed, padded to 32 bytes)
  const stealthAddressTopic = ('0x' + params.stealthAddress.slice(2).padStart(64, '0')) as HexString
  // Encode caller as topic (indexed, padded to 32 bytes)
  const callerTopic = ('0x' + params.caller.slice(2).padStart(64, '0')) as HexString

  // Encode non-indexed params as data
  // ephemeralPubKey (bytes) and metadata (bytes with viewTag)
  const ephemeralPubKeyHex = params.ephemeralPubKey.slice(2)
  const viewTagHex = params.viewTag.toString(16).padStart(2, '0')

  // ABI encode: offset1 (32) + offset2 (32) + len1 (32) + data1 + len2 (32) + data2
  const data = '0x' +
    '0000000000000000000000000000000000000000000000000000000000000040' + // offset to ephemeralPubKey
    '0000000000000000000000000000000000000000000000000000000000000080' + // offset to metadata
    '0000000000000000000000000000000000000000000000000000000000000021' + // length of ephemeralPubKey (33)
    ephemeralPubKeyHex.padEnd(64, '0') + // ephemeralPubKey padded
    '0000000000000000000000000000000000000000000000000000000000000001' + // length of metadata (1)
    viewTagHex.padEnd(64, '0') // viewTag padded

  return {
    address: params.contractAddress,
    topics: [ANNOUNCEMENT_EVENT_TOPIC, schemeIdTopic, stealthAddressTopic, callerTopic],
    data: data as HexString,
    blockNumber: ('0x' + (params.blockNumber || 1000000).toString(16)) as HexString,
    transactionHash: ('0x' + Math.random().toString(16).slice(2).padStart(64, '0')) as HexString,
    logIndex: '0x0' as HexString,
  }
}

// ─── Test Environment Setup ───────────────────────────────────────────────────

export interface TestEnvironmentConfig {
  /** Network to use */
  network: NetworkConfig
  /** Whether to skip network tests if not available */
  skipIfUnavailable: boolean
  /** Timeout for RPC calls in milliseconds */
  rpcTimeout: number
  /** Number of confirmations to wait for */
  confirmations: number
}

export const defaultTestEnvironment: TestEnvironmentConfig = {
  network: ANVIL_CONFIG,
  skipIfUnavailable: true,
  rpcTimeout: 30000,
  confirmations: 1,
}

/**
 * Check if a network is available
 */
export async function isNetworkAvailable(config: NetworkConfig): Promise<boolean> {
  try {
    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await response.json() as MockRpcResponse
    return data.result !== undefined
  } catch {
    return false
  }
}

/**
 * Create a conditional test that skips if network is unavailable
 */
export function describeIfNetwork(
  name: string,
  config: NetworkConfig,
  fn: () => void
): void {
  // This is a helper for test files to use
  // The actual describe/it.skip logic would be implemented in the test file
  console.log(`Network test suite: ${name} (${config.name})`)
  fn()
}
