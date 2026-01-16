# Adding Privacy to Your Solana dApp

*A practical guide to integrating SIP privacy into existing applications*

---

## Introduction

You have a working Solana dApp. Users can connect wallets, send tokens, maybe swap on Jupiter. But every transaction is public — and users are asking for privacy.

This guide shows you how to add privacy features to an existing app without a full rewrite. We'll cover:

1. Adding a "private receive" address
2. Implementing a "send privately" option
3. Showing private balance alongside public
4. React hooks for common patterns

**Time:** ~45 minutes

**Prerequisites:**
- Existing Solana dApp with wallet integration
- React (we'll show React patterns, adaptable to other frameworks)
- Basic understanding of SIP concepts (see [Getting Started](./01-getting-started-sdk.md))

---

## Architecture Overview

SIP privacy is additive — you don't replace your existing payment flow, you add a privacy option.

```
┌─────────────────────────────────────────────────────────┐
│  Your Existing dApp                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐      ┌─────────────────────────────┐ │
│   │   Wallet    │      │   Payment Form              │ │
│   │  Adapter    │      │   ┌─────────────────────┐   │ │
│   └─────────────┘      │   │  🔓 Public (default)│   │ │
│                        │   │  🔒 Private (NEW)   │   │ │
│                        │   └─────────────────────┘   │ │
│                        └─────────────────────────────┘ │
│                                                         │
│   ┌─────────────────────────────────────────────────┐  │
│   │   Balance Display                                │  │
│   │   Public: 10.5 SOL                              │  │
│   │   Private: 2.3 SOL (NEW)                        │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Install Dependencies

```bash
npm install @sip-protocol/sdk @sip-protocol/react
```

The React package provides hooks optimized for React apps.

---

## Step 2: Setup Provider Context

Wrap your app with SIP provider context:

```tsx
// src/providers/SIPProvider.tsx
import { createContext, useContext, useMemo, ReactNode } from 'react'
import { createProvider, SolanaRPCProvider } from '@sip-protocol/sdk'

interface SIPContextType {
  provider: SolanaRPCProvider
}

const SIPContext = createContext<SIPContextType | null>(null)

export function SIPProvider({
  children,
  heliusApiKey,
  cluster = 'mainnet-beta',
}: {
  children: ReactNode
  heliusApiKey: string
  cluster?: 'mainnet-beta' | 'devnet'
}) {
  const provider = useMemo(
    () => createProvider('helius', { apiKey: heliusApiKey, cluster }),
    [heliusApiKey, cluster]
  )

  return (
    <SIPContext.Provider value={{ provider }}>
      {children}
    </SIPContext.Provider>
  )
}

export function useSIPProvider() {
  const context = useContext(SIPContext)
  if (!context) throw new Error('useSIPProvider must be within SIPProvider')
  return context
}
```

Add to your app layout:

```tsx
// src/app/layout.tsx
import { SIPProvider } from '@/providers/SIPProvider'

export default function Layout({ children }) {
  return (
    <SIPProvider heliusApiKey={process.env.NEXT_PUBLIC_HELIUS_API_KEY!}>
      <WalletProvider>
        {children}
      </WalletProvider>
    </SIPProvider>
  )
}
```

---

## Step 3: Add Private Address Management

Create a hook to manage the user's private address:

```tsx
// src/hooks/usePrivateAddress.ts
import { useState, useCallback, useEffect } from 'react'
import {
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

const STORAGE_KEY = 'sip-private-address'

interface PrivateAddressData {
  encoded: string
  spendingPrivateKey: string
  viewingPrivateKey: string
  spendingPublicKey: string
}

export function usePrivateAddress() {
  const [address, setAddress] = useState<PrivateAddressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setAddress(JSON.parse(stored))
      } catch {
        // Invalid data, will regenerate
      }
    }
    setIsLoading(false)
  }, [])

  // Generate new address
  const generate = useCallback(() => {
    const meta = generateStealthMetaAddress()
    const data: PrivateAddressData = {
      encoded: encodeStealthMetaAddress(meta),
      spendingPrivateKey: meta.spendingKey.privateKey,
      viewingPrivateKey: meta.viewingKey.privateKey,
      spendingPublicKey: meta.spendingKey.publicKey,
    }

    // ⚠️ In production, use more secure storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setAddress(data)

    return data.encoded
  }, [])

  // Clear address (for testing/reset)
  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setAddress(null)
  }, [])

  return {
    address,
    encoded: address?.encoded ?? null,
    isLoading,
    generate,
    clear,
    hasAddress: !!address,
  }
}
```

---

## Step 4: Create Private Receive Component

Add a UI component for the private receiving address:

```tsx
// src/components/PrivateReceiveAddress.tsx
import { useState } from 'react'
import { usePrivateAddress } from '@/hooks/usePrivateAddress'
import { QRCodeSVG } from 'qrcode.react'

export function PrivateReceiveAddress() {
  const { encoded, hasAddress, generate, isLoading } = usePrivateAddress()
  const [copied, setCopied] = useState(false)

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!hasAddress) {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Private Receive Address</h3>
        <p className="text-sm text-gray-600 mb-4">
          Generate a private address to receive payments that can't be linked.
        </p>
        <button
          onClick={generate}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Generate Private Address
        </button>
      </div>
    )
  }

  const copyAddress = async () => {
    await navigator.clipboard.writeText(encoded!)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">🔒 Private Receive Address</h3>

      <div className="flex justify-center mb-4">
        <QRCodeSVG value={encoded!} size={150} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={encoded!}
          readOnly
          className="flex-1 px-3 py-2 border rounded text-sm font-mono"
        />
        <button
          onClick={copyAddress}
          className="px-3 py-2 border rounded hover:bg-gray-50"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Share this address to receive private payments.
        Each sender creates a unique one-time address.
      </p>
    </div>
  )
}
```

---

## Step 5: Add Private Balance Display

Show private balance alongside public balance:

```tsx
// src/hooks/usePrivateBalance.ts
import { useState, useCallback, useEffect } from 'react'
import { scanForPayments } from '@sip-protocol/sdk'
import { useSIPProvider } from '@/providers/SIPProvider'
import { usePrivateAddress } from './usePrivateAddress'

interface PrivatePayment {
  amount: bigint
  token: string
  signature: string
  claimed: boolean
}

export function usePrivateBalance() {
  const { provider } = useSIPProvider()
  const { address } = usePrivateAddress()
  const [payments, setPayments] = useState<PrivatePayment[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<Date | null>(null)

  const scan = useCallback(async () => {
    if (!address) return

    setIsScanning(true)
    try {
      const found = await scanForPayments({
        provider,
        viewingPrivateKey: address.viewingPrivateKey,
        spendingPublicKey: address.spendingPublicKey,
      })

      setPayments(found.map(p => ({
        ...p,
        claimed: false, // Track locally
      })))
      setLastScanned(new Date())
    } finally {
      setIsScanning(false)
    }
  }, [provider, address])

  // Auto-scan on mount and periodically
  useEffect(() => {
    if (address) {
      scan()
      const interval = setInterval(scan, 60000) // Every minute
      return () => clearInterval(interval)
    }
  }, [address, scan])

  // Calculate totals
  const totalBySol = payments
    .filter(p => p.token === 'native' && !p.claimed)
    .reduce((sum, p) => sum + p.amount, 0n)

  const totalByUsdc = payments
    .filter(p => p.token === 'USDC' && !p.claimed)
    .reduce((sum, p) => sum + p.amount, 0n)

  return {
    payments,
    isScanning,
    lastScanned,
    scan,
    balance: {
      sol: totalBySol,
      usdc: totalByUsdc,
    },
    unclaimedCount: payments.filter(p => !p.claimed).length,
  }
}
```

Display component:

```tsx
// src/components/PrivateBalanceDisplay.tsx
import { usePrivateBalance } from '@/hooks/usePrivateBalance'

export function PrivateBalanceDisplay() {
  const { balance, isScanning, lastScanned, scan, unclaimedCount } = usePrivateBalance()

  const formatSol = (lamports: bigint) =>
    (Number(lamports) / 1e9).toFixed(4)

  const formatUsdc = (units: bigint) =>
    (Number(units) / 1e6).toFixed(2)

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">🔒 Private Balance</h3>
        <button
          onClick={scan}
          disabled={isScanning}
          className="text-sm text-blue-600 hover:underline"
        >
          {isScanning ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>SOL</span>
          <span>{formatSol(balance.sol)}</span>
        </div>
        <div className="flex justify-between">
          <span>USDC</span>
          <span>${formatUsdc(balance.usdc)}</span>
        </div>
      </div>

      {unclaimedCount > 0 && (
        <p className="text-sm text-orange-600 mt-2">
          {unclaimedCount} payment(s) ready to claim
        </p>
      )}

      {lastScanned && (
        <p className="text-xs text-gray-400 mt-2">
          Last scanned: {lastScanned.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
```

---

## Step 6: Add "Send Privately" Option

Modify your existing send form to include a privacy toggle:

```tsx
// src/components/SendForm.tsx
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  decodeStealthMetaAddress,
  generateStealthAddress,
  sendPrivateSPLTransfer,
} from '@sip-protocol/sdk'
import { useSIPProvider } from '@/providers/SIPProvider'

export function SendForm() {
  const { publicKey, signTransaction } = useWallet()
  const { provider } = useSIPProvider()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [sending, setSending] = useState(false)

  const isStealthAddress = recipient.startsWith('sip:')

  const handleSend = async () => {
    if (!publicKey || !signTransaction) return

    setSending(true)
    try {
      if (isPrivate && isStealthAddress) {
        // Private send
        const recipientMeta = decodeStealthMetaAddress(recipient)
        const stealth = generateStealthAddress(recipientMeta)

        await sendPrivateSPLTransfer({
          provider,
          senderPublicKey: publicKey.toBase58(),
          stealthAddress: stealth.stealthAddress,
          ephemeralPublicKey: stealth.ephemeralPublicKey,
          amount: BigInt(parseFloat(amount) * 1e9),
          tokenMint: 'native',
          signTransaction,
        })
      } else {
        // Regular send (your existing logic)
        // await sendRegularTransfer(...)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); handleSend() }}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Recipient
          </label>
          <input
            type="text"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            placeholder="Address or sip:solana:0x..."
            className="w-full px-3 py-2 border rounded"
          />
          {isStealthAddress && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Private address detected
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Amount (SOL)
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        {isStealthAddress && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              🔒 Send privately (hide amount on-chain)
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={sending || !publicKey}
          className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {sending ? 'Sending...' : isPrivate ? 'Send Privately' : 'Send'}
        </button>
      </div>
    </form>
  )
}
```

---

## Step 7: Add Claim Flow

Let users claim their private payments:

```tsx
// src/components/ClaimPayments.tsx
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  claimStealthPayment,
  deriveStealthPrivateKey,
} from '@sip-protocol/sdk'
import { useSIPProvider } from '@/providers/SIPProvider'
import { usePrivateAddress } from '@/hooks/usePrivateAddress'
import { usePrivateBalance } from '@/hooks/usePrivateBalance'

export function ClaimPayments() {
  const { publicKey, signTransaction } = useWallet()
  const { provider } = useSIPProvider()
  const { address } = usePrivateAddress()
  const { payments, scan } = usePrivateBalance()
  const [claiming, setClaiming] = useState<string | null>(null)

  const unclaimed = payments.filter(p => !p.claimed)

  const handleClaim = async (payment: typeof payments[0]) => {
    if (!publicKey || !signTransaction || !address) return

    setClaiming(payment.signature)
    try {
      const stealthKey = deriveStealthPrivateKey(
        address.spendingPrivateKey,
        payment.ephemeralPublicKey
      )

      await claimStealthPayment({
        provider,
        stealthPrivateKey: stealthKey,
        stealthAddress: payment.stealthAddress,
        destinationAddress: publicKey.toBase58(),
        tokenMint: payment.tokenMint,
        amount: payment.amount,
      })

      // Refresh balance
      await scan()
    } finally {
      setClaiming(null)
    }
  }

  if (unclaimed.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No payments to claim
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Unclaimed Payments</h3>

      {unclaimed.map(payment => (
        <div
          key={payment.signature}
          className="flex justify-between items-center p-3 border rounded"
        >
          <div>
            <span className="font-mono">
              {(Number(payment.amount) / 1e9).toFixed(4)} {payment.token}
            </span>
          </div>
          <button
            onClick={() => handleClaim(payment)}
            disabled={claiming === payment.signature}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm"
          >
            {claiming === payment.signature ? 'Claiming...' : 'Claim'}
          </button>
        </div>
      ))}
    </div>
  )
}
```

---

## Security Considerations

### Key Storage

The example uses `localStorage` for simplicity. In production:

```typescript
// Better: Use encrypted IndexedDB
import { openDB } from 'idb'

const db = await openDB('sip-keys', 1, {
  upgrade(db) {
    db.createObjectStore('keys')
  },
})

// Encrypt before storing
const encrypted = await encryptWithPassword(keyData, userPassword)
await db.put('keys', encrypted, 'private-address')
```

### Memory Safety

Clear sensitive data from memory:

```typescript
import { secureWipe } from '@sip-protocol/sdk'

// After signing
secureWipe(privateKeyBuffer)
```

---

## Summary

You've added:
- ✅ Private receiving address (stealth meta-address)
- ✅ Private balance display
- ✅ "Send privately" option
- ✅ Claim flow for received payments

All while keeping your existing public payment flow intact.

**Next:** [Implementing Viewing Keys for Compliance](./03-viewing-keys-compliance.md)

---

*Published by SIP Protocol | The Privacy Standard for Web3*
