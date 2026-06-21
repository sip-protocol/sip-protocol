# Sipher Vault — Internal Security Self-Audit

| | |
|---|---|
| **Date** | 2026-06-19 |
| **Program** | `sipher_vault` · Anchor 1.0.2 · `programs/sipher-vault/programs/sipher-vault/src/` |
| **Deployment** | devnet `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` (this audit gates the mainnet deploy) |
| **Audit type** | Internal self-audit (the decided milestone approach). **Not** an independent external review — see §9. |
| **Method** | Static source review across 6 adversarial dimensions + targeted empirical verification |
| **Scope** | `sipher_vault` (15 instructions, ~1360 LOC) + the SDK gasless cash-out relayer |

---

## 1. Executive Summary

**Zero Critical, zero High.** Six independent adversarial review passes — each tasked with stealing, draining, freezing, or bypassing the vault — instead *proved* the core fund-custody properties hold from source:

1. **A bounded-but-malicious authority cannot touch depositor principal.** Authority refunds are `has_one = depositor` + timeout-gated; fee collection only drains the separate fee sinks. Proven exhaustively over every authority-gated instruction.
2. **Per-mint and native-SOL solvency hold.** Debit-first ordering + checked arithmetic + a rent-reserve fail-safe; cross-mint and cross-depositor isolation are enforced by PDA seeds + `has_one`.
3. **No silent-overflow drain surface.** Every lamport/balance/fee operation is `checked_*`; the native-SOL lamport mutations are aliasing-free with a rent guard on every debit.
4. **The Token-2022 extension allowlist is genuinely fail-closed.** It rejects transfer-fee / transfer-hook / permanent-delegate / non-transferable / and *unknown/future* extensions; the three allowed extensions are transfer-neutral for raw-amount accounting.
5. **The cross-program announcement CPI is byte-exact** (Borsh layout + discriminator independently re-derived), makes no re-entrant call, and degrades to an atomic revert under any account substitution — never theft or corruption.
6. **The SDK gasless relayer leaks no recipient secret**, its fee math cannot over-take or underflow, the ed25519 stealth scalar signer is cryptographically correct (verified on 200 random scalars, with malleated signatures rejected), and no failure mode strands funds.

The findings below — **6 Medium, 5 Low, 4 Info** — are pre-mainnet hardening, latent-footgun prevention, and honest-disclosure items. **None is a fund-theft exploit.** One was an *active functional defect* rather than a latent one: M6 (the withdrawal-path stack overflow) aborted `withdraw_private` at runtime under the platform-tools v1.52 build — now resolved by the Anchor 1.0.2 migration (`8c79a33`), which `Box`-es the heavy `WithdrawPrivate` accounts off the validation stack frame. **The remaining code findings are resolved in the accompanying hardening PR (M1, M2, M3, L3, I1–I4 — see Appendix A);** the disclosure items (M4, M5, L1) live in this report and the deploy runbook.

---

## 2. Scope

**In scope (reviewed line-by-line):**
- `programs/sipher-vault/programs/sipher-vault/src/{lib.rs, state.rs, errors.rs, constants.rs}`
- SDK gasless cash-out: `packages/sdk/src/chains/solana/{gasless-cashout,relayer-fee,stealth-signer,scan,sol-transfer}.ts` and `packages/sdk/src/solana/jito-relayer.ts`

**Out of scope (reviewed only at the boundary):**
- The `sip_privacy` program internals — examined only at the `create_transfer_announcement` CPI surface (§8).
- The Squads v4 multisig program — adopted as the mainnet authority; separately audited by 4 firms + 2 formal-verification engagements (governance decision record).
- The off-chain agent / SENTINEL orchestration layer.

---

## 3. Methodology

Six independent reviewers, one per threat dimension, each instructed to red-team — *find a way to break it; if you cannot, prove why it is safe* — and to cite source `file:line` for every claim:

1. Authority model, signer enforcement, PDA/account validation
2. Accounting correctness and the solvency invariant
3. Arithmetic, lamport-mutation, and rent safety
4. Token-2022 / SPL-interface safety
5. The `sip_privacy` CPI (correctness, account validation, liveness coupling, disclosure)
6. The SDK gasless relayer (trust boundary, fee math, key handling, failure modes)

**Empirical checks beyond static review:** the CPI's manual Borsh encoding and discriminator were re-derived independently and matched byte-for-byte; the stealth scalar signer was reimplemented and verified against a standard ed25519 verifier on 200 random raw scalars (200/200 pass; non-canonical `S` rejected).

**Test harness.** The program is tested with the **solana-bankrun raw-instruction** harness (the suite predates an Anchor TS-client setup). Building the `.so` uses platform-tools **v1.52** (rustc 1.89) — the toolchain Anchor 1.0.2 targets (see Appendix B).

---

## 4. System & Threat Model

`sipher_vault` is a **deposit-first commingling vault**. Depositors move SPL tokens, Token-2022 tokens, or native SOL into shared, program-owned PDAs; the per-`(depositor, mint)` `DepositRecord` tracks each depositor's balance. Withdrawals are **debit-first and depositor-signed**: the depositor signs, their record is debited, the net is sent to a one-time stealth recipient and the fee to a fee sink, then a metadata-only CPI announces the payment for scannability.

- **Vault holdings:** per-mint `vault_token` PDA (`token::authority = config`); singleton `sol_vault` PDA for native SOL; fee sinks `fee_token(mint)` and `sol_fee`.
- **Authority** (`config.authority`): may pause, collect fees, and authority-refund (to the original depositor only, timeout-enforced). At mainnet the authority becomes a **Squads v4 2-of-3 multisig**.
- **Privacy model:** *commingling, not cryptographic hiding* (see §7). Unlinkability comes from a shared, aggregating depositor batching many users — the deposit↔stealth link and the net amount are public on-chain.

**Adversaries assumed:** (a) an external attacker, (b) a malicious depositor, (c) a malicious-but-bounded authority. **Goals attempted:** steal/redirect another depositor's principal, break per-mint or native solvency, freeze funds, bypass a signer/authority check, abuse a Token-2022 mint, or abuse the CPI.

---

## 5. Proven-Safe Invariants

Each was an explicit hypothesis the reviewers tried to break and could not:

- **Authority is bounded — cannot reach principal.** The only authority-gated fund instructions are `authority_refund[_sol]` (destination forced to the seed-bound original depositor via `has_one = depositor`; amount capped at that depositor's balance; timeout enforced) and `collect_fee[_sol]` (source is the `fee_token` / `sol_fee` sink — the contexts have no `vault_token` / `sol_vault` field, so principal is structurally unreachable). `set_paused` moves nothing. *(lib.rs:487–527, 580–618, 622–648, 658–677; contexts 1151–1325.)*
- **Per-mint token solvency.** For every mint, `Σ DepositRecord.balance ≤ vault_token.amount`. `deposit` credits the record by exactly the transferred amount; `withdraw_private` debits by `amount` and moves out `net + fee = amount`; `refund`/`authority_refund` move out `available` and zero it. *(lib.rs:181–223, 232–330, 443–527.)*
- **Native-SOL solvency + rent fail-safe.** `Σ native balance ≤ sol_vault.lamports − rent_min`, enforced both by accounting and, independently, by a `checked_sub` + `require!(new_vault ≥ rent_min)` on every `sol_vault` debit — so even corrupted accounting cannot drain below the rent floor. *(lib.rs:390–397, 554–558, 601–605.)*
- **Checked arithmetic, no wrap, aliasing-free.** No raw `+=`/`-=` on any lamport/balance/fee (BPF release wraps silently); all 9 native lamport writes are full-value assignments after checked computation. The three accounts mutated in `withdraw_private_sol` cannot alias (program-owned `SolVault`/`SolFee` PDAs with distinct seeds vs a System-owned `SystemAccount` recipient). *(lib.rs:381–408.)*
- **Token-2022 allowlist is fail-closed.** Gated on the mint's real program owner; a malformed TLV → reject; only `MetadataPointer`, `TokenMetadata`, `InterestBearingConfig` allowed (all transfer-neutral for raw amounts); every other / unknown / future extension is rejected, so a fee/hook/permanent-delegate/non-transferable mint can never obtain a `vault_token` and thus can never be deposited or withdrawn. *(lib.rs:83–114.)*
- **CPI is byte-exact, non-re-entrant, substitution-safe.** The manual Borsh encoding matches `create_transfer_announcement` exactly; the callee makes no CPI (no re-entrancy) and the vault debits before the CPI regardless; `sip_config` (seeds), `sip_privacy_program` (address) are pinned, and a substituted `sip_transfer_record` can only fail the callee's `init` → atomic revert, never theft. *(lib.rs:726–782, 1011–1035.)*
- **SDK relayer.** Recipient secrets never reach the relayer (it receives only the already-signed serialized tx); `fee + net = gross` with `net` strictly positive; the scalar signer is correct and never logs/persists the scalar; a self-paid `claimStealthPayment` fallback guarantees funds are never stranded.

---

## 6. Findings

> Severity reflects custody impact. **None of these is an active exploit on the live program** — they are hardening, latent-footgun, disclosure, and forward-integration items. `file:line` references are to `programs/sipher-vault/programs/sipher-vault/src/lib.rs` unless noted.

### Medium

**M1 — No authority-rotation / fee-update instruction.** `config.authority` and `fee_bps` are set once at `initialize` and have no setter (only `paused` is mutable). The mainnet plan makes the authority a Squads 2-of-3 multisig; with no `update_authority` the authority can never be rotated without a full redeploy of a live custody program, and there is no recovery from a compromised key. *(whole `#[program]` mod; state.rs:5–13.)*
**Remediation:** add a two-step `update_authority` (propose / accept via a `pending_authority` field) + `update_fee` (cap-checked), both `has_one = authority`. This also lets the program deploy with a deploy key and hand off to the multisig in a controlled tx (subsumes L2).

**M2 — `locked_amount` is inert dead state.** `DepositRecord.locked_amount` is never written to a non-zero value by any instruction, and `BalanceLocked` is dead. `available == balance` always. Safe for solvency, but a custody struct shipping a load-bearing-looking field that is never enforced is an audit smell and an integration footgun: an SDK scheduler (drip/recurring/split) that treats `balance − reserved` as authoritative will be wrong, because the chain honors a full-`balance` withdraw/refund. *(state.rs:21; reads at lib.rs:248/363/446/492/536/585; errors.rs:26.)*
**Remediation (decided):** remove `locked_amount` + `BalanceLocked`; scheduled-send reservations are tracked off-chain with an explicit "the chain does not enforce this" contract.

**M3 — `refund` assigns `balance = locked_amount` (`=`, not `−= available`).** Safe today (the preceding `checked_sub` guard + `locked_amount ≡ 0`), but the assignment form means that if a future edit ever let `locked_amount > balance` and reordered the guard, a depositor's balance would *inflate* → insolvency. *(lib.rs:477, 523, 567, 614.)*
**Remediation:** subsumed by M2 (with `locked_amount` removed, refund becomes `balance = 0`).

**M4 — Privacy disclosure: the depositor↔stealth link and net amount are public.** `create_transfer_announcement` stores `TransferRecord.sender = depositor` (and the depositor is in the PDA seeds and in two emitted events), and `VaultWithdrawEvent.transfer_amount` is plaintext. This is the documented commingling model, but it must be stated plainly so it is never mis-sold: **a direct end-user deposit→withdraw provides essentially no privacy.** Unlinkability requires the depositor to be a shared aggregating wallet. *(lib.rs:301–326, 411–436; sip_privacy `TransferRecord.sender`.)* — see §7.
**Remediation:** documented here + in the integration notes; not a code change. A trustless (nullifier-based) withdrawal that breaks the on-chain sender link is future work (M19).

**M5 — No native-SOL gasless cash-out path in the SDK.** `buildGaslessCashout` is SPL-token-only; native SOL goes through the self-paid `sol-transfer` path (which already enforces the recipient rent floor). Safe today. But the universal-asset vault now supports native-SOL withdrawals on-chain, so **if** a native-SOL gasless cash-out is built on top, it MUST guarantee `net ≥ rent-exempt-min` for a fresh stealth recipient or the runtime fails the tx closed.
**Remediation:** documented as a forward integration requirement; gate any native-gasless work on the rent pre-funding check.

**M6 — `WithdrawPrivate` account-validation stack frame exceeds the BPF limit.** The SBF build reports `WithdrawPrivate::try_accounts` at an estimated 4416-byte frame, exceeding the 4096-byte BPF stack limit ("Stack offset of 4120 exceeded max offset of 4096 by 24 bytes … may cause undefined behavior during execution"). The context is account-heavy (`vault_token`, `fee_token`, `stealth_token`, `token_mint`, plus the four `sip_privacy` CPI accounts). **This was not merely latent:** the remediation pass confirmed that under the platform-tools v1.52 build `withdraw_private` aborts at runtime with "Access violation in unknown section at address 0x8 of size 8", taking the token-withdrawal path (and the dependent fee collection) down with it — only the lighter native-SOL `WithdrawPrivateSol` context was unaffected. It is a functional break of the token-withdrawal path, not a fund-theft exploit (the transaction reverts atomically). Pre-existing on `main` (introduced with the universal-asset context); surfaced by this audit's build. *(`WithdrawPrivate` context, lib.rs:962–1035; `WithdrawPrivateSol` verified within the limit.)*
**Remediation: Resolved by the Anchor 1.0.2 migration (`8c79a33`).** The 1.0 dup-check codegen enlarges the `try_accounts` frame, which forced the migration to `Box<>` the four heavy `InterfaceAccount` fields in `WithdrawPrivate` — the same fix this finding called for — moving them off the validation stack frame. The SBF build now emits no stack-offset warning, `withdraw_private` completes, and the bankrun suite is green. *(This hardening PR is rebased onto the migrated 1.0.2 base, so it carries no separate M6 commit.)*

### Low

**L1 — Cross-program liveness coupling to `sip_privacy`.** `withdraw_private[_sol]` reverts if `sip_privacy` is paused or uninitialized (the announcement CPI is mandatory and the tx is atomic). Funds are **never trapped** — `refund`/`refund_sol` make no CPI and let depositors self-recover after the timeout. *(lib.rs:301, 411; refund paths 443–571.)*
**Remediation:** document the dependency in the deploy runbook; govern both programs' pause authorities coherently under the same multisig.

**L2 — `initialize` is permissionless (first-caller becomes authority).** A deploy-time front-runner could become `config.authority`, gaining pause + fee-skim (not principal). *(lib.rs:55–73.)*
**Remediation:** resolved operationally by M1 (deploy with a key, hand off to the multisig) and by initializing atomically at deploy.

**L3 — `encrypted_amount` is unbounded in the vault.** The callee caps it at 64 bytes; an over-long blob reverts the whole withdrawal (depositor self-grief only — honest callers send ~48 bytes). *(lib.rs:239, 354.)*
**Remediation:** add an early `require!(encrypted_amount.len() ≤ 64)` guard before the debit (fail-fast, vault-native error).

**L4 — `getStealthBalance` returns `0n` on any RPC error.** A transient RPC failure is indistinguishable from "empty." Not used by the cash-out builder. *(scan.ts.)*
**Remediation:** distinguish not-found from RPC error, or document the best-effort semantics. Deferred (SDK robustness).

**L5 — `total_deposits` saturating vs `total_depositors` checked.** Cosmetic metric inconsistency; both unreachable at `u64::MAX`; no fund impact. *(lib.rs:159/214 vs 161/216.)* Accepted.

### Info / cleanup

- **I1 — Dead constant `SIP_TRANSFER_RECORD_SEED`** (lib.rs:42), never used — remove to avoid implying a validation that isn't there.
- **I2 — `token::token_program` not bound** on non-init token constraints. The runtime's own ownership check backstops it (a mismatch reverts with `IncorrectProgramId`), so no exploit; adding the binding yields a clearer Anchor error. Defense-in-depth.
- **I3 — `create_fee_token` lacks the Token-2022 allowlist.** Inert (a mint must clear the allowlist at `create_vault_token` before any withdrawal can route fees), but mirror it for defense-in-depth and to keep the two paths from diverging.
- **I4 — `init_if_needed` on `deposit_record`** is safe here (accumulate-not-reset, `is_new` derived from `cumulative_volume`), but pin the invariant with a comment so a future field-reset edit doesn't reintroduce a bug.

---

## 7. Privacy Boundary (M4 — read this verbatim)

> `sipher_vault`'s `withdraw_private[_sol]` records the **depositor public key on-chain** — in `TransferRecord.sender`, in the `TransferRecord` PDA seeds, and in both `ShieldedTransferEvent` and `VaultWithdrawEvent` — and the **net transfer amount is plaintext**. The depositor↔stealth link and the amount are **PUBLIC**. Unlinkability is achieved by **commingling** and requires the depositor to be a **shared aggregating wallet** batching many users. It is **not** cryptographic amount-hiding and **not** a trustless nullifier mixer. A direct end-user deposit→withdraw provides essentially no privacy. The Pedersen commitment and viewing key are for scannability and selective-disclosure compliance, not for hiding the settlement amount.

This boundary is intrinsic to the current design and must appear in any integration-facing material.

---

## 8. Cross-Program & Operational Dependencies

- **Announcement CPI is mandatory.** Every private withdrawal CPIs `sip_privacy::create_transfer_announcement` (metadata-only, no funds moved). The encoding is byte-exact and the accounts are pinned; a failure reverts the whole atomic tx. The vault debits the record *before* the CPI (debit-first), so there is no double-withdraw even under hypothetical re-entrancy.
- **Liveness coupling (L1).** A paused/uninitialized `sip_privacy` halts vault withdrawals — but never traps funds (`refund` self-recovery has no CPI). Govern both programs under the same authority.
- **Native-gasless gap (M5).** Gasless cash-out is SPL-only today; native-SOL recipients use the self-paid path that already enforces the rent floor.

---

## 9. Residual Risk & Mainnet (B7) Gate Checklist

This is a **self-audit, not an independent external review.** For a fund-custody program, an external audit is recommended **before scaling real user funds**; a devnet pilot and a limited-value mainnet launch on the strength of this self-audit + the hardening PR is the planned, accepted posture.

> **⚠️ Breaking account-layout change (this hardening PR).** M1 adds
> `VaultConfig.pending_authority` and M2 removes `DepositRecord.locked_amount`,
> changing both struct layouts. There is no migration/`realloc` instruction, so
> the new-layout program is **not a safe in-place upgrade** over any program
> holding old-layout accounts — the existing devnet config/records would be
> bricked (`AccountDidNotDeserialize` on `config`; shifted/corrupt deposit
> records → unwithdrawable). The **held devnet redeploy** must use fresh accounts
> (new program ID + fresh `initialize`, or close/recreate). Mainnet B7 is a fresh
> deploy → unaffected. Surfaced + verified against live devnet account sizes by
> the post-hardening independent review; full runbook detail in `DEPLOYMENT.md` →
> "Devnet Upgrade".

Before the mainnet deploy (B7):

- [x] **M1 landed** (`0528d49`) — `update_authority` (two-step) + `update_fee` present and tested.
- [x] **M2/M3 landed** (`3dbc44f`) — `locked_amount` removed; refund zeroes balance.
- [x] **L3 landed** (`d915b5f`) — `encrypted_amount` length guard.
- [x] **M6 resolved by the Anchor 1.0.2 migration** (`8c79a33`) — `WithdrawPrivate` stack frame back under 4096 B (Box accounts); build warning cleared, `withdraw_private` completes.
- [x] **I1/I2/I3/I4 landed** (`1b540a8`, `b4668e6`) — dead constant removed; token-program bindings; fee-token allowlist; init_if_needed invariant comment.
- [ ] **Authority = Squads v4 2-of-3 multisig** set at (or handed off immediately after) `initialize`; both the BPF upgrade authority and the in-program `config.authority` point at the multisig.
- [ ] **`sip_privacy` and `sipher_vault` pause authorities governed coherently** under the same multisig (L1).
- [ ] **Deploy runbook** documents: the privacy boundary (§7), the `sip_privacy` liveness coupling (L1), the SDK rent pre-funding obligation for native payouts (M5), the build toolchain requirement (Appendix B), and the **breaking account-layout change** (M1/M2 — no safe in-place upgrade; fresh accounts required; see `DEPLOYMENT.md`).
- [ ] **External audit** scheduled before scaling beyond limited mainnet value.

---

## Appendix A — Findings table

| ID | Severity | Title | Disposition |
|----|----------|-------|-------------|
| M1 | Medium | No `update_authority` / `update_fee` | ✅ Resolved `0528d49` |
| M2 | Medium | `locked_amount` inert dead state | ✅ Resolved `3dbc44f` |
| M3 | Medium | `refund` assigns `= locked_amount` | ✅ Resolved `3dbc44f` (subsumed by M2) |
| M4 | Medium | Privacy disclosure (depositor + amount public) | Documented (§7) — no code change |
| M5 | Medium | No native-SOL gasless path (rent pre-funding) | Documented — forward integration gate |
| M6 | Medium | `WithdrawPrivate::try_accounts` stack frame > 4096 B | ✅ Resolved `8c79a33` (Anchor 1.0.2 migration) |
| L1 | Low | `sip_privacy` liveness coupling | Documented — runbook |
| L2 | Low | `initialize` permissionless | ✅ Resolved `0528d49` (via M1) |
| L3 | Low | `encrypted_amount` unbounded | ✅ Resolved `d915b5f` |
| L4 | Low | `getStealthBalance` swallows RPC errors | Deferred (SDK) |
| L5 | Low | counter saturating vs checked | Accepted |
| I1 | Info | dead `SIP_TRANSFER_RECORD_SEED` | ✅ Resolved `1b540a8` |
| I2 | Info | `token::token_program` not bound | ✅ Resolved `1b540a8` |
| I3 | Info | `create_fee_token` no allowlist | ✅ Resolved `b4668e6` |
| I4 | Info | `init_if_needed` invariant comment | ✅ Resolved `1b540a8` |

## Appendix B — Build toolchain note

The program builds with **platform-tools v1.52** (rustc 1.89.0), the toolchain Anchor 1.0.2 targets: `cd programs/sipher-vault && cargo build-sbf --tools-version v1.52`. Pass the flag explicitly — Agave 3.0.13 may default to platform-tools v1.51 (rustc 1.84.1), which is below Anchor 1.0.2's MSRV. The Anchor 1.0.2 migration this PR is rebased onto also dissolved an earlier `blake3 → constant_time_eq 0.4.2` (edition2024) regression that had broken the build on the 0.30.1-era v1.51, by dropping the explicit `blake3` pins entirely.
