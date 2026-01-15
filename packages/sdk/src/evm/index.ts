/**
 * EVM-specific modules for SIP Protocol
 *
 * Provides EVM chain support including:
 * - ERC-4337 Account Abstraction for gas-sponsored privacy transactions
 * - Gelato Relay integration (via ERC-4337)
 *
 * @example
 * ```typescript
 * import { createPimlicoRelayer } from '@sip-protocol/sdk/evm'
 *
 * const relayer = createPimlicoRelayer({
 *   apiKey: process.env.PIMLICO_API_KEY!,
 *   chain: 'base',
 * })
 *
 * // Relay a shielded transfer with sponsored gas
 * const result = await relayer.relayTransaction({
 *   to: stealthAddress,
 *   data: transferCalldata,
 *   signer,
 * })
 * ```
 *
 * @packageDocumentation
 */

export {
  // Main class
  ERC4337Relayer,
  ERC4337RelayerError,
  ERC4337RelayerErrorCode,
  // Factory functions
  createPimlicoRelayer,
  createStackupRelayer,
  createBiconomyRelayer,
  // Types
  type ERC4337RelayerConfig,
  type UserOperation,
  type RelayTransactionRequest,
  type RelayTransactionResult,
  type SupportedEVMChain,
  // Constants
  EVM_CHAIN_IDS,
  ENTRY_POINT_V07,
  BUNDLER_ENDPOINTS,
} from './erc4337-relayer'
