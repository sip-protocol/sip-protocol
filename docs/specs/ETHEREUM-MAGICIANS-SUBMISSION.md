# Ethereum Magicians Forum Submission Guide

**Document:** SIP-EIP Ethereum Magicians Forum Post
**Target Forum:** https://ethereum-magicians.org
**Category:** EIPs / ERCs
**Status:** Draft

---

## 1. Forum Post Template

### 1.1 Post Title

```
EIP-XXXX: Shielded Intents Protocol (SIP) — Universal Privacy Standard for Ethereum
```

### 1.2 Full Post Content

---

**Copy below for forum submission:**

---

# EIP-XXXX: Shielded Intents Protocol (SIP)

## Simple Summary

A standard for privacy-preserving transactions on Ethereum using stealth addresses, Pedersen commitments, and viewing keys for selective disclosure.

## Abstract

This EIP proposes a comprehensive privacy standard (SIP — Shielded Intents Protocol) that enables applications to hide transaction sender, amount, and recipient while maintaining regulatory compliance through viewing keys. SIP builds on existing standards (EIP-5564, ERC-6538) and adds amount hiding via Pedersen commitments and a viewing key system for selective disclosure.

## Motivation

### The Problem

Current Ethereum transactions are fully transparent. While this transparency enables trustless verification, it creates significant privacy issues:

1. **Personal Privacy**: Salary payments, medical expenses, and political donations are public
2. **Business Privacy**: Competitors can track treasury movements and supplier payments
3. **Front-running**: MEV extraction exploits visible pending transactions
4. **Compliance Gap**: Existing privacy solutions (Tornado Cash) provide no compliance mechanism

### Why Not Use Existing Solutions?

| Solution | Limitation |
|----------|------------|
| Tornado Cash | Sanctioned, no compliance, fixed amounts only |
| Zcash | Separate chain, not Ethereum-native |
| Aztec Protocol | L2-only, requires migration |
| EIP-5564 (Stealth) | Addresses only, amounts still visible |

### The Solution

SIP combines three proven cryptographic primitives into a unified standard:

1. **Stealth Addresses** (EIP-5564 compatible): Hide recipient identity
2. **Pedersen Commitments**: Hide transaction amounts
3. **Viewing Keys**: Enable selective disclosure for compliance

This combination provides complete privacy while satisfying regulatory requirements.

## Specification

### Key Words

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

### Overview

SIP defines:
1. Stealth meta-address format and generation
2. Pedersen commitment scheme for amount hiding
3. Viewing key derivation and encryption
4. Privacy levels (transparent, shielded, compliant)
5. Standard error codes

### 1. Stealth Addresses

#### 1.1 Meta-Address Format

```
sip:ethereum:<spending_public_key>:<viewing_public_key>
```

Where:
- `spending_public_key`: 33-byte compressed secp256k1 public key (hex)
- `viewing_public_key`: 33-byte compressed secp256k1 public key (hex)

Example:
```
sip:ethereum:0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798:0x02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5
```

#### 1.2 Stealth Address Generation

Given recipient's meta-address `(P_spend, P_view)`:

1. Sender generates ephemeral private key `r` (random 32 bytes, valid secp256k1 scalar)
2. Sender computes ephemeral public key `R = r × G`
3. Sender computes shared secret `S = r × P_view`
4. Sender derives stealth public key:
   ```
   P_stealth = P_spend + H(S ‖ P_spend) × G
   ```
   Where `H` is `SHA256` truncated to valid scalar
5. Sender derives Ethereum address from `P_stealth` using `keccak256`

#### 1.3 Stealth Address Scanning

Given announcement `(stealth_address, R)` and recipient's keys `(s_priv, v_priv)`:

1. Recipient computes shared secret `S = v_priv × R`
2. Recipient derives expected public key:
   ```
   P_expected = s_priv × G + H(S ‖ s_priv × G) × G
   ```
3. Recipient derives expected address from `P_expected`
4. If `expected_address == stealth_address`, payment belongs to recipient

#### 1.4 Private Key Derivation

To spend from stealth address:
```
stealth_private = s_priv + H(S ‖ P_spend)
```

### 2. Pedersen Commitments

#### 2.1 Generator Points

- `G`: Standard secp256k1 generator
- `H`: Derived via "nothing-up-my-sleeve" construction:
  ```
  H = hash_to_curve(SHA256("SIP-PEDERSEN-GENERATOR-H-v1"))
  ```

#### 2.2 Commitment Creation

For value `v` and random blinding factor `r`:
```
C = v × G + r × H
```

Requirements:
- `v` MUST be a non-negative integer
- `r` MUST be a valid secp256k1 scalar (1 ≤ r < n)
- `r` MUST be cryptographically random

#### 2.3 Commitment Verification

Given commitment `C`, claimed value `v`, and blinding factor `r`:
```
verify: C == v × G + r × H
```

#### 2.4 Homomorphic Properties

Addition:
```
C(v1, r1) + C(v2, r2) = C(v1 + v2, r1 + r2)
```

Subtraction:
```
C(v1, r1) - C(v2, r2) = C(v1 - v2, r1 - r2)
```

### 3. Viewing Keys

#### 3.1 Key Types

| Type | Derivation Path | Capabilities |
|------|-----------------|--------------|
| Incoming | `SIP-VIEWING-KEY-v1:incoming` | View deposits |
| Outgoing | `SIP-VIEWING-KEY-v1:outgoing` | View withdrawals |
| Full | `SIP-VIEWING-KEY-v1:full` | View all transactions |

#### 3.2 Key Derivation

Using HKDF-SHA256:
```
viewing_key = HKDF(
  ikm: master_private_key,
  salt: "SIP-VIEWING-KEY-v1",
  info: key_type,
  length: 32
)
```

#### 3.3 Encryption

Algorithm: XChaCha20-Poly1305

```
ciphertext = XChaCha20-Poly1305.encrypt(
  key: viewing_key,
  nonce: random_24_bytes,
  plaintext: data,
  aad: optional_context
)
```

Output format:
```
nonce (24 bytes) ‖ ciphertext ‖ tag (16 bytes)
```

#### 3.4 Viewing Key Hash

For on-chain registration:
```
key_hash = SHA256(viewing_key_bytes)
```

### 4. Privacy Levels

| Level | Sender | Amount | Recipient | Viewing Key |
|-------|--------|--------|-----------|-------------|
| `transparent` | Public | Public | Public | N/A |
| `shielded` | Hidden | Hidden | Hidden | None |
| `compliant` | Hidden | Hidden | Hidden | Required |

### 5. Error Codes

| Code | Name | Description |
|------|------|-------------|
| `SIP_ERR_0100` | INVALID_INPUT | General invalid input |
| `SIP_ERR_0200` | INVALID_STEALTH_META_ADDRESS | Malformed meta-address |
| `SIP_ERR_0201` | INVALID_PUBLIC_KEY | Invalid curve point |
| `SIP_ERR_0300` | INVALID_COMMITMENT | Invalid commitment point |
| `SIP_ERR_0302` | INVALID_BLINDING_FACTOR | Zero or out-of-range |
| `SIP_ERR_0400` | INVALID_VIEWING_KEY | Malformed viewing key |
| `SIP_ERR_0403` | DECRYPTION_FAILED | Authentication failed |

## Rationale

### Why Stealth Addresses?

Stealth addresses provide recipient privacy without requiring protocol changes. Each payment creates a new address, preventing address clustering analysis. We build on EIP-5564 for compatibility.

### Why Pedersen Commitments?

Pedersen commitments hide amounts while allowing verification of transaction validity. The homomorphic property enables balance proofs without revealing values. This is the same scheme used by Monero and Mimblewimble.

### Why Viewing Keys?

Privacy without compliance is unsustainable (see Tornado Cash sanctions). Viewing keys provide a middle ground: private by default, auditable when required. This enables:
- Tax reporting
- Regulatory compliance
- Business audits
- Dispute resolution

### Why Not Use ZK-SNARKs?

While ZK proofs are powerful, they add complexity and gas costs. SIP's primitive-based approach:
- Has lower computational overhead
- Requires no trusted setup
- Uses well-understood cryptography
- Enables incremental adoption

ZK proofs can be layered on top of SIP for additional properties (range proofs, validity proofs).

### Backward Compatibility

SIP is additive — existing contracts and transactions continue to work. Applications opt-in to privacy by:
1. Using stealth addresses instead of direct addresses
2. Including commitments instead of raw amounts
3. Publishing ephemeral keys for scanning

## Reference Implementation

### TypeScript SDK

```typescript
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  createCommitment,
  generateViewingKey,
  encryptForViewing,
} from '@sip-protocol/sdk'

// Generate receivable meta-address
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('ethereum')

// Create stealth payment
const { stealthAddress, ephemeralPublicKey } =
  generateStealthAddress(metaAddress)

// Hide amount
const commitment = createCommitment(1000000000000000000n) // 1 ETH

// Enable compliance
const viewingKey = generateViewingKey(viewingPrivateKey, 'incoming')
const encrypted = encryptForViewing(txMetadata, viewingKey)
```

### Repository

- **SDK**: https://github.com/sip-protocol/sip-protocol
- **Tests**: 5,584+ test cases
- **Documentation**: https://docs.sip-protocol.org

## Security Considerations

### Cryptographic Assumptions

SIP security relies on:
1. **Discrete Logarithm Problem**: secp256k1 hardness
2. **Decisional Diffie-Hellman**: Shared secret indistinguishability
3. **XChaCha20-Poly1305**: AEAD security

### Key Management

- Spending keys MUST be stored securely (hardware wallet recommended)
- Viewing keys can be delegated but should be time-limited
- Blinding factors MUST be cryptographically random

### Side Channels

- Implementations SHOULD use constant-time operations for scalar multiplication
- Timing attacks on scanning are mitigated by batch processing

### Quantum Resistance

Current implementation uses secp256k1, which is not quantum-resistant. Future versions may support lattice-based alternatives. The modular design allows curve replacement without protocol changes.

## Test Vectors

Compliance test vectors are available at:
https://github.com/sip-protocol/sip-protocol/tree/main/tests/spec-compliance/vectors

Includes:
- Stealth address generation (17 vectors)
- Commitment operations (20 vectors)
- Viewing key operations (16 vectors)
- Error conditions (17 vectors)

## Copyright

Copyright and related rights waived via CC0.

---

## Discussion Questions

I'd like community feedback on the following:

### 1. Commitment Scheme

Should we mandate a specific range proof scheme for commitments, or leave it optional? Current proposal allows commitments without range proofs for flexibility, with the understanding that applications can add ZK range proofs as needed.

### 2. Viewing Key Standardization

Should viewing key registration be on-chain (via a registry contract like ERC-6538) or off-chain? On-chain provides discoverability but reduces privacy. Off-chain preserves privacy but requires out-of-band coordination.

### 3. Multi-Chain Considerations

SIP is designed to be chain-agnostic. Should this EIP explicitly cover non-Ethereum chains (Polygon, Arbitrum, etc.) or should those be separate proposals?

### 4. Compliance Metadata

Should we standardize the format for encrypted compliance metadata, or leave it application-specific? Standardization aids interoperability but may not fit all use cases.

### 5. Gas Optimization

The current reference implementation prioritizes correctness over gas efficiency. What level of on-chain gas optimization should be specified vs. left to implementers?

---

Looking forward to the community's feedback!

---

## 2. Pre-Submission Checklist

### 2.1 Content Review

- [ ] Specification is complete and unambiguous
- [ ] All cryptographic parameters are specified
- [ ] Test vectors are available and linked
- [ ] Reference implementation is functional
- [ ] Security considerations are comprehensive
- [ ] Backward compatibility is addressed

### 2.2 Formatting

- [ ] Uses standard EIP format
- [ ] Markdown renders correctly
- [ ] Code blocks have syntax highlighting
- [ ] Tables are properly formatted
- [ ] Links are working

### 2.3 Supporting Materials

- [ ] GitHub repository is public
- [ ] Documentation site is live
- [ ] Test vectors are accessible
- [ ] SDK is published to npm

---

## 3. Community Engagement Guidelines

### 3.1 Response Principles

1. **Be Patient**: EIP discussions take time (weeks to months)
2. **Stay Professional**: Even with critical feedback
3. **Acknowledge Valid Points**: Iterate based on good feedback
4. **Provide Evidence**: Back claims with code, tests, or research
5. **Avoid Defensiveness**: Criticism of the proposal isn't personal

### 3.2 Response Templates

#### Acknowledging Good Feedback

```
Thanks for this feedback, @[username]. You raise a valid point about [issue].

I've updated the specification to [change]. The updated text is:

[Quote updated spec section]

Does this address your concern?
```

#### Disagreeing Respectfully

```
Thanks for the input, @[username]. I understand the concern about [issue].

After consideration, we believe the current approach is better because:
1. [Reason 1]
2. [Reason 2]

That said, I'm open to being convinced otherwise. Could you elaborate on [specific point]?
```

#### Asking for Clarification

```
@[username], thanks for engaging with the proposal. I want to make sure I understand your concern correctly.

Are you suggesting that [interpretation A] or [interpretation B]?

If it's [A], then [response]. If it's [B], then [different response].
```

#### Deferring for Research

```
@[username], that's an interesting point about [issue]. I hadn't considered [aspect].

Let me investigate this further and get back to you with a more informed response. I'll update the thread within [timeframe].
```

### 3.3 Common Objections and Responses

#### "This adds unnecessary complexity"

```
I understand the complexity concern. However, the alternative is:
- No standardization → fragmented privacy solutions
- Simpler scheme → missing compliance (Tornado Cash fate)

SIP's three primitives (stealth, commitments, viewing keys) are the minimum
necessary for privacy + compliance. Each serves a distinct purpose:
- Stealth: Recipient privacy
- Commitments: Amount privacy
- Viewing keys: Selective disclosure

We've worked to make the developer experience simple (50 lines to integrate)
even though the underlying cryptography is sophisticated.
```

#### "Why not just use [existing solution]?"

```
Great question. Here's how SIP compares to [solution]:

[Solution]: [Limitation 1], [Limitation 2]
SIP: [How SIP addresses these]

SIP's approach is to combine proven primitives (stealth from EIP-5564,
commitments from Monero, viewing keys from Zcash) into a cohesive standard
that works across the Ethereum ecosystem.
```

#### "This enables money laundering"

```
Actually, SIP with viewing keys provides MORE compliance capability than cash
transactions. Here's why:

1. Viewing keys enable authorized parties to see full transaction details
2. On-chain commitments create an audit trail (unlike cash)
3. Compliance metadata can be encrypted for regulators

The goal is "privacy for users, transparency for regulators" — not anonymity.
This is the same model as encrypted banking communications.
```

#### "The cryptography hasn't been audited"

```
Valid concern. Here's our security posture:

1. We use audited libraries (@noble/curves, @noble/hashes)
2. We use standard primitives (secp256k1, XChaCha20-Poly1305)
3. We have 5,584+ tests including edge cases
4. A formal audit is planned for [date]

The cryptographic primitives are well-understood (same as Monero, Zcash).
Our composition is novel but follows established patterns.
```

---

## 4. Feedback Tracking

### 4.1 Feedback Log Template

| Date | User | Topic | Summary | Status | Response |
|------|------|-------|---------|--------|----------|
| | | | | | |

### 4.2 Status Categories

- **Acknowledged**: Feedback received, no action needed
- **Investigating**: Researching before responding
- **Addressed**: Spec updated based on feedback
- **Declined**: Feedback considered but not adopted (with explanation)
- **Pending**: Awaiting further input from commenter

### 4.3 Spec Change Log

| Version | Date | Changes | Rationale |
|---------|------|---------|-----------|
| 0.1.0 | 2026-01-20 | Initial draft | N/A |
| | | | |

---

## 5. Timeline and Milestones

### 5.1 Forum Discussion Phase

| Week | Goal |
|------|------|
| Week 1-2 | Initial feedback, identify major concerns |
| Week 3-4 | Address feedback, iterate on spec |
| Week 5-6 | Build consensus, resolve disputes |
| Week 7-8 | Final polish, prepare for EIP submission |

### 5.2 Success Criteria

Before moving to formal EIP submission:

- [ ] No unresolved major objections
- [ ] At least 5 supportive comments from known contributors
- [ ] All discussion questions answered
- [ ] Spec stable (no changes for 1 week)
- [ ] Security review complete

---

## 6. Related Forum Posts

### 6.1 Posts to Reference

- EIP-5564 discussion: [link]
- ERC-6538 discussion: [link]
- Privacy EIPs category: [link]

### 6.2 Cross-Posting

After Ethereum Magicians, consider posting to:
- [ ] Ethereum R&D Discord
- [ ] EthResearch forum (if academic angle)
- [ ] Twitter thread summarizing discussion

---

## 7. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-20 | Initial submission guide |

---

*This document prepares for Ethereum Magicians forum submission. Actual submission requires manual posting to https://ethereum-magicians.org.*
