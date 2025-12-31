# QUANTUM-RESISTANT-STORAGE: SIP Winternitz Vault Integration

| Field | Value |
|-------|-------|
| **SIP** | 10 |
| **Title** | Quantum-Resistant Storage via Winternitz Vaults |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2025-12-31 |
| **Updated** | 2025-12-31 |
| **Requires** | SIP-2 (STEALTH-ADDRESSES), SIP-3 (COMMITMENTS) |
| **External** | [solana-winternitz-vault](https://github.com/protocoldaemon-sec/solana-winternitz-vault) |

## Abstract

This specification defines the integration of SIP Protocol's privacy layer with Winternitz One-Time Signature (WOTS) vaults on Solana. The integration combines SIP's stealth addresses and Pedersen commitments with quantum-resistant hash-based cryptography, providing both **privacy** (hidden sender/amount/recipient) and **post-quantum security** (resistant to Grover's and Shor's algorithms).

The synergy is natural: both systems are built around **one-time use** primitives — SIP's stealth addresses and Winternitz signatures are each designed for single-use, making them architecturally compatible.

## Motivation

### The Quantum Threat

Current blockchain security relies on elliptic curve cryptography (Ed25519 on Solana, secp256k1 on Ethereum). These become vulnerable when sufficiently powerful quantum computers emerge:

| Algorithm | Classical Security | Quantum Security |
|-----------|-------------------|------------------|
| Ed25519 | 128-bit | ~64-bit (Grover) |
| secp256k1 | 128-bit | ~0-bit (Shor) |
| Winternitz (WOTS) | 256-bit | 128-bit+ |
| Keccak256 | 256-bit | 128-bit (Grover) |

### The Privacy Gap

Winternitz vaults provide quantum resistance but are fully transparent:
- Vault creation is public (who opened it)
- Balance is visible (how much is stored)
- Split/close operations reveal destinations

### The Combined Solution

SIP + Winternitz provides:

| Property | SIP Alone | Winternitz Alone | SIP + Winternitz |
|----------|-----------|------------------|------------------|
| Sender privacy | Yes | No | **Yes** |
| Amount privacy | Yes | No | **Yes** |
| Recipient privacy | Yes | No | **Yes** |
| Quantum resistance | No* | Yes | **Yes** |
| Compliance (viewing keys) | Yes | No | **Yes** |

*SIP's secp256k1 and ed25519 are not quantum-resistant

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SIP + WINTERNITZ ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────────┐
                           │   APPLICATION       │
                           │   (Wallet/DEX)      │
                           └──────────┬──────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PRIVACY LAYER                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │ Stealth Address   │  │ Pedersen          │  │ Viewing Key       │       │
│  │ Generation        │  │ Commitment        │  │ Encryption        │       │
│  │ (One-time dest)   │  │ (Hidden amount)   │  │ (Compliance)      │       │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘       │
│            │                      │                      │                  │
│            └──────────────────────┼──────────────────────┘                  │
│                                   │                                         │
│                          ┌────────▼────────┐                                │
│                          │ ShieldedVault   │                                │
│                          │ (SIP Wrapper)   │                                │
│                          └────────┬────────┘                                │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WINTERNITZ QUANTUM LAYER                                                   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │ WOTS Keypair      │  │ Keccak256         │  │ PDA Derivation    │       │
│  │ Generation        │  │ Merkle Root       │  │ (vault_address)   │       │
│  │ (One-time sig)    │  │ (224-bit hash)    │  │                   │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    WINTERNITZ VAULT (PDA)                             │ │
│  │  • Owner: SIP Stealth Address (privacy)                               │ │
│  │  • Balance: Hidden via Pedersen Commitment (privacy)                  │ │
│  │  • Auth: WOTS Signature (quantum-safe)                                │ │
│  │  • Metadata: Encrypted viewing key data (compliance)                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SOLANA RUNTIME                                                             │
│  • Native SOL Storage                                                       │
│  • PDA Account Management                                                   │
│  • Rent Exemption                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Specification

### 1. Key Concepts

#### 1.1 One-Time Alignment

Both systems are designed for single-use, creating natural compatibility:

| Component | SIP | Winternitz | Integration |
|-----------|-----|------------|-------------|
| Address | Stealth (one-time) | PDA (one-time) | Stealth → Vault owner |
| Signature | N/A | WOTS (one-time) | WOTS signs SIP proof |
| Lifecycle | Per-transaction | Per-transaction | Atomic operation |

#### 1.2 Security Model

```
┌────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                            │
├────────────────────────────────────────────────────────────────┤
│ Layer 3: COMPLIANCE (Viewing Keys)                             │
│ - Selective disclosure to auditors                             │
│ - Encrypted metadata in vault                                  │
├────────────────────────────────────────────────────────────────┤
│ Layer 2: PRIVACY (SIP)                                         │
│ - Stealth addresses hide recipient                             │
│ - Pedersen commitments hide amount                             │
│ - Sender anonymity via shielded intents                        │
├────────────────────────────────────────────────────────────────┤
│ Layer 1: QUANTUM RESISTANCE (Winternitz)                       │
│ - WOTS signatures: 128-bit post-quantum security               │
│ - Hash-based: No elliptic curve vulnerabilities                │
│ - One-time use: No key reuse attacks                           │
└────────────────────────────────────────────────────────────────┘
```

### 2. Data Structures

#### 2.1 ShieldedVault

```typescript
interface ShieldedVault {
  // === WINTERNITZ LAYER ===
  /** Winternitz public key merkle root (256-bit) */
  wotsMerkleRoot: Uint8Array  // 32 bytes

  /** PDA derived from merkle root */
  vaultAddress: PublicKey  // Solana PDA

  /** Vault balance in lamports (public on-chain, but hidden via commitment) */
  balance: bigint

  // === SIP PRIVACY LAYER ===
  /** One-time stealth address (owner of this vault) */
  stealthAddress: {
    address: HexString           // ed25519 stealth public key
    ephemeralPublicKey: HexString  // R for recipient scanning
    viewTag: number               // Efficient scanning
  }

  /** Pedersen commitment hiding the balance */
  balanceCommitment: {
    value: HexString        // C = balance*G + r*H
    blindingFactor: HexString  // r (kept secret)
  }

  /** Encrypted metadata for viewing key holders */
  encryptedMetadata: {
    ciphertext: HexString    // XChaCha20-Poly1305
    nonce: HexString         // 24 bytes
    viewingKeyHash: HexString  // For key identification
  }

  // === VAULT STATE ===
  /** Vault status */
  status: 'active' | 'spent'

  /** Creation timestamp */
  createdAt: number

  /** Chain ID */
  chain: 'solana'
}
```

#### 2.2 ShieldedVaultMetadata

Decrypted content of `encryptedMetadata`:

```typescript
interface ShieldedVaultMetadata {
  /** Actual balance (revealed to viewing key holders) */
  balance: bigint

  /** Blinding factor for commitment verification */
  blindingFactor: HexString

  /** Original sender (if disclosed) */
  sender?: HexString

  /** Purpose/memo */
  memo?: string

  /** Timestamp */
  timestamp: number
}
```

#### 2.3 WinternitzKeypair

```typescript
interface WinternitzKeypair {
  /** Private key material (256 x 32 bytes = 8KB) */
  privateKey: Uint8Array  // WOTS private key chain

  /** Public key (256 x 32 bytes, hashed to merkle root) */
  publicKey: Uint8Array

  /** Keccak256 merkle root of public key */
  merkleRoot: Uint8Array  // 32 bytes

  /** Has this keypair been used? (CRITICAL: must track) */
  used: boolean
}
```

### 3. Operations

#### 3.1 Open Shielded Vault

Creates a new quantum-resistant vault with privacy.

```
FUNCTION openShieldedVault(
  amount: bigint,
  recipientMetaAddress: StealthMetaAddress,
  viewingKey: ViewingKey
): ShieldedVault

STEPS:
  1. GENERATE SIP PRIVACY COMPONENTS
     ├── stealthAddress = generateEd25519StealthAddress(recipientMetaAddress)
     ├── commitment = commit(amount)
     └── metadata = encryptMetadata({balance, blindingFactor, timestamp}, viewingKey)

  2. GENERATE WINTERNITZ KEYPAIR
     ├── wots = generateWinternitzKeypair()
     └── merkleRoot = keccak256(wots.publicKey)

  3. DERIVE VAULT PDA
     └── vaultAddress = findProgramAddress([merkleRoot], WINTERNITZ_PROGRAM_ID)

  4. CREATE ON-CHAIN VAULT
     └── invoke WinternitzProgram::open_vault(merkleRoot, amount)

  5. STORE PRIVACY DATA (off-chain or in vault metadata)
     ├── stealthAddress
     ├── commitment
     └── encryptedMetadata

  RETURN ShieldedVault
```

**Pseudocode Implementation:**

```typescript
async function openShieldedVault(
  amount: bigint,
  recipientMetaAddress: StealthMetaAddress,
  viewingKey: ViewingKey,
  connection: Connection
): Promise<ShieldedVault> {
  // === SIP LAYER ===
  // Generate one-time stealth address for recipient
  const stealth = generateEd25519StealthAddress(recipientMetaAddress)

  // Hide balance with Pedersen commitment
  const commitment = commit(amount)

  // Encrypt metadata for viewing key holders
  const metadata: ShieldedVaultMetadata = {
    balance: amount,
    blindingFactor: commitment.blindingFactor,
    timestamp: Date.now()
  }
  const encrypted = encryptForViewingKey(metadata, viewingKey)

  // === WINTERNITZ LAYER ===
  // Generate fresh WOTS keypair
  const wots = generateWinternitzKeypair()
  const merkleRoot = keccak256(wots.publicKey)

  // Derive PDA
  const [vaultAddress] = PublicKey.findProgramAddressSync(
    [merkleRoot],
    WINTERNITZ_PROGRAM_ID
  )

  // Create vault on-chain
  const ix = WinternitzProgram.openVault({
    merkleRoot,
    lamports: amount
  })
  await sendTransaction(connection, ix)

  // Store WOTS private key securely (CRITICAL: must not lose this)
  await secureStorage.store(vaultAddress.toBase58(), {
    wotsPrivateKey: wots.privateKey,
    stealthPrivateKey: stealth.privateKey,  // For spending
    used: false
  })

  return {
    wotsMerkleRoot: merkleRoot,
    vaultAddress,
    balance: amount,
    stealthAddress: stealth,
    balanceCommitment: commitment,
    encryptedMetadata: encrypted,
    status: 'active',
    createdAt: Date.now(),
    chain: 'solana'
  }
}
```

#### 3.2 Split Shielded Vault

Atomically splits vault funds to two destinations with privacy.

```
FUNCTION splitShieldedVault(
  vault: ShieldedVault,
  splitAmount: bigint,
  splitRecipient: StealthMetaAddress,
  refundRecipient: StealthMetaAddress,
  viewingKey: ViewingKey,
  wotsPrivateKey: WinternitzKeypair
): { splitVault: ShieldedVault, refundVault: ShieldedVault }

STEPS:
  1. VALIDATE
     ├── REQUIRE vault.status == 'active'
     ├── REQUIRE wotsPrivateKey.used == false
     └── REQUIRE splitAmount <= vault.balance

  2. GENERATE NEW VAULTS (each with fresh keys)
     ├── splitVault = openShieldedVault(splitAmount, splitRecipient, viewingKey)
     └── refundVault = openShieldedVault(vault.balance - splitAmount, refundRecipient, viewingKey)

  3. SIGN SPLIT MESSAGE WITH WOTS
     ├── message = hash(splitVault.vaultAddress, refundVault.vaultAddress, splitAmount)
     ├── signature = wotsSign(wotsPrivateKey, message)
     └── MARK wotsPrivateKey.used = true  // CRITICAL: Never reuse

  4. EXECUTE ATOMIC SPLIT ON-CHAIN
     └── invoke WinternitzProgram::split_vault(
           vault.vaultAddress,
           splitVault.vaultAddress,
           refundVault.vaultAddress,
           signature
         )

  5. CLOSE ORIGINAL VAULT
     └── vault.status = 'spent'

  RETURN { splitVault, refundVault }
```

#### 3.3 Close Shielded Vault

Closes vault and sends all funds to a single recipient.

```
FUNCTION closeShieldedVault(
  vault: ShieldedVault,
  recipient: StealthMetaAddress,
  viewingKey: ViewingKey,
  wotsPrivateKey: WinternitzKeypair
): ShieldedVault

STEPS:
  1. VALIDATE
     ├── REQUIRE vault.status == 'active'
     └── REQUIRE wotsPrivateKey.used == false

  2. GENERATE RECIPIENT VAULT
     └── recipientVault = openShieldedVault(vault.balance, recipient, viewingKey)

  3. SIGN CLOSE MESSAGE WITH WOTS
     ├── message = hash(recipientVault.vaultAddress)
     ├── signature = wotsSign(wotsPrivateKey, message)
     └── MARK wotsPrivateKey.used = true

  4. EXECUTE CLOSE ON-CHAIN
     └── invoke WinternitzProgram::close_vault(
           vault.vaultAddress,
           recipientVault.vaultAddress,
           signature
         )

  5. UPDATE STATUS
     └── vault.status = 'spent'

  RETURN recipientVault
```

### 4. Scanning and Recovery

#### 4.1 Vault Scanning

Recipients scan for vaults belonging to them:

```
FUNCTION scanForVaults(
  spendingPrivateKey: HexString,
  viewingPrivateKey: HexString,
  vaults: ShieldedVault[]
): ShieldedVault[]

STEPS:
  FOR EACH vault IN vaults:
    // Quick view tag check (97% rejection)
    IF NOT checkViewTag(vault.stealthAddress, viewingPrivateKey):
      CONTINUE

    // Full stealth check
    IF checkEd25519StealthAddress(vault.stealthAddress, spendingPrivateKey, viewingPrivateKey):
      // Derive spending key for this vault
      stealthPrivKey = deriveEd25519StealthPrivateKey(
        vault.stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      )

      matchedVaults.push({
        vault,
        stealthPrivateKey: stealthPrivKey
      })

  RETURN matchedVaults
```

#### 4.2 Viewing Key Disclosure

Auditors can verify vault contents without spending capability:

```
FUNCTION auditVault(
  vault: ShieldedVault,
  viewingKey: ViewingKey
): AuditResult

STEPS:
  1. DECRYPT METADATA
     └── metadata = decryptWithViewingKey(vault.encryptedMetadata, viewingKey)

  2. VERIFY COMMITMENT
     ├── expectedCommitment = commit(metadata.balance, metadata.blindingFactor)
     └── REQUIRE expectedCommitment == vault.balanceCommitment

  3. RETURN AUDIT RESULT
     └── { balance: metadata.balance, timestamp: metadata.timestamp, verified: true }
```

### 5. Security Considerations

#### 5.1 WOTS Key Reuse Prevention (CRITICAL)

**Risk:** Reusing a Winternitz signature reveals ~50% of the private key, enabling forgery.

**Mitigation:**

```typescript
// Key state must be persisted and checked
interface WotsKeyState {
  merkleRoot: string
  used: boolean
  usedAt?: number
  usedFor?: string  // Transaction signature
}

async function signWithWots(
  privateKey: WinternitzKeypair,
  message: Uint8Array
): Promise<WotsSignature> {
  // Load state from persistent storage
  const state = await keyStateStore.get(privateKey.merkleRoot)

  if (state.used) {
    throw new Error(
      `CRITICAL: WOTS key ${state.merkleRoot} already used at ${state.usedAt}. ` +
      `Reuse would compromise security. Create new vault instead.`
    )
  }

  // Sign message
  const signature = wotsSign(privateKey, message)

  // IMMEDIATELY mark as used BEFORE returning
  await keyStateStore.update(privateKey.merkleRoot, {
    used: true,
    usedAt: Date.now(),
    usedFor: bytesToHex(signature)
  })

  return signature
}
```

#### 5.2 Vault Rotation Flow

Every transaction requires creating new vaults:

```
Transaction Flow:
1. User has Vault A (100 SOL)
2. User wants to send 30 SOL to Bob

Execute:
├── Create Vault B (Bob's stealth address, 30 SOL)
├── Create Vault C (User's new stealth address, 70 SOL refund)
├── Sign split with Vault A's WOTS key
├── Vault A closes (WOTS key burned)
└── Result: Vault B (Bob), Vault C (User)

User's Vault A WOTS key is NEVER usable again.
```

#### 5.3 Stealth Address + WOTS Binding

The vault's WOTS key is bound to a stealth address:

```
┌──────────────────────────────────────────────────────────────┐
│                    VAULT OWNERSHIP MODEL                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  To SPEND from vault, you need BOTH:                        │
│                                                              │
│  1. Stealth Private Key (proves you're the intended owner)  │
│     └── Derived from: spending_key + viewing_key + R        │
│                                                              │
│  2. WOTS Private Key (quantum-safe authorization)           │
│     └── Generated at vault creation, stored securely        │
│                                                              │
│  Neither alone is sufficient:                                │
│  • Stealth key without WOTS → Can't sign transactions       │
│  • WOTS without stealth → Can't prove ownership to protocol │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 5.4 Quantum Attack Vectors

| Attack | Traditional | With Winternitz |
|--------|-------------|-----------------|
| Shor's algorithm (ECDSA/Ed25519) | Vulnerable | **Protected** (hash-based) |
| Grover's algorithm (hash search) | N/A | **128-bit security** (224-bit hash) |
| Harvest now, decrypt later | At risk | **Safe** (post-quantum) |
| Key reuse exploitation | N/A | **Prevented** (one-time + tracking) |

#### 5.5 Blinding Factor Security

Blinding factors must be protected:

```
NEVER:
- Store blinding factors in plaintext on-chain
- Reuse blinding factors across commitments
- Derive blinding factors deterministically from public data

ALWAYS:
- Generate blindings from CSPRNG
- Encrypt blindings with viewing key before storage
- Verify commitment openings match stored blindings
```

### 6. API Design

#### 6.1 High-Level SDK Interface

```typescript
import { SipWinternitz } from '@sip-protocol/sdk/quantum'

// Initialize with Solana connection
const sip = new SipWinternitz({
  connection: new Connection('https://api.mainnet-beta.solana.com'),
  commitment: 'confirmed'
})

// Generate quantum-safe meta-address
const { metaAddress, privateKeys } = await sip.generateQuantumMetaAddress()
// Output: { stealthKeys, wotsKeys }

// Open a shielded vault
const vault = await sip.openVault({
  amount: 1_000_000_000n,  // 1 SOL in lamports
  recipient: recipientMetaAddress,
  viewingKey: auditorViewingKey
})

// Send funds (creates new vaults, closes old one)
const { recipientVault, changeVault } = await sip.send({
  fromVault: vault,
  toRecipient: bobMetaAddress,
  amount: 500_000_000n,  // 0.5 SOL
  viewingKey: auditorViewingKey
})

// Scan for incoming vaults
const myVaults = await sip.scan({
  spendingKey: privateKeys.spending,
  viewingKey: privateKeys.viewing
})

// Auditor verifies vault (with viewing key)
const auditResult = await sip.audit({
  vault: vault,
  viewingKey: auditorViewingKey
})
console.log(`Vault contains: ${auditResult.balance} lamports`)
```

#### 6.2 Low-Level Operations

```typescript
// Winternitz key generation
import { generateWinternitzKeypair, wotsSign, wotsVerify } from '@sip-protocol/sdk/quantum/wots'

const wots = generateWinternitzKeypair()
// wots.privateKey: 8KB (256 chains × 32 bytes)
// wots.publicKey: 8KB
// wots.merkleRoot: 32 bytes

// Sign (one-time only!)
const signature = wotsSign(wots.privateKey, message)

// Verify
const valid = wotsVerify(wots.publicKey, message, signature)

// Stealth + Commitment integration
import {
  generateEd25519StealthAddress,
  commit,
  encryptForViewingKey
} from '@sip-protocol/sdk'

const stealth = generateEd25519StealthAddress(recipientMeta)
const commitment = commit(amount)
const encrypted = encryptForViewingKey(metadata, viewingKey)
```

### 7. On-Chain Program Interface

The Winternitz program (Solana) exposes these instructions:

```rust
// Anchor-style interface
#[program]
pub mod winternitz_vault {
    // Open new vault with WOTS public key merkle root
    pub fn open_vault(
        ctx: Context<OpenVault>,
        merkle_root: [u8; 32],
    ) -> Result<()>;

    // Split vault to two destinations (requires WOTS signature)
    pub fn split_vault(
        ctx: Context<SplitVault>,
        split_lamports: u64,
        wots_signature: WotsSignature,
    ) -> Result<()>;

    // Close vault to single destination (requires WOTS signature)
    pub fn close_vault(
        ctx: Context<CloseVault>,
        wots_signature: WotsSignature,
    ) -> Result<()>;
}

// SIP extension: Store encrypted metadata
#[account]
pub struct VaultMetadata {
    pub stealth_address: [u8; 32],
    pub ephemeral_pubkey: [u8; 32],
    pub view_tag: u8,
    pub commitment: [u8; 33],
    pub encrypted_data: Vec<u8>,  // XChaCha20-Poly1305 ciphertext
}
```

### 8. Integration with SIP Settlement

The quantum storage layer plugs into SIP's settlement architecture:

```typescript
// Register as storage backend
import { SIP, QuantumStorageAdapter } from '@sip-protocol/sdk'

const sip = new SIP({
  storage: new QuantumStorageAdapter({
    program: WINTERNITZ_PROGRAM_ID,
    connection: solanaConnection
  }),
  // ... other config
})

// Now all SIP operations use quantum-resistant storage
const intent = await sip.createShieldedIntent({
  from: { chain: 'solana', ... },
  to: { chain: 'solana', ... },
  amount: '1000000000',
  privacyLevel: 'shielded'
})
// Internally uses Winternitz vaults for settlement
```

### 9. Migration Path

For existing SIP users:

```
Phase 1: Parallel Operation (M17)
├── Traditional ed25519 accounts continue to work
├── Quantum vaults available as opt-in
└── SDK detects and handles both

Phase 2: Recommended Default (M18)
├── New wallets default to quantum vaults
├── Migration tool for existing balances
└── UI shows "quantum-safe" badge

Phase 3: Full Transition (M20+)
├── Quantum vaults become standard
├── Legacy mode for backward compatibility
└── Deprecation warnings for ed25519-only
```

### 10. Performance Considerations

| Operation | Time | Size | Notes |
|-----------|------|------|-------|
| WOTS keygen | ~10ms | 16KB total | 256 × 32-byte chains |
| WOTS sign | ~5ms | ~8KB sig | One-time operation |
| WOTS verify | ~5ms | - | On-chain verification |
| Vault open | ~400ms | 1 tx | Includes rent |
| Vault split | ~800ms | 3 txs | Close + 2 opens |
| Vault scan | O(n/256) | - | View tag optimization |

**Storage Requirements:**

```
Per Vault:
├── On-chain: ~200 bytes (metadata) + rent (~0.002 SOL)
├── Off-chain (user): 16KB (WOTS keypair) + 64 bytes (stealth keys)
└── Total: ~16.3KB per active vault
```

### 11. Test Vectors

#### 11.1 WOTS Keypair Generation

```
Seed: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

Expected Merkle Root (Keccak256):
0x... (implementation-dependent, verify against reference)
```

#### 11.2 Shielded Vault Creation

```
Amount: 1_000_000_000 (1 SOL)

Stealth Address Input:
├── Spending Key: 0xd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a
└── Viewing Key:  0x3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c

Expected Output:
├── Stealth Address: 0x... (ephemeral-dependent)
├── Commitment: 0x02... (blinding-dependent)
└── Vault PDA: derived from merkle root
```

### 12. Future Extensions

#### 12.1 Threshold Vaults (M20+)

Multiple WOTS signatures required:

```typescript
// 2-of-3 quantum-safe multisig
const vault = await sip.openThresholdVault({
  amount,
  signers: [alice.wotsPubkey, bob.wotsPubkey, carol.wotsPubkey],
  threshold: 2
})

// Requires 2 WOTS signatures to spend
await sip.spend({
  vault,
  signatures: [aliceWotsSignature, bobWotsSignature]
})
```

#### 12.2 Time-Locked Vaults (M20+)

```typescript
// Vault unlocks after timestamp
const vault = await sip.openTimelockedVault({
  amount,
  recipient: recipientMeta,
  unlockTime: Date.now() + 30 * 24 * 60 * 60 * 1000  // 30 days
})
```

#### 12.3 Cross-Chain Quantum Bridge (M21+)

```typescript
// Quantum-safe cross-chain transfer
await sip.quantumBridge({
  fromVault: solanaVault,
  toChain: 'ethereum',
  recipient: ethRecipientMeta
})
// Uses quantum-safe proofs for bridge verification
```

## Reference Implementation

Pending. Will be implemented in:
- `packages/sdk/src/quantum/` - TypeScript SDK
- `programs/winternitz-sip/` - Solana program (Anchor)

## References

1. [Winternitz One-Time Signatures](https://eprint.iacr.org/2011/191.pdf)
2. [solana-winternitz-vault](https://github.com/protocoldaemon-sec/solana-winternitz-vault)
3. [Hash-Based Signatures (NIST)](https://csrc.nist.gov/projects/post-quantum-cryptography)
4. [SIP-2: Stealth Addresses](./STEALTH-ADDRESSES.md)
5. [SIP-3: Pedersen Commitments](./COMMITMENTS.md)
6. [Grover's Algorithm Impact on Cryptographic Security](https://arxiv.org/abs/quant-ph/9605043)

## Copyright

This specification is released under the MIT License.
