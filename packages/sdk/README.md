# @sip-protocol/sdk

[![npm version](https://img.shields.io/npm/v/@sip-protocol/sdk.svg)](https://www.npmjs.com/package/@sip-protocol/sdk)
[![Tests](https://github.com/sip-protocol/sip-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/sip-protocol/sip-protocol/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Privacy layer for cross-chain transactions.** One toggle to shield sender, amount, and recipient.

SIP (Shielded Intents Protocol) is the privacy standard for Web3 - like HTTPS for the internet. Add privacy to any cross-chain swap with stealth addresses, Pedersen commitments, and viewing keys for compliance.

## Installation

```bash
npm install @sip-protocol/sdk
# or
pnpm add @sip-protocol/sdk
# or
yarn add @sip-protocol/sdk
```

## Quick Start

### Basic Private Swap

```typescript
import { SIP, PrivacyLevel, NATIVE_TOKENS } from '@sip-protocol/sdk'

// Create SIP client
const sip = new SIP({ network: 'mainnet' })

// Create a shielded cross-chain swap
const intent = await sip.createIntent({
  input: { chain: 'ethereum', token: 'ETH', amount: '1.0' },
  output: { chain: 'solana', token: 'SOL' },
  privacy: PrivacyLevel.SHIELDED,
})

// Get quotes from solvers
const quotes = await sip.getQuotes(intent)

// Execute the swap (privacy preserved!)
const result = await sip.execute(intent, quotes[0])
console.log('Swap complete:', result.status)
```

### Privacy Levels

```typescript
import { PrivacyLevel } from '@sip-protocol/sdk'

// Full transparency (regular swap)
PrivacyLevel.TRANSPARENT

// Maximum privacy (hidden sender, amount, recipient)
PrivacyLevel.SHIELDED

// Privacy + compliance (auditor can verify with viewing key)
PrivacyLevel.COMPLIANT
```

### Generate Stealth Address

```typescript
import { generateStealthMetaAddress, generateStealthAddress } from '@sip-protocol/sdk'

// Recipient generates a meta-address (share this publicly)
const { metaAddress, spendingKey, viewingKey } = generateStealthMetaAddress('ethereum')

// Sender generates one-time stealth address from meta-address
const { stealthAddress, ephemeralPublicKey } = generateStealthAddress(metaAddress)

// Funds sent to stealthAddress are only recoverable by recipient
console.log('Send funds to:', stealthAddress)
```

### Pedersen Commitments

```typescript
import { commit, verifyOpening, addCommitments } from '@sip-protocol/sdk'

// Hide an amount in a commitment
const amount = 1000000n // 1 USDC (6 decimals)
const { commitment, blinding } = commit(amount)

// Verify the commitment opens to the claimed amount
const isValid = verifyOpening(commitment, amount, blinding)
console.log('Commitment valid:', isValid) // true

// Commitments are homomorphic (can add without revealing)
const { commitment: c1, blinding: b1 } = commit(100n)
const { commitment: c2, blinding: b2 } = commit(200n)
const sumCommitment = addCommitments(c1, c2)
// sumCommitment commits to 300 without revealing individual amounts
```

### NEAR Intents Integration

```typescript
import { NEARIntentsAdapter, generateStealthMetaAddress, PrivacyLevel } from '@sip-protocol/sdk'

const adapter = new NEARIntentsAdapter({
  jwtToken: process.env.NEAR_INTENTS_JWT,
})

// Create swap request
const request = {
  requestId: `swap_${Date.now()}`,
  privacyLevel: PrivacyLevel.SHIELDED,
  inputAsset: { chain: 'near', symbol: 'NEAR', decimals: 24 },
  inputAmount: 1000000000000000000000000n, // 1 NEAR
  outputAsset: { chain: 'ethereum', symbol: 'ETH', decimals: 18 },
}

// Generate stealth address for recipient
const { metaAddress } = generateStealthMetaAddress('ethereum')

// Prepare and execute
const prepared = await adapter.prepareSwap(request, metaAddress)
const quote = await adapter.getQuote(prepared)
console.log('Quote:', quote.amountOut, 'ETH')
```

### Compliant Mode with Viewing Keys

```typescript
import {
  SIP,
  PrivacyLevel,
  generateViewingKey,
  encryptForViewing,
  decryptWithViewing
} from '@sip-protocol/sdk'

// Create compliant swap (privacy + audit capability)
const sip = new SIP({ network: 'mainnet' })

const intent = await sip.createIntent({
  input: { chain: 'ethereum', token: 'USDC', amount: '10000' },
  output: { chain: 'polygon', token: 'USDC' },
  privacy: PrivacyLevel.COMPLIANT,
})

// Generate viewing key for auditor
const viewingKey = generateViewingKey()

// Encrypt transaction details for auditor
const encrypted = encryptForViewing(
  { amount: '10000', sender: '0x...', recipient: '0x...' },
  viewingKey.publicKey
)

// Auditor can decrypt with their private key
const decrypted = decryptWithViewing(encrypted, viewingKey.privateKey)
```

## Core Concepts

### Stealth Addresses (EIP-5564)

One-time addresses that prevent linking transactions to recipients:

| Chain Type | Curve | Function |
|------------|-------|----------|
| EVM (Ethereum, Polygon, Arbitrum) | secp256k1 | `generateStealthMetaAddress()` |
| Solana, NEAR | ed25519 | `generateEd25519StealthMetaAddress()` |

### Pedersen Commitments

Hide amounts while proving correctness:

- **Hiding**: Commitment reveals nothing about the value
- **Binding**: Cannot open to different values
- **Homomorphic**: `C(a) + C(b) = C(a+b)` - verify sums without revealing

### Privacy Levels

| Level | Sender | Amount | Recipient | Auditable |
|-------|--------|--------|-----------|-----------|
| `TRANSPARENT` | Visible | Visible | Visible | N/A |
| `SHIELDED` | Hidden | Hidden | Hidden | No |
| `COMPLIANT` | Hidden | Hidden | Hidden | Yes (viewing key) |

## API Reference

### Main Client

```typescript
import { SIP, createSIP, createProductionSIP } from '@sip-protocol/sdk'

const sip = new SIP({ network: 'mainnet' })
// or
const sip = createSIP({ network: 'testnet' })
// or (with NEAR Intents)
const sip = createProductionSIP({ jwtToken: '...' })
```

### Intent Builder

```typescript
import { IntentBuilder, createShieldedIntent } from '@sip-protocol/sdk'

// Fluent API
const intent = new IntentBuilder()
  .from('ethereum', 'ETH', '1.0')
  .to('solana', 'SOL')
  .withPrivacy(PrivacyLevel.SHIELDED)
  .build()

// Or direct creation
const intent = createShieldedIntent({
  input: { chain: 'ethereum', token: 'ETH', amount: '1.0' },
  output: { chain: 'solana', token: 'SOL' },
})
```

### Wallet Adapters

```typescript
import {
  EthereumWalletAdapter,
  SolanaWalletAdapter,
  LedgerWalletAdapter,
  TrezorWalletAdapter,
} from '@sip-protocol/sdk'

// MetaMask / Browser wallet
const eth = await EthereumWalletAdapter.create()
await eth.connect()

// Phantom / Solflare
const sol = await SolanaWalletAdapter.create()
await sol.connect()

// Hardware wallets
const ledger = await LedgerWalletAdapter.create({ transport: 'webusb' })
const trezor = await TrezorWalletAdapter.create()
```

### Proof Providers

```typescript
// Browser (WASM-based)
import { BrowserNoirProvider } from '@sip-protocol/sdk/browser'

const provider = new BrowserNoirProvider()
await provider.initialize()
const proof = await provider.generateFundingProof(params)

// Node.js
import { NoirProofProvider } from '@sip-protocol/sdk/proofs/noir'

const provider = new NoirProofProvider()
await provider.initialize()
const proof = await provider.generateFundingProof(params)

// Mock (for testing)
import { MockProofProvider } from '@sip-protocol/sdk'

const mock = new MockProofProvider()
const proof = await mock.generateFundingProof(params)
```

### Zcash Integration

```typescript
import { ZcashRPCClient, ZcashShieldedService } from '@sip-protocol/sdk'

const client = new ZcashRPCClient({
  host: 'localhost',
  port: 8232,
  username: process.env.ZCASH_RPC_USER,
  password: process.env.ZCASH_RPC_PASS,
})

const service = new ZcashShieldedService({ client })
const result = await service.shieldedSend({
  from: 'z-address...',
  to: 'z-address...',
  amount: 1.5,
  memo: 'Private payment',
})
```

### Privacy Backends

SIP Protocol supports multiple privacy backends for different use cases:

```typescript
import {
  // Backend registry and router
  PrivacyBackendRegistry,
  SmartRouter,
  // Individual backends
  SIPNativeBackend,      // Stealth addresses + Pedersen commitments
  PrivacyCashBackend,    // Pool mixing (anonymity sets)
  ArciumBackend,         // MPC compute privacy + C-SPL tokens
} from '@sip-protocol/sdk'

// Set up registry with multiple backends
const registry = new PrivacyBackendRegistry()
registry.register(new SIPNativeBackend())
registry.register(new ArciumBackend({ network: 'devnet' }))

// SmartRouter auto-selects optimal backend
const router = new SmartRouter(registry)
const result = await router.execute(transferParams, {
  prioritize: 'privacy', // or 'speed', 'cost', 'compliance'
})
```

### Arcium Integration (C-SPL Tokens)

Arcium provides compute privacy through MPC and C-SPL confidential tokens:

```typescript
import {
  createCombinedPrivacyServiceDevnet,
  createCSPLServiceDevnet,
} from '@sip-protocol/sdk'

// Option 1: C-SPL only (amount privacy)
const cspl = createCSPLServiceDevnet()
await cspl.initialize()

const wrap = await cspl.wrap({
  splMint: 'USDC-mint',
  owner: 'your-wallet',
  amount: 100_000000n,
})

// Option 2: Combined privacy (SIP + Arcium)
const combined = createCombinedPrivacyServiceDevnet()
await combined.initialize()

const result = await combined.executePrivateTransfer({
  splMint: 'USDC-mint',
  sender: 'your-wallet',
  recipientMetaAddress: 'sip:solana:0x02...:0x03...',
  amount: 100_000000n,
  decimals: 6,
  viewingKey: '0x04...', // For compliance
})

// Privacy achieved:
// - Hidden recipient (stealth address)
// - Hidden amount (C-SPL encryption)
// - Hidden sender (no linkability)
// - Compliance support (viewing key)
```

See [ARCIUM-INTEGRATION.md](docs/ARCIUM-INTEGRATION.md) for full documentation.

### Helius Integration (Solana)

SIP Protocol integrates with Helius for production-grade Solana stealth payment scanning:

```typescript
import { createProvider, scanForPayments } from '@sip-protocol/sdk'

// Create Helius provider with DAS API
const helius = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY!,
  cluster: 'mainnet-beta',
})

// Scan for stealth payments efficiently
const payments = await scanForPayments({
  connection,
  viewingPrivateKey,
  spendingPublicKey,
  provider: helius, // Uses DAS API for efficient queries
})
```

For real-time detection, use webhooks:

```typescript
import { createWebhookHandler } from '@sip-protocol/sdk'

const handler = createWebhookHandler({
  viewingPrivateKey,
  spendingPublicKey,
  onPaymentFound: (payment) => {
    console.log('Payment received!', payment.amount)
  },
})

// In Express.js route
app.post('/webhook/helius', async (req, res) => {
  await handler(req.body)
  res.status(200).send('OK')
})
```

See [HELIUS-INTEGRATION.md](docs/HELIUS-INTEGRATION.md) for full documentation.

### QuickNode Integration (Solana)

SIP Protocol integrates with QuickNode for high-performance Solana RPC and real-time streaming via Yellowstone gRPC:

```typescript
import { createProvider, QuickNodeProvider } from '@sip-protocol/sdk'

// Option 1: Using factory function
const quicknode = createProvider('quicknode', {
  endpoint: process.env.QUICKNODE_ENDPOINT!, // e.g., https://example.solana-mainnet.quiknode.pro/abc123
  cluster: 'mainnet-beta',
})

// Option 2: Direct instantiation
const provider = new QuickNodeProvider({
  endpoint: 'https://example.solana-mainnet.quiknode.pro/YOUR_API_KEY',
  cluster: 'mainnet-beta',
  enableGrpc: true, // Enable Yellowstone gRPC for real-time subscriptions
})

// Query token assets
const assets = await provider.getAssetsByOwner('7xK9...')
console.log('Token balances:', assets)

// Get specific token balance
const balance = await provider.getTokenBalance('7xK9...', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') // USDC
```

For real-time stealth payment detection using Yellowstone gRPC:

```typescript
import { QuickNodeProvider } from '@sip-protocol/sdk'

const quicknode = new QuickNodeProvider({
  endpoint: process.env.QUICKNODE_ENDPOINT!,
  enableGrpc: true, // Requires Yellowstone add-on on your QuickNode endpoint
})

// Subscribe to token transfers for a stealth address
if (quicknode.supportsSubscriptions()) {
  const unsubscribe = await quicknode.subscribeToTransfers(
    stealthAddress,
    (asset) => {
      console.log('Stealth payment received!', {
        mint: asset.mint,
        amount: asset.amount.toString(),
      })
    }
  )

  // Later: cleanup subscription
  unsubscribe()
}

// Cleanup all resources when done
await quicknode.close()
```

**QuickNode Advantages for SIP:**
- **Yellowstone gRPC**: Real-time token transfer notifications with low latency
- **Reliability**: Enterprise-grade infrastructure with global edge network
- **Flexibility**: Works with or without gRPC add-on (falls back to polling)

See [QuickNode Solana Docs](https://www.quicknode.com/docs/solana) for endpoint setup.

### Triton Integration (Solana)

SIP Protocol integrates with Triton for ultra-low latency Solana RPC and Dragon's Mouth gRPC streaming:

```typescript
import { createProvider, TritonProvider } from '@sip-protocol/sdk'

// Option 1: Using factory function
const triton = createProvider('triton', {
  xToken: process.env.TRITON_TOKEN!,
  cluster: 'mainnet-beta',
})

// Option 2: Direct instantiation with custom endpoints
const provider = new TritonProvider({
  xToken: process.env.TRITON_TOKEN!,
  endpoint: 'https://mainnet.rpcpool.com',      // Custom RPC endpoint
  grpcEndpoint: 'https://grpc.rpcpool.com:443', // Custom gRPC endpoint
  cluster: 'mainnet-beta',
  enableGrpc: true,
})

// Query token assets
const assets = await provider.getAssetsByOwner('7xK9...')

// Get specific token balance
const balance = await provider.getTokenBalance('7xK9...', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
```

For real-time stealth payment detection using Dragon's Mouth gRPC:

```typescript
import { TritonProvider } from '@sip-protocol/sdk'

const triton = new TritonProvider({
  xToken: process.env.TRITON_TOKEN!,
  enableGrpc: true,
})

// Subscribe to token transfers (~400ms latency advantage over WebSocket)
if (triton.supportsSubscriptions()) {
  const unsubscribe = await triton.subscribeToTransfers(
    stealthAddress,
    (asset) => {
      console.log('Stealth payment received!', asset)
    }
  )

  // Cleanup
  unsubscribe()
}

await triton.close()
```

**Triton Advantages for SIP:**
- **Dragon's Mouth gRPC**: ~400ms latency advantage over WebSocket
- **Multi-region Failover**: High availability for production apps
- **DeFi Optimized**: Ideal for trading and time-sensitive applications

See [Triton Docs](https://docs.triton.one/chains/solana) for setup.

### Provider Comparison

| Provider | Best For | Real-time | Special Features |
|----------|----------|-----------|------------------|
| **Helius** | Production apps | Webhooks | DAS API, rich metadata |
| **QuickNode** | Enterprise | Yellowstone gRPC | Global edge network |
| **Triton** | DeFi/Trading | Dragon's Mouth gRPC | ~400ms latency advantage |
| **Generic** | Development | WebSocket | No API key required |

All providers implement the same `SolanaRPCProvider` interface — switch between them without changing your application code.

## Supported Chains

| Chain | Input | Output | Stealth Curve |
|-------|-------|--------|---------------|
| Ethereum | Yes | Yes | secp256k1 |
| Solana | Yes | Yes | ed25519 |
| NEAR | Yes | Yes | ed25519 |
| Polygon | Yes | Yes | secp256k1 |
| Arbitrum | Yes | Yes | secp256k1 |
| Base | Yes | Yes | secp256k1 |
| Optimism | Yes | Yes | secp256k1 |
| Bitcoin | Yes | Yes | - |
| Zcash | Yes | Yes | - |

## Configuration

### Development Defaults

The SDK uses localhost endpoints by default for local development:

| Service | Default Endpoint | Environment Variable |
|---------|-----------------|---------------------|
| Zcash RPC | `127.0.0.1:8232` | `ZCASH_RPC_HOST`, `ZCASH_RPC_PORT` |
| Ethereum RPC | `localhost:8545` | `ETH_RPC_URL` |
| Solana RPC | `localhost:8899` | `SOL_RPC_URL` |
| Sui RPC | `localhost:9000` | `SUI_RPC_URL` |
| Helius API | - | `HELIUS_API_KEY` |
| QuickNode | - | `QUICKNODE_ENDPOINT` |
| Triton | - | `TRITON_TOKEN` |

These defaults allow you to run local nodes (Ganache, Hardhat, Solana Test Validator) without additional configuration.

### Production Configuration

**Always configure endpoints explicitly in production:**

```typescript
import { SIP } from '@sip-protocol/sdk'

const sip = new SIP({
  network: 'mainnet',
  mode: 'production',
  rpcEndpoints: {
    ethereum: process.env.ETH_RPC_URL,    // e.g., Alchemy, Infura
    solana: process.env.SOL_RPC_URL,      // e.g., Helius, QuickNode
    near: process.env.NEAR_RPC_URL,       // e.g., NEAR RPC
  },
})
```

**Using RPC Providers for Solana:**

```typescript
import { createProvider } from '@sip-protocol/sdk'

// Choose your preferred provider — same API, different backends
const provider = createProvider('quicknode', {
  endpoint: process.env.QUICKNODE_ENDPOINT!,
})
// or: createProvider('helius', { apiKey: process.env.HELIUS_API_KEY! })
// or: createProvider('triton', { xToken: process.env.TRITON_TOKEN! })
```

### Zcash Configuration

```typescript
import { ZcashRPCClient } from '@sip-protocol/sdk'

// Development (uses defaults)
const devClient = new ZcashRPCClient({
  username: 'user',
  password: 'pass',
})

// Production
const prodClient = new ZcashRPCClient({
  host: process.env.ZCASH_RPC_HOST,
  port: parseInt(process.env.ZCASH_RPC_PORT || '8232'),
  username: process.env.ZCASH_RPC_USER,
  password: process.env.ZCASH_RPC_PASS,
  tls: true,  // Enable for production
})
```

### Environment Variables

See [`.env.example`](https://github.com/sip-protocol/sip-protocol/blob/main/.env.example) for a complete list of configurable environment variables.

## Error Handling

```typescript
import { SIPError, ValidationError, CryptoError, isSIPError } from '@sip-protocol/sdk'

try {
  await sip.execute(intent, quote)
} catch (error) {
  if (isSIPError(error)) {
    console.error('SIP Error:', error.code, error.message)

    if (error instanceof ValidationError) {
      console.error('Invalid input:', error.details)
    }
  }
}
```

## Testing

The SDK includes 1,295 tests covering all functionality:

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run benchmarks
pnpm bench
```

## Documentation

- [Full Documentation](https://docs.sip-protocol.org)
- [API Reference](https://docs.sip-protocol.org/api)
- [Examples](https://github.com/sip-protocol/sip-protocol/tree/main/examples)

## Contributing

See [CONTRIBUTING.md](https://github.com/sip-protocol/sip-protocol/blob/main/CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](https://github.com/sip-protocol/sip-protocol/blob/main/LICENSE) for details.

---

**SIP Protocol** - Privacy is a feature, not a bug.

[Website](https://sip-protocol.org) | [Docs](https://docs.sip-protocol.org) | [GitHub](https://github.com/sip-protocol/sip-protocol) | [Discord](https://discord.gg/sip-protocol)
