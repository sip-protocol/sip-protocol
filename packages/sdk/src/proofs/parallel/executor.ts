/**
 * Parallel Proof Executor
 *
 * @module proofs/parallel/executor
 * @description Main executor for parallel proof generation with dependency resolution
 *
 * M20-12: Optimize proof generation parallelization (#307)
 */

import type { SingleProof } from '@sip-protocol/types'
import type {
  DependencyNode,
  ParallelExecutionOptions,
  ParallelProgressEvent,
  ParallelExecutionResult,
  ParallelExecutionStats,
  ParallelExecutionError,
  ProofTask,
  IParallelExecutor,
  IDependencyAnalyzer,
  IWorkerPool,
  IConcurrencyManager,
} from './interface'
import { DependencyAnalyzer } from './dependency-graph'
import { ConcurrencyManager } from './concurrency'
import { WorkerPool } from './worker-pool'
import type { ComposableProofProvider } from '../composer'

// ─── Parallel Executor Implementation ────────────────────────────────────────

/**
 * Executes proofs in parallel with dependency resolution and resource optimization
 */
export class ParallelExecutor implements IParallelExecutor {
  private readonly analyzer: IDependencyAnalyzer
  private readonly concurrencyManager: IConcurrencyManager
  private pool: IWorkerPool | null = null
  private readonly providerFactory: () => ComposableProofProvider

  private running = false
  private cancelled = false
  private completed = 0
  private total = 0

  constructor(providerFactory: () => ComposableProofProvider) {
    this.analyzer = new DependencyAnalyzer()
    this.concurrencyManager = new ConcurrencyManager()
    this.providerFactory = providerFactory
  }

  /**
   * Execute proofs in parallel with dependency resolution
   */
  async execute(
    nodes: DependencyNode[],
    options?: ParallelExecutionOptions
  ): Promise<ParallelExecutionResult> {
    if (nodes.length === 0) {
      return this.createEmptyResult()
    }

    this.running = true
    this.cancelled = false
    this.completed = 0
    this.total = nodes.length

    const startTime = Date.now()
    const errors: ParallelExecutionError[] = []
    const proofMap = new Map<string, SingleProof>()
    const completedSet = new Set<string>()

    // Analyze dependencies
    const analysis = this.analyzer.analyze(nodes)

    if (analysis.hasCycles) {
      throw new Error(
        `Dependency cycle detected: ${analysis.cyclePath?.join(' -> ')}`
      )
    }

    // Initialize worker pool
    const poolConfig = {
      minWorkers: 1,
      maxWorkers: Math.min(
        analysis.suggestedParallelism,
        this.concurrencyManager.getCurrentLimit()
      ),
      ...options?.poolConfig,
    }

    this.pool = new WorkerPool(poolConfig, this.providerFactory)

    // Start concurrency monitoring
    this.concurrencyManager.startMonitoring()

    try {
      // Process in levels (parallel within level, sequential across levels)
      let currentLevel = 0
      let maxParallelism = 0
      let totalParallelism = 0
      let parallelismSamples = 0
      let criticalPathTime = 0
      const levelStartTimes = new Map<number, number>()

      for (const level of analysis.executionLevels) {
        if (this.cancelled) break

        levelStartTimes.set(currentLevel, Date.now())
        const levelTasks: Promise<{ id: string; proof: SingleProof }>[] = []

        // Track parallelism
        maxParallelism = Math.max(maxParallelism, level.length)
        totalParallelism += level.length
        parallelismSamples++

        // Submit all tasks in this level
        for (const nodeId of level) {
          if (this.cancelled) break

          const node = analysis.graph.nodes.get(nodeId)!
          const task = this.createTask(node)

          // Emit progress event
          this.emitProgress(options, {
            type: 'task_started',
            taskId: nodeId,
            completed: this.completed,
            total: this.total,
            percentage: Math.round((this.completed / this.total) * 100),
            elapsedMs: Date.now() - startTime,
            currentParallelism: level.length,
            poolStats: this.pool?.getStats(),
          })

          const taskPromise = this.pool!
            .submit(task, {
              priority: task.priority,
              maxRetries: task.maxRetries,
              timeoutMs: options?.timeoutMs ?? 120000,
              onComplete: () => {
                this.completed++
                completedSet.add(nodeId)

                this.emitProgress(options, {
                  type: 'task_completed',
                  taskId: nodeId,
                  completed: this.completed,
                  total: this.total,
                  percentage: Math.round((this.completed / this.total) * 100),
                  elapsedMs: Date.now() - startTime,
                  estimatedRemainingMs: this.estimateRemainingTime(startTime),
                  currentParallelism: levelTasks.length,
                  poolStats: this.pool?.getStats(),
                })
              },
              onError: (t, error) => {
                errors.push({
                  taskId: t.id,
                  message: error.message,
                  stack: error.stack,
                  retryCount: t.retryCount,
                  wasRetried: t.retryCount > 0,
                  timestamp: Date.now(),
                })

                this.emitProgress(options, {
                  type: 'task_failed',
                  taskId: nodeId,
                  completed: this.completed,
                  total: this.total,
                  percentage: Math.round((this.completed / this.total) * 100),
                  elapsedMs: Date.now() - startTime,
                  currentParallelism: levelTasks.length,
                  poolStats: this.pool?.getStats(),
                })
              },
            })
            .then((proof) => ({ id: nodeId, proof }))

          levelTasks.push(taskPromise)
        }

        // Wait for all tasks in this level to complete
        const results = await Promise.allSettled(levelTasks)

        // Collect successful results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            proofMap.set(result.value.id, result.value.proof)
          }
        }

        // Track critical path time (if this level is on critical path)
        const levelTime = Date.now() - (levelStartTimes.get(currentLevel) ?? startTime)
        const isCriticalPathLevel = level.some((id) =>
          analysis.graph.criticalPath.includes(id)
        )
        if (isCriticalPathLevel) {
          criticalPathTime += levelTime
        }

        this.emitProgress(options, {
          type: 'batch_completed',
          completed: this.completed,
          total: this.total,
          percentage: Math.round((this.completed / this.total) * 100),
          elapsedMs: Date.now() - startTime,
          currentParallelism: 0,
          poolStats: this.pool?.getStats(),
        })

        currentLevel++
      }

      const totalTime = Date.now() - startTime
      const averageParallelism =
        parallelismSamples > 0 ? totalParallelism / parallelismSamples : 1

      // Calculate speedup vs sequential execution
      const sequentialTime = this.estimateSequentialTime(nodes)
      const speedupFactor = sequentialTime > 0 ? totalTime / sequentialTime : 1
      const efficiency = averageParallelism > 0 ? speedupFactor / averageParallelism : 1

      this.emitProgress(options, {
        type: 'all_completed',
        completed: this.completed,
        total: this.total,
        percentage: 100,
        elapsedMs: totalTime,
        currentParallelism: 0,
        poolStats: this.pool?.getStats(),
      })

      // Build ordered proof array
      const orderedProofs: SingleProof[] = []
      if (options?.preserveOrder !== false) {
        // Use execution order
        const executionOrder = this.analyzer.getExecutionOrder(analysis.graph)
        for (const nodeId of executionOrder) {
          const proof = proofMap.get(nodeId)
          if (proof) {
            orderedProofs.push(proof)
          }
        }
      } else {
        orderedProofs.push(...proofMap.values())
      }

      const stats: ParallelExecutionStats = {
        totalTimeMs: totalTime,
        criticalPathTimeMs: criticalPathTime,
        maxParallelism,
        averageParallelism,
        tasksCompleted: this.completed,
        tasksFailed: errors.length,
        workSteals: this.pool?.getStats().workSteals ?? 0,
        peakMemoryUsage: this.pool?.getStats().peakMemoryUsage ?? 0,
        speedupFactor,
        efficiency,
      }

      return {
        proofs: orderedProofs,
        proofMap,
        stats,
        errors,
        success: errors.length === 0,
      }
    } finally {
      this.running = false
      this.concurrencyManager.stopMonitoring()
      await this.pool?.shutdown()
      this.pool = null
    }
  }

  /**
   * Cancel ongoing execution
   */
  async cancel(): Promise<void> {
    this.cancelled = true
    if (this.pool) {
      await this.pool.shutdown()
    }
  }

  /**
   * Get current execution status
   */
  getStatus(): {
    readonly running: boolean
    readonly progress: number
    readonly completed: number
    readonly total: number
  } {
    return {
      running: this.running,
      progress: this.total > 0 ? Math.round((this.completed / this.total) * 100) : 0,
      completed: this.completed,
      total: this.total,
    }
  }

  /**
   * Get the dependency analyzer
   */
  getAnalyzer(): IDependencyAnalyzer {
    return this.analyzer
  }

  /**
   * Get the worker pool
   */
  getPool(): IWorkerPool {
    if (!this.pool) {
      throw new Error('Worker pool not initialized. Call execute() first.')
    }
    return this.pool
  }

  /**
   * Get the concurrency manager
   */
  getConcurrencyManager(): IConcurrencyManager {
    return this.concurrencyManager
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private createTask(node: DependencyNode): ProofTask {
    return {
      id: node.id,
      node,
      priority: this.getPriority(node),
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 2,
    }
  }

  private getPriority(node: DependencyNode): ProofTask['priority'] {
    if (node.priority !== undefined) {
      if (node.priority >= 3) return 'critical'
      if (node.priority >= 2) return 'high'
      if (node.priority >= 1) return 'normal'
      return 'low'
    }
    return 'normal'
  }

  private createEmptyResult(): ParallelExecutionResult {
    return {
      proofs: [],
      proofMap: new Map(),
      stats: {
        totalTimeMs: 0,
        criticalPathTimeMs: 0,
        maxParallelism: 0,
        averageParallelism: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        workSteals: 0,
        peakMemoryUsage: 0,
        speedupFactor: 1,
        efficiency: 1,
      },
      errors: [],
      success: true,
    }
  }

  private emitProgress(
    options: ParallelExecutionOptions | undefined,
    event: ParallelProgressEvent
  ): void {
    if (options?.enableProgress !== false && options?.onProgress) {
      options.onProgress(event)
    }
  }

  private estimateRemainingTime(startTime: number): number {
    if (this.completed === 0) {
      return 0
    }

    const elapsedMs = Date.now() - startTime
    const avgTimePerTask = elapsedMs / this.completed
    const remaining = this.total - this.completed

    return Math.round(avgTimePerTask * remaining)
  }

  private estimateSequentialTime(nodes: DependencyNode[]): number {
    // Sum of all estimated costs (normalized to ms)
    // Assuming 1 cost unit = 10ms
    return nodes.reduce((sum, node) => sum + node.estimatedCost * 10, 0)
  }
}

/**
 * Create a parallel executor instance
 */
export function createParallelExecutor(
  providerFactory: () => ComposableProofProvider
): IParallelExecutor {
  return new ParallelExecutor(providerFactory)
}

/**
 * Execute proofs in parallel (convenience function)
 */
export async function executeParallel(
  nodes: DependencyNode[],
  providerFactory: () => ComposableProofProvider,
  options?: ParallelExecutionOptions
): Promise<ParallelExecutionResult> {
  const executor = createParallelExecutor(providerFactory)
  return executor.execute(nodes, options)
}
