/**
 * Concurrency Manager for Parallel Proof Generation
 *
 * @module proofs/parallel/concurrency
 * @description CPU/memory-aware concurrency control for optimal resource utilization
 *
 * M20-12: Optimize proof generation parallelization (#307)
 */

import type {
  SystemResources,
  ConcurrencyConfig,
  ConcurrencyDecision,
  IConcurrencyManager,
} from './interface'
import { DEFAULT_CONCURRENCY_CONFIG } from './interface'

// ─── Resource Detection ──────────────────────────────────────────────────────

/**
 * Detect if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined'
}

/**
 * Check if Web Workers are supported
 */
function supportsWebWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

/**
 * Check if SharedArrayBuffer is supported
 */
function supportsSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== 'undefined'
}

/**
 * Get number of CPU cores
 */
function getCpuCores(): number {
  if (isBrowser()) {
    return navigator.hardwareConcurrency ?? 4
  }
  // Node.js
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require('os')
    return os.cpus().length
  } catch {
    return 4 // Fallback
  }
}

/**
 * Get memory information
 */
function getMemoryInfo(): { total: number; available: number } {
  if (isBrowser()) {
    // Browser has limited memory info
    // deviceMemory is not in all browsers, use type assertion
    const nav = navigator as { deviceMemory?: number }
    const deviceMemory = nav.deviceMemory ?? 4 // GB
    const totalBytes = deviceMemory * 1024 * 1024 * 1024
    // Estimate 50% available
    return {
      total: totalBytes,
      available: totalBytes * 0.5,
    }
  }
  // Node.js
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require('os')
    return {
      total: os.totalmem(),
      available: os.freemem(),
    }
  } catch {
    // Fallback: assume 8GB total, 4GB available
    return {
      total: 8 * 1024 * 1024 * 1024,
      available: 4 * 1024 * 1024 * 1024,
    }
  }
}

// ─── Concurrency Manager Implementation ──────────────────────────────────────

/**
 * Manages concurrency limits based on system resources
 */
export class ConcurrencyManager implements IConcurrencyManager {
  private readonly config: ConcurrencyConfig
  private currentLimit: number
  private monitoringInterval: ReturnType<typeof setInterval> | null = null
  private lastCpuUsage = 0
  private cpuSampleCount = 0
  private lastDecision: ConcurrencyDecision | null = null

  constructor(config: Partial<ConcurrencyConfig> = {}) {
    this.config = { ...DEFAULT_CONCURRENCY_CONFIG, ...config }
    this.currentLimit = this.config.maxConcurrentProofs
  }

  /**
   * Get current system resources
   */
  getResources(): SystemResources {
    const memory = getMemoryInfo()
    const cpuCores = getCpuCores()

    return {
      cpuCores,
      availableMemory: memory.available,
      totalMemory: memory.total,
      cpuUsage: this.lastCpuUsage,
      memoryUsage: Math.round(((memory.total - memory.available) / memory.total) * 100),
      isBrowser: isBrowser(),
      supportsWebWorkers: supportsWebWorkers(),
      supportsSharedArrayBuffer: supportsSharedArrayBuffer(),
    }
  }

  /**
   * Calculate optimal concurrency level based on current resources
   */
  calculateOptimalConcurrency(): ConcurrencyDecision {
    const resources = this.getResources()
    const timestamp = Date.now()

    // Check CPU threshold
    if (resources.cpuUsage > this.config.cpuThreshold) {
      const newLimit = Math.max(
        this.config.minConcurrency,
        Math.floor(this.currentLimit * 0.75)
      )
      this.currentLimit = newLimit

      return {
        recommendedConcurrency: newLimit,
        reason: 'cpu_high',
        resources,
        timestamp,
      }
    }

    // Check memory threshold
    if (resources.memoryUsage > this.config.memoryThreshold) {
      const newLimit = Math.max(
        this.config.minConcurrency,
        Math.floor(this.currentLimit * 0.75)
      )
      this.currentLimit = newLimit

      return {
        recommendedConcurrency: newLimit,
        reason: 'memory_high',
        resources,
        timestamp,
      }
    }

    // Resources available - can potentially increase concurrency
    if (
      resources.cpuUsage < this.config.cpuThreshold * 0.7 &&
      resources.memoryUsage < this.config.memoryThreshold * 0.7 &&
      this.currentLimit < this.config.maxConcurrentProofs
    ) {
      // Gradually increase
      const newLimit = Math.min(
        this.config.maxConcurrentProofs,
        this.currentLimit + 1
      )
      this.currentLimit = newLimit

      return {
        recommendedConcurrency: newLimit,
        reason: 'resources_available',
        resources,
        timestamp,
      }
    }

    // No change needed
    return {
      recommendedConcurrency: this.currentLimit,
      reason: 'no_change',
      resources,
      timestamp,
    }
  }

  /**
   * Start adaptive monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return // Already monitoring
    }

    if (!this.config.enableAdaptive) {
      return // Adaptive disabled
    }

    this.monitoringInterval = setInterval(() => {
      this.updateCpuUsage()
      this.lastDecision = this.calculateOptimalConcurrency()
    }, this.config.adaptiveIntervalMs)
  }

  /**
   * Stop adaptive monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  /**
   * Get current concurrency limit
   */
  getCurrentLimit(): number {
    return this.currentLimit
  }

  /**
   * Manually set concurrency limit
   */
  setLimit(limit: number): void {
    this.currentLimit = Math.max(
      this.config.minConcurrency,
      Math.min(this.config.maxConcurrentProofs, limit)
    )
  }

  /**
   * Get the last decision made
   */
  getLastDecision(): ConcurrencyDecision | null {
    return this.lastDecision
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private updateCpuUsage(): void {
    // Simple exponential moving average for CPU usage estimation
    // In a real implementation, we'd use process.cpuUsage() in Node.js
    // or performance.now() based sampling in browser

    // For now, simulate with a placeholder
    // In production, this would be based on actual measurements
    const baselineUsage = Math.random() * 30 + 20 // 20-50% baseline
    const loadFactor = this.currentLimit / this.config.maxConcurrentProofs
    const estimatedUsage = baselineUsage + loadFactor * 30

    // Exponential moving average
    const alpha = 0.3
    this.lastCpuUsage = this.cpuSampleCount === 0
      ? estimatedUsage
      : alpha * estimatedUsage + (1 - alpha) * this.lastCpuUsage

    this.cpuSampleCount++
  }
}

/**
 * Create a concurrency manager instance
 */
export function createConcurrencyManager(
  config?: Partial<ConcurrencyConfig>
): IConcurrencyManager {
  return new ConcurrencyManager(config)
}

/**
 * Get recommended concurrency based on system resources
 */
export function getRecommendedConcurrency(): number {
  const resources = new ConcurrencyManager().getResources()

  // Base on CPU cores with some overhead
  const baseConcurrency = Math.max(1, resources.cpuCores - 1)

  // Memory-aware adjustment (assume 256MB per proof, minimum 1)
  const memoryBasedLimit = Math.max(
    1,
    Math.floor(resources.availableMemory / (256 * 1024 * 1024))
  )

  return Math.min(baseConcurrency, memoryBasedLimit, 8)
}
