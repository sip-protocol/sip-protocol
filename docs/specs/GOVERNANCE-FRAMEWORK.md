# SIP Governance Framework

**Status:** Draft
**Version:** 0.1.0
**Last Updated:** 2026-01-20
**Related:** [Governance Token](./GOVERNANCE-TOKEN.md), [Legal Checklist](./LEGAL-CHECKLIST.md)

---

## Executive Summary

The SIP Governance Framework defines how protocol decisions are made, from parameter changes to treasury allocations. It emphasizes privacy-preserving voting using SIP's own cryptographic primitives, progressive decentralization, and efficient decision-making.

**Core Principles:**
- Privacy-first: Shielded voting prevents coercion and vote buying
- Progressive: Gradual transition from multisig to full DAO
- Efficient: Delegation and tiered proposals reduce friction
- Secure: Timelocks and emergency procedures protect the protocol

---

## 1. Governance Architecture

### 1.1 Governance Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOVERNANCE STACK                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 4: EMERGENCY COUNCIL                                      │
│           └── 3/5 multisig for critical security actions         │
│                                                                  │
│  Layer 3: TOKEN GOVERNANCE                                       │
│           └── Full DAO voting on major decisions                 │
│                                                                  │
│  Layer 2: DELEGATED GOVERNANCE                                   │
│           └── Elected delegates for routine decisions            │
│                                                                  │
│  Layer 1: PARAMETER GOVERNANCE                                   │
│           └── Automated/bounded parameter adjustments            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Decision Categories

| Category | Examples | Governance Layer | Quorum |
|----------|----------|------------------|--------|
| **Critical** | Protocol upgrades, token changes | Layer 3 (Full DAO) | 10% |
| **Major** | Treasury >$100K, new chains | Layer 3 (Full DAO) | 5% |
| **Standard** | Grants <$100K, parameters | Layer 2 (Delegates) | 3% |
| **Minor** | Fee adjustments (bounded) | Layer 1 (Automated) | N/A |
| **Emergency** | Security patches, pauses | Layer 4 (Council) | 3/5 |

---

## 2. Proposal Lifecycle

### 2.1 Proposal States

```
  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
  │  DRAFT  │ ──▶ │ ACTIVE  │ ──▶ │ PASSED  │ ──▶ │EXECUTED │
  └─────────┘     └─────────┘     └─────────┘     └─────────┘
       │               │               │
       │               ▼               ▼
       │          ┌─────────┐     ┌─────────┐
       └────────▶ │ REJECTED│     │ VETOED  │
                  └─────────┘     └─────────┘
```

| State | Duration | Description |
|-------|----------|-------------|
| **Draft** | Min 3 days | Discussion period, feedback gathering |
| **Active** | 5 days | Voting period |
| **Passed** | — | Met quorum and approval threshold |
| **Timelock** | 24-72h | Delay before execution (based on category) |
| **Executed** | — | On-chain execution complete |
| **Rejected** | — | Failed to meet quorum or approval |
| **Vetoed** | — | Emergency council override |

### 2.2 Proposal Requirements

| Category | Proposer Threshold | Quorum | Approval | Timelock |
|----------|-------------------|--------|----------|----------|
| Critical | 100,000 $SIP (0.01%) | 10% | 66% | 72 hours |
| Major | 50,000 $SIP | 5% | 60% | 48 hours |
| Standard | 10,000 $SIP | 3% | 55% | 24 hours |
| Minor | 1,000 $SIP | 1% | 51% | 6 hours |

### 2.3 Proposal Template

```markdown
# SIP-[NUMBER]: [Title]

## Summary
One paragraph description.

## Motivation
Why is this change needed?

## Specification
Technical details of the change.

## Security Considerations
Potential risks and mitigations.

## Budget (if applicable)
Requested funds and allocation.

## Timeline
Implementation milestones.
```

---

## 3. Voting Mechanics

### 3.1 Vote Options

- **For** — Support the proposal
- **Against** — Oppose the proposal
- **Abstain** — Count toward quorum but not approval

### 3.2 Voting Power Calculation

```typescript
function getVotingPower(address: string): bigint {
  const baseTokens = getStakedBalance(address)
  const delegatedTokens = getDelegatedTo(address)
  const timeMultiplier = getTimeMultiplier(address)

  return (baseTokens + delegatedTokens) * timeMultiplier
}

function getTimeMultiplier(address: string): number {
  const lockDuration = getStakeLockDuration(address)

  if (lockDuration >= 24) return 2.5  // 24+ months
  if (lockDuration >= 12) return 2.0  // 12-23 months
  if (lockDuration >= 6) return 1.5   // 6-11 months
  if (lockDuration >= 3) return 1.25  // 3-5 months
  return 1.0                          // No lock
}
```

### 3.3 Delegation

Token holders can delegate voting power without transferring tokens.

```typescript
interface Delegation {
  // Delegate voting power to another address
  delegate(to: string): Promise<TxHash>

  // Remove delegation (return to self)
  undelegate(): Promise<TxHash>

  // Check current delegate
  getDelegate(address: string): Promise<string | null>

  // Get total delegated to an address
  getDelegatedVotes(address: string): Promise<bigint>
}
```

**Delegation Rules:**
- Delegation is transitive (A→B, B→C means A's votes go to C)
- Max delegation depth: 2 (prevent loops)
- Delegation can be changed anytime (instant)
- Delegated tokens remain in delegator's wallet

---

## 4. Privacy-Preserving Voting (ZK)

### 4.1 Why Private Voting?

| Problem | Solution |
|---------|----------|
| Vote buying | Hidden votes prevent verification of payment |
| Coercion | Cannot prove how you voted |
| Whale tracking | Vote distribution unknown until reveal |
| Social pressure | Vote without judgment |

### 4.2 Commit-Reveal Scheme

SIP uses its own cryptographic primitives for private voting:

```
COMMIT PHASE (During voting period)
──────────────────────────────────────
1. Voter generates vote commitment:
   commitment = Pedersen(vote, blinding_factor)

2. Voter submits commitment on-chain
   (vote value hidden)

REVEAL PHASE (After voting ends)
──────────────────────────────────────
3. Voter reveals vote + blinding factor

4. Contract verifies:
   Pedersen(revealed_vote, revealed_blinding) == commitment

5. If valid, vote counted
```

### 4.3 Implementation with SIP Primitives

```typescript
import { createCommitment, verifyCommitment } from '@sip-protocol/sdk'

// Voter commits
async function commitVote(
  proposalId: string,
  vote: 'for' | 'against' | 'abstain',
  votingPower: bigint
): Promise<VoteCommitment> {
  // Encode vote as number
  const voteValue = vote === 'for' ? 1n : vote === 'against' ? 0n : 2n

  // Create Pedersen commitment
  const commitment = await createCommitment(voteValue * votingPower)

  // Store blinding factor securely (client-side)
  const blindingFactor = commitment.blindingFactor

  // Submit commitment on-chain
  return {
    proposalId,
    commitment: commitment.value,
    blindingFactor, // Keep secret until reveal
  }
}

// Voter reveals
async function revealVote(
  proposalId: string,
  vote: 'for' | 'against' | 'abstain',
  votingPower: bigint,
  blindingFactor: string
): Promise<TxHash> {
  const voteValue = vote === 'for' ? 1n : vote === 'against' ? 0n : 2n

  // Submit reveal to contract
  return governance.revealVote(
    proposalId,
    voteValue,
    votingPower,
    blindingFactor
  )
}
```

### 4.4 Viewing Keys for Vote Auditing

For compliance and transparency, voters can optionally share their voting viewing key:

```typescript
// Generate vote viewing key
const viewingKey = await generateVotingViewingKey(voterAddress)

// Share with auditor (e.g., foundation, regulator)
await shareVotingViewingKey(viewingKey, auditorAddress)

// Auditor can now verify voter's historical votes
const voteHistory = await auditVotes(viewingKey)
```

**Use Cases:**
- Institutional voters proving governance participation
- Grant recipients demonstrating engagement
- Regulatory compliance

---

## 5. Governance Bodies

### 5.1 Token Holders

- All $SIP holders
- Can vote directly or delegate
- Propose if meeting threshold

### 5.2 Delegates

Elected representatives who vote on behalf of delegators.

**Delegate Requirements:**
- Public identity (optional but encouraged)
- Written governance philosophy
- Regular voting participation (>80%)
- Communication with delegators

**Delegate Registry:**
```typescript
interface DelegateProfile {
  address: string
  name?: string           // Optional pseudonym/real name
  statement: string       // Governance philosophy
  votingHistory: Vote[]   // Past votes (public)
  delegators: number      // Number of delegators
  votingPower: bigint     // Total delegated power
}
```

### 5.3 Emergency Council

Multi-sig for critical security situations.

**Composition:** 5 members
- 2 Core team
- 2 Community-elected
- 1 Security expert (external)

**Powers:**
- Pause protocol (24h max without governance approval)
- Veto malicious proposals
- Emergency upgrades (with 72h timelock)

**Limitations:**
- Cannot access treasury
- Cannot change tokenomics
- Actions logged publicly
- Subject to governance removal

---

## 6. Progressive Decentralization

### 6.1 Decentralization Timeline

```
Phase 0: FOUNDATION (Current)
├── Core team multisig controls protocol
├── Community feedback via forums
└── Token not yet launched

Phase 1: LIMITED GOVERNANCE (Token Launch + 6 months)
├── Token holders can vote on non-critical proposals
├── Emergency council has veto power
├── Core team retains upgrade authority
└── Quorum: 3%

Phase 2: SHARED GOVERNANCE (Token Launch + 12 months)
├── Token holders vote on all proposals
├── Emergency council reduced to security-only
├── Delegate system active
└── Quorum: 5%

Phase 3: FULL DECENTRALIZATION (Token Launch + 24 months)
├── Complete DAO control
├── Emergency council subject to governance
├── All parameters governable
└── Quorum: 10%
```

### 6.2 Decentralization Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|
| Proposals decided by DAO | 30% | 70% | 100% |
| Treasury controlled by DAO | 20% | 60% | 100% |
| Upgrade authority | Team | Shared | DAO |
| Emergency council power | High | Medium | Low |

---

## 7. Treasury Management

### 7.1 Treasury Composition

```
┌─────────────────────────────────────────────────────────────────┐
│                    TREASURY ALLOCATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Stablecoins (USDC/USDT)        40%    Operating runway          │
│  Native tokens (SOL/ETH/NEAR)   30%    Ecosystem alignment       │
│  $SIP tokens                    20%    Buybacks, grants          │
│  DeFi yields                    10%    Treasury growth            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Treasury Operations

| Operation | Approval Required | Limit |
|-----------|-------------------|-------|
| Routine grants | Delegates | <$50K |
| Major grants | Full DAO | $50K-$500K |
| Strategic investments | Full DAO + Council | >$500K |
| Operational expenses | Delegates | <$25K/month |

### 7.3 Grant Program

```typescript
interface GrantProposal {
  title: string
  applicant: string
  amount: bigint
  milestones: Milestone[]
  category: 'development' | 'marketing' | 'research' | 'community'
}

interface Milestone {
  description: string
  deliverables: string[]
  fundingPercent: number  // % of grant released at completion
  deadline: Date
}
```

---

## 8. Dispute Resolution

### 8.1 Dispute Categories

1. **Proposal Disputes** — Disagreement on proposal validity
2. **Grant Disputes** — Milestone completion disagreements
3. **Council Disputes** — Emergency council action challenges

### 8.2 Resolution Process

```
1. INFORMAL RESOLUTION (7 days)
   └── Parties discuss in governance forum

2. MEDIATION (14 days)
   └── Neutral delegate mediates

3. ARBITRATION (7 days)
   └── Emergency council decides (non-binding)

4. GOVERNANCE VOTE (5 days)
   └── Token holders final decision
```

---

## 9. Governance Interfaces

### 9.1 On-Chain Contracts

```typescript
interface SIPGovernor {
  // Proposal management
  propose(targets: string[], values: bigint[], calldatas: bytes[]): Promise<ProposalId>
  queue(proposalId: ProposalId): Promise<TxHash>
  execute(proposalId: ProposalId): Promise<TxHash>
  cancel(proposalId: ProposalId): Promise<TxHash>

  // Voting
  castVote(proposalId: ProposalId, support: VoteType): Promise<TxHash>
  castVoteWithReason(proposalId: ProposalId, support: VoteType, reason: string): Promise<TxHash>
  castVoteCommitment(proposalId: ProposalId, commitment: bytes32): Promise<TxHash>
  revealVote(proposalId: ProposalId, support: VoteType, blinding: bytes32): Promise<TxHash>

  // Views
  getProposal(proposalId: ProposalId): Promise<Proposal>
  getVotes(account: string, blockNumber: number): Promise<bigint>
  hasVoted(proposalId: ProposalId, account: string): Promise<boolean>
}
```

### 9.2 Off-Chain Infrastructure

- **Forum:** Discourse or Commonwealth for discussion
- **Snapshot:** Off-chain signaling (gas-free)
- **Dashboard:** Real-time governance analytics
- **Notifications:** Email/push for proposal updates

---

## 10. Security Considerations

### 10.1 Attack Vectors

| Attack | Mitigation |
|--------|------------|
| Flash loan voting | Snapshot at proposal creation |
| Governance extraction | Timelocks, emergency veto |
| Proposal spam | Minimum threshold, deposit |
| Bribery | Private voting, commit-reveal |
| 51% attack | Time-locked voting power, progressive decentralization |

### 10.2 Timelock Parameters

| Action | Minimum Timelock |
|--------|------------------|
| Parameter change | 24 hours |
| Treasury transfer | 48 hours |
| Contract upgrade | 72 hours |
| Emergency pause | Immediate (council) |

---

## 11. Implementation Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **Design** | M20-31 | This document, token spec |
| **Contracts** | TBD | Governor, Timelock, Token |
| **Audit** | TBD | Security review |
| **Testnet** | TBD | Community testing |
| **Mainnet** | TBD | Progressive rollout |

---

## 12. References

- [OpenZeppelin Governor](https://docs.openzeppelin.com/contracts/governance)
- [Compound Governor Bravo](https://compound.finance/docs/governance)
- [Nouns DAO](https://nouns.wtf/vote)
- [Optimism Collective](https://community.optimism.io/docs/governance/)
- [Private Voting Research](https://eprint.iacr.org/2021/1194.pdf)

---

*This framework is subject to community feedback and governance approval.*
