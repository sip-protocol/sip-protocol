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

### `useStealthAddress()` (stub)

Generate and manage stealth addresses. Full implementation coming soon.

```tsx
const { generate, parse, isValid } = useStealthAddress()
```

### `usePrivateSwap()` (stub)

Execute private swaps with shielded intents. Full implementation coming soon.

```tsx
const { execute, status, error } = usePrivateSwap()
```

### `useViewingKey()` (stub)

Generate and manage viewing keys for compliance. Full implementation coming soon.

```tsx
const { generate, decrypt, share } = useViewingKey()
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

This package is under active development:

- [x] Provider setup
- [x] `useSIP()` hook
- [ ] `useStealthAddress()` implementation
- [ ] `usePrivateSwap()` implementation
- [ ] `useViewingKey()` implementation
- [ ] Additional utility hooks

## Documentation

- [Full Documentation](https://docs.sip-protocol.org)
- [SDK Reference](https://docs.sip-protocol.org/sdk)
- [Examples](https://github.com/sip-protocol/sip-protocol/tree/main/examples)

## License

MIT
