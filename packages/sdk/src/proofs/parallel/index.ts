/**
 * Parallel Proof Generation Module
 *
 * @module proofs/parallel
 * @description Optimized parallel proof generation with dependency resolution,
 * work stealing, and resource-aware concurrency control
 *
 * M20-12: Optimize proof generation parallelization (#307)
 *
 * ## Overview
 *
 * This module provides infrastructure for executing multiple proof generation
 * tasks in parallel with:
 *
 * - **Dependency Graph Analysis**: Determines optimal execution order
 * - **Worker Pool**: Manages parallel workers with work stealing
 * - **Concurrency Control**: CPU/memory-aware dynamic concurrency
 * - **Progress Tracking**: Real-time execution progress events
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   createParallelExecutor,
 *   createDependencyNode,
 * } from '@sip-protocol/sdk/proofs/parallel'
 *
 * // Create proof nodes with dependencies
 * const nodes = [
 *   createDependencyNode('proof-1', 'commitment', 'noir'),
 *   createDependencyNode('proof-2', 'funding', 'noir', {
 *     dependencies: ['proof-1'],
 *   }),
 *   createDependencyNode('proof-3', 'validity', 'halo2', {
 *     dependencies: ['proof-1'],
 *   }),
 *   createDependencyNode('proof-4', 'fulfillment', 'noir', {
 *     dependencies: ['proof-2', 'proof-3'],
 *   }),
 * ]
 *
 * // Execute in parallel
 * const executor = createParallelExecutor(() => myProofProvider)
 * const result = await executor.execute(nodes, {
 *   onProgress: (event) => console.log(`${event.percentage}% complete`),
 * })
 *
 * console.log(`Generated ${result.proofs.length} proofs`)
 * console.log(`Speedup: ${result.stats.speedupFactor}x`)
 * ```
 */

// ─── Types and Interfaces ────────────────────────────────────────────────────

export type {
  // Dependency Graph
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  GraphAnalysis,
  // Worker Pool
  WorkerStatus,
  WorkerInfo,
  WorkerPoolConfig,
  WorkerPoolStats,
  // Tasks
  TaskStatus,
  TaskPriority,
  ProofTask,
  TaskSubmitOptions,
  // Concurrency
  SystemResources,
  ConcurrencyConfig,
  ConcurrencyDecision,
  // Work Stealing
  WorkerStealingStats,
  WorkStealEvent,
  // Execution
  ParallelExecutionOptions,
  ParallelProgressEvent,
  ParallelExecutionResult,
  ParallelExecutionStats,
  ParallelExecutionError,
  // Scheduler
  SchedulingStrategy,
  SchedulerConfig,
  // Interface contracts
  IDependencyAnalyzer,
  IWorkerPool,
  IConcurrencyManager,
  IWorkStealingScheduler,
  IParallelExecutor,
} from './interface'

export {
  DEFAULT_WORKER_POOL_CONFIG,
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_SCHEDULER_CONFIG,
} from './interface'

// ─── Dependency Graph ────────────────────────────────────────────────────────

export {
  DependencyAnalyzer,
  createDependencyAnalyzer,
  createDependencyNode,
} from './dependency-graph'

// ─── Concurrency Management ──────────────────────────────────────────────────

export {
  ConcurrencyManager,
  createConcurrencyManager,
  getRecommendedConcurrency,
} from './concurrency'

// ─── Worker Pool ─────────────────────────────────────────────────────────────

export {
  WorkerPool,
  WorkStealingScheduler,
  createWorkerPool,
} from './worker-pool'

// ─── Parallel Executor ───────────────────────────────────────────────────────

export {
  ParallelExecutor,
  createParallelExecutor,
  executeParallel,
} from './executor'
