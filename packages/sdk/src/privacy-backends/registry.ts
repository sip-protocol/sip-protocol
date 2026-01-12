/**
 * Privacy Backend Registry
 *
 * Manages registration and discovery of privacy backends.
 *
 * @example
 * ```typescript
 * const registry = new PrivacyBackendRegistry()
 *
 * // Register backends
 * registry.register(new SIPNativeBackend())
 * registry.register(new PrivacyCashBackend(), { priority: 10 })
 *
 * // Get backends
 * const all = registry.getAll()
 * const byName = registry.get('sip-native')
 * const forChain = registry.getByChain('solana')
 * const forType = registry.getByType('transaction')
 * ```
 */

import type { ChainType } from '@sip-protocol/types'
import type {
  PrivacyBackend,
  BackendType,
  BackendRegistrationOptions,
  RegisteredBackend,
  TransferParams,
  AvailabilityResult,
} from './interface'

/**
 * Default priority for registered backends
 */
const DEFAULT_PRIORITY = 50

/**
 * Registry for managing privacy backends
 *
 * Provides a centralized way to register, discover, and manage
 * different privacy backend implementations.
 */
export class PrivacyBackendRegistry {
  private backends: Map<string, RegisteredBackend> = new Map()

  /**
   * Register a privacy backend
   *
   * @param backend - Backend instance to register
   * @param options - Registration options
   * @throws Error if backend with same name exists and override is false
   *
   * @example
   * ```typescript
   * registry.register(new SIPNativeBackend())
   * registry.register(new PrivacyCashBackend(), { priority: 100 })
   * ```
   */
  register(
    backend: PrivacyBackend,
    options: BackendRegistrationOptions = {}
  ): void {
    const { override = false, priority = DEFAULT_PRIORITY, enabled = true } = options

    if (this.backends.has(backend.name) && !override) {
      throw new Error(
        `Backend '${backend.name}' is already registered. ` +
        `Use { override: true } to replace it.`
      )
    }

    this.backends.set(backend.name, {
      backend,
      priority,
      enabled,
      registeredAt: Date.now(),
    })
  }

  /**
   * Unregister a backend by name
   *
   * @param name - Backend name to unregister
   * @returns true if backend was removed, false if not found
   */
  unregister(name: string): boolean {
    return this.backends.delete(name)
  }

  /**
   * Get a backend by name
   *
   * @param name - Backend name
   * @returns Backend instance or undefined if not found
   */
  get(name: string): PrivacyBackend | undefined {
    const entry = this.backends.get(name)
    return entry?.enabled ? entry.backend : undefined
  }

  /**
   * Check if a backend is registered
   *
   * @param name - Backend name
   * @returns true if registered (regardless of enabled state)
   */
  has(name: string): boolean {
    return this.backends.has(name)
  }

  /**
   * Get all enabled backends sorted by priority
   *
   * @returns Array of backends (highest priority first)
   */
  getAll(): PrivacyBackend[] {
    return Array.from(this.backends.values())
      .filter(entry => entry.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map(entry => entry.backend)
  }

  /**
   * Get all registered entries (including disabled)
   *
   * @returns Array of registered backend entries
   */
  getAllEntries(): RegisteredBackend[] {
    return Array.from(this.backends.values())
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get backends supporting a specific chain
   *
   * @param chain - Chain type to filter by
   * @returns Array of backends supporting the chain
   */
  getByChain(chain: ChainType): PrivacyBackend[] {
    return this.getAll().filter(backend =>
      backend.chains.includes(chain)
    )
  }

  /**
   * Get backends of a specific type
   *
   * @param type - Backend type to filter by
   * @returns Array of backends of the specified type
   */
  getByType(type: BackendType): PrivacyBackend[] {
    return this.getAll().filter(backend =>
      backend.type === type || backend.type === 'both'
    )
  }

  /**
   * Get backends that support compliance (viewing keys)
   *
   * @returns Array of compliance-supporting backends
   */
  getCompliant(): PrivacyBackend[] {
    return this.getAll().filter(backend =>
      backend.getCapabilities().complianceSupport
    )
  }

  /**
   * Find available backends for a transfer
   *
   * @param params - Transfer parameters
   * @returns Array of available backends with availability info
   */
  async findAvailable(
    params: TransferParams
  ): Promise<Array<{ backend: PrivacyBackend; availability: AvailabilityResult }>> {
    const chainBackends = this.getByChain(params.chain)
    const results: Array<{ backend: PrivacyBackend; availability: AvailabilityResult }> = []

    for (const backend of chainBackends) {
      const availability = await backend.checkAvailability(params)
      if (availability.available) {
        results.push({ backend, availability })
      }
    }

    return results
  }

  /**
   * Enable a backend
   *
   * @param name - Backend name
   * @returns true if backend was enabled, false if not found
   */
  enable(name: string): boolean {
    const entry = this.backends.get(name)
    if (entry) {
      entry.enabled = true
      return true
    }
    return false
  }

  /**
   * Disable a backend
   *
   * @param name - Backend name
   * @returns true if backend was disabled, false if not found
   */
  disable(name: string): boolean {
    const entry = this.backends.get(name)
    if (entry) {
      entry.enabled = false
      return true
    }
    return false
  }

  /**
   * Set backend priority
   *
   * @param name - Backend name
   * @param priority - New priority value
   * @returns true if priority was set, false if not found
   */
  setPriority(name: string, priority: number): boolean {
    const entry = this.backends.get(name)
    if (entry) {
      entry.priority = priority
      return true
    }
    return false
  }

  /**
   * Get count of registered backends
   *
   * @param enabledOnly - If true, only count enabled backends
   * @returns Number of backends
   */
  count(enabledOnly: boolean = false): number {
    if (enabledOnly) {
      return Array.from(this.backends.values()).filter(e => e.enabled).length
    }
    return this.backends.size
  }

  /**
   * Clear all registered backends
   */
  clear(): void {
    this.backends.clear()
  }

  /**
   * Get backend names
   *
   * @param enabledOnly - If true, only return enabled backend names
   * @returns Array of backend names
   */
  getNames(enabledOnly: boolean = false): string[] {
    if (enabledOnly) {
      return Array.from(this.backends.entries())
        .filter(([, entry]) => entry.enabled)
        .map(([name]) => name)
    }
    return Array.from(this.backends.keys())
  }
}

/**
 * Global default registry instance
 *
 * Use this for simple applications, or create your own instance
 * for more control.
 */
export const defaultRegistry = new PrivacyBackendRegistry()
