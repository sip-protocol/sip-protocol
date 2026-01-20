# SIP-EIP Engagement Strategy

**Status:** Active
**Version:** 1.0.0
**Last Updated:** 2026-01-20
**Related:** [SIP-EIP Specification](./SIP-EIP.md), [Working Group Charter](./WORKING-GROUP-CHARTER.md)

---

## Executive Summary

This document outlines the strategy for engaging with Ethereum Foundation EIP editors and the broader Ethereum community to shepherd the SIP-EIP (Shielded Intents Protocol) specification through the EIP review process. The goal is to establish SIP as an official Ethereum standard for privacy-preserving transactions.

**Target Outcome:** SIP-EIP reaches **Final** status within 12-18 months.

---

## 1. EIP Process Overview

### 1.1 EIP Stages

```
┌─────────┐    ┌─────────┐    ┌───────────┐    ┌─────────┐
│  Draft  │ ─► │ Review  │ ─► │ Last Call │ ─► │  Final  │
└─────────┘    └─────────┘    └───────────┘    └─────────┘
     │              │               │
     └──────────────┴───────────────┘
              May revert if changes needed
```

| Stage | Description | Duration | Requirements |
|-------|-------------|----------|--------------|
| **Draft** | Initial submission, properly formatted | Variable | Pass EIP editor review |
| **Review** | Ready for peer review | 2-6 months | Author marks ready, no blocking issues |
| **Last Call** | Final review window | 14 days min | Stable specification |
| **Final** | Accepted standard | Permanent | No normative changes during Last Call |
| **Stagnant** | Inactive for 6+ months | N/A | Can be resurrected |

### 1.2 Key Repositories

| Repository | Purpose | URL |
|------------|---------|-----|
| **EIPs** | Core protocol EIPs | https://github.com/ethereum/EIPs |
| **ERCs** | Application-level ERCs | https://github.com/ethereum/ERCs |
| **Eth Magicians** | Discussion forum | https://ethereum-magicians.org/ |

**Note:** SIP-EIP should be submitted to the **ERCs** repository as it's an application-level standard (similar to ERC-5564/ERC-6538).

---

## 2. Stakeholder Mapping

### 2.1 Current EIP Editors

| Editor | GitHub | Focus Areas | Priority |
|--------|--------|-------------|----------|
| **Sam Wilson** | @SamWilsn | Process, Office Hours | High |
| **Matt Garnett** | @lightclient | Core Protocol | Medium |
| **Alex Beregszaszi** | @axic | Compiler, EVM | Medium |
| **Gavin John** | @Pandapip1 | ERCs, Process | High |
| **Greg Colvin** | @gcolvin | EVM, Core | Low |

**Engagement Priority:**
- **High:** Directly relevant to application-level standards
- **Medium:** Useful for technical feedback
- **Low:** Less relevant to privacy/application standards

### 2.2 Stealth Address EIP Authors (Key Champions)

These individuals authored the related ERC-5564 and ERC-6538 standards and are ideal champions for SIP-EIP:

| Author | GitHub | Organization | Relationship |
|--------|--------|--------------|--------------|
| **Toni Wahrstätter** | @nerolation | Ethereum Foundation | Primary champion target |
| **Matt Solomon** | @mds1 | ScopeLift | SDK author, key ally |
| **Ben DiFrancesco** | @apbendi | ScopeLift | Implementation expert |
| **Gary Ghayrat** | @garyghayrat | Independent | Registry expertise |
| **Vitalik Buterin** | @vbuterin | Ethereum Foundation | High-profile endorsement |

**Strategy:** Position SIP-EIP as complementary to ERC-5564/ERC-6538, building on their foundation.

### 2.3 Ethereum Cat Herders

The Cat Herders coordinate EIP Office Hours and process management:

| Role | Contact | Engagement |
|------|---------|------------|
| **Office Hours Host** | @poojaranjan | Submit EIP for review |
| **Process Coordinator** | EIPIP GitHub | Track progress |

---

## 3. Engagement Timeline

### Phase 1: Pre-Submission (Weeks 1-4)

| Week | Activity | Owner | Deliverable |
|------|----------|-------|-------------|
| 1 | Finalize SIP-EIP specification | SIP Team | Complete spec document |
| 1 | Create Eth Magicians discussion thread | SIP Team | Forum post link |
| 2 | Reach out to ERC-5564 authors | SIP Team | Initial contact established |
| 2-3 | Gather community feedback | Community | Feedback incorporated |
| 3-4 | Address feedback, refine spec | SIP Team | Updated specification |

### Phase 2: Submission (Weeks 5-8)

| Week | Activity | Owner | Deliverable |
|------|----------|-------|-------------|
| 5 | Submit PR to ethereum/ERCs | SIP Team | PR number |
| 5 | Notify EIP editors | SIP Team | Editor acknowledgment |
| 6 | Attend EIP Office Hours | SIP Team | Meeting notes |
| 6-8 | Address editor feedback | SIP Team | All comments resolved |
| 8 | EIP merged as Draft | Editors | Draft status |

### Phase 3: Review (Months 3-9)

| Month | Activity | Owner | Deliverable |
|-------|----------|-------|-------------|
| 3 | Mark ready for Review | SIP Team | Review status |
| 3-6 | Peer review period | Community | Review comments |
| 4 | Present at Eth research calls | SIP Team | Presentation |
| 5 | Publish reference implementations | SIP Team | Working code |
| 6-9 | Address all feedback | SIP Team | No blocking issues |

### Phase 4: Finalization (Months 10-12)

| Month | Activity | Owner | Deliverable |
|-------|----------|-------|-------------|
| 10 | Request Last Call | SIP Team | Last Call status |
| 10-11 | 14-day Last Call period | Community | Final feedback |
| 11-12 | Address any final issues | SIP Team | No changes needed |
| 12 | Move to Final | Editors | Final status |

---

## 4. Communication Channels

### 4.1 Primary Channels

| Channel | Purpose | Frequency |
|---------|---------|-----------|
| **Eth Magicians Forum** | Main discussion thread | Ongoing |
| **GitHub ERCs** | Technical issues/PRs | As needed |
| **EIP Office Hours** | Live editor feedback | Bi-weekly |
| **Twitter/X** | Announcements | Major milestones |

### 4.2 EIP Office Hours

**Schedule:** Bi-weekly, 16:00 UTC (check current schedule)
**Format:** Video call with EIP editors
**How to Participate:**
1. Add your EIP to the agenda (posted on Eth Magicians)
2. Join the call
3. Present your EIP (5-10 minutes)
4. Receive feedback
5. Document action items

### 4.3 Eth Magicians Thread Structure

```markdown
# ERC-XXXX: Shielded Intents Protocol (SIP)

## Overview
[Brief summary - not a copy of the EIP]

## Motivation
[Why this standard is needed]

## Key Features
- Stealth addresses (builds on ERC-5564)
- Pedersen commitments for amount hiding
- Viewing keys for compliance
- Multi-chain support

## Reference Implementation
[Link to SDK and reference code]

## Discussion Points
[Specific questions for community]

## Related Standards
- ERC-5564: Stealth Addresses
- ERC-6538: Stealth Meta-Address Registry

## Links
- [Full Specification](link)
- [Reference Implementation](link)
- [Documentation](link)
```

---

## 5. Outreach Templates

### 5.1 Initial Contact to ERC-5564 Authors

**Subject:** SIP Protocol - Building on ERC-5564/6538 for Privacy Intents

```
Hi [Name],

I'm [Your Name] from the SIP Protocol team. We've been building a
privacy-preserving intent protocol that extends the stealth address
work you pioneered with ERC-5564 and ERC-6538.

SIP adds:
- Pedersen commitments for amount hiding
- Viewing keys for regulatory compliance
- Cross-chain privacy for intents

We're preparing to submit SIP as an ERC and would love your feedback:
- Technical review of our approach
- Compatibility with ERC-5564/6538
- Potential collaboration opportunities

Our draft specification: [link]
Reference implementation: [link]

Would you have 30 minutes for a call to discuss? We're big fans of
your work and want to ensure SIP complements rather than fragments
the stealth address ecosystem.

Best,
[Your Name]
SIP Protocol Team
```

### 5.2 EIP Editor Introduction

**Subject:** New ERC Submission - Shielded Intents Protocol (SIP)

```
Hi [Editor Name],

We're submitting a new ERC for Shielded Intents Protocol (SIP), a
privacy-preserving transaction standard that builds on ERC-5564
(Stealth Addresses) and ERC-6538 (Stealth Meta-Address Registry).

PR: [link to PR]
Discussion: [link to Eth Magicians thread]

Key additions to the stealth address ecosystem:
1. Pedersen commitments for hidden amounts
2. Viewing keys for selective disclosure
3. Intent-based architecture for cross-chain privacy

We've already:
- Engaged with ERC-5564/6538 authors
- Published reference implementation (TypeScript SDK)
- Deployed testnet contracts

We'd appreciate guidance on:
- Any formatting issues to address
- Recommended reviewers
- Timeline expectations

Happy to attend the next Office Hours if helpful.

Best,
[Your Name]
```

### 5.3 Community Announcement

**For Twitter/X:**

```
🛡️ Introducing SIP-EIP: The Privacy Standard for Web3

We're submitting the Shielded Intents Protocol as an Ethereum ERC!

Building on @neloation's ERC-5564 stealth addresses:
✅ Pedersen commitments (hidden amounts)
✅ Viewing keys (compliance)
✅ Multi-chain support

Discussion: [Eth Magicians link]
Spec: [GitHub link]

#Ethereum #Privacy #EIP
```

**For Eth Magicians:**

See Section 4.3 thread structure above.

### 5.4 Office Hours Request

**Posted to Eth Magicians meeting agenda:**

```
## ERC-XXXX: Shielded Intents Protocol (SIP)

**Author:** [Your GitHub handle]
**PR:** [link]
**Discussion:** [link]

### Agenda Items:
1. Review of specification structure
2. Compatibility verification with ERC-5564/6538
3. Security considerations feedback
4. Next steps for Review status

### Questions for Editors:
- Is the interface specification complete?
- Any concerns about the cryptographic primitives section?
- Recommended security reviewers?

**Time Needed:** 10 minutes
```

---

## 6. Success Metrics

### 6.1 Engagement Metrics

| Metric | Target | Tracking |
|--------|--------|----------|
| Eth Magicians thread replies | 20+ | Forum analytics |
| GitHub PR comments | 50+ | GitHub |
| Office Hours presentations | 3+ | Meeting notes |
| Champion endorsements | 2+ | Public statements |

### 6.2 Progress Metrics

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Eth Magicians thread created | Week 1 | 🔲 Pending |
| Initial outreach to ERC-5564 authors | Week 2 | 🔲 Pending |
| PR submitted to ethereum/ERCs | Week 5 | 🔲 Pending |
| First Office Hours presentation | Week 6 | 🔲 Pending |
| Draft status achieved | Week 8 | 🔲 Pending |
| Review status achieved | Month 6 | 🔲 Pending |
| Last Call initiated | Month 10 | 🔲 Pending |
| Final status achieved | Month 12 | 🔲 Pending |

### 6.3 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Editor feedback response time | < 1 week | Time to PR update |
| Open issues | 0 for Review | GitHub issues |
| Reference implementation coverage | 100% | Test coverage |
| Security audit | Completed | Audit report |

---

## 7. Risk Mitigation

### 7.1 Potential Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Stagnation (6+ months inactive) | High | Medium | Regular updates, active engagement |
| Rejection due to overlap with ERC-5564 | High | Low | Position as extension, get author buy-in |
| Security concerns block progress | High | Medium | Pre-submit security audit |
| Editor capacity constraints | Medium | Medium | Multiple editor relationships |
| Community pushback | Medium | Low | Early community engagement |

### 7.2 Mitigation Strategies

**Stagnation Prevention:**
- Set calendar reminders for monthly progress updates
- Maintain active Eth Magicians thread
- Present at least quarterly at Office Hours

**Overlap Concerns:**
- Explicitly reference ERC-5564/6538 as foundation
- Get endorsements from original authors
- Show clear differentiation (commitments, viewing keys, intents)

**Security Concerns:**
- Complete security audit before submission
- Document all cryptographic assumptions
- Provide formal verification where possible

---

## 8. Reference Resources

### 8.1 Successful EIP Examples

Study these for best practices:

| EIP | Authors | Notes |
|-----|---------|-------|
| [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) | Wahrstätter, Solomon, et al. | Stealth addresses - direct foundation |
| [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538) | Solomon, Wahrstätter, et al. | Registry - complementary standard |
| [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) | Buterin, et al. | Account abstraction - complex standard success |
| [ERC-721](https://eips.ethereum.org/EIPS/eip-721) | Entriken, et al. | NFT standard - clear interfaces |

### 8.2 Key Documents

| Document | Location |
|----------|----------|
| EIP-1: EIP Purpose and Guidelines | https://eips.ethereum.org/EIPS/eip-1 |
| EIP-5069: EIP Editor Handbook | https://eips.ethereum.org/EIPS/eip-5069 |
| ERC Template | https://github.com/ethereum/ERCs/blob/master/erc-template.md |
| SIP-EIP Specification | [./SIP-EIP.md](./SIP-EIP.md) |

### 8.3 Community Links

| Resource | URL |
|----------|-----|
| Fellowship of Ethereum Magicians | https://ethereum-magicians.org/ |
| EIP Office Hours | Check Eth Magicians for schedule |
| Ethereum ERCs GitHub | https://github.com/ethereum/ERCs |
| ScopeLift Stealth SDK | https://github.com/ScopeLift/stealth-address-sdk |

---

## 9. Tracking Dashboard

### 9.1 Current Status

```
EIP Submission Status: 🔲 Not Started

Progress:
├── Pre-Submission
│   ├── 🔲 Specification finalized
│   ├── 🔲 Eth Magicians thread created
│   ├── 🔲 ERC-5564 authors contacted
│   └── 🔲 Community feedback incorporated
│
├── Submission
│   ├── 🔲 PR submitted to ethereum/ERCs
│   ├── 🔲 Editor review requested
│   ├── 🔲 Office Hours presented
│   └── 🔲 Draft status achieved
│
├── Review
│   ├── 🔲 Peer review complete
│   ├── 🔲 All feedback addressed
│   └── 🔲 Review status achieved
│
└── Finalization
    ├── 🔲 Last Call initiated
    ├── 🔲 14-day period complete
    └── 🔲 Final status achieved
```

### 9.2 Contact Log

| Date | Contact | Channel | Topic | Outcome | Follow-up |
|------|---------|---------|-------|---------|-----------|
| | | | | | |

### 9.3 Action Items

| Item | Owner | Due | Status |
|------|-------|-----|--------|
| Create Eth Magicians thread | SIP Team | TBD | 🔲 |
| Contact @nerolation | SIP Team | TBD | 🔲 |
| Contact @mds1 | SIP Team | TBD | 🔲 |
| Submit PR to ERCs | SIP Team | TBD | 🔲 |
| Register for Office Hours | SIP Team | TBD | 🔲 |

---

## 10. Appendix: EIP Formatting Checklist

Before submitting, verify:

- [ ] **Preamble** complete (EIP number auto-assigned)
  - [ ] Title < 44 characters
  - [ ] Description < 140 characters
  - [ ] Author(s) with email/GitHub
  - [ ] Type: Standards Track
  - [ ] Category: ERC
  - [ ] Created date
  - [ ] Requires: ERC-5564, ERC-6538

- [ ] **Abstract** (< 200 words)
- [ ] **Motivation** section
- [ ] **Specification** section
  - [ ] Language: "MUST", "SHOULD", "MAY" per RFC 2119
  - [ ] All interfaces defined
  - [ ] All data structures defined
- [ ] **Rationale** section
- [ ] **Backwards Compatibility** section
- [ ] **Reference Implementation** section
- [ ] **Security Considerations** section
- [ ] **Copyright** waiver (CC0)

---

*This strategy document is a living document and should be updated as the EIP process progresses.*
