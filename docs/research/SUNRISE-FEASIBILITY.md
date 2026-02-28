# Sunrise Stake Integration Feasibility Assessment
**Date:** 2026-02-13
**Track:** Graveyard Hackathon - Migrations ($7K total: $3K / $2.5K / $1.5K)
**Deadline:** Unknown (TBD - check solana.com/graveyard-hack)

---

## Executive Summary

**Feasibility: MEDIUM-HARD | 7-10 dev days**

**Sunrise is NOT a cross-chain bridge** — it's a **liquid staking protocol** on Solana that routes SOL → gSOL (green SOL) and directs yield to climate projects (ReFi). The Graveyard Hackathon "Migrations" track sponsored by Sunrise appears to be about helping projects **migrate TO Solana**, not about cross-chain asset transfers.

**Critical Blocker:** The hackathon description is ambiguous. "Building bridges, migration tooling, or onboarding guides using Sunrise" could mean:
1. **Interpretation A:** Help traditional projects adopt Sunrise Stake for green treasury management (easier, 5-7 days)
2. **Interpretation B:** Build cross-chain asset migration tools that integrate Sunrise for immediate green staking (harder, 10-14 days)
3. **Interpretation C:** Build tooling to migrate stakers FROM dead Solana protocols TO Sunrise (medium, 7-10 days)

**Recommendation:** Contact hackathon organizers to clarify what "migration using Sunrise" means before committing.

---

## 1. What is Sunrise Stake?

**Official Description:** ReFi liquid staking protocol on Solana. Users deposit SOL → receive gSOL (1:1 ratio) → staking yield goes to carbon offsetting via Toucan NCT tokens.

### Architecture
```
User deposits SOL
  ↓
Sunrise Protocol routes to:
  • Marinade Finance (mSOL) - majority
  • SolBlaze (bSOL) - balanced routing
  • Marinade Unstake Pool - 10% liquidity for instant withdrawals
  ↓
User receives gSOL (1:1 with deposited SOL)
  ↓
Epoch yield accrues (2-3 days)
  ↓
Yield → Treasury PDA → Purchase & burn NCT carbon tokens
```

### Key Features
- **Non-custodial:** Smart contract controlled (no private keys)
- **Instant unstaking:** Up to liquidity pool limit (10% target), fee-free
- **Liquid staking:** gSOL can be used in DeFi while staking
- **ReFi focus:** Yield → carbon offsetting (Toucan NCT on Polygon/Celo via Wormhole)

---

## 2. Technical Infrastructure

### Program Addresses (Mainnet)
| Component | Address |
|-----------|---------|
| Sunrise Program | `sunzv8N3A8dRHwUBvxgRDEbWKk8t7yiHR4FLRgFsTX6` |
| Sunrise State | `43m66crxGfXSJpmx5wXRoFuHubhHA1GCvtHgmHW6cM1P` |
| gSOL Mint | `gso1xA56hacfgTHTF4F7wN5r4jbnJsKh99vR595uybA` |
| Treasury Controller | `sbnbpcN3HVfcj9jTwzncwLeNvCzSwbfMwNmdAgX36VW` |
| NCT Token (Wormhole) | `7sbtAMfAuSfsUvZKPWiXUXaizYCnpLL2BBnKNTU3wjfT` |

### Developer SDK
**NPM Package:** `@sunrisestake/client` (v0.1.17)

**Key Dependencies:**
- `@coral-xyz/anchor` ^0.31.1
- `@solana/web3.js` ^1.98.2
- `@sunrisestake/marinade-ts-sdk` ^4.0.4-alpha.18
- `@solana/spl-stake-pool` ^1.1.8

**Core Client Methods:**
```typescript
import { SunriseStakeClient, Environment } from '@sunrisestake/client'

// Initialize client
const client = await SunriseStakeClient.get(
  provider,
  'mainnet-beta', // or 'devnet'
  { addPriorityFee: true }
)

// Deposit SOL → gSOL
const depositTx = await client.makeBalancedDeposit(lamports, recipientPubkey)
await client.sendAndConfirmTransaction(depositTx)

// Unstake gSOL → SOL (instant if liquidity available)
const unstakeTx = await client.unstake(lamports)
await client.sendAndConfirmTransaction(unstakeTx)

// Get protocol details (balances, yields, etc)
const details = await client.details()

// Extract yield to treasury (permissionless crank)
await client.extractYield()
```

### Supported Chains
**Primary:** Solana only
**Carbon Bridge:** Polygon/Celo (via Wormhole for NCT tokens)

---

## 3. Potential Privacy-Preserving Migration Concepts

### Scenario A: Dead Protocol → Sunrise with Privacy
**User Flow:**
1. User has assets in a dead/deprecated Solana protocol (e.g., old DEX, failed staking)
2. Use SIP stealth address generation to create fresh identity
3. Withdraw from dead protocol → stealth address on Solana
4. Route to Sunrise via SIP shielded transfer → gSOL arrives at clean address
5. No on-chain link between old protocol wallet and new green staking

**Technical Approach:**
- SIP SDK generates stealth address + viewing key
- User withdraws from dead protocol to stealth address
- Backend Sipher API scans for arrival, builds Sunrise deposit tx
- User receives gSOL at stealth address (climate-positive + private)

**Value Prop:** "Migrate from dead protocols with a clean slate + go green"

### Scenario B: Cross-Chain Migration to Sunrise
**User Flow (Hypothetical):**
1. User has ETH staked on deprecated Ethereum staking protocol
2. Bridge ETH → Solana (via Wormhole/Allbridge)
3. SIP generates stealth Solana address during bridging
4. Assets arrive → immediately routed to Sunrise → gSOL
5. User gets climate-positive staking + privacy on Solana

**Technical Challenges:**
- Would need to integrate with existing bridge protocols (Wormhole, Allbridge)
- SIP same-chain privacy works on Solana, but bridge → privacy flow complex
- Sunrise only accepts SOL (would need swap ETH → SOL first)

**Value Prop:** "Leave dead chains behind, go green + private on Solana"

### Scenario C: Green Treasury Migration Tool
**User Flow (Organizations/DAOs):**
1. DAO has treasury in deprecated protocol or wants to go green
2. Migration tool automates withdrawal from old protocol
3. Route treasury SOL → Sunrise via batch transactions
4. Optional: Use SIP for treasurer privacy (hide amounts, segregate wallets)

**Technical Approach:**
- CLI/UI tool for batch treasury migration
- Integrate Sunrise SDK for automated gSOL conversion
- SIP viewing keys for compliance (show carbon offset to stakeholders)

**Value Prop:** "One-click green treasury migration for DAOs"

---

## 4. Developer Experience Assessment

### Documentation Quality: **6/10**
**Strengths:**
- Comprehensive TypeScript SDK with 2,288 lines of well-documented code
- Clear program addresses and environment configs
- GitHub organization with 10 repos (app, client, docs, yield-controller, etc)
- Official docs at docs.sunrisestake.com

**Weaknesses:**
- No explicit "developer integration guide" or quickstart
- Migration-specific documentation not found
- Unclear API rate limits or RPC requirements
- No webhooks/event system for tracking deposits

### SDK Usability: **7/10**
**Strengths:**
- Modern TypeScript with ESM/CJS dual exports
- Built on Anchor framework (standard Solana dev tooling)
- Good abstraction layer over Marinade/SolBlaze complexity
- Priority fee support via Helius integration

**Weaknesses:**
- No React hooks (have to build our own or use `@sunrisestake/app` internals)
- Complex internal state management (marinade, blaze, lock accounts)
- Requires understanding of stake pool mechanics for advanced features

### Integration Complexity: **MEDIUM**
**Easy Parts:**
- Basic deposit/unstake flows via SDK
- Reading gSOL balances (standard SPL token)
- Transaction building with Anchor

**Hard Parts:**
- Understanding liquidity pool rebalancing logic
- Epoch-based yield calculations
- Lock accounts for Impact NFTs (if we want to show carbon offset achievements)
- Cross-chain coordination if bridging from other chains

---

## 5. Privacy Integration Strategy

### Option 1: Stealth Address Wrapper (Simplest)
**What:** SIP generates stealth addresses, users migrate → stealth → Sunrise

**Steps:**
1. User provides old wallet address (dead protocol)
2. SIP generates stealth address on Solana
3. User withdraws from dead protocol → stealth address
4. Auto-route stealth SOL → Sunrise deposit
5. gSOL arrives at stealth address (private + green)

**SIP Components Used:**
- `packages/sdk/src/stealth.ts` - EIP-5564 stealth addresses
- `packages/sdk/src/privacy.ts` - Viewing keys for optional disclosure
- Existing Solana same-chain privacy (M17 complete)

**Dev Effort:** 5-7 days
- 1 day: Sunrise SDK integration + testing
- 2 days: SIP stealth → Sunrise flow
- 1 day: UI for migration wizard
- 1 day: Testing + edge cases
- 0.5 days: Documentation

### Option 2: Shielded Migration with Commitment (Medium)
**What:** Hide migration amounts using Pedersen commitments

**Steps:**
1. User locks funds in dead protocol
2. SIP creates Pedersen commitment for amount
3. Prove withdrawal without revealing amount
4. Route to Sunrise via shielded transfer
5. Sunrise receives gSOL mint request with hidden amount

**Challenges:**
- Sunrise SDK expects explicit `lamports` parameter
- Would need custom Sunrise program modification (unlikely for hackathon)
- OR: Use SIP off-chain proof, reveal amount only to Sunrise contract

**Dev Effort:** 10-14 days (risky for hackathon timeline)

### Option 3: Privacy-Preserving Treasury Migration (Medium-Hard)
**What:** DAO migration tool with viewing keys for compliance

**Steps:**
1. DAO treasury in dead protocol (old staking, deprecated DEX)
2. SIP generates viewing key for treasurer
3. Batch migration: old protocol → Sunrise
4. Viewing key allows DAO members to audit green migration
5. Public sees only gSOL mint, not source wallet linkage

**SIP Components Used:**
- Viewing keys for selective disclosure
- Batch transaction building
- Optional: Pedersen commitments for amount privacy

**Dev Effort:** 7-10 days
- 2 days: DAO treasury discovery (find common dead protocols)
- 2 days: Batch migration logic + Sunrise SDK
- 2 days: SIP viewing key integration
- 1 day: UI/CLI for DAO admins
- 1 day: Testing + docs

---

## 6. Competitive Landscape

### What Makes This Unique?
1. **First privacy + ReFi combo:** No one has done "private green staking"
2. **Dead protocol resurrection:** Help users escape rug pulls with clean slate
3. **Compliance + climate:** Viewing keys show carbon offset to regulators

### Potential Competitors (Graveyard Hackathon)
- **Migration Tools:** Others might build generic Solana onboarding (no privacy)
- **Sunrise Integrations:** Wallet plugins, DAO dashboards (no migration focus)
- **Privacy Projects:** Other SIP implementations (no Sunrise integration)

**Our Edge:** **Only** project combining privacy + ReFi + migration narrative

---

## 7. Feasibility Assessment

### Technical Feasibility: **MEDIUM**
**Pros:**
- Sunrise SDK is production-ready (v0.1.17, 1,129 commits)
- SIP M17 complete (Solana same-chain privacy working)
- No need to modify Sunrise smart contracts
- Can build as wrapper/middleware

**Cons:**
- Sunrise SDK has no built-in privacy primitives
- Cross-chain migration adds complexity (if Interpretation B)
- Hackathon timeline tight (7-10 days if starting fresh)

### Time Estimate by Scenario

| Scenario | Complexity | Dev Days | Notes |
|----------|-----------|----------|-------|
| **A: Stealth Wrapper** | Low-Medium | 5-7 days | Simplest, high completion probability |
| **B: Cross-Chain Bridge** | High | 12-14 days | Requires bridge integration, risky |
| **C: DAO Treasury Tool** | Medium | 7-10 days | Good narrative, moderate complexity |

### Recommendation: **Scenario A (Stealth Wrapper)**
**Why:**
- Achievable in hackathon timeframe (5-7 days)
- Clear user value: privacy + green staking
- Leverages existing SIP M17 work (no new crypto primitives)
- Aligns with "migration" if interpreted as "migrate from dead protocols"

**What to Build:**
1. **Frontend:** Migration wizard (dead protocol → Sunrise)
2. **Backend:** Sipher API endpoint for stealth → Sunrise routing
3. **SDK Integration:** Wrapper around `@sunrisestake/client`
4. **Demo:** Show migration from a known dead Solana protocol (e.g., Saber old pools)

---

## 8. Open Questions (CRITICAL - Ask Hackathon Organizers)

1. **What does "migration using Sunrise" mean?**
   - Migrate TO Solana (from other chains)?
   - Migrate FROM dead Solana protocols TO Sunrise?
   - Migrate DAO treasuries TO green staking?

2. **Is cross-chain bridging required?**
   - Or is Solana-only migration acceptable?

3. **Can we build on top of Sunrise SDK?**
   - Or must we integrate at smart contract level?

4. **What qualifies as a "migration"?**
   - Asset transfer? Wallet migration? Protocol adoption?

5. **Are there judging criteria?**
   - Technical complexity? User impact? Climate narrative?

---

## 9. Recommended Next Steps

### Before Committing (1 day)
1. **Contact hackathon organizers** - Clarify "migration using Sunrise" definition
2. **Review official rules** - Check solana.com/graveyard-hack for submission criteria
3. **Survey dead protocols** - List 5-10 dead Solana protocols users might want to escape

### If Go (Day 1-7)
1. **Day 1:** Sunrise SDK integration + basic deposit/unstake tests
2. **Day 2:** SIP stealth address generation + viewing key flow
3. **Day 3:** Build stealth → Sunrise routing logic
4. **Day 4:** Frontend migration wizard (simple UI)
5. **Day 5:** End-to-end testing with devnet
6. **Day 6:** Demo video + documentation
7. **Day 7:** Final polish + submission

### Tech Stack
- **Backend:** Extend Sipher API (existing SIP REST API)
- **Frontend:** Next.js (reuse sip-app components)
- **SDK:** `@sunrisestake/client` + `@sip-protocol/sdk`
- **Deployment:** VPS (151.245.137.75) with Docker

---

## 10. Risk Assessment

### High Risk
- **Ambiguous requirements:** Don't know what "migration" means yet
- **Timeline:** 7 days is tight if scope expands

### Medium Risk
- **Sunrise SDK changes:** v0.1.17 might have breaking changes during hackathon
- **Dead protocol selection:** Need to pick a protocol users actually care about

### Low Risk
- **SIP integration:** M17 complete, Solana privacy proven
- **Technical execution:** Team has built Sipher, sip-app (proven track record)

---

## 11. Success Metrics

### Minimum Viable Demo (5 days)
- [ ] User can migrate 1 SOL from dead protocol → Sunrise via stealth address
- [ ] gSOL arrives at clean address (no on-chain link to source)
- [ ] Demo video showing privacy + ReFi narrative

### Ideal Demo (7 days)
- [ ] Support 3+ dead Solana protocols
- [ ] Viewing key disclosure for compliance
- [ ] Dashboard showing carbon offset achievements
- [ ] CLI tool for batch DAO migrations

### Stretch Goals (10 days)
- [ ] Cross-chain migration from Ethereum
- [ ] Pedersen commitments for amount privacy
- [ ] Impact NFT integration (Sunrise lock accounts)

---

## 12. Final Verdict

**Feasibility: MEDIUM-HARD**
**Estimated Effort: 7-10 dev days**
**Confidence: 60%** (HIGH if organizers confirm Interpretation A, LOW if Interpretation B)

**Go/No-Go Decision:**
- **GO** if hackathon wants "Solana-native protocol migration to Sunrise"
- **NO-GO** if they require cross-chain bridging infrastructure
- **MAYBE** if DAO treasury tooling qualifies

**Next Action:** Email hackathon organizers TODAY to clarify requirements before committing dev time.

---

**Prepared by:** CIPHER (Senior Development Agent)
**For:** RECTOR (SIP Protocol Lead)
**Project:** SIP Protocol Graveyard Hackathon Assessment
**Date:** 2026-02-13
