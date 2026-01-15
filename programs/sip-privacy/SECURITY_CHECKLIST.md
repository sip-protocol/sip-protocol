# SIP Privacy Program - Security Checklist

This document tracks the security analysis for audit preparation.

## Legend

- ✅ Addressed
- ⚠️ Partial / Known limitation
- ❌ Not addressed / Needs work

---

## 1. Access Control

| Check | Status | Notes |
|-------|--------|-------|
| All privileged functions check authority | ✅ | `AdminAction` context validates |
| No public init without proper checks | ✅ | PDA prevents re-init |
| Signer validation on all user actions | ✅ | Anchor's `Signer<'info>` enforced |
| No hardcoded admin keys | ✅ | Authority set at init |

## 2. Account Validation

| Check | Status | Notes |
|-------|--------|-------|
| PDA seeds are unique per account type | ✅ | Different prefixes per PDA |
| Account discriminator checked | ✅ | Anchor handles automatically |
| Account ownership validated | ✅ | Anchor's `Account<'info, T>` |
| No type confusion attacks | ✅ | Strong typing via Anchor |
| Bump seed stored and validated | ✅ | `bump` field in all PDAs |

### PDA Collision Analysis

```
Config:         seeds = ["config"]
TransferRecord: seeds = ["transfer_record", sender, count]
NullifierRecord: seeds = ["nullifier", nullifier_bytes]
StealthAuthority: seeds = ["stealth_authority", transfer_record]
```

**Finding:** All PDAs use distinct prefix seeds. No collision possible.

## 3. Integer Arithmetic

| Check | Status | Notes |
|-------|--------|-------|
| No unchecked arithmetic | ✅ | Uses `checked_sub`, `checked_add` |
| No truncation issues | ✅ | Explicit type conversions |
| Fee calculation overflow safe | ✅ | Uses u128 intermediate |
| Transfer amount underflow protected | ✅ | `checked_sub` with error |

### Code References

```rust
// lib.rs:170 - Fee calculation
let fee_amount = (actual_amount as u128 * config.fee_bps as u128 / 10000) as u64;
let transfer_amount = actual_amount.checked_sub(fee_amount).ok_or(SipError::MathOverflow)?;

// lib.rs:462-466 - Lamport manipulation
**ctx.accounts.stealth_account.try_borrow_mut_lamports()? =
    ctx.accounts.stealth_account.lamports().checked_sub(transfer_amount)
        .ok_or(SipError::MathOverflow)?;
```

## 4. Re-entrancy Protection

| Check | Status | Notes |
|-------|--------|-------|
| State updated before external calls | ✅ | Record created before CPI |
| No callback patterns | ✅ | No callback accounts |
| CPI limited to known programs | ✅ | Only System and Token programs |

### Analysis

The program follows checks-effects-interactions pattern:
1. Validate inputs
2. Create/modify state accounts
3. Perform CPI (SOL/token transfer)
4. Emit events

## 5. Data Validation

| Check | Status | Notes |
|-------|--------|-------|
| Input size limits enforced | ✅ | `MAX_PROOF_SIZE`, etc. |
| Commitment format validated | ✅ | 0x02/0x03 prefix check |
| Proof deserialization safe | ✅ | Bounded reads, length checks |
| UTF-8 not assumed | ✅ | All data is raw bytes |

### Size Limits

| Field | Max Size | Location |
|-------|----------|----------|
| proof | 2048 bytes | lib.rs:62 |
| encrypted_amount | 64 bytes | lib.rs:137 |
| public_inputs | 32 * 32 bytes | zk_verifier/mod.rs |

## 6. Cryptographic Security

| Check | Status | Notes |
|-------|--------|-------|
| No custom crypto implementations | ⚠️ | Hash-to-curve in SDK |
| Standard curves used | ✅ | secp256k1, BN254 |
| Randomness from secure source | ✅ | Client-side, not on-chain |
| No weak key derivation | ✅ | EIP-5564 standard |

### Known Limitation

**Generator H Construction:** The H point for Pedersen commitments uses NUMS (nothing-up-my-sleeve) construction with domain separator. This is standard practice but should be verified.

```rust
// commitment/mod.rs:41
pub const H_DOMAIN: &[u8] = b"SIP-PEDERSEN-GENERATOR-H-v1";
```

## 7. Token Security (SPL)

| Check | Status | Notes |
|-------|--------|-------|
| Mint consistency validated | ✅ | Constraints on all accounts |
| Owner validation | ✅ | Constraints on token accounts |
| Authority properly derived | ✅ | PDA seeds with bump |
| No arbitrary token CPI | ✅ | Only to Token program |

### CPI Patterns

```rust
// Token transfer with PDA authority (lib.rs:528-546)
let seeds = &[
    b"stealth_authority".as_ref(),
    transfer_key.as_ref(),
    &[bump],
];
let signer_seeds = &[&seeds[..]];
let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
```

## 8. Denial of Service

| Check | Status | Notes |
|-------|--------|-------|
| Rent-exempt accounts | ✅ | Anchor default |
| Bounded loops | ✅ | No unbounded iteration |
| Compute budget reasonable | ✅ | < 400K CU per instruction |
| No attacker-controlled allocation | ✅ | Fixed-size accounts |

### Compute Analysis

See AUDIT.md for detailed compute unit analysis.

## 9. Front-running / MEV

| Check | Status | Notes |
|-------|--------|-------|
| Time-sensitive operations protected | ⚠️ | Stealth addresses help |
| Commit-reveal if needed | N/A | Not applicable |
| Slippage protection | N/A | Not a DEX |

### Analysis

Front-running risk is mitigated by:
1. Stealth addresses provide recipient unlinkability
2. Pedersen commitments hide amounts
3. No on-chain price oracle dependency

**Residual Risk:** A sophisticated attacker watching the mempool could potentially link transactions by timing, but cannot determine recipient or amount.

## 10. Upgrade Safety

| Check | Status | Notes |
|-------|--------|-------|
| No proxy pattern | ✅ | Direct program |
| No upgrade authority | ✅ | Immutable deployment |
| Migration path documented | ✅ | See AUDIT.md |

## 11. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| All errors defined | ✅ | SipError enum |
| No silent failures | ✅ | Results propagated |
| Error messages informative | ✅ | Descriptive messages |
| No panic in production | ✅ | Uses Result<> |

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | ProgramPaused | Emergency stop |
| 6001 | InvalidCommitment | Bad format |
| 6002 | ProofTooLarge | Size limit |
| 6003 | EncryptedAmountTooLarge | Size limit |
| 6004 | ProofVerificationFailed | ZK check |
| 6005 | Unauthorized | Admin only |
| 6006 | FeeTooHigh | Max 10% |
| 6007 | MathOverflow | Arithmetic |
| 6008 | AlreadyClaimed | Double-claim |
| 6009 | InvalidStealthProof | Wrong signer |
| 6010 | InvalidProofFormat | Bad structure |
| 6011 | UnsupportedProofType | Unknown type |
| 6012 | InvalidPublicInputs | Wrong count |

## 12. Event Emission

| Check | Status | Notes |
|-------|--------|-------|
| All state changes emit events | ✅ | Transfer, claim, verify |
| Events include sufficient data | ✅ | IDs, hashes, timestamps |
| No sensitive data in events | ✅ | Only commitments, not values |

### Events

- `ShieldedTransferEvent` - New transfer created
- `ClaimEvent` - Transfer claimed
- `CommitmentVerifiedEvent` - Debug verification
- `ZkProofVerifiedEvent` - ZK verification

## 13. ZK Proof Security

| Check | Status | Notes |
|-------|--------|-------|
| Proof format validated | ✅ | zk_verifier module |
| Public input count checked | ✅ | Per proof type |
| Field element bounds checked | ✅ | < curve order |
| Full verification | ⚠️ | Pending Sunspot |

### Known Limitation

**Current Implementation:** The ZK verifier performs structural validation only. Full cryptographic verification requires:

1. Sunspot verifier deployment (planned)
2. Or native alt_bn128 syscalls (future Solana feature)

**Mitigation:** Off-chain verification via @aztec/bb.js before submission.

---

## Summary

| Category | Status |
|----------|--------|
| Access Control | ✅ |
| Account Validation | ✅ |
| Integer Arithmetic | ✅ |
| Re-entrancy | ✅ |
| Data Validation | ✅ |
| Cryptography | ⚠️ |
| Token Security | ✅ |
| DoS Protection | ✅ |
| Front-running | ⚠️ |
| Upgrade Safety | ✅ |
| Error Handling | ✅ |
| Events | ✅ |
| ZK Proofs | ⚠️ |

### Key Findings

1. **Low Risk:** Well-structured program with standard patterns
2. **Medium Risk:** ZK verification not fully on-chain (documented limitation)
3. **Informational:** Single authority model (recommend multisig deployment)

### Recommendations

1. Deploy Sunspot verifiers for full ZK verification
2. Use squads.so multisig for authority
3. Add fuzzing tests for proof deserialization
4. Consider rate limiting via fee adjustments
5. Document recovery procedures for stuck transfers

---

**Reviewed by:** SIP Protocol Team
**Date:** January 2026
**Next Review:** After Sunspot integration
