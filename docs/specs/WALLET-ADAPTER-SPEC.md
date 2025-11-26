# Wallet Adapter Specification

> **Issue**: #35 - Abstract wallet interface design
> **Status**: IMPLEMENTED
> **Date**: November 27, 2025
> **Author**: RECTOR + CIPHER

---

## Overview

This specification defines a chain-agnostic wallet adapter interface for the SIP Protocol SDK. The interface allows SIP to work with any blockchain wallet while supporting optional privacy features.

---

## Design Principles

1. **Chain Agnostic**: Single interface works across all supported chains
2. **Minimal Interface**: Only essential operations required
3. **Privacy Optional**: Base interface works without privacy; extensions add it
4. **Event Driven**: Connection state changes emit events
5. **Type Safe**: Full TypeScript support with strict types

---

## Interface Hierarchy

```
WalletAdapter (base)
    │
    └── PrivateWalletAdapter (privacy extension)
            │
            ├── StealthAddresses
            ├── ViewingKeys
            └── ShieldedOperations
```

---

## Core Interface

### WalletAdapter

```typescript
interface WalletAdapter {
  // Identity
  readonly chain: ChainId
  readonly name: string
  readonly address: string
  readonly publicKey: HexString | ''

  // Connection
  readonly connectionState: WalletConnectionState
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // Signing
  signMessage(message: Uint8Array): Promise<Signature>
  signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction>
  signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt>

  // Balance
  getBalance(): Promise<bigint>
  getTokenBalance(asset: Asset): Promise<bigint>

  // Events
  on<T extends WalletEventType>(event: T, handler: EventHandler<T>): void
  off<T extends WalletEventType>(event: T, handler: EventHandler<T>): void
}
```

### Connection States

| State | Description |
|-------|-------------|
| `disconnected` | Not connected to wallet |
| `connecting` | Connection in progress |
| `connected` | Successfully connected |
| `error` | Connection failed |

### Events

| Event | Payload | When Emitted |
|-------|---------|--------------|
| `connect` | `{ address, chain }` | Wallet connected |
| `disconnect` | `{ reason? }` | Wallet disconnected |
| `accountChanged` | `{ previousAddress, newAddress }` | User switched accounts |
| `chainChanged` | `{ previousChain, newChain }` | User switched networks |
| `error` | `{ code, message, details? }` | Error occurred |

---

## Privacy Extension

### PrivateWalletAdapter

Extends `WalletAdapter` with privacy features:

```typescript
interface PrivateWalletAdapter extends WalletAdapter {
  // Stealth Addresses
  supportsStealthAddresses(): boolean
  getStealthMetaAddress(): StealthMetaAddress
  deriveStealthAddress(ephemeralPubKey: HexString): StealthAddress
  checkStealthAddress(address: HexString, ephemeralPubKey: HexString): boolean
  scanStealthPayments(fromBlock?: bigint, toBlock?: bigint): Promise<StealthPayment[]>

  // Viewing Keys
  supportsViewingKeys(): boolean
  exportViewingKey(): ViewingKey

  // Shielded Operations
  supportsShieldedTransactions(): boolean
  getShieldedBalance(): Promise<bigint>
  shieldedSend(params: ShieldedSendParams): Promise<ShieldedSendResult>
}
```

### Feature Detection

Use capability methods to check support:

```typescript
if (wallet.supportsStealthAddresses()) {
  const meta = wallet.getStealthMetaAddress()
}

if (wallet.supportsViewingKeys()) {
  const viewingKey = wallet.exportViewingKey()
}
```

---

## Implementation

### BaseWalletAdapter

Abstract class providing common functionality:

```typescript
abstract class BaseWalletAdapter implements WalletAdapter {
  // Event emitter infrastructure
  protected emit<T extends WalletEvent>(event: T): void

  // State management helpers
  protected setConnected(address: string, publicKey: HexString): void
  protected setDisconnected(reason?: string): void
  protected setError(code: string, message: string): void

  // Validation
  protected requireConnected(): void

  // Must implement
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract signMessage(message: Uint8Array): Promise<Signature>
  abstract signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction>
  abstract signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt>
  abstract getBalance(): Promise<bigint>
  abstract getTokenBalance(asset: Asset): Promise<bigint>
}
```

### MockWalletAdapter

Testing adapter with configurable behavior:

```typescript
const wallet = new MockWalletAdapter({
  chain: 'solana',
  address: 'TestAddress123',
  balance: 1000000000n,
  shouldFailConnect: false,
  shouldFailSign: false,
})

await wallet.connect()
const balance = await wallet.getBalance() // 1000000000n

// Simulate events
wallet.simulateAccountChange('NewAddress')
wallet.setMockBalance(5000000000n)
```

---

## Wallet Registry

Central registry for wallet discovery:

```typescript
// Register a wallet
walletRegistry.register({
  info: {
    id: 'phantom',
    name: 'Phantom',
    chains: ['solana'],
    supportsPrivacy: false,
  },
  factory: () => new PhantomWalletAdapter(),
  detect: () => typeof window !== 'undefined' && 'phantom' in window,
})

// Discover available wallets
const available = walletRegistry.getAvailableWallets('solana')

// Create and connect
const wallet = await walletRegistry.connect('phantom')
```

### Registry Methods

| Method | Description |
|--------|-------------|
| `register(entry)` | Add wallet adapter |
| `unregister(id)` | Remove wallet adapter |
| `getAllWallets()` | Get all registered wallets |
| `getWalletsForChain(chain)` | Filter by chain |
| `getAvailableWallets(chain?)` | Get detected wallets |
| `getPrivacyWallets(chain?)` | Get privacy-capable wallets |
| `isAvailable(id)` | Check if wallet is detected |
| `create(id)` | Create adapter instance |
| `connect(id)` | Create and connect |

---

## Error Handling

### WalletError

```typescript
class WalletError extends SIPError {
  readonly walletCode: WalletErrorCodeType

  // Error type checks
  isConnectionError(): boolean
  isSigningError(): boolean
  isTransactionError(): boolean
  isPrivacyError(): boolean
  isUserRejection(): boolean
}
```

### Error Codes

| Code | Category | Description |
|------|----------|-------------|
| `WALLET_NOT_INSTALLED` | Connection | Wallet extension not found |
| `WALLET_CONNECTION_REJECTED` | Connection | User rejected connection |
| `WALLET_CONNECTION_FAILED` | Connection | Connection failed |
| `WALLET_NOT_CONNECTED` | Connection | Operation requires connection |
| `WALLET_SIGNING_REJECTED` | Signing | User rejected signing |
| `WALLET_SIGNING_FAILED` | Signing | Signing operation failed |
| `WALLET_INSUFFICIENT_FUNDS` | Transaction | Not enough balance |
| `WALLET_TRANSACTION_REJECTED` | Transaction | User rejected transaction |
| `WALLET_TRANSACTION_FAILED` | Transaction | Transaction failed |
| `WALLET_STEALTH_NOT_SUPPORTED` | Privacy | Stealth not supported |
| `WALLET_VIEWING_KEY_NOT_SUPPORTED` | Privacy | Viewing keys not supported |
| `WALLET_SHIELDED_NOT_SUPPORTED` | Privacy | Shielded transactions not supported |

---

## Usage Examples

### Basic Usage

```typescript
import { walletRegistry, MockWalletAdapter } from '@sip-protocol/sdk'

// Using mock adapter directly
const wallet = new MockWalletAdapter({ chain: 'solana' })
await wallet.connect()

// Sign a message
const signature = await wallet.signMessage(
  new TextEncoder().encode('Hello SIP')
)

// Check balance
const balance = await wallet.getBalance()
```

### Event Handling

```typescript
wallet.on('accountChanged', ({ previousAddress, newAddress }) => {
  console.log(`Account changed: ${previousAddress} → ${newAddress}`)
})

wallet.on('error', ({ code, message }) => {
  console.error(`Wallet error [${code}]: ${message}`)
})
```

### Privacy Features

```typescript
import { isPrivateWalletAdapter } from '@sip-protocol/sdk'

if (isPrivateWalletAdapter(wallet)) {
  // Get stealth meta-address for receiving
  const metaAddress = wallet.getStealthMetaAddress()

  // Scan for incoming payments
  const payments = await wallet.scanStealthPayments()

  // Export viewing key for compliance
  const viewingKey = wallet.exportViewingKey()
}
```

---

## Chain-Specific Adapters

Future chain-specific adapters will extend `BaseWalletAdapter`:

| Adapter | Chain | Issue |
|---------|-------|-------|
| `SolanaWalletAdapter` | Solana | #36 |
| `EthereumWalletAdapter` | Ethereum | #37 |

---

## Type Exports

From `@sip-protocol/types`:

```typescript
// Core types
export type WalletConnectionState
export type Signature
export type UnsignedTransaction
export type SignedTransaction
export type TransactionReceipt

// Events
export type WalletEventType
export type WalletEvent
export type WalletEventHandler

// Interfaces
export interface WalletAdapter
export interface PrivateWalletAdapter

// Registry
export interface WalletInfo
export type WalletAdapterFactory
export interface WalletRegistryEntry

// Error codes
export const WalletErrorCode
export type WalletErrorCodeType
```

From `@sip-protocol/sdk`:

```typescript
// Classes
export class BaseWalletAdapter
export class MockWalletAdapter
export class WalletError

// Registry
export const walletRegistry
export function registerWallet
export function isPrivateWalletAdapter

// Helpers
export function notConnectedError
export function featureNotSupportedError
```

---

## Test Coverage

- **53 tests** covering:
  - MockWalletAdapter (30 tests)
  - WalletRegistry (23 tests)
- All tests passing

---

## References

- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [Wallet Adapter Pattern](https://docs.walletconnect.com/2.0/web3wallet/about)
- [SIP Privacy Specification](./PRIVACY-LEVELS-SPEC.md)

---

*Document Status: IMPLEMENTED*
*Last Updated: November 27, 2025*
