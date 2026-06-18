# Per-flow privacy-score primitives — design

**Date:** 2026-06-18
**Status:** Approved (design) → ready for implementation plan
**Scope:** `@sip-protocol/sdk` — new `flow-privacy/` module. Pure, additive. No on-chain or network code.

---

## 1. Context & motivation

The SDK already scores a **wallet's** surveillance exposure (`surveillance/scoring.ts → calculatePrivacyScore`, 0–100 over address reuse / clustering / exchange exposure / temporal / social). That answers *"how exposed is this address's history?"*

It does **not** answer the question an integrator needs at the moment of a commingling-vault cash-out: *"how private was **this specific flow** — this withdrawal to this stealth recipient, right now?"* The two are different objects (a wallet's whole history vs. a single settlement).

A flow through the current commingling vault has **genuinely mixed** privacy:

- **Stealth-address unlinkability** — strong, and volume-independent (the recipient is a one-time address).
- **Anonymity set by commingling** — depends entirely on *concurrent* same-asset, similar-amount activity, which is thin today.
- **Amount** — **plaintext on-chain** (`VaultWithdrawEvent.transfer_amount` is a `u64`); commingled, not cryptographically hidden.

The protocol's positioning rests on **not overclaiming** privacy. A per-flow assessment must therefore be *honest by construction*: it must surface the weak amount leg and the thin anonymity set rather than paper over them with a flattering single number. This module provides the primitives an integration layer (and UIs) can use to do that honestly.

This is roadmap item **B3** (per-flow privacy-score primitives), a Phase-1, audit-independent, dependency-free SDK addition.

## 2. Goals / non-goals

**Goals**
- Pure, unit-testable primitives that score a single vault flow from data the **caller already holds**.
- An output that carries **both** a numeric score (a UI gauge) **and** the honest factor breakdown + caveats, with the number **incapable of overclaiming** (tier-capped).
- Reuse the existing `PrivacyTier` ladder (`fees/privacy-tier.ts`) for the amount-hiding dimension — one source of truth, no redefinition.

**Non-goals (out of scope here)**
- **No on-chain fetching / RPC / event decoding.** The caller supplies the candidate window. (Rationale: the data integrity of the score depends on the completeness of that window, which the caller's own indexer owns authoritatively; a built-in log-scraping fetcher would add RPC coupling and inherit the host's broken Anchor-IDL event-decoder toolchain while being *equal-or-worse* in accuracy. A fetcher, if ever wanted, belongs to the higher integration layer that owns chain access.)
- No UI, no agent tool, no wallet-history scoring (that already exists in `surveillance/`).
- No new on-chain program behavior.

## 3. The three primitives

All pure, synchronous, side-effect-free. New module `packages/sdk/src/flow-privacy/`.

### 3.1 `anonSetInWindow(flow, candidates, opts) → AnonymitySet`
The anonymity set = the flows you **actually blend with**. A candidate counts only if it is:
1. **In the time window:** `|candidate.timestamp − flow.timestamp| ≤ windowSeconds`.
2. **Same asset:** `candidate.mint === flow.mint` (a USDC withdrawal does not hide a SOL withdrawal; native SOL uses the `Pubkey::default()` sentinel mint, compared as-is).
3. **Similar amount:** within the amount bucket — `min(a,b) / max(a,b) ≥ 1 − amountToleranceRatio` (a large withdrawal among dust is not hidden).
4. **Not self:** excluded by `signature` when present; otherwise an exact `(mint, amount, timestamp)` triple match is treated as self and excluded.

Returns `size` (after all filters), `sameMintCount` (same-mint, any amount — exposes how much the amount bucket pruned), the echoed `windowSeconds` / `amountToleranceRatio`, and `matched` (signatures of the blended flows, when supplied).

Defaults: `windowSeconds = 600` (10 min), `amountToleranceRatio = 0.5`.

### 3.2 `gaslessFlag(flow) → boolean`
Returns `flow.gasless`. Thin by design — named for symmetry and because "was the relayer the fee-payer?" is a first-class privacy factor (a self-paid cash-out links the gas-payer to the recipient; a gasless one does not). Kept as an exported accessor so callers and the composer reference one definition.

### 3.3 `amountHidingStatus(flow, tier?) → AmountHiding`
Maps the protocol tier the flow settled under onto an honest label. `tier` defaults to `CURRENT_PRIVACY_TIER` (TIER_1 today).

| `PrivacyTier` | `label` | `cryptographicallyHidden` |
|---|---|---|
| `TIER_1` | `visible-but-commingled` | `false` |
| `TIER_2` | `visible-but-unlinkable` | `false` |
| `TIER_3` | `cryptographically-hidden` | `true` |

Only `TIER_3` (confidential amounts / Pedersen) is cryptographically hidden. TIER_1/2 amounts are visible on-chain.

### 3.4 `assessFlowPrivacy(flow, candidates, opts) → FlowPrivacyAssessment`
The composer. Runs the three primitives, derives factor levels, computes the tier-capped score + band, and assembles caveats. This is the primary entry point; the three primitives remain individually exported for callers that want one piece.

## 4. Data types

```ts
import type { PrivacyTier } from '../fees/privacy-tier'

/** The flow being scored — derived from VaultWithdrawEvent + how the tx was submitted. */
export interface FlowInput {
  mint: string                 // base58; native SOL = Pubkey::default() sentinel
  transferAmount: bigint       // plaintext base units (VaultWithdrawEvent.transfer_amount)
  timestamp: number            // unix seconds (VaultWithdrawEvent.timestamp)
  gasless: boolean             // was the relayer the fee-payer? (gasless cash-out)
  stealthRecipient?: string    // optional context
  signature?: string           // optional — used to exclude self from candidates
}

/** A candidate withdrawal in the window — the subset of VaultWithdrawEvent the caller indexes. */
export interface WindowWithdrawal {
  mint: string
  transferAmount: bigint
  timestamp: number
  signature?: string
}

export interface AnonSetOptions {
  windowSeconds?: number       // default 600
  amountToleranceRatio?: number // default 0.5; (0, 1]
}

export interface AnonymitySet {
  size: number                 // same-mint AND similar-amount in window, self excluded
  sameMintCount: number        // same-mint, any amount (pre amount-bucket)
  windowSeconds: number
  amountToleranceRatio: number
  matched: string[]            // signatures of blended flows (when supplied)
}

export type PrivacyBand = 'limited' | 'moderate' | 'strong'
export type FactorLevel = 'weak' | 'moderate' | 'strong'

export interface AmountHiding {
  tier: PrivacyTier
  label: string                // 'visible-but-commingled' | 'visible-but-unlinkable' | 'cryptographically-hidden'
  cryptographicallyHidden: boolean
}

export interface FlowPrivacyAssessment {
  score: number                // 0–100, tier-capped
  band: PrivacyBand
  anonymitySet: AnonymitySet
  gasless: boolean
  amountHiding: AmountHiding
  factors: {
    anonymity: FactorLevel
    linkability: FactorLevel
    amount: FactorLevel
  }
  caveats: string[]
}

export interface AssessFlowOptions extends AnonSetOptions {
  tier?: PrivacyTier           // defaults to CURRENT_PRIVACY_TIER
}
```

## 5. Scoring model

Three factor levels → weighted 0–100 → **tier cap** so the number cannot overclaim.

**Factor levels**
- **anonymity** (from `AnonymitySet.size`): `0–2 → weak`, `3–9 → moderate`, `≥10 → strong`.
- **linkability** (gasless + the recipient is always a one-time stealth address): `gasless → strong`, `self-paid gas → moderate`.
- **amount**: `TIER_3 → strong`, else `weak` (plaintext on-chain at TIER_1/TIER_2).

**Raw score** — factor points `weak=0, moderate=0.5, strong=1`:
```
raw = 100 · (0.40·anonymity + 0.30·linkability + 0.30·amount)
```

**Tier cap** (the honesty guarantee):
```
TIER_1 → min(raw, 59)
TIER_2 → min(raw, 84)
TIER_3 → raw            // ≤ 100
```

**Band** from the capped score: `< 40 → limited`, `40–69 → moderate`, `≥ 70 → strong`.

**Net effect:** a current-vault (TIER_1) flow tops out at **moderate** no matter how large the crowd, because amounts are visible and the graph is commingled-not-broken. `strong` is unreachable until TIER_2/TIER_3 ship. The number is structurally honest.

All thresholds, weights, and caps live in named, exported, documented constants (`flow-privacy/constants.ts` or top of `assess.ts`) so they are auditable and tunable in one place — not magic numbers scattered through the logic.

## 6. Caveats

Generated from the factors; always honest, never silent. Emit when applicable:

- **amount visible** (whenever `amountHiding.cryptographicallyHidden === false`): e.g. *"Withdrawal amount (N) is visible on-chain — commingled, not cryptographically hidden."*
- **thin anonymity set** (when `anonymity` is below `strong`): *"Anonymity set is K similar-amount same-asset withdrawals in an M-minute window; small sets are correlatable."*
- **self-paid gas** (when not gasless): *"Cash-out paid its own gas — the fee-payer is linkable to the recipient. A gasless relayer removes this link."*

Caveat text is generic and integrator-agnostic.

## 7. Validation & errors

Validate at the boundary (SDK convention), throwing actionable `SipError`-style errors:
- `flow.timestamp` finite; `flow.transferAmount` a non-negative `bigint`; `flow.mint` non-empty.
- Each candidate: finite `timestamp`, non-negative `bigint` amount, non-empty `mint`.
- `windowSeconds > 0`; `0 < amountToleranceRatio ≤ 1`.
- `tier` (when supplied) a valid `PrivacyTier`.

Self-exclusion: by `signature` when present; else the exact `(mint, amount, timestamp)` triple is treated as self. (Edge case: an unrelated candidate that happens to match the triple exactly and has no signature is excluded — acceptably conservative, since it would understate, not overstate, the set.)

## 8. Module layout & exports

```
packages/sdk/src/flow-privacy/
  types.ts        # all interfaces/enums above
  constants.ts    # window/tolerance defaults, factor thresholds, weights, tier caps, band cutoffs, labels
  anon-set.ts     # anonSetInWindow
  factors.ts      # gaslessFlag, amountHidingStatus, factor-level derivations
  assess.ts       # assessFlowPrivacy (composer + scoring)
  index.ts        # barrel
```

Exported through the **main SDK barrel** (`packages/sdk/src/index.ts`) only — **not** a dedicated `package.json` `exports` subpath. (Lesson from B4: a subpath claimed in docs but absent from `package.json` `exports` is a CI-invisible breakage because barrel tests import the source path. Root barrel only, unless a subpath is added to `exports` deliberately.)

## 9. Testing strategy

Pure unit tests (Vitest), table-driven, no network:
- empty candidates → `size 0`, `band 'limited'`;
- mint filter excludes other assets; native-SOL sentinel mint matches only native SOL;
- amount bucket excludes dust and whales at the tolerance edge (boundary: exactly at `1 − tolerance`);
- window boundary (candidate exactly at `±windowSeconds`);
- self-exclusion by signature, and by triple when no signature;
- tier cap holds — a TIER_1 flow with a huge set + gasless still scores `≤ 59` / `band ≤ moderate`; TIER_3 can reach `strong`;
- `gasless` toggles the linkability factor and the corresponding caveat;
- caveats present exactly when their condition holds;
- validation throws on each bad input with an actionable message.

Target the SDK's 80%+ coverage bar on new code. Implementation follows TDD (tests first, red → green), per-unit and final whole-branch review.

## 10. Future (explicitly out of scope)

- A higher-layer fetcher that gathers the candidate window from chain (belongs to the integration client that owns RPC + an indexer/event-decoder).
- Surfacing the assessment through an agent tool or UI gauge.
- Re-tuning thresholds once real concurrent-volume data exists (the constants are built to be tuned).
