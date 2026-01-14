/**
 * Rate Limiter for Privacy Backends
 *
 * Implements token bucket rate limiting with configurable limits per backend.
 * Supports graceful degradation with queue/reject modes.
 *
 * ## Token Bucket Algorithm
 *
 * ```
 * ┌─────────────────────────────────────────────────────────┐
 * │                    Token Bucket                         │
 * │  ┌─────────────────────────────────────────────────┐   │
 * │  │ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○  (maxTokens)              │   │
 * │  │ ← tokens refill at refillRate per interval →   │   │
 * │  └─────────────────────────────────────────────────┘   │
 * │                        │                               │
 * │                    [request]                           │
 * │                        │                               │
 * │                        ▼                               │
 * │            tokens > 0 ? consume : reject/queue         │
 * └─────────────────────────────────────────────────────────┘
 * ```
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter({
 *   defaultConfig: {
 *     maxTokens: 10,
 *     refillRate: 1,
 *     refillIntervalMs: 1000, // 1 token per second
 *   },
 *   backendOverrides: {
 *     'arcium': { maxTokens: 5 }, // Slower backend
 *   },
 * })
 *
 * // Check if request is allowed
 * if (limiter.tryAcquire('sip-native')) {
 *   // Make request
 * } else {
 *   // Rate limited
 * }
 *
 * // Or use async with queueing
 * await limiter.acquire('sip-native', { timeout: 5000 })
 * ```
 *
 * @see https://en.wikipedia.org/wiki/Token_bucket
 */

import { deepFreeze } from './interface'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Configuration for a single rate limit bucket
 */
export interface RateLimitConfig {
  /**
   * Maximum number of tokens in the bucket
   * @default 10
   */
  maxTokens: number

  /**
   * Number of tokens to add per refill interval
   * @default 1
   */
  refillRate: number

  /**
   * Interval between token refills in milliseconds
   * @default 1000 (1 second)
   */
  refillIntervalMs: number
}

/**
 * Configuration for the rate limiter
 */
export interface RateLimiterConfig {
  /**
   * Default rate limit configuration for all backends
   */
  defaultConfig?: Partial<RateLimitConfig>

  /**
   * Per-backend rate limit overrides
   */
  backendOverrides?: Record<string, Partial<RateLimitConfig>>

  /**
   * Behavior when rate limit is exceeded
   * - 'reject': Immediately return false/throw
   * - 'queue': Wait for token availability (with timeout)
   * @default 'reject'
   */
  onLimitExceeded?: 'reject' | 'queue'

  /**
   * Maximum queue size per backend (when onLimitExceeded is 'queue')
   * @default 100
   */
  maxQueueSize?: number

  /**
   * Default timeout for queued requests in milliseconds
   * @default 30000 (30 seconds)
   */
  defaultTimeoutMs?: number
}

/**
 * Options for acquire operations
 */
export interface AcquireOptions {
  /**
   * Timeout for waiting for token availability (ms)
   * Only applies when onLimitExceeded is 'queue'
   */
  timeout?: number

  /**
   * Number of tokens to acquire
   * @default 1
   */
  tokens?: number
}

/**
 * State of a token bucket
 */
interface BucketState {
  /** Current number of available tokens */
  tokens: number
  /** Last refill timestamp */
  lastRefill: number
  /** Effective configuration for this bucket */
  config: Required<RateLimitConfig>
  /** Queue of waiting requests (resolve callbacks) */
  queue: Array<{
    resolve: (acquired: boolean) => void
    tokens: number
    expiresAt: number
  }>
}

/**
 * Statistics for a rate-limited backend
 */
export interface RateLimitStats {
  /** Backend name */
  name: string
  /** Current available tokens */
  availableTokens: number
  /** Maximum tokens */
  maxTokens: number
  /** Requests allowed */
  allowed: number
  /** Requests rejected due to rate limit */
  rejected: number
  /** Requests currently queued */
  queued: number
  /** Total tokens consumed */
  tokensConsumed: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  maxTokens: 10,
  refillRate: 1,
  refillIntervalMs: 1000,
}

/**
 * Default rate limiter configuration
 */
export const DEFAULT_RATE_LIMITER_CONFIG: Required<Omit<RateLimiterConfig, 'backendOverrides'>> = {
  defaultConfig: DEFAULT_RATE_LIMIT_CONFIG,
  onLimitExceeded: 'reject',
  maxQueueSize: 100,
  defaultTimeoutMs: 30000,
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitExceededError extends Error {
  readonly name = 'RateLimitExceededError'

  constructor(
    readonly backend: string,
    readonly availableTokens: number,
    readonly requestedTokens: number,
    readonly retryAfterMs?: number
  ) {
    const retryMsg = retryAfterMs ? ` Retry after ${retryAfterMs}ms.` : ''
    super(
      `Rate limit exceeded for backend '${backend}'. ` +
      `Available: ${availableTokens}, requested: ${requestedTokens}.${retryMsg}`
    )
  }
}

/**
 * Error thrown when queue is full
 */
export class QueueFullError extends Error {
  readonly name = 'QueueFullError'

  constructor(
    readonly backend: string,
    readonly queueSize: number,
    readonly maxQueueSize: number
  ) {
    super(
      `Queue full for backend '${backend}'. ` +
      `Current size: ${queueSize}, max: ${maxQueueSize}.`
    )
  }
}

/**
 * Error thrown when acquire times out
 */
export class AcquireTimeoutError extends Error {
  readonly name = 'AcquireTimeoutError'

  constructor(
    readonly backend: string,
    readonly timeoutMs: number
  ) {
    super(`Acquire timed out for backend '${backend}' after ${timeoutMs}ms.`)
  }
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

/**
 * Rate Limiter for Privacy Backends
 *
 * Implements per-backend rate limiting using the token bucket algorithm.
 * Supports configurable limits, graceful degradation, and request queueing.
 */
export class RateLimiter {
  private buckets: Map<string, BucketState> = new Map()
  private config: {
    defaultConfig: Required<RateLimitConfig>
    onLimitExceeded: 'reject' | 'queue'
    maxQueueSize: number
    defaultTimeoutMs: number
  }
  private overrides: Record<string, Partial<RateLimitConfig>>
  private stats: Map<string, { allowed: number; rejected: number; tokensConsumed: number }> = new Map()
  private processQueueInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Create a new rate limiter
   *
   * @param config - Rate limiter configuration
   */
  constructor(config: RateLimiterConfig = {}) {
    this.config = {
      defaultConfig: { ...DEFAULT_RATE_LIMIT_CONFIG, ...config.defaultConfig },
      onLimitExceeded: config.onLimitExceeded ?? 'reject',
      maxQueueSize: config.maxQueueSize ?? 100,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
    }
    this.overrides = config.backendOverrides ?? {}

    // Start queue processor if queueing is enabled
    if (this.config.onLimitExceeded === 'queue') {
      this.startQueueProcessor()
    }
  }

  /**
   * Try to acquire tokens for a backend (non-blocking)
   *
   * @param backend - Backend name
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns true if tokens were acquired, false if rate limited
   */
  tryAcquire(backend: string, tokens: number = 1): boolean {
    const bucket = this.getOrCreateBucket(backend)
    this.refillBucket(bucket)

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens
      this.recordAllowed(backend, tokens)
      return true
    }

    this.recordRejected(backend)
    return false
  }

  /**
   * Acquire tokens for a backend (blocking with optional queue)
   *
   * In 'reject' mode, throws RateLimitExceededError if tokens not available.
   * In 'queue' mode, waits for tokens to become available (with timeout).
   *
   * @param backend - Backend name
   * @param options - Acquire options
   * @returns Promise that resolves when tokens are acquired
   * @throws RateLimitExceededError if tokens not available (reject mode)
   * @throws AcquireTimeoutError if timeout exceeded (queue mode)
   * @throws QueueFullError if queue is full (queue mode)
   */
  async acquire(backend: string, options: AcquireOptions = {}): Promise<void> {
    const tokens = options.tokens ?? 1
    const timeout = options.timeout ?? this.config.defaultTimeoutMs

    // Try immediate acquisition
    if (this.tryAcquire(backend, tokens)) {
      return
    }

    // Handle based on mode
    if (this.config.onLimitExceeded === 'reject') {
      const bucket = this.getOrCreateBucket(backend)
      const retryAfterMs = this.estimateRefillTime(bucket, tokens)
      throw new RateLimitExceededError(backend, bucket.tokens, tokens, retryAfterMs)
    }

    // Queue mode - wait for tokens
    return this.waitForTokens(backend, tokens, timeout)
  }

  /**
   * Check if tokens are available without consuming them
   *
   * @param backend - Backend name
   * @param tokens - Number of tokens to check (default: 1)
   * @returns true if tokens are available
   */
  canAcquire(backend: string, tokens: number = 1): boolean {
    const bucket = this.getOrCreateBucket(backend)
    this.refillBucket(bucket)
    return bucket.tokens >= tokens
  }

  /**
   * Get number of available tokens for a backend
   *
   * @param backend - Backend name
   * @returns Number of available tokens
   */
  getAvailableTokens(backend: string): number {
    const bucket = this.getOrCreateBucket(backend)
    this.refillBucket(bucket)
    return bucket.tokens
  }

  /**
   * Get estimated time until tokens are available
   *
   * @param backend - Backend name
   * @param tokens - Number of tokens needed (default: 1)
   * @returns Estimated milliseconds until tokens available, or 0 if available now
   */
  getTimeUntilAvailable(backend: string, tokens: number = 1): number {
    const bucket = this.getOrCreateBucket(backend)
    this.refillBucket(bucket)

    if (bucket.tokens >= tokens) {
      return 0
    }

    return this.estimateRefillTime(bucket, tokens)
  }

  /**
   * Get rate limit statistics for a backend
   *
   * @param backend - Backend name
   * @returns Rate limit statistics
   */
  getStats(backend: string): RateLimitStats {
    const bucket = this.getOrCreateBucket(backend)
    this.refillBucket(bucket)
    const stats = this.stats.get(backend) ?? { allowed: 0, rejected: 0, tokensConsumed: 0 }

    return {
      name: backend,
      availableTokens: bucket.tokens,
      maxTokens: bucket.config.maxTokens,
      allowed: stats.allowed,
      rejected: stats.rejected,
      queued: bucket.queue.length,
      tokensConsumed: stats.tokensConsumed,
    }
  }

  /**
   * Get statistics for all tracked backends
   *
   * @returns Map of backend name to statistics
   */
  getAllStats(): Map<string, RateLimitStats> {
    const allStats = new Map<string, RateLimitStats>()
    for (const backend of this.buckets.keys()) {
      allStats.set(backend, this.getStats(backend))
    }
    return allStats
  }

  /**
   * Get rate limit configuration for a backend
   *
   * @param backend - Backend name
   * @returns Effective rate limit configuration
   */
  getBackendConfig(backend: string): Readonly<Required<RateLimitConfig>> {
    return deepFreeze(this.getEffectiveConfig(backend))
  }

  /**
   * Update rate limit configuration for a specific backend
   *
   * @param backend - Backend name
   * @param config - Partial configuration to merge
   */
  setBackendConfig(backend: string, config: Partial<RateLimitConfig>): void {
    this.overrides[backend] = { ...this.overrides[backend], ...config }

    // Update existing bucket if it exists
    if (this.buckets.has(backend)) {
      const bucket = this.buckets.get(backend)!
      bucket.config = this.getEffectiveConfig(backend)
      // Cap current tokens to new max
      if (bucket.tokens > bucket.config.maxTokens) {
        bucket.tokens = bucket.config.maxTokens
      }
    }
  }

  /**
   * Reset rate limit state for a backend
   *
   * Refills tokens to max and clears queue.
   *
   * @param backend - Backend name
   */
  reset(backend: string): void {
    if (this.buckets.has(backend)) {
      const bucket = this.buckets.get(backend)!
      bucket.tokens = bucket.config.maxTokens
      bucket.lastRefill = Date.now()

      // Reject all queued requests
      for (const waiter of bucket.queue) {
        waiter.resolve(false)
      }
      bucket.queue = []
    }
    this.stats.delete(backend)
  }

  /**
   * Reset all rate limit state
   */
  resetAll(): void {
    for (const backend of this.buckets.keys()) {
      this.reset(backend)
    }
  }

  /**
   * Clear tracking for a backend
   *
   * @param backend - Backend name
   * @returns true if backend was tracked
   */
  unregister(backend: string): boolean {
    const bucket = this.buckets.get(backend)
    if (bucket) {
      // Reject all queued requests
      for (const waiter of bucket.queue) {
        waiter.resolve(false)
      }
    }
    this.stats.delete(backend)
    return this.buckets.delete(backend)
  }

  /**
   * Get current configuration (deeply frozen copy)
   */
  getConfig(): Readonly<RateLimiterConfig> {
    return deepFreeze({
      ...this.config,
      backendOverrides: { ...this.overrides },
    })
  }

  /**
   * Get names of all tracked backends
   */
  getTrackedBackends(): string[] {
    return Array.from(this.buckets.keys())
  }

  /**
   * Dispose of the rate limiter
   *
   * Stops queue processor and rejects all pending requests.
   */
  dispose(): void {
    if (this.processQueueInterval) {
      clearInterval(this.processQueueInterval)
      this.processQueueInterval = null
    }

    // Reject all queued requests
    for (const bucket of this.buckets.values()) {
      for (const waiter of bucket.queue) {
        waiter.resolve(false)
      }
      bucket.queue = []
    }
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Get or create a bucket for a backend
   */
  private getOrCreateBucket(backend: string): BucketState {
    if (!this.buckets.has(backend)) {
      const config = this.getEffectiveConfig(backend)
      this.buckets.set(backend, {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
        config,
        queue: [],
      })
    }
    return this.buckets.get(backend)!
  }

  /**
   * Get effective configuration for a backend
   */
  private getEffectiveConfig(backend: string): Required<RateLimitConfig> {
    const override = this.overrides[backend] ?? {}
    return {
      maxTokens: override.maxTokens ?? this.config.defaultConfig.maxTokens,
      refillRate: override.refillRate ?? this.config.defaultConfig.refillRate,
      refillIntervalMs: override.refillIntervalMs ?? this.config.defaultConfig.refillIntervalMs,
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillBucket(bucket: BucketState): void {
    const now = Date.now()
    const elapsed = now - bucket.lastRefill

    if (elapsed >= bucket.config.refillIntervalMs) {
      const intervals = Math.floor(elapsed / bucket.config.refillIntervalMs)
      const tokensToAdd = intervals * bucket.config.refillRate
      bucket.tokens = Math.min(bucket.config.maxTokens, bucket.tokens + tokensToAdd)
      bucket.lastRefill = now - (elapsed % bucket.config.refillIntervalMs)
    }
  }

  /**
   * Estimate time until requested tokens are available
   */
  private estimateRefillTime(bucket: BucketState, tokens: number): number {
    const tokensNeeded = tokens - bucket.tokens
    if (tokensNeeded <= 0) return 0

    const intervalsNeeded = Math.ceil(tokensNeeded / bucket.config.refillRate)
    const timeUntilNextRefill = bucket.config.refillIntervalMs -
      (Date.now() - bucket.lastRefill) % bucket.config.refillIntervalMs

    return timeUntilNextRefill + (intervalsNeeded - 1) * bucket.config.refillIntervalMs
  }

  /**
   * Wait for tokens to become available (queue mode)
   */
  private async waitForTokens(
    backend: string,
    tokens: number,
    timeout: number
  ): Promise<void> {
    const bucket = this.getOrCreateBucket(backend)

    // Check queue size limit
    if (bucket.queue.length >= this.config.maxQueueSize) {
      throw new QueueFullError(backend, bucket.queue.length, this.config.maxQueueSize)
    }

    return new Promise<void>((resolve, reject) => {
      const expiresAt = Date.now() + timeout

      const waiter = {
        resolve: (acquired: boolean) => {
          if (acquired) {
            resolve()
          } else {
            reject(new AcquireTimeoutError(backend, timeout))
          }
        },
        tokens,
        expiresAt,
      }

      bucket.queue.push(waiter)
    })
  }

  /**
   * Start the queue processor interval
   */
  private startQueueProcessor(): void {
    // Process queues every 100ms
    this.processQueueInterval = setInterval(() => {
      this.processQueues()
    }, 100)
  }

  /**
   * Process all backend queues
   */
  private processQueues(): void {
    const now = Date.now()

    for (const [backend, bucket] of this.buckets) {
      this.refillBucket(bucket)

      // Process expired waiters first
      bucket.queue = bucket.queue.filter(waiter => {
        if (waiter.expiresAt <= now) {
          waiter.resolve(false)
          return false
        }
        return true
      })

      // Try to fulfill waiting requests
      while (bucket.queue.length > 0 && bucket.tokens >= bucket.queue[0].tokens) {
        const waiter = bucket.queue.shift()!
        bucket.tokens -= waiter.tokens
        this.recordAllowed(backend, waiter.tokens)
        waiter.resolve(true)
      }
    }
  }

  /**
   * Record an allowed request in stats
   */
  private recordAllowed(backend: string, tokens: number): void {
    if (!this.stats.has(backend)) {
      this.stats.set(backend, { allowed: 0, rejected: 0, tokensConsumed: 0 })
    }
    const stats = this.stats.get(backend)!
    stats.allowed++
    stats.tokensConsumed += tokens
  }

  /**
   * Record a rejected request in stats
   */
  private recordRejected(backend: string): void {
    if (!this.stats.has(backend)) {
      this.stats.set(backend, { allowed: 0, rejected: 0, tokensConsumed: 0 })
    }
    this.stats.get(backend)!.rejected++
  }
}
