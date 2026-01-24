# Threat Model

## Assets

| Asset | Description | Value |
|-------|-------------|-------|
| User SOL | Shielded funds in stealth accounts | High |
| Privacy | Transaction unlinkability | High |
| Config Account | Protocol parameters | Medium |
| Authority Key | Controls protocol | Critical |

## Threat Actors

### External Attacker

**Capabilities:** Public chain access, transaction submission
**Goals:** Steal funds, break privacy, DoS protocol

### Malicious Relayer

**Capabilities:** Transaction relay, timing analysis
**Goals:** Front-run, extract MEV, deanonymize

### Compromised Authority

**Capabilities:** Pause, fee changes, potentially upgrade
**Goals:** Extract fees, freeze funds, backdoor

### Chain Analyst

**Capabilities:** Full chain history, graph analysis
**Goals:** Link stealth addresses, identify patterns

## Attack Vectors

### A1: Commitment Forgery

**Description:** Forge commitment to claim higher amount than deposited
**Mitigations:**
- Pedersen binding property prevents this
- ZK proof must show `commitment = v*G + r*H`
- Verifier checks proof before transfer

**Status:** ✅ Mitigated (with real ZK proofs)

### A2: Stealth Address Collision

**Description:** Generate stealth address matching another user's
**Mitigations:**
- ed25519 collision resistance (128-bit security)
- Ephemeral keys are random per-transfer
- Would require breaking discrete log

**Status:** ✅ Mitigated

### A3: Viewing Key Extraction

**Description:** Extract viewing key from on-chain data
**Mitigations:**
- Only hash stored on-chain (SHA-256)
- Preimage resistance prevents recovery
- Encrypted amount uses separate key derivation

**Status:** ✅ Mitigated

### A4: Front-running Claims

**Description:** Observe claim tx in mempool, submit faster
**Mitigations:**
- Stealth address requires spending key
- Only recipient can derive spending key
- No publicly visible claim parameters

**Status:** ✅ Mitigated

### A5: Graph Analysis

**Description:** Link deposits/withdrawals by timing, amounts
**Mitigations:**
- Amounts hidden via commitments
- Stealth addresses prevent recipient linking
- View tags reduce scanning but don't leak identity

**Residual Risk:** Timing correlation still possible

### A6: Authority Key Compromise

**Description:** Attacker gains authority key access
**Impact:**
- Pause protocol (DoS)
- Set max fees (10% extraction)
- Cannot steal funds directly

**Mitigations:**
- Hardware wallet for authority
- Future: Multisig (Squads Protocol)
- Future: Timelock on sensitive operations

**Status:** ⚠️ Partially mitigated

### A7: ZK Proof Bypass

**Description:** Submit invalid proof that passes verification
**Mitigations:**
- Current: Mock proofs (not production-safe)
- Future: Real Groth16 verification via Sunspot
- Circuit constraints enforce correctness

**Status:** ❌ Not mitigated (mock proofs)

### A8: Reentrancy

**Description:** Callback to program during transfer
**Mitigations:**
- No external CPI calls in transfer
- State updated before SOL transfer
- Single instruction execution

**Status:** ✅ Mitigated

### A9: Integer Overflow

**Description:** Overflow amount calculations
**Mitigations:**
- Rust's checked arithmetic by default
- `checked_add`, `checked_sub` for fees
- Amount validated as u64

**Status:** ✅ Mitigated

### A10: Account Confusion

**Description:** Pass wrong account types to instruction
**Mitigations:**
- Anchor account validation
- PDA derivation checks
- Account discriminators

**Status:** ✅ Mitigated

## Risk Matrix

| Attack | Likelihood | Impact | Risk | Status |
|--------|------------|--------|------|--------|
| A1: Commitment Forgery | Low | Critical | Medium | ✅ |
| A2: Stealth Collision | Very Low | High | Low | ✅ |
| A3: VK Extraction | Very Low | High | Low | ✅ |
| A4: Front-running | Low | High | Medium | ✅ |
| A5: Graph Analysis | Medium | Medium | Medium | ⚠️ |
| A6: Authority Compromise | Low | High | Medium | ⚠️ |
| A7: ZK Bypass | High | Critical | Critical | ❌ |
| A8: Reentrancy | Very Low | Critical | Low | ✅ |
| A9: Overflow | Very Low | High | Low | ✅ |
| A10: Account Confusion | Low | High | Medium | ✅ |

## Pre-Mainnet Requirements

1. **Critical:** Implement real ZK proof verification (A7)
2. **High:** Add multisig authority (A6)
3. **Medium:** Add transaction timing jitter (A5)
