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

This section defines the core interfaces that implementations MUST provide for SIP compliance. Interfaces are specified in both Solidity (for on-chain) and TypeScript (for SDKs).

#### 7.1 Interface Versioning

All SIP interfaces follow semantic versioning with the following rules:

```
INTERFACE_VERSION = "1.0.0"

Version Format: MAJOR.MINOR.PATCH

MAJOR: Breaking changes (method signatures, return types)
MINOR: Additive changes (new methods, new optional parameters)
PATCH: Documentation, bug fixes, clarifications
```

**Version Query:**

```solidity
interface ISIPVersioned {
    /// @notice Returns the interface version
    /// @return version Semantic version string (e.g., "1.0.0")
    function sipVersion() external pure returns (string memory version);

    /// @notice Returns supported interface IDs
    /// @return interfaceIds Array of supported interface identifiers
    function supportedInterfaces() external pure returns (bytes4[] memory interfaceIds);
}
```

**Interface IDs (ERC-165):**

```
ISIPProvider:            0x5310a1f0
ISIPWallet:              0x8f2e4c3b
IStealthAddressGenerator: 0x7a9d2e1c
IViewingKeyProvider:     0x3b8c4d5a
```

#### 7.2 Error Codes

SIP defines standard error codes for consistent error handling across implementations:

```solidity
/// @notice Standard SIP error codes
library SIPErrors {
    // General errors (0x01XX)
    error InvalidInput(string reason);           // 0x0100
    error Unauthorized(address caller);          // 0x0101
    error NotInitialized();                      // 0x0102
    error AlreadyInitialized();                  // 0x0103
    error InsufficientFunds(uint256 required, uint256 available); // 0x0104
    error Expired(uint256 deadline, uint256 current);             // 0x0105

    // Stealth address errors (0x02XX)
    error InvalidStealthMetaAddress(string reason);  // 0x0200
    error InvalidPublicKey(bytes key);               // 0x0201
    error StealthAddressGenerationFailed();          // 0x0202
    error InvalidEphemeralKey(bytes key);            // 0x0203
    error ScanningFailed(string reason);             // 0x0204

    // Commitment errors (0x03XX)
    error InvalidCommitment(bytes32 commitment);     // 0x0300
    error CommitmentVerificationFailed();            // 0x0301
    error InvalidBlindingFactor();                   // 0x0302
    error ValueOutOfRange(uint256 value, uint256 max); // 0x0303
    error HomomorphicOperationFailed(string reason); // 0x0304

    // Viewing key errors (0x04XX)
    error InvalidViewingKey(bytes key);              // 0x0400
    error ViewingKeyNotRegistered(address account);  // 0x0401
    error UnauthorizedViewer(address viewer);        // 0x0402
    error DecryptionFailed(string reason);           // 0x0403
    error ViewingKeyExpired(uint256 expiry);         // 0x0404

    // Privacy level errors (0x05XX)
    error InvalidPrivacyLevel(uint8 level);          // 0x0500
    error PrivacyLevelMismatch(uint8 expected, uint8 actual); // 0x0501
    error ComplianceRequired();                      // 0x0502

    // Transfer errors (0x06XX)
    error TransferFailed(string reason);             // 0x0600
    error InvalidRecipient(address recipient);       // 0x0601
    error InvalidAmount();                           // 0x0602
    error SlippageExceeded(uint256 expected, uint256 actual); // 0x0603

    // Proof errors (0x07XX)
    error ProofGenerationFailed(string reason);      // 0x0700
    error ProofVerificationFailed();                 // 0x0701
    error InvalidProofFormat();                      // 0x0702
}
```

**TypeScript Error Enumeration:**

```typescript
enum SIPErrorCode {
  // General errors
  INVALID_INPUT = 'SIP_ERR_0100',
  UNAUTHORIZED = 'SIP_ERR_0101',
  NOT_INITIALIZED = 'SIP_ERR_0102',
  ALREADY_INITIALIZED = 'SIP_ERR_0103',
  INSUFFICIENT_FUNDS = 'SIP_ERR_0104',
  EXPIRED = 'SIP_ERR_0105',

  // Stealth address errors
  INVALID_STEALTH_META_ADDRESS = 'SIP_ERR_0200',
  INVALID_PUBLIC_KEY = 'SIP_ERR_0201',
  STEALTH_ADDRESS_GENERATION_FAILED = 'SIP_ERR_0202',
  INVALID_EPHEMERAL_KEY = 'SIP_ERR_0203',
  SCANNING_FAILED = 'SIP_ERR_0204',

  // Commitment errors
  INVALID_COMMITMENT = 'SIP_ERR_0300',
  COMMITMENT_VERIFICATION_FAILED = 'SIP_ERR_0301',
  INVALID_BLINDING_FACTOR = 'SIP_ERR_0302',
  VALUE_OUT_OF_RANGE = 'SIP_ERR_0303',
  HOMOMORPHIC_OPERATION_FAILED = 'SIP_ERR_0304',

  // Viewing key errors
  INVALID_VIEWING_KEY = 'SIP_ERR_0400',
  VIEWING_KEY_NOT_REGISTERED = 'SIP_ERR_0401',
  UNAUTHORIZED_VIEWER = 'SIP_ERR_0402',
  DECRYPTION_FAILED = 'SIP_ERR_0403',
  VIEWING_KEY_EXPIRED = 'SIP_ERR_0404',

  // Privacy level errors
  INVALID_PRIVACY_LEVEL = 'SIP_ERR_0500',
  PRIVACY_LEVEL_MISMATCH = 'SIP_ERR_0501',
  COMPLIANCE_REQUIRED = 'SIP_ERR_0502',

  // Transfer errors
  TRANSFER_FAILED = 'SIP_ERR_0600',
  INVALID_RECIPIENT = 'SIP_ERR_0601',
  INVALID_AMOUNT = 'SIP_ERR_0602',
  SLIPPAGE_EXCEEDED = 'SIP_ERR_0603',

  // Proof errors
  PROOF_GENERATION_FAILED = 'SIP_ERR_0700',
  PROOF_VERIFICATION_FAILED = 'SIP_ERR_0701',
  INVALID_PROOF_FORMAT = 'SIP_ERR_0702',
}

class SIPError extends Error {
  constructor(
    public readonly code: SIPErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(`[${code}] ${message}`)
    this.name = 'SIPError'
  }
}
```

#### 7.3 ISIPProvider Interface

The primary interface for SIP implementations. Providers aggregate all SIP functionality.

**Solidity:**

```solidity
/// @title ISIPProvider
/// @notice Primary interface for SIP Protocol implementations
/// @dev Aggregates stealth address, commitment, and transfer functionality
interface ISIPProvider is ISIPVersioned {

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Initialize the provider with configuration
    /// @param config Encoded configuration parameters
    function initialize(bytes calldata config) external;

    /// @notice Check if provider is ready for operations
    /// @return ready True if initialized and operational
    function isReady() external view returns (bool ready);

    // ═══════════════════════════════════════════════════════════════════════
    // STEALTH ADDRESS OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Generate a stealth address for recipient
    /// @param spendingPubKey Recipient's spending public key (compressed, 33 bytes)
    /// @param viewingPubKey Recipient's viewing public key (compressed, 33 bytes)
    /// @return stealthAddress The generated one-time stealth address
    /// @return ephemeralPubKey Ephemeral public key for recipient scanning
    function generateStealthAddress(
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey
    ) external returns (address stealthAddress, bytes memory ephemeralPubKey);

    /// @notice Parse a stealth meta-address string
    /// @param metaAddress The stealth meta-address (e.g., "sip:ethereum:0x....:0x....")
    /// @return chain Chain identifier
    /// @return spendingPubKey Spending public key
    /// @return viewingPubKey Viewing public key
    function parseStealthMetaAddress(
        string calldata metaAddress
    ) external pure returns (string memory chain, bytes memory spendingPubKey, bytes memory viewingPubKey);

    // ═══════════════════════════════════════════════════════════════════════
    // COMMITMENT OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Create a Pedersen commitment for an amount
    /// @param amount The value to commit (must be < curve order)
    /// @return commitment The commitment point (33 bytes compressed)
    /// @return blindingFactor The random blinding factor used (32 bytes)
    function createCommitment(
        uint256 amount
    ) external returns (bytes32 commitment, bytes32 blindingFactor);

    /// @notice Create a commitment with a specific blinding factor
    /// @param amount The value to commit
    /// @param blindingFactor The blinding factor to use
    /// @return commitment The commitment point
    function createCommitmentWithBlinding(
        uint256 amount,
        bytes32 blindingFactor
    ) external pure returns (bytes32 commitment);

    /// @notice Verify a commitment opening
    /// @param commitment The commitment to verify
    /// @param amount The claimed amount
    /// @param blindingFactor The blinding factor
    /// @return valid True if commitment opens to the claimed value
    function verifyCommitment(
        bytes32 commitment,
        uint256 amount,
        bytes32 blindingFactor
    ) external pure returns (bool valid);

    /// @notice Add two commitments homomorphically
    /// @param c1 First commitment
    /// @param c2 Second commitment
    /// @return sum Commitment to sum of values
    function addCommitments(
        bytes32 c1,
        bytes32 c2
    ) external pure returns (bytes32 sum);

    /// @notice Subtract two commitments homomorphically
    /// @param c1 First commitment
    /// @param c2 Second commitment
    /// @return diff Commitment to difference of values
    function subtractCommitments(
        bytes32 c1,
        bytes32 c2
    ) external pure returns (bytes32 diff);

    // ═══════════════════════════════════════════════════════════════════════
    // TRANSFER OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Execute a shielded transfer
    /// @param intent The shielded intent containing transfer details
    /// @return success True if transfer executed successfully
    /// @return txId Transaction identifier for tracking
    function executeShieldedTransfer(
        ShieldedIntent calldata intent
    ) external payable returns (bool success, bytes32 txId);

    /// @notice Get transfer status
    /// @param txId Transaction identifier
    /// @return status Current status of the transfer
    function getTransferStatus(
        bytes32 txId
    ) external view returns (TransferStatus status);

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Get the generator point G
    /// @return x X coordinate (32 bytes)
    /// @return y Y coordinate (32 bytes)
    function generatorG() external pure returns (bytes32 x, bytes32 y);

    /// @notice Get the Pedersen generator H
    /// @return x X coordinate (32 bytes)
    /// @return y Y coordinate (32 bytes)
    function generatorH() external pure returns (bytes32 x, bytes32 y);
}

/// @notice Transfer status enumeration
enum TransferStatus {
    PENDING,      // Transfer submitted, awaiting confirmation
    CONFIRMED,    // Transfer confirmed on-chain
    COMPLETED,    // Transfer fully completed
    FAILED,       // Transfer failed
    EXPIRED       // Transfer expired before completion
}
```

**TypeScript:**

```typescript
interface ISIPProvider {
  // Metadata
  readonly version: string
  readonly isReady: boolean
  readonly supportedChains: string[]

  // Initialization
  initialize(config?: SIPProviderConfig): Promise<void>
  waitUntilReady(timeoutMs?: number): Promise<void>

  // Stealth address operations
  generateStealthAddress(
    spendingPubKey: HexString,
    viewingPubKey: HexString
  ): Promise<StealthAddressResult>

  parseStealthMetaAddress(metaAddress: string): StealthMetaAddressParsed

  createStealthMetaAddress(
    chain: string,
    spendingPubKey: HexString,
    viewingPubKey: HexString
  ): string

  // Commitment operations
  createCommitment(amount: bigint, blindingFactor?: Uint8Array): Promise<CommitmentResult>
  verifyCommitment(commitment: HexString, amount: bigint, blindingFactor: HexString): boolean
  addCommitments(c1: HexString, c2: HexString): HexString
  subtractCommitments(c1: HexString, c2: HexString): HexString

  // Transfer operations
  executeShieldedTransfer(intent: ShieldedIntent): Promise<TransferResult>
  getTransferStatus(txId: HexString): Promise<TransferStatus>

  // Constants
  getGeneratorG(): { x: HexString; y: HexString }
  getGeneratorH(): { x: HexString; y: HexString }
}

interface SIPProviderConfig {
  chain: string
  rpcUrl?: string
  networkId?: string
  proofProvider?: IProofProvider
}

interface StealthAddressResult {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
}

interface StealthMetaAddressParsed {
  chain: string
  spendingPublicKey: HexString
  viewingPublicKey: HexString
}

interface CommitmentResult {
  commitment: HexString
  blindingFactor: HexString
}

interface TransferResult {
  success: boolean
  txId: HexString
  stealthAddress?: HexString
  commitment?: HexString
}
```

#### 7.4 ISIPWallet Interface

Interface for wallet integrations enabling SIP functionality.

**Solidity:**

```solidity
/// @title ISIPWallet
/// @notice Interface for wallet integrations with SIP Protocol
/// @dev Wallets implement this to enable privacy features
interface ISIPWallet is ISIPVersioned {

    // ═══════════════════════════════════════════════════════════════════════
    // KEY MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Get the wallet's stealth meta-address
    /// @return metaAddress The stealth meta-address for receiving private payments
    function getStealthMetaAddress() external view returns (string memory metaAddress);

    /// @notice Get the spending public key
    /// @return pubKey Compressed spending public key (33 bytes)
    function getSpendingPublicKey() external view returns (bytes memory pubKey);

    /// @notice Get the viewing public key
    /// @return pubKey Compressed viewing public key (33 bytes)
    function getViewingPublicKey() external view returns (bytes memory pubKey);

    /// @notice Derive a stealth private key for a received payment
    /// @param ephemeralPubKey The ephemeral public key from the sender
    /// @return stealthPrivKey The derived stealth private key
    /// @dev Only callable by wallet owner
    function deriveStealthPrivateKey(
        bytes calldata ephemeralPubKey
    ) external returns (bytes memory stealthPrivKey);

    // ═══════════════════════════════════════════════════════════════════════
    // SCANNING
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Scan for incoming stealth payments
    /// @param fromBlock Starting block number
    /// @param toBlock Ending block number (0 for latest)
    /// @return payments Array of detected stealth payments
    function scanForPayments(
        uint256 fromBlock,
        uint256 toBlock
    ) external returns (StealthPayment[] memory payments);

    /// @notice Check if a specific stealth address belongs to this wallet
    /// @param stealthAddress The stealth address to check
    /// @param ephemeralPubKey The ephemeral public key used
    /// @return isOwned True if this wallet can spend from the address
    function checkStealthOwnership(
        address stealthAddress,
        bytes calldata ephemeralPubKey
    ) external view returns (bool isOwned);

    // ═══════════════════════════════════════════════════════════════════════
    // TRANSFER OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Send a shielded payment
    /// @param recipientMetaAddress Recipient's stealth meta-address
    /// @param token Token address (address(0) for native token)
    /// @param amount Amount to send
    /// @param privacyLevel Privacy level for the transfer
    /// @return txId Transaction identifier
    function sendShielded(
        string calldata recipientMetaAddress,
        address token,
        uint256 amount,
        PrivacyLevel privacyLevel
    ) external payable returns (bytes32 txId);

    /// @notice Withdraw from a stealth address
    /// @param stealthAddress The stealth address to withdraw from
    /// @param ephemeralPubKey The ephemeral key used for this address
    /// @param recipient Destination address for withdrawal
    /// @param token Token to withdraw (address(0) for native)
    /// @param amount Amount to withdraw
    /// @return txId Transaction identifier
    function withdrawFromStealth(
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        address recipient,
        address token,
        uint256 amount
    ) external returns (bytes32 txId);

    // ═══════════════════════════════════════════════════════════════════════
    // VIEWING KEYS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Export a viewing key for an auditor
    /// @param keyType Type of viewing key (incoming, outgoing, full)
    /// @param auditorPubKey Auditor's public key for encryption
    /// @return encryptedKey Encrypted viewing key
    function exportViewingKey(
        ViewingKeyType keyType,
        bytes calldata auditorPubKey
    ) external returns (bytes memory encryptedKey);
}

/// @notice Detected stealth payment
struct StealthPayment {
    address stealthAddress;
    bytes ephemeralPubKey;
    bytes32 commitment;
    address token;
    uint256 blockNumber;
    bytes32 txHash;
}

/// @notice Viewing key type
enum ViewingKeyType {
    INCOMING,   // Can detect incoming payments
    OUTGOING,   // Can prove outgoing payments
    FULL        // Both incoming and outgoing
}
```

**TypeScript:**

```typescript
interface ISIPWallet {
  // Metadata
  readonly address: HexString
  readonly chain: string
  readonly isConnected: boolean

  // Connection
  connect(): Promise<void>
  disconnect(): Promise<void>

  // Key management
  getStealthMetaAddress(): Promise<string>
  getSpendingPublicKey(): Promise<HexString>
  getViewingPublicKey(): Promise<HexString>
  deriveStealthPrivateKey(ephemeralPubKey: HexString): Promise<HexString>

  // Scanning
  scanForPayments(options: ScanOptions): Promise<StealthPayment[]>
  checkStealthOwnership(stealthAddress: HexString, ephemeralPubKey: HexString): Promise<boolean>

  // Transfer operations
  sendShielded(params: ShieldedSendParams): Promise<TransferResult>
  withdrawFromStealth(params: WithdrawParams): Promise<TransferResult>

  // Viewing keys
  exportViewingKey(type: ViewingKeyType, auditorPubKey?: HexString): Promise<ExportedViewingKey>

  // Signing
  signMessage(message: Uint8Array): Promise<HexString>
  signShieldedIntent(intent: ShieldedIntent): Promise<HexString>

  // Events
  on(event: 'payment', handler: (payment: StealthPayment) => void): void
  on(event: 'disconnect', handler: () => void): void
  off(event: string, handler: Function): void
}

interface ScanOptions {
  fromBlock?: number
  toBlock?: number
  tokens?: HexString[]  // Filter by specific tokens
}

interface StealthPayment {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  commitment: HexString
  token: HexString
  amount?: bigint  // Only if viewer has viewing key
  blockNumber: number
  txHash: HexString
  timestamp: number
}

interface ShieldedSendParams {
  recipientMetaAddress: string
  token: HexString
  amount: bigint
  privacyLevel: PrivacyLevel
  memo?: string
}

interface WithdrawParams {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  recipient: HexString
  token: HexString
  amount: bigint
}

interface ExportedViewingKey {
  type: ViewingKeyType
  encryptedKey?: HexString  // If auditorPubKey provided
  rawKey?: HexString        // If no encryption requested
  validFrom: number
  validUntil?: number
}

type ViewingKeyType = 'incoming' | 'outgoing' | 'full'
```

#### 7.5 IStealthAddressGenerator Interface

Specialized interface for stealth address operations.

**Solidity:**

```solidity
/// @title IStealthAddressGenerator
/// @notice Interface for stealth address generation and scanning
interface IStealthAddressGenerator is ISIPVersioned {

    // ═══════════════════════════════════════════════════════════════════════
    // KEY GENERATION
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Generate a new stealth key pair
    /// @return spendingPrivate Spending private key (32 bytes)
    /// @return spendingPublic Spending public key (33 bytes compressed)
    /// @return viewingPrivate Viewing private key (32 bytes)
    /// @return viewingPublic Viewing public key (33 bytes compressed)
    function generateKeyPair() external returns (
        bytes memory spendingPrivate,
        bytes memory spendingPublic,
        bytes memory viewingPrivate,
        bytes memory viewingPublic
    );

    /// @notice Derive public key from private key
    /// @param privateKey The private key (32 bytes)
    /// @return publicKey The compressed public key (33 bytes)
    function derivePublicKey(
        bytes calldata privateKey
    ) external pure returns (bytes memory publicKey);

    // ═══════════════════════════════════════════════════════════════════════
    // STEALTH ADDRESS GENERATION
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Generate stealth address from meta-address
    /// @param spendingPubKey Recipient's spending public key
    /// @param viewingPubKey Recipient's viewing public key
    /// @return stealthAddress The one-time stealth address
    /// @return ephemeralPubKey Ephemeral public key for recipient
    /// @return sharedSecret The ECDH shared secret (for encryption)
    function generate(
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey
    ) external returns (
        address stealthAddress,
        bytes memory ephemeralPubKey,
        bytes32 sharedSecret
    );

    /// @notice Generate with deterministic ephemeral key (for testing)
    /// @param spendingPubKey Recipient's spending public key
    /// @param viewingPubKey Recipient's viewing public key
    /// @param ephemeralPrivKey Ephemeral private key to use
    /// @return stealthAddress The one-time stealth address
    /// @return ephemeralPubKey Corresponding ephemeral public key
    function generateDeterministic(
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey,
        bytes calldata ephemeralPrivKey
    ) external pure returns (
        address stealthAddress,
        bytes memory ephemeralPubKey
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEALTH ADDRESS RECOVERY
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Recover stealth private key as recipient
    /// @param spendingPrivKey Recipient's spending private key
    /// @param viewingPrivKey Recipient's viewing private key
    /// @param ephemeralPubKey Ephemeral public key from sender
    /// @return stealthPrivKey The derived stealth private key
    function recover(
        bytes calldata spendingPrivKey,
        bytes calldata viewingPrivKey,
        bytes calldata ephemeralPubKey
    ) external pure returns (bytes memory stealthPrivKey);

    /// @notice Compute shared secret for recipient
    /// @param spendingPrivKey Recipient's spending private key
    /// @param ephemeralPubKey Ephemeral public key from sender
    /// @return sharedSecret The ECDH shared secret
    function computeSharedSecret(
        bytes calldata spendingPrivKey,
        bytes calldata ephemeralPubKey
    ) external pure returns (bytes32 sharedSecret);

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Verify a stealth address derivation
    /// @param stealthAddress The claimed stealth address
    /// @param spendingPubKey Recipient's spending public key
    /// @param viewingPubKey Recipient's viewing public key
    /// @param ephemeralPubKey The ephemeral public key used
    /// @return valid True if derivation is correct
    function verify(
        address stealthAddress,
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey,
        bytes calldata ephemeralPubKey
    ) external pure returns (bool valid);

    // ═══════════════════════════════════════════════════════════════════════
    // META-ADDRESS UTILITIES
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Create a stealth meta-address string
    /// @param chain Chain identifier
    /// @param spendingPubKey Spending public key
    /// @param viewingPubKey Viewing public key
    /// @return metaAddress The formatted stealth meta-address
    function createMetaAddress(
        string calldata chain,
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey
    ) external pure returns (string memory metaAddress);

    /// @notice Parse a stealth meta-address string
    /// @param metaAddress The stealth meta-address to parse
    /// @return chain Chain identifier
    /// @return spendingPubKey Spending public key
    /// @return viewingPubKey Viewing public key
    function parseMetaAddress(
        string calldata metaAddress
    ) external pure returns (
        string memory chain,
        bytes memory spendingPubKey,
        bytes memory viewingPubKey
    );
}
```

**TypeScript:**

```typescript
interface IStealthAddressGenerator {
  // Metadata
  readonly curve: 'secp256k1' | 'ed25519'
  readonly domainSeparator: string

  // Key generation
  generateKeyPair(): Promise<StealthKeyPair>
  derivePublicKey(privateKey: HexString): HexString

  // Stealth address generation
  generate(spendingPubKey: HexString, viewingPubKey: HexString): Promise<StealthGenerationResult>
  generateDeterministic(
    spendingPubKey: HexString,
    viewingPubKey: HexString,
    ephemeralPrivKey: HexString
  ): StealthGenerationResult

  // Recovery
  recover(
    spendingPrivKey: HexString,
    viewingPrivKey: HexString,
    ephemeralPubKey: HexString
  ): HexString  // Returns stealth private key

  computeSharedSecret(spendingPrivKey: HexString, ephemeralPubKey: HexString): HexString

  // Verification
  verify(
    stealthAddress: HexString,
    spendingPubKey: HexString,
    viewingPubKey: HexString,
    ephemeralPubKey: HexString
  ): boolean

  // Meta-address utilities
  createMetaAddress(chain: string, spendingPubKey: HexString, viewingPubKey: HexString): string
  parseMetaAddress(metaAddress: string): StealthMetaAddressParsed
  isValidMetaAddress(metaAddress: string): boolean
}

interface StealthKeyPair {
  spendingPrivateKey: HexString
  spendingPublicKey: HexString
  viewingPrivateKey: HexString
  viewingPublicKey: HexString
}

interface StealthGenerationResult {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  sharedSecret: HexString
}
```

#### 7.6 IViewingKeyProvider Interface

Interface for viewing key management and selective disclosure.

**Solidity:**

```solidity
/// @title IViewingKeyProvider
/// @notice Interface for viewing key management and compliance
/// @dev Enables selective disclosure for auditors and regulators
interface IViewingKeyProvider is ISIPVersioned {

    // ═══════════════════════════════════════════════════════════════════════
    // VIEWING KEY GENERATION
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Derive a viewing key from spending key
    /// @param spendingPrivKey The spending private key
    /// @param keyType Type of viewing key to generate
    /// @return viewingKey The derived viewing key
    function deriveViewingKey(
        bytes calldata spendingPrivKey,
        ViewingKeyType keyType
    ) external pure returns (bytes memory viewingKey);

    /// @notice Generate a time-limited viewing key
    /// @param spendingPrivKey The spending private key
    /// @param keyType Type of viewing key
    /// @param validFrom Start timestamp
    /// @param validUntil Expiry timestamp
    /// @return viewingKey The derived viewing key with time bounds
    function deriveTimeLimitedViewingKey(
        bytes calldata spendingPrivKey,
        ViewingKeyType keyType,
        uint256 validFrom,
        uint256 validUntil
    ) external pure returns (bytes memory viewingKey);

    // ═══════════════════════════════════════════════════════════════════════
    // REGISTRATION
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Register a viewing key hash on-chain
    /// @param viewingKeyHash Hash of the viewing key
    /// @dev Enables discoverability for auditors
    function registerViewingKeyHash(bytes32 viewingKeyHash) external;

    /// @notice Check if a viewing key hash is registered
    /// @param account The account to check
    /// @return registered True if a viewing key is registered
    /// @return keyHash The registered key hash (if any)
    function isViewingKeyRegistered(
        address account
    ) external view returns (bool registered, bytes32 keyHash);

    /// @notice Revoke a viewing key registration
    /// @param viewingKeyHash The key hash to revoke
    function revokeViewingKey(bytes32 viewingKeyHash) external;

    // ═══════════════════════════════════════════════════════════════════════
    // DISCLOSURE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Encrypt viewing key for an auditor
    /// @param viewingKey The viewing key to share
    /// @param auditorPubKey Auditor's public key
    /// @return encryptedKey The encrypted viewing key
    function encryptViewingKeyForAuditor(
        bytes calldata viewingKey,
        bytes calldata auditorPubKey
    ) external pure returns (bytes memory encryptedKey);

    /// @notice Decrypt a viewing key (as auditor)
    /// @param encryptedKey The encrypted viewing key
    /// @param auditorPrivKey Auditor's private key
    /// @return viewingKey The decrypted viewing key
    function decryptViewingKey(
        bytes calldata encryptedKey,
        bytes calldata auditorPrivKey
    ) external pure returns (bytes memory viewingKey);

    // ═══════════════════════════════════════════════════════════════════════
    // SCANNING WITH VIEWING KEY
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Scan transactions using a viewing key
    /// @param viewingKey The viewing key for decryption
    /// @param announcements Array of stealth announcements to scan
    /// @return matches Array of matching stealth addresses with amounts
    function scanWithViewingKey(
        bytes calldata viewingKey,
        Announcement[] calldata announcements
    ) external view returns (ViewingMatch[] memory matches);

    /// @notice Decrypt a transaction amount using viewing key
    /// @param viewingKey The viewing key
    /// @param encryptedNote The encrypted note containing amount
    /// @return amount The decrypted amount
    function decryptAmount(
        bytes calldata viewingKey,
        bytes calldata encryptedNote
    ) external pure returns (uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Verify viewing key hash matches viewing key
    /// @param viewingKey The viewing key
    /// @param viewingKeyHash The claimed hash
    /// @return valid True if hash matches
    function verifyViewingKeyHash(
        bytes calldata viewingKey,
        bytes32 viewingKeyHash
    ) external pure returns (bool valid);

    /// @notice Compute viewing key hash
    /// @param viewingKey The viewing key bytes
    /// @return hash The SHA-256 hash
    function computeViewingKeyHash(
        bytes calldata viewingKey
    ) external pure returns (bytes32 hash);
}

/// @notice Stealth announcement for scanning
struct Announcement {
    address stealthAddress;
    bytes ephemeralPubKey;
    bytes encryptedNote;
    uint256 blockNumber;
}

/// @notice Match result from viewing key scan
struct ViewingMatch {
    address stealthAddress;
    bytes ephemeralPubKey;
    uint256 amount;
    address token;
    uint256 blockNumber;
    bytes32 txHash;
}
```

**TypeScript:**

```typescript
interface IViewingKeyProvider {
  // Viewing key generation
  deriveViewingKey(spendingPrivKey: HexString, type: ViewingKeyType): HexString
  deriveTimeLimitedViewingKey(
    spendingPrivKey: HexString,
    type: ViewingKeyType,
    validFrom: number,
    validUntil: number
  ): TimeLimitedViewingKey

  // Registration
  registerViewingKeyHash(viewingKeyHash: HexString): Promise<TxHash>
  isViewingKeyRegistered(account: HexString): Promise<{ registered: boolean; keyHash?: HexString }>
  revokeViewingKey(viewingKeyHash: HexString): Promise<TxHash>

  // Disclosure
  encryptViewingKeyForAuditor(viewingKey: HexString, auditorPubKey: HexString): HexString
  decryptViewingKey(encryptedKey: HexString, auditorPrivKey: HexString): HexString

  // Scanning
  scanWithViewingKey(viewingKey: HexString, announcements: Announcement[]): Promise<ViewingMatch[]>
  decryptAmount(viewingKey: HexString, encryptedNote: HexString): bigint

  // Verification
  verifyViewingKeyHash(viewingKey: HexString, viewingKeyHash: HexString): boolean
  computeViewingKeyHash(viewingKey: HexString): HexString
}

interface TimeLimitedViewingKey {
  key: HexString
  type: ViewingKeyType
  validFrom: number
  validUntil: number
  signature: HexString  // Proves time bounds authenticity
}

interface Announcement {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  encryptedNote: HexString
  blockNumber: number
  txHash?: HexString
}

interface ViewingMatch {
  stealthAddress: HexString
  ephemeralPublicKey: HexString
  amount: bigint
  token: HexString
  blockNumber: number
  txHash: HexString
  timestamp?: number
}

type TxHash = HexString
```

#### 7.7 Events

Standard events that SIP implementations MUST emit:

```solidity
/// @notice Emitted when a shielded transfer occurs
/// @param commitment Amount commitment (indexed for filtering)
/// @param stealthAddress Recipient's stealth address (indexed)
/// @param ephemeralPubKey Ephemeral public key for recipient scanning
/// @param encryptedNote Encrypted transaction metadata
event ShieldedTransfer(
    bytes32 indexed commitment,
    address indexed stealthAddress,
    bytes ephemeralPubKey,
    bytes encryptedNote
);

/// @notice Emitted when a viewing key is registered
/// @param account The account registering the key (indexed)
/// @param viewingKeyHash Hash of the viewing key (indexed)
/// @param keyType Type of viewing key registered
event ViewingKeyRegistered(
    address indexed account,
    bytes32 indexed viewingKeyHash,
    ViewingKeyType keyType
);

/// @notice Emitted when a viewing key is revoked
/// @param account The account revoking the key
/// @param viewingKeyHash Hash of the revoked key
event ViewingKeyRevoked(
    address indexed account,
    bytes32 indexed viewingKeyHash
);

/// @notice EIP-5564 compatible announcement
/// @param schemeId The stealth scheme ID (0 for SIP)
/// @param stealthAddress The generated stealth address
/// @param caller The transaction sender
/// @param ephemeralPubKey Ephemeral public key
/// @param metadata Additional encrypted data
event Announcement(
    uint256 indexed schemeId,
    address indexed stealthAddress,
    address indexed caller,
    bytes ephemeralPubKey,
    bytes metadata
);

/// @notice Emitted when provider is initialized
/// @param version Protocol version
/// @param chain Chain identifier
event ProviderInitialized(
    string version,
    string chain
);

/// @notice Emitted when transfer status changes
/// @param txId Transaction identifier
/// @param status New status
/// @param timestamp Block timestamp
event TransferStatusChanged(
    bytes32 indexed txId,
    TransferStatus status,
    uint256 timestamp
);
```

#### 7.8 Interface Inheritance Diagram

```
                    ┌─────────────────┐
                    │  ISIPVersioned  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│ ISIPProvider  │  │   ISIPWallet    │  │ IStealthAddressGenerator│
└───────────────┘  └─────────────────┘  └─────────────────────────┘
        │                    │                    │
        │                    │                    │
        ▼                    ▼                    │
┌───────────────────────────────────┐            │
│        IViewingKeyProvider        │◄───────────┘
└───────────────────────────────────┘
```

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
