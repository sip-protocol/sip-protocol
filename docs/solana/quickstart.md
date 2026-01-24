# Quickstart: Solana Privacy in 5 Minutes

Get started with private SOL transfers using SIP Protocol.

## Installation

```bash
npm install @sip-protocol/sdk
# or
pnpm add @sip-protocol/sdk
```

## 1. Generate Stealth Address (Recipient)

Recipients share their stealth meta-address publicly. Senders use it to derive one-time addresses.

```typescript
import { generateStealthMetaAddress } from '@sip-protocol/sdk'

// Recipient generates their meta-address once
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('solana')

// Share this publicly (like an email address)
console.log('My SIP address:', metaAddress)
// sip:solana:0x02abc...:0x03def...

// Store these securely (needed to claim payments)
// spendingPrivateKey - for signing claims
// viewingPrivateKey - for scanning payments
```

## 2. Send Private Payment (Sender)

```typescript
import { shieldedTransfer } from '@sip-protocol/sdk'
import { Connection, PublicKey } from '@solana/web3.js'

const connection = new Connection('https://api.devnet.solana.com')

const result = await shieldedTransfer({
  connection,
  sender: wallet.publicKey,
  recipient: 'sip:solana:0x02abc...:0x03def...', // Recipient's SIP address
  amount: 1_000_000_000n, // 1 SOL in lamports
  signTransaction: wallet.signTransaction,
})

console.log('Transaction:', result.signature)
console.log('Stealth address:', result.stealthAddress)
console.log('Note ID:', result.noteId)
```

## 3. Scan for Payments (Recipient)

```typescript
import { scanForPayments } from '@sip-protocol/sdk'

const payments = await scanForPayments({
  connection,
  viewingPrivateKey,  // From step 1
  spendingPublicKey,  // Derived from spendingPrivateKey
})

for (const payment of payments) {
  console.log('Found payment:', payment.amount, 'lamports')
  console.log('Stealth address:', payment.stealthAddress)
}
```

## 4. Claim Payment (Recipient)

```typescript
import { claimStealthPayment } from '@sip-protocol/sdk'

const claim = await claimStealthPayment({
  connection,
  stealthAddress: payment.stealthAddress,
  ephemeralPublicKey: payment.ephemeralPublicKey,
  viewingPrivateKey,
  spendingPrivateKey,
  destinationAddress: myMainWallet,
})

console.log('Claimed:', claim.signature)
```

## What Just Happened?

1. **Sender** created a Pedersen commitment hiding the amount
2. **Sender** derived a one-time stealth address for recipient
3. **On-chain** program verified the commitment and transferred SOL
4. **Recipient** scanned announcements using their viewing key
5. **Recipient** claimed funds using their spending key

**Privacy achieved:**
- Amount hidden (commitment)
- Recipient hidden (stealth address)
- Viewing key enables compliance if needed

## Next Steps

- [Architecture](./architecture.md) - How it works under the hood
- [API Reference](./api-reference.md) - Full SDK documentation
- [Examples](./examples/) - More use cases

## Need Help?

- GitHub: https://github.com/sip-protocol/sip-protocol
- Docs: https://docs.sip-protocol.org
