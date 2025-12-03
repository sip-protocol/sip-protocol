# Settlement Backend Interface

This directory contains the settlement abstraction layer for SIP Protocol, enabling pluggable settlement backends for cross-chain swaps.

## Overview

The `SettlementBackend` interface provides a unified API for executing cross-chain swaps through different settlement providers (NEAR Intents, Zcash, THORChain, direct on-chain execution, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  SIP SDK (Application Layer)                            │
│  • createIntent()                                       │
│  • getQuotes()                                          │
│  • execute()                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Settlement Backend Interface (Abstraction Layer)       │
│  • getQuote()                                           │
│  • executeSwap()                                        │
│  • getStatus()                                          │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┬───────────────┐
         ▼           ▼           ▼               ▼
┌─────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│ NEAR        │ │ Zcash   │ │THORChain │ │ Direct Chain │
│ Intents     │ │ Backend │ │ Backend  │ │ Backend      │
└─────────────┘ └─────────┘ └──────────┘ └──────────────┘
```

## Core Types

### SettlementBackend

The main interface that all backends must implement:

```typescript
interface SettlementBackend {
  readonly name: SettlementBackendName
  readonly capabilities: BackendCapabilities

  getQuote(params: QuoteParams): Promise<Quote>
  executeSwap(params: SwapParams): Promise<SwapResult>
  getStatus(swapId: string): Promise<SwapStatusResponse>

  // Optional methods
  cancel?(swapId: string): Promise<void>
  waitForCompletion?(swapId: string, options?): Promise<SwapStatusResponse>
  getDryQuote?(params: QuoteParams): Promise<Quote>
  notifyDeposit?(swapId: string, txHash: string, metadata?): Promise<void>
}
```

### QuoteParams

Parameters for requesting a swap quote:

```typescript
interface QuoteParams {
  fromChain: ChainId
  toChain: ChainId
  fromToken: string
  toToken: string
  amount: bigint
  privacyLevel: PrivacyLevel
  recipientMetaAddress?: StealthMetaAddress | string
  senderAddress?: string
  slippageTolerance?: number
  deadline?: number
}
```

### Quote

Quote response with pricing and execution details:

```typescript
interface Quote {
  quoteId: string
  amountIn: string
  amountOut: string
  minAmountOut: string
  fees: {
    networkFee: string
    protocolFee: string
    totalFeeUSD?: string
  }
  depositAddress: string
  recipientAddress: string
  expiresAt: number
  // ... optional fields
}
```

### SwapStatus

Enum tracking swap lifecycle:

```typescript
enum SwapStatus {
  PENDING_DEPOSIT = 'pending_deposit',
  DEPOSIT_CONFIRMED = 'deposit_confirmed',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDING = 'refunding',
  REFUNDED = 'refunded',
}
```

## Implementing a Backend

### 1. Basic Implementation

```typescript
import type {
  SettlementBackend,
  QuoteParams,
  Quote,
  SwapParams,
  SwapResult,
  SwapStatusResponse,
  BackendCapabilities,
} from '@sip-protocol/sdk'

export class MySettlementBackend implements SettlementBackend {
  readonly name = 'my-backend'
  readonly capabilities: BackendCapabilities = {
    supportedSourceChains: ['ethereum', 'solana'],
    supportedDestinationChains: ['near', 'polygon'],
    supportedPrivacyLevels: [PrivacyLevel.TRANSPARENT, PrivacyLevel.SHIELDED],
    supportsCancellation: false,
    supportsRefunds: true,
    averageExecutionTime: 120, // seconds
  }

  constructor(private config: MyBackendConfig) {}

  async getQuote(params: QuoteParams): Promise<Quote> {
    // 1. Validate parameters
    this.validateQuoteParams(params)

    // 2. Call backend API for quote
    const backendQuote = await this.fetchQuote(params)

    // 3. Convert to standard Quote format
    return {
      quoteId: backendQuote.id,
      amountIn: params.amount.toString(),
      amountOut: backendQuote.outputAmount,
      minAmountOut: this.calculateMinOutput(
        backendQuote.outputAmount,
        params.slippageTolerance
      ),
      fees: {
        networkFee: backendQuote.networkFee,
        protocolFee: backendQuote.protocolFee,
      },
      depositAddress: backendQuote.depositAddress,
      recipientAddress: backendQuote.recipient,
      expiresAt: Date.now() + 300000, // 5 minutes
    }
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    // 1. Retrieve quote
    const quote = await this.getQuoteById(params.quoteId)

    // 2. Execute swap (may involve signing, approvals, etc.)
    const execution = await this.executeBackendSwap(params)

    // 3. Return result
    return {
      swapId: execution.id,
      status: SwapStatus.PENDING_DEPOSIT,
      quoteId: params.quoteId,
      depositAddress: execution.depositAddress,
    }
  }

  async getStatus(swapId: string): Promise<SwapStatusResponse> {
    // Query backend for current status
    const backendStatus = await this.fetchStatus(swapId)

    return {
      swapId,
      status: this.mapStatus(backendStatus.status),
      quoteId: backendStatus.quoteId,
      depositAddress: backendStatus.depositAddress,
      amountIn: backendStatus.amountIn,
      amountOut: backendStatus.amountOut,
      depositTxHash: backendStatus.depositTx,
      settlementTxHash: backendStatus.settlementTx,
      updatedAt: backendStatus.lastUpdated,
    }
  }

  // Helper methods
  private validateQuoteParams(params: QuoteParams): void {
    if (!this.capabilities.supportedSourceChains.includes(params.fromChain)) {
      throw new ValidationError(`Chain ${params.fromChain} not supported`)
    }
    // ... more validation
  }

  private mapStatus(backendStatus: string): SwapStatus {
    // Map backend-specific status to SwapStatus enum
    const statusMap = {
      'waiting': SwapStatus.PENDING_DEPOSIT,
      'processing': SwapStatus.IN_PROGRESS,
      'completed': SwapStatus.SUCCESS,
      'failed': SwapStatus.FAILED,
    }
    return statusMap[backendStatus] ?? SwapStatus.FAILED
  }
}
```

### 2. Optional Methods

Implement optional methods for enhanced functionality:

```typescript
export class MySettlementBackend implements SettlementBackend {
  // ... required methods ...

  async cancel(swapId: string): Promise<void> {
    if (!this.capabilities.supportsCancellation) {
      throw new ProofError('Cancellation not supported')
    }

    const status = await this.getStatus(swapId)
    if (status.status !== SwapStatus.PENDING_DEPOSIT) {
      throw new ValidationError('Can only cancel pending swaps')
    }

    await this.backendCancelSwap(swapId)
  }

  async waitForCompletion(
    swapId: string,
    options?: { interval?: number; timeout?: number; onStatusChange?: (status: SwapStatusResponse) => void }
  ): Promise<SwapStatusResponse> {
    const interval = options?.interval ?? 5000
    const timeout = options?.timeout ?? 600000
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus(swapId)
      options?.onStatusChange?.(status)

      if (
        status.status === SwapStatus.SUCCESS ||
        status.status === SwapStatus.FAILED ||
        status.status === SwapStatus.REFUNDED
      ) {
        return status
      }

      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new NetworkError('Swap timeout')
  }

  async getDryQuote(params: QuoteParams): Promise<Quote> {
    // Return quote without creating deposit address
    return this.getQuote({ ...params, dry: true })
  }

  async notifyDeposit(
    swapId: string,
    txHash: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.backendNotifyDeposit(swapId, txHash, metadata)
  }
}
```

### 3. Factory Function

Provide a factory function for easy instantiation:

```typescript
export function createMyBackend(config: MyBackendConfig): SettlementBackend {
  return new MySettlementBackend(config)
}
```

### 4. Registry Entry

Create a registry entry for discoverability:

```typescript
export const myBackendRegistry: SettlementBackendRegistry = {
  name: 'my-backend',
  factory: createMyBackend,
  displayName: 'My Settlement Backend',
  description: 'Fast and reliable cross-chain swaps',
  homepage: 'https://mybackend.com',
  docs: 'https://docs.mybackend.com',
}
```

## Privacy Support

Backends should handle privacy levels appropriately:

### Transparent Mode

No privacy features required. Use sender's address directly.

```typescript
if (params.privacyLevel === PrivacyLevel.TRANSPARENT) {
  // Use senderAddress as both sender and recipient
  recipientAddress = params.senderAddress
}
```

### Shielded Mode

Generate stealth address for recipient:

```typescript
if (params.privacyLevel === PrivacyLevel.SHIELDED) {
  // Generate stealth address from recipientMetaAddress
  const { stealthAddress, ephemeralPublicKey } = generateStealthAddress(
    params.recipientMetaAddress
  )

  recipientAddress = stealthAddress
  // Store ephemeralPublicKey in metadata for recipient recovery
}
```

### Compliant Mode

Same as shielded, but include viewing key hash for auditors:

```typescript
if (params.privacyLevel === PrivacyLevel.COMPLIANT) {
  // Generate stealth address + viewing key hash
  const { stealthAddress, viewingKeyHash } = generateCompliantAddress(
    params.recipientMetaAddress,
    params.viewingKey
  )

  recipientAddress = stealthAddress
  // Include viewingKeyHash in metadata for auditors
}
```

## Error Handling

Use standard SIP errors:

```typescript
import { ValidationError, NetworkError, ProofError } from '@sip-protocol/sdk'

// Invalid parameters
throw new ValidationError('Invalid amount', 'amount', { min: 0, received: -1 })

// API/network issues
throw new NetworkError('Backend API unavailable', { status: 503 })

// Unsupported features
throw new ProofError('Feature not supported by this backend')
```

## Testing

Write comprehensive tests for your backend:

```typescript
import { describe, it, expect } from 'vitest'
import { PrivacyLevel } from '@sip-protocol/types'
import { MySettlementBackend } from './my-backend'

describe('MySettlementBackend', () => {
  it('should implement SettlementBackend interface', () => {
    const backend = new MySettlementBackend(config)

    expect(backend.name).toBe('my-backend')
    expect(backend.capabilities).toBeDefined()
    expect(typeof backend.getQuote).toBe('function')
    expect(typeof backend.executeSwap).toBe('function')
    expect(typeof backend.getStatus).toBe('function')
  })

  it('should get quote for valid params', async () => {
    const backend = new MySettlementBackend(config)

    const quote = await backend.getQuote({
      fromChain: 'ethereum',
      toChain: 'near',
      fromToken: 'USDC',
      toToken: 'NEAR',
      amount: 1000000n,
      privacyLevel: PrivacyLevel.TRANSPARENT,
    })

    expect(quote.quoteId).toBeDefined()
    expect(quote.depositAddress).toBeDefined()
    expect(BigInt(quote.amountOut)).toBeGreaterThan(0n)
  })

  // ... more tests
})
```

## Examples

See existing implementations:

- `packages/sdk/src/adapters/near-intents.ts` - NEAR Intents adapter (reference implementation)
- `packages/sdk/src/zcash/swap-service.ts` - Zcash swap service (privacy-focused)

## Roadmap

Planned backends for M11-M12 milestones:

- [x] NEAR Intents (M1-M8)
- [ ] Zcash Settlement Backend (M9)
- [ ] THORChain Backend (M10)
- [ ] Direct Chain Backend (M11)
- [ ] Mina Protocol Backend (M12)

## Resources

- [SIP Protocol Documentation](https://docs.sip-protocol.org)
- [NEAR Intents API](https://1click.chaindefuser.com)
- [THORChain Docs](https://docs.thorchain.org)
- [Zcash Shielded Transactions](https://z.cash/technology/zksnarks/)
