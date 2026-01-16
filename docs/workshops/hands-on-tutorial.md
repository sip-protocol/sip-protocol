# Hands-On Tutorial: Add Privacy to Your dApp

**Duration:** 45 minutes
**Difficulty:** Intermediate
**Prerequisites:** Basic TypeScript, Solana/Web3 familiarity

## What You'll Build

A privacy-enabled wallet that can:
1. Generate a stealth meta-address for receiving
2. Send private payments to any stealth address
3. Scan for and claim incoming payments

## Setup (5 minutes)

### 1. Clone the Starter

```bash
git clone https://github.com/sip-protocol/workshop-starter
cd workshop-starter
npm install
```

### 2. Environment Setup

Create `.env.local`:

```bash
# Get free API key at https://dev.helius.xyz
HELIUS_API_KEY=your_api_key_here

# Use devnet for workshop
NEXT_PUBLIC_NETWORK=devnet
```

### 3. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 - you should see a basic wallet UI.

---

## Exercise 1: Generate Stealth Meta-Address (10 minutes)

### Goal
Let users generate a private receiving address.

### Instructions

Open `src/hooks/usePrivateAddress.ts`:

```typescript
// TODO: Implement this hook
export function usePrivateAddress() {
  // Your code here
}
```

### Solution

```typescript
import { useState, useCallback } from 'react'
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

export function usePrivateAddress() {
  const [metaAddress, setMetaAddress] = useState<{
    encoded: string
    spendingKey: string
    viewingKey: string
  } | null>(null)

  const generate = useCallback(() => {
    // Generate stealth meta-address (spending + viewing keys)
    const meta = generateStealthMetaAddress()

    // Encode for sharing
    const encoded = encodeStealthMetaAddress(meta)

    setMetaAddress({
      encoded,
      // IMPORTANT: Store these securely in production
      spendingKey: meta.spendingKey.privateKey,
      viewingKey: meta.viewingKey.privateKey,
    })

    return encoded
  }, [])

  return {
    metaAddress,
    generate,
    receiveAddress: metaAddress?.encoded ?? null,
  }
}
```

### Test It

1. Click "Generate Private Address" in the UI
2. You should see an address like: `sip:solana:0x02...`
3. This is your shareable private receiving address

### What Happened?

- `generateStealthMetaAddress()` creates two key pairs:
  - Spending key: controls funds
  - Viewing key: sees incoming payments
- `encodeStealthMetaAddress()` formats it for sharing
- Anyone can send to this address; only you can receive

---

## Exercise 2: Send Private Payment (15 minutes)

### Goal
Send SOL or USDC privately to another stealth address.

### Instructions

Open `src/hooks/usePrivateSend.ts`:

```typescript
// TODO: Implement private send functionality
export function usePrivateSend() {
  // Your code here
}
```

### Solution

```typescript
import { useState, useCallback } from 'react'
import {
  decodeStealthMetaAddress,
  generateStealthAddress,
  sendPrivateSPLTransfer,
  createProvider,
} from '@sip-protocol/sdk'
import { useWallet } from '@solana/wallet-adapter-react'

export function usePrivateSend() {
  const { publicKey, signTransaction } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendPrivate = useCallback(async (params: {
    recipientMeta: string  // sip:solana:0x...
    amount: number         // in UI units (e.g., 1.5 for 1.5 SOL)
    token: 'SOL' | 'USDC'
  }) => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected')
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Decode recipient's meta-address
      const recipientMeta = decodeStealthMetaAddress(params.recipientMeta)

      // 2. Generate one-time stealth address for this payment
      const stealth = generateStealthAddress(recipientMeta)

      // 3. Create RPC provider
      const provider = createProvider('helius', {
        apiKey: process.env.HELIUS_API_KEY!,
        cluster: 'devnet',
      })

      // 4. Convert amount to lamports/smallest units
      const decimals = params.token === 'SOL' ? 9 : 6
      const amount = BigInt(Math.floor(params.amount * 10 ** decimals))

      // 5. Send the private transfer
      const result = await sendPrivateSPLTransfer({
        provider,
        senderPublicKey: publicKey.toBase58(),
        stealthAddress: stealth.stealthAddress,
        ephemeralPublicKey: stealth.ephemeralPublicKey,
        amount,
        tokenMint: params.token === 'SOL' ? 'native' : 'USDC',
        signTransaction,
      })

      return {
        signature: result.signature,
        stealthAddress: stealth.stealthAddress,
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [publicKey, signTransaction])

  return {
    sendPrivate,
    loading,
    error,
  }
}
```

### Test It

1. Get a partner's stealth meta-address (or use your own for testing)
2. Enter the address and amount in the Send form
3. Click "Send Privately"
4. Check Solana Explorer - the recipient address is one-time, not linkable

### What Happened?

- `generateStealthAddress()` creates a unique one-time address
- The ephemeral public key is included in the transaction memo
- Only the recipient can derive the private key to spend

---

## Exercise 3: Scan & Claim Payments (15 minutes)

### Goal
Scan for incoming private payments and claim them.

### Instructions

Open `src/hooks/usePrivateReceive.ts`:

```typescript
// TODO: Implement payment scanning and claiming
export function usePrivateReceive() {
  // Your code here
}
```

### Solution

```typescript
import { useState, useCallback } from 'react'
import {
  scanForPayments,
  claimStealthPayment,
  deriveStealthPrivateKey,
  createProvider,
} from '@sip-protocol/sdk'
import { useWallet } from '@solana/wallet-adapter-react'

interface IncomingPayment {
  signature: string
  amount: bigint
  token: string
  ephemeralPublicKey: string
  stealthAddress: string
  claimed: boolean
}

export function usePrivateReceive(privateAddress: {
  spendingKey: string
  viewingKey: string
  publicSpendingKey: string
} | null) {
  const { publicKey, signTransaction } = useWallet()
  const [payments, setPayments] = useState<IncomingPayment[]>([])
  const [scanning, setScanning] = useState(false)
  const [claiming, setClaiming] = useState(false)

  // Scan for incoming payments
  const scan = useCallback(async () => {
    if (!privateAddress) {
      throw new Error('No private address configured')
    }

    setScanning(true)

    try {
      const provider = createProvider('helius', {
        apiKey: process.env.HELIUS_API_KEY!,
        cluster: 'devnet',
      })

      const found = await scanForPayments({
        provider,
        viewingPrivateKey: privateAddress.viewingKey,
        spendingPublicKey: privateAddress.publicSpendingKey,
      })

      setPayments(found.map(p => ({
        ...p,
        claimed: false,
      })))

      return found
    } finally {
      setScanning(false)
    }
  }, [privateAddress])

  // Claim a specific payment to main wallet
  const claim = useCallback(async (payment: IncomingPayment) => {
    if (!privateAddress || !publicKey || !signTransaction) {
      throw new Error('Not ready to claim')
    }

    setClaiming(true)

    try {
      const provider = createProvider('helius', {
        apiKey: process.env.HELIUS_API_KEY!,
        cluster: 'devnet',
      })

      // Derive the private key for this specific stealth address
      const stealthPrivateKey = deriveStealthPrivateKey(
        privateAddress.spendingKey,
        payment.ephemeralPublicKey
      )

      const result = await claimStealthPayment({
        provider,
        stealthPrivateKey,
        stealthAddress: payment.stealthAddress,
        destinationAddress: publicKey.toBase58(),
        tokenMint: payment.token,
        amount: payment.amount,
        signTransaction,
      })

      // Mark as claimed
      setPayments(prev =>
        prev.map(p =>
          p.signature === payment.signature
            ? { ...p, claimed: true }
            : p
        )
      )

      return result
    } finally {
      setClaiming(false)
    }
  }, [privateAddress, publicKey, signTransaction])

  // Claim all unclaimed payments
  const claimAll = useCallback(async () => {
    const unclaimed = payments.filter(p => !p.claimed)
    const results = []

    for (const payment of unclaimed) {
      const result = await claim(payment)
      results.push(result)
    }

    return results
  }, [payments, claim])

  return {
    payments,
    scan,
    claim,
    claimAll,
    scanning,
    claiming,
    unclaimedCount: payments.filter(p => !p.claimed).length,
  }
}
```

### Test It

1. Have someone send to your stealth meta-address
2. Click "Scan for Payments"
3. See incoming payments listed
4. Click "Claim" to move funds to your main wallet

### What Happened?

- `scanForPayments()` uses your viewing key to find payments
- It scans transaction memos for ephemeral public keys
- For each match, it checks if you can derive the spending key
- `claimStealthPayment()` transfers from stealth address to your wallet

---

## Bonus Exercise: Add Privacy Toggle

Modify the send form to let users choose privacy level:

```typescript
import { PrivacyLevel } from '@sip-protocol/sdk'

// In your send hook
const privacyLevels = [
  { value: 'transparent', label: 'Public (no privacy)' },
  { value: 'shielded', label: 'Private (hidden sender/amount)' },
  { value: 'compliant', label: 'Compliant (private + auditable)' },
]

// Pass to your send function
privacy: PrivacyLevel.SHIELDED
```

---

## Troubleshooting

### "Wallet not connected"
- Ensure Phantom/Solflare is installed
- Switch to Devnet in wallet settings

### "No payments found"
- Payments take ~30 seconds to index
- Check the transaction signature on Explorer
- Verify the sender included the ephemeral key memo

### "Claim failed"
- Ensure you have SOL for transaction fees
- The stealth address might already be claimed

---

## What You Learned

1. **Stealth Meta-Addresses**: Generate once, receive many private payments
2. **One-Time Addresses**: Each payment goes to a unique, unlinkable address
3. **Key Derivation**: Only the recipient can derive the spending key
4. **Scanning**: Use viewing key to find your payments without exposing identity

---

## Next Steps

- Explore the [quick-start guides](../guides/) for more integration patterns
- Check out [DAO treasury](../guides/QUICK-START-DAO.md) for compliance features
- Read the [SDK docs](https://docs.sip-protocol.org) for full API reference

---

## Solution Code

Full solution available at:
```bash
git checkout solution
# or
cd sample-code/solution
```

---

*Workshop created for SIP Protocol Developer Education*
