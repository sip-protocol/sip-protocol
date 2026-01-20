# SIP as Native Mina zkApp - Exploration

**Issue:** #424 (M19-11)
**Date:** 2026-01-20
**Status:** Exploration Complete

---

## Executive Summary

This document explores deploying SIP as a native Mina zkApp. While technically feasible, the recommended approach is to use Mina/Pickles as a **compression layer** rather than a primary deployment target.

**Recommendation:** SIP should remain chain-agnostic with Mina zkApp as an optional feature for the Mina ecosystem.

---

## 1. What is a Mina zkApp?

### Overview

zkApps are smart contracts on Mina that execute off-chain and prove on-chain:

```
TRADITIONAL SMART CONTRACT        MINA ZKAPP

   User                            User
     │                               │
     ▼                               ▼
  ┌─────────┐                  ┌─────────┐
  │ On-Chain│                  │Off-Chain│ ◄── Prove locally
  │ Execute │                  │ Execute │
  └────┬────┘                  └────┬────┘
       │                             │
       ▼                             ▼
  Full computation            Zero-knowledge proof
  visible on-chain            submitted on-chain
       │                             │
       ▼                             ▼
  High gas costs              ~22KB constant proof
  Privacy leaks               Privacy preserved
```

### Key Features

- **Off-chain execution** — Complex logic runs locally
- **On-chain proof** — Only verify proof on-chain
- **Privacy** — Inputs hidden via ZK
- **Constant cost** — ~22KB proof regardless of complexity

---

## 2. SIP Privacy Features as zkApp

### Core SIP Functions

| Function | Description | zkApp Implementation |
|----------|-------------|---------------------|
| **Stealth Address** | One-time recipient | Generate off-chain, commit on-chain |
| **Commitment** | Hidden amount | Poseidon hash in circuit |
| **Nullifier** | Prevent double-spend | State update with ZK proof |
| **Viewing Key** | Selective disclosure | Optional reveal circuit |

### Example: SIP Privacy zkApp

```typescript
import {
  SmartContract,
  state,
  State,
  method,
  Field,
  Poseidon,
  MerkleTree,
  MerkleWitness,
  PublicKey,
} from 'o1js';

// Merkle tree depth for commitments
const TREE_HEIGHT = 20;
class CommitmentWitness extends MerkleWitness(TREE_HEIGHT) {}

export class SIPPrivacyZkApp extends SmartContract {
  // State: Merkle root of all commitments
  @state(Field) commitmentRoot = State<Field>();

  // State: Merkle root of all nullifiers (spent)
  @state(Field) nullifierRoot = State<Field>();

  // State: Transaction counter
  @state(Field) txCount = State<Field>();

  /**
   * Shield funds: Create a private commitment
   */
  @method async shield(
    amount: Field,          // Private: amount to shield
    blinding: Field,        // Private: random blinding factor
    commitment: Field,      // Public: computed commitment
    witness: CommitmentWitness  // Private: Merkle proof
  ) {
    // Verify commitment = Poseidon(amount, blinding)
    const computed = Poseidon.hash([amount, blinding]);
    computed.assertEquals(commitment);

    // Verify Merkle witness
    const currentRoot = this.commitmentRoot.getAndRequireEquals();
    witness.calculateRoot(Field(0)).assertEquals(currentRoot);

    // Update Merkle root with new commitment
    const newRoot = witness.calculateRoot(commitment);
    this.commitmentRoot.set(newRoot);

    // Increment transaction count
    const count = this.txCount.getAndRequireEquals();
    this.txCount.set(count.add(1));
  }

  /**
   * Unshield funds: Reveal and spend a commitment
   */
  @method async unshield(
    amount: Field,              // Private: amount to reveal
    blinding: Field,            // Private: blinding factor
    commitment: Field,          // Public: the commitment being spent
    nullifier: Field,           // Public: prevents double-spend
    nullifierWitness: CommitmentWitness,  // Private: nullifier tree proof
    commitmentWitness: CommitmentWitness, // Private: commitment tree proof
    recipient: PublicKey        // Public: where to send funds
  ) {
    // Verify commitment exists
    const commitRoot = this.commitmentRoot.getAndRequireEquals();
    commitmentWitness.calculateRoot(commitment).assertEquals(commitRoot);

    // Verify commitment = Poseidon(amount, blinding)
    const computed = Poseidon.hash([amount, blinding]);
    computed.assertEquals(commitment);

    // Verify nullifier = Poseidon(commitment, secret)
    // (In real impl, secret derived from blinding)
    const computedNullifier = Poseidon.hash([commitment, blinding]);
    computedNullifier.assertEquals(nullifier);

    // Check nullifier not already spent
    const nullRoot = this.nullifierRoot.getAndRequireEquals();
    nullifierWitness.calculateRoot(Field(0)).assertEquals(nullRoot);

    // Add nullifier to spent set
    const newNullRoot = nullifierWitness.calculateRoot(nullifier);
    this.nullifierRoot.set(newNullRoot);
  }

  /**
   * Private transfer: Move funds between commitments
   */
  @method async privateTransfer(
    // Input commitment (being spent)
    inputAmount: Field,
    inputBlinding: Field,
    inputCommitment: Field,
    inputNullifier: Field,

    // Output commitment (new)
    outputAmount: Field,
    outputBlinding: Field,
    outputCommitment: Field,

    // Merkle witnesses
    inputCommitmentWitness: CommitmentWitness,
    nullifierWitness: CommitmentWitness,
    outputCommitmentWitness: CommitmentWitness
  ) {
    // Verify input commitment
    const inputComputed = Poseidon.hash([inputAmount, inputBlinding]);
    inputComputed.assertEquals(inputCommitment);

    // Verify output commitment
    const outputComputed = Poseidon.hash([outputAmount, outputBlinding]);
    outputComputed.assertEquals(outputCommitment);

    // Verify amounts balance (input = output for simplicity)
    // In real impl, would support change outputs
    inputAmount.assertEquals(outputAmount);

    // Verify nullifier
    const computedNullifier = Poseidon.hash([inputCommitment, inputBlinding]);
    computedNullifier.assertEquals(inputNullifier);

    // Update state trees
    // (Simplified - real impl needs atomic updates)
  }
}
```

---

## 3. Feasibility Assessment

### Technical Feasibility

| Aspect | Assessment | Notes |
|--------|------------|-------|
| Commitment scheme | ✅ Feasible | Poseidon native |
| Nullifier management | ✅ Feasible | Merkle trees work |
| Stealth addresses | ⚠️ Partial | Need ECDH in circuit |
| Cross-chain | ❌ Limited | Mina-only natively |
| Viewing keys | ⚠️ Complex | Encryption in circuit |

### Constraints

1. **State size limits** — Mina zkApps have limited on-chain state
2. **Transaction throughput** — ~1-2 transactions per block slot
3. **Cross-chain bridging** — Would need bridge infrastructure
4. **Ecosystem size** — Mina smaller than Ethereum/Solana

---

## 4. Comparison: zkApp vs Compression Layer

### SIP as zkApp (Approach A)

```
User (Mina)
     │
     ▼
SIP zkApp (on Mina)
     │
     ▼
Mina Settlement
```

**Pros:**
- Native Mina integration
- Simple architecture
- Access to Mina users

**Cons:**
- Mina-only
- Limited to Mina ecosystem
- Cross-chain complexity

### SIP with Compression Layer (Approach B)

```
User (Any chain)
     │
     ▼
SIP SDK (Chain-agnostic)
     │
     ▼
Halo2 Accumulator
     │
     ▼
Pickles Compression
     │
     ▼
Any Settlement Layer
```

**Pros:**
- Chain-agnostic
- Flexible settlement
- Wider market

**Cons:**
- More complex
- Higher development cost

---

## 5. Market Analysis

### Mina Ecosystem

| Metric | Value | Implication |
|--------|-------|-------------|
| Market cap | ~$800M | Medium-sized |
| Daily active | ~5K | Smaller user base |
| zkApps deployed | ~50 | Early ecosystem |
| DeFi TVL | ~$10M | Limited liquidity |

### Comparison

| Ecosystem | TVL | Users | Priority for SIP |
|-----------|-----|-------|-----------------|
| Ethereum | $50B+ | 500K+ | High |
| Solana | $5B+ | 200K+ | High (M17) |
| Mina | $10M | 5K | Medium |

### Recommendation

**Mina zkApp should be optional**, not primary focus:
- Core SIP remains chain-agnostic
- Use Pickles for compression (valuable)
- Deploy zkApp for Mina-native users (optional)

---

## 6. Implementation Roadmap (If Pursued)

### Phase 1: Basic zkApp

- [ ] Port commitment circuit to o1js
- [ ] Implement shield/unshield methods
- [ ] Deploy on Berkeley testnet
- [ ] Basic testing

**Effort:** 2-3 weeks

### Phase 2: Full Privacy

- [ ] Add private transfer
- [ ] Implement nullifier tree
- [ ] Viewing key support
- [ ] Comprehensive testing

**Effort:** 4-6 weeks

### Phase 3: Production

- [ ] Security audit
- [ ] Mainnet deployment
- [ ] Documentation
- [ ] User interface

**Effort:** 4-8 weeks

### Total Estimate: 10-17 weeks

---

## 7. Alternative: Pickles Compression Focus

### Why Compression > zkApp

1. **Wider impact** — Benefits all chains, not just Mina
2. **Core value** — Succinct proofs are universally useful
3. **Less coupling** — SIP stays chain-agnostic
4. **Lower risk** — Not dependent on Mina ecosystem growth

### Recommendation

```
PRIORITY:

1. [HIGH] Pickles compression layer
   - Wrap Halo2 proofs to ~22KB
   - Chain-agnostic output
   - Light client verification

2. [MEDIUM] Mina zkApp (optional)
   - For Mina-native users
   - Leverage compression work
   - Deploy if ecosystem grows

3. [LOW] Mina settlement
   - Not recommended currently
   - Revisit if Mina TVL grows significantly
```

---

## 8. Conclusion

### Assessment Summary

| Option | Priority | Effort | Value |
|--------|----------|--------|-------|
| Pickles compression | **HIGH** | Medium | Very High |
| Mina zkApp | Medium | High | Medium |
| Mina settlement | Low | Very High | Low |

### Final Recommendation

**Focus on Pickles compression layer (Approach B)**:
- ~22KB constant-size proofs benefit all chains
- Chain-agnostic output for maximum flexibility
- Mina zkApp can be added later if ecosystem grows

SIP should remain a **privacy standard**, not a Mina-specific application. The Pickles compression provides the key value (succinct proofs) without ecosystem lock-in.

---

## 9. Research Files Summary

Phase 2 research produced:

| File | Content |
|------|---------|
| `ARCHITECTURE.md` | Kimchi system architecture |
| `BENCHMARKS.md` | Performance analysis |
| `INTEGRATION.md` | Technical integration requirements |
| `MINA-INTEGRATION.md` | Succinct verification design |
| `ZKAPP-EXPLORATION.md` | This document |

**Phase 2 Gate Assessment: GO ✅**

> *Can we generate Kimchi proofs? Is Mina integration viable?*

**Yes.** Proceed to Phase 3 (Tachyon) and Phase 4 (Composition Feasibility).

---

## References

- [Mina zkApps Documentation](https://docs.minaprotocol.com/zkapps)
- [o1js API Reference](https://docs.minaprotocol.com/zkapps/o1js-reference)
- [Mina Architecture](https://minaprotocol.com/blog/what-are-zk-snarks)
- [Berkeley Testnet](https://docs.minaprotocol.com/node-operators/berkeley-testnet)

---

**Conclusion:** SIP as native Mina zkApp is technically feasible but not recommended as primary focus. The higher-value integration is using Pickles as a compression layer for chain-agnostic ~22KB proofs. Mina zkApp can be an optional feature for Mina-native users.
