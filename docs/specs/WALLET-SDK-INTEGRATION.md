# Wallet SDK Integration Specification

**Document:** SIP Protocol Wallet SDK Integration
**Version:** 1.0.0
**Last Updated:** 2026-01-20
**Status:** Draft

---

## 1. Overview

This specification defines how wallet developers integrate SIP privacy features into their wallets. The goal is to make privacy a first-class feature in every Web3 wallet with minimal implementation effort.

### 1.1 Integration Options

| Package | Use Case | Complexity |
|---------|----------|------------|
| `@sip-protocol/wallet-adapter` | Universal wallet adapter | Low |
| `@sip-protocol/walletconnect` | WalletConnect v2 integration | Low |
| `@sip-protocol/metamask-snap` | MetaMask Snap | Medium |
| `@sip-protocol/solana-wallet` | Solana wallet-adapter | Low |
| `@sip-protocol/sdk` | Direct integration | High |

### 1.2 Features Enabled

- **Stealth Address Generation**: Create/manage stealth meta-addresses
- **Payment Scanning**: Detect incoming private payments
- **Key Management**: Secure spending/viewing key storage
- **Privacy Toggle**: User-controlled privacy levels
- **Compliance Tools**: Viewing key export for auditors

---

## 2. @sip-protocol/wallet-adapter

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  WALLET APPLICATION                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ UI Layer    │  │ State Mgmt  │  │ Settings    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────────┐ │
│  │  @sip-protocol/wallet-adapter                          │ │
│  │                                                        │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │ │
│  │  │ SIPWallet   │ │ KeyManager  │ │ Scanner     │     │ │
│  │  │ Adapter     │ │             │ │ Service     │     │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘     │ │
│  │                                                        │ │
│  └───────────────────────┬───────────────────────────────┘ │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  @sip-protocol/sdk (Core)                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Installation

```bash
npm install @sip-protocol/wallet-adapter
# or
yarn add @sip-protocol/wallet-adapter
# or
pnpm add @sip-protocol/wallet-adapter
```

### 2.3 Core Interface

```typescript
// @sip-protocol/wallet-adapter

/**
 * Main wallet adapter class
 */
export class SIPWalletAdapter {
  constructor(config: SIPWalletConfig)

  // Initialization
  async initialize(): Promise<void>
  async deriveFromSeed(seed: Uint8Array, chain: Chain): Promise<void>

  // Stealth Addresses
  getMetaAddress(): string
  async generateStealthAddress(recipientMeta: string): Promise<StealthResult>
  async checkStealthAddress(address: string, ephemeralPub: string): Promise<boolean>

  // Key Management
  getSpendingPublicKey(): string
  getViewingPublicKey(): string
  async exportViewingKey(type: ViewingKeyType): Promise<string>

  // Scanning
  async scanForPayments(options?: ScanOptions): Promise<Payment[]>
  startBackgroundScanning(interval: number): void
  stopBackgroundScanning(): void

  // Privacy Level
  getPrivacyLevel(): PrivacyLevel
  setPrivacyLevel(level: PrivacyLevel): void

  // Lifecycle
  async destroy(): Promise<void>
}

export interface SIPWalletConfig {
  chain: Chain
  network: 'mainnet' | 'testnet' | 'devnet'
  storage?: StorageAdapter
  scanner?: ScannerConfig
}

export interface StealthResult {
  stealthAddress: string
  ephemeralPublicKey: string
  commitment?: string
}

export interface Payment {
  stealthAddress: string
  ephemeralPublicKey: string
  amount?: bigint
  token?: string
  timestamp: number
  privateKey: Uint8Array
}

export type Chain = 'ethereum' | 'solana' | 'near' | 'arbitrum' | 'polygon' | 'base'
export type PrivacyLevel = 'transparent' | 'shielded' | 'compliant'
export type ViewingKeyType = 'incoming' | 'outgoing' | 'full'
```

### 2.4 Basic Usage

```typescript
import { SIPWalletAdapter } from '@sip-protocol/wallet-adapter'

// Initialize adapter
const sipWallet = new SIPWalletAdapter({
  chain: 'ethereum',
  network: 'mainnet',
})

// Derive keys from wallet seed
await sipWallet.deriveFromSeed(walletSeed, 'ethereum')

// Get stealth meta-address (share with senders)
const metaAddress = sipWallet.getMetaAddress()
console.log('Share this to receive privately:', metaAddress)
// sip:ethereum:0x02abc...123:0x03def...456

// Scan for incoming payments
const payments = await sipWallet.scanForPayments()
for (const payment of payments) {
  console.log('Found payment at:', payment.stealthAddress)
  // Use payment.privateKey to claim funds
}

// Generate stealth address for sending
const { stealthAddress, ephemeralPublicKey } =
  await sipWallet.generateStealthAddress(recipientMetaAddress)
```

### 2.5 Key Derivation

```typescript
/**
 * Key derivation follows BIP-32 style paths
 *
 * Master Seed
 * └── SIP Purpose (m/7579')
 *     └── Chain (m/7579'/60' for Ethereum)
 *         ├── Spending Key (m/7579'/60'/0')
 *         └── Viewing Key (m/7579'/60'/1')
 */

import { deriveStealthKeys } from '@sip-protocol/wallet-adapter'

const keys = deriveStealthKeys(masterSeed, {
  chain: 'ethereum',
  accountIndex: 0,
})

// keys.spendingPrivateKey - 32 bytes
// keys.spendingPublicKey - 33 bytes (compressed)
// keys.viewingPrivateKey - 32 bytes
// keys.viewingPublicKey - 33 bytes (compressed)
```

### 2.6 Storage Adapter

```typescript
/**
 * Wallets can provide custom storage for keys and state
 */
export interface StorageAdapter {
  // Key-value storage
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>

  // Encrypted storage (for private keys)
  getEncrypted(key: string, password: string): Promise<Uint8Array | null>
  setEncrypted(key: string, value: Uint8Array, password: string): Promise<void>
}

// Example: LocalStorage adapter
class LocalStorageAdapter implements StorageAdapter {
  async get(key: string) {
    return localStorage.getItem(`sip:${key}`)
  }

  async set(key: string, value: string) {
    localStorage.setItem(`sip:${key}`, value)
  }

  async delete(key: string) {
    localStorage.removeItem(`sip:${key}`)
  }

  async getEncrypted(key: string, password: string) {
    const encrypted = localStorage.getItem(`sip:encrypted:${key}`)
    if (!encrypted) return null
    return decrypt(encrypted, password)
  }

  async setEncrypted(key: string, value: Uint8Array, password: string) {
    const encrypted = encrypt(value, password)
    localStorage.setItem(`sip:encrypted:${key}`, encrypted)
  }
}
```

---

## 3. WalletConnect v2 Integration

### 3.1 Overview

WalletConnect v2 integration enables any WalletConnect-compatible dApp to request privacy features from supporting wallets.

### 3.2 Installation

```bash
npm install @sip-protocol/walletconnect
```

### 3.3 Namespace Extension

```typescript
// SIP extends the standard WalletConnect namespace
const SIP_NAMESPACE = {
  methods: [
    'sip_getMetaAddress',
    'sip_generateStealthAddress',
    'sip_signPrivateTransaction',
    'sip_exportViewingKey',
    'sip_getPrivacyLevel',
    'sip_setPrivacyLevel',
  ],
  events: [
    'sip_paymentReceived',
    'sip_privacyLevelChanged',
  ],
}
```

### 3.4 Wallet Implementation

```typescript
import { SIPWalletConnectProvider } from '@sip-protocol/walletconnect'
import SignClient from '@walletconnect/sign-client'

// Initialize WalletConnect with SIP support
const signClient = await SignClient.init({
  projectId: 'YOUR_PROJECT_ID',
  metadata: {
    name: 'My Wallet',
    description: 'Privacy-enabled wallet',
    url: 'https://mywallet.com',
    icons: ['https://mywallet.com/icon.png'],
  },
})

// Add SIP method handlers
const sipProvider = new SIPWalletConnectProvider(sipWallet)

signClient.on('session_request', async (event) => {
  const { method, params } = event.params.request

  if (method.startsWith('sip_')) {
    const result = await sipProvider.handleRequest(method, params)
    await signClient.respond({
      topic: event.topic,
      response: { id: event.id, result },
    })
  }
})
```

### 3.5 dApp Implementation

```typescript
import { SIPWalletConnectClient } from '@sip-protocol/walletconnect'

// Connect with SIP namespace
const session = await signClient.connect({
  requiredNamespaces: {
    eip155: {
      methods: ['eth_sendTransaction', 'personal_sign'],
      chains: ['eip155:1'],
      events: ['chainChanged'],
    },
    sip: {
      methods: ['sip_getMetaAddress', 'sip_generateStealthAddress'],
      chains: ['sip:1'], // SIP on Ethereum mainnet
      events: ['sip_paymentReceived'],
    },
  },
})

// Use SIP methods
const sipClient = new SIPWalletConnectClient(signClient, session.topic)

// Get user's meta-address
const metaAddress = await sipClient.getMetaAddress()

// Generate stealth address for payment
const { stealthAddress } = await sipClient.generateStealthAddress(metaAddress)
```

### 3.6 Method Specifications

#### sip_getMetaAddress

```typescript
// Request
{
  "method": "sip_getMetaAddress",
  "params": {
    "chain": "ethereum" // optional, defaults to session chain
  }
}

// Response
{
  "metaAddress": "sip:ethereum:0x02abc...123:0x03def...456"
}
```

#### sip_generateStealthAddress

```typescript
// Request
{
  "method": "sip_generateStealthAddress",
  "params": {
    "recipientMetaAddress": "sip:ethereum:0x02...:0x03...",
    "amount": "1000000000000000000", // optional, for commitment
    "privacyLevel": "shielded" // optional
  }
}

// Response
{
  "stealthAddress": "0x7a8b9c...",
  "ephemeralPublicKey": "0x02def...",
  "commitment": "0x03abc..." // if amount provided
}
```

#### sip_exportViewingKey

```typescript
// Request
{
  "method": "sip_exportViewingKey",
  "params": {
    "type": "incoming", // incoming | outgoing | full
    "scope": "2024" // optional scope identifier
  }
}

// Response (requires user approval in wallet)
{
  "viewingKey": "0xfedcba...",
  "type": "incoming",
  "scope": "2024",
  "expiresAt": 1735689600 // optional expiration
}
```

---

## 4. MetaMask Snaps Integration

### 4.1 Overview

MetaMask Snaps allow extending MetaMask with custom functionality. The SIP Snap adds privacy features to MetaMask.

### 4.2 Snap Manifest

```json
{
  "version": "1.0.0",
  "proposedName": "SIP Protocol",
  "description": "Privacy features for Ethereum transactions",
  "repository": {
    "type": "git",
    "url": "https://github.com/sip-protocol/metamask-snap"
  },
  "source": {
    "shasum": "...",
    "location": {
      "npm": {
        "filePath": "dist/bundle.js",
        "packageName": "@sip-protocol/metamask-snap",
        "registry": "https://registry.npmjs.org"
      }
    }
  },
  "initialPermissions": {
    "snap_dialog": {},
    "snap_manageState": {},
    "snap_getBip32Entropy": {
      "path": ["m", "7579'", "60'"],
      "curve": "secp256k1"
    },
    "endowment:rpc": {
      "dapps": true,
      "snaps": false
    }
  },
  "manifestVersion": "0.1"
}
```

### 4.3 Snap Implementation

```typescript
// src/index.ts
import { OnRpcRequestHandler } from '@metamask/snaps-types'
import { panel, text, copyable } from '@metamask/snaps-ui'
import { SIPWalletAdapter } from '@sip-protocol/wallet-adapter'

let sipWallet: SIPWalletAdapter | null = null

async function initializeSIP(): Promise<SIPWalletAdapter> {
  if (sipWallet) return sipWallet

  // Get entropy from MetaMask
  const entropy = await snap.request({
    method: 'snap_getBip32Entropy',
    params: {
      path: ['m', "7579'", "60'"],
      curve: 'secp256k1',
    },
  })

  sipWallet = new SIPWalletAdapter({
    chain: 'ethereum',
    network: 'mainnet',
  })

  await sipWallet.deriveFromSeed(
    Buffer.from(entropy.privateKey.slice(2), 'hex'),
    'ethereum'
  )

  return sipWallet
}

export const onRpcRequest: OnRpcRequestHandler = async ({ request }) => {
  const wallet = await initializeSIP()

  switch (request.method) {
    case 'sip_getMetaAddress':
      return wallet.getMetaAddress()

    case 'sip_generateStealthAddress': {
      const { recipientMetaAddress } = request.params as any
      return wallet.generateStealthAddress(recipientMetaAddress)
    }

    case 'sip_exportViewingKey': {
      const { type } = request.params as any

      // Show confirmation dialog
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            text('**Export Viewing Key**'),
            text(`A dApp is requesting your ${type} viewing key.`),
            text('This will allow them to see your transaction history.'),
            text('Only approve if you trust this dApp.'),
          ]),
        },
      })

      if (!confirmed) {
        throw new Error('User rejected viewing key export')
      }

      return wallet.exportViewingKey(type)
    }

    case 'sip_scanPayments':
      return wallet.scanForPayments()

    default:
      throw new Error(`Method not found: ${request.method}`)
  }
}
```

### 4.4 dApp Usage

```typescript
// Connect to SIP Snap
const snapId = 'npm:@sip-protocol/metamask-snap'

// Install snap if not already installed
await window.ethereum.request({
  method: 'wallet_requestSnaps',
  params: {
    [snapId]: {},
  },
})

// Get meta-address
const metaAddress = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: {
      method: 'sip_getMetaAddress',
    },
  },
})

// Generate stealth address
const result = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: {
      method: 'sip_generateStealthAddress',
      params: {
        recipientMetaAddress: 'sip:ethereum:0x02...:0x03...',
      },
    },
  },
})
```

---

## 5. Solana Wallet Adapter Plugin

### 5.1 Overview

Integration with Solana's `@solana/wallet-adapter` ecosystem for Phantom, Solflare, and other Solana wallets.

### 5.2 Installation

```bash
npm install @sip-protocol/solana-wallet @solana/wallet-adapter-react
```

### 5.3 React Provider

```typescript
// @sip-protocol/solana-wallet

import { FC, ReactNode, useMemo } from 'react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { SIPSolanaProvider } from '@sip-protocol/solana-wallet'

export const WalletContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const network = WalletAdapterNetwork.Mainnet
  const endpoint = useMemo(() => clusterApiUrl(network), [network])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <SIPSolanaProvider network={network}>
          {children}
        </SIPSolanaProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
```

### 5.4 Hooks

```typescript
import {
  useSIPSolana,
  useSolanaStealthAddress,
  useSolanaScanPayments,
} from '@sip-protocol/solana-wallet'

function MyComponent() {
  // Core hook
  const {
    metaAddress,
    privacyLevel,
    setPrivacyLevel,
    isInitialized,
  } = useSIPSolana()

  // Generate stealth address
  const { generate, stealthAddress, ephemeralPubkey } = useSolanaStealthAddress()

  // Scan for payments
  const { payments, isScanning, scan } = useSolanaScanPayments()

  const handleSend = async () => {
    const result = await generate(recipientMetaAddress)
    // Use result.stealthAddress as recipient
  }

  return (
    <div>
      <p>Your meta-address: {metaAddress}</p>
      <button onClick={() => setPrivacyLevel('shielded')}>
        Enable Privacy
      </button>
      <button onClick={scan}>Scan for Payments</button>
      {payments.map((p) => (
        <div key={p.stealthAddress}>
          Payment: {p.amount} at {p.stealthAddress}
        </div>
      ))}
    </div>
  )
}
```

### 5.5 Direct Integration

```typescript
import { SIPSolanaAdapter } from '@sip-protocol/solana-wallet'
import { Connection, Keypair } from '@solana/web3.js'

// Initialize with existing Solana wallet
const connection = new Connection('https://api.mainnet-beta.solana.com')
const wallet = useWallet() // from @solana/wallet-adapter-react

const sipAdapter = new SIPSolanaAdapter({
  connection,
  wallet,
  network: 'mainnet',
})

// Initialize SIP keys from wallet
await sipAdapter.initialize()

// Get meta-address
const metaAddress = sipAdapter.getMetaAddress()
// sip:solana:0x02abc...123:0x03def...456

// Generate stealth address for SPL token transfer
const { stealthAddress, ephemeralPublicKey } =
  await sipAdapter.generateStealthAddress(recipientMeta)

// Create private SPL transfer
const tx = await sipAdapter.createPrivateTransfer({
  mint: USDC_MINT,
  amount: 1_000_000n, // 1 USDC
  recipient: recipientMeta,
  privacyLevel: 'shielded',
})

// Sign and send
const signature = await wallet.sendTransaction(tx, connection)
```

---

## 6. React Native Support

### 6.1 Installation

```bash
npm install @sip-protocol/react-native
# Required peer dependencies
npm install react-native-get-random-values @noble/curves
```

### 6.2 Setup

```typescript
// index.js or App.tsx (before other imports)
import 'react-native-get-random-values'
```

### 6.3 Usage

```typescript
import { SIPProvider, useSIP } from '@sip-protocol/react-native'

function App() {
  return (
    <SIPProvider
      chain="ethereum"
      network="mainnet"
      storage={AsyncStorageAdapter}
    >
      <WalletScreen />
    </SIPProvider>
  )
}

function WalletScreen() {
  const {
    metaAddress,
    generateStealthAddress,
    scanPayments,
    payments,
    privacyLevel,
    setPrivacyLevel,
  } = useSIP()

  return (
    <View>
      <Text>Your Privacy Address:</Text>
      <Text selectable>{metaAddress}</Text>

      <TouchableOpacity onPress={() => setPrivacyLevel('shielded')}>
        <Text>Enable Privacy</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={scanPayments}>
        <Text>Scan for Payments</Text>
      </TouchableOpacity>

      <FlatList
        data={payments}
        renderItem={({ item }) => (
          <PaymentItem payment={item} />
        )}
      />
    </View>
  )
}
```

### 6.4 Secure Storage

```typescript
import * as SecureStore from 'expo-secure-store'
import { StorageAdapter } from '@sip-protocol/wallet-adapter'

export const SecureStorageAdapter: StorageAdapter = {
  async get(key: string) {
    return SecureStore.getItemAsync(`sip:${key}`)
  },

  async set(key: string, value: string) {
    await SecureStore.setItemAsync(`sip:${key}`, value)
  },

  async delete(key: string) {
    await SecureStore.deleteItemAsync(`sip:${key}`)
  },

  async getEncrypted(key: string, password: string) {
    const value = await SecureStore.getItemAsync(`sip:encrypted:${key}`)
    if (!value) return null
    // Expo SecureStore already encrypts, but we can add extra layer
    return decrypt(value, password)
  },

  async setEncrypted(key: string, value: Uint8Array, password: string) {
    const encrypted = encrypt(value, password)
    await SecureStore.setItemAsync(`sip:encrypted:${key}`, encrypted)
  },
}
```

---

## 7. API Reference

### 7.1 Core Types

```typescript
// Chain identifiers
type Chain =
  | 'ethereum'
  | 'solana'
  | 'near'
  | 'arbitrum'
  | 'optimism'
  | 'polygon'
  | 'base'
  | 'bnb'
  | 'avalanche'

// Privacy levels
type PrivacyLevel = 'transparent' | 'shielded' | 'compliant'

// Viewing key types
type ViewingKeyType = 'incoming' | 'outgoing' | 'full'

// Stealth address result
interface StealthResult {
  stealthAddress: string
  ephemeralPublicKey: string
  sharedSecret?: string
}

// Detected payment
interface Payment {
  stealthAddress: string
  ephemeralPublicKey: string
  privateKey: Uint8Array
  amount?: bigint
  token?: string
  timestamp: number
  claimed: boolean
}

// Scan options
interface ScanOptions {
  fromBlock?: number
  toBlock?: number
  tokens?: string[]
  limit?: number
}
```

### 7.2 Error Codes

| Code | Name | Description |
|------|------|-------------|
| `SIP_WALLET_001` | NOT_INITIALIZED | Wallet not initialized |
| `SIP_WALLET_002` | INVALID_CHAIN | Unsupported chain |
| `SIP_WALLET_003` | KEY_DERIVATION_FAILED | Key derivation error |
| `SIP_WALLET_004` | SCAN_FAILED | Payment scanning error |
| `SIP_WALLET_005` | EXPORT_DENIED | User denied export |
| `SIP_WALLET_006` | STORAGE_ERROR | Storage operation failed |

---

## 8. Security Considerations

### 8.1 Key Storage

- Spending private keys MUST be stored encrypted
- Use platform-specific secure storage (Keychain, Keystore, SecureStore)
- Never expose spending keys to dApps
- Viewing keys can be exported with user consent

### 8.2 Scanning Security

- Scanning reveals which addresses belong to user
- Use dedicated RPC endpoints or run own node
- Consider using privacy-preserving scanning services
- Rate limit scanning to prevent timing attacks

### 8.3 WalletConnect Security

- Validate session permissions before responding
- Always prompt user for sensitive operations
- Implement session timeout
- Log all SIP method calls for audit

---

## 9. Testing

### 9.1 Test Networks

| Chain | Network | Faucet |
|-------|---------|--------|
| Ethereum | Sepolia | sepoliafaucet.com |
| Solana | Devnet | solfaucet.com |
| NEAR | Testnet | near.org/faucet |

### 9.2 Test Vectors

Use test vectors from `@sip-protocol/sdk/test-vectors`:

```typescript
import { testVectors } from '@sip-protocol/sdk/test-vectors'

describe('Wallet Adapter', () => {
  for (const vector of testVectors.stealthAddresses) {
    it(vector.description, () => {
      const result = adapter.generateStealthAddress(vector.input.metaAddress)
      expect(result.stealthAddress).toBe(vector.expected.stealthAddress)
    })
  }
})
```

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-20 | Initial specification |

---

*This specification enables wallet developers to integrate SIP privacy features with minimal effort.*
