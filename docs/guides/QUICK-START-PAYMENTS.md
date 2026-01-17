# Quick Start: Payment App Integration

**Time to read: 6 minutes**

Add private payments to your fintech app with stablecoin support.

## Why Private Payments?

Traditional crypto payments expose:
- **Sender identity** - Anyone can see who paid
- **Amount** - Transaction value is public
- **Recipient** - Payment destination visible
- **History** - Complete payment trail on-chain

SIP hides all of this while maintaining compliance capability.

## Installation

```bash
pnpm add @sip-protocol/sdk
```

## 1. Create Private Payment

```typescript
import {
  PaymentBuilder,
  createShieldedPayment,
  PrivacyLevel,
} from '@sip-protocol/sdk'

// Create a private payment
const payment = new PaymentBuilder()
  .amount(100n * 10n**6n) // 100 USDC
  .token('USDC')
  .chain('solana')
  .recipient('sip:solana:0x02abc...') // Recipient's stealth meta-address
  .memo('Invoice #1234') // Encrypted memo
  .privacy(PrivacyLevel.SHIELDED)
  .build()

console.log('Payment ID:', payment.id)
console.log('Recipient sees memo, public sees nothing')
```

## 2. Send Payment

```typescript
import { createSolanaAdapter } from '@sip-protocol/sdk'

const wallet = createSolanaAdapter()
await wallet.connect()

const result = await payment.send(wallet)

console.log('Payment sent!')
console.log('TX:', result.signature)
console.log('Stealth address:', result.stealthAddress)
// Share result.claimCode with recipient (optional)
```

## 3. Receive Payments (Scan & Claim)

```typescript
import {
  scanForPayments,
  claimStealthPayment,
  createProvider,
} from '@sip-protocol/sdk'

const provider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
})

// Scan for incoming payments
const incoming = await scanForPayments({
  provider,
  viewingPrivateKey: myMeta.viewingKey.privateKey,
  spendingPublicKey: myMeta.spendingKey.publicKey,
})

console.log(`Found ${incoming.length} payments:`)
for (const p of incoming) {
  console.log(`- ${p.amount} ${p.token}`)
  if (p.memo) console.log(`  Memo: ${p.memo}`)
}

// Claim to main wallet
for (const p of incoming) {
  const claimed = await claimStealthPayment({
    provider,
    payment: p,
    destinationAddress: myMainWallet,
    spendingPrivateKey: myMeta.spendingKey.privateKey,
  })
  console.log('Claimed:', claimed.signature)
}
```

## 4. Payment Links

Generate shareable payment request links:

```typescript
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

// Generate payment link for receiving
const myMeta = generateStealthMetaAddress()
const encoded = encodeStealthMetaAddress(myMeta)

// Create payment link
const paymentLink = new URL('https://pay.yourapp.com')
paymentLink.searchParams.set('to', encoded)
paymentLink.searchParams.set('amount', '100')
paymentLink.searchParams.set('token', 'USDC')
paymentLink.searchParams.set('memo', 'Coffee')

console.log('Share this link:', paymentLink.toString())
// Sender clicks → app pre-fills payment → sends privately
```

## 5. Stablecoin Support

Built-in stablecoin registry:

```typescript
import {
  getStablecoin,
  getSupportedStablecoins,
  isStablecoinOnChain,
  formatStablecoinAmount,
} from '@sip-protocol/sdk'

// Check supported stablecoins
const stablecoins = getSupportedStablecoins()
console.log('Supported:', stablecoins.join(', '))
// USDC, USDT, DAI, PYUSD, ...

// Get stablecoin info
const usdc = getStablecoin('USDC')
console.log('USDC decimals:', usdc.decimals) // 6
console.log('USDC on Solana:', usdc.addresses.solana)

// Format amounts
const formatted = formatStablecoinAmount('USDC', 100_000_000n)
console.log(formatted) // "100.00 USDC"

// Check chain support
const hasUSDC = isStablecoinOnChain('USDC', 'solana') // true
const hasPYUSD = isStablecoinOnChain('PYUSD', 'solana') // true
```

## 6. Recurring Payments

Set up private recurring payments:

```typescript
import {
  PaymentBuilder,
  PrivacyLevel,
  generateViewingKey,
} from '@sip-protocol/sdk'

// Viewing key for payment history
const subscriptionKey = generateViewingKey()

async function createRecurringPayment(params: {
  recipient: string
  amount: bigint
  token: string
  frequency: 'weekly' | 'monthly'
}) {
  const payment = new PaymentBuilder()
    .amount(params.amount)
    .token(params.token)
    .recipient(params.recipient)
    .privacy(PrivacyLevel.COMPLIANT) // Track for accounting
    .viewingKey(subscriptionKey.publicKey)
    .memo(`Subscription - ${new Date().toISOString()}`)
    .build()

  return payment
}

// Cron job / scheduler calls this
const monthlyPayment = await createRecurringPayment({
  recipient: vendorMeta,
  amount: 29_99n * 10n**4n, // $29.99
  token: 'USDC',
  frequency: 'monthly',
})
```

## 7. Invoice System

Private invoicing with payment tracking:

```typescript
interface Invoice {
  id: string
  amount: bigint
  token: string
  recipientMeta: string
  memo: string
  dueDate: Date
  paid?: boolean
  paymentSignature?: string
}

class PrivateInvoicing {
  async createInvoice(params: Omit<Invoice, 'id'>): Promise<Invoice> {
    return {
      id: crypto.randomUUID(),
      ...params,
    }
  }

  async getPaymentUrl(invoice: Invoice): Promise<string> {
    const url = new URL('https://pay.yourapp.com/invoice')
    url.searchParams.set('id', invoice.id)
    url.searchParams.set('to', invoice.recipientMeta)
    url.searchParams.set('amount', invoice.amount.toString())
    url.searchParams.set('token', invoice.token)
    url.searchParams.set('memo', `Invoice: ${invoice.id}`)
    return url.toString()
  }

  async checkPaid(invoice: Invoice, provider: any): Promise<boolean> {
    const payments = await scanForPayments({
      provider,
      viewingPrivateKey: this.viewingKey,
      spendingPublicKey: this.spendingPublicKey,
      // Look for memo matching invoice ID
      filter: (p) => p.memo?.includes(invoice.id),
    })

    return payments.length > 0
  }
}
```

## Complete Payment App

```typescript
import {
  PaymentBuilder,
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  scanForPayments,
  claimStealthPayment,
  createProvider,
  PrivacyLevel,
  formatStablecoinAmount,
} from '@sip-protocol/sdk'

class PrivatePaymentApp {
  private meta: ReturnType<typeof generateStealthMetaAddress>
  private provider: ReturnType<typeof createProvider>

  constructor(heliusApiKey: string) {
    this.meta = generateStealthMetaAddress()
    this.provider = createProvider('helius', { apiKey: heliusApiKey })
  }

  // Get user's private receiving address
  getReceiveAddress(): string {
    return encodeStealthMetaAddress(this.meta)
  }

  // Send private payment
  async send(params: {
    to: string
    amount: bigint
    token: string
    memo?: string
    wallet: any
  }) {
    const payment = new PaymentBuilder()
      .amount(params.amount)
      .token(params.token)
      .recipient(params.to)
      .memo(params.memo || '')
      .privacy(PrivacyLevel.SHIELDED)
      .build()

    return payment.send(params.wallet)
  }

  // Get incoming payments
  async getIncoming() {
    const payments = await scanForPayments({
      provider: this.provider,
      viewingPrivateKey: this.meta.viewingKey.privateKey,
      spendingPublicKey: this.meta.spendingKey.publicKey,
    })

    return payments.map(p => ({
      amount: formatStablecoinAmount(p.token, p.amount),
      token: p.token,
      memo: p.memo,
      date: p.timestamp,
      claimed: p.claimed,
    }))
  }

  // Claim all unclaimed payments
  async claimAll(destinationWallet: string) {
    const payments = await scanForPayments({
      provider: this.provider,
      viewingPrivateKey: this.meta.viewingKey.privateKey,
      spendingPublicKey: this.meta.spendingKey.publicKey,
      filter: p => !p.claimed,
    })

    const results = []
    for (const p of payments) {
      const result = await claimStealthPayment({
        provider: this.provider,
        payment: p,
        destinationAddress: destinationWallet,
        spendingPrivateKey: this.meta.spendingKey.privateKey,
      })
      results.push(result)
    }

    return results
  }

  // Get balance across all stealth addresses
  async getBalance() {
    const payments = await this.getIncoming()
    const unclaimed = payments.filter(p => !p.claimed)

    // Group by token
    const balances: Record<string, bigint> = {}
    for (const p of unclaimed) {
      // Parse amount back (this is simplified)
      balances[p.token] = (balances[p.token] || 0n) + BigInt(p.amount)
    }

    return balances
  }
}

// Usage
const app = new PrivatePaymentApp(process.env.HELIUS_API_KEY!)

// Display receive address in UI
const myAddress = app.getReceiveAddress()

// Send payment
await app.send({
  to: recipientAddress,
  amount: 50n * 10n**6n, // 50 USDC
  token: 'USDC',
  memo: 'Thanks for dinner!',
  wallet: connectedWallet,
})

// Check incoming
const incoming = await app.getIncoming()
console.log('Pending payments:', incoming.length)

// Claim to main wallet
await app.claimAll(mainWalletAddress)
```

## Security Best Practices

1. **Key storage** - Store stealth keys in secure enclave
2. **Memo encryption** - Memos are encrypted, but keep sensitive info minimal
3. **Claim promptly** - Claim stealth payments to reduce exposure
4. **Backup keys** - Losing viewing/spending keys = losing funds

## Next Steps

- [Enterprise Compliance](./QUICK-START-COMPLIANCE.md)
- [DAO Treasury Guide](./QUICK-START-DAO.md)
- [Full API Reference](https://docs.sip-protocol.org/sdk)

---

Built with SIP Protocol - The Privacy Standard for Web3
