/**
 * Custom errors for SIP Protocol SDK
 *
 * Provides a comprehensive error hierarchy with:
 * - Machine-readable error codes
 * - Human-readable messages
 * - Original cause preservation
 * - Additional debugging context
 * - Serialization for logging
 */

// ─── Error Codes ─────────────────────────────────────────────────────────────

/**
 * Machine-readable error codes for programmatic error handling
 */
export enum ErrorCode {
  // General errors (1xxx)
  UNKNOWN = 'SIP_1000',
  INTERNAL = 'SIP_1001',
  NOT_IMPLEMENTED = 'SIP_1002',

  // Validation errors (2xxx)
  VALIDATION_FAILED = 'SIP_2000',
  INVALID_INPUT = 'SIP_2001',
  INVALID_CHAIN = 'SIP_2002',
  INVALID_PRIVACY_LEVEL = 'SIP_2003',
  INVALID_AMOUNT = 'SIP_2004',
  INVALID_HEX = 'SIP_2005',
  INVALID_KEY = 'SIP_2006',
  INVALID_ADDRESS = 'SIP_2007',
  MISSING_REQUIRED = 'SIP_2008',
  OUT_OF_RANGE = 'SIP_2009',
  TOKEN_NOT_FOUND = 'SIP_2010',
  UNSUPPORTED_CHAIN = 'SIP_2011',

  // Cryptographic errors (3xxx)
  CRYPTO_FAILED = 'SIP_3000',
  ENCRYPTION_FAILED = 'SIP_3001',
  DECRYPTION_FAILED = 'SIP_3002',
  KEY_DERIVATION_FAILED = 'SIP_3003',
  COMMITMENT_FAILED = 'SIP_3004',
  SIGNATURE_FAILED = 'SIP_3005',
  INVALID_CURVE_POINT = 'SIP_3006',
  INVALID_SCALAR = 'SIP_3007',
  INVALID_KEY_SIZE = 'SIP_3008',
  INVALID_ENCRYPTED_DATA = 'SIP_3009',
  INVALID_COMMITMENT = 'SIP_3010',
  INVALID_TIME_LOCK = 'SIP_3011',
  INVALID_SHARE = 'SIP_3012',
  INVALID_THRESHOLD = 'SIP_3013',
  CRYPTO_OPERATION_FAILED = 'SIP_3014',
  INVALID_FORMAT = 'SIP_3015',

  // Proof errors (4xxx)
  PROOF_FAILED = 'SIP_4000',
  PROOF_GENERATION_FAILED = 'SIP_4001',
  PROOF_VERIFICATION_FAILED = 'SIP_4002',
  PROOF_NOT_IMPLEMENTED = 'SIP_4003',
  PROOF_PROVIDER_NOT_READY = 'SIP_4004',
  INVALID_PROOF_PARAMS = 'SIP_4005',

  // Intent errors (5xxx)
  INTENT_FAILED = 'SIP_5000',
  INTENT_EXPIRED = 'SIP_5001',
  INTENT_CANCELLED = 'SIP_5002',
  INTENT_NOT_FOUND = 'SIP_5003',
  INTENT_INVALID_STATE = 'SIP_5004',
  PROOFS_REQUIRED = 'SIP_5005',
  QUOTE_EXPIRED = 'SIP_5006',

  // Network errors (6xxx)
  NETWORK_FAILED = 'SIP_6000',
  NETWORK_TIMEOUT = 'SIP_6001',
  NETWORK_UNAVAILABLE = 'SIP_6002',
  RPC_ERROR = 'SIP_6003',
  API_ERROR = 'SIP_6004',
  RATE_LIMITED = 'SIP_6005',

  // Wallet errors (7xxx)
  WALLET_ERROR = 'SIP_7000',
  WALLET_NOT_CONNECTED = 'SIP_7001',
  WALLET_CONNECTION_FAILED = 'SIP_7002',
  WALLET_SIGNING_FAILED = 'SIP_7003',
  WALLET_TRANSACTION_FAILED = 'SIP_7004',

  // Security errors (8xxx)
  SECURITY_ERROR = 'SIP_8000',
  INVALID_SIGNATURE = 'SIP_8001',
  INVALID_AUTH = 'SIP_8002',
  UNAUTHORIZED = 'SIP_8003',
  RATE_LIMIT_EXCEEDED = 'SIP_8004',

  // Privacy backend errors (9xxx)
  PRIVACY_BACKEND_ERROR = 'SIP_9000',
  ARCIUM_ERROR = 'SIP_9001',
  ARCIUM_INVALID_NETWORK = 'SIP_9002',
  ARCIUM_COMPUTATION_FAILED = 'SIP_9003',
  ARCIUM_COMPUTATION_TIMEOUT = 'SIP_9004',
  ARCIUM_CLUSTER_UNAVAILABLE = 'SIP_9005',
  ARCIUM_CIRCUIT_NOT_FOUND = 'SIP_9006',
  INCO_ERROR = 'SIP_9010',
  MAGICBLOCK_ERROR = 'SIP_9020',
  SHADOWWIRE_ERROR = 'SIP_9030',
}

// ─── Serialized Error Type ───────────────────────────────────────────────────

/**
 * Serialized error format for logging and transmission
 */
export interface SerializedError {
  name: string
  code: ErrorCode
  message: string
  field?: string
  context?: Record<string, unknown>
  cause?: string
  stack?: string
  timestamp: string
}

// ─── Base Error Class ────────────────────────────────────────────────────────

/**
 * Base error class for SIP Protocol
 *
 * All SDK errors extend this class and include:
 * - `code`: Machine-readable error code for programmatic handling
 * - `cause`: Original error if this error wraps another
 * - `context`: Additional debugging information
 *
 * @example
 * ```typescript
 * try {
 *   await sip.execute(intent, quote)
 * } catch (e) {
 *   if (e instanceof SIPError) {
 *     console.log(`Error ${e.code}: ${e.message}`)
 *     if (e.cause) console.log('Caused by:', e.cause)
 *   }
 * }
 * ```
 */
export class SIPError extends Error {
  /** Machine-readable error code */
  readonly code: ErrorCode

  /** Additional debugging context */
  readonly context?: Record<string, unknown>

  /** Timestamp when error was created */
  readonly timestamp: Date

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    options?: {
      cause?: Error
      context?: Record<string, unknown>
    }
  ) {
    super(message, { cause: options?.cause })
    this.name = 'SIPError'
    this.code = code
    this.context = options?.context
    this.timestamp = new Date()

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Serialize error for logging or transmission
   */
  toJSON(): SerializedError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
      stack: this.stack,
      timestamp: this.timestamp.toISOString(),
    }
  }

  /**
   * Create a string representation for logging
   */
  toString(): string {
    let result = `[${this.code}] ${this.name}: ${this.message}`
    if (this.cause instanceof Error) {
      result += `\n  Caused by: ${this.cause.message}`
    }
    return result
  }
}

// ─── Validation Error ────────────────────────────────────────────────────────

/**
 * Error thrown when input validation fails
 *
 * Provides detailed information about what validation failed
 * and optionally which field caused the error.
 *
 * @example
 * ```typescript
 * throw new ValidationError('Amount must be positive', 'input.amount')
 *
 * // With error code
 * throw new ValidationError('Invalid chain ID', 'chain', {
 *   code: ErrorCode.INVALID_CHAIN,
 *   context: { received: 'invalid-chain' }
 * })
 * ```
 */
export class ValidationError extends SIPError {
  /** The field that failed validation (if applicable) */
  readonly field?: string

  constructor(
    message: string,
    field?: string,
    context?: Record<string, unknown>,
    code: ErrorCode = ErrorCode.VALIDATION_FAILED,
  ) {
    const fullMessage = field
      ? `Validation failed for '${field}': ${message}`
      : `Validation failed: ${message}`
    super(fullMessage, code, { context })
    this.name = 'ValidationError'
    this.field = field
  }

  toJSON(): SerializedError {
    return {
      ...super.toJSON(),
      field: this.field,
    }
  }
}

// ─── Cryptographic Error ─────────────────────────────────────────────────────

/**
 * Error thrown when cryptographic operations fail
 *
 * Covers encryption, decryption, key derivation, commitments, and signatures.
 *
 * @example
 * ```typescript
 * throw new CryptoError('Decryption failed', ErrorCode.DECRYPTION_FAILED, {
 *   cause: originalError,
 *   context: { operation: 'decryptWithViewing' }
 * })
 * ```
 */
export class CryptoError extends SIPError {
  /** The cryptographic operation that failed */
  readonly operation?: string

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CRYPTO_FAILED,
    options?: {
      cause?: Error
      context?: Record<string, unknown>
      operation?: string
    }
  ) {
    super(message, code, options)
    this.name = 'CryptoError'
    this.operation = options?.operation
  }
}

/**
 * Error thrown when encryption functions are called but not yet implemented
 *
 * @deprecated Use CryptoError with ErrorCode.NOT_IMPLEMENTED instead
 */
export class EncryptionNotImplementedError extends CryptoError {
  /** The type of encryption operation */
  readonly operationType: 'encrypt' | 'decrypt'

  /** Reference to the specification document */
  readonly specReference: string

  constructor(
    operation: 'encrypt' | 'decrypt',
    specReference: string,
  ) {
    const message = `${operation.charAt(0).toUpperCase() + operation.slice(1)}ion is not implemented. ` +
      `Real authenticated encryption (ChaCha20-Poly1305) is required. ` +
      `See specification: ${specReference}`
    super(message, ErrorCode.NOT_IMPLEMENTED, {
      context: { operation, specReference }
    })
    this.name = 'EncryptionNotImplementedError'
    this.operationType = operation
    this.specReference = specReference
  }
}

// ─── Proof Error ─────────────────────────────────────────────────────────────

/**
 * Error thrown when proof operations fail
 *
 * Covers proof generation, verification, and related operations.
 *
 * @example
 * ```typescript
 * throw new ProofError('Proof verification failed', ErrorCode.PROOF_VERIFICATION_FAILED, {
 *   context: { proofType: 'funding', publicInputs: [...] }
 * })
 * ```
 */
export class ProofError extends SIPError {
  /** The type of proof involved */
  readonly proofType?: 'funding' | 'validity' | 'fulfillment' | 'viewing'

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PROOF_FAILED,
    options?: {
      cause?: Error
      context?: Record<string, unknown>
      proofType?: 'funding' | 'validity' | 'fulfillment' | 'viewing'
    }
  ) {
    super(message, code, options)
    this.name = 'ProofError'
    this.proofType = options?.proofType
  }
}

/**
 * Error thrown when a proof function is called but not yet implemented
 *
 * This error indicates that real ZK proof generation is required but not available.
 *
 * @example
 * ```typescript
 * // Use ProofProvider for proof generation
 * const provider = new NoirProofProvider(config)
 * await provider.initialize()
 * const result = await provider.generateFundingProof(params)
 * ```
 */
export class ProofNotImplementedError extends ProofError {
  /** Reference to the specification document */
  readonly specReference: string

  constructor(
    proofType: 'funding' | 'validity' | 'fulfillment' | 'viewing',
    specReference: string,
  ) {
    const message = `${proofType.charAt(0).toUpperCase() + proofType.slice(1)} proof generation is not implemented. ` +
      `Real ZK proofs are required for production use. ` +
      `See specification: ${specReference}`
    super(message, ErrorCode.PROOF_NOT_IMPLEMENTED, {
      context: { specReference },
      proofType,
    })
    this.name = 'ProofNotImplementedError'
    this.specReference = specReference
  }
}

// ─── Intent Error ────────────────────────────────────────────────────────────

/**
 * Error thrown when intent operations fail
 *
 * Covers intent creation, execution, and lifecycle errors.
 *
 * @example
 * ```typescript
 * throw new IntentError('Intent has expired', ErrorCode.INTENT_EXPIRED, {
 *   context: { intentId, expiry, now: Date.now() }
 * })
 * ```
 */
export class IntentError extends SIPError {
  /** The intent ID involved (if available) */
  readonly intentId?: string

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTENT_FAILED,
    options?: {
      cause?: Error
      context?: Record<string, unknown>
      intentId?: string
    }
  ) {
    super(message, code, options)
    this.name = 'IntentError'
    this.intentId = options?.intentId
  }
}

// ─── Network Error ───────────────────────────────────────────────────────────

/**
 * Error thrown when external service communication fails
 *
 * Covers RPC calls, API requests, and network connectivity issues.
 *
 * @example
 * ```typescript
 * throw new NetworkError('RPC request failed', ErrorCode.RPC_ERROR, {
 *   cause: originalError,
 *   context: { endpoint: 'https://...', method: 'eth_call' }
 * })
 * ```
 */
export class NetworkError extends SIPError {
  /** The endpoint that failed (if applicable) */
  readonly endpoint?: string

  /** HTTP status code (if applicable) */
  readonly statusCode?: number

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_FAILED,
    options?: {
      cause?: Error
      context?: Record<string, unknown>
      endpoint?: string
      statusCode?: number
    }
  ) {
    super(message, code, options)
    this.name = 'NetworkError'
    this.endpoint = options?.endpoint
    this.statusCode = options?.statusCode
  }
}

// ─── Security Error ──────────────────────────────────────────────────────────

/**
 * Error thrown when security/authentication checks fail
 *
 * Used for signature verification, authorization, and rate limiting.
 *
 * @example
 * ```typescript
 * throw new SecurityError('Invalid webhook signature', 'INVALID_SIGNATURE')
 *
 * // With context
 * throw new SecurityError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', {
 *   context: { limit: 100, window: '1m' }
 * })
 * ```
 */
export class SecurityError extends SIPError {
  /** Security error type for programmatic handling */
  readonly securityType: string

  constructor(
    message: string,
    securityType: string = 'SECURITY_ERROR',
    options?: {
      cause?: Error
      context?: Record<string, unknown>
    }
  ) {
    // Map security type to error code
    let code: ErrorCode
    switch (securityType) {
      case 'INVALID_SIGNATURE':
        code = ErrorCode.INVALID_SIGNATURE
        break
      case 'INVALID_AUTH':
        code = ErrorCode.INVALID_AUTH
        break
      case 'UNAUTHORIZED':
        code = ErrorCode.UNAUTHORIZED
        break
      case 'RATE_LIMIT_EXCEEDED':
        code = ErrorCode.RATE_LIMIT_EXCEEDED
        break
      default:
        code = ErrorCode.SECURITY_ERROR
    }

    super(message, code, options)
    this.name = 'SecurityError'
    this.securityType = securityType
  }
}

// ─── Error Utilities ─────────────────────────────────────────────────────────

/**
 * Check if an error is a SIP Protocol error
 */
export function isSIPError(error: unknown): error is SIPError {
  return error instanceof SIPError
}

/**
 * Check if an error is a security error
 */
export function isSecurityError(error: unknown): error is SecurityError {
  return error instanceof SecurityError
}

/**
 * Check if an error has a specific error code
 */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
  return isSIPError(error) && error.code === code
}

/**
 * Wrap an unknown error as a SIPError
 *
 * Useful for catching and re-throwing with additional context.
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation()
 * } catch (e) {
 *   throw wrapError(e, 'Operation failed', ErrorCode.INTERNAL)
 * }
 * ```
 */
export function wrapError(
  error: unknown,
  message: string,
  code: ErrorCode = ErrorCode.INTERNAL,
  context?: Record<string, unknown>
): SIPError {
  if (error instanceof SIPError) {
    return error
  }

  const cause = error instanceof Error ? error : new Error(String(error))

  return new SIPError(message, code, { cause, context })
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
