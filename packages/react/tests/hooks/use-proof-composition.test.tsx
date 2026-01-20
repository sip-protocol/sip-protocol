import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useProofComposer,
  useProofVerification,
  useComposedProof,
  useProofCache,
  useSystemCompatibility,
} from '../../src/hooks/use-proof-composition'
import type { SingleProof, ProofSystem } from '@sip-protocol/types'

// Mock the SDK
vi.mock('@sip-protocol/sdk', () => {
  // Mock orchestrator
  const mockOrchestrator = {
    plan: vi.fn(),
    execute: vi.fn(),
  }

  // Mock verification pipeline
  const mockPipeline = {
    verify: vi.fn(),
    verifySingle: vi.fn(),
    verifyBatch: vi.fn(),
    determineDependencies: vi.fn(),
  }

  // Mock validator
  const mockValidator = {
    areSystemsCompatible: vi.fn(),
    validate: vi.fn(),
  }

  return {
    createProofOrchestrator: vi.fn(() => mockOrchestrator),
    ProofOrchestrator: vi.fn(() => mockOrchestrator),
    createVerificationPipeline: vi.fn(() => mockPipeline),
    VerificationPipeline: vi.fn(() => mockPipeline),
    createCrossSystemValidator: vi.fn(() => mockValidator),
    CrossSystemValidator: vi.fn(() => mockValidator),
    SYSTEM_INFO: {
      noir: { name: 'Noir', curve: 'bn254' },
      halo2: { name: 'Halo2', curve: 'pasta' },
      kimchi: { name: 'Kimchi', curve: 'pasta' },
    },
    BN254_MODULUS:
      '21888242871839275222246405745257275088548364400416034343698204186575808495617',
    PALLAS_MODULUS:
      '28948022309329048855892746252171976963363056481941560715954676764349967630337',
    VESTA_MODULUS:
      '28948022309329048855892746252171976963363056481941647379679742748393362948097',
    BLS12_381_MODULUS:
      '52435875175126190479447740508185965837690552500527637822603658699938581184513',
  }
})

import * as sdk from '@sip-protocol/sdk'

// Helper to create mock proofs
const createMockSingleProof = (system: ProofSystem = 'noir'): SingleProof => ({
  system,
  proof: '0x010203' as `0x${string}`,
  publicInputs: ['0xinput1' as `0x${string}`, '0xinput2' as `0x${string}`],
  circuitId: 'test-circuit',
  metadata: {
    generatedAt: Date.now(),
    circuitId: 'test-circuit',
  },
})

describe('useProofComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with not ready state', () => {
      const { result } = renderHook(() => useProofComposer())

      expect(result.current.isReady).toBe(false)
      expect(result.current.orchestrator).toBeNull()
      expect(result.current.pipeline).toBeNull()
      expect(result.current.validator).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should auto-initialize when autoInit is true', async () => {
      const { result } = renderHook(() => useProofComposer({ autoInit: true }))

      await waitFor(() => {
        expect(result.current.isReady).toBe(true)
      })

      expect(result.current.orchestrator).not.toBeNull()
      expect(result.current.pipeline).not.toBeNull()
      expect(result.current.validator).not.toBeNull()
    })
  })

  describe('initialize', () => {
    it('should initialize orchestrator, pipeline, and validator', async () => {
      const { result } = renderHook(() => useProofComposer())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.isReady).toBe(true)
      expect(result.current.orchestrator).not.toBeNull()
      expect(result.current.pipeline).not.toBeNull()
      expect(result.current.validator).not.toBeNull()
      expect(sdk.createProofOrchestrator).toHaveBeenCalled()
      expect(sdk.createVerificationPipeline).toHaveBeenCalled()
      expect(sdk.createCrossSystemValidator).toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      vi.mocked(sdk.createProofOrchestrator).mockImplementationOnce(() => {
        throw new Error('Init failed')
      })

      const { result } = renderHook(() => useProofComposer())

      await act(async () => {
        await expect(result.current.initialize()).rejects.toThrow('Init failed')
      })

      expect(result.current.error?.message).toBe('Init failed')
      expect(result.current.isReady).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should reset state on cleanup', async () => {
      const { result } = renderHook(() => useProofComposer())

      await act(async () => {
        await result.current.initialize()
      })

      expect(result.current.isReady).toBe(true)

      act(() => {
        result.current.cleanup()
      })

      expect(result.current.isReady).toBe(false)
      expect(result.current.orchestrator).toBeNull()
      expect(result.current.pipeline).toBeNull()
      expect(result.current.validator).toBeNull()
    })
  })
})

describe('useProofVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with idle status', () => {
      const { result } = renderHook(() => useProofVerification())

      expect(result.current.status).toBe('idle')
      expect(result.current.result).toBeNull()
      expect(result.current.results).toEqual([])
      expect(result.current.error).toBeNull()
      expect(result.current.isVerifying).toBe(false)
      expect(result.current.isValid).toBeNull()
    })
  })

  describe('verify', () => {
    it('should verify a single proof and return result', async () => {
      const mockPipeline = (
        sdk.createVerificationPipeline as ReturnType<typeof vi.fn>
      )()
      mockPipeline.verifySingle.mockResolvedValue({
        valid: true,
        proofId: 'proof-1',
        timeMs: 50,
      })

      const { result } = renderHook(() => useProofVerification())

      const proof = createMockSingleProof()

      await act(async () => {
        const verificationResult = await result.current.verify(proof)
        expect(verificationResult.valid).toBe(true)
      })

      expect(result.current.status).toBe('success')
      expect(result.current.isValid).toBe(true)
      expect(result.current.result?.valid).toBe(true)
    })

    it('should track verification loading state', async () => {
      const { result } = renderHook(() => useProofVerification())

      // Initial state
      expect(result.current.isVerifying).toBe(false)

      await act(async () => {
        await result.current.verify(createMockSingleProof())
      })

      // After verification
      expect(result.current.isVerifying).toBe(false)
      expect(result.current.status).toBe('success')
    })

    it('should accumulate results for multiple verifications', async () => {
      const { result } = renderHook(() => useProofVerification())

      await act(async () => {
        await result.current.verify(createMockSingleProof())
      })

      expect(result.current.results).toHaveLength(1)

      await act(async () => {
        await result.current.verify(createMockSingleProof())
      })

      expect(result.current.results).toHaveLength(2)
    })
  })
})

describe('useComposedProof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with idle status', () => {
      const { result } = renderHook(() => useComposedProof())

      expect(result.current.status).toBe('idle')
      expect(result.current.result).toBeNull()
      expect(result.current.progress).toBe(0)
      expect(result.current.currentStep).toBe('')
      expect(result.current.error).toBeNull()
      expect(result.current.isComposing).toBe(false)
    })
  })

  describe('compose', () => {
    it('should compose proofs and track progress', async () => {
      const mockResult = {
        success: true,
        proofs: [createMockSingleProof()],
      }

      const mockOrchestrator = (
        sdk.createProofOrchestrator as ReturnType<typeof vi.fn>
      )()
      mockOrchestrator.execute.mockImplementation(async (_request, onProgress) => {
        // Simulate progress callbacks
        onProgress?.({ progress: 50, operation: 'Generating proof 1' })
        onProgress?.({ progress: 100, operation: 'Complete' })
        return mockResult
      })

      const { result } = renderHook(() => useComposedProof())

      await act(async () => {
        const composeResult = await result.current.compose({
          proofRequests: [{ circuitId: 'test', inputs: {} }],
        })
        expect(composeResult).toEqual(mockResult)
      })

      expect(result.current.result).toEqual(mockResult)
      expect(result.current.status).toBe('success')
      expect(result.current.progress).toBe(100)
    })

    it('should handle composition errors', async () => {
      const mockOrchestrator = (
        sdk.createProofOrchestrator as ReturnType<typeof vi.fn>
      )()
      mockOrchestrator.execute.mockRejectedValue(new Error('Compose failed'))

      const { result } = renderHook(() => useComposedProof())

      await act(async () => {
        await expect(
          result.current.compose({
            proofRequests: [{ circuitId: 'test', inputs: {} }],
          })
        ).rejects.toThrow('Compose failed')
      })

      expect(result.current.error?.message).toBe('Compose failed')
      expect(result.current.status).toBe('error')
    })
  })

  describe('cancel', () => {
    it('should set status to idle on cancel', () => {
      const { result } = renderHook(() => useComposedProof())

      act(() => {
        result.current.cancel()
      })

      expect(result.current.status).toBe('idle')
    })
  })
})

describe('useProofCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty cache', () => {
      const { result } = renderHook(() => useProofCache())

      expect(result.current.size).toBe(0)
    })
  })

  describe('get and set', () => {
    it('should store and retrieve proofs', () => {
      const { result } = renderHook(() => useProofCache())

      const proof = createMockSingleProof()

      act(() => {
        result.current.set('key-1', proof)
      })

      expect(result.current.size).toBe(1)

      const cachedProof = result.current.get('key-1')
      expect(cachedProof).toEqual(proof)
    })

    it('should return null for missing keys', () => {
      const { result } = renderHook(() => useProofCache())

      const cachedProof = result.current.get('nonexistent')
      expect(cachedProof).toBeNull()
    })

    it('should evict oldest entries when max size exceeded', () => {
      const { result } = renderHook(() => useProofCache({ maxSize: 2 }))

      act(() => {
        result.current.set('key-1', createMockSingleProof())
        result.current.set('key-2', createMockSingleProof())
        result.current.set('key-3', createMockSingleProof())
      })

      // Oldest entry should be evicted
      expect(result.current.size).toBe(2)
      expect(result.current.has('key-1')).toBe(false)
      expect(result.current.has('key-2')).toBe(true)
      expect(result.current.has('key-3')).toBe(true)
    })
  })

  describe('has', () => {
    it('should check if key exists', () => {
      const { result } = renderHook(() => useProofCache())

      act(() => {
        result.current.set('existing', createMockSingleProof())
      })

      expect(result.current.has('existing')).toBe(true)
      expect(result.current.has('nonexistent')).toBe(false)
    })
  })

  describe('remove', () => {
    it('should remove entry from cache', () => {
      const { result } = renderHook(() => useProofCache())

      act(() => {
        result.current.set('key-1', createMockSingleProof())
      })

      expect(result.current.size).toBe(1)

      act(() => {
        const removed = result.current.remove('key-1')
        expect(removed).toBe(true)
      })

      expect(result.current.size).toBe(0)
    })

    it('should return false when removing non-existent key', () => {
      const { result } = renderHook(() => useProofCache())

      let removed: boolean
      act(() => {
        removed = result.current.remove('nonexistent')
      })

      expect(removed!).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all entries', () => {
      const { result } = renderHook(() => useProofCache())

      act(() => {
        result.current.set('key-1', createMockSingleProof())
        result.current.set('key-2', createMockSingleProof())
      })

      expect(result.current.size).toBe(2)

      act(() => {
        result.current.clear()
      })

      expect(result.current.size).toBe(0)
    })
  })
})

describe('useSystemCompatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should provide supported systems and validator', () => {
      const { result } = renderHook(() => useSystemCompatibility())

      expect(result.current.supportedSystems).toBeDefined()
      expect(Array.isArray(result.current.supportedSystems)).toBe(true)
    })
  })

  describe('areCompatible', () => {
    it('should check if two systems are compatible', () => {
      const mockValidator = (
        sdk.createCrossSystemValidator as ReturnType<typeof vi.fn>
      )()
      mockValidator.areSystemsCompatible.mockReturnValue(true)

      const { result } = renderHook(() => useSystemCompatibility())

      const compatible = result.current.areCompatible('noir', 'halo2')

      expect(compatible).toBe(true)
      expect(mockValidator.areSystemsCompatible).toHaveBeenCalledWith(
        'noir',
        'halo2'
      )
    })

    it('should return false for incompatible systems', () => {
      const mockValidator = (
        sdk.createCrossSystemValidator as ReturnType<typeof vi.fn>
      )()
      mockValidator.areSystemsCompatible.mockReturnValue(false)

      const { result } = renderHook(() => useSystemCompatibility())

      const compatible = result.current.areCompatible('noir', 'plonky2')

      expect(compatible).toBe(false)
    })
  })
})
