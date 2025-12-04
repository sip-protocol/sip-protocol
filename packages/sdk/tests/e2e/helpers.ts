/**
 * E2E Test Helpers
 *
 * Utilities for end-to-end integration testing.
 * Provides mock wallets, network configurations, and test utilities.
 *
 * NETWORK NOTES:
 * - Individual chain RPCs (Solana, Ethereum, NEAR, Zcash) can use testnets
 * - NEAR Intents (1Click API) is MAINNET ONLY - no testnet deployment exists
 * - For 1Click swap testing, use MockSolver or small mainnet amounts ($5-10)
 */

import { vi } from 'vitest'
import {
  PrivacyLevel,
  IntentStatus,
  type ChainId,
  type HexString,
  type Asset,
  type ShieldedIntent,
  type StealthMetaAddress,
} from '@sip-protocol/types'
import { SIP, createSIP } from '../../src/sip'
import { MockProofProvider } from '../../src/proofs/mock'
import { MockSolver, createMockSolver } from '../../src/solver/mock-solver'
import { NEARIntentsAdapter } from '../../src/adapters/near-intents'
import { createMockSolanaAdapter } from '../../src/wallet/solana/mock'
import { createMockEthereumAdapter } from '../../src/wallet/ethereum/mock'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  encodeStealthMetaAddress,
} from '../../src/stealth'
import { commit, verifyOpening } from '../../src/commitment'
import { generateViewingKey, encryptForViewing, decryptWithViewing } from '../../src/privacy'

// ─── Network Configuration ──────────────────────────────────────────────────────

/**
 * Test network configuration for wallet/RPC testing
 * NOTE: These are chain-level testnets, NOT for NEAR Intents (which is mainnet-only)
 */
export interface TestnetConfig {
  /** Network identifier */
  network: 'testnet'
  /** RPC endpoints for each chain (testnet) */
  rpcEndpoints: Partial<Record<ChainId, string>>
  /** Test account addresses */
  accounts: Partial<Record<ChainId, string>>
  /** Test faucet URLs */
  faucets: Partial<Record<ChainId, string>>
}

/**
 * Default testnet configuration for wallet/RPC testing
 * NOTE: NEAR Intents (1Click) swaps require mainnet - use MockSolver for tests
 */
export const TESTNET_CONFIG: TestnetConfig = {
  network: 'testnet',
  rpcEndpoints: {
    solana: 'https://api.devnet.solana.com',
    ethereum: 'https://rpc.sepolia.org',
    near: 'https://rpc.testnet.near.org',
    zcash: 'http://localhost:18232', // Local testnet
  },
  accounts: {
    solana: 'test-wallet.devnet',
    ethereum: '0x742d35Cc6634C0532925a3b844Bc9e7595f8fB1b',
    near: 'test.testnet',
    zcash: 'ztestsapling1...',
  },
  faucets: {
    solana: 'https://faucet.solana.com',
    ethereum: 'https://sepoliafaucet.com',
    near: 'https://near-faucet.io',
    zcash: 'https://faucet.testnet.z.cash',
  },
}

// ─── Native Token Definitions ───────────────────────────────────────────────────

/**
 * Native tokens for testing
 */
export const NATIVE_TOKENS: Record<string, Asset> = {
  solana: {
    chain: 'solana' as ChainId,
    symbol: 'SOL',
    address: null,
    decimals: 9,
  },
  ethereum: {
    chain: 'ethereum' as ChainId,
    symbol: 'ETH',
    address: null,
    decimals: 18,
  },
  near: {
    chain: 'near' as ChainId,
    symbol: 'NEAR',
    address: null,
    decimals: 24,
  },
  zcash: {
    chain: 'zcash' as ChainId,
    symbol: 'ZEC',
    address: null,
    decimals: 8,
  },
}

// ─── Test Fixture Factory ───────────────────────────────────────────────────────

/**
 * E2E test fixture with all components initialized
 */
export interface E2ETestFixture {
  /** SIP client */
  sip: SIP
  /** Proof provider */
  proofProvider: MockProofProvider
  /** Mock solver */
  solver: MockSolver
  /** NEAR Intents adapter */
  nearAdapter: NEARIntentsAdapter
  /** Solana wallet adapter */
  solanaWallet: ReturnType<typeof createMockSolanaAdapter>
  /** Ethereum wallet adapter */
  ethereumWallet: ReturnType<typeof createMockEthereumAdapter>
  /** Stealth keys for Solana */
  solanaStealthKeys: ReturnType<typeof generateStealthMetaAddress>
  /** Stealth keys for Ethereum */
  ethereumStealthKeys: ReturnType<typeof generateStealthMetaAddress>
  /** Stealth keys for Zcash */
  zcashStealthKeys: ReturnType<typeof generateStealthMetaAddress>
  /** Cleanup function */
  cleanup: () => void
}

/**
 * Create a full E2E test fixture
 */
export async function createE2EFixture(): Promise<E2ETestFixture> {
  // Initialize proof provider
  const proofProvider = new MockProofProvider()
  await proofProvider.initialize()

  // Create SIP client
  const sip = new SIP({
    network: 'testnet',
    proofProvider,
  })

  // Create mock solver
  const solver = createMockSolver({
    name: 'E2E Test Solver',
    executionDelay: 100, // Fast for tests
    failureRate: 0,
  })

  // Create NEAR adapter
  const nearAdapter = new NEARIntentsAdapter({
    jwtToken: process.env.NEAR_INTENTS_JWT,
  })

  // Create wallet adapters with test balances
  const solanaWallet = createMockSolanaAdapter({
    balance: 10_000_000_000n, // 10 SOL
  })

  const ethereumWallet = createMockEthereumAdapter({
    balance: 5_000_000_000_000_000_000n, // 5 ETH
  })

  // Generate stealth keys for each chain
  const solanaStealthKeys = generateStealthMetaAddress('solana' as ChainId, 'Solana Test')
  const ethereumStealthKeys = generateStealthMetaAddress('ethereum' as ChainId, 'Ethereum Test')
  const zcashStealthKeys = generateStealthMetaAddress('zcash' as ChainId, 'Zcash Test')

  return {
    sip,
    proofProvider,
    solver,
    nearAdapter,
    solanaWallet,
    ethereumWallet,
    solanaStealthKeys,
    ethereumStealthKeys,
    zcashStealthKeys,
    cleanup: () => {
      solver.reset()
    },
  }
}

// ─── Cross-Chain Swap Helpers ───────────────────────────────────────────────────

/**
 * Cross-chain swap test parameters
 */
export interface CrossChainSwapParams {
  inputChain: ChainId
  outputChain: ChainId
  inputAmount: bigint
  minOutputAmount: bigint
  privacyLevel: PrivacyLevel
}

/**
 * Default swap parameters for testing
 */
export const DEFAULT_SWAP_PARAMS: CrossChainSwapParams = {
  inputChain: 'solana' as ChainId,
  outputChain: 'zcash' as ChainId,
  inputAmount: 1_000_000_000n, // 1 SOL
  minOutputAmount: 50_000_000n, // 0.5 ZEC
  privacyLevel: PrivacyLevel.SHIELDED,
}

/**
 * Create a shielded intent for testing
 * Note: For COMPLIANT mode, a viewing key is automatically generated
 * Note: Uses allowPlaceholders for test environment - NOT for production use
 */
export async function createTestIntent(
  sip: SIP,
  params: Partial<CrossChainSwapParams> = {}
): Promise<ShieldedIntent> {
  const p = { ...DEFAULT_SWAP_PARAMS, ...params }

  // For COMPLIANT mode, we need to pass viewingKey through params
  // Use the direct createShieldedIntent for more control
  if (p.privacyLevel === PrivacyLevel.COMPLIANT) {
    const { createShieldedIntent } = await import('../../src/intent')
    const viewingKey = generateViewingKey('/m/44/501/0/test')

    return createShieldedIntent({
      input: {
        asset: NATIVE_TOKENS[p.inputChain] ?? NATIVE_TOKENS.solana,
        amount: p.inputAmount,
      },
      output: {
        asset: NATIVE_TOKENS[p.outputChain] ?? NATIVE_TOKENS.zcash,
        minAmount: p.minOutputAmount,
        maxSlippage: 0.01,
      },
      privacy: p.privacyLevel,
      viewingKey: viewingKey.key,
      ttl: 3600,
    }, {
      // Allow placeholder signatures in test environment
      allowPlaceholders: true,
    })
  }

  const intent = await sip
    .intent()
    .input(p.inputChain, NATIVE_TOKENS[p.inputChain]?.symbol ?? 'SOL', p.inputAmount)
    .output(p.outputChain, NATIVE_TOKENS[p.outputChain]?.symbol ?? 'ZEC', p.minOutputAmount)
    .privacy(p.privacyLevel)
    .ttl(3600)
    .withPlaceholders() // Allow placeholder signatures in test environment
    .build()

  return intent
}

/**
 * Execute a complete swap flow for testing
 */
export async function executeTestSwap(
  fixture: E2ETestFixture,
  params: Partial<CrossChainSwapParams> = {}
): Promise<{
  intent: ShieldedIntent
  quotes: Awaited<ReturnType<SIP['getQuotes']>>
  result: Awaited<ReturnType<SIP['execute']>>
  duration: number
}> {
  const startTime = Date.now()

  // Create intent
  const intent = await createTestIntent(fixture.sip, params)

  // Get quotes
  const quotes = await fixture.sip.getQuotes(intent)

  // Execute with first quote
  const tracked = { ...intent, status: IntentStatus.PENDING, quotes: [] }
  const result = await fixture.sip.execute(tracked, quotes[0])

  return {
    intent,
    quotes,
    result,
    duration: Date.now() - startTime,
  }
}

// ─── Privacy Verification Helpers ───────────────────────────────────────────────

/**
 * Privacy verification result
 */
export interface PrivacyVerification {
  /** Whether sender identity is hidden */
  senderHidden: boolean
  /** Whether amount is hidden (commitment only) */
  amountHidden: boolean
  /** Whether stealth address is unlinkable */
  stealthUnlinkable: boolean
  /** Whether transactions are unlinkable */
  transactionsUnlinkable: boolean
  /** All privacy checks passed */
  allPassed: boolean
}

/**
 * Verify privacy guarantees of a shielded intent
 */
export function verifyPrivacy(intent: ShieldedIntent): PrivacyVerification {
  const isShielded = intent.privacyLevel === PrivacyLevel.SHIELDED ||
                     intent.privacyLevel === PrivacyLevel.COMPLIANT

  // Check sender hiding - senderCommitment is a Commitment object with 'value' field
  const senderCommitmentValue = typeof intent.senderCommitment === 'object'
    ? (intent.senderCommitment as { value?: string })?.value ?? ''
    : String(intent.senderCommitment ?? '')

  const senderHidden = isShielded &&
    !!intent.senderCommitment &&
    !senderCommitmentValue.includes('0x0000000000')

  // Check amount hiding - inputCommitment is a Commitment object
  const inputCommitmentValue = typeof intent.inputCommitment === 'object'
    ? (intent.inputCommitment as { value?: string })?.value ?? ''
    : String(intent.inputCommitment ?? '')

  const amountHidden = isShielded &&
    !!intent.inputCommitment &&
    !inputCommitmentValue.includes('0x0000000000')

  // Check stealth address
  const stealthUnlinkable = isShielded &&
    !!intent.recipientStealth &&
    intent.recipientStealth.length > 40

  // Transactions are unlinkable if all above are true
  const transactionsUnlinkable = senderHidden && amountHidden && stealthUnlinkable

  return {
    senderHidden,
    amountHidden,
    stealthUnlinkable,
    transactionsUnlinkable,
    allPassed: senderHidden && amountHidden && stealthUnlinkable && transactionsUnlinkable,
  }
}

/**
 * Verify stealth address can be claimed by recipient
 */
export function verifyStealthAddressClaim(
  stealthKeys: ReturnType<typeof generateStealthMetaAddress>,
  stealthAddress: ReturnType<typeof generateStealthAddress>
): boolean {
  return checkStealthAddress(
    stealthAddress.stealthAddress,
    stealthKeys.spendingPrivateKey,
    stealthKeys.viewingPrivateKey
  )
}

/**
 * Verify commitment matches expected value
 */
export function verifyCommitment(
  commitment: string,
  expectedAmount: bigint,
  blinding: string
): boolean {
  return verifyOpening(commitment as HexString, expectedAmount, blinding as HexString)
}

// ─── Compliance Verification Helpers ────────────────────────────────────────────

/**
 * Compliance verification result
 */
export interface ComplianceVerification {
  /** Whether viewing key can decrypt transaction data */
  viewingKeyWorks: boolean
  /** Whether wrong key fails to decrypt */
  wrongKeyFails: boolean
  /** Whether derived keys work */
  derivedKeysWork: boolean
  /** All compliance checks passed */
  allPassed: boolean
}

/**
 * Test transaction data for compliance
 */
export interface TestTransactionData {
  sender: string
  recipient: string
  amount: string
  timestamp: number
}

/**
 * Verify compliance flow with viewing keys
 */
export function verifyCompliance(
  masterKey: ReturnType<typeof generateViewingKey>,
  wrongKey: ReturnType<typeof generateViewingKey>,
  txData: TestTransactionData
): ComplianceVerification {
  // Test encryption/decryption with correct key
  const encrypted = encryptForViewing(txData, masterKey)
  let viewingKeyWorks = false
  try {
    const decrypted = decryptWithViewing(encrypted, masterKey)
    viewingKeyWorks = decrypted.sender === txData.sender &&
                      decrypted.recipient === txData.recipient &&
                      decrypted.amount === txData.amount
  } catch {
    viewingKeyWorks = false
  }

  // Test that wrong key fails
  let wrongKeyFails = false
  try {
    decryptWithViewing(encrypted, wrongKey)
    wrongKeyFails = false // Should have thrown
  } catch {
    wrongKeyFails = true
  }

  // Test derived keys
  let derivedKeysWork = false
  try {
    const derivedKey = generateViewingKey(`${masterKey.path}/audit/2024`)
    const derivedEncrypted = encryptForViewing(txData, derivedKey)
    const derivedDecrypted = decryptWithViewing(derivedEncrypted, derivedKey)
    derivedKeysWork = derivedDecrypted.sender === txData.sender
  } catch {
    derivedKeysWork = false
  }

  return {
    viewingKeyWorks,
    wrongKeyFails,
    derivedKeysWork,
    allPassed: viewingKeyWorks && wrongKeyFails && derivedKeysWork,
  }
}

// ─── Error Simulation Helpers ───────────────────────────────────────────────────

/**
 * Error scenario types
 */
export type ErrorScenario =
  | 'network_failure'
  | 'timeout'
  | 'invalid_quote'
  | 'solver_failure'
  | 'insufficient_balance'
  | 'expired_intent'

/**
 * Create a solver that fails with specific error
 */
export function createFailingSolver(scenario: ErrorScenario): MockSolver {
  switch (scenario) {
    case 'network_failure':
      return createMockSolver({
        name: 'Network Failure Solver',
        failureRate: 1.0, // Always fails
      })

    case 'timeout':
      return createMockSolver({
        name: 'Timeout Solver',
        executionDelay: 300000, // 5 minute delay
      })

    case 'solver_failure':
      return createMockSolver({
        name: 'Failing Solver',
        failureRate: 1.0,
      })

    default:
      return createMockSolver()
  }
}

/**
 * Create intent that will trigger specific error
 * Note: Uses allowPlaceholders for test environment - NOT for production use
 */
export async function createErrorIntent(
  sip: SIP,
  scenario: ErrorScenario
): Promise<ShieldedIntent> {
  switch (scenario) {
    case 'insufficient_balance':
      return sip
        .intent()
        .input('solana' as ChainId, 'SOL', 1_000_000_000_000n) // Huge amount
        .output('zcash' as ChainId, 'ZEC', 1n)
        .privacy(PrivacyLevel.SHIELDED)
        .withPlaceholders()
        .build()

    case 'expired_intent':
      return sip
        .intent()
        .input('solana' as ChainId, 'SOL', 1_000_000_000n)
        .output('zcash' as ChainId, 'ZEC', 50_000_000n)
        .privacy(PrivacyLevel.SHIELDED)
        .ttl(0) // Expires immediately
        .withPlaceholders()
        .build()

    case 'invalid_quote':
      return sip
        .intent()
        .input('solana' as ChainId, 'SOL', 1n) // Too small
        .output('zcash' as ChainId, 'ZEC', 1_000_000_000_000n) // Impossible output
        .privacy(PrivacyLevel.SHIELDED)
        .withPlaceholders()
        .build()

    default:
      return createTestIntent(sip)
  }
}

// ─── Performance Metrics ────────────────────────────────────────────────────────

/**
 * Performance metrics for a test run
 */
export interface PerformanceMetrics {
  /** Test name */
  testName: string
  /** Total duration in ms */
  totalDuration: number
  /** Time for intent creation */
  intentCreation: number
  /** Time for quote fetching */
  quoteFetch: number
  /** Time for execution */
  execution: number
  /** Memory usage before */
  memoryBefore: number
  /** Memory usage after */
  memoryAfter: number
  /** Memory delta */
  memoryDelta: number
}

/**
 * Performance metrics collector
 */
export class MetricsCollector {
  private metrics: PerformanceMetrics[] = []

  /**
   * Measure a test operation
   */
  async measure<T>(
    testName: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const memoryBefore = process.memoryUsage().heapUsed

    const startTime = Date.now()
    const result = await operation()
    const totalDuration = Date.now() - startTime

    const memoryAfter = process.memoryUsage().heapUsed

    const metrics: PerformanceMetrics = {
      testName,
      totalDuration,
      intentCreation: 0, // Would need more granular timing
      quoteFetch: 0,
      execution: 0,
      memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - memoryBefore,
    }

    this.metrics.push(metrics)

    return { result, metrics }
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalTests: number
    avgDuration: number
    maxDuration: number
    minDuration: number
    totalMemoryDelta: number
  } {
    const durations = this.metrics.map(m => m.totalDuration)

    return {
      totalTests: this.metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length || 0,
      maxDuration: Math.max(...durations, 0),
      minDuration: Math.min(...durations, Infinity),
      totalMemoryDelta: this.metrics.reduce((a, m) => a + m.memoryDelta, 0),
    }
  }

  /**
   * Clear collected metrics
   */
  clear(): void {
    this.metrics = []
  }

  /**
   * Format metrics as markdown table
   */
  formatAsMarkdown(): string {
    const lines = [
      '| Test | Duration (ms) | Memory Delta (KB) |',
      '|------|---------------|-------------------|',
    ]

    for (const m of this.metrics) {
      lines.push(`| ${m.testName} | ${m.totalDuration} | ${Math.round(m.memoryDelta / 1024)} |`)
    }

    const summary = this.getSummary()
    lines.push('')
    lines.push(`**Summary:** ${summary.totalTests} tests, avg ${Math.round(summary.avgDuration)}ms`)

    return lines.join('\n')
  }
}

// ─── Test Utilities ─────────────────────────────────────────────────────────────

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 10000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await delay(interval)
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Suppress console warnings during tests
 */
export function suppressConsoleWarnings(): () => void {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  return () => spy.mockRestore()
}

/**
 * Generate random hex string
 */
export function randomHex(length: number): HexString {
  const bytes = new Uint8Array(length / 2)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as HexString
}
