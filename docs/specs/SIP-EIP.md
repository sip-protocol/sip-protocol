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

This section documents the canonical reference implementations, implementation considerations, and integration guidelines for SIP Protocol.

### 1. Canonical Implementations

#### 1.1 Primary Reference: TypeScript SDK

The canonical reference implementation is `@sip-protocol/sdk`:

| Package | Version | License | Repository |
|---------|---------|---------|------------|
| `@sip-protocol/sdk` | 0.6.x | MIT | [github.com/sip-protocol/sip-protocol](https://github.com/sip-protocol/sip-protocol) |

**Installation:**
```bash
npm install @sip-protocol/sdk
# or
pnpm add @sip-protocol/sdk
# or
yarn add @sip-protocol/sdk
```

**Key Modules:**
| Module | Description | File |
|--------|-------------|------|
| `stealth.ts` | Stealth address generation (EIP-5564) | `packages/sdk/src/stealth.ts` |
| `crypto.ts` | Pedersen commitments, cryptographic primitives | `packages/sdk/src/crypto.ts` |
| `privacy.ts` | Viewing keys, XChaCha20-Poly1305 encryption | `packages/sdk/src/privacy.ts` |
| `intent.ts` | IntentBuilder, ShieldedIntent creation | `packages/sdk/src/intent.ts` |
| `sip.ts` | Main SIP client class | `packages/sdk/src/sip.ts` |

#### 1.2 Multi-Language SDKs

| Language | Package | Status | Notes |
|----------|---------|--------|-------|
| **TypeScript** | `@sip-protocol/sdk` | Stable | Primary reference |
| **Rust** | `sip-protocol-rs` | Stable | High-performance, WASM target |
| **Python** | `sip-protocol-py` | Stable | Data science, scripting |
| **Go** | `github.com/sip-protocol/sip-protocol/sdks/go` | Stable | Backend services |

All implementations MUST pass the shared test vector suite (Appendix B).

### 2. Basic Usage Examples

#### 2.1 Initialize Client

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

// Basic initialization
const sip = new SIP()

// With configuration
const sip = new SIP({
  chain: 'ethereum',
  rpcUrl: 'https://eth.llamarpc.com',
  proofProvider: 'noir',  // 'noir' | 'mock'
})

// Wait for initialization (loads Noir circuits if needed)
await sip.waitUntilReady()
```

#### 2.2 Generate Stealth Address

```typescript
// Parse recipient's stealth meta-address
const metaAddress = 'sip:ethereum:0x02abc...123:0x03def...456'
const { spendingPublicKey, viewingPublicKey } = sip.parseStealthMetaAddress(metaAddress)

// Generate one-time stealth address
const { stealthAddress, ephemeralPublicKey } = await sip.generateStealthAddress(
  spendingPublicKey,
  viewingPublicKey
)

// stealthAddress: '0x1234...abcd' (use for this transaction only)
// ephemeralPublicKey: '0x02...' (include in transaction for recipient scanning)
```

#### 2.3 Create Shielded Transfer

```typescript
import { parseEther } from 'viem'

// Create and execute shielded transfer
const tx = await sip.transfer({
  to: stealthAddress,
  amount: parseEther('1.0'),
  privacyLevel: PrivacyLevel.SHIELDED,
  ephemeralPublicKey,
  token: '0x0000000000000000000000000000000000000000', // Native ETH
})

console.log('Transaction hash:', tx.hash)
console.log('Commitment:', tx.commitment)
```

#### 2.4 Scan for Incoming Payments

```typescript
// Recipient scans for payments to their stealth addresses
const payments = await sip.scan({
  spendingPrivateKey: recipientSpendingPrivKey,
  viewingPrivateKey: recipientViewingPrivKey,
  fromBlock: 12345678,
  toBlock: 'latest',
})

for (const payment of payments) {
  console.log('Found payment:')
  console.log('  Address:', payment.stealthAddress)
  console.log('  Amount:', payment.amount)
  console.log('  Token:', payment.token)

  // Derive private key to spend from this address
  const stealthPrivKey = await sip.deriveStealthPrivateKey(
    recipientSpendingPrivKey,
    recipientViewingPrivKey,
    payment.ephemeralPublicKey
  )
}
```

#### 2.5 Viewing Key Export

```typescript
// Export viewing key for auditor
const viewingKey = await sip.exportViewingKey({
  spendingPrivateKey: mySpendingPrivKey,
  type: 'incoming',  // 'incoming' | 'outgoing' | 'full'
})

// Optionally encrypt for specific auditor
const encryptedKey = await sip.encryptViewingKey(viewingKey, auditorPublicKey)

// Share encryptedKey with auditor
```

### 3. Platform-Specific Considerations

#### 3.1 Browser Environment

**Supported Browsers:**
| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 90+ | Full support |
| Firefox | 89+ | Full support |
| Safari | 15+ | WebCrypto polyfill may be needed |
| Edge | 90+ | Full support |

**Browser-Specific Configuration:**
```typescript
import { SIP, BrowserNoirProvider } from '@sip-protocol/sdk'

// Browser: Use BrowserNoirProvider for WASM-based proving
const sip = new SIP({
  chain: 'ethereum',
  proofProvider: new BrowserNoirProvider({
    // Pre-compiled circuits loaded from CDN or bundled
    circuitUrl: '/circuits/sip-circuits.wasm',
    // Optional: Use Web Worker for non-blocking proving
    useWorker: true,
  }),
})
```

**Bundle Size Optimization:**
```javascript
// Tree-shake unused modules
import { generateStealthAddress, createCommitment } from '@sip-protocol/sdk/stealth'
import { encryptNote, decryptNote } from '@sip-protocol/sdk/privacy'

// Avoid importing entire SDK if only using specific functions
// BAD:  import { SIP } from '@sip-protocol/sdk'  // ~500KB
// GOOD: import { ... } from '@sip-protocol/sdk/stealth'  // ~50KB
```

**Web Worker Integration:**
```typescript
// main.ts
const worker = new Worker(new URL('./sip-worker.ts', import.meta.url))

worker.postMessage({
  type: 'generateProof',
  params: { balance: 1000n, minimum: 100n, blinding: '0x...' }
})

worker.onmessage = (e) => {
  if (e.data.type === 'proofResult') {
    console.log('Proof:', e.data.proof)
  }
}

// sip-worker.ts
import { generateFundingProof } from '@sip-protocol/sdk/proofs'

self.onmessage = async (e) => {
  if (e.data.type === 'generateProof') {
    const proof = await generateFundingProof(e.data.params)
    self.postMessage({ type: 'proofResult', proof })
  }
}
```

#### 3.2 Node.js Environment

**Supported Versions:**
| Node.js | Status | Notes |
|---------|--------|-------|
| 18.x LTS | Supported | Minimum recommended |
| 20.x LTS | Supported | Best performance |
| 22.x | Supported | Latest features |

**Node.js-Specific Configuration:**
```typescript
import { SIP, NoirProvider } from '@sip-protocol/sdk'

// Node.js: Use native Noir provider for faster proving
const sip = new SIP({
  chain: 'ethereum',
  proofProvider: new NoirProvider({
    // Native Barretenberg backend (faster than WASM)
    backend: 'native',
    // Circuit compilation cache
    cacheDir: './circuits-cache',
  }),
})
```

**Performance Optimization:**
```typescript
// Enable native crypto for faster operations
import { setCryptoBackend } from '@sip-protocol/sdk/crypto'

// Use native secp256k1 bindings (2-5x faster than pure JS)
setCryptoBackend('native')  // Requires: npm install secp256k1
```

#### 3.3 React Native / Mobile

**Supported Platforms:**
| Platform | Status | Notes |
|----------|--------|-------|
| iOS 14+ | Supported | Requires Hermes engine |
| Android 8+ | Supported | Requires Hermes engine |

**Mobile Configuration:**
```typescript
import { SIP } from '@sip-protocol/react-native'

// React Native: Uses native modules for crypto
const sip = new SIP({
  chain: 'solana',
  // Native crypto module handles key operations
  cryptoBackend: 'native',
})
```

### 4. WASM and Noir Circuit Compilation

#### 4.1 Circuit Architecture

SIP ZK proofs use Noir circuits compiled to WASM:

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOIR CIRCUIT PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Source (.noir)  →  Compile (nargo)  →  ACIR  →  WASM/Native    │
│                                                                  │
│  circuits/                                                       │
│  ├── funding_proof.noir      (~22,000 constraints)               │
│  ├── validity_proof.noir     (~35,000 constraints)               │
│  └── fulfillment_proof.noir  (~28,000 constraints)               │
│                                                                  │
│  Compiled artifacts:                                             │
│  ├── funding_proof.json      (ACIR bytecode)                     │
│  ├── funding_proof.wasm      (Barretenberg WASM)                 │
│  └── funding_proof_vk.json   (Verification key)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2 Compiling Circuits

```bash
# Install Noir toolchain
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup

# Clone circuits repository
git clone https://github.com/sip-protocol/circuits
cd circuits

# Compile all circuits
nargo compile

# Generate verification keys
nargo codegen-verifier

# Build WASM artifacts for browser
./scripts/build-wasm.sh
```

#### 4.3 Loading Circuits in Application

```typescript
// Browser: Load pre-compiled WASM
import { BrowserNoirProvider } from '@sip-protocol/sdk'

const provider = new BrowserNoirProvider({
  circuits: {
    funding: await fetch('/circuits/funding_proof.wasm').then(r => r.arrayBuffer()),
    validity: await fetch('/circuits/validity_proof.wasm').then(r => r.arrayBuffer()),
    fulfillment: await fetch('/circuits/fulfillment_proof.wasm').then(r => r.arrayBuffer()),
  },
  verificationKeys: {
    funding: await fetch('/circuits/funding_proof_vk.json').then(r => r.json()),
    validity: await fetch('/circuits/validity_proof_vk.json').then(r => r.json()),
    fulfillment: await fetch('/circuits/fulfillment_proof_vk.json').then(r => r.json()),
  },
})

// Node.js: Compile on-demand or use cached
import { NoirProvider } from '@sip-protocol/sdk'

const provider = new NoirProvider({
  circuitPaths: {
    funding: './circuits/funding_proof',
    validity: './circuits/validity_proof',
    fulfillment: './circuits/fulfillment_proof',
  },
  // Cache compiled circuits for faster subsequent loads
  cacheDir: './circuits-cache',
})
```

### 5. Implementation Optimizations

#### 5.1 Scalar Multiplication Optimizations

Reference implementation uses the following optimizations:

```typescript
// GLV endomorphism for secp256k1 (2x speedup)
// Splits scalar k into k1 + k2*lambda where |k1|, |k2| ≈ √n
function glvMultiply(P: Point, k: bigint): Point {
  const [k1, k2] = splitScalar(k)
  const Q = endomorphism(P)  // Q = lambda * P (cheap)
  return multiScalarMul([P, Q], [k1, k2])  // Shamir's trick
}

// Windowed multiplication (w=4)
// Precompute: [0, P, 2P, 3P, ..., 15P]
// Reduces doublings by 75%
```

#### 5.2 Batch Verification

```typescript
// Batch verify multiple commitments (3-5x faster than individual)
import { batchVerifyCommitments } from '@sip-protocol/sdk'

const results = await batchVerifyCommitments([
  { commitment: c1, value: v1, blinding: b1 },
  { commitment: c2, value: v2, blinding: b2 },
  { commitment: c3, value: v3, blinding: b3 },
])
// results: [true, true, false]
```

#### 5.3 Lazy Initialization

```typescript
// Circuits are loaded lazily on first use
const sip = new SIP({ proofProvider: 'noir' })

// No circuit loading yet...
const address = await sip.generateStealthAddress(...)  // Fast, no circuits needed

// Circuit loaded on first proof generation
const proof = await sip.generateFundingProof(...)  // Loads circuit, then generates
```

### 6. Testing Requirements

#### 6.1 Test Coverage Expectations

| Component | Minimum Coverage | Current Coverage |
|-----------|------------------|------------------|
| Core cryptography | 95% | 98% |
| Stealth addresses | 90% | 95% |
| Commitments | 90% | 96% |
| Viewing keys | 85% | 92% |
| Integration tests | 80% | 88% |
| E2E tests | 75% | 82% |

#### 6.2 Test Suite Structure

```
packages/sdk/tests/
├── unit/
│   ├── crypto.test.ts          # Cryptographic primitives
│   ├── stealth.test.ts         # Stealth address generation
│   ├── commitment.test.ts      # Pedersen commitments
│   └── privacy.test.ts         # Viewing keys, encryption
├── integration/
│   ├── transfer.test.ts        # End-to-end transfers
│   ├── scanning.test.ts        # Payment scanning
│   └── proofs.test.ts          # ZK proof generation
├── e2e/
│   ├── ethereum.test.ts        # Ethereum mainnet fork
│   ├── solana.test.ts          # Solana devnet
│   └── cross-chain.test.ts     # Multi-chain scenarios
└── fixtures/
    └── test-vectors.json       # Shared test vectors (Appendix B)
```

#### 6.3 Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific suite
pnpm test -- tests/unit/stealth.test.ts

# Run E2E tests (requires network)
pnpm test:e2e
```

#### 6.4 Test Vector Validation

All implementations MUST validate against shared test vectors:

```typescript
import testVectors from './fixtures/test-vectors.json'

describe('Test Vector Compliance', () => {
  testVectors.stealthAddresses.forEach((vector, i) => {
    it(`stealth address vector ${i}`, () => {
      const result = generateStealthAddress(
        vector.spendingPubKey,
        vector.viewingPubKey,
        vector.ephemeralPrivKey  // Deterministic for testing
      )
      expect(result.stealthAddress).toBe(vector.expectedStealthAddress)
      expect(result.ephemeralPubKey).toBe(vector.expectedEphemeralPubKey)
    })
  })

  testVectors.commitments.forEach((vector, i) => {
    it(`commitment vector ${i}`, () => {
      const result = createCommitment(vector.value, vector.blinding)
      expect(result.commitment).toBe(vector.expectedCommitment)
    })
  })
})
```

### 7. Performance Benchmarks

#### 7.1 Cryptographic Operations

Benchmarks on Apple M2 Pro (Node.js 20, native crypto):

| Operation | Time (ms) | Notes |
|-----------|-----------|-------|
| Key pair generation | 0.3 | secp256k1 |
| Stealth address generation | 0.8 | Includes ECDH + hash |
| Stealth address scanning (1000 txs) | 450 | With GLV optimization |
| Commitment creation | 0.5 | Pedersen, random blinding |
| Commitment verification | 0.4 | Point comparison |
| Batch commitment verify (100) | 25 | ~4x faster than individual |
| Viewing key derivation | 0.2 | HKDF-SHA256 |
| Note encryption | 0.1 | XChaCha20-Poly1305 |
| Note decryption | 0.1 | XChaCha20-Poly1305 |

#### 7.2 ZK Proof Operations

Benchmarks on Apple M2 Pro (native Barretenberg):

| Proof Type | Generation (s) | Verification (ms) | Constraints |
|------------|----------------|-------------------|-------------|
| Funding Proof | 2.1 | 15 | ~22,000 |
| Validity Proof | 3.5 | 18 | ~35,000 |
| Fulfillment Proof | 2.8 | 16 | ~28,000 |

**Browser Performance (WASM):**
| Proof Type | Generation (s) | Verification (ms) |
|------------|----------------|-------------------|
| Funding Proof | 4.5 | 25 |
| Validity Proof | 7.2 | 32 |
| Fulfillment Proof | 5.8 | 28 |

#### 7.3 Memory Usage

| Operation | Peak Memory | Notes |
|-----------|-------------|-------|
| SDK initialization | 15 MB | Without circuits |
| With Noir circuits | 80 MB | All circuits loaded |
| Proof generation | +50 MB | During proving |
| Batch scan (10K txs) | 120 MB | Streaming recommended for larger |

### 8. Deployment Guidelines

#### 8.1 Production Checklist

```
□ Security
  □ Use production RPC endpoints (not public endpoints)
  □ Enable rate limiting on API endpoints
  □ Implement request signing/authentication
  □ Set up monitoring and alerting
  □ Configure secure key storage (HSM/KMS)

□ Performance
  □ Enable circuit caching
  □ Use native crypto backend in Node.js
  □ Configure connection pooling for RPC
  □ Set appropriate timeouts

□ Reliability
  □ Implement retry logic with exponential backoff
  □ Use multiple RPC providers with fallback
  □ Set up health checks
  □ Configure graceful shutdown

□ Compliance
  □ Log all viewing key disclosures
  □ Implement audit trail for transfers
  □ Configure data retention policies
```

#### 8.2 Environment Configuration

```typescript
// Production configuration
const sip = new SIP({
  chain: 'ethereum',
  rpcUrl: process.env.ETH_RPC_URL,
  proofProvider: new NoirProvider({
    backend: 'native',
    cacheDir: '/var/cache/sip-circuits',
    maxConcurrency: 4,
  }),
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
  },
  timeout: 30000,
})
```

#### 8.3 Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-slim

# Install native dependencies for crypto
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copy application
COPY . .

# Pre-compile circuits
RUN pnpm run compile-circuits

# Build application
RUN pnpm build

# Run
CMD ["node", "dist/server.js"]
```

#### 8.4 Monitoring Integration

```typescript
import { SIP, SIPEvents } from '@sip-protocol/sdk'
import { metrics } from './metrics'  // Your metrics library

const sip = new SIP({...})

// Monitor proof generation times
sip.on(SIPEvents.PROOF_STARTED, ({ type }) => {
  metrics.startTimer(`sip_proof_generation_${type}`)
})

sip.on(SIPEvents.PROOF_COMPLETED, ({ type, success }) => {
  metrics.endTimer(`sip_proof_generation_${type}`)
  metrics.increment(`sip_proofs_${success ? 'success' : 'failure'}`, { type })
})

// Monitor transfer operations
sip.on(SIPEvents.TRANSFER_SUBMITTED, ({ txId }) => {
  metrics.increment('sip_transfers_submitted')
})

sip.on(SIPEvents.TRANSFER_CONFIRMED, ({ txId, confirmations }) => {
  metrics.increment('sip_transfers_confirmed')
})
```

### 9. Integration Examples

#### 9.1 React Integration

```tsx
import { SIPProvider, useSIP, useStealthAddress } from '@sip-protocol/react'

// Wrap app with provider
function App() {
  return (
    <SIPProvider config={{ chain: 'ethereum' }}>
      <PaymentForm />
    </SIPProvider>
  )
}

// Use hooks in components
function PaymentForm() {
  const { isReady, transfer } = useSIP()
  const { generate, stealthAddress, ephemeralPubKey } = useStealthAddress()

  const handlePay = async (recipient: string, amount: bigint) => {
    const meta = parseStealthMetaAddress(recipient)
    await generate(meta.spendingPubKey, meta.viewingPubKey)

    await transfer({
      to: stealthAddress,
      amount,
      privacyLevel: 'shielded',
      ephemeralPubKey,
    })
  }

  return (
    <button onClick={() => handlePay(recipient, amount)} disabled={!isReady}>
      Send Private Payment
    </button>
  )
}
```

#### 9.2 Express.js Backend

```typescript
import express from 'express'
import { SIP } from '@sip-protocol/sdk'

const app = express()
const sip = new SIP({ chain: 'ethereum', proofProvider: 'noir' })

// Initialize on startup
await sip.waitUntilReady()

app.post('/api/generate-stealth-address', async (req, res) => {
  const { spendingPubKey, viewingPubKey } = req.body

  const result = await sip.generateStealthAddress(spendingPubKey, viewingPubKey)

  res.json({
    stealthAddress: result.stealthAddress,
    ephemeralPublicKey: result.ephemeralPublicKey,
  })
})

app.post('/api/scan-payments', async (req, res) => {
  const { viewingKey, fromBlock } = req.body

  const payments = await sip.scanWithViewingKey(viewingKey, { fromBlock })

  res.json({ payments })
})

app.listen(3000)
```

### 10. Implementation-Defined Behavior

The following behaviors are implementation-defined and MAY vary:

| Behavior | Specification | Reference Implementation |
|----------|---------------|-------------------------|
| RNG source | CSPRNG required | `crypto.getRandomValues` / `crypto.randomBytes` |
| Default timeout | Implementation choice | 30 seconds |
| Retry policy | Implementation choice | 3 retries, exponential backoff |
| Circuit cache location | Implementation choice | `~/.sip/circuits-cache` |
| Log format | Implementation choice | JSON structured logging |
| Error message detail | Implementation choice | Detailed in development, minimal in production |

## Security Considerations

This section provides a comprehensive security analysis of SIP, covering threat models, attack vectors, mitigations, and implementation requirements. Implementers MUST carefully review this section to ensure secure deployments.

### 1. Threat Model

#### 1.1 Adversary Capabilities

SIP considers adversaries with the following capabilities:

| Adversary Type | Capabilities | Threat Level |
|----------------|--------------|--------------|
| **Passive Observer** | Monitor public blockchain data, network traffic | High |
| **Active Attacker** | Submit malicious transactions, front-run | Medium |
| **Compromised Service** | Control RPC nodes, indexers, or relayers | Medium |
| **State-Level Actor** | Network surveillance, legal compulsion | High |
| **Quantum Adversary** | Future quantum computer access | Future |

#### 1.2 Threat Model Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SIP THREAT MODEL                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    NETWORK LAYER THREATS                              │   │
│  │  • IP address correlation        • Traffic analysis                   │   │
│  │  • Timing correlation            • Node fingerprinting                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                   APPLICATION LAYER THREATS                           │   │
│  │  • Malicious dApps               • Phishing attacks                   │   │
│  │  • SDK vulnerabilities           • Wallet exploits                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                   PROTOCOL LAYER THREATS                              │   │
│  │  • Stealth address reuse         • Viewing key compromise             │   │
│  │  • Commitment manipulation       • Proof forgery                      │   │
│  │  • Front-running                 • Replay attacks                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                  CRYPTOGRAPHIC LAYER THREATS                          │   │
│  │  • DLP breakthrough              • Weak randomness                    │   │
│  │  • Side-channel leakage          • Quantum attacks (future)           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  TRUST ASSUMPTIONS                                                    │   │
│  │  ✓ Users control their private keys                                   │   │
│  │  ✓ Cryptographic primitives are secure                                │   │
│  │  ✓ Random number generation is unpredictable                          │   │
│  │  ✗ Network layer provides anonymity (NOT assumed)                     │   │
│  │  ✗ Third-party services are honest (NOT assumed)                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Cryptographic Assumptions

SIP security relies on the following hardness assumptions:

#### 2.1 Core Assumptions

| Assumption | Description | Affected Components |
|------------|-------------|---------------------|
| **Discrete Logarithm Problem (DLP)** | Given `G` and `P = p·G`, computing `p` is infeasible | Stealth addresses, key pairs |
| **Computational Diffie-Hellman (CDH)** | Given `G`, `aG`, `bG`, computing `abG` is infeasible | Shared secret derivation |
| **Decisional Diffie-Hellman (DDH)** | Cannot distinguish `(G, aG, bG, abG)` from random | Stealth address unlinkability |
| **Random Oracle Model (ROM)** | Hash functions behave as random oracles | Domain separation, key derivation |

#### 2.2 Pedersen Commitment Security

**Binding Property** (Computational):
- Cannot find `(v, r)` and `(v', r')` where `v ≠ v'` but `C(v,r) = C(v',r')`
- Relies on: Unknown discrete log of `H` with respect to `G`
- Breaks if: `log_G(H)` is known (attacker can open to any value)

**Hiding Property** (Information-Theoretic):
- Given commitment `C`, all values `v` are equally likely
- Unconditional: Even unbounded adversaries cannot determine `v`
- Relies on: Uniform random blinding factor `r`

#### 2.3 Security Parameters

| Parameter | Recommended | Minimum | Notes |
|-----------|-------------|---------|-------|
| Curve security level | 128-bit | 128-bit | secp256k1, ed25519 |
| Hash output size | 256-bit | 256-bit | SHA-256, Keccak-256 |
| Blinding factor entropy | 256-bit | 128-bit | CSPRNG required |
| Key derivation iterations | N/A | N/A | HKDF-SHA256 |

### 3. Stealth Address Security

#### 3.1 Stealth Address Reuse Risks

**Risk Level:** HIGH

**Description:** Reusing a stealth address for multiple payments breaks unlinkability and reveals the recipient.

**Attack Scenario:**
```
1. Alice sends 1 ETH to Bob's stealth address S1
2. Bob withdraws from S1 to his main address M
3. Carol sends 2 ETH to the SAME address S1
4. Observer links: S1 ← Bob's address M
5. Bob's receipt of Carol's payment is now PUBLIC
```

**Mitigations:**
1. **MUST** generate unique stealth address per transaction
2. **MUST** use fresh ephemeral key for each generation
3. **SHOULD** implement address freshness checks in wallets
4. **SHOULD NOT** display stealth addresses to users (use meta-address instead)

**Implementation Requirement:**
```typescript
// CORRECT: Generate fresh address each time
async function sendToRecipient(metaAddress: string, amount: bigint) {
  const { stealthAddress, ephemeralPubKey } = await generateStealthAddress(
    parseMetaAddress(metaAddress).spendingPubKey,
    parseMetaAddress(metaAddress).viewingPubKey
  )
  // Use stealthAddress for THIS transaction only
}

// WRONG: Caching or reusing stealth addresses
const cachedAddress = await generateStealthAddress(...) // NEVER DO THIS
await send(cachedAddress, amount1)
await send(cachedAddress, amount2)  // SECURITY VULNERABILITY
```

#### 3.2 Ephemeral Key Security

**Risk Level:** MEDIUM

**Description:** Weak or predictable ephemeral keys compromise stealth address privacy.

**Requirements:**
1. **MUST** generate ephemeral private key from CSPRNG with ≥256 bits entropy
2. **MUST NOT** derive ephemeral key from deterministic sources (timestamps, counters)
3. **MUST** securely delete ephemeral private key after use (sender-side)
4. **SHOULD** use memory-safe key handling (zeroize on drop)

**Weak Ephemeral Key Attack:**
```
If ephemeral key r is predictable:
1. Attacker knows r → can compute R = r·G
2. Attacker observes recipient meta-address (P, Q)
3. Attacker computes: S = r·P (shared secret)
4. Attacker derives stealth address and LINKS payments
```

#### 3.3 Stealth Address Scanning Privacy

**Risk Level:** LOW-MEDIUM

**Description:** Scanning for stealth payments may leak information to RPC providers.

**Mitigations:**
1. **SHOULD** use private RPC nodes or Tor-routed connections
2. **SHOULD** batch scanning requests to avoid timing correlation
3. **MAY** use oblivious transfer protocols for enhanced privacy
4. **SHOULD** scan broader ranges than necessary (padding)

### 4. Viewing Key Security

#### 4.1 Viewing Key Compromise Scenarios

**Risk Level:** HIGH

**Scenario 1: Full Viewing Key Compromise**
```
Impact: ALL historical and future incoming transactions revealed
Scope:  Complete loss of recipient privacy for that key
```

**Scenario 2: Time-Limited Key Compromise**
```
Impact: Transactions within validity window revealed
Scope:  Limited to specified time range
```

**Scenario 3: Auditor Key Leakage**
```
Impact: Auditor's view of user transactions exposed
Scope:  All transactions disclosed to that auditor
```

#### 4.2 Viewing Key Hierarchy

To limit exposure, SIP supports hierarchical viewing keys:

```
                    ┌─────────────────────┐
                    │   Master Spending   │
                    │       Key           │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Master Viewing    │
                    │       Key           │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  Incoming   │     │  Outgoing   │     │   Auditor   │
    │  View Key   │     │  View Key   │     │   View Key  │
    └─────────────┘     └─────────────┘     └─────────────┘
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ Time-Limited│     │ Time-Limited│     │ Time-Limited│
    │   Subkey    │     │   Subkey    │     │   Subkey    │
    └─────────────┘     └─────────────┘     └─────────────┘
```

#### 4.3 Viewing Key Rotation

**Recommendation:** Rotate viewing keys periodically or upon suspected compromise.

**Rotation Process:**
1. Generate new viewing key pair
2. Register new viewing key hash on-chain
3. Revoke old viewing key registration
4. Re-encrypt any stored viewing keys for auditors
5. Old keys can still decrypt historical transactions

**Grace Period:** Allow 30-day overlap for auditors to transition.

#### 4.4 Forward Secrecy Considerations

**Limitation:** SIP viewing keys do NOT provide forward secrecy.

If a viewing key is compromised:
- Past transactions are retroactively visible
- Future transactions remain visible until key rotation

**Mitigation:** Use time-limited viewing keys for sensitive disclosures.

### 5. Timing Attack Vectors

#### 5.1 Proof Generation Timing

**Risk Level:** LOW-MEDIUM

**Description:** Variable proof generation time may leak information about inputs.

**Attack Scenario:**
```
1. Attacker measures time to generate commitment/proof
2. Different values/blinding factors may take different time
3. Statistical analysis correlates timing with value ranges
```

**Mitigations:**
1. **MUST** use constant-time scalar multiplication
2. **MUST** use constant-time modular arithmetic
3. **SHOULD** add random delays to normalize timing
4. **SHOULD** use constant-time comparison for verification

**Implementation Checklist:**
- [ ] Scalar multiplication: Montgomery ladder or similar
- [ ] Modular reduction: Barrett/Montgomery reduction
- [ ] Conditional operations: Branchless implementations
- [ ] Memory access: Cache-timing resistant patterns

#### 5.2 Transaction Timing Correlation

**Risk Level:** MEDIUM

**Description:** Timing of shielded transactions may correlate with public activity.

**Attack Scenario:**
```
1. User receives public payment at time T
2. User sends shielded payment at time T+Δ
3. If Δ is consistent, attacker links public→shielded
```

**Mitigations:**
1. **SHOULD** add random delays between related transactions
2. **SHOULD** batch transactions with other users (if available)
3. **MAY** use scheduled/queued transaction submission
4. **SHOULD NOT** immediately move funds after receiving them

#### 5.3 Network Timing Analysis

**Risk Level:** MEDIUM

**Description:** Network-level timing can link sender/recipient even with encryption.

**Mitigations:**
1. **SHOULD** use Tor or VPN for transaction submission
2. **SHOULD** use different network paths for send vs. receive
3. **MAY** use mix networks for transaction relay
4. **SHOULD** implement transaction batching at relayer level

### 6. Metadata Leakage

#### 6.1 On-Chain Metadata

**Leaked Information:**
| Metadata | Privacy Impact | Mitigation |
|----------|----------------|------------|
| Transaction timestamp | Activity timing visible | Delayed submission |
| Gas price | Economic behavior visible | Standard gas pricing |
| Contract interactions | Protocol usage visible | Proxy contracts |
| Token type | Asset class visible | Multi-asset pools |
| Transaction size | Approximate amount range | Padding, fixed sizes |

#### 6.2 Encrypted Note Security

**Risk Level:** MEDIUM

**Description:** Encrypted notes may leak information through size, format, or encryption artifacts.

**Requirements:**
1. **MUST** use authenticated encryption (XChaCha20-Poly1305)
2. **MUST** pad notes to fixed size (recommended: 256 bytes)
3. **MUST** use unique nonce per encryption
4. **SHOULD** include random padding in plaintext
5. **MUST NOT** include identifiable plaintext patterns

**Encrypted Note Format:**
```
┌────────────────────────────────────────────────────────────┐
│  ENCRYPTED NOTE FORMAT (256 bytes fixed)                   │
├────────────────────────────────────────────────────────────┤
│  [Nonce: 24 bytes]                                         │
│  [Ciphertext: 200 bytes padded]                            │
│    - Amount: 32 bytes                                      │
│    - Token: 20 bytes                                       │
│    - Memo: up to 128 bytes                                 │
│    - Random padding: remaining bytes                       │
│  [Auth Tag: 16 bytes]                                      │
│  [Version: 2 bytes]                                        │
│  [Reserved: 14 bytes]                                      │
└────────────────────────────────────────────────────────────┘
```

#### 6.3 Side-Channel Metadata

**Risk Level:** MEDIUM-HIGH

| Side Channel | Information Leaked | Mitigation |
|--------------|-------------------|------------|
| IP address | Geographic location | Tor, VPN |
| Browser fingerprint | Device identity | Tor browser |
| Wallet address reuse | Identity linkage | Fresh addresses |
| RPC node logs | Transaction history | Private nodes |
| ENS/naming services | Identity association | Avoid for private txs |

### 7. Key Derivation Security

#### 7.1 Key Derivation Requirements

**MUST implement:**
```
SpendingKeyPair:
  private = CSPRNG(32 bytes)
  public  = private · G

ViewingKeyPair:
  private = HKDF-SHA256(
    ikm   = spending_private,
    salt  = "SIP-VIEWING-KEY-DERIVATION",
    info  = "viewing-key-v1",
    len   = 32
  )
  public = private · G
```

#### 7.2 Entropy Requirements

| Key Type | Minimum Entropy | Source |
|----------|-----------------|--------|
| Spending private key | 256 bits | CSPRNG |
| Viewing private key | Derived | HKDF from spending |
| Ephemeral private key | 256 bits | CSPRNG |
| Blinding factor | 256 bits | CSPRNG |

**CSPRNG Requirements:**
- Use platform-provided CSPRNG (e.g., `crypto.getRandomValues`, `/dev/urandom`)
- **NEVER** use `Math.random()` or similar PRNGs
- Test entropy quality in production environments
- Implement entropy health monitoring

#### 7.3 Key Storage Security

**Spending Keys (CRITICAL):**
1. **MUST** encrypt at rest with user-derived key
2. **MUST** use secure enclave/HSM when available
3. **SHOULD** support hardware wallet storage
4. **MUST** implement secure deletion on key rotation

**Viewing Keys (SENSITIVE):**
1. **SHOULD** encrypt at rest
2. **MAY** be stored with lower security than spending keys
3. **MUST** track all viewing key disclosures
4. **SHOULD** implement access logging

### 8. Compliance vs. Privacy Tradeoffs

#### 8.1 Privacy Levels Analysis

| Level | Privacy | Compliance | Use Case |
|-------|---------|------------|----------|
| **TRANSPARENT** | None | Full | Public treasury, grants |
| **SHIELDED** | Maximum | None | Personal transactions |
| **COMPLIANT** | Selective | Auditable | Institutional use |

#### 8.2 Selective Disclosure Matrix

```
                    ┌─────────────────────────────────────────────┐
                    │         SELECTIVE DISCLOSURE MATRIX         │
                    ├─────────────────────────────────────────────┤
                    │                                             │
                    │   Information      Viewing Key Type         │
                    │   Disclosed    INCOMING  OUTGOING  FULL     │
                    │   ──────────   ────────  ────────  ────     │
                    │   Amounts         ✓         ✓        ✓      │
                    │   Sender          ✗         ✓        ✓      │
                    │   Recipient       ✓         ✗        ✓      │
                    │   Timestamps      ✓         ✓        ✓      │
                    │   Token type      ✓         ✓        ✓      │
                    │   Tx history      Partial   Partial  Full   │
                    │                                             │
                    └─────────────────────────────────────────────┘
```

#### 8.3 Regulatory Considerations

**AML/KYC Compatibility:**
- Viewing keys enable compliance without breaking privacy for uninvolved parties
- Time-limited keys allow audit windows without permanent exposure
- Auditor-encrypted keys enable secure key custody

**FATF Travel Rule:**
- Encrypted notes can include required originator/beneficiary data
- Only authorized parties can decrypt (regulated entities)
- Privacy preserved for non-regulated transactions

**GDPR/Data Protection:**
- Users control their viewing keys (data sovereignty)
- Right to be forgotten: Viewing keys can be rotated
- Data minimization: Only required data in encrypted notes

#### 8.4 Tradeoff Recommendations

| Use Case | Recommended Level | Viewing Key Strategy |
|----------|-------------------|---------------------|
| Personal payments | SHIELDED | No disclosure |
| Business expenses | COMPLIANT | Time-limited to accountant |
| Institutional trading | COMPLIANT | Full key to compliance team |
| Charitable donations | COMPLIANT | Incoming key to donor for tax |
| Salary payments | COMPLIANT | Outgoing key to employer |

### 9. Implementation Security Requirements

#### 9.1 Mandatory Requirements

Implementations **MUST**:

1. **Cryptographic Operations**
   - Use constant-time implementations for all secret-dependent operations
   - Validate all curve points are on the curve
   - Reject points at infinity and low-order points
   - Use secure random number generation (CSPRNG)

2. **Key Management**
   - Encrypt private keys at rest
   - Implement secure key deletion (memory zeroization)
   - Support hardware wallet integration
   - Log all viewing key disclosures

3. **Input Validation**
   - Validate all public inputs before processing
   - Check commitment formats and ranges
   - Verify stealth meta-address syntax
   - Sanitize encrypted note contents

4. **Error Handling**
   - Use constant-time error responses
   - Avoid leaking information in error messages
   - Implement rate limiting on sensitive operations
   - Log security-relevant events

#### 9.2 Recommended Practices

Implementations **SHOULD**:

1. **Network Privacy**
   - Support Tor/VPN connectivity options
   - Implement transaction batching
   - Use multiple RPC endpoints
   - Add timing jitter to operations

2. **Defense in Depth**
   - Implement multiple validation layers
   - Use memory-safe languages where possible
   - Regular security audits
   - Bug bounty programs

3. **User Education**
   - Warn about privacy limitations
   - Explain viewing key implications
   - Guide secure key backup
   - Recommend privacy-preserving practices

#### 9.3 Security Audit Checklist

```
□ Cryptographic implementation review
  □ Constant-time operations verified
  □ RNG quality tested
  □ Key derivation follows spec
  □ Commitment scheme correctly implemented

□ Key management review
  □ Secure storage implemented
  □ Key deletion verified
  □ Access controls enforced
  □ Audit logging functional

□ Protocol implementation review
  □ All interfaces match specification
  □ Error handling consistent
  □ Input validation complete
  □ Event emissions correct

□ Integration security review
  □ Network privacy measures
  □ Third-party dependency audit
  □ API security review
  □ Frontend security (if applicable)
```

### 10. Future Security Considerations

#### 10.1 Quantum Resistance

**Timeline:** 10-20 years for cryptographically-relevant quantum computers

**Vulnerable Components:**
- Elliptic curve operations (stealth addresses, commitments)
- ECDH key exchange

**Migration Path:**
1. **Short-term:** Increase key sizes within classical schemes
2. **Medium-term:** Hybrid schemes (classical + post-quantum)
3. **Long-term:** Full transition to post-quantum cryptography

**Recommended Post-Quantum Alternatives:**
- Key exchange: Kyber (NIST standard)
- Signatures: Dilithium, SPHINCS+
- Commitments: Lattice-based schemes

#### 10.2 Quantum-Resistant Storage (WOTS+)

For long-term key protection, SIP recommends WOTS+ (Winternitz One-Time Signature) vaults:

```
┌─────────────────────────────────────────────────────────────────┐
│                 QUANTUM-RESISTANT VAULT DESIGN                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Classical Layer (Current)                                       │
│  ├── secp256k1 stealth addresses                                 │
│  ├── Pedersen commitments                                        │
│  └── Ed25519 signatures                                          │
│                                                                  │
│  Quantum-Resistant Layer (Future-Proof Storage)                  │
│  ├── WOTS+ signatures for vault access                           │
│  ├── Hash-based key derivation                                   │
│  └── Commitment to classical keys                                │
│                                                                  │
│  Migration: Funds can be moved from classical to QR vault        │
│             when quantum threat becomes imminent                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

See `QUANTUM-RESISTANT-STORAGE.md` for detailed specification.

### 11. Security Guarantees Summary

#### 11.1 What SIP Provides

| Guarantee | Strength | Condition |
|-----------|----------|-----------|
| **Recipient Privacy** | Strong | Fresh stealth address per tx |
| **Amount Privacy** | Perfect | Uniform random blinding |
| **Sender Privacy** | Medium | Fresh ephemeral keys |
| **Unlinkability** | Strong | No address/timing correlation |
| **Compliance Capability** | Strong | Viewing key not compromised |

#### 11.2 What SIP Does NOT Provide

| Non-Guarantee | Reason | Mitigation |
|---------------|--------|------------|
| **Network anonymity** | Out of scope | Use Tor/VPN |
| **Traffic analysis resistance** | Out of scope | Batching, delays |
| **Forward secrecy** | Viewing key design | Time-limited keys |
| **Post-quantum security** | Classical cryptography | Migration path |
| **Implementation security** | Varies by implementation | Audits required |

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
