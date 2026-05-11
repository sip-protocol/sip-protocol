# @sip-protocol/sns-stealth

SNS-based stealth address resolution and publishing for SIP Protocol.

Publish a `SIP-STEALTH` record on your `.sol` domain once. After that, any SIP-aware app can route private payments to you by name (`rector.sol`) instead of requiring senders to copy-paste a 140-character `sip:solana:<spending>:<viewing>` URI out of band.

See the design spec at `docs/superpowers/specs/2026-05-11-sip-sol-foundation-design.md`.

## Install

```bash
pnpm add @sip-protocol/sns-stealth
```

## Sender flow

Resolve a `.sol` domain to its stealth meta-address, then route a private payment to it.

```typescript
import { Connection } from '@solana/web3.js'
import {
  resolveSIPStealth,
  MetaAddress,
  NotFound,
  Malformed,
} from '@sip-protocol/sns-stealth'

const connection = new Connection('https://api.mainnet-beta.solana.com')

const result = await resolveSIPStealth(connection, 'rector.sol')

if (result instanceof MetaAddress) {
  // result.spending  — 32-byte ed25519 pubkey
  // result.viewing   — 32-byte ed25519 pubkey
  // result.chain     — 'solana'
  // result.domain    — 'rector.sol' (normalized)
  // Pass to your SIP stealth-payment flow.
} else if (result instanceof NotFound) {
  if (result.subject === 'domain') {
    // The .sol name itself does not exist on SNS.
    // Block: show "no such name" and stop.
  } else {
    // Domain exists, but the owner has not published a SIP-STEALTH record.
    // Warn + offer explicit public downgrade: [Send Public] / [Cancel].
  }
} else if (result instanceof Malformed) {
  // result.reason === 'json-parse'  — record exists but isn't valid JSON
  // result.reason === 'schema'      — record is JSON but fails v1 schema
  // Treat as a recoverable error and surface to the user.
}
```

## Receiver flow

Derive per-domain stealth keys, then publish them as a `SIP-STEALTH` record on your `.sol`.

```typescript
import { Connection } from '@solana/web3.js'
import { buildPublishTx, deriveStealthKeys } from '@sip-protocol/sns-stealth'

// `wallet` exposes signMessage + publicKey (matches @solana/wallet-adapter-base)
const connection = new Connection('https://api.mainnet-beta.solana.com')

const keys = await deriveStealthKeys(wallet, 'rector.sol')

const tx = await buildPublishTx(connection, 'rector.sol', {
  spending: keys.spending,
  viewing: keys.viewing,
}, wallet.publicKey)

await wallet.sendTransaction(tx, connection)
```

Keys are derived per-domain via HKDF-SHA256 over a wallet signature of `sip-stealth-v1:<normalized-domain>`. Same wallet + same domain → identical keys (deterministic, idempotent). Different domain → uncorrelatable keys.

Hold on to `keys.spendingPrivate` and `keys.viewingPrivate` — you will need them later to scan for and claim incoming payments.

## Cache

Resolution results are cached in-memory for 60 seconds per normalized domain, including negative results (`NotFound`, `Malformed`). To force a re-fetch:

```typescript
import { invalidateCache } from '@sip-protocol/sns-stealth'

invalidateCache('rector.sol')  // clear one domain
invalidateCache()               // clear all entries
```

## Record schema (v1)

The on-chain `SIP-STEALTH` record is canonical JSON:

```json
{"v":1,"spending":"<64-char lowercase hex>","viewing":"<64-char lowercase hex>"}
```

Strict validation rejects uppercase hex, wrong-length keys, missing `v`, or `v != 1`. The format is versioned for future forward-incompatible upgrades.

## Errors

```typescript
import {
  NotFound,        // discriminated: subject = 'domain' | 'record'
  Malformed,       // discriminated: reason = 'json-parse' | 'schema'
  NetworkError,    // wraps underlying RPC failure (thrown, not returned)
  UserRejected,    // wallet signature flow declined
  OnChainError,    // tx failed; exposes signature
} from '@sip-protocol/sns-stealth'
```

`NetworkError` is **thrown** from `resolveSIPStealth`. The other not-found/malformed variants are **returned** so callers can branch without try/catch.
