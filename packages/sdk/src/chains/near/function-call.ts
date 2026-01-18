/**
 * NEAR Function Call Privacy Wrapper
 *
 * Privacy-preserving contract interactions using stealth accounts.
 * Enables private DeFi, NFT, and smart contract interactions while
 * hiding caller identity.
 *
 * @example Private contract call from stealth account
 * ```typescript
 * import { buildPrivateFunctionCall } from '@sip-protocol/sdk'
 *
 * const result = buildPrivateFunctionCall({
 *   contractId: 'dex.near',
 *   methodName: 'swap',
 *   args: { token_in: 'usdc.near', amount: '1000000' },
 *   deposit: ONE_NEAR,
 *   hideDeposit: true,
 * })
 * ```
 *
 * @example Private NFT mint
 * ```typescript
 * const result = buildPrivateNFTMint({
 *   contractId: 'nft.near',
 *   receiverMetaAddress: 'sip:near:0x...',
 *   tokenId: 'token-1',
 *   metadata: { title: 'My NFT' },
 * })
 * ```
 *
 * @packageDocumentation
 */

import type { StealthAddress, StealthMetaAddress } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { isValidAccountId, ONE_YOCTO } from './constants'
import { generateNEARStealthAddress, parseNEARStealthMetaAddress } from './stealth'
import { createAnnouncementMemo } from './types'
import { commitNEAR, type NEARPedersenCommitment } from './commitment'
import type {
  NEARAction,
  NEARFunctionCallAction,
  NEARAddKeyAction,
} from './implicit-account'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Parameters for a private function call
 */
export interface PrivateFunctionCallParams {
  /** Contract to call */
  contractId: string
  /** Method name to invoke */
  methodName: string
  /** Method arguments (will be JSON stringified) */
  args?: Record<string, unknown>
  /** NEAR deposit to attach (default: 0) */
  deposit?: bigint
  /** Gas to attach (default: DEFAULT_GAS) */
  gas?: bigint
  /** Hide deposit amount with commitment */
  hideDeposit?: boolean
}

/**
 * Result of building a private function call
 */
export interface PrivateFunctionCallResult {
  /** Transaction actions */
  actions: NEARAction[]
  /** Receiver ID (the contract) */
  receiverId: string
  /** Deposit commitment (if hideDeposit is true) */
  depositCommitment?: NEARPedersenCommitment
  /** Gas attached */
  gasAttached: bigint
  /** Deposit attached */
  depositAttached: bigint
}

/**
 * Parameters for a private function call from a stealth account
 */
export interface PrivateFunctionCallFromStealthParams extends PrivateFunctionCallParams {
  /** Stealth account ID to call from */
  stealthAccountId: string
}

/**
 * Parameters for building a multi-step private transaction
 */
export interface MultiStepPrivateTransactionParams {
  /** Steps to execute in order */
  steps: Array<{
    /** Contract to call */
    contractId: string
    /** Method name */
    methodName: string
    /** Method arguments */
    args?: Record<string, unknown>
    /** Deposit for this step */
    deposit?: bigint
    /** Gas for this step */
    gas?: bigint
  }>
  /** Total gas budget for all steps */
  totalGas?: bigint
}

/**
 * Result of building a multi-step private transaction
 */
export interface MultiStepPrivateTransactionResult {
  /** Individual step builds */
  steps: Array<{
    actions: NEARAction[]
    receiverId: string
    deposit: bigint
    gas: bigint
  }>
  /** Total deposit across all steps */
  totalDeposit: bigint
  /** Total gas across all steps */
  totalGas: bigint
}

/**
 * Parameters for function call access key
 */
export interface FunctionCallAccessKeyParams {
  /** Public key to add (ed25519:base58 format) */
  publicKey: string
  /** Contract the key can call */
  receiverId: string
  /** Methods the key can call (empty = all methods) */
  methodNames: string[]
  /** Allowance in yoctoNEAR (optional) */
  allowance?: bigint
}

/**
 * Parameters for private NFT mint
 */
export interface PrivateNFTMintParams {
  /** NFT contract address */
  contractId: string
  /** Recipient's stealth meta-address */
  receiverMetaAddress: StealthMetaAddress | string
  /** Token ID */
  tokenId: string
  /** Token metadata */
  metadata?: {
    title?: string
    description?: string
    media?: string
    copies?: number
  }
  /** Deposit for storage (default: 0.1 NEAR) */
  deposit?: bigint
}

/**
 * Result of building a private NFT mint
 */
export interface PrivateNFTMintResult {
  /** Transaction actions */
  actions: NEARAction[]
  /** NFT contract address */
  receiverId: string
  /** Stealth address receiving the NFT */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
  /** Announcement memo */
  announcementMemo: string
}

/**
 * Parameters for private DeFi swap
 */
export interface PrivateDeFiSwapParams {
  /** DEX contract address */
  dexContract: string
  /** Token to swap from */
  tokenIn: string
  /** Token to swap to */
  tokenOut: string
  /** Amount to swap (in smallest units) */
  amountIn: bigint
  /** Minimum amount to receive */
  minAmountOut: bigint
  /** Recipient's stealth meta-address for output */
  receiverMetaAddress: StealthMetaAddress | string
  /** Slippage tolerance (default: 0.5%) */
  slippageBps?: number
}

/**
 * Result of building a private DeFi swap
 */
export interface PrivateDeFiSwapResult {
  /** Transaction actions */
  actions: NEARAction[]
  /** DEX contract address */
  receiverId: string
  /** Stealth address receiving swap output */
  stealthAddress: StealthAddress
  /** NEAR implicit account ID */
  stealthAccountId: string
  /** Announcement memo */
  announcementMemo: string
  /** Expected output amount */
  expectedOutput: bigint
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default gas for function calls (30 TGas)
 */
export const FUNCTION_CALL_DEFAULT_GAS = 30_000_000_000_000n

/**
 * Gas for NFT mint operations (50 TGas)
 */
export const NFT_MINT_GAS = 50_000_000_000_000n

/**
 * Default deposit for NFT storage (0.1 NEAR)
 */
export const NFT_STORAGE_DEPOSIT = 100_000_000_000_000_000_000_000n

/**
 * Gas for DEX swap operations (100 TGas)
 */
export const DEX_SWAP_GAS = 100_000_000_000_000n

// ─── Private Function Calls ───────────────────────────────────────────────────

/**
 * Build a private function call
 *
 * Creates a function call action that can be executed from a stealth account,
 * optionally hiding the deposit amount with a Pedersen commitment.
 *
 * @param params - Function call parameters
 * @returns Function call build
 *
 * @example
 * ```typescript
 * const result = buildPrivateFunctionCall({
 *   contractId: 'dex.near',
 *   methodName: 'swap',
 *   args: { token_in: 'usdc.near', amount: '1000000' },
 *   deposit: ONE_NEAR,
 *   hideDeposit: true,
 * })
 * ```
 */
export function buildPrivateFunctionCall(
  params: PrivateFunctionCallParams
): PrivateFunctionCallResult {
  const {
    contractId,
    methodName,
    args = {},
    deposit = 0n,
    gas = FUNCTION_CALL_DEFAULT_GAS,
    hideDeposit = false,
  } = params

  // Validate contract ID
  if (!isValidAccountId(contractId)) {
    throw new ValidationError('Invalid contractId', 'contractId')
  }

  // Validate method name
  if (!methodName || methodName.length === 0) {
    throw new ValidationError('methodName is required', 'methodName')
  }

  // Validate gas
  if (gas <= 0n) {
    throw new ValidationError('gas must be greater than 0', 'gas')
  }

  // Validate deposit
  if (deposit < 0n) {
    throw new ValidationError('deposit cannot be negative', 'deposit')
  }

  // Create deposit commitment if requested
  let depositCommitment: NEARPedersenCommitment | undefined
  if (hideDeposit && deposit > 0n) {
    depositCommitment = commitNEAR(deposit)
  }

  // Build function call args
  const argsString = JSON.stringify(args)

  // Build function call action
  const actions: NEARAction[] = [
    {
      type: 'FunctionCall',
      params: {
        methodName,
        args: argsString,
        gas,
        deposit,
      } as NEARFunctionCallAction,
    },
  ]

  return {
    actions,
    receiverId: contractId,
    depositCommitment,
    gasAttached: gas,
    depositAttached: deposit,
  }
}

/**
 * Build a batch of private function calls
 *
 * Creates multiple function call actions for a single transaction.
 * All calls are to the same contract.
 *
 * @param contractId - Contract to call
 * @param calls - List of method calls
 * @returns Batch function call build
 */
export function buildBatchPrivateFunctionCalls(
  contractId: string,
  calls: Array<{
    methodName: string
    args?: Record<string, unknown>
    deposit?: bigint
    gas?: bigint
  }>
): PrivateFunctionCallResult {
  if (!isValidAccountId(contractId)) {
    throw new ValidationError('Invalid contractId', 'contractId')
  }

  if (!calls || calls.length === 0) {
    throw new ValidationError('At least one call is required', 'calls')
  }

  if (calls.length > 10) {
    throw new ValidationError('Maximum 10 calls per batch', 'calls')
  }

  const actions: NEARAction[] = []
  let totalDeposit = 0n
  let totalGas = 0n

  for (const call of calls) {
    const {
      methodName,
      args = {},
      deposit = 0n,
      gas = FUNCTION_CALL_DEFAULT_GAS,
    } = call

    if (!methodName || methodName.length === 0) {
      throw new ValidationError('methodName is required for each call', 'calls')
    }

    actions.push({
      type: 'FunctionCall',
      params: {
        methodName,
        args: JSON.stringify(args),
        gas,
        deposit,
      } as NEARFunctionCallAction,
    })

    totalDeposit += deposit
    totalGas += gas
  }

  return {
    actions,
    receiverId: contractId,
    gasAttached: totalGas,
    depositAttached: totalDeposit,
  }
}

/**
 * Build a multi-step private transaction
 *
 * For transactions that need to call multiple contracts in sequence.
 * Returns separate transaction builds for each step.
 *
 * @param params - Multi-step transaction parameters
 * @returns Multi-step transaction build
 */
export function buildMultiStepPrivateTransaction(
  params: MultiStepPrivateTransactionParams
): MultiStepPrivateTransactionResult {
  const { steps, totalGas } = params

  if (!steps || steps.length === 0) {
    throw new ValidationError('At least one step is required', 'steps')
  }

  if (steps.length > 10) {
    throw new ValidationError('Maximum 10 steps per transaction', 'steps')
  }

  const results: MultiStepPrivateTransactionResult['steps'] = []
  let totalDeposit = 0n
  let calculatedTotalGas = 0n

  // Calculate gas per step if total is specified
  const gasPerStep = totalGas
    ? totalGas / BigInt(steps.length)
    : undefined

  for (const step of steps) {
    const {
      contractId,
      methodName,
      args = {},
      deposit = 0n,
      gas = gasPerStep ?? FUNCTION_CALL_DEFAULT_GAS,
    } = step

    if (!isValidAccountId(contractId)) {
      throw new ValidationError(`Invalid contractId: ${contractId}`, 'steps')
    }

    if (!methodName || methodName.length === 0) {
      throw new ValidationError('methodName is required for each step', 'steps')
    }

    const actions: NEARAction[] = [
      {
        type: 'FunctionCall',
        params: {
          methodName,
          args: JSON.stringify(args),
          gas,
          deposit,
        } as NEARFunctionCallAction,
      },
    ]

    results.push({
      actions,
      receiverId: contractId,
      deposit,
      gas,
    })

    totalDeposit += deposit
    calculatedTotalGas += gas
  }

  return {
    steps: results,
    totalDeposit,
    totalGas: calculatedTotalGas,
  }
}

// ─── Access Key Management ────────────────────────────────────────────────────

/**
 * Build function call access key for a stealth account
 *
 * Allows adding a limited access key to a stealth account that can
 * only call specific methods on a specific contract.
 *
 * @param params - Access key parameters
 * @returns Add key action
 *
 * @example
 * ```typescript
 * const action = buildFunctionCallAccessKey({
 *   publicKey: 'ed25519:...',
 *   receiverId: 'dex.near',
 *   methodNames: ['swap', 'deposit', 'withdraw'],
 *   allowance: ONE_NEAR,
 * })
 * ```
 */
export function buildFunctionCallAccessKey(
  params: FunctionCallAccessKeyParams
): NEARAction {
  const {
    publicKey,
    receiverId,
    methodNames,
    allowance,
  } = params

  // Validate public key format
  if (!publicKey.startsWith('ed25519:')) {
    throw new ValidationError(
      'publicKey must be in ed25519:base58 format',
      'publicKey'
    )
  }

  // Validate receiver
  if (!isValidAccountId(receiverId)) {
    throw new ValidationError('Invalid receiverId', 'receiverId')
  }

  return {
    type: 'AddKey',
    params: {
      publicKey,
      accessKey: {
        permission: {
          FunctionCall: {
            allowance,
            receiverId,
            methodNames,
          },
        },
      },
    } as NEARAddKeyAction,
  }
}

// ─── NFT Privacy ──────────────────────────────────────────────────────────────

/**
 * Build a private NFT mint
 *
 * Mints an NFT to a stealth address, hiding the recipient's identity.
 *
 * @param params - NFT mint parameters
 * @returns NFT mint build
 *
 * @example
 * ```typescript
 * const result = buildPrivateNFTMint({
 *   contractId: 'nft.near',
 *   receiverMetaAddress: 'sip:near:0x...',
 *   tokenId: 'token-1',
 *   metadata: { title: 'Private NFT' },
 * })
 * ```
 */
export function buildPrivateNFTMint(
  params: PrivateNFTMintParams
): PrivateNFTMintResult {
  const {
    contractId,
    receiverMetaAddress,
    tokenId,
    metadata = {},
    deposit = NFT_STORAGE_DEPOSIT,
  } = params

  // Validate contract
  if (!isValidAccountId(contractId)) {
    throw new ValidationError('Invalid NFT contractId', 'contractId')
  }

  // Parse meta-address if string
  const metaAddr = typeof receiverMetaAddress === 'string'
    ? parseNEARStealthMetaAddress(receiverMetaAddress)
    : receiverMetaAddress

  // Validate chain
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'receiverMetaAddress'
    )
  }

  // Generate stealth address for receiver
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Build NFT mint args (NEP-171 standard)
  const args = {
    token_id: tokenId,
    receiver_id: implicitAccountId,
    token_metadata: {
      title: metadata.title,
      description: metadata.description,
      media: metadata.media,
      copies: metadata.copies,
    },
    memo: announcementMemo,
  }

  // Build mint action
  const actions: NEARAction[] = [
    {
      type: 'FunctionCall',
      params: {
        methodName: 'nft_mint',
        args: JSON.stringify(args),
        gas: NFT_MINT_GAS,
        deposit,
      } as NEARFunctionCallAction,
    },
  ]

  return {
    actions,
    receiverId: contractId,
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
  }
}

/**
 * Build a private NFT transfer
 *
 * Transfers an NFT to a stealth address.
 *
 * @param contractId - NFT contract address
 * @param tokenId - Token ID to transfer
 * @param receiverMetaAddress - Recipient's stealth meta-address
 * @returns NFT transfer build
 */
export function buildPrivateNFTTransfer(
  contractId: string,
  tokenId: string,
  receiverMetaAddress: StealthMetaAddress | string
): PrivateNFTMintResult {
  // Validate contract
  if (!isValidAccountId(contractId)) {
    throw new ValidationError('Invalid NFT contractId', 'contractId')
  }

  // Parse meta-address if string
  const metaAddr = typeof receiverMetaAddress === 'string'
    ? parseNEARStealthMetaAddress(receiverMetaAddress)
    : receiverMetaAddress

  // Validate chain
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'receiverMetaAddress'
    )
  }

  // Generate stealth address for receiver
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Build NFT transfer args (NEP-171 standard)
  const args = {
    token_id: tokenId,
    receiver_id: implicitAccountId,
    memo: announcementMemo,
  }

  // Build transfer action
  const actions: NEARAction[] = [
    {
      type: 'FunctionCall',
      params: {
        methodName: 'nft_transfer',
        args: JSON.stringify(args),
        gas: NFT_MINT_GAS,
        deposit: ONE_YOCTO, // NEP-171 requires 1 yoctoNEAR
      } as NEARFunctionCallAction,
    },
  ]

  return {
    actions,
    receiverId: contractId,
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
  }
}

// ─── DeFi Privacy ─────────────────────────────────────────────────────────────

/**
 * Build a private DeFi swap
 *
 * Executes a token swap with output going to a stealth address.
 *
 * @param params - DeFi swap parameters
 * @returns DeFi swap build
 *
 * @example
 * ```typescript
 * const result = buildPrivateDeFiSwap({
 *   dexContract: 'ref-finance.near',
 *   tokenIn: 'usdc.near',
 *   tokenOut: 'wrap.near',
 *   amountIn: 1000_000_000n, // 1000 USDC
 *   minAmountOut: 900_000_000_000_000_000_000_000n, // min 0.9 NEAR
 *   receiverMetaAddress: 'sip:near:0x...',
 * })
 * ```
 */
export function buildPrivateDeFiSwap(
  params: PrivateDeFiSwapParams
): PrivateDeFiSwapResult {
  const {
    dexContract,
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    receiverMetaAddress,
    slippageBps = 50, // 0.5% default
  } = params

  // Validate DEX contract
  if (!isValidAccountId(dexContract)) {
    throw new ValidationError('Invalid dexContract', 'dexContract')
  }

  // Validate tokens
  if (!isValidAccountId(tokenIn)) {
    throw new ValidationError('Invalid tokenIn', 'tokenIn')
  }
  if (!isValidAccountId(tokenOut)) {
    throw new ValidationError('Invalid tokenOut', 'tokenOut')
  }

  // Validate amounts
  if (amountIn <= 0n) {
    throw new ValidationError('amountIn must be greater than 0', 'amountIn')
  }
  if (minAmountOut <= 0n) {
    throw new ValidationError('minAmountOut must be greater than 0', 'minAmountOut')
  }

  // Parse meta-address if string
  const metaAddr = typeof receiverMetaAddress === 'string'
    ? parseNEARStealthMetaAddress(receiverMetaAddress)
    : receiverMetaAddress

  // Validate chain
  if (metaAddr.chain !== 'near') {
    throw new ValidationError(
      `Expected NEAR meta-address, got chain '${metaAddr.chain}'`,
      'receiverMetaAddress'
    )
  }

  // Generate stealth address for swap output
  const { stealthAddress, implicitAccountId } = generateNEARStealthAddress(metaAddr)

  // Create announcement memo
  const announcementMemo = createAnnouncementMemo(
    stealthAddress.ephemeralPublicKey,
    stealthAddress.viewTag
  )

  // Calculate expected output with slippage
  const slippageMultiplier = 10000n - BigInt(slippageBps)
  const expectedOutput = (minAmountOut * 10000n) / slippageMultiplier

  // Build swap message for ft_transfer_call
  const swapMsg = JSON.stringify({
    actions: [
      {
        pool_id: 0, // Would need actual pool ID
        token_in: tokenIn,
        token_out: tokenOut,
        amount_in: amountIn.toString(),
        min_amount_out: minAmountOut.toString(),
      },
    ],
    receiver_id: implicitAccountId,
  })

  // Build ft_transfer_call action (to be sent to tokenIn contract)
  const args = {
    receiver_id: dexContract,
    amount: amountIn.toString(),
    msg: swapMsg,
    memo: announcementMemo,
  }

  const actions: NEARAction[] = [
    {
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer_call',
        args: JSON.stringify(args),
        gas: DEX_SWAP_GAS,
        deposit: ONE_YOCTO,
      } as NEARFunctionCallAction,
    },
  ]

  return {
    actions,
    receiverId: tokenIn, // Call goes to token contract
    stealthAddress,
    stealthAccountId: implicitAccountId,
    announcementMemo,
    expectedOutput,
  }
}

// ─── Gas Estimation ───────────────────────────────────────────────────────────

/**
 * Estimate gas for a function call
 *
 * @param methodName - Method being called
 * @param argsSize - Size of args in bytes
 * @returns Estimated gas in yoctoNEAR
 */
export function estimateFunctionCallGas(
  methodName: string,
  argsSize: number = 0
): bigint {
  // Base gas for function call
  let gas = 5_000_000_000_000n // 5 TGas base

  // Add gas for args serialization
  gas += BigInt(argsSize) * 1_000_000_000n // 1 GGas per byte

  // Add method-specific gas estimates
  if (methodName === 'ft_transfer' || methodName === 'ft_transfer_call') {
    gas += 10_000_000_000_000n // +10 TGas
  } else if (methodName === 'nft_mint' || methodName === 'nft_transfer') {
    gas += 20_000_000_000_000n // +20 TGas
  } else if (methodName.includes('swap')) {
    gas += 50_000_000_000_000n // +50 TGas for swaps
  }

  // Cap at reasonable maximum
  const maxGas = 300_000_000_000_000n // 300 TGas
  return gas > maxGas ? maxGas : gas
}

/**
 * Estimate total gas for a multi-step transaction
 *
 * @param steps - Transaction steps
 * @returns Total estimated gas
 */
export function estimateMultiStepGas(
  steps: Array<{ methodName: string; argsSize?: number }>
): bigint {
  let total = 0n

  for (const step of steps) {
    total += estimateFunctionCallGas(step.methodName, step.argsSize ?? 0)
  }

  return total
}
