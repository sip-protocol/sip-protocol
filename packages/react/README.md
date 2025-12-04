# @sip-protocol/react

React hooks for [Shielded Intents Protocol](https://sip-protocol.org).

## Installation

```bash
npm install @sip-protocol/react @sip-protocol/sdk
# or
pnpm add @sip-protocol/react @sip-protocol/sdk
```

## Quick Start

Wrap your app with `SIPProvider`:

```tsx
import { SIPProvider } from '@sip-protocol/react'

function App() {
  return (
    <SIPProvider config={{ network: 'testnet' }}>
      <YourApp />
    </SIPProvider>
  )
}
```

Use hooks in your components:

```tsx
import { useSIP } from '@sip-protocol/react'

function MyComponent() {
  const sip = useSIP()

  const handleCreateIntent = async () => {
    const intent = await sip.createShieldedIntent({
      from: { chain: 'ethereum', token: 'ETH', amount: '1.0' },
      to: { chain: 'solana', token: 'SOL' },
      privacyLevel: 'shielded'
    })
  }

  return <button onClick={handleCreateIntent}>Create Private Swap</button>
}
```

## Available Hooks

### `useSIP()`

Access the SIP client instance directly.

```tsx
const sip = useSIP()
```

### `useStealthAddress(chain)`

Generate and manage stealth addresses for privacy-preserving transactions.

```tsx
const {
  metaAddress,
  stealthAddress,
  isGenerating,
  regenerate,
  copyToClipboard,
} = useStealthAddress('ethereum')

return (
  <div>
    <p>Share this: {metaAddress}</p>
    <p>One-time address: {stealthAddress}</p>
    <button onClick={regenerate}>Generate New</button>
    <button onClick={copyToClipboard}>Copy</button>
  </div>
)
```

### `usePrivateSwap()`

Execute private swaps with shielded intents.

```tsx
const { quote, fetchQuote, swap, status, isLoading, error, reset } = usePrivateSwap()

// Fetch a quote
await fetchQuote({
  inputChain: 'solana',
  outputChain: 'ethereum',
  inputToken: 'SOL',
  outputToken: 'ETH',
  inputAmount: '1000000000',
})

// Execute swap
const result = await swap({
  input: { chain: 'solana', token: 'SOL', amount: 1000000000n },
  output: { chain: 'ethereum', token: 'ETH', minAmount: 0n },
  privacyLevel: PrivacyLevel.SHIELDED,
})
```

### `useViewingKey()`

Generate and manage viewing keys for compliance.

```tsx
const { viewingKey, sharedWith, generate, decrypt, share } = useViewingKey()

// Generate a viewing key
const key = generate()

// Share with auditor
await share('auditor-123')

// Decrypt transaction for auditing
const decrypted = await decrypt(encryptedTransaction)
```

## Configuration

The `SIPProvider` accepts the same configuration as the core SDK:

```tsx
<SIPProvider
  config={{
    network: 'mainnet',
    mode: 'production',
    defaultPrivacy: PrivacyLevel.SHIELDED,
    proofProvider: new MockProofProvider(),
    intentsAdapter: {
      jwtToken: process.env.NEAR_INTENTS_JWT
    }
  }}
>
  <App />
</SIPProvider>
```

See [@sip-protocol/sdk](https://github.com/sip-protocol/sip-protocol/tree/main/packages/sdk) for full configuration options.

## Development Status

This package is production-ready with full hook implementations:

- [x] Provider setup
- [x] `useSIP()` hook
- [x] `useStealthAddress()` hook (secp256k1 & ed25519 support)
- [x] `usePrivateSwap()` hook (full swap lifecycle)
- [x] `useViewingKey()` hook (compliance-ready)
- [x] Comprehensive test suite (57 tests)

## Documentation

- [Full Documentation](https://docs.sip-protocol.org)
- [SDK Reference](https://docs.sip-protocol.org/sdk)
- [Examples](https://github.com/sip-protocol/sip-protocol/tree/main/examples)

## License

MIT
