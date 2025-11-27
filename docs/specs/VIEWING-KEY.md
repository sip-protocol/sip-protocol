# Viewing Key Specification

> **Issue**: #8 - Define viewing key derivation and encryption specification
> **Status**: SPECIFIED
> **Date**: November 26, 2025

---

## 1. Overview

### Purpose

Viewing keys enable **selective disclosure** of shielded transaction details to authorized parties (auditors, regulators, accountants) without compromising overall privacy.

### Use Cases

| Use Case | Description |
|----------|-------------|
| **Tax Compliance** | Share transaction history with tax authority |
| **Audit** | Allow auditor to verify specific transactions |
| **Institutional** | Meet regulatory requirements for fund transparency |
| **Dispute Resolution** | Prove transaction occurred to third party |
| **Inheritance** | Grant read access to estate executor |

### Privacy Model

```
Full Privacy (Shielded):     Only user sees transactions
Selective Disclosure:        User + authorized viewers see specific txs
Compliant Mode:             User + designated auditor see all txs
```

---

## 2. Key Hierarchy

### 2.1 Overview

```
User Seed
    │
    └── Master Viewing Key (MVK)
            │
            ├── Full Viewing Key (FVK)
            │       └── Sees ALL transactions
            │
            ├── Auditor Key (AK)
            │       └── Sees ALL txs, time-limited
            │
            └── Transaction Viewing Keys (TVK)
                    └── Sees SINGLE transaction
```

### 2.2 Master Viewing Key (MVK)

Derived from user's wallet seed using BIP-32:

```
Derivation Path: m/44'/0'/account'/1'/0'
                    │    │    │       │    │
                    │    │    │       │    └── Index
                    │    │    │       └── Viewing purpose (1)
                    │    │    └── Account index
                    │    └── Reserved
                    └── BIP-44 purpose
```

**Generation**:
```
seed = user_mnemonic_to_seed(mnemonic, passphrase)
mvk = HKDF-SHA256(
  IKM = seed,
  salt = "sip-viewing-v1",
  info = "master-viewing-key",
  length = 32
)
```

### 2.3 Full Viewing Key (FVK)

Grants access to ALL user transactions:

```
fvk = HKDF-SHA256(
  IKM = mvk,
  salt = "sip-fvk",
  info = "full-viewing-key",
  length = 32
)
```

**WARNING**: FVK exposure reveals entire transaction history. Use sparingly.

### 2.4 Auditor Key (AK)

Time-limited viewing key for compliance:

```
ak = HKDF-SHA256(
  IKM = mvk,
  salt = "sip-auditor",
  info = auditor_id || start_time || end_time,
  length = 32
)
```

| Field | Description |
|-------|-------------|
| `auditor_id` | Identifier of authorized auditor |
| `start_time` | Key validity start (Unix timestamp) |
| `end_time` | Key validity end (Unix timestamp) |

### 2.5 Transaction Viewing Key (TVK)

Per-transaction key for selective disclosure:

```
tvk = HKDF-SHA256(
  IKM = mvk,
  salt = "sip-tvk",
  info = intent_hash,
  length = 32
)
```

This reveals ONLY the specific transaction, not any others.

---

## 3. Encryption Scheme

### 3.1 Algorithm Selection

| Component | Algorithm | Rationale |
|-----------|-----------|-----------|
| Key derivation | HKDF-SHA256 | Standard, proven |
| Symmetric encryption | ChaCha20-Poly1305 | Fast, secure, AEAD |
| Nonce | 12 bytes random | Per-encryption unique |

### 3.2 Transaction Data Structure

Data encrypted for viewing:

```typescript
interface ViewableTransactionData {
  // Intent details
  intentHash: string;
  intentType: 'swap' | 'transfer' | 'bridge';

  // Amounts (hidden in public view)
  inputAmount: bigint;
  outputAmount: bigint;

  // Addresses (hidden in public view)
  senderAddress: string;
  recipientAddress: string;

  // Metadata
  timestamp: number;
  status: 'pending' | 'fulfilled' | 'expired';

  // Commitments (for verification)
  inputCommitment: string;
  outputCommitment: string;
}
```

### 3.3 Encryption Process

```
Encrypt(viewing_key, tx_data):
  1. nonce ← random_bytes(12)
  2. plaintext ← serialize(tx_data)
  3. ciphertext ← ChaCha20-Poly1305.encrypt(
       key = viewing_key,
       nonce = nonce,
       plaintext = plaintext,
       aad = intent_hash  // Additional authenticated data
     )
  4. encrypted_blob ← nonce || ciphertext

  Return: encrypted_blob
```

### 3.4 Decryption Process

```
Decrypt(viewing_key, encrypted_blob, intent_hash):
  1. nonce ← encrypted_blob[0:12]
  2. ciphertext ← encrypted_blob[12:]
  3. plaintext ← ChaCha20-Poly1305.decrypt(
       key = viewing_key,
       nonce = nonce,
       ciphertext = ciphertext,
       aad = intent_hash
     )
  4. tx_data ← deserialize(plaintext)

  Return: tx_data
```

### 3.5 Multi-Key Encryption

For transactions viewable by multiple parties:

```
EncryptMultiKey(tx_data, viewing_keys[]):
  // Generate random data encryption key
  dek ← random_bytes(32)

  // Encrypt data once with DEK
  encrypted_data ← ChaCha20-Poly1305.encrypt(dek, nonce, tx_data)

  // Wrap DEK for each viewing key
  wrapped_keys ← []
  for vk in viewing_keys:
    wrapped ← ChaCha20-Poly1305.encrypt(vk, nonce_i, dek)
    wrapped_keys.append(wrapped)

  Return: {
    encrypted_data,
    wrapped_keys,  // One per authorized viewer
    key_hashes     // To identify which key to use
  }
```

---

## 4. Viewing Proof

### 4.1 Purpose

A ViewingProof demonstrates that decrypted data is authentic without revealing the viewing key itself.

### 4.2 Proof Structure

```typescript
interface ViewingProof {
  // What was revealed
  intentHash: string;
  revealedData: ViewableTransactionData;

  // Cryptographic proof
  commitmentProof: {
    // Prove revealed amounts match commitments
    inputAmountProof: ZKProof;   // Proves inputAmount matches inputCommitment
    outputAmountProof: ZKProof;  // Proves outputAmount matches outputCommitment
  };

  // Metadata
  viewingKeyHash: string;  // Hash of the viewing key used
  proofTimestamp: number;
}
```

### 4.3 Proof Generation (Noir)

```noir
fn generate_viewing_proof(
    // Public inputs
    intent_hash: pub Field,
    input_commitment: pub Field,
    output_commitment: pub Field,
    viewing_key_hash: pub Field,

    // Private inputs
    viewing_key: Field,
    input_amount: u64,
    input_blinding: Field,
    output_amount: u64,
    output_blinding: Field,
) {
    // Verify viewing key hash
    let computed_vk_hash = poseidon::hash_1([viewing_key]);
    assert(computed_vk_hash == viewing_key_hash);

    // Verify input commitment
    let computed_input_commit = pedersen_commit(
        input_amount as Field,
        input_blinding
    );
    assert(commitment_hash(computed_input_commit) == input_commitment);

    // Verify output commitment
    let computed_output_commit = pedersen_commit(
        output_amount as Field,
        output_blinding
    );
    assert(commitment_hash(computed_output_commit) == output_commitment);
}
```

### 4.4 Proof Verification

Verifier checks:
1. ZK proof is valid
2. Revealed amounts correspond to on-chain commitments
3. Viewing key hash matches authorized viewer

---

## 5. Access Control

### 5.1 Key Registration

Users can register viewing key recipients:

```typescript
interface ViewingKeyGrant {
  grantId: string;
  recipientId: string;        // Auditor/viewer identifier
  keyType: 'full' | 'auditor' | 'transaction';
  scope: {
    startTime?: number;       // For time-limited access
    endTime?: number;
    intentHashes?: string[];  // For transaction-specific
  };
  createdAt: number;
  revokedAt?: number;
}
```

### 5.2 Revocation

Keys can be revoked but previously-viewed data cannot be "un-revealed":

```typescript
interface RevocationRecord {
  grantId: string;
  revokedAt: number;
  reason: string;
}
```

**Important**: Revocation prevents future access. Past disclosures are permanent.

### 5.3 Key Rotation

For long-term auditor relationships:

```
1. Generate new auditor key with new time bounds
2. Revoke old key
3. Share new key with auditor
4. Old key stops working for new transactions
```

---

## 6. Security Analysis

### 6.1 Security Properties

| Property | Guarantee |
|----------|-----------|
| **Confidentiality** | Only key holders can decrypt |
| **Integrity** | AEAD prevents tampering |
| **Authenticity** | ViewingProof proves data is real |
| **Selective Disclosure** | TVK reveals only one transaction |
| **Forward Secrecy** | Key compromise doesn't reveal past txs (with TVK) |

### 6.2 Threat Analysis

| Threat | Mitigation |
|--------|------------|
| **Key theft** | Hardware security modules, multi-sig for FVK |
| **Auditor collusion** | Time-limited keys, audit logs |
| **Fake disclosure** | ViewingProof verification required |
| **Scope creep** | TVK limits to single transaction |
| **Key leakage** | Separate viewing keys from spending keys |

### 6.3 What Viewing Keys CAN Do

- Decrypt transaction details
- Prove transaction authenticity
- Verify amounts match commitments

### 6.4 What Viewing Keys CANNOT Do

- Spend funds (no spending authority)
- Create new transactions
- Modify transaction history
- Reveal other users' transactions

### 6.5 Trust Model

| Key Type | Trust Required | Risk |
|----------|---------------|------|
| **FVK** | High - reveals all | Full history exposure |
| **AK** | Medium - time-limited | Bounded exposure |
| **TVK** | Low - single tx | Minimal exposure |

---

## 7. Integration with SIP

### 7.1 Privacy Levels

| Level | Viewing Key Behavior |
|-------|---------------------|
| `TRANSPARENT` | No encryption, public |
| `SHIELDED` | Encrypted, no viewing key shared |
| `COMPLIANT` | Encrypted, auditor key pre-shared |

### 7.2 SDK Interface

```typescript
interface ViewingKeyManager {
  // Key generation
  generateMasterViewingKey(seed: Uint8Array): MasterViewingKey;
  deriveFullViewingKey(mvk: MasterViewingKey): FullViewingKey;
  deriveAuditorKey(
    mvk: MasterViewingKey,
    auditorId: string,
    startTime: number,
    endTime: number
  ): AuditorKey;
  deriveTransactionViewingKey(
    mvk: MasterViewingKey,
    intentHash: string
  ): TransactionViewingKey;

  // Encryption
  encryptForViewing(
    txData: ViewableTransactionData,
    viewingKeys: ViewingKey[]
  ): EncryptedViewingData;

  // Decryption
  decryptWithViewingKey(
    encryptedData: EncryptedViewingData,
    viewingKey: ViewingKey
  ): ViewableTransactionData;

  // Proofs
  generateViewingProof(
    viewingKey: ViewingKey,
    txData: ViewableTransactionData,
    commitments: Commitments
  ): ViewingProof;
  verifyViewingProof(proof: ViewingProof): boolean;
}
```

### 7.3 Flow: Compliant Mode

```
1. User sets privacy_level = COMPLIANT
2. User pre-shares auditor_key with designated auditor
3. For each transaction:
   a. Encrypt tx_data with auditor_key
   b. Store encrypted blob with intent
   c. Auditor can decrypt at any time (within key validity)
4. If audit requested:
   a. Auditor decrypts all transactions in scope
   b. Auditor generates ViewingProofs for report
```

### 7.4 Flow: Selective Disclosure

```
1. User has shielded transaction
2. Dispute arises, need to prove transaction
3. User derives TVK for specific intent_hash
4. User shares TVK with arbiter
5. Arbiter decrypts ONLY that transaction
6. Arbiter generates ViewingProof
7. Dispute resolved with cryptographic proof
```

---

## 8. Test Vectors

### 8.1 Key Derivation

```json
{
  "seed": "0x000102030405060708090a0b0c0d0e0f",
  "mvk": "0x...(HKDF output)",
  "fvk": "0x...(derived from mvk)",
  "tvk_for_intent_abc": "0x..."
}
```

### 8.2 Encryption/Decryption

```json
{
  "viewing_key": "0xaabbccdd...",
  "tx_data": {
    "intentHash": "0x123...",
    "inputAmount": 1000000,
    "outputAmount": 950000
  },
  "nonce": "0x112233445566778899aabbcc",
  "encrypted_blob": "0x112233445566778899aabbcc...(ciphertext)",
  "decrypted": "(matches tx_data)"
}
```

### 8.3 Viewing Proof

```json
{
  "intent_hash": "0x123...",
  "revealed_input_amount": 1000000,
  "input_commitment": "0xabc...",
  "proof": "0x...(ZK proof bytes)",
  "valid": true
}
```

---

## 9. Comparison with Zcash

### 9.1 Similarities

| Aspect | Zcash | SIP |
|--------|-------|-----|
| Viewing key concept | ✓ | ✓ |
| Incoming viewing key | ✓ (ivk) | ✓ (similar to FVK) |
| Per-tx disclosure | ✓ (memo field) | ✓ (TVK) |

### 9.2 SIP Extensions

| Feature | Zcash | SIP |
|---------|-------|-----|
| Time-limited keys | ✗ | ✓ (Auditor Keys) |
| ViewingProof | ✗ | ✓ (ZK proof of authenticity) |
| Multi-key encryption | ✗ | ✓ (multiple viewers) |
| Intent integration | ✗ | ✓ (native) |

---

## 10. References

- [Zcash Viewing Keys](https://zips.z.cash/zip-0310)
- [BIP-32 HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [HKDF RFC 5869](https://tools.ietf.org/html/rfc5869)
- [ChaCha20-Poly1305 RFC 8439](https://tools.ietf.org/html/rfc8439)

---

*Document Status: SPECIFIED*
*Last Updated: November 26, 2025*
