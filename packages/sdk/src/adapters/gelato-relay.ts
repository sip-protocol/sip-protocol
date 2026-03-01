/**
 * Gelato Relay Adapter for SIP Protocol
 *
 * Enables gasless claim and withdrawal from stealth addresses via Gelato Relay.
 * Recipients can claim funds without holding ETH for gas — critical for stealth
 * addresses which are freshly generated and have zero balance.
 *
 * ## Two Modes
 *
 * - **sponsoredCall**: SIP pays gas from Gas Tank (requires API key)
 * - **callWithSyncFee**: Fee deducted from withdrawal amount (requires SIPRelayer)
 *
 * ```
 * ┌──────────────────────────────────────────────────────────┐
 * │  GELATO RELAY + SIP PRIVACY FLOW                         │
 * │                                                          │
 * │  Sponsored Mode:                                         │
 * │  1. Recipient calls sponsoredClaim() with proof          │
 * │  2. Gelato relays tx to SIPPrivacy.withdrawDeposit()     │
 * │  3. SIP Gas Tank pays the gas fee                        │
 * │  4. Funds arrive at recipient stealth address             │
 * │                                                          │
 * │  SyncFee Mode:                                           │
 * │  1. Recipient calls syncFeeClaim() with proof + maxFee   │
 * │  2. Gelato relays tx to SIPRelayer contract              │
 * │  3. SIPRelayer calls SIPPrivacy.withdrawDeposit()        │
 * │  4. SIPRelayer deducts gas fee from withdrawn amount     │
 * │  5. Remainder arrives at recipient stealth address        │
 * │                                                          │
 * │  Result: Zero-gas claims from stealth addresses          │
 * └──────────────────────────────────────────────────────────┘
 * ```
 *
 * ## ABI Encoding
 *
 * Uses manual ABI encoding with @noble/hashes keccak256 for function selectors.
 * No ethers.js or viem dependency required.
 *
 * @see https://docs.gelato.network/web3-services/relay
 */

import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface GelatoRelayConfig {
  /** Gelato Gas Tank API key (required for sponsoredCall) */
  apiKey?: string
  /** Target chain ID (e.g. 11155111 for Sepolia) */
  chainId: number
  /** SIPPrivacy contract address */
  sipPrivacyAddress: string
  /** SIPRelayer contract address (required for callWithSyncFee) */
  sipRelayerAddress?: string
}

export interface RelayClaimParams {
  /** Deposit transfer ID */
  transferId: bigint
  /** Nullifier hash (bytes32 hex) */
  nullifier: string
  /** ZK proof (bytes hex) */
  proof: string
  /** Recipient address (20-byte hex) */
  recipient: string
}

export interface SyncFeeClaimParams extends RelayClaimParams {
  /** Token to pay Gelato fee in */
  feeToken: string
  /** Maximum fee willing to pay */
  maxFee: bigint
  /** ERC20 token address (omit or zero address for ETH) */
  token?: string
}

export interface RelayResult {
  /** Gelato task ID for tracking */
  taskId: string
  /** Which relay mode was used */
  mode: 'sponsored' | 'syncFee'
}

export type TaskStatus =
  | 'CheckPending'
  | 'ExecPending'
  | 'ExecSuccess'
  | 'ExecReverted'
  | 'Cancelled'

export interface TaskStatusResult {
  /** Gelato task ID */
  taskId: string
  /** Current task state */
  taskState: TaskStatus
  /** Transaction hash (available after execution) */
  transactionHash?: string
  /** Block number (available after execution) */
  blockNumber?: number
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const GELATO_RELAY_URL = 'https://relay.gelato.digital'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// ═══════════════════════════════════════════
// ABI Encoding Helpers (no ethers/viem)
// ═══════════════════════════════════════════

/**
 * Compute 4-byte function selector from Solidity signature.
 * selector = keccak256(signature)[0:4]
 */
export function functionSelector(signature: string): string {
  const hash = keccak_256(new TextEncoder().encode(signature))
  return '0x' + bytesToHex(hash).slice(0, 8)
}

/** Left-pad a bigint to 32 bytes (64 hex chars) */
function padUint256(value: bigint): string {
  if (value < 0n) throw new Error(`uint256 cannot be negative: ${value}`)
  if (value >= 2n ** 256n) throw new Error(`uint256 overflow: ${value}`)
  return value.toString(16).padStart(64, '0')
}

/** Left-pad an address to 32 bytes (64 hex chars) */
function padAddress(addr: string): string {
  const clean = addr.startsWith('0x') ? addr.slice(2) : addr
  if (clean.length !== 40) {
    throw new Error(`Invalid address length: expected 40 hex chars, got ${clean.length}`)
  }
  return clean.toLowerCase().padStart(64, '0')
}

/** Right-pad a bytes32 value to 32 bytes (64 hex chars) */
function padBytes32(value: string): string {
  const clean = value.startsWith('0x') ? value.slice(2) : value
  if (clean.length > 64) {
    throw new Error(`bytes32 value too long: ${clean.length} hex chars (max 64)`)
  }
  return clean.padEnd(64, '0')
}

/**
 * ABI-encode a dynamic `bytes` value.
 * Returns: length (32 bytes) + data (padded to 32-byte boundary)
 */
function encodeBytes(value: string): string {
  const clean = value.startsWith('0x') ? value.slice(2) : value
  if (clean.length % 2 !== 0) {
    throw new Error(`bytes value must have even hex length, got ${clean.length}`)
  }
  const length = clean.length / 2
  const paddedData = clean.length % 64 === 0
    ? clean
    : clean + '0'.repeat(64 - (clean.length % 64))
  return padUint256(BigInt(length)) + paddedData
}

// ═══════════════════════════════════════════
// GelatoRelayAdapter
// ═══════════════════════════════════════════

export class GelatoRelayAdapter {
  private config: GelatoRelayConfig

  constructor(config: GelatoRelayConfig) {
    if (!config.sipPrivacyAddress) {
      throw new Error('sipPrivacyAddress is required')
    }
    if (!config.chainId) {
      throw new Error('chainId is required')
    }
    this.config = config
  }

  /**
   * Gasless withdrawal via sponsoredCall (SIP pays gas from Gas Tank).
   * Calls SIPPrivacy.withdrawDeposit() directly.
   */
  async sponsoredClaim(params: RelayClaimParams): Promise<RelayResult> {
    if (!this.config.apiKey) {
      throw new Error('API key required for sponsoredCall')
    }

    const data = this.encodeWithdrawDeposit(params)

    const response = await fetch(`${GELATO_RELAY_URL}/relays/v2/sponsored-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: this.config.chainId,
        target: this.config.sipPrivacyAddress,
        data,
        sponsorApiKey: this.config.apiKey,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`Gelato relay error: ${response.status} ${text}`)
    }

    const result = await response.json()
    return { taskId: result.taskId, mode: 'sponsored' }
  }

  /**
   * Gasless withdrawal via callWithSyncFee (fee deducted from withdrawn amount).
   * Routes through SIPRelayer contract which handles fee deduction.
   *
   * - ETH withdrawals: calls relayedWithdrawETH()
   * - ERC20 withdrawals: calls relayedWithdrawToken() (when params.token is set)
   */
  async syncFeeClaim(params: SyncFeeClaimParams): Promise<RelayResult> {
    if (!this.config.sipRelayerAddress) {
      throw new Error('SIPRelayer address required for callWithSyncFee')
    }

    const isToken = params.token && params.token !== ZERO_ADDRESS
    const data = isToken
      ? this.encodeRelayedWithdrawToken(params)
      : this.encodeRelayedWithdrawETH(params)

    const response = await fetch(`${GELATO_RELAY_URL}/relays/v2/call-with-sync-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: this.config.chainId,
        target: this.config.sipRelayerAddress,
        data,
        feeToken: params.feeToken,
        isRelayContext: true,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      throw new Error(`Gelato relay error: ${response.status} ${text}`)
    }

    const result = await response.json()
    return { taskId: result.taskId, mode: 'syncFee' }
  }

  /**
   * Check relay task status.
   * Poll this after submitting a relay request to track execution.
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResult> {
    if (!taskId) {
      throw new Error('taskId is required')
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) {
      throw new Error(`Invalid taskId format: ${taskId}`)
    }

    const response = await fetch(`${GELATO_RELAY_URL}/tasks/status/${taskId}`)

    if (!response.ok) {
      throw new Error(`Gelato status error: ${response.status}`)
    }

    const result = await response.json()
    return {
      taskId: result.task.taskId,
      taskState: result.task.taskState,
      transactionHash: result.task.transactionHash,
      blockNumber: result.task.blockNumber,
    }
  }

  // ═══════════════════════════════════════════
  // ABI Encoding (no ethers/viem dependency)
  // ═══════════════════════════════════════════

  /**
   * Encode withdrawDeposit(uint256,bytes32,bytes,address)
   *
   * ABI layout:
   *   [selector 4B]
   *   [0x00] transferId        — uint256
   *   [0x20] nullifier         — bytes32
   *   [0x40] proof offset      — uint256 (points to 0x80)
   *   [0x60] recipient         — address
   *   [0x80] proof length      — uint256
   *   [0xa0] proof data        — bytes (padded)
   */
  private encodeWithdrawDeposit(params: RelayClaimParams): string {
    const selector = functionSelector('withdrawDeposit(uint256,bytes32,bytes,address)')
    const proofOffset = padUint256(128n) // 4 slots * 32 = 128

    return selector
      + padUint256(params.transferId)
      + padBytes32(params.nullifier)
      + proofOffset
      + padAddress(params.recipient)
      + encodeBytes(params.proof)
  }

  /**
   * Encode relayedWithdrawETH(uint256,bytes32,bytes,address,uint256)
   *
   * ABI layout:
   *   [selector 4B]
   *   [0x00] transferId        — uint256
   *   [0x20] nullifier         — bytes32
   *   [0x40] proof offset      — uint256 (points to 0xa0)
   *   [0x60] recipient         — address
   *   [0x80] maxFee            — uint256
   *   [0xa0] proof length      — uint256
   *   [0xc0] proof data        — bytes (padded)
   */
  private encodeRelayedWithdrawETH(params: SyncFeeClaimParams): string {
    const selector = functionSelector('relayedWithdrawETH(uint256,bytes32,bytes,address,uint256)')
    const proofOffset = padUint256(160n) // 5 slots * 32 = 160

    return selector
      + padUint256(params.transferId)
      + padBytes32(params.nullifier)
      + proofOffset
      + padAddress(params.recipient)
      + padUint256(params.maxFee)
      + encodeBytes(params.proof)
  }

  /**
   * Encode relayedWithdrawToken(uint256,bytes32,bytes,address,address,uint256)
   *
   * ABI layout:
   *   [selector 4B]
   *   [0x00] transferId        — uint256
   *   [0x20] nullifier         — bytes32
   *   [0x40] proof offset      — uint256 (points to 0xc0)
   *   [0x60] recipient         — address
   *   [0x80] token             — address
   *   [0xa0] maxFee            — uint256
   *   [0xc0] proof length      — uint256
   *   [0xe0] proof data        — bytes (padded)
   */
  private encodeRelayedWithdrawToken(params: SyncFeeClaimParams): string {
    const selector = functionSelector('relayedWithdrawToken(uint256,bytes32,bytes,address,address,uint256)')
    const proofOffset = padUint256(192n) // 6 slots * 32 = 192

    return selector
      + padUint256(params.transferId)
      + padBytes32(params.nullifier)
      + proofOffset
      + padAddress(params.recipient)
      + padAddress(params.token!)
      + padUint256(params.maxFee)
      + encodeBytes(params.proof)
  }
}

/**
 * Factory function for creating a GelatoRelayAdapter.
 *
 * @example
 * ```typescript
 * // Sponsored mode (SIP pays gas)
 * const relay = createGelatoRelayAdapter({
 *   apiKey: 'gelato-api-key',
 *   chainId: 11155111,
 *   sipPrivacyAddress: '0x1FED...',
 * })
 * const result = await relay.sponsoredClaim({ transferId, nullifier, proof, recipient })
 *
 * // SyncFee mode (fee from withdrawal)
 * const relay = createGelatoRelayAdapter({
 *   chainId: 11155111,
 *   sipPrivacyAddress: '0x1FED...',
 *   sipRelayerAddress: '0xABC...',
 * })
 * const result = await relay.syncFeeClaim({ transferId, nullifier, proof, recipient, feeToken, maxFee })
 * ```
 */
export function createGelatoRelayAdapter(config: GelatoRelayConfig): GelatoRelayAdapter {
  return new GelatoRelayAdapter(config)
}
