# Sipher Vault Deployment Guide

Deployment records and procedures for the `sipher_vault` Anchor program — a privacy-preserving deposit/withdraw vault that performs a CPI into `sip_privacy::create_transfer_announcement` to materialize stealth transfer announcements on-chain.

## Program Coordinates

| Field | Value |
|-------|-------|
| Program ID | `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` |
| Program Keypair | `~/Documents/secret/sipher-vault-program-id.json` |
| Authority Keypair | `~/Documents/secret/solana-devnet.json` |
| Authority Address (devnet) | `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` |
| Loader | `BPFLoaderUpgradeab1e11111111111111111111111` |

## Toolchain

| Tool | Version |
|------|---------|
| Anchor CLI | `0.30.1` |
| Solana CLI | `3.0.13` (Agave) |
| platform-tools | `v1.51` (rustc `1.84.1`, target SBF) |
| Host rustc | `1.94.1` (build only — IDL gen requires `--no-idl`) |

> **Build note:** anchor 0.30.1's IDL generator depends on `proc_macro2::Span::source_file()`,
> a nightly-only proc-macro API removed from current host rustc. Use `anchor build --no-idl`;
> the on-chain SBF binary is unaffected. The IDL artifact at `target/idl/sipher_vault.json`
> is regenerated from earlier compatible host toolchains.

## Devnet Deployments

### Devnet — Initial Deploy (2026-03-31)

- First devnet deployment of pre-CPI binary (commit `ca3a5a7`)
- Config PDA: `CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u`
- Config: 10 bps fee, 86400s refund timeout
- Authority: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (devnet wallet)
- Binary size: 353 KB (pre-CPI)

### Devnet — Phase 4a CPI Upgrade (2026-05-06)

- Upgraded from pre-CPI binary (Mar 31, 2026) to CPI version (commit `3c81ad0`)
- Upgrade TX: `395LeypDVog8J6QuGxMKekFwG4WdhMgqq4MRB91EfG2LPAg4tcttTAVyWN6saqMjsjn7hZgpTMzpWy4nUhH3YDbp`
- New deployed slot: `460367898`
- Binary size: `376664` bytes
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (devnet wallet)

### Devnet — Phase 4a `set_paused` Upgrade (2026-05-06)

Second devnet upgrade in Phase 4a — adds the authority-gated `set_paused`
instruction (commit `0f701e5`) on top of the CPI binary.

- Upgrade TX: `utoZnnbbaNz6X6VxybwpF6odKxDB8H28Kh3bwP3M3abJEHHdEBXv7tPcCaeJqAMT9vUJQazcUbLidPyNb2egkNy`
- Previous deployed slot: `460367898` (CPI upgrade)
- New deployed slot: `460374492`
- Binary size: `382112` bytes (Δ from prior `376_664` reflects the
  new instruction handler + accounts struct)
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`

### Devnet — Phase 4a `VaultPausedEvent` Upgrade (2026-05-06)

Third devnet upgrade in Phase 4a — adds the `VaultPausedEvent` emit to
`set_paused` so off-chain monitoring tooling can subscribe to state
changes. Same authority, same RPC, same config PDA.

- Upgrade TX: `4xZyApH8pjb4rUerXmKL6oodC6JKHDTes2y1k5jKHPGnjTR59ADRCMXccAKsBftdgB7bijT84KpDF8vsDxTagi1T`
- Previous deployed slot: `460374492` (set_paused upgrade)
- New deployed slot: `460376111`
- Binary size: `383144` bytes (Δ from `382112` reflects the
  event struct + emit call)
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`

## Mainnet Deployments

_Not deployed. See Phase 4b plan for mainnet rollout sequencing._

## Procedures

### Devnet Upgrade

Use the atomic upgrade script:

```bash
cd programs/sipher-vault
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm exec tsx scripts/upgrade-devnet.ts
```

The script verifies the program keypair, runs `anchor clean && anchor build --no-idl`,
deploys via `BPFLoaderUpgradeable`, and prints the new deployed slot. Idempotent —
running again redeploys.

### Mainnet Upgrade

_TODO: add `upgrade-mainnet.ts` in PR-B1._
