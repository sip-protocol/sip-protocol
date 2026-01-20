# SIP-001: Core Protocol Specification

```
SIP: 001
Title: Shielded Intents Protocol - Core Specification
Author: SIP Protocol Team <team@sip-protocol.org>
Status: Draft
Type: Standards Track
Category: Core
Created: 2026-01-21
Requires: SIP-002, SIP-003
```

## Abstract

This SIP defines the Shielded Intents Protocol (SIP), a privacy-preserving transaction standard for blockchain networks. SIP enables transactions where sender identity, recipient identity, and transaction amounts are cryptographically hidden while maintaining selective disclosure capabilities for compliance through viewing keys.

## Motivation

Current blockchain transactions are fully transparent, exposing:

1. **Sender addresses** - Linking all transactions to a single identity
2. **Recipient addresses** - Revealing counterparty relationships
3. **Transaction amounts** - Exposing financial positions and strategies

This transparency creates significant problems:

- **Front-running**: Adversaries can observe and exploit pending transactions
- **Privacy violations**: Financial histories are publicly accessible
- **Regulatory concerns**: Organizations cannot comply with privacy regulations (GDPR, financial privacy laws)
- **Security risks**: Wealthy addresses become targets for attacks

Existing privacy solutions (mixers, zero-knowledge rollups) lack:

- Selective disclosure for compliance
- Cross-chain interoperability
- Standardized interfaces for wallet/application integration

SIP addresses these gaps by providing a unified privacy standard with built-in compliance capabilities.

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

### 1. Protocol Overview

SIP operates through three core cryptographic primitives:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIP PROTOCOL STACK                           │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Viewing Keys (Selective Disclosure)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Encrypted viewing capabilities for authorized parties   │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Pedersen Commitments (Amount Hiding)                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Homomorphic commitments: C = v·G + r·H                  │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Stealth Addresses (Recipient Privacy)                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ One-time addresses derived from meta-address            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Data Types

#### 2.1 Primitive Types

```typescript
// 32-byte hex string with 0x prefix
type HexString32 = `0x${string}` // length: 66 characters

// 33-byte compressed public key with 0x prefix
type CompressedPublicKey = `0x${string}` // length: 68 characters

// Privacy level enum
type PrivacyLevel = 'transparent' | 'shielded' | 'compliant'

// Chain identifier
type ChainId =
  | 'ethereum' | 'solana' | 'near' | 'bitcoin'
  | 'polygon' | 'arbitrum' | 'optimism' | 'base'
  | 'avalanche' | 'bsc' | 'cosmos' | 'sui' | 'aptos'

// Elliptic curve identifier
type CurveType = 'secp256k1' | 'ed25519' | 'bn254'
```

#### 2.2 Core Structures

```typescript
interface StealthMetaAddress {
  chain: ChainId
  spendingPublicKey: CompressedPublicKey
  viewingPublicKey: CompressedPublicKey
}

interface StealthAddress {
  address: HexString32
  ephemeralPublicKey: CompressedPublicKey
  viewTag: number  // 1-byte view tag for scanning optimization
}

interface PedersenCommitment {
  value: CompressedPublicKey      // C = v·G + r·H
  blindingFactor: HexString32     // r (private)
}

interface ViewingKey {
  type: 'incoming' | 'outgoing' | 'full'
  privateKey: HexString32
  publicKey: CompressedPublicKey
}

interface ShieldedIntent {
  version: 1
  privacyLevel: PrivacyLevel
  sender: {
    commitment: PedersenCommitment  // Hidden sender info
    proof?: ZKProof                 // Optional ZK proof
  }
  recipient: {
    stealthAddress: StealthAddress
    encryptedMemo?: HexString32     // Optional encrypted metadata
  }
  amount: {
    commitment: PedersenCommitment  // Hidden amount
    rangeProof?: ZKProof            // Proof amount is in valid range
  }
  viewingKeyHash?: HexString32      // For compliance discovery
  timestamp: number
  nonce: HexString32
  signature: HexString32
}
```

### 3. Cryptographic Parameters

#### 3.1 Elliptic Curve Parameters

SIP supports multiple curves for cross-chain compatibility:

**secp256k1** (Ethereum, Bitcoin):
```
p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
     0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)
H = SHA256("SIP-Pedersen-H") → point  // Nothing-up-my-sleeve generator
```

**ed25519** (Solana, NEAR):
```
p = 2^255 - 19
n = 2^252 + 27742317777372353535851937790883648493
G = (15112221349535807912866137220509078935008241517919484311080070612873
     4030447602100559854592198127747774949637896237932636612081919907154759,
     46316835694926478169428394003475163141307993866256225615783033603165251
     855960)
H = SHA512("SIP-Pedersen-H-ed25519") → point
```

#### 3.2 Hash Functions

| Purpose | Algorithm | Output Size |
|---------|-----------|-------------|
| Key derivation | SHA-256 | 32 bytes |
| Commitment blinding | SHA-256 | 32 bytes |
| View tag generation | SHA-256[0] | 1 byte |
| Viewing key hash | SHA-256 | 32 bytes |
| Nonce generation | ChaCha20-RNG | 32 bytes |

#### 3.3 Encryption Parameters

```
Algorithm: XChaCha20-Poly1305
Key size: 256 bits
Nonce size: 192 bits (24 bytes)
Tag size: 128 bits (16 bytes)
```

### 4. Protocol Operations

#### 4.1 Meta-Address Generation

Recipients MUST generate a stealth meta-address for receiving private payments:

```
FUNCTION generateMetaAddress(seed: bytes) -> StealthMetaAddress:
    // Derive spending and viewing keys from seed
    spendingPrivateKey = HKDF(seed, "sip-spending", 32)
    viewingPrivateKey = HKDF(seed, "sip-viewing", 32)

    spendingPublicKey = spendingPrivateKey * G
    viewingPublicKey = viewingPrivateKey * G

    RETURN {
        chain: detectChain(seed),
        spendingPublicKey: compress(spendingPublicKey),
        viewingPublicKey: compress(viewingPublicKey)
    }
```

#### 4.2 Stealth Address Derivation

Senders MUST derive a one-time stealth address for each transaction:

```
FUNCTION deriveStealthAddress(
    metaAddress: StealthMetaAddress,
    ephemeralPrivateKey: bytes32
) -> StealthAddress:

    // Ephemeral key pair
    R = ephemeralPrivateKey * G

    // Shared secret via ECDH
    S = ephemeralPrivateKey * metaAddress.viewingPublicKey

    // Derive stealth address
    sharedSecretHash = SHA256(compress(S))
    stealthPrivateKey = sharedSecretHash + metaAddress.spendingPublicKey
    stealthAddress = stealthPrivateKey * G

    // View tag for efficient scanning
    viewTag = SHA256(compress(S))[0]

    RETURN {
        address: hash(compress(stealthAddress)),
        ephemeralPublicKey: compress(R),
        viewTag: viewTag
    }
```

#### 4.3 Pedersen Commitment Creation

Amounts MUST be committed using Pedersen commitments:

```
FUNCTION createCommitment(
    value: uint256,
    blindingFactor?: bytes32
) -> PedersenCommitment:

    // Generate random blinding factor if not provided
    IF blindingFactor IS NULL:
        blindingFactor = randomBytes(32)

    // Pedersen commitment: C = v*G + r*H
    commitment = (value * G) + (blindingFactor * H)

    RETURN {
        value: compress(commitment),
        blindingFactor: blindingFactor
    }
```

#### 4.4 Commitment Verification

```
FUNCTION verifyCommitment(
    commitment: PedersenCommitment,
    claimedValue: uint256
) -> boolean:

    // Recompute commitment
    expectedCommitment = (claimedValue * G) + (commitment.blindingFactor * H)

    RETURN compress(expectedCommitment) == commitment.value
```

#### 4.5 Shielded Intent Creation

```
FUNCTION createShieldedIntent(
    sender: KeyPair,
    recipientMetaAddress: StealthMetaAddress,
    amount: uint256,
    privacyLevel: PrivacyLevel
) -> ShieldedIntent:

    // Generate ephemeral key for stealth address
    ephemeralPrivateKey = randomBytes(32)

    // Derive recipient stealth address
    stealthAddress = deriveStealthAddress(
        recipientMetaAddress,
        ephemeralPrivateKey
    )

    // Create amount commitment
    amountCommitment = createCommitment(amount)

    // Create sender commitment (hides sender identity)
    senderCommitment = createCommitment(
        hash(sender.publicKey),
        randomBytes(32)
    )

    // Viewing key hash for compliance discovery
    viewingKeyHash = NULL
    IF privacyLevel == 'compliant':
        viewingKeyHash = SHA256(recipientMetaAddress.viewingPublicKey)

    // Build intent
    intent = {
        version: 1,
        privacyLevel: privacyLevel,
        sender: {
            commitment: senderCommitment
        },
        recipient: {
            stealthAddress: stealthAddress
        },
        amount: {
            commitment: amountCommitment
        },
        viewingKeyHash: viewingKeyHash,
        timestamp: currentTimestamp(),
        nonce: randomBytes(32)
    }

    // Sign intent
    intentHash = SHA256(serialize(intent))
    intent.signature = sign(sender.privateKey, intentHash)

    RETURN intent
```

#### 4.6 Intent Scanning

Recipients MUST scan for incoming payments:

```
FUNCTION scanForPayments(
    viewingPrivateKey: bytes32,
    spendingPublicKey: CompressedPublicKey,
    intents: ShieldedIntent[]
) -> Payment[]:

    payments = []

    FOR intent IN intents:
        // Quick check using view tag
        R = intent.recipient.stealthAddress.ephemeralPublicKey
        S = viewingPrivateKey * decompress(R)
        expectedViewTag = SHA256(compress(S))[0]

        IF expectedViewTag != intent.recipient.stealthAddress.viewTag:
            CONTINUE  // Not for us, skip

        // Full check - derive expected stealth address
        sharedSecretHash = SHA256(compress(S))
        expectedStealthPubKey = sharedSecretHash * G + decompress(spendingPublicKey)
        expectedAddress = hash(compress(expectedStealthPubKey))

        IF expectedAddress == intent.recipient.stealthAddress.address:
            // This payment is for us
            payment = {
                intent: intent,
                stealthPrivateKey: sharedSecretHash + spendingPrivateKey,
                // Amount revealed if we have viewing key
            }
            payments.push(payment)

    RETURN payments
```

### 5. Privacy Levels

SIP defines three privacy levels:

| Level | Sender | Amount | Recipient | Viewing Key |
|-------|--------|--------|-----------|-------------|
| `transparent` | Visible | Visible | Visible | Not used |
| `shielded` | Hidden | Hidden | Hidden | Optional |
| `compliant` | Hidden | Hidden | Hidden | Required |

#### 5.1 Transparent Mode

- Standard blockchain transaction
- No cryptographic privacy
- Used for interoperability testing

#### 5.2 Shielded Mode

- Full privacy for all participants
- No compliance mechanism
- Suitable for privacy-focused applications

#### 5.3 Compliant Mode

- Full privacy with selective disclosure
- Viewing key hash published on-chain
- Auditors can request viewing key from recipient
- Suitable for institutional and regulated applications

### 6. Viewing Key Disclosure Protocol

For compliant transactions, viewing keys enable selective disclosure:

```
FUNCTION discloseTo(
    viewingPrivateKey: bytes32,
    auditorPublicKey: CompressedPublicKey
) -> EncryptedViewingKey:

    // ECDH with auditor
    sharedSecret = viewingPrivateKey * decompress(auditorPublicKey)
    encryptionKey = SHA256(compress(sharedSecret))

    // Encrypt viewing key
    nonce = randomBytes(24)
    ciphertext = XChaCha20Poly1305.encrypt(
        encryptionKey,
        nonce,
        viewingPrivateKey
    )

    RETURN {
        ephemeralPublicKey: viewingPrivateKey * G,
        nonce: nonce,
        ciphertext: ciphertext
    }
```

### 7. Message Formats

#### 7.1 Meta-Address Format (URI)

```
sip:<chain>:<spendingKey>:<viewingKey>

Example:
sip:ethereum:0x02abc123...def:0x03def456...abc
sip:solana:0x02abc123...def:0x03def456...abc
```

#### 7.2 Intent Serialization

Intents MUST be serialized using the following canonical format:

```
intent_bytes =
    version (1 byte) ||
    privacy_level (1 byte) ||
    sender_commitment (33 bytes) ||
    recipient_stealth_address (32 bytes) ||
    recipient_ephemeral_pubkey (33 bytes) ||
    recipient_view_tag (1 byte) ||
    amount_commitment (33 bytes) ||
    viewing_key_hash (32 bytes, or 0x00...00 if null) ||
    timestamp (8 bytes, big-endian) ||
    nonce (32 bytes) ||
    signature (64 bytes)
```

Total: 270 bytes (fixed size)

### 8. Security Considerations

#### 8.1 Cryptographic Assumptions

SIP security relies on:

1. **Discrete Logarithm Problem (DLP)**: Computing private key from public key is infeasible
2. **Decisional Diffie-Hellman (DDH)**: ECDH shared secrets are indistinguishable from random
3. **Collision Resistance**: SHA-256 collision resistance for commitment binding

#### 8.2 Known Attacks and Mitigations

| Attack | Description | Mitigation |
|--------|-------------|------------|
| Timing attack | Key operations leak timing info | Constant-time implementations required |
| Replay attack | Reusing old intents | Unique nonces, timestamp validation |
| Front-running | Observing pending intents | Encrypted mempool submission |
| Amount correlation | Linking by transaction amounts | Pedersen commitments hide amounts |
| Address reuse | Same stealth address used twice | Fresh ephemeral keys per transaction |

#### 8.3 Implementation Requirements

Implementations MUST:

1. Use constant-time comparison for all cryptographic operations
2. Zeroize sensitive data after use
3. Use cryptographically secure random number generators
4. Validate all public keys are on the curve
5. Reject points at infinity

#### 8.4 Privacy Guarantees

**What SIP hides:**
- Sender identity (via commitment)
- Recipient identity (via stealth address)
- Transaction amount (via Pedersen commitment)
- Transaction linkability (fresh addresses per tx)

**What SIP does NOT hide:**
- Transaction timing
- Transaction existence
- Chain/network used
- Transaction size (fixed 270 bytes)

### 9. Backwards Compatibility

#### 9.1 EIP-5564 Compatibility

SIP stealth addresses are compatible with EIP-5564:

- Same ECDH-based derivation
- Compatible meta-address format
- View tag optimization supported

#### 9.2 ERC-6538 Compatibility

SIP viewing keys are compatible with ERC-6538 stealth meta-address registry:

- Viewing public keys can be registered
- Announcement format is compatible

### 10. Reference Implementation

Reference implementation available at:
- TypeScript SDK: `@sip-protocol/sdk`
- GitHub: https://github.com/sip-protocol/sip-protocol

```typescript
import {
  generateMetaAddress,
  deriveStealthAddress,
  createCommitment,
  createShieldedIntent,
  scanForPayments
} from '@sip-protocol/sdk'

// Generate recipient meta-address
const recipient = generateMetaAddress(seed)
// -> sip:ethereum:0x02abc...123:0x03def...456

// Create shielded payment
const intent = createShieldedIntent({
  sender: senderKeyPair,
  recipient: recipient,
  amount: 1000000n,  // 1 USDC (6 decimals)
  privacyLevel: 'compliant'
})

// Recipient scans for payments
const payments = await scanForPayments({
  viewingPrivateKey: recipient.viewingPrivateKey,
  spendingPublicKey: recipient.spendingPublicKey,
  intents: allIntents
})
```

### 11. Test Vectors

See [SIP-001 Test Vectors](./test-vectors/SIP-001-VECTORS.md) for comprehensive test cases.

### 12. Appendix

#### A. Notation

| Symbol | Description |
|--------|-------------|
| G | Generator point of elliptic curve |
| H | Secondary generator for Pedersen commitments |
| * | Scalar multiplication |
| + | Point addition |
| \|\| | Concatenation |
| SHA256 | SHA-256 hash function |
| HKDF | HMAC-based Key Derivation Function |

#### B. Constants

```
SIP_VERSION = 1
MAX_AMOUNT = 2^64 - 1
VIEW_TAG_SIZE = 1 byte
NONCE_SIZE = 32 bytes
SIGNATURE_SIZE = 64 bytes
```

## Rationale

### Why Stealth Addresses?

Stealth addresses provide recipient privacy without requiring a privacy pool. Each transaction creates a fresh address, preventing address clustering analysis.

### Why Pedersen Commitments?

Pedersen commitments are:
1. **Hiding**: Amount is computationally hidden
2. **Binding**: Cannot open to different values
3. **Homomorphic**: Enables balance verification without revealing amounts

### Why Three Privacy Levels?

Different use cases require different privacy guarantees:
- DeFi traders need full privacy (shielded)
- Institutions need compliance options (compliant)
- Testing/debugging needs visibility (transparent)

### Why XChaCha20-Poly1305?

- 256-bit security level
- 192-bit nonce eliminates nonce reuse concerns
- AEAD provides authentication
- Fast in software

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
