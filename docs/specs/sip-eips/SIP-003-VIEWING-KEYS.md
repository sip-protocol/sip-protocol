# SIP-003: Viewing Key Standard

```
SIP: 003
Title: Viewing Key Standard for Selective Disclosure
Author: SIP Protocol Team <team@sip-protocol.org>
Status: Draft
Type: Standards Track
Category: Core
Created: 2026-01-21
Requires: SIP-002
Required by: SIP-001
```

## Abstract

This SIP defines the viewing key standard for the Shielded Intents Protocol. Viewing keys enable selective disclosure of private transaction details to authorized parties (auditors, regulators, tax authorities) while maintaining privacy from the general public. This creates a compliance-friendly privacy solution for institutional adoption.

## Motivation

Privacy without accountability creates regulatory friction:

1. **Regulatory Compliance**: Financial institutions must comply with AML/KYC regulations
2. **Tax Reporting**: Users need to prove transaction history for tax purposes
3. **Audit Requirements**: Organizations require internal/external audit capabilities
4. **Legal Discovery**: Court orders may require transaction disclosure

Existing privacy solutions offer binary choice: full privacy OR full transparency. Viewing keys enable a middle ground: **privacy by default, disclosure by choice**.

### Use Cases

| Scenario | Viewing Key Type | Disclosed To |
|----------|------------------|--------------|
| Tax filing | Full | Tax authority |
| AML compliance | Incoming | Compliance team |
| Internal audit | Full | Auditors |
| Court order | Specific tx | Legal authorities |
| Transparency report | Outgoing | Public |

## Specification

### 1. Viewing Key Types

SIP defines three types of viewing keys with different disclosure capabilities:

```typescript
type ViewingKeyType = 'incoming' | 'outgoing' | 'full'

interface ViewingKey {
  type: ViewingKeyType
  privateKey: HexString32
  publicKey: CompressedPublicKey
  capabilities: ViewingCapability[]
}

type ViewingCapability =
  | 'scan_incoming'      // Detect incoming payments
  | 'scan_outgoing'      // Detect outgoing payments
  | 'reveal_amounts'     // Decrypt committed amounts
  | 'reveal_senders'     // Identify payment senders
  | 'reveal_recipients'  // Identify payment recipients
  | 'reveal_memos'       // Decrypt attached memos
```

#### 1.1 Capability Matrix

| Capability | Incoming Key | Outgoing Key | Full Key |
|------------|--------------|--------------|----------|
| scan_incoming | Yes | No | Yes |
| scan_outgoing | No | Yes | Yes |
| reveal_amounts | Yes (incoming) | Yes (outgoing) | Yes |
| reveal_senders | No | Yes | Yes |
| reveal_recipients | Yes | No | Yes |
| reveal_memos | Yes | Yes | Yes |

### 2. Key Derivation

#### 2.1 From Master Viewing Key

```
FUNCTION deriveViewingKeys(masterViewingKey: bytes32) -> ViewingKeySet:

    // Incoming viewing key
    incomingKey = HKDF(masterViewingKey, "sip-viewing-incoming", 32)

    // Outgoing viewing key
    outgoingKey = HKDF(masterViewingKey, "sip-viewing-outgoing", 32)

    // Full viewing key = master key (has both capabilities)
    fullKey = masterViewingKey

    RETURN {
        incoming: {
            type: 'incoming',
            privateKey: incomingKey,
            publicKey: derivePublicKey(incomingKey),
            capabilities: ['scan_incoming', 'reveal_amounts', 'reveal_recipients', 'reveal_memos']
        },
        outgoing: {
            type: 'outgoing',
            privateKey: outgoingKey,
            publicKey: derivePublicKey(outgoingKey),
            capabilities: ['scan_outgoing', 'reveal_amounts', 'reveal_senders', 'reveal_memos']
        },
        full: {
            type: 'full',
            privateKey: fullKey,
            publicKey: derivePublicKey(fullKey),
            capabilities: ['scan_incoming', 'scan_outgoing', 'reveal_amounts', 'reveal_senders', 'reveal_recipients', 'reveal_memos']
        }
    }
```

#### 2.2 Hierarchical Derivation

For time-bounded or scoped viewing keys:

```
FUNCTION deriveTimeBoundedKey(
    masterKey: bytes32,
    startTime: number,
    endTime: number
) -> TimeBoundedViewingKey:

    // Create time-specific key
    timeScope = encode(startTime, endTime)
    scopedKey = HKDF(masterKey, "sip-time-" + timeScope, 32)

    RETURN {
        privateKey: scopedKey,
        publicKey: derivePublicKey(scopedKey),
        validFrom: startTime,
        validUntil: endTime
    }
```

### 3. Viewing Key Hash

For compliant transactions, viewing keys are discoverable via hash:

```
FUNCTION computeViewingKeyHash(viewingPublicKey: CompressedPublicKey) -> HexString32:

    // Hash the raw key bytes, not hex string
    keyBytes = hexToBytes(viewingPublicKey)
    hash = SHA256(keyBytes)

    RETURN "0x" + hash.toHex()
```

**Important:** Hash raw bytes, not hex string representation.

### 4. Encrypted Viewing Key Sharing

#### 4.1 Sharing Protocol

```
FUNCTION shareViewingKey(
    viewingKey: ViewingKey,
    recipientPublicKey: CompressedPublicKey
) -> EncryptedViewingKeyPackage:

    // Generate ephemeral key for ECDH
    ephemeralPrivateKey = secureRandom(32)
    ephemeralPublicKey = derivePublicKey(ephemeralPrivateKey)

    // ECDH shared secret
    sharedSecret = ECDH(ephemeralPrivateKey, recipientPublicKey)

    // Derive encryption key
    encryptionKey = HKDF(sharedSecret, "sip-vk-encryption", 32)

    // Encrypt viewing key with XChaCha20-Poly1305
    nonce = secureRandom(24)
    payload = encode({
        type: viewingKey.type,
        privateKey: viewingKey.privateKey,
        capabilities: viewingKey.capabilities
    })

    ciphertext = XChaCha20Poly1305.encrypt(encryptionKey, nonce, payload)

    RETURN {
        version: 1,
        ephemeralPublicKey: ephemeralPublicKey,
        nonce: nonce,
        ciphertext: ciphertext,
        metadata: {
            createdAt: currentTimestamp(),
            expiresAt: NULL  // Optional expiration
        }
    }
```

#### 4.2 Decryption Protocol

```
FUNCTION decryptViewingKey(
    package: EncryptedViewingKeyPackage,
    recipientPrivateKey: bytes32
) -> ViewingKey:

    // ECDH shared secret
    sharedSecret = ECDH(recipientPrivateKey, package.ephemeralPublicKey)

    // Derive encryption key
    encryptionKey = HKDF(sharedSecret, "sip-vk-encryption", 32)

    // Decrypt
    payload = XChaCha20Poly1305.decrypt(
        encryptionKey,
        package.nonce,
        package.ciphertext
    )

    decoded = decode(payload)

    RETURN {
        type: decoded.type,
        privateKey: decoded.privateKey,
        publicKey: derivePublicKey(decoded.privateKey),
        capabilities: decoded.capabilities
    }
```

### 5. Transaction Scanning

#### 5.1 Scanning with Incoming Key

```
FUNCTION scanIncoming(
    incomingViewingKey: bytes32,
    spendingPublicKey: CompressedPublicKey,
    announcements: StealthAnnouncement[]
) -> IncomingPayment[]:

    payments = []

    FOR announcement IN announcements:
        // Quick view tag check
        sharedSecret = ECDH(incomingViewingKey, announcement.ephemeralPublicKey)
        expectedViewTag = SHA256(sharedSecret)[0]

        IF expectedViewTag != announcement.viewTag:
            CONTINUE

        // Full derivation check
        scalar = SHA256(sharedSecret)
        expectedStealthPubKey = scalarMult(scalar, G) + spendingPublicKey
        expectedAddress = computeAddress(expectedStealthPubKey)

        IF expectedAddress == announcement.stealthAddress:
            payment = {
                stealthAddress: announcement.stealthAddress,
                ephemeralPublicKey: announcement.ephemeralPublicKey,
                stealthPrivateKey: scalarAdd(scalar, spendingPrivateKey),
                blockNumber: announcement.blockNumber,
                txHash: announcement.txHash
            }

            // Decrypt memo if present
            IF announcement.encryptedMemo:
                payment.memo = decryptMemo(sharedSecret, announcement.encryptedMemo)

            payments.push(payment)

    RETURN payments
```

#### 5.2 Scanning with Outgoing Key

```
FUNCTION scanOutgoing(
    outgoingViewingKey: bytes32,
    sentTransactions: SentTransaction[]
) -> OutgoingPayment[]:

    payments = []

    FOR tx IN sentTransactions:
        // Verify this was sent by us using outgoing key
        expectedEphemeralPubKey = deriveEphemeralKey(outgoingViewingKey, tx.nonce)

        IF tx.ephemeralPublicKey == expectedEphemeralPubKey:
            payment = {
                recipient: tx.recipientMetaAddress,
                stealthAddress: tx.stealthAddress,
                amount: decryptAmount(outgoingViewingKey, tx.encryptedAmount),
                timestamp: tx.timestamp
            }
            payments.push(payment)

    RETURN payments
```

### 6. Amount Disclosure

#### 6.1 Encrypted Amount Format

```typescript
interface EncryptedAmount {
  // Pedersen commitment
  commitment: CompressedPublicKey

  // Encrypted (amount, blinding factor) pair
  encryptedData: {
    nonce: HexString24
    ciphertext: HexString  // XChaCha20-Poly1305 encrypted
  }
}
```

#### 6.2 Amount Encryption

```
FUNCTION encryptAmount(
    amount: uint256,
    blindingFactor: bytes32,
    viewingPublicKey: CompressedPublicKey
) -> EncryptedAmount:

    // Create Pedersen commitment
    commitment = pedersenCommit(amount, blindingFactor)

    // Derive encryption key from viewing key
    ephemeralPrivateKey = secureRandom(32)
    sharedSecret = ECDH(ephemeralPrivateKey, viewingPublicKey)
    encryptionKey = HKDF(sharedSecret, "sip-amount-encryption", 32)

    // Encrypt amount and blinding factor
    payload = encode({
        amount: amount,
        blindingFactor: blindingFactor
    })

    nonce = secureRandom(24)
    ciphertext = XChaCha20Poly1305.encrypt(encryptionKey, nonce, payload)

    RETURN {
        commitment: commitment,
        encryptedData: {
            nonce: nonce,
            ciphertext: ciphertext,
            ephemeralPublicKey: derivePublicKey(ephemeralPrivateKey)
        }
    }
```

#### 6.3 Amount Decryption

```
FUNCTION decryptAmount(
    encryptedAmount: EncryptedAmount,
    viewingPrivateKey: bytes32
) -> { amount: uint256, blindingFactor: bytes32 }:

    // Derive encryption key
    sharedSecret = ECDH(viewingPrivateKey, encryptedAmount.encryptedData.ephemeralPublicKey)
    encryptionKey = HKDF(sharedSecret, "sip-amount-encryption", 32)

    // Decrypt
    payload = XChaCha20Poly1305.decrypt(
        encryptionKey,
        encryptedAmount.encryptedData.nonce,
        encryptedAmount.encryptedData.ciphertext
    )

    decoded = decode(payload)

    // Verify commitment
    expectedCommitment = pedersenCommit(decoded.amount, decoded.blindingFactor)
    REQUIRE(expectedCommitment == encryptedAmount.commitment, "Invalid commitment")

    RETURN decoded
```

### 7. Viewing Key Proofs

For proving viewing key ownership without revealing the key:

#### 7.1 Proof of Viewing Key Ownership

```
FUNCTION proveViewingKeyOwnership(
    viewingPrivateKey: bytes32,
    challenge: bytes32
) -> ViewingKeyProof:

    // Sign challenge with viewing key
    viewingPublicKey = derivePublicKey(viewingPrivateKey)
    signature = sign(viewingPrivateKey, challenge)

    RETURN {
        viewingPublicKey: viewingPublicKey,
        challenge: challenge,
        signature: signature
    }
```

#### 7.2 Verification

```
FUNCTION verifyViewingKeyOwnership(
    proof: ViewingKeyProof,
    expectedKeyHash: HexString32
) -> boolean:

    // Verify key hash matches
    actualKeyHash = computeViewingKeyHash(proof.viewingPublicKey)
    IF actualKeyHash != expectedKeyHash:
        RETURN false

    // Verify signature
    RETURN verify(proof.viewingPublicKey, proof.challenge, proof.signature)
```

### 8. Compliance Integration

#### 8.1 On-Chain Viewing Key Registry

```solidity
interface IViewingKeyRegistry {
    event ViewingKeyRegistered(
        address indexed account,
        bytes32 indexed keyHash,
        uint256 keyType,  // 1=incoming, 2=outgoing, 3=full
        uint256 validFrom,
        uint256 validUntil
    );

    event ViewingKeyRevoked(
        address indexed account,
        bytes32 indexed keyHash
    );

    function registerViewingKey(
        bytes32 keyHash,
        uint256 keyType,
        uint256 validUntil
    ) external;

    function revokeViewingKey(bytes32 keyHash) external;

    function isKeyValid(
        address account,
        bytes32 keyHash
    ) external view returns (bool);

    function getKeyType(
        address account,
        bytes32 keyHash
    ) external view returns (uint256);
}
```

#### 8.2 Audit Trail Format

```typescript
interface AuditTrail {
  // Account being audited
  account: string

  // Time range of audit
  startTime: number
  endTime: number

  // Transactions within range
  transactions: AuditedTransaction[]

  // Viewing key used (hash only)
  viewingKeyHash: HexString32

  // Auditor identity
  auditor: {
    publicKey: CompressedPublicKey
    signature: HexString  // Signs the audit trail
  }

  // Audit metadata
  metadata: {
    generatedAt: number
    totalIncoming: string  // Sum of incoming amounts
    totalOutgoing: string  // Sum of outgoing amounts
    transactionCount: number
  }
}

interface AuditedTransaction {
  txHash: HexString32
  blockNumber: number
  timestamp: number
  direction: 'incoming' | 'outgoing'
  amount: string
  counterparty?: string  // If outgoing key was used
  memo?: string
}
```

#### 8.3 Regulatory Disclosure Request Protocol

```
SEQUENCE disclosureRequest:

    1. Regulator → Account holder:
       REQUEST_DISCLOSURE {
           requester: regulatorPublicKey,
           reason: "Tax audit 2025",
           timeRange: { start: 1704067200, end: 1735689600 },
           keyType: 'full',
           legalBasis: "Section 7602 IRC"
       }

    2. Account holder → Regulator:
       ENCRYPTED_KEY_PACKAGE {
           encryptedViewingKey: ...,  // Encrypted to regulator's key
           metadata: {
               keyType: 'full',
               validFrom: 1704067200,
               validUntil: 1735689600
           }
       }

    3. Regulator:
       - Decrypts viewing key
       - Scans blockchain for transactions
       - Generates audit trail
       - Destroys key after audit period

    4. Account holder can optionally:
       - Revoke time-scoped key after use
       - Request proof of key destruction
       - Verify audit trail accuracy
```

### 9. Security Considerations

#### 9.1 Key Security Hierarchy

```
SPENDING KEY (Most Sensitive)
└── Controls funds, never share
    │
FULL VIEWING KEY (Sensitive)
└── Reveals all transaction details
    │
    ├── INCOMING VIEWING KEY (Moderate)
    │   └── Reveals incoming payments only
    │
    └── OUTGOING VIEWING KEY (Moderate)
        └── Reveals outgoing payments only
            │
            └── TIME-SCOPED KEYS (Lower Risk)
                └── Limited time window, auto-expire
```

#### 9.2 Key Storage Requirements

| Key Type | Recommended Storage |
|----------|---------------------|
| Spending | Hardware wallet, air-gapped |
| Full Viewing | Encrypted file, password protected |
| Incoming | Hot wallet (for scanning) |
| Outgoing | Hot wallet (for sending) |
| Time-scoped | Memory only, destroy after use |

#### 9.3 Viewing Key Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Key theft | Privacy breach | Encryption, access control |
| Key leakage | Historical exposure | Time-scoped keys |
| Coercion | Forced disclosure | Duress keys (false data) |
| Key reuse | Correlation attacks | Unique keys per auditor |

#### 9.4 Duress Keys (Optional)

For coercion resistance, implementations MAY support duress keys:

```
FUNCTION generateDuressKey(masterKey: bytes32, duressPassword: string) -> ViewingKey:
    // Derive plausible but empty viewing key
    duressKey = HKDF(masterKey, "sip-duress-" + duressPassword, 32)

    // This key reveals no real transactions
    RETURN {
        type: 'full',
        privateKey: duressKey,
        publicKey: derivePublicKey(duressKey),
        capabilities: []  // Empty - reveals nothing
    }
```

### 10. Reference Implementation

```typescript
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'
import { secp256k1 } from '@noble/curves/secp256k1'

export class ViewingKeyManager {
  private masterKey: Uint8Array

  constructor(masterKey: Uint8Array) {
    this.masterKey = masterKey
  }

  deriveIncomingKey(): ViewingKey {
    const privateKey = hkdf(sha256, this.masterKey, undefined, 'sip-viewing-incoming', 32)
    return {
      type: 'incoming',
      privateKey,
      publicKey: secp256k1.getPublicKey(privateKey, true),
      capabilities: ['scan_incoming', 'reveal_amounts', 'reveal_recipients', 'reveal_memos']
    }
  }

  deriveOutgoingKey(): ViewingKey {
    const privateKey = hkdf(sha256, this.masterKey, undefined, 'sip-viewing-outgoing', 32)
    return {
      type: 'outgoing',
      privateKey,
      publicKey: secp256k1.getPublicKey(privateKey, true),
      capabilities: ['scan_outgoing', 'reveal_amounts', 'reveal_senders', 'reveal_memos']
    }
  }

  getFullViewingKey(): ViewingKey {
    return {
      type: 'full',
      privateKey: this.masterKey,
      publicKey: secp256k1.getPublicKey(this.masterKey, true),
      capabilities: [
        'scan_incoming', 'scan_outgoing',
        'reveal_amounts', 'reveal_senders', 'reveal_recipients', 'reveal_memos'
      ]
    }
  }

  deriveTimeBoundedKey(startTime: number, endTime: number): TimeBoundedViewingKey {
    const timeScope = `${startTime}-${endTime}`
    const privateKey = hkdf(sha256, this.masterKey, undefined, `sip-time-${timeScope}`, 32)
    return {
      type: 'time-bounded',
      privateKey,
      publicKey: secp256k1.getPublicKey(privateKey, true),
      validFrom: startTime,
      validUntil: endTime
    }
  }

  shareViewingKey(
    viewingKey: ViewingKey,
    recipientPublicKey: Uint8Array
  ): EncryptedViewingKeyPackage {
    // Generate ephemeral key
    const ephemeralPrivKey = secp256k1.utils.randomPrivateKey()
    const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivKey, true)

    // ECDH
    const sharedSecret = secp256k1.getSharedSecret(ephemeralPrivKey, recipientPublicKey)

    // Derive encryption key
    const encryptionKey = hkdf(sha256, sharedSecret, undefined, 'sip-vk-encryption', 32)

    // Encrypt
    const nonce = crypto.getRandomValues(new Uint8Array(24))
    const payload = JSON.stringify({
      type: viewingKey.type,
      privateKey: Buffer.from(viewingKey.privateKey).toString('hex'),
      capabilities: viewingKey.capabilities
    })

    const cipher = xchacha20poly1305(encryptionKey, nonce)
    const ciphertext = cipher.encrypt(new TextEncoder().encode(payload))

    return {
      version: 1,
      ephemeralPublicKey: ephemeralPubKey,
      nonce,
      ciphertext,
      metadata: {
        createdAt: Date.now()
      }
    }
  }

  static computeKeyHash(publicKey: Uint8Array): Uint8Array {
    return sha256(publicKey)
  }
}
```

### 11. Test Vectors

See [SIP-003 Test Vectors](../test-vectors/viewing-keys.json).

### 12. Compatibility

#### 12.1 Zcash Viewing Key Compatibility

SIP viewing keys serve similar purpose to Zcash incoming viewing keys (IVK) and outgoing viewing keys (OVK), with differences:

| Feature | SIP-003 | Zcash (Sapling) |
|---------|---------|-----------------|
| Key types | 3 (in/out/full) | 2 (IVK/OVK) |
| Derivation | HKDF from master | ZIP-32 path |
| Curve | secp256k1/ed25519 | jubjub |
| Encryption | XChaCha20-Poly1305 | ChaCha20-Poly1305 |

#### 12.2 Monero View Key Compatibility

Similar to Monero private view keys, with cross-chain enhancements.

## Rationale

### Why Three Key Types?

Different disclosure requirements need different capabilities:
- Tax authorities need full visibility
- Payment processors only need incoming
- Wallet apps only need outgoing for history

### Why Time-Bounded Keys?

Limiting key validity reduces long-term exposure risk. Auditors only need access during audit period.

### Why XChaCha20-Poly1305?

Extended nonce (192-bit) eliminates nonce reuse concerns when encrypting many viewing keys with same key.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
