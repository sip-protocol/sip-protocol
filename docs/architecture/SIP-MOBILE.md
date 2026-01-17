# SIP Mobile - Technical Architecture

**Version:** 1.0.0
**Status:** Design Phase
**Target Platforms:** Solana dApp Store (Seeker), Google Play, iOS App Store

---

## Executive Summary

SIP Mobile is the mobile application for SIP Protocol, bringing privacy-preserving transactions to Solana users on mobile devices. The app implements a **hybrid wallet architecture** that supports both embedded wallets (for seamless onboarding) and external wallet connections (for power users).

**Core Value Proposition:** One-tap private payments with stealth addresses, Pedersen commitments, and viewing keys for compliance.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SIP MOBILE APP                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRESENTATION LAYER                              │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │ │
│  │  │   Payments   │ │    Wallet    │ │   Receive    │ │   Settings   │  │ │
│  │  │    Screen    │ │    Screen    │ │    Screen    │ │    Screen    │  │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          STATE MANAGEMENT                               │ │
│  │                     (Zustand + React Query)                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         WALLET ABSTRACTION                              │ │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │ │
│  │  │     EMBEDDED WALLET         │  │      EXTERNAL WALLET            │  │ │
│  │  │  ┌───────────────────────┐  │  │  ┌───────────────────────────┐  │  │ │
│  │  │  │   Privy SDK           │  │  │  │   MWA (Android)           │  │  │ │
│  │  │  │   • Apple/Google SSO  │  │  │  │   • Phantom, Solflare     │  │  │ │
│  │  │  │   • Email login       │  │  │  │   • Any MWA wallet        │  │  │ │
│  │  │  │   • Passkey auth      │  │  │  ├───────────────────────────┤  │  │ │
│  │  │  │   • MPC key sharding  │  │  │  │   Deeplinks (iOS)         │  │  │ │
│  │  │  └───────────────────────┘  │  │  │   • Phantom Universal     │  │  │ │
│  │  └─────────────────────────────┘  │  │   • Solflare              │  │  │ │
│  │         "Quick Start"              │  └───────────────────────────┘  │  │ │
│  │                                    │        "Power User"             │  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          PRIVACY LAYER                                  │ │
│  │                       @sip-protocol/sdk                                 │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │ │
│  │  │   Stealth    │ │   Pedersen   │ │   Viewing    │ │   Privacy    │  │ │
│  │  │  Addresses   │ │ Commitments  │ │     Keys     │ │    Levels    │  │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         BLOCKCHAIN LAYER                                │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    @solana/web3.js                                │  │ │
│  │  │         Helius RPC │ QuickNode │ Triton │ Public RPC             │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Framework

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | React Native 0.74+ | Cross-platform, large ecosystem |
| **Language** | TypeScript (strict) | Type safety, matches SDK |
| **Navigation** | React Navigation 7 | Standard for RN apps |
| **State** | Zustand + React Query | Lightweight, performant |
| **Styling** | NativeWind (Tailwind) | Consistent with sip-app |

### Wallet Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Embedded Wallet** | Privy SDK | Apple/Google SSO, no seed phrase |
| **MWA (Android)** | @solana-mobile/mobile-wallet-adapter | Native Solana wallet protocol |
| **Deeplinks (iOS)** | Phantom Universal Links | iOS wallet connection |
| **Fallback** | WalletConnect v2 | Multi-wallet support |

### SIP Protocol Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@sip-protocol/sdk` | ^0.6.0 | Stealth addresses, commitments |
| `@sip-protocol/types` | ^0.6.0 | TypeScript types |
| `@solana/web3.js` | ^1.95.0 | Solana blockchain interaction |
| `@noble/curves` | ^1.4.0 | Cryptographic operations |

---

## Project Structure

```
sip-mobile/
├── src/
│   ├── app/                          # App entry & navigation
│   │   ├── _layout.tsx               # Root layout (Expo Router)
│   │   ├── index.tsx                 # Home/landing
│   │   ├── (auth)/                   # Auth flow screens
│   │   │   ├── login.tsx
│   │   │   ├── onboarding.tsx
│   │   │   └── wallet-setup.tsx
│   │   ├── (main)/                   # Main app screens
│   │   │   ├── _layout.tsx           # Tab navigator
│   │   │   ├── wallet.tsx            # Wallet overview
│   │   │   ├── send.tsx              # Send payment
│   │   │   ├── receive.tsx           # Receive (stealth address)
│   │   │   └── history.tsx           # Transaction history
│   │   └── (settings)/               # Settings screens
│   │       ├── privacy.tsx           # Privacy level settings
│   │       ├── viewing-keys.tsx      # Viewing key management
│   │       └── security.tsx          # Security settings
│   │
│   ├── components/                   # Reusable components
│   │   ├── ui/                       # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Modal.tsx
│   │   ├── wallet/                   # Wallet-specific components
│   │   │   ├── BalanceCard.tsx
│   │   │   ├── TokenList.tsx
│   │   │   ├── TransactionItem.tsx
│   │   │   └── WalletSelector.tsx
│   │   ├── privacy/                  # Privacy-specific components
│   │   │   ├── PrivacyToggle.tsx
│   │   │   ├── StealthAddressQR.tsx
│   │   │   ├── ViewingKeyCard.tsx
│   │   │   └── PrivacyLevelBadge.tsx
│   │   └── send/                     # Send flow components
│   │       ├── RecipientInput.tsx
│   │       ├── AmountInput.tsx
│   │       ├── ConfirmSheet.tsx
│   │       └── SuccessAnimation.tsx
│   │
│   ├── hooks/                        # Custom hooks
│   │   ├── useWallet.ts              # Wallet abstraction hook
│   │   ├── usePrivacy.ts             # Privacy operations hook
│   │   ├── useStealthAddress.ts      # Stealth address generation
│   │   ├── useViewingKey.ts          # Viewing key management
│   │   ├── useTransaction.ts         # Transaction building/sending
│   │   └── useBiometrics.ts          # Biometric authentication
│   │
│   ├── providers/                    # Context providers
│   │   ├── WalletProvider.tsx        # Wallet context (embedded + external)
│   │   ├── PrivyProvider.tsx         # Privy embedded wallet
│   │   ├── MWAProvider.tsx           # Mobile Wallet Adapter (Android)
│   │   ├── PrivacyProvider.tsx       # SIP privacy context
│   │   └── ThemeProvider.tsx         # Dark/light mode
│   │
│   ├── services/                     # Business logic services
│   │   ├── wallet/
│   │   │   ├── embedded.ts           # Privy wallet service
│   │   │   ├── mwa.ts                # MWA connection service
│   │   │   ├── deeplink.ts           # Phantom deeplink service
│   │   │   └── index.ts              # Unified wallet interface
│   │   ├── privacy/
│   │   │   ├── stealth.ts            # Stealth address operations
│   │   │   ├── commitments.ts        # Pedersen commitment helpers
│   │   │   ├── viewing-keys.ts       # Viewing key operations
│   │   │   └── scan.ts               # Payment scanning service
│   │   ├── solana/
│   │   │   ├── connection.ts         # RPC connection management
│   │   │   ├── transactions.ts       # Transaction building
│   │   │   └── tokens.ts             # Token account management
│   │   └── storage/
│   │       ├── secure.ts             # Secure storage (Keychain/Keystore)
│   │       └── async.ts              # AsyncStorage wrapper
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── wallet.store.ts           # Wallet state
│   │   ├── privacy.store.ts          # Privacy settings
│   │   ├── transaction.store.ts      # Transaction history
│   │   └── settings.store.ts         # App settings
│   │
│   ├── utils/                        # Utility functions
│   │   ├── format.ts                 # Formatting helpers
│   │   ├── validation.ts             # Input validation
│   │   ├── crypto.ts                 # Crypto utilities
│   │   └── platform.ts               # Platform detection
│   │
│   ├── constants/                    # App constants
│   │   ├── tokens.ts                 # Token configurations
│   │   ├── rpc.ts                    # RPC endpoints
│   │   └── privacy.ts                # Privacy level configs
│   │
│   └── types/                        # TypeScript types
│       ├── wallet.ts
│       ├── transaction.ts
│       └── navigation.ts
│
├── android/                          # Android native code
│   ├── app/
│   │   ├── build.gradle              # App build config
│   │   └── src/main/
│   │       ├── AndroidManifest.xml   # Permissions, deeplinks
│   │       └── java/.../             # Native modules if needed
│   └── build.gradle                  # Project build config
│
├── ios/                              # iOS native code
│   ├── SIPMobile/
│   │   ├── Info.plist                # URL schemes, permissions
│   │   ├── Entitlements.plist        # Associated domains
│   │   └── AppDelegate.mm            # Deeplink handling
│   └── Podfile                       # CocoaPods dependencies
│
├── assets/                           # Static assets
│   ├── images/
│   ├── fonts/
│   └── animations/                   # Lottie animations
│
├── tests/                            # Test suites
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   └── e2e/                          # Detox E2E tests
│
├── publishing/                       # dApp Store publishing
│   ├── config.yaml                   # dApp Store config
│   ├── assets/                       # Store assets (icons, screenshots)
│   └── publisher-keypair.json        # (gitignored) Publisher key
│
├── app.json                          # Expo config
├── eas.json                          # EAS Build config
├── metro.config.js                   # Metro bundler config
├── babel.config.js                   # Babel config
├── tailwind.config.js                # NativeWind config
├── tsconfig.json                     # TypeScript config
├── package.json
└── README.md
```

---

## Wallet Abstraction Layer

The wallet abstraction provides a unified interface regardless of wallet type (embedded vs external).

### Interface Definition

```typescript
// src/types/wallet.ts

export type WalletType = 'embedded' | 'mwa' | 'deeplink' | 'walletconnect'

export interface WalletAccount {
  publicKey: string
  label?: string
  type: WalletType
}

export interface WalletState {
  connected: boolean
  connecting: boolean
  account: WalletAccount | null
  type: WalletType | null
}

export interface WalletActions {
  connect: (type: WalletType) => Promise<void>
  disconnect: () => Promise<void>
  signTransaction: (tx: Transaction) => Promise<Transaction>
  signAndSendTransaction: (tx: Transaction) => Promise<string>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
}

export type WalletContextType = WalletState & WalletActions
```

### Unified Wallet Hook

```typescript
// src/hooks/useWallet.ts

import { useCallback, useMemo } from 'react'
import { Platform } from 'react-native'
import { usePrivy } from '@privy-io/react-auth'
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { useWalletStore } from '../stores/wallet.store'
import { WalletType, WalletContextType } from '../types/wallet'

export function useWallet(): WalletContextType {
  const store = useWalletStore()
  const privy = usePrivy()

  const connect = useCallback(async (type: WalletType) => {
    store.setConnecting(true)

    try {
      switch (type) {
        case 'embedded':
          await connectEmbedded(privy)
          break

        case 'mwa':
          if (Platform.OS !== 'android') {
            throw new Error('MWA only available on Android')
          }
          await connectMWA()
          break

        case 'deeplink':
          await connectDeeplink()
          break

        case 'walletconnect':
          await connectWalletConnect()
          break
      }

      store.setConnected(true)
      store.setType(type)
    } catch (error) {
      store.setError(error)
      throw error
    } finally {
      store.setConnecting(false)
    }
  }, [privy, store])

  const signAndSendTransaction = useCallback(async (tx: Transaction) => {
    const { type } = store

    switch (type) {
      case 'embedded':
        return signAndSendWithPrivy(privy, tx)

      case 'mwa':
        return transact(async (wallet) => {
          const signed = await wallet.signAndSendTransactions({
            transactions: [tx],
          })
          return signed[0]
        })

      case 'deeplink':
        return signAndSendWithDeeplink(tx)

      default:
        throw new Error(`Unsupported wallet type: ${type}`)
    }
  }, [store, privy])

  return {
    connected: store.connected,
    connecting: store.connecting,
    account: store.account,
    type: store.type,
    connect,
    disconnect: store.disconnect,
    signTransaction: store.signTransaction,
    signAndSendTransaction,
    signMessage: store.signMessage,
  }
}
```

---

## Privacy Integration

### Stealth Address Flow

```typescript
// src/services/privacy/stealth.ts

import {
  generateStealthAddress,
  deriveSharedSecret,
  computeStealthPrivateKey,
} from '@sip-protocol/sdk'

export interface StealthPaymentRequest {
  spendingPublicKey: string
  viewingPublicKey: string
  amount: number
  token: string
  memo?: string
  expiresAt?: Date
}

export async function createStealthPaymentRequest(
  spendingPublicKey: string,
  viewingPublicKey: string,
  options?: { expiresAt?: Date; memo?: string }
): Promise<StealthPaymentRequest> {
  return {
    spendingPublicKey,
    viewingPublicKey,
    amount: 0, // Set by sender
    token: 'SOL',
    memo: options?.memo,
    expiresAt: options?.expiresAt,
  }
}

export async function generateOneTimeAddress(
  recipientSpendingKey: string,
  recipientViewingKey: string
): Promise<{
  stealthAddress: string
  ephemeralPublicKey: string
  viewingKeyHash: string
}> {
  const result = await generateStealthAddress({
    spendingPublicKey: recipientSpendingKey,
    viewingPublicKey: recipientViewingKey,
    chain: 'solana',
  })

  return {
    stealthAddress: result.stealthAddress,
    ephemeralPublicKey: result.ephemeralPublicKey,
    viewingKeyHash: result.viewingKeyHash,
  }
}

export async function scanForPayments(
  viewingPrivateKey: string,
  spendingPublicKey: string,
  transactions: Transaction[]
): Promise<DetectedPayment[]> {
  const payments: DetectedPayment[] = []

  for (const tx of transactions) {
    // Check if this transaction contains a payment to us
    const detected = await tryDecryptPayment(
      tx,
      viewingPrivateKey,
      spendingPublicKey
    )

    if (detected) {
      payments.push(detected)
    }
  }

  return payments
}
```

### Privacy Toggle Component

```typescript
// src/components/privacy/PrivacyToggle.tsx

import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { PrivacyLevel } from '@sip-protocol/types'
import { usePrivacyStore } from '../../stores/privacy.store'

const PRIVACY_LEVELS: { level: PrivacyLevel; label: string; description: string }[] = [
  {
    level: 'transparent',
    label: 'Public',
    description: 'Standard Solana transaction',
  },
  {
    level: 'shielded',
    label: 'Private',
    description: 'Hidden sender, amount, recipient',
  },
  {
    level: 'compliant',
    label: 'Compliant',
    description: 'Private with viewing key for auditors',
  },
]

export function PrivacyToggle() {
  const { level, setLevel } = usePrivacyStore()

  return (
    <View className="bg-gray-900 rounded-2xl p-4">
      <Text className="text-white text-lg font-semibold mb-3">
        Privacy Level
      </Text>

      <View className="flex-row gap-2">
        {PRIVACY_LEVELS.map(({ level: l, label, description }) => (
          <Pressable
            key={l}
            onPress={() => setLevel(l)}
            className={`flex-1 p-3 rounded-xl ${
              level === l ? 'bg-purple-600' : 'bg-gray-800'
            }`}
          >
            <Text className={`font-medium ${
              level === l ? 'text-white' : 'text-gray-400'
            }`}>
              {label}
            </Text>
            <Text className="text-gray-500 text-xs mt-1">
              {description}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
```

---

## Platform-Specific Implementations

### Android: Mobile Wallet Adapter

```typescript
// src/services/wallet/mwa.ts

import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import { Transaction, PublicKey } from '@solana/web3.js'

const APP_IDENTITY = {
  name: 'SIP Mobile',
  uri: 'https://sip-protocol.org',
  icon: 'favicon.ico',
}

export async function connectMWA(): Promise<{
  publicKey: string
  authToken: string
}> {
  return transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.authorize({
      cluster: 'mainnet-beta',
      identity: APP_IDENTITY,
    })

    return {
      publicKey: authResult.accounts[0].address,
      authToken: authResult.auth_token,
    }
  })
}

export async function signTransactionMWA(
  transaction: Transaction
): Promise<Transaction> {
  return transact(async (wallet: Web3MobileWallet) => {
    // Reauthorize if needed
    await wallet.authorize({
      cluster: 'mainnet-beta',
      identity: APP_IDENTITY,
    })

    const signedTxs = await wallet.signTransactions({
      transactions: [transaction],
    })

    return signedTxs[0]
  })
}

export async function signAndSendMWA(
  transaction: Transaction
): Promise<string> {
  return transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: 'mainnet-beta',
      identity: APP_IDENTITY,
    })

    const signatures = await wallet.signAndSendTransactions({
      transactions: [transaction],
    })

    return signatures[0]
  })
}
```

### iOS: Phantom Deeplinks

```typescript
// src/services/wallet/deeplink.ts

import { Linking } from 'react-native'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Transaction } from '@solana/web3.js'

const PHANTOM_URL = 'https://phantom.app/ul/v1'

interface DeeplinkSession {
  dappKeyPair: nacl.BoxKeyPair
  sharedSecret: Uint8Array | null
  session: string | null
  phantomPublicKey: string | null
}

let session: DeeplinkSession = {
  dappKeyPair: nacl.box.keyPair(),
  sharedSecret: null,
  session: null,
  phantomPublicKey: null,
}

export function getConnectUrl(redirectUrl: string): string {
  const url = new URL(`${PHANTOM_URL}/connect`)

  url.searchParams.set('app_url', 'https://sip-protocol.org')
  url.searchParams.set(
    'dapp_encryption_public_key',
    bs58.encode(session.dappKeyPair.publicKey)
  )
  url.searchParams.set('redirect_link', redirectUrl)
  url.searchParams.set('cluster', 'mainnet-beta')

  return url.toString()
}

export async function connectPhantom(): Promise<void> {
  const redirectUrl = 'sipmobile://onConnect'
  const connectUrl = getConnectUrl(redirectUrl)

  await Linking.openURL(connectUrl)
  // Handle response in app's URL handler
}

export function handleConnectResponse(url: string): {
  publicKey: string
  session: string
} {
  const params = new URLSearchParams(url.split('?')[1])

  const phantomPublicKey = params.get('phantom_encryption_public_key')!
  const data = params.get('data')!
  const nonce = params.get('nonce')!

  // Derive shared secret
  session.sharedSecret = nacl.box.before(
    bs58.decode(phantomPublicKey),
    session.dappKeyPair.secretKey
  )

  // Decrypt response
  const decrypted = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    session.sharedSecret
  )

  const response = JSON.parse(Buffer.from(decrypted!).toString())

  session.session = response.session
  session.phantomPublicKey = response.public_key

  return {
    publicKey: response.public_key,
    session: response.session,
  }
}

export async function signAndSendWithPhantom(
  transaction: Transaction
): Promise<string> {
  if (!session.sharedSecret || !session.session) {
    throw new Error('Not connected to Phantom')
  }

  const serializedTx = transaction.serialize({
    requireAllSignatures: false,
  })

  const payload = {
    transaction: bs58.encode(serializedTx),
    session: session.session,
  }

  const nonce = nacl.randomBytes(24)
  const encrypted = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    session.sharedSecret
  )

  const url = new URL(`${PHANTOM_URL}/signAndSendTransaction`)
  url.searchParams.set(
    'dapp_encryption_public_key',
    bs58.encode(session.dappKeyPair.publicKey)
  )
  url.searchParams.set('nonce', bs58.encode(nonce))
  url.searchParams.set('redirect_link', 'sipmobile://onSignAndSend')
  url.searchParams.set('payload', bs58.encode(encrypted))

  await Linking.openURL(url.toString())

  // Return signature from URL handler
  return '' // Placeholder - actual signature from callback
}
```

---

## Security Architecture

### Key Storage

| Platform | Storage Method | Protection |
|----------|---------------|------------|
| **iOS** | Keychain Services | Secure Enclave, Face ID |
| **Android** | Android Keystore | Hardware-backed, TEE |
| **Embedded** | Privy MPC | Shamir's Secret Sharing, TEE |

### Security Implementation

```typescript
// src/services/storage/secure.ts

import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'

export async function saveSecureKey(
  key: string,
  value: string
): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: true,
    authenticationPrompt: 'Authenticate to access your wallet',
  })
}

export async function getSecureKey(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key)
}

export async function requireBiometrics(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const isEnrolled = await LocalAuthentication.isEnrolledAsync()

  if (!hasHardware || !isEnrolled) {
    return false
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to continue',
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  })

  return result.success
}
```

### Privacy Protections

```typescript
// src/utils/privacy-guards.ts

import { useEffect } from 'react'
import { Platform, AppState } from 'react-native'
import * as ScreenCapture from 'expo-screen-capture'

// Prevent screenshots on sensitive screens
export function useScreenshotProtection(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return

    if (Platform.OS === 'android') {
      ScreenCapture.preventScreenCaptureAsync()
    }

    return () => {
      if (Platform.OS === 'android') {
        ScreenCapture.allowScreenCaptureAsync()
      }
    }
  }, [enabled])
}

// Clear clipboard after paste
export function useClipboardProtection() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        // Clear sensitive data from clipboard
        Clipboard.setString('')
      }
    })

    return () => subscription.remove()
  }, [])
}
```

---

## Publishing Strategy

### 1. Solana dApp Store (Primary)

**Target:** Seeker devices, privacy-focused users

```yaml
# publishing/config.yaml
publisher:
  name: "SIP Protocol"
  address: "<PUBLISHER_PUBKEY>"
  website: "https://sip-protocol.org"
  email: "mobile@sip-protocol.org"

app:
  name: "SIP Mobile"
  android_package: "org.sip_protocol.mobile"

release:
  version: "1.0.0"
  catalog:
    en-US:
      short_description: "Privacy-first Solana wallet"
      long_description: |
        SIP Mobile brings cryptographic privacy to Solana.

        Features:
        • Stealth addresses - One-time addresses for each payment
        • Hidden amounts - Pedersen commitments hide transaction values
        • Viewing keys - Selective disclosure for compliance
        • One-tap privacy toggle
        • Apple/Google login (no seed phrase)
        • Connect external wallets (Phantom, Solflare)

      whats_new: "Initial release"

  files:
    - apk: "./android/app/build/outputs/apk/release/app-release.apk"
    - icon: "./publishing/assets/icon-512.png"
    - banner: "./publishing/assets/banner-1200x600.png"
    - screenshots:
        - "./publishing/assets/screenshot-1.png"
        - "./publishing/assets/screenshot-2.png"
        - "./publishing/assets/screenshot-3.png"
        - "./publishing/assets/screenshot-4.png"
```

**Publishing Commands:**

```bash
# Install CLI
pnpm add -D @solana-mobile/dapp-store-cli

# Validate
npx dapp-store validate \
  -k ./publishing/publisher-keypair.json \
  -b $ANDROID_SDK_ROOT/build-tools/34.0.0

# Submit
npx dapp-store publish submit \
  -k ./publishing/publisher-keypair.json \
  -u https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY \
  --requestor-is-authorized
```

### 2. Google Play Store

**Target:** General Android users

**Requirements:**
- Separate signing key (NOT the same as dApp Store)
- Android App Bundle (AAB) format
- Privacy policy URL
- Data safety form

**Build Command:**
```bash
cd android && ./gradlew bundleRelease
```

### 3. iOS App Store

**Target:** iPhone users

**Compliance Strategy:**
- No crypto for in-app purchases
- View-only NFTs (no feature unlocking)
- External fiat on-ramps (MoonPay, Apple Pay)
- Organization developer account

**Build Command:**
```bash
eas build --platform ios --profile production
```

---

## Development Roadmap

### Phase 1: Foundation (Weeks 1-3)
- [ ] Project setup with Expo + React Native
- [ ] Privy embedded wallet integration
- [ ] Basic wallet UI (balance, send, receive)
- [ ] @sip-protocol/sdk integration

### Phase 2: Privacy Features (Weeks 4-6)
- [ ] Stealth address generation
- [ ] Privacy level toggle
- [ ] Payment scanning
- [ ] Viewing key management

### Phase 3: External Wallets (Weeks 7-8)
- [ ] MWA integration (Android)
- [ ] Phantom deeplinks (iOS)
- [ ] Wallet selector UI

### Phase 4: Polish & Testing (Weeks 9-10)
- [ ] E2E tests with Detox
- [ ] Security audit
- [ ] Performance optimization
- [ ] Accessibility

### Phase 5: Publishing (Weeks 11-12)
- [ ] dApp Store submission
- [ ] Google Play submission
- [ ] iOS App Store submission
- [ ] Marketing assets

---

## Related Documents

- [ARCHITECTURE.md](/docs/ARCHITECTURE.md) - Core protocol architecture
- [PRIVACY-BACKENDS.md](/docs/architecture/PRIVACY-BACKENDS.md) - Privacy backend options
- [Phantom Deeplinks Guide](https://docs.phantom.com/solana/integrating-phantom/deeplinks-ios-and-android)
- [Solana Mobile Docs](https://docs.solanamobile.com/)
- [Privy Documentation](https://docs.privy.io/)

---

**Last Updated:** 2026-01-17
**Status:** Design Phase
**Author:** SIP Protocol Team
