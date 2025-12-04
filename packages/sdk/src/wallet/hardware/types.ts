/**
 * Hardware Wallet Types
 *
 * Type definitions for hardware wallet adapters (Ledger, Trezor).
 */

import type { ChainId, HexString } from '@sip-protocol/types'

// ─── Device Types ───────────────────────────────────────────────────────────────

/**
 * Supported hardware wallet manufacturers
 */
export type HardwareWalletType = 'ledger' | 'trezor'

/**
 * Ledger device models
 */
export type LedgerModel = 'nanoS' | 'nanoSPlus' | 'nanoX' | 'stax' | 'flex'

/**
 * Trezor device models
 */
export type TrezorModel = 'one' | 'T' | 'safe3' | 'safe5'

/**
 * Hardware wallet connection status
 */
export type HardwareConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'locked'
  | 'app_closed'
  | 'error'

/**
 * Transport type for device communication
 */
export type TransportType = 'usb' | 'bluetooth' | 'webusb' | 'webhid'

// ─── Device Info ────────────────────────────────────────────────────────────────

/**
 * Hardware device information
 */
export interface HardwareDeviceInfo {
  /** Device manufacturer */
  manufacturer: HardwareWalletType
  /** Device model */
  model: string
  /** Firmware version */
  firmwareVersion?: string
  /** Whether device is locked */
  isLocked: boolean
  /** Currently open app (if any) */
  currentApp?: string
  /** Device label/name (user-set) */
  label?: string
  /** Device ID (unique identifier) */
  deviceId?: string
}

// ─── Derivation Paths ───────────────────────────────────────────────────────────

/**
 * Standard BIP44 derivation paths
 */
export const DerivationPath = {
  /** Ethereum: m/44'/60'/0'/0/index */
  ETHEREUM: "m/44'/60'/0'/0",
  /** Ethereum (Ledger Live): m/44'/60'/index'/0/0 */
  ETHEREUM_LEDGER_LIVE: "m/44'/60'",
  /** Solana: m/44'/501'/0'/0' */
  SOLANA: "m/44'/501'/0'/0'",
  /** Bitcoin: m/84'/0'/0'/0 (native segwit) */
  BITCOIN: "m/84'/0'/0'/0",
  /** NEAR: m/44'/397'/0' */
  NEAR: "m/44'/397'/0'",
} as const

/**
 * Get derivation path for a chain
 */
export function getDerivationPath(chain: ChainId, accountIndex: number = 0): string {
  switch (chain) {
    case 'ethereum':
      return `${DerivationPath.ETHEREUM}/${accountIndex}`
    case 'solana':
      return DerivationPath.SOLANA.replace("0'", `${accountIndex}'`)
    case 'bitcoin':
      return `${DerivationPath.BITCOIN}/${accountIndex}`
    case 'near':
      return DerivationPath.NEAR.replace("0'", `${accountIndex}'`)
    default:
      return `${DerivationPath.ETHEREUM}/${accountIndex}`
  }
}

// ─── Configuration ──────────────────────────────────────────────────────────────

/**
 * Base hardware wallet configuration
 */
export interface HardwareWalletConfig {
  /** Target chain */
  chain: ChainId
  /** Account index (default: 0) */
  accountIndex?: number
  /** Custom derivation path (overrides default) */
  derivationPath?: string
  /** Transport type preference */
  transport?: TransportType
  /** Connection timeout in ms (default: 30000) */
  timeout?: number
}

/**
 * Ledger-specific configuration
 */
export interface LedgerConfig extends HardwareWalletConfig {
  /** Expected app name to be open on device */
  appName?: string
  /** Whether to use Ledger Live derivation path */
  useLedgerLive?: boolean
  /** Scramble key for transport */
  scrambleKey?: string
}

/**
 * Trezor-specific configuration
 */
export interface TrezorConfig extends HardwareWalletConfig {
  /** Trezor Connect manifest URL */
  manifestUrl?: string
  /** Trezor Connect manifest email */
  manifestEmail?: string
  /** Trezor Connect manifest app name */
  manifestAppName?: string
  /** Whether to use popup for Trezor Connect */
  popup?: boolean
}

// ─── Signing Requests ───────────────────────────────────────────────────────────

/**
 * Hardware wallet signing request
 */
export interface HardwareSignRequest {
  /** Raw message to sign */
  message: Uint8Array
  /** Display message on device (if supported) */
  displayMessage?: string
  /** Whether this is a transaction (vs arbitrary message) */
  isTransaction?: boolean
}

/**
 * Ethereum transaction for hardware signing
 */
export interface HardwareEthereumTx {
  /** Recipient address */
  to: string
  /** Value in wei (hex) */
  value: HexString
  /** Gas limit (hex) */
  gasLimit: HexString
  /** Gas price (hex) - for legacy tx */
  gasPrice?: HexString
  /** Max fee per gas (hex) - for EIP-1559 */
  maxFeePerGas?: HexString
  /** Max priority fee per gas (hex) - for EIP-1559 */
  maxPriorityFeePerGas?: HexString
  /** Transaction data (hex) */
  data?: HexString
  /** Nonce (hex) */
  nonce: HexString
  /** Chain ID */
  chainId: number
}

/**
 * Signature from hardware wallet
 */
export interface HardwareSignature {
  /** r component */
  r: HexString
  /** s component */
  s: HexString
  /** v component (recovery id) */
  v: number
  /** Full signature (r + s + v) */
  signature: HexString
}

// ─── Account Info ───────────────────────────────────────────────────────────────

/**
 * Account derived from hardware wallet
 */
export interface HardwareAccount {
  /** Account address */
  address: string
  /** Public key (hex) */
  publicKey: HexString
  /** Derivation path used */
  derivationPath: string
  /** Account index */
  index: number
  /** Chain */
  chain: ChainId
}

// ─── Transport Interfaces ───────────────────────────────────────────────────────

/**
 * Abstract transport interface for hardware communication
 *
 * This is implemented by actual transport libraries:
 * - @ledgerhq/hw-transport-webusb
 * - @ledgerhq/hw-transport-webhid
 * - @trezor/connect-web
 */
export interface HardwareTransport {
  /** Open connection to device */
  open(): Promise<void>
  /** Close connection */
  close(): Promise<void>
  /** Send APDU command (Ledger) */
  send?(cla: number, ins: number, p1: number, p2: number, data?: Buffer): Promise<Buffer>
  /** Check if transport is open */
  isOpen?: boolean
}

// ─── Error Types ────────────────────────────────────────────────────────────────

/**
 * Hardware wallet error codes
 */
export const HardwareErrorCode = {
  /** Device not found/connected */
  DEVICE_NOT_FOUND: 'HARDWARE_DEVICE_NOT_FOUND',
  /** Device is locked (requires PIN) */
  DEVICE_LOCKED: 'HARDWARE_DEVICE_LOCKED',
  /** Required app not open on device */
  APP_NOT_OPEN: 'HARDWARE_APP_NOT_OPEN',
  /** User rejected on device */
  USER_REJECTED: 'HARDWARE_USER_REJECTED',
  /** Transport/communication error */
  TRANSPORT_ERROR: 'HARDWARE_TRANSPORT_ERROR',
  /** Timeout waiting for device */
  TIMEOUT: 'HARDWARE_TIMEOUT',
  /** Unsupported operation */
  UNSUPPORTED: 'HARDWARE_UNSUPPORTED',
  /** Invalid derivation path */
  INVALID_PATH: 'HARDWARE_INVALID_PATH',
  /** Invalid parameters provided */
  INVALID_PARAMS: 'HARDWARE_INVALID_PARAMS',
} as const

export type HardwareErrorCodeType = typeof HardwareErrorCode[keyof typeof HardwareErrorCode]

/**
 * Hardware wallet error
 */
export class HardwareWalletError extends Error {
  readonly code: HardwareErrorCodeType
  readonly device?: HardwareWalletType
  readonly details?: unknown

  constructor(
    message: string,
    code: HardwareErrorCodeType,
    device?: HardwareWalletType,
    details?: unknown
  ) {
    super(message)
    this.name = 'HardwareWalletError'
    this.code = code
    this.device = device
    this.details = details
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

/**
 * Check if browser supports WebUSB
 */
export function supportsWebUSB(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

/**
 * Check if browser supports WebHID
 */
export function supportsWebHID(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator
}

/**
 * Check if browser supports Web Bluetooth
 */
export function supportsWebBluetooth(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

/**
 * Get available transport types
 */
export function getAvailableTransports(): TransportType[] {
  const transports: TransportType[] = []

  if (supportsWebUSB()) transports.push('webusb')
  if (supportsWebHID()) transports.push('webhid')
  if (supportsWebBluetooth()) transports.push('bluetooth')

  return transports
}
