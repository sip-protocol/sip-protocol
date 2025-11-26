# Cryptographic Assumptions

## Overview

This document details the cryptographic assumptions underlying the SIP protocol, including hardness assumptions, security levels, known attacks, and parameter justifications.

## Elliptic Curve: secp256k1

### Parameters

```
Field: F_p where p = 2^256 - 2^32 - 977
Curve: y² = x³ + 7 (Koblitz curve)
Order: n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
Cofactor: h = 1
Generator: G (standard secp256k1 generator)
```

### Hardness Assumptions

1. **Elliptic Curve Discrete Logarithm Problem (ECDLP)**
   - Given G and P = kG, finding k is computationally infeasible
   - Security level: ~128 bits (best known attack: Pollard's rho)
   - Required for: commitment hiding, stealth address unlinkability

2. **Computational Diffie-Hellman (CDH)**
   - Given G, aG, bG, computing abG is infeasible without knowing a or b
   - Reduces to ECDLP
   - Required for: stealth address generation (ECDH key exchange)

### Known Attacks

| Attack | Complexity | Mitigation |
|--------|------------|------------|
| Pollard's rho | O(√n) ≈ 2^128 | None needed (sufficient security) |
| Baby-step giant-step | O(√n) space/time | None needed |
| Invalid curve attack | Variable | Point validation on all inputs |
| Small subgroup attack | N/A | Cofactor = 1, not applicable |
| Twist attack | Variable | Point validation |

### Parameter Justification

- **secp256k1 choice**: Bitcoin-proven, 15+ years of analysis, efficient implementations
- **128-bit security**: NIST recommended minimum for 2030+ timeframe
- **Cofactor 1**: Simplifies implementation, no subgroup attacks

## Pedersen Commitments

### Construction

```
Commitment: C = v·G + r·H

Where:
- v: value (secret)
- r: blinding factor (random, 256-bit)
- G: standard secp256k1 generator
- H: NUMS (Nothing Up My Sleeve) generator
```

### H Generator (NUMS Construction)

```typescript
// H is derived by hashing a fixed string to curve
const seed = sha256("SIP_PEDERSEN_H_GENERATOR_V1")
H = hashToCurve(seed)

// Properties:
// 1. Nobody knows discrete log of H with respect to G
// 2. Construction is deterministic and verifiable
// 3. Follows industry best practice (see Zcash, Mimblewimble)
```

### Security Properties

1. **Perfectly Hiding**
   - For any two values v₁, v₂, commitments are indistinguishable
   - Information-theoretic: holds even against unbounded adversary
   - Proof: For any v, C can be opened to any value with appropriate r

2. **Computationally Binding**
   - Cannot find (v₁, r₁) ≠ (v₂, r₂) such that commit(v₁, r₁) = commit(v₂, r₂)
   - Reduces to ECDLP: finding collision implies knowing log_G(H)
   - Security: 128 bits under ECDLP assumption

3. **Additively Homomorphic**
   - C₁ + C₂ = commit(v₁ + v₂, r₁ + r₂)
   - Enables balance proofs without revealing amounts

### Known Attacks

| Attack | Applicable | Mitigation |
|--------|------------|------------|
| Related blinding | Yes if blinding reused | Fresh random blinding per commitment |
| Blinding bias | Yes if PRNG weak | Rejection sampling for uniform distribution |
| H backdoor | Yes if H = kG known | NUMS construction, verifiable derivation |

## Stealth Addresses (EIP-5564 Style)

### Construction

```
Recipient publishes: (K_spend, K_view) - stealth meta-address
Sender generates:    r (ephemeral private key)
                     R = r·G (ephemeral public key)
                     S = r·K_view (shared secret via ECDH)
                     s = H(S) (scalar derivation)
                     P = K_spend + s·G (stealth address)

Recipient computes:  S' = k_view·R (same shared secret)
                     s' = H(S')
                     p = k_spend + s' (stealth private key)
```

### Security Properties

1. **Unlinkability**
   - Different stealth addresses for same recipient are unlinkable
   - Even with multiple payments, no common factor reveals recipient

2. **Ephemeral Key Privacy**
   - R reveals nothing about recipient without k_view
   - Observers cannot compute shared secret

3. **View Key Separation**
   - k_view allows scanning without spending capability
   - Provides audit/compliance path

### Assumptions

- **CDH**: Required for ECDH security
- **Random Oracle Model**: Hash function modeled as random oracle
- **Fresh Ephemeral Keys**: New r for each payment

### View Tag Optimization

```
view_tag = first byte of H(S)
```

- Reduces scanning computation by 256x
- Small information leakage: reveals 8 bits about shared secret
- Acceptable trade-off for scanning efficiency

## Hash Functions

### SHA-256

Used for:
- NUMS generator derivation
- Shared secret to scalar derivation
- Proof hashing

Properties:
- 128-bit collision resistance
- 256-bit preimage resistance
- Standard construction, extensively analyzed

### Assumed Properties

1. **Preimage Resistance**: Given h = H(m), finding m is infeasible
2. **Second Preimage Resistance**: Given m₁, finding m₂ ≠ m₁ with H(m₁) = H(m₂) is infeasible
3. **Collision Resistance**: Finding any m₁ ≠ m₂ with H(m₁) = H(m₂) is infeasible
4. **Random Oracle Behavior**: H behaves as random function (heuristic)

## ZK Proof System (Noir/Barretenberg)

### Framework

- **Backend**: Barretenberg (Aztec)
- **Language**: Noir
- **Proof System**: UltraPlonk

### Assumptions

1. **Soundness**: Malicious prover cannot convince verifier of false statement
   - Based on: q-DLOG assumption, algebraic group model
   - Security level: Depends on constraint system

2. **Zero-Knowledge**: Verifier learns nothing beyond statement truth
   - Based on: Hiding property of commitment scheme
   - Computational zero-knowledge

3. **Trusted Setup**: Universal SRS (Structured Reference String)
   - Barretenberg uses BN254 curve
   - Powers-of-tau ceremony (Aztec ceremony + Hermez contributions)

### Circuit Constraints

| Circuit | Constraints (approx) | Purpose |
|---------|---------------------|---------|
| Funding Proof | ~20 | Prove sufficient balance |
| Validity Proof | ~200 | Verify intent signature |
| Fulfillment Proof | ~200 | Verify delivery |

## Random Number Generation

### Source

```typescript
crypto.getRandomValues(new Uint8Array(32))
```

### Properties Required

1. **Unpredictability**: Each bit has 50% probability
2. **Independence**: No correlation between outputs
3. **Backtracking Resistance**: Past outputs don't reveal future

### Platform Security

| Platform | Source | Quality |
|----------|--------|---------|
| Browser | Web Crypto API → OS CSPRNG | High |
| Node.js | crypto.randomBytes → OS CSPRNG | High |
| Mobile | OS secure random | High |

### Failure Modes

- PRNG seeding failure → Predictable outputs
- Mitigation: Rejection sampling + validation

## Security Level Summary

| Component | Security Level | Basis |
|-----------|---------------|-------|
| ECDLP | 128 bits | secp256k1 curve |
| Commitments | 128 bits | Binding reduces to ECDLP |
| Commitments | ∞ (perfect) | Hiding is information-theoretic |
| Stealth addresses | 128 bits | CDH assumption |
| SHA-256 | 128 bits | Collision resistance |
| ZK Proofs | ~128 bits | UltraPlonk soundness |

## Implementation Notes

### Constant-Time Operations

The @noble/curves library provides:
- Constant-time scalar multiplication
- Constant-time point addition
- Constant-time comparison

This prevents timing side-channel attacks.

### Validation Requirements

1. All points must be validated on curve before use
2. Scalars must be in valid range [1, n-1]
3. Commitments must be non-identity point
4. Proofs must be verified before acceptance

## References

1. [SEC 2: Recommended Elliptic Curve Domain Parameters](https://www.secg.org/sec2-v2.pdf)
2. [Pedersen Commitments](https://link.springer.com/chapter/10.1007/3-540-46766-1_9)
3. [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
4. [Noir Documentation](https://noir-lang.org/docs)
5. [Barretenberg](https://github.com/AztecProtocol/barretenberg)
