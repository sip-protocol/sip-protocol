# Vault Fee Re-Precision — whole-bps → tenths-of-bps

**Date:** 2026-06-27
**Status:** Design — awaiting review
**Component:** `programs/sipher-vault` (Solana Anchor program) + `@sipher/sdk` (separate repo)
**Branch:** `feat/sipher-vault-fee-precision`

---

## Motivation

The vault's protocol fee is stored as **whole basis points** (`fee_bps: u16`) and applied as
`fee = amount · fee_bps / 10_000`. The smallest non-zero fee is therefore **1 bps**.

Negotiated integrator rates can fall **between** whole basis points — e.g. a **7.5 bps** launch
rate. That value is **not representable** on-chain today: the authority can only set 7 or 8 bps,
so the on-chain rate cannot exactly match an agreed fractional rate. This spec makes fractional
basis-point rates exactly representable.

## Goal

Make a fee such as **7.5 bps** exact on-chain, with the **minimum** change that stays consistent
with the rest of the SIP codebase (which is basis-points throughout).

## Approach

Reinterpret the fee unit from whole basis points to **tenths of a basis point** (0.1 bps):

```
fee = amount · fee_tenths_bps / 100_000      // 75 = 7.5 bps
```

The field stays a `u16` at the **same byte offset** — the `VaultConfig` layout is **unchanged**,
so **no account migration** (`migrate_config`) is required. Only a program **upgrade** plus one
`update_fee` call are needed.

### Why tenths-of-bps (not ppm, not "pips")
- SIP's whole codebase speaks **basis points** (EVM `SIPPrivacy`/`SIPSwapRouter`, `sip-privacy`,
  the vault). Tenths-of-bps is "bps with one more digit" — the least-surprising extension. Switching
  the vault alone to ppm would make it the odd unit out.
- 0.1 bps granularity covers every rate in play (7.5 / 10 / 15 / 17.5 bps are all multiples of 0.5).
- Field name **`fee_tenths_bps`** is preferred over `fee_pips`: a "pip" conventionally means *1 bps*
  in finance — a footgun in fee code. (Alternative considered: `fee_rate: u16` + a documented
  `FEE_DENOMINATOR = 100_000` const. See **Open decision**.)

## Detailed changes

### 1. On-chain program — `programs/sipher-vault/programs/sipher-vault/src/`

**`state.rs`**
- `fee_bps: u16` → `fee_tenths_bps: u16` (state.rs:7). Same 2 bytes, same offset (40, after the
  8-byte discriminator + 32-byte authority). Pure rename + unit reinterpretation.

**`lib.rs`**
- Both divisors `10_000 → 100_000`:
  - token withdraw `withdraw_private` (lib.rs:259)
  - native-SOL withdraw `withdraw_private_sol` (lib.rs:374)
- `initialize` (lib.rs:75/82/90): arg `fee_tenths_bps`, cap check, `msg!` text.
- `update_fee` (lib.rs:736–747): arg `new_fee_tenths_bps`, cap check (lib.rs:737),
  `FeeUpdatedEvent { old_fee_tenths_bps, new_fee_tenths_bps }`, `msg!` text.
- Doc comments referencing `fee_bps / 10_000` (e.g. lib.rs:336, module header).

**`constants.rs`**
- `DEFAULT_FEE_BPS: u16 = 10` → `DEFAULT_FEE_TENTHS_BPS: u16 = 100`
  (keeps the **list** TIER-1 = 10 bps as the default; a fractional integrator rate is set explicitly,
  never baked into the default).
- `MAX_FEE_BPS: u16 = 100` → `MAX_FEE_TENTHS_BPS: u16 = 1000` (still a **1% cap**).

### 2. SDK — `@sipher/sdk` (sipher repo, separate PR)

- `packages/sdk/src/vault.ts` (:130, :149): the parser reads the raw `u16` and presents
  **`feeBps = raw / 10`** — a possibly-fractional number (75 → `7.5`). The public field name
  `feeBps` is kept, so consumers stay correct with near-zero API churn.
- `packages/sdk/src/types.ts` (:9): `feeBps: number`, documented as may-be-fractional.
- `packages/sdk/src/idl/sipher_vault.json`: regenerate from the upgraded program (field rename).
- `packages/sdk/scripts/devnet-check.ts` (:42): prints "Fee: 7.5 bps" correctly via the parser.
- **Explicitly NOT touched:** `packages/sdk/src/privacy.ts` and `privacy-sol.ts`. Those read the
  **`sip-privacy`** program's config (a *different* program, still whole-bps). Calling this out so
  they are not "helpfully" changed.

### 3. Migration / deploy (devnet)

The live config stores `fee_bps = 10` (10 bps under the *old* divisor). After the upgrade the
divisor is `100_000`, so the stored `10` reads as **1 bps** until reset. The deploy is therefore
**sequence-coupled**:

```
solana program deploy (upgrade)  →  update_fee(75)  →  verify SDK shows 7.5 bps
```

Devnet, single config, authority = the devnet wallet we hold. Mainnet (future) = the same sequence,
but pause-wrapped under the Squads multisig (out of scope here — see the mainnet-readiness path doc).

## Data flow (before → after)

| | Stored value | Divisor | 10-SOL withdraw fee |
|---|---|---|---|
| Before | `fee_bps = 10` | 10_000 | 10 bps = 0.01 SOL |
| After | `fee_tenths_bps = 75` | 100_000 | 7.5 bps = 0.0075 SOL |

Fee math stays `u128`-checked (`checked_mul`/`checked_div`) → `u64`; debit-first ordering and the
PDA-signed transfers are unchanged.

## Error handling
- Cap enforced in both `initialize` and `update_fee`: `require!(x <= MAX_FEE_TENTHS_BPS, FeeTooHigh)`.
- All fee arithmetic remains checked (overflow → `MathOverflow`); no new failure modes.

## Testing
- **Vault bankrun** (`tests/sipher-vault/`): update `setup.ts`/helpers fee config and assertions in
  `01-initialize`, `04-collect-fee`, `10-bankrun-classic-spl`, `12-native-sol`.
  - Add the **headline proof**: config `75` → withdraw 10 SOL → fee = `0.0075 SOL` exactly.
  - Add a small-amount **rounding-boundary** case (where 1-bps granularity would have rounded fee to 0).
  - Cap rejection: `MAX_FEE_TENTHS_BPS + 1` → `FeeTooHigh`.
- **SDK** (`packages/sdk/tests/vault.test.ts`): raw `75` → `feeBps === 7.5`; update the config-buffer
  builder; keep a whole-bps case (`100` → `feeBps === 10`).
- **Local verify before deploy**: `cargo build-sbf` + bankrun green (`programs/*` is outside root CI).

## Scope boundaries
- **In:** vault program + `constants.rs` + scripts (`init-devnet.ts`) + bankrun tests (this repo PR);
  `@sipher/sdk` parser/types/IDL/tests (sipher repo PR); devnet upgrade + `update_fee`.
- **Out:** `sip-privacy` (mainnet, whole-bps, separate — left as-is), the `IntegratorRate` PDA
  (deferred to ≥2 integrators / pre-mainnet), EVM contracts.
- **Known trade-off:** the vault's fee unit now diverges from `sip-privacy`'s (tenths vs whole bps).
  Acceptable — different programs; the SDK distinguishes them. Align `sip-privacy` only if/when it is
  next upgraded.

## Risks
- **Semantic-reset window:** stored `10` reads as 1 bps between upgrade and `update_fee`. Mitigation:
  run `update_fee(75)` immediately after the upgrade; on devnet the window is harmless.
- **Source-level breaking rename is deliberate:** Rust will not compile against the old `fee_bps`
  name, surfacing every consumer. That is the safety feature, not a regression.
- **Cross-repo ordering:** the program + IDL PR (this repo) lands **first**; the SDK PR (sipher)
  consumes the new IDL **second**.

## Open decision (for review)
**Field naming:** `fee_tenths_bps` (self-documenting, recommended) vs `fee_rate: u16` +
`FEE_DENOMINATOR = 100_000` (DeFi-generic). Both yield exact 7.5 bps; the choice only affects
naming/readability. Defaulting to `fee_tenths_bps` unless changed at review.
