/**
 * Tests for lazy proof generation
 *
 * M20-14: Add lazy proof generation support (#319)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SingleProof } from '@sip-protocol/types'
import {
  LazyProof,
  createLazyProof,
  ProofGenerationQueue,
  createProofQueue,
  LazyVerificationKey,
  VerificationKeyRegistry,
  createVKRegistry,
  SpeculativePrefetcher,
  createPrefetcher,
  LazyProofError,
  DEFAULT_LAZY_CONFIG,
  DEFAULT_QUEUE_CONFIG,
  DEFAULT_PREFETCH_CONFIG,
} from '../../src/proofs/lazy'

// ─── Test Helpers ────────────────────────────────────────────────────────────

const mockProof: SingleProof = {
  id: 'test-proof-1',
  proof: '0x1234',
  publicInputs: ['0xabc'],
  metadata: {
    system: 'noir',
    systemVersion: '1.0.0',
    circuitId: 'test-circuit',
    circuitVersion: '1.0.0',
    generatedAt: Date.now(),
    proofSizeBytes: 128,
  },
}

function createMockGenerator(
  proof: SingleProof = mockProof,
  delay = 10
): (signal: AbortSignal) => Promise<SingleProof> {
  return async (signal: AbortSignal) => {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, delay)
      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new Error('Aborted'))
      })
    })
    return proof
  }
}

function createFailingGenerator(
  error: Error = new Error('Generation failed'),
  delay = 10
): (signal: AbortSignal) => Promise<SingleProof> {
  return async (_signal: AbortSignal) => {
    await new Promise((r) => setTimeout(r, delay))
    throw error
  }
}

// ─── LazyProof Tests ─────────────────────────────────────────────────────────

describe('LazyProof', () => {
  describe('construction', () => {
    it('should start in pending state', () => {
      const lazy = new LazyProof(createMockGenerator())
      expect(lazy.status).toBe('pending')
      expect(lazy.isResolved).toBe(false)
      expect(lazy.isGenerating).toBe(false)
    })

    it('should use default config', () => {
      const lazy = new LazyProof(createMockGenerator())
      expect(lazy['config']).toEqual(DEFAULT_LAZY_CONFIG)
    })

    it('should merge custom config with defaults', () => {
      const lazy = new LazyProof(createMockGenerator(), { priority: 'high' })
      expect(lazy['config'].priority).toBe('high')
      expect(lazy['config'].trigger).toBe(DEFAULT_LAZY_CONFIG.trigger)
    })

    it('should start immediately when trigger is immediate', async () => {
      let called = false
      const generator = async (signal: AbortSignal) => {
        called = true
        await new Promise((r) => setTimeout(r, 10))
        return mockProof
      }
      const lazy = new LazyProof(generator, { trigger: 'immediate' })

      // Wait a bit for the promise to start
      await new Promise((r) => setTimeout(r, 5))
      expect(called).toBe(true)

      // Wait for completion
      await lazy.resolve()
      expect(lazy.status).toBe('resolved')
    })
  })

  describe('resolve', () => {
    it('should generate proof on resolve', async () => {
      const lazy = new LazyProof(createMockGenerator())
      expect(lazy.status).toBe('pending')

      const proof = await lazy.resolve()
      expect(proof).toEqual(mockProof)
      expect(lazy.status).toBe('resolved')
      expect(lazy.isResolved).toBe(true)
      expect(lazy.proof).toEqual(mockProof)
    })

    it('should return cached proof on subsequent resolves', async () => {
      const generator = vi.fn(createMockGenerator())
      const lazy = new LazyProof(generator)

      const proof1 = await lazy.resolve()
      const proof2 = await lazy.resolve()

      expect(proof1).toEqual(proof2)
      expect(generator).toHaveBeenCalledTimes(1)
    })

    it('should return same proof when called multiple times during generation', async () => {
      const lazy = new LazyProof(createMockGenerator(mockProof, 50))

      // Start two resolves in parallel
      const [proof1, proof2] = await Promise.all([lazy.resolve(), lazy.resolve()])

      // Both should return the same proof
      expect(proof1).toEqual(proof2)
      expect(lazy.status).toBe('resolved')
    })

    it('should throw when accessing proof before resolve', () => {
      const lazy = new LazyProof(createMockGenerator())
      expect(() => lazy.proof).toThrow(LazyProofError)
      expect(() => lazy.proof).toThrow('Proof not yet resolved')
    })

    it('should return null from proofOrNull before resolve', () => {
      const lazy = new LazyProof(createMockGenerator())
      expect(lazy.proofOrNull).toBeNull()
    })
  })

  describe('cancellation', () => {
    it('should cancel pending proof', () => {
      const lazy = new LazyProof(createMockGenerator())
      const cancelled = lazy.cancel()

      expect(cancelled).toBe(true)
      expect(lazy.status).toBe('cancelled')
      expect(lazy.isCancelled).toBe(true)
    })

    it('should cancel generating proof', async () => {
      const lazy = new LazyProof(createMockGenerator(mockProof, 1000))
      const promise = lazy.resolve()

      // Wait for generation to start
      await new Promise((r) => setTimeout(r, 10))
      expect(lazy.status).toBe('generating')

      const cancelled = lazy.cancel()
      expect(cancelled).toBe(true)

      await expect(promise).rejects.toThrow('cancelled')
      expect(lazy.status).toBe('cancelled')
    })

    it('should not cancel resolved proof', async () => {
      const lazy = new LazyProof(createMockGenerator())
      await lazy.resolve()

      const cancelled = lazy.cancel()
      expect(cancelled).toBe(false)
      expect(lazy.status).toBe('resolved')
    })

    it('should not cancel already cancelled proof', () => {
      const lazy = new LazyProof(createMockGenerator())
      lazy.cancel()

      const cancelled = lazy.cancel()
      expect(cancelled).toBe(false)
    })

    it('should throw when resolving cancelled proof', async () => {
      const lazy = new LazyProof(createMockGenerator())
      lazy.cancel()

      await expect(lazy.resolve()).rejects.toThrow('cancelled')
    })
  })

  describe('reset', () => {
    it('should reset resolved proof to pending', async () => {
      const lazy = new LazyProof(createMockGenerator())
      await lazy.resolve()
      expect(lazy.status).toBe('resolved')

      lazy.reset()
      expect(lazy.status).toBe('pending')
      expect(lazy.proofOrNull).toBeNull()
    })

    it('should cancel and reset generating proof', async () => {
      const lazy = new LazyProof(createMockGenerator(mockProof, 1000))
      lazy.resolve().catch(() => {})

      await new Promise((r) => setTimeout(r, 10))
      expect(lazy.status).toBe('generating')

      lazy.reset()
      expect(lazy.status).toBe('pending')
    })

    it('should allow re-generation after reset', async () => {
      const generator = vi.fn(createMockGenerator())
      const lazy = new LazyProof(generator)

      await lazy.resolve()
      lazy.reset()
      await lazy.resolve()

      expect(generator).toHaveBeenCalledTimes(2)
    })
  })

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      let attempts = 0
      const generator = async (signal: AbortSignal) => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return mockProof
      }

      const lazy = new LazyProof(generator, {
        maxRetries: 2,
        retryDelayMs: 10,
      })

      const proof = await lazy.resolve()
      expect(proof).toEqual(mockProof)
      expect(attempts).toBe(3) // 1 initial + 2 retries
    })

    it('should fail after max retries exceeded', async () => {
      const generator = createFailingGenerator(new Error('Permanent failure'), 5)
      const lazy = new LazyProof(generator, {
        maxRetries: 1,
        retryDelayMs: 5,
      })

      await expect(lazy.resolve()).rejects.toThrow('Permanent failure')
      expect(lazy.status).toBe('failed')
      expect(lazy.isFailed).toBe(true)
      expect(lazy.error?.message).toBe('Permanent failure')
    })
  })

  describe('timeout', () => {
    it('should timeout when generation takes too long', async () => {
      const lazy = new LazyProof(createMockGenerator(mockProof, 1000), {
        timeoutMs: 50,
        maxRetries: 0,
      })

      await expect(lazy.resolve()).rejects.toThrow('timed out')
    })
  })

  describe('events', () => {
    it('should emit start event', async () => {
      const listener = vi.fn()
      const lazy = new LazyProof(createMockGenerator())
      lazy.addEventListener(listener)

      await lazy.resolve()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'start' })
      )
    })

    it('should emit complete event', async () => {
      const listener = vi.fn()
      const lazy = new LazyProof(createMockGenerator())
      lazy.addEventListener(listener)

      await lazy.resolve()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'complete' })
      )
    })

    it('should emit cancel event', () => {
      const listener = vi.fn()
      const lazy = new LazyProof(createMockGenerator())
      lazy.addEventListener(listener)

      lazy.cancel()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cancel' })
      )
    })

    it('should emit retry event', async () => {
      let attempts = 0
      const generator = async (signal: AbortSignal) => {
        attempts++
        if (attempts < 2) throw new Error('Fail')
        return mockProof
      }

      const listener = vi.fn()
      const lazy = new LazyProof(generator, {
        maxRetries: 1,
        retryDelayMs: 5,
      })
      lazy.addEventListener(listener)

      await lazy.resolve()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'retry', data: expect.objectContaining({ attempt: 1 }) })
      )
    })

    it('should emit error event on failure', async () => {
      const listener = vi.fn()
      const lazy = new LazyProof(createFailingGenerator(), {
        maxRetries: 0,
      })
      lazy.addEventListener(listener)

      await lazy.resolve().catch(() => {})

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      )
    })

    it('should remove event listener', async () => {
      const listener = vi.fn()
      const lazy = new LazyProof(createMockGenerator())
      lazy.addEventListener(listener)
      lazy.removeEventListener(listener)

      await lazy.resolve()

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('serialization', () => {
    it('should serialize pending proof', () => {
      const lazy = new LazyProof(createMockGenerator())
      const serialized = lazy.serialize()

      expect(serialized.status).toBe('pending')
      expect(serialized.proof).toBeUndefined()
      expect(serialized.config).toEqual(DEFAULT_LAZY_CONFIG)
    })

    it('should serialize resolved proof', async () => {
      const lazy = new LazyProof(createMockGenerator(), undefined, {
        system: 'noir',
        circuitId: 'test',
      })
      await lazy.resolve()
      const serialized = lazy.serialize()

      expect(serialized.status).toBe('resolved')
      expect(serialized.proof).toEqual(mockProof)
      expect(serialized.metadata?.system).toBe('noir')
      expect(serialized.metadata?.circuitId).toBe('test')
    })

    it('should deserialize resolved proof', async () => {
      const lazy = new LazyProof(createMockGenerator())
      await lazy.resolve()
      const serialized = lazy.serialize()

      const restored = LazyProof.deserialize(serialized, createMockGenerator())
      expect(restored.status).toBe('resolved')
      expect(restored.proof).toEqual(mockProof)
    })

    it('should trigger generation on serialize when configured', async () => {
      let called = false
      const generator = async (_signal: AbortSignal) => {
        called = true
        await new Promise((r) => setTimeout(r, 10))
        return mockProof
      }
      const lazy = new LazyProof(generator, { trigger: 'on-serialize' })

      lazy.serialize()

      // Wait a tick for the promise to start
      await new Promise((r) => setTimeout(r, 5))
      expect(called).toBe(true)
    })
  })
})

// ─── Factory Function Tests ──────────────────────────────────────────────────

describe('createLazyProof', () => {
  it('should create lazy proof with defaults', () => {
    const lazy = createLazyProof(createMockGenerator())
    expect(lazy).toBeInstanceOf(LazyProof)
    expect(lazy.status).toBe('pending')
  })

  it('should create lazy proof with custom config', () => {
    const lazy = createLazyProof(createMockGenerator(), { priority: 'critical' })
    expect(lazy['config'].priority).toBe('critical')
  })
})

// ─── ProofGenerationQueue Tests ──────────────────────────────────────────────

describe('ProofGenerationQueue', () => {
  describe('construction', () => {
    it('should use default config', () => {
      const queue = new ProofGenerationQueue()
      expect(queue['config']).toEqual(DEFAULT_QUEUE_CONFIG)
    })

    it('should merge custom config', () => {
      const queue = new ProofGenerationQueue({ maxConcurrent: 4 })
      expect(queue['config'].maxConcurrent).toBe(4)
      expect(queue['config'].maxQueueSize).toBe(DEFAULT_QUEUE_CONFIG.maxQueueSize)
    })
  })

  describe('enqueue', () => {
    it('should add proof to queue', () => {
      const queue = new ProofGenerationQueue({ autoProcess: false })
      const lazy = new LazyProof(createMockGenerator())

      const id = queue.enqueue(lazy)
      expect(id).toMatch(/^proof-\d+$/)
      expect(queue.size).toBe(1)
    })

    it('should order by priority', () => {
      const queue = new ProofGenerationQueue({ autoProcess: false })
      const low = new LazyProof(createMockGenerator(), { priority: 'low' })
      const high = new LazyProof(createMockGenerator(), { priority: 'high' })
      const critical = new LazyProof(createMockGenerator(), { priority: 'critical' })

      queue.enqueue(low)
      queue.enqueue(high)
      queue.enqueue(critical)

      // Critical should be first
      expect(queue['queue'][0].lazy).toBe(critical)
      expect(queue['queue'][1].lazy).toBe(high)
      expect(queue['queue'][2].lazy).toBe(low)
    })

    it('should override priority when specified', () => {
      const queue = new ProofGenerationQueue({ autoProcess: false })
      const lazy = new LazyProof(createMockGenerator(), { priority: 'low' })

      queue.enqueue(lazy, 'critical')
      expect(queue['queue'][0].priority).toBe('critical')
    })

    it('should throw when queue is full', () => {
      const queue = new ProofGenerationQueue({ maxQueueSize: 2, autoProcess: false })
      queue.enqueue(new LazyProof(createMockGenerator()))
      queue.enqueue(new LazyProof(createMockGenerator()))

      expect(() => queue.enqueue(new LazyProof(createMockGenerator()))).toThrow('Queue is full')
    })
  })

  describe('dequeue', () => {
    it('should remove proof from queue', () => {
      const queue = new ProofGenerationQueue({ autoProcess: false })
      const lazy = new LazyProof(createMockGenerator())
      const id = queue.enqueue(lazy)

      const removed = queue.dequeue(id)
      expect(removed).toBe(true)
      expect(queue.size).toBe(0)
      expect(lazy.isCancelled).toBe(true)
    })

    it('should return false for non-existent id', () => {
      const queue = new ProofGenerationQueue()
      expect(queue.dequeue('non-existent')).toBe(false)
    })
  })

  describe('processing', () => {
    it('should auto-process when enabled', async () => {
      const queue = new ProofGenerationQueue({ autoProcess: true })
      const lazy = new LazyProof(createMockGenerator(mockProof, 10))

      queue.enqueue(lazy)
      await new Promise((r) => setTimeout(r, 50))

      expect(lazy.status).toBe('resolved')
    })

    it('should respect maxConcurrent', async () => {
      const queue = new ProofGenerationQueue({ maxConcurrent: 2, autoProcess: true })
      const lazy1 = new LazyProof(createMockGenerator(mockProof, 100))
      const lazy2 = new LazyProof(createMockGenerator(mockProof, 100))
      const lazy3 = new LazyProof(createMockGenerator(mockProof, 100))

      queue.enqueue(lazy1)
      queue.enqueue(lazy2)
      queue.enqueue(lazy3)

      await new Promise((r) => setTimeout(r, 20))

      // Only 2 should be processing, 1 should be pending
      const stats = queue.getStats()
      expect(stats.processing).toBeLessThanOrEqual(2)
    })

    it('should process manually when autoProcess is false', async () => {
      const queue = new ProofGenerationQueue({ autoProcess: false })
      const lazy = new LazyProof(createMockGenerator(mockProof, 10))

      queue.enqueue(lazy)
      expect(lazy.status).toBe('pending')

      await queue.process()
      expect(lazy.status).toBe('resolved')
    })
  })

  describe('cancelAll', () => {
    it('should cancel all queued and processing proofs', async () => {
      const queue = new ProofGenerationQueue({ autoProcess: true, maxConcurrent: 1 })
      const lazy1 = new LazyProof(createMockGenerator(mockProof, 1000))
      const lazy2 = new LazyProof(createMockGenerator(mockProof, 1000))

      queue.enqueue(lazy1)
      queue.enqueue(lazy2)

      await new Promise((r) => setTimeout(r, 10))
      const cancelled = queue.cancelAll()

      expect(cancelled).toBeGreaterThanOrEqual(1)
      expect(queue.isEmpty).toBe(true)
    })
  })

  describe('stats', () => {
    it('should track statistics', async () => {
      const queue = new ProofGenerationQueue({ autoProcess: false })
      queue.enqueue(new LazyProof(createMockGenerator(mockProof, 5)))
      queue.enqueue(new LazyProof(createFailingGenerator(new Error('fail'), 5), { maxRetries: 0 }))

      await queue.process()
      const stats = queue.getStats()

      expect(stats.completed).toBe(1)
      expect(stats.failed).toBe(1)
    })
  })
})

describe('createProofQueue', () => {
  it('should create queue with defaults', () => {
    const queue = createProofQueue()
    expect(queue).toBeInstanceOf(ProofGenerationQueue)
  })
})

// ─── LazyVerificationKey Tests ───────────────────────────────────────────────

describe('LazyVerificationKey', () => {
  it('should start in pending state', () => {
    const vk = new LazyVerificationKey(
      async () => '0xvk123',
      'noir',
      'test-circuit'
    )
    expect(vk.isLoaded).toBe(false)
    expect(vk.getSync()).toBeNull()
  })

  it('should expose system and circuitId', () => {
    const vk = new LazyVerificationKey(
      async () => '0xvk123',
      'noir',
      'test-circuit'
    )
    expect(vk.system).toBe('noir')
    expect(vk.circuitId).toBe('test-circuit')
  })

  it('should load on get', async () => {
    const vk = new LazyVerificationKey(
      async () => '0xvk123',
      'noir',
      'test-circuit'
    )

    const key = await vk.get()
    expect(key).toBe('0xvk123')
    expect(vk.isLoaded).toBe(true)
    expect(vk.getSync()).toBe('0xvk123')
  })

  it('should return cached value on subsequent gets', async () => {
    const loader = vi.fn(async () => '0xvk123')
    const vk = new LazyVerificationKey(loader, 'noir', 'test-circuit')

    await vk.get()
    await vk.get()

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('should preload without waiting', async () => {
    const loader = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return '0xvk123'
    })
    const vk = new LazyVerificationKey(loader, 'noir', 'test-circuit')

    vk.preload()
    expect(loader).toHaveBeenCalled()
    expect(vk.isLoaded).toBe(false)

    await new Promise((r) => setTimeout(r, 20))
    expect(vk.isLoaded).toBe(true)
  })
})

// ─── VerificationKeyRegistry Tests ───────────────────────────────────────────

describe('VerificationKeyRegistry', () => {
  it('should register and retrieve keys', async () => {
    const registry = new VerificationKeyRegistry()
    registry.register('noir', 'circuit1', async () => '0xvk1')
    registry.register('halo2', 'circuit2', async () => '0xvk2')

    const vk1 = await registry.get('noir', 'circuit1')
    const vk2 = await registry.get('halo2', 'circuit2')

    expect(vk1).toBe('0xvk1')
    expect(vk2).toBe('0xvk2')
  })

  it('should throw for unregistered key', async () => {
    const registry = new VerificationKeyRegistry()
    await expect(registry.get('noir', 'unknown')).rejects.toThrow('No verification key registered')
  })

  it('should preload specific circuits', async () => {
    const loader1 = vi.fn(async () => '0xvk1')
    const loader2 = vi.fn(async () => '0xvk2')

    const registry = new VerificationKeyRegistry()
    registry.register('noir', 'circuit1', loader1)
    registry.register('halo2', 'circuit2', loader2)

    registry.preload([{ system: 'noir', circuitId: 'circuit1' }])

    await new Promise((r) => setTimeout(r, 10))
    expect(loader1).toHaveBeenCalled()
    expect(loader2).not.toHaveBeenCalled()
  })

  it('should preload all keys', async () => {
    const loader1 = vi.fn(async () => '0xvk1')
    const loader2 = vi.fn(async () => '0xvk2')

    const registry = new VerificationKeyRegistry()
    registry.register('noir', 'circuit1', loader1)
    registry.register('halo2', 'circuit2', loader2)

    registry.preloadAll()

    await new Promise((r) => setTimeout(r, 10))
    expect(loader1).toHaveBeenCalled()
    expect(loader2).toHaveBeenCalled()
  })
})

describe('createVKRegistry', () => {
  it('should create registry', () => {
    const registry = createVKRegistry()
    expect(registry).toBeInstanceOf(VerificationKeyRegistry)
  })
})

// ─── SpeculativePrefetcher Tests ─────────────────────────────────────────────

describe('SpeculativePrefetcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should use default config', () => {
    const prefetcher = new SpeculativePrefetcher()
    expect(prefetcher['config']).toEqual(DEFAULT_PREFETCH_CONFIG)
  })

  it('should register generators', () => {
    const prefetcher = new SpeculativePrefetcher()
    const generator = createMockGenerator()

    prefetcher.register('circuit1', generator)
    expect(prefetcher['generators'].has('circuit1')).toBe(true)
  })

  it('should prefetch based on access patterns', () => {
    vi.useRealTimers()

    const prefetcher = new SpeculativePrefetcher({
      likelihoodThreshold: 0.5,
      maxPrefetch: 2,
    })

    prefetcher.register('circuit1', createMockGenerator())
    prefetcher.register('circuit2', createMockGenerator())

    // Record enough accesses to trigger prefetch
    for (let i = 0; i < 5; i++) {
      prefetcher.recordAccess('circuit1')
    }

    const prefetched = prefetcher.getPrefetched('circuit1')
    expect(prefetched).not.toBeNull()
    expect(prefetched?.status).toBe('generating')
  })

  it('should not prefetch below threshold', () => {
    vi.useRealTimers()

    const prefetcher = new SpeculativePrefetcher({
      likelihoodThreshold: 0.9,
      maxPrefetch: 2,
    })

    // Only register one circuit, but also access an unregistered one
    // This dilutes the likelihood below threshold
    prefetcher.register('circuit1', createMockGenerator())

    // Access circuit1 twice, and an unregistered "circuit2" 8 times
    // circuit1 likelihood = 2/10 = 20% (below 90%)
    prefetcher.recordAccess('circuit2') // unregistered
    prefetcher.recordAccess('circuit2')
    prefetcher.recordAccess('circuit2')
    prefetcher.recordAccess('circuit2')
    prefetcher.recordAccess('circuit1')
    prefetcher.recordAccess('circuit2')
    prefetcher.recordAccess('circuit2')
    prefetcher.recordAccess('circuit2')
    prefetcher.recordAccess('circuit1')
    prefetcher.recordAccess('circuit2')

    // circuit1 has 20% likelihood, below 90% threshold
    expect(prefetcher.getPrefetched('circuit1')).toBeNull()
  })

  it('should clear prefetched proofs', () => {
    vi.useRealTimers()

    const prefetcher = new SpeculativePrefetcher({
      likelihoodThreshold: 0.5,
    })

    prefetcher.register('circuit1', createMockGenerator())

    // Trigger prefetch
    for (let i = 0; i < 3; i++) {
      prefetcher.recordAccess('circuit1')
    }

    expect(prefetcher.getPrefetched('circuit1')).not.toBeNull()

    prefetcher.clear()

    expect(prefetcher.getPrefetched('circuit1')).toBeNull()
  })

  it('should respect maxPrefetch limit', () => {
    vi.useRealTimers()

    // The prefetcher evaluates likelihood after EVERY access.
    // With maxPrefetch=1, only 1 circuit should be prefetched even if multiple reach threshold.
    const prefetcher = new SpeculativePrefetcher({
      likelihoodThreshold: 0.5, // 50%
      maxPrefetch: 1,
    })

    prefetcher.register('circuit1', createMockGenerator())
    prefetcher.register('circuit2', createMockGenerator())

    // First access: circuit1 = 100% → prefetched (maxPrefetch=1 reached)
    prefetcher.recordAccess('circuit1')

    // Second access: circuit1 = 50%, circuit2 = 50% → circuit2 meets threshold but limit reached
    prefetcher.recordAccess('circuit2')

    // More accesses to circuit2 to push its likelihood higher
    prefetcher.recordAccess('circuit2')
    prefetcher.recordAccess('circuit2')
    // Now: circuit1 = 1/4 = 25%, circuit2 = 3/4 = 75%

    // circuit1 was prefetched first (100% likelihood on first access)
    // circuit2 is NOT prefetched despite higher likelihood because maxPrefetch=1
    const prefetched1 = prefetcher.getPrefetched('circuit1')
    const prefetched2 = prefetcher.getPrefetched('circuit2')

    expect(prefetched1).not.toBeNull()
    expect(prefetched2).toBeNull() // maxPrefetch limit prevents this
  })
})

describe('createPrefetcher', () => {
  it('should create prefetcher with defaults', () => {
    const prefetcher = createPrefetcher()
    expect(prefetcher).toBeInstanceOf(SpeculativePrefetcher)
  })
})

// ─── LazyProofError Tests ────────────────────────────────────────────────────

describe('LazyProofError', () => {
  it('should have correct name and code', () => {
    const error = new LazyProofError('Test error', 'CANCELLED')
    expect(error.name).toBe('LazyProofError')
    expect(error.code).toBe('CANCELLED')
    expect(error.message).toBe('Test error')
  })
})
