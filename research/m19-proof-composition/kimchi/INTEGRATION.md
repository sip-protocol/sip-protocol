# Kimchi Integration Requirements for SIP

**Issue:** #273 (M19-08)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

This document outlines the requirements for integrating Kimchi/Pickles with SIP's proof composition architecture. The goal is to leverage Kimchi's constant-size recursive proofs alongside Halo2's flexible accumulation.

**Key Integration Paths:**
1. **o1js SDK** — TypeScript zkApps on Mina
2. **Rust Kimchi library** — Direct proof-systems integration
3. **Hybrid** — Halo2 accumulation + Pickles final compression

---

## 1. Integration Options

### Option A: o1js (TypeScript)

**Best for:** zkApp development, browser proving, Mina deployment

```typescript
// o1js integration pattern
import { Field, SmartContract, method, Provable } from 'o1js';

class SIPPrivacyProof extends SmartContract {
  @method async verifyPrivateTransfer(
    commitment: Field,
    nullifier: Field,
    proof: Proof<SIPCircuit>
  ) {
    // Verify incoming proof
    proof.verify();

    // Check commitment is valid
    commitment.assertNotEquals(Field(0));

    // Emit event (on Mina)
    this.emitEvent('transfer', commitment);
  }
}
```

**Pros:**
- TypeScript developer experience
- Browser-native proving
- Mina ecosystem integration
- Built-in recursion

**Cons:**
- Tightly coupled to Mina
- Less flexible than raw Kimchi
- Larger runtime (~10MB WASM)

### Option B: Rust Kimchi Library

**Best for:** Custom proof composition, non-Mina deployment

```rust
// Direct Kimchi integration
use kimchi::{
    circuits::gate::CircuitGate,
    prover::Prover,
    verifier::Verifier,
};

fn create_sip_proof() -> Result<Proof> {
    // Build circuit
    let gates = build_sip_circuit();

    // Create prover
    let prover = Prover::create(&gates, &srs)?;

    // Generate proof
    let witness = generate_witness(&private_inputs);
    let proof = prover.prove(&witness)?;

    Ok(proof)
}
```

**Pros:**
- Maximum flexibility
- No Mina dependency
- Can integrate with Halo2

**Cons:**
- More complex integration
- Less documentation
- Requires Rust expertise

### Option C: Hybrid (Recommended for SIP)

**Best for:** Proof composition with multiple systems

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIP HYBRID INTEGRATION                       │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ Noir Proof  │  │ Halo2 Proof │  │External Proof│           │
│   │(Barretenberg)│  │   (IPA)    │  │  (any)      │           │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│          │                │                │                    │
│          └────────┬───────┴────────┬───────┘                   │
│                   │                │                            │
│                   ▼                ▼                            │
│          ┌─────────────────────────────────┐                   │
│          │      HALO2 ACCUMULATOR          │                   │
│          │  • Aggregate multiple proofs    │                   │
│          │  • Flexible proof types         │                   │
│          └──────────────┬──────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│          ┌─────────────────────────────────┐                   │
│          │    KIMCHI/PICKLES WRAPPER       │                   │
│          │  • Verify Halo2 accumulator     │                   │
│          │  • Compress to ~22KB            │                   │
│          │  • Constant-size output         │                   │
│          └──────────────┬──────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│          ┌─────────────────────────────────┐                   │
│          │       FINAL PROOF (~22KB)       │                   │
│          │  • Light client verifiable      │                   │
│          │  • Chain-agnostic               │                   │
│          └─────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technical Requirements

### 2.1 Shared Cryptographic Foundation

Both Halo2 and Kimchi use:

| Component | Specification |
|-----------|---------------|
| Curves | Pallas (y² = x³ + 5 over Fp) |
| | Vesta (y² = x³ + 5 over Fq) |
| Field (Pallas base) | p = 28948022309329048855892746252171976963363056481941560715954676764349967630337 |
| Field (Vesta base) | q = 28948022309329048855892746252171976963363056481941647379679742748393362948097 |
| Commitment | IPA (Inner Product Argument) |
| Arithmetization | PLONKish |

### 2.2 Dependencies

**For o1js integration:**
```json
{
  "dependencies": {
    "o1js": "^1.0.0"
  }
}
```

**For Rust Kimchi:**
```toml
[dependencies]
kimchi = { git = "https://github.com/o1-labs/proof-systems" }
mina-curves = "0.1"
ark-ff = "0.4"
ark-poly = "0.4"
```

### 2.3 Build Requirements

| Platform | Requirements |
|----------|-------------|
| Node.js | v18+ with ESM support |
| Browser | Chrome 90+, Firefox 90+, Safari 15+ |
| Rust | 1.70+ stable |
| WASM | wasm32-unknown-unknown target |

---

## 3. Circuit Compatibility

### 3.1 Translating SIP Circuits to Kimchi

**SIP Funding Proof (Noir):**
```noir
fn main(
    balance: Field,
    minimum: pub Field,
    commitment: pub Commitment,
    blinding: Field,
) {
    assert(balance >= minimum);
    let computed = pedersen_commit(balance, blinding);
    assert(computed == commitment);
}
```

**Equivalent o1js:**
```typescript
import { Field, Struct, Provable, Poseidon } from 'o1js';

class FundingProof extends Struct({
  commitment: Field,
  minimum: Field,
}) {
  static verify(balance: Field, blinding: Field, expected: FundingProof) {
    // Range check (balance >= minimum)
    balance.assertGreaterThanOrEqual(expected.minimum);

    // Commitment verification
    const computed = Poseidon.hash([balance, blinding]);
    computed.assertEquals(expected.commitment);
  }
}
```

### 3.2 Key Differences

| Aspect | Noir | Kimchi/o1js |
|--------|------|-------------|
| Field | bn254 | Pasta (Pallas/Vesta) |
| Hash | Pedersen/Poseidon | Poseidon built-in |
| Range check | Built-in | Provable.if + assertions |
| EC ops | secp256k1/bn254 | Pallas/Vesta native |

### 3.3 Foreign Field for Cross-System

Kimchi's foreign field gates enable verification of bn254 operations:

```typescript
// Verify external bn254 proof inside Kimchi
import { ForeignField } from 'o1js';

// Define bn254 field
const Bn254Field = ForeignField.create(
  0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n
);

// Perform bn254 arithmetic in Kimchi circuit
const result = Bn254Field.add(a, b);
```

---

## 4. API Design for SIP

### 4.1 TypeScript SDK Extension

```typescript
// packages/sdk/src/adapters/kimchi-adapter.ts

import { Proof, SmartContract } from 'o1js';

export interface KimchiAdapter {
  // Compile SIP circuits for Kimchi
  compile(): Promise<VerificationKey>;

  // Generate recursive proof
  proveRecursive(
    inputs: SIPProofInputs,
    previousProofs: Proof[]
  ): Promise<Proof>;

  // Verify Kimchi proof
  verify(proof: Proof): Promise<boolean>;

  // Export for Halo2 accumulation
  exportForAccumulation(): Promise<AccumulatorInput>;
}
```

### 4.2 Proof Composition Interface

```typescript
// packages/sdk/src/composition/composer.ts

export interface ProofComposer {
  // Add proof to composition
  addProof(
    proof: AnyProof,
    system: 'noir' | 'halo2' | 'kimchi'
  ): void;

  // Accumulate via Halo2
  accumulate(): Promise<Halo2Accumulator>;

  // Compress via Pickles
  compress(): Promise<PicklesProof>;

  // Get final proof
  finalize(): Promise<ComposedProof>;
}
```

---

## 5. Integration Steps

### Phase 1: o1js POC (Issue #308)

1. Set up o1js development environment
2. Port simple SIP circuit (commitment verification)
3. Test proof generation and verification
4. Benchmark performance

### Phase 2: Rust Integration (#423)

1. Add Kimchi to Rust workspace
2. Implement Kimchi prover for SIP circuits
3. Create bridge between Halo2 and Kimchi
4. Test accumulator composition

### Phase 3: zkApp Exploration (#424)

1. Design SIP as Mina zkApp
2. Implement on-chain state management
3. Test with Mina testnet
4. Evaluate vs custom deployment

---

## 6. Challenges and Mitigations

### 6.1 Field Incompatibility

**Challenge:** Noir uses bn254, Kimchi uses Pasta

**Mitigation:**
- Use foreign field arithmetic in Kimchi
- Verify bn254 operations as "black box"
- Accept ~3x constraint overhead

### 6.2 Proof Format Differences

**Challenge:** Different serialization formats

**Mitigation:**
- Define canonical intermediate format
- Implement converters in SIP SDK
- Use commitment-based verification (not full proof)

### 6.3 Recursion Model Differences

**Challenge:** Halo2 uses accumulation, Pickles uses Step/Wrap

**Mitigation:**
- Use Halo2 for intermediate accumulation
- Use Pickles only for final compression
- Clear interface boundaries

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
describe('Kimchi Integration', () => {
  it('should compile SIP circuit', async () => {
    const { verificationKey } = await SIPCircuit.compile();
    expect(verificationKey).toBeDefined();
  });

  it('should generate valid proof', async () => {
    const proof = await SIPCircuit.prove(inputs);
    expect(await SIPCircuit.verify(proof)).toBe(true);
  });

  it('should compose with Halo2', async () => {
    const kimchiProof = await generateKimchiProof();
    const accumulator = await halo2Accumulate(kimchiProof);
    expect(accumulator.isValid()).toBe(true);
  });
});
```

### 7.2 Integration Tests

- Cross-system proof verification
- Recursive proof generation
- Browser compatibility
- Performance regression

---

## 8. Resource Estimates

### Development Time

| Task | Estimate |
|------|----------|
| o1js POC | 3 days |
| Rust Kimchi integration | 5 days |
| Halo2-Kimchi bridge | 5 days |
| Testing & debugging | 3 days |
| Documentation | 2 days |
| **Total** | **~18 days** |

### Infrastructure

| Resource | Requirement |
|----------|-------------|
| Development | 16GB RAM, 4+ cores |
| CI/CD | 32GB RAM runner |
| Browser testing | BrowserStack or similar |

---

## 9. Checklist

### For Kimchi Integration

- [ ] Set up o1js development environment
- [ ] Port SIP commitment circuit to o1js
- [ ] Implement proof generation
- [ ] Test verification
- [ ] Benchmark performance
- [ ] Document API

### For Proof Composition

- [ ] Define accumulator interface
- [ ] Implement Halo2-Kimchi bridge
- [ ] Test cross-system verification
- [ ] Create final compression pipeline
- [ ] Validate constant-size output

---

## 10. Summary

### Integration Recommendation

**Hybrid approach (Option C)** is recommended:

1. **Halo2** for flexible accumulation of multiple proof types
2. **Kimchi/Pickles** for final compression to ~22KB
3. **o1js** for TypeScript developer experience (optional)

### Key Benefits

- Leverages strengths of both systems
- Constant-size final proof for light clients
- Flexible intermediate accumulation
- Same cryptographic foundation (Pasta, IPA)

### Next Steps

1. **#308** — Build Kimchi POC with o1js
2. **#423** — Implement Mina Kimchi integration
3. **#424** — Explore SIP as native zkApp

---

## References

- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)
- [o1-labs/proof-systems](https://github.com/o1-labs/proof-systems)
- [Kimchi Specification](https://o1-labs.github.io/proof-systems/specs/kimchi.html)
- [Pickles Overview](https://o1-labs.github.io/proof-systems/pickles/overview.html)

---

**Conclusion:** Kimchi integration is feasible and complementary to Halo2. The shared Pasta curves and IPA commitments provide a strong foundation for proof composition. Recommended path: Halo2 accumulation + Pickles compression for optimal flexibility and constant-size output.
