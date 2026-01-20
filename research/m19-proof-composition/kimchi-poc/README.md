# SIP Kimchi/o1js Proof-of-Concept

**Issue:** #308 (M19-09)
**Date:** 2026-01-20
**Status:** POC Complete

---

## Overview

This POC demonstrates Kimchi proof system fundamentals using o1js (Mina's TypeScript SDK):

1. **Simple Circuit** - Basic multiplication proof
2. **Commitment Circuit** - SIP-relevant commitment verification
3. **Recursion Demo** - Pickles recursive proof composition

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
cd research/m19-proof-composition/kimchi-poc
pnpm install
```

### Run Demos

```bash
# Simple multiplication (a × b = c)
pnpm simple

# SIP commitment verification
pnpm commitment

# Recursive proof composition
pnpm recursion
```

## Architecture

```
src/
├── main.ts         # Entry point (shows usage)
├── simple.ts       # Simple multiplication circuit
├── commitment.ts   # SIP commitment verification
└── recursion.ts    # Recursive proof demo
```

## Circuits Demonstrated

### 1. Simple Circuit (`simple.ts`)

Proves: *I know `a` and `b` such that `a × b = c`*

**o1js concepts shown:**
- `ZkProgram` for circuit definition
- `Field` operations
- Proof generation with `method()`
- Verification with `verify()`

### 2. Commitment Circuit (`commitment.ts`)

Proves: *I know `amount` and `blinding` such that `Poseidon(amount, blinding) = commitment`*

**SIP relevance:**
- Demonstrates hidden amount verification
- Uses Poseidon hash (native to Kimchi)
- Includes minimum amount proof

**o1js concepts shown:**
- Custom `Struct` types
- Poseidon hashing
- Multiple methods in one ZkProgram
- Comparison assertions

### 3. Recursion Demo (`recursion.ts`)

Demonstrates Pickles recursion with a counter that increments via recursive proofs.

**Key insight:**
- `SelfProof` enables referencing previous proofs
- Each proof verifies the previous one
- Final proof attests to entire chain

**Comparison with Halo2:**

| Aspect | Halo2 Accumulation | Kimchi Pickles |
|--------|-------------------|----------------|
| Model | Accumulate, verify once | Verify in each step |
| Final size | ~1.5KB × depth | ~22KB constant |
| Verification | O(log n) amortized | O(1) constant |

## Performance (Expected)

| Operation | Time |
|-----------|------|
| Compilation (first) | 15-30s |
| Compilation (cached) | 3-5s |
| Simple proof | 5-15s |
| Commitment proof | 10-20s |
| Recursive proof | 15-45s per iteration |
| Verification | 100-500ms |

**Note:** First run includes compilation. Subsequent runs benefit from caching.

## SIP Integration Path

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIP COMPOSED PROOF                           │
│                                                                 │
│   ┌─────────────────┐  ┌─────────────────┐                     │
│   │  Noir Circuit   │  │  Halo2 Circuit  │                     │
│   │ (SIP Validity)  │  │ (Zcash Privacy) │                     │
│   └────────┬────────┘  └────────┬────────┘                     │
│            │                    │                               │
│            ▼                    ▼                               │
│   ┌──────────────────────────────────────┐                     │
│   │          HALO2 ACCUMULATOR           │                     │
│   │  (Flexible, small per-proof)         │                     │
│   └──────────────────────────────────────┘                     │
│                        │                                        │
│                        ▼                                        │
│   ┌──────────────────────────────────────┐                     │
│   │     KIMCHI/PICKLES WRAPPER           │                     │
│   │  (Constant ~22KB output)             │                     │
│   │  (This POC proves feasibility)       │                     │
│   └──────────────────────────────────────┘                     │
│                        │                                        │
│                        ▼                                        │
│   ┌──────────────────────────────────────┐                     │
│   │       LIGHT CLIENT PROOF             │                     │
│   │  • Mobile verifiable                 │                     │
│   │  • Chain-agnostic                    │                     │
│   └──────────────────────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Findings

1. **Same cryptographic foundation** - Kimchi uses same Pasta curves as Halo2
2. **Native recursion** - `SelfProof` makes recursive composition straightforward
3. **Constant-size output** - Pickles produces ~22KB regardless of depth
4. **TypeScript DX** - o1js provides accessible development experience

## Comparison: Halo2 vs Kimchi POCs

| Aspect | Halo2 POC (Rust) | Kimchi POC (o1js) |
|--------|-----------------|-------------------|
| Language | Rust | TypeScript |
| Proof size | ~1.5KB | ~22KB (Pickles) |
| Recursion | Accumulation scheme | Step/Wrap (Pickles) |
| Best for | Flexible accumulation | Constant output |
| DX | Lower-level, more control | Higher-level, easier |

## Next Steps

1. **#423** - Integrate with Mina for succinct verification
2. **#424** - Explore SIP as native Mina zkApp
3. **#417** - Halo2 + Kimchi compatibility analysis

## References

- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)
- [Kimchi Specification](https://o1-labs.github.io/proof-systems/specs/kimchi.html)
- [Pickles Overview](https://o1-labs.github.io/proof-systems/pickles/overview.html)
- [o1-labs/proof-systems](https://github.com/o1-labs/proof-systems)
