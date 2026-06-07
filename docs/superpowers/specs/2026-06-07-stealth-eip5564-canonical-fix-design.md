# Stealth Scheme — Canonical EIP-5564 Fix (Design)

**Date:** 2026-06-07
**Status:** Design — pending RECTOR sign-off on the open decision (§9)
**Tracking issue:** [sip-protocol#1099](https://github.com/sip-protocol/sip-protocol/issues/1099)
**Author:** CIPHER (investigation: stgrants_T3_12)

---

## 1. Problem

SIP's secp256k1 and ed25519 stealth implementations **swap the two EIP-5564 key roles**: the ECDH shared secret is built from the **spending** key and the one-time address is built on the **viewing** key — the inverse of canonical EIP-5564. The two curves agree with each other, so the send → self-claim path (wallet holds both private keys) works and is tested. But the swap makes **view-only scanning cryptographically impossible** (detection needs the spending private key), which silently breaks every "scan with the viewing key" surface and produces a false "view-only" security claim in the sip-mobile auditor UI.

**Verified (this investigation):**
- Proven with an 8/8 probe on both curves: correct full-wallet check detects; the scanners' `(viewingPriv, spendingPUB)` pattern never detects; an auditor with viewing-priv + publics cannot recover the spend key (so **no theft**).
- Mainnet exposure is negligible: the SIP Privacy program has ~151 lifetime txs, all Jan 31–Mar 8 2026, dormant ~3 months (deploy/test footprint, not adoption). EVM stealth is testnet-only. sip-mobile is not yet distributed. No production app implements receiving. → a fix can be a near-clean break.

**Broken surfaces:** SDK `scanForPayments` (`chains/solana/scan.ts:163`), `StealthScanner.subscribe` (`stealth-scanner.ts:521`), webhook provider (`providers/webhook.ts:649`), published `@sip-protocol/react` `useScanPayments`, and sip-mobile's auditor export + UI copy.
**Working surfaces (full-wallet, both privates):** core send→self-claim, `@sip-protocol/cli` scan, sip-mobile self-scan.

## 2. Goal

Make the SIP stealth scheme **canonical EIP-5564** on both curves so that view-only delegation works as advertised, all four broken scanners function with their existing interfaces, and the mobile auditor feature + its security copy become true — without orphaning any already-announced stealth funds.

## 3. The scheme: current vs. target

Let `(k_spend, K_spend)` = spending keypair, `(k_view, K_view)` = viewing keypair, `r`/`R = r·G` = ephemeral, `H` = SHA-256, `G` = generator.

| Step | CURRENT (swapped — to remove) | TARGET (canonical EIP-5564) |
|---|---|---|
| Sender shared secret | `S = r · K_spend` | `S = r · K_view` |
| One-time address | `P = K_view + H(S)·G` | `P = K_spend + H(S)·G` |
| Recipient shared secret | `S = k_spend · R` | `S = k_view · R` |
| Stealth private key (spend) | `p = k_view + H(S)` | `p = k_spend + H(S)` |
| **Scan / detect needs** | spending-priv (+ view) → **no view-only** | **viewing-priv + spending-PUB → view-only** ✓ |
| **Spend needs** | both privates | both privates |

The flip is mechanical: in generation swap `K_spend ↔ K_view`; in derivation swap which private key feeds the ECDH (`k_view`) vs the additive scalar (`k_spend`); rewrite `check` as a true view-only function.

## 4. Affected files (inventory)

**`@sip-protocol/sdk` (this repo) — core:**
- `packages/sdk/src/stealth/ed25519.ts` — `generate*StealthAddress`, `derive*StealthPrivateKey`, `check*StealthAddress`
- `packages/sdk/src/stealth/secp256k1.ts` — same three
- `packages/sdk/src/stealth/index.ts:151-195` — `deriveStealthPrivateKey` (unchanged sig) + `checkStealthAddress` (new view-only sig)
- `packages/sdk/src/chains/solana/scan.ts:163`, `stealth-scanner.ts:521`, `providers/webhook.ts:649` — already pass `(viewingPriv, spendingPub)`; become correct, but add version routing (§6)
- `packages/sdk/src/chains/solana/types.ts` — `createAnnouncementMemo` / `parseAnnouncement` version (`SIP:1`→`SIP:2`)
- `packages/sdk/src/chains/ethereum/*` — verify `schemeId`; secp256k1 crypto flips via the shared module
- Tests: `tests/chains/solana/scan.test.ts` (add e2e round-trip), `tests/crypto/stealth*.test.ts`, `tests/e2e/*stealth*`, `tests/e2e/solana/*`

**`@sip-protocol/react` (this repo):** `src/hooks/use-scan-payments.ts` — works once SDK is canonical; add a hook test asserting detection.

**`@sip-protocol/cli` (this repo):** `src/commands/scan.ts:95,113` — split check (view-only: `viewingPriv, spendingPub`) from derive (both privates).

**sip-mobile (separate repo, sibling plan):** `src/lib/stealth.ts:183-326` (own copy of the swapped crypto), auditor export `src/hooks/useViewingKeys.ts`, UI copy `app/settings/viewing-keys/index.tsx:653`. Currently on `@sip-protocol/sdk@^0.7.3` — bump after SDK ships.

**docs-sip (separate repo, sibling plan):** revert #109 crypto pages (crypto-assumptions, audit-checklist, security-properties) to canonical EIP-5564 descriptions.

## 5. API changes

| Function | Before | After |
|---|---|---|
| `checkStealthAddress` / `check{Ed25519,Secp256k1}StealthAddress` | `(addr, spendingPrivateKey, viewingPrivateKey)` → both privates | `(addr, viewingPrivateKey, spendingPublicKey)` → **view-only** |
| `deriveStealthPrivateKey` / `derive*` | `(addr, spendingPrivateKey, viewingPrivateKey)` | **unchanged** (both privates) |
| `generateStealthAddress` / `generate*` | `(metaAddress)` | **unchanged** (math flips internally) |

**Decision D2 (recommended): adopt the canonical view-only `checkStealthAddress` signature.** It is the EIP-5564-correct end state and is exactly what the scanners already pass. Cost: breaking change for `@sip-protocol/cli` + ~12 test files that call `check*` with `(spendingPriv, viewingPriv)`. SDK is pre-1.0 (0.9.0) → ship under a clear CHANGELOG + minor bump. The scanners need **no** call-site change.

## 6. Versioning & back-compat

- **Solana:** new canonical sends emit `SIP:2:<ephemeral>:<viewTag>:<stealth>`. The scanner reads the version: `SIP:2` → canonical scan (`viewing-priv + spending-pub`); `SIP:1` → legacy scan (the old swapped derivation, both privates). Claim derives with the convention matching the announcement version.
- **EVM:** announcements carry EIP-5564 `schemeId`. Canonical secp256k1 = `schemeId = 1`. Testnet-only → legacy testnet announcements are disposable; no migration path required (redeploy/retest).
- **Meta-address string** `sip:<chain>:<spendingKey>:<viewingKey>` is unchanged — the keys' *semantics* become correct; no re-encoding.

## 7. Test strategy (the gap that hid the bug)

1. **End-to-end scan round-trip** (was missing): generate a real announcement via the send path → `scanForPayments` → assert a positive detection + correct amount. One per curve / chain.
2. **View-only delegation test:** detection succeeds with `viewing-private + spending-public` only (no spending-private present), and `deriveStealthPrivateKey` still requires both. This is the property that was impossible before.
3. **Back-compat test (if D-open = keep):** a `SIP:1` announcement is still claimable via the legacy path; a `SIP:2` announcement via canonical.
4. Update all existing `check*` call sites in tests to the new signature.

## 8. Rollout / sequencing

1. **Plan 1 — SDK + react + cli (this repo).** The self-contained, testable core. Branch `fix/stealth-eip5564-canonical`, TDD, SDK suite green, CHANGELOG, version bump, publish.
2. **Plan 2 — sip-mobile.** Bump SDK dep, flip its own `stealth.ts`, verify self-scan + auditor import-scan now work with `viewing-priv + spending-pub`, correct the UI copy (now true).
3. **Plan 3 — docs-sip.** Revert #109 crypto pages to canonical; update #1099.
4. Close #1099 referencing the merged PRs.

## 9. Open decision (needs RECTOR)

**D-open — legacy `SIP:1` back-compat: keep a minimal v1 claim/scan path, or hard-cut?**
- **Keep (recommended):** ~2 extra tasks; any stealth funds ever announced under v1 stay claimable forever. Cheap insurance, given we can't fully enumerate memo-based sends.
- **Hard-cut:** simpler/smaller plan; justified because mainnet is dormant test-only and no production receive path exists. Risk: any real v1 funds become unclaimable via the SDK.

## 10. Risks

- **Breaking SDK API** (`check*` signature) — mitigated by CHANGELOG + pre-1.0 status + coordinated cli/test updates.
- **Two curves must flip together** with their scanners and tests, or round-trips break — mitigated by TDD task ordering (red e2e test first).
- **sip-mobile drift** — its vendored crypto must flip in lockstep with the SDK bump; sequence Plan 2 immediately after Plan 1 ships.
- **Non-enumerable v1 sends** — addressed by D-open=keep.
