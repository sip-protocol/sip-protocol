# Quick Start: Adding Privacy to Your Wallet

**Time to read: 5 minutes**

Add stealth address privacy to your existing wallet app with SIP Protocol.

## Prerequisites

- Existing wallet integration (Solana/Ethereum)
- Node.js 18+
- TypeScript (recommended)

## Installation

```bash
pnpm add @sip-protocol/sdk
# or
npm install @sip-protocol/sdk
```

## 1. Generate Stealth Meta-Address

When a user wants to receive private payments, generate their stealth meta-address (their "private receiving address"):

```typescript
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

// Generate once per user, store securely
const metaAddress = generateStealthMetaAddress()

// This is their public "private address" to share
const encoded = encodeStealthMetaAddress(metaAddress)
// Format: sip:solana:0x02abc...123:0x03def...456

console.log('Share this address to receive private payments:', encoded)
```

**Store securely:**
- `metaAddress.spendingKey.privateKey` - Required to spend received funds
- `metaAddress.viewingKey.privateKey` - Required to scan for payments

## 2. Generate One-Time Stealth Address

When sending to someone's stealth meta-address:

```typescript
import {
  decodeStealthMetaAddress,
  generateStealthAddress,
} from '@sip-protocol/sdk'

// Parse recipient's meta-address
const recipientMeta = decodeStealthMetaAddress(
  'sip:solana:0x02abc...123:0x03def...456'
)

// Generate one-time address for this payment
const stealth = generateStealthAddress(recipientMeta)

// Send payment to this address
console.log('Send funds to:', stealth.stealthAddress)
console.log('Include in tx memo:', stealth.ephemeralPublicKey)
```

## 3. Scan for Incoming Payments

Scan the chain for payments to the user:

```typescript
import {
  scanForPayments,
  createProvider,
} from '@sip-protocol/sdk'

const provider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
})

const payments = await scanForPayments({
  provider,
  viewingPrivateKey: metaAddress.viewingKey.privateKey,
  spendingPublicKey: metaAddress.spendingKey.publicKey,
  // Optional: start from specific slot
  fromSlot: 250000000,
})

console.log(`Found ${payments.length} private payments`)
for (const payment of payments) {
  console.log(`- ${payment.amount} ${payment.token} from ${payment.signature}`)
}
```

## 4. Claim Stealth Payment

Derive the private key and transfer funds to user's main wallet:

```typescript
import {
  claimStealthPayment,
  deriveStealthPrivateKey,
} from '@sip-protocol/sdk'

// Derive private key for this specific payment
const privateKey = deriveStealthPrivateKey(
  metaAddress.spendingKey.privateKey,
  payment.ephemeralPublicKey
)

// Claim to user's main wallet
const result = await claimStealthPayment({
  provider,
  stealthPrivateKey: privateKey,
  destinationAddress: userMainWallet,
  tokenMint: payment.tokenMint,
  amount: payment.amount,
})

console.log('Claimed! TX:', result.signature)
```

## Complete Integration Example

```typescript
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  scanForPayments,
  claimStealthPayment,
  deriveStealthPrivateKey,
  createProvider,
} from '@sip-protocol/sdk'

class PrivateWallet {
  private meta: ReturnType<typeof generateStealthMetaAddress>
  private provider: ReturnType<typeof createProvider>

  constructor(apiKey: string) {
    this.meta = generateStealthMetaAddress()
    this.provider = createProvider('helius', { apiKey })
  }

  getReceiveAddress(): string {
    return encodeStealthMetaAddress(this.meta)
  }

  async getPrivateBalance(): Promise<Array<{ amount: bigint; token: string }>> {
    const payments = await scanForPayments({
      provider: this.provider,
      viewingPrivateKey: this.meta.viewingKey.privateKey,
      spendingPublicKey: this.meta.spendingKey.publicKey,
    })
    return payments
  }

  async claimAll(destinationWallet: string): Promise<string[]> {
    const payments = await this.getPrivateBalance()
    const txIds: string[] = []

    for (const payment of payments) {
      const privateKey = deriveStealthPrivateKey(
        this.meta.spendingKey.privateKey,
        payment.ephemeralPublicKey
      )
      const result = await claimStealthPayment({
        provider: this.provider,
        stealthPrivateKey: privateKey,
        destinationAddress: destinationWallet,
        tokenMint: payment.tokenMint,
        amount: payment.amount,
      })
      txIds.push(result.signature)
    }

    return txIds
  }
}
```

## Security Notes

1. **Never expose private keys** - Store spending/viewing keys in secure enclave or encrypted storage
2. **Secure memory** - Use `secureWipe()` after key operations
3. **Validate addresses** - Always validate stealth meta-addresses before use

## Next Steps

- [Private DEX Integration](./QUICK-START-DEX.md)
- [DAO Treasury with Viewing Keys](./QUICK-START-DAO.md)
- [Full API Reference](https://docs.sip-protocol.org/sdk)

---

Built with SIP Protocol - The Privacy Standard for Web3
