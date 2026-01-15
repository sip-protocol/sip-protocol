# WOTS+ Post-Quantum Signature Research

**Status:** Research Phase
**Issue:** [#491](https://github.com/sip-protocol/sip-protocol/issues/491)
**Milestone:** M20 (Q4 2026)
**Priority:** Low - Marketing/future-proofing

---

## Executive Summary

This document evaluates adding WOTS+ (Winternitz One-Time Signature Plus) support for post-quantum resistant signatures in SIP Protocol stealth addresses. The key insight is that **SIP's one-time stealth address model naturally aligns with WOTS+ one-time signature constraints**.

**Recommendation:** Proceed with prototyping. The natural fit with stealth addresses and competitive positioning justify exploration, despite current quantum threats being theoretical.

---

## Table of Contents

1. [Background](#background)
2. [WOTS+ Overview](#wots-overview)
3. [Natural Fit with SIP](#natural-fit-with-sip)
4. [Technical Analysis](#technical-analysis)
5. [Implementation Design](#implementation-design)
6. [Cost Analysis](#cost-analysis)
7. [Competitive Landscape](#competitive-landscape)
8. [Decision Matrix](#decision-matrix)
9. [Prototype Plan](#prototype-plan)
10. [Related Work](#related-work)

---

## Background

### Quantum Threat Model

Current cryptographic signatures (ed25519, secp256k1) rely on:
- **Elliptic Curve Discrete Log Problem (ECDLP)** - ed25519, secp256k1
- **Integer Factorization** - RSA

Shor's algorithm on a sufficiently large quantum computer can break both in polynomial time. However:

- **Current state (2026):** Largest quantum computers ~1,000 qubits
- **Required for ECDLP:** ~2,000-4,000 logical qubits (millions of physical qubits)
- **Timeline estimates:** 10-20 years for cryptographically relevant quantum computers

### Why Consider Post-Quantum Now?

1. **"Harvest now, decrypt later"** - Adversaries may store encrypted data to decrypt later
2. **Migration time** - Cryptographic migrations take years (SHA-1 → SHA-2 took ~15 years)
3. **Marketing differentiation** - Competitors (Obscura, etc.) advertise PQ readiness
4. **Future-proofing** - Early research enables faster deployment when needed

---

## WOTS+ Overview

### What is WOTS+?

**Winternitz One-Time Signature Plus (WOTS+)** is a hash-based signature scheme that:

- Relies **only on hash function security** (SHA-256, SHAKE256)
- Is **provably secure** against quantum computers
- Is a **building block** for SPHINCS+ (NIST PQ standard)
- Has **one-time key usage** constraint

### How WOTS+ Works

```
1. Key Generation:
   secret_seed ──▶ 67 chains × 16 hash iterations = private key
   hash_chain_ends = public key (~2KB)

2. Signing (message m):
   - Hash message to get checksum + indices
   - Partially reveal hash chains based on indices
   - Signature = intermediate chain values (~2KB)

3. Verification:
   - Continue hash chains from signature to public key
   - Verify chain endpoints match
```

### WOTS+ Parameters (Typical)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Security Level | 256 bits | Post-quantum 128-bit security |
| Hash Function | SHA-256 | Or SHAKE256 |
| Winternitz Parameter (w) | 16 | Trade-off: larger w = smaller sig, slower |
| Private Key Size | ~2,144 bytes | 67 × 32-byte seeds |
| Public Key Size | ~2,144 bytes | 67 × 32-byte chain endpoints |
| Signature Size | ~2,144 bytes | 67 × 32-byte chain values |
| Sign Time | ~1ms | CPU-bound, hash operations |
| Verify Time | ~1ms | Similar to signing |

### Comparison with Current Schemes

| Property | ed25519 | secp256k1 | WOTS+ |
|----------|---------|-----------|-------|
| Public Key | 32 bytes | 33 bytes | ~2KB |
| Signature | 64 bytes | ~72 bytes | ~2KB |
| Quantum Safe | ❌ | ❌ | ✅ |
| Key Reuse | ✅ Unlimited | ✅ Unlimited | ❌ ONE TIME |
| Sign Speed | 10μs | 20μs | 1ms |
| Verify Speed | 30μs | 50μs | 1ms |
| On-chain Cost | Low | Low | High |

---

## Natural Fit with SIP

### The One-Time Constraint Problem

WOTS+'s biggest limitation is that **each key pair can only sign ONE message**. Signing twice with the same key reveals enough hash chain values to forge signatures.

This is normally a critical problem:

```
Traditional Wallet:
  Private Key ──▶ Sign tx 1 ✅
                  Sign tx 2 ✅
                  Sign tx 3 ✅
  (Key reuse required)

WOTS+ Constraint VIOLATED ❌
```

### Why SIP Stealth Addresses Solve This

SIP stealth addresses are **inherently one-time use**:

```
Sender creates stealth address ──▶ Recipient claims once ──▶ Address retired

Flow:
1. Sender: derive_stealth(recipient_viewing_key) → Stealth Address A
2. Sender: send payment to Stealth Address A
3. Recipient: derive_private_key(Stealth Address A) → Sign claim tx
4. Recipient: claim payment (ONE signature)
5. Stealth Address A is NEVER used again

This PERFECTLY aligns with WOTS+ one-time constraint ✅
```

### Security Alignment

| SIP Property | WOTS+ Constraint | Alignment |
|--------------|------------------|-----------|
| Stealth address = one-time | Key used once | ✅ Perfect |
| Claim tx = single signature | One sig per key | ✅ Perfect |
| Address derived per payment | Fresh key per use | ✅ Perfect |
| Unlinkability required | No key reuse | ✅ Perfect |

---

## Technical Analysis

### Key Derivation from Stealth Seed

Current stealth key derivation (ed25519):

```typescript
// Current ed25519 stealth derivation
const sharedSecret = scalarMult(viewingPrivateKey, ephemeralPublicKey)
const stealthPrivateKey = sha256(sharedSecret || spendingPrivateKey)
```

Proposed WOTS+ derivation:

```typescript
// WOTS+ stealth derivation
const sharedSecret = scalarMult(viewingPrivateKey, ephemeralPublicKey)
const wotsSecretSeed = sha256(sharedSecret || spendingPrivateKey || "wots+")

// Generate WOTS+ keypair from seed
const wotsKeypair = wots.generateFromSeed(wotsSecretSeed, {
  w: 16,           // Winternitz parameter
  n: 32,           // Security parameter (bytes)
  hash: 'sha256',  // Hash function
})
```

### Transaction Structure Changes

Current claim transaction (Solana):

```
┌─────────────────────────────────────────┐
│ Solana Transaction                       │
├─────────────────────────────────────────┤
│ Signatures: [ed25519_sig (64 bytes)]    │
│ Message:                                 │
│   - Claim instruction                    │
│   - Stealth address                      │
│   - Recipient                            │
└─────────────────────────────────────────┘
Total: ~200-300 bytes
```

With WOTS+ option:

```
┌─────────────────────────────────────────┐
│ Solana Transaction                       │
├─────────────────────────────────────────┤
│ Signatures: [wots_sig (~2KB)]           │
│ Message:                                 │
│   - Claim instruction                    │
│   - WOTS+ public key hash (32 bytes)    │
│   - Stealth address                      │
│   - Recipient                            │
│   - Full WOTS+ public key (account data) │
└─────────────────────────────────────────┘
Total: ~4-5KB
```

### Solana Verification Challenges

Solana doesn't natively support WOTS+ verification. Options:

1. **Custom Program (recommended)**
   ```rust
   // On-chain WOTS+ verifier
   pub fn verify_wots_signature(
       public_key: &[u8; 2144],
       signature: &[u8; 2144],
       message: &[u8],
   ) -> Result<()>
   ```
   - Estimated: 200-400K compute units
   - One-time deployment, reusable

2. **ZK Proof of Signature Validity**
   - Generate proof off-chain that signature is valid
   - Verify small proof on-chain
   - Higher complexity, lower on-chain cost

3. **Trusted Relayer**
   - Off-chain verification by trusted party
   - Not recommended (defeats decentralization)

---

## Implementation Design

### Hybrid Signature Architecture

```typescript
// User choice of signature scheme
interface ClaimParams {
  stealthAddress: string
  recipient: string
  signatureScheme: 'ed25519' | 'wots+'  // User choice
}

// Under the hood
class StealthClaimer {
  async claim(params: ClaimParams) {
    if (params.signatureScheme === 'wots+') {
      return this.claimWithWOTS(params)
    }
    return this.claimWithEd25519(params)  // Default
  }

  private async claimWithWOTS(params: ClaimParams) {
    // 1. Derive WOTS+ keypair from stealth seed
    const keypair = await deriveWOTSKeypair(params.stealthAddress)

    // 2. Build claim instruction with WOTS+ verification
    const ix = await buildWOTSClaimInstruction({
      stealthAddress: params.stealthAddress,
      recipient: params.recipient,
      wotsPublicKey: keypair.publicKey,
    })

    // 3. Sign with WOTS+
    const message = serializeInstruction(ix)
    const signature = wots.sign(keypair.privateKey, message)

    // 4. Submit transaction with WOTS+ signature
    return submitWOTSTransaction(ix, signature, keypair.publicKey)
  }
}
```

### TypeScript WOTS+ Module

```typescript
// packages/sdk/src/crypto/wots.ts

export interface WOTSConfig {
  w: number          // Winternitz parameter (4, 16, 256)
  n: number          // Security parameter (32 for 256-bit)
  hash: 'sha256' | 'shake256'
}

export interface WOTSKeypair {
  privateKey: Uint8Array  // Secret seed
  publicKey: Uint8Array   // Chain endpoints
}

export interface WOTSSignature {
  signature: Uint8Array   // Intermediate chain values
}

// Key generation from seed (deterministic)
export function generateFromSeed(
  seed: Uint8Array,
  config: WOTSConfig = DEFAULT_CONFIG
): WOTSKeypair

// Sign message (ONE TIME ONLY!)
export function sign(
  privateKey: Uint8Array,
  message: Uint8Array,
  config: WOTSConfig = DEFAULT_CONFIG
): WOTSSignature

// Verify signature
export function verify(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: WOTSSignature,
  config: WOTSConfig = DEFAULT_CONFIG
): boolean

// Constants
export const DEFAULT_CONFIG: WOTSConfig = {
  w: 16,
  n: 32,
  hash: 'sha256',
}

export const WOTS_PUBLIC_KEY_SIZE = 2144   // bytes
export const WOTS_SIGNATURE_SIZE = 2144    // bytes
export const WOTS_PRIVATE_KEY_SIZE = 2144  // bytes
```

### Solana Program Extension

```rust
// programs/sip-stealth/src/wots.rs

use sha2::{Sha256, Digest};

pub const WOTS_N: usize = 32;           // Security parameter
pub const WOTS_W: usize = 16;           // Winternitz parameter
pub const WOTS_LEN1: usize = 64;        // ceil(256 / log2(W))
pub const WOTS_LEN2: usize = 3;         // ceil(log2(LEN1 * (W-1)) / log2(W)) + 1
pub const WOTS_LEN: usize = WOTS_LEN1 + WOTS_LEN2;  // 67
pub const WOTS_SIG_SIZE: usize = WOTS_LEN * WOTS_N; // 2144

/// Verify WOTS+ signature
pub fn verify_wots_signature(
    public_key: &[u8; WOTS_SIG_SIZE],
    signature: &[u8; WOTS_SIG_SIZE],
    message: &[u8],
) -> Result<(), ProgramError> {
    // 1. Hash message to get base-W representation
    let msg_digest = Sha256::digest(message);
    let (b, checksum) = base_w_with_checksum(&msg_digest);

    // 2. For each chain, hash signature value (W - b[i]) times
    let mut computed_pk = [0u8; WOTS_SIG_SIZE];
    for i in 0..WOTS_LEN {
        let chain_start = i * WOTS_N;
        let chain_end = chain_start + WOTS_N;

        let steps = (WOTS_W - 1) - b[i] as usize;
        let mut chain_value = signature[chain_start..chain_end].to_vec();

        for _ in 0..steps {
            chain_value = Sha256::digest(&chain_value).to_vec();
        }

        computed_pk[chain_start..chain_end].copy_from_slice(&chain_value);
    }

    // 3. Compare computed public key with provided public key
    if computed_pk != *public_key {
        return Err(ProgramError::InvalidSignature);
    }

    Ok(())
}

/// Convert hash to base-W representation with checksum
fn base_w_with_checksum(digest: &[u8; 32]) -> ([u8; WOTS_LEN], u32) {
    // ... implementation
}
```

---

## Cost Analysis

### Solana Transaction Costs

| Component | ed25519 Claim | WOTS+ Claim |
|-----------|---------------|-------------|
| Signature data | 64 bytes | 2,144 bytes |
| Public key | 32 bytes | 2,144 bytes (account) |
| Base tx | ~200 bytes | ~200 bytes |
| **Total size** | ~296 bytes | ~4,488 bytes |
| **Compute units** | ~5,000 | ~300,000 (estimated) |
| **Priority fee** | ~0.000005 SOL | ~0.00003 SOL |
| **Base fee** | 0.000005 SOL | 0.000005 SOL |
| **Total cost** | ~0.00001 SOL | ~0.000035 SOL |

### Storage Costs (Account Rent)

If storing WOTS+ public key in account:
- Account size: 2,144 bytes
- Rent-exempt: ~0.015 SOL
- Can be recovered after claim

### Verdict

**WOTS+ claims cost ~3.5x more than ed25519** but remain affordable:
- ~$0.007 at $200/SOL vs ~$0.002 for ed25519
- Acceptable for users who prioritize quantum resistance

---

## Competitive Landscape

### Projects Advertising Post-Quantum

| Project | PQ Approach | Status |
|---------|-------------|--------|
| Obscura | WOTS+ (advertised) | Unclear implementation |
| Zcash | Research only | No deployment |
| Monero | Research only | No deployment |
| QRL | XMSS (full PQ) | Live, Ethereum L1 |
| IOTA | W-OTS in Tangle | Deprecated |

### SIP Differentiation

By implementing WOTS+ for stealth claims, SIP would be:
- **First privacy protocol** with practical PQ option on Solana
- **Hybrid approach** - users choose classical or PQ
- **Natural fit** - stealth addresses match one-time constraint

---

## Decision Matrix

### Go/No-Go Criteria

| Criterion | Threshold | Status |
|-----------|-----------|--------|
| Verification cost | < 500K CU | ✅ ~300K estimated |
| Implementation complexity | < 2 weeks | ✅ Feasible |
| User demand | Surveys/feedback | ⏳ TBD |
| Security review | External audit | ⏳ Required before prod |
| UX impact | < 2x latency | ✅ Acceptable |

### Recommendation

**Proceed with prototyping** based on:
1. ✅ Natural fit with stealth address model
2. ✅ Acceptable cost overhead
3. ✅ Competitive positioning value
4. ✅ Future-proofing benefits

**Implementation phases:**
1. **Phase 1 (M17):** TypeScript WOTS+ library + tests
2. **Phase 2 (M18):** Solana verifier program
3. **Phase 3 (M20):** Full integration + audit

---

## Prototype Plan

### Phase 1: TypeScript Implementation

```bash
# Create WOTS+ module
packages/sdk/src/crypto/wots.ts
packages/sdk/tests/crypto/wots.test.ts
```

Deliverables:
- [ ] WOTS+ key generation from seed
- [ ] Sign function with one-time enforcement
- [ ] Verify function
- [ ] Test vectors from SPHINCS+ spec
- [ ] Benchmark: sign/verify times

### Phase 2: Stealth Integration

```typescript
// Integration with stealth addresses
packages/sdk/src/stealth/wots-stealth.ts
```

Deliverables:
- [ ] Derive WOTS+ keypair from stealth seed
- [ ] WOTS+ stealth address format
- [ ] Claim tx builder with WOTS+ signature

### Phase 3: Solana Program

```rust
// On-chain verifier
programs/sip-stealth/src/wots.rs
```

Deliverables:
- [ ] WOTS+ verification instruction
- [ ] Compute unit optimization
- [ ] Integration tests

---

## Related Work

### Specifications

- [RFC 8391: XMSS](https://datatracker.ietf.org/doc/html/rfc8391) - Extended Merkle Signature Scheme (uses WOTS+)
- [SPHINCS+ Specification](https://sphincs.org/data/sphincs+-specification.pdf) - NIST PQ standard
- [Hash-Based Signatures by Andreas Hülsing](https://www.esat.kuleuven.be/cosic/publications/thesis-267.pdf)

### Implementations

- [hash-sigs (C reference)](https://github.com/cisco/hash-sigs) - Cisco's implementation
- [pqcrypto-sphincsplus (Rust)](https://crates.io/crates/pqcrypto-sphincsplus) - Rust bindings
- [noble-post-quantum (TypeScript)](https://github.com/paulmillr/noble-post-quantum) - Paul Miller's library

### Related SIP Issues

- [#441 - Winternitz Vault](https://github.com/sip-protocol/sip-protocol/issues/441) - Quantum-resistant storage
- [#401 - SIP Solana Program](https://github.com/sip-protocol/sip-protocol/issues/401) - Base program

---

## Appendix: WOTS+ Algorithm Details

### Key Generation

```
Input: seed (32 bytes), w (Winternitz parameter)

len1 = ceil(256 / log2(w))  // 64 for w=16
len2 = floor(log2(len1 * (w-1)) / log2(w)) + 1  // 3 for w=16
len = len1 + len2  // 67

For i = 0 to len-1:
  sk[i] = SHA256(seed || i || "sk")  // 32 bytes each
  pk[i] = hash_chain(sk[i], w-1)      // Apply hash w-1 times

Return (sk, pk)  // ~2KB each
```

### Signing

```
Input: sk (private key), message

msg_hash = SHA256(message)
(b, checksum) = base_w(msg_hash)  // Convert to base-w digits

sig = []
For i = 0 to len-1:
  sig[i] = hash_chain(sk[i], b[i])  // Apply hash b[i] times

Return sig  // ~2KB
```

### Verification

```
Input: pk (public key), message, sig

msg_hash = SHA256(message)
(b, checksum) = base_w(msg_hash)

For i = 0 to len-1:
  computed_pk[i] = hash_chain(sig[i], w - 1 - b[i])

Return computed_pk == pk
```

---

*Last Updated: January 2026*
*Author: SIP Protocol Team*
