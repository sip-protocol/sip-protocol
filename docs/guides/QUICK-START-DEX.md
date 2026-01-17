# Quick Start: Private DEX Swap Integration

**Time to read: 7 minutes**

Add private swaps to your DEX or trading interface with hidden amounts and recipients.

## Prerequisites

- DEX integration (Jupiter, Uniswap, etc.)
- Node.js 18+
- Understanding of intent-based trading

## Installation

```bash
pnpm add @sip-protocol/sdk
```

## Core Concept: Shielded Intents

SIP wraps your swap in privacy:
1. **Hidden sender** - Stealth address as recipient
2. **Hidden amount** - Pedersen commitment
3. **Hidden recipient** - One-time address

```
User → [SIP Privacy Layer] → DEX → [SIP Privacy Layer] → Recipient
            ↓                           ↓
       Hide sender                 Hide recipient
       Hide amount                 Prove correctness
```

## 1. Create Private Swap Intent

```typescript
import {
  SIP,
  PrivacyLevel,
  IntentBuilder,
} from '@sip-protocol/sdk'

const sip = new SIP({
  network: 'mainnet',
  defaultPrivacy: PrivacyLevel.SHIELDED,
})

// Create a private swap intent
const intent = new IntentBuilder()
  .from('solana', 'SOL', 10n * 10n**9n) // 10 SOL
  .to('solana', 'USDC')
  .withPrivacy(PrivacyLevel.SHIELDED)
  .withSlippage(0.5) // 0.5%
  .build()

console.log('Intent ID:', intent.id)
console.log('Privacy:', intent.privacy) // 'shielded'
```

## 2. Get Quotes (Amount Hidden from Solvers)

```typescript
// Quotes see the intent but not the exact amount
const quotes = await sip.getQuotes(intent)

console.log(`Found ${quotes.length} quotes`)
for (const quote of quotes) {
  console.log(`- ${quote.solver}: ${quote.outputAmount} USDC`)
  console.log(`  Route: ${quote.route.join(' → ')}`)
}

// Select best quote
const bestQuote = quotes[0]
```

## 3. Execute Private Swap

```typescript
import { createSolanaAdapter } from '@sip-protocol/sdk'

// Connect user's wallet
const wallet = createSolanaAdapter()
await wallet.connect()

// Execute the swap
const result = await sip.execute(intent, bestQuote, {
  wallet,
  // Output goes to a stealth address
  recipientMeta: recipientStealthMetaAddress,
})

console.log('Swap completed!')
console.log('TX:', result.signature)
console.log('Output address:', result.stealthAddress) // One-time address
```

## 4. With Viewing Keys (Compliance)

For institutional use with audit capabilities:

```typescript
import {
  PrivacyLevel,
  generateViewingKey,
} from '@sip-protocol/sdk'

// Generate viewing key for compliance
const viewingKey = generateViewingKey()

const intent = new IntentBuilder()
  .from('solana', 'SOL', 100n * 10n**9n)
  .to('solana', 'USDC')
  .withPrivacy(PrivacyLevel.COMPLIANT) // Privacy + audit
  .withViewingKey(viewingKey.publicKey)
  .build()

// Later: Share viewing key with auditor
// They can decrypt transaction details
console.log('Share with auditor:', viewingKey.publicKey)
```

## 5. Jupiter Integration Example

```typescript
import {
  SIP,
  PrivacyLevel,
  createSolanaAdapter,
  generateStealthAddress,
  decodeStealthMetaAddress,
} from '@sip-protocol/sdk'

async function privateJupiterSwap(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  recipientMeta: string,
) {
  const sip = new SIP({ network: 'mainnet' })
  const wallet = createSolanaAdapter()
  await wallet.connect()

  // Generate stealth address for recipient
  const meta = decodeStealthMetaAddress(recipientMeta)
  const stealth = generateStealthAddress(meta)

  // Get Jupiter quote
  const quote = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`
  ).then(r => r.json())

  // Wrap in SIP privacy
  const intent = await sip.createIntent({
    input: { chain: 'solana', token: inputMint, amount },
    output: { chain: 'solana', token: outputMint },
    privacy: PrivacyLevel.SHIELDED,
    stealthRecipient: stealth.stealthAddress,
  })

  // Execute swap to stealth address
  const swapTx = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.address,
      destinationTokenAccount: stealth.stealthAddress,
    }),
  }).then(r => r.json())

  // Sign and send
  const signature = await wallet.signAndSend(swapTx.swapTransaction)

  return {
    signature,
    stealthAddress: stealth.stealthAddress,
    ephemeralKey: stealth.ephemeralPublicKey,
  }
}
```

## 6. Amount Hiding with Commitments

For advanced privacy, hide exact amounts:

```typescript
import {
  commit,
  generateBlinding,
  addCommitments,
} from '@sip-protocol/sdk'

// Hide the exact swap amount
const amount = 1000n * 10n**6n // 1000 USDC
const blinding = generateBlinding()
const commitment = commit(amount, blinding)

// Solver sees commitment, not amount
console.log('Commitment:', commitment.value)
// Solver proves: input commitment = output commitment
// Without knowing the actual amounts
```

## Complete DEX Integration

```typescript
import {
  SIP,
  PrivacyLevel,
  createSolanaAdapter,
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

class PrivateDEX {
  private sip: SIP

  constructor() {
    this.sip = new SIP({
      network: 'mainnet',
      mode: 'production',
    })
  }

  async swap(params: {
    fromToken: string
    toToken: string
    amount: bigint
    recipientMeta?: string // Optional: send to someone else
    privacy?: PrivacyLevel
  }) {
    const wallet = createSolanaAdapter()
    await wallet.connect()

    // If no recipient, generate for self
    let recipientMeta = params.recipientMeta
    let selfMeta
    if (!recipientMeta) {
      selfMeta = generateStealthMetaAddress()
      recipientMeta = encodeStealthMetaAddress(selfMeta)
    }

    const intent = await this.sip.createIntent({
      input: {
        chain: 'solana',
        token: params.fromToken,
        amount: params.amount,
      },
      output: {
        chain: 'solana',
        token: params.toToken,
      },
      privacy: params.privacy || PrivacyLevel.SHIELDED,
    })

    const quotes = await this.sip.getQuotes(intent)
    if (quotes.length === 0) throw new Error('No quotes available')

    const result = await this.sip.execute(intent, quotes[0], {
      wallet,
      recipientMeta,
    })

    return {
      txSignature: result.signature,
      stealthAddress: result.stealthAddress,
      // If self-send, return recovery info
      recoveryInfo: selfMeta ? {
        spendingKey: selfMeta.spendingKey.privateKey,
        viewingKey: selfMeta.viewingKey.privateKey,
      } : undefined,
    }
  }
}
```

## Privacy Levels Comparison

| Level | Sender | Amount | Recipient | Auditable |
|-------|--------|--------|-----------|-----------|
| `transparent` | Public | Public | Public | N/A |
| `shielded` | Hidden | Hidden | Hidden | No |
| `compliant` | Hidden | Hidden | Hidden | Yes (viewing key) |

## Next Steps

- [DAO Treasury Guide](./QUICK-START-DAO.md)
- [NFT Marketplace Privacy](./QUICK-START-NFT.md)
- [Enterprise Compliance](./QUICK-START-COMPLIANCE.md)

---

Built with SIP Protocol - The Privacy Standard for Web3
