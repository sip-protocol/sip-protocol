import { vi } from 'vitest'
import type { SettlementBackend, SettlementQuote, SettlementResult } from '@sip-protocol/types'

// Test fixtures
export const TEST_FIXTURES = {
  // Valid secp256k1 private key (32 bytes)
  privateKey: '0x' + '01'.repeat(32),

  // Valid spending public key (33 bytes compressed)
  spendingKey: '0x02' + '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'.slice(4),

  // Valid viewing public key (33 bytes compressed)
  viewingKey: '0x03' + 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5'.slice(4),

  // Valid stealth address
  stealthAddress: 'sip:eth:0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798:0x03c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',

  // Test amounts
  amount: BigInt(1000000), // 1 USDC

  // Test tokens
  sourceToken: 'USDC',
  destToken: 'USDT',
  sourceChain: 'ethereum',
  destChain: 'polygon',
}

// Mock Settlement Backend
export class MockSettlementBackend implements SettlementBackend {
  name = 'mock-backend'
  version = '1.0.0'

  async initialize() {
    return
  }

  async getQuote(): Promise<SettlementQuote> {
    return {
      id: 'quote-' + Math.random().toString(36).slice(2),
      sourceAmount: TEST_FIXTURES.amount,
      destAmount: BigInt(995000), // 0.5% slippage
      estimatedTime: 30,
      fees: {
        network: BigInt(1000),
        protocol: BigInt(4000),
      },
      route: ['ethereum', 'polygon'],
      expiresAt: Date.now() + 60000,
    }
  }

  async submitIntent(): Promise<SettlementResult> {
    return {
      intentId: 'intent-' + Math.random().toString(36).slice(2),
      status: 'pending',
      txHash: '0xmock' + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
    }
  }

  async getIntentStatus() {
    return {
      status: 'fulfilled' as const,
      txHash: '0xmock' + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
    }
  }

  async cancel() {
    return {
      success: true,
      txHash: '0xcancel' + Math.random().toString(36).slice(2),
    }
  }
}

// Mock NEAR Intents Adapter
export const mockNearIntents = {
  getQuote: vi.fn().mockResolvedValue({
    id: 'near-quote-123',
    sourceAmount: TEST_FIXTURES.amount,
    destAmount: BigInt(995000),
    estimatedTime: 30,
    fees: {
      network: BigInt(1000),
      protocol: BigInt(4000),
    },
    route: ['ethereum', 'near'],
    expiresAt: Date.now() + 60000,
  }),
  submitIntent: vi.fn().mockResolvedValue({
    intentId: 'near-intent-123',
    status: 'pending',
    txHash: '0xnear123',
    timestamp: Date.now(),
  }),
}

// Mock Zcash RPC
export const mockZcashRpc = {
  getShieldedBalance: vi.fn().mockResolvedValue(BigInt(10000000)),
  createShieldedTransaction: vi.fn().mockResolvedValue({
    txid: 'zcash-tx-123',
    hex: '0xzcash',
  }),
}

// Test utilities
export function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Helper to create mock API server
export function createMockApiServer() {
  const handlers = new Map<string, Function>()

  return {
    on: (endpoint: string, handler: Function) => {
      handlers.set(endpoint, handler)
    },
    call: async (endpoint: string, data: any) => {
      const handler = handlers.get(endpoint)
      if (!handler) throw new Error(`No handler for ${endpoint}`)
      return handler(data)
    },
    close: () => {
      handlers.clear()
    },
  }
}

// Setup global test environment
beforeAll(() => {
  // Suppress console logs during tests unless VERBOSE=1
  if (!process.env.VERBOSE) {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  }
})

afterAll(() => {
  vi.restoreAllMocks()
})
