/**
 * Hardware Wallet Module
 *
 * Support for hardware wallets (Ledger, Trezor) in SIP Protocol.
 *
 * @example
 * ```typescript
 * import {
 *   LedgerWalletAdapter,
 *   TrezorWalletAdapter,
 *   MockLedgerAdapter,
 * } from '@sip-protocol/sdk'
 *
 * // Connect to Ledger
 * const ledger = new LedgerWalletAdapter({
 *   chain: 'ethereum',
 *   accountIndex: 0,
 * })
 * await ledger.connect()
 *
 * // Connect to Trezor
 * const trezor = new TrezorWalletAdapter({
 *   chain: 'ethereum',
 *   manifestEmail: 'dev@myapp.com',
 *   manifestAppName: 'My DApp',
 *   manifestUrl: 'https://myapp.com',
 * })
 * await trezor.connect()
 *
 * // Use mock adapter for testing
 * const mock = new MockLedgerAdapter({
 *   chain: 'ethereum',
 * })
 * await mock.connect()
 * ```
 *
 * @remarks
 * Hardware wallet adapters require external dependencies:
 * - Ledger: `@ledgerhq/hw-transport-webusb`, `@ledgerhq/hw-app-eth`
 * - Trezor: `@trezor/connect-web`
 *
 * Mock adapters are included for testing without hardware.
 *
 * @module hardware
 */

// Types
export {
  type HardwareWalletType,
  type LedgerModel,
  type TrezorModel,
  type HardwareConnectionStatus,
  type TransportType,
  type HardwareDeviceInfo,
  type HardwareWalletConfig,
  type LedgerConfig,
  type TrezorConfig,
  type HardwareSignRequest,
  type HardwareEthereumTx,
  type HardwareSignature,
  type HardwareAccount,
  type HardwareTransport,
  type HardwareErrorCodeType,
  HardwareErrorCode,
  HardwareWalletError,
  DerivationPath,
  getDerivationPath,
  supportsWebUSB,
  supportsWebHID,
  supportsWebBluetooth,
  getAvailableTransports,
} from './types'

// Ledger adapter
export { LedgerWalletAdapter, createLedgerAdapter } from './ledger'

// Ledger privacy adapter (Ethereum stealth addresses)
export {
  LedgerPrivacyAdapter,
  createLedgerPrivacyAdapter,
  type LedgerPrivacyConfig,
  type LedgerStealthKeyMaterial,
  type LedgerScannedPayment,
  type LedgerClaimResult,
} from './ledger-privacy'

// Trezor adapter
export { TrezorWalletAdapter, createTrezorAdapter } from './trezor'

// Mock adapters for testing
export {
  type MockHardwareConfig,
  MockLedgerAdapter,
  MockTrezorAdapter,
  createMockLedgerAdapter,
  createMockTrezorAdapter,
} from './mock'
