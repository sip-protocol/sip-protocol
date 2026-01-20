# SIP-002: Stealth Address Format

```
SIP: 002
Title: Stealth Address Format Specification
Author: SIP Protocol Team <team@sip-protocol.org>
Status: Draft
Type: Standards Track
Category: Core
Created: 2026-01-21
Requires: None
Required by: SIP-001
```

## Abstract

This SIP defines the stealth address format for the Shielded Intents Protocol. Stealth addresses enable recipients to receive payments at unique, unlinkable addresses derived from a single public meta-address, providing recipient privacy without requiring sender-recipient coordination.

## Motivation

Traditional blockchain addresses create a permanent link between all transactions to that address. This enables:

- **Address clustering**: Linking transactions to identify users
- **Balance tracking**: Monitoring wealth accumulation over time
- **Transaction graph analysis**: Mapping economic relationships

Stealth addresses solve this by generating a fresh, one-time address for each transaction. The recipient can derive the private key for each address using their viewing key, while observers cannot link addresses to the recipient's identity.

### Comparison with Existing Standards

| Feature | SIP-002 | EIP-5564 | Monero | Zcash |
|---------|---------|----------|--------|-------|
| Multi-chain | Yes | Ethereum only | Monero only | Zcash only |
| View tags | Yes | Yes | Yes | No |
| Viewing keys | Full support | Partial | Yes | Yes |
| URI format | Yes | No | No | No |
| Curve agnostic | Yes | secp256k1 only | ed25519 only | BLS12-381 |

## Specification

### 1. Meta-Address Structure

A stealth meta-address is the public identity that recipients share. It consists of two public keys:

```typescript
interface StealthMetaAddress {
  // Blockchain identifier
  chain: ChainId

  // Public key for spending (controls funds)
  spendingPublicKey: CompressedPublicKey

  // Public key for viewing (enables scanning)
  viewingPublicKey: CompressedPublicKey

  // Elliptic curve used
  curve: CurveType
}
```

#### 1.1 Chain Identifiers

```typescript
type ChainId =
  // EVM chains
  | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalanche' | 'bsc'
  // Non-EVM chains
  | 'solana' | 'near' | 'bitcoin' | 'cosmos' | 'sui' | 'aptos'
  // Testnets (append -testnet)
  | 'ethereum-testnet' | 'solana-testnet' | 'near-testnet'
```

#### 1.2 Curve Types

| Chain | Curve | Key Format |
|-------|-------|------------|
| Ethereum, Bitcoin, EVM | secp256k1 | 33-byte compressed |
| Solana, NEAR | ed25519 | 32-byte |
| ZK chains | bn254 | 32-byte |

### 2. URI Format

Meta-addresses MUST be encoded as URIs for sharing:

```
sip:<chain>:<spendingKey>:<viewingKey>[?<params>]
```

#### 2.1 Components

| Component | Required | Description |
|-----------|----------|-------------|
| `sip:` | Yes | URI scheme identifier |
| `<chain>` | Yes | Chain identifier |
| `<spendingKey>` | Yes | Hex-encoded spending public key |
| `<viewingKey>` | Yes | Hex-encoded viewing public key |
| `?<params>` | No | Optional query parameters |

#### 2.2 Optional Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `label` | Human-readable label | `?label=Alice` |
| `curve` | Explicit curve (if not chain default) | `?curve=ed25519` |
| `version` | Protocol version | `?version=1` |

#### 2.3 Examples

```
# Ethereum (secp256k1)
sip:ethereum:0x02abc123def456789...abc:0x03def456abc789012...def

# Solana (ed25519)
sip:solana:0x1234567890abcdef...123:0x234567890abcdef1...234

# With label
sip:ethereum:0x02abc123...abc:0x03def456...def?label=Alice%20Wallet

# Bitcoin (explicit chain)
sip:bitcoin:0x02abc123...abc:0x03def456...def?version=1
```

### 3. Key Derivation

#### 3.1 From Seed Phrase

Meta-address keys SHOULD be derived from a BIP-39 seed phrase:

```
FUNCTION deriveFromSeed(mnemonic: string, chainId: ChainId) -> KeyPair:
    // Standard BIP-39 seed
    seed = bip39.mnemonicToSeed(mnemonic)

    // Derive SIP-specific master key
    // Path: m/purpose'/coin_type'/account'/change/index
    // SIP purpose: 5564 (EIP-5564 compatibility)
    masterKey = HKDF(seed, "sip-master-key", 64)

    // Split into spending and viewing keys
    spendingPrivateKey = masterKey[0:32]
    viewingPrivateKey = masterKey[32:64]

    // Derive public keys based on chain curve
    curve = getCurve(chainId)
    spendingPublicKey = curve.getPublicKey(spendingPrivateKey)
    viewingPublicKey = curve.getPublicKey(viewingPrivateKey)

    RETURN {
        spendingPrivateKey,
        spendingPublicKey,
        viewingPrivateKey,
        viewingPublicKey
    }
```

#### 3.2 Deterministic Derivation Paths

For HD wallet compatibility:

```
# SIP derivation path
m/5564'/<coin_type>'/<account>'/<change>/<index>

# Examples:
m/5564'/60'/0'/0/0    # Ethereum, account 0, spending key
m/5564'/60'/0'/0/1    # Ethereum, account 0, viewing key
m/5564'/501'/0'/0/0   # Solana, account 0, spending key
m/5564'/501'/0'/0/1   # Solana, account 0, viewing key
```

### 4. Stealth Address Derivation

#### 4.1 Sender-Side Generation

When sending to a stealth meta-address:

```
FUNCTION deriveStealthAddress(
    metaAddress: StealthMetaAddress,
    ephemeralPrivateKey?: bytes32
) -> StealthAddress:

    curve = getCurve(metaAddress.chain)

    // Generate ephemeral key pair if not provided
    IF ephemeralPrivateKey IS NULL:
        ephemeralPrivateKey = secureRandom(32)

    ephemeralPublicKey = curve.getPublicKey(ephemeralPrivateKey)

    // ECDH: shared secret = ephemeral_private * viewing_public
    sharedSecret = curve.ecdh(
        ephemeralPrivateKey,
        metaAddress.viewingPublicKey
    )

    // Hash shared secret to get scalar
    sharedSecretScalar = SHA256(sharedSecret)

    // Derive stealth public key
    // P_stealth = hash(S) * G + P_spending
    hashPoint = curve.scalarMultiply(sharedSecretScalar, curve.G)
    stealthPublicKey = curve.pointAdd(
        hashPoint,
        metaAddress.spendingPublicKey
    )

    // Generate view tag (first byte of hash for quick scanning)
    viewTag = SHA256(sharedSecret)[0]

    // Compute address (chain-specific)
    address = computeAddress(stealthPublicKey, metaAddress.chain)

    RETURN {
        address: address,
        ephemeralPublicKey: ephemeralPublicKey,
        viewTag: viewTag,
        chainAddress: formatChainAddress(address, metaAddress.chain)
    }
```

#### 4.2 Recipient-Side Recovery

Recipient derives private key to spend funds:

```
FUNCTION recoverStealthPrivateKey(
    ephemeralPublicKey: CompressedPublicKey,
    viewingPrivateKey: bytes32,
    spendingPrivateKey: bytes32,
    chain: ChainId
) -> bytes32:

    curve = getCurve(chain)

    // ECDH: shared secret = viewing_private * ephemeral_public
    sharedSecret = curve.ecdh(
        viewingPrivateKey,
        ephemeralPublicKey
    )

    // Hash shared secret
    sharedSecretScalar = SHA256(sharedSecret)

    // Derive stealth private key
    // s_stealth = hash(S) + s_spending (mod n)
    stealthPrivateKey = curve.scalarAdd(
        sharedSecretScalar,
        spendingPrivateKey
    )

    RETURN stealthPrivateKey
```

### 5. View Tag Optimization

View tags enable efficient scanning by pre-filtering transactions:

```
FUNCTION checkViewTag(
    ephemeralPublicKey: CompressedPublicKey,
    viewingPrivateKey: bytes32,
    expectedViewTag: number
) -> boolean:

    // Quick ECDH check
    sharedSecret = ecdh(viewingPrivateKey, ephemeralPublicKey)
    computedViewTag = SHA256(sharedSecret)[0]

    RETURN computedViewTag == expectedViewTag
```

**Performance Impact:**

| Without View Tag | With View Tag |
|------------------|---------------|
| Full ECDH + point add per tx | 1 ECDH per tx |
| O(n) full derivations | O(n/256) full derivations |
| ~1ms per tx | ~0.01ms per tx (average) |

### 6. Chain-Specific Address Formats

#### 6.1 Ethereum / EVM

```
FUNCTION computeEthereumAddress(publicKey: bytes33) -> string:
    // Decompress if needed
    uncompressed = secp256k1.decompress(publicKey)

    // Keccak256 of uncompressed key (without prefix)
    hash = keccak256(uncompressed[1:65])

    // Take last 20 bytes
    address = "0x" + hash[12:32].toHex()

    RETURN address.toLowerCase()
```

#### 6.2 Solana

```
FUNCTION computeSolanaAddress(publicKey: bytes32) -> string:
    // Solana addresses ARE the public key (base58 encoded)
    address = base58.encode(publicKey)

    RETURN address
```

#### 6.3 Bitcoin

```
FUNCTION computeBitcoinAddress(publicKey: bytes33, network: string) -> string:
    // P2WPKH (native SegWit)
    hash160 = RIPEMD160(SHA256(publicKey))

    IF network == "mainnet":
        prefix = "bc"
    ELSE:
        prefix = "tb"

    // Bech32 encoding
    address = bech32.encode(prefix, 0, hash160)

    RETURN address
```

#### 6.4 NEAR

```
FUNCTION computeNearAddress(publicKey: bytes32) -> string:
    // NEAR uses ed25519 public keys directly
    // Format: ed25519:<base58-pubkey>
    address = "ed25519:" + base58.encode(publicKey)

    RETURN address
```

### 7. Announcement Protocol

Senders MUST announce stealth payments for recipients to discover:

#### 7.1 Announcement Format

```typescript
interface StealthAnnouncement {
  // Stealth address receiving funds
  stealthAddress: string

  // Ephemeral public key for derivation
  ephemeralPublicKey: CompressedPublicKey

  // View tag for efficient scanning
  viewTag: number

  // Optional: encrypted memo
  encryptedMemo?: HexString

  // Block number/slot when announced
  blockNumber: number

  // Transaction hash containing announcement
  txHash: HexString32
}
```

#### 7.2 On-Chain Announcement (EVM)

For EVM chains, use the EIP-5564 Announcer contract:

```solidity
interface ISIPAnnouncer {
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external;
}
```

#### 7.3 Scheme IDs

| Scheme ID | Description | Curve |
|-----------|-------------|-------|
| 0 | Reserved | - |
| 1 | secp256k1 + ECDH | secp256k1 |
| 2 | ed25519 + X25519 | ed25519 |
| 3 | bn254 (ZK-friendly) | bn254 |

### 8. Security Considerations

#### 8.1 Key Security

- Spending private key MUST be stored securely (cold storage recommended)
- Viewing private key MAY be stored on hot devices for scanning
- Ephemeral private keys MUST be discarded after use

#### 8.2 Privacy Guarantees

**Protected:**
- Recipient identity (unlinkable addresses)
- Transaction linkability (fresh address per tx)
- Address reuse patterns

**NOT Protected:**
- Sender identity (separate from stealth addresses)
- Transaction amounts (use Pedersen commitments)
- Transaction timing/existence

#### 8.3 Known Vulnerabilities

| Attack | Risk | Mitigation |
|--------|------|------------|
| Ephemeral key reuse | Address linkability | Fresh random key per tx |
| View tag collision | False positives | Full derivation check |
| Timing attacks | Key extraction | Constant-time ops |
| Invalid curve attack | Key recovery | Point validation |

### 9. Reference Implementation

```typescript
import { secp256k1 } from '@noble/curves/secp256k1'
import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'

export function deriveStealthAddress(
  spendingPubKey: Uint8Array,
  viewingPubKey: Uint8Array,
  curve: 'secp256k1' | 'ed25519' = 'secp256k1'
): StealthAddress {
  const curveLib = curve === 'secp256k1' ? secp256k1 : ed25519

  // Generate ephemeral key
  const ephemeralPrivKey = curveLib.utils.randomPrivateKey()
  const ephemeralPubKey = curveLib.getPublicKey(ephemeralPrivKey)

  // ECDH shared secret
  const sharedSecret = curveLib.getSharedSecret(ephemeralPrivKey, viewingPubKey)

  // Derive scalar
  const scalar = sha256(sharedSecret)

  // Compute stealth public key
  const scalarPoint = curveLib.ProjectivePoint.BASE.multiply(
    BigInt('0x' + Buffer.from(scalar).toString('hex'))
  )
  const spendingPoint = curveLib.ProjectivePoint.fromHex(spendingPubKey)
  const stealthPoint = scalarPoint.add(spendingPoint)
  const stealthPubKey = stealthPoint.toRawBytes(true)

  // View tag
  const viewTag = sha256(sharedSecret)[0]

  return {
    address: computeAddress(stealthPubKey, curve),
    ephemeralPublicKey: ephemeralPubKey,
    viewTag,
    stealthPublicKey: stealthPubKey
  }
}

export function recoverStealthPrivateKey(
  ephemeralPubKey: Uint8Array,
  viewingPrivKey: Uint8Array,
  spendingPrivKey: Uint8Array,
  curve: 'secp256k1' | 'ed25519' = 'secp256k1'
): Uint8Array {
  const curveLib = curve === 'secp256k1' ? secp256k1 : ed25519

  // Recreate shared secret
  const sharedSecret = curveLib.getSharedSecret(viewingPrivKey, ephemeralPubKey)

  // Derive scalar
  const scalar = sha256(sharedSecret)

  // Add to spending private key (mod n)
  const scalarBigInt = BigInt('0x' + Buffer.from(scalar).toString('hex'))
  const spendingBigInt = BigInt('0x' + Buffer.from(spendingPrivKey).toString('hex'))
  const stealthPrivBigInt = (scalarBigInt + spendingBigInt) % curveLib.CURVE.n

  return numberToBytes(stealthPrivBigInt, 32)
}
```

### 10. Test Vectors

See [SIP-002 Test Vectors](../test-vectors/stealth-addresses.json).

#### 10.1 secp256k1 Vector

```json
{
  "curve": "secp256k1",
  "spendingPrivateKey": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "viewingPrivateKey": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "ephemeralPrivateKey": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "expectedStealthAddress": "0x7c3a...(chain-specific)",
  "expectedViewTag": 42
}
```

### 11. Compatibility

#### 11.1 EIP-5564 Compatibility

SIP-002 is fully compatible with EIP-5564:

- Same ECDH derivation scheme
- Same view tag optimization
- Compatible announcement format

#### 11.2 ERC-6538 Registry

Meta-addresses can be registered in ERC-6538 registries:

```solidity
interface IERC6538Registry {
    function registerKeys(
        uint256 schemeId,
        bytes calldata stealthMetaAddress
    ) external;

    function stealthMetaAddressOf(
        address registrant,
        uint256 schemeId
    ) external view returns (bytes memory);
}
```

## Rationale

### Why Two Keys (Spending + Viewing)?

Separating spending and viewing enables:
1. Hot wallet scanning with viewing key only
2. Cold storage for spending key
3. Selective disclosure without spending access

### Why ECDH?

ECDH provides:
1. Perfect forward secrecy (ephemeral keys)
2. Non-interactive derivation
3. Standard, audited implementations

### Why View Tags?

View tags reduce scanning cost by 256x on average, making mobile/light clients viable.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
