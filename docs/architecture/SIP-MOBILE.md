# SIP Mobile - Technical Architecture

**Version:** 1.0.0
**Status:** Design Phase
**Target Platforms:** Solana dApp Store (Seeker), Google Play, iOS App Store

---

## Executive Summary

SIP Mobile is the **multi-chain** mobile application for SIP Protocol, bringing privacy-preserving transactions to users across Solana, Ethereum, and other blockchains. The app implements a **hybrid wallet architecture** with **chain abstraction from day 1**, supporting both embedded wallets (for seamless onboarding) and external wallet connections (for power users).

**Core Value Proposition:** One-tap private payments across any chain with stealth addresses, Pedersen commitments, and viewing keys for compliance.

**Multi-Chain Strategy:** Architecture built for multi-chain from day 1, with phased rollout:
- **Phase 1 (Launch):** Solana
- **Phase 2:** Ethereum L1 + L2s (Arbitrum, Optimism, Base)
- **Phase 3:** Bitcoin, NEAR, Cosmos ecosystem

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SIP MOBILE APP                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRESENTATION LAYER                                  │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │ │
│  │  │   Payments   │ │    Wallet    │ │   Receive    │ │   Settings   │      │ │
│  │  │    Screen    │ │    Screen    │ │    Screen    │ │    Screen    │      │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                           │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                          STATE MANAGEMENT                                   │ │
│  │                     (Zustand + React Query + MMKV)                          │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                           │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                      CHAIN ABSTRACTION LAYER                                │ │
│  │  ┌──────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Unified Interfaces: Account | Transaction | Token | Network         │  │ │
│  │  └──────────────────────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐              │ │
│  │  │  SOLANA         │ │  ETHEREUM       │ │  OTHER CHAINS   │              │ │
│  │  │  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │              │ │
│  │  │  │ @solana/  │  │ │  │ viem      │  │ │  │ Chain SDK │  │              │ │
│  │  │  │ web3.js   │  │ │  │ wagmi     │  │ │  │ (future)  │  │              │ │
│  │  │  ├───────────┤  │ │  ├───────────┤  │ │  ├───────────┤  │              │ │
│  │  │  │ MWA       │  │ │  │WalletConnect│ │  │ Native    │  │              │ │
│  │  │  │ Deeplinks │  │ │  │ Deeplinks │  │ │  │ Adapters  │  │              │ │
│  │  │  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │              │ │
│  │  │   Phase 1 ✓     │ │   Phase 2       │ │   Phase 3       │              │ │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                           │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                         WALLET ABSTRACTION                                  │ │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐  │ │
│  │  │     EMBEDDED WALLET         │  │      EXTERNAL WALLET                │  │ │
│  │  │  ┌───────────────────────┐  │  │  ┌─────────────────────────────┐    │  │ │
│  │  │  │   Privy SDK           │  │  │  │ SOLANA: MWA / Deeplinks     │    │  │ │
│  │  │  │   • Multi-chain keys  │  │  │  │ EVM: WalletConnect v2       │    │  │ │
│  │  │  │   • Apple/Google SSO  │  │  │  │ Hardware: Ledger (BT)       │    │  │ │
│  │  │  │   • MPC key sharding  │  │  │  └─────────────────────────────┘    │  │ │
│  │  │  └───────────────────────┘  │  │        "Power User"                 │  │ │
│  │  │       "Quick Start"          │  │                                     │  │ │
│  │  └─────────────────────────────┘  └─────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                           │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                          PRIVACY LAYER                                      │ │
│  │                       @sip-protocol/sdk                                     │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │ │
│  │  │   Stealth    │ │   Pedersen   │ │   Viewing    │ │   Privacy    │      │ │
│  │  │  Addresses   │ │ Commitments  │ │     Keys     │ │    Levels    │      │ │
│  │  │  (all chains)│ │  (all chains)│ │  (all chains)│ │  (all chains)│      │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Chain Architecture

### Design Philosophy

**"Build for many, launch with one"** - The codebase is architecturally prepared for multi-chain from day 1, but launches with Solana to align with M17 milestone and Seeker device availability.

### Chain Support Roadmap

| Phase | Chains | Timeline | Features |
|-------|--------|----------|----------|
| **Phase 1** | Solana | Launch | Full privacy features, Seeker/MWA, dApp Store |
| **Phase 2** | Ethereum, Arbitrum, Optimism, Base | +2 months | EVM privacy, WalletConnect, L2 support |
| **Phase 3** | Bitcoin, NEAR, Cosmos | +4 months | Extended ecosystem |

### Chain Abstraction Layer

The chain abstraction layer provides unified interfaces that work identically across all supported chains.

#### Core Interfaces

```typescript
// src/types/chain.ts

/**
 * Supported blockchain networks
 */
export type ChainId =
  // Solana
  | 'solana:mainnet'
  | 'solana:devnet'
  // Ethereum & L2s
  | 'eip155:1'      // Ethereum Mainnet
  | 'eip155:42161'  // Arbitrum One
  | 'eip155:10'     // Optimism
  | 'eip155:8453'   // Base
  | 'eip155:137'    // Polygon
  // Future
  | 'near:mainnet'
  | 'cosmos:cosmoshub-4'

export type ChainType = 'solana' | 'evm' | 'near' | 'cosmos' | 'bitcoin'

export interface ChainConfig {
  id: ChainId
  type: ChainType
  name: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrl: string
  iconUrl: string
  testnet: boolean
}

/**
 * Chain-agnostic account representation
 */
export interface UnifiedAccount {
  // Unique identifier across all chains
  id: string

  // Display info
  label: string
  avatarUrl?: string

  // Chain-specific addresses
  addresses: {
    [chainId: ChainId]: string
  }

  // Wallet type
  type: 'embedded' | 'external' | 'hardware' | 'watch'

  // Privacy keys (chain-agnostic)
  stealthMetaAddress?: string
  viewingPublicKey?: string
}

/**
 * Chain-agnostic transaction
 */
export interface UnifiedTransaction {
  id: string
  chainId: ChainId
  type: 'send' | 'receive' | 'swap' | 'contract'

  // Amounts
  amount: string
  token: UnifiedToken

  // Addresses (chain-specific format)
  from: string
  to: string

  // Privacy
  privacyLevel: 'transparent' | 'shielded' | 'compliant'
  stealthAddress?: string
  viewingKeyHash?: string

  // Status
  status: 'pending' | 'confirmed' | 'failed'
  timestamp: number
  txHash: string
  blockExplorerUrl: string
}

/**
 * Chain-agnostic token
 */
export interface UnifiedToken {
  // Unique across chains
  id: string

  // Display
  symbol: string
  name: string
  decimals: number
  logoUrl: string

  // Chain-specific addresses
  addresses: {
    [chainId: ChainId]: string | 'native'
  }

  // Price (USD)
  priceUsd?: number
  change24h?: number
}

/**
 * Chain-agnostic balance
 */
export interface UnifiedBalance {
  token: UnifiedToken
  chainId: ChainId
  balance: string          // Raw amount
  balanceFormatted: string // Human readable
  balanceUsd: number
}
```

#### Chain Provider Interface

```typescript
// src/services/chains/types.ts

import { UnifiedTransaction, UnifiedToken, UnifiedBalance, ChainId } from '@/types/chain'

/**
 * Each chain implements this interface
 */
export interface ChainProvider {
  // Chain info
  readonly chainId: ChainId
  readonly chainType: ChainType

  // Connection
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // Account
  getAddress(): Promise<string>
  getBalance(tokenAddress?: string): Promise<UnifiedBalance>
  getBalances(): Promise<UnifiedBalance[]>

  // Transactions
  sendTransaction(tx: SendTransactionParams): Promise<string>
  getTransaction(txHash: string): Promise<UnifiedTransaction>
  getTransactionHistory(address: string): Promise<UnifiedTransaction[]>
  estimateFee(tx: SendTransactionParams): Promise<TransactionFee>

  // Tokens
  getTokenInfo(address: string): Promise<UnifiedToken>
  getTokenBalance(tokenAddress: string): Promise<UnifiedBalance>

  // Privacy (SIP-specific)
  generateStealthAddress(
    spendingPubKey: string,
    viewingPubKey: string
  ): Promise<StealthAddressResult>

  scanForPayments(
    viewingPrivateKey: string,
    spendingPublicKey: string,
    fromBlock?: number
  ): Promise<DetectedPayment[]>

  // Signing
  signMessage(message: string): Promise<string>
  signTransaction(tx: unknown): Promise<unknown>
}

export interface SendTransactionParams {
  to: string
  amount: string
  token?: string // Token address, undefined for native
  privacyLevel: 'transparent' | 'shielded' | 'compliant'
  viewingKey?: string // For compliant transactions
  memo?: string
}

export interface TransactionFee {
  amount: string
  amountUsd: number
  token: UnifiedToken
  estimated: boolean
}

export interface StealthAddressResult {
  stealthAddress: string
  ephemeralPublicKey: string
  viewingKeyHash: string
}

export interface DetectedPayment {
  txHash: string
  amount: string
  token: UnifiedToken
  stealthAddress: string
  timestamp: number
}
```

#### Chain Provider Factory

```typescript
// src/services/chains/factory.ts

import { ChainId, ChainType } from '@/types/chain'
import { ChainProvider } from './types'
import { SolanaProvider } from './solana/provider'
import { EVMProvider } from './evm/provider'
// Future: import { NearProvider } from './near/provider'

const providers = new Map<ChainId, ChainProvider>()

export function getChainProvider(chainId: ChainId): ChainProvider {
  if (providers.has(chainId)) {
    return providers.get(chainId)!
  }

  const provider = createProvider(chainId)
  providers.set(chainId, provider)
  return provider
}

function createProvider(chainId: ChainId): ChainProvider {
  const chainType = getChainType(chainId)

  switch (chainType) {
    case 'solana':
      return new SolanaProvider(chainId)

    case 'evm':
      return new EVMProvider(chainId)

    // Future chains
    // case 'near':
    //   return new NearProvider(chainId)

    default:
      throw new Error(`Unsupported chain: ${chainId}`)
  }
}

function getChainType(chainId: ChainId): ChainType {
  if (chainId.startsWith('solana:')) return 'solana'
  if (chainId.startsWith('eip155:')) return 'evm'
  if (chainId.startsWith('near:')) return 'near'
  if (chainId.startsWith('cosmos:')) return 'cosmos'
  throw new Error(`Unknown chain type for: ${chainId}`)
}

// Convenience exports
export const solana = () => getChainProvider('solana:mainnet')
export const ethereum = () => getChainProvider('eip155:1')
export const arbitrum = () => getChainProvider('eip155:42161')
export const base = () => getChainProvider('eip155:8453')
```

### Solana Implementation (Phase 1)

```typescript
// src/services/chains/solana/provider.ts

import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { ChainProvider, SendTransactionParams } from '../types'
import { ChainId, UnifiedBalance, UnifiedTransaction } from '@/types/chain'
import { generateStealthAddress as sipGenerateStealth } from '@sip-protocol/sdk'

export class SolanaProvider implements ChainProvider {
  readonly chainId: ChainId
  readonly chainType = 'solana' as const

  private connection: Connection
  private walletAdapter: WalletAdapter | null = null

  constructor(chainId: ChainId) {
    this.chainId = chainId
    const rpcUrl = this.getRpcUrl(chainId)
    this.connection = new Connection(rpcUrl, 'confirmed')
  }

  async sendTransaction(params: SendTransactionParams): Promise<string> {
    if (!this.walletAdapter) {
      throw new Error('Wallet not connected')
    }

    const { to, amount, token, privacyLevel } = params

    // Handle privacy levels
    let recipient = to
    let ephemeralPubKey: string | undefined

    if (privacyLevel === 'shielded' || privacyLevel === 'compliant') {
      // Generate stealth address for recipient
      const stealth = await this.generateStealthAddress(
        params.recipientSpendingKey!,
        params.recipientViewingKey!
      )
      recipient = stealth.stealthAddress
      ephemeralPubKey = stealth.ephemeralPublicKey
    }

    // Build transaction
    const tx = await this.buildTransaction(recipient, amount, token)

    // Add ephemeral pubkey as memo if shielded
    if (ephemeralPubKey) {
      tx.add(this.createMemoInstruction(ephemeralPubKey))
    }

    // Sign and send
    const signature = await this.walletAdapter.signAndSendTransaction(tx)

    return signature
  }

  async generateStealthAddress(
    spendingPubKey: string,
    viewingPubKey: string
  ): Promise<StealthAddressResult> {
    // Use SIP SDK (chain-agnostic)
    const result = await sipGenerateStealth({
      spendingPublicKey: spendingPubKey,
      viewingPublicKey: viewingPubKey,
      chain: 'solana',
    })

    return {
      stealthAddress: result.stealthAddress,
      ephemeralPublicKey: result.ephemeralPublicKey,
      viewingKeyHash: result.viewingKeyHash,
    }
  }

  // ... other methods
}
```

### EVM Implementation (Phase 2)

```typescript
// src/services/chains/evm/provider.ts

import { createPublicClient, createWalletClient, http } from 'viem'
import { mainnet, arbitrum, optimism, base } from 'viem/chains'
import { ChainProvider, SendTransactionParams } from '../types'
import { ChainId, UnifiedBalance, UnifiedTransaction } from '@/types/chain'
import { generateStealthAddress as sipGenerateStealth } from '@sip-protocol/sdk'

const CHAIN_CONFIGS = {
  'eip155:1': mainnet,
  'eip155:42161': arbitrum,
  'eip155:10': optimism,
  'eip155:8453': base,
}

export class EVMProvider implements ChainProvider {
  readonly chainId: ChainId
  readonly chainType = 'evm' as const

  private publicClient: ReturnType<typeof createPublicClient>
  private walletClient: ReturnType<typeof createWalletClient> | null = null

  constructor(chainId: ChainId) {
    this.chainId = chainId
    const chain = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]

    this.publicClient = createPublicClient({
      chain,
      transport: http(),
    })
  }

  async sendTransaction(params: SendTransactionParams): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected')
    }

    const { to, amount, token, privacyLevel } = params

    // Handle privacy levels
    let recipient = to as `0x${string}`
    let ephemeralPubKey: string | undefined

    if (privacyLevel === 'shielded' || privacyLevel === 'compliant') {
      const stealth = await this.generateStealthAddress(
        params.recipientSpendingKey!,
        params.recipientViewingKey!
      )
      recipient = stealth.stealthAddress as `0x${string}`
      ephemeralPubKey = stealth.ephemeralPublicKey
    }

    // Send transaction
    const hash = await this.walletClient.sendTransaction({
      to: recipient,
      value: BigInt(amount),
      // Include ephemeral key in data field for stealth txs
      data: ephemeralPubKey ? (`0x${ephemeralPubKey}` as `0x${string}`) : undefined,
    })

    return hash
  }

  async generateStealthAddress(
    spendingPubKey: string,
    viewingPubKey: string
  ): Promise<StealthAddressResult> {
    // Use SIP SDK (same interface as Solana!)
    const result = await sipGenerateStealth({
      spendingPublicKey: spendingPubKey,
      viewingPublicKey: viewingPubKey,
      chain: 'ethereum', // SDK handles chain-specific derivation
    })

    return {
      stealthAddress: result.stealthAddress,
      ephemeralPublicKey: result.ephemeralPublicKey,
      viewingKeyHash: result.viewingKeyHash,
    }
  }

  // ... other methods
}
```

### Multi-Chain Hooks

```typescript
// src/hooks/useChain.ts

import { useCallback, useMemo } from 'react'
import { useChainStore } from '@/stores/chain.store'
import { getChainProvider } from '@/services/chains/factory'
import { ChainId, UnifiedBalance } from '@/types/chain'

export function useChain() {
  const { activeChainId, setActiveChain, enabledChains } = useChainStore()

  const provider = useMemo(
    () => getChainProvider(activeChainId),
    [activeChainId]
  )

  const switchChain = useCallback(async (chainId: ChainId) => {
    if (!enabledChains.includes(chainId)) {
      throw new Error(`Chain ${chainId} is not enabled`)
    }
    setActiveChain(chainId)
  }, [enabledChains, setActiveChain])

  return {
    chainId: activeChainId,
    provider,
    switchChain,
    enabledChains,
  }
}

// src/hooks/useMultiChainBalances.ts

export function useMultiChainBalances(address: string) {
  const { enabledChains } = useChainStore()

  return useQueries({
    queries: enabledChains.map((chainId) => ({
      queryKey: ['balances', chainId, address],
      queryFn: async () => {
        const provider = getChainProvider(chainId)
        return provider.getBalances()
      },
      enabled: !!address,
    })),
    combine: (results) => {
      const balances: UnifiedBalance[] = []
      let totalUsd = 0

      for (const result of results) {
        if (result.data) {
          balances.push(...result.data)
          totalUsd += result.data.reduce((sum, b) => sum + b.balanceUsd, 0)
        }
      }

      return {
        balances,
        totalUsd,
        isLoading: results.some((r) => r.isLoading),
      }
    },
  })
}
```

### Chain Selector UI

```typescript
// src/components/chain/ChainSelector.tsx

import React from 'react'
import { View, Text, Pressable, Image } from 'react-native'
import { useChain } from '@/hooks/useChain'
import { CHAIN_CONFIGS } from '@/constants/chains'

export function ChainSelector() {
  const { chainId, switchChain, enabledChains } = useChain()

  return (
    <View className="flex-row gap-2">
      {enabledChains.map((id) => {
        const config = CHAIN_CONFIGS[id]
        const isActive = id === chainId

        return (
          <Pressable
            key={id}
            onPress={() => switchChain(id)}
            className={`p-2 rounded-xl flex-row items-center gap-2 ${
              isActive ? 'bg-cyan-500/20 border border-cyan-500' : 'bg-gray-800'
            }`}
          >
            <Image
              source={{ uri: config.iconUrl }}
              className="w-6 h-6 rounded-full"
            />
            <Text className={isActive ? 'text-cyan-400' : 'text-gray-400'}>
              {config.name}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
```

### Multi-Chain Account Display

```
┌─────────────────────────────────────────────────────────────────┐
│  Account Center                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [All Chains ▼]  Total: $8,702.03                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────┐                                                        │
│  │ 👾  │  rz 1                           $8,702.03              │
│  └─────┘                                                        │
│           🟣 Solana    4KAF...H2y2        $222.29               │
│           ⟠ Ethereum  0x7a3...9f21       $8,438.38              │
│           🔵 Arbitrum 0x7a3...9f21       $28.36                 │
│           🔴 Optimism 0x7a3...9f21       $13.00                 │
├─────────────────────────────────────────────────────────────────┤
│              + Add Account                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## UX Reference: Jupiter Mobile (iOS)

> **Source:** Jupiter Mobile iOS App screenshots (January 2026)
> **Purpose:** Document proven UX patterns for SIP Mobile implementation

### Key UX Patterns Observed

#### 1. Multi-Account Architecture

Jupiter supports **multiple wallets/accounts** within a single app instance:

```
┌─────────────────────────────────────────────────────────┐
│  Account Center                                          │
├─────────────────────────────────────────────────────────┤
│  [Value] [Type] [Recent]         ← Sorting tabs         │
├─────────────────────────────────────────────────────────┤
│  ┌─────┐                                                │
│  │ 🐘  │  Wallet 1              $8,438.38              │
│  └─────┘  CzjG...4uNC                                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────┐                                                │
│  │ 👾  │  rz 1                  $222.29    ← Selected  │
│  └─────┘  4KAF...H2y2           (cyan border)          │
├─────────────────────────────────────────────────────────┤
│  ┌─────┐                                                │
│  │ 😊  │  RZ Team               $28.36                 │
│  └─────┘  9dAT...Z6Wd                                   │
├─────────────────────────────────────────────────────────┤
│              + Add Account                               │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- Each account has unique **NFT-style avatar**
- Custom **account labels** (not just addresses)
- **Truncated addresses** format: `4KAF...H2y2`
- **USD balance** prominently displayed
- **Sorting options**: Value, Type, Recent
- **Visual selection indicator** (cyan/teal border)

#### 2. Hybrid Authentication Flow

Jupiter offers **4 authentication paths** in the "Add Account" modal:

```
┌─────────────────────────────────────────────────────────┐
│                    Add Account                           │
│     Sign up & log in with your preferred                │
│              social account                              │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  📧  your@email.com                    [Paste]    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│    [ 🍎 ]    [ G ]    [ 𝕏 ]    [ 🎮 ]                  │
│    Apple    Google     X      Discord                   │
│                                                          │
│                      — or —                              │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │            + Create Account                        │  │  ← Primary CTA (cyan)
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │            📥 Import Account                       │  │  ← Secondary (dark)
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│         Other options (Watch Account & Ledger)           │  ← Tertiary link
└─────────────────────────────────────────────────────────┘
```

**Authentication Hierarchy:**
1. **Social Login** (Primary) - Apple, Google, X (Twitter), Discord
2. **Email** - Passwordless magic link
3. **Create Account** - New embedded wallet (no seed phrase)
4. **Import Account** - Seed phrase or private key
5. **Other Options** - Watch-only, Ledger hardware wallet

#### 3. Seed Phrase Import Flow

Supports multiple recovery phrase lengths:

```
┌─────────────────────────────────────────────────────────┐
│  ←        Secret Recovery Phrase                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Import an existing account with your 12,               │
│  15, 18, 21, or 24-word secret recovery              ?  │
│  phrase or private key.                                  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  Enter secret phrase or private key               │  │
│  │                                                    │  │
│  │                                                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    Paste                           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │                   Continue                         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Import Options:**
- 12, 15, 18, 21, or 24-word seed phrases
- Raw private key
- Single text area (auto-detects format)
- Prominent "Paste" button

#### 4. Advanced Account Options

```
┌─────────────────────────────────────────────────────────┐
│              Choose Method                               │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  ⬚    Ledger                                      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  👁    Watch Account                              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Power User Options:**
- **Ledger** - Hardware wallet via Bluetooth
- **Watch Account** - View-only mode (track without signing)

#### 5. Side Menu Structure

```
┌─────────────────────────────────────────────────────────┐
│  ┌─────┐  rz 1              [Switch]                    │
│  │ 👾  │  4KAF...H2y2  ⚙                               │
│  └─────┘                                                │
├─────────────────────────────────────────────────────────┤
│  Account                                                 │
│  ───────                                                │
│  📥  Manage                                             │
│  🏦  Add Funds                                          │
│  📡  Radar                                              │
│  🕐  History                                            │
├─────────────────────────────────────────────────────────┤
│  What's New                                              │
│  ──────────                                             │
│  💰  Earn                                               │
│  📊  Prediction          [Beta]                         │
│  📈  Perps                                              │
│  🖼   NFTs               [Beta]                         │
├─────────────────────────────────────────────────────────┤
│  [💬 Get help]        [⚙ Settings]                     │
└─────────────────────────────────────────────────────────┘
```

### Design System Observations

| Element | Jupiter Mobile | SIP Mobile Recommendation |
|---------|---------------|---------------------------|
| **Primary Color** | Cyan/Teal (`#00D9FF`) | Purple + Cyan accent |
| **Background** | Dark (`#0A1929`) | Similar dark theme |
| **Cards** | Rounded corners, subtle borders | Match style |
| **Typography** | Clean sans-serif | SF Pro / Inter |
| **Selection State** | Cyan border highlight | Adopt pattern |
| **Buttons** | Cyan fill (primary), Dark fill (secondary) | Match hierarchy |
| **Beta Tags** | Small cyan/teal badges | Use for new features |

#### 6. Swap/Send Interface

The main trading interface with custom numpad:

```
┌─────────────────────────────────────────────────────────┐
│  👾  Fees saved                    🕐  ⚙️  🌐          │
│      ⚡ $10.62                                          │
├─────────────────────────────────────────────────────────┤
│  [⚡Market]    [🔔 Limit]    [🔄 Recurring]            │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  💲  USDC ✓ >                                     │  │
│  │      📧 200                    (available bal)    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│                        0                                 │
│                      $0.00                              │
│                                                          │
│                        ↕️                                │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  🟣  SOL ✓ >                                      │  │
│  │      📧 0.016414643                               │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │               Enter amount                         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  [MAX]     1       2       3                            │
│  [75%]     4       5       6                            │
│  [50%]     7       8       9                            │
│  [CLEAR]   .       0       ⌫                            │
├─────────────────────────────────────────────────────────┤
│     📁          ↕️           📊                         │
│  Portfolio     Swap         Pro                         │
└─────────────────────────────────────────────────────────┘
```

**Key UX Elements:**
- **Order type tabs**: Market (default), Limit, Recurring
- **Token selectors**: Show token icon, symbol, verified badge (✓), balance
- **Swap direction**: ↕️ button to flip input/output
- **Custom numpad**: Percentage shortcuts (MAX, 75%, 50%), CLEAR button
- **Bottom tab bar**: Portfolio, Swap (active), Pro
- **Fees saved**: Gamification showing cumulative savings

#### 7. Manage Account Screen

Account customization and security:

```
┌─────────────────────────────────────────────────────────┐
│               Manage Account                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌──────────┐                         │
│                    │   👾     │                         │
│                    │  Avatar  │                         │
│                    └──────────┘                         │
│                                                          │
│                       rz 1                              │
│                   4KAF...H2y2  📋                       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  Customize Account                            >   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Show Private Key                             >   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│                                                          │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │            Remove Account                          │  │  ← Red/danger
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Key UX Elements:**
- **Large avatar**: Prominent display with circular frame
- **Account name**: Editable label in accent color
- **Address with copy**: Truncated address + clipboard icon
- **Customize Account**: Change name, avatar
- **Show Private Key**: Export functionality (requires auth)
- **Remove Account**: Destructive action in red at bottom

#### 8. Transaction History

Chronological transaction list with filtering:

```
┌─────────────────────────────────────────────────────────┐
│  ✕                    History                            │
├─────────────────────────────────────────────────────────┤
│  [⚡Swap]  [🔔 Limit]  [🔄 Recurring]  [↗️ Tran...]     │
├─────────────────────────────────────────────────────────┤
│  January 15, 2026                                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  ↕️ Swap                      15 Jan at 08.16     │  │
│  │  💲🟣  USDC → SOL           +0.034219726 SOL     │  │
│  │       1 USDC ≈ 0.0068439 SOL       -5 USDC       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  November 11, 2025                                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  ↕️ Swap                      11 Nov at 04.52     │  │
│  │  🔵💲  JUP → USDC          +74.109029 USDC       │  │
│  │       1 JUP ≈ 0.35744 USDC    -207.330426 JUP    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  November 6, 2025                                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  ↕️ Swap                      6 Nov at 20.49      │  │
│  │  🟣💲  SOL → USDC          +20.902291 USDC       │  │
│  │       1 SOL ≈ 160.79 USDC        -0.13 SOL       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Key UX Elements:**
- **Filter tabs**: Swap, Limit, Recurring, Transfers (scrollable)
- **Date grouping**: Transactions grouped by date
- **Transaction card**: Type badge, token icons, direction arrow
- **Amounts**: Green for received (+), gray for sent (-)
- **Exchange rate**: Shows rate at time of transaction
- **Timestamp**: Date and time in local format

#### 9. Global Settings

App-wide configuration:

```
┌─────────────────────────────────────────────────────────┐
│               Global Settings                            │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  ⚙️  Preferences                              >   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  🛡️  Security & Privacy                       >   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  🔗  Connected Apps                           >   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  📱  Jupiter Sync                             >   │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  🎧  Help & Support                           >   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  📡  About Jupiter                            >   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Settings Categories:**
- **Preferences**: Display, currency, language, notifications
- **Security & Privacy**: Biometrics, auto-lock, privacy settings
- **Connected Apps**: dApp connections management
- **Jupiter Sync**: Cross-device sync
- **Help & Support**: FAQ, contact, tickets
- **About**: Version, terms, licenses

#### 10. Token Detail / Portfolio View

Detailed token information with chart:

```
┌─────────────────────────────────────────────────────────┐
│  🟣  SOL ✓              ⭐   📤   •••                   │
│      4y • 1111...1111 🕐                                │
├─────────────────────────────────────────────────────────┤
│  $144.26               Mkt Cap      $81.5B              │
│  -$50.5  -25.95%       Liquidity    $167M               │
│                        Holders      3.8M                │
│                        Org. Score   99.21               │
├─────────────────────────────────────────────────────────┤
│  [Int] [1m] [1h] [4h] [1D] [More ▼]     💲  📈        │
│  ┌───────────────────────────────────────────────────┐  │
│  │          📊 Candlestick Chart                     │  │
│  │     ┌──┐                              •           │  │
│  │   ┌─┤  ├──┐    ┌──┬──┐         ┌──┬──┤           │  │
│  │  ─┴─┴──┴──┴────┴──┴──┴─────────┴──┴──┴──         │  │
│  │  $148.47 ───────────────────────────────          │  │
│  │  $145.72 ───────────────────────────────          │  │
│  │  $142.96 ───────────────────────────────          │  │
│  │  $140.21 ───────────────────────────────          │  │
│  └───────────────────────────────────────────────────┘  │
│   Jan 15    Jan 16    Jan 17    Jan 18                  │
├─────────────────────────────────────────────────────────┤
│  [Overview]    Terminal    Live Feed    🕐              │
├─────────────────────────────────────────────────────────┤
│  📊 Position PnL                                    >   │
│  $2.37                                    -$0.0308      │
│  0.0164146 SOL                              -1.28%      │
├─────────────────────────────────────────────────────────┤
│  Earn with SOL  ❓              Earn 3.82% APR          │
├─────────────────────────────────────────────────────────┤
│  [↗️ Send]      [— Sell]      [+ Buy]                  │
└─────────────────────────────────────────────────────────┘
```

**Key UX Elements:**
- **Token header**: Icon, name, verified badge, favorite, share, more
- **Price display**: Large current price, change amount, percentage (red/green)
- **Market data**: Mkt Cap, Liquidity, Holders, Org. Score (trust metric)
- **Timeframe selector**: Interval, 1m, 1h, 4h, 1D, More
- **Chart type toggle**: Candlestick / Line chart
- **Candlestick chart**: Interactive price chart with timestamps
- **Tab navigation**: Overview, Terminal, Live Feed
- **Position PnL**: User's holdings and profit/loss
- **Yield opportunity**: Staking APR callout
- **Action buttons**: Send (outline), Sell (outline), Buy (filled cyan)

#### 11. In-App Browser / dApp Discovery

Integrated browser with quick access to ecosystem apps:

```
┌─────────────────────────────────────────────────────────┐
│  👾   🔍 Start typing...                      ✕        │
├─────────────────────────────────────────────────────────┤
│  Jupiter                                                 │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   📁    │  │   🤝    │  │   📈    │  │   📊    │    │
│  │Portfolio│  │  Lend   │  │  Perps  │  │   Pro   │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│     (cyan)       (dark)       (dark)       (dark)       │
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │   ⊕     │  │   ⚖️    │  │   🌀    │  │   ≡     │    │
│  │ Studio  │  │Prediction│  │  Stake  │  │  DRiP  │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│                                                          │
│                                                          │
│                    🐱 Mascot                             │
│                  (space cat)                             │
│                                                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│    ←        →        🔍        [1]        •••          │
│   back    forward   search    tabs       more           │
└─────────────────────────────────────────────────────────┘
```

**Key UX Elements:**
- **Universal search**: Search bar for tokens, addresses, dApps
- **Feature grid**: 4x2 grid of ecosystem features/apps
- **Icon + label**: Each feature has distinct icon and name
- **Active indicator**: Current section highlighted (cyan background)
- **Browser controls**: Back, forward, search, tab count, more menu
- **Brand mascot**: Engaging illustration (cat astronaut)

#### 12. Send Flow (Detailed)

Clean, focused send interface:

```
┌─────────────────────────────────────────────────────────┐
│           [Address]    Magic Link      🕐              │
│              ↑ active                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│                   💲 USDC ▼                             │
│                                                          │
│                      |0                                  │
│                                                          │
│                   $0.00  🔄                             │
│                                                          │
│                  📧 200 USDC                            │
│                  (available)                             │
│                                                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │               Enter amount                         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  [MAX]     1       2       3                            │
│  [75%]     4       5       6                            │
│  [50%]     7       8       9                            │
│  [CLEAR]   .       0       ⌫                            │
└─────────────────────────────────────────────────────────┘
```

**Key UX Elements:**
- **Recipient type tabs**: Address (direct) vs Magic Link (shareable link)
- **History access**: Clock icon for recent recipients
- **Token selector**: Dropdown with icon, centered
- **Amount input**: Large font, cursor indicator, centered
- **USD conversion**: Real-time with refresh button
- **Balance chip**: Shows available balance, tappable for MAX
- **Smart numpad**: Percentage shortcuts on left column

#### 13. Add Funds / Deposit Options

Multiple funding methods in bottom sheet:

```
┌─────────────────────────────────────────────────────────┐
│  👾  rz 1                          🔄    🌐           │
│                                                          │
│                    $222.29                              │
│                                                          │
│      [✈️ Send]    [⊞ Deposit]    [⟲ Scan]             │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                    Add Funds                             │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  Instant Buy USDC              GPay 💳 Apple Pay  │  │
│  │  Buy USDC via credit card,                        │  │
│  │  Apple Pay, and more.                             │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Phantom Connect                          👻      │  │
│  │  Connect & transfer.                              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Solflare Connect                         🟡      │  │
│  │  Connect & transfer.                              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Receive Funds                            🟣      │  │
│  │  Deposit via the SOL network                      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Funding Methods:**
1. **Instant Buy**: Fiat on-ramp (credit card, Apple Pay, Google Pay)
2. **Phantom Connect**: Transfer from Phantom wallet
3. **Solflare Connect**: Transfer from Solflare wallet
4. **Receive Funds**: Show deposit address/QR

**Key UX Elements:**
- **Quick actions bar**: Send, Deposit, Scan at top
- **Bottom sheet modal**: Slides up over main content
- **Option cards**: Icon on right, title + description on left
- **Payment icons**: Visual indicators for supported methods
- **Wallet branding**: Phantom ghost, Solflare logo

---

### SIP Mobile Adaptations

Based on Jupiter's UX, SIP Mobile should implement:

1. **Multi-Account Support**
   - Allow multiple wallets per app
   - Custom labels and avatars
   - Easy switching via "Account Center"

2. **Hybrid Auth (Priority Order)**
   ```
   1. Social Login (Apple, Google) → Embedded wallet
   2. Create Account → New embedded wallet
   3. Import Account → Seed phrase/private key
   4. Watch Account → View-only mode
   5. Hardware → Ledger support
   ```

3. **Privacy-Specific Additions**
   - Privacy level indicator per account
   - Viewing key management in account settings
   - Stealth address generation in "Receive"

4. **Navigation Structure**
   ```
   Side Menu:
   ├── Account (Switch, Manage)
   ├── Privacy
   │   ├── Viewing Keys
   │   ├── Privacy Level
   │   └── Stealth Addresses
   ├── Payments
   │   ├── Send (Private)
   │   ├── Receive
   │   └── History
   └── Settings
   ```

5. **Send Flow Adaptations (Privacy-Enhanced)**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │  [🔒 Private]    [👁 Compliant]    [📢 Public]         │  ← Privacy tabs
   ├─────────────────────────────────────────────────────────┤
   │  From: Your Wallet                                      │
   │  To:   [Enter address or stealth address]              │
   │        [📷 Scan QR]  [📋 Paste]  [👤 Contacts]         │
   ├─────────────────────────────────────────────────────────┤
   │  Amount: [___________]  SOL ▼                          │
   │  [MAX] [75%] [50%] [25%]                               │
   ├─────────────────────────────────────────────────────────┤
   │  🔒 Privacy: SHIELDED                                  │
   │  • Recipient sees: One-time stealth address            │
   │  • Amount hidden: Yes (Pedersen commitment)            │
   │  • Viewing key: Attached for compliance                │
   └─────────────────────────────────────────────────────────┘
   ```

6. **Transaction History Adaptations**
   - Add **privacy badge** per transaction (🔒/👁/📢)
   - Show **stealth address** (truncated) for private txs
   - Filter by privacy level
   - "Reveal" option for viewing key holders

7. **Settings Additions for SIP**
   ```
   Global Settings:
   ├── Preferences
   ├── Security & Privacy          ← Enhanced
   │   ├── Biometrics
   │   ├── Auto-lock
   │   ├── Default Privacy Level   ← NEW
   │   └── Viewing Key Export      ← NEW
   ├── Viewing Keys                ← NEW section
   │   ├── Active Keys
   │   ├── Shared With
   │   └── Revoke Access
   ├── Connected Apps
   └── Help & Support
   ```

8. **Account Management Additions**
   ```
   Manage Account:
   ├── Customize Account
   ├── Show Private Key
   ├── Show Viewing Key            ← NEW
   ├── Export Stealth Meta-Address ← NEW
   └── Remove Account
   ```

9. **Add Funds Adaptations (Privacy-Enhanced)**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │                    Add Funds                             │
   ├─────────────────────────────────────────────────────────┤
   │  ┌───────────────────────────────────────────────────┐  │
   │  │  🔒 Private Deposit                        NEW    │  │
   │  │  Generate stealth address for anonymous funding   │  │
   │  └───────────────────────────────────────────────────┘  │
   │                                                          │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │  Instant Buy USDC              GPay 💳 Apple Pay  │  │
   │  │  Buy via credit card, Apple Pay                   │  │
   │  └───────────────────────────────────────────────────┘  │
   │                                                          │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │  Phantom Connect                           👻     │  │
   │  │  Connect & transfer from Phantom                  │  │
   │  └───────────────────────────────────────────────────┘  │
   │                                                          │
   │  ┌───────────────────────────────────────────────────┐  │
   │  │  Public Address                            🟣     │  │
   │  │  Standard Solana deposit address                  │  │
   │  └───────────────────────────────────────────────────┘  │
   └─────────────────────────────────────────────────────────┘
   ```
   - **Private Deposit**: Generates one-time stealth address
   - **Fiat On-ramp**: Standard flow (funds arrive publicly, can shield after)
   - **Wallet Connect**: Transfer from external wallets
   - **Public Address**: Fallback for standard deposits

10. **Send Flow with Magic Link + Privacy**
    ```
    Recipient Type Tabs:
    [🔒 Stealth Address]  [📧 Address]  [🔗 Magic Link]

    Stealth Address: Generates one-time address for recipient
    Address: Standard Solana address (privacy depends on toggle)
    Magic Link: Shareable payment link (recipient claims privately)
    ```

11. **dApp Browser Adaptations**
    ```
    SIP Feature Grid:
    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
    │   📁    │  │   🔒    │  │   👁    │  │   📜    │
    │Portfolio│  │ Private │  │ Viewing │  │ History │
    │         │  │  Send   │  │  Keys   │  │         │
    └─────────┘  └─────────┘  └─────────┘  └─────────┘

    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
    │   📥    │  │   ↔️    │  │   ⚙️    │  │   ❓    │
    │ Receive │  │  Swap   │  │Settings │  │  Help   │
    └─────────┘  └─────────┘  └─────────┘  └─────────┘
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
