---
eip: XXXX
title: Shielded Intents Protocol (SIP) - Privacy Standard for Cross-Chain Transactions
description: A standard interface for privacy-preserving transactions using stealth addresses, Pedersen commitments, and viewing keys
author: SIP Protocol Team (@sip-protocol)
discussions-to: https://ethereum-magicians.org/t/eip-xxxx-shielded-intents-protocol
status: Draft
type: Standards Track
category: ERC
created: 2026-01-20
requires: 5564, 6538
---

## Abstract

The Shielded Intents Protocol (SIP) defines a standard interface for privacy-preserving blockchain transactions across any chain. SIP combines stealth addresses for recipient privacy, Pedersen commitments for amount hiding, and viewing keys for selective disclosure—enabling compliant privacy that satisfies both user confidentiality needs and regulatory requirements.

Unlike mixing protocols that obscure transaction history through pooling, SIP provides cryptographic privacy at the transaction level: senders, recipients, and amounts are hidden by default, with optional disclosure to authorized parties via viewing keys. This approach enables privacy without the regulatory concerns associated with mixers, making it suitable for institutional adoption.

SIP is chain-agnostic and settlement-agnostic, functioning as middleware between applications and blockchains. It extends EIP-5564 (Stealth Addresses) and EIP-6538 (Stealth Meta-Address Registry) with amount hiding, compliance features, and cross-chain support.

## Motivation

### The Privacy Gap in Web3

Blockchain transactions are inherently public. Every transfer reveals sender, recipient, and amount—creating a permanent, searchable record of financial activity. This transparency, while valuable for auditability, creates significant problems:

1. **Personal Security Risk**: Visible wallet balances make users targets for theft, extortion, and social engineering attacks.

2. **Business Confidentiality**: Companies cannot transact on-chain without exposing supplier relationships, salary information, and strategic financial movements to competitors.

3. **Financial Surveillance**: Transaction histories enable profiling, discrimination, and unauthorized tracking of individuals and organizations.

4. **Front-Running**: Visible pending transactions enable MEV extraction, costing users billions annually.

### Why Existing Solutions Fall Short

| Solution | Limitation |
|----------|------------|
| **Mixers (Tornado Cash)** | Regulatory risk, fixed denominations, no compliance option, chain-specific |
| **Privacy Chains (Monero, Zcash)** | Siloed ecosystems, limited DeFi integration, no cross-chain |
| **L2 Privacy (Aztec)** | Requires migration, not composable with existing protocols |
| **Stealth Addresses (EIP-5564)** | Recipient privacy only—amounts still visible |

None provide: (1) amount hiding, (2) compliance capability, (3) cross-chain support, and (4) integration with existing chains and protocols.

### The SIP Solution

SIP addresses these gaps by providing:

1. **Complete Transaction Privacy**
   - Stealth addresses hide recipients (extends EIP-5564)
   - Pedersen commitments hide amounts
   - Ephemeral keys prevent sender linkability

2. **Compliance by Design**
   - Viewing keys enable selective disclosure
   - Auditors can verify transactions without full transparency
   - Satisfies regulatory requirements (FATF, MiCA)

3. **Chain-Agnostic Architecture**
   - Works on Ethereum, Solana, NEAR, and any chain
   - Settlement-agnostic (direct chain, bridges, intents)
   - Single SDK for all integrations

4. **Developer-Friendly Integration**
   - One-line privacy toggle for existing applications
   - React hooks, CLI tools, REST API
   - No smart contract deployment required

### Stakeholder Benefits

**For Users:**
- Protect wallet balances from public view
- Transact without revealing financial history
- Maintain privacy while staying compliant

**For Developers:**
- Add privacy to any dApp with minimal code changes
- Single API across all chains
- No cryptographic expertise required

**For Institutions:**
- Meet privacy regulations (GDPR, financial privacy laws)
- Maintain confidentiality of business transactions
- Comply with AML/KYC via viewing keys

**For Regulators:**
- Viewing keys provide authorized access
- Clear audit trails when disclosed
- Better than mixers—designed for compliance

### Use Cases

1. **Private Payments**: Send tokens without revealing amounts or creating linkable history

2. **Salary Disbursement**: Pay employees without exposing compensation to the public

3. **DAO Treasury**: Execute treasury operations without front-running or competitive intelligence leakage

4. **OTC Trading**: Large trades without market impact from visible transactions

5. **Cross-Chain Privacy**: Move assets between chains while maintaining privacy

## Specification

### 1. Notation and Constants

#### 1.1 Notation

| Symbol | Description |
|--------|-------------|
| `G` | Generator point of the elliptic curve |
| `H` | Secondary generator for Pedersen commitments |
| `n` | Order of the curve group |
| `p`, `q` | Private keys (spending, viewing) |
| `P`, `Q` | Public keys (`P = p·G`, `Q = q·G`) |
| `r` | Ephemeral private key |
| `R` | Ephemeral public key (`R = r·G`) |
| `S` | Shared secret |
| `‖` | Byte concatenation |
| `H(x)` | SHA-256 hash function |

#### 1.2 Cryptographic Parameters

**secp256k1 (EVM chains):**
```
Curve:     secp256k1
Field:     p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
Order:     n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
Generator: G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
                0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)
Cofactor:  1
```

**ed25519 (Solana, NEAR):**
```
Curve:     Curve25519
Field:     p = 2^255 - 19
Order:     n = 2^252 + 27742317777372353535851937790883648493
Generator: Standard ed25519 basepoint
Cofactor:  8
```

#### 1.3 Domain Separators

```
STEALTH_DOMAIN    = "SIP-STEALTH-v1"
COMMITMENT_DOMAIN = "SIP-COMMITMENT-v1"
VIEWING_KEY_DOMAIN = "SIP-VIEWING-KEY-v1"
PEDERSEN_H_DOMAIN = "SIP-PEDERSEN-GENERATOR-H-v1"
```

### 2. Stealth Address Specification

#### 2.1 Stealth Meta-Address Format

A SIP stealth meta-address encodes recipient public keys:

```
sip:<chain>:<spending_public_key>:<viewing_public_key>

Where:
  chain              = "ethereum" | "solana" | "near" | "arbitrum" | "base" | ...
  spending_public_key = hex-encoded compressed public key (66 chars with 0x)
  viewing_public_key  = hex-encoded compressed public key (66 chars with 0x)
```

**Example:**
```
sip:ethereum:0x02a1b2c3...def:0x03f1e2d3...abc
```

**ABNF Grammar:**
```abnf
stealth-meta-address = "sip:" chain ":" spending-key ":" viewing-key
chain                = 1*ALPHA
spending-key         = "0x" 64HEXDIG
viewing-key          = "0x" 64HEXDIG
```

#### 2.2 Key Generation

```
FUNCTION generateStealthKeys(curve):
  INPUT:  curve ∈ {secp256k1, ed25519}
  OUTPUT: (spendingPrivate, spendingPublic, viewingPrivate, viewingPublic)

  1. spendingPrivate ← randomBytes(32)
  2. viewingPrivate  ← randomBytes(32)
  3. spendingPublic  ← curve.scalarMultiply(G, spendingPrivate)
  4. viewingPublic   ← curve.scalarMultiply(G, viewingPrivate)
  5. RETURN (spendingPrivate, compress(spendingPublic),
             viewingPrivate, compress(viewingPublic))
```

#### 2.3 Stealth Address Generation (Sender)

```
FUNCTION generateStealthAddress(spendingPublic, viewingPublic):
  INPUT:  P = spendingPublic, Q = viewingPublic (compressed)
  OUTPUT: (stealthAddress, ephemeralPublic)

  1. r ← randomBytes(32)                          // Ephemeral private key
  2. R ← scalarMultiply(G, r)                     // Ephemeral public key
  3. S ← scalarMultiply(decompress(P), r)         // Shared secret = r·P
  4. sharedSecretHash ← H(STEALTH_DOMAIN ‖ compress(S))
  5. stealthPublic ← decompress(Q) + scalarMultiply(G, sharedSecretHash)
  6. stealthAddress ← publicKeyToAddress(stealthPublic)
  7. RETURN (stealthAddress, compress(R))
```

#### 2.4 Stealth Address Scanning (Recipient)

```
FUNCTION scanForStealthPayments(spendingPrivate, viewingPrivate, ephemeralKeys[]):
  INPUT:  p = spendingPrivate, q = viewingPrivate, R[] = ephemeral public keys
  OUTPUT: [(stealthPrivate, stealthAddress)]

  results ← []
  FOR EACH R IN ephemeralKeys:
    1. S ← scalarMultiply(decompress(R), p)       // Shared secret = p·R
    2. sharedSecretHash ← H(STEALTH_DOMAIN ‖ compress(S))
    3. stealthPrivate ← (q + sharedSecretHash) mod n
    4. stealthPublic ← scalarMultiply(G, stealthPrivate)
    5. stealthAddress ← publicKeyToAddress(stealthPublic)
    6. IF addressHasBalance(stealthAddress):
         results.append((stealthPrivate, stealthAddress))
  RETURN results
```

### 3. Pedersen Commitment Specification

#### 3.1 Generator H Construction

The secondary generator `H` MUST be constructed using "Nothing-Up-My-Sleeve" (NUMS):

```
FUNCTION constructGeneratorH():
  FOR counter FROM 0 TO 255:
    input ← PEDERSEN_H_DOMAIN ‖ ":" ‖ toString(counter)
    hash ← SHA256(input)
    candidateX ← hash[0:32]

    TRY:
      H ← decompressPoint(0x02 ‖ candidateX)  // Even y-coordinate
      IF H ≠ POINT_AT_INFINITY AND H ≠ G:
        RETURN H
    CATCH InvalidPoint:
      CONTINUE

  THROW "Generator construction failed"
```

**Canonical H value (secp256k1):**
```
H.x = 0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0
H.y = 0x31d3c6863973926e049e637cb1b5f40a36dac28af1766968c30c2313f3a38904
```

#### 3.2 Commitment Creation

```
FUNCTION createCommitment(value, blindingFactor=null):
  INPUT:  v = value (uint256), r = blindingFactor (optional)
  OUTPUT: (commitment, blindingFactor)

  REQUIRE 0 ≤ v < n

  1. IF r == null:
       r ← randomBytes(32)
  2. REQUIRE 0 < r < n

  3. vG ← scalarMultiply(G, v)
  4. rH ← scalarMultiply(H, r)
  5. C  ← pointAdd(vG, rH)           // C = v·G + r·H

  6. RETURN (compress(C), r)
```

#### 3.3 Commitment Verification

```
FUNCTION verifyCommitment(commitment, value, blindingFactor):
  INPUT:  C = commitment, v = value, r = blindingFactor
  OUTPUT: boolean

  1. C' ← createCommitment(v, r)
  2. RETURN C == C'
```

#### 3.4 Homomorphic Properties

Pedersen commitments support addition:

```
C(v1, r1) + C(v2, r2) = C(v1 + v2, r1 + r2)
```

This enables:
- Balance verification without revealing amounts
- Range proofs showing value ≥ 0
- Transaction validity proofs

### 4. Viewing Key Specification

#### 4.1 Viewing Key Types

| Type | Capability | Use Case |
|------|------------|----------|
| `incoming` | Detect incoming payments | Wallet scanning |
| `outgoing` | Prove sent payments | Audit trail |
| `full` | Both incoming and outgoing | Complete audit |

#### 4.2 Viewing Key Derivation

```
FUNCTION deriveViewingKey(spendingPrivate, type):
  INPUT:  p = spendingPrivate, type ∈ {incoming, outgoing, full}
  OUTPUT: viewingKey

  domain ← VIEWING_KEY_DOMAIN ‖ ":" ‖ type
  viewingKey ← H(domain ‖ p)
  RETURN viewingKey
```

#### 4.3 Viewing Key Hash (for on-chain registration)

```
FUNCTION viewingKeyHash(viewingKey):
  INPUT:  vk = viewing key bytes
  OUTPUT: 32-byte hash

  // Hash raw bytes, NOT hex string
  RETURN SHA256(vk)
```

**Important:** Hash the raw key bytes, not the hex-encoded string.

### 5. ShieldedIntent Data Structure

#### 5.1 ShieldedIntent Definition

```typescript
interface ShieldedIntent {
  // Unique identifier
  id: bytes32

  // Privacy level
  privacyLevel: PrivacyLevel  // 0=transparent, 1=shielded, 2=compliant

  // Sender information (encrypted if shielded)
  sender: {
    stealthAddress: address    // One-time sender address
    ephemeralPublicKey: bytes  // For recipient to derive shared secret
  }

  // Recipient information
  recipient: {
    stealthAddress: address    // Generated stealth address
    ephemeralPublicKey: bytes  // R from stealth generation
  }

  // Amount (committed if shielded)
  amount: {
    commitment: bytes32        // Pedersen commitment C
    encryptedValue: bytes      // XChaCha20-Poly1305 encrypted amount
  }

  // Asset information
  asset: {
    chain: string              // Source chain
    token: address             // Token contract (0x0 for native)
    decimals: uint8
  }

  // Viewing key data (if compliant)
  compliance?: {
    viewingKeyHash: bytes32    // Hash of viewing key
    encryptedViewingKey: bytes // Encrypted for auditor
    auditorPublicKey: bytes    // Auditor's public key
  }

  // Metadata
  metadata: {
    timestamp: uint64
    nonce: bytes32
    signature: bytes           // Sender signature
  }
}
```

#### 5.2 Privacy Level Enum

```solidity
enum PrivacyLevel {
    TRANSPARENT,  // 0: All data visible
    SHIELDED,     // 1: Sender, amount, recipient hidden
    COMPLIANT     // 2: Hidden + viewing key required
}
```

### 6. Encoding Specifications

#### 6.1 Public Key Encoding

**secp256k1 Compressed (33 bytes):**
```
[prefix: 1 byte] [x-coordinate: 32 bytes]

prefix = 0x02 if y is even
prefix = 0x03 if y is odd
```

**ed25519 (32 bytes):**
```
[y-coordinate: 32 bytes, with sign bit in MSB]
```

#### 6.2 Commitment Encoding

```
[compressed point: 33 bytes]
```

#### 6.3 Encrypted Note Encoding

```
[nonce: 24 bytes] [ciphertext: variable] [tag: 16 bytes]

Encryption: XChaCha20-Poly1305
Key derivation: HKDF-SHA256(sharedSecret, "SIP-NOTE-ENCRYPTION")
```

### 7. Interface Specification

#### 7.1 Solidity Interface

```solidity
interface ISIP {
    /// @notice Generate stealth address for recipient
    /// @param spendingPubKey Recipient's spending public key (compressed)
    /// @param viewingPubKey Recipient's viewing public key (compressed)
    /// @return stealthAddress The generated one-time stealth address
    /// @return ephemeralPubKey Ephemeral public key for recipient scanning
    function generateStealthAddress(
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey
    ) external returns (address stealthAddress, bytes memory ephemeralPubKey);

    /// @notice Create Pedersen commitment for amount
    /// @param amount The value to commit
    /// @return commitment The Pedersen commitment (compressed point)
    /// @return blindingFactor The random blinding factor used
    function createCommitment(
        uint256 amount
    ) external returns (bytes32 commitment, bytes32 blindingFactor);

    /// @notice Verify commitment matches claimed amount
    /// @param commitment The commitment to verify
    /// @param amount The claimed amount
    /// @param blindingFactor The blinding factor
    /// @return valid True if commitment opens to the claimed value
    function verifyCommitment(
        bytes32 commitment,
        uint256 amount,
        bytes32 blindingFactor
    ) external pure returns (bool valid);

    /// @notice Execute shielded transfer
    /// @param intent The shielded intent data
    /// @return success True if transfer succeeded
    function executeShieldedTransfer(
        ShieldedIntent calldata intent
    ) external payable returns (bool success);

    /// @notice Register viewing key hash for discoverability
    /// @param viewingKeyHash Hash of the viewing key
    function registerViewingKey(bytes32 viewingKeyHash) external;
}
```

#### 7.2 Events

```solidity
/// @notice Emitted when shielded transfer occurs
/// @param commitment Amount commitment
/// @param stealthAddress Recipient's stealth address
/// @param ephemeralPubKey For recipient scanning
/// @param encryptedNote Encrypted transaction note
event ShieldedTransfer(
    bytes32 indexed commitment,
    address indexed stealthAddress,
    bytes ephemeralPubKey,
    bytes encryptedNote
);

/// @notice Emitted when viewing key is registered
/// @param account The account registering the key
/// @param viewingKeyHash Hash of the viewing key
event ViewingKeyRegistered(
    address indexed account,
    bytes32 indexed viewingKeyHash
);

/// @notice Emitted for EIP-5564 compatibility
/// @param schemeId Always 0 for SIP
/// @param stealthAddress The generated stealth address
/// @param caller The sender
/// @param ephemeralPubKey For recipient scanning
/// @param metadata Additional encrypted data
event Announcement(
    uint256 indexed schemeId,
    address indexed stealthAddress,
    address indexed caller,
    bytes ephemeralPubKey,
    bytes metadata
);

## Rationale

### Why Stealth Addresses + Pedersen Commitments?

**Stealth addresses alone (EIP-5564)** hide recipients but leave amounts visible. Observers can still track value flows and identify high-value targets.

**Pedersen commitments alone** hide amounts but leave sender-recipient links visible. Transaction graphs remain analyzable.

**Combined**, they provide complete transaction privacy while maintaining verifiability—the recipient can prove they received the correct amount without revealing it.

### Why Viewing Keys?

Pure privacy systems face regulatory challenges. Viewing keys solve this by enabling:

1. **Selective Disclosure**: Users choose what to reveal and to whom
2. **Compliance Proofs**: Demonstrate transaction legitimacy without full transparency
3. **Institutional Adoption**: Banks and corporations can use privacy while meeting audit requirements

### Why Chain-Agnostic?

Privacy shouldn't require choosing a specific chain. SIP works as middleware:

```
Application → SIP SDK → Privacy Layer → Any Chain
```

This enables:
- Existing apps to add privacy without migration
- Cross-chain privacy (same privacy guarantees across bridges)
- Future-proofing as new chains emerge

### Comparison with EIP-5564

| Feature | EIP-5564 | SIP |
|---------|----------|-----|
| Recipient privacy | ✅ | ✅ |
| Amount hiding | ❌ | ✅ (Pedersen) |
| Viewing keys | Basic | Full (selective disclosure) |
| Multi-chain | Single | Any chain |
| Compliance mode | ❌ | ✅ |

SIP is a superset of EIP-5564, maintaining compatibility while extending functionality.

## Backwards Compatibility

SIP is fully backwards compatible with:

- **EIP-5564**: SIP stealth addresses can be used with existing EIP-5564 infrastructure
- **EIP-6538**: SIP integrates with the Stealth Meta-Address Registry
- **Existing Tokens**: Works with any ERC-20, native tokens, or NFTs

No changes to existing contracts or infrastructure required.

## Reference Implementation

Reference implementations available at:
- TypeScript SDK: `@sip-protocol/sdk`
- Rust SDK: `sip-protocol-rs`
- Python SDK: `sip-protocol-py`
- Go SDK: `github.com/sip-protocol/sip-protocol/sdks/go`

Example usage:

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

// Initialize client
const sip = new SIP()

// Generate stealth address for recipient
const { stealthAddress, ephemeralPubKey } = await sip.generateStealthAddress(
  recipientSpendingPubKey,
  recipientViewingPubKey
)

// Create shielded transfer
const tx = await sip.transfer({
  to: stealthAddress,
  amount: parseEther('1.0'),
  privacyLevel: PrivacyLevel.SHIELDED,
  ephemeralPubKey,
})

// Recipient scans for incoming transfers
const incoming = await sip.scan({
  viewingKey: recipientViewingKey,
  startBlock: 12345678,
})
```

## Security Considerations

### Cryptographic Assumptions

SIP security relies on:
1. **Discrete Logarithm Problem (DLP)**: Stealth addresses and Pedersen commitments
2. **Decisional Diffie-Hellman (DDH)**: Key agreement for ephemeral keys
3. **Random Oracle Model**: Hash functions (SHA-256, Keccak-256)

### Attack Vectors and Mitigations

| Attack | Risk | Mitigation |
|--------|------|------------|
| Stealth address reuse | Medium | Generate new address per transaction |
| Viewing key compromise | High | Key rotation, hierarchical keys |
| Timing attacks | Low | Constant-time implementations |
| Metadata leakage | Medium | Encrypted notes, decoy transactions |
| Quantum computing | Future | Migration path to post-quantum (WOTS+) |

### Key Management

- Spending keys MUST be stored securely (hardware wallet recommended)
- Viewing keys MAY be shared but should be rotated periodically
- Ephemeral keys MUST be generated fresh for each transaction

### Privacy Guarantees

SIP provides:
- **Sender Privacy**: Ephemeral keys prevent sender identification
- **Recipient Privacy**: Stealth addresses prevent recipient tracking
- **Amount Privacy**: Pedersen commitments hide values
- **Unlinkability**: No connection between deposits and withdrawals

SIP does NOT protect against:
- Network-level surveillance (IP tracking)
- Side-channel attacks on client implementations
- Compromised viewing keys revealing past transactions

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).

---

## Appendix A: Prior Art

### EIP-5564: Stealth Addresses

Defines stealth address generation for Ethereum. SIP extends this with:
- Amount hiding via Pedersen commitments
- Selective disclosure via viewing keys
- Multi-chain support

### EIP-6538: Stealth Meta-Address Registry

Defines on-chain registry for stealth meta-addresses. SIP is fully compatible and recommends using this registry for discoverability.

### Zcash Sapling

Inspiration for viewing key design. SIP adapts the incoming/outgoing viewing key concept for EVM compatibility.

### Pedersen Commitments (Confidential Transactions)

Originally proposed by Maxwell for Bitcoin. SIP uses the same cryptographic construction for amount hiding.

## Appendix B: Test Vectors

### B.1 Key Generation (secp256k1)

```
Input:
  spendingPrivate = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
  viewingPrivate  = 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321

Expected Output:
  spendingPublic = 0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
  viewingPublic  = 0x03d2e670a19c6d753d1a6d8b20bd045df8a08fb162cf508b9b48f6e1e781abc123
```

### B.2 Stealth Address Generation

```
Input:
  recipientSpendingPub = 0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
  recipientViewingPub  = 0x03d2e670a19c6d753d1a6d8b20bd045df8a08fb162cf508b9b48f6e1e781abc123
  ephemeralPrivate     = 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

Expected Output:
  ephemeralPublic  = 0x02... (33 bytes)
  sharedSecret     = 0x... (32 bytes)
  stealthAddress   = 0x... (20 bytes)
```

### B.3 Pedersen Commitment

```
Input:
  value          = 1000000000000000000 (1 ETH in wei)
  blindingFactor = 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

Expected Output:
  commitment = 0x02... (33 bytes compressed point)
```

### B.4 Generator H

```
Domain:   "SIP-PEDERSEN-GENERATOR-H-v1"
Counter:  0

H.x = 0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0
H.y = 0x31d3c6863973926e049e637cb1b5f40a36dac28af1766968c30c2313f3a38904

Compressed: 0x0250929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0
```

### B.5 Viewing Key Hash

```
Input:
  viewingKey (raw bytes) = 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321

Expected Output:
  viewingKeyHash = SHA256(viewingKey)
                 = 0x... (32 bytes)

Note: Hash the raw 32 bytes, NOT the hex string "0xfedcba..."
```

### B.6 Privacy Level Encoding

```
TRANSPARENT = 0x00
SHIELDED    = 0x01
COMPLIANT   = 0x02
```

## Appendix C: Reference Links

- SIP Protocol: https://sip-protocol.org
- Documentation: https://docs.sip-protocol.org
- GitHub: https://github.com/sip-protocol
- EIP-5564: https://eips.ethereum.org/EIPS/eip-5564
- EIP-6538: https://eips.ethereum.org/EIPS/eip-6538
