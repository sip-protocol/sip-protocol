/**
 * NEAR Implicit Account Privacy Support
 *
 * Provides privacy operations for NEAR implicit accounts using stealth addresses.
 * Implicit accounts are ideal for stealth addresses as they:
 * - Don't require on-chain registration
 * - Are created automatically on first transfer
 * - Account ID = lowercase hex of ed25519 public key
 *
 * @example Send private transfer
 * ```typescript
 * import { buildPrivateTransfer } from '@sip-protocol/sdk'
 *
 * const { transaction, stealthAddress } = await buildPrivateTransfer({
 *   recipientMetaAddress: 'sip:near:0x...:0x...',
 *   amount: 1_000_000_000_000_000_000_000_000n, // 1 NEAR
 * })
 *
 * // Sign and send transaction using your NEAR wallet
 * await wallet.signAndSendTransaction(transaction)
 * ```
 *
 * @example Claim from stealth account
 * ```typescript
 * import { buildClaimTransaction, deriveStealthAccountKeyPair } from '@sip-protocol/sdk'
 *
 * // Derive keypair for the stealth account
 * const keypair = deriveStealthAccountKeyPair({
 *   stealthAddress: detectedPayment.stealthAddress,
 *   spendingPrivateKey: mySpendingKey,
 *   viewingPrivateKey: myViewingKey,
 * })
 *
 * // Build claim transaction
 * const tx = buildClaimTransaction({
 *   stealthAccountId: detectedPayment.stealthAccountId,
 *   destinationAccountId: 'alice.near',
 *   amount: detectedPayment.amount,
 * })
 * ```
 *
 * @packageDocumentation
 */

import { ed25519 } from '@noble/curves/ed25519'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString, StealthAddress, StealthMetaAddress } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { isValidPrivateKey } from '../../validation'
import {
  generateNEARStealthAddress,
  deriveNEARStealthPrivateKey,
  ed25519PublicKeyToImplicitAccount,
  parseNEARStealthMetaAddress,
} from './stealth'
import { createAnnouncementMemo } from './types'
import {
  isImplicitAccount,
  isValidAccountId,
  ONE_YOCTO,
  DEFAULT_GAS,
  STORAGE_DEPOSIT_DEFAULT,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result of building a private transfer
 */
export interface NEARPrivateTransferBuild {
  /** The stealth address generated for the recipient */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID (64 hex chars) */
  stealthAccountId: string
  /** Announcement memo to include in transaction */
  announcementMemo: string
  /** Transaction actions to execute */
  actions: NEARAction[]
  /** Receiver ID for the transaction (the stealth implicit account) */
  receiverId: string
}

/**
 * NEAR transaction action
 */
export interface NEARAction {
  type: 'Transfer' | 'FunctionCall' | 'AddKey' | 'DeleteKey' | 'DeleteAccount'
  params: NEARTransferAction | NEARFunctionCallAction | NEARAddKeyAction | NEARDeleteKeyAction | NEARDeleteAccountAction
}

/**
 * Native NEAR transfer action
 */
export interface NEARTransferAction {
  deposit: bigint
}

/**
 * Function call action (for NEP-141 tokens or contracts)
 */
export interface NEARFunctionCallAction {
  methodName: string
  args: string | Uint8Array
  gas: bigint
  deposit: bigint
}

/**
 * Add access key action
 */
export interface NEARAddKeyAction {
  publicKey: string
  accessKey: {
    permission: 'FullAccess' | {
      FunctionCall: {
        allowance?: bigint
        receiverId: string
        methodNames: string[]
      }
    }
  }
}

/**
 * Delete access key action
 */
export interface NEARDeleteKeyAction {
  publicKey: string
}

/**
 * Delete account action (sends remaining balance to beneficiary)
 */
export interface NEARDeleteAccountAction {
  beneficiaryId: string
}

/**
 * Derived stealth account keypair
 */
export interface NEARStealthKeyPair {
  /** Ed25519 public key (0x-prefixed hex) */
  publicKey: HexString
  /** Ed25519 private key scalar (0x-prefixed hex) */
  privateKey: HexString
  /** NEAR implicit account ID */
  accountId: string
  /** NEAR-formatted public key string (ed25519:base58) */
  nearPublicKey: string
  /** Raw public key bytes */
  publicKeyBytes: Uint8Array
}

/**
 * Parameters for deriving a stealth account keypair
 */
export interface DeriveStealthKeyPairParams {
  /** The stealth address to derive keys for */
  stealthAddress: StealthAddress
  /** Recipient's spending private key */
  spendingPrivateKey: HexString
  /** Recipient's viewing private key */
  viewingPrivateKey: HexString
}

/**
 * Parameters for building a claim transaction
 */
export interface NEARClaimTransactionParams {
  /** Stealth implicit account ID to claim from */
  stealthAccountId: string
  /** Destination account ID to receive funds */
  destinationAccountId: string
  /** Amount to claim in yoctoNEAR (defaults to full balance minus storage) */
  amount?: bigint
  /** Token contract for NEP-141 claims (omit for native NEAR) */
  tokenContract?: string
  /** Leave minimum balance for storage (default: true) */
  keepStorageDeposit?: boolean
}

/**
 * Result of building a claim transaction
 */
export interface NEARClaimTransactionBuild {
  /** Transaction actions */
  actions: NEARAction[]
  /** Receiver ID (destination for native NEAR, token contract for NEP-141) */
  receiverId: string
  /** Whether this is a token transfer */
  isTokenTransfer: boolean
}

/**
 * Parameters for adding an access key to a stealth account
 */
export interface NEARAddAccessKeyParams {
  /** New public key to add (ed25519:base58 format) */
  newPublicKey: string
  /** Permission type */
  permission: 'FullAccess' | {
    allowance?: bigint
    receiverId: string
    methodNames: string[]
  }
}

/**
 * Parameters for key rotation
 */
export interface NEARKeyRotationParams {
  /** Current stealth account ID */
  stealthAccountId: string
  /** New public key (ed25519:base58 format) */
  newPublicKey: string
  /** Old public key to delete (ed25519:base58 format) */
  oldPublicKey: string
  /** Permission for new key */
  permission?: 'FullAccess' | {
    allowance?: bigint
    receiverId: string
    methodNames: string[]
  }
}

// ─── Private Transfer Building ────────────────────────────────────────────────

/**
 * Build a private NEAR transfer to a stealth address
 *
 * Generates a one-time stealth address and builds the transaction
 * actions needed to send NEAR privately.
 *
 * @param recipientMetaAddress - Recipient's stealth meta-address
 * @param amount - Amount in yoctoNEAR
 * @returns Transfer build with actions and stealth address
 *
 * @example Native NEAR transfer
 * ```typescript
 * const { actions, receiverId, stealthAddress, announcementMemo } =
 *   buildPrivateTransfer(
 *     'sip:near:0x...:0x...',
 *     1_000_000_000_000_000_000_000_000n // 1 NEAR
 *   )
 *
 * // Create transaction with these actions
 * // Include announcementMemo in transaction logs/memo
 * ```
 */
export function buildPrivateTransfer(
  recipientMetaAddress: StealthMetaAddress | string,
  amount: bigint
): NEARPrivateTransferBuild {
  // Parse meta-address if string
  const metaAddr = typeof recipientMetaAddress === 'string'
    ? parseNEARStealthMetaAddress(recipientMetaAddress)
    : recipientMetaAddress

  // Validate chain
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'recipientMetaAddress'
    )
  }

  // Validate amount
  if (amount <= 0n) {
    throw new ValidationError('amount must be greater than 0', 'amount')
  }

  // Generate stealth address
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Build transfer action
  const actions: NEARAction[] = [
    {
      type: 'Transfer',
      params: {
        deposit: amount,
      } as NEARTransferAction,
    },
  ]

  return {
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
    actions,
    receiverId: implicitAccountId,
  }
}

/**
 * Build a private NEP-141 token transfer to a stealth address
 *
 * @param recipientMetaAddress - Recipient's stealth meta-address
 * @param tokenContract - NEP-141 token contract address
 * @param amount - Amount in token's smallest units
 * @param memo - Optional memo for the transfer
 * @returns Transfer build with actions and stealth address
 *
 * @example NEP-141 token transfer
 * ```typescript
 * const { actions, receiverId, stealthAddress, announcementMemo } =
 *   buildPrivateTokenTransfer(
 *     'sip:near:0x...:0x...',
 *     'usdt.tether-token.near',
 *     1_000_000n, // 1 USDT (6 decimals)
 *   )
 *
 * // receiverId is the token contract
 * // ft_transfer to stealthAccountId
 * ```
 */
export function buildPrivateTokenTransfer(
  recipientMetaAddress: StealthMetaAddress | string,
  tokenContract: string,
  amount: bigint,
  memo?: string
): NEARPrivateTransferBuild {
  // Parse meta-address if string
  const metaAddr = typeof recipientMetaAddress === 'string'
    ? parseNEARStealthMetaAddress(recipientMetaAddress)
    : recipientMetaAddress

  // Validate chain
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'recipientMetaAddress'
    )
  }

  // Validate token contract
  if (!isValidAccountId(tokenContract)) {
    throw new ValidationError('Invalid token contract account ID', 'tokenContract')
  }

  // Validate amount
  if (amount <= 0n) {
    throw new ValidationError('amount must be greater than 0', 'amount')
  }

  // Generate stealth address
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo (include in the ft_transfer memo)
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Build ft_transfer_call args
  const transferMemo = memo ? `${announcementMemo}|${memo}` : announcementMemo
  const args = JSON.stringify({
    receiver_id: implicitAccountId,
    amount: amount.toString(),
    memo: transferMemo,
  })

  // Build function call action
  const actions: NEARAction[] = [
    {
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer',
        args,
        gas: DEFAULT_GAS,
        deposit: ONE_YOCTO, // NEP-141 requires 1 yoctoNEAR deposit
      } as NEARFunctionCallAction,
    },
  ]

  return {
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
    actions,
    receiverId: tokenContract,
  }
}

/**
 * Build storage deposit for a stealth account on a token contract
 *
 * Many NEP-141 tokens require storage deposit before receiving tokens.
 *
 * @param stealthAccountId - Stealth implicit account ID
 * @param tokenContract - Token contract address
 * @param amount - Storage deposit amount (defaults to standard amount)
 * @returns Actions for storage deposit
 */
export function buildStorageDeposit(
  stealthAccountId: string,
  tokenContract: string,
  amount: bigint = STORAGE_DEPOSIT_DEFAULT
): NEARAction[] {
  if (!isImplicitAccount(stealthAccountId)) {
    throw new ValidationError(
      'stealthAccountId must be a valid implicit account',
      'stealthAccountId'
    )
  }

  if (!isValidAccountId(tokenContract)) {
    throw new ValidationError('Invalid token contract account ID', 'tokenContract')
  }

  const args = JSON.stringify({
    account_id: stealthAccountId,
  })

  return [
    {
      type: 'FunctionCall',
      params: {
        methodName: 'storage_deposit',
        args,
        gas: DEFAULT_GAS,
        deposit: amount,
      } as NEARFunctionCallAction,
    },
  ]
}

// ─── Key Derivation ───────────────────────────────────────────────────────────

/**
 * Derive the keypair for a stealth implicit account
 *
 * Uses the DKSAP (Dual-Key Stealth Address Protocol) to derive
 * the private key that controls the stealth account.
 *
 * @param params - Derivation parameters
 * @returns Derived keypair with NEAR-formatted public key
 *
 * @example
 * ```typescript
 * const keypair = deriveStealthAccountKeyPair({
 *   stealthAddress: detectedPayment.stealthAddress,
 *   spendingPrivateKey: mySpendingKey,
 *   viewingPrivateKey: myViewingKey,
 * })
 *
 * // keypair.nearPublicKey can be used to sign transactions
 * // keypair.accountId is the implicit account ID
 * ```
 */
export function deriveStealthAccountKeyPair(
  params: DeriveStealthKeyPairParams
): NEARStealthKeyPair {
  const { stealthAddress, spendingPrivateKey, viewingPrivateKey } = params

  // Validate inputs
  if (!stealthAddress) {
    throw new ValidationError('stealthAddress is required', 'stealthAddress')
  }
  if (!isValidPrivateKey(spendingPrivateKey)) {
    throw new ValidationError('Invalid spendingPrivateKey', 'spendingPrivateKey')
  }
  if (!isValidPrivateKey(viewingPrivateKey)) {
    throw new ValidationError('Invalid viewingPrivateKey', 'viewingPrivateKey')
  }

  // Derive private key using DKSAP
  const recovery = deriveNEARStealthPrivateKey(
    stealthAddress,
    spendingPrivateKey,
    viewingPrivateKey
  )

  // The derived private key is a scalar (not a seed)
  // Compute public key from scalar
  const privateKeyBytes = hexToBytes(recovery.privateKey.slice(2))
  const scalar = bytesToBigIntLE(privateKeyBytes)
  const publicPoint = ed25519.ExtendedPoint.BASE.multiply(scalar)
  const publicKeyBytes = publicPoint.toRawBytes()

  // Convert to NEAR-formatted public key (ed25519:base58)
  const nearPublicKey = `ed25519:${bytesToBase58(publicKeyBytes)}`

  // Get implicit account ID
  const accountId = ed25519PublicKeyToImplicitAccount(
    `0x${bytesToHex(publicKeyBytes)}` as HexString
  )

  return {
    publicKey: `0x${bytesToHex(publicKeyBytes)}` as HexString,
    privateKey: recovery.privateKey,
    accountId,
    nearPublicKey,
    publicKeyBytes,
  }
}

// ─── Claim Transactions ───────────────────────────────────────────────────────

/**
 * Build a transaction to claim funds from a stealth account
 *
 * @param params - Claim parameters
 * @returns Transaction build with actions
 *
 * @example Claim native NEAR
 * ```typescript
 * const { actions, receiverId } = buildClaimTransaction({
 *   stealthAccountId: '1234...abcd',
 *   destinationAccountId: 'alice.near',
 *   amount: 1_000_000_000_000_000_000_000_000n,
 * })
 *
 * // Sign with derived stealth keypair and send
 * ```
 */
export function buildClaimTransaction(
  params: NEARClaimTransactionParams
): NEARClaimTransactionBuild {
  const {
    stealthAccountId,
    destinationAccountId,
    amount,
    tokenContract,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    keepStorageDeposit: _keepStorageDeposit = true, // Reserved for future balance calculation
  } = params

  // Validate stealth account
  if (!isImplicitAccount(stealthAccountId)) {
    throw new ValidationError(
      'stealthAccountId must be a valid implicit account',
      'stealthAccountId'
    )
  }

  // Validate destination
  if (!isValidAccountId(destinationAccountId)) {
    throw new ValidationError(
      'Invalid destinationAccountId',
      'destinationAccountId'
    )
  }

  // Token transfer
  if (tokenContract) {
    if (!isValidAccountId(tokenContract)) {
      throw new ValidationError('Invalid tokenContract', 'tokenContract')
    }

    const args = JSON.stringify({
      receiver_id: destinationAccountId,
      amount: amount?.toString() ?? '0', // Will need to query balance if not specified
      memo: null,
    })

    return {
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'ft_transfer',
            args,
            gas: DEFAULT_GAS,
            deposit: ONE_YOCTO,
          } as NEARFunctionCallAction,
        },
      ],
      receiverId: tokenContract,
      isTokenTransfer: true,
    }
  }

  // Native NEAR transfer
  const transferAmount = amount ?? 0n

  return {
    actions: [
      {
        type: 'Transfer',
        params: {
          deposit: transferAmount,
        } as NEARTransferAction,
      },
    ],
    receiverId: destinationAccountId,
    isTokenTransfer: false,
  }
}

/**
 * Build a transaction to delete a stealth account and claim all funds
 *
 * This is more gas-efficient than regular transfer as it reclaims
 * storage deposit. Use when you want to fully drain the account.
 *
 * @param stealthAccountId - Stealth implicit account to delete
 * @param beneficiaryId - Account to receive all remaining funds
 * @returns Delete account action
 */
export function buildDeleteStealthAccount(
  stealthAccountId: string,
  beneficiaryId: string
): NEARAction[] {
  if (!isImplicitAccount(stealthAccountId)) {
    throw new ValidationError(
      'stealthAccountId must be a valid implicit account',
      'stealthAccountId'
    )
  }

  if (!isValidAccountId(beneficiaryId)) {
    throw new ValidationError('Invalid beneficiaryId', 'beneficiaryId')
  }

  return [
    {
      type: 'DeleteAccount',
      params: {
        beneficiaryId,
      } as NEARDeleteAccountAction,
    },
  ]
}

// ─── Access Key Management ────────────────────────────────────────────────────

/**
 * Build actions to add an access key to a stealth account
 *
 * This allows spending from the stealth account with a different key
 * (e.g., a hardware wallet key) without revealing the stealth private key.
 *
 * @param params - Add access key parameters
 * @returns Add key action
 *
 * @example Add full access key
 * ```typescript
 * const actions = buildAddAccessKey({
 *   newPublicKey: 'ed25519:...',
 *   permission: 'FullAccess',
 * })
 *
 * // Sign with stealth keypair and send
 * ```
 */
export function buildAddAccessKey(params: NEARAddAccessKeyParams): NEARAction[] {
  const { newPublicKey, permission } = params

  // Validate public key format
  if (!newPublicKey.startsWith('ed25519:')) {
    throw new ValidationError(
      'newPublicKey must be in ed25519:base58 format',
      'newPublicKey'
    )
  }

  const accessKey = permission === 'FullAccess'
    ? { permission: 'FullAccess' as const }
    : {
        permission: {
          FunctionCall: {
            allowance: permission.allowance,
            receiverId: permission.receiverId,
            methodNames: permission.methodNames,
          },
        },
      }

  return [
    {
      type: 'AddKey',
      params: {
        publicKey: newPublicKey,
        accessKey,
      } as NEARAddKeyAction,
    },
  ]
}

/**
 * Build actions for key rotation on a stealth account
 *
 * Atomically adds a new key and removes the old key in a single transaction.
 * Useful for migrating to a hardware wallet key.
 *
 * @param params - Key rotation parameters
 * @returns Actions for key rotation
 */
export function buildKeyRotation(params: NEARKeyRotationParams): NEARAction[] {
  const { newPublicKey, oldPublicKey, permission = 'FullAccess' } = params

  // Validate public key formats
  if (!newPublicKey.startsWith('ed25519:')) {
    throw new ValidationError(
      'newPublicKey must be in ed25519:base58 format',
      'newPublicKey'
    )
  }
  if (!oldPublicKey.startsWith('ed25519:')) {
    throw new ValidationError(
      'oldPublicKey must be in ed25519:base58 format',
      'oldPublicKey'
    )
  }

  const accessKey = permission === 'FullAccess'
    ? { permission: 'FullAccess' as const }
    : {
        permission: {
          FunctionCall: {
            allowance: permission.allowance,
            receiverId: permission.receiverId,
            methodNames: permission.methodNames,
          },
        },
      }

  // Add new key first, then delete old key
  return [
    {
      type: 'AddKey',
      params: {
        publicKey: newPublicKey,
        accessKey,
      } as NEARAddKeyAction,
    },
    {
      type: 'DeleteKey',
      params: {
        publicKey: oldPublicKey,
      } as NEARDeleteKeyAction,
    },
  ]
}

// ─── Account State Helpers ────────────────────────────────────────────────────

/**
 * Check if an implicit account ID is valid and follows stealth address format
 *
 * @param accountId - Account ID to check
 * @returns True if it's a valid stealth-compatible implicit account
 */
export function isStealthCompatibleAccount(accountId: string): boolean {
  return isImplicitAccount(accountId)
}

/**
 * Get the public key for an implicit account
 *
 * @param accountId - Implicit account ID (64 hex chars)
 * @returns Ed25519 public key in NEAR format (ed25519:base58)
 */
export function getImplicitAccountPublicKey(accountId: string): string {
  if (!isImplicitAccount(accountId)) {
    throw new ValidationError(
      'accountId must be a valid implicit account',
      'accountId'
    )
  }

  // Convert hex to bytes
  const publicKeyBytes = hexToBytes(accountId)

  // Convert to base58 and format
  return `ed25519:${bytesToBase58(publicKeyBytes)}`
}

/**
 * Verify that an implicit account matches a stealth address
 *
 * @param accountId - Implicit account ID to check
 * @param stealthAddress - Expected stealth address
 * @returns True if the account matches the stealth address
 */
export function verifyImplicitAccountMatch(
  accountId: string,
  stealthAddress: StealthAddress
): boolean {
  if (!isImplicitAccount(accountId)) {
    return false
  }

  // Get expected account ID from stealth address
  const expectedAccountId = ed25519PublicKeyToImplicitAccount(stealthAddress.address)

  return accountId.toLowerCase() === expectedAccountId.toLowerCase()
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Convert bytes to little-endian BigInt
 */
function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

/**
 * Convert bytes to base58
 */
function bytesToBase58(bytes: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

  // Count leading zeros
  let zeros = 0
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    zeros++
  }

  // Convert to base58
  const result: number[] = []
  let num = 0n
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte)
  }

  while (num > 0n) {
    const remainder = Number(num % 58n)
    num = num / 58n
    result.unshift(remainder)
  }

  // Add leading '1's for each leading zero byte
  for (let i = 0; i < zeros; i++) {
    result.unshift(0)
  }

  return result.map(i => ALPHABET[i]).join('')
}
