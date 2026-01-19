/**
 * Ethereum Stealth Transfer Builder
 *
 * High-level transfer orchestration that combines stealth address generation,
 * announcement building, gas estimation, and transaction preparation.
 *
 * @module chains/ethereum/transfer
 */

import type { HexString, StealthMetaAddress } from '@sip-protocol/types'
import { EthereumPrivacyAdapter } from './privacy-adapter'
import { EthereumRpcClient } from './rpc'
import {
  estimateEthTransferGas,
  estimateTokenTransferGas,
  type DetailedGasEstimate,
} from './gas-estimation'
import type { EthereumNetwork } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Prepared transaction ready for signing
 */
export interface PreparedTransaction {
  /**
   * Target address
   */
  to: HexString

  /**
   * Value in wei
   */
  value: bigint

  /**
   * Call data (if contract call)
   */
  data?: HexString

  /**
   * Nonce
   */
  nonce: number

  /**
   * Gas limit
   */
  gasLimit: bigint

  /**
   * Chain ID
   */
  chainId: number

  /**
   * EIP-1559: Max priority fee per gas
   */
  maxPriorityFeePerGas: bigint

  /**
   * EIP-1559: Max fee per gas
   */
  maxFeePerGas: bigint

  /**
   * Transaction type (2 = EIP-1559)
   */
  type: 2
}

/**
 * Prepared stealth transfer bundle
 */
export interface PreparedStealthTransfer {
  /**
   * ETH/token transfer transaction
   */
  transferTx: PreparedTransaction

  /**
   * Announcement transaction
   */
  announcementTx: PreparedTransaction

  /**
   * Stealth address receiving funds
   */
  stealthAddress: HexString

  /**
   * Ephemeral public key for recipient
   */
  ephemeralPublicKey: HexString

  /**
   * View tag for efficient scanning
   */
  viewTag: number

  /**
   * Amount commitment (if hiding amounts)
   */
  amountCommitment?: HexString

  /**
   * Blinding factor (if hiding amounts)
   */
  blindingFactor?: HexString

  /**
   * Gas estimate breakdown
   */
  gasEstimate: DetailedGasEstimate

  /**
   * Total cost estimate (gas + value)
   */
  totalCostWei: bigint
}

/**
 * Transfer execution result
 */
export interface TransferResult {
  /**
   * Transfer transaction hash
   */
  transferTxHash: HexString

  /**
   * Announcement transaction hash
   */
  announcementTxHash: HexString

  /**
   * Stealth address funds were sent to
   */
  stealthAddress: HexString

  /**
   * Amount transferred
   */
  amount: bigint

  /**
   * Token address (if ERC-20)
   */
  tokenAddress?: HexString

  /**
   * Ephemeral public key
   */
  ephemeralPublicKey: HexString

  /**
   * View tag
   */
  viewTag: number
}

/**
 * Claim build result
 */
export interface PreparedClaim {
  /**
   * Claim transaction
   */
  claimTx: PreparedTransaction

  /**
   * Stealth address to claim from
   */
  stealthAddress: HexString

  /**
   * Derived private key for stealth address
   */
  stealthPrivateKey: HexString

  /**
   * Destination address
   */
  destinationAddress: HexString

  /**
   * Amount being claimed
   */
  amount: bigint

  /**
   * Token address (if ERC-20)
   */
  tokenAddress?: HexString
}

// ─── Transfer Builder Class ──────────────────────────────────────────────────

/**
 * Ethereum Stealth Transfer Builder
 *
 * Orchestrates the complete flow for privacy transfers:
 * 1. Generate stealth address from recipient's meta-address
 * 2. Build transfer and announcement transactions
 * 3. Estimate gas and prepare for signing
 * 4. Track submissions and confirmations
 *
 * @example Complete flow
 * ```typescript
 * const builder = new StealthTransferBuilder('mainnet', {
 *   rpcUrl: 'https://eth.llamarpc.com',
 * })
 *
 * // Prepare transfer
 * const prepared = await builder.prepareEthTransfer({
 *   from: senderAddress,
 *   recipient: recipientMetaAddress,
 *   amount: toWei(1), // 1 ETH
 * })
 *
 * // Sign transactions (with your wallet)
 * const signedTransfer = await wallet.signTransaction(prepared.transferTx)
 * const signedAnnouncement = await wallet.signTransaction(prepared.announcementTx)
 *
 * // Submit
 * const result = await builder.submitTransfer({
 *   signedTransferTx: signedTransfer,
 *   signedAnnouncementTx: signedAnnouncement,
 * })
 * ```
 */
export class StealthTransferBuilder {
  private adapter: EthereumPrivacyAdapter
  private rpc: EthereumRpcClient
  private network: EthereumNetwork
  private chainId: number

  constructor(
    network: EthereumNetwork = 'mainnet',
    options?: {
      rpcUrl?: string
      announcerAddress?: HexString
    }
  ) {
    this.network = network
    this.adapter = new EthereumPrivacyAdapter({
      network,
      announcerAddress: options?.announcerAddress,
    })
    this.rpc = new EthereumRpcClient(network, { rpcUrl: options?.rpcUrl })
    this.chainId = this.rpc.getChainId()
  }

  // ─── ETH Transfer Methods ────────────────────────────────────────────────────

  /**
   * Prepare an ETH stealth transfer
   *
   * Generates stealth address, builds transactions, estimates gas.
   *
   * @param params - Transfer parameters
   * @returns Prepared transactions ready for signing
   */
  async prepareEthTransfer(params: {
    from: HexString
    recipient: StealthMetaAddress | string
    amount: bigint
    memo?: string
  }): Promise<PreparedStealthTransfer> {
    // Build shielded transfer
    const build = this.adapter.buildShieldedTransfer({
      recipient: params.recipient,
      amount: params.amount,
      memo: params.memo,
    })

    // Get fee data and nonces
    const [feeData, nonce] = await Promise.all([
      this.rpc.getFeeData(),
      this.rpc.getNextNonce(params.from),
    ])

    // Reserve nonces for both transactions
    const transferNonce = nonce
    const announcementNonce = nonce + 1

    // Get gas estimate
    const gasEstimate = estimateEthTransferGas(this.network)

    // Prepare transfer transaction
    const transferTx: PreparedTransaction = {
      to: build.stealthEthAddress,
      value: params.amount,
      nonce: transferNonce,
      gasLimit: gasEstimate.breakdown.transferGas,
      chainId: this.chainId,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      maxFeePerGas: feeData.maxFeePerGas,
      type: 2,
    }

    // Prepare announcement transaction
    const announcementTx: PreparedTransaction = {
      to: build.announcementTx.to,
      value: 0n,
      data: build.announcementTx.data,
      nonce: announcementNonce,
      gasLimit: gasEstimate.breakdown.announcementGas,
      chainId: this.chainId,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      maxFeePerGas: feeData.maxFeePerGas,
      type: 2,
    }

    // Calculate total cost
    const totalGasCost = gasEstimate.estimatedCostWei
    const totalCostWei = params.amount + totalGasCost

    return {
      transferTx,
      announcementTx,
      stealthAddress: build.stealthEthAddress,
      ephemeralPublicKey: build.ephemeralPublicKey,
      viewTag: build.viewTag,
      amountCommitment: build.amountCommitment,
      blindingFactor: build.blindingFactor,
      gasEstimate,
      totalCostWei,
    }
  }

  // ─── Token Transfer Methods ──────────────────────────────────────────────────

  /**
   * Prepare an ERC-20 token stealth transfer
   *
   * @param params - Transfer parameters
   * @returns Prepared transactions ready for signing
   */
  async prepareTokenTransfer(params: {
    from: HexString
    recipient: StealthMetaAddress | string
    amount: bigint
    tokenContract: HexString
    decimals?: number
    memo?: string
  }): Promise<PreparedStealthTransfer & { tokenTransferData: HexString }> {
    // Build shielded token transfer
    const build = this.adapter.buildShieldedTokenTransfer({
      recipient: params.recipient,
      amount: params.amount,
      tokenContract: params.tokenContract,
      decimals: params.decimals,
      memo: params.memo,
    })

    // Get fee data and nonces
    const [feeData, nonce] = await Promise.all([
      this.rpc.getFeeData(),
      this.rpc.getNextNonce(params.from),
    ])

    // Reserve nonces
    const transferNonce = nonce
    const announcementNonce = nonce + 1

    // Get gas estimate (without approval - caller handles that)
    const gasEstimate = estimateTokenTransferGas(this.network, false)

    // Prepare transfer transaction
    const transferTx: PreparedTransaction = {
      to: params.tokenContract,
      value: 0n,
      data: build.tokenTransferData,
      nonce: transferNonce,
      gasLimit: gasEstimate.breakdown.transferGas,
      chainId: this.chainId,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      maxFeePerGas: feeData.maxFeePerGas,
      type: 2,
    }

    // Prepare announcement transaction
    const announcementTx: PreparedTransaction = {
      to: build.announcementTx.to,
      value: 0n,
      data: build.announcementTx.data,
      nonce: announcementNonce,
      gasLimit: gasEstimate.breakdown.announcementGas,
      chainId: this.chainId,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      maxFeePerGas: feeData.maxFeePerGas,
      type: 2,
    }

    return {
      transferTx,
      announcementTx,
      stealthAddress: build.stealthEthAddress,
      ephemeralPublicKey: build.ephemeralPublicKey,
      viewTag: build.viewTag,
      amountCommitment: build.amountCommitment,
      blindingFactor: build.blindingFactor,
      gasEstimate,
      totalCostWei: gasEstimate.estimatedCostWei,
      tokenTransferData: build.tokenTransferData,
    }
  }

  // ─── Submit Methods ──────────────────────────────────────────────────────────

  /**
   * Submit signed transfer transactions
   *
   * Submits both transfer and announcement, waits for confirmations.
   *
   * @param params - Signed transaction data
   * @returns Submission result
   */
  async submitTransfer(params: {
    signedTransferTx: HexString
    signedAnnouncementTx: HexString
    stealthAddress: HexString
    ephemeralPublicKey: HexString
    viewTag: number
    amount: bigint
    tokenAddress?: HexString
    waitForConfirmation?: boolean
  }): Promise<TransferResult> {
    // Submit transfer first
    const transferTxHash = await this.rpc.sendRawTransaction(params.signedTransferTx)

    // Submit announcement
    const announcementTxHash = await this.rpc.sendRawTransaction(params.signedAnnouncementTx)

    // Optionally wait for confirmations
    if (params.waitForConfirmation !== false) {
      await Promise.all([
        this.rpc.waitForTransaction(transferTxHash, 1),
        this.rpc.waitForTransaction(announcementTxHash, 1),
      ])
    }

    return {
      transferTxHash,
      announcementTxHash,
      stealthAddress: params.stealthAddress,
      amount: params.amount,
      tokenAddress: params.tokenAddress,
      ephemeralPublicKey: params.ephemeralPublicKey,
      viewTag: params.viewTag,
    }
  }

  // ─── Claim Methods ───────────────────────────────────────────────────────────

  /**
   * Prepare a claim transaction
   *
   * @param params - Claim parameters
   * @returns Prepared claim transaction
   */
  async prepareClaim(params: {
    stealthAddress: {
      address: HexString
      ephemeralPublicKey: HexString
      viewTag: number
    }
    viewingPrivateKey: HexString
    spendingPrivateKey: HexString
    destinationAddress: HexString
    amount: bigint
    tokenContract?: HexString
  }): Promise<PreparedClaim> {
    // Build claim transaction
    const build = this.adapter.buildClaimTransaction({
      stealthAddress: params.stealthAddress,
      ephemeralPublicKey: params.stealthAddress.ephemeralPublicKey,
      viewingPrivateKey: params.viewingPrivateKey,
      spendingPrivateKey: params.spendingPrivateKey,
      destinationAddress: params.destinationAddress,
      amount: params.amount,
      tokenContract: params.tokenContract,
    })

    // Get fee data - note: we use the stealth address as "from"
    const feeData = await this.rpc.getFeeData()

    // For claims, nonce needs to be fetched for the stealth address
    // But we can't know it without the RPC having the address funded
    // We'll set nonce to 0 as stealth addresses typically have no prior txs
    const nonce = 0

    // Prepare claim transaction
    const claimTx: PreparedTransaction = {
      to: build.tx.to,
      value: build.tx.value,
      data: build.tx.data,
      nonce,
      gasLimit: build.estimatedGas,
      chainId: this.chainId,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      maxFeePerGas: feeData.maxFeePerGas,
      type: 2,
    }

    return {
      claimTx,
      stealthAddress: build.stealthEthAddress,
      stealthPrivateKey: build.stealthPrivateKey,
      destinationAddress: params.destinationAddress,
      amount: params.amount,
      tokenAddress: params.tokenContract,
    }
  }

  /**
   * Submit a signed claim transaction
   *
   * @param signedTx - Signed claim transaction
   * @param waitForConfirmation - Whether to wait for confirmation
   * @returns Transaction hash
   */
  async submitClaim(
    signedTx: HexString,
    waitForConfirmation: boolean = true
  ): Promise<HexString> {
    const txHash = await this.rpc.sendRawTransaction(signedTx)

    if (waitForConfirmation) {
      await this.rpc.waitForTransaction(txHash, 1)
    }

    return txHash
  }

  // ─── Balance Methods ─────────────────────────────────────────────────────────

  /**
   * Get ETH balance of an address
   *
   * @param address - Address to check
   * @returns Balance in wei
   */
  async getBalance(address: HexString): Promise<bigint> {
    return this.rpc.getBalance(address)
  }

  /**
   * Check if sender has sufficient balance for transfer
   *
   * @param sender - Sender address
   * @param amount - Amount to transfer
   * @param isToken - Whether this is a token transfer
   * @returns True if sufficient balance
   */
  async hasSufficientBalance(
    sender: HexString,
    amount: bigint,
    isToken: boolean = false
  ): Promise<{ sufficient: boolean; balance: bigint; required: bigint }> {
    const balance = await this.rpc.getBalance(sender)

    // For token transfers, only need gas
    const gasEstimate = isToken
      ? estimateTokenTransferGas(this.network)
      : estimateEthTransferGas(this.network)

    const required = isToken ? gasEstimate.estimatedCostWei : amount + gasEstimate.estimatedCostWei

    return {
      sufficient: balance >= required,
      balance,
      required,
    }
  }

  // ─── Utility Methods ─────────────────────────────────────────────────────────

  /**
   * Get the privacy adapter
   */
  getAdapter(): EthereumPrivacyAdapter {
    return this.adapter
  }

  /**
   * Get the RPC client
   */
  getRpcClient(): EthereumRpcClient {
    return this.rpc
  }

  /**
   * Get network
   */
  getNetwork(): EthereumNetwork {
    return this.network
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.chainId
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a stealth transfer builder
 *
 * @param network - Target network
 * @param rpcUrl - Optional custom RPC URL
 * @returns Transfer builder
 */
export function createStealthTransferBuilder(
  network: EthereumNetwork = 'mainnet',
  rpcUrl?: string
): StealthTransferBuilder {
  return new StealthTransferBuilder(network, { rpcUrl })
}

/**
 * Create a mainnet transfer builder
 */
export function createMainnetTransferBuilder(rpcUrl?: string): StealthTransferBuilder {
  return new StealthTransferBuilder('mainnet', { rpcUrl })
}

/**
 * Create a Sepolia testnet transfer builder
 */
export function createSepoliaTransferBuilder(rpcUrl?: string): StealthTransferBuilder {
  return new StealthTransferBuilder('sepolia', { rpcUrl })
}
