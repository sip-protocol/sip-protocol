# Getting Started with SIP Protocol

> **Shielded Intents Protocol** - Privacy layer for cross-chain transactions

This guide will help you integrate SIP SDK into your application in minutes.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Understanding Privacy Levels](#understanding-privacy-levels)
4. [Core Concepts](#core-concepts)
5. [Integration Guides](#integration-guides)
6. [Use Cases](#use-cases)
7. [Error Handling](#error-handling)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### Requirements

- Node.js 18+
- TypeScript 5.0+ (recommended)

### Package Installation

```bash
# npm
npm install @sip-protocol/sdk

# pnpm (recommended)
pnpm add @sip-protocol/sdk

# yarn
yarn add @sip-protocol/sdk
```

### TypeScript Configuration

SIP SDK is written in TypeScript with full type definitions included. No additional `@types` packages needed.

```json
// tsconfig.json (recommended settings)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true
  }
}
```

---

## Quick Start

### Your First Shielded Intent (5 minutes)

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

// 1. Initialize the SDK
const sip = new SIP({ network: 'testnet' })

// 2. Create a shielded intent using the builder pattern
const intent = await sip
  .intent()
  .input('solana', 'SOL', 1_000_000_000n)  // 1 SOL (in lamports)
  .output('ethereum', 'ETH')                // Receive ETH
  .privacy(PrivacyLevel.SHIELDED)           // Enable privacy
  .build()

// 3. Get quotes from solvers
const quotes = await sip.getQuotes(intent.intent)

// 4. Execute with best quote
if (quotes.length > 0) {
  const result = await sip.execute(intent, quotes[0])
  console.log('Transaction:', result.txHash)
}
```

### What Just Happened?

1. **Input hidden**: Your 1 SOL is represented as a Pedersen commitment - solvers see a cryptographic commitment, not the actual amount
2. **Sender hidden**: Your wallet address is not exposed in the intent
3. **Recipient protected**: A stealth address is generated for receiving ETH
4. **Cross-chain**: The intent bridges from Solana to Ethereum via NEAR Intents

---

## Understanding Privacy Levels

SIP offers three privacy levels to match your needs:

### `PrivacyLevel.TRANSPARENT`

Standard cross-chain swap with no privacy features.

```typescript
const intent = await sip
  .intent()
  .input('near', 'NEAR', 100n)
  .output('ethereum', 'ETH')
  .privacy(PrivacyLevel.TRANSPARENT)
  .build()

// Intent shows: sender, amount, recipient - all public
```

**Use when**: Speed is priority, privacy not needed, lowest gas costs.

### `PrivacyLevel.SHIELDED`

Full privacy - hidden sender, amount, and unlinkable recipient.

```typescript
const intent = await sip
  .intent()
  .input('ethereum', 'ETH', 1_000_000_000_000_000_000n)  // 1 ETH
  .output('zcash', 'ZEC')
  .privacy(PrivacyLevel.SHIELDED)
  .build()

// Intent shows: cryptographic commitments only
// - Sender: Pedersen commitment (hidden)
// - Amount: Pedersen commitment (hidden)
// - Recipient: Stealth address (unlinkable)
```

**Use when**: Maximum privacy required, high-value transactions, MEV protection.

### `PrivacyLevel.COMPLIANT`

Privacy with selective disclosure via viewing keys.

```typescript
// Generate a viewing key for auditors
const viewingKey = sip.generateViewingKey('/m/44/501/0/audit')

const intent = await sip
  .intent()
  .input('solana', 'SOL', 5_000_000_000n)
  .output('near', 'NEAR')
  .privacy(PrivacyLevel.COMPLIANT)
  .viewingKey(viewingKey)
  .build()

// Transaction is private, but auditors with the viewing key
// can decrypt and verify transaction details
```

**Use when**: Institutional requirements, regulatory compliance, DAO treasury operations.

### Privacy Comparison Table

| Feature | Transparent | Shielded | Compliant |
|---------|-------------|----------|-----------|
| Sender hidden | ❌ | ✅ | ✅ |
| Amount hidden | ❌ | ✅ | ✅ |
| Recipient unlinkable | ❌ | ✅ | ✅ |
| Auditable | N/A | ❌ | ✅ |
| Gas cost | Lowest | Medium | Medium |

---

## Core Concepts

### Stealth Addresses

Stealth addresses provide recipient privacy by generating unique, one-time addresses.

```typescript
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  deriveStealthPrivateKey,
  encodeStealthMetaAddress
} from '@sip-protocol/sdk'

// Recipient generates a stealth meta-address (share this publicly)
const metaAddress = generateStealthMetaAddress('ethereum')

// Encode for sharing
const encoded = encodeStealthMetaAddress(metaAddress)
// => "sip:ethereum:0x02abc...def:0x03xyz...789"

// Sender generates a one-time stealth address for this specific payment
const { stealthAddress, ephemeralPublicKey } = generateStealthAddress(metaAddress)

// Recipient can derive the private key to spend funds
const privateKey = deriveStealthPrivateKey(
  stealthAddress,
  ephemeralPublicKey,
  metaAddress.spendingKey,
  metaAddress.viewingKey
)
```

### Pedersen Commitments

Hide transaction amounts while allowing verification.

```typescript
import {
  commit,
  verifyOpening,
  generateBlinding,
  addCommitments
} from '@sip-protocol/sdk'

// Create a commitment to hide an amount
const amount = 1000n
const blinding = generateBlinding()
const commitment = commit(amount, blinding)

// Later, prove you committed to this amount without revealing it
const isValid = verifyOpening(commitment, amount, blinding)
// => true

// Commitments are homomorphic - you can add them!
const commitment1 = commit(100n, generateBlinding())
const commitment2 = commit(200n, generateBlinding())
const sumCommitment = addCommitments(commitment1, commitment2)
// sumCommitment commits to 300n
```

### Viewing Keys

Enable selective disclosure for compliance.

```typescript
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing
} from '@sip-protocol/sdk'

// Generate master viewing key
const masterKey = generateViewingKey('/m/44/501/0')

// Derive child keys for different purposes
const auditKey = deriveViewingKey(masterKey, '/audit/2024')
const taxKey = deriveViewingKey(masterKey, '/tax/quarterly')

// Encrypt transaction data for viewing key holder
const txData = {
  sender: '0xabc...',
  recipient: '0xdef...',
  amount: 1000n,
  asset: 'ETH'
}

const encrypted = encryptForViewing(txData, auditKey)

// Auditor can decrypt with their viewing key
const decrypted = decryptWithViewing(encrypted, auditKey)
```

---

## Integration Guides

### React / Next.js Integration

```typescript
// hooks/useSIP.ts
import { useState, useCallback } from 'react'
import { SIP, PrivacyLevel, TrackedIntent } from '@sip-protocol/sdk'

const sip = new SIP({ network: 'testnet' })

export function useSIP() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createSwap = useCallback(async (
    inputChain: string,
    inputToken: string,
    inputAmount: bigint,
    outputChain: string,
    outputToken: string,
    privacy: PrivacyLevel
  ): Promise<TrackedIntent | null> => {
    setLoading(true)
    setError(null)

    try {
      const intent = await sip
        .intent()
        .input(inputChain, inputToken, inputAmount)
        .output(outputChain, outputToken)
        .privacy(privacy)
        .build()

      return intent
    } catch (err) {
      setError(err as Error)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { sip, createSwap, loading, error }
}
```

```tsx
// components/SwapForm.tsx
import { useSIP } from '../hooks/useSIP'
import { PrivacyLevel } from '@sip-protocol/sdk'

export function SwapForm() {
  const { createSwap, loading, error } = useSIP()

  const handleSwap = async () => {
    const intent = await createSwap(
      'solana', 'SOL', 1_000_000_000n,
      'ethereum', 'ETH',
      PrivacyLevel.SHIELDED
    )

    if (intent) {
      console.log('Intent created:', intent.intent.id)
    }
  }

  return (
    <div>
      <button onClick={handleSwap} disabled={loading}>
        {loading ? 'Creating...' : 'Swap with Privacy'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </div>
  )
}
```

### Node.js Backend Integration

```typescript
// services/sip-service.ts
import {
  SIP,
  PrivacyLevel,
  MockProofProvider,
  TrackedIntent
} from '@sip-protocol/sdk'

export class SIPService {
  private sip: SIP

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    this.sip = new SIP({
      network,
      proofProvider: new MockProofProvider() // Use real provider in production
    })
  }

  async createPrivateSwap(params: {
    inputChain: string
    inputToken: string
    inputAmount: bigint
    outputChain: string
    outputToken: string
    privacyLevel?: PrivacyLevel
  }): Promise<TrackedIntent> {
    const intent = await this.sip
      .intent()
      .input(params.inputChain, params.inputToken, params.inputAmount)
      .output(params.outputChain, params.outputToken)
      .privacy(params.privacyLevel ?? PrivacyLevel.SHIELDED)
      .build()

    return intent
  }

  async executeIntent(intent: TrackedIntent) {
    const quotes = await this.sip.getQuotes(intent.intent)

    if (quotes.length === 0) {
      throw new Error('No quotes available')
    }

    // Select best quote (lowest price)
    const bestQuote = quotes.sort((a, b) =>
      Number(a.outputAmount - b.outputAmount)
    )[0]

    return this.sip.execute(intent, bestQuote)
  }
}
```

### Wallet Connection

```typescript
import {
  SIP,
  SolanaWalletAdapter,
  EthereumWalletAdapter,
  createSolanaAdapter,
  createEthereumAdapter,
  getSolanaProvider,
  getEthereumProvider
} from '@sip-protocol/sdk'

const sip = new SIP({ network: 'testnet' })

// Connect Solana wallet (Phantom, Solflare, etc.)
async function connectSolana() {
  const provider = getSolanaProvider()
  if (!provider) {
    throw new Error('No Solana wallet found')
  }

  const adapter = createSolanaAdapter(provider)
  await adapter.connect()

  sip.connect(adapter)
  console.log('Connected:', adapter.address)
}

// Connect Ethereum wallet (MetaMask, etc.)
async function connectEthereum() {
  const provider = getEthereumProvider()
  if (!provider) {
    throw new Error('No Ethereum wallet found')
  }

  const adapter = createEthereumAdapter(provider)
  await adapter.connect()

  sip.connect(adapter)
  console.log('Connected:', adapter.address)
}

// Check connection status
if (sip.isConnected()) {
  const wallet = sip.getWallet()
  console.log('Wallet chain:', wallet?.chain)
  console.log('Wallet address:', wallet?.address)
}
```

---

## Use Cases

### Simple Swap with Privacy

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

async function privateSwap() {
  const sip = new SIP({ network: 'testnet' })

  // Create shielded intent
  const intent = await sip
    .intent()
    .input('solana', 'SOL', 2_000_000_000n)  // 2 SOL
    .output('ethereum', 'ETH')
    .privacy(PrivacyLevel.SHIELDED)
    .slippage(0.5)  // 0.5% slippage tolerance
    .expiry(30)     // 30 minute expiry
    .build()

  // Get and execute
  const quotes = await sip.getQuotes(intent.intent)
  const result = await sip.execute(intent, quotes[0])

  console.log('Swap complete:', result.txHash)
}
```

### Compliant Transaction with Viewing Key

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

async function compliantTransaction() {
  const sip = new SIP({ network: 'mainnet' })

  // Generate viewing key for compliance team
  const complianceKey = sip.generateViewingKey('/m/44/501/0/compliance')

  // Store the key securely for your compliance team
  console.log('Compliance viewing key:', complianceKey.publicKey)

  // Create compliant intent
  const intent = await sip
    .intent()
    .input('ethereum', 'ETH', 10_000_000_000_000_000_000n)  // 10 ETH
    .output('near', 'NEAR')
    .privacy(PrivacyLevel.COMPLIANT)
    .viewingKey(complianceKey)
    .build()

  // Transaction is private, but compliance can audit
  const quotes = await sip.getQuotes(intent.intent)
  const result = await sip.execute(intent, quotes[0])

  return {
    txHash: result.txHash,
    viewingKeyForAudit: complianceKey.publicKey
  }
}
```

### DAO Treasury Operations

```typescript
import { SIP, PrivacyLevel, generateViewingKey } from '@sip-protocol/sdk'

async function daoTreasurySwap() {
  const sip = new SIP({ network: 'mainnet' })

  // Generate viewing keys for different stakeholders
  const treasuryMasterKey = generateViewingKey('/dao/treasury/master')

  // Derive keys for different access levels
  const councilKey = sip.deriveViewingKey(treasuryMasterKey, '/council')
  const auditorKey = sip.deriveViewingKey(treasuryMasterKey, '/auditor')
  const publicKey = sip.deriveViewingKey(treasuryMasterKey, '/public')

  // Create treasury operation
  const intent = await sip
    .intent()
    .input('near', 'NEAR', 1_000_000_000_000_000_000_000_000n)  // 1M NEAR
    .output('ethereum', 'USDC')
    .privacy(PrivacyLevel.COMPLIANT)
    .viewingKey(councilKey)  // Council members can view
    .build()

  return intent
}
```

### Batch Operations

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

async function batchSwaps() {
  const sip = new SIP({ network: 'testnet' })

  const swapConfigs = [
    { input: ['solana', 'SOL', 1_000_000_000n], output: ['ethereum', 'ETH'] },
    { input: ['near', 'NEAR', 100_000_000_000_000_000_000_000n], output: ['zcash', 'ZEC'] },
    { input: ['ethereum', 'ETH', 500_000_000_000_000_000n], output: ['solana', 'SOL'] },
  ]

  // Create all intents in parallel
  const intents = await Promise.all(
    swapConfigs.map(config =>
      sip
        .intent()
        .input(config.input[0] as string, config.input[1] as string, config.input[2] as bigint)
        .output(config.output[0], config.output[1])
        .privacy(PrivacyLevel.SHIELDED)
        .build()
    )
  )

  console.log(`Created ${intents.length} shielded intents`)
  return intents
}
```

---

## Error Handling

SIP SDK provides typed errors for robust error handling:

```typescript
import {
  SIP,
  PrivacyLevel,
  SIPError,
  ValidationError,
  CryptoError,
  NetworkError,
  ErrorCode,
  isSIPError,
  hasErrorCode
} from '@sip-protocol/sdk'

async function safeSwap() {
  const sip = new SIP({ network: 'testnet' })

  try {
    const intent = await sip
      .intent()
      .input('solana', 'SOL', 1_000_000_000n)
      .output('ethereum', 'ETH')
      .privacy(PrivacyLevel.SHIELDED)
      .build()

    const quotes = await sip.getQuotes(intent.intent)
    const result = await sip.execute(intent, quotes[0])

    return result
  } catch (error) {
    // Check if it's a SIP error
    if (isSIPError(error)) {
      // Handle specific error codes
      if (hasErrorCode(error, ErrorCode.INVALID_CHAIN)) {
        console.error('Invalid chain specified')
      } else if (hasErrorCode(error, ErrorCode.INVALID_AMOUNT)) {
        console.error('Invalid amount')
      } else if (hasErrorCode(error, ErrorCode.CRYPTO_FAILED)) {
        console.error('Cryptographic operation failed')
      } else if (hasErrorCode(error, ErrorCode.NETWORK_ERROR)) {
        console.error('Network error:', error.message)
      }

      // Access error details
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)

      // Errors can be serialized
      const serialized = error.toJSON()
      // Send to logging service, etc.
    }

    throw error
  }
}
```

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `SIP_2000` | Validation failed | Check input parameters |
| `SIP_2002` | Invalid chain | Use supported chain ID |
| `SIP_2003` | Invalid privacy level | Use PrivacyLevel enum |
| `SIP_2004` | Invalid amount | Amount must be positive bigint |
| `SIP_3000` | Crypto operation failed | Check key formats |
| `SIP_4000` | Proof generation failed | Verify proof provider setup |
| `SIP_5000` | Network error | Check network connectivity |

---

## Troubleshooting

### Common Issues

#### "No Solana wallet found"

```typescript
// Check if wallet extension is installed
if (typeof window !== 'undefined' && !window.solana) {
  console.log('Please install Phantom or another Solana wallet')
}
```

#### "Invalid chain" error

```typescript
// Supported chains
const SUPPORTED_CHAINS = ['near', 'ethereum', 'solana', 'zcash', 'bitcoin']

// Validate before creating intent
if (!SUPPORTED_CHAINS.includes(inputChain)) {
  throw new Error(`Chain ${inputChain} not supported`)
}
```

#### BigInt serialization in JSON

```typescript
// BigInt can't be serialized directly
// Use this replacer function
const safeStringify = (obj: any) =>
  JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v)

const intent = await sip.intent()...build()
console.log(safeStringify(intent))
```

#### Proof generation takes too long

```typescript
// Use MockProofProvider for development
import { MockProofProvider } from '@sip-protocol/sdk'

const sip = new SIP({
  network: 'testnet',
  proofProvider: new MockProofProvider() // Instant mock proofs
})
```

### FAQ

**Q: What chains are supported?**
A: NEAR, Ethereum, Solana, Zcash, and Bitcoin. More coming soon.

**Q: Are the proofs real ZK proofs?**
A: Currently using mock proofs. Real Noir-based ZK proofs coming in future release.

**Q: How do viewing keys work with stealth addresses?**
A: Viewing keys can decrypt transaction metadata, while stealth addresses remain unlinkable. The viewing key holder can see amounts and participants, but cannot spend funds.

**Q: Is this production-ready?**
A: The SDK is feature-complete for testnet. Mainnet deployment pending security audit.

**Q: How is this different from Zcash directly?**
A: SIP adds privacy to cross-chain transactions via NEAR Intents. Zcash provides on-chain privacy for ZEC only.

---

## Next Steps

- [API Reference](../api/README.md) - Full API documentation
- [Privacy Levels Spec](../specs/PRIVACY-LEVELS.md) - Technical details
- [Stealth Address Spec](../specs/STEALTH-ADDRESS.md) - How stealth addresses work
- [Solver Integration](./SOLVER-INTEGRATION.md) - Build a solver

---

*Part of the [SIP Protocol](https://github.com/sip-protocol) ecosystem*
