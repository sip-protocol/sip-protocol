# Integration Guide: Adding Privacy to Your dApp

Step-by-step guide for integrating SIP Protocol into Solana applications.

## Overview

SIP Protocol adds privacy to your dApp with minimal code changes:

```typescript
// Before (public transfer)
await connection.sendTransaction(transferTx, [wallet])

// After (private transfer)
await shieldedTransfer({ connection, sender, recipient, amount, signTransaction })
```

## Prerequisites

- Node.js 18+
- Solana wallet integration (Phantom, Solflare, etc.)
- Basic understanding of Solana transactions

## Step 1: Install Dependencies

```bash
npm install @sip-protocol/sdk @solana/web3.js
```

For React apps:

```bash
npm install @sip-protocol/react @solana/wallet-adapter-react
```

## Step 2: Initialize SDK

### Vanilla TypeScript

```typescript
import { Connection } from '@solana/web3.js'
import { createProvider } from '@sip-protocol/sdk'

const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
)

// Optional: Use Helius for enhanced features
const provider = createProvider('helius', {
  apiKey: process.env.HELIUS_API_KEY,
  cluster: 'devnet',
})
```

### React

```typescript
import { SIPProvider } from '@sip-protocol/react'

function App() {
  return (
    <WalletProvider>
      <SIPProvider chain="solana">
        <YourApp />
      </SIPProvider>
    </WalletProvider>
  )
}
```

## Step 3: Generate User's SIP Address

Users need a SIP address to receive private payments. Generate once and store.

```typescript
import { generateStealthMetaAddress, encodeStealthMetaAddress } from '@sip-protocol/sdk'

// Generate new identity (do once per user)
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('solana')

// Get shareable URI
const sipAddress = encodeStealthMetaAddress(metaAddress)
// "sip:solana:0x02abc...:0x03def..."

// Store keys securely (encrypted in localStorage, secure enclave, etc.)
await secureStorage.set('sip_spending_key', spendingPrivateKey)
await secureStorage.set('sip_viewing_key', viewingPrivateKey)
```

## Step 4: Send Private Payments

### Basic SOL Transfer

```typescript
import { shieldedTransfer } from '@sip-protocol/sdk'

async function sendPrivatePayment(
  recipientSipAddress: string,
  amountSol: number
) {
  const result = await shieldedTransfer({
    connection,
    sender: wallet.publicKey,
    recipient: recipientSipAddress,
    amount: BigInt(Math.floor(amountSol * 1e9)), // Convert to lamports
    signTransaction: wallet.signTransaction,
  })

  return {
    signature: result.signature,
    explorerUrl: result.explorerUrl,
  }
}
```

### With React Hook

```typescript
import { useShieldedTransfer } from '@sip-protocol/react'

function SendButton() {
  const { send, loading, error } = useShieldedTransfer()

  const handleSend = async () => {
    const result = await send({
      recipient: recipientAddress,
      amount: 1_000_000_000n,
    })
    console.log('Sent:', result.signature)
  }

  return (
    <button onClick={handleSend} disabled={loading}>
      {loading ? 'Sending...' : 'Send Private Payment'}
    </button>
  )
}
```

## Step 5: Receive Private Payments

### Scan for Incoming Payments

```typescript
import { scanForPayments } from '@sip-protocol/sdk'

async function checkIncomingPayments() {
  const spendingKey = await secureStorage.get('sip_spending_key')
  const viewingKey = await secureStorage.get('sip_viewing_key')

  const payments = await scanForPayments({
    connection,
    viewingPrivateKey: viewingKey,
    spendingPublicKey: derivePublicKey(spendingKey),
  })

  return payments.map(p => ({
    amount: Number(p.amount) / 1e9, // Convert to SOL
    stealthAddress: p.stealthAddress,
    timestamp: new Date(p.timestamp * 1000),
  }))
}
```

### Claim Payments

```typescript
import { claimStealthPayment } from '@sip-protocol/sdk'

async function claimPayment(payment: Payment) {
  const result = await claimStealthPayment({
    connection,
    stealthAddress: payment.stealthAddress,
    ephemeralPublicKey: payment.ephemeralPublicKey,
    viewingPrivateKey: await secureStorage.get('sip_viewing_key'),
    spendingPrivateKey: await secureStorage.get('sip_spending_key'),
    destinationAddress: wallet.publicKey,
  })

  return result.signature
}
```

## Step 6: Display Privacy Status

Show users their privacy state:

```typescript
function PrivacyIndicator({ isShielded }: { isShielded: boolean }) {
  return (
    <div className={isShielded ? 'text-green-500' : 'text-gray-500'}>
      {isShielded ? '🔒 Shielded' : '👁 Public'}
    </div>
  )
}
```

## Step 7: Handle Errors

```typescript
import { ValidationError } from '@sip-protocol/sdk'

try {
  await shieldedTransfer({ ... })
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid input (address, amount, etc.)
    showError(`Invalid ${error.field}: ${error.message}`)
  } else if (error.message.includes('insufficient funds')) {
    showError('Not enough SOL for transfer + fees')
  } else {
    showError('Transfer failed. Please try again.')
    console.error(error)
  }
}
```

## Best Practices

### 1. Key Storage

```typescript
// DO: Use secure storage
import { SecureStore } from 'expo-secure-store' // Mobile
import { Keychain } from 'react-native-keychain' // Mobile
// Or encrypted localStorage with user password

// DON'T: Store keys in plain localStorage
localStorage.setItem('private_key', key) // NEVER
```

### 2. Amount Display

```typescript
// Show commitment status, not raw amount (for observers)
function AmountDisplay({ commitment }: { commitment: string }) {
  return <span title="Amount hidden">🔒 Hidden</span>
}

// For recipients, show decrypted amount
function RecipientAmountDisplay({ amount }: { amount: bigint }) {
  return <span>{(Number(amount) / 1e9).toFixed(4)} SOL</span>
}
```

### 3. Transaction Confirmation

```typescript
async function waitForConfirmation(signature: string) {
  const latestBlockhash = await connection.getLatestBlockhash()

  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  })
}
```

### 4. Batch Scanning

```typescript
// Scan in batches for large histories
async function fullScan() {
  let fromSlot = 0
  const allPayments = []

  while (true) {
    const batch = await scanForPayments({
      connection,
      viewingPrivateKey,
      spendingPublicKey,
      fromSlot,
      limit: 100,
    })

    if (batch.length === 0) break

    allPayments.push(...batch)
    fromSlot = batch[batch.length - 1].slot + 1
  }

  return allPayments
}
```

## Example: Private Payment Form

```typescript
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { shieldedTransfer, decodeStealthMetaAddress } from '@sip-protocol/sdk'

export function PrivatePaymentForm() {
  const { publicKey, signTransaction } = useWallet()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!publicKey || !signTransaction) return

    setStatus('sending')

    try {
      // Validate SIP address
      decodeStealthMetaAddress(recipient)

      const result = await shieldedTransfer({
        connection,
        sender: publicKey,
        recipient,
        amount: BigInt(Math.floor(parseFloat(amount) * 1e9)),
        signTransaction,
      })

      setStatus('success')
      console.log('Transaction:', result.explorerUrl)
    } catch (error) {
      setStatus('error')
      console.error(error)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="sip:solana:0x..."
        value={recipient}
        onChange={e => setRecipient(e.target.value)}
      />
      <input
        type="number"
        placeholder="Amount (SOL)"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending...' : 'Send Private Payment'}
      </button>
      {status === 'success' && <p>Payment sent privately!</p>}
      {status === 'error' && <p>Failed to send. Check console.</p>}
    </form>
  )
}
```

## Next Steps

- [Security](./security.md) - Security best practices
- [Examples](./examples/) - More code samples
- [API Reference](./api-reference.md) - Full API docs
