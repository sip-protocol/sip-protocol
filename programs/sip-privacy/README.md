# SIP Privacy - Solana Anchor Program

Privacy-preserving shielded transfers on Solana using Pedersen commitments, stealth addresses, and ZK proofs.

## Overview

The SIP Privacy program enables:

- **Hidden amounts**: Pedersen commitments (`C = v*G + r*H`)
- **Hidden recipients**: Stealth addresses (one-time addresses)
- **Compliance**: Viewing keys for selective disclosure
- **Validity proofs**: ZK proofs verify without revealing data

## Quick Start

### Prerequisites

- Rust 1.90.0+
- Anchor CLI 0.32.1
- Solana CLI 2.0+

### Build

```bash
# Check compilation
cargo check

# Full build (requires nightly cargo with edition2024)
anchor build
```

### Test

```bash
# Run unit tests
cargo test

# Run integration tests (requires local validator)
anchor test
```

### Deploy

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet
anchor deploy --provider.cluster mainnet
```

## Program ID

```
S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at
```

## Instructions

### User Instructions

| Instruction | Description |
|-------------|-------------|
| `shielded_transfer` | Transfer SOL with hidden amount |
| `shielded_token_transfer` | Transfer SPL tokens with hidden amount |
| `claim_transfer` | Claim SOL as stealth key holder |
| `claim_token_transfer` | Claim tokens as stealth key holder |

### Admin Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize` | Set up program configuration |
| `set_paused` | Emergency pause/unpause |
| `update_fee` | Update protocol fee |

### Utility Instructions

| Instruction | Description |
|-------------|-------------|
| `verify_commitment` | Verify Pedersen commitment format |
| `verify_zk_proof` | Verify ZK proof structure |

## State Accounts

### Config (PDA: `["config"]`)

Global program configuration.

| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Admin authority |
| fee_bps | u16 | Fee in basis points |
| paused | bool | Emergency pause flag |
| total_transfers | u64 | Transfer counter |
| bump | u8 | PDA bump |

### TransferRecord (PDA: `["transfer_record", sender, count]`)

Individual transfer metadata.

| Field | Type | Description |
|-------|------|-------------|
| sender | Pubkey | Original sender |
| stealth_recipient | Pubkey | One-time address |
| amount_commitment | [u8; 33] | Pedersen commitment |
| ephemeral_pubkey | [u8; 33] | For key derivation |
| viewing_key_hash | [u8; 32] | For scanning |
| encrypted_amount | Vec<u8> | Encrypted for recipient |
| timestamp | i64 | Creation time |
| claimed | bool | Claim status |
| token_mint | Option<Pubkey> | Token mint (if SPL) |
| bump | u8 | PDA bump |

### NullifierRecord (PDA: `["nullifier", nullifier]`)

Prevents double-claims.

| Field | Type | Description |
|-------|------|-------------|
| nullifier | [u8; 32] | Unique identifier |
| transfer_record | Pubkey | Associated transfer |
| claimed_at | i64 | Claim timestamp |
| bump | u8 | PDA bump |

## Errors

| Code | Name | Description |
|------|------|-------------|
| 6000 | ProgramPaused | Program is paused |
| 6001 | InvalidCommitment | Bad commitment format |
| 6002 | ProofTooLarge | Proof exceeds limit |
| 6003 | EncryptedAmountTooLarge | Encrypted data too large |
| 6004 | ProofVerificationFailed | ZK proof invalid |
| 6005 | Unauthorized | Not authority |
| 6006 | FeeTooHigh | Fee > 10% |
| 6007 | MathOverflow | Arithmetic error |
| 6008 | AlreadyClaimed | Double-claim attempt |
| 6009 | InvalidStealthProof | Wrong stealth key |
| 6010 | InvalidProofFormat | Bad proof structure |
| 6011 | UnsupportedProofType | Unknown proof type |
| 6012 | InvalidPublicInputs | Wrong input count |

## Events

### ShieldedTransferEvent

Emitted when a shielded transfer is created.

```rust
pub struct ShieldedTransferEvent {
    pub sender: Pubkey,
    pub stealth_recipient: Pubkey,
    pub amount_commitment: [u8; 33],
    pub ephemeral_pubkey: [u8; 33],
    pub viewing_key_hash: [u8; 32],
    pub timestamp: i64,
    pub transfer_id: Pubkey,
}
```

### ClaimEvent

Emitted when a transfer is claimed.

```rust
pub struct ClaimEvent {
    pub transfer_id: Pubkey,
    pub nullifier: [u8; 32],
    pub recipient: Pubkey,
    pub timestamp: i64,
}
```

## Security

See [AUDIT.md](./AUDIT.md) for the full audit package and [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) for security analysis.

### Key Security Properties

1. **Double-claim prevention**: NullifierRecord PDA
2. **Stealth key verification**: Signer constraint
3. **Integer overflow protection**: Checked arithmetic
4. **Access control**: Authority validation

## Integration

### TypeScript SDK

```typescript
import { SolanaNoirVerifier } from '@sip-protocol/sdk'

// Create verifier
const verifier = new SolanaNoirVerifier({ network: 'devnet' })
await verifier.initialize()

// Verify proof off-chain
const valid = await verifier.verifyOffChain(proof)

// Verify on-chain
const result = await verifier.verifyOnChain(proof, wallet)
```

### Direct Program Interaction

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { SipPrivacy } from './types/sip_privacy'

const program = new Program<SipPrivacy>(idl, programId, provider)

// Shielded transfer
await program.methods
  .shieldedTransfer(
    commitment,
    stealthPubkey,
    ephemeralPubkey,
    viewingKeyHash,
    encryptedAmount,
    proof,
    actualAmount
  )
  .accounts({
    config: configPda,
    transferRecord: transferRecordPda,
    sender: wallet.publicKey,
    stealthAccount: stealthAddress,
    feeCollector: feeAddress,
    systemProgram: SystemProgram.programId,
  })
  .rpc()
```

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [SIP Protocol](https://sip-protocol.org)
- [Documentation](https://docs.sip-protocol.org)
- [GitHub](https://github.com/sip-protocol)
