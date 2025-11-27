/**
 * NEAR Intents 1Click API Type Definitions
 *
 * TypeScript types for integrating with NEAR Intents 1Click API
 * and Solver Relay for cross-chain intent-based swaps.
 *
 * @see https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api
 */

// ─── Asset Identifiers ─────────────────────────────────────────────────────────

/**
 * Defuse asset identifier format: {chain}:{network}:{address}
 * Examples:
 * - "near:mainnet:wrap.near"
 * - "eth:1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
 * - "sol:mainnet:native"
 */
export type DefuseAssetId = string

/**
 * Chain identifier for deposit/refund/recipient types
 */
export type ChainType = 'near' | 'eth' | 'sol' | 'btc' | 'zcash' | 'arb' | 'base' | 'polygon' | string

// ─── 1Click API Types ──────────────────────────────────────────────────────────

/**
 * Swap type determines how amounts are calculated
 */
export enum OneClickSwapType {
  /** Fixed input amount, variable output */
  EXACT_INPUT = 'EXACT_INPUT',
  /** Fixed output amount, variable input */
  EXACT_OUTPUT = 'EXACT_OUTPUT',
  /** Partial deposits allowed, variable amounts */
  FLEX_INPUT = 'FLEX_INPUT',
  /** Streaming deposits, ongoing swaps */
  ANY_INPUT = 'ANY_INPUT',
}

/**
 * Deposit mode for the swap
 */
export enum OneClickDepositMode {
  /** Standard deposit to address */
  SIMPLE = 'SIMPLE',
  /** Deposit with memo (for chains like NEAR) */
  MEMO = 'MEMO',
}

/**
 * Status of a swap in the 1Click system
 */
export enum OneClickSwapStatus {
  /** Awaiting user deposit */
  PENDING_DEPOSIT = 'PENDING_DEPOSIT',
  /** Deposit detected, execution in progress */
  PROCESSING = 'PROCESSING',
  /** Successfully delivered to destination */
  SUCCESS = 'SUCCESS',
  /** Deposit below minimum threshold */
  INCOMPLETE_DEPOSIT = 'INCOMPLETE_DEPOSIT',
  /** Funds returned automatically */
  REFUNDED = 'REFUNDED',
  /** Execution error occurred */
  FAILED = 'FAILED',
}

/**
 * Token metadata from /v0/tokens endpoint
 */
export interface OneClickToken {
  /** Defuse asset identifier */
  defuse_asset_id: DefuseAssetId
  /** Blockchain name */
  blockchain: string
  /** Token contract address or null for native */
  address: string | null
  /** Token symbol */
  symbol: string
  /** Token decimals */
  decimals: number
  /** Current USD price */
  priceUsd?: string
}

/**
 * Fee recipient for app-level fees
 */
export interface OneClickAppFee {
  /** Fee recipient address */
  recipient: string
  /** Fee recipient chain type */
  recipientType: ChainType
  /** Fee amount in basis points or absolute */
  amount: string
}

/**
 * Quote request parameters for POST /v0/quote
 */
export interface OneClickQuoteRequest {
  /** Preview only, no deposit address generated */
  dry?: boolean
  /** How to calculate the swap */
  swapType: OneClickSwapType
  /** Slippage tolerance in basis points (100 = 1%) */
  slippageTolerance?: number
  /** Source asset identifier */
  originAsset: DefuseAssetId
  /** Destination asset identifier */
  destinationAsset: DefuseAssetId
  /** Amount in smallest units (input or output depending on swapType) */
  amount: string
  /** Address for refunds on failed swaps */
  refundTo: string
  /** Destination address for output tokens */
  recipient: string
  /** Source chain identifier */
  depositType: ChainType
  /** Refund chain identifier */
  refundType: ChainType
  /** Destination chain identifier */
  recipientType: ChainType
  /** ISO timestamp for automatic refund trigger */
  deadline?: string
  /** Deposit mode */
  depositMode?: OneClickDepositMode
  /** Optional app-level fees */
  appFees?: OneClickAppFee[]
}

/**
 * Quote response from POST /v0/quote
 */
export interface OneClickQuoteResponse {
  /** Unique quote identifier */
  quoteId: string
  /** Address to deposit input tokens */
  depositAddress: string
  /** Required input amount in smallest units */
  amountIn: string
  /** Human-readable input amount */
  amountInFormatted: string
  /** Expected output amount in smallest units */
  amountOut: string
  /** Human-readable output amount */
  amountOutFormatted: string
  /** Estimated USD value (display only) */
  amountOutUsd?: string
  /** Quote expiration timestamp */
  deadline: string
  /** Estimated completion time in seconds */
  timeEstimate: number
  /** Quote signature */
  signature: string
  /** Original request echo */
  request?: OneClickQuoteRequest
}

/**
 * Deposit submission for POST /v0/deposit/submit
 */
export interface OneClickDepositSubmit {
  /** Transaction hash of the deposit */
  txHash: string
  /** Deposit address from quote */
  depositAddress: string
  /** NEAR account if depositing from NEAR */
  nearSenderAccount?: string
  /** Memo for memo-based deposits */
  memo?: string
}

/**
 * Status response from GET /v0/status
 */
export interface OneClickStatusResponse {
  /** Current swap status */
  status: OneClickSwapStatus
  /** Deposit transaction hash */
  depositTxHash?: string
  /** Settlement transaction hash */
  settlementTxHash?: string
  /** Actual input amount */
  amountIn?: string
  /** Actual output amount */
  amountOut?: string
  /** Error message if failed */
  error?: string
}

/**
 * ANY_INPUT withdrawal record
 */
export interface OneClickWithdrawal {
  /** Withdrawal amount */
  amount: string
  /** Fees deducted */
  fees: string
  /** Timestamp of withdrawal */
  timestamp: string
  /** Transaction hash */
  txHash: string
}

// ─── Solver Relay Types ────────────────────────────────────────────────────────

/**
 * Solver relay intent status
 */
export enum SolverIntentStatus {
  /** Awaiting solver execution */
  PENDING = 'PENDING',
  /** Transaction submitted to chain */
  TX_BROADCASTED = 'TX_BROADCASTED',
  /** Fully settled on-chain */
  SETTLED = 'SETTLED',
  /** Intent not found or invalid */
  NOT_FOUND_OR_NOT_VALID = 'NOT_FOUND_OR_NOT_VALID',
}

/**
 * Supported signature types for intent signing
 */
export enum SolverSignatureType {
  /** NEAR Protocol NEP-413 standard */
  NEP413 = 'nep413',
  /** Ethereum ERC-191 standard */
  ERC191 = 'erc191',
  /** Raw Ed25519 signature */
  RAW_ED25519 = 'raw_ed25519',
}

/**
 * Quote request for solver relay
 */
export interface SolverQuoteRequest {
  /** Input asset identifier */
  defuse_asset_identifier_in: DefuseAssetId
  /** Output asset identifier */
  defuse_asset_identifier_out: DefuseAssetId
  /** Exact input amount (mutually exclusive with exact_amount_out) */
  exact_amount_in?: string
  /** Exact output amount (mutually exclusive with exact_amount_in) */
  exact_amount_out?: string
  /** Minimum validity time for quotes in milliseconds (default: 60000) */
  min_deadline_ms?: number
}

/**
 * Quote response from solver relay
 */
export interface SolverQuoteResponse {
  /** Unique quote hash for reference */
  quote_hash: string
  /** Input asset identifier */
  defuse_asset_identifier_in: DefuseAssetId
  /** Output asset identifier */
  defuse_asset_identifier_out: DefuseAssetId
  /** Required input amount */
  amount_in: string
  /** Offered output amount */
  amount_out: string
  /** Quote expiration timestamp */
  expiration_time: string
}

/**
 * Signed data for intent publication
 */
export interface SolverSignedData {
  /** Signed message payload */
  message: string
  /** Unique nonce */
  nonce: string
  /** Recipient solver account */
  recipient: string
}

/**
 * Intent publication request
 */
export interface SolverPublishIntent {
  /** Quote hashes to fulfill */
  quote_hashes: string[]
  /** Signed intent data */
  signed_data: SolverSignedData
  /** Signature type used */
  signature_type: SolverSignatureType
  /** Signature bytes */
  signature: string
}

/**
 * Intent status response
 */
export interface SolverStatusResponse {
  /** Current status */
  status: SolverIntentStatus
  /** NEAR transaction hash if settled */
  near_tx_hash?: string
}

/**
 * Token diff intent format for verifier contract
 * Keys are defuse asset identifiers
 * Positive values = receive, Negative values = send
 */
export interface TokenDiffIntent {
  [assetId: DefuseAssetId]: string
}

// ─── WebSocket Events ──────────────────────────────────────────────────────────

/**
 * Quote event received by solvers
 */
export interface SolverQuoteEvent {
  /** Event type */
  event: 'quote'
  /** Quote data */
  data: {
    /** Unique quote ID */
    quote_id: string
    /** Input asset */
    defuse_asset_identifier_in: DefuseAssetId
    /** Output asset */
    defuse_asset_identifier_out: DefuseAssetId
    /** Exact input amount if specified */
    exact_amount_in?: string
    /** Exact output amount if specified */
    exact_amount_out?: string
    /** Minimum deadline in ms */
    min_deadline_ms: number
  }
}

/**
 * Quote status event
 */
export interface SolverQuoteStatusEvent {
  /** Event type */
  event: 'quote_status'
  /** Status data */
  data: {
    /** Quote ID */
    quote_id: string
    /** Current status */
    status: SolverIntentStatus
  }
}

// ─── Error Types ───────────────────────────────────────────────────────────────

/**
 * 1Click API error codes
 */
export enum OneClickErrorCode {
  /** No solvers can fill this amount */
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  /** Asset pair not supported */
  UNSUPPORTED_PAIR = 'UNSUPPORTED_PAIR',
  /** Amount below minimum threshold */
  AMOUNT_TOO_LOW = 'AMOUNT_TOO_LOW',
  /** Deadline too short for solvers */
  DEADLINE_TOO_SHORT = 'DEADLINE_TOO_SHORT',
  /** Invalid request parameters */
  INVALID_PARAMS = 'INVALID_PARAMS',
  /** Rate limit exceeded */
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * API error response
 */
export interface OneClickError {
  /** Error code */
  code: OneClickErrorCode | string
  /** Human-readable message */
  message: string
  /** Additional error details */
  details?: Record<string, unknown>
}

// ─── API Client Configuration ──────────────────────────────────────────────────

/**
 * 1Click API client configuration
 */
export interface OneClickConfig {
  /** Base URL (default: https://1click.chaindefuser.com) */
  baseUrl?: string
  /** JWT token for authenticated requests */
  jwtToken?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom fetch implementation */
  fetch?: typeof fetch
}

/**
 * Solver relay configuration
 */
export interface SolverRelayConfig {
  /** RPC endpoint (default: https://solver-relay-v2.chaindefuser.com/rpc) */
  rpcUrl?: string
  /** WebSocket endpoint (default: wss://solver-relay-v2.chaindefuser.com/ws) */
  wsUrl?: string
  /** Request timeout in milliseconds */
  timeout?: number
}
