/**
 * Tests for Parallel Proof Generation Module
 *
 * @module tests/proofs/parallel
 * M20-12: Optimize proof generation parallelization (#307)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { SingleProof, ProofProviderCapabilities, ProofProviderStatus, ProofAggregationStrategy } from '@sip-protocol/types'
import type { ComposableProofProvider, ProofGenerationResult } from '../../src/proofs/composer'
import {
  // Dependency Graph
  DependencyAnalyzer,
  createDependencyAnalyzer,
  createDependencyNode,
  // Concurrency
  ConcurrencyManager,
  createConcurrencyManager,
  getRecommendedConcurrency,
  // Worker Pool
  WorkerPool,
  WorkStealingScheduler,
  createWorkerPool,
  // Executor
  ParallelExecutor,
  createParallelExecutor,
  executeParallel,
  // Config
  DEFAULT_WORKER_POOL_CONFIG,
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_SCHEDULER_CONFIG,
  // Types
  type DependencyNode,
  type ParallelProgressEvent,
} from '../../src/proofs/parallel'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockProof(circuitId: string): SingleProof {
  return {
    id: `proof-${circuitId}`,
    proof: `0x${circuitId.padStart(64, '0')}`,
    publicInputs: [`0x${circuitId}`],
    metadata: {
      system: 'noir',
      systemVersion: '1.0.0',
      circuitId, // Use the circuitId directly from the request
      circuitVersion: '1.0.0',
      generatedAt: Date.now(),
      proofSizeBytes: 256,
      verificationCost: 1000n,
    },
  }
}

const mockCapabilities: ProofProviderCapabilities = {
  system: 'noir',
  supportsRecursion: true,
  supportsBatchVerification: true,
  supportsBrowser: true,
  supportsNode: true,
  maxProofSize: 10 * 1024 * 1024,
  supportedStrategies: ['sequential', 'parallel', 'batch'] as unknown as ProofAggregationStrategy[],
  availableCircuits: ['*'],
}

const mockStatus: ProofProviderStatus = {
  isReady: true,
  isBusy: false,
  queueLength: 0,
  metrics: {
    proofsGenerated: 0,
    proofsVerified: 0,
    avgGenerationTimeMs: 10,
    avgVerificationTimeMs: 1,
    successRate: 1,
    memoryUsageBytes: 1024 * 1024,
  },
}

function createMockProvider(delay = 10): ComposableProofProvider {
  return {
    system: 'noir',
    capabilities: mockCapabilities,
    status: mockStatus,
    async initialize() {},
    async waitUntilReady() {},
    async generateProof(request): Promise<ProofGenerationResult> {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return {
        success: true,
        proof: createMockProof(request.circuitId),
        timeMs: delay,
        providerId: 'mock-provider',
      }
    },
    async verifyProof() {
      return true
    },
    getAvailableCircuits() {
      return ['*']
    },
    hasCircuit(_circuitId: string) {
      return true
    },
    async dispose() {},
  }
}

function createFailingProvider(): ComposableProofProvider {
  return {
    ...createMockProvider(),
    async generateProof(): Promise<ProofGenerationResult> {
      return {
        success: false,
        error: 'Proof generation failed',
        timeMs: 1,
        providerId: 'failing-provider',
      }
    },
  }
}

// ─── Dependency Analyzer Tests ───────────────────────────────────────────────

describe('DependencyAnalyzer', () => {
  let analyzer: DependencyAnalyzer

  beforeEach(() => {
    analyzer = new DependencyAnalyzer()
  })

  describe('analyze', () => {
    it('should analyze a simple linear dependency chain', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
        createDependencyNode('c', 'circuit-c', 'noir', { dependencies: ['b'] }),
      ]

      const result = analyzer.analyze(nodes)

      expect(result.hasCycles).toBe(false)
      expect(result.graph.roots).toEqual(['a'])
      expect(result.graph.leaves).toEqual(['c'])
      expect(result.graph.maxDepth).toBe(2)
      expect(result.executionLevels.length).toBe(3)
      expect(result.executionLevels[0]).toEqual(['a'])
      expect(result.executionLevels[1]).toEqual(['b'])
      expect(result.executionLevels[2]).toEqual(['c'])
    })

    it('should analyze a parallel graph', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir'),
        createDependencyNode('c', 'circuit-c', 'noir'),
      ]

      const result = analyzer.analyze(nodes)

      expect(result.hasCycles).toBe(false)
      expect(result.graph.roots).toHaveLength(3)
      expect(result.graph.leaves).toHaveLength(3)
      expect(result.graph.maxDepth).toBe(0)
      expect(result.executionLevels.length).toBe(1)
      expect(result.executionLevels[0]).toHaveLength(3)
      expect(result.suggestedParallelism).toBe(3)
    })

    it('should analyze a diamond dependency pattern', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
        createDependencyNode('c', 'circuit-c', 'noir', { dependencies: ['a'] }),
        createDependencyNode('d', 'circuit-d', 'noir', { dependencies: ['b', 'c'] }),
      ]

      const result = analyzer.analyze(nodes)

      expect(result.hasCycles).toBe(false)
      expect(result.graph.roots).toEqual(['a'])
      expect(result.graph.leaves).toEqual(['d'])
      expect(result.executionLevels.length).toBe(3)
      expect(result.executionLevels[0]).toEqual(['a'])
      expect(result.executionLevels[1]).toHaveLength(2) // b and c in parallel
      expect(result.executionLevels[2]).toEqual(['d'])
      expect(result.suggestedParallelism).toBe(2)
    })

    it('should detect cycles', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir', { dependencies: ['c'] }),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
        createDependencyNode('c', 'circuit-c', 'noir', { dependencies: ['b'] }),
      ]

      const result = analyzer.analyze(nodes)

      expect(result.hasCycles).toBe(true)
      expect(result.cyclePath).toBeDefined()
      expect(result.cyclePath!.length).toBeGreaterThan(0)
    })

    it('should handle empty node list', () => {
      const result = analyzer.analyze([])

      expect(result.hasCycles).toBe(false)
      expect(result.graph.nodes.size).toBe(0)
      expect(result.executionLevels.length).toBe(0)
    })

    it('should calculate critical path', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir', { estimatedCost: 100 }),
        createDependencyNode('b', 'circuit-b', 'noir', {
          dependencies: ['a'],
          estimatedCost: 200,
        }),
        createDependencyNode('c', 'circuit-c', 'noir', {
          dependencies: ['a'],
          estimatedCost: 50,
        }),
        createDependencyNode('d', 'circuit-d', 'noir', {
          dependencies: ['b', 'c'],
          estimatedCost: 100,
        }),
      ]

      const result = analyzer.analyze(nodes)

      // Critical path should be a -> b -> d (total cost 400)
      expect(result.graph.criticalPath).toContain('a')
      expect(result.graph.criticalPath).toContain('b')
      expect(result.graph.criticalPath).toContain('d')
    })

    it('should identify bottlenecks', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir', { estimatedCost: 10 }),
        createDependencyNode('b', 'circuit-b', 'noir', {
          dependencies: ['a'],
          estimatedCost: 1000, // Bottleneck
        }),
        createDependencyNode('c', 'circuit-c', 'noir', {
          dependencies: ['b'],
          estimatedCost: 10,
        }),
      ]

      const result = analyzer.analyze(nodes)

      expect(result.bottlenecks).toContain('b')
    })
  })

  describe('getExecutionOrder', () => {
    it('should return topological order', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
        createDependencyNode('c', 'circuit-c', 'noir', { dependencies: ['b'] }),
      ]

      const analysis = analyzer.analyze(nodes)
      const order = analyzer.getExecutionOrder(analysis.graph)

      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
    })
  })

  describe('getReadyNodes', () => {
    it('should return nodes with satisfied dependencies', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
        createDependencyNode('c', 'circuit-c', 'noir', { dependencies: ['a'] }),
      ]

      const analysis = analyzer.analyze(nodes)
      const completed = new Set(['a'])

      const ready = analyzer.getReadyNodes(analysis.graph, completed)

      expect(ready).toContain('b')
      expect(ready).toContain('c')
      expect(ready).not.toContain('a')
    })

    it('should sort by priority then cost', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir', {
          estimatedCost: 100,
          priority: 1,
        }),
        createDependencyNode('b', 'circuit-b', 'noir', {
          estimatedCost: 50,
          priority: 2,
        }),
        createDependencyNode('c', 'circuit-c', 'noir', {
          estimatedCost: 200,
          priority: 2,
        }),
      ]

      const analysis = analyzer.analyze(nodes)
      const ready = analyzer.getReadyNodes(analysis.graph, new Set())

      // b has higher priority and lower cost than c
      expect(ready[0]).toBe('b')
      expect(ready[1]).toBe('c')
      expect(ready[2]).toBe('a')
    })
  })

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
      ]

      const analysis = analyzer.analyze(nodes)
      const newNode = createDependencyNode('b', 'circuit-b', 'noir', {
        dependencies: ['a'],
      })

      const updatedGraph = analyzer.addNode(analysis.graph, newNode)

      expect(updatedGraph.nodes.has('b')).toBe(true)
      expect(updatedGraph.leaves).toContain('b')
    })
  })

  describe('removeNode', () => {
    it('should remove a node from the graph', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
      ]

      const analysis = analyzer.analyze(nodes)
      const updatedGraph = analyzer.removeNode(analysis.graph, 'b')

      expect(updatedGraph.nodes.has('b')).toBe(false)
      expect(updatedGraph.nodes.has('a')).toBe(true)
      expect(updatedGraph.leaves).toContain('a')
    })
  })

  describe('validateAcyclic', () => {
    it('should return true for acyclic graph', () => {
      const nodes: DependencyNode[] = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
      ]

      const analysis = analyzer.analyze(nodes)

      expect(analyzer.validateAcyclic(analysis.graph)).toBe(true)
    })
  })
})

describe('createDependencyNode', () => {
  it('should create a node with defaults', () => {
    const node = createDependencyNode('test', 'circuit-test', 'noir')

    expect(node.id).toBe('test')
    expect(node.circuitId).toBe('circuit-test')
    expect(node.system).toBe('noir')
    expect(node.dependencies).toEqual([])
    expect(node.estimatedCost).toBe(100)
    expect(node.estimatedMemory).toBe(64 * 1024 * 1024)
  })

  it('should create a node with custom options', () => {
    const node = createDependencyNode('test', 'circuit-test', 'halo2', {
      dependencies: ['a', 'b'],
      estimatedCost: 500,
      estimatedMemory: 128 * 1024 * 1024,
      privateInputs: { secret: '0x123' },
      publicInputs: { value: 100 },
      priority: 2,
    })

    expect(node.dependencies).toEqual(['a', 'b'])
    expect(node.estimatedCost).toBe(500)
    expect(node.estimatedMemory).toBe(128 * 1024 * 1024)
    expect(node.privateInputs).toEqual({ secret: '0x123' })
    expect(node.publicInputs).toEqual({ value: 100 })
    expect(node.priority).toBe(2)
  })
})

// ─── Concurrency Manager Tests ───────────────────────────────────────────────

describe('ConcurrencyManager', () => {
  let manager: ConcurrencyManager

  beforeEach(() => {
    manager = new ConcurrencyManager()
  })

  afterEach(() => {
    manager.stopMonitoring()
  })

  describe('getResources', () => {
    it('should return system resources', () => {
      const resources = manager.getResources()

      expect(resources.cpuCores).toBeGreaterThan(0)
      expect(resources.totalMemory).toBeGreaterThan(0)
      expect(resources.availableMemory).toBeGreaterThan(0)
      expect(resources.cpuUsage).toBeGreaterThanOrEqual(0)
      expect(resources.memoryUsage).toBeGreaterThanOrEqual(0)
      expect(typeof resources.isBrowser).toBe('boolean')
      expect(typeof resources.supportsWebWorkers).toBe('boolean')
      expect(typeof resources.supportsSharedArrayBuffer).toBe('boolean')
    })
  })

  describe('calculateOptimalConcurrency', () => {
    it('should return concurrency decision', () => {
      const decision = manager.calculateOptimalConcurrency()

      expect(decision.recommendedConcurrency).toBeGreaterThanOrEqual(
        DEFAULT_CONCURRENCY_CONFIG.minConcurrency
      )
      expect(decision.recommendedConcurrency).toBeLessThanOrEqual(
        DEFAULT_CONCURRENCY_CONFIG.maxConcurrentProofs
      )
      expect(decision.reason).toBeDefined()
      expect(decision.resources).toBeDefined()
      expect(decision.timestamp).toBeGreaterThan(0)
    })
  })

  describe('getCurrentLimit', () => {
    it('should return current limit', () => {
      const limit = manager.getCurrentLimit()

      expect(limit).toBe(DEFAULT_CONCURRENCY_CONFIG.maxConcurrentProofs)
    })
  })

  describe('setLimit', () => {
    it('should set limit within bounds', () => {
      manager.setLimit(2)
      expect(manager.getCurrentLimit()).toBe(2)

      manager.setLimit(0)
      expect(manager.getCurrentLimit()).toBe(DEFAULT_CONCURRENCY_CONFIG.minConcurrency)

      manager.setLimit(100)
      expect(manager.getCurrentLimit()).toBe(DEFAULT_CONCURRENCY_CONFIG.maxConcurrentProofs)
    })
  })

  describe('monitoring', () => {
    it('should start and stop monitoring', () => {
      manager.startMonitoring()
      manager.stopMonitoring()
      // Should not throw
    })
  })
})

describe('getRecommendedConcurrency', () => {
  it('should return a reasonable value', () => {
    const recommended = getRecommendedConcurrency()

    expect(recommended).toBeGreaterThanOrEqual(1)
    expect(recommended).toBeLessThanOrEqual(8)
  })
})

// ─── Work Stealing Scheduler Tests ───────────────────────────────────────────

describe('WorkStealingScheduler', () => {
  let scheduler: WorkStealingScheduler

  beforeEach(() => {
    scheduler = new WorkStealingScheduler()
  })

  describe('assign', () => {
    it('should assign task to worker with shortest queue', () => {
      // Register workers
      scheduler.registerWorker({
        id: 'worker-1',
        status: 'idle',
        currentTask: null,
        taskQueue: [],
        tasksCompleted: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })

      const task = {
        id: 'task-1',
        node: createDependencyNode('n1', 'circuit', 'noir'),
        priority: 'normal' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
      }

      const workerId = scheduler.assign(task)

      expect(workerId).toBe('worker-1')
    })

    it('should return null if no workers available', () => {
      const task = {
        id: 'task-1',
        node: createDependencyNode('n1', 'circuit', 'noir'),
        priority: 'normal' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
      }

      const workerId = scheduler.assign(task)

      expect(workerId).toBeNull()
    })
  })

  describe('steal', () => {
    it('should steal from worker with longest queue', () => {
      const task1 = {
        id: 'task-1',
        node: createDependencyNode('n1', 'circuit', 'noir'),
        priority: 'normal' as const,
        status: 'queued' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
      }

      const task2 = {
        id: 'task-2',
        node: createDependencyNode('n2', 'circuit', 'noir'),
        priority: 'normal' as const,
        status: 'queued' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
      }

      // Worker 1 has empty queue
      scheduler.registerWorker({
        id: 'worker-1',
        status: 'idle',
        currentTask: null,
        taskQueue: [],
        tasksCompleted: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })

      // Worker 2 has 2 tasks
      scheduler.registerWorker({
        id: 'worker-2',
        status: 'busy',
        currentTask: null,
        taskQueue: [task1, task2],
        tasksCompleted: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })

      const stolen = scheduler.steal('worker-1')

      expect(stolen).not.toBeNull()
      expect(stolen!.id).toBe('task-2') // LIFO steal
    })

    it('should return null if no work to steal', () => {
      scheduler.registerWorker({
        id: 'worker-1',
        status: 'idle',
        currentTask: null,
        taskQueue: [],
        tasksCompleted: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })

      const stolen = scheduler.steal('worker-1')

      expect(stolen).toBeNull()
    })
  })

  describe('getStealingStats', () => {
    it('should return stats for all workers', () => {
      scheduler.registerWorker({
        id: 'worker-1',
        status: 'idle',
        currentTask: null,
        taskQueue: [],
        tasksCompleted: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })

      const stats = scheduler.getStealingStats()

      expect(stats).toHaveLength(1)
      expect(stats[0].workerId).toBe('worker-1')
    })
  })

  describe('clearWorkerQueue', () => {
    it('should clear queue and return tasks', () => {
      const task = {
        id: 'task-1',
        node: createDependencyNode('n1', 'circuit', 'noir'),
        priority: 'normal' as const,
        status: 'queued' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
      }

      scheduler.registerWorker({
        id: 'worker-1',
        status: 'idle',
        currentTask: null,
        taskQueue: [task],
        tasksCompleted: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      })

      const tasks = scheduler.clearWorkerQueue('worker-1')

      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe('task-1')
    })
  })
})

// ─── Worker Pool Tests ───────────────────────────────────────────────────────

describe('WorkerPool', () => {
  let pool: WorkerPool

  afterEach(async () => {
    if (pool) {
      await pool.shutdown()
    }
  })

  describe('constructor', () => {
    it('should initialize with minimum workers', () => {
      pool = new WorkerPool(
        { minWorkers: 2, maxWorkers: 4 },
        createMockProvider
      )

      const stats = pool.getStats()
      expect(stats.workerCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('submit', () => {
    it('should execute a task and return proof', async () => {
      pool = new WorkerPool(
        { minWorkers: 1, maxWorkers: 2 },
        createMockProvider
      )

      const task = {
        id: 'task-1',
        node: createDependencyNode('n1', 'circuit-1', 'noir'),
        priority: 'normal' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
      }

      const proof = await pool.submit(task)

      expect(proof).toBeDefined()
      expect(proof.metadata.system).toBe('noir')
    })

    it('should handle task failure', async () => {
      pool = new WorkerPool(
        { minWorkers: 1, maxWorkers: 2 },
        createFailingProvider
      )

      const task = {
        id: 'task-1',
        node: createDependencyNode('n1', 'circuit-1', 'noir'),
        priority: 'normal' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 0, // No retries
      }

      await expect(pool.submit(task)).rejects.toThrow()
    })

    it('should call completion callback', async () => {
      pool = new WorkerPool(
        { minWorkers: 1, maxWorkers: 2 },
        createMockProvider
      )

      const task = {
        id: 'task-1',
        node: createDependencyNode('n1', 'circuit-1', 'noir'),
        priority: 'normal' as const,
        status: 'pending' as const,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
      }

      const onComplete = vi.fn()
      await pool.submit(task, { onComplete })

      expect(onComplete).toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('should return pool statistics', () => {
      pool = new WorkerPool(
        { minWorkers: 1, maxWorkers: 2 },
        createMockProvider
      )

      const stats = pool.getStats()

      expect(stats.workerCount).toBeGreaterThanOrEqual(1)
      expect(stats.completedTasks).toBe(0)
      expect(stats.failedTasks).toBe(0)
      expect(stats.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getWorkers', () => {
    it('should return worker info', () => {
      pool = new WorkerPool(
        { minWorkers: 2, maxWorkers: 4 },
        createMockProvider
      )

      const workers = pool.getWorkers()

      expect(workers.length).toBeGreaterThanOrEqual(2)
      expect(workers[0].id).toBeDefined()
      expect(workers[0].status).toBeDefined()
    })
  })

  describe('scale', () => {
    it('should scale up workers', async () => {
      pool = new WorkerPool(
        { minWorkers: 1, maxWorkers: 4 },
        createMockProvider
      )

      await pool.scale(3)

      const stats = pool.getStats()
      expect(stats.workerCount).toBe(3)
    })

    it('should not scale below minimum', async () => {
      pool = new WorkerPool(
        { minWorkers: 2, maxWorkers: 4 },
        createMockProvider
      )

      await pool.scale(1)

      const stats = pool.getStats()
      expect(stats.workerCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('pause and resume', () => {
    it('should pause and resume execution', () => {
      pool = new WorkerPool(
        { minWorkers: 1, maxWorkers: 2 },
        createMockProvider
      )

      pool.pause()
      pool.resume()
      // Should not throw
    })
  })

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      pool = new WorkerPool(
        { minWorkers: 1, maxWorkers: 2 },
        createMockProvider
      )

      await pool.shutdown()

      expect(pool.isRunning()).toBe(false)
    })
  })
})

// ─── Parallel Executor Tests ─────────────────────────────────────────────────

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor

  beforeEach(() => {
    executor = new ParallelExecutor(createMockProvider)
  })

  describe('execute', () => {
    it('should execute empty node list', async () => {
      const result = await executor.execute([])

      expect(result.success).toBe(true)
      expect(result.proofs).toHaveLength(0)
    })

    it('should execute independent nodes in parallel', async () => {
      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir'),
        createDependencyNode('c', 'circuit-c', 'noir'),
      ]

      const result = await executor.execute(nodes)

      expect(result.success).toBe(true)
      expect(result.proofs).toHaveLength(3)
      expect(result.stats.maxParallelism).toBe(3)
    })

    it('should respect dependencies', async () => {
      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
      ]

      const result = await executor.execute(nodes)

      expect(result.success).toBe(true)
      expect(result.proofs).toHaveLength(2)
      // a should be before b in the result
      const proofOrder = result.proofs.map((p) => p.metadata?.circuitId)
      expect(proofOrder.indexOf('circuit-a')).toBeLessThan(
        proofOrder.indexOf('circuit-b')
      )
    })

    it('should detect cycles and throw', async () => {
      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir', { dependencies: ['b'] }),
        createDependencyNode('b', 'circuit-b', 'noir', { dependencies: ['a'] }),
      ]

      await expect(executor.execute(nodes)).rejects.toThrow('cycle')
    })

    it('should emit progress events', async () => {
      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir'),
      ]

      const progressEvents: ParallelProgressEvent[] = []
      const result = await executor.execute(nodes, {
        enableProgress: true,
        onProgress: (event) => progressEvents.push(event),
      })

      expect(result.success).toBe(true)
      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents.some((e) => e.type === 'task_started')).toBe(true)
      expect(progressEvents.some((e) => e.type === 'task_completed')).toBe(true)
      expect(progressEvents.some((e) => e.type === 'all_completed')).toBe(true)
    })

    it('should handle diamond dependency pattern', async () => {
      const nodes = [
        createDependencyNode('root', 'circuit-root', 'noir'),
        createDependencyNode('left', 'circuit-left', 'noir', {
          dependencies: ['root'],
        }),
        createDependencyNode('right', 'circuit-right', 'noir', {
          dependencies: ['root'],
        }),
        createDependencyNode('merge', 'circuit-merge', 'noir', {
          dependencies: ['left', 'right'],
        }),
      ]

      const result = await executor.execute(nodes)

      expect(result.success).toBe(true)
      expect(result.proofs).toHaveLength(4)
      expect(result.stats.maxParallelism).toBe(2) // left and right parallel
    })

    it('should collect errors', async () => {
      const failingExecutor = new ParallelExecutor(createFailingProvider)

      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir'),
      ]

      const result = await failingExecutor.execute(nodes)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should calculate speedup factor', async () => {
      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir', { estimatedCost: 100 }),
        createDependencyNode('b', 'circuit-b', 'noir', { estimatedCost: 100 }),
      ]

      const result = await executor.execute(nodes)

      expect(result.stats.speedupFactor).toBeDefined()
      expect(result.stats.efficiency).toBeDefined()
    })
  })

  describe('cancel', () => {
    it('should cancel execution', async () => {
      // Create slow provider
      const slowExecutor = new ParallelExecutor(() => createMockProvider(500))

      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir'),
      ]

      const executePromise = slowExecutor.execute(nodes)

      // Cancel after a short delay
      setTimeout(() => slowExecutor.cancel(), 50)

      // Should complete (possibly with partial results)
      const result = await executePromise
      expect(result).toBeDefined()
    })
  })

  describe('getStatus', () => {
    it('should return execution status', () => {
      const status = executor.getStatus()

      expect(status.running).toBe(false)
      expect(status.progress).toBe(0)
      expect(status.completed).toBe(0)
      expect(status.total).toBe(0)
    })
  })

  describe('getAnalyzer', () => {
    it('should return the dependency analyzer', () => {
      const analyzer = executor.getAnalyzer()

      expect(analyzer).toBeDefined()
      expect(typeof analyzer.analyze).toBe('function')
    })
  })

  describe('getConcurrencyManager', () => {
    it('should return the concurrency manager', () => {
      const manager = executor.getConcurrencyManager()

      expect(manager).toBeDefined()
      expect(typeof manager.getCurrentLimit).toBe('function')
    })
  })
})

// ─── Factory Function Tests ──────────────────────────────────────────────────

describe('Factory Functions', () => {
  describe('createDependencyAnalyzer', () => {
    it('should create a dependency analyzer', () => {
      const analyzer = createDependencyAnalyzer()

      expect(analyzer).toBeInstanceOf(DependencyAnalyzer)
    })
  })

  describe('createConcurrencyManager', () => {
    it('should create a concurrency manager', () => {
      const manager = createConcurrencyManager()

      expect(manager).toBeDefined()
      expect(typeof manager.getCurrentLimit).toBe('function')
    })

    it('should accept custom config', () => {
      const manager = createConcurrencyManager({ maxConcurrentProofs: 8 })

      expect(manager.getCurrentLimit()).toBe(8)
    })
  })

  describe('createWorkerPool', () => {
    it('should create a worker pool', async () => {
      const pool = createWorkerPool({ minWorkers: 1 }, createMockProvider)

      expect(pool).toBeDefined()
      expect(pool.isRunning()).toBe(true)

      await pool.shutdown()
    })
  })

  describe('createParallelExecutor', () => {
    it('should create a parallel executor', () => {
      const executor = createParallelExecutor(createMockProvider)

      expect(executor).toBeDefined()
      expect(typeof executor.execute).toBe('function')
    })
  })

  describe('executeParallel', () => {
    it('should execute proofs in parallel', async () => {
      const nodes = [
        createDependencyNode('a', 'circuit-a', 'noir'),
        createDependencyNode('b', 'circuit-b', 'noir'),
      ]

      const result = await executeParallel(nodes, createMockProvider)

      expect(result.success).toBe(true)
      expect(result.proofs).toHaveLength(2)
    })
  })
})

// ─── Default Config Tests ────────────────────────────────────────────────────

describe('Default Configurations', () => {
  it('should have valid DEFAULT_WORKER_POOL_CONFIG', () => {
    expect(DEFAULT_WORKER_POOL_CONFIG.minWorkers).toBe(1)
    expect(DEFAULT_WORKER_POOL_CONFIG.maxWorkers).toBe(4)
    expect(DEFAULT_WORKER_POOL_CONFIG.enableWorkStealing).toBe(true)
  })

  it('should have valid DEFAULT_CONCURRENCY_CONFIG', () => {
    expect(DEFAULT_CONCURRENCY_CONFIG.maxConcurrentProofs).toBe(4)
    expect(DEFAULT_CONCURRENCY_CONFIG.minConcurrency).toBe(1)
    expect(DEFAULT_CONCURRENCY_CONFIG.enableAdaptive).toBe(true)
  })

  it('should have valid DEFAULT_SCHEDULER_CONFIG', () => {
    expect(DEFAULT_SCHEDULER_CONFIG.strategy).toBe('balanced')
    expect(DEFAULT_SCHEDULER_CONFIG.enableBatching).toBe(true)
  })
})
