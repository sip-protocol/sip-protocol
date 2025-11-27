# Stealth Address Protocol Specification

> **Issue**: #7 - Define stealth address protocol specification
> **Status**: SPECIFIED
> **Date**: November 26, 2025
> **Implementation**: `packages/sdk/src/stealth.ts`

---

## 1. Overview

### Purpose

Stealth addresses provide **recipient privacy** by generating unique, one-time addresses for each transaction. This prevents:

- Address reuse linkability
- Transaction graph analysis
- Balance correlation attacks

### The Problem (ZachXBT Vulnerability)

In current cross-chain swaps:
```
User has: shielded ZEC in z-address
User swaps: ZEC → SOL via intent
Refund goes to: t1ABC... (transparent, reused)

Chain analysis: "t1ABC received refunds 50 times → links to shielded activity"
```

### The Solution (SIP Stealth Addresses)

```
Each swap: generates fresh stealth address
Refund goes to: unique stealth_1, stealth_2, stealth_3...

Chain analysis: "No pattern - each address used once"
```

---

## 2. Cryptographic Foundation

### 2.1 Curve Parameters

SIP uses **secp256k1** for compatibility with Ethereum, Bitcoin, and Zcash transparent addresses.

| Parameter | Value |
|-----------|-------|
| Curve | secp256k1 |
| Generator | G (standard) |
| Order | n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 |
| Field | p = 2²⁵⁶ - 2³² - 977 |

### 2.2 Hash Functions

| Purpose | Function | Notes |
|---------|----------|-------|
| Shared secret hashing | SHA-256 | Standard, widely supported |
| View tag | First byte of SHA-256 | Optimization for scanning |

### 2.3 Key Types

| Key | Symbol | Description |
|-----|--------|-------------|
| Spending private key | p | Controls spending from stealth address |
| Spending public key | P = p·G | Published in meta-address |
| Viewing private key | q | Used to scan for incoming txs |
| Viewing public key | Q = q·G | Published in meta-address |
| Ephemeral private key | r | Generated per-transaction by sender |
| Ephemeral public key | R = r·G | Published with transaction |
| Stealth private key | a | Derived for each stealth address |
| Stealth public key | A = a·G | The one-time address |

---

## 3. Protocol Specification

### 3.1 Key Generation (Recipient Setup)

The recipient generates their stealth meta-address once:

```
KeyGen():
  1. p ← random_scalar()              // Spending private key
  2. P ← p · G                        // Spending public key
  3. q ← random_scalar()              // Viewing private key
  4. Q ← q · G                        // Viewing public key
  5. meta_address ← (P, Q)            // Published stealth meta-address

  Return: (meta_address, p, q)
```

**Security Requirements**:
- p and q MUST be generated with cryptographically secure randomness
- p and q MUST be kept secret by the recipient
- P and Q are published (e.g., in a registry or shared directly)

### 3.2 Stealth Address Generation (Sender)

When sending to a recipient with meta-address (P, Q):

```
GenerateStealth(P, Q):
  1. r ← random_scalar()              // Ephemeral private key
  2. R ← r · G                        // Ephemeral public key
  3. S ← r · P                        // Shared secret (ECDH)
  4. h ← SHA256(S)                    // Hash the shared secret
  5. view_tag ← h[0]                  // First byte for optimization
  6. A ← Q + h · G                    // Stealth address

  Return: (A, R, view_tag)
```

**Publication**: The sender publishes (R, view_tag) alongside the transaction to address A.

### 3.3 Stealth Address Scanning (Recipient)

The recipient scans for incoming transactions:

```
ScanForStealth(R, A, view_tag, p, q):
  1. S' ← p · R                       // Recompute shared secret
  2. h' ← SHA256(S')                  // Hash it

  // Optimization: quick reject using view tag
  3. if h'[0] ≠ view_tag:
       return NOT_MINE

  // Full verification
  4. A' ← Q + h' · G                  // Expected stealth address
  5. if A' ≠ A:
       return NOT_MINE

  Return: MINE
```

### 3.4 Private Key Derivation (Claiming Funds)

When the recipient finds a matching stealth address:

```
DerivePrivateKey(R, p, q):
  1. S ← p · R                        // Shared secret
  2. h ← SHA256(S)                    // Hash
  3. a ← q + h (mod n)                // Stealth private key

  Return: a
```

**Verification**: a · G = Q + h · G = A ✓

---

## 4. Encoding Format

### 4.1 Stealth Meta-Address

Format: `sip:{chain}:{spending_key}:{viewing_key}`

```
sip:ethereum:0x02abc...def:0x03123...456
    │         │              │
    │         │              └── Viewing public key (compressed)
    │         └── Spending public key (compressed)
    └── Chain identifier
```

### 4.2 Supported Chains

| Chain ID | Description |
|----------|-------------|
| `ethereum` | Ethereum mainnet |
| `solana` | Solana mainnet |
| `zcash` | Zcash (for t-addresses) |
| `near` | NEAR Protocol |
| `polygon` | Polygon PoS |

### 4.3 Key Encoding

- Public keys: Compressed format (33 bytes, hex with 0x prefix)
- Private keys: 32 bytes, hex with 0x prefix
- All scalars: Big-endian encoding

### 4.4 Example

```
Meta-address:
sip:ethereum:0x02a1b2c3d4e5f6...33bytes:0x03f6e5d4c3b2a1...33bytes

Stealth address output:
{
  "address": "0x02...(33 bytes compressed pubkey)",
  "ephemeralPublicKey": "0x03...(33 bytes)",
  "viewTag": 142
}
```

---

## 5. Security Analysis

### 5.1 Security Properties

| Property | Guarantee | Assumption |
|----------|-----------|------------|
| **Unlinkability** | Different stealth addresses cannot be linked | ECDH security (CDH) |
| **Recipient Privacy** | Observer cannot determine recipient | DDH assumption |
| **Sender Deniability** | Anyone could have generated the address | Ephemeral key is random |
| **Forward Secrecy** | Compromise of viewing key doesn't reveal past | Spending key separate |

### 5.2 What is Protected

| Information | Protected? | Notes |
|-------------|------------|-------|
| Recipient identity | ✅ Yes | Hidden behind one-time address |
| Link between txs | ✅ Yes | Each address unique |
| Recipient's balance | ✅ Yes | No address reuse to correlate |
| Viewing key holder | ✅ Yes | Scanning is private |

### 5.3 What is NOT Protected

| Information | Protected? | Notes |
|-------------|------------|-------|
| Transaction amount | ❌ No | Visible on chain (use commitments) |
| Sender identity | ❌ No | Stealth is for recipient |
| Transaction timing | ❌ No | Block timestamp visible |
| Ephemeral key | ❌ No | Must be published for recipient |

### 5.4 Threat Analysis

| Threat | Mitigation |
|--------|------------|
| **Key reuse** | Generate fresh ephemeral key per tx |
| **Weak randomness** | Use cryptographically secure RNG |
| **Timing analysis** | Stealth doesn't help; use mixing |
| **View key compromise** | Only reveals incoming txs, not spending |
| **Spending key compromise** | Full compromise; use hardware wallet |
| **Metadata correlation** | Use Tor/VPN for broadcasting |

### 5.5 View Tag Security

The view tag (1 byte) reduces scanning work by 256x but leaks 8 bits of information.

**Analysis**:
- Attacker learns: "These addresses share the same view tag"
- With 256 possible tags: ~1/256 addresses share each tag
- Privacy loss: Minimal (256 addresses still unlinkable among themselves)
- Benefit: 255/256 addresses rejected with single byte comparison

**Recommendation**: Accept the tradeoff. 8 bits of leakage is negligible for the scanning speedup.

---

## 6. Cross-Chain Considerations

### 6.1 Chain-Specific Address Derivation

Each chain has different address formats derived from the stealth public key A:

| Chain | Derivation |
|-------|------------|
| Ethereum | `keccak256(A)[12:32]` (last 20 bytes) |
| Solana | `A` directly (ed25519 needed - see note) |
| Zcash (t-addr) | `hash160(A)` with version byte |
| Bitcoin | `hash160(A)` with version byte |

**Note on Solana**: Solana uses ed25519, not secp256k1. Options:
1. Separate meta-address for Solana (ed25519 keys)
2. Deterministic derivation from secp256k1 to ed25519

### 6.2 Multi-Chain Meta-Address

For users active on multiple chains:

```json
{
  "version": 1,
  "addresses": {
    "ethereum": "sip:ethereum:0x02...:0x03...",
    "solana": "sip:solana:base58...:base58...",
    "zcash": "sip:zcash:0x02...:0x03..."
  }
}
```

### 6.3 Registry Design

Stealth meta-addresses can be published in:

1. **On-chain registry** (like EIP-6538)
2. **ENS/DNS records**
3. **Direct sharing** (QR code, messaging)
4. **SIP resolver service** (centralized but convenient)

---

## 7. Implementation Reference

### 7.1 Current Implementation

Located at: `packages/sdk/src/stealth.ts`

```typescript
// Generate meta-address
const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
  generateStealthMetaAddress('ethereum', 'My Wallet')

// Generate stealth address for recipient
const { stealthAddress, sharedSecret } =
  generateStealthAddress(recipientMetaAddress)

// Recipient scans
const isMine = checkStealthAddress(
  stealthAddress,
  spendingPrivateKey,
  viewingPrivateKey
)

// Recipient derives private key to claim
const recovery = deriveStealthPrivateKey(
  stealthAddress,
  spendingPrivateKey,
  viewingPrivateKey
)
```

### 7.2 Dependencies

- `@noble/curves/secp256k1` - Elliptic curve operations
- `@noble/hashes/sha256` - SHA-256 hashing
- `@noble/hashes/utils` - Byte utilities

---

## 8. Test Vectors

### 8.1 Key Generation

```json
{
  "spending_private_key": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "spending_public_key": "0x02...(compute from above)",
  "viewing_private_key": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "viewing_public_key": "0x03...(compute from above)"
}
```

### 8.2 Stealth Address Generation

```json
{
  "input": {
    "spending_public_key": "0x02...",
    "viewing_public_key": "0x03...",
    "ephemeral_private_key": "0xaaaa..."
  },
  "output": {
    "ephemeral_public_key": "0x02...",
    "shared_secret_hash": "0x...",
    "view_tag": 42,
    "stealth_address": "0x02..."
  }
}
```

### 8.3 Scanning and Recovery

```json
{
  "input": {
    "stealth_address": "0x02...",
    "ephemeral_public_key": "0x02...",
    "view_tag": 42,
    "spending_private_key": "0x1234...",
    "viewing_private_key": "0xfedc..."
  },
  "output": {
    "is_mine": true,
    "derived_private_key": "0x..."
  }
}
```

### 8.4 Negative Test (Not Mine)

```json
{
  "input": {
    "stealth_address": "0x02...(generated for different recipient)",
    "ephemeral_public_key": "0x02...",
    "view_tag": 42,
    "spending_private_key": "0xWRONG...",
    "viewing_private_key": "0xWRONG..."
  },
  "output": {
    "is_mine": false
  }
}
```

---

## 9. Comparison with EIP-5564

### 9.1 Alignment

| Aspect | EIP-5564 | SIP |
|--------|----------|-----|
| Curve | secp256k1 | secp256k1 ✓ |
| Key structure | (P, Q) | (P, Q) ✓ |
| Shared secret | ECDH | ECDH ✓ |
| View tag | 1 byte | 1 byte ✓ |
| Hash function | Not specified | SHA-256 |

### 9.2 SIP Extensions

| Extension | Description |
|-----------|-------------|
| Multi-chain | Chain ID in encoding |
| Intent integration | Used for refund addresses |
| Encoding format | `sip:` URI scheme |

### 9.3 Compatibility

SIP stealth addresses are **compatible** with EIP-5564:
- Same math
- Same key structure
- Different encoding (SIP uses `sip:` prefix)

Conversion possible via encoding/decoding.

---

## 10. References

- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [EIP-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [Vitalik's Stealth Address Post](https://vitalik.eth.limo/general/2023/01/20/stealth.html)
- [Noble Curves Library](https://github.com/paulmillr/noble-curves)

---

*Document Status: SPECIFIED*
*Last Updated: November 26, 2025*
