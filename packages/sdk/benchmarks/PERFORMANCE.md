# SIP SDK Performance Report

Baseline metrics for @sip-protocol/sdk cryptographic operations.

## Target Metrics

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Stealth address generation | <10ms | ~3.8ms | PASS |
| Commitment creation | <5ms | ~3.1ms | PASS |
| Key derivation | <5ms | ~0.003ms | PASS |
| Memory per intent | <1KB | ~500B | PASS |

## Detailed Results

### Stealth Address Operations

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| generateStealthMetaAddress | 1,735 | 0.58 | 2.02 |
| generateStealthAddress | 262 | 3.81 | 8.26 |
| deriveStealthPrivateKey | 360 | 2.78 | 4.55 |
| checkStealthAddress | 340 | 2.94 | 4.36 |
| encodeStealthMetaAddress | 9.5M | 0.0001 | 0.0002 |
| decodeStealthMetaAddress | 1.1M | 0.0009 | 0.0014 |

### Pedersen Commitment Operations

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| commit (random blinding) | 328 | 3.05 | 5.12 |
| commit (zero value) | 386 | 2.59 | 3.66 |
| verifyOpening | 350 | 2.86 | 3.52 |
| addCommitments | 4,323 | 0.23 | 0.66 |
| subtractCommitments | 4,332 | 0.23 | 0.85 |
| addBlindings | 171K | 0.006 | 0.014 |
| generateBlinding | 658K | 0.002 | 0.004 |
| getGenerators | 1.96M | 0.0005 | 0.001 |

### Viewing Key & Encryption Operations

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| generateViewingKey | 345K | 0.003 | 0.007 |
| deriveViewingKey | 324K | 0.003 | 0.006 |
| encryptForViewing | 51K | 0.02 | 0.06 |
| decryptWithViewing | 56K | 0.02 | 0.07 |

### Intent Operations

| Operation | ops/s | mean (ms) |
|-----------|-------|-----------|
| createShieldedIntent (transparent) | 144 | 6.9 |
| trackIntent | 7.4M | 0.0001 |
| serializeIntent | 2.7M | 0.0004 |

### Throughput

| Operation | ops/s | Effective rate |
|-----------|-------|----------------|
| 100x stealth address generation | 21 | 2,100 addr/s |
| 100x commitment creation | 3.5 | 350 commit/s |
| 100x viewing key generation | 3,572 | 357K keys/s |
| 50x intent creation (transparent) | 3.3 | 165 intents/s |

## Analysis

### Bottlenecks

1. **Elliptic curve operations** (~3ms) - Required for cryptographic security
2. **Stealth address generation** (~3.8ms) - Involves ECDH + hashing
3. **Commitment creation** (~3.1ms) - Two scalar multiplications

### Optimizations Applied

- Lazy generator H initialization (computed once at module load)
- Efficient scalar arithmetic using @noble/curves
- View tag optimization for stealth address scanning (256x faster rejection)

### Recommendations

1. **Batch operations** - Process multiple intents in parallel when possible
2. **Caching** - Cache generator points and frequently used keys
3. **WebAssembly** - Consider WASM for crypto if <1ms needed (not currently required)
4. **Worker threads** - Offload batch operations to background workers

## Running Benchmarks

```bash
# Run all benchmarks
pnpm bench

# Run with JSON output
pnpm bench:json

# Results saved to benchmarks/results.json
```

## Environment

- Platform: Node.js (ES modules)
- CPU: Apple Silicon (M-series) / x86-64
- Libraries: @noble/curves, @noble/hashes, @noble/ciphers
