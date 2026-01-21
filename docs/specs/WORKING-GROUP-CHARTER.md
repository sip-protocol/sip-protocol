# SIP Cross-Chain Privacy Working Group Charter

**Status:** Draft
**Version:** 0.1.0
**Created:** 2026-01-20
**Last Updated:** 2026-01-20

---

## Executive Summary

The SIP Cross-Chain Privacy Working Group (SIP-WG) is a multi-stakeholder collaboration focused on developing, standardizing, and promoting privacy-preserving transaction standards across blockchain ecosystems. The group brings together chain foundations, privacy projects, wallet developers, and researchers to create interoperable privacy solutions.

**Mission:** Establish SIP as the universal privacy standard for Web3 transactions.

**Vision:** A blockchain ecosystem where privacy is the default, compliance is achievable, and users control their financial data across all chains.

---

## 1. Working Group Objectives

### 1.1 Primary Objectives

| Objective | Description | Success Metric |
|-----------|-------------|----------------|
| **Standardization** | Finalize SIP-EIP as cross-chain privacy standard | EIP merged, adopted by 3+ chains |
| **Interoperability** | Ensure consistent privacy across ecosystems | Shared test vectors pass on all implementations |
| **Adoption** | Drive integration into wallets and dApps | 5+ wallet integrations, 10+ dApp adoptions |
| **Education** | Publish resources on compliant privacy | 10+ educational resources, 1000+ developers reached |

### 1.2 Deliverables

**Year 1 Deliverables:**
1. Finalized SIP-EIP specification
2. Reference implementations in 4 languages (TypeScript, Rust, Python, Go)
3. Compliance framework documentation
4. Integration guides for major wallets
5. Security audit of core specification

**Year 2 Deliverables:**
1. Cross-chain privacy bridge specifications
2. Hardware wallet integration standards
3. Enterprise compliance toolkit
4. Academic paper on SIP privacy guarantees

---

## 2. Membership Structure

### 2.1 Membership Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKING GROUP MEMBERSHIP STRUCTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CORE MAINTAINERS (3-5 members)                                      │    │
│  │  • SIP Protocol Team                                                 │    │
│  │  • Elected from active contributors                                  │    │
│  │  • Responsible for specification maintenance                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CHAIN REPRESENTATIVES (1 per ecosystem)                             │    │
│  │  • Ethereum, Solana, NEAR, Cosmos, Bitcoin L2s                       │    │
│  │  • Foundation or core team members                                   │    │
│  │  • Provide ecosystem-specific feedback                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PRIVACY PROJECT REPRESENTATIVES                                     │    │
│  │  • Zcash, Aztec, Railgun, Tornado alternatives                       │    │
│  │  • Cryptographic expertise                                           │    │
│  │  • Privacy research collaboration                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  WALLET & INFRASTRUCTURE PARTNERS                                    │    │
│  │  • MetaMask, Phantom, Rainbow, Ledger                                │    │
│  │  • RPC providers, indexers                                           │    │
│  │  • Integration feedback                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  COMMUNITY CONTRIBUTORS (Open)                                       │    │
│  │  • Developers, researchers, auditors                                 │    │
│  │  • Open participation in discussions                                 │    │
│  │  • Can submit proposals and implementations                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Membership Criteria

| Category | Requirements | Voting Rights |
|----------|--------------|---------------|
| **Core Maintainer** | 6+ months active contribution, elected by WG | Full voting |
| **Chain Representative** | Foundation/core team member, active participation | Full voting |
| **Privacy Representative** | Active privacy project contributor | Full voting |
| **Wallet Partner** | Integration commitment or active development | Full voting |
| **Community Contributor** | Signed contributor agreement | Advisory (non-binding) |

### 2.3 Target Membership

**Chain Ecosystems (5+ target):**

| Ecosystem | Target Representative | Status |
|-----------|----------------------|--------|
| Ethereum | EF Privacy Team / Vitalik's circle | 🔲 To invite |
| Solana | Solana Foundation / Privacy focus | 🔲 To invite |
| NEAR | NEAR Foundation (existing relationship) | 🔲 To invite |
| Cosmos | Interchain Foundation | 🔲 To invite |
| Bitcoin L2 | Lightning Labs / Stacks | 🔲 To invite |
| Polygon | Polygon Labs | 🔲 To invite |
| Arbitrum | Offchain Labs | 🔲 To invite |

**Privacy Projects:**

| Project | Focus | Status |
|---------|-------|--------|
| Zcash | Shielded transactions, viewing keys | 🔲 To invite |
| Aztec | ZK rollups, private DeFi | 🔲 To invite |
| Railgun | Privacy on EVM | 🔲 To invite |
| Penumbra | Private Cosmos chain | 🔲 To invite |
| Mina | Succinct blockchain | 🔲 To invite |

**Wallet Developers:**

| Wallet | Platforms | Status |
|--------|-----------|--------|
| MetaMask | Browser, Mobile | 🔲 To invite |
| Phantom | Solana, Multi-chain | 🔲 To invite |
| Rainbow | Ethereum, Mobile-first | 🔲 To invite |
| Ledger | Hardware | 🔲 To invite |
| Backpack | Multi-chain | 🔲 To invite |

---

## 3. Governance

### 3.1 Decision-Making Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DECISION-MAKING PROCESS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROPOSAL SUBMISSION                                                         │
│  └── Any member can submit via GitHub Issue                                  │
│                                    │                                         │
│                                    ▼                                         │
│  DISCUSSION PERIOD (14 days minimum)                                         │
│  └── Open discussion on GitHub + Discord                                     │
│  └── Author addresses feedback, revises proposal                             │
│                                    │                                         │
│                                    ▼                                         │
│  VOTING PERIOD (7 days)                                                      │
│  └── Voting members cast votes on GitHub                                     │
│  └── Options: Approve, Reject, Abstain                                       │
│                                    │                                         │
│                                    ▼                                         │
│  DECISION                                                                    │
│  └── Pass: 2/3 supermajority of voting members                               │
│  └── Quorum: 50% of voting members must participate                          │
│                                    │                                         │
│                                    ▼                                         │
│  IMPLEMENTATION                                                              │
│  └── Core maintainers merge approved changes                                 │
│  └── Changelog updated, version bumped                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Proposal Types

| Type | Description | Voting Threshold | Timeframe |
|------|-------------|------------------|-----------|
| **Spec Change** | Modifications to SIP-EIP | 2/3 supermajority | 14 + 7 days |
| **New Feature** | Adding new capabilities | 2/3 supermajority | 14 + 7 days |
| **Bug Fix** | Corrections to spec | Simple majority | 7 + 3 days |
| **Documentation** | Non-normative changes | Simple majority | 7 + 3 days |
| **Membership** | New voting members | 2/3 supermajority | 14 + 7 days |
| **Charter Change** | Governance modifications | 3/4 supermajority | 21 + 7 days |

### 3.3 Conflict Resolution

1. **Technical Disputes**: Resolved by reference implementation behavior
2. **Interpretation Disputes**: Core maintainers provide authoritative interpretation
3. **Membership Disputes**: Resolved by 2/3 vote of non-involved voting members
4. **Unresolved Conflicts**: Escalate to external mediator (mutually agreed)

---

## 4. Communication Channels

### 4.1 Primary Channels

| Channel | Purpose | Access |
|---------|---------|--------|
| **GitHub Discussions** | Proposals, spec discussions | Public |
| **Discord Server** | Real-time collaboration | Invite-only for WG, public read |
| **Monthly Calls** | Sync meetings, decisions | Voting members + invited guests |
| **Mailing List** | Announcements, summaries | Public subscribe |

### 4.2 Discord Structure

```
SIP Working Group Discord
├── #announcements          (read-only, announcements)
├── #general                (public discussion)
├── #introductions          (new member intros)
├── spec-discussion/
│   ├── #stealth-addresses  (EIP-5564 extension)
│   ├── #commitments        (Pedersen scheme)
│   ├── #viewing-keys       (Compliance)
│   └── #cross-chain        (Multi-chain)
├── implementation/
│   ├── #typescript-sdk
│   ├── #rust-sdk
│   ├── #circuits           (Noir/ZK)
│   └── #wallets            (Integration)
├── ecosystem/
│   ├── #ethereum
│   ├── #solana
│   ├── #near
│   └── #cosmos
├── working-group/          (Voting members only)
│   ├── #core-maintainers
│   ├── #voting
│   └── #private
└── community/
    ├── #help
    ├── #showcase
    └── #off-topic
```

### 4.3 Meeting Cadence

| Meeting | Frequency | Duration | Attendees |
|---------|-----------|----------|-----------|
| **WG Sync** | Monthly | 60 min | All voting members |
| **Core Maintainers** | Bi-weekly | 30 min | Core maintainers |
| **Implementation Sync** | Weekly | 45 min | SDK developers |
| **Community Call** | Monthly | 45 min | Open to all |

**Meeting Schedule:**
- WG Sync: First Tuesday of month, 17:00 UTC
- Core Maintainers: Every other Thursday, 16:00 UTC
- Implementation Sync: Wednesdays, 15:00 UTC
- Community Call: Third Thursday of month, 18:00 UTC

---

## 5. Document Repository

### 5.1 Repository Structure

```
github.com/sip-protocol/sip-working-group/
├── README.md                 # Charter summary
├── CHARTER.md               # This document
├── MEMBERS.md               # Current membership roster
├── meetings/
│   ├── 2026/
│   │   ├── 2026-01-wg-sync.md
│   │   ├── 2026-02-wg-sync.md
│   │   └── ...
│   └── templates/
│       ├── meeting-template.md
│       └── decision-template.md
├── proposals/
│   ├── accepted/
│   ├── rejected/
│   └── active/
├── decisions/
│   ├── DEC-001-charter-adoption.md
│   └── ...
└── resources/
    ├── onboarding.md
    ├── contributor-guide.md
    └── glossary.md
```

### 5.2 Shared Resources

| Resource | Location | Purpose |
|----------|----------|---------|
| Specification | `sip-protocol/sip-protocol/docs/specs/` | Normative spec |
| Test Vectors | `sip-protocol/sip-protocol/tests/fixtures/` | Compliance testing |
| Reference Impl | `sip-protocol/sip-protocol/packages/sdk/` | Canonical code |
| Meeting Notes | `sip-working-group/meetings/` | Decision history |
| Proposals | `sip-working-group/proposals/` | Change tracking |

---

## 6. Outreach Strategy

### 6.1 Invitation Template

**Subject:** Invitation to Join SIP Cross-Chain Privacy Working Group

```markdown
Dear [Name],

I'm reaching out on behalf of the SIP Protocol team to invite [Organization]
to join the SIP Cross-Chain Privacy Working Group.

**What is SIP?**
SIP (Shielded Intents Protocol) is developing a universal privacy standard
for blockchain transactions—combining stealth addresses, Pedersen commitments,
and viewing keys for compliant privacy across any chain.

**Why Join?**
- Shape the future of cross-chain privacy standards
- Ensure [Ecosystem] compatibility and optimization
- Collaborate with leading privacy and wallet teams
- Early access to specifications and implementations

**Commitment:**
- Monthly 1-hour sync calls
- Review and feedback on specifications
- Optional: contribute to implementation

**Recent Achievements:**
- Zypherpunk Hackathon Winner ($6,500, #14 of 88, 3 tracks)
- 5,500+ tests, production SDK
- Multi-chain support (Ethereum, Solana, NEAR, Cosmos)

**Next Steps:**
Would you be available for a 30-minute call to discuss?
I'd love to share our roadmap and hear your perspective on [specific topic].

Best regards,
[Name]
SIP Protocol Team
```

### 6.2 Outreach Timeline

| Week | Target | Action |
|------|--------|--------|
| Week 1 | NEAR Foundation | Leverage hackathon relationship |
| Week 1 | Zcash Foundation | Privacy expertise collaboration |
| Week 2 | Solana Foundation | Same-chain privacy focus |
| Week 2 | Phantom Wallet | Solana wallet integration |
| Week 3 | Ethereum Foundation | EIP standardization |
| Week 3 | MetaMask / ConsenSys | EVM wallet integration |
| Week 4 | Aztec | ZK expertise |
| Week 4 | Rainbow Wallet | Mobile-first perspective |

### 6.3 Value Propositions by Stakeholder

| Stakeholder | Value Proposition |
|-------------|-------------------|
| **Chain Foundations** | Universal privacy standard reduces fragmentation |
| **Privacy Projects** | Collaboration amplifies impact, shared research |
| **Wallet Developers** | One integration covers multiple chains |
| **Enterprises** | Compliance-ready privacy enables adoption |
| **Regulators** | Viewing keys provide authorized access |

---

## 7. Code of Conduct

### 7.1 Core Principles

1. **Respect**: Treat all members with dignity and respect
2. **Collaboration**: Work together toward shared goals
3. **Transparency**: Conduct business openly and document decisions
4. **Inclusion**: Welcome diverse perspectives and backgrounds
5. **Technical Merit**: Base decisions on technical merit, not politics

### 7.2 Unacceptable Behavior

- Personal attacks or harassment
- Discrimination based on identity
- Sharing confidential information without consent
- Disrupting meetings or discussions
- Misrepresenting WG positions or decisions

### 7.3 Enforcement

1. **Warning**: First violation results in private warning
2. **Temporary Suspension**: Second violation, 30-day suspension from voting
3. **Removal**: Third violation or severe breach, permanent removal
4. **Appeal**: Members may appeal to non-involved core maintainers

---

## 8. Intellectual Property

### 8.1 Licensing

| Content | License | Notes |
|---------|---------|-------|
| Specifications | CC0 | Public domain |
| Reference Code | MIT | Permissive open source |
| Meeting Notes | CC-BY-4.0 | Attribution required |
| Proposals | CC0 | Public domain |

### 8.2 Contributor Agreement

All contributors must agree to:
1. License contributions under the appropriate license above
2. Not submit patented material without disclosure
3. Grant perpetual, irrevocable license to the WG

### 8.3 Patent Policy

- Members agree not to assert patents against SIP implementations
- Patent-encumbered proposals must be disclosed before voting
- WG may reject proposals with problematic IP

---

## 9. Success Metrics

### 9.1 Adoption Metrics

| Metric | Year 1 Target | Year 2 Target |
|--------|---------------|---------------|
| Chain integrations | 3 | 7 |
| Wallet integrations | 5 | 15 |
| dApp adoptions | 10 | 50 |
| Monthly active users | 1,000 | 50,000 |
| TVL in SIP transactions | $10M | $500M |

### 9.2 Community Metrics

| Metric | Year 1 Target | Year 2 Target |
|--------|---------------|---------------|
| Voting members | 15 | 30 |
| Community contributors | 50 | 200 |
| Discord members | 500 | 5,000 |
| GitHub stars | 500 | 2,000 |

### 9.3 Specification Metrics

| Metric | Year 1 Target | Year 2 Target |
|--------|---------------|---------------|
| EIP status | Final | Adopted standard |
| Security audits | 2 | 4 |
| Test vector compliance | 100% | 100% |
| Reference implementations | 4 | 6 |

---

## 10. Timeline

### 10.1 Formation Phase (Q1 2026)

| Month | Milestone |
|-------|-----------|
| January | Charter draft, initial outreach |
| February | First members confirmed, Discord setup |
| March | First WG sync call, governance ratified |

### 10.2 Growth Phase (Q2-Q3 2026)

| Quarter | Focus |
|---------|-------|
| Q2 | Expand membership, EIP submission |
| Q3 | Wallet integrations, security audit |

### 10.3 Maturity Phase (Q4 2026+)

| Quarter | Focus |
|---------|-------|
| Q4 2026 | Cross-chain implementations |
| 2027+ | Ongoing maintenance, new features |

---

## 11. Amendments

This charter may be amended by 3/4 supermajority vote of voting members after a 21-day discussion period and 7-day voting period.

**Version History:**
| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-20 | Initial draft |

---

## Appendix A: Onboarding Checklist

New voting members should complete:

- [ ] Sign contributor agreement
- [ ] Join Discord server
- [ ] Add to GitHub organization
- [ ] Subscribe to mailing list
- [ ] Add to meeting calendar
- [ ] Introduction in #introductions
- [ ] Review specification and charter
- [ ] Attend first WG sync call

---

## Appendix B: Meeting Template

```markdown
# SIP Working Group Sync - [Date]

## Attendees
- [ ] Name (Organization)

## Agenda
1. Review action items from last meeting
2. Specification updates
3. Implementation progress
4. New proposals
5. Open discussion

## Notes

### 1. Action Items Review
- [ ] Item 1 - Owner - Status

### 2. Specification Updates
- ...

### 3. Implementation Progress
- ...

### 4. New Proposals
- ...

### 5. Open Discussion
- ...

## Action Items
- [ ] New item - Owner - Due date

## Next Meeting
- Date: [Next month first Tuesday]
- Time: 17:00 UTC
```

---

*This charter establishes the foundation for collaborative cross-chain privacy standardization. All members commit to its principles and processes.*
