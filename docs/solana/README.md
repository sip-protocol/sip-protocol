# Solana Privacy Documentation

Developer documentation for SIP Protocol on Solana.

## Quick Links

| Document | Description |
|----------|-------------|
| [Quickstart](./quickstart.md) | Get started in 5 minutes |
| [Architecture](./architecture.md) | How it works under the hood |
| [API Reference](./api-reference.md) | Full SDK documentation |
| [Integration Guide](./integration-guide.md) | Add privacy to your dApp |
| [Security](./security.md) | Security best practices |

## Examples

| Example | Description |
|---------|-------------|
| [Basic Transfer](./examples/basic-transfer.md) | Send private SOL payment |
| [Private Swap](./examples/private-swap.md) | Jupiter DEX with privacy |
| [Compliance](./examples/compliance.md) | Viewing key disclosure |

## Installation

```bash
npm install @sip-protocol/sdk
```

## Quick Example

```typescript
import { shieldedTransfer } from '@sip-protocol/sdk'

const result = await shieldedTransfer({
  connection,
  sender: wallet.publicKey,
  recipient: 'sip:solana:0x02abc...:0x03def...',
  amount: 1_000_000_000n, // 1 SOL
  signTransaction: wallet.signTransaction,
})

console.log('Private transfer:', result.signature)
```

## Resources

- **GitHub**: https://github.com/sip-protocol/sip-protocol
- **NPM**: https://npmjs.com/package/@sip-protocol/sdk
- **Website**: https://sip-protocol.org
- **Docs**: https://docs.sip-protocol.org
