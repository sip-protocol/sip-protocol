/**
 * Ethereum Chain Constants
 *
 * RPC endpoints, token addresses, and configuration for Ethereum same-chain privacy.
 * Supports mainnet and common L2s (Arbitrum, Optimism, Base).
 *
 * @packageDocumentation
 */

/**
 * Get environment variable or return default
 * Works in both Node.js and browser environments
 */
function getEnvVar(name: string, defaultValue: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || defaultValue
  }
  return defaultValue
}

/**
 * Ethereum network types
 */
export type EthereumNetwork =
  | 'mainnet'
  | 'sepolia'
  | 'goerli'
  | 'arbitrum'
  | 'arbitrum-sepolia'
  | 'optimism'
  | 'optimism-sepolia'
  | 'base'
  | 'base-sepolia'
  | 'polygon'
  | 'polygon-mumbai'
  | 'zksync'
  | 'scroll'
  | 'linea'
  | 'mantle'
  | 'blast'
  | 'localhost'

/**
 * EVM chain IDs
 */
export const EVM_CHAIN_IDS: Record<EthereumNetwork, number> = {
  mainnet: 1,
  sepolia: 11155111,
  goerli: 5,
  arbitrum: 42161,
  'arbitrum-sepolia': 421614,
  optimism: 10,
  'optimism-sepolia': 11155420,
  base: 8453,
  'base-sepolia': 84532,
  polygon: 137,
  'polygon-mumbai': 80001,
  zksync: 324,
  scroll: 534352,
  linea: 59144,
  mantle: 5000,
  blast: 81457,
  localhost: 31337,
} as const

/**
 * Ethereum RPC endpoints by network
 * Users should override with their own RPC providers (Alchemy, Infura, etc.)
 */
export const ETHEREUM_RPC_ENDPOINTS: Record<EthereumNetwork, string> = {
  mainnet: getEnvVar('ETH_MAINNET_RPC', 'https://eth.llamarpc.com'),
  sepolia: getEnvVar('ETH_SEPOLIA_RPC', 'https://rpc.sepolia.org'),
  goerli: getEnvVar('ETH_GOERLI_RPC', 'https://rpc.goerli.eth.gateway.fm'),
  arbitrum: getEnvVar('ARB_MAINNET_RPC', 'https://arb1.arbitrum.io/rpc'),
  'arbitrum-sepolia': getEnvVar('ARB_SEPOLIA_RPC', 'https://sepolia-rollup.arbitrum.io/rpc'),
  optimism: getEnvVar('OP_MAINNET_RPC', 'https://mainnet.optimism.io'),
  'optimism-sepolia': getEnvVar('OP_SEPOLIA_RPC', 'https://sepolia.optimism.io'),
  base: getEnvVar('BASE_MAINNET_RPC', 'https://mainnet.base.org'),
  'base-sepolia': getEnvVar('BASE_SEPOLIA_RPC', 'https://sepolia.base.org'),
  polygon: getEnvVar('POLYGON_MAINNET_RPC', 'https://polygon-rpc.com'),
  'polygon-mumbai': getEnvVar('POLYGON_MUMBAI_RPC', 'https://rpc-mumbai.maticvigil.com'),
  zksync: getEnvVar('ZKSYNC_MAINNET_RPC', 'https://mainnet.era.zksync.io'),
  scroll: getEnvVar('SCROLL_MAINNET_RPC', 'https://rpc.scroll.io'),
  linea: getEnvVar('LINEA_MAINNET_RPC', 'https://rpc.linea.build'),
  mantle: getEnvVar('MANTLE_MAINNET_RPC', 'https://rpc.mantle.xyz'),
  blast: getEnvVar('BLAST_MAINNET_RPC', 'https://rpc.blast.io'),
  localhost: getEnvVar('ETH_LOCALHOST_RPC', 'http://localhost:8545'),
} as const

/**
 * Block explorer URLs by network
 */
export const ETHEREUM_EXPLORER_URLS: Record<EthereumNetwork, string> = {
  mainnet: 'https://etherscan.io',
  sepolia: 'https://sepolia.etherscan.io',
  goerli: 'https://goerli.etherscan.io',
  arbitrum: 'https://arbiscan.io',
  'arbitrum-sepolia': 'https://sepolia.arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  'optimism-sepolia': 'https://sepolia-optimism.etherscan.io',
  base: 'https://basescan.org',
  'base-sepolia': 'https://sepolia.basescan.org',
  polygon: 'https://polygonscan.com',
  'polygon-mumbai': 'https://mumbai.polygonscan.com',
  zksync: 'https://explorer.zksync.io',
  scroll: 'https://scrollscan.com',
  linea: 'https://lineascan.build',
  mantle: 'https://explorer.mantle.xyz',
  blast: 'https://blastscan.io',
  localhost: 'http://localhost:8545',
} as const

/**
 * Common ERC-20 token addresses on Ethereum mainnet
 */
export const ETHEREUM_TOKEN_CONTRACTS = {
  /** Wrapped ETH */
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  /** USD Coin */
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  /** Tether USD */
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  /** Dai Stablecoin */
  DAI: '0x6B175474E89094C44Da98b954EescdeCB5bE3d830',
  /** Chainlink */
  LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  /** Uniswap */
  UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  /** Aave */
  AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
} as const

/**
 * Token decimals for Ethereum tokens
 */
export const ETHEREUM_TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  WETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  LINK: 18,
  UNI: 18,
  AAVE: 18,
}

/**
 * EIP-5564 Stealth Address Announcer contract address
 * Deployed on mainnet and most L2s at the same address
 */
export const EIP5564_ANNOUNCER_ADDRESS = '0x55649E01B5Df198D18D95b5cc5051630cfD45564'

/**
 * EIP-5564 Stealth Meta-Address Registry contract address
 */
export const EIP5564_REGISTRY_ADDRESS = '0x6538E6bf4B0eBd30A8Ea10e318b7AEb51A8E4b5c'

/**
 * SIP announcement event signature (for log filtering)
 * Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)
 */
export const ANNOUNCEMENT_EVENT_SIGNATURE =
  '0x5f0eab8057630ba7676c49b4f21a0231414e79474595be8e4c432fbf6bf0f4e7'

/**
 * EIP-5564 scheme ID for secp256k1 stealth addresses
 */
export const SECP256K1_SCHEME_ID = 1

/**
 * View tag byte position and mask
 */
export const VIEW_TAG_MIN = 0
export const VIEW_TAG_MAX = 255

/**
 * Secp256k1 compressed public key length (33 bytes)
 */
export const SECP256K1_PUBKEY_LENGTH = 33

/**
 * Secp256k1 compressed public key hex length including '0x' prefix
 */
export const SECP256K1_PUBKEY_HEX_LENGTH = 68

/**
 * Ethereum address length (20 bytes)
 */
export const ETH_ADDRESS_LENGTH = 20

/**
 * Ethereum address hex length including '0x' prefix
 */
export const ETH_ADDRESS_HEX_LENGTH = 42

/**
 * Default gas limits for common operations
 */
export const DEFAULT_GAS_LIMITS = {
  /** Native ETH transfer */
  ethTransfer: 21000n,
  /** ERC-20 transfer */
  erc20Transfer: 65000n,
  /** ERC-20 approve */
  erc20Approve: 46000n,
  /** Stealth address announcement */
  announcement: 80000n,
  /** Claim from stealth address */
  claim: 100000n,
  /** Registry: register stealth meta-address */
  registryRegister: 150000n,
  /** Registry: update stealth meta-address */
  registryUpdate: 100000n,
  /** Registry: query meta-address (view call) */
  registryQuery: 0n,
} as const

/**
 * One ETH in wei
 */
export const ONE_ETH = 10n ** 18n

/**
 * One Gwei in wei
 */
export const ONE_GWEI = 10n ** 9n

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(
  txHash: string,
  network: EthereumNetwork = 'mainnet'
): string {
  const baseUrl = ETHEREUM_EXPLORER_URLS[network]
  return `${baseUrl}/tx/${txHash}`
}

/**
 * Get explorer URL for an address
 */
export function getAddressExplorerUrl(
  address: string,
  network: EthereumNetwork = 'mainnet'
): string {
  const baseUrl = ETHEREUM_EXPLORER_URLS[network]
  return `${baseUrl}/address/${address}`
}

/**
 * Get explorer URL for a token
 */
export function getTokenExplorerUrl(
  tokenAddress: string,
  network: EthereumNetwork = 'mainnet'
): string {
  const baseUrl = ETHEREUM_EXPLORER_URLS[network]
  return `${baseUrl}/token/${tokenAddress}`
}

/**
 * Get token contract address from symbol
 */
export function getTokenContract(symbol: string): string | undefined {
  return ETHEREUM_TOKEN_CONTRACTS[symbol as keyof typeof ETHEREUM_TOKEN_CONTRACTS]
}

/**
 * Get token decimals from symbol
 */
export function getEthereumTokenDecimals(symbol: string): number {
  return ETHEREUM_TOKEN_DECIMALS[symbol] ?? 18
}

/**
 * Get chain ID for a network
 */
export function getChainId(network: EthereumNetwork): number {
  return EVM_CHAIN_IDS[network]
}

/**
 * Get network name from chain ID
 */
export function getNetworkFromChainId(chainId: number): EthereumNetwork | undefined {
  const entry = Object.entries(EVM_CHAIN_IDS).find(([_, id]) => id === chainId)
  return entry ? (entry[0] as EthereumNetwork) : undefined
}

/**
 * Check if a network is a testnet
 */
export function isTestnet(network: EthereumNetwork): boolean {
  return (
    network === 'sepolia' ||
    network === 'goerli' ||
    network === 'arbitrum-sepolia' ||
    network === 'optimism-sepolia' ||
    network === 'base-sepolia' ||
    network === 'polygon-mumbai' ||
    network === 'localhost'
  )
}

/**
 * Check if a network is an L2
 */
export function isL2Network(network: EthereumNetwork): boolean {
  return (
    network === 'arbitrum' ||
    network === 'arbitrum-sepolia' ||
    network === 'optimism' ||
    network === 'optimism-sepolia' ||
    network === 'base' ||
    network === 'base-sepolia' ||
    network === 'polygon' ||
    network === 'polygon-mumbai'
  )
}

/**
 * Validate an Ethereum address format (basic check)
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Sanitize a URL by masking potential credentials
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    if (parsed.username || parsed.password) {
      parsed.username = '***'
      parsed.password = ''
    }

    const sensitivePatterns = [
      'api-key',
      'apikey',
      'api_key',
      'key',
      'token',
      'x-token',
      'secret',
      'auth',
    ]
    const keysToMask: string[] = []
    for (const [key] of parsed.searchParams) {
      const keyLower = key.toLowerCase()
      if (
        sensitivePatterns.some(
          (pattern) => keyLower === pattern || keyLower.includes(pattern)
        )
      ) {
        keysToMask.push(key)
      }
    }
    for (const key of keysToMask) {
      parsed.searchParams.set(key, '***')
    }

    return parsed.toString()
  } catch {
    return url
      .replace(/api-key=[^&]+/gi, 'api-key=***')
      .replace(/apikey=[^&]+/gi, 'apikey=***')
      .replace(/token=[^&]+/gi, 'token=***')
  }
}
