# NEAR 1Click API Privacy Analysis

Privacy threat model and mitigation strategies for NEAR Intents integration with SIP Protocol.

## Executive Summary

NEAR 1Click API provides intent-based cross-chain swaps but exposes several data points that compromise privacy. SIP Protocol's stealth addresses and Pedersen commitments can shield recipient identity and amounts, but structural limitations remain at the intent broadcast level.

## Data Exposure Analysis

### What Solvers See

When a quote is requested via 1Click API, the following data is exposed to the solver network:

| Data Point | Visibility | Privacy Impact |
|------------|------------|----------------|
| Source asset | **Full** | Links to source chain identity |
| Destination asset | **Full** | Reveals trading intent |
| Input amount | **Full** | Exact value exposed |
| Output amount (min) | **Full** | Reveals expected value |
| Refund address | **Full** | Links to source identity |
| Recipient address | **Full** | Without SIP: links to destination identity |
| Slippage tolerance | **Full** | Minor information leakage |
| Deadline | **Full** | Timing information |

### What Goes On-Chain

| Data Point | Source Chain | Destination Chain |
|------------|--------------|-------------------|
| Input amount | Visible in deposit tx | N/A |
| Output amount | N/A | Visible in settlement tx |
| Deposit address | Visible (temporary) | N/A |
| Recipient address | N/A | Visible (one-time if stealth) |
| Verifier interaction | N/A | Visible on NEAR |

### Metadata Leakage

1. **Timing Correlation**: Quote request → Deposit → Settlement creates timing fingerprint
2. **Amount Correlation**: Input/output amounts can be correlated even across chains
3. **Volume Analysis**: Large or unusual amounts stand out
4. **Pair Analysis**: Uncommon asset pairs reduce anonymity set

## Threat Scenarios

### Threat 1: Solver Surveillance

**Adversary**: Malicious or compromised solver
**Goal**: Build profile of user trading activity
**Method**: Log all quotes, correlate by refund address
**Data Obtained**:
- Full trading history by address
- Asset preferences
- Trading volume
- Timing patterns

**Risk Level**: HIGH

**Mitigation**:
- Use fresh addresses for `refundTo` (partial)
- Cannot hide amounts or assets from solvers
- SIP adds no protection at quote request level

### Threat 2: Cross-Chain Correlation

**Adversary**: Blockchain analyst
**Goal**: Link source and destination identities
**Method**: Correlate input amounts, timing, and output amounts
**Data Obtained**:
- Link between source chain address and destination address
- Transaction graph spanning multiple chains

**Risk Level**: HIGH (without SIP), MEDIUM (with SIP stealth addresses)

**Mitigation**:
- **Stealth Addresses**: Destination is one-time, unlinkable
- **Timing Noise**: Still vulnerable to timing correlation
- **Amount Correlation**: Input amounts visible; output hidden only if destination supports shielded pools

### Threat 3: Intent Broadcast Deanonymization

**Adversary**: Network observer
**Goal**: Identify who is swapping what
**Method**: Monitor intent broadcast to solver network
**Data Obtained**:
- IP address (if not using Tor/VPN)
- Full intent parameters
- Correlation with subsequent on-chain activity

**Risk Level**: MEDIUM

**Mitigation**:
- Use Tor/VPN for network privacy
- Intent parameters still exposed to solver network

### Threat 4: Deposit Address Linkability

**Adversary**: On-chain analyst
**Goal**: Link deposits to swaps
**Method**: Track deposits to known 1Click deposit addresses
**Data Obtained**:
- Confirmation user is using 1Click
- Input amounts and source addresses

**Risk Level**: LOW-MEDIUM

**Mitigation**:
- Deposit addresses are per-quote (somewhat ephemeral)
- Still links source address to swap activity

## Privacy Score by Integration Mode

| Mode | Solver Privacy | On-Chain Source | On-Chain Dest | Overall |
|------|----------------|-----------------|---------------|---------|
| Vanilla 1Click | ❌ None | ❌ Visible | ❌ Visible | **POOR** |
| + Stealth Recipient | ❌ None | ❌ Visible | ✅ Unlinkable | **FAIR** |
| + Shielded Output (Zcash) | ❌ None | ❌ Visible | ✅ Hidden | **GOOD** |
| Full SIP (future) | ⚠️ Partial | ⚠️ Commitment | ✅ Hidden | **EXCELLENT** |

## SIP Mitigation Strategies

### 1. Stealth Address as Recipient

**Implementation**:
```typescript
// Generate fresh stealth address for each swap
const { stealthAddress, ephemeralPublicKey } = generateStealthAddress(recipientMetaAddress)

// Use stealth address in 1Click quote
const quote = await oneClickAPI.quote({
  recipient: stealthAddress,
  recipientType: 'eth', // or destination chain
  // ... other params
})
```

**Privacy Gain**: Destination address is one-time, cannot be linked to recipient's public meta-address.

**Limitation**: Input side still visible; solver sees output address (just can't link it).

### 2. Commitment-Based Intent (Future)

When solvers support Pedersen commitments:

```typescript
// Hide amount in commitment
const { commitment, blinding } = commit(outputAmount)

// Intent with hidden amount
const intent = {
  destinationAsset: '...',
  outputCommitment: commitment, // Instead of plaintext amount
  proof: generateRangeProof(outputAmount, blinding),
}
```

**Privacy Gain**: Solvers verify amount is valid without knowing exact value.

**Limitation**: Requires solver protocol changes (not currently supported).

### 3. Viewing Key for Compliance

For regulated scenarios:

```typescript
// Generate viewing key for intent
const viewingKey = generateViewingKey(derivationPath)

// Create intent with encrypted data
const encryptedData = encryptForViewing({
  inputAmount,
  outputAmount,
  recipient,
}, viewingKey)

// Share viewing key with compliance officer
shareViewingKey(viewingKey, auditorPublicKey)
```

**Privacy Gain**: General public sees nothing; auditors see everything.

### 4. Batching and Mixing (Future)

**Concept**: Combine multiple intents into a batch where individual mappings are hidden.

**Implementation Considerations**:
- Requires coordination protocol
- Introduces latency
- Needs critical mass of users

## Residual Risks

Even with all mitigations, these risks remain:

### Unavoidable Exposures

1. **Solver Network**: Solvers must see *something* to provide quotes
2. **Timing Patterns**: Cross-chain timing correlation is fundamentally hard to prevent
3. **Volume Fingerprinting**: Large swaps are identifiable regardless of address privacy
4. **Chain-Specific Leakage**: Some chains have no shielded pools

### Recommended Trade-offs

| Use Case | Recommended Mode | Residual Risk |
|----------|------------------|---------------|
| Personal privacy | Stealth addresses | Timing correlation |
| Business transactions | Compliant mode + viewing keys | Auditor has full visibility |
| High-value transfers | Wait for full SIP implementation | Current: high exposure |
| Frequent trading | Accept limited privacy | Profile buildable over time |

## Recommendations for SIP Integration

### Phase 1: Current Implementation

1. **Always use stealth addresses** for recipient
2. **Rotate refund addresses** when possible
3. **Document privacy limitations** clearly to users
4. **Log nothing** on client side

### Phase 2: Enhanced Privacy

1. **Implement timing randomization** for quote requests
2. **Add decoy quote requests** (if economically feasible)
3. **Support Tor integration** for network privacy

### Phase 3: Protocol-Level Changes

1. **Propose commitment-based quotes** to NEAR Intents team
2. **Implement batch aggregation** if user base supports
3. **Integrate with Zcash shielded pools** for destination

## Conclusion

NEAR 1Click API provides significant privacy exposure at the intent broadcast level. SIP Protocol can effectively shield the destination side using stealth addresses, but input amounts and source identities remain visible. Full privacy requires protocol-level changes to support commitment-based intents.

**Current Privacy Level**: FAIR (with stealth addresses)
**Achievable Privacy Level**: GOOD (with Zcash destination)
**Ideal Privacy Level**: EXCELLENT (requires protocol evolution)
