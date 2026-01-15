/**
 * ERC-4337 Relayer for EVM Gas Abstraction
 *
 * Enables users to submit shielded EVM transactions without paying gas directly,
 * using ERC-4337 account abstraction with Paymasters.
 *
 * This breaks the link between the user's wallet and their privacy transaction,
 * providing true sender privacy on EVM chains (Base, Arbitrum, Optimism, etc.).
 *
 * @example
 * ```typescript
 * import { ERC4337Relayer, createPimlicoRelayer } from '@sip-protocol/sdk'
 *
 * // Create relayer with Pimlico bundler
 * const relayer = createPimlicoRelayer({
 *   apiKey: process.env.PIMLICO_API_KEY!,
 *   chain: 'base',
 * })
 *
 * // Relay a shielded transfer
 * const result = await relayer.relayTransaction({
 *   to: stealthAddress,
 *   data: transferCalldata,
 *   value: 0n,
 *   signer,
 * })
 * ```
 *
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */

/**
 * Supported EVM chains for ERC-4337 relaying
 */
export type SupportedEVMChain =
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'sepolia'
  | 'base-sepolia'

/**
 * Chain IDs for supported networks
 */
export const EVM_CHAIN_IDS: Record<SupportedEVMChain, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  sepolia: 11155111,
  'base-sepolia': 84532,
}

/**
 * Entry point addresses for ERC-4337 v0.7
 */
export const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

/**
 * Popular bundler endpoints
 */
export const BUNDLER_ENDPOINTS = {
  pimlico: {
    mainnet: 'https://api.pimlico.io/v2/{chain}/rpc',
    testnet: 'https://api.pimlico.io/v2/{chain}/rpc',
  },
  stackup: {
    mainnet: 'https://api.stackup.sh/v1/node/{apiKey}',
    testnet: 'https://api.stackup.sh/v1/node/{apiKey}',
  },
  biconomy: {
    mainnet: 'https://bundler.biconomy.io/api/v2/{chainId}/{apiKey}',
    testnet: 'https://bundler.biconomy.io/api/v2/{chainId}/{apiKey}',
  },
  alchemy: {
    mainnet: 'https://alchemy.com/account-abstraction/v3/{chain}/rpc',
    testnet: 'https://alchemy.com/account-abstraction/v3/{chain}/rpc',
  },
} as const

/**
 * ERC-4337 Relayer configuration
 */
export interface ERC4337RelayerConfig {
  /** Bundler RPC endpoint (full URL or provider name) */
  bundlerUrl?: string
  /** Bundler provider (pimlico, stackup, biconomy, alchemy) */
  bundlerProvider?: 'pimlico' | 'stackup' | 'biconomy' | 'alchemy'
  /** API key for bundler */
  apiKey: string
  /** Target chain */
  chain: SupportedEVMChain
  /** Paymaster URL (for gas sponsorship) */
  paymasterUrl?: string
  /** Entry point version (default: v0.7) */
  entryPointVersion?: 'v0.6' | 'v0.7'
  /** Maximum gas price multiplier (default: 1.2) */
  gasPriceMultiplier?: number
}

/**
 * User Operation structure (ERC-4337 v0.7)
 */
export interface UserOperation {
  sender: string
  nonce: bigint
  factory?: string
  factoryData?: string
  callData: string
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymaster?: string
  paymasterVerificationGasLimit?: bigint
  paymasterPostOpGasLimit?: bigint
  paymasterData?: string
  signature: string
}

/**
 * Request to relay a transaction
 */
export interface RelayTransactionRequest {
  /** Target contract address */
  to: string
  /** Call data */
  data: string
  /** Value to send (in wei) */
  value?: bigint
  /** Signer for the UserOperation */
  signer: {
    address: string
    signMessage: (message: Uint8Array | string) => Promise<string>
  }
  /** Maximum fee willing to pay (optional, for fee limits) */
  maxFee?: bigint
  /** Wait for transaction confirmation */
  waitForConfirmation?: boolean
}

/**
 * Result of relaying a transaction
 */
export interface RelayTransactionResult {
  /** Whether the relay was successful */
  success: boolean
  /** User operation hash */
  userOpHash?: string
  /** Transaction hash (if confirmed) */
  transactionHash?: string
  /** Gas used */
  gasUsed?: bigint
  /** Actual fee paid */
  actualFee?: bigint
  /** Error if failed */
  error?: Error
}

/**
 * Bundler RPC response types
 */
interface BundlerEstimateResponse {
  preVerificationGas: string
  verificationGasLimit: string
  callGasLimit: string
  paymasterVerificationGasLimit?: string
  paymasterPostOpGasLimit?: string
}

interface BundlerSendResponse {
  result: string // userOpHash
}

interface BundlerReceiptResponse {
  result: {
    userOpHash: string
    entryPoint: string
    sender: string
    nonce: string
    success: boolean
    actualGasUsed: string
    actualGasCost: string
    receipt: {
      transactionHash: string
      blockNumber: string
      gasUsed: string
    }
  } | null
}

/**
 * Error codes for ERC-4337 Relayer
 */
export enum ERC4337RelayerErrorCode {
  BUNDLER_ERROR = 'BUNDLER_ERROR',
  PAYMASTER_ERROR = 'PAYMASTER_ERROR',
  SIGNATURE_ERROR = 'SIGNATURE_ERROR',
  GAS_ESTIMATION_ERROR = 'GAS_ESTIMATION_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_CHAIN = 'INVALID_CHAIN',
}

/**
 * ERC-4337 Relayer error
 */
export class ERC4337RelayerError extends Error {
  code: ERC4337RelayerErrorCode
  details?: unknown

  constructor(message: string, code: ERC4337RelayerErrorCode, details?: unknown) {
    super(message)
    this.name = 'ERC4337RelayerError'
    this.code = code
    this.details = details
  }
}

/**
 * ERC-4337 Relayer for EVM gas abstraction
 *
 * Submits transactions via ERC-4337 bundlers with paymaster sponsorship.
 */
export class ERC4337Relayer {
  private readonly bundlerUrl: string
  private readonly paymasterUrl: string | null
  private readonly chainId: number
  private readonly entryPoint: string
  private readonly gasPriceMultiplier: number

  constructor(config: ERC4337RelayerConfig) {
    // Validate chain
    if (!EVM_CHAIN_IDS[config.chain]) {
      throw new ERC4337RelayerError(
        `Unsupported chain: ${config.chain}`,
        ERC4337RelayerErrorCode.INVALID_CHAIN
      )
    }

    this.chainId = EVM_CHAIN_IDS[config.chain]
    this.gasPriceMultiplier = config.gasPriceMultiplier ?? 1.2

    // Set entry point
    this.entryPoint = ENTRY_POINT_V07

    // Build bundler URL
    if (config.bundlerUrl) {
      this.bundlerUrl = config.bundlerUrl
    } else if (config.bundlerProvider) {
      const endpoints = BUNDLER_ENDPOINTS[config.bundlerProvider]
      const isTestnet = config.chain.includes('sepolia')
      const template = isTestnet ? endpoints.testnet : endpoints.mainnet

      this.bundlerUrl = template
        .replace('{chain}', config.chain)
        .replace('{chainId}', this.chainId.toString())
        .replace('{apiKey}', config.apiKey)

      // Add API key as query param for Pimlico
      if (config.bundlerProvider === 'pimlico') {
        this.bundlerUrl += `?apikey=${config.apiKey}`
      }
    } else {
      throw new ERC4337RelayerError(
        'Either bundlerUrl or bundlerProvider must be specified',
        ERC4337RelayerErrorCode.BUNDLER_ERROR
      )
    }

    // Set paymaster URL (defaults to bundler URL for integrated services)
    this.paymasterUrl = config.paymasterUrl ?? this.bundlerUrl
  }

  /**
   * Relay a transaction via ERC-4337
   *
   * @param request - Transaction to relay
   * @returns Relay result
   */
  async relayTransaction(request: RelayTransactionRequest): Promise<RelayTransactionResult> {
    try {
      // 1. Build the UserOperation
      const userOp = await this.buildUserOperation(request)

      // 2. Sign the UserOperation
      const signedUserOp = await this.signUserOperation(userOp, request.signer)

      // 3. Submit to bundler
      const userOpHash = await this.submitUserOperation(signedUserOp)

      // 4. Wait for confirmation if requested
      if (request.waitForConfirmation) {
        const receipt = await this.waitForReceipt(userOpHash)

        if (!receipt) {
          return {
            success: false,
            userOpHash,
            error: new ERC4337RelayerError(
              'Transaction timed out waiting for confirmation',
              ERC4337RelayerErrorCode.TIMEOUT
            ),
          }
        }

        return {
          success: receipt.success,
          userOpHash,
          transactionHash: receipt.receipt.transactionHash,
          gasUsed: BigInt(receipt.actualGasUsed),
          actualFee: BigInt(receipt.actualGasCost),
        }
      }

      return {
        success: true,
        userOpHash,
      }
    } catch (error) {
      if (error instanceof ERC4337RelayerError) {
        return { success: false, error }
      }
      return {
        success: false,
        error: new ERC4337RelayerError(
          error instanceof Error ? error.message : 'Unknown error',
          ERC4337RelayerErrorCode.BUNDLER_ERROR,
          error
        ),
      }
    }
  }

  /**
   * Build a UserOperation for the transaction
   */
  private async buildUserOperation(request: RelayTransactionRequest): Promise<UserOperation> {
    // Get gas prices from bundler
    const gasPrices = await this.getGasPrices()

    // Build call data for the target call
    const callData = this.encodeExecuteCall(request.to, request.value ?? 0n, request.data)

    // Get nonce from entry point (simplified - in production, query contract)
    const nonce = await this.getNonce(request.signer.address)

    // Estimate gas limits
    const gasEstimate = await this.estimateGas({
      sender: request.signer.address,
      nonce,
      callData,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
    })

    // Get paymaster data if sponsoring
    const paymasterData = await this.getPaymasterData({
      sender: request.signer.address,
      nonce,
      callData,
      ...gasEstimate,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
    })

    return {
      sender: request.signer.address,
      nonce,
      callData,
      callGasLimit: gasEstimate.callGasLimit,
      verificationGasLimit: gasEstimate.verificationGasLimit,
      preVerificationGas: gasEstimate.preVerificationGas,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      paymaster: paymasterData.paymaster,
      paymasterVerificationGasLimit: paymasterData.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: paymasterData.paymasterPostOpGasLimit,
      paymasterData: paymasterData.paymasterData,
      signature: '0x', // Will be filled in during signing
    }
  }

  /**
   * Sign a UserOperation
   */
  private async signUserOperation(
    userOp: UserOperation,
    signer: RelayTransactionRequest['signer']
  ): Promise<UserOperation> {
    // Compute the UserOperation hash
    const userOpHash = this.getUserOpHash(userOp)

    // Sign the hash
    const signature = await signer.signMessage(userOpHash)

    return {
      ...userOp,
      signature,
    }
  }

  /**
   * Submit UserOperation to bundler
   */
  private async submitUserOperation(userOp: UserOperation): Promise<string> {
    const response = await fetch(this.bundlerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [this.serializeUserOp(userOp), this.entryPoint],
      }),
    })

    if (!response.ok) {
      throw new ERC4337RelayerError(
        `Bundler request failed: ${response.status}`,
        ERC4337RelayerErrorCode.BUNDLER_ERROR
      )
    }

    const data = (await response.json()) as BundlerSendResponse | { error: { message: string } }

    if ('error' in data) {
      throw new ERC4337RelayerError(
        data.error.message,
        ERC4337RelayerErrorCode.BUNDLER_ERROR
      )
    }

    return data.result
  }

  /**
   * Wait for UserOperation receipt
   */
  private async waitForReceipt(
    userOpHash: string,
    timeoutMs: number = 60000
  ): Promise<BundlerReceiptResponse['result']> {
    const startTime = Date.now()
    const pollInterval = 2000

    while (Date.now() - startTime < timeoutMs) {
      const response = await fetch(this.bundlerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        }),
      })

      if (response.ok) {
        const data = (await response.json()) as BundlerReceiptResponse
        if (data.result) {
          return data.result
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    return null
  }

  /**
   * Get current gas prices from bundler
   */
  private async getGasPrices(): Promise<{
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  }> {
    const response = await fetch(this.bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pimlico_getUserOperationGasPrice',
        params: [],
      }),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.result?.standard) {
        return {
          maxFeePerGas: BigInt(data.result.standard.maxFeePerGas),
          maxPriorityFeePerGas: BigInt(data.result.standard.maxPriorityFeePerGas),
        }
      }
    }

    // Fallback: use reasonable defaults
    return {
      maxFeePerGas: BigInt(30e9), // 30 gwei
      maxPriorityFeePerGas: BigInt(1e9), // 1 gwei
    }
  }

  /**
   * Estimate gas for UserOperation
   */
  private async estimateGas(partialUserOp: Partial<UserOperation>): Promise<{
    preVerificationGas: bigint
    verificationGasLimit: bigint
    callGasLimit: bigint
  }> {
    const response = await fetch(this.bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_estimateUserOperationGas',
        params: [
          {
            sender: partialUserOp.sender,
            nonce: `0x${(partialUserOp.nonce ?? 0n).toString(16)}`,
            callData: partialUserOp.callData,
            signature: '0x' + 'ff'.repeat(65), // Dummy signature for estimation
          },
          this.entryPoint,
        ],
      }),
    })

    if (!response.ok) {
      throw new ERC4337RelayerError(
        'Gas estimation failed',
        ERC4337RelayerErrorCode.GAS_ESTIMATION_ERROR
      )
    }

    const data = await response.json() as { result: BundlerEstimateResponse } | { error: { message: string } }

    if ('error' in data) {
      throw new ERC4337RelayerError(
        data.error.message,
        ERC4337RelayerErrorCode.GAS_ESTIMATION_ERROR
      )
    }

    // Apply gas multiplier for safety margin
    const multiplier = this.gasPriceMultiplier

    return {
      preVerificationGas: BigInt(Math.ceil(Number(BigInt(data.result.preVerificationGas)) * multiplier)),
      verificationGasLimit: BigInt(Math.ceil(Number(BigInt(data.result.verificationGasLimit)) * multiplier)),
      callGasLimit: BigInt(Math.ceil(Number(BigInt(data.result.callGasLimit)) * multiplier)),
    }
  }

  /**
   * Get paymaster data for sponsorship
   */
  private async getPaymasterData(partialUserOp: Partial<UserOperation>): Promise<{
    paymaster?: string
    paymasterVerificationGasLimit?: bigint
    paymasterPostOpGasLimit?: bigint
    paymasterData?: string
  }> {
    if (!this.paymasterUrl) {
      return {}
    }

    const response = await fetch(this.paymasterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_sponsorUserOperation',
        params: [
          {
            sender: partialUserOp.sender,
            nonce: `0x${(partialUserOp.nonce ?? 0n).toString(16)}`,
            callData: partialUserOp.callData,
            callGasLimit: `0x${(partialUserOp.callGasLimit ?? 0n).toString(16)}`,
            verificationGasLimit: `0x${(partialUserOp.verificationGasLimit ?? 0n).toString(16)}`,
            preVerificationGas: `0x${(partialUserOp.preVerificationGas ?? 0n).toString(16)}`,
            maxFeePerGas: `0x${(partialUserOp.maxFeePerGas ?? 0n).toString(16)}`,
            maxPriorityFeePerGas: `0x${(partialUserOp.maxPriorityFeePerGas ?? 0n).toString(16)}`,
            signature: '0x' + 'ff'.repeat(65),
          },
          this.entryPoint,
          { sponsorshipPolicyId: 'sp_sip_privacy' }, // Sponsorship policy
        ],
      }),
    })

    if (!response.ok) {
      // Paymaster not available, user will pay gas
      return {}
    }

    const data = await response.json()

    if (data.result) {
      return {
        paymaster: data.result.paymaster,
        paymasterVerificationGasLimit: data.result.paymasterVerificationGasLimit
          ? BigInt(data.result.paymasterVerificationGasLimit)
          : undefined,
        paymasterPostOpGasLimit: data.result.paymasterPostOpGasLimit
          ? BigInt(data.result.paymasterPostOpGasLimit)
          : undefined,
        paymasterData: data.result.paymasterData,
      }
    }

    return {}
  }

  /**
   * Get nonce for sender
   */
  private async getNonce(sender: string): Promise<bigint> {
    // In production, this would query the EntryPoint contract
    // For now, return 0 (first operation) or query bundler
    const response = await fetch(this.bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: this.entryPoint,
            data: `0x35567e1a${sender.slice(2).padStart(64, '0')}${'0'.repeat(64)}`, // getNonce(address,uint192)
          },
          'latest',
        ],
      }),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.result && data.result !== '0x') {
        return BigInt(data.result)
      }
    }

    return 0n
  }

  /**
   * Encode execute call for smart account
   */
  private encodeExecuteCall(to: string, value: bigint, data: string): string {
    // Standard execute function signature
    // execute(address dest, uint256 value, bytes calldata func)
    const selector = '0xb61d27f6'
    const encodedTo = to.slice(2).padStart(64, '0')
    const encodedValue = value.toString(16).padStart(64, '0')
    const dataOffset = (32 * 3).toString(16).padStart(64, '0')
    const dataLength = ((data.length - 2) / 2).toString(16).padStart(64, '0')
    const dataContent = data.slice(2).padEnd(Math.ceil((data.length - 2) / 64) * 64, '0')

    return `${selector}${encodedTo}${encodedValue}${dataOffset}${dataLength}${dataContent}`
  }

  /**
   * Compute UserOperation hash
   */
  private getUserOpHash(userOp: UserOperation): string {
    // Simplified hash computation
    // In production, use proper EIP-712 typed data hashing
    const packed = this.packUserOp(userOp)
    // For now, return a placeholder - real implementation would use keccak256
    return packed
  }

  /**
   * Pack UserOperation for hashing
   */
  private packUserOp(userOp: UserOperation): string {
    return JSON.stringify({
      sender: userOp.sender,
      nonce: userOp.nonce.toString(),
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit.toString(),
      verificationGasLimit: userOp.verificationGasLimit.toString(),
      preVerificationGas: userOp.preVerificationGas.toString(),
      maxFeePerGas: userOp.maxFeePerGas.toString(),
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString(),
      paymaster: userOp.paymaster,
      paymasterData: userOp.paymasterData,
      chainId: this.chainId,
      entryPoint: this.entryPoint,
    })
  }

  /**
   * Serialize UserOperation for RPC
   */
  private serializeUserOp(userOp: UserOperation): Record<string, string | undefined> {
    return {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      factory: userOp.factory,
      factoryData: userOp.factoryData,
      callData: userOp.callData,
      callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      paymaster: userOp.paymaster,
      paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit
        ? `0x${userOp.paymasterVerificationGasLimit.toString(16)}`
        : undefined,
      paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit
        ? `0x${userOp.paymasterPostOpGasLimit.toString(16)}`
        : undefined,
      paymasterData: userOp.paymasterData,
      signature: userOp.signature,
    }
  }

  /**
   * Check if relayer is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_supportedEntryPoints',
          params: [],
        }),
      })

      if (!response.ok) return false

      const data = await response.json()
      return Array.isArray(data.result) && data.result.length > 0
    } catch {
      return false
    }
  }

  /**
   * Get supported entry points
   */
  async getSupportedEntryPoints(): Promise<string[]> {
    try {
      const response = await fetch(this.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_supportedEntryPoints',
          params: [],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.result ?? []
      }
    } catch {
      // Ignore
    }
    return []
  }
}

/**
 * Create a Pimlico-backed ERC-4337 relayer
 *
 * @param config - Relayer configuration
 * @returns Configured relayer
 */
export function createPimlicoRelayer(
  config: Omit<ERC4337RelayerConfig, 'bundlerProvider'>
): ERC4337Relayer {
  return new ERC4337Relayer({
    ...config,
    bundlerProvider: 'pimlico',
  })
}

/**
 * Create a Stackup-backed ERC-4337 relayer
 *
 * @param config - Relayer configuration
 * @returns Configured relayer
 */
export function createStackupRelayer(
  config: Omit<ERC4337RelayerConfig, 'bundlerProvider'>
): ERC4337Relayer {
  return new ERC4337Relayer({
    ...config,
    bundlerProvider: 'stackup',
  })
}

/**
 * Create a Biconomy-backed ERC-4337 relayer
 *
 * @param config - Relayer configuration
 * @returns Configured relayer
 */
export function createBiconomyRelayer(
  config: Omit<ERC4337RelayerConfig, 'bundlerProvider'>
): ERC4337Relayer {
  return new ERC4337Relayer({
    ...config,
    bundlerProvider: 'biconomy',
  })
}
