/**
 * Zcash RPC Types
 *
 * TypeScript definitions for Zcash node RPC API.
 * Based on Zcash 6.x RPC documentation.
 *
 * @see https://zcash.github.io/rpc/
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

/**
 * Zcash RPC client configuration
 */
export interface ZcashConfig {
  /** RPC host (default: 127.0.0.1) */
  host?: string
  /** RPC port (default: 8232 mainnet, 18232 testnet) */
  port?: number
  /** RPC username */
  username: string
  /** RPC password */
  password: string
  /** Use testnet (default: false) */
  testnet?: boolean
  /** Request timeout in ms (default: 30000) */
  timeout?: number
  /** Number of retries on failure (default: 3) */
  retries?: number
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number
}

/**
 * Zcash network type
 */
export type ZcashNetwork = 'mainnet' | 'testnet' | 'regtest'

// ─── Address Types ─────────────────────────────────────────────────────────────

/**
 * Zcash address types
 */
export type ZcashAddressType = 'p2pkh' | 'p2sh' | 'sprout' | 'sapling' | 'orchard' | 'unified'

/**
 * Receiver types for unified addresses
 */
export type ZcashReceiverType = 'p2pkh' | 'sapling' | 'orchard'

/**
 * Address validation result
 */
export interface ZcashAddressInfo {
  /** Whether the address is valid */
  isvalid: boolean
  /** The validated address */
  address?: string
  /** Address type */
  address_type?: ZcashAddressType
  /** Deprecated: same as address_type */
  type?: ZcashAddressType
  /** Whether the address belongs to this wallet */
  ismine?: boolean
  /** Sprout: paying key */
  payingkey?: string
  /** Sprout: transmission key */
  transmissionkey?: string
  /** Sapling: diversifier */
  diversifier?: string
  /** Sapling: diversified transmission key */
  diversifiedtransmissionkey?: string
}

// ─── Account Types ─────────────────────────────────────────────────────────────

/**
 * New account creation result
 */
export interface ZcashNewAccount {
  /** The account number */
  account: number
}

/**
 * Address for account result
 */
export interface ZcashAccountAddress {
  /** Account number */
  account: number
  /** Diversifier index used */
  diversifier_index: number
  /** Receiver types included */
  receiver_types: ZcashReceiverType[]
  /** The unified address */
  address: string
}

/**
 * Account balance per pool
 */
export interface ZcashPoolBalance {
  /** Balance in zatoshis */
  valueZat: number
}

/**
 * Account balance result
 */
export interface ZcashAccountBalance {
  /** Balances per pool */
  pools: {
    transparent?: ZcashPoolBalance
    sapling?: ZcashPoolBalance
    orchard?: ZcashPoolBalance
  }
  /** Minimum confirmations used */
  minimum_confirmations: number
}

// ─── Transaction Types ─────────────────────────────────────────────────────────

/**
 * Value pool types
 */
export type ZcashPool = 'transparent' | 'sprout' | 'sapling' | 'orchard'

/**
 * Unspent note (shielded UTXO)
 */
export interface ZcashUnspentNote {
  /** Transaction ID */
  txid: string
  /** Value pool */
  pool: ZcashPool
  /** Output index */
  outindex: number
  /** Number of confirmations */
  confirmations: number
  /** Whether spendable by this wallet */
  spendable: boolean
  /** The shielded address */
  address: string
  /** Value in ZEC */
  amount: number
  /** Memo field (hex) */
  memo: string
  /** Memo as UTF-8 if valid */
  memoStr?: string
  /** Whether this is change */
  change: boolean
  /** Sprout: joinsplit index */
  jsindex?: number
  /** Sprout: joinsplit output index */
  jsoutindex?: number
}

/**
 * Recipient for z_sendmany
 */
export interface ZcashSendRecipient {
  /** Recipient address (t-addr, z-addr, or unified) */
  address: string
  /** Amount in ZEC */
  amount: number
  /** Optional memo (hex, for shielded recipients only) */
  memo?: string
}

/**
 * Privacy policy for z_sendmany
 */
export type ZcashPrivacyPolicy =
  | 'LegacyCompat'
  | 'FullPrivacy'
  | 'AllowRevealedAmounts'
  | 'AllowRevealedRecipients'
  | 'AllowRevealedSenders'
  | 'AllowFullyTransparent'
  | 'AllowLinkingAccountAddresses'
  | 'NoPrivacy'

/**
 * Parameters for shielded send
 */
export interface ZcashShieldedSendParams {
  /** Source address */
  fromAddress: string
  /** Recipients */
  recipients: ZcashSendRecipient[]
  /** Minimum confirmations (default: 10) */
  minConf?: number
  /** Fee in ZEC (default: ZIP 317 calculation) */
  fee?: number
  /** Privacy policy (default: LegacyCompat) */
  privacyPolicy?: ZcashPrivacyPolicy
}

// ─── Operation Types ───────────────────────────────────────────────────────────

/**
 * Operation status values
 */
export type ZcashOperationStatus = 'queued' | 'executing' | 'success' | 'failed' | 'cancelled'

/**
 * Operation result for successful transactions
 */
export interface ZcashOperationTxResult {
  /** Transaction ID */
  txid: string
}

/**
 * Operation error
 */
export interface ZcashOperationError {
  /** Error code */
  code: number
  /** Error message */
  message: string
}

/**
 * Operation status response
 */
export interface ZcashOperation {
  /** Operation ID */
  id: string
  /** Current status */
  status: ZcashOperationStatus
  /** Creation time (Unix timestamp) */
  creation_time: number
  /** Method that created this operation */
  method: string
  /** Method parameters */
  params: Record<string, unknown>
  /** Result (if successful) */
  result?: ZcashOperationTxResult
  /** Error (if failed) */
  error?: ZcashOperationError
  /** Execution seconds (if completed) */
  execution_secs?: number
}

// ─── Block Types ───────────────────────────────────────────────────────────────

/**
 * Block header information
 */
export interface ZcashBlockHeader {
  /** Block hash */
  hash: string
  /** Number of confirmations */
  confirmations: number
  /** Block height */
  height: number
  /** Block version */
  version: number
  /** Merkle root */
  merkleroot: string
  /** Block time (Unix timestamp) */
  time: number
  /** Nonce */
  nonce: string
  /** Solution */
  solution: string
  /** Bits */
  bits: string
  /** Difficulty */
  difficulty: number
  /** Chain work */
  chainwork: string
  /** Previous block hash */
  previousblockhash?: string
  /** Next block hash */
  nextblockhash?: string
}

/**
 * Full block data
 */
export interface ZcashBlock extends ZcashBlockHeader {
  /** Transaction IDs in the block */
  tx: string[]
  /** Block size in bytes */
  size: number
}

// ─── RPC Request/Response ──────────────────────────────────────────────────────

/**
 * JSON-RPC request
 */
export interface ZcashRPCRequest {
  /** JSON-RPC version */
  jsonrpc: '1.0' | '2.0'
  /** Request ID */
  id: string | number
  /** Method name */
  method: string
  /** Method parameters */
  params: unknown[]
}

/**
 * JSON-RPC response
 */
export interface ZcashRPCResponse<T = unknown> {
  /** Result (if successful) */
  result: T | null
  /** Error (if failed) */
  error: ZcashRPCError | null
  /** Request ID */
  id: string | number
}

/**
 * JSON-RPC error
 */
export interface ZcashRPCError {
  /** Error code */
  code: number
  /** Error message */
  message: string
  /** Additional data */
  data?: unknown
}

// ─── Error Codes ───────────────────────────────────────────────────────────────

/**
 * Standard Zcash RPC error codes
 */
export const ZcashErrorCode = {
  // General errors
  MISC_ERROR: -1,
  TYPE_ERROR: -3,
  INVALID_ADDRESS_OR_KEY: -5,
  OUT_OF_MEMORY: -7,
  INVALID_PARAMETER: -8,
  DATABASE_ERROR: -20,
  DESERIALIZATION_ERROR: -22,
  VERIFY_ERROR: -25,
  VERIFY_REJECTED: -26,
  VERIFY_ALREADY_IN_CHAIN: -27,
  IN_WARMUP: -28,

  // P2P client errors
  CLIENT_NOT_CONNECTED: -9,
  CLIENT_IN_INITIAL_DOWNLOAD: -10,
  CLIENT_NODE_ALREADY_ADDED: -23,
  CLIENT_NODE_NOT_ADDED: -24,
  CLIENT_NODE_NOT_CONNECTED: -29,
  CLIENT_INVALID_IP_OR_SUBNET: -30,

  // Wallet errors
  WALLET_ERROR: -4,
  WALLET_INSUFFICIENT_FUNDS: -6,
  WALLET_INVALID_ACCOUNT_NAME: -11,
  WALLET_KEYPOOL_RAN_OUT: -12,
  WALLET_UNLOCK_NEEDED: -13,
  WALLET_PASSPHRASE_INCORRECT: -14,
  WALLET_WRONG_ENC_STATE: -15,
  WALLET_ENCRYPTION_FAILED: -16,
  WALLET_ALREADY_UNLOCKED: -17,
} as const

export type ZcashErrorCodeType = (typeof ZcashErrorCode)[keyof typeof ZcashErrorCode]

// ─── Blockchain Info ───────────────────────────────────────────────────────────

/**
 * Blockchain information
 */
export interface ZcashBlockchainInfo {
  /** Current network (main, test, regtest) */
  chain: string
  /** Current block count */
  blocks: number
  /** Current header count */
  headers: number
  /** Best block hash */
  bestblockhash: string
  /** Current difficulty */
  difficulty: number
  /** Verification progress */
  verificationprogress: number
  /** Chain work */
  chainwork: string
  /** Whether initial block download is complete */
  initialblockdownload: boolean
  /** Size on disk in bytes */
  size_on_disk: number
  /** Whether pruned */
  pruned: boolean
  /** Consensus parameters */
  consensus: {
    chaintip: string
    nextblock: string
  }
}

/**
 * Network information
 */
export interface ZcashNetworkInfo {
  /** Server version */
  version: number
  /** Server subversion string */
  subversion: string
  /** Protocol version */
  protocolversion: number
  /** Local services offered */
  localservices: string
  /** Number of connections */
  connections: number
  /** Networks available */
  networks: Array<{
    name: string
    limited: boolean
    reachable: boolean
  }>
  /** Relay fee */
  relayfee: number
  /** Local addresses */
  localaddresses: Array<{
    address: string
    port: number
    score: number
  }>
}
