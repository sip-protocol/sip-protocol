# sip.sol Foundation (F1+F2) — Design Spec

**Date:** 2026-05-11
**Status:** Draft
**Sub-project:** F1 + F2 of the Composite Flagship roadmap (7 sub-projects total)
**Predecessor:** Frontier April 2026 hackathon research (`~/Documents/secret/claude-strategy/sip-protocol/research/frontier-april-2026-analysis.html`)

## Overview

`sip.sol` is the codename for SIP Protocol's privacy *identity* layer on Solana. Today SIP is a privacy *transport* layer (stealth addresses, Pedersen commitments, viewing keys); `sip.sol` makes SIP also Solana's privacy *identity* layer by publishing stealth meta-addresses as Solana Name Service (SNS) records — turning a 140-character `sip:solana:<spending>:<viewing>` URI into a human-readable `rector.sol`.

This spec defines **F1 + F2**: the foundational sub-project that everything else in the composite flagship depends on. Other sub-projects (P1 MagicBlock PER backend, P2 Jupiter private swap with `.sol` destination, P3 sipher-mcp, P4 WDK plugin, D1–D3 distribution) get their own specs.

### One-line summary

A new `@sip-protocol/sns-stealth` package + integration into sip-app, sip-mobile, and sipher that lets any `.sol` owner publish a `SIP-STEALTH` SNS record once, after which any SIP-aware app can route private payments to them by name.

> Naming note: "sip.sol" is a codename for the pattern, not a domain SIP must own. The same `SIP-STEALTH` record works on every existing `.sol` (`rector.sol`, `sipher.sol`, `treasury.acme.sol`). Buying the literal `sip.sol` domain as a marquee identity is optional and orthogonal.

## Context

### Current state of SIP

- Stealth addresses encoded as URI: `sip:<chain>:<spendingKey>:<viewingKey>` (~140 chars).
- DKSAP derivation (ed25519 on Solana, secp256k1 elsewhere) in `packages/sdk/src/stealth.ts`.
- Pedersen commitments + viewing keys for compliance in `packages/sdk/src/crypto.ts` and `packages/sdk/src/privacy.ts`.
- `sip_privacy` mainnet program deployed at `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`.
- Production flows already shipped: send / receive / scan / claim, Jupiter private swap (mainnet-verified TX `3QCoHcJ...1NNg`), `sipher_vault` on devnet.
- User pain point: senders copy-paste 140-character URIs out of band before every payment.

### Solana Name Service (SNS)

- Originally Bonfida, now a standalone protocol — `.sol` domains as Solana account PDAs.
- SNS records v2 supports custom record keys (text values, ~few KB max).
- Standard records: `SOL`, `ETH`, `BTC`, `IPFS`, `email`, `discord`, `twitter`, `github`, `telegram`, etc.
- SDK: `@bonfida/spl-name-service` — ecosystem standard, already imported by sip-app.

### Strategic positioning

- SIP currently uses raw `sip:solana:...` URIs — works, but UX bottleneck.
- PrivacyCash (pool-based), Cloak (Groth16 UTXO pool), Umbra (Arcium MPC mixer) all lack identity layers — they're pool-based by construction.
- This is SIP's unique opportunity: **stealth + identity at the same layer.**
- Long-term: SNS-IP / SIP-IP standard proposal (sub-project D1) makes `SIP-STEALTH` a permanent ecosystem record key.

## Goals

1. Any `.sol` owner can enable SIP-aware private payments by signing **one** transaction.
2. Any SIP-aware app (sip-app, sip-mobile, sipher) can route private payments to a `.sol` recipient by name.
3. Any third-party Solana dApp can import `@sip-protocol/sns-stealth` and add the same capability.
4. Existing `sip:solana:...` URI format continues to work — `sip.sol` is **additive**, not replacement.
5. Per-domain stealth identities — multiple domains owned by the same wallet stay uncorrelatable.

## Non-goals (deferred to other sub-projects)

| Item                                       | Sub-project |
|--------------------------------------------|-------------|
| Multi-chain stealth records (`SIP-STEALTH-ETH`) | V2 / TBD   |
| Push-payment stealth escrow (fallback D)    | V2 / TBD   |
| Subdomain-scoped viewing keys              | V2 / TBD   |
| Capability fields (tokens, min amounts)    | V2 / TBD   |
| MagicBlock PER backend for `sipher_vault`  | P1         |
| sipher-mcp standalone package              | P3         |
| WDK plugin                                 | P4         |
| SNS-IP / SIP-IP standard proposal          | D1         |
| Content series (blog, tutorial, video)     | D2         |
| Wallet outreach (Phantom / Backpack / …)   | D3         |

## Design

### Architecture

```
                    @sip-protocol/sns-stealth   (NEW)
   ┌─────────────────────┬─────────────────────┬─────────────────────┐
   │     resolve.ts      │     publish.ts      │      derive.ts      │
   │                     │                     │                     │
   │  resolveSIPStealth  │   buildPublishTx    │   deriveStealthKeys │
   │  (domain)           │   (domain, keys)    │   (wallet, domain)  │
   │  -> MetaAddress|err │   -> Transaction    │   -> KeyPair        │
   └─────────────────────┴─────────────────────┴─────────────────────┘
                                  │
                  ┌───────────────▼────────────────┐
                  │  @bonfida/spl-name-service     │
                  │  (existing dep, SNS r/w)       │
                  └────────────────────────────────┘

                       Consumed by three existing apps
   ┌──────────────────┬──────────────────────┬──────────────────────┐
   │     sip-app      │     sip-mobile       │      sipher          │
   │   (Next.js 16)   │     (Expo 54)        │   (Express + Pi)     │
   │                  │                      │                      │
   │  /wallet/sip-    │  Settings >          │  agent tools:        │
   │  stealth         │  SIP-STEALTH         │  resolveSNS          │
   │  /payments/send  │  Send tab            │  sendPrivateToSNS    │
   └──────────────────┴──────────────────────┴──────────────────────┘
```

### Record format (V1)

**Record key:** `SIP-STEALTH` (uppercase, hyphen separator — matches SNS chain-record convention like `SOL`, `ETH`, `BTC`, `IPFS`).

**Value:** UTF-8 JSON string.

```json
{
  "v": 1,
  "spending": "<32-byte ed25519 pubkey, lowercase hex, no 0x prefix>",
  "viewing":  "<32-byte ed25519 pubkey, lowercase hex, no 0x prefix>"
}
```

**Encoding rules:**

- `v` is a JSON number, fixed at `1` for this spec.
- `spending` and `viewing` are 64-character lowercase hex strings (32 raw bytes each).
- Whitespace inside the JSON is implementation-defined but must round-trip through `JSON.parse`.
- Total record payload is ~95 bytes.

**Validation (Zod):**

```typescript
import { z } from 'zod'

const Hex32 = z.string().regex(/^[0-9a-f]{64}$/)

export const SIPStealthRecordV1 = z.object({
  v: z.literal(1),
  spending: Hex32,
  viewing:  Hex32,
})
export type SIPStealthRecord = z.infer<typeof SIPStealthRecordV1>
```

**Future schema versions** stay under the same record key `SIP-STEALTH` by bumping `v`. Multi-chain extension lives under separate keys (`SIP-STEALTH-ETH`, `SIP-STEALTH-BTC`).

### Key derivation (per-domain DKSAP)

Goal: deterministic from main wallet, **unique per `.sol` domain** Alice owns, no separate backup required.

**Algorithm:**

```typescript
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import { ed25519 } from '@noble/curves/ed25519'

async function deriveStealthKeys(
  wallet: Signer,
  domain: string,
): Promise<{ spending: KeyPair; viewing: KeyPair }> {
  // Normalize: lowercase, strip trailing dot
  const normalized = domain.toLowerCase().replace(/\.$/, '')
  const message = `sip-stealth-v1:${normalized}`
  const signature = await wallet.signMessage(new TextEncoder().encode(message))

  // HKDF-SHA256: hash, ikm, salt, info, length
  const spendingSeed = hkdf(sha256, signature, undefined, 'spending', 32)
  const viewingSeed  = hkdf(sha256, signature, undefined, 'viewing',  32)

  return {
    spending: ed25519.utils.getPublicKey(spendingSeed),
    viewing:  ed25519.utils.getPublicKey(viewingSeed),
  }
}
```

**HKDF parameters (fixed):** hash = SHA-256, IKM = wallet signature bytes, salt = empty, info = `'spending'` or `'viewing'` (UTF-8), output length = 32 bytes.

**Domain normalization:** all `.sol` inputs are lowercased and stripped of any trailing dot before signature input, SNS lookup, and cache key.

**Properties:**

- **Deterministic** — same wallet + same domain → same keys forever.
- **Per-domain** — different domain → different signature input → different keys → uncorrelatable identities.
- **Cross-device** — Alice signs on iPhone or laptop with same Phantom seed → same keys.
- **No new backup** — main wallet seed phrase is the only thing she needs to remember.

**Reserved salt strings:**

- `sip-stealth-v1:<domain>` — V1 derivation message (this spec).
- Future versions reserve `sip-stealth-v2:<domain>` etc.

### Publish flow

```
User                  sip-app                  sns-stealth                Bonfida SDK    Solana
 |                       |                          |                          |            |
 | "Enable Private"      |                          |                          |            |
 |---------------------->|                          |                          |            |
 |                       | deriveStealthKeys(...)   |                          |            |
 |                       |------------------------->|                          |            |
 |                       |                          | signMessage              |            |
 |                       |<-------------------------|  (sip-stealth-v1:domain) |            |
 | Phantom popup         |                          |                          |            |
 | [Approve]             |                          |                          |            |
 |---------------------->| signature                |                          |            |
 |                       |------------------------->| -> {spending, viewing}   |            |
 |                       |<-------------------------|                          |            |
 |                       | buildPublishTx(...)      |                          |            |
 |                       |------------------------->|                          |            |
 |                       |                          | setRecord('SIP-STEALTH', |            |
 |                       |                          |    JSON.stringify({...}))|            |
 |                       |                          |------------------------->|            |
 |                       |<---- tx ---------------------|                      |            |
 | Phantom popup [Send]  |                          |                          |            |
 |---------------------->| sendTransaction --------------------------------------------------->|
 |                       |<--- tx signature ---------------------------------------------------|
 | "Private payments     |                          |                          |            |
 |   enabled"            |                          |                          |            |
 |<----------------------|                          |                          |            |
```

### Resolve flow

```typescript
async function resolveSIPStealth(
  domain: string,
): Promise<MetaAddress | NotFound | Malformed> {
  // 1. Cache (60s TTL per domain)
  const cached = cache.get(domain)
  if (cached !== undefined) return cached

  // 2. Fetch SNS record
  let raw: string
  try {
    raw = await getRecord(connection, domain, 'SIP-STEALTH')
  } catch (e) {
    if (e instanceof DomainNotFoundError) return new NotFound('domain')
    if (e instanceof RecordNotFoundError) return new NotFound('record')
    throw e   // network / RPC errors bubble up
  }

  // 3. Parse + validate
  let parsed: unknown
  try { parsed = JSON.parse(raw) }
  catch { return new Malformed('json-parse') }

  const result = SIPStealthRecordV1.safeParse(parsed)
  if (!result.success) return new Malformed('schema', result.error)

  // 4. Build MetaAddress + cache
  const metaAddr = new MetaAddress({
    spending: hexToBytes(result.data.spending),
    viewing:  hexToBytes(result.data.viewing),
    chain:    'solana',
    domain,
  })
  cache.set(domain, metaAddr, 60_000)
  return metaAddr
}
```

### Fallback behavior (UI)

When the resolver returns `NotFound('record')` — domain exists but no `SIP-STEALTH` record:

```
+----------------------------------------------+
| Send Payment                                 |
|                                              |
| Recipient                                    |
| [ rector.sol                              ]  |
|                                              |
| ! Private payment not available.             |
|   rector.sol hasn't enabled SIP-STEALTH.     |
|                                              |
|   Send publicly to their wallet instead?     |
|                                              |
|   [ Send Public ]  [ Cancel ]                |
+----------------------------------------------+
```

Other error cases:

| Result                          | UI                                               |
|--------------------------------- |--------------------------------------------------|
| `NotFound('domain')`             | Block — "rector.sol not found"                   |
| `NotFound('record')`             | Warn + downgrade toast (above)                   |
| `Malformed('json-parse')`        | Block — "rector.sol's privacy record is invalid" |
| `Malformed('schema', e)`         | Block — "Unsupported privacy version (v=N)"      |
| Network / RPC error              | Block + retry button                             |

**Principle: never silently downgrade.** A public send always requires an explicit click.

### Caching

- Implementation: `Map<domain, { value: MetaAddress | NotFound, expiresAt: number }>`.
- TTL: 60 seconds per domain (initial guess — may tune during integration testing).
- Invalidation: `invalidateCache(domain)` exposed in SDK; called from the UI's manual refresh affordance.
- No persistent storage — in-memory only, lives for one app session.

### Backwards compatibility

Existing `sip:solana:<spending>:<viewing>` URI format remains supported. `sip.sol` is additive:

- UI recipient fields accept either format.
- `resolveSIPStealth` is invoked only when normalized input matches `/^[a-z0-9-]+(\.[a-z0-9-]+)*\.sol$/`. Input is lowercased + trailing-dot-stripped before regex match.
- Existing E2E flows (Send + Scan + Claim verified on Seeker — see `seeker-test-wallets.md`) unaffected.

**Migration path for current users:** users currently sharing `sip:solana:...` URIs can publish them to their `.sol` domain as a `SIP-STEALTH` record and start sharing `rector.sol` going forward. The publish UI offers a choice:

- **Use my existing SIP keys** — copies the keys from the user's current SIP setup. Best for users with active inbound payments.
- **Generate new per-domain keys** (default) — derives fresh keys via the algorithm above. Best for new users or those who want clean uncorrelatable identities.

## Integration plan

### `@sip-protocol/sns-stealth` (new monorepo package)

```
packages/sns-stealth/
├── src/
│   ├── resolve.ts          # resolveSIPStealth(domain)
│   ├── publish.ts          # buildPublishTx(domain, keys)
│   ├── derive.ts           # deriveStealthKeys(wallet, domain)
│   ├── schema.ts           # Zod schemas + types
│   ├── cache.ts            # in-memory cache
│   ├── errors.ts           # typed errors (NotFound, Malformed)
│   └── index.ts            # public API
├── tests/
│   ├── derive.test.ts
│   ├── schema.test.ts
│   ├── resolve.test.ts
│   ├── publish.test.ts
│   └── integration.test.ts
├── package.json            # @sip-protocol/sns-stealth v0.1.0
├── tsconfig.json
└── README.md
```

**Public API:**

```typescript
export {
  resolveSIPStealth,
  buildPublishTx,
  deriveStealthKeys,
  invalidateCache,
}
export { MetaAddress, NotFound, Malformed }
export { SIPStealthRecordV1 }
export type { SIPStealthRecord }
```

**Dependencies:**

- `@bonfida/spl-name-service` (existing across sip-app)
- `@noble/curves` (existing)
- `@noble/hashes` (existing)
- `zod` (existing across sip-app)

### sip-app integration

**New route:** `src/app/wallet/sip-stealth/page.tsx`

- Connect-wallet gate (existing Solana wallet adapter).
- Auto-detects `.sol` domains owned by the connected wallet via Bonfida reverse-lookup.
- Per-domain "Enable private payments" CTAs.
- Choice of existing-keys vs new-keys (see Backwards Compatibility).
- Calls `deriveStealthKeys` + `buildPublishTx` + wallet adapter send.
- Success / error UI states.

**Extended route:** `src/app/payments/send/page.tsx`

- Recipient input accepts:
  - Raw Solana address (existing).
  - `sip:solana:...` URI (existing).
  - `<domain>.sol` (**new** — calls `resolveSIPStealth`).
- Shows fallback toast (warn + downgrade) when `NotFound('record')`.
- Manual "Refresh" affordance to force re-resolve (covers the "I just published" case).

### sip-mobile integration

**New screen:** `app/(tabs)/settings/sip-stealth.tsx`

- Mirrors sip-app's `/wallet/sip-stealth` flow but native.
- Uses sip-mobile's existing key storage (SecureStore / Seed Vault) where applicable.

**Extended screen:** `app/(tabs)/send/index.tsx`

- Recipient input accepts `.sol` names.
- Fallback toast pattern matches sip-app.

### sipher integration

**New agent tools:** `packages/agent/src/tools/`

- `resolveSNS.ts` — wraps `resolveSIPStealth` for agent use; returns `MetaAddress` or typed error.
- `sendPrivateToSNS.ts` — composite: resolves SNS, derives one-time stealth, delegates to existing `send` tool.

**HERALD usage:**

User tweets `@sipher_xyz send 10 USDC to rector.sol privately`. HERALD calls `resolveSNS` → `sendPrivateToSNS`. SENTINEL preflight gate applies as for any other fund-moving tool.

## Testing strategy

### Unit (`packages/sns-stealth/tests/`)

- `derive.test.ts`
  - Same wallet + same domain → same keys (determinism).
  - Different domains → different keys (per-domain uniqueness).
  - Different wallets → different keys.
  - Signature mocked with fixed bytes for deterministic CI.
- `schema.test.ts`
  - Valid v1 records pass.
  - Missing `v`, wrong `v` value, malformed hex, wrong length all rejected.
  - Future-proofing: `v=2` payload rejected.
- `resolve.test.ts`
  - Cache hit returns cached value.
  - Cache miss triggers SNS lookup.
  - All four error branches (domain / record / json / schema) produce correct typed errors.
  - Network error bubbles up.
- `publish.test.ts`
  - Transaction structure matches Bonfida `setRecord` spec.
  - Record value JSON-encodes correctly.
  - Fee + compute budget within expected bounds.

### Integration

- vs SNS devnet using a SIP-owned test `.sol` domain (e.g. `test.sipher.sol`).
- Round-trip: publish → wait for confirmation → resolve → derive one-time stealth address.
- Cache invalidation: publish v2 → cache hit returns stale → invalidate → fetch fresh.

### E2E

- sip-app: publish on devnet test domain, resolve from a different browser session, complete send through existing mainnet `sip_privacy` flow.
- sip-mobile: same flow on Seeker hardware (per existing `seeker-test-wallets.md` patterns).
- sipher: agent test — Pi SDK invokes `resolveSNS` + `sendPrivateToSNS`, verify TX lands at the expected stealth address.

### Mainnet smoke

After devnet validation passes:

- Publish to one SIP-owned mainnet test `.sol`.
- Independent RPC confirms record readable.
- Resolve + private send + scan + claim cycle completes.
- TX signatures recorded for changelog / blog post draft.

## Error handling summary

| Scenario                                | Error type               | UI surface              |
|-----------------------------------------|--------------------------|--------------------------|
| Domain doesn't exist                    | `NotFound('domain')`     | Block + error message    |
| Domain exists, no `SIP-STEALTH` record  | `NotFound('record')`     | Warn + downgrade toast   |
| Record JSON unparseable                 | `Malformed('json-parse')` | Block + error            |
| Record schema invalid                   | `Malformed('schema', e)` | Block + error (with `v`) |
| RPC network error                       | `NetworkError`           | Block + retry button     |
| Wallet rejected sig request (publish)   | `UserRejected`           | Silent, return to idle   |
| TX failed on-chain (publish)            | `OnChainError`           | Show TX sig + retry      |

All errors are typed; consumers can `instanceof` or use discriminated unions. The package's public API never throws untyped exceptions.

## Open questions

1. **Existing-keys vs fresh-keys for migrating users.** Spec offers both in the publish UI; default = fresh per-domain keys. Confirm UX wording during implementation.
2. **Cache TTL.** 60s is the starting value. May need a shorter window for the first 5 minutes after a publish (Bonfida confirmation lag), or a "just published" hint. Decide during integration testing.
3. **Force-refresh UX.** Both sip-app and sip-mobile must expose a manual refresh affordance in the recipient field — design detail, not architectural.
4. **HKDF info parameter.** Spec uses `'spending'` and `'viewing'` as HKDF info strings; confirm collision-resistance with cryptography review before mainnet rollout.

## Acceptance criteria

F1+F2 is "shipped" when:

1. `@sip-protocol/sns-stealth@0.1.0` published to npm.
2. Package has ≥90% unit-test coverage and integration tests pass against SNS devnet.
3. sip-app's `/wallet/sip-stealth` route is live at `app.sip-protocol.org`.
4. sip-app's `/payments/send` accepts `<domain>.sol` and shows the fallback toast correctly.
5. sip-mobile's Settings publish flow + Send tab resolve flow shipped to internal TestFlight + APK.
6. sipher's `resolveSNS` + `sendPrivateToSNS` tools live in production.
7. One end-to-end mainnet payment from one `.sol` to another, documented with TX signatures and screenshots.
8. Outline draft of the D2 content post exists (full content post deferred to D2 sub-project).

## References

- Bonfida SPL Name Service: <https://github.com/SolanaNameService/sns-sdk>
- SNS records v2 docs: <https://docs.sns.id/collection/naming-service/records>
- Existing SIP DKSAP: `packages/sdk/src/stealth.ts`
- Existing SIP crypto: `packages/sdk/src/crypto.ts`, `packages/sdk/src/privacy.ts`
- Mainnet `sip_privacy` program: `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`
- Composite flagship decomposition: `.superpowers/brainstorm/91888-1778506430/content/decomposition.html`
- Frontier April 2026 hackathon research: `~/Documents/secret/claude-strategy/sip-protocol/research/frontier-april-2026-analysis.html`
