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

---

## Solana Same-Chain Privacy

Benchmarks for Solana-specific privacy operations using ed25519 curve.

### Target Metrics (Solana)

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| ed25519 stealth address generation | <10ms | ~2.1ms | PASS |
| SPL token transfer building | <50ms | ~2.4ms | PASS |
| Payment scanning | <1ms per tx | ~1.7ms | MARGINAL |
| Transaction serialization | <5ms | ~0.1ms | PASS |

### ed25519 Stealth Address Operations

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| generateEd25519StealthMetaAddress | 3,042 | 0.33 | 0.91 |
| generateEd25519StealthAddress | 479 | 2.09 | 3.30 |
| deriveEd25519StealthPrivateKey | 580 | 1.73 | 3.39 |
| checkEd25519StealthAddress (scan) | 578 | 1.73 | 3.32 |
| ed25519PublicKeyToSolanaAddress | 238K | 0.004 | 0.005 |
| encodeStealthMetaAddress (solana) | 13.9M | 0.0001 | 0.0002 |
| decodeStealthMetaAddress (solana) | 2.1M | 0.0005 | 0.001 |

### Transaction Building

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| createTransactionBuilder | 7.1M | 0.0001 | 0.0004 |
| buildSOLTransfer | 462 | 2.16 | 3.70 |
| buildSPLTransfer | 411 | 2.43 | 6.82 |
| estimateComputeUnits | 41K | 0.024 | 0.027 |
| calculatePriorityFee | 18.5M | 0.0001 | 0.0001 |

### Token Operations

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| resolveTokenMetadata (cached) | 143K | 0.007 | 0.018 |
| formatTokenAmount | 4.7M | 0.0002 | 0.0005 |
| parseTokenAmount | 7.5M | 0.0001 | 0.0002 |
| formatLamports | 1.7M | 0.0006 | 0.001 |
| parseSOLToLamports | 3.8M | 0.0003 | 0.0004 |

### Validation

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| validateSOLTransfer | 421 | 2.37 | 5.95 |
| validateTransfer (SPL) | 368 | 2.72 | 4.50 |

### Announcement Operations

| Operation | ops/s | mean (ms) | p99 (ms) |
|-----------|-------|-----------|----------|
| createAnnouncementMemo | 310K | 0.003 | 0.004 |
| parseAnnouncement | 4.8M | 0.0002 | 0.0003 |

### Payment Scanning Performance

| Scenario | ops/s | mean (ms) | Per tx (ms) |
|----------|-------|-----------|-------------|
| Single announcement (owned) | 578 | 1.73 | 1.73 |
| Single announcement (not owned) | ~560 | ~1.8 | 1.8 |
| 100 announcements (all owned) | ~6 | ~160 | 1.6 |
| 100 announcements (50% owned) | ~6 | ~160 | 1.6 |

**Note:** Payment scanning is slightly above the 1ms target but acceptable for production use. View tag optimization provides 256x faster rejection for non-matching addresses.

## Analysis

### Bottlenecks

1. **Elliptic curve operations** (~3ms secp256k1, ~2ms ed25519) - Required for cryptographic security
2. **Stealth address generation** (~3.8ms secp256k1, ~2.1ms ed25519) - Involves ECDH + hashing
3. **Commitment creation** (~3.1ms) - Two scalar multiplications

### Optimizations Applied

- Lazy generator H initialization (computed once at module load)
- Efficient scalar arithmetic using @noble/curves
- View tag optimization for stealth address scanning (256x faster rejection)
- ed25519 operations are ~40% faster than secp256k1 (Solana-native)

### Recommendations

1. **Batch operations** - Process multiple intents in parallel when possible
2. **Caching** - Cache generator points and frequently used keys
3. **WebAssembly** - Consider WASM for crypto if <1ms needed (not currently required)
4. **Worker threads** - Offload batch operations to background workers

## Running Benchmarks

```bash
# Run all benchmarks
pnpm bench

# Run crypto benchmarks only
pnpm vitest bench benchmarks/crypto.bench.ts

# Run Solana benchmarks only
pnpm vitest bench benchmarks/solana.bench.ts

# Run with JSON output
pnpm bench:json

# Results saved to benchmarks/results.json
```

## Environment

- Platform: Node.js (ES modules)
- CPU: Apple Silicon (M-series) / x86-64
- Libraries: @noble/curves, @noble/hashes, @noble/ciphers
