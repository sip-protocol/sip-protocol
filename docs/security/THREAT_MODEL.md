# SIP Protocol Threat Model

## Overview

This document describes the threat model for the Shielded Intents Protocol (SIP), defining adversary capabilities, trust assumptions, and security boundaries.

## Adversary Model

### Adversary Capabilities

We assume a computationally bounded adversary who can:

1. **Network Level**
   - Observe all network traffic (global passive adversary)
   - Perform timing analysis on transaction submission
   - Correlate transactions across chains by timing
   - Run malicious nodes on supported networks

2. **Blockchain Level**
   - Read all public blockchain data
   - Submit arbitrary transactions
   - Front-run transactions (MEV)
   - Analyze transaction graphs

3. **Application Level**
   - Interact with SIP SDK as a legitimate user
   - Attempt to link stealth addresses
   - Try to determine hidden amounts
   - Submit malformed proofs

### Adversary Limitations

The adversary CANNOT:

1. Break standard cryptographic assumptions (ECDLP, SHA-256 preimage)
2. Compromise user devices or extract private keys
3. Perform quantum attacks (post-quantum not in scope)
4. Compromise the majority of solver network
5. Control blockchain consensus (51% attacks out of scope)

## Trust Assumptions

### Trusted Components

| Component | Trust Level | Justification |
|-----------|-------------|---------------|
| @noble/curves | High | Audited, widely used, constant-time |
| secp256k1 curve | High | 20+ years of analysis, Bitcoin-proven |
| User's device | Required | Key generation/storage happens locally |
| PRNG (crypto.getRandomValues) | High | OS-provided, well-audited |

### Semi-Trusted Components

| Component | Trust Level | Notes |
|-----------|-------------|-------|
| Solvers | Semi-trusted | Can see encrypted intent metadata, cannot steal funds |
| NEAR chain | Semi-trusted | Provides liveness, cannot break privacy |
| RPC providers | Low trust | Only see public data |

### Untrusted Components

| Component | Notes |
|-----------|-------|
| Other users | Adversarial by default |
| Public mempool | Assume fully observed |
| Block explorers | Assume they correlate everything |

## Security Boundaries

### Critical Security Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Device                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                Private Key Storage                       ││
│  │  - Spending private key (MUST never leave)              ││
│  │  - Viewing private key (can be selectively shared)      ││
│  │  - Blinding factors (MUST be kept until reveal)         ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                  │
│                     SDK Operations                           │
│  - Key generation         │  - Proof generation             │
│  - Commitment creation    │  - Stealth address derivation   │
│  - Intent building        │  - Address scanning             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ (Only public data crosses)
┌─────────────────────────────────────────────────────────────┐
│                    Public Network                            │
│  - Commitments (hiding amounts)                             │
│  - Stealth addresses (unlinkable to recipient)              │
│  - Ephemeral public keys (for stealth scanning)             │
│  - ZK proofs (reveal nothing beyond validity)               │
└─────────────────────────────────────────────────────────────┘
```

### Data Classification

| Data Type | Classification | Exposure |
|-----------|---------------|----------|
| Spending private key | SECRET | Never exposed |
| Viewing private key | CONFIDENTIAL | Selective disclosure |
| Blinding factors | SECRET | Never exposed (until opening) |
| Transaction amounts | CONFIDENTIAL | Hidden in commitments |
| Sender identity | CONFIDENTIAL | Hidden via stealth addresses |
| Recipient identity | CONFIDENTIAL | Unlinkable stealth addresses |
| Intent parameters | PUBLIC | Output requirements visible |
| ZK proofs | PUBLIC | Verifiable by anyone |
| Commitments | PUBLIC | Computationally hiding |
| Ephemeral keys | PUBLIC | Required for scanning |

## Threat Categories

### 1. Privacy Threats

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Amount disclosure | Pedersen commitments | None (computationally hiding) |
| Sender linkability | Stealth addresses | Low (view tag optimization) |
| Recipient linkability | One-time addresses | None (fresh address per payment) |
| Transaction graph analysis | Commitments + stealth | Medium (timing correlation) |

### 2. Integrity Threats

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Forged proofs | ZK proof verification | None (soundness guarantee) |
| Double spending | On-chain enforcement | None (blockchain consensus) |
| Amount manipulation | Commitment binding | None (computationally binding) |
| Key substitution | User verification | Low (UI/UX dependent) |

### 3. Availability Threats

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Solver unavailability | Multiple solver support | Medium (not implemented yet) |
| Network congestion | Timeout/retry logic | Low |
| DoS on proof generation | Resource limits | Medium |

### 4. Implementation Threats

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Side-channel attacks | noble/curves constant-time | Low |
| RNG failure | OS CSPRNG + rejection sampling | Low |
| Memory disclosure | Explicit zeroization (TODO) | Medium |
| Integer overflow | BigInt arithmetic | None |

## Out of Scope

The following threats are explicitly OUT OF SCOPE for SIP:

1. **Endpoint Security**
   - Malware on user devices
   - Keyloggers
   - Screen capture attacks

2. **Social Engineering**
   - Phishing attacks
   - Scams involving fake addresses

3. **Economic Attacks**
   - Market manipulation
   - Flash loan attacks
   - MEV (handled at chain level)

4. **Network-Level Attacks**
   - Sybil attacks on P2P
   - Eclipse attacks
   - BGP hijacking

5. **Quantum Threats**
   - Shor's algorithm attacks on ECDLP
   - Grover's algorithm attacks on hashes

## Attack Scenarios

### Scenario 1: Passive Observer

**Goal**: Link sender to recipient
**Method**: Monitor all transactions, analyze timing
**Defense**: Stealth addresses generate fresh one-time addresses
**Result**: Observer sees unrelated addresses, cannot link

### Scenario 2: Malicious Solver

**Goal**: Steal funds or extract private data
**Method**: Accept intent but not fulfill, or extract amounts
**Defense**: Proofs verify without revealing amounts, escrow protects funds
**Result**: Solver can DoS but cannot steal or learn private data

### Scenario 3: Blockchain Analyst

**Goal**: Determine transaction amounts
**Method**: Analyze commitment values, look for patterns
**Defense**: Random blinding factors make commitments indistinguishable
**Result**: All commitments look random, no amount information leakage

## Recommendations

### For Users

1. Generate keys on secure, offline devices when possible
2. Verify recipient addresses through out-of-band channels
3. Use fresh stealth addresses for each transaction
4. Don't reuse blinding factors

### For Integrators

1. Never log private keys or blinding factors
2. Implement proper session management
3. Use secure random number generation
4. Clear sensitive data from memory after use

### For Auditors

1. Focus on key generation and handling
2. Verify constant-time operations in crypto code
3. Check blinding factor generation
4. Audit proof verification logic
