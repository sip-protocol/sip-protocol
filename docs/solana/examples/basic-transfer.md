# Example: Basic Private Transfer

Complete example of sending a private SOL payment.

## Prerequisites

```bash
npm install @sip-protocol/sdk @solana/web3.js
```

## Full Example

```typescript
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  shieldedTransfer,
  scanForPayments,
  claimStealthPayment,
} from '@sip-protocol/sdk'

async function main() {
  // Setup connection
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed')

  // ============================================
  // RECIPIENT: Generate SIP address (one time)
  // ============================================

  console.log('--- Recipient Setup ---')

  const {
    metaAddress: recipientMeta,
    spendingPrivateKey: recipientSpending,
    viewingPrivateKey: recipientViewing,
  } = generateStealthMetaAddress('solana')

  const recipientSipAddress = encodeStealthMetaAddress(recipientMeta)
  console.log('Recipient SIP address:', recipientSipAddress)

  // ============================================
  // SENDER: Send private payment
  // ============================================

  console.log('\n--- Sender: Sending Payment ---')

  // Load sender wallet (in real app, use wallet adapter)
  const senderWallet = Keypair.generate() // Demo only

  // Fund sender (devnet airdrop)
  const airdropSig = await connection.requestAirdrop(
    senderWallet.publicKey,
    2 * LAMPORTS_PER_SOL
  )
  await connection.confirmTransaction(airdropSig)
  console.log('Sender funded:', senderWallet.publicKey.toBase58())

  // Send 1 SOL privately
  const result = await shieldedTransfer({
    connection,
    sender: senderWallet.publicKey,
    recipient: recipientSipAddress,
    amount: BigInt(1 * LAMPORTS_PER_SOL),
    signTransaction: async (tx) => {
      tx.sign(senderWallet)
      return tx
    },
  })

  console.log('Transaction sent!')
  console.log('  Signature:', result.signature)
  console.log('  Stealth address:', result.stealthAddress)
  console.log('  Explorer:', result.explorerUrl)

  // ============================================
  // RECIPIENT: Scan and claim
  // ============================================

  console.log('\n--- Recipient: Scanning ---')

  // Wait a moment for transaction to be indexed
  await new Promise(r => setTimeout(r, 5000))

  // Scan for incoming payments
  const payments = await scanForPayments({
    connection,
    viewingPrivateKey: recipientViewing,
    spendingPublicKey: recipientMeta.spendingKey,
  })

  console.log(`Found ${payments.length} payment(s)`)

  if (payments.length > 0) {
    const payment = payments[0]
    console.log('  Amount:', Number(payment.amount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('  Stealth address:', payment.stealthAddress)

    // Claim to a new wallet
    console.log('\n--- Recipient: Claiming ---')

    const recipientMainWallet = Keypair.generate()

    const claimResult = await claimStealthPayment({
      connection,
      stealthAddress: payment.stealthAddress,
      ephemeralPublicKey: payment.ephemeralPublicKey,
      viewingPrivateKey: recipientViewing,
      spendingPrivateKey: recipientSpending,
      destinationAddress: recipientMainWallet.publicKey,
    })

    console.log('Claimed!')
    console.log('  Signature:', claimResult.signature)
    console.log('  Destination:', recipientMainWallet.publicKey.toBase58())

    // Check balance
    const balance = await connection.getBalance(recipientMainWallet.publicKey)
    console.log('  New balance:', balance / LAMPORTS_PER_SOL, 'SOL')
  }
}

main().catch(console.error)
```

## Run the Example

```bash
npx ts-node basic-transfer.ts
```

## Expected Output

```
--- Recipient Setup ---
Recipient SIP address: sip:solana:0x02abc...123:0x03def...456

--- Sender: Sending Payment ---
Sender funded: 7xyz...abc
Transaction sent!
  Signature: 5VERv...QUW
  Stealth address: 9abc...xyz
  Explorer: https://solscan.io/tx/5VERv...?cluster=devnet

--- Recipient: Scanning ---
Found 1 payment(s)
  Amount: 1 SOL
  Stealth address: 9abc...xyz

--- Recipient: Claiming ---
Claimed!
  Signature: 3abc...def
  Destination: 4def...ghi
  New balance: 0.998 SOL
```

## Key Points

1. **Meta-address is public** - Share like an email address
2. **Stealth address is one-time** - Different for each payment
3. **Viewing key enables scanning** - But cannot spend
4. **Spending key enables claiming** - Keep secret

## Next Steps

- [Private Swap](./private-swap.md) - Jupiter DEX with privacy
- [Compliance](./compliance.md) - Viewing key disclosure
