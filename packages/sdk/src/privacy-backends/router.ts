/**
 * SmartRouter - Privacy Backend Selection
 *
 * Automatically selects the optimal privacy backend based on:
 * - User preferences (privacy, speed, cost, compliance)
 * - Backend capabilities and availability
 * - Transfer parameters
 *
 * @example
 * ```typescript
 * import { SmartRouter, PrivacyBackendRegistry, SIPNativeBackend } from '@sip-protocol/sdk'
 *
 * const registry = new PrivacyBackendRegistry()
 * registry.register(new SIPNativeBackend())
 *
 * const router = new SmartRouter(registry)
 *
 * // Auto-select best backend
 * const result = await router.execute(params, {
 *   prioritize: 'compliance',
 *   requireViewingKeys: true,
 * })
 *
 * // Or just select without executing
 * const selection = await router.selectBackend(params, config)
 * console.log(`Selected: ${selection.backend.name}`)
 * ```
 */

import type {
  PrivacyBackend,
  TransferParams,
  TransactionResult,
  SmartRouterConfig,
  BackendSelectionResult,
  AvailabilityResult,
} from './interface'
import { PrivacyBackendRegistry } from './registry'

/**
 * Default router configuration
 */
const DEFAULT_CONFIG: SmartRouterConfig = {
  prioritize: 'privacy',
  requireViewingKeys: false,
  allowComputePrivacy: true,
}

/**
 * Scoring weights for different priorities
 */
const PRIORITY_WEIGHTS = {
  privacy: {
    hiddenAmount: 25,
    hiddenSender: 25,
    hiddenRecipient: 25,
    hiddenCompute: 10,
    anonymitySet: 15,
  },
  speed: {
    fast: 40,
    medium: 25,
    slow: 10,
    setupRequired: -20,
  },
  cost: {
    baseCost: 50,
    estimatedCost: 50,
  },
  compliance: {
    complianceSupport: 60,
    hiddenAmount: 15,
    hiddenSender: 15,
    hiddenRecipient: 10,
  },
}

/**
 * SmartRouter for automatic backend selection
 *
 * Analyzes available backends and selects the optimal one
 * based on user preferences and transfer requirements.
 */
export class SmartRouter {
  private registry: PrivacyBackendRegistry

  /**
   * Create a new SmartRouter
   *
   * @param registry - Backend registry to use for selection
   */
  constructor(registry: PrivacyBackendRegistry) {
    this.registry = registry
  }

  /**
   * Select the best backend for a transfer
   *
   * @param params - Transfer parameters
   * @param config - Router configuration
   * @returns Selection result with backend and reasoning
   * @throws Error if no suitable backend is found
   */
  async selectBackend(
    params: TransferParams,
    config: Partial<SmartRouterConfig> = {}
  ): Promise<BackendSelectionResult> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config }

    // Get backends for the chain
    const chainBackends = this.registry.getByChain(params.chain)

    if (chainBackends.length === 0) {
      throw new Error(
        `No backends available for chain '${params.chain}'. ` +
        `Register a backend that supports this chain.`
      )
    }

    // Filter and score backends
    const scoredBackends: Array<{
      backend: PrivacyBackend
      availability: AvailabilityResult
      score: number
      reason: string
    }> = []

    for (const backend of chainBackends) {
      // Check exclusions
      if (fullConfig.excludeBackends?.includes(backend.name)) {
        continue
      }

      // Check availability
      const availability = await backend.checkAvailability(params)
      if (!availability.available) {
        continue
      }

      // Check hard requirements
      const capabilities = backend.getCapabilities()

      // Viewing key requirement
      if (fullConfig.requireViewingKeys && !capabilities.complianceSupport) {
        continue
      }

      // Anonymity set requirement
      if (
        fullConfig.minAnonymitySet &&
        capabilities.anonymitySet !== undefined &&
        capabilities.anonymitySet < fullConfig.minAnonymitySet
      ) {
        continue
      }

      // Compute privacy filter
      if (!fullConfig.allowComputePrivacy && backend.type === 'compute') {
        continue
      }

      // Cost limit
      if (fullConfig.maxCost && availability.estimatedCost) {
        if (availability.estimatedCost > fullConfig.maxCost) {
          continue
        }
      }

      // Latency limit
      if (fullConfig.maxLatency && availability.estimatedTime) {
        if (availability.estimatedTime > fullConfig.maxLatency) {
          continue
        }
      }

      // Score this backend
      const { score, reason } = this.scoreBackend(
        backend,
        availability,
        fullConfig
      )

      scoredBackends.push({
        backend,
        availability,
        score,
        reason,
      })
    }

    if (scoredBackends.length === 0) {
      throw new Error(
        `No backends meet the requirements for this transfer. ` +
        `Check your router configuration and registered backends.`
      )
    }

    // Sort by score (descending)
    scoredBackends.sort((a, b) => b.score - a.score)

    // Preferred backend bonus
    if (fullConfig.preferredBackend) {
      const preferredIndex = scoredBackends.findIndex(
        s => s.backend.name === fullConfig.preferredBackend
      )
      if (preferredIndex > 0) {
        // Move preferred to top if within 10 points of leader
        const preferred = scoredBackends[preferredIndex]
        const leader = scoredBackends[0]
        if (leader.score - preferred.score <= 10) {
          scoredBackends.splice(preferredIndex, 1)
          scoredBackends.unshift(preferred)
          preferred.reason = `Preferred backend (within 10pts of optimal)`
        }
      }
    }

    const selected = scoredBackends[0]
    const alternatives = scoredBackends.slice(1).map(s => ({
      backend: s.backend,
      score: s.score,
      reason: s.reason,
    }))

    return {
      backend: selected.backend,
      reason: selected.reason,
      alternatives,
      score: selected.score,
    }
  }

  /**
   * Execute a transfer using the best available backend
   *
   * @param params - Transfer parameters
   * @param config - Router configuration
   * @returns Transaction result
   */
  async execute(
    params: TransferParams,
    config: Partial<SmartRouterConfig> = {}
  ): Promise<TransactionResult> {
    const selection = await this.selectBackend(params, config)
    return selection.backend.execute(params)
  }

  /**
   * Get available backends for a transfer (without selecting)
   *
   * @param params - Transfer parameters
   * @returns Array of available backends with scores
   */
  async getAvailableBackends(
    params: TransferParams
  ): Promise<Array<{ backend: PrivacyBackend; availability: AvailabilityResult }>> {
    return this.registry.findAvailable(params)
  }

  /**
   * Score a backend based on configuration priority
   */
  private scoreBackend(
    backend: PrivacyBackend,
    availability: AvailabilityResult,
    config: SmartRouterConfig
  ): { score: number; reason: string } {
    const capabilities = backend.getCapabilities()
    let score = 0
    const reasons: string[] = []

    switch (config.prioritize) {
      case 'privacy':
        if (capabilities.hiddenAmount) {
          score += PRIORITY_WEIGHTS.privacy.hiddenAmount
          reasons.push('hidden amounts')
        }
        if (capabilities.hiddenSender) {
          score += PRIORITY_WEIGHTS.privacy.hiddenSender
          reasons.push('hidden sender')
        }
        if (capabilities.hiddenRecipient) {
          score += PRIORITY_WEIGHTS.privacy.hiddenRecipient
          reasons.push('hidden recipient')
        }
        if (capabilities.hiddenCompute) {
          score += PRIORITY_WEIGHTS.privacy.hiddenCompute
          reasons.push('private compute')
        }
        if (capabilities.anonymitySet && capabilities.anonymitySet >= 100) {
          score += PRIORITY_WEIGHTS.privacy.anonymitySet
          reasons.push(`anonymity set: ${capabilities.anonymitySet}`)
        }
        break

      case 'speed':
        score += PRIORITY_WEIGHTS.speed[capabilities.latencyEstimate]
        reasons.push(`${capabilities.latencyEstimate} latency`)
        if (capabilities.setupRequired) {
          score += PRIORITY_WEIGHTS.speed.setupRequired
          reasons.push('setup required')
        }
        break

      case 'cost':
        // Lower cost = higher score (invert with log scale)
        if (availability.estimatedCost !== undefined) {
          // Use log scale to handle wide range of costs
          // log10(100) ≈ 2, log10(100000) ≈ 5, log10(1000000) ≈ 6
          const logCost = availability.estimatedCost > BigInt(0)
            ? Math.log10(Number(availability.estimatedCost))
            : 0
          // Max cost assumed around 10^14 (log = 14), gives score 0
          // Min cost around 10^2 (log = 2), gives score ~60
          const costScore = Math.max(0, 70 - logCost * 5)
          score += costScore
          reasons.push(`low cost`)
        }
        break

      case 'compliance':
        if (capabilities.complianceSupport) {
          score += PRIORITY_WEIGHTS.compliance.complianceSupport
          reasons.push('viewing key support')
        }
        if (capabilities.hiddenAmount) {
          score += PRIORITY_WEIGHTS.compliance.hiddenAmount
        }
        if (capabilities.hiddenSender) {
          score += PRIORITY_WEIGHTS.compliance.hiddenSender
        }
        if (capabilities.hiddenRecipient) {
          score += PRIORITY_WEIGHTS.compliance.hiddenRecipient
        }
        break
    }

    // Normalize score to 0-100
    score = Math.min(100, Math.max(0, score))

    return {
      score,
      reason: reasons.length > 0 ? reasons.join(', ') : 'default selection',
    }
  }
}
