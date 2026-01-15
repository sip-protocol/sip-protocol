/**
 * Secure Key Storage for React Native
 *
 * Provides secure storage for private keys using native platform capabilities:
 * - iOS: Keychain with biometric protection
 * - Android: Keystore with biometric protection
 *
 * Falls back to in-memory storage if react-native-keychain is not available.
 *
 * @example
 * ```typescript
 * import { SecureStorage } from '@sip-protocol/react-native'
 *
 * // Store viewing key
 * await SecureStorage.setViewingKey('my-wallet', viewingPrivateKey)
 *
 * // Retrieve with biometric prompt
 * const key = await SecureStorage.getViewingKey('my-wallet')
 *
 * // Clear on logout
 * await SecureStorage.clearAll()
 * ```
 */

/**
 * Storage options for secure key storage
 */
export interface SecureStorageOptions {
  /** Key identifier/service name */
  service?: string
  /** Require biometric authentication to access */
  requireBiometrics?: boolean
  /** iOS: Accessibility level */
  accessible?: 'whenUnlocked' | 'afterFirstUnlock' | 'always'
  /** Storage backend to use */
  backend?: 'keychain' | 'memory'
}

/**
 * Default service name for SIP keys
 */
const DEFAULT_SERVICE = 'com.sip-protocol.keys'

/**
 * Key prefixes for different key types
 */
const KEY_PREFIXES = {
  spending: 'sip:spending:',
  viewing: 'sip:viewing:',
  ephemeral: 'sip:ephemeral:',
  meta: 'sip:meta:',
} as const

type KeyType = keyof typeof KEY_PREFIXES

/**
 * In-memory fallback storage (for testing or when keychain unavailable)
 */
const memoryStorage = new Map<string, string>()

/**
 * Keychain module interface (subset of react-native-keychain)
 * Defined locally to avoid requiring type declarations at build time
 */
interface KeychainModule {
  ACCESSIBLE: {
    WHEN_UNLOCKED: number
    AFTER_FIRST_UNLOCK: number
    ALWAYS: number
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: number
  }
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: number
  }
  AUTHENTICATION_TYPE: {
    BIOMETRICS: number
  }
  setGenericPassword(
    username: string,
    password: string,
    options?: {
      service?: string
      accessible?: number
      accessControl?: number
      authenticationType?: number
    }
  ): Promise<boolean | { service: string; storage: string }>
  getGenericPassword(options?: {
    service?: string
    authenticationPrompt?: {
      title: string
      subtitle?: string
      description?: string
      cancel?: string
    }
  }): Promise<false | { username: string; password: string; service: string; storage: string }>
  resetGenericPassword(options?: { service?: string }): Promise<boolean>
  getSupportedBiometryType(): Promise<string | null>
}

/**
 * Check if react-native-keychain is available
 */
let Keychain: KeychainModule | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  Keychain = require('react-native-keychain') as KeychainModule
} catch {
  // Keychain not available, will use memory fallback
}

/**
 * Get the appropriate storage backend
 */
function getBackend(options?: SecureStorageOptions): 'keychain' | 'memory' {
  if (options?.backend) {
    return options.backend
  }
  return Keychain ? 'keychain' : 'memory'
}

/**
 * Build the full key name for storage
 */
function buildKeyName(type: KeyType, identifier: string): string {
  return `${KEY_PREFIXES[type]}${identifier}`
}

/**
 * Store a key securely
 *
 * @param type - Type of key (spending, viewing, ephemeral, meta)
 * @param identifier - Unique identifier (e.g., wallet address)
 * @param value - Key value (hex string)
 * @param options - Storage options
 */
async function setKey(
  type: KeyType,
  identifier: string,
  value: string,
  options?: SecureStorageOptions
): Promise<boolean> {
  const keyName = buildKeyName(type, identifier)
  const backend = getBackend(options)

  if (backend === 'memory') {
    memoryStorage.set(keyName, value)
    return true
  }

  if (!Keychain) {
    throw new Error(
      'react-native-keychain is required for secure storage. ' +
      'Install it or use backend: "memory" for testing.'
    )
  }

  const service = options?.service ?? DEFAULT_SERVICE

  // Build keychain options
  const keychainOptions: {
    service?: string
    accessible?: number
    accessControl?: number
    authenticationType?: number
  } = {
    service,
    accessible: mapAccessible(options?.accessible),
  }

  // Add biometric authentication if requested
  if (options?.requireBiometrics) {
    keychainOptions.accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET
    keychainOptions.authenticationType =
      Keychain.AUTHENTICATION_TYPE.BIOMETRICS
  }

  const result = await Keychain.setGenericPassword(
    keyName,
    value,
    keychainOptions
  )

  return !!result
}

/**
 * Retrieve a key from secure storage
 *
 * @param type - Type of key (spending, viewing, ephemeral, meta)
 * @param identifier - Unique identifier (e.g., wallet address)
 * @param options - Storage options
 * @returns Key value or null if not found
 */
async function getKey(
  type: KeyType,
  identifier: string,
  options?: SecureStorageOptions
): Promise<string | null> {
  const keyName = buildKeyName(type, identifier)
  const backend = getBackend(options)

  if (backend === 'memory') {
    return memoryStorage.get(keyName) ?? null
  }

  if (!Keychain) {
    throw new Error(
      'react-native-keychain is required for secure storage. ' +
      'Install it or use backend: "memory" for testing.'
    )
  }

  const service = options?.service ?? DEFAULT_SERVICE

  const keychainOptions: {
    service?: string
    authenticationPrompt?: {
      title: string
      subtitle?: string
      description?: string
      cancel?: string
    }
  } = {
    service,
  }

  // Add biometric prompt if required
  if (options?.requireBiometrics) {
    keychainOptions.authenticationPrompt = {
      title: 'Authenticate to access key',
      subtitle: 'SIP Protocol requires authentication',
      description: 'Use biometrics to unlock your private keys',
      cancel: 'Cancel',
    }
  }

  const result = await Keychain.getGenericPassword(keychainOptions)

  if (!result) {
    return null
  }

  // Verify we got the right key
  if (result.username !== keyName) {
    return null
  }

  return result.password
}

/**
 * Delete a key from secure storage
 *
 * @param type - Type of key (spending, viewing, ephemeral, meta)
 * @param identifier - Unique identifier (e.g., wallet address)
 * @param options - Storage options
 */
async function deleteKey(
  type: KeyType,
  identifier: string,
  options?: SecureStorageOptions
): Promise<boolean> {
  const keyName = buildKeyName(type, identifier)
  const backend = getBackend(options)

  if (backend === 'memory') {
    return memoryStorage.delete(keyName)
  }

  if (!Keychain) {
    throw new Error('react-native-keychain is required for secure storage.')
  }

  const service = options?.service ?? DEFAULT_SERVICE

  return await Keychain.resetGenericPassword({ service })
}

/**
 * Clear all stored keys
 *
 * @param options - Storage options
 */
async function clearAll(options?: SecureStorageOptions): Promise<boolean> {
  const backend = getBackend(options)

  if (backend === 'memory') {
    memoryStorage.clear()
    return true
  }

  if (!Keychain) {
    throw new Error('react-native-keychain is required for secure storage.')
  }

  const service = options?.service ?? DEFAULT_SERVICE

  return await Keychain.resetGenericPassword({ service })
}

/**
 * Map our accessibility levels to keychain constants
 */
function mapAccessible(
  level?: 'whenUnlocked' | 'afterFirstUnlock' | 'always'
): number | undefined {
  if (!Keychain) return undefined

  switch (level) {
    case 'whenUnlocked':
      return Keychain.ACCESSIBLE.WHEN_UNLOCKED
    case 'afterFirstUnlock':
      return Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK
    case 'always':
      return Keychain.ACCESSIBLE.ALWAYS
    default:
      return Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  }
}

/**
 * Check if biometrics are available on this device
 *
 * @returns Biometrics support info
 */
async function getSupportedBiometrics(): Promise<{
  available: boolean
  biometryType: 'FaceID' | 'TouchID' | 'Fingerprint' | 'None'
}> {
  if (!Keychain) {
    return { available: false, biometryType: 'None' }
  }

  const biometryType = await Keychain.getSupportedBiometryType()

  if (!biometryType) {
    return { available: false, biometryType: 'None' }
  }

  return {
    available: true,
    biometryType: biometryType as 'FaceID' | 'TouchID' | 'Fingerprint',
  }
}

/**
 * Check if secure storage is available
 */
function isAvailable(): boolean {
  return !!Keychain
}

/**
 * SecureStorage API
 *
 * Unified API for secure key storage on mobile devices.
 */
export const SecureStorage = {
  // Key operations
  setKey,
  getKey,
  deleteKey,
  clearAll,

  // Convenience methods for viewing keys
  setViewingKey: (identifier: string, key: string, options?: SecureStorageOptions) =>
    setKey('viewing', identifier, key, options),
  getViewingKey: (identifier: string, options?: SecureStorageOptions) =>
    getKey('viewing', identifier, options),
  deleteViewingKey: (identifier: string, options?: SecureStorageOptions) =>
    deleteKey('viewing', identifier, options),

  // Convenience methods for spending keys
  setSpendingKey: (identifier: string, key: string, options?: SecureStorageOptions) =>
    setKey('spending', identifier, key, options),
  getSpendingKey: (identifier: string, options?: SecureStorageOptions) =>
    getKey('spending', identifier, options),
  deleteSpendingKey: (identifier: string, options?: SecureStorageOptions) =>
    deleteKey('spending', identifier, options),

  // Convenience methods for meta addresses
  setMetaAddress: (identifier: string, meta: string, options?: SecureStorageOptions) =>
    setKey('meta', identifier, meta, options),
  getMetaAddress: (identifier: string, options?: SecureStorageOptions) =>
    getKey('meta', identifier, options),
  deleteMetaAddress: (identifier: string, options?: SecureStorageOptions) =>
    deleteKey('meta', identifier, options),

  // Biometrics support
  getSupportedBiometrics,
  isAvailable,
} as const

export type { KeyType }
