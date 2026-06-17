# sipher-vault: Universal Asset Support (native SOL + Token-2022)

**Date:** 2026-06-16
**Status:** Design approved — implementation pending
**Scope:** `programs/sipher-vault` on-chain program only (devnet redeploy). SDK native-SOL support (scan / gasless cash-out) and the integrator client are separate follow-on specs.
**Related:** `2026-04-16-authority-refund-design.md`; tracking issue for the equivalent mainnet `sip-privacy` upgrade: sip-protocol#1160.

---

## 1. Motivation

`sipher-vault` is a deposit-first commingling privacy vault: depositors fund a shared PDA, then withdraw privately to stealth addresses with a Pedersen-committed announcement. Today it custodies **classic SPL tokens only**. Two gaps limit its reach as a general privacy primitive:

1. **No native SOL.** SOL is the dominant payment asset on Solana; integrators with native-SOL flows must wrap to wSOL on every leg (ATA rent, wrap/unwrap instructions, dust cleanup). The vault has no lamport custody path.
2. **No Token-2022.** The program is bound to the classic SPL Token program (`Program<'info, Token>`), so any Token-2022 mint is rejected.

This design makes the vault a **universal asset custody primitive**: native SOL + every classic SPL token + Token-2022 (with a safety allowlist), in one audited pass. Doing all asset classes together avoids a second program change + redeploy + audit later.

## 2. Goals / Non-goals

**Goals**
- Custody and privately withdraw **native SOL** (lamports) directly — no wrapping.
- Custody and privately withdraw **Token-2022** mints, gated by a **conservative extension allowlist** that fails closed.
- Preserve existing **classic SPL** behavior and the commingling / depositor-as-signer model unchanged.
- Keep the on-chain↔SDK contract explicit so the SDK follow-on cannot drift.
- Leave the **mainnet `sip-privacy`** program untouched.

**Non-goals (this spec)**
- SDK native-SOL scan / gasless cash-out, and the integrator client — separate follow-on specs.
- Token-2022 **fee-bearing** (transfer-fee), **transfer-hook**, **confidential**, **permanent-delegate**, **non-transferable**, **default-frozen** mints — explicitly rejected in v1; fee-bearing support may be a later upgrade.
- Trustless nullifier-authorized withdrawal (separate co-build).
- Mainnet deployment — gated on the self-audit (see §10).

## 3. Current state (verified vs source)

- `deposit` / `withdraw_private` / `refund` / `authority_refund` / `collect_fee` move funds via `anchor_spl::token::Transfer` over `Account<'info, TokenAccount>` + `Account<'info, Mint>`, `token_program: Program<'info, Token>` (classic SPL only) — `lib.rs`.
- `withdraw_private` CPIs `sip_privacy::create_transfer_announcement` (metadata-only; records `token_mint` as opaque bytes — no validation, no token movement) — verified in `sip-privacy/.../lib.rs:330`.
- `DepositRecord { depositor, token_mint, balance, locked_amount, cumulative_volume, last_deposit_at, bump }`; PDA seeds `[DEPOSIT_RECORD_SEED, depositor, token_mint]`.
- `withdraw_private` / `refund` / `authority_refund` require the **depositor as signer**, `DepositRecord` is `has_one`-keyed on `depositor` → the depositor authorizes their own withdrawal (commingling vault, not a trustless mixer).
- Toolchain: Anchor `0.30.1`; `anchor-spl 0.30.1` ships `token_interface` (so `Interface<TokenInterface>` + `InterfaceAccount` + `transfer_checked` are available without a toolchain bump). Tests: TS / ts-mocha under `tests/sipher-vault/`.

## 4. Architecture — two asset tracks, shared spine (Approach A)

One `VaultConfig`, one `DepositRecord` shape, one announcement CPI. Two custody tracks:

- **Token track (classic SPL + Token-2022):** the *existing* instructions, migrated to the SPL **interface** so a single code path serves both token programs.
- **Native-SOL track:** *new* `*_sol` instructions custodying lamports in dedicated PDAs.

Shared internal helpers — `compute_fee(amount, bps)`, debit-first balance update, and the `create_transfer_announcement` CPI — keep the tracks DRY without merging their custody logic. The high-risk lamport handling stays isolated in the native track so each track audits independently.

## 5. Detailed design

### 5.1 New constants & PDAs

- `VAULT_SOL_SEED = b"vault_sol"`, `FEE_SOL_SEED = b"fee_sol"`.
- `SolVault { bump }` and `SolFee { bump }` — minimal marker accounts, program-owned, rent-exempt. They hold native lamports above their own rent-exempt minimum. **Singletons** — native SOL is a single asset, so there is one global vault + fee pair (seeds carry no mint), unlike the per-mint token vault/fee PDAs.
- `NATIVE_SOL_MINT: Pubkey = Pubkey::default()` — the sentinel "mint" representing native SOL (the all-zero / System-Program pubkey; no real SPL mint collides with it, unlike the wSOL mint which is a legitimate SPL deposit).

### 5.2 Native-SOL track (new instructions)

- **`create_sol_vault`** — one-time init of the `SolVault` + `SolFee` PDAs (payer funds the rent-exempt minimum). Mirrors `create_vault_token` / `create_fee_token`.
- **`deposit_sol(amount)`** — `system_program::transfer(depositor → sol_vault, amount)` (depositor signs); create/update `DepositRecord` keyed `(depositor, NATIVE_SOL_MINT)`. Reverts on `paused` / `amount == 0`.
- **`withdraw_private_sol(amount, amount_commitment, stealth_pubkey, ephemeral_pubkey, viewing_key_hash, encrypted_amount, proof)`**
  1. Debit-first: `available = balance − locked_amount`; require `available ≥ amount`; `balance −= amount`.
  2. `fee = amount · fee_bps / 10_000`; `net = amount − fee` (checked).
  3. **Checked lamport mutation** (source is the program-owned `SolVault`): `sol_vault −= amount`, `stealth += net`, `sol_fee += fee`.
  4. **Rent-reserve guard:** require `sol_vault.lamports() − amount ≥ Rent::minimum_balance(sol_vault.data_len())`. The reserve sits *under* all depositor balances, so correct accounting never reaches it; the guard is a fail-safe.
  5. CPI `create_transfer_announcement` with `token_mint = NATIVE_SOL_MINT` (depositor is the announcement signer / rent payer).
  6. Emit `VaultWithdrawEvent` (with `mint = NATIVE_SOL_MINT`).

  `encrypted_amount` / `proof` mirror the token `withdraw_private` signature — carried for announcement parity and off-chain verification; format-checked, unused on-chain (as today).
- **`refund_sol` / `authority_refund_sol`** — return the depositor's unlocked balance to the depositor via checked lamport mutation. Same constraints as the token refunds: destination is the **original depositor only**, `refund_timeout` enforced (authority does not bypass the cooldown), reverts on `paused` (authority variant).
- **`collect_fee_sol(amount)`** — authority-only; drains `SolFee` lamports to the authority (above the fee PDA's rent reserve). `amount == 0` collects all available.

The stealth recipient in `withdraw_private_sol` is a plain writable account (no ATA, no mint check) — simpler than the token path. Lamport mutation (rather than a system CPI) is required because the source is a program-owned PDA; this is the single highest-risk operation and is fenced by checked arithmetic + the rent guard.

### 5.3 Token track (migration + Token-2022 allowlist)

- Migrate the existing token instructions: `Token → Interface<'info, TokenInterface>`, `Account<'info, TokenAccount> → InterfaceAccount<'info, TokenAccount>`, `Account<'info, Mint> → InterfaceAccount<'info, Mint>`, `token::transfer → token_interface::transfer_checked(.., amount, decimals)` (Token-2022 requires checked transfers). Classic SPL rides the identical path.
- **Extension allowlist, enforced at `create_vault_token`** — the choke point, since `deposit` requires the per-mint vault PDA to exist. On creation, parse the mint's extension TLV (`spl_token_2022::extension::StateWithExtensions::<Mint>::unpack(..).get_extension_types()`) and apply a **fail-closed accept-list**:
  - ✅ **Accept** only: *no extensions* (classic SPL), `MetadataPointer`, `TokenMetadata`, `InterestBearingConfig`.
  - ❌ **Reject** everything else — explicitly including `PermanentDelegate`, `ConfidentialTransferMint`, `TransferHook`, `TransferFeeConfig`, `NonTransferable`, `DefaultAccountState`, and any **unknown/future** extension (fail closed) → `UnsupportedMintExtension`.
- **Why the choke point suffices:** every rejected extension is **init-immutable** on the mint (cannot be added after mint creation), so gating at vault-creation cannot be bypassed by a later mint mutation. Documented as a security invariant; revisit if a future Token-2022 version makes any rejected extension mutable.

### 5.4 Sentinel mint + announcement contract (SDK-facing — pinned here)

- Native SOL is represented by `NATIVE_SOL_MINT = Pubkey::default()` in the `DepositRecord` seed and the `create_transfer_announcement` `token_mint` argument.
- `sip-privacy` records it as opaque metadata → **no `sip-privacy` change**.
- **Contract the SDK follow-on MUST honor:** a `TransferRecord` / `VaultWithdrawEvent` with `mint == Pubkey::default()` ⇒ native SOL → the scanner reads the stealth account's **lamports** (not an ATA); any other value ⇒ an SPL/Token-2022 mint → read the stealth ATA.

### 5.5 DepositRecord & events

- `DepositRecord` is reused unchanged; `token_mint` holds the real mint or `NATIVE_SOL_MINT`; `balance` is lamports or token base units.
- `VaultWithdrawEvent` gains an explicit **`mint: Pubkey`** field for clean off-chain native-vs-token decode (the only struct change).

### 5.6 Errors (new variants)

- `UnsupportedMintExtension` — mint carries a non-allowlisted (or unknown) Token-2022 extension.
- `RentReserveViolation` — a native withdrawal/refund/fee-collect would drain a SOL PDA below its rent-exempt minimum.
- `InvalidSolVault` — SOL vault / fee PDA mismatch.

## 6. Instruction inventory

| Instruction | Before | After |
|---|---|---|
| `initialize`, `set_paused` | ✅ | ✅ unchanged |
| `create_vault_token` | classic only | + Token-2022 interface **+ extension allowlist gate** |
| `create_fee_token` | classic only | + interface |
| `deposit` / `withdraw_private` / `refund` / `authority_refund` / `collect_fee` | classic `Transfer` | interface + `transfer_checked` |
| `create_sol_vault` | — | **new** |
| `deposit_sol` / `withdraw_private_sol` / `refund_sol` / `authority_refund_sol` / `collect_fee_sol` | — | **new** |

## 7. Account contexts

- **Modified token contexts:** swap concrete `Token`/`TokenAccount`/`Mint` types for the `*Interface` equivalents; `CreateVaultToken` additionally receives the mint account-info to parse extensions.
- **New native contexts:** `CreateSolVault` (config, sol_vault `init`, sol_fee `init`, payer, system_program); `DepositSol` (config, deposit_record `init_if_needed`, sol_vault, depositor signer, system_program); `WithdrawPrivateSol` (config, deposit_record `has_one = depositor`, sol_vault, sol_fee, stealth `AccountInfo` mut, depositor signer, + the three sip-privacy CPI accounts + system_program); `RefundSol` / `AuthorityRefundSol` / `CollectFeeSol` mirroring their token counterparts without token accounts.

## 8. Security considerations

- **Lamport mutation** (`withdraw_private_sol`, `refund_sol`, `authority_refund_sol`, `collect_fee_sol`): all arithmetic checked; rent-reserve guard on every debit of a SOL PDA; debit-first ordering (reduce `DepositRecord.balance` before moving lamports).
- **Allowlist completeness:** fail-closed (unknown extensions rejected). One test per rejected extension; the accept-list is the only path that proceeds.
- **Custody boundary unchanged:** `authority_refund_sol` returns funds to the original depositor only; `collect_fee_sol` touches the fee PDA only; neither can redirect principal. Upgrade authority remains the residual trust (mainnet → Squads v4 2-of-3).
- **Commingling model unchanged:** depositor signs every withdrawal; native and token tracks share this property.
- **Sub-rent-exempt native payouts:** a stealth recipient receiving a native amount below the rent-exempt minimum yields a non-rent-exempt account; it persists while lamports remain `> 0` and the recipient can move it later (no fund loss). Noted for the audit; v1 adds no minimum-payout floor.

## 9. Testing strategy (TS / ts-mocha, matching `tests/sipher-vault/`)

- **Native:** `create_sol_vault`; `deposit_sol`; `withdraw_private_sol` (debit-first, fee split, **rent-reserve guard**, announcement with sentinel mint); `refund_sol`; `authority_refund_sol` (timeout + depositor-only); `collect_fee_sol`.
- **Token-2022:** `create_vault_token` accepts a plain T22 mint and an accept-listed-extension mint; **rejects each disallowed extension** (one test each: permanent-delegate, transfer-fee, transfer-hook, confidential, non-transferable, default-frozen) + an unknown-extension fail-closed case; `transfer_checked` happy path; deposit + withdraw round-trip.
- **Classic SPL regression:** the existing suite passes unchanged after the interface migration.
- **Sentinel:** a native withdrawal emits `VaultWithdrawEvent { mint == Pubkey::default() }` and an announcement with `token_mint == Pubkey::default()`.

## 10. Deployment

- **Devnet (now):** `anchor build` → `solana program deploy` to devnet (authority `FGSkt8…`, per CLAUDE.md), regenerate the IDL, run `create_sol_vault`. `VaultConfig` is unchanged (same fee / timeout). The pilot uses native SOL directly.
- **Mainnet (gated):** deferred behind the **self-audit complete** rule and the upgrade + config authority moving to the **Squads v4 2-of-3** multisig.

## 11. Out of scope / follow-ons

- SDK native-SOL **scan** + **gasless cash-out** (consume the §5.4 contract) — next spec.
- Integrator client — separate spec; partly gated externally.
- `sip-privacy` Token-2022 parity — tracked as sip-protocol#1160 (mainnet, separately gated).

## 12. Decisions log

1. **Approach A** (separate native instructions; token path widened in place) over unified-branching (B) or program-side wrapping (C) — isolates high-risk lamport code; single-purpose instructions; smallest audit blast radius.
2. **Sentinel = `Pubkey::default()`** over the wSOL mint (which is an ambiguous, legitimate SPL deposit).
3. **`mint: Pubkey` added to `VaultWithdrawEvent`** for clean off-chain decode.
4. **Allowlist enforced at `create_vault_token`**, fail-closed, justified by the init-immutability of every rejected extension.
5. **Conservative Token-2022 v1** (reject fee/hook/confidential/delegate/non-transferable/default-frozen) — minimize audit surface; fee-bearing support is a possible later multisig-governed upgrade.
