# SIP Privacy Anchor Program - Audit Package

**Program ID:** `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`
**Version:** 0.1.0
**Anchor Version:** 0.32.1
**Rust Version:** 1.90.0

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Instructions](#instructions)
4. [State Accounts](#state-accounts)
5. [Security Model](#security-model)
6. [Threat Model](#threat-model)
7. [Compute Analysis](#compute-analysis)
8. [Known Limitations](#known-limitations)
9. [Upgrade Path](#upgrade-path)
10. [Test Coverage](#test-coverage)

---

## Overview

The SIP Privacy program enables privacy-preserving transfers on Solana using:

- **Pedersen Commitments**: Hide transfer amounts (`C = v*G + r*H`)
- **Stealth Addresses**: Hide recipient identity (one-time addresses)
- **Viewing Keys**: Enable selective disclosure for compliance
- **ZK Proofs**: Verify validity without revealing private data

### Core Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SENDER (off-chain)                                                         │
│  1. Generate stealth address from recipient's public keys                   │
│  2. Create Pedersen commitment to amount                                    │
│  3. Encrypt amount with recipient's viewing key                             │
│  4. Generate ZK proof of valid commitment                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PRIVACY PROGRAM (on-chain)                                             │
│  1. Verify commitment format (compressed secp256k1 point)                   │
│  2. Verify ZK proof structure                                               │
│  3. Create TransferRecord PDA                                               │
│  4. Transfer funds to stealth address                                       │
│  5. Emit ShieldedTransferEvent                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECIPIENT (off-chain + on-chain)                                           │
│  1. Scan events with viewing key                                            │
│  2. Derive stealth private key                                              │
│  3. Call claim_transfer with nullifier                                      │
│  4. Receive funds to main wallet                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Dependencies

```toml
[dependencies]
anchor-lang = "0.32.1"
anchor-spl = "0.32.1"
bytemuck = { version = "1.20.0", features = ["derive"] }
```

### Module Structure

```
programs/sip-privacy/
├── Anchor.toml              # Program configuration
├── Cargo.toml               # Rust dependencies
└── src/
    ├── lib.rs               # Main program (instructions, accounts, errors)
    ├── commitment/          # Pedersen commitment verification
    │   └── mod.rs
    └── zk_verifier/         # ZK proof verification
        └── mod.rs
```

### Program Accounts

| Account | Type | Purpose |
|---------|------|---------|
| Config | PDA | Global program configuration |
| TransferRecord | PDA | Individual transfer metadata |
| NullifierRecord | PDA | Prevents double-claims |

---

## Instructions

### 1. `initialize`

**Purpose:** Initialize program configuration

**Accounts:**
- `config` (init, PDA) - Program configuration
- `authority` (signer, mut) - Initial authority
- `system_program` - System program

**Parameters:**
- `fee_bps: u16` - Protocol fee in basis points (max 1000 = 10%)

**Security Considerations:**
- Can only be called once (PDA already initialized check)
- Authority is set to caller

### 2. `shielded_transfer`

**Purpose:** Execute a shielded native SOL transfer

**Accounts:**
- `config` (mut, PDA) - Validates not paused
- `transfer_record` (init, PDA) - Stores transfer metadata
- `sender` (signer, mut) - Pays for transfer and rent
- `stealth_account` (mut) - Recipient stealth address
- `fee_collector` (mut) - Receives protocol fee
- `system_program` - For SOL transfer

**Parameters:**
- `amount_commitment: [u8; 33]` - Pedersen commitment
- `stealth_pubkey: Pubkey` - One-time recipient address
- `ephemeral_pubkey: [u8; 33]` - For stealth key derivation
- `viewing_key_hash: [u8; 32]` - For compliance scanning
- `encrypted_amount: Vec<u8>` - Amount encrypted for recipient
- `proof: Vec<u8>` - ZK proof of valid commitment
- `actual_amount: u64` - Actual transfer amount (for SOL transfer)

**Security Considerations:**
- Commitment format validated (0x02 or 0x03 prefix)
- Proof size limited to 2048 bytes
- Encrypted amount limited to 64 bytes
- Fee calculation uses checked arithmetic
- Transfer record uniquely derived from sender + transfer count

### 3. `shielded_token_transfer`

**Purpose:** Execute a shielded SPL token transfer

**Additional Accounts:**
- `token_mint` - Token being transferred
- `sender_token_account` - Source token account
- `stealth_token_account` - Destination token account
- `fee_token_account` - Fee collector token account
- `token_program` - SPL Token program

**Security Considerations:**
- Token account ownership validated
- Mint consistency validated across all token accounts

### 4. `claim_transfer`

**Purpose:** Claim a shielded transfer as the recipient

**Accounts:**
- `config` (PDA) - Validates not paused
- `transfer_record` (mut) - Marks as claimed
- `nullifier_record` (init, PDA) - Prevents double-claim
- `stealth_account` (signer, mut) - Proves ownership
- `recipient` (signer, mut) - Receives funds
- `system_program` - For SOL transfer

**Parameters:**
- `nullifier: [u8; 32]` - Unique identifier preventing replay
- `proof: Vec<u8>` - ZK proof of stealth key ownership

**Security Considerations:**
- Stealth account must sign (proves ownership)
- Nullifier PDA prevents double-claims
- Transfer record marked claimed atomically
- Funds transferred via direct lamport manipulation

### 5. `claim_token_transfer`

**Purpose:** Claim a shielded token transfer

**Additional Accounts:**
- `stealth_authority` (PDA) - Authority for stealth token account
- `stealth_token_account` - Source tokens
- `recipient_token_account` - Destination tokens
- `token_program` - SPL Token program

**Security Considerations:**
- Stealth authority is PDA derived from transfer record
- CPI to token program with signer seeds

### 6. `verify_commitment`

**Purpose:** Standalone commitment verification (testing/debugging)

**Accounts:**
- `payer` (signer) - Pays for compute

**Parameters:**
- `commitment: [u8; 33]` - Commitment to verify
- `value: u64` - Claimed value
- `blinding: [u8; 32]` - Blinding factor

### 7. `verify_zk_proof`

**Purpose:** Standalone ZK proof verification

**Accounts:**
- `payer` (signer) - Pays for compute

**Parameters:**
- `proof_data: Vec<u8>` - Serialized proof with public inputs

**Supported Proof Types:**
- `0` = Funding proof (3 public inputs)
- `1` = Validity proof (6 public inputs)
- `2` = Fulfillment proof (8 public inputs)

### 8. `set_paused`

**Purpose:** Emergency pause mechanism

**Accounts:**
- `config` (mut, PDA) - Updates pause flag
- `authority` (signer) - Must be program authority

**Security Considerations:**
- Only authority can pause/unpause
- Paused state blocks transfers and claims

### 9. `update_fee`

**Purpose:** Update protocol fee

**Accounts:**
- `config` (mut, PDA) - Updates fee
- `authority` (signer) - Must be program authority

**Parameters:**
- `new_fee_bps: u16` - New fee (max 1000 = 10%)

---

## State Accounts

### Config

```rust
pub struct Config {
    pub authority: Pubkey,      // 32 bytes - Admin authority
    pub fee_bps: u16,           // 2 bytes - Fee in basis points
    pub paused: bool,           // 1 byte - Pause flag
    pub total_transfers: u64,   // 8 bytes - Transfer counter
    pub bump: u8,               // 1 byte - PDA bump
}
// Total: 44 bytes + 8 discriminator = 52 bytes
```

### TransferRecord

```rust
pub struct TransferRecord {
    pub sender: Pubkey,                    // 32 bytes
    pub stealth_recipient: Pubkey,         // 32 bytes
    pub amount_commitment: [u8; 33],       // 33 bytes
    pub ephemeral_pubkey: [u8; 33],        // 33 bytes
    pub viewing_key_hash: [u8; 32],        // 32 bytes
    pub encrypted_amount: Vec<u8>,         // 4 + 64 bytes (max)
    pub timestamp: i64,                    // 8 bytes
    pub claimed: bool,                     // 1 byte
    pub token_mint: Option<Pubkey>,        // 1 + 32 bytes
    pub bump: u8,                          // 1 byte
}
// Total: ~277 bytes + 8 discriminator = ~285 bytes
```

### NullifierRecord

```rust
pub struct NullifierRecord {
    pub nullifier: [u8; 32],        // 32 bytes
    pub transfer_record: Pubkey,    // 32 bytes
    pub claimed_at: i64,            // 8 bytes
    pub bump: u8,                   // 1 byte
}
// Total: 73 bytes + 8 discriminator = 81 bytes
```

---

## Security Model

### Access Control

| Action | Required Authority |
|--------|-------------------|
| Initialize | Any (once) |
| Shielded Transfer | Any sender with funds |
| Claim Transfer | Stealth key holder |
| Set Paused | Config authority only |
| Update Fee | Config authority only |

### PDA Seeds

| PDA | Seeds | Purpose |
|-----|-------|---------|
| Config | `["config"]` | Singleton config |
| TransferRecord | `["transfer_record", sender, transfer_count]` | Unique per transfer |
| NullifierRecord | `["nullifier", nullifier_bytes]` | Prevents double-claim |
| StealthAuthority | `["stealth_authority", transfer_record]` | Token transfer authority |

### Cryptographic Assumptions

1. **secp256k1 DLOG hardness**: Pedersen commitment hiding
2. **SHA256 preimage resistance**: Nullifier uniqueness
3. **XChaCha20-Poly1305 IND-CCA2**: Encrypted amount confidentiality
4. **UltraHonk soundness**: ZK proof validity

---

## Threat Model

### Assets

1. **User funds** (SOL and SPL tokens)
2. **Privacy** (amounts, recipients)
3. **Protocol fees**
4. **Program availability**

### Threat Actors

1. **External attacker** - Attempts to steal funds or break privacy
2. **Malicious sender** - Attempts to create invalid transfers
3. **Malicious recipient** - Attempts double-claim
4. **Compromised authority** - Attempts unauthorized admin actions

### Threats and Mitigations

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Double-claim | Fund loss | Nullifier PDA prevents replay |
| Invalid commitment | Fund lock | Format validation + ZK proof |
| Front-running | Privacy leak | Stealth addresses provide unlinkability |
| Integer overflow | Fund loss | Checked arithmetic throughout |
| Account confusion | Privilege escalation | Anchor account validation |
| Rent drain | Denial of service | Rent-exempt accounts |
| Authority compromise | Admin abuse | Single authority, no key rotation (limitation) |
| ZK proof forgery | Invalid claims | Off-chain + on-chain verification |

### Attack Scenarios

#### Scenario 1: Double-Claim Attempt

**Attack:** Recipient tries to claim same transfer twice

**Defense:**
1. NullifierRecord PDA created on first claim
2. Second claim fails with `AccountAlreadyInUse`

#### Scenario 2: Stealth Address Theft

**Attack:** Attacker intercepts transfer and claims

**Defense:**
1. Stealth account must sign claim transaction
2. Only recipient can derive stealth private key

#### Scenario 3: Commitment Manipulation

**Attack:** Sender claims commitment is X, transfers Y

**Defense:**
1. Commitment format validated on-chain
2. ZK proof ensures commitment matches actual amount
3. (Future) Full cryptographic verification

---

## Compute Analysis

### Instruction Costs

| Instruction | Estimated CU | Notes |
|-------------|--------------|-------|
| initialize | ~20,000 | Account creation only |
| shielded_transfer | ~100,000 | CPI + account creation |
| shielded_token_transfer | ~120,000 | Additional token CPI |
| claim_transfer | ~80,000 | Nullifier + lamport transfer |
| claim_token_transfer | ~100,000 | Additional token CPI |
| verify_commitment | ~5,000 | Format validation only |
| verify_zk_proof | ~50,000 | Deserialization + validation |

### Full ZK Verification (Future)

| Proof Type | Estimated CU | Status |
|------------|--------------|--------|
| Funding | ~200,000 | Pending Sunspot |
| Validity | ~350,000 | Pending Sunspot |
| Fulfillment | ~250,000 | Pending Sunspot |

---

## Known Limitations

### Current Implementation

1. **ZK proofs not fully verified on-chain**
   - Current: Format validation only
   - Future: Sunspot verifier integration
   - Risk: Must trust off-chain verification

2. **Single authority model**
   - No multisig or DAO governance
   - No authority rotation mechanism
   - Recommended: Deploy with multisig

3. **Non-upgradeable**
   - Program is immutable once deployed
   - Bug fixes require new deployment + migration

4. **Commitment verification placeholder**
   - Full EC verification requires solana-secp256k1
   - Would cost ~60,000 CU per verification

### Operational Risks

1. **RPC dependency**: Event scanning requires reliable RPC
2. **Key management**: Lost stealth keys = lost funds
3. **Compliance**: Viewing key disclosure is voluntary

---

## Upgrade Path

### Current Design: Non-Upgradeable

The program is deployed as non-upgradeable for security:
- No proxy pattern
- No upgrade authority
- Immutable bytecode

### Migration Strategy

For bug fixes or feature additions:

1. Deploy new program with new ID
2. Migrate liquidity via claim + re-deposit
3. Update SDK to support both programs
4. Deprecate old program over time

### Future Considerations

If upgradeability becomes necessary:
- Consider squads.so multisig
- Consider governance token voting
- Consider timelock mechanisms

---

## Test Coverage

### Unit Tests

| Module | File | Coverage |
|--------|------|----------|
| commitment | `commitment/mod.rs` | 100% |
| zk_verifier | `zk_verifier/mod.rs` | 100% |

### Integration Tests

| Test | Status | Description |
|------|--------|-------------|
| Initialize | ✅ | Basic setup |
| Shielded transfer | ✅ | Full flow |
| Claim transfer | ✅ | Recipient claim |
| Double-claim prevention | ✅ | Nullifier check |
| Pause mechanism | ✅ | Admin controls |
| Fee collection | ✅ | Protocol fees |

### Recommended Additional Tests

- [ ] Fuzzing for proof deserialization
- [ ] Concurrent claim attempts
- [ ] Maximum data size handling
- [ ] Cross-program invocation attacks

---

## Appendix: Security Checklist

See [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) for detailed security analysis.

---

**Prepared for audit by:** SIP Protocol Team
**Date:** January 2026
**Contact:** security@sip-protocol.org
