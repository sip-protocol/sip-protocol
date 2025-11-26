# ZK Proof Architecture Decision

> **Issue**: #2 - Define ZK proof architecture (framework selection)
> **Status**: DECIDED
> **Date**: November 26, 2025
> **Author**: SIP Protocol Team

---

## Executive Summary

**Decision**: Use **Noir** as the primary ZK circuit language for SIP Protocol.

**Rationale**: Noir provides the best balance of developer experience, backend flexibility, and modern tooling while avoiding the complexity of per-circuit trusted setups.

---

## Context

SIP Protocol requires zero-knowledge proofs for three core operations:

1. **Funding Proof**: Prove sufficient funds exist without revealing balance
2. **Validity Proof**: Prove intent authorization without revealing sender
3. **Fulfillment Proof**: Prove correct execution without revealing transaction path

These proofs must be:
- Secure (cryptographically sound, auditable)
- Efficient (fast verification, reasonable proof generation)
- Practical (good developer experience, maintainable)

---

## Candidates Evaluated

### 1. Circom + Groth16

**Overview**: The most battle-tested ZK framework, used by Tornado Cash, Dark Forest, and many production systems.

**Pros**:
- Production-proven (6+ years in production)
- Fastest browser proving via optimized WASM
- Smallest proof size (~200 bytes)
- Fastest on-chain verification (~300K gas)
- Extensive library ecosystem (circomlib)
- Multiple prover options (snarkjs, rapidsnark, arkworks)

**Cons**:
- **Requires per-circuit trusted setup** - security risk if compromised
- Manual constraint management - error-prone
- "Abstracted too early" - awkward middle ground between high/low level
- Scaling challenges with large circuits
- RSA circuit: ~15 seconds, complex circuits: up to 1 minute

**Security**: Trail of Bits Circomspect analyzer available.

### 2. Noir (Aztec)

**Overview**: Modern ZK DSL with Rust-like syntax, backend-agnostic architecture.

**Pros**:
- **Best developer experience** - Rust-inspired, intuitive syntax
- **Backend agnostic** - supports UltraPlonk, Groth16, Halo2, Plonky2
- Universal setup (no per-circuit trusted setup)
- Rich standard library (SHA256, Blake2/3, Pedersen, Poseidon, ECDSA, EdDSA, Schnorr)
- Browser support via NoirJS
- Recursive proof support
- Active development (1.0 pre-release announced)
- Growing ecosystem: zkEmail, zkPassport, zkLogin using Noir
- Formal verification tools available (rocq-of-noir, lampe)

**Cons**:
- Still maturing (not as battle-tested as Circom)
- Some performance gaps vs optimized Circom (improving rapidly)
- Smaller community than Circom (but growing fast: 600+ GitHub projects)

**Security**: Nethermind audit, formal verification tooling, Consensys Diligence audits of Noir projects.

### 3. Halo2 (Zcash)

**Overview**: Zcash's high-performance zk-SNARK with PLONKish arithmetization.

**Pros**:
- **No trusted setup** (uses IPA-based commitments)
- Production deployed in Zcash NU5
- Recursive proof composition built-in
- Used by major projects (Scroll, Taiko, Protocol Labs, PSE)
- Highly customizable with custom gates and lookup tables

**Cons**:
- **Steep learning curve** - "expert's tool"
- Verbose code (156 lines vs 77 for Noir in benchmark)
- Long circuit compilation times
- Must implement "chips" from scratch for basic operations
- **Soundness bug discovered September 2024** (query collision bug)

**Security**: Kudelski Security research, multiple formal verification efforts.

---

## Evaluation Matrix

| Criteria | Weight | Circom+Groth16 | Noir | Halo2 |
|----------|--------|----------------|------|-------|
| **Security** | 25% | 9/10 (battle-tested) | 7/10 (maturing) | 7/10 (bug found) |
| **Developer Experience** | 25% | 5/10 (manual) | 9/10 (excellent) | 4/10 (verbose) |
| **Performance** | 15% | 9/10 (optimized) | 7/10 (improving) | 8/10 (good) |
| **Trust Assumptions** | 15% | 5/10 (per-circuit) | 8/10 (universal) | 10/10 (none) |
| **Ecosystem/Tooling** | 10% | 9/10 (mature) | 7/10 (growing) | 6/10 (sparse) |
| **Flexibility** | 10% | 6/10 (limited) | 9/10 (agnostic) | 8/10 (custom) |
| **Weighted Score** | 100% | **7.05** | **7.75** | **6.55** |

---

## Decision: Noir

### Primary Reasons

1. **Backend Agnostic**: Noir compiles to ACIR (intermediate representation) that can target multiple proving backends. If we need to switch from UltraPlonk to Groth16 or Halo2 for specific use cases, we can without rewriting circuits.

2. **Developer Experience**: SIP is a long-term protocol. Noir's Rust-like syntax, good documentation, and intuitive abstractions will reduce bugs and speed development. The 77-line Mastermind implementation vs 156 lines in Halo2 demonstrates this conciseness.

3. **Universal Setup**: Avoiding per-circuit trusted setups eliminates a significant security and operational burden. We don't need to coordinate ceremonies for each circuit update.

4. **Rich Standard Library**: Built-in support for:
   - Pedersen hash (our commitment scheme)
   - ECDSA/EdDSA (wallet signatures)
   - SHA256, Keccak256 (compatibility)
   - Schnorr (stealth address derivation)

5. **Browser Support**: NoirJS enables client-side proof generation, critical for our demo and future wallet integrations.

6. **Growing Ecosystem**: zkEmail, zkPassport are building production systems on Noir. The EF ZK Grants supporting Noir development signals long-term viability.

7. **Recursive Proofs**: Native support via `#[recursive]` attribute enables future scalability.

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Less battle-tested | Focus on simple circuits first; use formal verification tools |
| Performance gaps | Start with UltraPlonk; can switch backends if needed |
| Ecosystem smaller | Core primitives (Pedersen, ECDSA) well-supported |
| Aztec dependency | Noir is open source; community forks exist |

---

## Implementation Plan

### Phase 1: Setup (Week 1)
- Install Noir toolchain (nargo)
- Set up project structure
- Create basic test circuit

### Phase 2: Core Circuits (Weeks 2-4)
- Implement Pedersen commitment circuit
- Implement Funding Proof circuit (#3)
- Implement Validity Proof circuit (#4)
- Implement Fulfillment Proof circuit (#5)

### Phase 3: Integration (Weeks 5-6)
- Create TypeScript bindings via NoirJS
- Integrate with SDK ProofProvider interface
- Browser proof generation testing

### Phase 4: Optimization (Week 7+)
- Benchmark and optimize constraints
- Consider backend alternatives if needed
- Prepare for security review

---

## Alternatives Considered

### Why Not Circom?

Circom's per-circuit trusted setup is a significant operational burden for a protocol that will evolve. Each circuit change requires a new ceremony. For SIP's iterative development approach, this is impractical.

### Why Not Halo2?

Despite no trusted setup and Zcash compatibility, Halo2's steep learning curve and verbose code would slow development significantly. The September 2024 soundness bug also raises concerns about stability.

### Why Not Bulletproofs?

Bulletproofs are excellent for range proofs but have slower verification (~10x slower than SNARKs). Not suitable for our use case requiring multiple proof types.

---

## References

- [Noir Documentation](https://noir-lang.org/)
- [Noir 1.0 Pre-Release Announcement](https://aztec.network/blog/the-future-of-zk-development-is-here-announcing-the-noir-1-0-pre-release)
- [ZK Framework Comparison](https://blog.aayushg.com/zk/)
- [Noir vs Circom](https://medium.com/distributed-lab/how-to-zk-noir-vs-circom-610d1b88b119)
- [Halo2 Security Research](https://research.kudelskisecurity.com/2024/09/24/on-the-security-of-halo2-proof-system/)
- [ZK Framework Mastermind Benchmark](https://veridise.com/blog/learn-blockchain/exploring-zk-frameworks-mastermind-game-in-5-different-zk-languages/)
- [Circom Prover Comparison](https://zkmopro.org/blog/circom-comparison/)

---

## Appendix: Code Comparison

### Pedersen Commitment in Noir (estimated)
```noir
use dep::std::hash::pedersen_hash;

fn commit(value: Field, blinding: Field) -> Field {
    pedersen_hash([value, blinding])
}

fn main(
    value: Field,
    blinding: Field,
    expected_commitment: pub Field
) {
    let commitment = commit(value, blinding);
    assert(commitment == expected_commitment);
}
```

### Same in Circom (estimated)
```circom
pragma circom 2.0.0;
include "circomlib/circuits/pedersen.circom";

template Commit() {
    signal input value;
    signal input blinding;
    signal output commitment;

    component pedersen = Pedersen(2);
    pedersen.in[0] <== value;
    pedersen.in[1] <== blinding;

    commitment <== pedersen.out[0];
}

template CommitmentVerifier() {
    signal input value;
    signal input blinding;
    signal input expected;

    component commit = Commit();
    commit.value <== value;
    commit.blinding <== blinding;

    expected === commit.commitment;
}

component main {public [expected]} = CommitmentVerifier();
```

Noir: ~15 lines, Circom: ~25 lines for equivalent functionality.

---

*Document Status: FINAL*
*Last Updated: November 26, 2025*
