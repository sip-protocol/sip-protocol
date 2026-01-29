# SIP Protocol — Arcium End-to-End Private DeFi Submission

| Field | Value |
|-------|-------|
| **Track** | End-to-End Private DeFi |
| **Sponsor** | Arcium |
| **Prize Pool** | $10,000 |
| **Project** | SIP Protocol |
| **Tagline** | Full-Stack Privacy: C-SPL + Arcium MPC + Stealth Addresses |

---

## Executive Summary

SIP Protocol delivers **true end-to-end private DeFi** by combining three privacy layers:

1. **C-SPL** — Encrypted token amounts (Token-2022 Confidential Transfers)
2. **Arcium MPC** — Confidential swap validation (no plaintext exposure)
3. **Stealth Addresses** — Hidden sender and recipient

This isn't just "private swaps" — it's a **full privacy stack** where amounts, logic, AND participants are all encrypted.

### Why SIP Wins

| Feature | SIP + Arcium | Single-Layer Solutions |
|---------|--------------|------------------------|
| **Hidden Amounts** | ✅ C-SPL encrypted balances | ⚠️ Often visible |
| **Hidden Logic** | ✅ Arcium MPC validation | ❌ On-chain exposure |
| **Hidden Participants** | ✅ Stealth addresses | ❌ Public addresses |
| **Compliance Ready** | ✅ Viewing keys for auditors | ❌ All-or-nothing |
| **Production App** | ✅ sip-mobile (iOS/Android) | ⚠️ CLI/demo only |

---

## 1. The Problem

Current DeFi privacy is incomplete:

```
Typical "Private" Swap:
┌─────────────────────────────────────────────────────────────┐
│  User A (PUBLIC) → Swap Contract → User B (PUBLIC)          │
│                                                             │
│  What's hidden:  Amount (maybe)                             │
│  What's exposed: Sender, Recipient, Swap logic, Timing      │
└─────────────────────────────────────────────────────────────┘

Problem: Observers can still:
- Link sender to recipient via timing analysis
- See swap parameters on-chain
- Track wallet activity patterns
```

**The gap:** No solution combines encrypted amounts + encrypted compute + hidden participants.

---

## 2. The Solution: Full Privacy Stack

SIP Protocol combines three complementary technologies:

```
┌─────────────────────────────────────────────────────────────┐
│  FULL PRIVACY DEFI (SIP Protocol)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: C-SPL (Token-2022 Confidential Transfers)         │
│  └── Encrypts token amounts using Twisted ElGamal           │
│  └── Balances hidden on-chain                               │
│                                                             │
│  Layer 2: Arcium MPC                                        │
│  └── Validates swaps on encrypted data                      │
│  └── No node sees plaintext amounts                         │
│  └── Threshold decryption for results                       │
│                                                             │
│  Layer 3: SIP Native (Stealth Addresses)                    │
│  └── One-time recipient addresses                           │
│  └── Sender unlinkable to recipient                         │
│  └── Viewing keys for compliance                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Result: Amount ✓ Logic ✓ Sender ✓ Recipient ✓ ALL HIDDEN   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. What We Built

### 3.1 Arcium MPC Program (Anchor + Arcis)

**Repository:** [github.com/sip-protocol/sip-arcium-program](https://github.com/sip-protocol/sip-arcium-program)

**Deployment:**
| Field | Value |
|-------|-------|
| Program ID | `S1P5q5497A6oRCUutUFb12LkNQynTNoEyRyUvotmcX9` |
| MXE Account | `5qy4Njk4jCJE4QgZ5dsg8uye3vzFypFTV7o7RRSQ8vr4` |
| Cluster Offset | 456 (Arcium devnet v0.6.3) |
| Network | Solana Devnet |

**MPC Circuits (Arcis):**

| Circuit | Purpose | Privacy Guarantee |
|---------|---------|-------------------|
| `private_transfer` | Validate balance ≥ amount | No node sees actual balance |
| `check_balance` | Threshold check | Amount hidden, only boolean result |
| `validate_swap` | DEX swap validation | Input/output amounts encrypted |

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (sip-mobile)                                        │
│  └── Encrypt inputs with x25519 keypair                     │
├─────────────────────────────────────────────────────────────┤
│  ANCHOR PROGRAM (sip-arcium-program)                        │
│  ├── Queue computation to Arcium MXE                        │
│  ├── Await callback with encrypted result                   │
│  └── Emit events with encrypted outputs                     │
├─────────────────────────────────────────────────────────────┤
│  ARCIUM MXE CLUSTER                                         │
│  ├── Decrypt inputs (threshold MPC)                         │
│  ├── Execute circuit (no single node sees plaintext)        │
│  └── Encrypt outputs with requester's key                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Mobile App Integration (sip-mobile)

**Repository:** [github.com/sip-protocol/sip-mobile](https://github.com/sip-protocol/sip-mobile)

**Key Files:**

```
src/privacy-providers/
├── arcium.ts         # Arcium MPC adapter
├── cspl.ts           # C-SPL confidential tokens adapter
└── sip-native.ts     # Stealth address adapter

src/hooks/
└── usePrivateDeFi.ts # Orchestrates full privacy stack
```

**Full Privacy Flow:**

```typescript
// usePrivateDeFi.ts - Orchestrates all three layers
const result = await privateSwap({
  inputToken: "SOL",
  outputToken: "USDC",
  amount: "1.0",
  recipient: "sip:solana:...", // Stealth meta-address
  slippageBps: 50,
})

// Flow:
// 1. Wrap SOL → C-SOL (encrypted balance)
// 2. Validate swap via Arcium MPC (encrypted compute)
// 3. Send USDC to stealth address (hidden recipient)
```

### 3.3 Privacy Provider Architecture

SIP integrates Arcium alongside 6 other privacy providers:

| Provider | Technology | Status |
|----------|------------|--------|
| **Arcium** | MPC | ✅ Deployed |
| C-SPL | Token-2022 | ✅ Complete |
| SIP Native | Stealth + Pedersen | ✅ Complete |
| Privacy Cash | Pool mixing | ✅ Complete |
| ShadowWire | Bulletproofs | ✅ Complete |
| MagicBlock | TEE | ✅ Complete |
| Inco | FHE/TEE | ✅ Complete |

**Why this matters:** Users can choose Arcium for MPC-based privacy while SIP adds viewing keys for compliance on top.

---

## 4. Technical Deep Dive

### 4.1 Arcium Circuit: `validate_swap`

```rust
// encrypted-ixs/src/lib.rs

#[encrypted]
pub fn validate_swap(
    input_balance: Encryptable<u64>,
    input_amount: Encryptable<u64>,
    min_output: Encryptable<u64>,
    actual_output: Encryptable<u64>,
) -> (bool, Encryptable<u64>, bool) {
    // All computation happens on encrypted data
    // No MPC node sees plaintext values

    let has_sufficient_balance = input_balance >= input_amount;
    let new_balance = input_balance - input_amount;
    let slippage_ok = actual_output >= min_output;

    let is_valid = has_sufficient_balance && slippage_ok;

    (is_valid, new_balance, slippage_ok)
}
```

**Privacy guarantees:**
- Input balance never revealed
- Swap amounts encrypted throughout
- Only boolean results exposed (valid/invalid)

### 4.2 C-SPL Integration

```typescript
// src/privacy-providers/cspl.ts

async wrapToken(params: WrapParams): Promise<WrapResult> {
  // 1. Get or create confidential token account
  const account = await this.service.getOrCreateAccount(mint, owner)

  // 2. Encrypt amount using Twisted ElGamal
  const encrypted = await this.service.encryptAmount(amount)

  // 3. Deposit to confidential balance
  const signature = await this.service.deposit(mint, amount, owner)

  return { success: true, csplMint: account.mint }
}
```

### 4.3 Stealth Address Generation

```typescript
// Recipient generates stealth meta-address
const metaAddress = generateStealthMetaAddress(spendingKey, viewingKey)
// → "sip:solana:02abc...123:03def...456"

// Sender derives one-time address
const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(metaAddress)
// → Unique address, unlinkable to recipient's main wallet

// Recipient scans using viewing key
const payments = await scanForPayments(viewingKey)
// → Finds payments without revealing link to main address
```

---

## 5. Why This Wins

### Best Overall App ($5,000)

| Criteria | SIP Protocol |
|----------|--------------|
| **Fully Confidential DeFi** | ✅ Amounts + Logic + Participants all hidden |
| **Production App** | ✅ sip-mobile on iOS/Android/Seeker |
| **Multiple Privacy Layers** | ✅ C-SPL + Arcium + Stealth combined |
| **Real Integration** | ✅ 7 privacy providers, 632 tests |

### Best Integration into Existing App ($3,000)

| Criteria | SIP Protocol |
|----------|--------------|
| **Existing App** | ✅ sip-mobile was functional before Arcium |
| **Clean Integration** | ✅ ArciumAdapter follows PrivacyProviderAdapter interface |
| **Non-Invasive** | ✅ Arcium is one of 7 swappable backends |
| **Maintains Functionality** | ✅ App works with or without Arcium |

### Most \<encrypted\> Potential (2 × $1,000)

| Criteria | SIP Protocol |
|----------|--------------|
| **Novel Combination** | ✅ First to combine C-SPL + Arcium + Stealth |
| **Expandable** | ✅ Architecture supports any privacy backend |
| **Compliance Layer** | ✅ Viewing keys work across all providers |
| **Ecosystem Value** | ✅ SDK usable by other Solana apps |

---

## 6. Repositories & Links

| Resource | URL |
|----------|-----|
| **Arcium Program** | [github.com/sip-protocol/sip-arcium-program](https://github.com/sip-protocol/sip-arcium-program) |
| **Mobile App** | [github.com/sip-protocol/sip-mobile](https://github.com/sip-protocol/sip-mobile) |
| **Core SDK** | [github.com/sip-protocol/sip-protocol](https://github.com/sip-protocol/sip-protocol) |
| **Live App** | [app.sip-protocol.org](https://app.sip-protocol.org) |
| **Documentation** | [docs.sip-protocol.org](https://docs.sip-protocol.org) |

---

## 7. Test Coverage

| Component | Tests | Status |
|-----------|-------|--------|
| sip-mobile | 632 | ✅ Passing |
| Core SDK | 6,661+ | ✅ Passing |
| TypeScript | Strict | ✅ No errors |

```bash
# Verify builds
cd sip-mobile && pnpm install && pnpm typecheck && pnpm test:run
cd sip-arcium-program && anchor build && anchor test
```

---

## 8. The Vision

SIP Protocol positions Arcium as the **MPC layer** in a complete privacy stack:

```
Future State:
┌─────────────────────────────────────────────────────────────┐
│  ANY SOLANA APP                                             │
│  └── import { SIP } from '@sip-protocol/sdk'                │
├─────────────────────────────────────────────────────────────┤
│  SIP PROTOCOL (Privacy Middleware)                          │
│  ├── Stealth Addresses (hidden participants)                │
│  ├── Viewing Keys (compliance)                              │
│  └── Backend Router                                         │
├─────────────────────────────────────────────────────────────┤
│  ARCIUM MPC        │  C-SPL         │  Other Backends       │
│  (encrypted compute)│ (encrypted amt)│  (ZK, TEE, etc.)     │
└─────────────────────────────────────────────────────────────┘
```

**Arcium becomes the default MPC backend** for SIP Protocol users who want confidential compute without trusting any single party.

---

## 9. Team

| Role | Contact |
|------|---------|
| Lead Developer | rector@rectorspace.com |
| GitHub | [@rz1989s](https://github.com/rz1989s) |
| Organization | [github.com/sip-protocol](https://github.com/sip-protocol) |

---

## 10. Acknowledgments

Built for the **Solana Privacy Hackathon 2026** — Arcium End-to-End Private DeFi Track.

Special thanks to the Arcium team for documentation and devnet support.

---

**Submission Date:** January 2026
**Hackathon:** Solana Privacy Hack
**Track:** Arcium — End-to-End Private DeFi ($10,000)
