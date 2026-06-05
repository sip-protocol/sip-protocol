# Dependency Security Audit

| Field | Value |
|-------|-------|
| **Document** | DEP-AUDIT-001 |
| **Version** | 2.0.0 |
| **Date** | 2026-06-06 |
| **Tool** | GitHub Dependabot · `pnpm audit` · `cargo`/Cargo.lock review |
| **Status** | Active |

## Executive Summary

This document tracks known vulnerabilities in SIP Protocol dependencies and their mitigation status.

**Current status: 0 critical · 0 high.** The two HIGH-severity advisories tracked in v1.0.0
(`bigint-buffer`, `qs`) were **resolved** in the 2026-06-05 Dependabot sweep (46 → 10 open
alerts; see [§3 Resolved](#3-resolved-historical) and PRs #1092–#1095).

The **10 remaining open Dependabot alerts** (5 medium · 5 low) have each been triaged against
the *actual* vulnerable code path — not just the version range. The conclusion, with evidence
recorded below, is that **none are exploitable in SIP's usage**:

- **8 are recommended for dismissal as "not affected"** — the vulnerable API/path is provably
  unreachable (transitive deps whose consumers never call the vulnerable function), or the crate
  is host-side test/build tooling that is never linked into the on-chain BPF binary.
- **2 are deferred** (`borsh`, `curve25519-dalek`) — they reach the on-chain graph through
  `solana-program 1.18.26`, their only patch is a major bump, and that graph is deliberately
  frozen by the `anchor-lang 0.30.1` / platform-tools v1.51 toolchain pin. Their practical
  exposure is low; they are tracked for the next Solana/Anchor toolchain upgrade.

## 1. Vulnerability Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | ✅ |
| High | 0 | ✅ |
| Medium | 5 | 🔍 Triaged — 4 not-affected, 1 deferred (`borsh`) |
| Low | 5 | 🔍 Triaged — 4 not-affected, 1 deferred (`curve25519-dalek`) |

**Disposition at a glance:**

| Alert | Package | Sev | Manifest | Vulnerable code path | Disposition |
|-------|---------|-----|----------|----------------------|-------------|
| #123 | uuid | med | `pnpm-lock.yaml` (root) | `v3/v5/v6` with caller `buf` | Dismiss — not affected |
| #124 | uuid | med | `programs/sip-privacy/package-lock.json` | `v3/v5/v6` with caller `buf` | Dismiss — not affected |
| #125 | uuid | med | `programs/sipher-vault/pnpm-lock.yaml` | `v3/v5/v6` with caller `buf` | Dismiss — not affected |
| #142 | elliptic | low | `pnpm-lock.yaml` (root) | ECDSA **signing** | Dismiss — verify-only, no patch |
| #76 | atty | low | `programs/sipher-vault/Cargo.lock` | Windows unaligned read | Dismiss — host-only, no patch |
| #93 | rand | low | `programs/sipher-vault/Cargo.lock` | `rand::rng()` + custom logger | Dismiss — host-only |
| #92 | rand | low | `programs/sip-privacy/Cargo.lock` | `rand::rng()` + custom logger | Dismiss — host-only |
| #77 | ed25519-dalek | med | `programs/sipher-vault/Cargo.lock` | Mismatched-key **signing** oracle | Dismiss — host-only, matched-key |
| #75 | borsh | med | `programs/sipher-vault/Cargo.lock` | Non-`Copy` ZST deserialization | **Defer** — anchor-locked (major) |
| #78 | curve25519-dalek | low | `programs/sipher-vault/Cargo.lock` | `Scalar` subtraction timing | **Defer** — anchor-locked (major) |

## 2. Deferred Dependabot Alerts — Triage (2026-06-06)

### 2.0 Methodology

1. **Enumerate** all open alerts with full pagination
   (`gh api --paginate '/repos/sip-protocol/sip-protocol/dependabot/alerts?state=open'` —
   the default page silently undercounts).
2. **Read the advisory**, not just the version range — identify the *specific* vulnerable
   function / code path and the conditions required to trigger it (GitHub Advisory DB + CVE).
3. **Map the reverse-dependency path** (`pnpm why`, Cargo.lock parse) to find which package
   pulls the dep and at what version.
4. **Establish reachability** — confirm whether SIP code, or any transitive consumer, actually
   exercises the vulnerable path; for Rust, distinguish host-side (test/client/build) crates
   from those linked into the on-chain BPF program.

### 2.1 uuid — `v3/v5/v6` buffer-bounds (#123, #124, #125)

| Field | Value |
|-------|-------|
| **Package** | uuid |
| **Severity** | Medium · CWE-787 / CWE-1285 |
| **Advisory** | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) · CVE-2026-41907 |
| **Vulnerable** | `< 11.1.1` (also `12.0.0–12.0.0`, `13.0.0–13.0.0`) |
| **Patched** | 11.1.1 / 12.0.1 / 13.0.1 / 14.0.0 |
| **Description** | `v3()`/`v5()`/`v6()` accept an external output buffer but do not bounds-check writes (small `buf` or large `offset`) → silent partial write. `v1()`/`v4()`/`v7()` are **not affected** (they throw `RangeError`). |

**Dependency paths** (uuid is 100% transitive — zero direct dependency, zero `import` in SIP source):

```
root (pnpm-lock.yaml):
  langsmith@0.4.7, @langchain/core@0.3.80      → uuid@10.0.0  ⚠️
  @solana/web3.js@1.98.4 → jayson@4.3.0         → uuid@8.3.2   ⚠️
  @solana/web3.js@1.98.4 → rpc-websockets@9.3.2 → uuid@8.3.2   ⚠️
  rpc-websockets@9.3.9                          → uuid@14.0.0  ✅ already patched
sipher-vault (pnpm-lock.yaml):
  @solana/web3.js → jayson                      → uuid@8.3.2   ⚠️
  @solana/web3.js → rpc-websockets@9.3.7        → uuid@11.1.0  ⚠️ (one patch below 11.1.1)
sip-privacy (package-lock.json):
  @coral-xyz/anchor → @solana/web3.js → jayson  → uuid@8.3.2   ⚠️
```

**Risk Assessment**:
- **Exploitability**: Requires calling `v3`/`v5`/`v6` **and** passing an attacker-influenced
  external `buf`/`offset`. This is a rare embedded-optimization pattern.
- **Reachability — none**:
  - SIP source imports `uuid` **0 times** and calls `v3/v5/v6` **0 times** (grep over `packages/*/src`).
  - Every transitive consumer was inspected: `jayson`, `rpc-websockets`, `langsmith`,
    `@langchain/core` all use uuid for **random/ID generation only** (`v4`/`v1`); **none** call
    `v3`/`v5`/`v6` with an output buffer (grep for `v3(`/`v5(`/`v6(` call-sites → 0 hits each).
- **Data flow**: ID generation in RPC clients (`jayson`/`rpc-websockets`) and LLM-tracing tooling
  (`langsmith`/`langchain-core`) — never privacy-critical, never fed a caller buffer.

**Mitigation / Disposition**: **Dismiss — `not_used`.** The vulnerable API is unreachable on
multiple independent grounds. A blanket `pnpm.overrides` to force `uuid@11.1.1` was **rejected**:
it would force a cross-major bump on `jayson` (declares `^8`) and the `@solana/web3.js` RPC path
for **zero** security benefit, risking the Solana RPC client — exactly the "defer, don't gamble"
rule. (Note: the tree already proves compatibility with uuid 11.x/14.x via `rpc-websockets`,
so a future natural bump is low-risk; we simply do not force it now.)

### 2.2 elliptic — ECDSA `k`-truncation (#142)

| Field | Value |
|-------|-------|
| **Package** | elliptic |
| **Severity** | Low · CWE-1240 · CVSS AC:H |
| **Advisory** | [GHSA-848j-6mx2-7j84](https://github.com/advisories/GHSA-848j-6mx2-7j84) · CVE-2025-14505 |
| **Vulnerable** | `<= 6.6.1` |
| **Patched** | **None** — 6.6.1 (latest) is still vulnerable |
| **Description** | ECDSA **signature generation** mis-computes the byte-length of interim `k` when it has leading zeros → truncation → faulty signatures; under specific conditions an attacker holding a faulty signature can derive the secret key. The flaw is exclusively in the **signing** path. |

**Dependency path**:

```
@sip-protocol/sdk (and api/cli/react/react-native)
└── @magicblock-labs/ephemeral-rollups-sdk@0.14.4
    └── @phala/dcap-qvl@0.3.9            (DCAP Quote Verification Library)
        └── elliptic@6.6.1 ⚠️
```

**Risk Assessment**:
- **Exploitability**: Requires the vulnerable library to **generate** ECDSA signatures with a
  secret key, and the attacker to collect faulty signatures. Attack complexity is High; severity Low.
- **Reachability — none**: `@phala/dcap-qvl` is a Quote **Verification** library. Source inspection
  of `dcap-qvl/src/crypto-compat.js` shows every elliptic call site is **verify-only**:
  `new EC('p256')` → `ec.keyFromPublic(keyData)` → `key.verify(digest, signature)`.
  There is **no** `keyFromPrivate`, **no** `.sign()`, and **no** private key in the path. The
  vulnerable signing code is never invoked.
- **Data flow**: Intel TEE (SGX/TDX) attestation-quote signature verification, reached only via the
  optional MagicBlock ephemeral-rollups SDK. No SIP signing key is ever handled by this dependency.

**Mitigation / Disposition**: **Dismiss — `not_used`.** Three independent grounds: (1) no patch
exists to upgrade to; (2) the vulnerable signing path is provably unreachable (verify-only); (3)
Low severity, High attack-complexity. Monitor `@phala/dcap-qvl` for a future elliptic-free release.

### 2.3 Cargo host-side tooling — `atty`, `rand`, `ed25519-dalek` (#76, #92, #93, #77)

These crates are pulled in by **host-side** dependencies (test harness, client SDK, logging,
HD-wallet/mnemonic, keygen) and are **not linked into the on-chain BPF program**, which links
`solana-program` (on-chain) rather than `solana-sdk` (host). Solana BPF cannot use OS entropy or
perform client-side keygen, so the vulnerable code paths cannot execute on-chain.

| Alert | Crate | Sev | Advisory | Reverse-dep (who pulls it) | Why not affected |
|-------|-------|-----|----------|----------------------------|------------------|
| #76 | atty 0.2.14 | low | [GHSA-g98v-hv3f-hcfr](https://github.com/advisories/GHSA-g98v-hv3f-hcfr) (no patch) | `env_logger@0.9.3` | Windows-only unaligned read in a **host-side logger**; SIP builds/runs on Linux/macOS CI, not Windows; never in the `.so`. No upstream patch (atty unmaintained). |
| #93 | rand 0.7.3 / 0.8.5 | low | [GHSA-cq8v-f236-94qc](https://github.com/advisories/GHSA-cq8v-f236-94qc) (patch 0.8.6) | `solana-sdk`, `libsecp256k1`, `tiny-bip39`, `ark-std`, `ed25519-dalek` | Soundness bug requires `rand::rng()` re-entered from a **custom global logger** — a host-side condition that cannot arise in BPF (no OS RNG). Host keygen/mnemonic/test tooling only. |
| #92 | rand 0.7.3 / 0.8.5 | low | same as #93 | same as #93 (`sip-privacy`) | Same as #93. Although `rand 0.8.5` is also reachable via `solana-program`, the vulnerable trigger (`rand::rng()` + custom logger reentrancy) is host-only and absent on-chain. |
| #77 | ed25519-dalek 1.0.1 | med | [GHSA-w5vr-6qhr-36cc](https://github.com/advisories/GHSA-w5vr-6qhr-36cc) (patch 2.0.0) | `solana-sdk@1.18.26`, `ed25519-dalek-bip32@0.2.0` | "Double public-key signing oracle" affects the **signing** API only when called with a public key that mismatches the secret. Reached solely via the **host-side** `solana-sdk` `Keypair` (which always derives the matching pubkey) and BIP32 HD derivation — test/client code, not the on-chain binary. Oracle condition never met. |

**Mitigation / Disposition**: **Dismiss — `not_used`** for all four. The vulnerable code is either
host-only (cannot run in BPF) or its trigger condition is never met. `ed25519-dalek` (#77) is the
sole medium here; it remains dismissable on the matched-key + host-only grounds — *Wallahu a'lam*,
and a `cargo tree --target bpfel-unknown-unknown` check is recommended to formally confirm BPF
exclusion at the next toolchain touch.

### 2.4 Cargo on-chain-adjacent — `borsh`, `curve25519-dalek` (#75, #78)

These reach the on-chain graph through `solana-program 1.18.26`. Their only fix is a **major**
version bump, and `solana-program 1.18.26` is pinned by `anchor-lang 0.30.1` for BPF toolchain
compatibility (see [§5](#5-anchorsolana-toolchain-pin)). They cannot be bumped without upgrading
Anchor/Solana — which, for the **mainnet-deployed** `sip-privacy` program, is a build + redeploy
decision, not a lockfile edit.

| Alert | Crate | Sev | Advisory | Reverse-dep | Practical exposure |
|-------|-------|-----|----------|-------------|--------------------|
| #75 | borsh 0.9.3 | med | [GHSA-fjx5-qpf4-xjf2](https://github.com/advisories/GHSA-fjx5-qpf4-xjf2) (patch 1.0.0) | `solana-program@1.18.26` | Unsound deserialization of **non-`Copy` zero-sized types**. SIP's Anchor account/instruction types (and `solana-program`'s internal types) are plain data structs — no non-`Copy` ZST is deserialized from untrusted input. Low. Anchor itself uses borsh `0.10.x` (also in-tree) for account (de)serialization; the flagged `0.9.3` is `solana-program`'s internal pin. |
| #78 | curve25519-dalek 3.2.1 | low | [GHSA-x4gp-pqpj-f43q](https://github.com/advisories/GHSA-x4gp-pqpj-f43q) (patch 4.1.3) | `solana-program@1.18.26`, `solana-zk-token-sdk@1.18.26`, `ed25519-dalek@1.0.1` | Timing variability in `Scalar` subtraction. On-chain BPF execution is metered by compute units, not wall-clock observable to a remote attacker in the classic side-channel sense; operations are over public commitment points. Low. |

**Mitigation / Disposition**: **Defer** — tracked for the next Solana/Anchor toolchain upgrade.
Both alerts are on `sipher-vault` (devnet-only); the same anchor-locked graph underlies the
mainnet `sip-privacy` program, so any future bump must be evaluated, `anchor build`-verified, and
(for mainnet) redeploy-gated together. *Amanah:* not an autonomous lockfile change.

> **Note on alert asymmetry**: `sip-privacy/Cargo.lock` and `sipher-vault/Cargo.lock` carry the
> *same* vulnerable crate versions (both pin the `solana 1.18.26` graph), yet Dependabot currently
> files only `rand` (#92) against `sip-privacy`. This is a per-manifest scan artifact, not a real
> difference in exposure — the triage above applies identically to both programs.

## 3. Resolved (historical)

Resolved in the 2026-06-05 sweep (PRs #1092 sample manifests · #1093 root `pnpm.overrides` ·
#1094 program test-tooling · #1095 `tar` regression fix). Recorded here for the audit trail.

| Package | Severity | Resolution |
|---------|----------|------------|
| bigint-buffer | High | Replaced with maintained fork `bigint-buffer-fixed@^1.1.6` (GHSA-3gc7-fjrx-p6mg) |
| qs | High | Tightened `pnpm.overrides` to `>=6.15.2` (GHSA-6rw7-vpxm-498p) |
| vitest (kimchi-poc) | Critical | `^1 → ^4.1` (standalone research manifest, no lockfile) |
| next, vite, ws, serialize-javascript, langsmith, ajv, bn.js, picomatch, minimatch, rollup, path-to-regexp, fast-uri, flatted, postcss, tar | High/Med | See PRs #1092–#1095 |

## 4. Security-Critical Dependencies

These are the core cryptographic dependencies — all audited:

| Package | Version | Audit | Notes |
|---------|---------|-------|-------|
| @noble/curves | 1.8.x | [Cure53 2022](https://github.com/paulmillr/noble-curves/blob/main/audit/2022-12-cure53-audit-nbl2.pdf) | ECC operations |
| @noble/hashes | 1.7.x | [Cure53 2022](https://github.com/paulmillr/noble-curves/blob/main/audit/2022-12-cure53-audit-nbl2.pdf) | Hash functions |
| @noble/ciphers | 1.2.x | [Cure53 2024](https://github.com/paulmillr/noble-ciphers/blob/main/audit/2024-08-cure53-audit.pdf) | Symmetric encryption |
| @aztec/bb.js | 0.x | Aztec Internal | ZK proving |
| @solana/web3.js | 1.x | Solana Foundation | Chain interaction |

> SIP's privacy-critical cryptography (stealth addresses, Pedersen commitments, viewing-key
> encryption) is implemented on the **Cure53-audited `@noble/*`** stack — none of the open
> advisories above touch this code path.

## 5. Anchor/Solana Toolchain Pin

Both Solana programs deliberately pin the build toolchain, which transitively freezes the
crypto/serialization crate graph that §2.3–§2.4 reference:

| Program | Network | `anchor-lang` | Solana graph | Pin rationale |
|---------|---------|---------------|--------------|---------------|
| `sip-privacy` | **Mainnet-Beta** (`S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`) + devnet | `0.30.1` | `solana-* 1.18.26` | "Compatibility with solana platform-tools v1.51 (rustc 1.84.1)" (Cargo.toml comment) |
| `sipher-vault` | Devnet | `0.30.1` | `solana-* 1.18.26` | Same toolchain pin; `blake3`/`constant_time_eq` further pinned to avoid the `edition2024` requirement Cargo 1.84 cannot satisfy |

**Upgrade path (future work)**: resolving `borsh` (#75) and `curve25519-dalek` (#78) requires
upgrading `anchor-lang`/`solana-program` to a release whose graph carries `borsh 1.x` and
`curve25519-dalek 4.x`. That is an Anchor-version migration with on-chain serialization
implications and, for the mainnet `sip-privacy` program, a redeploy decision — to be scoped as a
dedicated, `anchor build`-verified effort, **not** a Dependabot auto-bump.

## 6. Supply Chain Security

| Check | Status |
|-------|--------|
| Lock file integrity | ✅ `pnpm-lock.yaml` committed |
| Dependency pinning | ✅ Exact versions in lock file |
| GitHub provenance | ⚠️ Not all packages have provenance |
| npm 2FA | ⚠️ @sip-protocol packages require 2FA |
| Dependabot alerts | ✅ Enabled; triaged (this document) |

**Recommendations**:
1. Enable npm provenance when publishing `@sip-protocol` packages.
2. Re-run the triage on each new advisory; dismiss with a comment linking this document.
3. Run `pnpm audit` before each release; review lock-file changes in PRs.
4. **After any lockfile *regeneration***, re-check Dependabot/`pnpm audit` — a refresh can itself
   introduce new vulns (the #1094 `sipher-vault` refresh pulled in `tar@6.2.1`, fixed in #1095).

## 7. Update Schedule

| Frequency | Action |
|-----------|--------|
| Weekly | Review new Dependabot advisories |
| Monthly | Evaluate minor version updates |
| Quarterly | Evaluate major version updates |
| On Advisory | Immediate triage of critical/high CVEs |
| Toolchain upgrade | Re-evaluate deferred Cargo alerts (§2.4) |

## 8. Audit Commands

```bash
# Enumerate ALL open Dependabot alerts (--paginate is mandatory — default page undercounts)
gh api --paginate '/repos/sip-protocol/sip-protocol/dependabot/alerts?state=open&per_page=100'

# Read a specific advisory's actual vulnerable code path
gh api /advisories/GHSA-w5hq-g745-h8pq

# npm reverse-dependency path
pnpm why uuid -r

# Cargo reverse-dependency (run in a program dir; requires Solana toolchain)
cargo tree -i borsh@0.9.3 --target bpfel-unknown-unknown

# Vulnerability scans
pnpm audit
cargo audit   # in programs/*/
```

## 9. Contact

For security concerns related to SIP Protocol dependencies:
- **Email**: security@sip-protocol.org
- **GitHub**: Open a private security advisory

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-06 | 2.0.0 | Resolved prior HIGHs (bigint-buffer, qs) via the 2026-06-05 sweep. Added full triage of the 10 deferred Dependabot alerts (uuid, elliptic, borsh, ed25519-dalek, curve25519-dalek, rand, atty) with advisory analysis, reverse-dep paths, and per-alert disposition (8 not-affected, 2 deferred). Added §5 Anchor/Solana toolchain pin. |
| 2026-01-13 | 1.0.0 | Initial dependency audit |
