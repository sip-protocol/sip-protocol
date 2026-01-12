# Wallet Integration Example

Connect to real wallets (Phantom, MetaMask, Ledger) and sign transactions with SIP Protocol.

## What This Example Demonstrates

1. **Solana Wallet** - Connect to Phantom or other Solana wallets
2. **Ethereum Wallet** - Connect to MetaMask or other EIP-1193 providers
3. **Hardware Wallet** - Connect to Ledger via WebUSB/WebHID
4. **Sign Transactions** - Sign shielded intents with connected wallets

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Browser with wallet extensions (Phantom, MetaMask) for browser examples
- Ledger device for hardware wallet example

## Quick Start

```bash
# Install dependencies
pnpm install

# Run mock wallet example (no real wallet needed)
npx ts-node index.ts

# Run with Phantom (browser required)
npx ts-node phantom-example.ts

# Run with MetaMask (browser required)
npx ts-node metamask-example.ts

# Run with Ledger (device required)
npx ts-node ledger-example.ts
```

## Wallet Adapters Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION                                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ SIP Protocol SDK                                            │ │
│  │                                                              │ │
│  │  createShieldedIntent()                                     │ │
│  │  sip.execute(intent, quote, { wallet })                     │ │
│  │                                                              │ │
│  └────────────────────────┬────────────────────────────────────┘ │
│                           │                                       │
│                           ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ WalletAdapter Interface                                     │ │
│  │                                                              │ │
│  │  connect() / disconnect()                                   │ │
│  │  getAddress() / getPublicKey()                              │ │
│  │  signMessage() / signTransaction()                          │ │
│  │                                                              │ │
│  └────────────────────────┬────────────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Solana       │   │ Ethereum     │   │ Hardware     │
│ Adapter      │   │ Adapter      │   │ Adapter      │
│              │   │              │   │              │
│ • Phantom    │   │ • MetaMask   │   │ • Ledger     │
│ • Solflare   │   │ • WalletConn │   │ • Trezor     │
│ • Backpack   │   │ • Rainbow    │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

## Wallet Adapter API

All wallet adapters implement the same interface:

```typescript
interface WalletAdapter {
  // Connection
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean

  // Account info
  getAddress(): Promise<string>
  getPublicKey(): Promise<HexString>
  getChain(): ChainId

  // Signing
  signMessage(message: Uint8Array): Promise<Signature>
  signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction>

  // Events
  on(event: WalletEventType, handler: WalletEventHandler): void
  off(event: WalletEventType, handler: WalletEventHandler): void
}
```

## Solana Wallet (Phantom)

### Browser Setup

```typescript
import { createSolanaAdapter, getSolanaProvider } from '@sip-protocol/sdk'

// Detect available Solana wallets
const provider = getSolanaProvider()

if (!provider) {
  console.log('Please install Phantom wallet')
}

// Create adapter
const wallet = createSolanaAdapter({
  providerName: 'Phantom',
  cluster: 'mainnet-beta',
})
```

### Connect and Sign

```typescript
// Connect to wallet
await wallet.connect()

console.log(`Connected: ${await wallet.getAddress()}`)

// Sign a message
const message = new TextEncoder().encode('Sign this to prove ownership')
const signature = await wallet.signMessage(message)

console.log(`Signature: ${signature}`)
```

### Full Integration

```typescript
import { SIP, createSolanaAdapter } from '@sip-protocol/sdk'

const wallet = createSolanaAdapter({ providerName: 'Phantom' })
await wallet.connect()

const sip = new SIP({ network: 'mainnet' })

// Create and execute shielded swap
const intent = await sip.createIntent({
  input: { chain: 'solana', token: 'SOL', amount: 1_000_000_000n },
  output: { chain: 'ethereum', token: 'ETH' },
  privacy: 'shielded',
})

const quotes = await sip.getQuotes(intent)
const result = await sip.execute(intent, quotes[0], { wallet })
```

## Ethereum Wallet (MetaMask)

### Browser Setup

```typescript
import { createEthereumAdapter, getEthereumProvider } from '@sip-protocol/sdk'

// Detect MetaMask
const provider = getEthereumProvider()

if (!provider) {
  console.log('Please install MetaMask')
}

// Create adapter
const wallet = createEthereumAdapter({
  providerName: 'MetaMask',
  chainId: 1, // Ethereum mainnet
})
```

### Connect and Sign

```typescript
// Connect to wallet
await wallet.connect()

console.log(`Connected: ${await wallet.getAddress()}`)

// Sign typed data (EIP-712)
const typedData = {
  domain: { name: 'SIP Protocol', version: '1', chainId: 1 },
  types: {
    Intent: [
      { name: 'id', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  value: {
    id: 'sip-intent-123',
    amount: 1000000000000000000n,
  },
}

const signature = await wallet.signTypedData(typedData)
```

### Chain Switching

```typescript
// Switch to Polygon
await wallet.switchChain(137)

// Add custom network
await wallet.addChain({
  chainId: 42161,
  chainName: 'Arbitrum One',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://arb1.arbitrum.io/rpc'],
})
```

## Hardware Wallet (Ledger)

### Setup

```typescript
import {
  createLedgerAdapter,
  supportsWebUSB,
  getAvailableTransports,
} from '@sip-protocol/sdk'

// Check browser support
const transports = getAvailableTransports()
console.log('Available transports:', transports)

if (!supportsWebUSB()) {
  console.log('WebUSB not supported, try WebHID')
}

// Create adapter
const wallet = createLedgerAdapter({
  transport: 'webusb', // or 'webhid'
  chain: 'ethereum',
  derivationPath: "m/44'/60'/0'/0/0",
})
```

### Connect and Sign

```typescript
// Connect to Ledger
console.log('Please connect your Ledger and open the Ethereum app...')
await wallet.connect()

console.log(`Connected: ${await wallet.getAddress()}`)

// Sign transaction (requires user confirmation on device)
const tx = {
  to: '0x...',
  value: 1000000000000000000n,
  gasLimit: 21000n,
}

console.log('Please confirm on your Ledger device...')
const signedTx = await wallet.signTransaction(tx)
```

### Multiple Accounts

```typescript
// Get accounts at different derivation paths
const accounts = await wallet.getAccounts(5) // First 5 accounts

for (const account of accounts) {
  console.log(`${account.path}: ${account.address}`)
}

// Switch to different account
await wallet.setAccountIndex(2)
```

## Event Handling

```typescript
// Listen for wallet events
wallet.on('connect', (event) => {
  console.log('Connected:', event.address)
})

wallet.on('disconnect', () => {
  console.log('Disconnected')
})

wallet.on('accountChanged', (event) => {
  console.log('Account changed:', event.address)
})

wallet.on('chainChanged', (event) => {
  console.log('Chain changed:', event.chainId)
})

wallet.on('error', (event) => {
  console.error('Wallet error:', event.error.message)
})
```

## Mock Wallets for Testing

```typescript
import {
  createMockSolanaAdapter,
  createMockEthereumAdapter,
  createMockLedgerAdapter,
} from '@sip-protocol/sdk'

// Create mock Solana wallet
const mockSolana = createMockSolanaAdapter({
  address: 'So11111111111111111111111111111111111111112',
  autoConnect: true,
})

// Create mock Ethereum wallet
const mockEth = createMockEthereumAdapter({
  address: '0x1234567890abcdef1234567890abcdef12345678',
  chainId: 1,
})

// Create mock Ledger
const mockLedger = createMockLedgerAdapter({
  model: 'Nano X',
  chain: 'ethereum',
})
```

## Security Best Practices

1. **Verify addresses** - Always display full address for user verification
2. **Clear signing** - Show exactly what user is signing
3. **Hardware wallets** - Recommend for large transactions
4. **Domain verification** - Check window.location in browser
5. **Error handling** - Handle user rejection gracefully

## Error Handling

```typescript
import { WalletError, WalletErrorCode } from '@sip-protocol/sdk'

try {
  await wallet.connect()
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.code) {
      case WalletErrorCode.NOT_INSTALLED:
        console.log('Please install the wallet extension')
        break
      case WalletErrorCode.USER_REJECTED:
        console.log('Connection rejected by user')
        break
      case WalletErrorCode.ALREADY_CONNECTED:
        console.log('Already connected')
        break
      case WalletErrorCode.CHAIN_NOT_SUPPORTED:
        console.log('Chain not supported')
        break
    }
  }
}
```

## Next Steps

- See `examples/private-payment/` for stealth address basics
- See `examples/private-swap/` for cross-chain swaps
- See `examples/compliance/` for viewing keys and auditing
