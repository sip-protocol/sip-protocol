# Solver Integration Guide

Guide for implementing SIP-compatible solvers that can fulfill shielded intents while preserving user privacy.

## Overview

SIP solvers are market makers that compete to fulfill cross-chain swap intents. Unlike traditional DEX aggregators, SIP solvers operate with privacy-preserving constraints:

- **Cannot see sender identity** (only cryptographic commitment)
- **Cannot see exact input amount** (only commitment)
- **Can see output requirements** (needed for quoting)
- **Receive one-time stealth addresses** (unlinkable to recipient)

## Privacy Guarantees

### What Solvers Can See

| Data | Visibility | Purpose |
|------|------------|---------|
| Output asset | **Visible** | Know what to deliver |
| Minimum output amount | **Visible** | Calculate quote |
| Maximum slippage | **Visible** | Price bounds |
| Expiry timestamp | **Visible** | Quote validity |
| Input commitment | **Hidden value** | Proves funds exist |
| Sender commitment | **Hidden value** | Proves valid sender |
| Recipient address | **Stealth** | One-time, unlinkable |
| Funding proof | **Verifiable** | Proves sufficient balance |
| Validity proof | **Verifiable** | Proves well-formed intent |

### What Solvers Cannot See

| Data | Protection | Impact |
|------|------------|--------|
| Sender identity | Commitment | Cannot profile users |
| Input amount | Commitment | Cannot front-run |
| Recipient identity | Stealth address | Cannot link transactions |
| Transaction history | Unlinkable | No pattern analysis |

## Implementing a Solver

### 1. Interface Overview

```typescript
interface SIPSolver {
  // Solver metadata
  readonly info: Solver
  readonly capabilities: SolverCapabilities

  // Core methods
  canHandle(intent: SolverVisibleIntent): Promise<boolean>
  generateQuote(intent: SolverVisibleIntent): Promise<SolverQuote | null>
  fulfill(intent: ShieldedIntent, quote: SolverQuote): Promise<FulfillmentResult>

  // Optional methods
  cancel?(intentId: string): Promise<boolean>
  getStatus?(intentId: string): Promise<FulfillmentStatus | null>
}
```

### 2. Implementing `canHandle`

Check if your solver can potentially fulfill the intent:

```typescript
async canHandle(intent: SolverVisibleIntent): Promise<boolean> {
  // Check chain support
  if (!this.capabilities.outputChains.includes(intent.outputAsset.chain)) {
    return false
  }

  // Check expiry
  if (intent.expiry < Date.now() / 1000) {
    return false
  }

  // Check minimum amount
  if (intent.minOutputAmount < this.info.minOrderSize) {
    return false
  }

  // Check liquidity availability
  const liquidity = await this.getLiquidity(intent.outputAsset)
  if (liquidity < intent.minOutputAmount) {
    return false
  }

  return true
}
```

### 3. Implementing `generateQuote`

Generate a competitive quote based on visible output requirements:

```typescript
async generateQuote(intent: SolverVisibleIntent): Promise<SolverQuote | null> {
  if (!await this.canHandle(intent)) {
    return null
  }

  // Get current market price
  const price = await this.getPrice(intent.outputAsset)

  // Calculate output amount (add your spread)
  const baseOutput = intent.minOutputAmount
  const outputWithSpread = baseOutput + (baseOutput * BigInt(spread)) / 10000n

  // Calculate fee
  const fee = (outputWithSpread * BigInt(feePercent)) / 10000n

  return {
    quoteId: generateQuoteId(),
    intentId: intent.intentId,
    solverId: this.info.id,
    outputAmount: outputWithSpread,
    estimatedTime: 30, // seconds
    expiry: Math.floor(Date.now() / 1000) + 60,
    fee,
    signature: await this.signQuote(quoteId, outputWithSpread),
    validUntil: Math.floor(Date.now() / 1000) + 60,
    estimatedGas: 200000n,
  }
}
```

### 4. Implementing `fulfill`

Execute the swap when user accepts your quote:

```typescript
async fulfill(
  intent: ShieldedIntent,
  quote: SolverQuote,
): Promise<FulfillmentResult> {
  try {
    // 1. Verify quote is still valid
    if (quote.expiry < Date.now() / 1000) {
      throw new Error('Quote expired')
    }

    // 2. Verify proofs (funding + validity)
    await this.verifyProofs(intent)

    // 3. Execute the swap
    //    - Send output tokens to stealth address
    //    - Stealth address is `intent.recipientStealth.address`
    const txHash = await this.executeSwap(
      intent.outputAsset,
      quote.outputAmount,
      intent.recipientStealth.address, // One-time address
    )

    // 4. Generate fulfillment proof
    const proof = await this.generateFulfillmentProof(intent, quote, txHash)

    return {
      intentId: intent.intentId,
      status: IntentStatus.FULFILLED,
      outputAmount: quote.outputAmount,
      txHash: intent.privacyLevel === 'transparent' ? txHash : undefined,
      fulfillmentProof: proof,
      fulfilledAt: Math.floor(Date.now() / 1000),
    }
  } catch (error) {
    return {
      intentId: intent.intentId,
      status: IntentStatus.FAILED,
      fulfilledAt: Math.floor(Date.now() / 1000),
      error: error.message,
    }
  }
}
```

## Solver Capabilities

Define your solver's capabilities:

```typescript
const capabilities: SolverCapabilities = {
  // Supported chains for input
  inputChains: ['near', 'ethereum', 'solana'],

  // Supported chains for output
  outputChains: ['near', 'ethereum', 'solana', 'zcash'],

  // Supported asset pairs
  supportedPairs: new Map([
    ['near', ['ethereum', 'solana']],
    ['ethereum', ['near', 'zcash']],
  ]),

  // Privacy features
  supportsShielded: true,
  supportsCompliant: true,
  supportsPartialFill: false,

  // Performance
  avgFulfillmentTime: 30, // seconds
}
```

## Privacy Best Practices

### Do's

1. **Verify proofs** - Always verify funding and validity proofs
2. **Use stealth addresses** - Send output to the provided stealth address
3. **Respect privacy levels** - Don't log transaction data for shielded intents
4. **Time randomization** - Add slight delays to prevent timing analysis

### Don'ts

1. **Don't log sender info** - Even commitment values
2. **Don't correlate intents** - Each intent should be treated independently
3. **Don't share intent data** - With third parties
4. **Don't store stealth addresses** - They're one-time use

## Event Handling

Emit events for monitoring and debugging:

```typescript
type SolverEvent =
  | { type: 'quote_generated'; data: { intentId: string; quote: SolverQuote } }
  | { type: 'fulfillment_started'; data: { intentId: string; txHash: string } }
  | { type: 'fulfillment_completed'; data: { intentId: string; proof: FulfillmentProof } }
  | { type: 'fulfillment_failed'; data: { intentId: string; error: string } }

// Usage
solver.on('quote_generated', ({ intentId, quote }) => {
  console.log(`Quote ${quote.quoteId} generated for intent ${intentId}`)
})
```

## Testing

Use MockSolver for testing:

```typescript
import { MockSolver, createMockSolver } from '@sip-protocol/sdk'

// Create solver with custom config
const solver = createMockSolver({
  name: 'Test Solver',
  supportedChains: ['near', 'ethereum'],
  feePercent: 0.005, // 0.5%
  executionDelay: 100, // ms
  failureRate: 0, // 0% failures
})

// Test quote generation
const quote = await solver.generateQuote(visibleIntent)
expect(quote).toBeDefined()
expect(quote.outputAmount).toBeGreaterThan(visibleIntent.minOutputAmount)
```

## Integration with NEAR Intents

For NEAR Intents integration, solvers connect to the Solver Bus:

```typescript
// WebSocket connection
const ws = new WebSocket('wss://solver-relay-v2.chaindefuser.com/ws')

// Subscribe to quote requests
ws.send(JSON.stringify({
  method: 'subscribe',
  params: ['quote'],
}))

// Handle quote requests
ws.on('message', async (data) => {
  const event = JSON.parse(data)
  if (event.event === 'quote') {
    const quote = await solver.generateQuote(event.data)
    if (quote) {
      ws.send(JSON.stringify({
        method: 'quote_response',
        params: { quote_id: event.data.quote_id, ...quote },
      }))
    }
  }
})
```

## Reference Implementation

See `packages/sdk/src/solver/mock-solver.ts` for a complete reference implementation.

## Security Considerations

1. **Collateral** - Lock collateral before fulfillment
2. **Timeout handling** - Handle expired intents gracefully
3. **Proof verification** - Verify all ZK proofs before executing
4. **Rate limiting** - Protect against spam quotes
5. **Quote signing** - Sign quotes to prevent tampering
