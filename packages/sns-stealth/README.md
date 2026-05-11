# @sip-protocol/sns-stealth

SNS-based stealth address resolution and publishing for SIP Protocol.

Publish a `SIP-STEALTH` record on your `.sol` domain → receive private payments by name. Any SIP-aware app can resolve `rector.sol` to a one-time stealth address.

See the design spec at `docs/superpowers/specs/2026-05-11-sip-sol-foundation-design.md`.

## Install

```bash
pnpm add @sip-protocol/sns-stealth
```

## Usage

```typescript
import { resolveSIPStealth, buildPublishTx, deriveStealthKeys } from '@sip-protocol/sns-stealth'

// Sender
const meta = await resolveSIPStealth(connection, 'rector.sol')
if (meta instanceof MetaAddress) { /* send privately */ }

// Receiver (one-time setup)
const keys = await deriveStealthKeys(wallet, 'rector.sol')
const tx = await buildPublishTx(connection, 'rector.sol', keys, wallet.publicKey)
await wallet.sendTransaction(tx)
```
