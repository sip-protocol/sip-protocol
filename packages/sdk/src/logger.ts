/**
 * Structured Logger for SIP SDK
 *
 * Provides production-ready logging using pino with:
 * - Structured JSON output for log aggregators
 * - Configurable log levels via SIP_LOG_LEVEL
 * - Silent mode for tests (SIP_LOG_SILENT=true)
 * - Privacy-aware redaction of sensitive data
 * - Child loggers for module-specific context
 *
 * @example
 * ```typescript
 * import { logger, createLogger } from '@sip-protocol/sdk'
 *
 * // Use global logger
 * logger.info({ module: 'stealth' }, 'Generating stealth address')
 *
 * // Create module-specific logger
 * const log = createLogger('stealth')
 * log.info('Generating address')
 * log.warn({ deprecated: 'createCommitment' }, 'Function deprecated')
 * ```
 *
 * @example Environment Configuration
 * ```bash
 * SIP_LOG_LEVEL=debug    # trace, debug, info, warn, error, fatal, silent
 * SIP_LOG_SILENT=true    # Disable all logging (for tests)
 * ```
 */

import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino'

// Re-export pino types for convenience
export type { Logger as PinoLogger } from 'pino'

/**
 * Log levels supported by the SDK
 */
export type SIPLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent'

/**
 * Configuration options for the SIP logger
 */
export interface SIPLoggerConfig {
  /** Log level (default: from SIP_LOG_LEVEL env or 'info') */
  level?: SIPLogLevel
  /** Logger name (shown in logs) */
  name?: string
  /** Custom pino options */
  options?: LoggerOptions
}

/**
 * Sensitive fields that should be redacted in logs
 */
const SENSITIVE_FIELDS = new Set([
  'privateKey',
  'secretKey',
  'seed',
  'mnemonic',
  'password',
  'secret',
  'blindingFactor',
  'viewingPrivateKey',
  'spendingPrivateKey',
])

/**
 * Fields that should be partially redacted (show first/last chars)
 */
const PARTIAL_REDACT_FIELDS = new Set([
  'address',
  'publicKey',
  'pubkey',
  'from',
  'to',
  'owner',
  'sender',
  'recipient',
  'wallet',
  'signature',
  'txHash',
  'txSignature',
  'transactionHash',
  'stealthAddress',
  'ephemeralPubkey',
])

/**
 * Get the configured log level from environment
 */
function getLogLevel(): SIPLogLevel {
  // Check for silent mode first
  const silent = process.env.SIP_LOG_SILENT
  if (silent === 'true' || silent === '1') {
    return 'silent'
  }

  // Check for explicit level
  const level = process.env.SIP_LOG_LEVEL?.toLowerCase()
  const validLevels: SIPLogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']
  if (level && validLevels.includes(level as SIPLogLevel)) {
    return level as SIPLogLevel
  }

  // Default to warn in production, info otherwise
  return process.env.NODE_ENV === 'production' ? 'warn' : 'info'
}

/**
 * Check if running in test environment
 */
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    process.env.JEST_WORKER_ID !== undefined ||
    process.env.SIP_LOG_SILENT === 'true'
  )
}

/**
 * Redact a string value for logging
 */
function redactValue(value: string, chars: number = 4): string {
  if (!value || typeof value !== 'string') return '[invalid]'
  if (value.length <= chars * 2 + 3) return value
  return `${value.slice(0, chars)}...${value.slice(-chars)}`
}

/**
 * Custom serializer that redacts sensitive data
 */
function createRedactingSerializer() {
  return {
    // Redact sensitive object properties
    obj: (obj: Record<string, unknown>): Record<string, unknown> => {
      if (!obj || typeof obj !== 'object') return obj

      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase()

        // Fully redact sensitive fields
        if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(lowerKey)) {
          result[key] = '[REDACTED]'
          continue
        }

        // Partially redact address-like fields
        if (
          (PARTIAL_REDACT_FIELDS.has(key) || PARTIAL_REDACT_FIELDS.has(lowerKey)) &&
          typeof value === 'string'
        ) {
          result[key] = redactValue(value)
          continue
        }

        // Recursively handle nested objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = createRedactingSerializer().obj(value as Record<string, unknown>)
          continue
        }

        result[key] = value
      }
      return result
    },
  }
}

/**
 * Create the base pino logger instance
 */
function createBaseLogger(config: SIPLoggerConfig = {}): PinoLogger {
  const level = config.level ?? getLogLevel()

  // In test environment, always use silent unless explicitly set
  const effectiveLevel = isTestEnvironment() && !config.level ? 'silent' : level

  const options: LoggerOptions = {
    name: config.name ?? 'sip-sdk',
    level: effectiveLevel,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Timestamp in ISO format for log aggregators
    timestamp: pino.stdTimeFunctions.isoTime,
    // Custom serializers for objects
    serializers: createRedactingSerializer(),
    ...config.options,
  }

  return pino(options)
}

/**
 * Global SDK logger instance
 *
 * @example
 * ```typescript
 * import { logger } from '@sip-protocol/sdk'
 *
 * logger.info('SDK initialized')
 * logger.warn({ deprecated: 'oldFunc' }, 'Function deprecated')
 * logger.error({ err }, 'Operation failed')
 * ```
 */
export const logger = createBaseLogger()

/**
 * Create a child logger for a specific module
 *
 * Child loggers inherit the parent's configuration and add
 * a 'module' field to all log entries.
 *
 * @param module - Module name to add to all log entries
 * @param config - Optional additional configuration
 * @returns Child logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from '@sip-protocol/sdk'
 *
 * const log = createLogger('stealth')
 * log.info('Generating stealth address')
 * // Output: {"level":"info","time":"...","module":"stealth","msg":"Generating stealth address"}
 *
 * log.warn({ deprecated: 'oldFunc', replacement: 'newFunc' }, 'Function deprecated')
 * // Output: {"level":"warn","time":"...","module":"stealth","deprecated":"oldFunc","replacement":"newFunc","msg":"Function deprecated"}
 * ```
 */
export function createLogger(module: string, config?: SIPLoggerConfig): PinoLogger {
  if (config) {
    return createBaseLogger({ ...config, name: `sip-sdk:${module}` }).child({ module })
  }
  return logger.child({ module })
}

/**
 * Configure the global logger
 *
 * Note: This creates a new logger instance. Existing child loggers
 * will not be affected.
 *
 * @param config - Logger configuration options
 *
 * @example
 * ```typescript
 * import { configureLogger } from '@sip-protocol/sdk'
 *
 * // Enable debug logging
 * configureLogger({ level: 'debug' })
 *
 * // Silent mode for tests
 * configureLogger({ level: 'silent' })
 * ```
 */
export function configureLogger(config: SIPLoggerConfig): PinoLogger {
  return createBaseLogger(config)
}

/**
 * Silence all logging (useful for tests)
 *
 * @example
 * ```typescript
 * import { silenceLogger } from '@sip-protocol/sdk'
 *
 * beforeAll(() => {
 *   silenceLogger()
 * })
 * ```
 */
export function silenceLogger(): void {
  logger.level = 'silent'
}

/**
 * Set the log level at runtime
 *
 * @param level - New log level
 *
 * @example
 * ```typescript
 * import { setLogLevel } from '@sip-protocol/sdk'
 *
 * setLogLevel('debug') // Enable verbose logging
 * setLogLevel('error') // Only show errors
 * ```
 */
export function setLogLevel(level: SIPLogLevel): void {
  logger.level = level
}

/**
 * Get the current log level
 *
 * @returns Current log level
 */
export function getLogLevelName(): SIPLogLevel {
  return logger.level as SIPLogLevel
}

/**
 * Check if a specific log level is enabled
 *
 * @param level - Log level to check
 * @returns true if the level would produce output
 *
 * @example
 * ```typescript
 * import { isLevelEnabled } from '@sip-protocol/sdk'
 *
 * if (isLevelEnabled('debug')) {
 *   // Expensive debug computation
 *   const details = computeExpensiveDebugInfo()
 *   logger.debug(details, 'Debug info')
 * }
 * ```
 */
export function isLevelEnabled(level: SIPLogLevel): boolean {
  return logger.isLevelEnabled(level)
}
