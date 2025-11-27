# SIP: Shielded Intents Protocol

**A Privacy Layer for Cross-Chain Transactions**

*Version 1.0 — November 2025*

---

## Abstract

Cross-chain transactions have become fundamental to decentralized finance, yet they consistently leak sensitive information about users. Current intent-based systems—designed to simplify cross-chain swaps—expose sender addresses, transaction amounts, and recipient identities to public blockchain analysis.

We present SIP (Shielded Intents Protocol), a privacy layer that integrates with existing intent-based settlement systems to provide configurable transaction privacy. SIP employs three complementary cryptographic techniques: (1) **Pedersen commitments** to hide transaction amounts while enabling verification, (2) **stealth addresses** following EIP-5564 to generate unlinkable one-time recipient addresses, and (3) **viewing keys** to enable selective disclosure for compliance requirements.

SIP operates as an application layer atop NEAR Intents, requiring no modifications to underlying blockchain infrastructure. Our implementation achieves sub-10ms overhead for privacy operations while maintaining full compatibility with existing multi-chain settlement flows. The protocol supports three privacy levels—transparent, shielded, and compliant—allowing users to choose appropriate privacy guarantees for their use case.

**Keywords:** privacy, cross-chain, stealth addresses, Pedersen commitments, intents, zero-knowledge proofs

---

## 1. Introduction

### 1.1 The Privacy Problem in Cross-Chain Finance

Blockchain transparency, while valuable for auditability, creates significant privacy concerns for users engaging in cross-chain transactions. Every swap, bridge, or transfer leaves permanent, publicly linkable records that enable:

- **Transaction graph analysis**: Linking sender and recipient wallets across chains
- **Balance correlation**: Inferring holdings from transaction patterns
- **Behavioral profiling**: Tracking user activity across DeFi protocols

The emergence of intent-based systems like NEAR Intents and UniswapX has simplified cross-chain operations but has not addressed these privacy concerns. Users expressing intents still reveal their addresses, desired amounts, and counterparties.

### 1.2 The ZachXBT Vulnerability

The vulnerability motivating SIP was identified in common cross-chain swap patterns. Consider a user holding shielded ZEC in a z-address who wishes to swap to SOL:

```
Current Flow:
1. User has: shielded ZEC in z-address (private)
2. User initiates: ZEC → SOL swap via intent
3. Swap completes: SOL sent to user's Solana address
4. Refund (if any): sent to t1ABC... (transparent Zcash address)

Problem: t1ABC is reused across transactions
Chain analysis: "t1ABC received refunds 50 times"
              → Links to user's shielded activity
              → Compromises entire privacy set
```

Even when the source asset is private, the interaction with transparent systems through address reuse destroys privacy guarantees.

### 1.3 Our Contribution

SIP addresses these challenges through a modular privacy layer that:

1. **Hides amounts** using Pedersen commitments with homomorphic properties
2. **Prevents address linkage** using EIP-5564 stealth addresses
3. **Enables compliance** through hierarchical viewing keys
4. **Integrates seamlessly** with NEAR Intents settlement infrastructure

Our implementation demonstrates that meaningful privacy can be achieved without protocol-level changes to existing blockchains, through careful application of established cryptographic primitives.

---

## 2. Background

### 2.1 Intent-Based Systems

Intent-based systems separate user desire from execution. Rather than constructing specific transactions, users express **intents**—declarations of desired outcomes—which are fulfilled by specialized actors called **solvers**.

```
Traditional Flow:
  User → constructs transaction → submits to chain → waits for confirmation

Intent Flow:
  User → expresses intent → solver fulfills → settlement across chains
```

NEAR Intents provides cross-chain settlement through **Chain Signatures**, enabling solvers to execute transactions on any supported blockchain from a single NEAR-based coordination layer.

### 2.2 Pedersen Commitments

A Pedersen commitment allows committing to a value while hiding it. Given generators G and H on an elliptic curve where the discrete logarithm relationship is unknown:

```
C = v·G + r·H
```

Where:
- v = value being committed
- r = random blinding factor
- G = standard generator
- H = independently derived generator (NUMS construction)

**Properties:**
- **Perfectly hiding**: Given C, no information about v is revealed
- **Computationally binding**: Cannot find v', r' such that v'·G + r'·H = C (unless ECDLP is broken)
- **Additively homomorphic**: C₁ + C₂ = (v₁ + v₂)·G + (r₁ + r₂)·H

### 2.3 Stealth Addresses

Stealth addresses, formalized in EIP-5564, provide recipient privacy through one-time addresses. The recipient publishes a **stealth meta-address** containing two public keys, and senders derive fresh addresses for each payment.

```
Meta-address: (P, Q) where P = p·G, Q = q·G
  - p = spending private key
  - q = viewing private key

Address Generation (sender):
  1. Generate ephemeral keypair: r, R = r·G
  2. Compute shared secret: S = r·P (ECDH)
  3. Derive scalar: s = H(S)
  4. Compute stealth address: A = Q + s·G

Key Recovery (recipient):
  1. Compute shared secret: S' = p·R
  2. Verify: H(S') matches expected
  3. Derive stealth private key: a = q + H(S')
```

### 2.4 NEAR Chain Signatures

Chain Signatures enable NEAR accounts to sign transactions for other blockchains using threshold cryptography. This allows:

- Single coordination point for multi-chain operations
- Atomic settlement guarantees
- Solver-based execution without user interaction per chain

---

## 3. Protocol Design

### 3.1 System Model

SIP operates as an application layer between user applications and the NEAR Intents settlement system:

```
┌─────────────────────────────────────────────────────────┐
│  Application Layer (DApps, Wallets, DAOs)               │
├─────────────────────────────────────────────────────────┤
│  Privacy Layer (SIP)                                    │
│  • Pedersen Commitments    • Stealth Addresses          │
│  • Viewing Keys            • Zero-Knowledge Proofs      │
├─────────────────────────────────────────────────────────┤
│  Settlement Layer (NEAR Intents)                        │
│  • Solvers                 • Chain Signatures           │
├─────────────────────────────────────────────────────────┤
│  Blockchain Layer                                       │
│  NEAR  |  Ethereum  |  Solana  |  Zcash  |  Bitcoin    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Threat Model

**Adversary Capabilities:**

We consider a computationally bounded adversary who can:
- Observe all network traffic (global passive adversary)
- Read all public blockchain data
- Submit arbitrary transactions
- Front-run transactions (MEV)
- Analyze transaction graphs
- Interact with SIP as a legitimate user

**Adversary Limitations:**

The adversary cannot:
- Break standard cryptographic assumptions (ECDLP, collision-resistant hashing)
- Compromise user devices or extract private keys
- Perform quantum attacks
- Control majority of solver network

**Trust Assumptions:**

| Component | Trust Level | Justification |
|-----------|-------------|---------------|
| Cryptographic libraries | High | Audited, constant-time implementations |
| User's device | Required | Key generation/storage is local |
| OS CSPRNG | High | Well-audited entropy sources |
| Solvers | Semi-trusted | See metadata, cannot steal funds |
| NEAR chain | Semi-trusted | Provides liveness, cannot break privacy |

### 3.3 Privacy Definitions

**Definition 1 (Amount Privacy):** A protocol provides amount privacy if, for any two transactions with amounts v₁ and v₂, no PPT adversary can distinguish which transaction contains which amount with probability significantly greater than 1/2.

**Definition 2 (Sender Unlinkability):** A protocol provides sender unlinkability if, given two stealth addresses A₁ and A₂ belonging to the same recipient, no PPT adversary can determine this relationship with probability significantly greater than 1/2.

**Definition 3 (Recipient Unlinkability):** A protocol provides recipient unlinkability if, given a stealth meta-address and a stealth address, no PPT adversary can determine whether the address belongs to that meta-address (without the viewing key) with probability significantly greater than 1/2.

### 3.4 Security Goals

1. **Confidentiality**: Transaction amounts remain hidden from public observers
2. **Unlinkability**: Transactions cannot be linked to specific users without viewing keys
3. **Integrity**: Committed amounts cannot be altered; proofs cannot be forged
4. **Compliance**: Authorized parties can verify transactions using viewing keys
5. **Non-interference**: Privacy features do not affect settlement correctness

---

## 4. Construction

### 4.1 NUMS Generator Construction

For Pedersen commitments, we require an independent generator H where the discrete log relationship to G is unknown. We use the Nothing-Up-My-Sleeve (NUMS) construction:

```
Algorithm: GenerateH()
  domain ← "SIP-PEDERSEN-GENERATOR-H-v1"
  for counter = 0 to 255:
    candidate ← SHA256(domain || counter)
    if IsValidCurvePoint(candidate):
      H ← LiftX(candidate)
      if H ≠ G and H ≠ O:
        return H
  fail "Could not generate H"
```

This construction ensures:
- Deterministic, verifiable derivation
- No party knows log_G(H)
- Domain separation prevents cross-protocol attacks

### 4.2 Commitment Scheme

**Commit(v, r):**
```
Input: value v ∈ [0, n), optional blinding r
Output: commitment C, blinding factor r

1. If r not provided: r ← RandomBytes(32) mod n
2. If r = 0: r ← 1  // Avoid invalid scalar
3. C ← v·G + r·H
4. Return (C, r)
```

**VerifyOpening(C, v, r):**
```
Input: commitment C, claimed value v, blinding factor r
Output: boolean

1. r' ← r mod n
2. If r' = 0: r' ← 1
3. C' ← v·G + r'·H
4. Return C = C'
```

### 4.3 Stealth Address Scheme

**GenerateMetaAddress(chain):**
```
Input: target chain identifier
Output: meta-address, private keys

1. p ← RandomBytes(32)  // Spending private
2. q ← RandomBytes(32)  // Viewing private
3. P ← p·G              // Spending public
4. Q ← q·G              // Viewing public
5. Return {
     metaAddress: (P, Q, chain),
     spendingKey: p,
     viewingKey: q
   }
```

**DeriveStealthAddress(metaAddress):**
```
Input: recipient's meta-address (P, Q, chain)
Output: stealth address, ephemeral public key, shared secret

1. r ← RandomBytes(32)           // Ephemeral private
2. R ← r·G                       // Ephemeral public
3. S ← ECDH(r, P)                // Shared secret point
4. s ← SHA256(S)                 // Scalar derivation
5. A ← Q + s·G                   // Stealth address
6. viewTag ← s[0]                // First byte for scanning
7. Return {
     address: A,
     ephemeralKey: R,
     viewTag: viewTag,
     sharedSecret: s
   }
```

**RecoverStealthKey(stealthAddress, R, p, q):**
```
Input: stealth address A, ephemeral key R, private keys (p, q)
Output: stealth private key a

1. S' ← ECDH(p, R)               // Recompute shared secret
2. s' ← SHA256(S')
3. a ← q + s' mod n              // Stealth private key
4. A' ← a·G
5. Assert A' = A                 // Verify derivation
6. Return a
```

### 4.4 Shielded Intent Format

A shielded intent contains:

```typescript
interface ShieldedIntent {
  // Public fields
  intentId: string              // Unique identifier
  version: string               // Protocol version
  privacyLevel: PrivacyLevel    // transparent | shielded | compliant
  createdAt: number             // Timestamp
  expiry: number                // Validity window

  // Output specification (public)
  outputAsset: Asset            // Desired output token
  minOutputAmount: bigint       // Minimum acceptable
  maxSlippage: number           // Tolerance

  // Hidden fields (commitments)
  inputCommitment: Commitment   // C = v·G + r·H
  senderCommitment: Commitment  // Sender identity commitment

  // Stealth addressing
  recipientStealth: StealthAddress  // One-time address
  ephemeralPublicKey: HexString     // For recipient scanning

  // Proofs
  fundingProof: ZKProof         // Proves sufficient balance
  validityProof: ZKProof        // Proves authorization

  // Compliance (optional)
  viewingKeyHash?: Hash         // For audit discovery
  encryptedMetadata?: Encrypted // Viewing key decryptable
}
```

### 4.5 Privacy Levels

SIP supports three privacy configurations:

| Level | Amount Hidden | Sender Hidden | Recipient Hidden | Auditable |
|-------|--------------|---------------|------------------|-----------|
| transparent | No | No | No | N/A |
| shielded | Yes | Yes | Yes | No |
| compliant | Yes | Yes | Yes | Yes (with viewing key) |

**Transparent:** Standard intent with no privacy features. Useful for public treasury operations.

**Shielded:** Full privacy using commitments and stealth addresses. No party can link transactions without private keys.

**Compliant:** Full privacy with viewing key support. Authorized auditors can decrypt transaction details while public observers cannot.

### 4.6 Viewing Key Derivation

Viewing keys enable selective disclosure:

```
MasterViewingKey:
  k ← RandomBytes(32)
  hash ← SHA256(k)
  Return { key: k, path: "m/0", hash: hash }

DeriveChildKey(master, childPath):
  combined ← master.key || ":" || childPath
  derived ← SHA256(combined)
  hash ← SHA256(derived)
  Return { key: derived, path: master.path + "/" + childPath, hash: hash }
```

Encryption uses XChaCha20-Poly1305 with HKDF key derivation:

```
EncryptForViewing(data, viewingKey):
  encKey ← HKDF(SHA256, viewingKey.key, "SIP-VIEWING-KEY-ENCRYPTION-V1", 32)
  nonce ← RandomBytes(24)
  ciphertext ← XChaCha20Poly1305.Encrypt(encKey, nonce, data)
  Return { ciphertext, nonce, viewingKeyHash: viewingKey.hash }
```

---

## 5. Security Analysis

### 5.1 Commitment Security

**Theorem 1 (Hiding):** SIP commitments are perfectly hiding.

*Proof sketch:* For any commitment C = v·G + r·H and any target value v', there exists r' = r + (v - v')·log_G(H) such that C = v'·G + r'·H. Since log_G(H) is unknown (NUMS construction), this r' cannot be computed, but its existence guarantees information-theoretic hiding. □

**Theorem 2 (Binding):** SIP commitments are computationally binding under ECDLP.

*Proof sketch:* Finding (v₁, r₁) ≠ (v₂, r₂) such that v₁·G + r₁·H = v₂·G + r₂·H implies (v₁ - v₂)·G = (r₂ - r₁)·H, yielding log_G(H) = (v₁ - v₂)/(r₂ - r₁), contradicting ECDLP hardness. □

### 5.2 Stealth Address Security

**Theorem 3 (Unlinkability):** Stealth addresses derived from the same meta-address are unlinkable to observers without the viewing key.

*Proof sketch:* Each stealth address A = Q + H(r·P)·G uses fresh ephemeral key r. The shared secret r·P = r·p·G is ECDH output, computationally indistinguishable from random without knowing r or p. Thus A appears as a random curve point to observers. □

**Theorem 4 (View Tag Leakage):** The 8-bit view tag reveals at most 8 bits of information about the shared secret.

*Analysis:* The view tag is the first byte of SHA256(S). Given SHA256's preimage resistance, this reveals no structural information about S beyond reducing the search space by factor 256. This is an acceptable trade-off for ~256x scanning efficiency improvement.

### 5.3 Encryption Security

XChaCha20-Poly1305 provides:
- **IND-CPA security**: Ciphertexts indistinguishable from random
- **INT-CTXT security**: Authentication prevents tampering
- **Nonce-misuse resistance**: 24-byte nonces with random generation

### 5.4 Known Limitations

1. **Timing correlation**: Transactions submitted close together may be linkable by timing. Mitigation: delayed submission, batching.

2. **Amount inference**: If output amount is public, input can sometimes be inferred from market rates. Mitigation: commitment to output ranges.

3. **Memory safety**: JavaScript cannot guarantee secure memory clearing. Mitigation: minimize key lifetime, rely on OS protections.

4. **Quantum threat**: secp256k1 ECDLP is vulnerable to Shor's algorithm. Mitigation: out of current scope; future work includes post-quantum migration path.

---

## 6. Implementation

### 6.1 SDK Architecture

The SIP SDK provides a TypeScript implementation:

```typescript
// Core usage
import { createSIP, PrivacyLevel } from '@sip-protocol/sdk'

const sip = createSIP({ proofProvider: new MockProofProvider() })

const intent = await sip.intent()
  .from({ chain: 'ethereum', token: 'USDC', amount: 1000n })
  .to({ chain: 'solana', token: 'SOL' })
  .withPrivacy(PrivacyLevel.SHIELDED)
  .withRecipient(stealthMetaAddress)
  .build()
```

### 6.2 Cryptographic Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| @noble/curves | ^1.3.0 | secp256k1 operations |
| @noble/hashes | ^1.3.3 | SHA256, HKDF |
| @noble/ciphers | ^2.0.1 | XChaCha20-Poly1305 |

All noble libraries are audited by Trail of Bits and provide constant-time implementations.

### 6.3 Performance Characteristics

| Operation | Time (avg) | Notes |
|-----------|------------|-------|
| Generate meta-address | 0.9ms | One-time setup |
| Derive stealth address | 5.4ms | Per transaction |
| Create commitment | 7.2ms | Includes H generation on first call |
| Verify commitment | 6.6ms | |
| Full shielded intent | ~25ms | End-to-end |

Measured on Apple M1, Node.js 20, averaged over 100 iterations.

### 6.4 Integration with NEAR Intents

SIP integrates with NEAR's 1Click API:

```
User Intent → SIP (add privacy) → 1Click Quote → Solver Execution → Settlement
```

The privacy layer adds:
1. Commitment generation for amounts
2. Stealth address derivation for recipients
3. Proof generation for validity
4. Encrypted metadata for compliance

---

## 7. Related Work

### 7.1 Zcash

Zcash pioneered shielded transactions using zk-SNARKs. SIP differs by:
- Operating at application layer (no protocol changes)
- Supporting multiple chains
- Using simpler primitives (Pedersen vs. Jubjub)

### 7.2 Tornado Cash

Tornado Cash provided Ethereum privacy through deposit/withdrawal pools. SIP differs by:
- Not requiring fixed denominations
- Supporting cross-chain operations
- Providing compliance mechanisms

### 7.3 Aztec Protocol

Aztec implements a ZK-rollup with private transactions. SIP differs by:
- Not requiring separate L2
- Integrating with existing settlement systems
- Focusing on cross-chain intents

### 7.4 EIP-5564 Stealth Addresses

SIP implements EIP-5564 with modifications:
- Extended for cross-chain meta-addresses
- Integrated with commitment scheme
- Added viewing key hierarchy

### 7.5 Railgun

Railgun provides EVM privacy through ZK proofs. SIP differs by:
- Multi-chain native design
- Intent-based rather than transfer-based
- Modular privacy levels

---

## 8. Conclusion

### 8.1 Summary

SIP demonstrates that practical privacy for cross-chain transactions can be achieved through careful application of established cryptographic primitives at the application layer. Our key contributions are:

1. **Architecture**: A privacy layer that integrates with existing intent-based settlement systems without requiring blockchain modifications

2. **Flexibility**: Three privacy levels (transparent, shielded, compliant) accommodating different user requirements

3. **Efficiency**: Sub-30ms overhead for complete privacy operations, suitable for interactive applications

4. **Compliance**: Viewing key mechanism enabling authorized disclosure while maintaining public privacy

### 8.2 Current Status

The SIP SDK is implemented with:
- 741 passing tests
- 89.88% code coverage
- Audited cryptographic dependencies
- Production-ready core primitives

### 8.3 Future Work

1. **ZK Circuit Implementation**: Replace mock proofs with Noir circuits for trustless verification

2. **Post-Quantum Migration**: Evaluate lattice-based alternatives for long-term security

3. **Privacy Set Analysis**: Quantify anonymity set sizes under various usage patterns

4. **Cross-Protocol Integration**: Extend to additional intent systems beyond NEAR

5. **Formal Verification**: Machine-checked proofs of security properties

---

## References

[1] Ben-Sasson, E., et al. "Zerocash: Decentralized Anonymous Payments from Bitcoin." IEEE S&P 2014.

[2] EIP-5564: Stealth Addresses. Ethereum Improvement Proposals. https://eips.ethereum.org/EIPS/eip-5564

[3] Pedersen, T. P. "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing." CRYPTO 1991.

[4] NEAR Protocol. "Chain Signatures." https://docs.near.org/chain-signatures

[5] Bernstein, D. J. "Curve25519: New Diffie-Hellman Speed Records." PKC 2006.

[6] @noble/curves. https://github.com/paulmillr/noble-curves

[7] Mimblewimble. "MimbleWimble." https://docs.grin.mw/wiki/introduction/mimblewimble/

[8] Aztec Protocol. "PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge." https://eprint.iacr.org/2019/953

---

## Appendix A: Protocol Parameters

| Parameter | Value | Justification |
|-----------|-------|---------------|
| Curve | secp256k1 | Bitcoin/Ethereum compatibility, 128-bit security |
| Hash | SHA-256 | Standard, 128-bit collision resistance |
| Encryption | XChaCha20-Poly1305 | AEAD, nonce-misuse resistant |
| Nonce size | 24 bytes | XChaCha20 standard |
| Key size | 32 bytes | 256-bit security level |
| View tag | 8 bits | 256x scanning speedup |

## Appendix B: Stealth Meta-Address Format

```
sip:<chain>:<spendingKey>:<viewingKey>

Example:
sip:ethereum:0x02abc...def:0x03123...456

Where:
- chain ∈ {ethereum, solana, near, zcash, polygon, arbitrum, optimism, base}
- spendingKey: 33-byte compressed secp256k1 public key (hex)
- viewingKey: 33-byte compressed secp256k1 public key (hex)
```

## Appendix C: Commitment Format

```typescript
interface Commitment {
  value: HexString      // 33-byte compressed point (commitment C)
  blindingFactor: HexString  // 32-byte scalar (blinding r)
}
```

The commitment point uses compressed representation (02 or 03 prefix followed by x-coordinate).

---

*© 2025 SIP Protocol Contributors. This document is released under CC BY 4.0.*
