/**
 * Tests for ProofOrchestrator
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import {
  ProofOrchestrator,
  createProofOrchestrator,
  DEFAULT_ORCHESTRATOR_CONFIG,
  BUILTIN_TEMPLATES,
} from '../../src/proofs/orchestrator'

import type {
  OrchestratorConfig,
  CompositionRequest,
  OrchestratorProgressEvent,
  CompositionTemplate,
} from '../../src/proofs/orchestrator'

import type { ComposableProofProvider } from '../../src/proofs/composer/interface'
import type {
  ProofSystem,
  ProofProviderCapabilities,
  ProofProviderStatus,
  ProofProviderMetrics,
  SingleProof,
  HexString,
} from '@sip-protocol/types'

import { ProofAggregationStrategy as Strategy } from '@sip-protocol/types'

// ─── Mock Provider Factory ──────────────────────────────────────────────────

function createMockProvider(
  system: ProofSystem,
  options: {
    isReady?: boolean
    circuits?: string[]
    generateError?: string
    verifyResult?: boolean
    initDelay?: number
    generateDelay?: number
  } = {},
): ComposableProofProvider {
  const {
    isReady = true,
    circuits = ['funding_proof', 'validity_proof'],
    generateError,
    verifyResult = true,
    initDelay = 0,
    generateDelay = 0,
  } = options

  let ready = isReady
  let proofCounter = 0

  const metrics: ProofProviderMetrics = {
    proofsGenerated: 0,
    proofsVerified: 0,
    avgGenerationTimeMs: 100,
    avgVerificationTimeMs: 50,
    successRate: 1.0,
    memoryUsageBytes: 1024 * 1024,
  }

  const capabilities: ProofProviderCapabilities = {
    system,
    supportsRecursion: true,
    supportsBatchVerification: true,
    supportsBrowser: true,
    supportsNode: true,
    maxProofSize: 65536,
    supportedStrategies: [Strategy.SEQUENTIAL, Strategy.PARALLEL, Strategy.BATCH],
    availableCircuits: circuits,
  }

  return {
    system,
    capabilities,
    get status(): ProofProviderStatus {
      return {
        isReady: ready,
        isBusy: false,
        queueLength: 0,
        metrics,
      }
    },

    async initialize() {
      if (initDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, initDelay))
      }
      ready = true
    },

    async waitUntilReady() {
      if (!ready) {
        await this.initialize()
      }
    },

    async generateProof(request) {
      if (generateDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, generateDelay))
      }

      if (generateError) {
        return {
          success: false,
          error: generateError,
          timeMs: 10,
          providerId: `${system}-provider`,
        }
      }

      proofCounter++
      const proof: SingleProof = {
        id: `proof-${system}-${proofCounter}`,
        proof: '0x1234567890abcdef' as HexString,
        publicInputs: ['0x0001', '0x0002'] as HexString[],
        metadata: {
          system,
          systemVersion: '1.0.0',
          circuitId: request.circuitId,
          circuitVersion: '1.0.0',
          generatedAt: Date.now(),
          proofSizeBytes: 256,
        },
      }

      return {
        success: true,
        proof,
        timeMs: 100,
        providerId: `${system}-provider`,
      }
    },

    async verifyProof() {
      return verifyResult
    },

    async verifyBatch(proofs) {
      return proofs.map(() => verifyResult)
    },

    getAvailableCircuits() {
      return circuits
    },

    hasCircuit(circuitId) {
      return circuits.includes(circuitId)
    },

    async dispose() {
      ready = false
    },
  }
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('ProofOrchestrator', () => {
  let orchestrator: ProofOrchestrator

  beforeEach(() => {
    orchestrator = new ProofOrchestrator()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Configuration ──────────────────────────────────────────────────────────

  describe('configuration', () => {
    it('should use default config when none provided', () => {
      const config = orchestrator.config
      expect(config.maxRetries).toBe(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries)
      expect(config.baseDelayMs).toBe(DEFAULT_ORCHESTRATOR_CONFIG.baseDelayMs)
      expect(config.timeoutMs).toBe(DEFAULT_ORCHESTRATOR_CONFIG.timeoutMs)
    })

    it('should accept custom config', () => {
      const custom: Partial<OrchestratorConfig> = {
        maxRetries: 5,
        baseDelayMs: 2000,
        timeoutMs: 600000,
      }

      const customOrchestrator = new ProofOrchestrator(custom)
      const config = customOrchestrator.config

      expect(config.maxRetries).toBe(5)
      expect(config.baseDelayMs).toBe(2000)
      expect(config.timeoutMs).toBe(600000)
    })

    it('should update config dynamically', () => {
      orchestrator.updateConfig({ maxRetries: 10 })
      expect(orchestrator.config.maxRetries).toBe(10)
    })

    it('should preserve other config values when updating', () => {
      const originalTimeout = orchestrator.config.timeoutMs
      orchestrator.updateConfig({ maxRetries: 10 })
      expect(orchestrator.config.timeoutMs).toBe(originalTimeout)
    })
  })

  // ─── Provider Management ────────────────────────────────────────────────────

  describe('provider management', () => {
    it('should register a provider', () => {
      const provider = createMockProvider('noir')
      orchestrator.registerProvider(provider)

      expect(orchestrator.getProvider('noir')).toBe(provider)
    })

    it('should unregister a provider', () => {
      const provider = createMockProvider('noir')
      orchestrator.registerProvider(provider)

      const result = orchestrator.unregisterProvider('noir')

      expect(result).toBe(true)
      expect(orchestrator.getProvider('noir')).toBeUndefined()
    })

    it('should return false when unregistering non-existent provider', () => {
      const result = orchestrator.unregisterProvider('noir')
      expect(result).toBe(false)
    })

    it('should track available systems', () => {
      orchestrator.registerProvider(createMockProvider('noir'))
      orchestrator.registerProvider(createMockProvider('halo2'))

      const systems = orchestrator.getAvailableSystems()

      expect(systems).toContain('noir')
      expect(systems).toContain('halo2')
      expect(systems).toHaveLength(2)
    })

    it('should replace existing provider for same system', () => {
      const provider1 = createMockProvider('noir', { circuits: ['circuit1'] })
      const provider2 = createMockProvider('noir', { circuits: ['circuit2'] })

      orchestrator.registerProvider(provider1)
      orchestrator.registerProvider(provider2)

      const registered = orchestrator.getProvider('noir')
      expect(registered?.getAvailableCircuits()).toContain('circuit2')
      expect(registered?.getAvailableCircuits()).not.toContain('circuit1')
    })
  })

  // ─── Template Management ────────────────────────────────────────────────────

  describe('template management', () => {
    it('should have built-in templates', () => {
      const templates = orchestrator.getTemplates()
      expect(templates.length).toBeGreaterThan(0)
    })

    it('should include shielded-transfer template', () => {
      const template = orchestrator.getTemplate('shielded-transfer')
      expect(template).toBeDefined()
      expect(template?.name).toBe('Shielded Transfer')
    })

    it('should include compliant-transfer template', () => {
      const template = orchestrator.getTemplate('compliant-transfer')
      expect(template).toBeDefined()
      expect(template?.requiredProofs).toHaveLength(3)
    })

    it('should register custom template', () => {
      const customTemplate: CompositionTemplate = {
        id: 'custom-template',
        name: 'Custom Template',
        description: 'Test template',
        requiredProofs: [{ circuitId: 'test_proof', required: true }],
        defaultStrategy: Strategy.PARALLEL,
      }

      orchestrator.registerTemplate(customTemplate)
      const retrieved = orchestrator.getTemplate('custom-template')

      expect(retrieved).toEqual(customTemplate)
    })

    it('should return undefined for unknown template', () => {
      const template = orchestrator.getTemplate('unknown-template')
      expect(template).toBeUndefined()
    })
  })

  // ─── State ──────────────────────────────────────────────────────────────────

  describe('state', () => {
    it('should start in idle state', () => {
      expect(orchestrator.state).toBe('idle')
    })
  })

  // ─── Planning ───────────────────────────────────────────────────────────────

  describe('planning', () => {
    beforeEach(() => {
      orchestrator.registerProvider(createMockProvider('noir'))
      orchestrator.registerProvider(createMockProvider('halo2'))
    })

    it('should create valid plan for simple request', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
          { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const plan = await orchestrator.plan(request)

      expect(plan.valid).toBe(true)
      expect(plan.errors).toHaveLength(0)
      expect(plan.proofRequests).toHaveLength(2)
    })

    it('should include required providers in plan', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {}, system: 'noir' },
        ],
      }

      const plan = await orchestrator.plan(request)

      expect(plan.requiredProviders).toContain('noir')
    })

    it('should detect missing provider', async () => {
      orchestrator.unregisterProvider('noir')

      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {}, system: 'noir' },
        ],
      }

      const plan = await orchestrator.plan(request)

      expect(plan.valid).toBe(false)
      expect(plan.errors.some(e => e.includes('No provider'))).toBe(true)
    })

    it('should apply template defaults', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
          { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
        ],
        template: 'shielded-transfer',
      }

      const plan = await orchestrator.plan(request)

      expect(plan.strategy).toBe(Strategy.SEQUENTIAL)
    })

    it('should detect missing required template proofs', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
          // Missing validity_proof required by template
        ],
        template: 'shielded-transfer',
      }

      const plan = await orchestrator.plan(request)

      expect(plan.valid).toBe(false)
      expect(plan.errors.some(e => e.includes('validity_proof'))).toBe(true)
    })

    it('should error on unknown template', async () => {
      const request: CompositionRequest = {
        proofs: [{ circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} }],
        template: 'unknown-template',
      }

      const plan = await orchestrator.plan(request)

      expect(plan.valid).toBe(false)
      expect(plan.errors.some(e => e.includes('not found'))).toBe(true)
    })

    it('should generate recommendations for many sequential proofs', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
          { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
          { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
        ],
        strategy: Strategy.SEQUENTIAL,
      }

      const plan = await orchestrator.plan(request)

      expect(plan.recommendations.some(r =>
        r.toLowerCase().includes('parallel') || r.toLowerCase().includes('batch'),
      )).toBe(true)
    })

    it('should estimate time based on proofs and providers', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
          { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const plan = await orchestrator.plan(request)

      expect(plan.estimatedTimeMs).toBeGreaterThan(0)
    })

    it('should infer noir system from circuit naming', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'noir_circuit', privateInputs: {}, publicInputs: {} },
        ],
      }

      // No provider set for noir, but we registered one in beforeEach
      const plan = await orchestrator.plan(request)

      expect(plan.requiredProviders).toContain('noir')
    })
  })

  // ─── Execution ──────────────────────────────────────────────────────────────

  describe('execution', () => {
    beforeEach(() => {
      vi.useRealTimers() // Use real timers for execution tests
      orchestrator.registerProvider(createMockProvider('noir'))
    })

    afterEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should execute composition successfully', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const result = await orchestrator.execute(request)

      expect(result.success).toBe(true)
      expect(result.state).toBe('completed')
      expect(result.composedProof).toBeDefined()
    })

    it('should return dry-run result without executing', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
        dryRun: true,
      }

      const result = await orchestrator.execute(request)

      expect(result.success).toBe(true)
      expect(result.composedProof).toBeUndefined()
      expect(result.retries).toBe(0)
    })

    it('should report progress during execution', async () => {
      const progressEvents: OrchestratorProgressEvent[] = []

      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      await orchestrator.execute(request, (event) => {
        progressEvents.push(event)
      })

      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents.some(e => e.operation === 'planning')).toBe(true)
      expect(progressEvents.some(e => e.operation === 'completed')).toBe(true)
    })

    it('should include audit log in result', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const result = await orchestrator.execute(request)

      expect(result.auditLog.length).toBeGreaterThan(0)
      expect(result.auditLog.some(e => e.event === 'execution_started')).toBe(true)
    })

    it('should handle proof generation errors', async () => {
      orchestrator.registerProvider(createMockProvider('noir', {
        generateError: 'Generation failed',
      }))

      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {}, system: 'noir' },
        ],
      }

      const result = await orchestrator.execute(request)

      expect(result.success).toBe(false)
      expect(result.state).toBe('failed')
    })

    it('should compose multiple proofs', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
          { circuitId: 'validity_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const result = await orchestrator.execute(request)

      expect(result.success).toBe(true)
      expect(result.composedProof?.proofs).toHaveLength(2)
    })

    it('should apply strategy to composed proof', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
        strategy: Strategy.PARALLEL,
      }

      const result = await orchestrator.execute(request)

      expect(result.success).toBe(true)
      expect(result.composedProof?.strategy).toBe(Strategy.PARALLEL)
    })
  })

  // ─── Cancellation ───────────────────────────────────────────────────────────

  describe('cancellation', () => {
    beforeEach(() => {
      vi.useRealTimers()
      orchestrator.registerProvider(createMockProvider('noir', {
        generateDelay: 100,
      }))
    })

    afterEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should handle external abort signal', async () => {
      const controller = new AbortController()

      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
        abortSignal: controller.signal,
      }

      // Start execution and abort shortly after
      const promise = orchestrator.execute(request)
      setTimeout(() => controller.abort(), 10)

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.state).toBe('cancelled')
    })

    it('should cancel via cancel method', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const promise = orchestrator.execute(request)
      setTimeout(() => orchestrator.cancel(), 10)

      const result = await promise

      expect(result.success).toBe(false)
      expect(result.state).toBe('cancelled')
    })
  })

  // ─── Audit Logging ──────────────────────────────────────────────────────────

  describe('audit logging', () => {
    it('should track provider registration in audit log', () => {
      orchestrator.registerProvider(createMockProvider('noir'))

      const log = orchestrator.getAuditLog()

      expect(log.some(e =>
        e.event === 'provider_registered' &&
        (e.details as Record<string, unknown>).system === 'noir',
      )).toBe(true)
    })

    it('should track template registration in audit log', () => {
      const template: CompositionTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        requiredProofs: [],
        defaultStrategy: Strategy.SEQUENTIAL,
      }

      orchestrator.registerTemplate(template)

      const log = orchestrator.getAuditLog()

      expect(log.some(e => e.event === 'template_registered')).toBe(true)
    })

    it('should clear audit log', () => {
      orchestrator.registerProvider(createMockProvider('noir'))
      expect(orchestrator.getAuditLog().length).toBeGreaterThan(0)

      orchestrator.clearAuditLog()

      expect(orchestrator.getAuditLog()).toHaveLength(0)
    })

    it('should disable audit logging when configured', async () => {
      const noAuditOrchestrator = new ProofOrchestrator({
        enableAuditLog: false,
      })

      noAuditOrchestrator.registerProvider(createMockProvider('noir'))

      expect(noAuditOrchestrator.getAuditLog()).toHaveLength(0)
    })
  })

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe('validation', () => {
    beforeEach(() => {
      vi.useRealTimers()
      orchestrator.registerProvider(createMockProvider('noir'))
    })

    afterEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should validate proofs before composition', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const result = await orchestrator.execute(request)

      expect(result.validationReport).toBeDefined()
    })

    it('should skip validation when disabled', async () => {
      const noValidateOrchestrator = new ProofOrchestrator({
        validateBeforeCompose: false,
      })
      noValidateOrchestrator.registerProvider(createMockProvider('noir'))

      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const result = await noValidateOrchestrator.execute(request)

      expect(result.validationReport).toBeUndefined()
    })
  })

  // ─── Retries ────────────────────────────────────────────────────────────────

  describe('retries', () => {
    beforeEach(() => {
      vi.useRealTimers()
    })

    afterEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should retry failed operations', async () => {
      let attempts = 0
      const provider = createMockProvider('noir')
      const originalGenerateProof = provider.generateProof.bind(provider)

      provider.generateProof = async (request) => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return originalGenerateProof(request)
      }

      const retryOrchestrator = new ProofOrchestrator({
        maxRetries: 5,
        baseDelayMs: 10,
        maxDelayMs: 50,
      })
      retryOrchestrator.registerProvider(provider)

      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const result = await retryOrchestrator.execute(request)

      expect(result.success).toBe(true)
      expect(attempts).toBe(3)
    }, 10000)

    it('should fail after max retries exceeded', async () => {
      const failingProvider = createMockProvider('noir')
      failingProvider.generateProof = async () => {
        throw new Error('Permanent failure')
      }

      const retryOrchestrator = new ProofOrchestrator({
        maxRetries: 2,
        baseDelayMs: 10,
        maxDelayMs: 50,
      })
      retryOrchestrator.registerProvider(failingProvider)

      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} },
        ],
      }

      const result = await retryOrchestrator.execute(request)

      expect(result.success).toBe(false)
      expect(result.state).toBe('failed')
    }, 10000)
  })

  // ─── Multi-System Composition ───────────────────────────────────────────────

  describe('multi-system composition', () => {
    let multiOrchestrator: ProofOrchestrator

    beforeEach(() => {
      vi.useRealTimers()
      // Create orchestrator with validation disabled to test composition flow
      multiOrchestrator = new ProofOrchestrator({
        validateBeforeCompose: false,
      })
      multiOrchestrator.registerProvider(createMockProvider('noir', {
        circuits: ['noir_proof'],
      }))
      multiOrchestrator.registerProvider(createMockProvider('halo2', {
        circuits: ['halo2_proof'],
      }))
    })

    afterEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should compose proofs from multiple systems', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'noir_proof', privateInputs: {}, publicInputs: {}, system: 'noir' },
          { circuitId: 'halo2_proof', privateInputs: {}, publicInputs: {}, system: 'halo2' },
        ],
      }

      const result = await multiOrchestrator.execute(request)

      expect(result.success).toBe(true)
      expect(result.composedProof?.compositionMetadata.systems).toContain('noir')
      expect(result.composedProof?.compositionMetadata.systems).toContain('halo2')
    })

    it('should generate compatibility recommendations', async () => {
      const request: CompositionRequest = {
        proofs: [
          { circuitId: 'noir_proof', privateInputs: {}, publicInputs: {}, system: 'noir' },
          { circuitId: 'halo2_proof', privateInputs: {}, publicInputs: {}, system: 'halo2' },
        ],
      }

      const plan = await multiOrchestrator.plan(request)

      expect(plan.recommendations.some(r =>
        r.toLowerCase().includes('multi-system') ||
        r.toLowerCase().includes('cross-system'),
      )).toBe(true)
    })
  })

  // ─── Timeout Handling ───────────────────────────────────────────────────────

  describe('timeout handling', () => {
    beforeEach(() => {
      vi.useRealTimers()
    })

    afterEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    it('should use request-specific timeout', async () => {
      const slowProvider = createMockProvider('noir', {
        generateDelay: 500, // Slow enough to trigger timeout
      })

      const timeoutOrchestrator = new ProofOrchestrator({
        timeoutMs: 10000, // Default high
        maxRetries: 0, // Disable retries for this test
      })
      timeoutOrchestrator.registerProvider(slowProvider)

      const request: CompositionRequest = {
        proofs: [{ circuitId: 'funding_proof', privateInputs: {}, publicInputs: {} }],
        timeoutMs: 100, // Short timeout (less than generateDelay)
      }

      const result = await timeoutOrchestrator.execute(request)

      expect(result.success).toBe(false)
      expect(result.error?.toLowerCase()).toContain('timeout')
    }, 10000)
  })

  // ─── Factory Function ───────────────────────────────────────────────────────

  describe('createProofOrchestrator', () => {
    it('should create orchestrator with default config', () => {
      const created = createProofOrchestrator()
      expect(created).toBeInstanceOf(ProofOrchestrator)
      expect(created.config.maxRetries).toBe(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries)
    })

    it('should create orchestrator with custom config', () => {
      const created = createProofOrchestrator({ maxRetries: 10 })
      expect(created.config.maxRetries).toBe(10)
    })
  })

  // ─── Built-in Templates ─────────────────────────────────────────────────────

  describe('BUILTIN_TEMPLATES', () => {
    it('should have all expected templates', () => {
      const templateIds = BUILTIN_TEMPLATES.map(t => t.id)

      expect(templateIds).toContain('shielded-transfer')
      expect(templateIds).toContain('compliant-transfer')
      expect(templateIds).toContain('multi-chain-bridge')
      expect(templateIds).toContain('batch-verification')
    })

    it('should have valid structure for all templates', () => {
      for (const template of BUILTIN_TEMPLATES) {
        expect(template.id).toBeTruthy()
        expect(template.name).toBeTruthy()
        expect(template.description).toBeTruthy()
        expect(Array.isArray(template.requiredProofs)).toBe(true)
        expect(template.defaultStrategy).toBeTruthy()
      }
    })
  })
})

describe('DEFAULT_ORCHESTRATOR_CONFIG', () => {
  it('should have sensible default values', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries).toBe(3)
    expect(DEFAULT_ORCHESTRATOR_CONFIG.baseDelayMs).toBe(1000)
    expect(DEFAULT_ORCHESTRATOR_CONFIG.maxDelayMs).toBe(30000)
    expect(DEFAULT_ORCHESTRATOR_CONFIG.timeoutMs).toBe(300000)
    expect(DEFAULT_ORCHESTRATOR_CONFIG.enableAuditLog).toBe(true)
    expect(DEFAULT_ORCHESTRATOR_CONFIG.validateBeforeCompose).toBe(true)
  })
})
