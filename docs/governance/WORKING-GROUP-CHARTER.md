# Privacy Standards Working Group Charter

**Shielded Intents Protocol Industry Working Group**

**Version:** 1.0.0
**Effective Date:** Q1 2026
**Status:** Draft (Pending Founding Member Ratification)

---

## 1. Purpose and Mission

### 1.1 Mission Statement

The Privacy Standards Working Group (PSWG) is an open, collaborative body established to develop, promote, and maintain interoperable privacy standards for the blockchain industry. Our mission is to enable **privacy by default, disclosure by choice** across all chains and applications.

### 1.2 Vision

A blockchain ecosystem where:
- Users have strong financial privacy protections
- Regulatory compliance is built into privacy solutions
- Standards enable interoperability across chains and applications
- Privacy is accessible to all, not just technical experts

### 1.3 Core Principles

| Principle | Description |
|-----------|-------------|
| **Open** | Transparent processes, public specifications, permissionless participation |
| **Neutral** | No single vendor or project controls outcomes |
| **Practical** | Standards that can be implemented and adopted |
| **Compliant** | Privacy that works within regulatory frameworks |
| **Inclusive** | Diverse perspectives from across the ecosystem |

---

## 2. Scope

### 2.1 In Scope

The Working Group focuses on:

1. **Privacy Standards Development**
   - Stealth address specifications
   - Commitment schemes and formats
   - Viewing key standards
   - Cross-chain privacy protocols

2. **Interoperability**
   - Cross-implementation compatibility
   - Bridge integration standards
   - Wallet integration standards
   - RPC provider standards

3. **Compliance Frameworks**
   - Viewing key disclosure protocols
   - Audit trail specifications
   - Travel Rule integration
   - Sanctions screening guidance

4. **Reference Implementations**
   - Open-source reference code
   - Test vectors and suites
   - Compliance testing tools

### 2.2 Out of Scope

The Working Group does NOT:

- Develop proprietary or closed standards
- Favor any single implementation over others
- Provide legal advice or regulatory interpretation
- Certify or audit specific implementations
- Develop consensus mechanisms or L1 protocols

---

## 3. Membership

### 3.1 Member Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MEMBERSHIP STRUCTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FOUNDING MEMBERS                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Initial signatories who ratify the charter                         │   │
│  │ • Full voting rights                                                │   │
│  │ • Steering committee eligibility                                    │   │
│  │ • Charter amendment rights                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FULL MEMBERS                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Organizations actively implementing or using privacy standards      │   │
│  │ • Full voting rights                                                │   │
│  │ • Subgroup participation                                            │   │
│  │ • Proposal submission rights                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  OBSERVER MEMBERS                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Interested parties following standards development                  │   │
│  │ • Meeting attendance (non-voting)                                   │   │
│  │ • Public comment rights                                             │   │
│  │ • Mailing list access                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  INDIVIDUAL CONTRIBUTORS                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Independent developers and researchers                              │   │
│  │ • Technical contribution rights                                     │   │
│  │ • Public comment rights                                             │   │
│  │ • Recognition for contributions                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Membership Criteria

**Founding Members** (Initial Formation):
- Demonstrated commitment to privacy standards
- Significant ecosystem presence
- Signed charter agreement
- Named representative(s)

**Full Members** (Ongoing Admission):
- Active implementation or adoption of standards
- Demonstrated technical contribution
- Membership application approved by Steering Committee
- Annual commitment acknowledgment

**Observer Members**:
- Open registration
- Agreement to conduct guidelines
- No formal approval required

### 3.3 Member Responsibilities

| Responsibility | Founding | Full | Observer |
|----------------|----------|------|----------|
| Charter ratification | Required | N/A | N/A |
| Meeting participation | Expected | Expected | Optional |
| Technical contributions | Expected | Expected | Optional |
| Voting | Full | Full | None |
| Annual dues | None | None | None |
| Public advocacy | Encouraged | Encouraged | Optional |

### 3.4 Membership Termination

Membership may be terminated for:
- Violation of conduct guidelines
- Extended inactivity (12+ months)
- Voluntary withdrawal
- Organization dissolution

Termination requires:
- Steering Committee majority vote
- 30-day notice period
- Opportunity to respond

---

## 4. Governance Structure

### 4.1 Organizational Chart

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOVERNANCE STRUCTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │   FULL MEMBER   │                                 │
│                         │    ASSEMBLY     │                                 │
│                         │  (All Members)  │                                 │
│                         └────────┬────────┘                                 │
│                                  │ Elects                                   │
│                                  ▼                                          │
│                         ┌─────────────────┐                                 │
│                         │    STEERING     │                                 │
│                         │   COMMITTEE     │                                 │
│                         │  (7 Members)    │                                 │
│                         └────────┬────────┘                                 │
│                                  │ Appoints                                 │
│           ┌──────────────────────┼──────────────────────┐                  │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│  │   TECHNICAL     │   │   COMPLIANCE    │   │   ECOSYSTEM     │          │
│  │   SUBGROUP      │   │   SUBGROUP      │   │   SUBGROUP      │          │
│  │                 │   │                 │   │                 │          │
│  │ • Specs         │   │ • Regulatory    │   │ • Adoption      │          │
│  │ • Reference     │   │ • Audit         │   │ • Outreach      │          │
│  │ • Testing       │   │ • Compliance    │   │ • Education     │          │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Steering Committee

**Composition:**
- 7 members elected by Full Member Assembly
- 2-year terms, staggered (3-4 seats per year)
- Maximum 2 consecutive terms
- No organization may hold more than 1 seat

**Responsibilities:**
- Strategic direction
- Subgroup oversight
- Membership decisions
- Budget management (if applicable)
- External representation

**Officers:**
- Chair: Leads meetings, external spokesperson
- Vice-Chair: Supports Chair, succession
- Secretary: Meeting minutes, records

### 4.3 Subgroups

**Technical Subgroup:**
- Standards specification drafting
- Reference implementation oversight
- Test vector development
- Technical review process

**Compliance Subgroup:**
- Regulatory engagement
- Compliance framework development
- Audit standard alignment
- Legal liaison

**Ecosystem Subgroup:**
- Adoption tracking
- Developer education
- Public communications
- Event coordination

### 4.4 Decision Making

**Consensus Preferred:**
All decisions should first seek consensus among affected parties.

**Voting (When Consensus Fails):**

| Decision Type | Threshold | Quorum |
|---------------|-----------|--------|
| Technical standards | 2/3 majority | 50% of members |
| Steering Committee | Simple majority | 5 of 7 |
| Charter amendments | 3/4 majority | 66% of members |
| New members | Steering Committee | 5 of 7 |
| Subgroup creation | Steering Committee | 5 of 7 |

---

## 5. Standards Process

### 5.1 Lifecycle

```
STANDARD LIFECYCLE

┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ DRAFT   │────▶│ REVIEW  │────▶│ FINAL   │────▶│ ACTIVE  │────▶│ RETIRED │
│         │     │ CALL    │     │ CALL    │     │         │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
     │               │               │               │               │
     ▼               ▼               ▼               ▼               ▼
 Initial          Public         Final vote      Official       Superseded
 proposal         comment        and approval    standard       or obsolete
```

### 5.2 Stage Requirements

**Draft:**
- Any member may submit
- Must include: problem statement, proposed solution, rationale
- Technical Subgroup assigns editor
- Iterative refinement

**Review Call (30 days minimum):**
- Public comment period
- All feedback documented
- Substantive changes restart timer
- Technical Subgroup recommendation

**Final Call (14 days):**
- No substantive changes
- Member vote
- 2/3 majority required
- Editorial corrections only

**Active:**
- Published as official standard
- Reference implementation required
- Test vectors available
- Version controlled

**Retired:**
- Superseded by newer standard
- Security issues discovered
- No longer relevant
- Archived for reference

### 5.3 Standard Numbering

```
SIP-XXX: Core Protocol Standards
  SIP-001: Core Protocol
  SIP-002: Stealth Addresses
  SIP-003: Viewing Keys
  ...

SIP-1XX: Integration Standards
  SIP-100: Wallet Integration
  SIP-101: DEX Integration
  SIP-102: Bridge Integration
  ...

SIP-2XX: Compliance Standards
  SIP-200: Audit Trail Format
  SIP-201: Viewing Key Sharing
  SIP-202: Travel Rule Payload
  ...

SIP-3XX: Cross-Chain Standards
  SIP-300: Universal Meta-Address
  SIP-301: Bridge Privacy Protocol
  ...
```

---

## 6. Intellectual Property

### 6.1 Contribution License

All contributions to Working Group standards are made under:

- **Specifications:** CC0 (Public Domain Dedication)
- **Reference Code:** MIT License
- **Documentation:** CC-BY-4.0

### 6.2 Patent Policy

Members agree to:

1. **RAND-Z Commitment:** License any essential patents royalty-free
2. **Disclosure Obligation:** Disclose known essential patents
3. **Defensive Use Only:** No offensive patent claims against implementers

### 6.3 Trademark

- "SIP" and "Shielded Intents Protocol" are open for use
- Working Group may establish certification marks
- Members may not imply endorsement without authorization

---

## 7. Meetings and Communication

### 7.1 Meeting Cadence

| Meeting Type | Frequency | Participants |
|--------------|-----------|--------------|
| Full Assembly | Quarterly | All members |
| Steering Committee | Monthly | SC members |
| Technical Subgroup | Bi-weekly | Subgroup members |
| Compliance Subgroup | Monthly | Subgroup members |
| Ecosystem Subgroup | Monthly | Subgroup members |

### 7.2 Meeting Format

- **Remote-first:** Video conferencing primary
- **Recorded:** All meetings recorded for asynchronous access
- **Minutes:** Published within 7 days
- **Agenda:** Published 7 days in advance

### 7.3 Communication Channels

| Channel | Purpose |
|---------|---------|
| Mailing List | Official announcements, voting |
| Discord/Slack | Day-to-day discussion |
| GitHub | Specification development |
| Public Forum | Community feedback |

---

## 8. Code of Conduct

### 8.1 Expected Behavior

Members shall:
- Treat all participants with respect
- Focus on technical merit, not personal attributes
- Assume good faith in discussions
- Maintain confidentiality when required
- Disclose conflicts of interest

### 8.2 Unacceptable Behavior

- Personal attacks or harassment
- Discrimination of any kind
- Sharing confidential information
- Sabotaging standards process
- Misrepresenting Working Group positions

### 8.3 Enforcement

1. **Warning:** First violation, documented warning
2. **Suspension:** Repeated violations, temporary ban
3. **Expulsion:** Severe violations, permanent removal

Steering Committee handles enforcement with right of appeal.

---

## 9. Amendment Process

### 9.1 Proposing Amendments

Any Full Member may propose charter amendments:

1. Submit written proposal to Steering Committee
2. 30-day comment period
3. Steering Committee recommendation
4. Full Assembly vote
5. 3/4 majority required for adoption

### 9.2 Emergency Amendments

For urgent matters (security, legal):
- Steering Committee may adopt temporary amendments
- Full Assembly ratification within 60 days
- Simple majority for temporary measures

---

## 10. Dissolution

### 10.1 Conditions

The Working Group may dissolve if:
- Mission is complete (standards widely adopted)
- Activity ceases (no meetings for 12 months)
- Member vote (3/4 majority)

### 10.2 Asset Disposition

Upon dissolution:
- All specifications remain public domain
- Reference implementations remain MIT licensed
- Documentation archived permanently
- Any funds donated to open-source foundation

---

## Appendix A: Founding Member Commitment

```
FOUNDING MEMBER SIGNATURE BLOCK

Organization: _________________________________

Representative Name: _________________________________

Title: _________________________________

Email: _________________________________

Date: _________________________________

Signature: _________________________________


By signing, the organization commits to:
1. Ratifying this charter
2. Active participation in Working Group activities
3. Implementation or adoption of published standards
4. Compliance with code of conduct
5. Patent policy commitments
```

---

## Appendix B: Initial Subgroup Mandates

### Technical Subgroup Mandate

**Scope:** Development and maintenance of privacy standards specifications

**Initial Work Items:**
- SIP-001 through SIP-003 review and finalization
- EIP-5564/ERC-6538 compatibility verification
- Cross-chain privacy protocol specification
- Test vector development

### Compliance Subgroup Mandate

**Scope:** Regulatory alignment and compliance framework development

**Initial Work Items:**
- Regulatory landscape documentation
- Viewing key disclosure protocol
- Travel Rule integration standard
- Audit trail format specification

### Ecosystem Subgroup Mandate

**Scope:** Adoption, education, and community building

**Initial Work Items:**
- Member onboarding program
- Developer documentation
- Public website and communications
- Conference and event coordination

---

**Charter Version:** 1.0.0
**Last Updated:** January 2026
**Next Review:** July 2026
