import type { ChainId, HexString } from '@sip-protocol/types'

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'shutting_down'
  version: string
  timestamp: string
  uptime: number
  services?: {
    proofProvider: {
      ready: boolean
      error: string | null
    }
    rateLimiter?: {
      store: 'redis' | 'memory'
      redisConfigured: boolean
      redisConnected: boolean
    }
  }
  cache?: {
    swaps: {
      size: number
      maxSize: number
      utilizationPercent: number
    }
  }
}

/**
 * Request schemas
 */
export interface GenerateStealthRequest {
  chain: ChainId
  recipientMetaAddress: {
    spendingKey: HexString
    viewingKey: HexString
    chain: ChainId
    label?: string
  }
}

export interface CreateCommitmentRequest {
  value: string // bigint as string
  blindingFactor?: HexString
}

export interface GenerateFundingProofRequest {
  balance: string // bigint as string
  minRequired: string // bigint as string
  balanceBlinding: HexString
}

export interface GetQuoteRequest {
  inputChain: ChainId
  inputToken: string
  inputAmount: string // bigint as string
  outputChain: ChainId
  outputToken: string
  slippageTolerance?: number
}

export interface ExecuteSwapRequest {
  intentId: string
  quoteId: string
  privacy?: 'transparent' | 'shielded' | 'compliant'
  viewingKey?: HexString
}

/**
 * Response schemas
 */
export interface StealthAddressResponse {
  stealthAddress: {
    address: HexString
    ephemeralPublicKey: HexString
    viewTag: number
  }
}

export interface CommitmentResponse {
  commitment: HexString
  blindingFactor: HexString
}

export interface FundingProofResponse {
  proof: HexString
  publicInputs: HexString[]
}

export interface QuoteResponse {
  quoteId: string
  inputAmount: string
  outputAmount: string
  rate: string
  estimatedTime: number
  fees: {
    network: string
    protocol: string
  }
  route?: {
    steps: Array<{
      chain: ChainId
      protocol: string
      fromToken: string
      toToken: string
    }>
  }
}

export interface SwapResponse {
  swapId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionHash?: HexString
  timestamp: string
}

export interface SwapStatusResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionHash?: HexString
  inputAmount: string
  outputAmount?: string
  createdAt: string
  updatedAt: string
  error?: string
}
