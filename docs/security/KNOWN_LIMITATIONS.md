# Known Limitations

## Overview

This document describes what SIP does NOT protect against, known privacy leakages, and areas requiring further development.

## Privacy Limitations

### 1. Metadata Leakage

**What leaks**:
- Transaction timing
- Transaction size
- Number of inputs/outputs
- Asset types

**Why it matters**:
- Timing correlation can link transactions
- Unique patterns can fingerprint users
- Active adversary can use timing to deanonymize

**Mitigation strategies** (not implemented):
- Random delay injection
- Transaction batching
- Decoy transactions

### 2. Network-Level Privacy

**SIP does NOT provide**:
- IP address hiding
- Tor/I2P integration
- P2P network privacy

**Attack scenario**:
```
1. Adversary runs NEAR/Zcash nodes
2. Observes which IP submits which transaction
3. Correlates IP to physical identity
4. Links transactions despite on-chain privacy
```

**Recommendation**: Use SIP with Tor or VPN

### 3. Amount Pattern Analysis

**The problem**:
```
User always sends exactly 100.00 NEAR
Pattern becomes identifiable across transactions
```

**Mitigation strategies** (not implemented):
- Standard denomination amounts
- Amount splitting
- Noise addition

### 4. Graph Analysis Resistance

**Current state**:
- Individual transactions are private
- Transaction graph still exists
- Advanced analysis may correlate flows

**What analysis can reveal**:
- Volume patterns over time
- Hot wallet identification
- Exchange deposit patterns

## Implementation Limitations

### 1. Memory Handling

**Current state**: No explicit zeroization

**Risk**:
```typescript
// Current code
const privateKey = generatePrivateKey()
// ... use key ...
// Key remains in memory until GC

// Should be
const privateKey = generatePrivateKey()
// ... use key ...
secureZero(privateKey)  // Not implemented
```

**Impact**: Private keys may persist in memory

**Future work**: Implement secure memory handling

### 2. Side-Channel Considerations

**Mitigated**:
- Timing attacks (noble/curves is constant-time)
- Cache timing (library handles this)

**Not mitigated**:
- Power analysis (hardware level)
- EM emanation (hardware level)
- Speculative execution attacks

**Assessment**: Acceptable for software implementation

### 3. Error Handling Leakage

**Potential issue**:
```typescript
// Bad: Different errors reveal information
if (!validCommitment) throw "Invalid commitment"
if (!validRange) throw "Range proof failed"

// Better: Uniform error
if (!valid) throw "Proof verification failed"
```

**Current state**: Needs audit for error timing/content

### 4. Randomness Quality

**Dependency**: OS CSPRNG (crypto.getRandomValues)

**Risk scenarios**:
- Virtualization with weak entropy
- Early boot with insufficient entropy
- Compromised OS RNG

**Mitigation**: Not currently implemented
- Could add additional entropy sources
- Could use deterministic derivation from master secret

## Protocol Limitations

### 1. No Range Proofs (Yet)

**Impact**: Malicious user could create negative amounts

```
commit(-1000) + commit(2000) = commit(1000)
But value created from nothing!
```

**Current mitigation**: Mock proofs don't enforce range

**Future work**: Implement Bulletproofs or similar

### 2. Single-Use Stealth Addresses

**Design limitation**:
- Each payment generates new address
- Recipient must scan all ephemeral keys
- O(n) scanning cost where n = all payments

**Mitigation**: View tag reduces cost to O(n/256)

**Alternative approaches** (not implemented):
- Indexed announcements
- Bloom filter announcements
- Light client protocols

### 3. No Revocation Mechanism

**Issue**: Once viewing key is shared, cannot revoke

**Scenario**:
```
1. User shares viewing key with auditor
2. User wants to revoke access
3. Cannot: auditor can still scan past transactions
4. Future transactions also visible until new keys
```

**Future work**: Key rotation protocol

### 4. Solver Trust Model

**Current state**: Solvers are semi-trusted

**What solvers know**:
- Encrypted intent contents (if they decrypt)
- Timing of intent submission
- Correlation possibilities

**What solvers cannot do**:
- Steal funds (proofs protect)
- Modify intent (signature protects)

**Future work**: MPC-based solving for full privacy

## Operational Limitations

### 1. Key Management

**User responsibility**:
- Secure key storage
- Backup and recovery
- Device security

**SIP does NOT provide**:
- Key recovery mechanisms
- Social recovery
- Hardware wallet integration (yet)

### 2. No Privacy by Default

**Issue**: Users must explicitly choose privacy level

**Risk**: Users may not understand options

**Future work**: Better UX guidance

### 3. Cross-Chain Correlation

**Challenge**:
```
1. User sends NEAR (private)
2. Receives ZEC (private)
3. But timing correlation possible
4. Amount may correlate (market rate)
```

**Mitigation strategies** (not implemented):
- Variable delays
- Amount obfuscation
- Multi-hop routing

## Cryptographic Limitations

### 1. Not Post-Quantum Secure

**Vulnerable to**:
- Shor's algorithm (breaks ECDLP)
- Future quantum computers

**Timeline**: Estimated 10-20+ years

**Future work**: Post-quantum migration path

### 2. 128-bit Security Level

**Adequate for**: Current and near-future threats

**Not adequate for**: Long-term secret protection (50+ years)

**Consideration**: Regulatory requirements may demand higher

### 3. Trusted Setup Dependency

**ZK proofs require**: Universal SRS from ceremony

**Risk**: If ceremony compromised, soundness fails

**Mitigation**: Using Aztec's ceremony with many participants

## Known Bugs and TODOs

### High Priority

| Issue | Impact | Location |
|-------|--------|----------|
| No memory zeroization | Key leakage | All key handling |
| No range proofs | Value creation | proof system |
| Limited error handling | Info leakage | Various |

### Medium Priority

| Issue | Impact | Location |
|-------|--------|----------|
| View tag leaks 8 bits | Minor info leak | stealth.ts |
| No key rotation | Revocation impossible | Protocol design |
| Single solver | Centralization | Architecture |

### Low Priority

| Issue | Impact | Location |
|-------|--------|----------|
| Timing variance | Correlation risk | Various |
| No batching | Efficiency | Protocol design |
| Limited error messages | Debug difficulty | Various |

## Comparison with Alternatives

### vs. Full Zcash

| Feature | SIP | Zcash |
|---------|-----|-------|
| Amount privacy | Yes | Yes |
| Sender privacy | Yes | Yes |
| Cross-chain | Yes | No |
| Setup | Inherited | Own ceremony |
| Maturity | New | 8+ years |

### vs. Tornado Cash

| Feature | SIP | Tornado |
|---------|-----|---------|
| Amount privacy | Yes | Fixed amounts |
| Cross-chain | Yes | No |
| Compliance option | Yes | No |
| Regulatory status | Designed for compliance | Sanctioned |

### vs. Plain Intents

| Feature | SIP | Plain Intents |
|---------|-----|---------------|
| Privacy | Full | None |
| Efficiency | Lower | Higher |
| Complexity | Higher | Lower |
| Adoption barrier | Higher | Lower |

## Recommendations

### For Users

1. Use Tor/VPN for network privacy
2. Avoid unique amount patterns
3. Don't reuse addresses
4. Understand that timing leaks

### For Integrators

1. Implement additional network privacy
2. Add random delays
3. Consider amount standardization
4. Provide privacy education

### For Auditors

1. Focus on key handling
2. Review error leakage
3. Analyze timing side channels
4. Verify proof verification logic

## Roadmap for Addressing Limitations

### Phase 1: Security Hardening
- [ ] Memory zeroization
- [ ] Error message standardization
- [ ] Additional input validation

### Phase 2: Privacy Enhancement
- [ ] Range proofs (Bulletproofs)
- [ ] Timing obfuscation
- [ ] Amount standardization

### Phase 3: Protocol Evolution
- [ ] Multi-solver support
- [ ] Key rotation
- [ ] Post-quantum preparation
