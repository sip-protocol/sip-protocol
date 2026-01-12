# Privacy Backends Architecture

> **Purpose**: Technical comparison of privacy backends and architectural rationale for SIP Native.

---

## Overview

SIP Protocol supports multiple privacy backends through a unified `PrivacyBackend` interface. This allows developers to choose the best privacy approach for their use case while maintaining a consistent API.

```
┌─────────────────────────────────────────────────────────────┐
│                      SIP SDK                                │
│                         │                                   │
│              ┌──────────┴──────────┐                        │
│              │  PrivacyBackend     │                        │
│              │  Interface (#483)   │                        │
│              └──────────┬──────────┘                        │
│                         │                                   │
│    ┌────────┬───────────┼───────────┬────────┐              │
│    ▼        ▼           ▼           ▼        ▼              │
│ ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌────────┐         │
│ │Priv- │ │ Inco │ │ Arcium   │ │ SIP  │ │ Future │         │
│ │acy- │ │(FHE) │ │  (MPC)   │ │Native│ │Backends│         │
│ │Cash │ │      │ │          │ │      │ │        │         │
│ └──────┘ └──────┘ └──────────┘ └──────┘ └────────┘         │
│   #480     #482      #481       #401                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Comparison

### Privacy Models

| Backend | Technology | Privacy Source | Amount Hidden | Compliance |
|---------|------------|----------------|---------------|------------|
| **PrivacyCash** | Pool mixing + ZK proofs | Anonymity set (crowd) | ❌ Visible on-chain | ❌ None |
| **Inco** | FHE + TEE | Encryption + hardware | ✅ Encrypted | ⚠️ Bolt-on |
| **Arcium** | MPC | Data splitting | ✅ Never assembled | ⚠️ Bolt-on |
| **SIP Native** | Pedersen + Stealth + ZK | Cryptographic guarantees | ✅ Commitment only | ✅ Native viewing keys |

### Technical Trade-offs

| Backend | Latency | Trust Model | Best For |
|---------|---------|-------------|----------|
| **PrivacyCash** | Seconds + wait for anonymity | Cryptographic (ZK) | Maximum anonymity set |
| **Inco** | Seconds | TEE hardware trust | Confidential compute, programmable privacy |
| **Arcium** | Seconds (MPC rounds) | Dishonest majority | Dark pools, private DeFi, order books |
| **SIP Native** | ~400ms (single tx) | Cryptographic (Pedersen + ZK) | Compliant privacy transfers |

---

## Privacy Model Deep Dive

### PrivacyCash (Pool Mixing)

```
How it works:
1. Deposit SOL into pool → receive commitment
2. Wait for anonymity set to grow (more deposits)
3. Generate ZK proof of valid commitment
4. Withdraw to ANY address

Privacy guarantee: "Hiding in the crowd"
- 10 users in pool = 1/10 chance of linking
- 1000 users = 1/1000 chance

Weakness: Amount correlation
- Deposit 7.32 SOL at T₀
- Withdraw 7.32 SOL at T₁
- Statistical correlation possible
```

### Inco (FHE + TEE)

```
How it works:
1. Client encrypts data
2. Send to Trusted Execution Environment
3. Compute on encrypted data (FHE) or in secure enclave (TEE)
4. Return encrypted result

Privacy guarantee: Data encrypted during compute
Trust assumption: TEE hardware is secure (Intel SGX, etc.)

Best for: Confidential state, programmable privacy rules
```

### Arcium (MPC)

```
How it works:
1. Split secret across N computation nodes
2. Each node computes on their share
3. Combine results without revealing inputs
4. Dishonest majority security model

Privacy guarantee: Data never in one place
Overhead: Multiple communication rounds

Best for: Complex private computations, dark pools
```

### SIP Native (Pedersen + Stealth)

```
How it works:
1. Sender creates Pedersen commitment: C = amount * G + blinding * H
2. Sender generates one-time stealth address for recipient
3. ZK proof verifies: commitment valid, sender authorized
4. Recipient scans with viewing key, claims with spending key

Privacy guarantee: CRYPTOGRAPHIC (not probabilistic)
- Amount hidden: Only commitment visible, computationally infeasible to reverse
- Recipient hidden: Stealth address unlinkable to recipient's public key
- Sender hidden: ZK proof reveals nothing about sender

Compliance: Viewing keys allow selective disclosure to auditors
```

---

## Why SIP Native?

### 1. Cryptographic vs Probabilistic Privacy

```
PrivacyCash: Privacy depends on pool size
             Small pool = weak privacy
             Large pool = stronger privacy
             Always probabilistic

SIP Native:  Privacy is mathematically guaranteed
             Works with 0 other users
             Pedersen commitment is binding and hiding
             No waiting for anonymity set
```

### 2. Amount Hiding

```
PrivacyCash on-chain data:
  Deposit: { pool: "1_SOL", commitment: 0x... }
  Withdraw: { pool: "1_SOL", nullifier: 0x..., recipient: 0x... }
  → Amount visible (1 SOL pool)
  → Timing + amount correlation possible

SIP Native on-chain data:
  Transfer: { commitment: 0x7f3a..., stealth_addr: 0x9b2c... }
  → Amount hidden in commitment
  → No correlation possible
```

### 3. Native Compliance (Viewing Keys)

```typescript
// SIP Native: Compliance built-in
const tx = await sip.shieldedTransfer({
  to: recipient,
  amount: 1000,
  viewingKey: auditorPublicKey,  // Auditor can verify, others cannot
})

// PrivacyCash: No compliance option
// User must choose: privacy OR compliance, not both
```

### 4. Single Transaction Finality

```
PrivacyCash flow:
  1. Deposit tx (wait for confirmation)
  2. Wait for anonymity set (hours/days)
  3. Withdrawal tx (wait for confirmation)
  Total: Hours to days

SIP Native flow:
  1. Shielded transfer tx (single transaction)
  Total: ~400ms (Solana finality)
```

---

## When to Use Each Backend

### Use PrivacyCash when:
- Maximum anonymity set is priority
- Compliance is not required
- Willing to wait for pool growth
- Amount privacy not critical

### Use Inco when:
- Need confidential compute (not just transfers)
- Building programmable privacy rules
- Complex state that needs encryption
- TEE trust model acceptable

### Use Arcium when:
- Building private DeFi (dark pools, order books)
- Need MPC security model
- Complex multi-party computations
- Can tolerate MPC coordination overhead

### Use SIP Native when (Recommended Default):
- Need compliant privacy (viewing keys)
- Amount hiding is important
- Want single-transaction UX
- Building for institutional/enterprise use
- Need multi-chain compatibility
- Want cryptographic (not probabilistic) guarantees

---

## SmartRouter Selection Logic

The SmartRouter (#487) automatically selects the best backend:

```typescript
function selectBackend(params: TransferParams): Backend {
  // 1. If user explicitly specified, use that
  if (params.backend) return params.backend

  // 2. If compliance required, must use SIP Native
  if (params.viewingKey) return 'sip-native'

  // 3. If amount hiding critical, prefer SIP Native
  if (params.requireAmountPrivacy) return 'sip-native'

  // 4. Default to SIP Native (best overall)
  return 'sip-native'

  // Future: Consider liquidity, fees, latency
}
```

---

## Implementation Status

| Backend | Issue | Status | Notes |
|---------|-------|--------|-------|
| PrivacyBackend Interface | #483 | 🔲 Planned | Abstraction layer |
| PrivacyCash Adapter | #480 | 🔲 Planned | Pool mixing backend |
| Inco Adapter | #482 | 🔲 Planned | FHE/TEE backend |
| Arcium Adapter | #481 | 🔲 Planned | MPC backend |
| SIP Native Program | #401 | 🔲 Planned | Our Anchor program |
| SmartRouter v2 | #487 | 🔲 Planned | Auto-selection |

---

## References

- [PrivacyCash](https://privacycash.co/) - Pool mixing on Solana
- [Inco Network](https://docs.inco.org/svm/home) - FHE/TEE confidential compute
- [Arcium](https://docs.arcium.com/developers) - MPC confidential compute
- [EIP-5564](https://eips.ethereum.org/EIPS/eip-5564) - Stealth address standard
- [Pedersen Commitments](https://en.wikipedia.org/wiki/Commitment_scheme) - Cryptographic hiding

---

*Last updated: January 2026*
