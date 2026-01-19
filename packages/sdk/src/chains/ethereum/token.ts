/**
 * ERC-20 Token Helper for Privacy Transfers
 *
 * Handles token allowances, EIP-2612 permit signatures,
 * and metadata fetching for privacy-preserving token transfers.
 *
 * @module chains/ethereum/token
 */

import type { HexString } from '@sip-protocol/types'
import { EthereumRpcClient } from './rpc'
import { estimateTokenTransferGas, type DetailedGasEstimate } from './gas-estimation'
import type { EthereumNetwork } from './constants'
import { DEFAULT_GAS_LIMITS } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * ERC-20 token metadata
 */
export interface TokenMetadata {
  /**
   * Token name
   */
  name: string

  /**
   * Token symbol
   */
  symbol: string

  /**
   * Token decimals
   */
  decimals: number

  /**
   * Token contract address
   */
  address: HexString
}

/**
 * Token allowance info
 */
export interface TokenAllowance {
  /**
   * Owner address
   */
  owner: HexString

  /**
   * Spender address
   */
  spender: HexString

  /**
   * Current allowance
   */
  allowance: bigint

  /**
   * Token address
   */
  tokenAddress: HexString
}

/**
 * EIP-2612 permit data
 */
export interface PermitData {
  /**
   * Owner (signer) address
   */
  owner: HexString

  /**
   * Spender address
   */
  spender: HexString

  /**
   * Permit value
   */
  value: bigint

  /**
   * Permit nonce
   */
  nonce: bigint

  /**
   * Permit deadline (Unix timestamp)
   */
  deadline: bigint

  /**
   * Token address
   */
  tokenAddress: HexString
}

/**
 * EIP-712 typed data for permit signing
 */
export interface PermitTypedData {
  /**
   * Domain separator data
   */
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: HexString
  }

  /**
   * Types
   */
  types: {
    Permit: Array<{
      name: string
      type: string
    }>
  }

  /**
   * Primary type
   */
  primaryType: 'Permit'

  /**
   * Message to sign
   */
  message: {
    owner: HexString
    spender: HexString
    value: string
    nonce: string
    deadline: string
  }
}

/**
 * Prepared approval transaction
 */
export interface PreparedApproval {
  /**
   * Transaction data
   */
  tx: {
    to: HexString
    data: HexString
    value: bigint
  }

  /**
   * Token address
   */
  tokenAddress: HexString

  /**
   * Spender address
   */
  spender: HexString

  /**
   * Approval amount
   */
  amount: bigint

  /**
   * Estimated gas
   */
  estimatedGas: bigint
}

/**
 * Token transfer check result
 */
export interface TransferCheck {
  /**
   * Whether transfer is possible
   */
  canTransfer: boolean

  /**
   * Current token balance
   */
  balance: bigint

  /**
   * Current allowance for spender
   */
  allowance: bigint

  /**
   * Whether approval is needed
   */
  needsApproval: boolean

  /**
   * Amount of additional approval needed
   */
  additionalApprovalNeeded: bigint

  /**
   * Transfer amount
   */
  amount: bigint

  /**
   * Estimated gas for transfer (including approval if needed)
   */
  gasEstimate: DetailedGasEstimate
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * ERC-20 function selectors
 */
const ERC20_SELECTORS = {
  /**
   * name() returns (string)
   */
  name: '0x06fdde03',

  /**
   * symbol() returns (string)
   */
  symbol: '0x95d89b41',

  /**
   * decimals() returns (uint8)
   */
  decimals: '0x313ce567',

  /**
   * totalSupply() returns (uint256)
   */
  totalSupply: '0x18160ddd',

  /**
   * balanceOf(address) returns (uint256)
   */
  balanceOf: '0x70a08231',

  /**
   * allowance(address,address) returns (uint256)
   */
  allowance: '0xdd62ed3e',

  /**
   * approve(address,uint256) returns (bool)
   */
  approve: '0x095ea7b3',

  /**
   * transfer(address,uint256) returns (bool)
   */
  transfer: '0xa9059cbb',

  /**
   * transferFrom(address,address,uint256) returns (bool)
   */
  transferFrom: '0x23b872dd',

  /**
   * permit(address,address,uint256,uint256,uint8,bytes32,bytes32)
   */
  permit: '0xd505accf',

  /**
   * nonces(address) returns (uint256)
   */
  nonces: '0x7ecebe00',

  /**
   * DOMAIN_SEPARATOR() returns (bytes32)
   */
  domainSeparator: '0x3644e515',
} as const

/**
 * Maximum uint256 value for unlimited approval
 */
export const MAX_UINT256 = 2n ** 256n - 1n

// ─── Token Helper Class ──────────────────────────────────────────────────────

/**
 * ERC-20 Token Helper
 *
 * Provides utilities for working with ERC-20 tokens in privacy transfers:
 * - Metadata fetching (name, symbol, decimals)
 * - Balance and allowance checking
 * - Approval transaction building
 * - EIP-2612 permit support
 *
 * @example Basic usage
 * ```typescript
 * const helper = new TokenHelper('mainnet')
 *
 * // Get token info
 * const metadata = await helper.getTokenMetadata(usdcAddress)
 * console.log(metadata.symbol) // 'USDC'
 *
 * // Check if transfer is possible
 * const check = await helper.checkTransfer({
 *   owner: senderAddress,
 *   spender: routerAddress,
 *   tokenAddress: usdcAddress,
 *   amount: 100_000_000n,
 * })
 *
 * if (check.needsApproval) {
 *   const approval = helper.buildApproval(...)
 *   // Sign and submit approval
 * }
 * ```
 */
export class TokenHelper {
  private rpc: EthereumRpcClient
  private network: EthereumNetwork
  private metadataCache: Map<string, TokenMetadata> = new Map()

  constructor(
    network: EthereumNetwork = 'mainnet',
    options?: {
      rpcUrl?: string
    }
  ) {
    this.network = network
    this.rpc = new EthereumRpcClient(network, options)
  }

  // ─── Metadata Methods ────────────────────────────────────────────────────────

  /**
   * Get token metadata (name, symbol, decimals)
   *
   * Results are cached for performance.
   *
   * @param tokenAddress - Token contract address
   * @returns Token metadata
   */
  async getTokenMetadata(tokenAddress: HexString): Promise<TokenMetadata> {
    const cached = this.metadataCache.get(tokenAddress.toLowerCase())
    if (cached) {
      return cached
    }

    // Fetch name, symbol, decimals in parallel
    const [name, symbol, decimals] = await Promise.all([
      this.getTokenName(tokenAddress),
      this.getTokenSymbol(tokenAddress),
      this.getTokenDecimals(tokenAddress),
    ])

    const metadata: TokenMetadata = {
      name,
      symbol,
      decimals,
      address: tokenAddress,
    }

    this.metadataCache.set(tokenAddress.toLowerCase(), metadata)
    return metadata
  }

  /**
   * Get token name
   *
   * @param tokenAddress - Token contract address
   * @returns Token name
   */
  async getTokenName(tokenAddress: HexString): Promise<string> {
    try {
      const result = await this.rpc.call({
        to: tokenAddress,
        data: ERC20_SELECTORS.name as HexString,
      })
      return this.decodeString(result)
    } catch {
      return 'Unknown Token'
    }
  }

  /**
   * Get token symbol
   *
   * @param tokenAddress - Token contract address
   * @returns Token symbol
   */
  async getTokenSymbol(tokenAddress: HexString): Promise<string> {
    try {
      const result = await this.rpc.call({
        to: tokenAddress,
        data: ERC20_SELECTORS.symbol as HexString,
      })
      return this.decodeString(result)
    } catch {
      return 'UNKNOWN'
    }
  }

  /**
   * Get token decimals
   *
   * @param tokenAddress - Token contract address
   * @returns Token decimals (default: 18)
   */
  async getTokenDecimals(tokenAddress: HexString): Promise<number> {
    try {
      const result = await this.rpc.call({
        to: tokenAddress,
        data: ERC20_SELECTORS.decimals as HexString,
      })
      return parseInt(result, 16)
    } catch {
      return 18 // Default to 18 if call fails
    }
  }

  // ─── Balance Methods ─────────────────────────────────────────────────────────

  /**
   * Get token balance
   *
   * @param tokenAddress - Token contract address
   * @param owner - Address to check balance of
   * @returns Token balance
   */
  async getBalance(tokenAddress: HexString, owner: HexString): Promise<bigint> {
    const data = `${ERC20_SELECTORS.balanceOf}${owner.slice(2).padStart(64, '0')}` as HexString

    const result = await this.rpc.call({
      to: tokenAddress,
      data,
    })

    return BigInt(result)
  }

  // ─── Allowance Methods ───────────────────────────────────────────────────────

  /**
   * Get token allowance
   *
   * @param tokenAddress - Token contract address
   * @param owner - Token owner address
   * @param spender - Spender address
   * @returns Current allowance
   */
  async getAllowance(
    tokenAddress: HexString,
    owner: HexString,
    spender: HexString
  ): Promise<bigint> {
    const ownerParam = owner.slice(2).padStart(64, '0')
    const spenderParam = spender.slice(2).padStart(64, '0')
    const data = `${ERC20_SELECTORS.allowance}${ownerParam}${spenderParam}` as HexString

    const result = await this.rpc.call({
      to: tokenAddress,
      data,
    })

    return BigInt(result)
  }

  /**
   * Build an approval transaction
   *
   * @param tokenAddress - Token contract address
   * @param spender - Spender address to approve
   * @param amount - Amount to approve (use MAX_UINT256 for unlimited)
   * @returns Prepared approval transaction
   */
  buildApproval(
    tokenAddress: HexString,
    spender: HexString,
    amount: bigint = MAX_UINT256
  ): PreparedApproval {
    const spenderParam = spender.slice(2).padStart(64, '0')
    const amountParam = amount.toString(16).padStart(64, '0')
    const data = `${ERC20_SELECTORS.approve}${spenderParam}${amountParam}` as HexString

    return {
      tx: {
        to: tokenAddress,
        data,
        value: 0n,
      },
      tokenAddress,
      spender,
      amount,
      estimatedGas: DEFAULT_GAS_LIMITS.erc20Approve,
    }
  }

  /**
   * Check if transfer is possible and what approvals are needed
   *
   * @param params - Check parameters
   * @returns Transfer check result
   */
  async checkTransfer(params: {
    owner: HexString
    spender: HexString
    tokenAddress: HexString
    amount: bigint
  }): Promise<TransferCheck> {
    // Fetch balance and allowance in parallel
    const [balance, allowance] = await Promise.all([
      this.getBalance(params.tokenAddress, params.owner),
      this.getAllowance(params.tokenAddress, params.owner, params.spender),
    ])

    const needsApproval = allowance < params.amount
    const additionalApprovalNeeded = needsApproval
      ? params.amount - allowance
      : 0n

    const canTransfer = balance >= params.amount

    // Estimate gas
    const gasEstimate = estimateTokenTransferGas(this.network, needsApproval)

    return {
      canTransfer,
      balance,
      allowance,
      needsApproval,
      additionalApprovalNeeded,
      amount: params.amount,
      gasEstimate,
    }
  }

  // ─── Permit Methods ──────────────────────────────────────────────────────────

  /**
   * Check if token supports EIP-2612 permit
   *
   * @param tokenAddress - Token contract address
   * @returns True if permit is supported
   */
  async supportsPermit(tokenAddress: HexString): Promise<boolean> {
    try {
      // Try to call nonces() - if it exists, permit is likely supported
      await this.rpc.call({
        to: tokenAddress,
        data: `${ERC20_SELECTORS.nonces}${'0'.padStart(64, '0')}` as HexString,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get permit nonce for an address
   *
   * @param tokenAddress - Token contract address
   * @param owner - Address to get nonce for
   * @returns Permit nonce
   */
  async getPermitNonce(tokenAddress: HexString, owner: HexString): Promise<bigint> {
    const ownerParam = owner.slice(2).padStart(64, '0')
    const data = `${ERC20_SELECTORS.nonces}${ownerParam}` as HexString

    const result = await this.rpc.call({
      to: tokenAddress,
      data,
    })

    return BigInt(result)
  }

  /**
   * Build EIP-712 typed data for permit signing
   *
   * @param params - Permit parameters
   * @returns Typed data for signing
   */
  async buildPermitTypedData(params: {
    tokenAddress: HexString
    owner: HexString
    spender: HexString
    value: bigint
    deadline?: bigint
  }): Promise<PermitTypedData> {
    // Get token metadata and nonce
    const [metadata, nonce] = await Promise.all([
      this.getTokenMetadata(params.tokenAddress),
      this.getPermitNonce(params.tokenAddress, params.owner),
    ])

    // Default deadline: 1 hour from now
    const deadline = params.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600)

    return {
      domain: {
        name: metadata.name,
        version: '1',
        chainId: this.rpc.getChainId(),
        verifyingContract: params.tokenAddress,
      },
      types: {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Permit',
      message: {
        owner: params.owner,
        spender: params.spender,
        value: params.value.toString(),
        nonce: nonce.toString(),
        deadline: deadline.toString(),
      },
    }
  }

  /**
   * Build permit call data from signature
   *
   * @param params - Permit parameters with signature
   * @returns Call data for permit function
   */
  buildPermitCallData(params: {
    owner: HexString
    spender: HexString
    value: bigint
    deadline: bigint
    v: number
    r: HexString
    s: HexString
  }): HexString {
    const ownerParam = params.owner.slice(2).padStart(64, '0')
    const spenderParam = params.spender.slice(2).padStart(64, '0')
    const valueParam = params.value.toString(16).padStart(64, '0')
    const deadlineParam = params.deadline.toString(16).padStart(64, '0')
    const vParam = params.v.toString(16).padStart(64, '0')
    const rParam = params.r.slice(2).padStart(64, '0')
    const sParam = params.s.slice(2).padStart(64, '0')

    return `${ERC20_SELECTORS.permit}${ownerParam}${spenderParam}${valueParam}${deadlineParam}${vParam}${rParam}${sParam}` as HexString
  }

  // ─── Utility Methods ─────────────────────────────────────────────────────────

  /**
   * Format token amount with decimals
   *
   * @param amount - Raw amount
   * @param decimals - Token decimals
   * @returns Formatted string
   */
  formatAmount(amount: bigint, decimals: number): string {
    const divisor = 10n ** BigInt(decimals)
    const whole = amount / divisor
    const fraction = amount % divisor

    if (fraction === 0n) {
      return whole.toString()
    }

    const fractionStr = fraction.toString().padStart(decimals, '0')
    const trimmed = fractionStr.replace(/0+$/, '')

    return `${whole}.${trimmed}`
  }

  /**
   * Parse token amount from string
   *
   * @param amount - Amount string (e.g., "100.5")
   * @param decimals - Token decimals
   * @returns Raw amount
   */
  parseAmount(amount: string, decimals: number): bigint {
    const [whole, fraction = ''] = amount.split('.')
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
    const combined = `${whole}${paddedFraction}`

    return BigInt(combined)
  }

  /**
   * Get network
   */
  getNetwork(): EthereumNetwork {
    return this.network
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear()
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  /**
   * Decode ABI-encoded string
   */
  private decodeString(data: HexString): string {
    // Remove 0x prefix
    const hex = data.slice(2)

    // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
    if (hex.length < 128) {
      // Might be raw bytes32 string (some older tokens)
      return this.decodeBytesString(hex)
    }

    // Skip offset (first 32 bytes)
    // Get length (next 32 bytes)
    const lengthHex = hex.slice(64, 128)
    const length = parseInt(lengthHex, 16)

    if (length === 0 || length > 256) {
      return this.decodeBytesString(hex)
    }

    // Get string data
    const stringHex = hex.slice(128, 128 + length * 2)

    // Decode hex to string
    let result = ''
    for (let i = 0; i < stringHex.length; i += 2) {
      const charCode = parseInt(stringHex.substr(i, 2), 16)
      if (charCode === 0) break
      result += String.fromCharCode(charCode)
    }

    return result
  }

  /**
   * Decode bytes32 string (for non-standard tokens)
   */
  private decodeBytesString(hex: string): string {
    let result = ''
    for (let i = 0; i < Math.min(hex.length, 64); i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16)
      if (charCode === 0) break
      result += String.fromCharCode(charCode)
    }
    return result.trim() || 'Unknown'
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a token helper for a network
 *
 * @param network - Target network
 * @param rpcUrl - Optional custom RPC URL
 * @returns Token helper
 */
export function createTokenHelper(
  network: EthereumNetwork = 'mainnet',
  rpcUrl?: string
): TokenHelper {
  return new TokenHelper(network, { rpcUrl })
}

/**
 * Create a mainnet token helper
 */
export function createMainnetTokenHelper(rpcUrl?: string): TokenHelper {
  return new TokenHelper('mainnet', { rpcUrl })
}

/**
 * Create a Sepolia testnet token helper
 */
export function createSepoliaTokenHelper(rpcUrl?: string): TokenHelper {
  return new TokenHelper('sepolia', { rpcUrl })
}
