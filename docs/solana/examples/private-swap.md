# Example: Private DEX Swap

Execute a private token swap via Jupiter with hidden amounts.

## Overview

```
1. User swaps SOL → USDC privately
2. Amount hidden via Pedersen commitment
3. Recipient hidden via stealth address
4. Swap executed through Jupiter aggregator
```

## Prerequisites

```bash
npm install @sip-protocol/sdk @solana/web3.js @jup-ag/api
```

## Full Example

```typescript
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createJupiterApiClient } from '@jup-ag/api'
import {
  generateStealthMetaAddress,
  shieldedTransfer,
  commit,
} from '@sip-protocol/sdk'

// Token mints
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')

async function privateSwap() {
  const connection = new Connection('https://api.mainnet-beta.solana.com')
  const jupiter = createJupiterApiClient()

  // User's wallet
  const wallet = Keypair.generate() // In production: wallet adapter

  // Amount to swap (hidden from observers)
  const inputAmount = BigInt(1 * LAMPORTS_PER_SOL) // 1 SOL

  // Create commitment to hide amount
  const { commitment, blinding } = commit(inputAmount)
  console.log('Amount commitment:', commitment)
  // Observer sees commitment, not amount

  // Get Jupiter quote
  const quote = await jupiter.quoteGet({
    inputMint: SOL_MINT.toBase58(),
    outputMint: USDC_MINT.toBase58(),
    amount: Number(inputAmount),
    slippageBps: 50, // 0.5%
  })

  console.log('Quote received:')
  console.log('  Input:', Number(inputAmount) / LAMPORTS_PER_SOL, 'SOL')
  console.log('  Output:', Number(quote.outAmount) / 1e6, 'USDC')
  console.log('  Price impact:', quote.priceImpactPct, '%')

  // Generate stealth address for output
  const { metaAddress } = generateStealthMetaAddress('solana')

  // Get swap transaction
  const swapResult = await jupiter.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      // In production: destination could be stealth address
    },
  })

  console.log('\nSwap transaction ready')
  console.log('  Commitment (hidden amount):', commitment)
  console.log('  Stealth recipient available for output')

  // In production:
  // 1. Execute swap to stealth address
  // 2. Store commitment + blinding for recipient
  // 3. Recipient claims using viewing key

  return {
    commitment,
    quote,
    transaction: swapResult.swapTransaction,
  }
}

// Execute with privacy wrapper
async function executePrivateSwap() {
  console.log('=== Private DEX Swap ===\n')

  try {
    const result = await privateSwap()
    console.log('\nSwap prepared successfully!')
    console.log('Amount hidden behind commitment')
    console.log('Recipient can be hidden via stealth address')
  } catch (error) {
    console.error('Swap failed:', error)
  }
}

executePrivateSwap()
```

## Privacy Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  USER WALLET                                                  │
│  1. Create commitment C = amount·G + blinding·H              │
│  2. Get Jupiter quote (amount visible to Jupiter)            │
│  3. Generate stealth address for output tokens               │
│  4. Execute swap with output to stealth address              │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│  JUPITER AGGREGATOR                                          │
│  • Finds best route across DEXs                              │
│  • Amount visible during execution (unavoidable)             │
│  • Output destination can be stealth address                 │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│  ON-CHAIN RESULT                                             │
│  • Observers see: swap happened, output to stealth addr      │
│  • Hidden: who owns stealth addr, relationship to user       │
│  • Commitment stored for amount verification                 │
└──────────────────────────────────────────────────────────────┘
```

## Privacy Levels

| Level | What's Hidden | Trade-offs |
|-------|---------------|------------|
| **Full** | Amount + Recipient | More complex, higher fees |
| **Recipient Only** | Output destination | Simpler, amount visible |
| **Amount Only** | Swap size | Recipient visible |

## Integration with Jupiter

```typescript
// Option 1: Direct to stealth address
const swap = await jupiter.swapPost({
  swapRequest: {
    quoteResponse: quote,
    userPublicKey: wallet.publicKey.toBase58(),
    destinationTokenAccount: stealthTokenAccount.toBase58(), // Stealth ATA
  },
})

// Option 2: Via SIP program (wrapped swap)
const privateSwap = await shieldedSwap({
  connection,
  sender: wallet.publicKey,
  inputMint: SOL_MINT,
  outputMint: USDC_MINT,
  amount: inputAmount,
  recipientMeta: recipientMetaAddress,
  signTransaction: wallet.signTransaction,
})
```

## Limitations

1. **Jupiter sees amount** - During quote/execution
2. **MEV possible** - Swap is public during execution
3. **Slippage visible** - Quote parameters public

## Future: Full Private Swaps

With ZK proofs (M18+):

```typescript
// ZK proof that:
// 1. User has sufficient balance
// 2. Swap parameters are valid
// 3. Output goes to valid stealth address
// Without revealing amounts

const zkSwap = await shieldedSwapWithProof({
  proof: generateSwapProof(inputAmount, outputAmount, blinding),
  commitment: commitment,
  stealthRecipient: stealthAddress,
})
```

## Next Steps

- [Compliance](./compliance.md) - Viewing key disclosure for audits
- [Basic Transfer](./basic-transfer.md) - Simple private payment
