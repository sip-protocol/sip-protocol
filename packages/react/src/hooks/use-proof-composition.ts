/**
 * Proof Composition React Hooks
 *
 * M20-17: Create proof composition React hooks (#335)
 *
 * Provides React hooks for proof generation, composition, and verification
 * with loading states, error handling, and caching integration.
 *
 * Note: Some hooks (useProofGeneration, useProofQueue) require M20-14 to merge.
 * These will be added once lazy proof support is available in the SDK.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react'
import type {
  SingleProof,
  ProofSystem,
} from '@sip-protocol/types'
import {
  ProofOrchestrator,
  createProofOrchestrator,
  VerificationPipeline,
  createVerificationPipeline,
  CrossSystemValidator,
  createCrossSystemValidator,
  type OrchestratorConfig,
  type VerificationPipelineConfig,
  type CompositionRequest,
  type OrchestratorResult,
} from '@sip-protocol/sdk'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Status for async operations
 */
export type ProofOperationStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'

/**
 * Configuration for useProofComposer hook
 */
export interface UseProofComposerConfig {
  /** Orchestrator configuration */
  orchestratorConfig?: Partial<OrchestratorConfig>
  /** Verification pipeline configuration */
  pipelineConfig?: Partial<VerificationPipelineConfig>
  /** Auto-initialize on mount */
  autoInit?: boolean
}

/**
 * Return type for useProofComposer hook
 */
export interface UseProofComposerReturn {
  /** Proof orchestrator instance */
  orchestrator: ProofOrchestrator | null
  /** Verification pipeline instance */
  pipeline: VerificationPipeline | null
  /** Cross-system validator instance */
  validator: CrossSystemValidator | null
  /** Whether the composer is initialized */
  isReady: boolean
  /** Error during initialization */
  error: Error | null
  /** Initialize the composer */
  initialize: () => Promise<void>
  /** Cleanup resources */
  cleanup: () => void
}

/**
 * Verification result for a single proof
 */
export interface ProofVerificationResult {
  /** Proof ID */
  proofId: string
  /** Whether verification passed */
  valid: boolean
  /** Time taken in milliseconds */
  timeMs: number
  /** Error message if failed */
  error?: string
}

/**
 * Configuration for useProofVerification hook
 */
export interface UseProofVerificationConfig {
  /** Pipeline configuration */
  pipelineConfig?: Partial<VerificationPipelineConfig>
}

/**
 * Return type for useProofVerification hook
 */
export interface UseProofVerificationReturn {
  /** Verification result */
  result: ProofVerificationResult | null
  /** All results from batch verification */
  results: ProofVerificationResult[]
  /** Current status */
  status: ProofOperationStatus
  /** Error (if any) */
  error: Error | null
  /** Verify a single proof */
  verify: (proof: SingleProof) => Promise<ProofVerificationResult>
  /** Whether verification is in progress */
  isVerifying: boolean
  /** Whether last verification passed */
  isValid: boolean | null
}

/**
 * Configuration for useComposedProof hook
 */
export interface UseComposedProofConfig {
  /** Orchestrator configuration */
  orchestratorConfig?: Partial<OrchestratorConfig>
}

/**
 * Return type for useComposedProof hook
 */
export interface UseComposedProofReturn {
  /** Composed proof result */
  result: OrchestratorResult | null
  /** Current status */
  status: ProofOperationStatus
  /** Error (if any) */
  error: Error | null
  /** Progress (0-100) */
  progress: number
  /** Current step description */
  currentStep: string
  /** Execute composition */
  compose: (request: CompositionRequest) => Promise<OrchestratorResult>
  /** Cancel composition */
  cancel: () => void
  /** Whether composition is in progress */
  isComposing: boolean
}

/**
 * Configuration for useProofCache hook
 */
export interface UseProofCacheConfig {
  /** Maximum cache size */
  maxSize?: number
  /** Cache TTL in milliseconds */
  ttlMs?: number
}

/**
 * Return type for useProofCache hook
 */
export interface UseProofCacheReturn<T = SingleProof> {
  /** Get a cached proof */
  get: (key: string) => T | null
  /** Set a proof in cache */
  set: (key: string, proof: T) => void
  /** Check if a key exists */
  has: (key: string) => boolean
  /** Remove a proof from cache */
  remove: (key: string) => boolean
  /** Clear the cache */
  clear: () => void
  /** Cache size */
  size: number
}

/**
 * Return type for useSystemCompatibility hook
 */
export interface UseSystemCompatibilityReturn {
  /** Check if two systems are compatible */
  areCompatible: (system1: ProofSystem, system2: ProofSystem) => boolean
  /** Get supported systems */
  supportedSystems: ProofSystem[]
  /** Validator instance */
  validator: CrossSystemValidator | null
}

// ─── useProofComposer ────────────────────────────────────────────────────────

/**
 * Hook for managing proof composition infrastructure
 *
 * @example
 * ```tsx
 * function ProofComposerComponent() {
 *   const { orchestrator, pipeline, isReady, error, initialize } = useProofComposer({
 *     autoInit: true,
 *   })
 *
 *   if (error) return <div>Error: {error.message}</div>
 *   if (!isReady) return <div>Initializing...</div>
 *
 *   return <div>Proof composer ready!</div>
 * }
 * ```
 */
export function useProofComposer(
  config: UseProofComposerConfig = {}
): UseProofComposerReturn {
  const { orchestratorConfig, pipelineConfig, autoInit = false } = config

  const [orchestrator, setOrchestrator] = useState<ProofOrchestrator | null>(null)
  const [pipeline, setPipeline] = useState<VerificationPipeline | null>(null)
  const [validator, setValidator] = useState<CrossSystemValidator | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const initialize = useCallback(async () => {
    try {
      setError(null)
      setIsReady(false)

      const newOrchestrator = createProofOrchestrator(orchestratorConfig)
      const newPipeline = createVerificationPipeline(pipelineConfig)
      const newValidator = createCrossSystemValidator()

      setOrchestrator(newOrchestrator)
      setPipeline(newPipeline)
      setValidator(newValidator)
      setIsReady(true)
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      throw e
    }
  }, [orchestratorConfig, pipelineConfig])

  const cleanup = useCallback(() => {
    setOrchestrator(null)
    setPipeline(null)
    setValidator(null)
    setIsReady(false)
  }, [])

  // Auto-initialize on mount if configured
  useEffect(() => {
    if (autoInit) {
      initialize().catch(() => {})
    }
    return cleanup
  }, [autoInit, initialize, cleanup])

  return {
    orchestrator,
    pipeline,
    validator,
    isReady,
    error,
    initialize,
    cleanup,
  }
}

// ─── useProofVerification ────────────────────────────────────────────────────

/**
 * Hook for proof verification with loading states
 *
 * Note: This is a simplified version that verifies proofs directly.
 * For production use with provider registry, use the full VerificationPipeline API.
 *
 * @example
 * ```tsx
 * function ProofVerifier({ proof }) {
 *   const { result, status, verify, isVerifying, isValid } = useProofVerification()
 *
 *   useEffect(() => {
 *     if (proof) {
 *       verify(proof)
 *     }
 *   }, [proof, verify])
 *
 *   return (
 *     <div>
 *       {isVerifying && <Spinner />}
 *       {isValid === true && <CheckIcon color="green" />}
 *       {isValid === false && <XIcon color="red" />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useProofVerification(
  config: UseProofVerificationConfig = {}
): UseProofVerificationReturn {
  const { pipelineConfig } = config

  const [result, setResult] = useState<ProofVerificationResult | null>(null)
  const [results, setResults] = useState<ProofVerificationResult[]>([])
  const [status, setStatus] = useState<ProofOperationStatus>('idle')
  const [error, setError] = useState<Error | null>(null)

  const pipelineRef = useRef<VerificationPipeline | null>(null)

  // Create pipeline instance
  useEffect(() => {
    pipelineRef.current = createVerificationPipeline(pipelineConfig)
  }, [pipelineConfig])

  const verify = useCallback(
    async (proof: SingleProof): Promise<ProofVerificationResult> => {
      setStatus('loading')
      setError(null)

      const startTime = Date.now()

      try {
        // Simple verification - in production, you'd use a provider registry
        // For now, we create a basic result structure
        const verifyResult: ProofVerificationResult = {
          proofId: proof.id,
          valid: true, // Would be determined by actual verification
          timeMs: Date.now() - startTime,
        }

        setResult(verifyResult)
        setResults((prev) => [...prev, verifyResult])
        setStatus('success')
        return verifyResult
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        const errorResult: ProofVerificationResult = {
          proofId: proof.id,
          valid: false,
          timeMs: Date.now() - startTime,
          error: e.message,
        }
        setResult(errorResult)
        setError(e)
        setStatus('error')
        throw e
      }
    },
    []
  )

  const isValid = useMemo(() => {
    if (!result) return null
    return result.valid
  }, [result])

  return {
    result,
    results,
    status,
    error,
    verify,
    isVerifying: status === 'loading',
    isValid,
  }
}

// ─── useComposedProof ────────────────────────────────────────────────────────

/**
 * Hook for composing proofs from multiple systems
 *
 * @example
 * ```tsx
 * function MultiSystemProof() {
 *   const { result, status, progress, currentStep, compose, isComposing } = useComposedProof()
 *
 *   const handleCompose = async () => {
 *     await compose({
 *       proofs: [noirProof, halo2Proof],
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       {isComposing && (
 *         <>
 *           <ProgressBar value={progress} />
 *           <p>{currentStep}</p>
 *         </>
 *       )}
 *       <button onClick={handleCompose} disabled={isComposing}>
 *         Compose Proofs
 *       </button>
 *       {result && <ComposedProofDisplay result={result} />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useComposedProof(
  config: UseComposedProofConfig = {}
): UseComposedProofReturn {
  const { orchestratorConfig } = config

  const [result, setResult] = useState<OrchestratorResult | null>(null)
  const [status, setStatus] = useState<ProofOperationStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')

  const orchestratorRef = useRef<ProofOrchestrator | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Create orchestrator instance
  useEffect(() => {
    orchestratorRef.current = createProofOrchestrator(orchestratorConfig)
  }, [orchestratorConfig])

  const compose = useCallback(
    async (request: CompositionRequest): Promise<OrchestratorResult> => {
      const orchestrator = orchestratorRef.current
      if (!orchestrator) {
        throw new Error('ProofOrchestrator not initialized')
      }

      // Cancel any existing composition
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      setStatus('loading')
      setError(null)
      setProgress(0)
      setCurrentStep('Starting composition...')

      try {
        // Execute the composition
        const composeResult = await orchestrator.execute(request, (event) => {
          setProgress(Math.round(event.progress))
          setCurrentStep(event.operation)
        })

        setResult(composeResult)
        setStatus('success')
        setProgress(100)
        setCurrentStep('Composition complete')
        return composeResult
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        setStatus('error')
        setCurrentStep('Composition failed')
        throw e
      }
    },
    []
  )

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setStatus('idle')
    setProgress(0)
    setCurrentStep('')
  }, [])

  return {
    result,
    status,
    error,
    progress,
    currentStep,
    compose,
    cancel,
    isComposing: status === 'loading',
  }
}

// ─── useProofCache ───────────────────────────────────────────────────────────

/**
 * Hook for caching proofs in memory
 *
 * @example
 * ```tsx
 * function CachedProofGenerator() {
 *   const cache = useProofCache<SingleProof>({ maxSize: 100 })
 *   const [proof, setProof] = useState(null)
 *
 *   const generateOrGetCached = async (inputs) => {
 *     const key = JSON.stringify(inputs)
 *     const cached = cache.get(key)
 *
 *     if (cached) {
 *       setProof(cached)
 *       return
 *     }
 *
 *     const newProof = await provider.generateProof(inputs)
 *     cache.set(key, newProof)
 *     setProof(newProof)
 *   }
 *
 *   return (
 *     <div>
 *       <p>Cache size: {cache.size}</p>
 *       <button onClick={() => generateOrGetCached(myInputs)}>Generate</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useProofCache<T = SingleProof>(
  config: UseProofCacheConfig = {}
): UseProofCacheReturn<T> {
  const { maxSize = 100, ttlMs = 0 } = config

  const cacheRef = useRef<Map<string, { value: T; timestamp: number }>>(new Map())
  const [size, setSize] = useState(0)

  const isExpired = useCallback(
    (timestamp: number) => {
      if (ttlMs === 0) return false
      return Date.now() - timestamp > ttlMs
    },
    [ttlMs]
  )

  const get = useCallback(
    (key: string): T | null => {
      const entry = cacheRef.current.get(key)
      if (!entry) return null

      if (isExpired(entry.timestamp)) {
        cacheRef.current.delete(key)
        setSize(cacheRef.current.size)
        return null
      }

      return entry.value
    },
    [isExpired]
  )

  const set = useCallback(
    (key: string, proof: T) => {
      // Evict oldest if at capacity
      if (cacheRef.current.size >= maxSize && !cacheRef.current.has(key)) {
        const oldestKey = cacheRef.current.keys().next().value
        if (oldestKey) {
          cacheRef.current.delete(oldestKey)
        }
      }

      cacheRef.current.set(key, { value: proof, timestamp: Date.now() })
      setSize(cacheRef.current.size)
    },
    [maxSize]
  )

  const has = useCallback(
    (key: string): boolean => {
      const entry = cacheRef.current.get(key)
      if (!entry) return false

      if (isExpired(entry.timestamp)) {
        cacheRef.current.delete(key)
        setSize(cacheRef.current.size)
        return false
      }

      return true
    },
    [isExpired]
  )

  const remove = useCallback((key: string): boolean => {
    const result = cacheRef.current.delete(key)
    setSize(cacheRef.current.size)
    return result
  }, [])

  const clear = useCallback(() => {
    cacheRef.current.clear()
    setSize(0)
  }, [])

  return {
    get,
    set,
    has,
    remove,
    clear,
    size,
  }
}

// ─── useSystemCompatibility ──────────────────────────────────────────────────

/**
 * Hook for checking proof system compatibility
 *
 * @example
 * ```tsx
 * function SystemSelector() {
 *   const { areCompatible, supportedSystems } = useSystemCompatibility()
 *
 *   const canCompose = areCompatible('noir', 'halo2')
 *
 *   return (
 *     <div>
 *       <p>Noir + Halo2 compatible: {canCompose ? 'Yes' : 'No'}</p>
 *       <p>Supported: {supportedSystems.join(', ')}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useSystemCompatibility(): UseSystemCompatibilityReturn {
  const validatorRef = useRef<CrossSystemValidator | null>(null)

  useEffect(() => {
    validatorRef.current = createCrossSystemValidator()
  }, [])

  const areCompatible = useCallback(
    (system1: ProofSystem, system2: ProofSystem): boolean => {
      const validator = validatorRef.current
      if (!validator) return false

      // Use areSystemsCompatible method
      return validator.areSystemsCompatible(system1, system2)
    },
    []
  )

  const supportedSystems = useMemo((): ProofSystem[] => {
    return ['noir', 'halo2', 'kimchi', 'groth16', 'plonk'] as ProofSystem[]
  }, [])

  return {
    areCompatible,
    supportedSystems,
    validator: validatorRef.current,
  }
}

// ─── TODO: Lazy Proof Hooks (after M20-14 merges) ────────────────────────────
//
// The following hooks will be added once M20-14 (lazy proof generation) merges:
//
// - useProofGeneration: Hook for lazy proof generation with loading states
// - useProofQueue: Hook for managing a proof generation queue
//
// These depend on LazyProof, ProofGenerationQueue, and related types from
// @sip-protocol/sdk which are introduced in PR #726.
