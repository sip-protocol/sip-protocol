/**
 * Centralized RPC endpoint configuration
 *
 * All localhost URLs are configurable via environment variables.
 * This allows Docker, Kubernetes, and CI environments to override defaults.
 *
 * @module config/endpoints
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
 * Solana RPC endpoints
 */
export const SOLANA_RPC_ENDPOINTS = {
  localnet: getEnvVar('SOLANA_LOCALNET_RPC', 'http://localhost:8899'),
  devnet: getEnvVar('SOLANA_DEVNET_RPC', 'https://api.devnet.solana.com'),
  testnet: getEnvVar('SOLANA_TESTNET_RPC', 'https://api.testnet.solana.com'),
  mainnet: getEnvVar('SOLANA_MAINNET_RPC', 'https://api.mainnet-beta.solana.com'),
} as const

/**
 * Solana explorer endpoints
 */
export const SOLANA_EXPLORER_ENDPOINTS = {
  localnet: getEnvVar('SOLANA_LOCALNET_EXPLORER', 'http://localhost:3000'),
  devnet: getEnvVar('SOLANA_DEVNET_EXPLORER', 'https://explorer.solana.com'),
  testnet: getEnvVar('SOLANA_TESTNET_EXPLORER', 'https://explorer.solana.com'),
  mainnet: getEnvVar('SOLANA_MAINNET_EXPLORER', 'https://explorer.solana.com'),
} as const

/**
 * Ethereum RPC endpoints
 */
export const ETH_RPC_ENDPOINTS = {
  localnet: getEnvVar('ETH_LOCALNET_RPC', 'http://localhost:8545'),
  goerli: getEnvVar('ETH_GOERLI_RPC', 'https://rpc.ankr.com/eth_goerli'),
  sepolia: getEnvVar('ETH_SEPOLIA_RPC', 'https://rpc.ankr.com/eth_sepolia'),
  mainnet: getEnvVar('ETH_MAINNET_RPC', 'https://rpc.ankr.com/eth'),
} as const

/**
 * Sui RPC endpoints
 */
export const SUI_RPC_ENDPOINTS = {
  localnet: getEnvVar('SUI_LOCALNET_RPC', 'http://localhost:9000'),
  devnet: getEnvVar('SUI_DEVNET_RPC', 'https://fullnode.devnet.sui.io:443'),
  testnet: getEnvVar('SUI_TESTNET_RPC', 'https://fullnode.testnet.sui.io:443'),
  mainnet: getEnvVar('SUI_MAINNET_RPC', 'https://fullnode.mainnet.sui.io:443'),
} as const

/**
 * Zcash RPC configuration
 */
export interface ZcashRpcConfig {
  host: string
  port: number
}

export const ZCASH_RPC_CONFIG: ZcashRpcConfig = {
  host: getEnvVar('ZCASH_RPC_HOST', '127.0.0.1'),
  port: parseInt(getEnvVar('ZCASH_RPC_PORT', '8232'), 10),
}

/**
 * Get all configurable endpoint environment variables
 * Useful for documentation and validation
 */
export function getEndpointEnvVars(): Record<string, { envVar: string; default: string }> {
  return {
    // Solana
    'solana.localnet': { envVar: 'SOLANA_LOCALNET_RPC', default: 'http://localhost:8899' },
    'solana.devnet': { envVar: 'SOLANA_DEVNET_RPC', default: 'https://api.devnet.solana.com' },
    'solana.testnet': { envVar: 'SOLANA_TESTNET_RPC', default: 'https://api.testnet.solana.com' },
    'solana.mainnet': { envVar: 'SOLANA_MAINNET_RPC', default: 'https://api.mainnet-beta.solana.com' },
    'solana.localnet.explorer': { envVar: 'SOLANA_LOCALNET_EXPLORER', default: 'http://localhost:3000' },
    // Ethereum
    'ethereum.localnet': { envVar: 'ETH_LOCALNET_RPC', default: 'http://localhost:8545' },
    'ethereum.goerli': { envVar: 'ETH_GOERLI_RPC', default: 'https://rpc.ankr.com/eth_goerli' },
    'ethereum.sepolia': { envVar: 'ETH_SEPOLIA_RPC', default: 'https://rpc.ankr.com/eth_sepolia' },
    'ethereum.mainnet': { envVar: 'ETH_MAINNET_RPC', default: 'https://rpc.ankr.com/eth' },
    // Sui
    'sui.localnet': { envVar: 'SUI_LOCALNET_RPC', default: 'http://localhost:9000' },
    'sui.devnet': { envVar: 'SUI_DEVNET_RPC', default: 'https://fullnode.devnet.sui.io:443' },
    'sui.testnet': { envVar: 'SUI_TESTNET_RPC', default: 'https://fullnode.testnet.sui.io:443' },
    'sui.mainnet': { envVar: 'SUI_MAINNET_RPC', default: 'https://fullnode.mainnet.sui.io:443' },
    // Zcash
    'zcash.host': { envVar: 'ZCASH_RPC_HOST', default: '127.0.0.1' },
    'zcash.port': { envVar: 'ZCASH_RPC_PORT', default: '8232' },
  }
}
