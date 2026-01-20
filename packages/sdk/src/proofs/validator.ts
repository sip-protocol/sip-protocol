/**
 * Cross-System Proof Validation
 *
 * Implements validation logic that ensures proofs from different ZK systems
 * can be correctly composed together. This includes validating input/output
 * compatibility, field consistency, and proof linkage integrity.
 *
 * Key features:
 * - Field element compatibility validation
 * - Public input/output type matching
 * - Proof commitment linkage verification
 * - Curve compatibility validation
 * - Semantic validation (proof meaning consistency)
 * - Detailed validation error reports
 *
 * @packageDocumentation
 */

import type {
  ProofSystem,
  SingleProof,
  ComposedProof,
  HexString,
} from '@sip-protocol/types'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Elliptic curve used by a proof system
 */
export type EllipticCurve =
  | 'bn254'       // Used by Noir (default), Groth16
  | 'bls12-381'   // Used by some Plonk implementations
  | 'pallas'      // Part of Pasta curves (Halo2, Kimchi)
  | 'vesta'       // Part of Pasta curves (Halo2, Kimchi)
  | 'secp256k1'   // Bitcoin curve (rarely used for ZK)
  | 'ed25519'     // Edwards curve

/**
 * Field characteristics for a proof system
 */
export interface FieldCharacteristics {
  /** Field modulus (prime p) */
  modulus: bigint
  /** Scalar field size */
  scalarFieldSize: number
  /** Base field size */
  baseFieldSize: number
  /** Whether the field is a prime field */
  isPrimeField: boolean
}

/**
 * System compatibility information
 */
export interface SystemInfo {
  /** Proof system identifier */
  system: ProofSystem
  /** Primary curve used */
  primaryCurve: EllipticCurve
  /** Secondary curve (for cycle of curves) */
  secondaryCurve?: EllipticCurve
  /** Field characteristics */
  field: FieldCharacteristics
  /** Whether system supports recursion */
  supportsRecursion: boolean
  /** Whether system supports IVC (incremental verifiable computation) */
  supportsIVC: boolean
}

/**
 * Validation result for a single check
 */
export interface ValidationCheck {
  /** Check identifier */
  checkId: string
  /** Human-readable check name */
  name: string
  /** Whether check passed */
  passed: boolean
  /** Severity if failed */
  severity: 'error' | 'warning' | 'info'
  /** Detailed message */
  message: string
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Comprehensive validation report
 */
export interface ValidationReport {
  /** Overall validation result */
  valid: boolean
  /** List of checks performed */
  checks: ValidationCheck[]
  /** Number of errors */
  errorCount: number
  /** Number of warnings */
  warningCount: number
  /** Total validation time (ms) */
  validationTimeMs: number
  /** Proofs validated */
  proofsValidated: number
  /** Systems involved */
  systemsInvolved: ProofSystem[]
  /** Compatibility matrix */
  compatibilityMatrix?: CompatibilityEntry[][]
  /** Recommendations for composition */
  recommendations: string[]
}

/**
 * Entry in compatibility matrix
 */
export interface CompatibilityEntry {
  /** Source system */
  sourceSystem: ProofSystem
  /** Target system */
  targetSystem: ProofSystem
  /** Whether systems are compatible */
  compatible: boolean
  /** Compatibility level */
  level: 'full' | 'partial' | 'none'
  /** Required conversions */
  requiredConversions: string[]
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Skip field compatibility check */
  skipFieldCheck?: boolean
  /** Skip curve compatibility check */
  skipCurveCheck?: boolean
  /** Skip input/output matching */
  skipInputOutputCheck?: boolean
  /** Skip linkage verification */
  skipLinkageCheck?: boolean
  /** Strict mode - fail on warnings */
  strictMode?: boolean
  /** Custom system info overrides */
  systemOverrides?: Partial<Record<ProofSystem, Partial<SystemInfo>>>
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * BN254 field modulus (used by Noir)
 */
const BN254_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')

/**
 * Pallas field modulus (used by Halo2, Kimchi)
 */
const PALLAS_MODULUS = BigInt('28948022309329048855892746252171976963363056481941560715954676764349967630337')

/**
 * Vesta field modulus (used by Halo2, Kimchi)
 */
const VESTA_MODULUS = BigInt('28948022309329048855892746252171976963363056481941647379679742748393362948097')

/**
 * BLS12-381 scalar field modulus
 */
const BLS12_381_MODULUS = BigInt('52435875175126190479447740508185965837690552500527637822603658699938581184513')

/**
 * Default system information for known proof systems
 */
export const SYSTEM_INFO: Record<ProofSystem, SystemInfo> = {
  noir: {
    system: 'noir',
    primaryCurve: 'bn254',
    field: {
      modulus: BN254_MODULUS,
      scalarFieldSize: 254,
      baseFieldSize: 254,
      isPrimeField: true,
    },
    supportsRecursion: true,
    supportsIVC: false,
  },
  halo2: {
    system: 'halo2',
    primaryCurve: 'pallas',
    secondaryCurve: 'vesta',
    field: {
      modulus: PALLAS_MODULUS,
      scalarFieldSize: 255,
      baseFieldSize: 255,
      isPrimeField: true,
    },
    supportsRecursion: true,
    supportsIVC: true,
  },
  kimchi: {
    system: 'kimchi',
    primaryCurve: 'pallas',
    secondaryCurve: 'vesta',
    field: {
      modulus: PALLAS_MODULUS,
      scalarFieldSize: 255,
      baseFieldSize: 255,
      isPrimeField: true,
    },
    supportsRecursion: true,
    supportsIVC: true,
  },
  groth16: {
    system: 'groth16',
    primaryCurve: 'bn254',
    field: {
      modulus: BN254_MODULUS,
      scalarFieldSize: 254,
      baseFieldSize: 254,
      isPrimeField: true,
    },
    supportsRecursion: false,
    supportsIVC: false,
  },
  plonk: {
    system: 'plonk',
    primaryCurve: 'bls12-381',
    field: {
      modulus: BLS12_381_MODULUS,
      scalarFieldSize: 255,
      baseFieldSize: 381,
      isPrimeField: true,
    },
    supportsRecursion: true,
    supportsIVC: false,
  },
}

/**
 * Curve family groupings for compatibility
 */
const CURVE_FAMILIES: Record<string, EllipticCurve[]> = {
  pasta: ['pallas', 'vesta'],
  bn: ['bn254'],
  bls: ['bls12-381'],
}

// ─── Cross-System Validator ──────────────────────────────────────────────────

/**
 * CrossSystemValidator
 *
 * Validates that proofs from different ZK systems can be correctly
 * composed together.
 *
 * @example
 * ```typescript
 * const validator = new CrossSystemValidator()
 *
 * const report = validator.validate([noirProof, halo2Proof])
 *
 * if (!report.valid) {
 *   console.log('Validation errors:', report.checks.filter(c => !c.passed))
 * }
 * ```
 */
export class CrossSystemValidator {
  private _options: ValidationOptions
  private _systemInfo: Record<ProofSystem, SystemInfo>

  constructor(options: ValidationOptions = {}) {
    this._options = options
    this._systemInfo = { ...SYSTEM_INFO }

    // Apply any overrides
    if (options.systemOverrides) {
      for (const [system, override] of Object.entries(options.systemOverrides)) {
        const systemKey = system as ProofSystem
        if (this._systemInfo[systemKey]) {
          this._systemInfo[systemKey] = {
            ...this._systemInfo[systemKey],
            ...override,
          }
        }
      }
    }
  }

  // ─── Main Validation ─────────────────────────────────────────────────────

  /**
   * Validate proofs for cross-system composition
   */
  validate(proofs: SingleProof[], options?: ValidationOptions): ValidationReport {
    const startTime = Date.now()
    const opts = { ...this._options, ...options }
    const checks: ValidationCheck[] = []
    const systems = new Set<ProofSystem>()

    // Collect systems involved
    for (const proof of proofs) {
      systems.add(proof.metadata.system)
    }

    const systemsArray = Array.from(systems)

    // Perform validation checks
    if (!opts.skipFieldCheck) {
      checks.push(...this.validateFieldCompatibility(proofs))
    }

    if (!opts.skipCurveCheck) {
      checks.push(...this.validateCurveCompatibility(systemsArray))
    }

    if (!opts.skipInputOutputCheck) {
      checks.push(...this.validateInputOutputMatching(proofs))
    }

    if (!opts.skipLinkageCheck) {
      checks.push(...this.validateLinkageIntegrity(proofs))
    }

    // Add semantic validation
    checks.push(...this.validateSemanticConsistency(proofs))

    // Count errors and warnings
    const errorCount = checks.filter(c => !c.passed && c.severity === 'error').length
    const warningCount = checks.filter(c => !c.passed && c.severity === 'warning').length

    // Determine overall validity
    const valid = opts.strictMode
      ? errorCount === 0 && warningCount === 0
      : errorCount === 0

    // Build compatibility matrix
    const compatibilityMatrix = this.buildCompatibilityMatrix(systemsArray)

    // Generate recommendations
    const recommendations = this.generateRecommendations(proofs, checks)

    return {
      valid,
      checks,
      errorCount,
      warningCount,
      validationTimeMs: Date.now() - startTime,
      proofsValidated: proofs.length,
      systemsInvolved: systemsArray,
      compatibilityMatrix,
      recommendations,
    }
  }

  /**
   * Validate a composed proof
   */
  validateComposed(composedProof: ComposedProof, options?: ValidationOptions): ValidationReport {
    return this.validate(composedProof.proofs, options)
  }

  /**
   * Quick check if two systems are compatible
   */
  areSystemsCompatible(system1: ProofSystem, system2: ProofSystem): boolean {
    const info1 = this._systemInfo[system1]
    const info2 = this._systemInfo[system2]

    if (!info1 || !info2) return false

    // Same system is always compatible
    if (system1 === system2) return true

    // Check curve family compatibility
    const family1 = this.getCurveFamily(info1.primaryCurve)
    const family2 = this.getCurveFamily(info2.primaryCurve)

    return family1 === family2
  }

  /**
   * Get system information
   */
  getSystemInfo(system: ProofSystem): SystemInfo | undefined {
    return this._systemInfo[system]
  }

  // ─── Field Validation ────────────────────────────────────────────────────

  private validateFieldCompatibility(proofs: SingleProof[]): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    // Group proofs by system
    const proofsBySystem = new Map<ProofSystem, SingleProof[]>()
    for (const proof of proofs) {
      const system = proof.metadata.system
      const existing = proofsBySystem.get(system) || []
      existing.push(proof)
      proofsBySystem.set(system, existing)
    }

    // Validate field sizes between different systems
    const systems = Array.from(proofsBySystem.keys())
    for (let i = 0; i < systems.length; i++) {
      for (let j = i + 1; j < systems.length; j++) {
        const system1 = systems[i]
        const system2 = systems[j]
        const info1 = this._systemInfo[system1]
        const info2 = this._systemInfo[system2]

        if (!info1 || !info2) continue

        // Check if field sizes are compatible
        const sizeDiff = Math.abs(info1.field.scalarFieldSize - info2.field.scalarFieldSize)
        const passed = sizeDiff <= 1 // Allow 1-bit difference

        checks.push({
          checkId: `field-size-${system1}-${system2}`,
          name: `Field Size Compatibility: ${system1} <-> ${system2}`,
          passed,
          severity: passed ? 'info' : 'warning',
          message: passed
            ? `Field sizes are compatible (${info1.field.scalarFieldSize} vs ${info2.field.scalarFieldSize} bits)`
            : `Field size mismatch: ${system1} uses ${info1.field.scalarFieldSize}-bit field, ${system2} uses ${info2.field.scalarFieldSize}-bit field`,
          context: {
            system1FieldSize: info1.field.scalarFieldSize,
            system2FieldSize: info2.field.scalarFieldSize,
          },
        })

        // Check modulus compatibility
        const modulusCompatible = info1.field.modulus === info2.field.modulus

        checks.push({
          checkId: `field-modulus-${system1}-${system2}`,
          name: `Field Modulus Compatibility: ${system1} <-> ${system2}`,
          passed: modulusCompatible,
          severity: modulusCompatible ? 'info' : 'warning',
          message: modulusCompatible
            ? 'Fields use the same modulus'
            : `Different field moduli - may require value conversion`,
          context: {
            sameModulus: modulusCompatible,
          },
        })
      }
    }

    return checks
  }

  // ─── Curve Validation ────────────────────────────────────────────────────

  private validateCurveCompatibility(systems: ProofSystem[]): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    // Build curve family map
    const familyCount = new Map<string, ProofSystem[]>()
    for (const system of systems) {
      const info = this._systemInfo[system]
      if (!info) continue

      const family = this.getCurveFamily(info.primaryCurve)
      const existing = familyCount.get(family) || []
      existing.push(system)
      familyCount.set(family, existing)
    }

    // Check if all systems use curves from the same family
    const families = Array.from(familyCount.keys())
    const allSameFamily = families.length === 1

    checks.push({
      checkId: 'curve-family-check',
      name: 'Curve Family Consistency',
      passed: allSameFamily,
      severity: allSameFamily ? 'info' : 'error',
      message: allSameFamily
        ? `All systems use ${families[0]} curve family`
        : `Multiple curve families detected: ${families.join(', ')}. Cross-family composition requires special handling.`,
      context: {
        families: Object.fromEntries(familyCount),
      },
    })

    // For each pair, check direct curve compatibility
    for (let i = 0; i < systems.length; i++) {
      for (let j = i + 1; j < systems.length; j++) {
        const system1 = systems[i]
        const system2 = systems[j]
        const info1 = this._systemInfo[system1]
        const info2 = this._systemInfo[system2]

        if (!info1 || !info2) continue

        const sameCurve = info1.primaryCurve === info2.primaryCurve
        const cycleCompatible = this.areCycleCompatible(info1, info2)

        checks.push({
          checkId: `curve-compat-${system1}-${system2}`,
          name: `Curve Compatibility: ${system1} <-> ${system2}`,
          passed: sameCurve || cycleCompatible,
          severity: sameCurve || cycleCompatible ? 'info' : 'warning',
          message: sameCurve
            ? `Both use ${info1.primaryCurve} curve`
            : cycleCompatible
              ? `Compatible via Pasta cycle (${info1.primaryCurve}/${info2.primaryCurve})`
              : `Different curves: ${info1.primaryCurve} vs ${info2.primaryCurve}`,
          context: {
            curve1: info1.primaryCurve,
            curve2: info2.primaryCurve,
            sameCurve,
            cycleCompatible,
          },
        })
      }
    }

    return checks
  }

  private getCurveFamily(curve: EllipticCurve): string {
    for (const [family, curves] of Object.entries(CURVE_FAMILIES)) {
      if (curves.includes(curve)) {
        return family
      }
    }
    return 'unknown'
  }

  private areCycleCompatible(info1: SystemInfo, info2: SystemInfo): boolean {
    // Pasta curves form a cycle (Pallas/Vesta)
    const pastaCurves: EllipticCurve[] = ['pallas', 'vesta']
    const info1IsPasta = pastaCurves.includes(info1.primaryCurve) ||
      Boolean(info1.secondaryCurve && pastaCurves.includes(info1.secondaryCurve))
    const info2IsPasta = pastaCurves.includes(info2.primaryCurve) ||
      Boolean(info2.secondaryCurve && pastaCurves.includes(info2.secondaryCurve))

    return info1IsPasta && info2IsPasta
  }

  // ─── Input/Output Validation ─────────────────────────────────────────────

  private validateInputOutputMatching(proofs: SingleProof[]): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    // Check if public inputs are properly formatted
    for (const proof of proofs) {
      const hasValidInputs = proof.publicInputs.every(input =>
        typeof input === 'string' && input.startsWith('0x')
      )

      checks.push({
        checkId: `input-format-${proof.id}`,
        name: `Public Input Format: ${proof.id}`,
        passed: hasValidInputs,
        severity: hasValidInputs ? 'info' : 'error',
        message: hasValidInputs
          ? `All ${proof.publicInputs.length} public inputs are properly formatted`
          : 'Some public inputs are not in valid hex format',
        context: {
          proofId: proof.id,
          inputCount: proof.publicInputs.length,
        },
      })
    }

    // Check for input/output linkage between sequential proofs
    for (let i = 0; i < proofs.length - 1; i++) {
      const current = proofs[i]
      const next = proofs[i + 1]

      // Check if proofs have overlapping public inputs (suggesting linkage)
      const currentInputsSet = new Set(current.publicInputs)
      const hasOverlap = next.publicInputs.some(input => currentInputsSet.has(input))

      checks.push({
        checkId: `input-linkage-${current.id}-${next.id}`,
        name: `Input Linkage: ${current.id} -> ${next.id}`,
        passed: true, // This is informational
        severity: 'info',
        message: hasOverlap
          ? 'Proofs share common public inputs (linked)'
          : 'Proofs have independent public inputs',
        context: {
          sourceProofId: current.id,
          targetProofId: next.id,
          hasOverlap,
        },
      })
    }

    return checks
  }

  // ─── Linkage Validation ──────────────────────────────────────────────────

  private validateLinkageIntegrity(proofs: SingleProof[]): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    // Check proof chain integrity
    for (let i = 1; i < proofs.length; i++) {
      const prevProof = proofs[i - 1]
      const currProof = proofs[i]
      const currWithLink = currProof as SingleProof & { linkHash?: HexString }

      if (currWithLink.linkHash) {
        // Verify the link hash
        const expectedHash = this.computeLinkHash(prevProof, currProof)
        const linkValid = expectedHash === currWithLink.linkHash

        checks.push({
          checkId: `link-integrity-${currProof.id}`,
          name: `Link Integrity: ${prevProof.id} -> ${currProof.id}`,
          passed: linkValid,
          severity: linkValid ? 'info' : 'error',
          message: linkValid
            ? 'Proof linkage hash verified'
            : 'Proof linkage hash mismatch - chain integrity compromised',
          context: {
            expectedHash,
            actualHash: currWithLink.linkHash,
          },
        })
      }
    }

    // Check timestamp ordering
    let timestampOrdered = true
    for (let i = 1; i < proofs.length; i++) {
      if (proofs[i].metadata.generatedAt < proofs[i - 1].metadata.generatedAt) {
        timestampOrdered = false
        break
      }
    }

    checks.push({
      checkId: 'timestamp-ordering',
      name: 'Proof Timestamp Ordering',
      passed: timestampOrdered,
      severity: timestampOrdered ? 'info' : 'warning',
      message: timestampOrdered
        ? 'Proofs are correctly ordered by generation time'
        : 'Proofs are not in chronological order - may indicate incorrect composition',
    })

    return checks
  }

  private computeLinkHash(sourceProof: SingleProof, targetProof: SingleProof): HexString {
    const combinedData = sourceProof.proof + targetProof.proof
    let hash = 0
    for (let i = 0; i < combinedData.length; i++) {
      const char = combinedData.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}` as HexString
  }

  // ─── Semantic Validation ─────────────────────────────────────────────────

  private validateSemanticConsistency(proofs: SingleProof[]): ValidationCheck[] {
    const checks: ValidationCheck[] = []

    // Check circuit ID consistency within same-system proofs
    const circuitsBySystem = new Map<ProofSystem, Set<string>>()
    for (const proof of proofs) {
      const system = proof.metadata.system
      const existing = circuitsBySystem.get(system) || new Set()
      existing.add(proof.metadata.circuitId)
      circuitsBySystem.set(system, existing)
    }

    for (const [system, circuits] of circuitsBySystem) {
      checks.push({
        checkId: `circuit-diversity-${system}`,
        name: `Circuit Diversity: ${system}`,
        passed: true, // Informational
        severity: 'info',
        message: `${system} proofs use ${circuits.size} distinct circuit(s): ${Array.from(circuits).join(', ')}`,
        context: {
          system,
          circuitCount: circuits.size,
          circuits: Array.from(circuits),
        },
      })
    }

    // Check for expired proofs
    const now = Date.now()
    for (const proof of proofs) {
      const expiresAt = proof.metadata.expiresAt
      if (expiresAt) {
        const expired = expiresAt < now

        checks.push({
          checkId: `proof-expiry-${proof.id}`,
          name: `Proof Expiry: ${proof.id}`,
          passed: !expired,
          severity: expired ? 'error' : 'info',
          message: expired
            ? `Proof expired at ${new Date(expiresAt).toISOString()}`
            : expiresAt
              ? `Proof valid until ${new Date(expiresAt).toISOString()}`
              : 'Proof has no expiry',
          context: {
            proofId: proof.id,
            expiresAt,
            expired,
          },
        })
      }
    }

    // Check proof size consistency
    const proofSizes = proofs.map(p => p.metadata.proofSizeBytes)
    const avgSize = proofSizes.reduce((a, b) => a + b, 0) / proofSizes.length
    const maxDeviation = Math.max(...proofSizes.map(s => Math.abs(s - avgSize)))
    const sizeConsistent = maxDeviation < avgSize * 2 // Within 200% of average

    checks.push({
      checkId: 'proof-size-consistency',
      name: 'Proof Size Consistency',
      passed: sizeConsistent,
      severity: sizeConsistent ? 'info' : 'warning',
      message: sizeConsistent
        ? `Proof sizes are consistent (avg: ${Math.round(avgSize)} bytes)`
        : `High proof size variance detected (avg: ${Math.round(avgSize)}, max deviation: ${Math.round(maxDeviation)})`,
      context: {
        averageSize: Math.round(avgSize),
        maxDeviation: Math.round(maxDeviation),
        sizes: proofSizes,
      },
    })

    return checks
  }

  // ─── Compatibility Matrix ────────────────────────────────────────────────

  private buildCompatibilityMatrix(systems: ProofSystem[]): CompatibilityEntry[][] {
    const matrix: CompatibilityEntry[][] = []

    for (const source of systems) {
      const row: CompatibilityEntry[] = []
      for (const target of systems) {
        row.push(this.getCompatibilityEntry(source, target))
      }
      matrix.push(row)
    }

    return matrix
  }

  private getCompatibilityEntry(source: ProofSystem, target: ProofSystem): CompatibilityEntry {
    const sourceInfo = this._systemInfo[source]
    const targetInfo = this._systemInfo[target]

    if (!sourceInfo || !targetInfo) {
      return {
        sourceSystem: source,
        targetSystem: target,
        compatible: false,
        level: 'none',
        requiredConversions: ['unknown-system'],
      }
    }

    // Same system - full compatibility
    if (source === target) {
      return {
        sourceSystem: source,
        targetSystem: target,
        compatible: true,
        level: 'full',
        requiredConversions: [],
      }
    }

    // Check curve family
    const sourceFamily = this.getCurveFamily(sourceInfo.primaryCurve)
    const targetFamily = this.getCurveFamily(targetInfo.primaryCurve)

    if (sourceFamily === targetFamily) {
      // Same curve family - partial compatibility
      return {
        sourceSystem: source,
        targetSystem: target,
        compatible: true,
        level: 'partial',
        requiredConversions: ['format-conversion'],
      }
    }

    // Different curve families - requires field conversion
    return {
      sourceSystem: source,
      targetSystem: target,
      compatible: true,
      level: 'partial',
      requiredConversions: ['field-conversion', 'format-conversion'],
    }
  }

  // ─── Recommendations ─────────────────────────────────────────────────────

  private generateRecommendations(proofs: SingleProof[], checks: ValidationCheck[]): string[] {
    const recommendations: string[] = []

    // Check for curve incompatibilities
    const curveErrors = checks.filter(c =>
      c.checkId.startsWith('curve-') && !c.passed
    )
    if (curveErrors.length > 0) {
      recommendations.push(
        'Consider using proof systems from the same curve family (e.g., Halo2 + Kimchi for Pasta curves, or Noir + Groth16 for BN254)'
      )
    }

    // Check for field mismatches
    const fieldWarnings = checks.filter(c =>
      c.checkId.startsWith('field-') && !c.passed
    )
    if (fieldWarnings.length > 0) {
      recommendations.push(
        'Field element values may need conversion when composing proofs from different systems'
      )
    }

    // Check for expired proofs
    const expiredProofs = checks.filter(c =>
      c.checkId.startsWith('proof-expiry-') && !c.passed
    )
    if (expiredProofs.length > 0) {
      recommendations.push(
        'Regenerate expired proofs before composition'
      )
    }

    // Suggest batching for same-system proofs
    const proofsBySystem = new Map<ProofSystem, number>()
    for (const proof of proofs) {
      const count = proofsBySystem.get(proof.metadata.system) || 0
      proofsBySystem.set(proof.metadata.system, count + 1)
    }

    for (const [system, count] of proofsBySystem) {
      if (count > 2) {
        const info = this._systemInfo[system]
        if (info?.supportsRecursion) {
          recommendations.push(
            `Consider using recursive aggregation for the ${count} ${system} proofs`
          )
        }
      }
    }

    // General optimization suggestion
    if (proofs.length > 5) {
      recommendations.push(
        'For large compositions, consider using parallel verification to improve performance'
      )
    }

    return recommendations
  }
}

// ─── Factory Function ────────────────────────────────────────────────────────

/**
 * Create a cross-system validator with optional configuration
 */
export function createCrossSystemValidator(
  options?: ValidationOptions
): CrossSystemValidator {
  return new CrossSystemValidator(options)
}

// ─── Export Constants ────────────────────────────────────────────────────────

export { BN254_MODULUS, PALLAS_MODULUS, VESTA_MODULUS, BLS12_381_MODULUS }
