/**
 * Worker Pool for Parallel Proof Generation
 *
 * @module proofs/parallel/worker-pool
 * @description Manages a pool of workers for parallel proof generation
 *
 * M20-12: Optimize proof generation parallelization (#307)
 */

import type { SingleProof } from '@sip-protocol/types'
import type {
  WorkerStatus,
  WorkerInfo,
  WorkerPoolConfig,
  WorkerPoolStats,
  ProofTask,
  TaskSubmitOptions,
  IWorkerPool,
  WorkStealEvent,
  WorkerStealingStats,
  IWorkStealingScheduler,
} from './interface'
import { DEFAULT_WORKER_POOL_CONFIG } from './interface'
import type { ComposableProofProvider } from '../composer'

// ─── Worker Implementation ───────────────────────────────────────────────────

interface WorkerState {
  id: string
  status: WorkerStatus
  currentTask: ProofTask | null
  taskQueue: ProofTask[]
  tasksCompleted: number
  totalExecutionTime: number
  memoryUsage: number
  createdAt: number
  lastActiveAt: number
}

// ─── Work Stealing Scheduler ─────────────────────────────────────────────────

/**
 * Manages work stealing between workers for load balancing
 */
export class WorkStealingScheduler implements IWorkStealingScheduler {
  private readonly workers = new Map<string, WorkerState>()
  private readonly stealHistory: WorkStealEvent[] = []
  private readonly maxHistorySize = 1000

  /**
   * Register a worker with the scheduler
   */
  registerWorker(worker: WorkerState): void {
    this.workers.set(worker.id, worker)
  }

  /**
   * Unregister a worker from the scheduler
   */
  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId)
  }

  /**
   * Assign a task to the best available worker
   */
  assign(task: ProofTask): string | null {
    // Find worker with shortest queue
    let bestWorker: WorkerState | null = null
    let shortestQueue = Infinity

    for (const worker of this.workers.values()) {
      if (worker.status === 'idle' || worker.status === 'busy') {
        const queueLength = worker.taskQueue.length + (worker.currentTask ? 1 : 0)
        if (queueLength < shortestQueue) {
          shortestQueue = queueLength
          bestWorker = worker
        }
      }
    }

    if (bestWorker) {
      bestWorker.taskQueue.push(task)
      return bestWorker.id
    }

    return null
  }

  /**
   * Attempt to steal work from another worker
   */
  steal(thiefId: string): ProofTask | null {
    const thief = this.workers.get(thiefId)
    if (!thief) return null

    // Find victim with longest queue (at least 2 tasks to steal 1)
    let victim: WorkerState | null = null
    let longestQueue = 1 // Need at least 2 to steal

    for (const worker of this.workers.values()) {
      if (worker.id !== thiefId && worker.taskQueue.length > longestQueue) {
        longestQueue = worker.taskQueue.length
        victim = worker
      }
    }

    if (victim && victim.taskQueue.length > 1) {
      // Steal from the end of the queue (LIFO steal)
      const stolenTask = victim.taskQueue.pop()!

      // Record steal event
      this.recordStealEvent({
        timestamp: Date.now(),
        thief: thiefId,
        victim: victim.id,
        taskId: stolenTask.id,
        victimQueueLength: victim.taskQueue.length + 1, // Before steal
        thiefQueueLength: thief.taskQueue.length,
      })

      return stolenTask
    }

    return null
  }

  /**
   * Get stealing statistics for all workers
   */
  getStealingStats(): readonly WorkerStealingStats[] {
    const stats: WorkerStealingStats[] = []

    for (const worker of this.workers.values()) {
      const tasksStolen = this.stealHistory.filter((e) => e.victim === worker.id).length
      const tasksAcquired = this.stealHistory.filter((e) => e.thief === worker.id).length
      const avgQueueLength = worker.taskQueue.length // Simplified

      stats.push({
        workerId: worker.id,
        tasksStolen,
        tasksAcquired,
        averageQueueLength: avgQueueLength,
      })
    }

    return stats
  }

  /**
   * Get steal events history
   */
  getStealHistory(limit?: number): readonly WorkStealEvent[] {
    if (limit) {
      return this.stealHistory.slice(-limit)
    }
    return [...this.stealHistory]
  }

  /**
   * Clear a worker's queue and return tasks
   */
  clearWorkerQueue(workerId: string): readonly ProofTask[] {
    const worker = this.workers.get(workerId)
    if (!worker) return []

    const tasks = [...worker.taskQueue]
    worker.taskQueue = []
    return tasks
  }

  private recordStealEvent(event: WorkStealEvent): void {
    this.stealHistory.push(event)

    // Limit history size
    if (this.stealHistory.length > this.maxHistorySize) {
      this.stealHistory.shift()
    }
  }
}

// ─── Worker Pool Implementation ──────────────────────────────────────────────

/**
 * Manages a pool of workers for parallel proof generation
 */
export class WorkerPool implements IWorkerPool {
  private readonly config: WorkerPoolConfig
  private readonly workers = new Map<string, WorkerState>()
  private readonly scheduler: WorkStealingScheduler
  private readonly providerFactory: () => ComposableProofProvider

  private running = true
  private paused = false
  private taskIdCounter = 0
  private completedTasks = 0
  private failedTasks = 0
  private totalTasks = 0
  private workSteals = 0
  private peakMemoryUsage = 0
  private startTime: number

  private workStealingInterval: ReturnType<typeof setInterval> | null = null
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null

  constructor(
    config: Partial<WorkerPoolConfig>,
    providerFactory: () => ComposableProofProvider
  ) {
    this.config = { ...DEFAULT_WORKER_POOL_CONFIG, ...config }
    this.scheduler = new WorkStealingScheduler()
    this.providerFactory = providerFactory
    this.startTime = Date.now()

    // Initialize minimum workers
    this.initializeWorkers()

    // Start work stealing if enabled
    if (this.config.enableWorkStealing) {
      this.startWorkStealing()
    }

    // Start idle worker cleanup
    this.startIdleCleanup()
  }

  /**
   * Submit a task to the pool
   */
  async submit(task: ProofTask, options?: TaskSubmitOptions): Promise<SingleProof> {
    if (!this.running) {
      throw new Error('Worker pool is not running')
    }

    this.totalTasks++

    // Apply options
    if (options?.priority) {
      const t = task as { priority: typeof options.priority }
      t.priority = options.priority
    }
    if (options?.maxRetries !== undefined) {
      const t = task as { maxRetries: number }
      t.maxRetries = options.maxRetries
    }

    return new Promise((resolve, reject) => {
      const timeoutMs = options?.timeoutMs ?? 120000 // 2 minute default

      // Setup timeout
      const timeoutId = setTimeout(() => {
        task.status = 'failed'
        task.error = new Error(`Task ${task.id} timed out after ${timeoutMs}ms`)
        this.failedTasks++
        options?.onError?.(task, task.error)
        reject(task.error)
      }, timeoutMs)

      // Execute task
      this.executeTask(task)
        .then((result) => {
          clearTimeout(timeoutId)
          task.status = 'completed'
          task.result = result
          task.completedAt = Date.now()
          this.completedTasks++
          options?.onComplete?.(task)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          task.status = 'failed'
          task.error = error instanceof Error ? error : new Error(String(error))
          this.failedTasks++
          options?.onError?.(task, task.error)
          reject(task.error)
        })
    })
  }

  /**
   * Get current pool statistics
   */
  getStats(): WorkerPoolStats {
    let busyWorkers = 0
    let idleWorkers = 0
    let queuedTasks = 0
    let memoryUsage = 0

    for (const worker of this.workers.values()) {
      if (worker.status === 'busy') {
        busyWorkers++
      } else if (worker.status === 'idle') {
        idleWorkers++
      }
      queuedTasks += worker.taskQueue.length
      memoryUsage += worker.memoryUsage
    }

    this.peakMemoryUsage = Math.max(this.peakMemoryUsage, memoryUsage)

    const totalExecutionTime = Array.from(this.workers.values()).reduce(
      (sum, w) => sum + w.totalExecutionTime,
      0
    )
    const averageTaskTime =
      this.completedTasks > 0 ? totalExecutionTime / this.completedTasks : 0

    return {
      workerCount: this.workers.size,
      busyWorkers,
      idleWorkers,
      queuedTasks,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      totalTasks: this.totalTasks,
      averageTaskTime,
      workSteals: this.workSteals,
      memoryUsage,
      peakMemoryUsage: this.peakMemoryUsage,
      uptime: Date.now() - this.startTime,
    }
  }

  /**
   * Get information about all workers
   */
  getWorkers(): readonly WorkerInfo[] {
    return Array.from(this.workers.values()).map((w) => ({
      id: w.id,
      status: w.status,
      currentTask: w.currentTask?.id,
      tasksCompleted: w.tasksCompleted,
      totalExecutionTime: w.totalExecutionTime,
      averageTaskTime: w.tasksCompleted > 0 ? w.totalExecutionTime / w.tasksCompleted : 0,
      memoryUsage: w.memoryUsage,
      createdAt: w.createdAt,
      lastActiveAt: w.lastActiveAt,
    }))
  }

  /**
   * Scale pool to target worker count
   */
  async scale(targetWorkers: number): Promise<void> {
    const clamped = Math.max(
      this.config.minWorkers,
      Math.min(this.config.maxWorkers, targetWorkers)
    )

    const currentCount = this.workers.size

    if (clamped > currentCount) {
      // Add workers
      for (let i = 0; i < clamped - currentCount; i++) {
        this.createWorker()
      }
    } else if (clamped < currentCount) {
      // Remove idle workers first
      const workersToRemove = currentCount - clamped
      let removed = 0

      for (const [workerId, worker] of this.workers) {
        if (removed >= workersToRemove) break
        if (worker.status === 'idle') {
          await this.terminateWorker(workerId)
          removed++
        }
      }
    }
  }

  /**
   * Pause task execution
   */
  pause(): void {
    this.paused = true
  }

  /**
   * Resume task execution
   */
  resume(): void {
    this.paused = false
    // Process any queued tasks
    this.processQueues()
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    this.running = false

    // Stop intervals
    if (this.workStealingInterval) {
      clearInterval(this.workStealingInterval)
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval)
    }

    // Terminate all workers
    const terminationPromises: Promise<void>[] = []
    for (const workerId of this.workers.keys()) {
      terminationPromises.push(this.terminateWorker(workerId))
    }

    await Promise.all(terminationPromises)
  }

  /**
   * Check if pool is running
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Get the work stealing scheduler
   */
  getScheduler(): IWorkStealingScheduler {
    return this.scheduler
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  private initializeWorkers(): void {
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.createWorker()
    }
  }

  private createWorker(): WorkerState {
    const id = `worker-${++this.taskIdCounter}`
    const worker: WorkerState = {
      id,
      status: 'idle',
      currentTask: null,
      taskQueue: [],
      tasksCompleted: 0,
      totalExecutionTime: 0,
      memoryUsage: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    }

    this.workers.set(id, worker)
    this.scheduler.registerWorker(worker)

    return worker
  }

  private async terminateWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId)
    if (!worker) return

    worker.status = 'terminating'

    // Redistribute queued tasks
    const tasks = this.scheduler.clearWorkerQueue(workerId)
    for (const task of tasks) {
      this.scheduler.assign(task)
    }

    worker.status = 'terminated'
    this.scheduler.unregisterWorker(workerId)
    this.workers.delete(workerId)
  }

  private async executeTask(task: ProofTask): Promise<SingleProof> {
    // Wait if paused
    while (this.paused) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Find available worker or create one
    let worker = this.findIdleWorker()
    if (!worker && this.workers.size < this.config.maxWorkers) {
      worker = this.createWorker()
    }

    if (!worker) {
      // Queue the task
      task.status = 'queued'
      const assignedWorkerId = this.scheduler.assign(task)
      if (!assignedWorkerId) {
        throw new Error('No workers available to execute task')
      }

      // Wait for task to be processed
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (task.status === 'completed' && task.result) {
            clearInterval(checkInterval)
            resolve(task.result)
          } else if (task.status === 'failed') {
            clearInterval(checkInterval)
            reject(task.error ?? new Error('Task failed'))
          }
        }, 50)
      })
    }

    // Execute immediately
    return this.runTaskOnWorker(worker, task)
  }

  private async runTaskOnWorker(worker: WorkerState, task: ProofTask): Promise<SingleProof> {
    worker.status = 'busy'
    worker.currentTask = task
    worker.lastActiveAt = Date.now()
    task.status = 'running'
    task.startedAt = Date.now()
    task.workerId = worker.id

    try {
      // Get a provider instance
      const provider = this.providerFactory()

      // Generate the proof
      const startTime = Date.now()
      const result = await provider.generateProof({
        circuitId: task.node.circuitId,
        privateInputs: task.node.privateInputs,
        publicInputs: task.node.publicInputs,
      })

      const executionTime = Date.now() - startTime
      worker.totalExecutionTime += executionTime
      worker.tasksCompleted++
      worker.memoryUsage = Math.max(worker.memoryUsage, task.node.estimatedMemory)

      // Mark worker as idle and process queue
      worker.status = 'idle'
      worker.currentTask = null

      // Check for successful proof generation
      if (!result.success || !result.proof) {
        throw new Error(result.error ?? 'Proof generation failed')
      }

      // Process next task in queue
      this.processWorkerQueue(worker)

      return result.proof
    } catch (error) {
      worker.status = 'idle'
      worker.currentTask = null

      // Retry if allowed
      if (task.retryCount < task.maxRetries) {
        task.retryCount++
        task.status = 'queued'
        return this.executeTask(task)
      }

      throw error
    }
  }

  private findIdleWorker(): WorkerState | null {
    for (const worker of this.workers.values()) {
      if (worker.status === 'idle') {
        return worker
      }
    }
    return null
  }

  private processQueues(): void {
    for (const worker of this.workers.values()) {
      if (worker.status === 'idle') {
        this.processWorkerQueue(worker)
      }
    }
  }

  private processWorkerQueue(worker: WorkerState): void {
    if (worker.taskQueue.length === 0 || this.paused) {
      return
    }

    const nextTask = worker.taskQueue.shift()
    if (nextTask) {
      this.runTaskOnWorker(worker, nextTask).catch(() => {
        // Error handled in runTaskOnWorker
      })
    }
  }

  private startWorkStealing(): void {
    this.workStealingInterval = setInterval(() => {
      if (this.paused) return

      // Find idle workers
      for (const worker of this.workers.values()) {
        if (worker.status === 'idle' && worker.taskQueue.length === 0) {
          const stolenTask = this.scheduler.steal(worker.id)
          if (stolenTask) {
            this.workSteals++
            this.runTaskOnWorker(worker, stolenTask).catch(() => {
              // Error handled in runTaskOnWorker
            })
          }
        }
      }
    }, this.config.workStealingIntervalMs)
  }

  private startIdleCleanup(): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now()

      for (const [workerId, worker] of this.workers) {
        // Don't remove workers below minimum
        if (this.workers.size <= this.config.minWorkers) {
          break
        }

        // Check if worker has been idle too long
        if (
          worker.status === 'idle' &&
          worker.taskQueue.length === 0 &&
          now - worker.lastActiveAt > this.config.idleTimeoutMs
        ) {
          this.terminateWorker(workerId).catch(() => {
            // Ignore termination errors
          })
        }
      }
    }, this.config.idleTimeoutMs / 2)
  }
}

/**
 * Create a worker pool instance
 */
export function createWorkerPool(
  config: Partial<WorkerPoolConfig>,
  providerFactory: () => ComposableProofProvider
): IWorkerPool {
  return new WorkerPool(config, providerFactory)
}
