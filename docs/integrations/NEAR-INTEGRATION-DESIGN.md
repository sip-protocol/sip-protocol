# NEAR Intents Integration Design

Design document for integrating NEAR 1Click API with SIP Protocol SDK.

## Goals

1. Enable privacy-preserving cross-chain swaps via NEAR Intents
2. Shield recipient identity using stealth addresses
3. Support compliant mode with selective disclosure
4. Provide seamless developer experience

## Non-Goals

- Hiding input amounts (requires protocol-level changes)
- Solver-side privacy (out of scope for MVP)
- Custom solver implementation (use existing network)

## Architecture

### Component Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           SIP SDK                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     Intent Layer                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐│  │
│  │  │IntentBuilder│  │PrivacyLayer │  │      NEARIntentsAdapter     ││  │
│  │  │(existing)   │──│(existing)   │──│         (new)               ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘│  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                   │                                       │
│  ┌────────────────────────────────┼───────────────────────────────────┐  │
│  │               Stealth & Commitment Layer                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐   │  │
│  │  │  Stealth    │  │  Pedersen   │  │    Viewing Keys          │   │  │
│  │  │  Addresses  │  │ Commitments │  │                          │   │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                   │                                       │
│  ┌────────────────────────────────┼───────────────────────────────────┐  │
│  │                     Network Adapters                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐   │  │
│  │  │ OneClick    │  │ SolverRelay │  │    Status Tracker        │   │  │
│  │  │   Client    │  │   Client    │  │                          │   │  │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │   NEAR 1Click API         │
                    │   (External Service)      │
                    └───────────────────────────┘
```

### New Components

#### 1. NEARIntentsAdapter

**Purpose**: Bridge between SIP intents and NEAR 1Click API

**Responsibilities**:
- Convert SIP ShieldedIntent to OneClickQuoteRequest
- Generate stealth addresses for recipients
- Handle quote lifecycle
- Track swap status

**Interface**:
```typescript
interface NEARIntentsAdapter {
  // Convert SIP intent to 1Click quote request
  prepareQuote(intent: ShieldedIntent): Promise<OneClickQuoteRequest>

  // Request quote from 1Click API
  getQuote(request: OneClickQuoteRequest): Promise<OneClickQuoteResponse>

  // Submit deposit notification
  submitDeposit(deposit: OneClickDepositSubmit): Promise<void>

  // Track swap status
  getStatus(depositAddress: string): Promise<OneClickStatusResponse>

  // Full flow: intent → quote → deposit → status
  executeIntent(intent: ShieldedIntent): Promise<SwapResult>
}
```

#### 2. OneClickClient

**Purpose**: HTTP client for 1Click API

**Interface**:
```typescript
interface OneClickClient {
  // Get supported tokens
  getTokens(): Promise<OneClickToken[]>

  // Request swap quote
  quote(request: OneClickQuoteRequest): Promise<OneClickQuoteResponse>

  // Submit deposit transaction
  submitDeposit(deposit: OneClickDepositSubmit): Promise<OneClickQuoteResponse>

  // Check swap status
  getStatus(depositAddress: string, memo?: string): Promise<OneClickStatusResponse>
}
```

#### 3. SolverRelayClient (Optional)

**Purpose**: Direct solver integration for advanced use cases

**Interface**:
```typescript
interface SolverRelayClient {
  // Request quote directly from solvers
  quote(request: SolverQuoteRequest): Promise<SolverQuoteResponse[]>

  // Publish signed intent
  publishIntent(intent: SolverPublishIntent): Promise<void>

  // Get intent status
  getStatus(quoteHash: string): Promise<SolverStatusResponse>

  // WebSocket for real-time updates
  subscribe(channel: 'quote' | 'quote_status'): AsyncIterator<SolverQuoteEvent>
}
```

## Privacy Integration

### Stealth Address Flow

```
┌─────────────────┐                              ┌─────────────────┐
│  Sender         │                              │  Recipient      │
│                 │                              │                 │
│  Has: meta addr │                              │  Has: meta addr │
│  of recipient   │                              │  + private keys │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │ 1. Generate stealth address                    │
         │    from recipient's meta addr                  │
         ▼                                                │
┌─────────────────┐                                       │
│ Stealth Address │                                       │
│ + Ephemeral Key │                                       │
└────────┬────────┘                                       │
         │                                                │
         │ 2. Use stealth as recipient in                 │
         │    OneClickQuoteRequest                        │
         ▼                                                │
┌─────────────────┐                                       │
│ 1Click API      │                                       │
│ Quote + Deposit │                                       │
└────────┬────────┘                                       │
         │                                                │
         │ 3. Funds sent to stealth addr                  │
         │    on destination chain                        │
         ▼                                                │
┌─────────────────┐                                       │
│ Destination     │                                       │
│ Chain           │◀─────── 4. Recipient scans, derives ──┘
│ (stealth addr)  │            private key, claims funds
└─────────────────┘
```

### Privacy Modes

| Mode | Recipient | Amounts | Viewer Access |
|------|-----------|---------|---------------|
| `transparent` | Plain address | Visible | N/A |
| `shielded` | Stealth address | Visible* | None |
| `compliant` | Stealth address | Visible* | Viewing key holders |

*Amount visibility depends on destination chain capabilities

### Integration with Viewing Keys

For compliant mode, generate viewing keys that allow auditors to:

1. **Verify recipient**: Derive public key from viewing key, confirm stealth address ownership
2. **Track history**: Scan for all transactions to viewing key holder
3. **Audit amounts**: Decrypt any encrypted metadata (future)

```typescript
// Compliant mode flow
const viewingKey = generateViewingKey(derivationPath)

const intent = await new IntentBuilder()
  .input('near', 'NEAR', 100n)
  .output('eth', 'ETH', 0.03n)
  .privacy('compliant')
  .recipient(recipientMetaAddress)
  .viewingKey(viewingKey)
  .build()

// Auditor can verify with viewing key
const isForRecipient = verifyWithViewingKey(
  stealthAddress,
  ephemeralPubKey,
  viewingKey
)
```

## Data Flow

### Intent Creation to Swap Execution

```
1. User creates intent via SDK
   ─────────────────────────────────────────────────────────────────
   const intent = await createShieldedIntent({
     input: { chain: 'near', symbol: 'NEAR', amount: 100n },
     output: { chain: 'eth', symbol: 'ETH', minAmount: 0.03n },
     privacy: 'shielded',
     recipientMetaAddress: '...',
   })

2. NEARIntentsAdapter converts to 1Click request
   ─────────────────────────────────────────────────────────────────
   - Generate stealth address from recipientMetaAddress
   - Map SIP asset format to Defuse asset identifiers
   - Construct OneClickQuoteRequest

3. OneClickClient fetches quote
   ─────────────────────────────────────────────────────────────────
   POST /v0/quote → OneClickQuoteResponse
   - depositAddress: where to send input tokens
   - amountIn/amountOut: swap amounts
   - deadline: expiration

4. User deposits to depositAddress
   ─────────────────────────────────────────────────────────────────
   - On source chain (NEAR)
   - Transaction monitored by 1Click

5. 1Click executes swap
   ─────────────────────────────────────────────────────────────────
   - Solvers compete to fulfill
   - Winner executes on destination chain
   - Funds sent to stealth address

6. Recipient claims funds
   ─────────────────────────────────────────────────────────────────
   - Scans for stealth addresses
   - Derives private key
   - Spends from stealth address
```

## API Design

### High-Level API (Recommended)

```typescript
import { SIPClient } from '@sip-protocol/sdk'

const client = new SIPClient({
  nearIntents: {
    baseUrl: 'https://1click.chaindefuser.com',
    jwtToken: process.env.NEAR_INTENTS_JWT,
  },
})

// Simple swap with privacy
const result = await client.swap({
  from: { chain: 'near', amount: '100 NEAR' },
  to: { chain: 'eth', asset: 'ETH' },
  recipient: recipientMetaAddress,
  privacy: 'shielded',
})

console.log(result.status) // 'SUCCESS'
console.log(result.txHash) // destination chain tx
```

### Low-Level API (Advanced)

```typescript
import {
  NEARIntentsAdapter,
  OneClickClient
} from '@sip-protocol/sdk'

const oneClick = new OneClickClient({ baseUrl: '...' })
const adapter = new NEARIntentsAdapter({ oneClick })

// Manual control over each step
const intent = await createShieldedIntent({ ... })
const quote = await adapter.getQuote(
  await adapter.prepareQuote(intent)
)

// Deposit separately
const depositTx = await wallet.send(quote.depositAddress, quote.amountIn)

// Track status
const status = await adapter.getStatus(quote.depositAddress)
```

## Error Handling

### Error Categories

1. **Quote Errors**: Invalid assets, insufficient liquidity, amount too low
2. **Network Errors**: Timeout, rate limiting, server errors
3. **Deposit Errors**: Wrong amount, expired quote, failed deposit
4. **Settlement Errors**: Solver failure, chain issues

### Error Mapping

```typescript
enum SIPSwapError {
  // Quote phase
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  UNSUPPORTED_PAIR = 'UNSUPPORTED_PAIR',
  AMOUNT_TOO_LOW = 'AMOUNT_TOO_LOW',

  // Deposit phase
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  DEPOSIT_FAILED = 'DEPOSIT_FAILED',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',

  // Settlement phase
  SOLVER_FAILURE = 'SOLVER_FAILURE',
  SETTLEMENT_TIMEOUT = 'SETTLEMENT_TIMEOUT',

  // Privacy
  INVALID_META_ADDRESS = 'INVALID_META_ADDRESS',
  STEALTH_GENERATION_FAILED = 'STEALTH_GENERATION_FAILED',
}
```

## Testing Strategy

### Unit Tests

- Asset identifier mapping
- Stealth address generation for recipients
- Quote request construction
- Status parsing

### Integration Tests

- Dry quote requests (no deposit address)
- Full quote lifecycle (with testnet)
- Error handling scenarios

### Mocking

```typescript
// MockOneClickClient for testing
class MockOneClickClient implements OneClickClient {
  async quote(request: OneClickQuoteRequest): Promise<OneClickQuoteResponse> {
    return {
      quoteId: 'mock_quote_123',
      depositAddress: '0xmock...',
      amountIn: request.amount,
      amountOut: calculateMockOutput(request),
      // ...
    }
  }
}
```

## Implementation Plan

### Phase 1: Core Integration

1. Implement `OneClickClient` HTTP client
2. Implement basic `NEARIntentsAdapter`
3. Add stealth address integration
4. Unit tests

### Phase 2: Full Flow

1. End-to-end swap execution
2. Status tracking and polling
3. Error handling
4. Integration tests with testnet

### Phase 3: Advanced Features

1. Viewing key integration for compliant mode
2. Solver relay direct integration (optional)
3. Batch swap support
4. WebSocket status updates

## Security Considerations

1. **API Keys**: JWT tokens stored securely, never logged
2. **Deposit Addresses**: Verify quote signature before depositing
3. **Stealth Keys**: Generated client-side, never sent to API
4. **Amount Validation**: Verify amountOut against expectations
5. **Deadline Handling**: Refuse quotes with short deadlines

## Open Questions

1. **Testnet**: NEAR Intents has no testnet - how to test?
   - Option A: Dry quotes only
   - Option B: Minimal mainnet tests
   - Option C: Mock server

2. **Zcash Integration**: How to bridge to Zcash shielded pools?
   - Requires Zcash-specific adapter
   - May need different swap path

3. **Fee Handling**: Where to apply SIP protocol fees?
   - Option A: Add to appFees array
   - Option B: Separate fee layer

## References

- [NEAR-1CLICK-API.md](./NEAR-1CLICK-API.md) - Full API documentation
- [NEAR-PRIVACY-ANALYSIS.md](./NEAR-PRIVACY-ANALYSIS.md) - Privacy threat model
- [SIP-SPEC.md](../spec/SIP-SPEC.md) - Protocol specification
