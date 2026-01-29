# SIP Protocol — Arcium End-to-End Private DeFi Submission

| Field | Value |
|-------|-------|
| **Track** | End-to-End Private DeFi |
| **Sponsor** | Arcium |
| **Prize Pool** | $10,000 |
| **Project** | SIP Protocol |
| **Tagline** | Full-Stack Privacy: Arcium MPC + Jupiter DEX + Stealth Addresses |

---

## Executive Summary

SIP Protocol delivers **true end-to-end private DeFi** by combining:

1. **Arcium MPC** — Confidential swap validation (no plaintext exposure)
2. **Jupiter DEX** — Real swaps with best routes
3. **Stealth Addresses** — Hidden sender and recipient

This isn't just "private swaps" — it's a **full privacy stack** where logic AND participants are encrypted, with real on-chain transactions.

### Why SIP Wins

| Feature | SIP + Arcium | Single-Layer Solutions |
|---------|--------------|------------------------|
| **Hidden Logic** | ✅ Arcium MPC validation | ❌ On-chain exposure |
| **Hidden Participants** | ✅ Stealth addresses | ❌ Public addresses |
| **Real Swaps** | ✅ Jupiter DEX integration | ⚠️ Simulated/demo only |
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

SIP Protocol combines complementary technologies for real private DeFi:

```
┌─────────────────────────────────────────────────────────────┐
│  FULL PRIVACY DEFI (SIP Protocol)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Arcium MPC                                        │
│  └── Validates swaps on encrypted data                      │
│  └── No MPC node sees plaintext amounts                     │
│  └── Threshold decryption for results only                  │
│                                                             │
│  Layer 2: Jupiter DEX                                       │
│  └── Real swap execution with best routes                   │
│  └── Actual on-chain transactions                           │
│  └── No mock data or simulations                            │
│                                                             │
│  Layer 3: SIP Native (Stealth Addresses)                    │
│  └── One-time recipient addresses                           │
│  └── Sender unlinkable to recipient                         │
│  └── Viewing keys for compliance                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Result: Logic ✓ Sender ✓ Recipient ✓ ALL HIDDEN            │
└─────────────────────────────────────────────────────────────┘
```

> **Note on C-SPL:** Token-2022 Confidential Transfers (C-SPL) are implemented as a separate adapter in SIP Protocol. However, Solana has temporarily disabled the ZK ElGamal program required for confidential transfers. The C-SPL adapter is ready and will activate when Solana re-enables this feature.

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
│  ├── Fetch MXE x25519 public key from chain                 │
│  ├── Generate ephemeral x25519 keypair                      │
│  ├── Derive shared secret via ECDH (our priv + MXE pub)     │
│  └── Encrypt inputs with RescueCipher                       │
├─────────────────────────────────────────────────────────────┤
│  ANCHOR PROGRAM (sip-arcium-program)                        │
│  ├── Receive encrypted inputs + our public key + nonce      │
│  ├── Queue computation to Arcium MXE                        │
│  └── Emit events with encrypted outputs                     │
├─────────────────────────────────────────────────────────────┤
│  ARCIUM MXE CLUSTER                                         │
│  ├── Derive same shared secret (MXE priv + our pub)         │
│  ├── Decrypt inputs (threshold MPC)                         │
│  ├── Execute circuit (no single node sees plaintext)        │
│  └── Encrypt outputs with requester's key                   │
└─────────────────────────────────────────────────────────────┘
```

**x25519 Key Exchange:**
```typescript
// 1. Fetch MXE's x25519 public key (from chain via getMXEPublicKey)
const mxePublicKey = await getMXEPublicKey(provider, PROGRAM_ID)

// 2. Generate ephemeral keypair
const privateKey = x25519.utils.randomSecretKey()
const publicKey = x25519.getPublicKey(privateKey)

// 3. Derive shared secret (ECDH)
const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey)

// 4. Encrypt with RescueCipher
const cipher = new RescueCipher(sharedSecret)
const ciphertext = cipher.encrypt([amount], nonce)
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
// usePrivateDeFi.ts - Orchestrates real private swaps
const { quote: jupiterQuote } = useQuote({
  inputMint: SOL_MINT,
  outputMint: USDC_MINT,
  amount: parseUnits("1.0", 9),
})

const result = await privateSwap({
  inputToken: SOL_TOKEN,
  outputToken: USDC_TOKEN,
  amount: "1.0",
  recipient: "sip:solana:...", // Stealth meta-address
  slippageBps: 50,
  jupiterQuote,  // Real Jupiter quote (required)
  quote: parsedQuote,
})

// Flow (no mocks, all real):
// 1. Get real quote from Jupiter API
// 2. Validate swap via Arcium MPC (encrypted compute)
// 3. Execute swap via Jupiter (real on-chain tx)
// 4. Send output to stealth address (hidden recipient)
```

### 3.3 Privacy Provider Architecture

SIP integrates Arcium alongside 6 other privacy providers:

| Provider | Technology | Status |
|----------|------------|--------|
| **Arcium** | MPC | ✅ Deployed (real txs) |
| SIP Native | Stealth + Pedersen | ✅ Complete (real txs) |
| C-SPL | Token-2022 | ⏸️ Ready (blocked by Solana) |
| Privacy Cash | Pool mixing | ✅ Complete |
| ShadowWire | Bulletproofs | ✅ Complete |
| MagicBlock | TEE | ✅ Complete |
| Inco | FHE/TEE | ✅ Complete |

**Why this matters:** Users can choose Arcium for MPC-based privacy while SIP adds viewing keys for compliance on top. The private DeFi flow uses **real Jupiter swaps** and **real Arcium program calls** — no mocked or simulated transactions.

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

### 4.2 Jupiter DEX Integration

```typescript
// src/hooks/usePrivateDeFi.ts - Real swap execution

async function executeJupiterSwap(
  jupiterQuote: JupiterQuoteResponse,
  walletAddress: string,
  signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>
): Promise<{ success: boolean; signature?: string }> {
  // 1. Get swap transaction from Jupiter API
  const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", {
    method: "POST",
    body: JSON.stringify({
      quoteResponse: jupiterQuote,
      userPublicKey: walletAddress,
      wrapAndUnwrapSol: true,
    }),
  })
  const { swapTransaction } = await swapResponse.json()

  // 2. Sign and send real transaction
  const txBuffer = Buffer.from(swapTransaction, "base64")
  const signedTx = await signTransaction(new Uint8Array(txBuffer))
  const signature = await connection.sendRawTransaction(signedTx)

  return { success: true, signature }
}
```

> **Note:** This is real code from our implementation — no mocks or simulations. The swap transaction is signed by the user's wallet and executed on-chain.

### 4.3 Arcium Encryption (Proper MXE Integration)

```typescript
// src/privacy-providers/arcium.ts - Real MXE encryption

private async encryptU64(value: bigint): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  // Ensure we have MXE public key (fetched from chain)
  if (!this.mxePublicKey) {
    this.mxePublicKey = await this.fetchMXEPublicKey()
  }

  // Create shared secret with MXE cluster (ECDH: our private key + MXE public key)
  const sharedSecret = this.sdk.x25519.getSharedSecret(this.privateKey, this.mxePublicKey)
  const cipher = new this.sdk.RescueCipher(sharedSecret)
  const nonce = this.sdk.randomBytes(16)

  const ciphertexts = cipher.encrypt([value], nonce)
  // ... pack into 32 bytes
  return { ciphertext, nonce }
}
```

**Why this matters:**
- Uses **real MXE public key** fetched from chain (not placeholder)
- Proper **x25519 ECDH** key exchange with MXE cluster
- MXE can derive same shared secret using **their private key + our public key**
- **RescueCipher** encryption matches Arcium's expected format

### 4.4 Stealth Address Generation

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
| **Fully Confidential DeFi** | ✅ Logic + Participants hidden via MPC + Stealth |
| **Production App** | ✅ sip-mobile on iOS/Android/Seeker |
| **Real Transactions** | ✅ No mocks — real Jupiter swaps, real Arcium MPC |
| **Proper MXE Integration** | ✅ Real x25519 ECDH with MXE cluster public key |
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
| **Novel Combination** | ✅ First to combine Arcium MPC + Jupiter + Stealth |
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
Current State (Production):
┌─────────────────────────────────────────────────────────────┐
│  SIP MOBILE APP                                             │
│  └── usePrivateDeFi() hook                                  │
├─────────────────────────────────────────────────────────────┤
│  SIP PROTOCOL (Privacy Middleware)                          │
│  ├── Stealth Addresses (hidden participants)                │
│  ├── Viewing Keys (compliance)                              │
│  └── Provider Router                                        │
├─────────────────────────────────────────────────────────────┤
│  ARCIUM MPC        │  JUPITER DEX   │  SIP NATIVE           │
│  (encrypted compute)│ (real swaps)  │  (stealth transfer)   │
└─────────────────────────────────────────────────────────────┘

Future State (when Solana enables ZK ElGamal):
├─────────────────────────────────────────────────────────────┤
│  ARCIUM MPC │ C-SPL (encrypted amt) │ More Backends...      │
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
