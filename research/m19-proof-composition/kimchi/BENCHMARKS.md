# Kimchi Performance Benchmarks

**Issue:** #267 (M19-07)
**Date:** 2026-01-20
**Status:** Research Complete

---

## Executive Summary

Kimchi/Pickles performance is optimized for recursive proof composition and constant-size outputs (~22KB). While direct benchmark comparisons with Halo2 are limited, both systems share similar foundations (PLONKish, IPA, Pasta curves).

**Key Findings:**
- Compilation with caching: ~3s (85% improvement)
- Verification: tens to hundreds of milliseconds
- Final proof size: ~22KB (constant via Pickles)
- Block proving target: ~30 seconds

---

## 1. Benchmark Overview

### Available Metrics (from o1-labs)

```
bench_proof_creation (Kimchi single proof):
  Instructions:     22,045,968,746
  L1 Accesses:      27,210,681,906
  L2 Accesses:      32,019,515
  RAM Accesses:     3,034,134
  Estimated Cycles: 27,476,974,171
```

### Running Benchmarks

```bash
# Clone proof-systems
git clone https://github.com/o1-labs/proof-systems
cd proof-systems

# Criterion benchmarks (time-based)
cargo criterion -p kimchi --bench proof_criterion

# IAI benchmarks (instruction-based, CI-friendly)
cargo bench -p kimchi --bench iai
```

---

## 2. o1js Compilation Performance

### With Prover Key Caching

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| First compilation | ~20s | ~20s | — |
| Subsequent compilations | ~20s | ~3s | **85%** |

Caching stores the prover key after first compilation, dramatically reducing iteration time during development.

### Compilation Process

```typescript
// o1js compilation
const { verificationKey } = await MyZkApp.compile();
// First run: ~20 seconds (builds circuit)
// Cached runs: ~3 seconds (loads prover key)
```

---

## 3. Proof Generation Estimates

### zkApp Proof Generation

Based on community reports and documentation:

| Circuit Complexity | Estimated Time | Notes |
|--------------------|----------------|-------|
| Simple (hash check) | 5-15 seconds | Browser, no recursion |
| Medium (signatures) | 15-45 seconds | Browser, 1-2 recursion levels |
| Complex (DeFi logic) | 45-120 seconds | Browser, multiple proofs |

**Note:** Exact times vary by:
- Browser vs Node.js
- Device hardware
- Circuit constraints count
- Recursion depth

### Verification Time

From Mina documentation:

> "The proof generated will always be fast to verify (on the order of tens or hundreds of milliseconds) irrespective of how complex the original computation was."

| Operation | Time Range |
|-----------|------------|
| Verification | 10-200ms |
| Final (Pickles) | ~100ms |

---

## 4. Block Production Benchmarks

### Mina Network Targets

| Metric | Current | Target (2025) |
|--------|---------|---------------|
| Block slot time | 180s | 90s |
| Block proving | ~30s | ~30s |
| SNARK workers | Parallel | Enhanced parallel |

### SNARK Worker Performance

Block producers distribute proving across multiple workers:
- Parallel SNARK worker scheme
- Can prove heavy zkApp transactions within ~30s window
- No artificial caps on zkApp transactions per block

---

## 5. Comparison with Other Systems

### PLONKish Systems Comparison

| System | Setup | Proof Size | Verification | Trusted Setup |
|--------|-------|------------|--------------|---------------|
| **Kimchi** | Minutes | ~22KB (Pickles) | ~100ms | No |
| **Halo2** | Minutes | ~1.5KB | ~5-10ms | No |
| **gnark PLONK** | Minutes | ~500B | ~3-5ms | SRS |
| **Groth16** | Minutes | ~128-192B | ~1.2ms | Yes |

### Constraint Efficiency

From benchmarks:

| Hash Function | TurboPlonk Gates | UltraPlonk (w/lookups) | Improvement |
|---------------|------------------|------------------------|-------------|
| Pedersen | 345 | 103 | 3.3x |
| SHA-256 | ~100K | ~30K | 3-4x |

### Halo2 vs Kimchi

Both use:
- Same Pasta curves (Pallas/Vesta)
- Same IPA polynomial commitments
- PLONKish arithmetization

Key differences:

| Aspect | Halo2 | Kimchi |
|--------|-------|--------|
| Recursion | Accumulation scheme | Pickles (Step/Wrap) |
| Final proof | ~1.5KB (per layer) | ~22KB (constant) |
| Custom gates | User-defined | Pre-built set (~15) |
| Target use | General ZK | Mina blockchain |

---

## 6. Memory Usage

### Estimated Requirements

| Circuit Size | Peak Memory | Notes |
|--------------|-------------|-------|
| Small (2^14) | ~500MB | Browser viable |
| Medium (2^16) | ~2GB | Needs good hardware |
| Large (2^18) | ~8GB | Server recommended |
| Mina block | ~16GB+ | Block producer |

### Memory Optimization

Kimchi/Pickles uses chunking for large circuits:
- Split large polynomials
- Recursive compression
- Final constant-size output

---

## 7. In-Browser Performance

### o1js Browser Proving

```
Browser Environment:
- Chrome/Firefox/Safari with WebAssembly
- Requires: 4GB+ RAM recommended
- Multi-core benefits from parallel proving

Typical Times:
- Simple proof: 5-20 seconds
- Complex proof: 30-120 seconds
- Verification: <1 second
```

### Browser Optimization Tips

1. **Use prover key caching** — 85% faster after first compile
2. **Minimize circuit size** — fewer constraints = faster proving
3. **Consider recursive batching** — amortize proof costs
4. **Web Worker usage** — don't block UI thread

---

## 8. Pickles Recursion Overhead

### Step vs Wrap Performance

| Operation | Relative Cost | Purpose |
|-----------|---------------|---------|
| Step proof | Higher | Application logic + verify previous |
| Wrap proof | Lower | Compression only |
| Accumulation | Efficient | Challenge aggregation |

### Recursion Depth Impact

```
Depth 1:  Base cost
Depth 2:  +~20% overhead
Depth 3:  +~35% overhead
Depth N:  Logarithmic growth (amortized)
```

The constant ~22KB output regardless of depth is the key advantage.

---

## 9. Comparison with Halo2 (SIP Context)

### For Proof Composition

| Metric | Halo2 | Kimchi/Pickles |
|--------|-------|----------------|
| Single proof size | ~1.5KB | Variable |
| Recursive final size | ~1.5KB × depth | ~22KB (constant) |
| Verification | O(log n) amortized | O(1) (Pickles) |
| Best for | Accumulating many proofs | Constant-size output |

### Recommendation for SIP

**Use Kimchi/Pickles as final aggregator:**

```
Halo2 Accumulator (flexible, small proofs)
         │
         ▼
Kimchi/Pickles Wrap (constant 22KB output)
         │
         ▼
Light Client Verification (Mina-style)
```

Benefits:
- Best of both worlds
- Flexible accumulation from Halo2
- Constant-size final proof from Pickles

---

## 10. Optimization Strategies

### For SIP Integration

1. **Design for recursion depth**
   - Plan circuit hierarchy
   - Minimize per-layer complexity

2. **Leverage lookup tables**
   - 3-4x fewer constraints for hashes
   - Built-in XOR, Range tables

3. **Use foreign field gates**
   - Verify external proofs efficiently
   - Cross-chain signature verification

4. **Cache prover keys**
   - Critical for development
   - 85% compilation time savings

5. **Batch operations**
   - Amortize fixed costs
   - Better throughput for multiple proofs

---

## 11. Benchmark Summary

```
KIMCHI/PICKLES PERFORMANCE PROFILE

Strengths:
+ Constant-size final proofs (~22KB)
+ Efficient recursion via Pickles
+ Lookup tables for constraint reduction
+ In-browser proving support
+ Prover key caching (85% faster)

Considerations:
- Larger single proof than Halo2
- Less flexible than Halo2 custom gates
- Browser proving can be slow (30-120s)
- Higher memory requirements for complex circuits

Performance Summary:
- Compilation: 3-20s (cached vs first run)
- Simple proof: 5-20s
- Complex proof: 30-120s
- Verification: 10-200ms
- Final size: ~22KB (constant)
```

---

## 12. References

- [o1-labs/proof-systems Benchmarks](https://github.com/o1-labs/proof-systems)
- [Mina Performance Roadmap](https://www.o1labs.org/blog/mina-performance-roadmap)
- [zk-Bench Comparative Evaluation](https://eprint.iacr.org/2023/1503.pdf)
- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)
- [Prover Key Caching in o1js](https://blog.o1labs.org/performance-unlock-prover-key-caching-in-o1js-08a9437c8d97)

---

**Conclusion:** Kimchi/Pickles performance is suitable for SIP's proof composition goals. While individual proofs may take longer than Halo2, the constant-size final output (~22KB) via Pickles recursion is valuable for light client verification. Recommended approach: use Halo2 for flexible accumulation, Pickles for final compression.
