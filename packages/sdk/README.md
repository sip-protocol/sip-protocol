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
