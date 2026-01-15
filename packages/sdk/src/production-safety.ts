/**
 * Production Safety Checks
 *
 * Runtime validation to detect development-only configurations in production.
 * Prevents accidental localhost URLs, default credentials, and other dev-only
 * settings from being used in production deployments.
 *
 * @example
 * ```typescript
 * import { validateProductionConfig, isProductionEnvironment } from '@sip-protocol/sdk'
 *
 * // Check if running in production
 * if (isProductionEnvironment()) {
 *   // Validate config throws if localhost URLs detected
 *   validateProductionConfig({
 *     rpcEndpoint: process.env.RPC_ENDPOINT,
 *     apiUrl: process.env.API_URL,
 *   })
 * }
 *
 * // Or use assertNoLocalhost for individual URLs
 * const endpoint = assertNoLocalhost(
 *   process.env.RPC_ENDPOINT || 'http://localhost:8899',
 *   'RPC_ENDPOINT'
 * )
 * ```
 */

// ─── Constants ──────────────────────────────────────────────────────────────────

/**
 * Patterns that indicate localhost/development URLs
 */
const LOCALHOST_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?/i,
  /^https?:\/\/0\.0\.0\.0(:\d+)?/i,
  /^https?:\/\/\[::1\](:\d+)?/i,
  /^https?:\/\/host\.docker\.internal(:\d+)?/i,
]

/**
 * Environment variable that can override localhost safety checks
 */
const ALLOW_LOCALHOST_ENV = 'SIP_ALLOW_LOCALHOST_IN_PROD'

// ─── Environment Detection ──────────────────────────────────────────────────────

/**
 * Check if running in a production environment
 *
 * Production is detected when:
 * - NODE_ENV === 'production'
 * - SIP_ENV === 'production'
 *
 * @returns true if production environment detected
 *
 * @example
 * ```typescript
 * if (isProductionEnvironment()) {
 *   console.log('Running in production mode')
 * }
 * ```
 */
export function isProductionEnvironment(): boolean {
  if (typeof process === 'undefined' || !process.env) {
    // Browser without process - check window location
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname
      // Not localhost = likely production
      return !isLocalhostUrl(`https://${hostname}`)
    }
    return false
  }

  const nodeEnv = process.env.NODE_ENV?.toLowerCase()
  const sipEnv = process.env.SIP_ENV?.toLowerCase()

  return nodeEnv === 'production' || sipEnv === 'production'
}

/**
 * Check if localhost URLs are explicitly allowed in production
 *
 * @returns true if SIP_ALLOW_LOCALHOST_IN_PROD=true
 */
export function isLocalhostAllowed(): boolean {
  if (typeof process === 'undefined' || !process.env) {
    return false
  }
  return process.env[ALLOW_LOCALHOST_ENV] === 'true'
}

// ─── URL Validation ─────────────────────────────────────────────────────────────

/**
 * Check if a URL points to localhost
 *
 * @param url - URL to check
 * @returns true if URL is localhost
 *
 * @example
 * ```typescript
 * isLocalhostUrl('http://localhost:8899')  // true
 * isLocalhostUrl('https://api.mainnet.solana.com')  // false
 * ```
 */
export function isLocalhostUrl(url: string): boolean {
  return LOCALHOST_PATTERNS.some((pattern) => pattern.test(url))
}

/**
 * Result from validateProductionConfig
 */
export interface ProductionConfigValidationResult {
  valid: boolean
  errors: ProductionConfigError[]
  warnings: ProductionConfigWarning[]
}

/**
 * Error found during production config validation
 */
export interface ProductionConfigError {
  key: string
  value: string
  message: string
}

/**
 * Warning found during production config validation
 */
export interface ProductionConfigWarning {
  key: string
  message: string
}

/**
 * Error thrown when production validation fails
 */
export class ProductionSafetyError extends Error {
  constructor(
    message: string,
    public readonly errors: ProductionConfigError[]
  ) {
    super(message)
    this.name = 'ProductionSafetyError'
  }
}

/**
 * Validate configuration for production safety
 *
 * In production mode:
 * - Throws if any URL value contains localhost
 * - Can be bypassed with SIP_ALLOW_LOCALHOST_IN_PROD=true
 *
 * In non-production mode:
 * - Returns validation result without throwing
 * - Logs warnings for localhost URLs
 *
 * @param config - Configuration object to validate (key-value pairs)
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 * @throws ProductionSafetyError if production mode and localhost URLs found
 *
 * @example
 * ```typescript
 * // Validates all URL-like values in config
 * validateProductionConfig({
 *   rpcEndpoint: 'http://localhost:8899',  // Error in production
 *   apiUrl: 'https://api.example.com',     // OK
 *   name: 'my-app',                        // Ignored (not a URL)
 * })
 * ```
 */
export function validateProductionConfig(
  config: Record<string, unknown>,
  options: {
    /** Only validate these keys (defaults to all string values that look like URLs) */
    keys?: string[]
    /** Throw in production even if localhost allowed (for critical configs) */
    strict?: boolean
  } = {}
): ProductionConfigValidationResult {
  const isProduction = isProductionEnvironment()
  const localhostAllowed = isLocalhostAllowed()
  const errors: ProductionConfigError[] = []
  const warnings: ProductionConfigWarning[] = []

  // Determine which keys to validate
  const keysToValidate = options.keys ?? Object.keys(config)

  for (const key of keysToValidate) {
    const value = config[key]

    // Skip non-string values
    if (typeof value !== 'string') {
      continue
    }

    // Skip values that don't look like URLs
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      continue
    }

    // Check for localhost
    if (isLocalhostUrl(value)) {
      if (isProduction && !localhostAllowed) {
        errors.push({
          key,
          value: maskSensitiveUrl(value),
          message: `Localhost URL detected in production for '${key}'. Set a production URL or ${ALLOW_LOCALHOST_ENV}=true to override.`,
        })
      } else if (isProduction && localhostAllowed && options.strict) {
        errors.push({
          key,
          value: maskSensitiveUrl(value),
          message: `Localhost URL not allowed for '${key}' even with ${ALLOW_LOCALHOST_ENV}=true (strict mode).`,
        })
      } else if (isProduction) {
        warnings.push({
          key,
          message: `Using localhost URL for '${key}' in production (allowed via ${ALLOW_LOCALHOST_ENV})`,
        })
      }
    }
  }

  const result: ProductionConfigValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  }

  // Throw in production if errors found
  if (!result.valid && isProduction) {
    const errorMessages = errors.map((e) => `  - ${e.key}: ${e.message}`).join('\n')
    throw new ProductionSafetyError(
      `Production safety check failed:\n${errorMessages}`,
      errors
    )
  }

  return result
}

/**
 * Assert that a URL is not localhost in production
 *
 * Convenience function for validating individual URLs.
 *
 * @param url - URL to validate
 * @param name - Name of the config key (for error messages)
 * @returns The URL if valid
 * @throws ProductionSafetyError if localhost in production
 *
 * @example
 * ```typescript
 * // Throws in production if localhost
 * const endpoint = assertNoLocalhost(
 *   process.env.RPC_ENDPOINT || 'http://localhost:8899',
 *   'RPC_ENDPOINT'
 * )
 * ```
 */
export function assertNoLocalhost(url: string, name: string): string {
  validateProductionConfig({ [name]: url }, { keys: [name] })
  return url
}

/**
 * Get a URL with production fallback
 *
 * In production:
 * - If primary is localhost, throws error
 * - Returns primary if valid
 *
 * In development:
 * - Returns primary (even if localhost)
 *
 * @param primary - Primary URL (may be localhost in dev)
 * @param name - Name of the config key
 * @returns Valid URL for the current environment
 *
 * @example
 * ```typescript
 * const rpcEndpoint = getProductionUrl(
 *   process.env.RPC_ENDPOINT || 'http://localhost:8899',
 *   'RPC_ENDPOINT'
 * )
 * ```
 */
export function getProductionUrl(primary: string, name: string): string {
  if (isProductionEnvironment() && isLocalhostUrl(primary) && !isLocalhostAllowed()) {
    throw new ProductionSafetyError(
      `No production URL configured for '${name}'. Current value: ${maskSensitiveUrl(primary)}`,
      [{ key: name, value: maskSensitiveUrl(primary), message: 'Localhost URL in production' }]
    )
  }
  return primary
}

// ─── Utility Functions ──────────────────────────────────────────────────────────

/**
 * Mask sensitive parts of a URL for safe logging
 *
 * @param url - URL to mask
 * @returns URL with credentials and API keys masked
 */
function maskSensitiveUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // Mask credentials
    if (parsed.username || parsed.password) {
      parsed.username = '***'
      parsed.password = ''
    }

    // Mask API keys in query params
    const sensitiveParams = ['api-key', 'apikey', 'key', 'token', 'secret']
    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '***')
      }
    }

    return parsed.toString()
  } catch {
    // If URL parsing fails, return as-is (it's likely just localhost anyway)
    return url
  }
}

/**
 * Create a production-safe configuration helper
 *
 * Returns a function that validates URLs and provides defaults.
 *
 * @param defaults - Default values for non-production environments
 * @returns Configuration getter function
 *
 * @example
 * ```typescript
 * const getConfig = createProductionConfig({
 *   rpcEndpoint: 'http://localhost:8899',
 *   apiUrl: 'http://localhost:3000',
 * })
 *
 * // In dev: returns localhost
 * // In prod: throws if env vars not set
 * const rpc = getConfig('rpcEndpoint', process.env.RPC_ENDPOINT)
 * ```
 */
export function createProductionConfig<T extends Record<string, string>>(
  defaults: T
): <K extends keyof T>(key: K, envValue?: string) => string {
  return <K extends keyof T>(key: K, envValue?: string): string => {
    const value = envValue ?? defaults[key]

    if (isProductionEnvironment() && (!envValue || isLocalhostUrl(value)) && !isLocalhostAllowed()) {
      throw new ProductionSafetyError(
        `Production configuration required for '${String(key)}'. ` +
        `Set the environment variable or ${ALLOW_LOCALHOST_ENV}=true to use defaults.`,
        [{ key: String(key), value: maskSensitiveUrl(value), message: 'Missing production configuration' }]
      )
    }

    return value
  }
}
