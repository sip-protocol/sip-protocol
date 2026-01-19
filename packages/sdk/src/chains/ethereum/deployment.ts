/**
 * Ethereum L2 Deployment Utilities
 *
 * Provides contract deployment and verification helpers for Ethereum L2s.
 * Supports Base, Arbitrum, Optimism, and other EVM-compatible chains.
 *
 * @module chains/ethereum/deployment
 */

import type { HexString } from '@sip-protocol/types'
import {
  type EthereumNetwork,
  EVM_CHAIN_IDS,
  ETHEREUM_RPC_ENDPOINTS,
  ETHEREUM_EXPLORER_URLS,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * L2 network configuration for deployment
 */
export interface L2NetworkConfig {
  /** Network identifier */
  network: EthereumNetwork
  /** Chain ID */
  chainId: number
  /** RPC endpoint */
  rpcUrl: string
  /** Block explorer URL */
  explorerUrl: string
  /** Block explorer API URL */
  explorerApiUrl: string
  /** Whether this is a testnet */
  isTestnet: boolean
  /** Average block time in seconds */
  blockTime: number
  /** Required confirmations for finality */
  requiredConfirmations: number
  /** Native token symbol */
  nativeToken: string
  /** Gas multiplier (L2s often have lower fees) */
  gasMultiplier: number
}

/**
 * Contract deployment result
 */
export interface DeploymentResult {
  /** Deployed contract address */
  address: HexString
  /** Deployment transaction hash */
  transactionHash: HexString
  /** Block number of deployment */
  blockNumber: number
  /** Gas used */
  gasUsed: bigint
  /** Network deployed to */
  network: EthereumNetwork
  /** Chain ID */
  chainId: number
  /** Timestamp */
  deployedAt: number
}

/**
 * Contract verification request
 */
export interface VerificationRequest {
  /** Contract address */
  address: HexString
  /** Network */
  network: EthereumNetwork
  /** Source code (flattened) */
  sourceCode: string
  /** Contract name */
  contractName: string
  /** Compiler version */
  compilerVersion: string
  /** Constructor arguments (ABI-encoded) */
  constructorArguments?: HexString
  /** Optimization enabled */
  optimization?: boolean
  /** Optimization runs */
  runs?: number
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether verification was successful */
  success: boolean
  /** Verification GUID for checking status */
  guid?: string
  /** Error message if failed */
  error?: string
  /** Explorer URL to verified contract */
  explorerUrl?: string
}

/**
 * Deployment config for a specific contract
 */
export interface DeploymentConfig {
  /** Contract bytecode */
  bytecode: HexString
  /** Constructor arguments (ABI-encoded) */
  constructorArgs?: HexString
  /** Gas limit override */
  gasLimit?: bigint
  /** Value to send (for payable constructors) */
  value?: bigint
  /** Nonce override */
  nonce?: number
}

// ─── L2 Network Configurations ────────────────────────────────────────────────

/**
 * Pre-configured L2 networks for SIP deployment
 */
export const L2_NETWORK_CONFIGS: Record<string, L2NetworkConfig> = {
  base: {
    network: 'base',
    chainId: EVM_CHAIN_IDS.base,
    rpcUrl: ETHEREUM_RPC_ENDPOINTS.base,
    explorerUrl: ETHEREUM_EXPLORER_URLS.base,
    explorerApiUrl: 'https://api.basescan.org/api',
    isTestnet: false,
    blockTime: 2,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.1,
  },
  'base-sepolia': {
    network: 'base-sepolia',
    chainId: EVM_CHAIN_IDS['base-sepolia'],
    rpcUrl: ETHEREUM_RPC_ENDPOINTS['base-sepolia'],
    explorerUrl: ETHEREUM_EXPLORER_URLS['base-sepolia'],
    explorerApiUrl: 'https://api-sepolia.basescan.org/api',
    isTestnet: true,
    blockTime: 2,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.1,
  },
  arbitrum: {
    network: 'arbitrum',
    chainId: EVM_CHAIN_IDS.arbitrum,
    rpcUrl: ETHEREUM_RPC_ENDPOINTS.arbitrum,
    explorerUrl: ETHEREUM_EXPLORER_URLS.arbitrum,
    explorerApiUrl: 'https://api.arbiscan.io/api',
    isTestnet: false,
    blockTime: 0.25, // ~250ms
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.05,
  },
  'arbitrum-sepolia': {
    network: 'arbitrum-sepolia',
    chainId: EVM_CHAIN_IDS['arbitrum-sepolia'],
    rpcUrl: ETHEREUM_RPC_ENDPOINTS['arbitrum-sepolia'],
    explorerUrl: ETHEREUM_EXPLORER_URLS['arbitrum-sepolia'],
    explorerApiUrl: 'https://api-sepolia.arbiscan.io/api',
    isTestnet: true,
    blockTime: 0.25,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.05,
  },
  optimism: {
    network: 'optimism',
    chainId: EVM_CHAIN_IDS.optimism,
    rpcUrl: ETHEREUM_RPC_ENDPOINTS.optimism,
    explorerUrl: ETHEREUM_EXPLORER_URLS.optimism,
    explorerApiUrl: 'https://api-optimistic.etherscan.io/api',
    isTestnet: false,
    blockTime: 2,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.1,
  },
  'optimism-sepolia': {
    network: 'optimism-sepolia',
    chainId: EVM_CHAIN_IDS['optimism-sepolia'],
    rpcUrl: ETHEREUM_RPC_ENDPOINTS['optimism-sepolia'],
    explorerUrl: ETHEREUM_EXPLORER_URLS['optimism-sepolia'],
    explorerApiUrl: 'https://api-sepolia-optimistic.etherscan.io/api',
    isTestnet: true,
    blockTime: 2,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.1,
  },
  polygon: {
    network: 'polygon',
    chainId: EVM_CHAIN_IDS.polygon,
    rpcUrl: ETHEREUM_RPC_ENDPOINTS.polygon,
    explorerUrl: ETHEREUM_EXPLORER_URLS.polygon,
    explorerApiUrl: 'https://api.polygonscan.com/api',
    isTestnet: false,
    blockTime: 2,
    requiredConfirmations: 32,
    nativeToken: 'MATIC',
    gasMultiplier: 1.0,
  },
  zksync: {
    network: 'zksync',
    chainId: EVM_CHAIN_IDS.zksync,
    rpcUrl: ETHEREUM_RPC_ENDPOINTS.zksync,
    explorerUrl: ETHEREUM_EXPLORER_URLS.zksync,
    explorerApiUrl: 'https://api-era.zksync.network/api',
    isTestnet: false,
    blockTime: 1,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.1,
  },
  scroll: {
    network: 'scroll',
    chainId: EVM_CHAIN_IDS.scroll,
    rpcUrl: ETHEREUM_RPC_ENDPOINTS.scroll,
    explorerUrl: ETHEREUM_EXPLORER_URLS.scroll,
    explorerApiUrl: 'https://api.scrollscan.com/api',
    isTestnet: false,
    blockTime: 3,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.1,
  },
  linea: {
    network: 'linea',
    chainId: EVM_CHAIN_IDS.linea,
    rpcUrl: ETHEREUM_RPC_ENDPOINTS.linea,
    explorerUrl: ETHEREUM_EXPLORER_URLS.linea,
    explorerApiUrl: 'https://api.lineascan.build/api',
    isTestnet: false,
    blockTime: 2,
    requiredConfirmations: 1,
    nativeToken: 'ETH',
    gasMultiplier: 0.1,
  },
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Get L2 network configuration
 *
 * @param network - Network identifier
 * @returns L2 network config or undefined if not found
 *
 * @example
 * ```typescript
 * const config = getL2Config('base')
 * console.log(config.gasMultiplier) // 0.1
 * ```
 */
export function getL2Config(network: EthereumNetwork): L2NetworkConfig | undefined {
  return L2_NETWORK_CONFIGS[network]
}

/**
 * Get all supported L2 networks
 *
 * @param includeTestnets - Whether to include testnets
 * @returns Array of L2 network configs
 */
export function getSupportedL2s(includeTestnets: boolean = false): L2NetworkConfig[] {
  return Object.values(L2_NETWORK_CONFIGS).filter(
    (config) => includeTestnets || !config.isTestnet
  )
}

/**
 * Get L2 config by chain ID
 *
 * @param chainId - EVM chain ID
 * @returns L2 network config or undefined
 */
export function getL2ConfigByChainId(chainId: number): L2NetworkConfig | undefined {
  return Object.values(L2_NETWORK_CONFIGS).find(
    (config) => config.chainId === chainId
  )
}

/**
 * Check if a chain ID is a supported L2
 *
 * @param chainId - EVM chain ID
 * @returns Whether the chain is a supported L2
 */
export function isSupportedL2(chainId: number): boolean {
  return getL2ConfigByChainId(chainId) !== undefined
}

// ─── Deployment Helpers ───────────────────────────────────────────────────────

/**
 * Generate deployment transaction data
 *
 * @param config - Deployment configuration
 * @returns Transaction data for deployment
 *
 * @example
 * ```typescript
 * const txData = generateDeploymentTx({
 *   bytecode: '0x...',
 *   constructorArgs: '0x...',
 * })
 * // Sign and send txData with your wallet
 * ```
 */
export function generateDeploymentTx(config: DeploymentConfig): {
  data: HexString
  value: bigint
  gasLimit?: bigint
} {
  // Concatenate bytecode with constructor arguments
  const data = config.constructorArgs
    ? `${config.bytecode}${config.constructorArgs.slice(2)}` as HexString
    : config.bytecode

  return {
    data,
    value: config.value ?? 0n,
    gasLimit: config.gasLimit,
  }
}

/**
 * Estimate deployment gas for an L2
 *
 * @param network - Target L2 network
 * @param bytecodeLength - Length of bytecode in bytes
 * @param hasConstructor - Whether contract has constructor with args
 * @returns Estimated gas limit
 */
export function estimateDeploymentGas(
  _network: EthereumNetwork,
  bytecodeLength: number,
  hasConstructor: boolean = false
): bigint {
  // Base deployment cost: 21000 (tx) + 32000 (create) + 200 per byte
  const baseGas = 21000n + 32000n + BigInt(bytecodeLength * 200)

  // Add constructor overhead if needed
  const constructorGas = hasConstructor ? 50000n : 0n

  // L2s have lower gas costs, but we don't reduce the limit
  // Just the price is lower, limit should be safe
  return baseGas + constructorGas
}

/**
 * Get explorer verification URL
 *
 * @param address - Contract address
 * @param network - Network
 * @returns URL to verify contract on explorer
 */
export function getVerificationUrl(
  address: HexString,
  network: EthereumNetwork
): string {
  const config = getL2Config(network)
  if (!config) {
    const explorerUrl = ETHEREUM_EXPLORER_URLS[network] ?? 'https://etherscan.io'
    return `${explorerUrl}/verifyContract?a=${address}`
  }
  return `${config.explorerUrl}/verifyContract?a=${address}`
}

/**
 * Get contract URL on block explorer
 *
 * @param address - Contract address
 * @param network - Network
 * @returns URL to contract on explorer
 */
export function getContractUrl(
  address: HexString,
  network: EthereumNetwork
): string {
  const config = getL2Config(network)
  const explorerUrl = config?.explorerUrl ?? ETHEREUM_EXPLORER_URLS[network]
  return `${explorerUrl}/address/${address}#code`
}

// ─── Verification Helpers ─────────────────────────────────────────────────────

/**
 * Build verification request body for Etherscan-compatible API
 *
 * @param request - Verification request details
 * @returns URL-encoded form body
 */
export function buildVerificationBody(request: VerificationRequest): string {
  const config = getL2Config(request.network)
  const chainId = config?.chainId ?? EVM_CHAIN_IDS[request.network]

  const params = new URLSearchParams({
    apikey: '', // User must provide their own API key
    module: 'contract',
    action: 'verifysourcecode',
    chainId: chainId.toString(),
    sourceCode: request.sourceCode,
    codeformat: 'solidity-single-file',
    contractname: request.contractName,
    compilerversion: request.compilerVersion,
    optimizationUsed: request.optimization ? '1' : '0',
    runs: (request.runs ?? 200).toString(),
    constructorArguements: request.constructorArguments?.slice(2) ?? '',
  })

  return params.toString()
}

/**
 * Check verification status on explorer
 *
 * @param guid - Verification GUID
 * @param network - Network
 * @param apiKey - Explorer API key
 * @returns Verification status
 */
export async function checkVerificationStatus(
  guid: string,
  network: EthereumNetwork,
  apiKey: string
): Promise<{ status: 'pending' | 'success' | 'failed'; message: string }> {
  const config = getL2Config(network)
  const apiUrl = config?.explorerApiUrl ?? 'https://api.etherscan.io/api'

  const params = new URLSearchParams({
    apikey: apiKey,
    module: 'contract',
    action: 'checkverifystatus',
    guid,
  })

  const response = await fetch(`${apiUrl}?${params}`)
  const data = await response.json()

  if (data.status === '1') {
    return { status: 'success', message: data.result }
  } else if (data.result === 'Pending in queue') {
    return { status: 'pending', message: data.result }
  } else {
    return { status: 'failed', message: data.result }
  }
}

// ─── Multi-L2 Deployment ──────────────────────────────────────────────────────

/**
 * Deployment status for multi-L2 deployment
 */
export interface MultiL2DeploymentStatus {
  /** Network being deployed to */
  network: EthereumNetwork
  /** Deployment status */
  status: 'pending' | 'deploying' | 'verifying' | 'complete' | 'failed'
  /** Deployment result if successful */
  result?: DeploymentResult
  /** Error if failed */
  error?: string
  /** Verification status */
  verified?: boolean
}

/**
 * Create a multi-L2 deployment plan
 *
 * @param networks - Target networks (defaults to Tier 1: Base, Arbitrum, Optimism)
 * @param includeTestnets - Whether to include testnet deployments
 * @returns Deployment plan with network configs
 *
 * @example
 * ```typescript
 * const plan = createDeploymentPlan(['base', 'arbitrum', 'optimism'])
 * // plan.forEach(network => deployTo(network))
 * ```
 */
export function createDeploymentPlan(
  networks?: EthereumNetwork[],
  includeTestnets: boolean = true
): L2NetworkConfig[] {
  // Default Tier 1 L2s (90%+ market share)
  const tier1Networks: EthereumNetwork[] = [
    'base',
    'arbitrum',
    'optimism',
  ]

  const targetNetworks = networks ?? tier1Networks
  const configs: L2NetworkConfig[] = []

  for (const network of targetNetworks) {
    const config = getL2Config(network)
    if (config) {
      configs.push(config)

      // Add corresponding testnet if requested
      if (includeTestnets) {
        const testnetNetwork = `${network}-sepolia` as EthereumNetwork
        const testnetConfig = getL2Config(testnetNetwork)
        if (testnetConfig) {
          configs.push(testnetConfig)
        }
      }
    }
  }

  return configs
}

/**
 * Get recommended deployment order (testnets first)
 *
 * @param networks - Networks to deploy to
 * @returns Ordered array of networks
 */
export function getDeploymentOrder(networks: L2NetworkConfig[]): L2NetworkConfig[] {
  // Sort: testnets first, then by gas multiplier (cheapest first)
  return [...networks].sort((a, b) => {
    if (a.isTestnet && !b.isTestnet) return -1
    if (!a.isTestnet && b.isTestnet) return 1
    return a.gasMultiplier - b.gasMultiplier
  })
}

// ─── Gas Price Comparison ─────────────────────────────────────────────────────

/**
 * L2 gas price comparison
 */
export interface L2GasComparison {
  network: EthereumNetwork
  estimatedGasPrice: bigint
  estimatedDeployCost: bigint
  relativeToMainnet: number // 0.1 = 10% of mainnet cost
}

/**
 * Compare gas prices across L2s
 *
 * @param bytecodeLength - Contract bytecode length
 * @param mainnetGasPrice - Current mainnet gas price in wei
 * @returns Gas price comparison for each L2
 *
 * @example
 * ```typescript
 * const comparison = compareL2GasPrices(10000, 30n * 10n**9n)
 * // Find cheapest L2 for deployment
 * const cheapest = comparison.sort((a, b) =>
 *   Number(a.estimatedDeployCost - b.estimatedDeployCost)
 * )[0]
 * ```
 */
export function compareL2GasPrices(
  bytecodeLength: number,
  mainnetGasPrice: bigint
): L2GasComparison[] {
  const gasLimit = estimateDeploymentGas('mainnet', bytecodeLength)

  return getSupportedL2s(false).map((config) => {
    const l2GasPrice = BigInt(Math.floor(Number(mainnetGasPrice) * config.gasMultiplier))
    const l2Cost = gasLimit * l2GasPrice

    return {
      network: config.network,
      estimatedGasPrice: l2GasPrice,
      estimatedDeployCost: l2Cost,
      relativeToMainnet: config.gasMultiplier,
    }
  })
}

export default {
  L2_NETWORK_CONFIGS,
  getL2Config,
  getSupportedL2s,
  getL2ConfigByChainId,
  isSupportedL2,
  generateDeploymentTx,
  estimateDeploymentGas,
  getVerificationUrl,
  getContractUrl,
  buildVerificationBody,
  checkVerificationStatus,
  createDeploymentPlan,
  getDeploymentOrder,
  compareL2GasPrices,
}
