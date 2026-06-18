# Per-flow Privacy-Score Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure SDK primitives that honestly score a single commingling-vault flow's privacy (anonymity set, gasless, amount-hiding) into a tier-capped 0–100 score + factor/caveat breakdown.

**Architecture:** A new `packages/sdk/src/flow-privacy/` module of pure, synchronous functions over caller-supplied data — no RPC, no event decoding. Three primitives (`anonSetInWindow`, `gaslessFlag`, `amountHidingStatus`) plus a composer (`assessFlowPrivacy`). Reuses the B4 `PrivacyTier` ladder for the amount-hiding dimension. Tier caps make the numeric score structurally incapable of overclaiming.

**Tech Stack:** TypeScript (strict), Vitest, `@sip-protocol/sdk` monorepo package, pnpm + changesets.

## Global Constraints

_Every task's requirements implicitly include this section._

- **Style:** 2-space indent, **no semicolons**, explicit types on public APIs, JSDoc on every exported function/type. Match `packages/sdk/src/fees/privacy-tier.ts`.
- **Purity:** additive only; no network/RPC/filesystem; no new dependencies; no on-chain program changes.
- **Reuse:** import `PrivacyTier` / `CURRENT_PRIVACY_TIER` from `../fees/privacy-tier` — never redefine the tier ladder.
- **Validation:** every public function validates its inputs at the boundary, throwing `ValidationError` from `../errors` (`new ValidationError(message, field)`).
- **Exports:** main SDK barrel (`packages/sdk/src/index.ts`) only — **no** `package.json` `exports` subpath (a subpath absent from `exports` is a CI-invisible break).
- **Naming gate (public repo):** generic only — no partner or competitor names. Before pushing, run the project's confidential naming-gate regex (kept in the private session handoff, never in-repo) against the diff; it must be clean. Use "integrator", "commingling vault", "stealth recipient".
- **Commits:** GPG-signed (`-S`), conventional, **no AI attribution** (no `Co-Authored-By`, no `Generated with`).
- **Changeset:** one `minor` changeset for `@sip-protocol/sdk` (new public API) — publishes the next SDK minor on merge.
- **Coverage:** 80%+ on new code. TDD: failing test first, then minimal implementation.
- **Run commands** (from the worktree root `/.../feat+flow-privacy-score`):
  - one test file: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/<file>`
  - typecheck: `pnpm --filter @sip-protocol/sdk typecheck`

## File Structure

```
packages/sdk/src/flow-privacy/
  types.ts        # FULL data model (all interfaces/enums) — created once in Task 1
  constants.ts    # tunable constants — grows across Tasks 1–3
  validate.ts     # boundary validators — grows across Tasks 1–2
  anon-set.ts     # anonSetInWindow                                  (Task 1)
  factors.ts      # gaslessFlag, amountHidingStatus, factor levels   (Task 2)
  assess.ts       # assessFlowPrivacy composer (scoring + caveats)   (Task 3)
  index.ts        # module barrel                                    (Task 4)
packages/sdk/tests/flow-privacy/
  anon-set.test.ts   (Task 1)
  factors.test.ts    (Task 2)
  assess.test.ts     (Task 3)
  exports.test.ts    (Task 4)
packages/sdk/src/index.ts   # main barrel — modified in Task 4
.changeset/flow-privacy-primitives.md   # Task 4
```

---

### Task 1: `anonSetInWindow` + data model + validators

**Files:**
- Create: `packages/sdk/src/flow-privacy/types.ts`
- Create: `packages/sdk/src/flow-privacy/constants.ts`
- Create: `packages/sdk/src/flow-privacy/validate.ts`
- Create: `packages/sdk/src/flow-privacy/anon-set.ts`
- Test: `packages/sdk/tests/flow-privacy/anon-set.test.ts`

**Interfaces:**
- Consumes: `PrivacyTier` from `../fees/privacy-tier`; `ValidationError` from `../errors`.
- Produces:
  - `anonSetInWindow(flow: FlowInput, candidates: WindowWithdrawal[], opts?: AnonSetOptions): AnonymitySet`
  - the full type set in `types.ts` (`FlowInput`, `WindowWithdrawal`, `AnonSetOptions`, `AnonymitySet`, `PrivacyBand`, `FactorLevel`, `AmountHiding`, `FlowPrivacyAssessment`, `AssessFlowOptions`)
  - validators `validateFlowInput`, `validateWindowWithdrawals`, `validateAnonSetOptions`
  - constants `DEFAULT_WINDOW_SECONDS = 600`, `DEFAULT_AMOUNT_TOLERANCE_RATIO = 0.5`

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/tests/flow-privacy/anon-set.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { anonSetInWindow } from '../../src/flow-privacy/anon-set'
import type { FlowInput, WindowWithdrawal } from '../../src/flow-privacy/types'

const SOL = '11111111111111111111111111111111'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

const flow: FlowInput = {
  mint: SOL,
  transferAmount: 5_000_000_000n, // 5 SOL
  timestamp: 1_000_000,
  gasless: true,
  signature: 'SELF',
}

function w(over: Partial<WindowWithdrawal>): WindowWithdrawal {
  return { mint: SOL, transferAmount: 5_000_000_000n, timestamp: 1_000_000, signature: 'x', ...over }
}

describe('anonSetInWindow', () => {
  it('returns size 0 with no candidates', () => {
    const set = anonSetInWindow(flow, [])
    expect(set.size).toBe(0)
    expect(set.sameMintCount).toBe(0)
    expect(set.windowSeconds).toBe(600)
    expect(set.amountToleranceRatio).toBe(0.5)
    expect(set.matched).toEqual([])
  })

  it('counts only same-mint withdrawals (USDC does not hide SOL)', () => {
    const set = anonSetInWindow(flow, [
      w({ signature: 'a' }),
      w({ mint: USDC, signature: 'b' }),
    ])
    expect(set.sameMintCount).toBe(1)
    expect(set.size).toBe(1)
    expect(set.matched).toEqual(['a'])
  })

  it('excludes candidates outside the time window', () => {
    const inWin = w({ timestamp: 1_000_000 + 600, signature: 'in' })
    const outWin = w({ timestamp: 1_000_000 + 601, signature: 'out' })
    const set = anonSetInWindow(flow, [inWin, outWin])
    expect(set.size).toBe(1)
    expect(set.matched).toEqual(['in'])
  })

  it('applies the amount bucket: [2.5, 10] SOL at tolerance 0.5 for a 5 SOL flow', () => {
    const set = anonSetInWindow(flow, [
      w({ transferAmount: 2_500_000_000n, signature: 'half' }),   // in (== 1 - tol)
      w({ transferAmount: 2_499_999_999n, signature: 'dust' }),   // out
      w({ transferAmount: 10_000_000_000n, signature: 'double' }), // in (flow is half of it)
      w({ transferAmount: 11_000_000_000n, signature: 'whale' }), // out
    ])
    expect(set.sameMintCount).toBe(4)
    expect(set.size).toBe(2)
    expect(set.matched.sort()).toEqual(['double', 'half'])
  })

  it('excludes self by signature, then by exact (mint, amount, timestamp) triple', () => {
    const bySig = anonSetInWindow(flow, [w({ signature: 'SELF' })])
    expect(bySig.size).toBe(0)
    const flowNoSig: FlowInput = { ...flow, signature: undefined }
    const byTriple = anonSetInWindow(flowNoSig, [
      { mint: SOL, transferAmount: 5_000_000_000n, timestamp: 1_000_000 }, // self triple, no sig
      w({ signature: 'other' }),
    ])
    expect(byTriple.size).toBe(1)
    expect(byTriple.matched).toEqual(['other'])
  })

  it('honors custom window and tolerance', () => {
    const set = anonSetInWindow(flow, [w({ timestamp: 1_000_300, signature: 'c' })], {
      windowSeconds: 120,
      amountToleranceRatio: 1,
    })
    expect(set.size).toBe(0) // 300s > 120s window
    expect(set.windowSeconds).toBe(120)
    expect(set.amountToleranceRatio).toBe(1)
  })

  it('throws ValidationError on bad input', () => {
    expect(() => anonSetInWindow({ ...flow, mint: '' }, [])).toThrow('flow.mint')
    expect(() => anonSetInWindow({ ...flow, transferAmount: -1n }, [])).toThrow('flow.transferAmount')
    expect(() => anonSetInWindow(flow, [], { windowSeconds: 0 })).toThrow('windowSeconds')
    expect(() => anonSetInWindow(flow, [], { amountToleranceRatio: 1.5 })).toThrow('amountToleranceRatio')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/anon-set.test.ts`
Expected: FAIL — cannot resolve `../../src/flow-privacy/anon-set` (module not created yet).

- [ ] **Step 3: Create the full data model**

Create `packages/sdk/src/flow-privacy/types.ts`:

```ts
/**
 * Per-flow privacy-score types.
 *
 * Scores a single commingling-vault flow (a withdrawal to a stealth recipient),
 * distinct from the wallet-history scoring in `surveillance/`.
 *
 * @packageDocumentation
 */
import type { PrivacyTier } from '../fees/privacy-tier'

/** The flow being scored — derived from VaultWithdrawEvent + how the tx was submitted. */
export interface FlowInput {
  /** base58 mint; native SOL = the `Pubkey::default()` sentinel */
  mint: string
  /** plaintext base units (VaultWithdrawEvent.transfer_amount) */
  transferAmount: bigint
  /** unix seconds (VaultWithdrawEvent.timestamp) */
  timestamp: number
  /** was the relayer the fee-payer? (gasless cash-out) */
  gasless: boolean
  /** optional context — the one-time stealth recipient */
  stealthRecipient?: string
  /** optional — used to exclude this flow from the candidate set */
  signature?: string
}

/** A candidate withdrawal in the window — the subset of VaultWithdrawEvent a caller indexes. */
export interface WindowWithdrawal {
  mint: string
  transferAmount: bigint
  timestamp: number
  signature?: string
}

/** Options for `anonSetInWindow`. */
export interface AnonSetOptions {
  /** half-width of the time window in seconds (default 600) */
  windowSeconds?: number
  /** amount bucket width as a ratio in (0, 1] (default 0.5) */
  amountToleranceRatio?: number
}

/** The anonymity set a flow blends into. */
export interface AnonymitySet {
  /** same-mint AND similar-amount in window, self excluded */
  size: number
  /** same-mint, any amount (pre amount-bucket) — shows the bucket's effect */
  sameMintCount: number
  windowSeconds: number
  amountToleranceRatio: number
  /** signatures of the flows blended with (when supplied) */
  matched: string[]
}

/** Overall qualitative band for a flow. */
export type PrivacyBand = 'limited' | 'moderate' | 'strong'

/** Per-factor qualitative level. */
export type FactorLevel = 'weak' | 'moderate' | 'strong'

/** Honest amount-hiding status, mapped onto the PrivacyTier ladder. */
export interface AmountHiding {
  tier: PrivacyTier
  /** 'visible-but-commingled' | 'visible-but-unlinkable' | 'cryptographically-hidden' */
  label: string
  cryptographicallyHidden: boolean
}

/** The full per-flow assessment. */
export interface FlowPrivacyAssessment {
  /** 0–100, tier-capped so it cannot overclaim */
  score: number
  band: PrivacyBand
  anonymitySet: AnonymitySet
  gasless: boolean
  amountHiding: AmountHiding
  factors: {
    anonymity: FactorLevel
    linkability: FactorLevel
    amount: FactorLevel
  }
  /** honest, generated from factors — never silent */
  caveats: string[]
}

/** Options for `assessFlowPrivacy`. */
export interface AssessFlowOptions extends AnonSetOptions {
  /** the protocol tier the flow settled under (default CURRENT_PRIVACY_TIER) */
  tier?: PrivacyTier
}
```

- [ ] **Step 4: Create constants (Task 1 subset)**

Create `packages/sdk/src/flow-privacy/constants.ts`:

```ts
/**
 * Tunable constants for per-flow privacy scoring. All thresholds, weights, and
 * caps live here so the model is auditable in one place.
 *
 * @packageDocumentation
 */

/** Default half-width of the anonymity-set time window (seconds). */
export const DEFAULT_WINDOW_SECONDS = 600

/** Default amount bucket width as a ratio in (0, 1]. */
export const DEFAULT_AMOUNT_TOLERANCE_RATIO = 0.5
```

- [ ] **Step 5: Create validators (Task 1 subset)**

Create `packages/sdk/src/flow-privacy/validate.ts`:

```ts
/**
 * Boundary validators for the flow-privacy primitives.
 *
 * @packageDocumentation
 */
import { ValidationError } from '../errors'
import type { FlowInput, WindowWithdrawal, AnonSetOptions } from './types'

/** Validate a FlowInput, throwing ValidationError on the first problem. */
export function validateFlowInput(flow: FlowInput): void {
  if (!flow || typeof flow !== 'object') throw new ValidationError('flow is required', 'flow')
  if (typeof flow.mint !== 'string' || flow.mint.length === 0)
    throw new ValidationError('mint must be a non-empty string', 'flow.mint')
  if (typeof flow.transferAmount !== 'bigint' || flow.transferAmount < 0n)
    throw new ValidationError('transferAmount must be a non-negative bigint', 'flow.transferAmount')
  if (!Number.isFinite(flow.timestamp))
    throw new ValidationError('timestamp must be a finite number', 'flow.timestamp')
  if (typeof flow.gasless !== 'boolean')
    throw new ValidationError('gasless must be a boolean', 'flow.gasless')
}

/** Validate the candidate array. */
export function validateWindowWithdrawals(candidates: WindowWithdrawal[]): void {
  if (!Array.isArray(candidates))
    throw new ValidationError('candidates must be an array', 'candidates')
  candidates.forEach((c, i) => {
    if (typeof c.mint !== 'string' || c.mint.length === 0)
      throw new ValidationError('mint must be a non-empty string', `candidates[${i}].mint`)
    if (typeof c.transferAmount !== 'bigint' || c.transferAmount < 0n)
      throw new ValidationError('transferAmount must be a non-negative bigint', `candidates[${i}].transferAmount`)
    if (!Number.isFinite(c.timestamp))
      throw new ValidationError('timestamp must be a finite number', `candidates[${i}].timestamp`)
  })
}

/** Validate anonymity-set options. */
export function validateAnonSetOptions(opts: AnonSetOptions): void {
  const { windowSeconds, amountToleranceRatio } = opts
  if (windowSeconds !== undefined && (!Number.isFinite(windowSeconds) || windowSeconds <= 0))
    throw new ValidationError('windowSeconds must be a positive number', 'windowSeconds')
  if (
    amountToleranceRatio !== undefined &&
    (!Number.isFinite(amountToleranceRatio) || amountToleranceRatio <= 0 || amountToleranceRatio > 1)
  )
    throw new ValidationError('amountToleranceRatio must be in (0, 1]', 'amountToleranceRatio')
}
```

- [ ] **Step 6: Implement `anonSetInWindow`**

Create `packages/sdk/src/flow-privacy/anon-set.ts`:

```ts
/**
 * anonSetInWindow — the flows a given flow actually blends into.
 *
 * @packageDocumentation
 */
import { DEFAULT_WINDOW_SECONDS, DEFAULT_AMOUNT_TOLERANCE_RATIO } from './constants'
import { validateFlowInput, validateWindowWithdrawals, validateAnonSetOptions } from './validate'
import type { FlowInput, WindowWithdrawal, AnonSetOptions, AnonymitySet } from './types'

/**
 * Compute the anonymity set a flow blends into: same-mint, similar-amount
 * withdrawals within a time window, excluding the flow itself.
 *
 * @param flow - the flow being scored
 * @param candidates - withdrawals the caller observed near the flow (caller-supplied; no RPC)
 * @param opts - window + amount-tolerance overrides
 */
export function anonSetInWindow(
  flow: FlowInput,
  candidates: WindowWithdrawal[],
  opts: AnonSetOptions = {},
): AnonymitySet {
  validateFlowInput(flow)
  validateWindowWithdrawals(candidates)
  validateAnonSetOptions(opts)

  const windowSeconds = opts.windowSeconds ?? DEFAULT_WINDOW_SECONDS
  const amountToleranceRatio = opts.amountToleranceRatio ?? DEFAULT_AMOUNT_TOLERANCE_RATIO

  const isSelf = (c: WindowWithdrawal): boolean => {
    if (flow.signature && c.signature) return c.signature === flow.signature
    return (
      c.mint === flow.mint &&
      c.transferAmount === flow.transferAmount &&
      c.timestamp === flow.timestamp
    )
  }

  const inWindowSameMint = candidates.filter(
    (c) =>
      !isSelf(c) && c.mint === flow.mint && Math.abs(c.timestamp - flow.timestamp) <= windowSeconds,
  )

  // amount bucket: min/max >= 1 - tol, computed in integer space to avoid bigint/float mixing.
  // scale the float threshold by 1000 (3-decimal precision on the ratio).
  const scaledThreshold = BigInt(Math.round((1 - amountToleranceRatio) * 1000))
  const withinBucket = (c: WindowWithdrawal): boolean => {
    const a = flow.transferAmount
    const b = c.transferAmount
    if (a === 0n && b === 0n) return true
    if (a === 0n || b === 0n) return false
    const lo = a < b ? a : b
    const hi = a < b ? b : a
    return lo * 1000n >= hi * scaledThreshold
  }

  const matchedFlows = inWindowSameMint.filter(withinBucket)

  return {
    size: matchedFlows.length,
    sameMintCount: inWindowSameMint.length,
    windowSeconds,
    amountToleranceRatio,
    matched: matchedFlows
      .map((c) => c.signature)
      .filter((s): s is string => typeof s === 'string'),
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/anon-set.test.ts`
Expected: PASS (all 7 tests).
Then: `pnpm --filter @sip-protocol/sdk typecheck` — Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/sdk/src/flow-privacy/types.ts packages/sdk/src/flow-privacy/constants.ts packages/sdk/src/flow-privacy/validate.ts packages/sdk/src/flow-privacy/anon-set.ts packages/sdk/tests/flow-privacy/anon-set.test.ts
git commit -S -m "feat(flow-privacy): anonSetInWindow primitive (mint + amount bucketed)"
```

---

### Task 2: factor primitives — `gaslessFlag`, `amountHidingStatus`, factor levels

**Files:**
- Modify: `packages/sdk/src/flow-privacy/constants.ts` (append)
- Modify: `packages/sdk/src/flow-privacy/validate.ts` (append `validateTier`)
- Create: `packages/sdk/src/flow-privacy/factors.ts`
- Test: `packages/sdk/tests/flow-privacy/factors.test.ts`

**Interfaces:**
- Consumes: `FlowInput`, `FactorLevel`, `AmountHiding` from `./types`; `PrivacyTier`, `CURRENT_PRIVACY_TIER` from `../fees/privacy-tier`; `validateFlowInput` from `./validate`.
- Produces:
  - `gaslessFlag(flow: FlowInput): boolean`
  - `amountHidingStatus(flow: FlowInput, tier?: PrivacyTier): AmountHiding`
  - `deriveAnonymityLevel(size: number): FactorLevel`
  - `deriveLinkabilityLevel(gasless: boolean): FactorLevel`
  - `deriveAmountLevel(amountHiding: AmountHiding): FactorLevel`
  - `validateTier(tier: PrivacyTier): void`
  - constants `ANON_SET_MODERATE_MIN = 3`, `ANON_SET_STRONG_MIN = 10`, `AMOUNT_HIDING_LABELS`

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/tests/flow-privacy/factors.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  gaslessFlag,
  amountHidingStatus,
  deriveAnonymityLevel,
  deriveLinkabilityLevel,
  deriveAmountLevel,
} from '../../src/flow-privacy/factors'
import { PrivacyTier } from '../../src/fees/privacy-tier'
import type { FlowInput } from '../../src/flow-privacy/types'

const flow: FlowInput = {
  mint: '11111111111111111111111111111111',
  transferAmount: 5_000_000_000n,
  timestamp: 1_000_000,
  gasless: true,
}

describe('gaslessFlag', () => {
  it('returns the flow gasless flag', () => {
    expect(gaslessFlag(flow)).toBe(true)
    expect(gaslessFlag({ ...flow, gasless: false })).toBe(false)
  })
  it('validates input', () => {
    expect(() => gaslessFlag({ ...flow, mint: '' })).toThrow('flow.mint')
  })
})

describe('amountHidingStatus', () => {
  it('defaults to the current tier (TIER_1 = visible-but-commingled)', () => {
    expect(amountHidingStatus(flow)).toEqual({
      tier: PrivacyTier.TIER_1,
      label: 'visible-but-commingled',
      cryptographicallyHidden: false,
    })
  })
  it('maps TIER_2 to visible-but-unlinkable', () => {
    expect(amountHidingStatus(flow, PrivacyTier.TIER_2)).toEqual({
      tier: PrivacyTier.TIER_2,
      label: 'visible-but-unlinkable',
      cryptographicallyHidden: false,
    })
  })
  it('maps TIER_3 to cryptographically-hidden', () => {
    expect(amountHidingStatus(flow, PrivacyTier.TIER_3)).toEqual({
      tier: PrivacyTier.TIER_3,
      label: 'cryptographically-hidden',
      cryptographicallyHidden: true,
    })
  })
  it('rejects an invalid tier', () => {
    expect(() => amountHidingStatus(flow, 'tier_9' as PrivacyTier)).toThrow('tier')
  })
})

describe('factor-level derivations', () => {
  it('anonymity: 0–2 weak, 3–9 moderate, ≥10 strong', () => {
    expect(deriveAnonymityLevel(0)).toBe('weak')
    expect(deriveAnonymityLevel(2)).toBe('weak')
    expect(deriveAnonymityLevel(3)).toBe('moderate')
    expect(deriveAnonymityLevel(9)).toBe('moderate')
    expect(deriveAnonymityLevel(10)).toBe('strong')
  })
  it('linkability: gasless strong, self-paid moderate', () => {
    expect(deriveLinkabilityLevel(true)).toBe('strong')
    expect(deriveLinkabilityLevel(false)).toBe('moderate')
  })
  it('amount: cryptographically hidden strong, else weak', () => {
    expect(deriveAmountLevel(amountHidingStatus(flow, PrivacyTier.TIER_3))).toBe('strong')
    expect(deriveAmountLevel(amountHidingStatus(flow, PrivacyTier.TIER_1))).toBe('weak')
    expect(deriveAmountLevel(amountHidingStatus(flow, PrivacyTier.TIER_2))).toBe('weak')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/factors.test.ts`
Expected: FAIL — cannot resolve `../../src/flow-privacy/factors`.

- [ ] **Step 3: Append constants**

Append to `packages/sdk/src/flow-privacy/constants.ts`:

```ts
import { PrivacyTier } from '../fees/privacy-tier'

/** Anonymity-set size at/above which the anonymity factor is at least 'moderate'. */
export const ANON_SET_MODERATE_MIN = 3

/** Anonymity-set size at/above which the anonymity factor is 'strong'. */
export const ANON_SET_STRONG_MIN = 10

/** Honest amount-hiding label per tier. */
export const AMOUNT_HIDING_LABELS: Record<PrivacyTier, string> = {
  [PrivacyTier.TIER_1]: 'visible-but-commingled',
  [PrivacyTier.TIER_2]: 'visible-but-unlinkable',
  [PrivacyTier.TIER_3]: 'cryptographically-hidden',
}
```

- [ ] **Step 4: Append `validateTier`**

Append to `packages/sdk/src/flow-privacy/validate.ts` (and add `import { PrivacyTier } from '../fees/privacy-tier'` at the top, beside the existing imports):

```ts
/** Validate that a value is a known PrivacyTier. */
export function validateTier(tier: PrivacyTier): void {
  if (!Object.values(PrivacyTier).includes(tier))
    throw new ValidationError('tier must be a valid PrivacyTier', 'tier')
}
```

- [ ] **Step 5: Implement `factors.ts`**

Create `packages/sdk/src/flow-privacy/factors.ts`:

```ts
/**
 * Flow privacy factor primitives: gasless flag, amount-hiding status, and the
 * qualitative factor-level derivations consumed by the composer.
 *
 * @packageDocumentation
 */
import { PrivacyTier, CURRENT_PRIVACY_TIER } from '../fees/privacy-tier'
import { ANON_SET_MODERATE_MIN, ANON_SET_STRONG_MIN, AMOUNT_HIDING_LABELS } from './constants'
import { validateFlowInput, validateTier } from './validate'
import type { FlowInput, FactorLevel, AmountHiding } from './types'

/** Whether the cash-out was gasless (relayer fee-payer → no fee-payer→recipient link). */
export function gaslessFlag(flow: FlowInput): boolean {
  validateFlowInput(flow)
  return flow.gasless
}

/** Honest amount-hiding status for the tier the flow settled under. */
export function amountHidingStatus(
  flow: FlowInput,
  tier: PrivacyTier = CURRENT_PRIVACY_TIER,
): AmountHiding {
  validateFlowInput(flow)
  validateTier(tier)
  return {
    tier,
    label: AMOUNT_HIDING_LABELS[tier],
    cryptographicallyHidden: tier === PrivacyTier.TIER_3,
  }
}

/** Anonymity factor level from the anonymity-set size. */
export function deriveAnonymityLevel(size: number): FactorLevel {
  if (size >= ANON_SET_STRONG_MIN) return 'strong'
  if (size >= ANON_SET_MODERATE_MIN) return 'moderate'
  return 'weak'
}

/** Linkability factor level (the recipient is always a one-time stealth address). */
export function deriveLinkabilityLevel(gasless: boolean): FactorLevel {
  return gasless ? 'strong' : 'moderate'
}

/** Amount factor level — only cryptographic hiding is 'strong'. */
export function deriveAmountLevel(amountHiding: AmountHiding): FactorLevel {
  return amountHiding.cryptographicallyHidden ? 'strong' : 'weak'
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/factors.test.ts`
Expected: PASS.
Then: `pnpm --filter @sip-protocol/sdk typecheck` — Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/sdk/src/flow-privacy/constants.ts packages/sdk/src/flow-privacy/validate.ts packages/sdk/src/flow-privacy/factors.ts packages/sdk/tests/flow-privacy/factors.test.ts
git commit -S -m "feat(flow-privacy): gasless + amount-hiding factor primitives"
```

---

### Task 3: `assessFlowPrivacy` composer (scoring + caveats)

**Files:**
- Modify: `packages/sdk/src/flow-privacy/constants.ts` (append)
- Create: `packages/sdk/src/flow-privacy/assess.ts`
- Test: `packages/sdk/tests/flow-privacy/assess.test.ts`

**Interfaces:**
- Consumes: `anonSetInWindow` (Task 1); `gaslessFlag`, `amountHidingStatus`, `deriveAnonymityLevel`, `deriveLinkabilityLevel`, `deriveAmountLevel` (Task 2); `CURRENT_PRIVACY_TIER` from `../fees/privacy-tier`; types from `./types`.
- Produces:
  - `assessFlowPrivacy(flow: FlowInput, candidates: WindowWithdrawal[], opts?: AssessFlowOptions): FlowPrivacyAssessment`
  - constants `FACTOR_WEIGHTS`, `FACTOR_POINTS`, `TIER_SCORE_CAP`, `BAND_MODERATE_MIN = 40`, `BAND_STRONG_MIN = 70`

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/tests/flow-privacy/assess.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { assessFlowPrivacy } from '../../src/flow-privacy/assess'
import { PrivacyTier } from '../../src/fees/privacy-tier'
import type { FlowInput, WindowWithdrawal } from '../../src/flow-privacy/types'

const SOL = '11111111111111111111111111111111'
const flow: FlowInput = { mint: SOL, transferAmount: 5_000_000_000n, timestamp: 1_000_000, gasless: true, signature: 'SELF' }

// 10 same-mint, same-amount, in-window candidates → anonymity 'strong'
const bigCrowd: WindowWithdrawal[] = Array.from({ length: 10 }, (_, i) => ({
  mint: SOL,
  transferAmount: 5_000_000_000n,
  timestamp: 1_000_000 + i,
  signature: `c${i}`,
}))

describe('assessFlowPrivacy', () => {
  it('caps a TIER_1 flow at moderate even with a strong crowd (honesty guarantee)', () => {
    const a = assessFlowPrivacy(flow, bigCrowd)
    expect(a.factors).toEqual({ anonymity: 'strong', linkability: 'strong', amount: 'weak' })
    expect(a.score).toBe(59) // min(round(70), 59)
    expect(a.band).toBe('moderate')
    expect(a.amountHiding.tier).toBe(PrivacyTier.TIER_1)
    expect(a.caveats).toContain(
      'Withdrawal amount (5000000000) is visible on-chain — commingled, not cryptographically hidden.',
    )
  })

  it('reaches strong only when amounts are cryptographically hidden (TIER_3)', () => {
    const a = assessFlowPrivacy(flow, bigCrowd, { tier: PrivacyTier.TIER_3 })
    expect(a.factors.amount).toBe('strong')
    expect(a.score).toBe(100)
    expect(a.band).toBe('strong')
    expect(a.caveats).toEqual([]) // strong anon + gasless + hidden amount → no caveats
  })

  it('TIER_2 (unlinkable) can reach strong band with visible amounts', () => {
    const a = assessFlowPrivacy(flow, bigCrowd, { tier: PrivacyTier.TIER_2 })
    expect(a.score).toBe(70) // min(round(70), 84)
    expect(a.band).toBe('strong')
  })

  it('empty crowd → limited band, thin-set caveat', () => {
    const a = assessFlowPrivacy(flow, [])
    expect(a.factors.anonymity).toBe('weak')
    expect(a.score).toBe(30) // round(100*(0.4*0 + 0.3*1 + 0.3*0)) capped at 59
    expect(a.band).toBe('limited')
    expect(a.caveats.some((c) => c.includes('Anonymity set is 0'))).toBe(true)
  })

  it('self-paid gas lowers linkability and adds a caveat', () => {
    const a = assessFlowPrivacy({ ...flow, gasless: false }, bigCrowd)
    expect(a.factors.linkability).toBe('moderate')
    expect(a.gasless).toBe(false)
    expect(a.caveats.some((c) => c.includes('paid its own gas'))).toBe(true)
  })

  it('propagates validation errors from the primitives', () => {
    expect(() => assessFlowPrivacy({ ...flow, transferAmount: -1n }, [])).toThrow('flow.transferAmount')
    expect(() => assessFlowPrivacy(flow, [], { tier: 'tier_9' as PrivacyTier })).toThrow('tier')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/assess.test.ts`
Expected: FAIL — cannot resolve `../../src/flow-privacy/assess`.

- [ ] **Step 3: Append scoring constants**

Append to `packages/sdk/src/flow-privacy/constants.ts`:

```ts
import type { FactorLevel } from './types'

/** Weight of each factor in the raw score (sum to 1). */
export const FACTOR_WEIGHTS: Record<'anonymity' | 'linkability' | 'amount', number> = {
  anonymity: 0.4,
  linkability: 0.3,
  amount: 0.3,
}

/** Points awarded per factor level. */
export const FACTOR_POINTS: Record<FactorLevel, number> = {
  weak: 0,
  moderate: 0.5,
  strong: 1,
}

/** Maximum score per tier — the honesty cap. TIER_1 cannot exceed 'moderate'. */
export const TIER_SCORE_CAP: Record<PrivacyTier, number> = {
  [PrivacyTier.TIER_1]: 59,
  [PrivacyTier.TIER_2]: 84,
  [PrivacyTier.TIER_3]: 100,
}

/** Band cutoffs on the capped score. */
export const BAND_MODERATE_MIN = 40
export const BAND_STRONG_MIN = 70
```

(`PrivacyTier` is already imported at the top of `constants.ts` from Task 2.)

- [ ] **Step 4: Implement `assess.ts`**

Create `packages/sdk/src/flow-privacy/assess.ts`:

```ts
/**
 * assessFlowPrivacy — composes the primitives into an honest, tier-capped
 * per-flow privacy assessment (score + band + factors + caveats).
 *
 * @packageDocumentation
 */
import { CURRENT_PRIVACY_TIER } from '../fees/privacy-tier'
import { anonSetInWindow } from './anon-set'
import {
  gaslessFlag,
  amountHidingStatus,
  deriveAnonymityLevel,
  deriveLinkabilityLevel,
  deriveAmountLevel,
} from './factors'
import {
  FACTOR_WEIGHTS,
  FACTOR_POINTS,
  TIER_SCORE_CAP,
  BAND_MODERATE_MIN,
  BAND_STRONG_MIN,
} from './constants'
import type {
  FlowInput,
  WindowWithdrawal,
  AssessFlowOptions,
  FlowPrivacyAssessment,
  PrivacyBand,
  AnonymitySet,
  AmountHiding,
} from './types'

function bandFor(score: number): PrivacyBand {
  if (score >= BAND_STRONG_MIN) return 'strong'
  if (score >= BAND_MODERATE_MIN) return 'moderate'
  return 'limited'
}

function buildCaveats(
  flow: FlowInput,
  anonymitySet: AnonymitySet,
  gasless: boolean,
  amountHiding: AmountHiding,
  anonymityStrong: boolean,
): string[] {
  const caveats: string[] = []
  if (!amountHiding.cryptographicallyHidden)
    caveats.push(
      `Withdrawal amount (${flow.transferAmount}) is visible on-chain — commingled, not cryptographically hidden.`,
    )
  if (!anonymityStrong) {
    const minutes = Math.round(anonymitySet.windowSeconds / 60)
    caveats.push(
      `Anonymity set is ${anonymitySet.size} similar-amount same-asset withdrawal(s) in a ${minutes}-minute window; small sets are correlatable.`,
    )
  }
  if (!gasless)
    caveats.push(
      'Cash-out paid its own gas — the fee-payer is linkable to the recipient. A gasless relayer removes this link.',
    )
  return caveats
}

/**
 * Score a single vault flow's privacy honestly, over caller-supplied data.
 *
 * @param flow - the flow being scored
 * @param candidates - withdrawals the caller observed near the flow (no RPC)
 * @param opts - window/tolerance + the settlement tier (default CURRENT_PRIVACY_TIER)
 */
export function assessFlowPrivacy(
  flow: FlowInput,
  candidates: WindowWithdrawal[],
  opts: AssessFlowOptions = {},
): FlowPrivacyAssessment {
  const tier = opts.tier ?? CURRENT_PRIVACY_TIER
  const anonymitySet = anonSetInWindow(flow, candidates, opts)
  const gasless = gaslessFlag(flow)
  const amountHiding = amountHidingStatus(flow, tier)

  const factors = {
    anonymity: deriveAnonymityLevel(anonymitySet.size),
    linkability: deriveLinkabilityLevel(gasless),
    amount: deriveAmountLevel(amountHiding),
  }

  const raw =
    100 *
    (FACTOR_WEIGHTS.anonymity * FACTOR_POINTS[factors.anonymity] +
      FACTOR_WEIGHTS.linkability * FACTOR_POINTS[factors.linkability] +
      FACTOR_WEIGHTS.amount * FACTOR_POINTS[factors.amount])

  const score = Math.min(Math.round(raw), TIER_SCORE_CAP[tier])
  const band = bandFor(score)
  const caveats = buildCaveats(flow, anonymitySet, gasless, amountHiding, factors.anonymity === 'strong')

  return { score, band, anonymitySet, gasless, amountHiding, factors, caveats }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/assess.test.ts`
Expected: PASS.
Then: `pnpm --filter @sip-protocol/sdk typecheck` — Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/flow-privacy/constants.ts packages/sdk/src/flow-privacy/assess.ts packages/sdk/tests/flow-privacy/assess.test.ts
git commit -S -m "feat(flow-privacy): assessFlowPrivacy composer with tier-capped scoring"
```

---

### Task 4: barrel exports + changeset

**Files:**
- Create: `packages/sdk/src/flow-privacy/index.ts`
- Modify: `packages/sdk/src/index.ts` (append exports after the fees block, ~line 1614)
- Create: `.changeset/flow-privacy-primitives.md`
- Test: `packages/sdk/tests/flow-privacy/exports.test.ts`

**Interfaces:**
- Consumes: all public functions/types from Tasks 1–3.
- Produces: the public SDK surface — `anonSetInWindow`, `gaslessFlag`, `amountHidingStatus`, `assessFlowPrivacy` + the nine types, reachable from `@sip-protocol/sdk`.

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/tests/flow-privacy/exports.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as sdk from '../../src/index'
import * as flowPrivacy from '../../src/flow-privacy'

describe('flow-privacy public surface', () => {
  it('exposes the primitives from the module barrel', () => {
    expect(typeof flowPrivacy.anonSetInWindow).toBe('function')
    expect(typeof flowPrivacy.gaslessFlag).toBe('function')
    expect(typeof flowPrivacy.amountHidingStatus).toBe('function')
    expect(typeof flowPrivacy.assessFlowPrivacy).toBe('function')
  })

  it('re-exports the primitives from the main SDK entry', () => {
    expect(typeof sdk.anonSetInWindow).toBe('function')
    expect(typeof sdk.gaslessFlag).toBe('function')
    expect(typeof sdk.amountHidingStatus).toBe('function')
    expect(typeof sdk.assessFlowPrivacy).toBe('function')
  })

  it('the main-entry composer produces a complete assessment', () => {
    const a = sdk.assessFlowPrivacy(
      { mint: '11111111111111111111111111111111', transferAmount: 5_000_000_000n, timestamp: 1_000_000, gasless: true },
      [],
    )
    expect(a).toHaveProperty('score')
    expect(a).toHaveProperty('band')
    expect(a).toHaveProperty('factors')
    expect(a).toHaveProperty('caveats')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/exports.test.ts`
Expected: FAIL — `../../src/flow-privacy` has no index, and `sdk.assessFlowPrivacy` is undefined.

- [ ] **Step 3: Create the module barrel**

Create `packages/sdk/src/flow-privacy/index.ts`:

```ts
/**
 * Per-flow privacy-score primitives.
 *
 * Honest assessment of a single commingling-vault flow (anonymity set, gasless,
 * amount-hiding), distinct from the wallet-history scoring in `surveillance/`.
 * Pure — the caller supplies the candidate window; no RPC.
 *
 * @packageDocumentation
 */
export { anonSetInWindow } from './anon-set'
export { gaslessFlag, amountHidingStatus } from './factors'
export { assessFlowPrivacy } from './assess'

export type {
  FlowInput,
  WindowWithdrawal,
  AnonSetOptions,
  AnonymitySet,
  PrivacyBand,
  FactorLevel,
  AmountHiding,
  FlowPrivacyAssessment,
  AssessFlowOptions,
} from './types'
```

- [ ] **Step 4: Wire into the main SDK barrel**

In `packages/sdk/src/index.ts`, immediately after the fees `export type { ... } from './fees'` block (ends ~line 1614), add:

```ts
// ─── Flow Privacy (per-flow privacy-score primitives) ────────────────────────
export {
  anonSetInWindow,
  gaslessFlag,
  amountHidingStatus,
  assessFlowPrivacy,
} from './flow-privacy'

export type {
  FlowInput,
  WindowWithdrawal,
  AnonSetOptions,
  AnonymitySet,
  PrivacyBand,
  FactorLevel,
  AmountHiding,
  FlowPrivacyAssessment,
  AssessFlowOptions,
} from './flow-privacy'
```

- [ ] **Step 5: Add the changeset**

Create `.changeset/flow-privacy-primitives.md`:

```md
---
"@sip-protocol/sdk": minor
---

Add per-flow privacy-score primitives (`flow-privacy` module): `anonSetInWindow`, `gaslessFlag`, `amountHidingStatus`, and the `assessFlowPrivacy` composer. They honestly score a single commingling-vault flow — a tier-capped 0–100 score plus an anonymity-set / gasless / amount-hiding factor breakdown with caveats — over caller-supplied data (no RPC).
```

- [ ] **Step 6: Run tests + full suite + typecheck**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy/exports.test.ts` — Expected: PASS.
Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/flow-privacy` — Expected: all flow-privacy tests PASS.
Run: `pnpm --filter @sip-protocol/sdk typecheck` — Expected: no errors.
Run (regression): `pnpm --filter @sip-protocol/sdk test -- --run` — Expected: full SDK suite green.

- [ ] **Step 7: Naming-gate the whole diff, then commit**

Run the project's confidential naming-gate regex (provided out-of-band from the private handoff — not stored in this repo) over the full diff:

```bash
git diff origin/main --diff-filter=d > /tmp/flow-privacy.diff
# grep /tmp/flow-privacy.diff with the out-of-band naming-gate regex; expect zero matches (clean)
git add packages/sdk/src/flow-privacy/index.ts packages/sdk/src/index.ts .changeset/flow-privacy-primitives.md packages/sdk/tests/flow-privacy/exports.test.ts
git commit -S -m "feat(flow-privacy): export primitives from SDK barrel + changeset"
```

Expected: the naming-gate grep finds no matches.

---

## Self-Review

**1. Spec coverage:**
- §3.1 anonSetInWindow (mint + amount bucket + window + self-exclusion) → Task 1. ✓
- §3.2 gaslessFlag → Task 2. ✓
- §3.3 amountHidingStatus (tier→label map, default CURRENT_PRIVACY_TIER) → Task 2. ✓
- §3.4 assessFlowPrivacy composer → Task 3. ✓
- §4 data types → Task 1 (`types.ts`, full model). ✓
- §5 scoring model (weights 0.40/0.30/0.30, points, caps 59/84/100, bands 40/70) → Task 3 constants + assess. ✓
- §6 caveats (amount-visible, thin-set, self-paid) → Task 3 `buildCaveats`. ✓
- §7 validation & errors (ValidationError at boundary, self-exclusion edge) → Task 1 `validate.ts` + Task 2 `validateTier`. ✓
- §8 module layout + main-barrel-only export → Task 4. ✓
- §9 testing (table-driven, no RPC, boundaries, tier cap, coverage) → tests in Tasks 1–4. ✓

**2. Placeholder scan:** none — every step has complete code and concrete commands.

**3. Type consistency:** `FlowInput`/`WindowWithdrawal`/`AnonSetOptions`/`AnonymitySet`/`FactorLevel`/`AmountHiding`/`AssessFlowOptions`/`FlowPrivacyAssessment`/`PrivacyBand` defined once in Task 1 `types.ts`; function names (`anonSetInWindow`, `gaslessFlag`, `amountHidingStatus`, `assessFlowPrivacy`, `deriveAnonymityLevel`, `deriveLinkabilityLevel`, `deriveAmountLevel`, `validateFlowInput`, `validateWindowWithdrawals`, `validateAnonSetOptions`, `validateTier`) used consistently across Tasks 1–4. Scoring math verified: TIER_1 max raw 70 → cap 59 → moderate; TIER_2 70 → strong; TIER_3 100 → strong; empty crowd 30 → limited. Confirmed collision-free against existing SDK exports.
