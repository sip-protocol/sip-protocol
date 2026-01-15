/**
 * Deprecation Warning Utility
 *
 * Provides a consistent way to handle deprecation warnings that:
 * - Logs each warning only once per session (no spam)
 * - Can be suppressed via environment variable
 * - Uses consistent message format with removal date
 *
 * @module utils/deprecation
 */

import { createLogger } from '../logger'

const log = createLogger('deprecation')

/** Set of warning IDs that have already been emitted */
const warnedIds = new Set<string>()

/**
 * Check if deprecation warnings should be suppressed
 *
 * Set SIP_SUPPRESS_DEPRECATION=true to disable all warnings
 */
const isSuppressed = (): boolean => {
  // Check both process.env and global (for browser compatibility)
  if (typeof process !== 'undefined' && process.env?.SIP_SUPPRESS_DEPRECATION === 'true') {
    return true
  }
  return false
}

/**
 * Emit a deprecation warning (once per function)
 *
 * @param id - Unique identifier for this deprecation (e.g., 'createCommitment')
 * @param message - Warning message to display
 *
 * @example
 * ```typescript
 * export function oldFunction() {
 *   warnOnce('oldFunction', 'oldFunction() is deprecated. Use newFunction() instead.')
 *   // ... implementation
 * }
 * ```
 */
export function warnOnce(id: string, message: string): void {
  if (isSuppressed()) return
  if (warnedIds.has(id)) return

  warnedIds.add(id)
  log.warn({ deprecationId: id }, message)
}

/**
 * Create a standard deprecation message
 *
 * @param funcName - Name of the deprecated function
 * @param replacement - Name of the replacement function/module
 * @param removalDate - Date when the function will be removed (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * warnOnce('createCommitment', deprecationMessage(
 *   'createCommitment()',
 *   'commit() from "./commitment"',
 *   '2026-06-01'
 * ))
 * ```
 */
export function deprecationMessage(
  funcName: string,
  replacement: string,
  removalDate: string = '2026-06-01'
): string {
  return `${funcName} is deprecated and will be removed after ${removalDate}. Use ${replacement} instead.`
}

/**
 * Reset warning state (for testing only)
 *
 * @internal
 */
export function _resetWarnings(): void {
  warnedIds.clear()
}

/**
 * Check if a warning has been emitted (for testing only)
 *
 * @internal
 */
export function _hasWarned(id: string): boolean {
  return warnedIds.has(id)
}
