# SIP Governance Token Design

**Status:** Draft
**Version:** 0.1.0
**Last Updated:** 2026-01-20
**Related:** [Governance Framework](./GOVERNANCE-FRAMEWORK.md), [Legal Checklist](./LEGAL-CHECKLIST.md)

---

## Executive Summary

The SIP Token (working name: `$SIP`) is a governance and utility token for the SIP Protocol ecosystem. It enables decentralized governance, incentivizes network participation, and provides utility through fee discounts and staking mechanisms.

**Key Principles:**
- Pure utility/governance — not a security
- Privacy-first governance using SIP's own primitives
- Value accrual through protocol fee sharing
- Progressive decentralization timeline

---

## 1. Token Utility Model

### 1.1 Primary Utilities

| Utility | Description | Value Driver |
|---------|-------------|--------------|
| **Governance Voting** | Vote on protocol parameters, upgrades, treasury | Decision power |
| **Fee Discounts** | Tiered discounts on protocol fees (staking-based) | Direct savings |
| **Staking Rewards** | Earn from protocol fee revenue | Passive income |
| **Solver/Relayer Bonds** | Stake to become protocol operator | Access rights |

### 1.2 Fee Discount Tiers

Integrates with the protocol fee system (M20-30):

| Tier | Staked $SIP | Fee Discount |
|------|-------------|--------------|
| Standard | 0 | 0% |
| Bronze | 1,000 | 10% |
| Silver | 10,000 | 20% |
| Gold | 100,000 | 35% |
| Platinum | 1,000,000 | 50% |

*Note: Stacks with viewing key discount (50%) for maximum 75% fee reduction.*

### 1.3 Value Accrual Mechanism

```
Protocol Fees → Treasury → Distribution
                              ├── 40% Buyback & Burn
                              ├── 40% Staker Rewards
                              └── 20% Development Fund
```

**Buyback Mechanism:**
- Automated buyback when treasury exceeds threshold
- Burned tokens reduce supply (deflationary pressure)
- Transparent on-chain execution

**Staker Rewards:**
- Pro-rata distribution to staked token holders
- Weekly distribution epochs
- Compound option available

---

## 2. Token Economics

### 2.1 Supply Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Total Supply** | 1,000,000,000 (1B) | Standard for governance tokens |
| **Initial Circulating** | ~15% (150M) | Prevent early dumps |
| **Inflation** | 0% (fixed supply) | Deflationary via burns |
| **Decimals** | 18 | EVM standard |

### 2.2 Token Distribution

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOKEN DISTRIBUTION (1B)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░  Community: 40% (400M) │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Team: 20% (200M)      │
│  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Ecosystem: 15% (150M) │
│  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Investors: 15% (150M) │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Liquidity: 10% (100M) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Allocation | Amount | Percentage | Purpose |
|------------|--------|------------|---------|
| **Community Treasury** | 400,000,000 | 40% | Grants, rewards, ecosystem growth |
| **Team & Contributors** | 200,000,000 | 20% | Core team, early contributors |
| **Ecosystem Grants** | 150,000,000 | 15% | Developer grants, integrations |
| **Investors** | 150,000,000 | 15% | Seed, strategic rounds |
| **Initial Liquidity** | 100,000,000 | 10% | DEX liquidity, market making |

### 2.3 Vesting Schedules

```
Team & Contributors (20%)
├── Cliff: 12 months
├── Vesting: 48 months linear
└── Full unlock: Month 60

Investors (15%)
├── Cliff: 6 months
├── Vesting: 24 months linear
└── Full unlock: Month 30

Ecosystem Grants (15%)
├── Cliff: None
├── Vesting: Per-grant basis
└── Typical: 12-24 months

Community Treasury (40%)
├── Cliff: None
├── Vesting: None (DAO-controlled)
└── Release: Governance proposals

Initial Liquidity (10%)
├── Cliff: None
├── Vesting: None
└── Locked in DEX pools
```

**Vesting Visualization:**

```
Month:  0    6    12   18   24   30   36   42   48   54   60
        │    │    │    │    │    │    │    │    │    │    │
Team:   ░░░░░░░░░░████████████████████████████████████████████
                  ↑ Cliff ends, linear unlock begins

Invest: ░░░░░░████████████████████████████
              ↑ Cliff ends

Liquid: ████████████████████████████████████████████████████████
        ↑ Immediately available (locked in pools)
```

---

## 3. Multi-Chain Deployment

### 3.1 Chain Strategy

SIP is multi-chain — the token must be accessible across all supported chains.

| Chain | Role | Token Standard |
|-------|------|----------------|
| **Solana** | Primary (highest volume) | SPL Token |
| **NEAR** | Secondary (Intents origin) | NEP-141 |
| **Ethereum** | Tertiary (DeFi liquidity) | ERC-20 |
| **Arbitrum** | L2 governance | ERC-20 |

### 3.2 Cross-Chain Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GOVERNANCE HUB (Solana)                      │
│  • Canonical token supply                                        │
│  • Governance execution                                          │
│  • Treasury management                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Wormhole / LayerZero
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │    NEAR     │ │  Ethereum   │ │  Arbitrum   │
    │  (Bridged)  │ │  (Bridged)  │ │  (Bridged)  │
    │             │ │             │ │             │
    │ Vote relay  │ │ Vote relay  │ │ Vote relay  │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### 3.3 Cross-Chain Voting

- Votes cast on any chain relay to governance hub
- Snapshot-style off-chain voting for gas efficiency
- On-chain execution on canonical chain (Solana)

---

## 4. Anti-Sybil Mechanisms

### 4.1 Token-Weighted Voting

Default mechanism — 1 token = 1 vote.

**Pros:** Simple, transparent, aligned incentives
**Cons:** Plutocratic, whale-dominated

### 4.2 Quadratic Voting (Optional)

Cost of votes scales quadratically:
- 1 vote = 1 token
- 4 votes = 4 tokens
- 9 votes = 9 tokens
- n² votes = n² tokens

**Implementation:**
```typescript
function voteCost(votes: number): bigint {
  return BigInt(votes * votes)
}
```

### 4.3 Time-Weighted Voting

Longer staking = more voting power:

| Stake Duration | Vote Multiplier |
|----------------|-----------------|
| No lock | 1.0x |
| 3 months | 1.25x |
| 6 months | 1.5x |
| 12 months | 2.0x |
| 24 months | 2.5x |

### 4.4 Reputation Layer (Future)

- On-chain activity scoring
- Contribution-based reputation
- Optional ZK identity integration (Worldcoin, Polygon ID)

---

## 5. Staking Mechanism

### 5.1 Staking Parameters

| Parameter | Value |
|-----------|-------|
| Minimum stake | 100 $SIP |
| Lock period | None (liquid) or locked (bonus) |
| Unbonding period | 7 days |
| Reward frequency | Weekly epochs |
| Slashing | None (governance only) |

### 5.2 Staking Contract Interface

```typescript
interface SIPStaking {
  // Stake tokens (optionally with lock)
  stake(amount: bigint, lockMonths?: number): Promise<TxHash>

  // Unstake tokens (subject to unbonding)
  unstake(amount: bigint): Promise<TxHash>

  // Claim accumulated rewards
  claimRewards(): Promise<TxHash>

  // Compound rewards back into stake
  compound(): Promise<TxHash>

  // View functions
  getStake(address: string): Promise<StakeInfo>
  getPendingRewards(address: string): Promise<bigint>
  getVotingPower(address: string): Promise<bigint>
}
```

### 5.3 Liquid Staking (Future)

- stSIP receipt token for staked positions
- Tradeable, usable in DeFi
- Maintains voting rights

---

## 6. Token Launch Strategy

### 6.1 Pre-Launch Requirements

- [ ] SIP Labs, Inc. legal entity established
- [ ] Legal opinion on utility classification
- [ ] Token audit (contract security)
- [ ] Tokenomics audit (economic model)
- [ ] Multi-chain deployment tested

### 6.2 Launch Phases

**Phase 1: Testnet (Month 0-2)**
- Deploy on testnets (Solana Devnet, NEAR Testnet)
- Community testing
- Bug bounty program

**Phase 2: Limited Launch (Month 3)**
- Mainnet deployment
- Liquidity bootstrapping event
- Initial DEX listing

**Phase 3: Full Launch (Month 4+)**
- Cross-chain bridges enabled
- Governance activation
- Staking rewards begin

### 6.3 Initial Price Discovery

**Options:**
1. **Liquidity Bootstrapping Pool (LBP)** — Fair price discovery
2. **Dutch Auction** — Descending price, buyer determines value
3. **Fixed Price Sale** — Simple but may misprice

**Recommendation:** LBP on Solana (Jupiter/Orca) for fair discovery.

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Regulatory classification as security | High | Utility-first design, legal opinion, no profit expectations |
| Whale accumulation | Medium | Vesting, quadratic voting option, time-locks |
| Low voter turnout | Medium | Delegation, incentivized voting |
| Cross-chain bridge exploit | High | Battle-tested bridges, gradual rollout |
| Token price volatility | Medium | Treasury diversification, buyback smoothing |

---

## 8. Governance Integration

See [GOVERNANCE-FRAMEWORK.md](./GOVERNANCE-FRAMEWORK.md) for:
- Proposal lifecycle
- Voting mechanics
- Privacy-preserving voting (ZK)
- Emergency procedures

---

## 9. Open Questions

1. **Token name:** $SIP, $SHIELD, $PRIV?
2. **Primary chain:** Solana vs Ethereum for governance hub?
3. **Quadratic voting:** Enable by default or opt-in?
4. **Investor allocation:** 15% appropriate or adjust?
5. **Inflation:** Fixed supply or small inflation for rewards?

---

## 10. References

- [Compound Governance](https://compound.finance/governance)
- [Uniswap Governance](https://gov.uniswap.org/)
- [Nouns DAO](https://nouns.wtf/)
- [NEAR Governance](https://gov.near.org/)
- [a]16z Token Best Practices](https://a16z.com/token-launch-best-practices/)

---

*This document is for design purposes only. Token launch requires legal entity formation and regulatory compliance.*
