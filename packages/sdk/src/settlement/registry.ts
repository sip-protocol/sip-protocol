/**
 * Settlement Backend Registry
 *
 * Manages multiple settlement backends and provides route-based selection.
 *
 * @module settlement/registry
 */

import type { ChainId } from '@sip-protocol/types'
import type { SettlementBackend } from './interface'

/**
 * Route identifier
 */
export interface Route {
  /** Source chain */
  fromChain: ChainId
  /** Destination chain */
  toChain: ChainId
  /** Backend name that supports this route */
  backend: string
}

/**
 * Settlement Registry Error
 */
export class SettlementRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettlementRegistryError'
  }
}

/**
 * Settlement Backend Registry
 *
 * Manages multiple settlement backends and provides route-based selection.
 *
 * @example
 * ```typescript
 * const registry = new SettlementRegistry()
 *
 * // Register backends
 * registry.register(nearIntentsBackend)
 * registry.register(zcashBackend)
 *
 * // Get backend by name
 * const backend = registry.get('near-intents')
 *
 * // Find best backend for a route
 * const bestBackend = registry.getBestForRoute('ethereum', 'solana')
 *
 * // List all supported routes
 * const routes = registry.getSupportedRoutes()
 * ```
 */
export class SettlementRegistry {
  private backends: Map<string, SettlementBackend> = new Map()

  /**
   * Register a settlement backend
   *
   * @param backend - Settlement backend to register
   * @throws {SettlementRegistryError} If backend with same name already exists
   *
   * @example
   * ```typescript
   * registry.register(nearIntentsBackend)
   * ```
   */
  register(backend: SettlementBackend): void {
    if (this.backends.has(backend.name)) {
      throw new SettlementRegistryError(
        `Backend '${backend.name}' is already registered`
      )
    }

    this.backends.set(backend.name, backend)
  }

  /**
   * Get a settlement backend by name
   *
   * @param name - Backend name
   * @returns Settlement backend
   * @throws {SettlementRegistryError} If backend is not found
   *
   * @example
   * ```typescript
   * const backend = registry.get('near-intents')
   * ```
   */
  get(name: string): SettlementBackend {
    const backend = this.backends.get(name)
    if (!backend) {
      throw new SettlementRegistryError(`Backend '${name}' not found`)
    }
    return backend
  }

  /**
   * List all registered backend names
   *
   * @returns Array of backend names
   *
   * @example
   * ```typescript
   * const names = registry.list()
   * // ['near-intents', 'zcash', 'thorchain']
   * ```
   */
  list(): string[] {
    return Array.from(this.backends.keys())
  }

  /**
   * Get the best backend for a specific route
   *
   * Selection criteria (in order of priority):
   * 1. Backends that support both source and destination chains
   * 2. Backends with faster average execution time
   * 3. First registered backend (if no execution time info)
   *
   * @param fromChain - Source chain
   * @param toChain - Destination chain
   * @returns Best settlement backend for the route
   * @throws {SettlementRegistryError} If no backend supports the route
   *
   * @example
   * ```typescript
   * const backend = registry.getBestForRoute('ethereum', 'solana')
   * const quote = await backend.getQuote({ ... })
   * ```
   */
  getBestForRoute(fromChain: ChainId, toChain: ChainId): SettlementBackend {
    const supportedBackends: SettlementBackend[] = []

    // Find all backends that support this route
    for (const backend of Array.from(this.backends.values())) {
      const { supportedSourceChains, supportedDestinationChains } =
        backend.capabilities

      const supportsSource = supportedSourceChains.includes(fromChain)
      const supportsDestination =
        supportedDestinationChains.includes(toChain)

      if (supportsSource && supportsDestination) {
        supportedBackends.push(backend)
      }
    }

    if (supportedBackends.length === 0) {
      throw new SettlementRegistryError(
        `No backend supports route from '${fromChain}' to '${toChain}'`
      )
    }

    // If only one backend supports the route, return it
    if (supportedBackends.length === 1) {
      return supportedBackends[0]
    }

    // Sort by average execution time (fastest first)
    // Backends without execution time info go last
    supportedBackends.sort((a, b) => {
      const timeA = a.capabilities.averageExecutionTime ?? Infinity
      const timeB = b.capabilities.averageExecutionTime ?? Infinity
      return timeA - timeB
    })

    return supportedBackends[0]
  }

  /**
   * Get all supported routes across all registered backends
   *
   * @returns Array of supported routes
   *
   * @example
   * ```typescript
   * const routes = registry.getSupportedRoutes()
   * // [
   * //   { fromChain: 'ethereum', toChain: 'solana', backend: 'near-intents' },
   * //   { fromChain: 'solana', toChain: 'ethereum', backend: 'near-intents' },
   * //   { fromChain: 'ethereum', toChain: 'zcash', backend: 'zcash' },
   * //   ...
   * // ]
   * ```
   */
  getSupportedRoutes(): Route[] {
    const routes: Route[] = []

    for (const backend of Array.from(this.backends.values())) {
      const { supportedSourceChains, supportedDestinationChains } =
        backend.capabilities

      // Generate all possible routes for this backend
      for (const fromChain of supportedSourceChains) {
        for (const toChain of supportedDestinationChains) {
          routes.push({
            fromChain,
            toChain,
            backend: backend.name,
          })
        }
      }
    }

    return routes
  }

  /**
   * Check if a backend is registered
   *
   * @param name - Backend name
   * @returns True if backend is registered
   *
   * @example
   * ```typescript
   * if (registry.has('near-intents')) {
   *   const backend = registry.get('near-intents')
   * }
   * ```
   */
  has(name: string): boolean {
    return this.backends.has(name)
  }

  /**
   * Unregister a settlement backend
   *
   * @param name - Backend name to unregister
   * @returns True if backend was unregistered, false if not found
   *
   * @example
   * ```typescript
   * registry.unregister('near-intents')
   * ```
   */
  unregister(name: string): boolean {
    return this.backends.delete(name)
  }

  /**
   * Clear all registered backends
   *
   * @example
   * ```typescript
   * registry.clear()
   * ```
   */
  clear(): void {
    this.backends.clear()
  }

  /**
   * Get number of registered backends
   *
   * @returns Number of registered backends
   *
   * @example
   * ```typescript
   * const count = registry.size()
   * ```
   */
  size(): number {
    return this.backends.size
  }
}
