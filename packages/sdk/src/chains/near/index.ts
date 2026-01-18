/**
 * NEAR Same-Chain Privacy Module
 *
 * Provides privacy-preserving NEAR and NEP-141 token transfers using stealth addresses.
 *
 * @example Sender flow
 * ```typescript
 * import { sendPrivateNEARTransfer } from '@sip-protocol/sdk'
 *
 * const result = await sendPrivateNEARTransfer({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   senderAccountId: 'alice.near',
 *   senderPrivateKey: 'ed25519:...',
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   amount: 1_000_000_000_000_000_000_000_000n, // 1 NEAR
 * })
 * ```
 *
 * @example Recipient flow
 * ```typescript
 * import { scanForNEARPayments, claimNEARPayment } from '@sip-protocol/sdk'
 *
 * // Scan for incoming payments
 * const payments = await scanForNEARPayments({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   viewingPrivateKey,
 *   spendingPublicKey,
 * })
 *
 * // Claim a payment
 * const result = await claimNEARPayment({
 *   rpcUrl: 'https://rpc.mainnet.near.org',
 *   stealthAddress: payments[0].stealthAddress,
 *   ephemeralPublicKey: payments[0].ephemeralPublicKey,
 *   viewingPrivateKey,
 *   spendingPrivateKey,
 *   destinationAccountId: 'alice.near',
 * })
 * ```
 *
 * @packageDocumentation
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export {
  NEAR_RPC_ENDPOINTS,
  NEAR_EXPLORER_URLS,
  NEAR_TOKEN_CONTRACTS,
  NEAR_TOKEN_DECIMALS,
  SIP_MEMO_PREFIX,
  NEAR_IMPLICIT_ACCOUNT_LENGTH,
  NEAR_ACCOUNT_ID_MIN_LENGTH,
  NEAR_ACCOUNT_ID_MAX_LENGTH,
  ED25519_KEY_BYTES,
  ED25519_KEY_HEX_LENGTH,
  VIEW_TAG_MIN,
  VIEW_TAG_MAX,
  DEFAULT_GAS,
  STORAGE_BALANCE_MIN,
  STORAGE_DEPOSIT_DEFAULT,
  ONE_YOCTO,
  ONE_NEAR,
  getExplorerUrl,
  getAccountExplorerUrl,
  getTokenContract,
  getNEARTokenDecimals,
  isImplicitAccount,
  isNamedAccount,
  isValidAccountId,
  sanitizeUrl,
  type NEARNetwork,
} from './constants'

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  NEARAnnouncement,
  NEARPrivateTransferParams,
  NEARPrivateTransferResult,
  NEARScanParams,
  NEARScanResult,
  NEARDetectedPayment,
  NEARClaimParams,
  NEARClaimResult,
  NEARStealthBalance,
  NEARRpcError,
  NEARTransactionOutcome,
} from './types'

export { parseAnnouncement, createAnnouncementMemo } from './types'

// ─── Stealth Address (M17-NEAR-01, M17-NEAR-02) ──────────────────────────────

export {
  generateNEARStealthMetaAddress,
  generateNEARStealthAddress,
  deriveNEARStealthPrivateKey,
  checkNEARStealthAddress,
  ed25519PublicKeyToImplicitAccount,
  implicitAccountToEd25519PublicKey,
  encodeNEARStealthMetaAddress,
  parseNEARStealthMetaAddress,
  validateNEARStealthMetaAddress,
  validateNEARStealthAddress,
  type NEARStealthAddressResult,
  type NEARStealthMetaAddressResult,
} from './stealth'
