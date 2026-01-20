/**
 * Proof Format Converters Tests
 *
 * Tests for M20-08: Implement proof format converters
 * - ProofConverter implementations
 * - Noir, Halo2, Kimchi converters
 * - UnifiedProofConverter
 * - Error handling and validation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { SingleProof, ProofMetadata, HexString } from '@sip-protocol/types'
import {
  NoirProofConverter,
  Halo2ProofConverter,
  KimchiProofConverter,
  UnifiedProofConverter,
  createNoirConverter,
  createHalo2Converter,
  createKimchiConverter,
  createUnifiedConverter,
  convertToSIP,
  convertFromSIP,
  ProofConversionError,
  InvalidProofError,
  UnsupportedVersionError,
  DEFAULT_CONVERSION_OPTIONS,
  type NoirNativeProof,
  type Halo2NativeProof,
  type KimchiNativeProof,
} from '../../src/proofs/converters'

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createSampleNoirProof(): NoirNativeProof {
  return {
    system: 'noir',
    proofData: new Uint8Array(128).fill(0x42),
    publicInputs: ['12345', '67890'],
    verificationKey: new Uint8Array(64).fill(0xaa),
    circuitHash: 'test-circuit-hash',
    noirVersion: '0.33.0',
    backendVersion: '0.51.0',
  }
}

function createSampleHalo2Proof(): Halo2NativeProof {
  return {
    system: 'halo2',
    proofData: new Uint8Array(256).fill(0x55),
    publicInputs: ['98765', '43210'],
    verificationKey: new Uint8Array(128).fill(0xbb),
    provingKeyCommitment: '0x1234567890abcdef' as HexString,
    k: 14,
    halo2Version: '0.3.0',
  }
}

function createSampleKimchiProof(): KimchiNativeProof {
  return {
    system: 'kimchi',
    proofData: new Uint8Array(512).fill(0x77),
    publicInputs: ['111222', '333444'],
    verificationKey: new Uint8Array(256).fill(0xcc),
    srsHash: '0xfedcba0987654321' as HexString,
    kimchiVersion: '1.0.0',
    verifierIndexCommitment: '0xdeadbeef' as HexString,
  }
}

function createSampleSIPProof(system: 'noir' | 'halo2' | 'kimchi'): SingleProof {
  const metadata: ProofMetadata = {
    system,
    systemVersion: '1.0.0',
    circuitId: `${system}-test-circuit`,
    circuitVersion: '1.0.0',
    generatedAt: Date.now(),
    proofSizeBytes: 128,
    verificationCost: 100n,
  }

  return {
    id: `test-proof-${Date.now()}`,
    proof: '0x' + 'ab'.repeat(64) as HexString,
    publicInputs: [
      '0x0000000000000000000000000000000000000000000000000000000000003039' as HexString,
      '0x0000000000000000000000000000000000000000000000000000000000010932' as HexString,
    ],
    verificationKey: '0x' + 'cd'.repeat(32) as HexString,
    metadata,
  }
}

// ─── Noir Converter Tests ────────────────────────────────────────────────────

describe('NoirProofConverter', () => {
  let converter: NoirProofConverter

  beforeEach(() => {
    converter = new NoirProofConverter()
  })

  describe('constructor', () => {
    it('should have correct system and version', () => {
      expect(converter.system).toBe('noir')
      expect(converter.version).toBe('1.0.0')
    })
  })

  describe('toSIP', () => {
    it('should convert Noir proof to SIP format', () => {
      const noirProof = createSampleNoirProof()
      const result = converter.toSIP(noirProof)

      expect(result.success).toBe(true)
      expect(result.result).toBeDefined()
      expect(result.result?.metadata.system).toBe('noir')
      expect(result.result?.metadata.systemVersion).toBe('0.33.0')
      expect(result.lossless).toBe(true)
    })

    it('should convert public inputs to hex format', () => {
      const noirProof = createSampleNoirProof()
      const result = converter.toSIP(noirProof)

      expect(result.success).toBe(true)
      expect(result.result?.publicInputs).toHaveLength(2)
      expect(result.result?.publicInputs[0]).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should include verification key when requested', () => {
      const noirProof = createSampleNoirProof()
      const result = converter.toSIP(noirProof, { includeVerificationKey: true })

      expect(result.success).toBe(true)
      expect(result.result?.verificationKey).toBeDefined()
      expect(result.result?.verificationKey).toMatch(/^0x[0-9a-f]+$/i)
    })

    it('should exclude verification key when not requested', () => {
      const noirProof = createSampleNoirProof()
      const result = converter.toSIP(noirProof, { includeVerificationKey: false })

      expect(result.success).toBe(true)
      expect(result.result?.verificationKey).toBeUndefined()
    })

    it('should include conversion metadata', () => {
      const noirProof = createSampleNoirProof()
      const result = converter.toSIP(noirProof)

      expect(result.conversionMetadata).toBeDefined()
      expect(result.conversionMetadata.sourceSystem).toBe('noir')
      expect(result.conversionMetadata.targetSystem).toBe('sip')
      expect(result.conversionMetadata.converterVersion).toBe('1.0.0')
    })

    it('should validate proof when validation enabled', () => {
      const invalidProof: NoirNativeProof = {
        system: 'noir',
        proofData: new Uint8Array(0), // Empty - invalid
        publicInputs: [],
      }

      const result = converter.toSIP(invalidProof, { validateBeforeConversion: true })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_INPUT')
    })

    it('should warn about unsupported Noir version', () => {
      const noirProof = createSampleNoirProof()
      noirProof.noirVersion = '0.20.0' // Old version

      const result = converter.toSIP(noirProof)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('UNSUPPORTED_VERSION')
    })

    it('should use custom ID generator', () => {
      const noirProof = createSampleNoirProof()
      const customId = 'custom-proof-id-123'
      const result = converter.toSIP(noirProof, {
        idGenerator: () => customId,
      })

      expect(result.success).toBe(true)
      expect(result.result?.id).toBe(customId)
    })
  })

  describe('fromSIP', () => {
    it('should convert SIP proof to Noir format', () => {
      const sipProof = createSampleSIPProof('noir')
      const result = converter.fromSIP(sipProof)

      expect(result.success).toBe(true)
      expect(result.result).toBeDefined()
      expect(result.result?.system).toBe('noir')
      expect(result.lossless).toBe(true)
    })

    it('should convert public inputs from hex', () => {
      const sipProof = createSampleSIPProof('noir')
      const result = converter.fromSIP(sipProof)

      expect(result.success).toBe(true)
      expect(result.result?.publicInputs).toHaveLength(2)
      // Should be decimal strings
      expect(result.result?.publicInputs[0]).toMatch(/^\d+$/)
    })

    it('should reject non-Noir proofs', () => {
      const sipProof = createSampleSIPProof('halo2')
      const result = converter.fromSIP(sipProof)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_INPUT')
    })

    it('should preserve native metadata when requested', () => {
      const sipProof = createSampleSIPProof('noir')
      const result = converter.fromSIP(sipProof, { preserveNativeMetadata: true })

      expect(result.success).toBe(true)
      expect(result.result?.nativeMetadata).toBeDefined()
      expect(result.result?.nativeMetadata?.sipProofId).toBe(sipProof.id)
    })
  })

  describe('validateNative', () => {
    it('should validate valid proof', () => {
      const noirProof = createSampleNoirProof()
      const result = converter.validateNative(noirProof)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect empty proof data', () => {
      const invalidProof: NoirNativeProof = {
        system: 'noir',
        proofData: new Uint8Array(0),
        publicInputs: ['123'],
      }

      const result = converter.validateNative(invalidProof)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'proofData')).toBe(true)
    })

    it('should detect invalid public input format', () => {
      const invalidProof: NoirNativeProof = {
        system: 'noir',
        proofData: new Uint8Array(64).fill(0x42),
        publicInputs: ['invalid-not-a-number'],
      }

      const result = converter.validateNative(invalidProof)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field.includes('publicInputs'))).toBe(true)
    })

    it('should include warnings for missing optional fields', () => {
      const minimalProof: NoirNativeProof = {
        system: 'noir',
        proofData: new Uint8Array(64).fill(0x42),
        publicInputs: ['123'],
      }

      const result = converter.validateNative(minimalProof)

      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('canConvertFromSIP', () => {
    it('should return true for Noir proofs', () => {
      const sipProof = createSampleSIPProof('noir')
      expect(converter.canConvertFromSIP(sipProof)).toBe(true)
    })

    it('should return false for non-Noir proofs', () => {
      const sipProof = createSampleSIPProof('halo2')
      expect(converter.canConvertFromSIP(sipProof)).toBe(false)
    })
  })

  describe('getSupportedVersions', () => {
    it('should return list of supported versions', () => {
      const versions = converter.getSupportedVersions()
      expect(versions.length).toBeGreaterThan(0)
      expect(versions).toContain('0.33')
    })
  })
})

// ─── Halo2 Converter Tests ───────────────────────────────────────────────────

describe('Halo2ProofConverter', () => {
  let converter: Halo2ProofConverter

  beforeEach(() => {
    converter = new Halo2ProofConverter()
  })

  describe('constructor', () => {
    it('should have correct system and version', () => {
      expect(converter.system).toBe('halo2')
      expect(converter.version).toBe('1.0.0')
    })
  })

  describe('toSIP', () => {
    it('should convert Halo2 proof to SIP format', () => {
      const halo2Proof = createSampleHalo2Proof()
      const result = converter.toSIP(halo2Proof)

      expect(result.success).toBe(true)
      expect(result.result).toBeDefined()
      expect(result.result?.metadata.system).toBe('halo2')
      expect(result.lossless).toBe(true)
    })

    it('should include k value in circuit ID', () => {
      const halo2Proof = createSampleHalo2Proof()
      const result = converter.toSIP(halo2Proof)

      expect(result.success).toBe(true)
      expect(result.result?.metadata.circuitId).toContain('k14')
    })
  })

  describe('fromSIP', () => {
    it('should convert SIP proof to Halo2 format', () => {
      const sipProof = createSampleSIPProof('halo2')
      sipProof.metadata.circuitId = 'halo2-k14-abcd1234' // Include k value
      const result = converter.fromSIP(sipProof)

      expect(result.success).toBe(true)
      expect(result.result?.system).toBe('halo2')
      expect(result.result?.k).toBe(14)
    })

    it('should reject non-Halo2 proofs', () => {
      const sipProof = createSampleSIPProof('noir')
      const result = converter.fromSIP(sipProof)

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_INPUT')
    })
  })

  describe('validateNative', () => {
    it('should validate valid proof', () => {
      const halo2Proof = createSampleHalo2Proof()
      const result = converter.validateNative(halo2Proof)

      expect(result.valid).toBe(true)
    })

    it('should detect invalid k value', () => {
      const invalidProof = createSampleHalo2Proof()
      invalidProof.k = 2 // Too small

      const result = converter.validateNative(invalidProof)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'k')).toBe(true)
    })
  })
})

// ─── Kimchi Converter Tests ──────────────────────────────────────────────────

describe('KimchiProofConverter', () => {
  let converter: KimchiProofConverter

  beforeEach(() => {
    converter = new KimchiProofConverter()
  })

  describe('constructor', () => {
    it('should have correct system and version', () => {
      expect(converter.system).toBe('kimchi')
      expect(converter.version).toBe('1.0.0')
    })
  })

  describe('toSIP', () => {
    it('should convert Kimchi proof to SIP format', () => {
      const kimchiProof = createSampleKimchiProof()
      const result = converter.toSIP(kimchiProof)

      expect(result.success).toBe(true)
      expect(result.result).toBeDefined()
      expect(result.result?.metadata.system).toBe('kimchi')
      expect(result.lossless).toBe(true)
    })
  })

  describe('fromSIP', () => {
    it('should convert SIP proof to Kimchi format', () => {
      const sipProof = createSampleSIPProof('kimchi')
      const result = converter.fromSIP(sipProof)

      expect(result.success).toBe(true)
      expect(result.result?.system).toBe('kimchi')
    })

    it('should reject non-Kimchi proofs', () => {
      const sipProof = createSampleSIPProof('noir')
      const result = converter.fromSIP(sipProof)

      expect(result.success).toBe(false)
    })
  })

  describe('validateNative', () => {
    it('should validate valid proof', () => {
      const kimchiProof = createSampleKimchiProof()
      const result = converter.validateNative(kimchiProof)

      expect(result.valid).toBe(true)
    })

    it('should validate Pasta field elements', () => {
      const invalidProof = createSampleKimchiProof()
      // Very large value that exceeds Pallas modulus
      invalidProof.publicInputs = ['115792089237316195423570985008687907853269984665640564039457584007913129639935']

      const result = converter.validateNative(invalidProof)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVALID_FIELD_ELEMENT')).toBe(true)
    })
  })
})

// ─── Unified Converter Tests ─────────────────────────────────────────────────

describe('UnifiedProofConverter', () => {
  let converter: UnifiedProofConverter

  beforeEach(() => {
    converter = new UnifiedProofConverter()
  })

  describe('toSIP', () => {
    it('should route Noir proofs to Noir converter', () => {
      const noirProof = createSampleNoirProof()
      const result = converter.toSIP(noirProof)

      expect(result.success).toBe(true)
      expect(result.result?.metadata.system).toBe('noir')
    })

    it('should route Halo2 proofs to Halo2 converter', () => {
      const halo2Proof = createSampleHalo2Proof()
      const result = converter.toSIP(halo2Proof)

      expect(result.success).toBe(true)
      expect(result.result?.metadata.system).toBe('halo2')
    })

    it('should route Kimchi proofs to Kimchi converter', () => {
      const kimchiProof = createSampleKimchiProof()
      const result = converter.toSIP(kimchiProof)

      expect(result.success).toBe(true)
      expect(result.result?.metadata.system).toBe('kimchi')
    })
  })

  describe('fromSIP', () => {
    it('should route to appropriate converter based on proof system', () => {
      const noirSipProof = createSampleSIPProof('noir')
      const noirResult = converter.fromSIP(noirSipProof)
      expect(noirResult.success).toBe(true)
      expect(noirResult.result?.system).toBe('noir')

      const halo2SipProof = createSampleSIPProof('halo2')
      const halo2Result = converter.fromSIP(halo2SipProof)
      expect(halo2Result.success).toBe(true)
      expect(halo2Result.result?.system).toBe('halo2')

      const kimchiSipProof = createSampleSIPProof('kimchi')
      const kimchiResult = converter.fromSIP(kimchiSipProof)
      expect(kimchiResult.success).toBe(true)
      expect(kimchiResult.result?.system).toBe('kimchi')
    })
  })

  describe('getSupportedSystems', () => {
    it('should return all supported systems', () => {
      const systems = converter.getSupportedSystems()
      expect(systems).toContain('noir')
      expect(systems).toContain('halo2')
      expect(systems).toContain('kimchi')
    })
  })

  describe('isSystemSupported', () => {
    it('should return true for supported systems', () => {
      expect(converter.isSystemSupported('noir')).toBe(true)
      expect(converter.isSystemSupported('halo2')).toBe(true)
      expect(converter.isSystemSupported('kimchi')).toBe(true)
    })

    it('should return false for unsupported systems', () => {
      expect(converter.isSystemSupported('groth16')).toBe(false)
      expect(converter.isSystemSupported('plonk')).toBe(false)
    })
  })
})

// ─── Factory Functions Tests ─────────────────────────────────────────────────

describe('Factory Functions', () => {
  describe('createNoirConverter', () => {
    it('should create NoirProofConverter instance', () => {
      const converter = createNoirConverter()
      expect(converter).toBeInstanceOf(NoirProofConverter)
    })
  })

  describe('createHalo2Converter', () => {
    it('should create Halo2ProofConverter instance', () => {
      const converter = createHalo2Converter()
      expect(converter).toBeInstanceOf(Halo2ProofConverter)
    })
  })

  describe('createKimchiConverter', () => {
    it('should create KimchiProofConverter instance', () => {
      const converter = createKimchiConverter()
      expect(converter).toBeInstanceOf(KimchiProofConverter)
    })
  })

  describe('createUnifiedConverter', () => {
    it('should create UnifiedProofConverter instance', () => {
      const converter = createUnifiedConverter()
      expect(converter).toBeInstanceOf(UnifiedProofConverter)
    })
  })
})

// ─── Convenience Functions Tests ─────────────────────────────────────────────

describe('Convenience Functions', () => {
  describe('convertToSIP', () => {
    it('should convert native proof to SIP format', () => {
      const noirProof = createSampleNoirProof()
      const result = convertToSIP(noirProof)

      expect(result.success).toBe(true)
      expect(result.result?.metadata.system).toBe('noir')
    })
  })

  describe('convertFromSIP', () => {
    it('should convert SIP proof to native format', () => {
      const sipProof = createSampleSIPProof('halo2')
      const result = convertFromSIP(sipProof)

      expect(result.success).toBe(true)
      expect(result.result?.system).toBe('halo2')
    })
  })
})

// ─── Error Classes Tests ─────────────────────────────────────────────────────

describe('Error Classes', () => {
  describe('ProofConversionError', () => {
    it('should create with all properties', () => {
      const error = new ProofConversionError(
        'INVALID_INPUT',
        'Test error message',
        'noir',
        'sip',
      )

      expect(error.name).toBe('ProofConversionError')
      expect(error.code).toBe('INVALID_INPUT')
      expect(error.message).toBe('Test error message')
      expect(error.sourceSystem).toBe('noir')
      expect(error.targetSystem).toBe('sip')
    })

    it('should include cause when provided', () => {
      const cause = new Error('Underlying error')
      const error = new ProofConversionError(
        'UNKNOWN_ERROR',
        'Wrapper error',
        'halo2',
        'sip',
        cause,
      )

      expect(error.cause).toBe(cause)
    })
  })

  describe('InvalidProofError', () => {
    it('should create with validation errors', () => {
      const validationErrors = [
        { field: 'proofData', message: 'Empty', code: 'REQUIRED' },
      ]
      const error = new InvalidProofError('noir', 'sip', validationErrors)

      expect(error.name).toBe('InvalidProofError')
      expect(error.code).toBe('INVALID_INPUT')
      expect(error.validationErrors).toEqual(validationErrors)
    })
  })

  describe('UnsupportedVersionError', () => {
    it('should create with version info', () => {
      const error = new UnsupportedVersionError('noir', '0.10.0', ['0.30', '0.31'])

      expect(error.name).toBe('UnsupportedVersionError')
      expect(error.code).toBe('UNSUPPORTED_VERSION')
      expect(error.providedVersion).toBe('0.10.0')
      expect(error.supportedVersions).toContain('0.30')
    })
  })
})

// ─── Default Options Tests ───────────────────────────────────────────────────

describe('DEFAULT_CONVERSION_OPTIONS', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_CONVERSION_OPTIONS.preserveNativeMetadata).toBe(true)
    expect(DEFAULT_CONVERSION_OPTIONS.validateBeforeConversion).toBe(true)
    expect(DEFAULT_CONVERSION_OPTIONS.includeVerificationKey).toBe(true)
    expect(DEFAULT_CONVERSION_OPTIONS.targetChainId).toBe('')
    expect(typeof DEFAULT_CONVERSION_OPTIONS.idGenerator).toBe('function')
  })

  it('should generate unique IDs', () => {
    const id1 = DEFAULT_CONVERSION_OPTIONS.idGenerator()
    const id2 = DEFAULT_CONVERSION_OPTIONS.idGenerator()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^proof-\d+-[a-z0-9]+$/)
  })
})

// ─── Round-Trip Tests ────────────────────────────────────────────────────────

describe('Round-Trip Conversion', () => {
  it('should preserve Noir proof data through round-trip', () => {
    const converter = createNoirConverter()
    const original = createSampleNoirProof()

    // Convert to SIP
    const sipResult = converter.toSIP(original)
    expect(sipResult.success).toBe(true)

    // Convert back to Noir
    const nativeResult = converter.fromSIP(sipResult.result!)
    expect(nativeResult.success).toBe(true)

    // Verify data matches
    expect(nativeResult.result?.proofData).toEqual(original.proofData)
    expect(nativeResult.result?.publicInputs.length).toBe(original.publicInputs.length)
  })

  it('should preserve Halo2 proof data through round-trip', () => {
    const converter = createHalo2Converter()
    const original = createSampleHalo2Proof()

    const sipResult = converter.toSIP(original)
    expect(sipResult.success).toBe(true)

    const nativeResult = converter.fromSIP(sipResult.result!)
    expect(nativeResult.success).toBe(true)

    expect(nativeResult.result?.proofData).toEqual(original.proofData)
    expect(nativeResult.result?.k).toBe(original.k)
  })

  it('should preserve Kimchi proof data through round-trip', () => {
    const converter = createKimchiConverter()
    const original = createSampleKimchiProof()

    const sipResult = converter.toSIP(original)
    expect(sipResult.success).toBe(true)

    const nativeResult = converter.fromSIP(sipResult.result!)
    expect(nativeResult.success).toBe(true)

    expect(nativeResult.result?.proofData).toEqual(original.proofData)
  })
})
