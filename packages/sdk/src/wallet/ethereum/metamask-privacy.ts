/**
 * MetaMask Privacy Signing Utilities
 *
 * Provides MetaMask-specific helpers for privacy operations including
 * EIP-712 signing, viewing key derivation, and transaction building.
 *
 * @module wallet/ethereum/metamask-privacy
 */

import type { HexString } from '@sip-protocol/types'
import type { EIP712TypedData } from './types'
import { PrivacyEthereumWalletAdapter } from './privacy-adapter'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * MetaMask signing request types
 */
export type MetaMaskSigningMethod =
  | 'personal_sign'
  | 'eth_signTypedData_v4'
  | 'eth_sign'

/**
 * Privacy operation types that require signing
 */
export type PrivacyOperationType =
  | 'key_derivation'
  | 'stealth_transfer'
  | 'token_approval'
  | 'claim_funds'
  | 'view_key_share'

/**
 * Human-readable signing context for privacy operations
 */
export interface PrivacySigningContext {
  operation: PrivacyOperationType
  description: string
  warnings?: string[]
  data?: Record<string, unknown>
}

/**
 * MetaMask signing request with context
 */
export interface MetaMaskSigningRequest {
  method: MetaMaskSigningMethod
  params: unknown[]
  context: PrivacySigningContext
}

/**
 * EIP-712 domain configuration for SIP Protocol
 */
export interface SIPDomainConfig {
  name: string
  version: string
  chainId: number
  verifyingContract?: HexString
}

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Default SIP Protocol EIP-712 domain
 */
export const DEFAULT_SIP_DOMAIN: Omit<SIPDomainConfig, 'chainId'> = {
  name: 'SIP Protocol',
  version: '1',
}

/**
 * Privacy operation descriptions for user prompts
 */
export const PRIVACY_OPERATION_DESCRIPTIONS: Record<PrivacyOperationType, string> = {
  key_derivation: 'Generate privacy keys for stealth address operations',
  stealth_transfer: 'Send funds to a private stealth address',
  token_approval: 'Approve tokens for privacy transfer',
  claim_funds: 'Claim funds from stealth address',
  view_key_share: 'Share viewing key for compliance',
}

// ─── EIP-712 Type Definitions ───────────────────────────────────────────────

/**
 * EIP-712 types for key derivation
 */
export const KEY_DERIVATION_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ],
  KeyDerivation: [
    { name: 'purpose', type: 'string' },
    { name: 'domain', type: 'string' },
    { name: 'address', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

/**
 * EIP-712 types for stealth transfer authorization
 */
export const STEALTH_TRANSFER_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ],
  StealthTransfer: [
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'token', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

/**
 * EIP-712 types for viewing key sharing
 */
export const VIEW_KEY_SHARE_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ],
  ViewKeyShare: [
    { name: 'auditor', type: 'address' },
    { name: 'scope', type: 'string' },
    { name: 'validFrom', type: 'uint256' },
    { name: 'validUntil', type: 'uint256' },
  ],
} as const

// ─── Message Building ───────────────────────────────────────────────────────

/**
 * Build key derivation signing message
 *
 * This message is signed by the user to deterministically derive
 * stealth keys. The same signature always produces the same keys.
 *
 * @param params - Derivation parameters
 * @returns Human-readable message for signing
 */
export function buildKeyDerivationMessage(params: {
  domain: string
  address: string
  nonce?: number
}): string {
  return [
    'SIP Protocol Key Derivation Request',
    '',
    `Domain: ${params.domain}`,
    `Address: ${params.address}`,
    `Nonce: ${params.nonce ?? 0}`,
    '',
    'By signing this message, you authorize the generation of',
    'privacy keys for stealth address operations.',
    '',
    'These keys will be derived deterministically from this signature.',
    'Use the same domain and nonce to recover the same keys.',
  ].join('\n')
}

/**
 * Build EIP-712 typed data for key derivation
 *
 * @param params - Derivation parameters
 * @param chainId - Chain ID
 * @returns EIP-712 typed data
 */
export function buildKeyDerivationTypedData(
  params: {
    domain: string
    address: HexString
    nonce?: number
  },
  chainId: number
): EIP712TypedData {
  return {
    domain: {
      ...DEFAULT_SIP_DOMAIN,
      chainId,
    },
    types: {
      KeyDerivation: KEY_DERIVATION_TYPES.KeyDerivation as unknown as Array<{
        name: string
        type: string
      }>,
    },
    primaryType: 'KeyDerivation',
    message: {
      purpose: 'SIP Protocol Stealth Key Derivation',
      domain: params.domain,
      address: params.address,
      nonce: (params.nonce ?? 0).toString(),
    },
  }
}

/**
 * Build viewing key share authorization
 *
 * Creates EIP-712 typed data for authorizing viewing key sharing
 * with auditors or compliance services.
 *
 * @param params - Share parameters
 * @param chainId - Chain ID
 * @returns EIP-712 typed data
 */
export function buildViewKeyShareTypedData(
  params: {
    auditor: HexString
    scope: string
    validFrom: number
    validUntil: number
  },
  chainId: number
): EIP712TypedData {
  return {
    domain: {
      ...DEFAULT_SIP_DOMAIN,
      chainId,
    },
    types: {
      ViewKeyShare: VIEW_KEY_SHARE_TYPES.ViewKeyShare as unknown as Array<{
        name: string
        type: string
      }>,
    },
    primaryType: 'ViewKeyShare',
    message: {
      auditor: params.auditor,
      scope: params.scope,
      validFrom: params.validFrom.toString(),
      validUntil: params.validUntil.toString(),
    },
  }
}

// ─── MetaMask Detection ─────────────────────────────────────────────────────

/**
 * Check if MetaMask is installed
 *
 * @returns True if MetaMask is detected
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const ethereum = (window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum
  return !!ethereum?.isMetaMask
}

/**
 * Check if MetaMask Flask is installed
 *
 * Flask is MetaMask's developer version with experimental features
 * including Snaps support.
 *
 * @returns True if MetaMask Flask is detected
 */
export function isMetaMaskFlaskInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const ethereum = (window as unknown as {
    ethereum?: { isMetaMask?: boolean; _metamask?: { isUnlocked?: () => Promise<boolean> } }
  }).ethereum
  // Flask has additional internal properties
  return !!ethereum?.isMetaMask && !!ethereum?._metamask
}

/**
 * Get MetaMask version info
 *
 * @returns Version string or undefined if not available
 */
export async function getMetaMaskVersion(): Promise<string | undefined> {
  if (!isMetaMaskInstalled()) return undefined

  try {
    const ethereum = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string> } }).ethereum
    const result = await ethereum.request({ method: 'web3_clientVersion' })
    return result
  } catch {
    return undefined
  }
}

// ─── Privacy Context Helpers ────────────────────────────────────────────────

/**
 * Create signing context for privacy operation
 *
 * Provides user-friendly context for what they're signing.
 *
 * @param operation - Privacy operation type
 * @param data - Additional context data
 * @returns Signing context
 */
export function createSigningContext(
  operation: PrivacyOperationType,
  data?: Record<string, unknown>
): PrivacySigningContext {
  const warnings: string[] = []

  if (operation === 'key_derivation') {
    warnings.push('Your privacy keys will be derived from this signature')
    warnings.push('Save your derivation domain and nonce to recover keys later')
  } else if (operation === 'view_key_share') {
    warnings.push('The auditor will be able to see your transaction amounts')
    warnings.push('They cannot spend your funds with just the viewing key')
  } else if (operation === 'stealth_transfer') {
    warnings.push('This transaction cannot be easily traced to your address')
  }

  return {
    operation,
    description: PRIVACY_OPERATION_DESCRIPTIONS[operation],
    warnings,
    data,
  }
}

// ─── Adapter Helpers ────────────────────────────────────────────────────────

/**
 * Create a MetaMask-configured privacy adapter
 *
 * @param options - Adapter options
 * @returns Configured privacy adapter
 */
export function createMetaMaskPrivacyAdapter(options: {
  deriveFromWallet?: boolean
  derivationDomain?: string
} = {}): PrivacyEthereumWalletAdapter {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed')
  }

  const ethereum = (window as unknown as { ethereum: unknown }).ethereum

  return new PrivacyEthereumWalletAdapter({
    wallet: 'metamask',
    provider: ethereum as unknown as import('./types').EIP1193Provider,
    deriveFromWallet: options.deriveFromWallet ?? true,
    derivationDomain: options.derivationDomain ?? 'app.sip-protocol.org',
  })
}

/**
 * Check if wallet adapter is MetaMask
 *
 * @param adapter - Privacy adapter to check
 * @returns True if adapter is using MetaMask
 */
export function isMetaMaskAdapter(adapter: PrivacyEthereumWalletAdapter): boolean {
  return adapter.name.includes('metamask')
}

// ─── Signature Verification ─────────────────────────────────────────────────

/**
 * Extract V, R, S from signature
 *
 * MetaMask returns signatures in different formats depending on the method.
 * This normalizes them to V, R, S components.
 *
 * @param signature - Raw signature hex string
 * @returns Signature components
 */
export function parseSignature(signature: HexString): {
  v: number
  r: HexString
  s: HexString
} {
  // Remove 0x prefix
  const sig = signature.slice(2)

  // Standard 65-byte signature: r (32 bytes) + s (32 bytes) + v (1 byte)
  if (sig.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 hex chars, got ${sig.length}`)
  }

  const r = `0x${sig.slice(0, 64)}` as HexString
  const s = `0x${sig.slice(64, 128)}` as HexString
  let v = parseInt(sig.slice(128, 130), 16)

  // EIP-155: v is 27 or 28 for legacy, or chainId*2 + 35/36 for replay protection
  // MetaMask typically returns 27/28, normalize to 0/1 if needed
  if (v === 0 || v === 1) {
    v += 27
  }

  return { v, r, s }
}

/**
 * Format signature to EIP-2098 compact format
 *
 * Reduces signature size from 65 to 64 bytes by encoding v in s.
 *
 * @param signature - Raw 65-byte signature
 * @returns Compact 64-byte signature
 */
export function toCompactSignature(signature: HexString): HexString {
  const { v, r, s } = parseSignature(signature)

  // In compact format, if v is 28, the highest bit of s is set
  let sVal = BigInt(s)
  if (v === 28) {
    // Set bit 255 of s
    sVal |= BigInt(1) << BigInt(255)
  }

  const sHex = sVal.toString(16).padStart(64, '0')
  return `${r}${sHex}` as HexString
}
