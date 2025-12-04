/**
 * Cosmos Chain Support
 *
 * Stealth address generation and IBC cross-chain transfers for Cosmos ecosystem.
 *
 * Supported chains:
 * - Cosmos Hub (cosmos)
 * - Osmosis (osmo)
 * - Injective (inj)
 * - Celestia (celestia)
 * - Sei (sei)
 * - dYdX (dydx)
 *
 * @example
 * ```typescript
 * import {
 *   CosmosStealthService,
 *   CosmosIBCStealthService,
 *   generateCosmosStealthAddress,
 *   createStealthIBCTransfer
 * } from '@sip-protocol/sdk/cosmos'
 *
 * // Stealth addresses
 * const service = new CosmosStealthService()
 * const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
 *   service.generateStealthMetaAddress('cosmos', 'My Wallet')
 *
 * // IBC stealth transfers
 * const ibcService = new CosmosIBCStealthService()
 * const transfer = ibcService.createStealthIBCTransfer({
 *   sourceChain: 'cosmos',
 *   destChain: 'osmosis',
 *   recipientMetaAddress: metaAddress,
 *   amount: 1000000n,
 *   denom: 'uatom'
 * })
 * console.log(transfer.stealthAddress) // "osmo1..."
 * ```
 */

// ─── Stealth Addresses ─────────────────────────────────────────────────────

export {
  // Service class
  CosmosStealthService,

  // Standalone functions
  generateCosmosStealthMetaAddress,
  generateCosmosStealthAddress,
  stealthKeyToCosmosAddress,
  isValidCosmosAddress,

  // Types
  type CosmosChainId,
  type CosmosStealthResult,

  // Constants
  CHAIN_PREFIXES,
} from './stealth'

// ─── IBC Stealth Transfers ─────────────────────────────────────────────────

export {
  // Service class
  CosmosIBCStealthService,

  // Standalone functions
  createStealthIBCTransfer,
  buildIBCMsgTransfer,
  scanIBCTransfers,
  getIBCChannel,

  // Types
  type IBCChannel,
  type StealthIBCTransferParams,
  type StealthIBCTransfer,
  type IBCMsgTransfer,
  type IncomingIBCTransfer,
  type ReceivedStealthTransfer,

  // Constants
  IBC_CHANNELS,
} from './ibc-stealth'
