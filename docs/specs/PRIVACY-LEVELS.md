# Privacy Levels Specification

> **Issue**: #9 - Define privacy levels formal specification
> **Status**: SPECIFIED
> **Date**: November 26, 2025

---

## 1. Overview

SIP defines three privacy levels that users can select per-intent:

| Level | Privacy | Compliance | Use Case |
|-------|---------|------------|----------|
| `TRANSPARENT` | None | Full | Maximum compatibility |
| `SHIELDED` | Full | None | Maximum privacy |
| `COMPLIANT` | Full + Disclosure | Selective | Institutional/regulatory |

Each level specifies exactly what information is hidden, what proofs are required, and what guarantees are provided.

---

## 2. Privacy Level: TRANSPARENT

### 2.1 Definition

Standard on-chain transaction with no privacy enhancements.

```typescript
enum PrivacyLevel {
  TRANSPARENT = 'transparent'
}
```

### 2.2 Visibility Matrix

| Information | Visible To | Storage |
|-------------|-----------|---------|
| Sender address | Everyone | On-chain |
| Input amount | Everyone | On-chain |
| Output amount | Everyone | On-chain |
| Recipient address | Everyone | On-chain |
| Transaction time | Everyone | On-chain |
| Asset types | Everyone | On-chain |

### 2.3 Required Proofs

**None** - Standard transaction signing only.

| Proof | Required? |
|-------|-----------|
| Funding Proof | ❌ No |
| Validity Proof | ❌ No |
| Fulfillment Proof | ❌ No |

### 2.4 Data Structure

```typescript
interface TransparentIntent {
  privacyLevel: 'transparent';

  // All fields in plaintext
  sender: string;
  recipient: string;
  inputAsset: AssetId;
  inputAmount: bigint;
  outputAsset: AssetId;
  minOutputAmount: bigint;

  // Standard signature
  signature: string;

  // Metadata
  timestamp: number;
  expiry: number;
}
```

### 2.5 Guarantees

| Property | Guaranteed? | Notes |
|----------|-------------|-------|
| Transaction validity | ✅ Yes | Standard chain validation |
| Sender privacy | ❌ No | Address visible |
| Amount privacy | ❌ No | Amounts visible |
| Recipient privacy | ❌ No | Address visible |
| Unlinkability | ❌ No | Full graph analysis possible |

### 2.6 Use Cases

- DEX integrations requiring transparency
- Public treasury operations
- Airdrops and distributions
- Testing and debugging

---

## 3. Privacy Level: SHIELDED

### 3.1 Definition

Full privacy mode with cryptographic hiding of sender, amounts, and recipient.

```typescript
enum PrivacyLevel {
  SHIELDED = 'shielded'
}
```

### 3.2 Visibility Matrix

| Information | Visible To | Hidden Via |
|-------------|-----------|------------|
| Sender address | Nobody | Sender commitment |
| Input amount | Nobody | Pedersen commitment |
| Output amount | Solver only (range) | Commitment |
| Recipient address | Nobody | Stealth address |
| Min output required | Everyone | Plaintext (for quoting) |
| Asset types | Everyone | Needed for routing |
| Intent exists | Everyone | On-chain |

### 3.3 Required Proofs

| Proof | Required? | Purpose |
|-------|-----------|---------|
| Funding Proof | ✅ Yes | Prove balance ≥ input |
| Validity Proof | ✅ Yes | Prove authorization |
| Fulfillment Proof | ✅ Yes | Prove correct delivery |

### 3.4 Data Structure

```typescript
interface ShieldedIntent {
  privacyLevel: 'shielded';

  // Commitments (hiding values)
  senderCommitment: Commitment;      // Pedersen(H(address), blinding)
  inputCommitment: Commitment;       // Pedersen(amount, blinding)
  outputCommitment: Commitment;      // Pedersen(amount, blinding)

  // Public requirements (needed for solver quoting)
  inputAsset: AssetId;
  outputAsset: AssetId;
  minOutputAmount: bigint;           // Minimum acceptable output

  // Stealth address for recipient
  recipientStealth: StealthAddress;

  // Proofs
  fundingProof: FundingProof;
  validityProof: ValidityProof;

  // Anti-replay
  nullifier: string;

  // Timing
  timestamp: number;
  expiry: number;
}
```

### 3.5 Guarantees

| Property | Guaranteed? | Mechanism |
|----------|-------------|-----------|
| Sender privacy | ✅ Yes | Sender commitment (Pedersen) |
| Amount privacy | ✅ Yes | Amount commitments |
| Recipient privacy | ✅ Yes | Stealth address |
| Unlinkability | ✅ Yes | Fresh blinding + stealth per tx |
| Non-replay | ✅ Yes | Nullifier set |
| Correct execution | ✅ Yes | Fulfillment proof |

### 3.6 What Solvers See

```
Solver view:
├── "Someone wants to swap"
├── "Input: ??? amount of SOL (committed)"
├── "Output: at least 100 ZEC"
├── "Recipient: stealth address 0x..."
└── "Proof that sender has sufficient funds: ✓"
```

### 3.7 Cryptographic Components Used

| Component | Specification |
|-----------|---------------|
| Sender hiding | Validity Proof (#4) |
| Amount hiding | Funding Proof (#3) |
| Recipient hiding | Stealth Address (#7) |
| Execution verification | Fulfillment Proof (#5) |

---

## 4. Privacy Level: COMPLIANT

### 4.1 Definition

Full privacy with selective disclosure capability for authorized auditors.

```typescript
enum PrivacyLevel {
  COMPLIANT = 'compliant'
}
```

### 4.2 Visibility Matrix

| Information | Public | Auditor (with key) |
|-------------|--------|-------------------|
| Sender address | ❌ Hidden | ✅ Visible |
| Input amount | ❌ Hidden | ✅ Visible |
| Output amount | ❌ Hidden | ✅ Visible |
| Recipient address | ❌ Hidden | ✅ Visible |
| Transaction time | ✅ Visible | ✅ Visible |
| Audit trail | ❌ Hidden | ✅ Full history |

### 4.3 Required Proofs

| Proof | Required? | Purpose |
|-------|-----------|---------|
| Funding Proof | ✅ Yes | Prove balance ≥ input |
| Validity Proof | ✅ Yes | Prove authorization |
| Fulfillment Proof | ✅ Yes | Prove correct delivery |
| ViewingProof | 🔄 On demand | Prove disclosure authenticity |

### 4.4 Data Structure

```typescript
interface CompliantIntent extends ShieldedIntent {
  privacyLevel: 'compliant';

  // All ShieldedIntent fields, plus:

  // Encrypted transaction details for auditor
  encryptedViewingData: EncryptedViewingData;

  // Auditor configuration
  auditorKeyHash: string;           // Hash of designated auditor's key
  viewingKeyScope: 'full' | 'transaction';
}

interface EncryptedViewingData {
  ciphertext: Uint8Array;           // ChaCha20-Poly1305 encrypted
  nonce: Uint8Array;
  keyHashes: string[];              // Which keys can decrypt
}
```

### 4.5 Guarantees

| Property | Public | Auditor |
|----------|--------|---------|
| Sender privacy | ✅ Yes | ❌ No (disclosed) |
| Amount privacy | ✅ Yes | ❌ No (disclosed) |
| Recipient privacy | ✅ Yes | ❌ No (disclosed) |
| Unlinkability (public) | ✅ Yes | N/A |
| Audit capability | N/A | ✅ Yes |
| Proof of authenticity | N/A | ✅ Yes (ViewingProof) |

### 4.6 Auditor Workflow

```
1. User creates COMPLIANT intent
2. User designates auditor (provides auditor_key_hash)
3. Transaction data encrypted with auditor's key
4. Encrypted blob stored with intent
5. Auditor decrypts when needed
6. Auditor generates ViewingProof for reports
```

### 4.7 Cryptographic Components Used

| Component | Specification |
|-----------|---------------|
| All SHIELDED components | ✓ |
| Transaction encryption | Viewing Key (#8) |
| Selective disclosure | ViewingProof (#8) |
| Key hierarchy | MVK/AK/TVK (#8) |

---

## 5. Comparison Matrix

### 5.1 Privacy Comparison

| Aspect | TRANSPARENT | SHIELDED | COMPLIANT |
|--------|-------------|----------|-----------|
| Sender hidden | ❌ | ✅ | ✅ (public) / ❌ (auditor) |
| Amount hidden | ❌ | ✅ | ✅ (public) / ❌ (auditor) |
| Recipient hidden | ❌ | ✅ | ✅ (public) / ❌ (auditor) |
| Audit possible | ✅ (trivial) | ❌ | ✅ (with key) |

### 5.2 Proof Requirements

| Proof | TRANSPARENT | SHIELDED | COMPLIANT |
|-------|-------------|----------|-----------|
| Funding | ❌ | ✅ | ✅ |
| Validity | ❌ | ✅ | ✅ |
| Fulfillment | ❌ | ✅ | ✅ |
| Viewing | N/A | N/A | 🔄 Optional |

### 5.3 Performance Impact

| Aspect | TRANSPARENT | SHIELDED | COMPLIANT |
|--------|-------------|----------|-----------|
| Proof generation | None | ~2-5s | ~2-5s + encryption |
| Verification | Fast | ~10ms | ~10ms |
| Data size | Small | Medium | Medium + encrypted blob |
| Complexity | Low | High | Highest |

### 5.4 Use Case Fit

| Use Case | Recommended Level |
|----------|-------------------|
| Public DEX swap | TRANSPARENT |
| Personal privacy | SHIELDED |
| Institutional trading | COMPLIANT |
| Tax reporting needed | COMPLIANT |
| Anonymous donation | SHIELDED |
| Regulated exchange | COMPLIANT |

---

## 6. Transition Rules

### 6.1 Allowed Transitions

```
TRANSPARENT ──────────────────────────────────────┐
      │                                           │
      │ (can upgrade)                             │
      ▼                                           │
  SHIELDED ───────────────────────────────────────┤
      │                                           │
      │ (can add compliance)                      │
      ▼                                           │
  COMPLIANT ──────────────────────────────────────┘
                                                  │
                                                  │
                                    (cannot downgrade)
```

### 6.2 Rules

| Transition | Allowed? | Notes |
|------------|----------|-------|
| TRANSPARENT → SHIELDED | ✅ Yes | Add proofs and commitments |
| TRANSPARENT → COMPLIANT | ✅ Yes | Add proofs + viewing key |
| SHIELDED → COMPLIANT | ✅ Yes | Add viewing key encryption |
| SHIELDED → TRANSPARENT | ❌ No | Cannot reveal hidden data |
| COMPLIANT → SHIELDED | ❌ No | Auditor key already shared |
| COMPLIANT → TRANSPARENT | ❌ No | Cannot reveal hidden data |

### 6.3 Rationale

Once data is committed/hidden, revealing it would require the private witness data which only the user has. The protocol cannot force disclosure without user cooperation.

---

## 7. Implementation Requirements

### 7.1 SDK Integration

```typescript
// Creating intents at different privacy levels
const sip = new SIP();

// Transparent - simple
const transparentIntent = await sip.createIntent({
  privacyLevel: PrivacyLevel.TRANSPARENT,
  sender: '0x...',
  recipient: '0x...',
  inputAmount: 100n,
  // ... standard fields
});

// Shielded - with proofs
const shieldedIntent = await sip.createIntent({
  privacyLevel: PrivacyLevel.SHIELDED,
  inputAmount: 100n,  // Will be committed
  // ... other fields
  // SDK automatically generates:
  // - Commitments
  // - Stealth address
  // - Funding proof
  // - Validity proof
});

// Compliant - with auditor key
const compliantIntent = await sip.createIntent({
  privacyLevel: PrivacyLevel.COMPLIANT,
  inputAmount: 100n,
  auditorKeyHash: '0x...',  // Designated auditor
  // SDK automatically:
  // - Does everything SHIELDED does
  // - Encrypts tx data for auditor
});
```

### 7.2 Validation Rules

```typescript
function validateIntent(intent: Intent): ValidationResult {
  switch (intent.privacyLevel) {
    case 'transparent':
      // Check standard fields present
      return validateTransparent(intent);

    case 'shielded':
      // Check commitments, proofs, stealth address
      return validateShielded(intent);

    case 'compliant':
      // Check all shielded requirements + viewing data
      return validateCompliant(intent);
  }
}
```

---

## 8. Security Considerations

### 8.1 Privacy Level Selection

| Consideration | Guidance |
|---------------|----------|
| Default level | SHIELDED (privacy by default) |
| Downgrade requests | Reject - cannot downgrade |
| Level in metadata | Include in intent_hash to prevent tampering |

### 8.2 Commitment Binding

All commitments MUST be bound to the privacy level:

```
commitment_hash = Poseidon(
  commitment,
  privacy_level,
  intent_id
)
```

This prevents commitment reuse across different privacy contexts.

### 8.3 Auditor Trust

For COMPLIANT mode:
- User chooses auditor (not protocol)
- Multiple auditors supported
- Revocation possible but doesn't hide past disclosures
- Consider auditor reputation system

---

## 9. Test Vectors

### 9.1 Privacy Level Enum

```json
{
  "TRANSPARENT": "transparent",
  "SHIELDED": "shielded",
  "COMPLIANT": "compliant"
}
```

### 9.2 Shielded Intent Example

```json
{
  "privacyLevel": "shielded",
  "senderCommitment": "0x...",
  "inputCommitment": "0x...",
  "outputCommitment": "0x...",
  "inputAsset": "solana:SOL",
  "outputAsset": "zcash:ZEC",
  "minOutputAmount": "1000000",
  "recipientStealth": {
    "address": "0x...",
    "ephemeralPublicKey": "0x...",
    "viewTag": 42
  },
  "fundingProof": "0x...",
  "validityProof": "0x...",
  "nullifier": "0x...",
  "timestamp": 1732600000,
  "expiry": 1732686400
}
```

### 9.3 Compliant Intent Example

```json
{
  "privacyLevel": "compliant",
  "...all shielded fields...",
  "encryptedViewingData": {
    "ciphertext": "0x...",
    "nonce": "0x112233445566778899aabbcc",
    "keyHashes": ["0xauditor1...", "0xauditor2..."]
  },
  "auditorKeyHash": "0xauditor1..."
}
```

---

## 10. References

- [Funding Proof Specification](./FUNDING-PROOF.md)
- [Validity Proof Specification](./VALIDITY-PROOF.md)
- [Fulfillment Proof Specification](./FULFILLMENT-PROOF.md)
- [Stealth Address Specification](./STEALTH-ADDRESS.md)
- [Viewing Key Specification](./VIEWING-KEY.md)
- [Zcash Shielded Transactions](https://zips.z.cash/protocol/protocol.pdf)

---

*Document Status: SPECIFIED*
*Last Updated: November 26, 2025*
