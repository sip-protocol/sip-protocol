# Docs ↔ GitHub Issues Sync Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync all documentation (ROADMAP.md, STRATEGY.md, CLAUDE.md, M17-MOBILE-TRACKER.md) with actual GitHub issue state — fix stale references, add missing issues, update statuses.

**Architecture:** Pure documentation edits across 4 files. No code changes. Each task targets one file section. GitHub issues are the source of truth — docs follow.

**Tech Stack:** Markdown editing only. `gh` CLI for verification.

---

## Task 1: ROADMAP.md — Replace M18 Issue Table

**Files:**
- Modify: `ROADMAP.md` (M18 section, ~lines 1198-1216)

**Context:** ROADMAP points to old closed issues (#405-#410, #382, #422, #458, #459). GitHub has 25 new M18-IMPL issues (#800-#824) plus #944 (cross-labeled M18+M19). The surrounding M18 narrative text (technology stack, L2 strategy, relayer strategy) is still accurate — only the issue table needs replacement.

**Step 1: Replace the M18 issue table**

Replace the existing table (from `| Issue |` header through `| [#459]...`) with:

```markdown
| Issue | Description | Priority | Status |
|-------|-------------|----------|--------|
| [#800](../../issues/800) | [EPIC] Ethereum Same-Chain Privacy Implementation | - | 🔲 Planned |
| [#801](../../issues/801) | Solidity contract scaffolding | Critical | 🔲 Planned |
| [#802](../../issues/802) | shieldedTransfer function (Solidity) | Critical | 🔲 Planned |
| [#803](../../issues/803) | claimTransfer function (Solidity) | Critical | 🔲 Planned |
| [#804](../../issues/804) | On-chain Pedersen verification (EVM) | Critical | 🔲 Planned |
| [#805](../../issues/805) | Noir→EVM ZK verifier deployment | Critical | 🔲 Planned |
| [#806](../../issues/806) | EIP-5564 stealth address implementation | Critical | 🔲 Planned |
| [#807](../../issues/807) | SDK shieldedTransfer API for Ethereum | High | 🔲 Planned |
| [#808](../../issues/808) | Secp256k1 stealth address scanning (EVM) | High | 🔲 Planned |
| [#809](../../issues/809) | EVM viewing key disclosure mechanism | High | 🔲 Planned |
| [#810](../../issues/810) | **Gelato/ERC-4337 relayer integration** (gas abstraction) | High | 🔲 Planned |
| [#811](../../issues/811) | Uniswap integration for private swaps | Medium | 🔲 Planned |
| [#812](../../issues/812) | 1inch aggregator integration | Medium | 🔲 Planned |
| [#813](../../issues/813) | **Base L2 deployment** (Coinbase compliance alignment) | Critical | 🔲 Planned |
| [#814](../../issues/814) | **Arbitrum deployment** (largest TVL, DeFi) | Critical | 🔲 Planned |
| [#815](../../issues/815) | **Optimism deployment** (OP Stack reuse) | High | 🔲 Planned |
| [#816](../../issues/816) | Sepolia testnet deployment | Critical | 🔲 Planned |
| [#817](../../issues/817) | E2E test suite for EVM (80+ tests) | High | 🔲 Planned |
| [#818](../../issues/818) | Solidity audit preparation | High | 🔲 Planned |
| [#819](../../issues/819) | Gas optimization (target < 200K) | Medium | 🔲 Planned |
| [#820](../../issues/820) | EVM developer documentation | Medium | 🔲 Planned |
| [#821](../../issues/821) | zkSync Era deployment | Medium | 🔲 Planned |
| [#822](../../issues/822) | Linea deployment | Medium | 🔲 Planned |
| [#823](../../issues/823) | Scroll deployment | Medium | 🔲 Planned |
| [#824](../../issues/824) | Long-tail L2 deployments (Blast, Mantle, Mode) | Low | 🔲 Planned |
| [#944](../../issues/944) | EVM Claim Verifier — Solidity ZK proof verification (M19 cross-ref) | Critical | 🔲 Planned |
```

**Step 2: Verify no broken references**

Run: `grep -n '#405\|#406\|#407\|#408\|#409\|#410\|#422\|#458\|#459' ROADMAP.md`
Expected: No matches (all old references replaced)

**Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: sync ROADMAP.md M18 issue table with GitHub (#800-#824)"
```

---

## Task 2: ROADMAP.md — Replace M20 Issue Table

**Files:**
- Modify: `ROADMAP.md` (M20 section, ~lines 1372-1389)

**Context:** ROADMAP M20 table is mostly synced but missing 3 issues (#841, #846, #853) and has a placeholder "Inco custom FHE program" with no issue number. GitHub has 19 M20-IMPL issues (#839-#853, #946-#949).

**Step 1: Replace the M20 issue table**

Replace from `| Issue |` header through the last `| #852...` row with:

```markdown
| Issue | Description | Status |
|-------|-------------|--------|
| [#839](../../issues/839) | [EPIC] Technical Moat Building | 🔲 Planned |
| [#840](../../issues/840) | Proof composition v1 implementation | 🔲 Research |
| [#841](../../issues/841) | Composed proof benchmarks | 🔲 Planned |
| [#842](../../issues/842) | **Oblivious Sync Service** (Tachyon-inspired) | 🔲 Planned |
| [#843](../../issues/843) | **Quantum-Resistant Storage** (Winternitz Vaults) | 🔲 Planned |
| [#844](../../issues/844) | **WOTS+ Post-Quantum Signatures** for stealth addresses | 🔲 Planned |
| [#845](../../issues/845) | **BNB Chain support** (4.32M daily wallets, Asia market) | 🔲 Planned |
| [#846](../../issues/846) | PancakeSwap integration | 🔲 Planned |
| [#847](../../issues/847) | Chain-specific optimizations | 🔲 Planned |
| [#848](../../issues/848) | Python SDK | 🔲 Planned |
| [#849](../../issues/849) | Rust SDK | 🔲 Planned |
| [#850](../../issues/850) | Go SDK | 🔲 Planned |
| [#851](../../issues/851) | NEAR fee contract (protocol revenue) | 🔲 Planned |
| [#852](../../issues/852) | Governance token design | 🔲 Planned |
| [#853](../../issues/853) | Fee distribution mechanism | 🔲 Planned |
| [#946](../../issues/946) | **Batched Claim Aggregation** — Multiple claims in one tx | 🔲 Planned |
| [#947](../../issues/947) | **Randomized Claim Delays** — Break timing correlation | 🔲 Planned |
| [#948](../../issues/948) | **Fixed Denomination Pools** — Stronger anonymity sets | 🔲 Planned |
| [#949](../../issues/949) | **Relayer Network** — Hide claimer IP + wallet | 🔲 Planned |
```

Also remove the standalone line referencing "Inco custom FHE program" with `-` (no issue exists).

**Step 2: Verify count matches**

Run: `grep -c 'M20-IMPL\|issues/84[0-9]\|issues/85[0-3]\|issues/94[6-9]' ROADMAP.md`
Expected: At least 19 references

**Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: sync ROADMAP.md M20 issue table — add #841, #846, #853"
```

---

## Task 3: ROADMAP.md — Replace M21 Placeholder Table with Real Issues

**Files:**
- Modify: `ROADMAP.md` (M21 section, ~lines 1408-1421)

**Context:** ROADMAP shows 5 placeholder rows with dashes. GitHub has 16 real issues (#854-#869) with `M21-IMPL` labels. The section needs a full rewrite of the table.

**Step 1: Replace the M21 section table**

Replace from `| Issue |` through `| - | Industry working group formation |` with:

```markdown
| Issue | Description | Status |
|-------|-------------|--------|
| [#854](../../issues/854) | [EPIC] Standard Proposal (SIP-EIP) | 🔲 Planned |
| [#855](../../issues/855) | SIP-EIP formal specification | 🔲 Planned |
| [#856](../../issues/856) | Cross-chain privacy standard proposal | 🔲 Planned |
| [#857](../../issues/857) | Reference implementation documentation | 🔲 Planned |
| [#858](../../issues/858) | Compliance framework documentation | 🔲 Planned |
| [#859](../../issues/859) | Audit trail specification | 🔲 Planned |
| [#860](../../issues/860) | Viewing key disclosure standard | 🔲 Planned |
| [#861](../../issues/861) | Industry working group formation | 🔲 Planned |
| [#862](../../issues/862) | Ethereum Magicians forum submission | 🔲 Planned |
| [#863](../../issues/863) | ETH Denver 2026 presentation | 🔲 Planned |
| [#864](../../issues/864) | Wallet provider outreach | 🔲 Planned |
| [#865](../../issues/865) | DEX partnership strategy | 🔲 Planned |
| [#866](../../issues/866) | SIP standard announcement blog post | 🔲 Planned |
| [#867](../../issues/867) | SIP-EIP explainer video | 🔲 Planned |
| [#868](../../issues/868) | Adoption metrics framework | 🔲 Planned |
| [#869](../../issues/869) | Wallet SDK integration specification | 🔲 Planned |
```

**Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: sync ROADMAP.md M21 — replace placeholders with #854-#869"
```

---

## Task 4: ROADMAP.md — Replace M22 Placeholder Table with Real Issues

**Files:**
- Modify: `ROADMAP.md` (M22 section, ~lines 1458-1469)

**Context:** ROADMAP shows 9 placeholder rows with dashes. GitHub has 17 real issues (#870-#886) with `M22-IMPL` labels, organized into institutional (7) + agent (5) + enterprise infra (5) sub-groups.

**Step 1: Replace the M22 section table**

Replace from `| Issue |` through `| - | Agent credential standard ("Know Your Agent") |` with:

```markdown
| Issue | Description | Category | Status |
|-------|-------------|----------|--------|
| [#870](../../issues/870) | [EPIC] Institutional + Agent Custody | - | 🔲 Planned |
| [#871](../../issues/871) | Fireblocks viewing key API integration | Institutional | 🔲 Planned |
| [#872](../../issues/872) | Anchorage compliance dashboard integration | Institutional | 🔲 Planned |
| [#873](../../issues/873) | BitGo multi-sig + viewing keys integration | Institutional | 🔲 Planned |
| [#874](../../issues/874) | Coinbase Prime exploration | Institutional | 🔲 Planned |
| [#875](../../issues/875) | Compliance REST API | Institutional | 🔲 Planned |
| [#876](../../issues/876) | Time-bound viewing key delegation | Institutional | 🔲 Planned |
| [#877](../../issues/877) | Audit report generation | Institutional | 🔲 Planned |
| [#878](../../issues/878) | Compliance dashboard UI | Institutional | 🔲 Planned |
| [#879](../../issues/879) | **Agent viewing key delegation API** | Agent | 🔲 Planned |
| [#880](../../issues/880) | **Agent credential standard (Know Your Agent)** | Agent | 🔲 Planned |
| [#881](../../issues/881) | Scoped agent permissions | Agent | 🔲 Planned |
| [#882](../../issues/882) | Agent audit trail | Agent | 🔲 Planned |
| [#883](../../issues/883) | Agent identity verification | Agent | 🔲 Planned |
| [#884](../../issues/884) | Enterprise SSO integration | Enterprise | 🔲 Planned |
| [#885](../../issues/885) | Multi-tenant architecture | Enterprise | 🔲 Planned |
| [#886](../../issues/886) | SLA & support documentation | Enterprise | 🔲 Planned |
```

**Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: sync ROADMAP.md M22 — replace placeholders with #870-#886"
```

---

## Task 5: ROADMAP.md — Update Phase 4 Status + M17 Mainnet

**Files:**
- Modify: `ROADMAP.md` (~lines 537-542 path diagram, ~line 971 M17 header, ~line 1171 M18 header)

**Context:** The "Path to Endgame" diagram and M17 header still say M17 is active. M17 is complete with mainnet deployment Jan 31. M18 is now the active milestone.

**Step 1: Update the Path to Endgame diagram**

In the ASCII diagram (~line 537-542), change:
```
• M16 Complete ✅  • Zcash route
• M17 Complete ✅  • Proof compo
• M18 Active 🎯   • SIP-EIP
```
This is already correct. No change needed here.

**Step 2: Update M17 header to show mainnet**

The M17 header (~line 971) says `✅ Complete (Jan 2026)`. Add mainnet info to the program section:

Change:
```
**Program:** `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (devnet)
```

To:
```
**Program:** `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (devnet + mainnet-beta)
**Mainnet TX:** [`2akhczwV...iFe8R`](https://solscan.io/tx/2akhczwV94LJ8HL3xbAmNddBSACZTbYMAoow4LmgjkeVS1hu1H7DTKHFfZrm8DHZ6BBrVn93AjiAQUZjg78iFe8R) (Jan 31, 2026)
```

**Step 3: Verify M18 header shows correct status**

The M18 header (~line 1171) should say `🔲 Q2 2026`. This is correct for "planned/next up" — no change needed unless you want to change to `🎯`.

**Step 4: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: update ROADMAP.md M17 to show mainnet deployment"
```

---

## Task 6: STRATEGY.md — Update Current Status Section

**Files:**
- Modify: `~/Documents/secret/claude-strategy/sip-protocol/STRATEGY.md` (~lines 84-107)

**Context:** Strategy is frozen at Jan 23, 2026 state. Multiple fields are stale.

**Step 1: Update the Current Status block**

Replace lines 86-106 with:

```markdown
**Phase:** M17 Complete | M18 Active (Ethereum Same-Chain Privacy)
**Tests:** 7,504+ passing (SDK: 6,691 | React: 543 | CLI: 62 | API: 198 | RN: 10)
**Live:** sip-protocol.org, docs.sip-protocol.org, app.sip-protocol.org, blog.sip-protocol.org, sipher.sip-protocol.org
**npm:** @sip-protocol/sdk v0.8.1 published (7 packages total)
**Program:** Mainnet `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (deployed Jan 31, 2026)
**Tracker:** `~/.claude/sip-protocol/M17-MOBILE-TRACKER.md` (14-week plan — COMPLETE)

**🏆 Achievement:** Zypherpunk Hackathon Winner — $6,500 (NEAR $4K + Tachyon $500 + pumpfun $2K) | #9/93 | 3 Tracks | Dec 2025

**💰 Grant Status:**
| Grant | Amount | Status | Next |
|-------|--------|--------|------|
| Superteam Indonesia | $10,000 USDC | ✅ **APPROVED** | Tranches in progress |
| Solana Audit Subsidy V | $6,000 | ✅ **APPROVED** | Subsidy held, target Q3 2026 |
| SIP Labs, Inc. | — | 📋 Planned | Feb 2026 |
| Solana Foundation | $100K | 📋 Planned | Feb-Mar 2026 |

| Phase | Milestones | Status |
|-------|------------|--------|
| **Phase 1-3: Foundation/Standard/Ecosystem** | M1-M15 | ✅ Complete |
| **Phase 4: Same-Chain Expansion** | M16-M18 | 🎯 Active (M18) |
| **Phase 5: Technical Moat** | M19-M22 | 🔲 Future |
```

**Step 2: Update the "Key Insight: We're Ahead" list (~line 151-161)**

Update version and test count:
- `npm Published SDK (v0.7.3)` → `npm Published SDK (v0.8.1)`
- `6,661+ Tests` → `7,504+ Tests`
- Add: `✅ Solana Mainnet Program (deployed Jan 31, 2026)`

**Step 3: Update the Audit Subsidy entry in Grant Pipeline (~line 348)**

Change:
```
| **Solana Audit Subsidy V** | Up to $50,000 | ⏳ Applied | Await decision | Feb 7 |
```
To:
```
| **Solana Audit Subsidy V** | $6,000 | ✅ **APPROVED** | Subsidy held by Areta, target Q3 2026 | Feb 10 |
```

**Step 4: Commit (private file — no git, just save)**

This file is in `~/Documents/secret/` — not in a git repo. Just save.

---

## Task 7: STRATEGY.md — Update Hackathon Section

**Files:**
- Modify: `~/Documents/secret/claude-strategy/sip-protocol/STRATEGY.md` (~lines 430-580)

**Context:** Strategy shows Privacy Hack as "ACTIVE" and doesn't mention Graveyard Hackathon or Colosseum Agent Hackathon.

**Step 1: Update the Active hackathons table (~line 434)**

Replace:
```markdown
| **Solana Privacy Hack** | Jan 12-30, 2026 | $100K+ | Privacy Tooling / Private Payments | 🎯 **ACTIVE** |
```
With:
```markdown
| **Solana Privacy Hack** | Jan 12-30, 2026 | $100K+ | Privacy Tooling / Private Payments | ✅ **COMPLETED** |
| **Colosseum Agent Hackathon** | Jan-Feb 12, 2026 | $100K | Agent Track (sipher) | ✅ **SUBMITTED** |
| **Graveyard Hackathon** | Feb 2026 | Various | 11 tracks (sip-app) | ✅ **SUBMITTED** |
```

**Step 2: Update hackathon calendar (~line 571)**

```markdown
PRIZE PATH (Free Money)
───────────────────────────────────────────────────
Jan 12-30    → Privacy Hack (COMPLETED)         $100K+
Jan-Feb 12   → Agent Hackathon (SUBMITTED)      $100K
Feb 2026     → Graveyard Hackathon (SUBMITTED)  Various
Apr 6-May 11 → Colosseum Spring (CONFIRMED)     $600K+
Sept 28-Nov 2 → Colosseum Fall (CONFIRMED)      $600K+
```

**Step 3: Save (private file — no git)**

---

## Task 8: CLAUDE.md — Fix M17 Status + SDK Version

**Files:**
- Modify: `CLAUDE.md` (milestone table + project structure)

**Context:** Phase 4 table shows M17 as 🎯 (should be ✅). SDK version inconsistency (0.8.0 in structure, 0.8.1 in header).

**Step 1: Fix Phase 4 milestone table**

Change:
```
| M17: Solana Same-Chain | Native Solana privacy SDK + Jupiter DEX | 🎯 |
```
To:
```
| M17: Solana Same-Chain | Native Solana privacy SDK + Jupiter DEX | ✅ |
```

**Step 2: Fix SDK version in project structure**

Change:
```
│   ├── sdk/                  # @sip-protocol/sdk v0.8.0 - Core SDK (6,691 tests)
```
To:
```
│   ├── sdk/                  # @sip-protocol/sdk v0.8.1 - Core SDK (6,691 tests)
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: fix CLAUDE.md M17 status ✅ and SDK version to 0.8.1"
```

---

## Task 9: M17-MOBILE-TRACKER.md — Update Date + Mainnet Note

**Files:**
- Modify: `~/.claude/sip-protocol/M17-MOBILE-TRACKER.md` (~lines 1, 34, 224)

**Context:** Last updated Jan 30. Missing mainnet deployment (Jan 31) and current date.

**Step 1: Update the M17 program line (~line 34)**

Change:
```
**Program:** `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (devnet)
```
To:
```
**Program:** `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (devnet + mainnet-beta, deployed Jan 31)
```

**Step 2: Update the Last Updated line (~line 224)**

Change:
```
**Last Updated:** 2026-01-30 | **Tests:** 647 | **Coverage:** 80%+
```
To:
```
**Last Updated:** 2026-02-26 | **Tests:** 647 | **Coverage:** 80%+
```

**Step 3: No git commit needed (memory file)**

---

## Task 10: Verify All Docs Synced

**Step 1: Run verification checks**

```bash
# Check ROADMAP M18 references new issues
grep -c 'issues/80[0-9]\|issues/81[0-9]\|issues/82[0-4]' ROADMAP.md
# Expected: 25+

# Check ROADMAP M21 references real issues
grep -c 'issues/85[4-9]\|issues/86[0-9]' ROADMAP.md
# Expected: 16+

# Check ROADMAP M22 references real issues
grep -c 'issues/87[0-9]\|issues/88[0-6]' ROADMAP.md
# Expected: 17+

# Check no old M18 issue refs remain
grep -n '#405\|#406\|#407\|#408\|#409\|#410' ROADMAP.md
# Expected: No output

# Check CLAUDE.md M17 status
grep 'M17.*Solana' CLAUDE.md | grep '✅'
# Expected: Match

# Check SDK version consistency
grep -n 'v0\.7\.3\|v0\.8\.0' CLAUDE.md ROADMAP.md
# Expected: No stale versions (v0.7.3 should be gone, v0.8.0 only in package.json refs)
```

**Step 2: Final commit if any missed fixes**

```bash
git add -A
git commit -m "docs: final sync verification pass"
```

---

## Execution Summary

| Task | File | Scope | Effort |
|------|------|-------|--------|
| 1 | ROADMAP.md | M18 table (25 issues) | 3 min |
| 2 | ROADMAP.md | M20 table (19 issues) | 2 min |
| 3 | ROADMAP.md | M21 table (16 issues) | 2 min |
| 4 | ROADMAP.md | M22 table (17 issues) | 2 min |
| 5 | ROADMAP.md | M17 mainnet + status | 1 min |
| 6 | STRATEGY.md | Current status section | 3 min |
| 7 | STRATEGY.md | Hackathon section | 2 min |
| 8 | CLAUDE.md | M17 status + SDK version | 1 min |
| 9 | M17-TRACKER.md | Date + mainnet | 1 min |
| 10 | All | Verification | 2 min |

**Total: 10 tasks, ~19 minutes, 5 commits (ROADMAP x4, CLAUDE x1) + 2 private file saves**
