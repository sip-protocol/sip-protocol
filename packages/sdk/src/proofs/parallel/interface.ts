/**
 * Parallel Proof Generation - Interface Definitions
 *
 * @module proofs/parallel
 * @description Types and interfaces for optimized parallel proof generation
 *
 * M20-12: Optimize proof generation parallelization (#307)
 */

import type { ProofSystem, SingleProof } from '@sip-protocol/types'

// ─── Dependency Graph Types ──────────────────────────────────────────────────

/**
 * Node in the proof dependency graph
 */
export interface DependencyNode {
  /** Unique identifier for this proof task */
  readonly id: string
  /** Circuit ID to execute */
  readonly circuitId: string
  /** Proof system to use */
  readonly system: ProofSystem
  /** IDs of proofs this depends on (must complete first) */
  readonly dependencies: readonly string[]
  /** Estimated computation cost (relative units) */
  readonly estimatedCost: number
  /** Estimated memory requirements in bytes */
  readonly estimatedMemory: number
  /** Private inputs for proof generation */
  readonly privateInputs: Record<string, unknown>
  /** Public inputs for proof generation */
  readonly publicInputs: Record<string, unknown>
  /** Optional priority (higher = scheduled first among peers) */
  readonly priority?: number
}

/**
 * Edge in the dependency graph
 */
export interface DependencyEdge {
  /** Source node ID (dependency) */
  readonly from: string
  /** Target node ID (depends on source) */
  readonly to: string
  /** How the dependency output is used */
  readonly connectionType: 'proof' | 'commitment' | 'witness'
}

/**
 * Complete dependency graph for parallel execution
 */
export interface DependencyGraph {
  /** All proof nodes */
  readonly nodes: Map<string, DependencyNode>
  /** All edges between nodes */
  readonly edges: DependencyEdge[]
  /** Root nodes (no dependencies) */
  readonly roots: readonly string[]
  /** Leaf nodes (no dependents) */
  readonly leaves: readonly string[]
  /** Maximum depth of the graph */
  readonly maxDepth: number
  /** Total estimated computation cost */
  readonly totalCost: number
  /** Critical path (longest chain) node IDs */
  readonly criticalPath: readonly string[]
}

/**
 * Analysis result from dependency graph
 */
export interface GraphAnalysis {
  /** The constructed graph */
  readonly graph: DependencyGraph
  /** Suggested parallelism level */
  readonly suggestedParallelism: number
  /** Execution levels (nodes that can run in parallel) */
  readonly executionLevels: readonly string[][]
  /** Whether graph has cycles (invalid) */
  readonly hasCycles: boolean
  /** Cycle path if cycles detected */
  readonly cyclePath?: readonly string[]
  /** Bottleneck nodes (high cost on critical path) */
  readonly bottlenecks: readonly string[]
}

// ─── Worker Pool Types ───────────────────────────────────────────────────────

/**
 * Worker status
 */
export type WorkerStatus = 'idle' | 'busy' | 'terminating' | 'terminated' | 'error'

/**
 * Worker information
 */
export interface WorkerInfo {
  /** Worker ID */
  readonly id: string
  /** Current status */
  readonly status: WorkerStatus
  /** Task currently being executed (if any) */
  readonly currentTask?: string
  /** Number of tasks completed */
  readonly tasksCompleted: number
  /** Total execution time in ms */
  readonly totalExecutionTime: number
  /** Average task time in ms */
  readonly averageTaskTime: number
  /** Memory usage estimate in bytes */
  readonly memoryUsage: number
  /** When the worker was created */
  readonly createdAt: number
  /** Last activity timestamp */
  readonly lastActiveAt: number
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Minimum number of workers to maintain */
  readonly minWorkers: number
  /** Maximum number of workers */
  readonly maxWorkers: number
  /** Worker idle timeout in ms before termination */
  readonly idleTimeoutMs: number
  /** Maximum memory per worker in bytes */
  readonly maxMemoryPerWorker: number
  /** Enable work stealing between workers */
  readonly enableWorkStealing: boolean
  /** Work stealing interval in ms */
  readonly workStealingIntervalMs: number
  /** Task queue high water mark */
  readonly taskQueueHighWaterMark: number
  /** Use Web Workers in browser (if available) */
  readonly useWebWorkers: boolean
  /** Worker script URL for Web Workers */
  readonly workerScriptUrl?: string
}

/**
 * Default worker pool configuration
 */
export const DEFAULT_WORKER_POOL_CONFIG: WorkerPoolConfig = {
  minWorkers: 1,
  maxWorkers: 4,
  idleTimeoutMs: 30000,
  maxMemoryPerWorker: 512 * 1024 * 1024, // 512MB
  enableWorkStealing: true,
  workStealingIntervalMs: 100,
  taskQueueHighWaterMark: 100,
  useWebWorkers: true,
}

/**
 * Worker pool statistics
 */
export interface WorkerPoolStats {
  /** Current number of workers */
  readonly workerCount: number
  /** Number of busy workers */
  readonly busyWorkers: number
  /** Number of idle workers */
  readonly idleWorkers: number
  /** Tasks in queue */
  readonly queuedTasks: number
  /** Tasks completed */
  readonly completedTasks: number
  /** Tasks failed */
  readonly failedTasks: number
  /** Total tasks submitted */
  readonly totalTasks: number
  /** Average task execution time in ms */
  readonly averageTaskTime: number
  /** Work steals performed */
  readonly workSteals: number
  /** Current memory usage estimate in bytes */
  readonly memoryUsage: number
  /** Peak memory usage in bytes */
  readonly peakMemoryUsage: number
  /** Pool uptime in ms */
  readonly uptime: number
}

// ─── Task Types ──────────────────────────────────────────────────────────────

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

/**
 * Proof generation task
 */
export interface ProofTask {
  /** Unique task ID */
  readonly id: string
  /** Dependency node this task executes */
  readonly node: DependencyNode
  /** Task priority */
  readonly priority: TaskPriority
  /** Current status */
  status: TaskStatus
  /** Assigned worker ID (if running) */
  workerId?: string
  /** Task creation timestamp */
  readonly createdAt: number
  /** Task start timestamp */
  startedAt?: number
  /** Task completion timestamp */
  completedAt?: number
  /** Result proof (if completed) */
  result?: SingleProof
  /** Error (if failed) */
  error?: Error
  /** Retry count */
  retryCount: number
  /** Maximum retries allowed */
  readonly maxRetries: number
}

/**
 * Task submission options
 */
export interface TaskSubmitOptions {
  /** Task priority */
  readonly priority?: TaskPriority
  /** Maximum retries */
  readonly maxRetries?: number
  /** Timeout in ms */
  readonly timeoutMs?: number
  /** Callback on completion */
  readonly onComplete?: (task: ProofTask) => void
  /** Callback on failure */
  readonly onError?: (task: ProofTask, error: Error) => void
  /** Callback on progress */
  readonly onProgress?: (task: ProofTask, progress: number) => void
}

// ─── Concurrency Control Types ───────────────────────────────────────────────

/**
 * System resource information
 */
export interface SystemResources {
  /** Number of logical CPU cores */
  readonly cpuCores: number
  /** Available memory in bytes */
  readonly availableMemory: number
  /** Total system memory in bytes */
  readonly totalMemory: number
  /** CPU usage percentage (0-100) */
  readonly cpuUsage: number
  /** Memory usage percentage (0-100) */
  readonly memoryUsage: number
  /** Whether running in browser */
  readonly isBrowser: boolean
  /** Whether Web Workers are supported */
  readonly supportsWebWorkers: boolean
  /** Whether SharedArrayBuffer is supported */
  readonly supportsSharedArrayBuffer: boolean
}

/**
 * Concurrency configuration
 */
export interface ConcurrencyConfig {
  /** Maximum concurrent proofs */
  readonly maxConcurrentProofs: number
  /** Maximum memory usage in bytes */
  readonly maxMemoryUsage: number
  /** CPU usage threshold to reduce concurrency (0-100) */
  readonly cpuThreshold: number
  /** Memory usage threshold to reduce concurrency (0-100) */
  readonly memoryThreshold: number
  /** Minimum concurrency level (never go below) */
  readonly minConcurrency: number
  /** Enable adaptive concurrency adjustment */
  readonly enableAdaptive: boolean
  /** Adaptive adjustment interval in ms */
  readonly adaptiveIntervalMs: number
}

/**
 * Default concurrency configuration
 */
export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxConcurrentProofs: 4,
  maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
  cpuThreshold: 80,
  memoryThreshold: 85,
  minConcurrency: 1,
  enableAdaptive: true,
  adaptiveIntervalMs: 1000,
}

/**
 * Concurrency adjustment decision
 */
export interface ConcurrencyDecision {
  /** Recommended concurrency level */
  readonly recommendedConcurrency: number
  /** Reason for adjustment */
  readonly reason: 'cpu_high' | 'memory_high' | 'resources_available' | 'no_change'
  /** Current system resources */
  readonly resources: SystemResources
  /** Timestamp */
  readonly timestamp: number
}

// ─── Work Stealing Types ─────────────────────────────────────────────────────

/**
 * Work stealing statistics for a worker
 */
export interface WorkerStealingStats {
  /** Worker ID */
  readonly workerId: string
  /** Tasks stolen from this worker */
  readonly tasksStolen: number
  /** Tasks acquired from other workers */
  readonly tasksAcquired: number
  /** Average queue length */
  readonly averageQueueLength: number
}

/**
 * Work stealing event
 */
export interface WorkStealEvent {
  /** Timestamp */
  readonly timestamp: number
  /** Worker that stole the task */
  readonly thief: string
  /** Worker that lost the task */
  readonly victim: string
  /** Task ID stolen */
  readonly taskId: string
  /** Victim's queue length at time of steal */
  readonly victimQueueLength: number
  /** Thief's queue length at time of steal */
  readonly thiefQueueLength: number
}

// ─── Parallel Execution Types ────────────────────────────────────────────────

/**
 * Parallel execution options
 */
export interface ParallelExecutionOptions {
  /** Worker pool configuration */
  readonly poolConfig?: Partial<WorkerPoolConfig>
  /** Concurrency configuration */
  readonly concurrencyConfig?: Partial<ConcurrencyConfig>
  /** Maximum execution time in ms */
  readonly timeoutMs?: number
  /** Enable progress events */
  readonly enableProgress?: boolean
  /** Progress callback */
  readonly onProgress?: (event: ParallelProgressEvent) => void
  /** Batch size for submitting tasks */
  readonly batchSize?: number
  /** Preserve order of results */
  readonly preserveOrder?: boolean
}

/**
 * Progress event for parallel execution
 */
export interface ParallelProgressEvent {
  /** Event type */
  readonly type: 'task_started' | 'task_completed' | 'task_failed' | 'batch_completed' | 'all_completed'
  /** Task ID (if applicable) */
  readonly taskId?: string
  /** Number of tasks completed */
  readonly completed: number
  /** Total number of tasks */
  readonly total: number
  /** Completion percentage (0-100) */
  readonly percentage: number
  /** Elapsed time in ms */
  readonly elapsedMs: number
  /** Estimated time remaining in ms */
  readonly estimatedRemainingMs?: number
  /** Current parallelism level */
  readonly currentParallelism: number
  /** Worker pool stats */
  readonly poolStats?: WorkerPoolStats
}

/**
 * Result of parallel execution
 */
export interface ParallelExecutionResult {
  /** All generated proofs (in dependency order) */
  readonly proofs: SingleProof[]
  /** Map of node ID to proof */
  readonly proofMap: Map<string, SingleProof>
  /** Execution statistics */
  readonly stats: ParallelExecutionStats
  /** Any errors encountered */
  readonly errors: ParallelExecutionError[]
  /** Whether execution completed successfully */
  readonly success: boolean
}

/**
 * Execution statistics
 */
export interface ParallelExecutionStats {
  /** Total execution time in ms */
  readonly totalTimeMs: number
  /** Time spent on critical path in ms */
  readonly criticalPathTimeMs: number
  /** Maximum parallelism achieved */
  readonly maxParallelism: number
  /** Average parallelism level */
  readonly averageParallelism: number
  /** Number of tasks completed */
  readonly tasksCompleted: number
  /** Number of tasks failed */
  readonly tasksFailed: number
  /** Number of work steals */
  readonly workSteals: number
  /** Peak memory usage in bytes */
  readonly peakMemoryUsage: number
  /** Speedup factor vs sequential */
  readonly speedupFactor: number
  /** Efficiency (speedup / parallelism) */
  readonly efficiency: number
}

/**
 * Error during parallel execution
 */
export interface ParallelExecutionError {
  /** Task ID that failed */
  readonly taskId: string
  /** Error message */
  readonly message: string
  /** Error stack */
  readonly stack?: string
  /** Retry count at failure */
  readonly retryCount: number
  /** Whether task was retried */
  readonly wasRetried: boolean
  /** Timestamp */
  readonly timestamp: number
}

// ─── Scheduler Types ─────────────────────────────────────────────────────────

/**
 * Scheduling strategy
 */
export type SchedulingStrategy =
  | 'fifo'           // First in, first out
  | 'priority'       // By priority then creation time
  | 'shortest_first' // Shortest estimated time first
  | 'critical_path'  // Critical path tasks first
  | 'balanced'       // Balance load across workers

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Scheduling strategy */
  readonly strategy: SchedulingStrategy
  /** Enable preemption of low priority tasks */
  readonly enablePreemption: boolean
  /** Preemption threshold (only preempt if new task priority exceeds by this) */
  readonly preemptionThreshold: number
  /** Enable task batching */
  readonly enableBatching: boolean
  /** Batch timeout in ms */
  readonly batchTimeoutMs: number
  /** Maximum batch size */
  readonly maxBatchSize: number
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  strategy: 'balanced',
  enablePreemption: false,
  preemptionThreshold: 2,
  enableBatching: true,
  batchTimeoutMs: 50,
  maxBatchSize: 10,
}

// ─── Interface Definitions ───────────────────────────────────────────────────

/**
 * Dependency graph analyzer interface
 */
export interface IDependencyAnalyzer {
  /**
   * Analyze a set of proof requests and build dependency graph
   */
  analyze(nodes: DependencyNode[]): GraphAnalysis

  /**
   * Add a node to an existing graph
   */
  addNode(graph: DependencyGraph, node: DependencyNode): DependencyGraph

  /**
   * Remove a node from the graph
   */
  removeNode(graph: DependencyGraph, nodeId: string): DependencyGraph

  /**
   * Get execution order respecting dependencies
   */
  getExecutionOrder(graph: DependencyGraph): readonly string[]

  /**
   * Find nodes ready to execute (dependencies satisfied)
   */
  getReadyNodes(graph: DependencyGraph, completed: Set<string>): readonly string[]

  /**
   * Validate graph is acyclic
   */
  validateAcyclic(graph: DependencyGraph): boolean
}

/**
 * Worker pool interface
 */
export interface IWorkerPool {
  /**
   * Submit a task to the pool
   */
  submit(task: ProofTask, options?: TaskSubmitOptions): Promise<SingleProof>

  /**
   * Get current pool statistics
   */
  getStats(): WorkerPoolStats

  /**
   * Get information about all workers
   */
  getWorkers(): readonly WorkerInfo[]

  /**
   * Scale pool to target worker count
   */
  scale(targetWorkers: number): Promise<void>

  /**
   * Pause task execution
   */
  pause(): void

  /**
   * Resume task execution
   */
  resume(): void

  /**
   * Shutdown the pool
   */
  shutdown(): Promise<void>

  /**
   * Check if pool is running
   */
  isRunning(): boolean
}

/**
 * Concurrency manager interface
 */
export interface IConcurrencyManager {
  /**
   * Get current system resources
   */
  getResources(): SystemResources

  /**
   * Calculate optimal concurrency level
   */
  calculateOptimalConcurrency(): ConcurrencyDecision

  /**
   * Start adaptive monitoring
   */
  startMonitoring(): void

  /**
   * Stop adaptive monitoring
   */
  stopMonitoring(): void

  /**
   * Get current concurrency limit
   */
  getCurrentLimit(): number

  /**
   * Manually set concurrency limit
   */
  setLimit(limit: number): void
}

/**
 * Work stealing scheduler interface
 */
export interface IWorkStealingScheduler {
  /**
   * Assign a task to a worker
   */
  assign(task: ProofTask): string | null

  /**
   * Attempt to steal work from another worker
   */
  steal(thief: string): ProofTask | null

  /**
   * Get stealing statistics
   */
  getStealingStats(): readonly WorkerStealingStats[]

  /**
   * Get steal events history
   */
  getStealHistory(limit?: number): readonly WorkStealEvent[]

  /**
   * Clear a worker's queue (worker terminated)
   */
  clearWorkerQueue(workerId: string): readonly ProofTask[]
}

/**
 * Main parallel executor interface
 */
export interface IParallelExecutor {
  /**
   * Execute proofs in parallel with dependency resolution
   */
  execute(nodes: DependencyNode[], options?: ParallelExecutionOptions): Promise<ParallelExecutionResult>

  /**
   * Cancel ongoing execution
   */
  cancel(): Promise<void>

  /**
   * Get current execution status
   */
  getStatus(): {
    readonly running: boolean
    readonly progress: number
    readonly completed: number
    readonly total: number
  }

  /**
   * Get the dependency analyzer
   */
  getAnalyzer(): IDependencyAnalyzer

  /**
   * Get the worker pool
   */
  getPool(): IWorkerPool

  /**
   * Get the concurrency manager
   */
  getConcurrencyManager(): IConcurrencyManager
}
