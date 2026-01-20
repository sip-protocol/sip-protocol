# SIP-EIP Integration Examples

**Version:** 1.0.0
**Last Updated:** 2026-01-20
**Spec Version:** SIP-EIP Draft 1.0.0

---

## Overview

This document provides comprehensive integration examples showing how to implement SIP-EIP compliant privacy in various application contexts. Each example includes complete code, step-by-step guides, and best practices.

**Target Implementations:**
- DEX Integration (private swaps)
- Wallet Integration (stealth addresses)
- Compliance Dashboard (viewing keys)
- Cross-Chain Bridge (shielded transfers)
- DAO Treasury (private voting)

---

## 1. DEX Integration

### 1.1 Overview

Integrate SIP-EIP privacy into decentralized exchanges to enable private swaps where the swap amount and recipient are hidden from public view.

**Privacy Features:**
- Hidden swap amounts (Pedersen commitments)
- Stealth recipient addresses
- Optional compliance via viewing keys
- No linkability between trades

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  USER INTERFACE                                              │
│  • Amount input (hidden via commitment)                      │
│  • Recipient stealth address                                 │
│  • Privacy level selector                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SIP-EIP PRIVACY LAYER                                       │
│  • createCommitment() for amount hiding                      │
│  • generateStealthAddress() for recipient                    │
│  • encryptForViewing() for compliance                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  DEX PROTOCOL (Jupiter, Uniswap, etc.)                       │
│  • Execute swap with commitment                              │
│  • Route to stealth address                                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Backend Implementation

```typescript
// dex-integration/backend/src/private-swap.ts
import {
  SIP,
  PrivacyLevel,
  createCommitment,
  generateStealthAddress,
  encryptForViewing,
  generateViewingKey,
  type ShieldedIntent,
  type Commitment,
} from '@sip-protocol/sdk'

interface PrivateSwapParams {
  inputToken: string
  outputToken: string
  amount: bigint           // Hidden from public
  recipientMetaAddress: string
  privacyLevel: PrivacyLevel
  viewingKeyHash?: string  // For compliance
}

interface PrivateSwapResult {
  intentId: string
  commitment: Commitment
  stealthAddress: string
  ephemeralPublicKey: string
  encryptedAmount?: string
}

/**
 * Create a private swap with hidden amount and stealth recipient
 *
 * SIP-EIP Spec References:
 * - §2.1 Stealth Address Generation
 * - §3.1 Pedersen Commitment Creation
 * - §4.2 Encryption for Viewing
 */
export async function createPrivateSwap(
  params: PrivateSwapParams
): Promise<PrivateSwapResult> {
  const sip = new SIP({ network: 'mainnet' })

  // Step 1: Create amount commitment (§3.1)
  // C = amount * G + blinding * H
  const commitment = createCommitment(params.amount)

  // Step 2: Generate stealth address for recipient (§2.1)
  // S = P_spend + H(r * P_view || P_spend) * G
  const { stealthAddress, ephemeralPublicKey } = generateStealthAddress(
    params.recipientMetaAddress
  )

  // Step 3: Create shielded intent
  const intent: ShieldedIntent = {
    id: crypto.randomUUID(),
    input: {
      token: params.inputToken,
      commitment: commitment.value,
    },
    output: {
      token: params.outputToken,
      recipient: stealthAddress,
    },
    privacy: params.privacyLevel,
    timestamp: Date.now(),
  }

  // Step 4: Optional compliance encryption (§4.2)
  let encryptedAmount: string | undefined
  if (params.privacyLevel === PrivacyLevel.COMPLIANT && params.viewingKeyHash) {
    // Encrypt amount for authorized viewers
    const viewingKey = await sip.resolveViewingKey(params.viewingKeyHash)
    encryptedAmount = encryptForViewing(
      { amount: params.amount.toString(), timestamp: intent.timestamp },
      viewingKey
    )
  }

  // Step 5: Submit to DEX
  const result = await sip.submitIntent(intent)

  return {
    intentId: result.id,
    commitment,
    stealthAddress,
    ephemeralPublicKey,
    encryptedAmount,
  }
}

/**
 * Execute the swap after solver provides quote
 */
export async function executePrivateSwap(
  intentId: string,
  quoteId: string,
  wallet: any
): Promise<{ txHash: string }> {
  const sip = new SIP({ network: 'mainnet' })

  // Get quote details
  const quote = await sip.getQuote(quoteId)

  // Sign and execute
  const signature = await wallet.signMessage(
    `Execute SIP swap: ${intentId}`
  )

  const result = await sip.execute(intentId, {
    quoteId,
    signature,
  })

  return { txHash: result.transactionHash }
}
```

### 1.4 Frontend Implementation

```typescript
// dex-integration/frontend/src/components/PrivateSwap.tsx
import React, { useState } from 'react'
import {
  useSIP,
  useStealthAddress,
  useCommitment,
  useViewingKey,
} from '@sip-protocol/react'
import { PrivacyLevel } from '@sip-protocol/sdk'

interface SwapFormData {
  inputToken: string
  outputToken: string
  amount: string
  recipientMetaAddress: string
  privacyLevel: PrivacyLevel
}

export function PrivateSwapForm() {
  const [formData, setFormData] = useState<SwapFormData>({
    inputToken: 'SOL',
    outputToken: 'USDC',
    amount: '',
    recipientMetaAddress: '',
    privacyLevel: PrivacyLevel.SHIELDED,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { createPrivateSwap, execute } = useSIP()
  const { generateForRecipient } = useStealthAddress()
  const { create: createCommitment } = useCommitment()
  const { current: viewingKey } = useViewingKey()

  const handleSwap = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Validate inputs
      if (!formData.amount || !formData.recipientMetaAddress) {
        throw new Error('Amount and recipient required')
      }

      const amountBigInt = BigInt(
        parseFloat(formData.amount) * 1e9 // Convert to lamports/wei
      )

      // Create private swap
      const result = await createPrivateSwap({
        inputToken: formData.inputToken,
        outputToken: formData.outputToken,
        amount: amountBigInt,
        recipientMetaAddress: formData.recipientMetaAddress,
        privacyLevel: formData.privacyLevel,
        viewingKeyHash: viewingKey?.hash,
      })

      console.log('Swap created:', result.intentId)

      // In production, show quote selection UI
      // then call execute()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="private-swap-form">
      <h2>Private Swap</h2>

      {/* Token Selection */}
      <div className="token-pair">
        <select
          value={formData.inputToken}
          onChange={(e) => setFormData({ ...formData, inputToken: e.target.value })}
        >
          <option value="SOL">SOL</option>
          <option value="ETH">ETH</option>
          <option value="USDC">USDC</option>
        </select>
        <span>→</span>
        <select
          value={formData.outputToken}
          onChange={(e) => setFormData({ ...formData, outputToken: e.target.value })}
        >
          <option value="USDC">USDC</option>
          <option value="SOL">SOL</option>
          <option value="ETH">ETH</option>
        </select>
      </div>

      {/* Amount Input (will be hidden) */}
      <div className="amount-input">
        <label>Amount (hidden via commitment)</label>
        <input
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          placeholder="0.0"
        />
      </div>

      {/* Recipient Stealth Address */}
      <div className="recipient-input">
        <label>Recipient Meta-Address</label>
        <input
          type="text"
          value={formData.recipientMetaAddress}
          onChange={(e) => setFormData({ ...formData, recipientMetaAddress: e.target.value })}
          placeholder="sip:solana:0x02...abc:0x03...def"
        />
      </div>

      {/* Privacy Level */}
      <div className="privacy-toggle">
        <label>Privacy Level</label>
        <select
          value={formData.privacyLevel}
          onChange={(e) => setFormData({
            ...formData,
            privacyLevel: e.target.value as PrivacyLevel
          })}
        >
          <option value={PrivacyLevel.TRANSPARENT}>Transparent (Public)</option>
          <option value={PrivacyLevel.SHIELDED}>Shielded (Full Privacy)</option>
          <option value={PrivacyLevel.COMPLIANT}>Compliant (Auditable)</option>
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      <button onClick={handleSwap} disabled={isLoading}>
        {isLoading ? 'Creating Swap...' : 'Swap Privately'}
      </button>
    </div>
  )
}
```

### 1.5 Step-by-Step Guide

1. **Install Dependencies**
   ```bash
   npm install @sip-protocol/sdk @sip-protocol/react
   ```

2. **Configure SIP Provider**
   ```typescript
   import { SIPProvider } from '@sip-protocol/react'

   function App() {
     return (
       <SIPProvider network="mainnet">
         <PrivateSwapForm />
       </SIPProvider>
     )
   }
   ```

3. **Generate User's Meta-Address**
   ```typescript
   const { metaAddress } = generateStealthMetaAddress('solana')
   // Share metaAddress publicly for receiving
   ```

4. **Create Private Swap**
   - Amount → Pedersen commitment (hidden)
   - Recipient → Stealth address (unlinkable)
   - Optional viewing key for compliance

5. **Execute Swap**
   - Get quotes from solvers
   - Sign and submit transaction
   - Funds arrive at stealth address

---

## 2. Wallet Integration

### 2.1 Overview

Integrate SIP-EIP stealth addresses into wallet applications to enable private receiving without exposing the main wallet address.

**Key Features:**
- Generate and display stealth meta-address
- Scan for incoming payments
- Derive keys to claim funds
- Multi-chain support

### 2.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  WALLET UI                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Meta-Address│  │ Scan Status │  │ Claim Funds │         │
│  │   Display   │  │   Monitor   │  │   Button    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SIP-EIP STEALTH MODULE                                      │
│  • generateStealthMetaAddress() - Create receivable address  │
│  • checkStealthAddress() - Scan for payments                 │
│  • deriveStealthPrivateKey() - Extract spending key          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN RPC                                              │
│  • Monitor announcements                                     │
│  • Submit claim transactions                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Backend Implementation

```typescript
// wallet-integration/backend/src/stealth-wallet.ts
import {
  generateStealthMetaAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
  encodeStealthMetaAddress,
  decodeStealthMetaAddress,
  type StealthMetaAddress,
  type StealthKeys,
} from '@sip-protocol/sdk'
import { Keypair } from '@solana/web3.js'

interface WalletStealthConfig {
  chain: 'ethereum' | 'solana' | 'near'
  masterSeed?: Uint8Array
}

/**
 * Stealth Wallet Manager
 *
 * SIP-EIP Spec References:
 * - §2.1 Stealth Meta-Address Format
 * - §2.2 Stealth Address Scanning
 * - §2.3 Private Key Derivation
 */
export class StealthWalletManager {
  private chain: string
  private spendingPrivateKey: Uint8Array
  private viewingPrivateKey: Uint8Array
  private metaAddress: string

  constructor(config: WalletStealthConfig) {
    this.chain = config.chain

    // Generate or derive keys
    const keys = this.generateKeys(config.masterSeed)
    this.spendingPrivateKey = keys.spendingPrivateKey
    this.viewingPrivateKey = keys.viewingPrivateKey
    this.metaAddress = keys.metaAddress
  }

  private generateKeys(seed?: Uint8Array): StealthKeys & { metaAddress: string } {
    // Generate stealth meta-address (§2.1)
    const result = generateStealthMetaAddress(this.chain, { seed })
    return {
      spendingPrivateKey: result.spendingPrivateKey,
      viewingPrivateKey: result.viewingPrivateKey,
      spendingPublicKey: result.spendingPublicKey,
      viewingPublicKey: result.viewingPublicKey,
      metaAddress: result.metaAddress,
    }
  }

  /**
   * Get shareable meta-address
   * Format: sip:<chain>:<spending_pub>:<viewing_pub>
   */
  getMetaAddress(): string {
    return this.metaAddress
  }

  /**
   * Scan for incoming payments (§2.2)
   *
   * @param announcements - List of stealth address announcements from chain
   * @returns Payments belonging to this wallet
   */
  async scanForPayments(
    announcements: StealthAnnouncement[]
  ): Promise<DetectedPayment[]> {
    const payments: DetectedPayment[] = []

    for (const announcement of announcements) {
      // Check if this stealth address belongs to us
      const isOurs = checkStealthAddress(
        announcement.stealthAddress,
        announcement.ephemeralPublicKey,
        this.spendingPrivateKey,
        this.viewingPrivateKey
      )

      if (isOurs) {
        // Derive the private key for this stealth address (§2.3)
        const { privateKey } = deriveStealthPrivateKey(
          announcement.stealthAddress,
          announcement.ephemeralPublicKey,
          this.spendingPrivateKey,
          this.viewingPrivateKey
        )

        payments.push({
          stealthAddress: announcement.stealthAddress,
          ephemeralPublicKey: announcement.ephemeralPublicKey,
          privateKey,
          amount: announcement.amount,
          token: announcement.token,
          timestamp: announcement.timestamp,
        })
      }
    }

    return payments
  }

  /**
   * Claim funds from a stealth address
   */
  async claimFunds(
    payment: DetectedPayment,
    destinationAddress: string
  ): Promise<string> {
    // Create keypair from derived private key
    const keypair = Keypair.fromSecretKey(payment.privateKey)

    // Build and sign transfer transaction
    // (Chain-specific implementation)
    const txHash = await this.submitClaim(keypair, destinationAddress, payment)

    return txHash
  }

  private async submitClaim(
    keypair: Keypair,
    destination: string,
    payment: DetectedPayment
  ): Promise<string> {
    // Implementation depends on chain
    // For Solana: Create SPL transfer instruction
    // For Ethereum: Create ERC-20 transfer
    throw new Error('Implement chain-specific claim logic')
  }
}

interface StealthAnnouncement {
  stealthAddress: string
  ephemeralPublicKey: string
  amount?: string
  token?: string
  timestamp: number
}

interface DetectedPayment {
  stealthAddress: string
  ephemeralPublicKey: string
  privateKey: Uint8Array
  amount?: string
  token?: string
  timestamp: number
}
```

### 2.4 Frontend Implementation

```typescript
// wallet-integration/frontend/src/components/StealthReceive.tsx
import React, { useState, useEffect } from 'react'
import {
  useStealthAddress,
  useScanPayments,
} from '@sip-protocol/react'
import QRCode from 'qrcode.react'

export function StealthReceivePanel() {
  const { metaAddress, isGenerating } = useStealthAddress()
  const { payments, isScanning, scan } = useScanPayments()
  const [copied, setCopied] = useState(false)

  // Auto-scan every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => scan(), 30000)
    return () => clearInterval(interval)
  }, [scan])

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(metaAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isGenerating) {
    return <div>Generating stealth address...</div>
  }

  return (
    <div className="stealth-receive-panel">
      <h2>Receive Privately</h2>

      {/* Meta-Address Display */}
      <div className="meta-address-section">
        <h3>Your Stealth Meta-Address</h3>
        <p className="description">
          Share this address to receive private payments.
          Each sender generates a unique stealth address.
        </p>

        <div className="qr-code">
          <QRCode value={metaAddress} size={200} />
        </div>

        <div className="address-display">
          <code>{metaAddress}</code>
          <button onClick={copyToClipboard}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Payment Scanning */}
      <div className="scanning-section">
        <h3>Incoming Payments</h3>
        <button onClick={() => scan()} disabled={isScanning}>
          {isScanning ? 'Scanning...' : 'Scan Now'}
        </button>

        {payments.length === 0 ? (
          <p>No payments detected yet</p>
        ) : (
          <ul className="payment-list">
            {payments.map((payment, index) => (
              <li key={index} className="payment-item">
                <div className="payment-amount">
                  {payment.amount} {payment.token}
                </div>
                <div className="payment-time">
                  {new Date(payment.timestamp).toLocaleString()}
                </div>
                <button onClick={() => claimPayment(payment)}>
                  Claim
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

### 2.5 Step-by-Step Guide

1. **Initialize Wallet with Stealth Support**
   ```typescript
   const wallet = new StealthWalletManager({
     chain: 'solana',
     masterSeed: deriveSeedFromMnemonic(mnemonic)
   })
   ```

2. **Display Meta-Address to User**
   ```typescript
   const metaAddress = wallet.getMetaAddress()
   // sip:solana:0x02abc...123:0x03def...456
   ```

3. **Scan for Incoming Payments**
   ```typescript
   // Fetch announcements from chain
   const announcements = await fetchStealthAnnouncements()

   // Check which ones are ours
   const payments = await wallet.scanForPayments(announcements)
   ```

4. **Claim Detected Funds**
   ```typescript
   for (const payment of payments) {
     const txHash = await wallet.claimFunds(payment, myMainAddress)
     console.log('Claimed:', txHash)
   }
   ```

---

## 3. Compliance Dashboard

### 3.1 Overview

Build a compliance dashboard that allows authorized auditors to view transaction details using viewing keys, while maintaining privacy for unauthorized observers.

**Key Features:**
- Viewing key generation (incoming/outgoing/full)
- Encrypted transaction data
- Auditor-specific access scopes
- Audit trail logging

### 3.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  COMPLIANCE DASHBOARD                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Key Manager │  │ Tx Explorer │  │ Audit Logs  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  SIP-EIP VIEWING KEY MODULE                                  │
│  • generateViewingKey() - Create viewing keys                │
│  • deriveViewingKey() - Hierarchical derivation              │
│  • encryptForViewing() / decryptWithViewing()               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ENCRYPTED DATA STORE                                        │
│  • Transaction metadata (encrypted)                          │
│  • Viewing key registry                                      │
│  • Audit logs                                                │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Backend Implementation

```typescript
// compliance-dashboard/backend/src/viewing-key-manager.ts
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
  computeViewingKeyHash,
  type ViewingKey,
  type ViewingKeyType,
} from '@sip-protocol/sdk'
import { sha256 } from '@noble/hashes/sha256'

interface AuditorConfig {
  id: string
  name: string
  organization: string
  scope: 'incoming' | 'outgoing' | 'full'
  validUntil: Date
}

interface TransactionData {
  txHash: string
  amount: string
  sender: string
  recipient: string
  timestamp: number
  token: string
}

/**
 * Viewing Key Manager for Compliance
 *
 * SIP-EIP Spec References:
 * - §4.1 Viewing Key Generation
 * - §4.2 Viewing Key Derivation
 * - §4.3 Encryption/Decryption
 */
export class ViewingKeyManager {
  private masterKey: ViewingKey
  private auditorKeys: Map<string, ViewingKey> = new Map()

  constructor(masterSeed: Uint8Array) {
    // Generate master viewing key (§4.1)
    this.masterKey = generateViewingKey(masterSeed, 'full')
  }

  /**
   * Create scoped viewing key for auditor (§4.2)
   */
  createAuditorKey(config: AuditorConfig): {
    viewingKey: string
    keyHash: string
  } {
    // Derive scoped key using HKDF
    const derivationPath = `auditor/${config.id}/${config.scope}`
    const auditorKey = deriveViewingKey(this.masterKey, derivationPath)

    // Store for later use
    this.auditorKeys.set(config.id, auditorKey)

    // Return public key hash (for on-chain registration)
    const keyHash = computeViewingKeyHash(auditorKey)

    return {
      viewingKey: auditorKey.privateKey, // Securely transmit to auditor
      keyHash,
    }
  }

  /**
   * Encrypt transaction data for authorized viewers (§4.3)
   */
  encryptTransactionData(
    txData: TransactionData,
    authorizedKeyHashes: string[]
  ): Map<string, string> {
    const encryptedData = new Map<string, string>()

    for (const [auditorId, key] of this.auditorKeys) {
      const keyHash = computeViewingKeyHash(key)

      if (authorizedKeyHashes.includes(keyHash)) {
        // Encrypt for this auditor
        const encrypted = encryptForViewing(
          JSON.stringify(txData),
          key.publicKey
        )
        encryptedData.set(keyHash, encrypted)
      }
    }

    return encryptedData
  }

  /**
   * Decrypt transaction data (auditor calls this)
   */
  static decryptTransactionData(
    encryptedData: string,
    viewingKey: string
  ): TransactionData {
    const decrypted = decryptWithViewing(encryptedData, viewingKey)
    return JSON.parse(decrypted)
  }

  /**
   * Get master key hash for on-chain registration
   */
  getMasterKeyHash(): string {
    return computeViewingKeyHash(this.masterKey)
  }

  /**
   * Revoke auditor access
   */
  revokeAuditorKey(auditorId: string): boolean {
    return this.auditorKeys.delete(auditorId)
  }
}

/**
 * Audit Log for compliance tracking
 */
export class AuditLog {
  private logs: AuditEntry[] = []

  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    this.logs.push({
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    })
  }

  getLogsByAuditor(auditorId: string): AuditEntry[] {
    return this.logs.filter(l => l.auditorId === auditorId)
  }

  getLogsByTimeRange(start: Date, end: Date): AuditEntry[] {
    return this.logs.filter(
      l => l.timestamp >= start.getTime() && l.timestamp <= end.getTime()
    )
  }
}

interface AuditEntry {
  id: string
  auditorId: string
  action: 'view' | 'decrypt' | 'export'
  txHash?: string
  timestamp: number
  ipAddress?: string
}
```

### 3.4 Frontend Implementation

```typescript
// compliance-dashboard/frontend/src/components/ComplianceDashboard.tsx
import React, { useState, useEffect } from 'react'
import { useViewingKey, useDecrypt } from '@sip-protocol/react'

interface AuditorSession {
  auditorId: string
  viewingKey: string
  scope: 'incoming' | 'outgoing' | 'full'
}

export function ComplianceDashboard() {
  const [session, setSession] = useState<AuditorSession | null>(null)
  const [transactions, setTransactions] = useState<DecryptedTx[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const { decrypt, canDecrypt } = useDecrypt(session?.viewingKey)

  const handleLogin = async (viewingKey: string) => {
    // Validate key and get session info
    const sessionInfo = await validateAuditorKey(viewingKey)
    setSession(sessionInfo)
  }

  const loadTransactions = async () => {
    if (!session) return

    setIsLoading(true)
    try {
      // Fetch encrypted transactions
      const encryptedTxs = await fetchEncryptedTransactions(session.auditorId)

      // Decrypt each transaction
      const decrypted = await Promise.all(
        encryptedTxs.map(async (tx) => {
          if (canDecrypt(tx.encryptedData)) {
            const data = await decrypt(tx.encryptedData)
            return { ...tx, decrypted: data, status: 'revealed' }
          }
          return { ...tx, status: 'unauthorized' }
        })
      )

      setTransactions(decrypted)
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) {
    return <AuditorLogin onLogin={handleLogin} />
  }

  return (
    <div className="compliance-dashboard">
      <header>
        <h1>Compliance Dashboard</h1>
        <div className="session-info">
          <span>Auditor: {session.auditorId}</span>
          <span>Scope: {session.scope}</span>
        </div>
      </header>

      <section className="transaction-explorer">
        <h2>Transaction Explorer</h2>
        <button onClick={loadTransactions} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Load Transactions'}
        </button>

        <table className="tx-table">
          <thead>
            <tr>
              <th>TX Hash</th>
              <th>Amount</th>
              <th>Sender</th>
              <th>Recipient</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.txHash}>
                <td>{tx.txHash.slice(0, 10)}...</td>
                <td>
                  {tx.status === 'revealed'
                    ? `${tx.decrypted.amount} ${tx.decrypted.token}`
                    : '🔒 Hidden'}
                </td>
                <td>
                  {tx.status === 'revealed'
                    ? tx.decrypted.sender.slice(0, 10) + '...'
                    : '🔒 Hidden'}
                </td>
                <td>
                  {tx.status === 'revealed'
                    ? tx.decrypted.recipient.slice(0, 10) + '...'
                    : '🔒 Hidden'}
                </td>
                <td>{new Date(tx.timestamp).toLocaleString()}</td>
                <td>
                  <span className={`status-${tx.status}`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="audit-log">
        <h2>Audit Log</h2>
        {/* Audit log viewer */}
      </section>
    </div>
  )
}

function AuditorLogin({ onLogin }: { onLogin: (key: string) => void }) {
  const [viewingKey, setViewingKey] = useState('')

  return (
    <div className="auditor-login">
      <h1>Auditor Login</h1>
      <input
        type="password"
        value={viewingKey}
        onChange={(e) => setViewingKey(e.target.value)}
        placeholder="Enter viewing key"
      />
      <button onClick={() => onLogin(viewingKey)}>
        Login
      </button>
    </div>
  )
}

interface DecryptedTx {
  txHash: string
  encryptedData: string
  timestamp: number
  status: 'revealed' | 'unauthorized'
  decrypted?: {
    amount: string
    token: string
    sender: string
    recipient: string
  }
}
```

### 3.5 Step-by-Step Guide

1. **Organization Setup**
   ```typescript
   const keyManager = new ViewingKeyManager(masterSeed)
   const masterHash = keyManager.getMasterKeyHash()
   // Register masterHash on-chain
   ```

2. **Create Auditor Key**
   ```typescript
   const { viewingKey, keyHash } = keyManager.createAuditorKey({
     id: 'auditor-2024-001',
     name: 'Tax Authority',
     organization: 'IRS',
     scope: 'full',
     validUntil: new Date('2025-12-31'),
   })
   // Securely transmit viewingKey to auditor
   ```

3. **Encrypt Transaction Data**
   ```typescript
   const encrypted = keyManager.encryptTransactionData(txData, [keyHash])
   // Store encrypted data with transaction
   ```

4. **Auditor Decrypts**
   ```typescript
   const txData = ViewingKeyManager.decryptTransactionData(
     encryptedData,
     auditorViewingKey
   )
   ```

---

## 4. Cross-Chain Bridge

### 4.1 Overview

Implement a cross-chain bridge with privacy where the source address, destination address, and amount are all hidden from public observers.

**Privacy Features:**
- Hidden source chain address
- Hidden destination chain address
- Hidden bridge amount
- Compliance-ready with viewing keys

### 4.2 Backend Implementation

```typescript
// cross-chain-bridge/backend/src/private-bridge.ts
import {
  SIP,
  PrivacyLevel,
  createCommitment,
  generateStealthAddress,
  encryptForViewing,
  createShieldedIntent,
  type ShieldedIntent,
} from '@sip-protocol/sdk'

interface BridgeRequest {
  sourceChain: string
  destinationChain: string
  sourceToken: string
  destinationToken: string
  amount: bigint
  recipientMetaAddress: string
  privacyLevel: PrivacyLevel
  viewingKeyHash?: string
}

interface BridgeResult {
  bridgeId: string
  sourceCommitment: string
  destinationStealthAddress: string
  estimatedTime: number
  status: 'pending' | 'bridging' | 'completed' | 'failed'
}

/**
 * Private Cross-Chain Bridge
 *
 * SIP-EIP Spec References:
 * - §2.1 Cross-Chain Stealth Addresses
 * - §3.1 Pedersen Commitments
 * - §5.1 Shielded Intent Format
 */
export async function createPrivateBridge(
  request: BridgeRequest
): Promise<BridgeResult> {
  const sip = new SIP({ network: 'mainnet' })

  // Step 1: Create commitment for bridge amount (§3.1)
  const commitment = createCommitment(request.amount)

  // Step 2: Generate stealth address on destination chain (§2.1)
  const { stealthAddress, ephemeralPublicKey } = generateStealthAddress(
    request.recipientMetaAddress,
    { targetChain: request.destinationChain }
  )

  // Step 3: Create shielded bridge intent (§5.1)
  const intent: ShieldedIntent = {
    id: crypto.randomUUID(),
    type: 'bridge',
    input: {
      chain: request.sourceChain,
      token: request.sourceToken,
      commitment: commitment.value,
    },
    output: {
      chain: request.destinationChain,
      token: request.destinationToken,
      recipient: stealthAddress,
    },
    privacy: request.privacyLevel,
    metadata: {
      ephemeralPublicKey,
    },
    timestamp: Date.now(),
  }

  // Step 4: Optional compliance encryption
  if (request.privacyLevel === PrivacyLevel.COMPLIANT && request.viewingKeyHash) {
    const viewingKey = await sip.resolveViewingKey(request.viewingKeyHash)
    intent.encryptedMetadata = encryptForViewing(
      JSON.stringify({
        amount: request.amount.toString(),
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
      }),
      viewingKey
    )
  }

  // Step 5: Submit to bridge network
  const result = await sip.submitBridgeIntent(intent)

  return {
    bridgeId: result.id,
    sourceCommitment: commitment.value,
    destinationStealthAddress: stealthAddress,
    estimatedTime: result.estimatedTime,
    status: 'pending',
  }
}

/**
 * Monitor bridge status
 */
export async function getBridgeStatus(bridgeId: string): Promise<BridgeResult> {
  const sip = new SIP({ network: 'mainnet' })
  const status = await sip.getBridgeStatus(bridgeId)

  return {
    bridgeId,
    sourceCommitment: status.sourceCommitment,
    destinationStealthAddress: status.destinationAddress,
    estimatedTime: status.estimatedTime,
    status: status.status,
  }
}
```

### 4.3 Frontend Implementation

```typescript
// cross-chain-bridge/frontend/src/components/PrivateBridge.tsx
import React, { useState } from 'react'
import { useSIP, useCommitment, useStealthAddress } from '@sip-protocol/react'
import { PrivacyLevel } from '@sip-protocol/sdk'

const SUPPORTED_CHAINS = ['ethereum', 'solana', 'near', 'arbitrum', 'polygon']

export function PrivateBridgeForm() {
  const [sourceChain, setSourceChain] = useState('ethereum')
  const [destChain, setDestChain] = useState('solana')
  const [amount, setAmount] = useState('')
  const [recipientMeta, setRecipientMeta] = useState('')
  const [privacyLevel, setPrivacyLevel] = useState(PrivacyLevel.SHIELDED)
  const [bridgeResult, setBridgeResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { createPrivateBridge } = useSIP()

  const handleBridge = async () => {
    setIsLoading(true)
    try {
      const result = await createPrivateBridge({
        sourceChain,
        destinationChain: destChain,
        sourceToken: 'USDC',
        destinationToken: 'USDC',
        amount: BigInt(parseFloat(amount) * 1e6),
        recipientMetaAddress: recipientMeta,
        privacyLevel,
      })
      setBridgeResult(result)
    } catch (error) {
      console.error('Bridge failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="private-bridge">
      <h2>Private Cross-Chain Bridge</h2>

      <div className="chain-selector">
        <div>
          <label>From</label>
          <select value={sourceChain} onChange={(e) => setSourceChain(e.target.value)}>
            {SUPPORTED_CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <span>→</span>
        <div>
          <label>To</label>
          <select value={destChain} onChange={(e) => setDestChain(e.target.value)}>
            {SUPPORTED_CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="amount-input">
        <label>Amount (Hidden)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="USDC amount"
        />
      </div>

      <div className="recipient-input">
        <label>Recipient Meta-Address</label>
        <input
          type="text"
          value={recipientMeta}
          onChange={(e) => setRecipientMeta(e.target.value)}
          placeholder={`sip:${destChain}:0x02...:0x03...`}
        />
      </div>

      <div className="privacy-selector">
        <label>Privacy</label>
        <select value={privacyLevel} onChange={(e) => setPrivacyLevel(e.target.value as PrivacyLevel)}>
          <option value={PrivacyLevel.SHIELDED}>Full Privacy</option>
          <option value={PrivacyLevel.COMPLIANT}>Auditable</option>
        </select>
      </div>

      <button onClick={handleBridge} disabled={isLoading}>
        {isLoading ? 'Bridging...' : 'Bridge Privately'}
      </button>

      {bridgeResult && (
        <div className="bridge-status">
          <h3>Bridge Status</h3>
          <p>ID: {bridgeResult.bridgeId}</p>
          <p>Status: {bridgeResult.status}</p>
          <p>Est. Time: {bridgeResult.estimatedTime}s</p>
        </div>
      )}
    </div>
  )
}
```

---

## 5. DAO Treasury

### 5.1 Overview

Implement private DAO treasury management with anonymous voting and hidden treasury balances.

**Privacy Features:**
- Hidden treasury balance (commitment)
- Anonymous voting (stealth addresses)
- Selective disclosure for members
- Audit-ready with viewing keys

### 5.2 Backend Implementation

```typescript
// dao-treasury/backend/src/private-treasury.ts
import {
  createCommitment,
  addCommitments,
  subtractCommitments,
  generateStealthAddress,
  encryptForViewing,
  decryptWithViewing,
  generateViewingKey,
  type Commitment,
} from '@sip-protocol/sdk'

interface TreasuryConfig {
  daoId: string
  memberViewingKeys: Map<string, string>
  auditorViewingKey?: string
}

interface Proposal {
  id: string
  title: string
  description: string
  amount: bigint
  recipient: string
  votes: Map<string, Vote>
  status: 'active' | 'passed' | 'rejected' | 'executed'
}

interface Vote {
  voterCommitment: string  // Anonymous voter commitment
  voteCommitment: string   // yes/no as commitment
  encryptedVote: string    // For tallying
}

/**
 * Private DAO Treasury Manager
 *
 * SIP-EIP Spec References:
 * - §3.1-3.3 Pedersen Commitments (balance hiding)
 * - §2.1 Stealth Addresses (anonymous voting)
 * - §4.1-4.3 Viewing Keys (member disclosure)
 */
export class PrivateTreasury {
  private config: TreasuryConfig
  private balanceCommitment: Commitment
  private balanceBlinding: bigint
  private proposals: Map<string, Proposal> = new Map()

  constructor(config: TreasuryConfig, initialBalance: bigint) {
    this.config = config

    // Create initial balance commitment (§3.1)
    const commitment = createCommitment(initialBalance)
    this.balanceCommitment = commitment
    this.balanceBlinding = BigInt('0x' + commitment.blindingFactor.slice(2))
  }

  /**
   * Get treasury balance commitment (public)
   * The actual balance is hidden
   */
  getBalanceCommitment(): string {
    return this.balanceCommitment.value
  }

  /**
   * Deposit funds (publicly adds to commitment) (§3.2)
   */
  deposit(amount: bigint): string {
    const depositCommitment = createCommitment(amount)

    // Homomorphic addition: new_balance = old_balance + deposit
    const newCommitment = addCommitments(
      this.balanceCommitment.value,
      depositCommitment.value
    )

    this.balanceCommitment.value = newCommitment
    this.balanceBlinding += BigInt('0x' + depositCommitment.blindingFactor.slice(2))

    return depositCommitment.value
  }

  /**
   * Create proposal for treasury spend
   */
  createProposal(
    title: string,
    description: string,
    amount: bigint,
    recipientMetaAddress: string
  ): string {
    const proposalId = crypto.randomUUID()

    // Generate stealth address for recipient
    const { stealthAddress } = generateStealthAddress(recipientMetaAddress)

    this.proposals.set(proposalId, {
      id: proposalId,
      title,
      description,
      amount,
      recipient: stealthAddress,
      votes: new Map(),
      status: 'active',
    })

    return proposalId
  }

  /**
   * Cast anonymous vote on proposal (§2.1 for anonymity)
   */
  castVote(
    proposalId: string,
    voterMetaAddress: string,
    vote: boolean,
    memberViewingKey: string
  ): string {
    const proposal = this.proposals.get(proposalId)
    if (!proposal || proposal.status !== 'active') {
      throw new Error('Invalid or inactive proposal')
    }

    // Create voter commitment (anonymous identity)
    const voterCommitment = createCommitment(BigInt(Date.now()))

    // Create vote commitment (1 = yes, 0 = no)
    const voteCommitment = createCommitment(vote ? 1n : 0n)

    // Encrypt vote for tallying
    const encryptedVote = encryptForViewing(
      JSON.stringify({ vote, timestamp: Date.now() }),
      memberViewingKey
    )

    proposal.votes.set(voterCommitment.value, {
      voterCommitment: voterCommitment.value,
      voteCommitment: voteCommitment.value,
      encryptedVote,
    })

    return voterCommitment.value
  }

  /**
   * Tally votes (requires voting key to decrypt)
   */
  tallyVotes(proposalId: string, tallyingKey: string): {
    yes: number
    no: number
    total: number
  } {
    const proposal = this.proposals.get(proposalId)
    if (!proposal) throw new Error('Proposal not found')

    let yes = 0
    let no = 0

    for (const vote of proposal.votes.values()) {
      try {
        const decrypted = JSON.parse(
          decryptWithViewing(vote.encryptedVote, tallyingKey)
        )
        if (decrypted.vote) {
          yes++
        } else {
          no++
        }
      } catch {
        // Skip votes we can't decrypt
      }
    }

    return { yes, no, total: proposal.votes.size }
  }

  /**
   * Execute passed proposal (§3.3 subtraction)
   */
  async executeProposal(proposalId: string): Promise<string> {
    const proposal = this.proposals.get(proposalId)
    if (!proposal || proposal.status !== 'passed') {
      throw new Error('Proposal not passed')
    }

    // Create withdrawal commitment
    const withdrawCommitment = createCommitment(proposal.amount)

    // Homomorphic subtraction: new_balance = old_balance - withdrawal
    const newCommitment = subtractCommitments(
      this.balanceCommitment.value,
      withdrawCommitment.value
    )

    this.balanceCommitment.value = newCommitment
    proposal.status = 'executed'

    // Return commitment for on-chain verification
    return withdrawCommitment.value
  }

  /**
   * Reveal balance to member with viewing key
   */
  revealBalanceToMember(
    memberId: string
  ): { encryptedBalance: string } | null {
    const memberKey = this.config.memberViewingKeys.get(memberId)
    if (!memberKey) return null

    const balanceData = JSON.stringify({
      commitment: this.balanceCommitment.value,
      blinding: this.balanceBlinding.toString(),
      timestamp: Date.now(),
    })

    return {
      encryptedBalance: encryptForViewing(balanceData, memberKey),
    }
  }
}
```

### 5.3 Frontend Implementation

```typescript
// dao-treasury/frontend/src/components/DAOTreasury.tsx
import React, { useState } from 'react'
import { useViewingKey, useCommitment } from '@sip-protocol/react'

export function DAOTreasuryDashboard({ daoId }: { daoId: string }) {
  const [proposals, setProposals] = useState<any[]>([])
  const [balanceCommitment, setBalanceCommitment] = useState('')
  const [revealedBalance, setRevealedBalance] = useState<string | null>(null)

  const { viewingKey, canDecrypt, decrypt } = useViewingKey()

  const revealBalance = async () => {
    const encryptedBalance = await fetchEncryptedBalance(daoId)
    if (canDecrypt(encryptedBalance)) {
      const data = JSON.parse(await decrypt(encryptedBalance))
      setRevealedBalance(data.balance)
    }
  }

  const castVote = async (proposalId: string, vote: boolean) => {
    await submitVote(proposalId, vote, viewingKey)
    // Refresh proposals
  }

  return (
    <div className="dao-treasury">
      <h1>DAO Treasury</h1>

      {/* Balance Section */}
      <section className="balance-section">
        <h2>Treasury Balance</h2>
        <div className="commitment">
          Commitment: {balanceCommitment.slice(0, 20)}...
        </div>
        {viewingKey && (
          <button onClick={revealBalance}>
            Reveal Balance (Members Only)
          </button>
        )}
        {revealedBalance && (
          <div className="revealed-balance">
            Balance: {revealedBalance} USDC
          </div>
        )}
      </section>

      {/* Proposals Section */}
      <section className="proposals-section">
        <h2>Active Proposals</h2>
        {proposals.map(proposal => (
          <div key={proposal.id} className="proposal-card">
            <h3>{proposal.title}</h3>
            <p>{proposal.description}</p>
            <div className="proposal-amount">
              Request: {proposal.amount} USDC
            </div>
            <div className="vote-buttons">
              <button onClick={() => castVote(proposal.id, true)}>
                Vote Yes (Anonymous)
              </button>
              <button onClick={() => castVote(proposal.id, false)}>
                Vote No (Anonymous)
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
```

---

## 6. Integration Checklist

### 6.1 Pre-Integration

- [ ] Install `@sip-protocol/sdk` and `@sip-protocol/react`
- [ ] Configure SIP provider with network settings
- [ ] Generate or import user's stealth keys
- [ ] Set up viewing key infrastructure (if compliance needed)

### 6.2 Security Checklist

- [ ] Store private keys securely (never in localStorage)
- [ ] Validate all user inputs before processing
- [ ] Use secure random for blinding factors
- [ ] Implement rate limiting on API endpoints
- [ ] Enable audit logging for compliance operations

### 6.3 Testing Checklist

- [ ] Unit tests for commitment operations
- [ ] Integration tests for stealth address flow
- [ ] E2E tests for complete user journeys
- [ ] Compliance test vectors (see TEST-VECTORS.md)

---

## 7. API Reference

### 7.1 Core Functions

| Function | Purpose | Spec Section |
|----------|---------|--------------|
| `generateStealthMetaAddress()` | Create receivable address | §2.1 |
| `generateStealthAddress()` | One-time recipient address | §2.1 |
| `checkStealthAddress()` | Scan for payments | §2.2 |
| `deriveStealthPrivateKey()` | Extract spending key | §2.3 |
| `createCommitment()` | Hide amount | §3.1 |
| `addCommitments()` | Homomorphic addition | §3.2 |
| `subtractCommitments()` | Homomorphic subtraction | §3.3 |
| `generateViewingKey()` | Create viewing key | §4.1 |
| `encryptForViewing()` | Encrypt for auditor | §4.2 |
| `decryptWithViewing()` | Decrypt as auditor | §4.3 |

### 7.2 React Hooks

| Hook | Purpose |
|------|---------|
| `useSIP()` | Main SIP client access |
| `useStealthAddress()` | Stealth address management |
| `useCommitment()` | Commitment creation/verification |
| `useViewingKey()` | Viewing key operations |
| `useScanPayments()` | Payment scanning |
| `useDecrypt()` | Decryption with viewing key |

---

## 8. Troubleshooting

### 8.1 Common Issues

**Stealth address not detected:**
- Verify ephemeral public key is correct
- Check that viewing key matches
- Ensure scanning the right chain

**Commitment verification fails:**
- Verify blinding factor is preserved
- Check for overflow in large values
- Ensure using same generator H

**Decryption fails:**
- Verify viewing key type matches (incoming/outgoing/full)
- Check nonce is correctly transmitted
- Ensure ciphertext not tampered

### 8.2 Debug Mode

```typescript
import { SIP, setLogLevel } from '@sip-protocol/sdk'

// Enable debug logging
setLogLevel('debug')

const sip = new SIP({ network: 'mainnet', debug: true })
```

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-20 | Initial release with 5 integration examples |

---

*These examples demonstrate SIP-EIP compliant implementations. Adapt to your specific use case.*
