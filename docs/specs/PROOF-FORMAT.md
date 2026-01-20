# PROOF-FORMAT: SIP Unified Proof Format Specification

| Field | Value |
|-------|-------|
| **SIP** | 20-07 |
| **Title** | Unified Proof Format Specification |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2026-01-20 |
| **Updated** | 2026-01-20 |
| **Requires** | SIP-6 (FUNDING-PROOF), SIP-7 (VALIDITY-PROOF), SIP-8 (FULFILLMENT-PROOF) |

## Abstract

This specification defines the SIPProof universal format that can represent zero-knowledge proofs from any supported proving system (Noir, Halo2, Kimchi, Groth16, PLONK). The format enables interoperability, consistent handling, proof composition, and cross-system verification across the SIP protocol.

## Motivation

SIP Protocol's technical moat is built on proof composition — combining proofs from multiple ZK systems into unified attestations. This requires:

1. **Interoperability**: Proofs from different systems must be handled consistently
2. **Composition**: Proofs must link together for aggregation
3. **Verification**: Format must support efficient verification across systems
4. **Persistence**: Proofs must serialize/deserialize reliably
5. **Evolution**: Format must version for future extension

The unified proof format addresses these requirements with a comprehensive, self-describing structure.

## Specification

### 1. Format Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SIPProof Universal Format                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  HEADER (Fixed 16 bytes)                                            │   │
│  │  ├─ Magic: 0x53495050 ("SIPP")                                      │   │
│  │  ├─ Version: u16                                                    │   │
│  │  ├─ Type: u8 (single=0x01, composed=0x02)                           │   │
│  │  ├─ System: u8 (noir=0x01, halo2=0x02, kimchi=0x03, ...)            │   │
│  │  ├─ Flags: u8                                                       │   │
│  │  └─ Reserved: 3 bytes                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  METADATA (Variable length)                                         │   │
│  │  ├─ Circuit ID (32 bytes, hash)                                     │   │
│  │  ├─ Circuit Version (32 bytes, hash)                                │   │
│  │  ├─ Generated At (8 bytes, timestamp)                               │   │
│  │  ├─ Expires At (8 bytes, timestamp, optional)                       │   │
│  │  └─ Target Chain ID (variable, optional)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PUBLIC INPUTS (Variable length)                                    │   │
│  │  ├─ Count: u16                                                      │   │
│  │  └─ Inputs: Field[] (32 bytes each)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  VERIFICATION KEY (Variable length, optional)                       │   │
│  │  ├─ Length: u32                                                     │   │
│  │  ├─ Key Type: u8 (embedded=0x01, reference=0x02, hash=0x03)         │   │
│  │  └─ Key Data: bytes[]                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PROOF DATA (Variable length)                                       │   │
│  │  ├─ Length: u32                                                     │   │
│  │  └─ Proof Bytes: bytes[]                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LINKING (Variable length, for composition)                         │   │
│  │  ├─ Parent IDs: bytes32[] (proofs this derives from)                │   │
│  │  ├─ Child IDs: bytes32[] (proofs derived from this)                 │   │
│  │  └─ Commitment Chain: bytes32[] (linked commitments)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  INTEGRITY (Fixed 32 bytes)                                         │   │
│  │  └─ Checksum: SHA256(all preceding bytes)                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Header Section

The header provides quick identification and routing without parsing the full proof.

#### 2.1 Binary Format

```
Offset  Size  Field        Description
------  ----  -----------  ------------------------------------------
0x00    4     magic        Magic bytes: 0x53495050 ("SIPP")
0x04    2     version      Format version (major.minor as u8.u8)
0x06    1     type         Proof type (single=0x01, composed=0x02)
0x07    1     system       Proof system identifier
0x08    1     flags        Feature flags (see 2.3)
0x09    3     reserved     Reserved for future use (must be 0x00)
0x0C    4     id           Proof ID (first 4 bytes of full 32-byte ID)
```

#### 2.2 Proof System Identifiers

| ID | System | Description |
|:--:|--------|-------------|
| `0x01` | Noir | Aztec's Noir DSL (Barretenberg backend) |
| `0x02` | Halo2 | Zcash's Halo2 proving system |
| `0x03` | Kimchi | Mina's Kimchi proving system |
| `0x04` | Groth16 | Groth16 SNARKs (various backends) |
| `0x05` | PLONK | Generic PLONK implementations |
| `0x06` | SP1 | Succinct's SP1 zkVM |
| `0x07` | RISC0 | RISC Zero zkVM |
| `0xFF` | Mock | Mock proofs for testing |

#### 2.3 Feature Flags

```
Bit  Meaning
---  -------------------------------------
0    Has verification key embedded
1    Has expiry timestamp
2    Has linking data (composition)
3    Is recursive proof
4    Has target chain ID
5    Uses compressed public inputs
6    Reserved
7    Reserved
```

### 3. Metadata Section

Metadata provides provenance and verification context.

#### 3.1 Structure

```typescript
interface ProofMetadata {
  /** The proof system that generated this proof */
  system: ProofSystem

  /** Version of the proof system (e.g., "0.32.0" for Noir) */
  systemVersion: string

  /** Circuit identifier (hash of circuit bytecode) */
  circuitId: HexString

  /** Circuit version/hash for verification */
  circuitVersion: string

  /** Timestamp when proof was generated (Unix ms) */
  generatedAt: number

  /** Optional expiry timestamp (Unix ms) */
  expiresAt?: number

  /** Size of the proof in bytes */
  proofSizeBytes: number

  /** Estimated verification cost (gas units) */
  verificationCost?: bigint

  /** Chain ID where proof is intended to be verified */
  targetChainId?: string
}
```

#### 3.2 Binary Encoding

```
Offset  Size     Field            Notes
------  -------  ---------------  --------------------------------
0x00    1        systemVersion    Length-prefixed string
var     32       circuitId        SHA256 hash
var     32       circuitVersion   SHA256 hash
var     8        generatedAt      Unix timestamp (ms)
var     8        expiresAt        Unix timestamp (ms) or 0 if none
var     4        proofSizeBytes   Proof size in bytes
var     8        verificationCost Estimated gas (optional, 0 if none)
var     1+n      targetChainId    Length-prefixed string (optional)
```

### 4. Public Inputs Section

Public inputs are the values visible to verifiers and essential for proof verification.

#### 4.1 Structure

```typescript
interface PublicInputs {
  /** Number of public inputs */
  count: number

  /** Array of field elements (32 bytes each) */
  inputs: HexString[]

  /** Optional labels for inputs (for debugging/display) */
  labels?: string[]
}
```

#### 4.2 Binary Encoding

```
Offset  Size     Field         Notes
------  -------  ------------  --------------------------------
0x00    2        count         Number of inputs (u16, max 65535)
0x02    32*n     inputs        Field elements, big-endian
```

#### 4.3 JSON Encoding

```json
{
  "publicInputs": [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000064"
  ]
}
```

### 5. Verification Key Section

The verification key enables proof verification. It can be embedded, referenced, or specified by hash.

#### 5.1 Key Types

| Type | ID | Description | Use Case |
|------|:--:|-------------|----------|
| Embedded | `0x01` | Full VK included in proof | Standalone verification |
| Reference | `0x02` | URI to retrieve VK | Size optimization |
| Hash | `0x03` | SHA256 of VK | On-chain, VK stored separately |

#### 5.2 Structure

```typescript
interface VerificationKeyData {
  /** Key type */
  type: 'embedded' | 'reference' | 'hash'

  /** Key data (raw bytes, URI, or hash) */
  data: HexString | string

  /** Key hash for integrity (always present) */
  hash: HexString

  /** Optional: VK metadata */
  metadata?: {
    circuitId: string
    curveType: string
    constraintCount: number
  }
}
```

#### 5.3 Binary Encoding

```
Offset  Size     Field         Notes
------  -------  ------------  --------------------------------
0x00    4        length        Total section length
0x04    1        keyType       0x01=embedded, 0x02=reference, 0x03=hash
0x05    32       keyHash       SHA256 of verification key
0x25    var      keyData       Raw VK bytes, URI string, or omitted
```

### 6. Proof Data Section

The raw cryptographic proof bytes.

#### 6.1 Structure

```typescript
interface ProofData {
  /** Raw proof bytes */
  proof: HexString

  /** Proof size for validation */
  size: number
}
```

#### 6.2 Binary Encoding

```
Offset  Size     Field         Notes
------  -------  ------------  --------------------------------
0x00    4        length        Proof size in bytes
0x04    n        proof         Raw proof bytes
```

#### 6.3 System-Specific Proof Sizes

| System | Typical Size | Notes |
|--------|-------------:|-------|
| Noir/BB | 2,048 - 4,096 bytes | UltraPlonk proofs |
| Halo2 | 5,000 - 10,000 bytes | Variable by circuit |
| Kimchi | 8,000 - 15,000 bytes | Includes polynomial commitments |
| Groth16 | 128 - 256 bytes | Constant size |
| PLONK | 512 - 1,024 bytes | Standard PLONK |

### 7. Linking Section (Composition)

Linking fields enable proof composition and relationship tracking.

#### 7.1 Structure

```typescript
interface ProofLinking {
  /** Unique proof ID (32 bytes) */
  id: HexString

  /** IDs of parent proofs (proofs this was derived from) */
  parentIds: HexString[]

  /** IDs of child proofs (proofs derived from this) */
  childIds: HexString[]

  /** Commitment chain for value linking */
  commitmentChain: HexString[]

  /** Nullifier (for single-use enforcement) */
  nullifier?: HexString

  /** Merkle root (for inclusion proofs) */
  merkleRoot?: HexString
}
```

#### 7.2 Proof ID Generation

Proof IDs are deterministically generated from proof content:

```typescript
function generateProofId(proof: SIPProof): HexString {
  const preimage = concat([
    proof.metadata.circuitId,
    proof.metadata.generatedAt.toString(),
    ...proof.publicInputs,
    proof.proof.slice(0, 64), // First 64 bytes of proof
  ])
  return sha256(preimage)
}
```

#### 7.3 Commitment Chain

For composed proofs, the commitment chain links input/output commitments:

```
FundingProof.outputCommitment → ValidityProof.inputCommitment
ValidityProof.outputCommitment → FulfillmentProof.inputCommitment
```

#### 7.4 Binary Encoding

```
Offset  Size     Field              Notes
------  -------  -----------------  --------------------------------
0x00    32       id                 Proof ID
0x20    1        parentCount        Number of parent IDs (max 255)
0x21    32*n     parentIds          Parent proof IDs
var     1        childCount         Number of child IDs (max 255)
var     32*n     childIds           Child proof IDs
var     1        commitmentCount    Number of commitments (max 255)
var     32*n     commitmentChain    Linked commitments
var     1        hasNullifier       0x00 or 0x01
var     32?      nullifier          If hasNullifier == 0x01
var     1        hasMerkleRoot      0x00 or 0x01
var     32?      merkleRoot         If hasMerkleRoot == 0x01
```

### 8. Integrity Section

The integrity section provides tamper detection.

#### 8.1 Checksum Computation

```typescript
function computeChecksum(proofBytes: Uint8Array): HexString {
  // Checksum covers all bytes except the final 32-byte checksum
  const dataToHash = proofBytes.slice(0, proofBytes.length - 32)
  return sha256(dataToHash)
}

function verifyChecksum(proofBytes: Uint8Array): boolean {
  const embedded = proofBytes.slice(-32)
  const computed = computeChecksum(proofBytes)
  return bytesEqual(embedded, computed)
}
```

### 9. Complete Type Definitions

#### 9.1 SingleProof (Atomic Proof)

```typescript
/**
 * A single proof from one proof system
 */
interface SingleProof {
  /** Unique identifier for this proof */
  id: string

  /** The raw proof data */
  proof: HexString

  /** Public inputs for verification */
  publicInputs: HexString[]

  /** Verification key (if needed) */
  verificationKey?: HexString

  /** Metadata about the proof */
  metadata: ProofMetadata

  /** Linking data for composition */
  linking?: ProofLinking
}
```

#### 9.2 ComposedProof (Aggregated Proof)

```typescript
/**
 * A composed proof combining multiple proofs
 */
interface ComposedProof {
  /** Unique identifier for the composed proof */
  id: string

  /** The individual proofs that were composed */
  proofs: SingleProof[]

  /** The aggregation strategy used */
  strategy: ProofAggregationStrategy

  /** Current status of the composed proof */
  status: ComposedProofStatus

  /** Aggregated proof data (if strategy produces one) */
  aggregatedProof?: HexString

  /** Combined public inputs */
  combinedPublicInputs: HexString[]

  /** Composition metadata */
  compositionMetadata: CompositionMetadata

  /** Verification hints for efficient verification */
  verificationHints: VerificationHints
}
```

#### 9.3 Aggregation Strategies

```typescript
enum ProofAggregationStrategy {
  /** Proofs are verified sequentially */
  SEQUENTIAL = 'sequential',

  /** Proofs are verified in parallel */
  PARALLEL = 'parallel',

  /** Proofs are recursively aggregated */
  RECURSIVE = 'recursive',

  /** Proofs are batched for verification */
  BATCH = 'batch'
}
```

### 10. Serialization Formats

#### 10.1 Binary Format (Recommended for Storage/Transport)

The binary format follows the structure in Section 1 exactly. It is:
- Compact (minimal overhead)
- Fast to parse
- Self-describing via header

```typescript
function serializeBinary(proof: SingleProof): Uint8Array {
  const buffer = new ArrayBuffer(calculateSize(proof))
  const view = new DataView(buffer)

  // Write header
  view.setUint32(0, 0x53495050, false) // "SIPP" magic
  view.setUint16(4, VERSION, false)
  view.setUint8(6, PROOF_TYPE_SINGLE)
  view.setUint8(7, getSystemId(proof.metadata.system))
  view.setUint8(8, computeFlags(proof))
  // ... continue with sections

  return new Uint8Array(buffer)
}

function deserializeBinary(bytes: Uint8Array): SingleProof {
  // Verify magic
  const magic = new DataView(bytes.buffer).getUint32(0, false)
  if (magic !== 0x53495050) {
    throw new Error('Invalid proof format: bad magic')
  }

  // Verify checksum
  if (!verifyChecksum(bytes)) {
    throw new Error('Invalid proof format: checksum mismatch')
  }

  // Parse sections...
  return proof
}
```

#### 10.2 JSON Format (Recommended for APIs/Debugging)

```json
{
  "format": "sip-proof-v1",
  "id": "0x1234567890abcdef...",
  "type": "single",
  "system": "noir",
  "metadata": {
    "system": "noir",
    "systemVersion": "0.32.0",
    "circuitId": "funding_proof",
    "circuitVersion": "1.0.0",
    "generatedAt": 1705747200000,
    "expiresAt": 1705833600000,
    "proofSizeBytes": 2048,
    "verificationCost": "150000",
    "targetChainId": "solana:mainnet"
  },
  "publicInputs": [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000064"
  ],
  "verificationKey": {
    "type": "hash",
    "hash": "0xabcd1234..."
  },
  "proof": "0xaabbccdd...",
  "linking": {
    "parentIds": [],
    "childIds": ["0xdeadbeef..."],
    "commitmentChain": ["0x1111...", "0x2222..."],
    "nullifier": "0x9999..."
  },
  "checksum": "0xfedcba9876543210..."
}
```

#### 10.3 Base64 Encoding (Compact JSON Transport)

For environments where binary is inconvenient but size matters:

```typescript
function toBase64Proof(proof: SingleProof): string {
  const binary = serializeBinary(proof)
  return base64Encode(binary)
}

function fromBase64Proof(encoded: string): SingleProof {
  const binary = base64Decode(encoded)
  return deserializeBinary(binary)
}
```

### 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-20 | Initial specification |

#### 11.1 Version Compatibility

- **Major version changes** (1.x → 2.x): Breaking format changes
- **Minor version changes** (1.0 → 1.1): Backwards-compatible additions

Parsers MUST:
- Reject proofs with unknown major version
- Accept proofs with higher minor version (ignore unknown fields)

### 12. Cross-System Interoperability

#### 12.1 Native Proof Conversion

When converting proofs between systems, use the UnifiedProofConverter:

```typescript
interface ProofConversionResult {
  /** Whether conversion was successful */
  success: boolean

  /** The converted proof */
  proof?: SingleProof

  /** Whether the conversion preserved all information */
  lossless: boolean

  /** Conversion warnings */
  warnings?: string[]
}

interface UnifiedProofConverter {
  /** Convert a proof to a different system's native format */
  toNative(proof: SingleProof, targetSystem: ProofSystem): ProofConversionResult

  /** Convert a native proof to SIP unified format */
  fromNative(nativeProof: unknown, sourceSystem: ProofSystem): SingleProof
}
```

#### 12.2 Conversion Matrix

| From \ To | Noir | Halo2 | Kimchi | Groth16 | PLONK |
|-----------|:----:|:-----:|:------:|:-------:|:-----:|
| **Noir** | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| **Halo2** | ⚠️ | ✅ | ❌ | ❌ | ⚠️ |
| **Kimchi** | ⚠️ | ❌ | ✅ | ❌ | ❌ |
| **Groth16** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **PLONK** | ⚠️ | ⚠️ | ❌ | ❌ | ✅ |

✅ = Lossless, ⚠️ = Lossy (metadata only), ❌ = Not supported

### 13. Security Considerations

#### 13.1 Checksum Verification

**Always** verify the checksum before processing a proof:

```typescript
function processProof(bytes: Uint8Array): SingleProof {
  // MUST verify checksum first
  if (!verifyChecksum(bytes)) {
    throw new Error('Proof integrity check failed')
  }
  return deserializeBinary(bytes)
}
```

#### 13.2 Proof ID Collision

Proof IDs are SHA256 hashes with 128-bit collision resistance. For high-security applications, verify the full proof content matches expected values.

#### 13.3 Replay Protection

Proofs with `nullifier` fields MUST NOT be accepted twice:

```typescript
const usedNullifiers = new Set<string>()

function acceptProof(proof: SingleProof): void {
  if (proof.linking?.nullifier) {
    if (usedNullifiers.has(proof.linking.nullifier)) {
      throw new Error('Proof already used (nullifier replay)')
    }
    usedNullifiers.add(proof.linking.nullifier)
  }
  // Process proof...
}
```

#### 13.4 Expiry Enforcement

```typescript
function isProofValid(proof: SingleProof): boolean {
  const now = Date.now()

  // Check expiry
  if (proof.metadata.expiresAt && proof.metadata.expiresAt < now) {
    return false
  }

  // Check not too old (default 24h max age)
  const maxAge = 24 * 60 * 60 * 1000
  if (now - proof.metadata.generatedAt > maxAge) {
    return false
  }

  return true
}
```

#### 13.5 Verification Key Trust

For `hash` type verification keys, the verifier MUST:
1. Retrieve the full VK from a trusted source
2. Verify SHA256(VK) matches the embedded hash
3. Use the retrieved VK for verification

### 14. Implementation Examples

#### 14.1 Creating a Proof

```typescript
import { ProofBuilder } from '@sip-protocol/sdk'

const proof = await ProofBuilder.create()
  .system('noir')
  .circuit('funding_proof', '1.0.0')
  .publicInputs([commitment, minimumRequired])
  .privateInputs({ balance, blindingFactor })
  .targetChain('solana:mainnet')
  .expiresIn('1h')
  .build()
```

#### 14.2 Verifying a Proof

```typescript
import { ProofVerifier } from '@sip-protocol/sdk'

const verifier = new ProofVerifier({
  providers: { noir: noirProvider, halo2: halo2Provider }
})

const result = await verifier.verify(proof)

if (result.valid) {
  console.log('Proof verified successfully')
} else {
  console.error('Verification failed:', result.error)
}
```

#### 14.3 Composing Proofs

```typescript
import { ProofAggregator } from '@sip-protocol/sdk'

const aggregator = new ProofAggregator({ strategy: 'sequential' })

const composed = await aggregator.aggregate([
  fundingProof,
  validityProof,
  fulfillmentProof
])

// Single composed proof verifies all three
const result = await verifier.verifyComposed(composed)
```

### 15. Reference Implementation

See `packages/types/src/proof-composition.ts`:
- `SingleProof` - Atomic proof type
- `ComposedProof` - Aggregated proof type
- `ProofMetadata` - Metadata structure

See `packages/sdk/src/proofs/`:
- `converters/` - Format conversion implementations
- `composer/` - Proof composition logic
- `providers/` - System-specific providers

### 16. Test Vectors

#### 16.1 Valid SingleProof (Noir)

```json
{
  "id": "0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd",
  "system": "noir",
  "metadata": {
    "system": "noir",
    "systemVersion": "0.32.0",
    "circuitId": "funding_proof",
    "circuitVersion": "1.0.0",
    "generatedAt": 1705747200000,
    "proofSizeBytes": 256
  },
  "publicInputs": [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000064"
  ],
  "proof": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

#### 16.2 Binary Header (Hex)

```
53 49 50 50  // Magic: "SIPP"
01 00        // Version: 1.0
01           // Type: single
01           // System: noir
03           // Flags: has VK + has expiry
00 00 00     // Reserved
a1 b2 c3 d4  // ID (first 4 bytes)
```

## References

1. [PROOF-COMPOSITION-ARCHITECTURE.md](./PROOF-COMPOSITION-ARCHITECTURE.md) - Architecture design
2. [PROOF-COMPOSITION-RESEARCH.md](./PROOF-COMPOSITION-RESEARCH.md) - Feasibility research
3. [Noir Language Documentation](https://noir-lang.org/docs)
4. [Halo2 Book](https://zcash.github.io/halo2/)
5. [Mina Kimchi Documentation](https://o1-labs.github.io/proof-systems/)

## Copyright

This specification is released under the MIT License.
