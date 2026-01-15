/**
 * Mock Privacy Backend
 *
 * A configurable mock implementation of PrivacyBackend for testing purposes.
 * Useful for integration tests, unit tests, and development workflows.
 *
 * @example
 * ```typescript
 * import { MockBackend, PrivacyBackendRegistry } from '@sip-protocol/sdk'
 *
 * // Basic usage
 * const mock = new MockBackend()
 *
 * // With custom configuration
 * const customMock = new MockBackend({
 *   name: 'test-backend',
 *   executeResult: { success: true, signature: 'test-sig', backend: 'test-backend' },
 *   shouldFail: false,
 *   latencyMs: 100,
 * })
 *
 * // Use in registry
 * const registry = new PrivacyBackendRegistry()
 * registry.register(mock)
 * ```
 */

import type {
  PrivacyBackend,
  BackendType,
  BackendCapabilities,
  TransferParams,
  TransactionResult,
  AvailabilityResult,
  BackendParams,
  PrivacyBackendVersion,
} from './interface'
import { CURRENT_BACKEND_VERSION } from './interface'

/**
 * Configuration options for MockBackend
 */
export interface MockBackendConfig {
  /** Backend name (default: 'mock') */
  name?: string
  /** Backend type (default: 'transaction') */
  type?: BackendType
  /** Supported chains (default: ['solana', 'ethereum']) */
  chains?: string[]
  /** Custom capabilities to return */
  capabilities?: Partial<BackendCapabilities>
  /** Custom availability result */
  availabilityResult?: Partial<AvailabilityResult>
  /** Custom execute result */
  executeResult?: Partial<TransactionResult>
  /** Should execute fail with an error */
  shouldFail?: boolean
  /** Error message when shouldFail is true */
  failureMessage?: string
  /** Simulated latency in milliseconds (default: 0) */
  latencyMs?: number
  /** Estimated cost in lamports (default: 5000n) */
  estimatedCost?: bigint
}

/**
 * Default mock capabilities
 */
const DEFAULT_CAPABILITIES: BackendCapabilities = {
  hiddenAmount: true,
  hiddenSender: true,
  hiddenRecipient: true,
  hiddenCompute: false,
  complianceSupport: true,
  setupRequired: false,
  latencyEstimate: 'fast',
  supportedTokens: 'all',
  minAmount: undefined,
  maxAmount: undefined,
}

/**
 * Mock Privacy Backend for testing
 *
 * Provides a configurable mock implementation that can simulate
 * various backend behaviors for testing purposes.
 */
export class MockBackend implements PrivacyBackend {
  readonly version: PrivacyBackendVersion = CURRENT_BACKEND_VERSION
  readonly name: string
  readonly type: BackendType
  readonly chains: string[]

  private config: Required<Omit<MockBackendConfig, 'name' | 'type' | 'chains' | 'capabilities' | 'availabilityResult' | 'executeResult'>>
  private capabilities: BackendCapabilities
  private availabilityResult: AvailabilityResult
  private executeResult: TransactionResult

  /** Track number of execute calls */
  public executeCalls: TransferParams[] = []

  /** Track number of checkAvailability calls */
  public availabilityCalls: BackendParams[] = []

  constructor(config: MockBackendConfig = {}) {
    this.name = config.name ?? 'mock'
    this.type = config.type ?? 'transaction'
    this.chains = config.chains ?? ['solana', 'ethereum']

    this.config = {
      shouldFail: config.shouldFail ?? false,
      failureMessage: config.failureMessage ?? 'Mock backend failure',
      latencyMs: config.latencyMs ?? 0,
      estimatedCost: config.estimatedCost ?? 5000n,
    }

    this.capabilities = {
      ...DEFAULT_CAPABILITIES,
      ...config.capabilities,
    }

    this.availabilityResult = {
      available: true,
      estimatedCost: this.config.estimatedCost,
      estimatedTime: this.config.latencyMs || 1000,
      ...config.availabilityResult,
    }

    this.executeResult = {
      success: true,
      signature: `mock-sig-${Date.now()}`,
      backend: this.name,
      ...config.executeResult,
    }
  }

  /**
   * Check if backend is available for given parameters
   */
  async checkAvailability(params: BackendParams): Promise<AvailabilityResult> {
    this.availabilityCalls.push(params)

    if (this.config.latencyMs > 0) {
      await this.delay(this.config.latencyMs)
    }

    // Check if chain is supported
    if ('chain' in params && !this.chains.includes(params.chain)) {
      return {
        available: false,
        reason: `Chain ${params.chain} not supported by ${this.name}`,
      }
    }

    return { ...this.availabilityResult }
  }

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities {
    return { ...this.capabilities }
  }

  /**
   * Execute a privacy-preserving transfer
   */
  async execute(params: TransferParams): Promise<TransactionResult> {
    this.executeCalls.push(params)

    if (this.config.latencyMs > 0) {
      await this.delay(this.config.latencyMs)
    }

    if (this.config.shouldFail) {
      return {
        success: false,
        error: this.config.failureMessage,
        backend: this.name,
      }
    }

    return {
      ...this.executeResult,
      signature: `mock-sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }
  }

  /**
   * Estimate cost for an operation
   */
  async estimateCost(_params: BackendParams): Promise<bigint> {
    if (this.config.latencyMs > 0) {
      await this.delay(this.config.latencyMs)
    }

    return this.config.estimatedCost
  }

  /**
   * Reset mock state (call counts, etc.)
   */
  reset(): void {
    this.executeCalls = []
    this.availabilityCalls = []
  }

  /**
   * Configure mock to fail on next execute
   */
  setFailure(shouldFail: boolean, message?: string): void {
    this.config.shouldFail = shouldFail
    if (message) {
      this.config.failureMessage = message
    }
  }

  /**
   * Update availability result
   */
  setAvailability(available: boolean, reason?: string): void {
    this.availabilityResult = {
      ...this.availabilityResult,
      available,
      reason,
    }
  }

  /**
   * Helper to simulate latency
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Create a mock backend factory for parameterized tests
 *
 * @example
 * ```typescript
 * const createMock = createMockFactory({ latencyMs: 50 })
 *
 * const fast = createMock('fast-backend')
 * const slow = createMock('slow-backend', { latencyMs: 500 })
 * ```
 */
export function createMockFactory(
  defaultConfig: MockBackendConfig = {}
): (name: string, overrides?: MockBackendConfig) => MockBackend {
  return (name: string, overrides: MockBackendConfig = {}) => {
    return new MockBackend({
      ...defaultConfig,
      ...overrides,
      name,
    })
  }
}
