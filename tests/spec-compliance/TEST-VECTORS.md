# SIP-EIP Compliance Test Vectors

**Version:** 1.0.0
**Last Updated:** 2026-01-20
**Spec Version:** SIP-EIP Draft 1.0.0

---

## Overview

This document describes the language-agnostic test vector format for SIP-EIP compliance testing. Any implementation (TypeScript, Rust, Go, Python, etc.) can use these vectors to verify spec conformance.

**Test Vector Files:**
- `stealth-addresses.json` - Stealth address operations (50+ vectors)
- `commitments.json` - Pedersen commitment operations (50+ vectors)
- `viewing-keys.json` - Viewing key operations (30+ vectors)
- `intents.json` - ShieldedIntent serialization vectors
- `errors.json` - Expected error conditions

---

## 1. Test Vector Format

### 1.1 General Structure

All test vector files follow this structure:

```json
{
  "version": "1.0.0",
  "spec_version": "SIP-EIP Draft 1.0.0",
  "generated": "2026-01-20T00:00:00Z",
  "description": "Test vectors for [operation]",
  "vectors": [
    {
      "id": "unique-identifier",
      "description": "Human-readable description",
      "input": { /* operation-specific inputs */ },
      "expected": { /* expected outputs */ },
      "valid": true
    }
  ]
}
```

### 1.2 Data Encoding

| Type | Encoding | Example |
|------|----------|---------|
| Bytes (fixed) | Hex with 0x prefix | `"0x0123456789abcdef"` |
| Bytes (variable) | Hex with 0x prefix | `"0x..."` |
| BigInt | Decimal string | `"1000000000000000000"` |
| Points (compressed) | 33-byte hex | `"0x02..."` or `"0x03..."` |
| Points (uncompressed) | 65-byte hex | `"0x04..."` |
| Addresses | Chain-specific | `"0x..."` (ETH), Base58 (SOL) |

### 1.3 Deterministic Randomness

For reproducible tests, "random" values are derived deterministically:

```
random_bytes(n, seed) = SHA256(seed ‖ counter)[0:n]
```

Test vectors specify the seed and counter used.

---

## 2. Stealth Address Test Vectors

### 2.1 Format

```json
{
  "id": "stealth-001",
  "description": "Basic stealth address generation",
  "input": {
    "chain": "ethereum",
    "spending_private_key": "0x...",
    "viewing_private_key": "0x...",
    "ephemeral_private_key": "0x..."
  },
  "expected": {
    "spending_public_key": "0x02...",
    "viewing_public_key": "0x03...",
    "meta_address": "sip:ethereum:0x02...:0x03...",
    "stealth_address": "0x...",
    "ephemeral_public_key": "0x02...",
    "shared_secret": "0x..."
  },
  "valid": true
}
```

### 2.2 Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| Basic generation | 10 | Standard stealth address generation |
| Key derivation | 10 | Spending key derivation from stealth |
| Address scanning | 10 | Check if address belongs to wallet |
| Multi-chain | 10 | Different chain encodings |
| Edge cases | 5 | Boundary conditions |
| Invalid inputs | 5 | Expected error cases |

### 2.3 Key Operations Tested

1. **Meta-address encoding** (`encodeStealthMetaAddress`)
2. **Meta-address parsing** (`decodeStealthMetaAddress`)
3. **Stealth address generation** (`generateStealthAddress`)
4. **Address scanning** (`checkStealthAddress`)
5. **Private key derivation** (`deriveStealthPrivateKey`)

---

## 3. Commitment Test Vectors

### 3.1 Format

```json
{
  "id": "commit-001",
  "description": "Basic Pedersen commitment",
  "input": {
    "value": "100",
    "blinding_factor": "0x..."
  },
  "expected": {
    "commitment": "0x02...",
    "verification": true
  },
  "valid": true
}
```

### 3.2 Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| Basic commitment | 10 | Standard C = v·G + r·H |
| Zero value | 5 | C = r·H (v = 0) |
| Large values | 5 | Near curve order |
| Verification | 10 | Opening verification |
| Homomorphic add | 10 | C1 + C2 = C(v1+v2) |
| Homomorphic sub | 5 | C1 - C2 = C(v1-v2) |
| Invalid inputs | 5 | Expected errors |

### 3.3 Key Operations Tested

1. **Commitment creation** (`createCommitment`)
2. **Commitment verification** (`verifyCommitment`)
3. **Homomorphic addition** (`addCommitments`)
4. **Homomorphic subtraction** (`subtractCommitments`)
5. **Blinding arithmetic** (`addBlindings`, `subtractBlindings`)

---

## 4. Viewing Key Test Vectors

### 4.1 Format

```json
{
  "id": "viewing-001",
  "description": "Incoming viewing key generation",
  "input": {
    "master_private_key": "0x...",
    "key_type": "incoming"
  },
  "expected": {
    "viewing_key": "0x...",
    "viewing_public_key": "0x02...",
    "key_hash": "0x..."
  },
  "valid": true
}
```

### 4.2 Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| Key generation | 10 | All three key types |
| Key derivation | 5 | Deterministic derivation |
| Encryption | 5 | XChaCha20-Poly1305 |
| Decryption | 5 | Successful decryption |
| Key hash | 5 | SHA-256 of key bytes |

### 4.3 Key Operations Tested

1. **Key generation** (`generateViewingKey`)
2. **Key derivation** (`deriveViewingKey`)
3. **Encryption** (`encryptForViewer`)
4. **Decryption** (`decryptWithViewingKey`)
5. **Hash computation** (`computeViewingKeyHash`)

---

## 5. Error Test Vectors

### 5.1 Format

```json
{
  "id": "error-001",
  "description": "Invalid stealth meta-address format",
  "operation": "decodeStealthMetaAddress",
  "input": {
    "meta_address": "invalid:format"
  },
  "expected_error": {
    "code": "SIP_ERR_0200",
    "type": "INVALID_STEALTH_META_ADDRESS"
  },
  "valid": false
}
```

### 5.2 Error Categories

| Error Code | Category | Tests |
|------------|----------|-------|
| `SIP_ERR_0100` | Invalid input | 3 |
| `SIP_ERR_0200` | Stealth address | 5 |
| `SIP_ERR_0300` | Commitment | 5 |
| `SIP_ERR_0400` | Viewing key | 3 |
| `SIP_ERR_0500` | Privacy level | 2 |

---

## 6. Running Compliance Tests

### 6.1 TypeScript

```typescript
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import * as sip from '@sip-protocol/sdk'

const vectors = JSON.parse(readFileSync('vectors/stealth-addresses.json', 'utf-8'))

describe('SIP-EIP Stealth Address Compliance', () => {
  for (const vector of vectors.vectors) {
    it(vector.description, () => {
      if (vector.valid) {
        const result = sip.generateStealthAddress(
          vector.input.spending_public_key,
          vector.input.viewing_public_key,
          vector.input.ephemeral_private_key
        )
        expect(result.stealthAddress).toBe(vector.expected.stealth_address)
        expect(result.ephemeralPublicKey).toBe(vector.expected.ephemeral_public_key)
      } else {
        expect(() => {
          sip.generateStealthAddress(/* invalid inputs */)
        }).toThrow(vector.expected_error.code)
      }
    })
  }
})
```

### 6.2 Rust

```rust
use serde::Deserialize;
use sip_protocol::stealth::*;

#[derive(Deserialize)]
struct TestVector {
    id: String,
    description: String,
    input: Input,
    expected: Expected,
    valid: bool,
}

#[test]
fn test_stealth_compliance() {
    let vectors: Vec<TestVector> = serde_json::from_str(
        include_str!("vectors/stealth-addresses.json")
    ).unwrap();

    for vector in vectors {
        if vector.valid {
            let result = generate_stealth_address(/* inputs */);
            assert_eq!(result.stealth_address, vector.expected.stealth_address);
        }
    }
}
```

### 6.3 Go

```go
package sip_test

import (
    "encoding/json"
    "os"
    "testing"
    sip "github.com/sip-protocol/sip-go"
)

func TestStealthCompliance(t *testing.T) {
    data, _ := os.ReadFile("vectors/stealth-addresses.json")
    var suite TestSuite
    json.Unmarshal(data, &suite)

    for _, vector := range suite.Vectors {
        t.Run(vector.Description, func(t *testing.T) {
            if vector.Valid {
                result := sip.GenerateStealthAddress(/* inputs */)
                if result.Address != vector.Expected.StealthAddress {
                    t.Errorf("expected %s, got %s",
                        vector.Expected.StealthAddress, result.Address)
                }
            }
        })
    }
}
```

---

## 7. Test Vector Validation

### 7.1 Self-Consistency Checks

Every test vector file includes self-consistency checks:

1. **Commitment verification**: All commitments verify with their values/blindings
2. **Stealth scanning**: All stealth addresses pass scanning check
3. **Encryption roundtrip**: Encrypted data decrypts to original

### 7.2 Cross-Implementation Validation

Vectors are validated against:
- TypeScript SDK (`@sip-protocol/sdk`)
- Rust crate (`sip-protocol`)
- Go module (when available)

### 7.3 Generating New Vectors

```bash
# TypeScript
npx ts-node scripts/generate-vectors.ts

# Rust
cargo run --example generate-vectors
```

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-20 | Initial release with 130+ vectors |

---

## Appendix A: Generator Points

For reference, the generator points used:

**G (secp256k1 base point):**
```
x = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
y = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
```

**H (SIP Pedersen generator):**
```
Derived from: SHA256("SIP-PEDERSEN-GENERATOR-H-v1" ‖ counter)
First valid point at counter = [implementation dependent]
```

---

## Appendix B: Test Seeds

Deterministic seeds used for "random" values:

| Seed | Purpose |
|------|---------|
| `"sip-test-stealth-001"` | Stealth address vectors |
| `"sip-test-commit-001"` | Commitment vectors |
| `"sip-test-viewing-001"` | Viewing key vectors |

---

*These test vectors are canonical. Any deviation indicates a non-compliant implementation.*
