# THORChain Integration Research

**Issue:** [#149](https://github.com/sip-protocol/sip-protocol/issues/149)
**Date:** December 2024
**Status:** Research Complete
**Researcher:** CIPHER

---

## Executive Summary

THORChain is a **highly feasible** settlement backend for SIP Protocol's cross-chain privacy layer. It provides native, non-custodial cross-chain swaps across 12+ chains (Bitcoin, Ethereum, Base, NEAR, Solana [Q3 2025], and more) without bridges or wrapped assets.

**Key Findings:**
- **Privacy Compatible:** THORChain requires no KYC and operates with no custodians. Privacy layer can be added on top through SIP's stealth addresses and commitments
- **Native Asset Settlement:** Perfect alignment with SIP's goal of native asset privacy across chains
- **Mature SDK Ecosystem:** XChainJS and SwapKit provide TypeScript integration paths
- **Proven at Scale:** $2.5B+ total volume, 12+ integrated chains, live since 2021

**Recommendation:** PROCEED with THORChain as primary settlement backend for M11-M12 (Multi-Backend Support).

**Estimated Effort:** 4-6 weeks (1 developer)
- Week 1-2: THORChain adapter implementation (`ThorchainSettlementBackend`)
- Week 3-4: Integration testing, memo format handling, fee estimation
- Week 5-6: E2E tests, documentation, production hardening

---

## THORChain Overview

### What is THORChain?

THORChain is an independent, cross-chain liquidity protocol that operates as a Layer 1 decentralized exchange (DEX). Built on the Cosmos SDK, it uses:
- **CometBFT** consensus engine (formerly Tendermint)
- **Cosmos-SDK** state machine
- **GG20 Threshold Signature Scheme (TSS)** for distributed vault control
- **Bifrost** module for observing external blockchains

**Core Value Proposition:** Swap native assets across chains with zero reliance on centralized parties, no bridges, no wrapping.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATIONS (Wallets, DEXs, DAOs)                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Send L1 transaction with memo
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL CHAINS (BTC, ETH, NEAR, SOL, etc.)                    │
│  └─ User sends funds to Asgard Vault address                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Bifrost observes
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  THORCHAIN (Cosmos SDK L1)                                      │
│  ├─ Bifrost: Observe inbound transactions (67% consensus)       │
│  ├─ State Machine: Parse memo, route to handler                 │
│  ├─ Continuous Liquidity Pools: Execute swap via AMM            │
│  └─ TSS: Sign outbound transaction to destination vault         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Outbound transaction
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  DESTINATION CHAIN                                              │
│  └─ User receives swapped assets                                │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight for SIP:** THORChain sees only L1 transactions. Privacy layer (stealth addresses, commitments, viewing keys) can be added at the application layer without requiring THORChain protocol changes.

---

## Swap Mechanics

### How Swaps Work

1. **User Intent:** Application constructs a swap memo (e.g., `=:ETH.ETH:0x...`)
2. **Inbound Transaction:** User sends native asset to current Asgard vault address
3. **Observation:** Bifrost nodes observe the transaction (requires 67% consensus)
4. **Standardization:** Bifrost converts transaction to standardized witness format
5. **Memo Parsing:** State machine parses memo and routes to swap handler
6. **Liquidity Pool Swap:** Continuous Liquidity Pool (CLP) executes swap using AMM
7. **Outbound Signing:** TSS ceremony signs outbound transaction (2/3 of nodes required)
8. **Asset Delivery:** Destination chain receives swapped assets

### Swap Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Single Swap** | Native asset ↔ RUNE | Direct RUNE swaps |
| **Double Swap** | Asset A → RUNE → Asset B | Cross-chain swaps (most common) |
| **Streaming Swap** | Split into N subswaps | Reduce slippage on large trades |
| **Limit Swap** | Execute only when price met | Conditional execution (advanced queue) |

**Streaming Swaps (Recommended):** Breaks large trades into subswaps to reduce slippage. Default: each subswap has 5 bps slippage. Controlled via `streaming_quantity` parameter.

### Continuous Liquidity Pools

- **Structure:** Each pool = 1 external asset + RUNE (e.g., BTC + RUNE, ETH + RUNE)
- **Linking:** RUNE presence in all pools creates continuous liquidity network
- **Slip-Based Fees:** Deeper pools = lower fees. Fees scale with trade size to throttle demand

---

## Privacy Considerations

### Existing Privacy Features

THORChain provides baseline privacy suitable for SIP integration:

1. **No KYC Required:** No identity verification, email, or personal data collection
2. **Non-Custodial:** Users maintain self-custody throughout swap lifecycle
3. **Decentralized:** No centralized parties can block, censor, or surveil transactions
4. **Transparent but Pseudonymous:** On-chain data is public, but addresses are not linked to identities

### Privacy Limitations

THORChain swaps are **transparent by default:**
- Sender address visible (VIN0 on UTXO chains, tx.origin on EVM)
- Swap amounts visible (inbound amount, outbound amount)
- Recipient address visible (from memo)
- Transaction linkability (can track swaps via vault interactions)

**Privacy Coin Challenge:** Previous Monero integration attempt failed due to incompatibility with memo system and transparent address requirements. Monero's privacy model conflicts with THORChain's need for explicit routing instructions.

### How SIP Adds Privacy Layer

SIP Protocol can overlay privacy on THORChain without protocol changes:

#### 1. Shielded Sender (Stealth Address Input)
```typescript
// User generates ephemeral keypair
const ephemeral = generateEphemeralKey()

// Compute stealth address for self (return address)
const stealthReturn = computeStealthAddress(userSpendingKey, ephemeral)

// Send from stealth address to THORChain vault
// VIN0 = stealthReturn (hides actual sender)
```

**Benefit:** THORChain sees stealth address as sender, not user's main address.

#### 2. Hidden Amounts (Pedersen Commitments)
```typescript
// Create commitment to amount
const commitment = createCommitment(amount, blindingFactor)

// Include commitment in off-chain data
// THORChain sees actual amount (required for swap)
// But commitment proves amount without revealing it to auditors
```

**Limitation:** THORChain requires real amounts for swap execution. Commitments used for **compliance/audit**, not on-chain privacy.

**Alternative Approach:** Use NEAR Intents for compliance-friendly privacy, THORChain for maximum liquidity. Dual-backend strategy.

#### 3. Shielded Recipient (Stealth Address Output)
```typescript
// Compute stealth address for recipient
const recipientStealth = computeStealthAddress(
  recipientSpendingKey,
  recipientViewingKey,
  ephemeralKey
)

// THORChain memo with stealth address
const memo = `=:ETH.ETH:${recipientStealth}:${limitPrice}`
```

**Benefit:** Recipient address in memo is one-time stealth address. Unlinkable to recipient's main wallet.

#### 4. Viewing Keys for Compliance
```typescript
// Generate viewing key for auditor
const viewingKey = generateViewingKey(userSecret)

// Auditor can decrypt commitment and link addresses
// But viewing key is selective - given only to authorized parties
```

**Benefit:** Compliant privacy. User proves legitimacy to auditors without public transparency.

### Privacy Level Mapping

| SIP Privacy Level | THORChain Implementation |
|-------------------|--------------------------|
| `transparent` | Standard THORChain swap (no privacy layer) |
| `shielded` | Stealth addresses for sender/recipient |
| `compliant` | Stealth addresses + viewing key for auditor |

**Key Insight:** THORChain provides settlement infrastructure. SIP provides privacy UX on top.

---

## Integration Approach

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  SIP SDK (@sip-protocol/sdk)                                    │
│  ├─ IntentBuilder: Creates shielded intents                     │
│  ├─ SIP Client: Orchestrates intent lifecycle                   │
│  └─ SettlementBackend Interface                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ implements
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ThorchainSettlementBackend (NEW)                               │
│  ├─ submitIntent(): Submit shielded intent to THORChain         │
│  ├─ getIntentStatus(): Check swap status                        │
│  ├─ estimateFees(): Calculate network + liquidity fees          │
│  ├─ getSupportedAssets(): Return THORChain asset list           │
│  └─ Internal:                                                    │
│     ├─ buildThorchainMemo(): Convert intent to memo format      │
│     ├─ getVaultAddress(): Fetch current Asgard vault            │
│     ├─ observeInbound(): Watch for transaction confirmation     │
│     └─ trackOutbound(): Monitor outbound delivery               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  XChainJS / SwapKit SDK                                         │
│  ├─ Chain Clients (BTC, ETH, etc.)                              │
│  ├─ Transaction Construction                                    │
│  ├─ Wallet Abstraction                                          │
│  └─ THORChain API Client                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  THORChain Network                                              │
│  ├─ Midgard API (analytics, historical data)                    │
│  ├─ THORNode RPC (state queries, inbound addresses)             │
│  └─ L1 Blockchains (transaction broadcast)                      │
└─────────────────────────────────────────────────────────────────┘
```

### SDK Options

#### Option 1: XChainJS (Recommended)
- **Pros:** Official library, lightweight, mature, multi-chain support
- **Cons:** Lower-level, requires more custom logic
- **GitHub:** https://github.com/xchainjs/xchainjs-lib
- **TypeScript:** Yes
- **Use Case:** Full control over transaction construction

#### Option 2: SwapKit SDK
- **Pros:** High-level API, <100 lines of code for integration, DEX aggregation, wallet connectors
- **Cons:** Heavier dependency, may include unnecessary features
- **GitHub:** https://github.com/thorswap/SwapKit
- **Docs:** https://docs.swapkit.dev
- **Use Case:** Rapid integration, wallet UI

**Recommendation:** Start with **XChainJS** for granular control over privacy layer integration. Consider SwapKit wrapper for reference app.

### API Endpoints

#### THORNode RPC (State Queries)
```
https://thornode.ninerealms.com
```

Key endpoints:
- `GET /thorchain/inbound_addresses` - Current vault addresses (refresh every 10 min)
- `GET /thorchain/pools` - Liquidity pool data
- `GET /thorchain/quote/swap` - Swap quote with fees
- `GET /thorchain/tx/{txid}/signers` - Transaction status

#### Midgard API (Analytics)
```
https://midgard.ninerealms.com
```

Key endpoints:
- `GET /v2/actions` - Transaction history
- `GET /v2/pools` - Pool statistics
- `GET /v2/health` - Network health

**Critical:** Never cache inbound addresses! Vaults rotate regularly. Sending to old vault = loss of funds.

### Transaction Construction

#### UTXO Chains (Bitcoin, Litecoin, Dogecoin, BCH)
```typescript
// 1. Fetch current Asgard vault address
const vaultAddr = await getInboundAddress('BTC')

// 2. Build memo
const memo = `=:ETH.ETH:${recipientStealth}:${limitPrice}/1/0`

// 3. Construct transaction
const tx = {
  outputs: [
    { address: vaultAddr, amount: swapAmount },        // VOUT0: To vault
    { address: stealthReturn, amount: changeAmount },  // VOUT1: Change to stealth
    { opReturn: memo }                                 // VOUT2: Memo
  ],
  inputs: [
    { address: userAddress, utxo: selectedUtxo }       // VIN0: Identifies user
  ]
}
```

#### EVM Chains (Ethereum, Avalanche, Base, BSC)
```typescript
// 1. Get THORChain Router contract address
const routerAddr = await getInboundAddress('ETH')

// 2. Build memo
const memo = `=:BTC.BTC:${recipientStealth}:0/1/0`

// 3. Call depositWithExpiry
const router = new ethers.Contract(routerAddr, ROUTER_ABI)
const expiry = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

await router.depositWithExpiry(
  vaultAddr,          // vault
  'ETH.ETH',          // asset (use zero address for native ETH)
  amount,             // amount
  memo,               // memo
  expiry,             // expiry (Unix timestamp)
  { value: amount }   // For native ETH, include in value field
)
```

### Memo Format for Privacy

Standard THORChain memo:
```
=:CHAIN.ASSET:DESTADDR:LIMIT/AFFILIATE/FEE
```

SIP-enhanced memo:
```
=:ETH.ETH:<stealth_address>:<limit>/<affiliate>/<fee>|<encrypted_metadata>
```

**Vertical Pipe Feature:** Data after `|` is forwarded as outbound memo. Use for encrypted viewing key, commitment proof, or compliance data.

Example:
```typescript
const memo = `=:ETH.ETH:${stealthAddr}:0/1/0|${encryptedViewingKey}`
//                                              ^^^^^^^^^^^^^^^^^^^^
//                                              Forwarded to recipient
```

Recipient contract can parse outbound memo to:
1. Recover viewing key
2. Verify commitment proof
3. Link stealth address to real identity (if authorized)

---

## Fee Structure

THORChain fees are multi-layered and dynamic:

### 1. Network Fee
- **Fixed:** 0.02 RUNE per transaction
- **Purpose:** THORChain L1 consensus cost
- **Who Pays:** User (included in swap)

### 2. Outbound Fee
- **Dynamic:** `txSize × gasRate × Outbound Fee Multiplier (OFM)`
- **OFM Range:** 1.0x to 3.0x (adjusts based on surplus)
- **Purpose:** Cover L1 gas costs (nodes pay gas, protocol recoups)
- **Returned By:** `inbound_addresses` endpoint (per-chain)

**Example:**
```json
{
  "chain": "ETH",
  "address": "0x...",
  "gas_rate": "30",  // 30 gwei
  "outbound_fee": "15000000000000000"  // 0.015 ETH (~$50 at $3,300/ETH)
}
```

### 3. Liquidity/Slip Fee
- **Formula:** Proportional to pool depth and trade size
- **Range:** 0.1% - 5%+ (depends on liquidity)
- **Benefit:** Deeper pools = lower slip
- **Mitigation:** Use streaming swaps (splits into subswaps)

**Example:**
- $100k swap in $10M pool: ~1% slip
- $100k swap in $1M pool: ~10% slip
- $100k streaming swap (10 subswaps): ~0.1% slip per subswap

### 4. Affiliate Fee (Optional)
- **Range:** 0 - 10,000 bps (0% - 100%, commonly 0.1% - 1%)
- **Purpose:** Integrator revenue share
- **Paid In:** RUNE (default) or preferred asset via THORName
- **Memo Format:** `=:ASSET:DEST:0/<affiliate_addr>/<fee_bps>`

**SIP Use Case:** Set affiliate fee to fund protocol development or DAO treasury.

### Total Fee Calculation

```typescript
const totalFee =
  networkFee +           // 0.02 RUNE (~$0.05)
  outboundFee +          // Dynamic (e.g., $0.50 - $50 depending on chain)
  liquidityFee +         // Proportional to trade size (0.1% - 5%)
  affiliateFee           // Optional (0% - 1%)

// Example for $1,000 ETH → BTC swap:
// Network: $0.05
// Outbound: $5 (ETH gas) + $3 (BTC fee) = $8
// Liquidity: ~$5 (0.5% slip in deep pool)
// Affiliate: $1 (0.1% fee)
// TOTAL: $14.05 (1.4% effective fee)
```

### Fee Optimization Strategies

1. **Use Streaming Swaps:** Reduce slip from 5% to 0.5% on large trades
2. **Monitor Pool Depth:** Swap during high liquidity periods
3. **Batch Transactions:** Combine multiple swaps when possible (via intents)
4. **Set Limit Prices:** Use advanced queue to wait for favorable rates

---

## Supported Assets

### Live Chains (December 2024)

| Chain | Native Asset | Example Assets | Status |
|-------|--------------|----------------|--------|
| **Bitcoin** | BTC | BTC | Live |
| **Ethereum** | ETH | ETH, USDT, USDC, DAI | Live |
| **BNB Chain** | BNB | BNB, BUSD | Live |
| **Avalanche** | AVAX | AVAX, USDC | Live |
| **Cosmos Hub** | ATOM | ATOM | Live |
| **Dogecoin** | DOGE | DOGE | Live |
| **Bitcoin Cash** | BCH | BCH | Live |
| **Litecoin** | LTC | LTC | Live |
| **Base** | ETH | ETH, USDC | Live (Q1 2025) |
| **Ripple** | XRP | XRP | Live (Q2 2025) |
| **TRON** | TRX | TRX, USDT-TRC20 | Live (July 2025) |

**Total:** 11 live chains

### Upcoming Chains (2025-2026 Roadmap)

| Chain | Blocker | Expected |
|-------|---------|----------|
| **Solana** | EdDSA support needed | Q3 2025 (in progress) |
| **Cardano** | EdDSA support needed | Q4 2025 |
| **TON** | EdDSA support needed | 2026 |
| **SUI** | EdDSA support needed | 2026 |
| **Arbitrum** | L2 integration | Under consideration |

**Note:** THORChain uses ECDSA vaults (Bitcoin/Ethereum style). EdDSA support required for ed25519-based chains (Solana, Cardano, TON, SUI).

### Asset Notation

THORChain uses `CHAIN.ASSET` format:
```
BTC.BTC              # Bitcoin
ETH.ETH              # Native Ethereum
ETH.USDC-0x...       # USDC on Ethereum
AVAX.USDC-0x...      # USDC on Avalanche
BASE.ETH             # Native ETH on Base
```

**Key Insight:** Same token on different chains = different assets. USDC on Ethereum ≠ USDC on Avalanche.

### 5,500+ Assets via DEX Aggregation

THORChain + SwapKit enables access to 5,500+ tokens via DEX aggregation:
- THORChain: Cross-chain liquidity for major assets
- 1inch/Paraswap: EVM DEX aggregation for long-tail tokens
- Jupiter: Solana DEX aggregation

**Example Flow:** USDC (Ethereum) → ETH (via 1inch) → BTC (via THORChain) → SOL (via Jupiter) → SPL token

---

## Integration Complexity

### Complexity Assessment

| Component | Complexity | Effort | Notes |
|-----------|------------|--------|-------|
| **API Integration** | Low | 1-2 days | Well-documented REST API |
| **Transaction Construction** | Medium | 3-5 days | Chain-specific logic (UTXO vs EVM) |
| **Memo Format Handling** | Low | 1-2 days | String parsing, straightforward |
| **Fee Estimation** | Medium | 2-3 days | Multiple fee types, dynamic OFM |
| **Vault Address Management** | Low | 1 day | Endpoint polling, cache invalidation |
| **Status Tracking** | Medium | 3-4 days | Async flow (inbound → swap → outbound) |
| **Stealth Address Integration** | Medium | 4-5 days | SIP-specific, ephemeral key handling |
| **Viewing Key Embedding** | Low | 2-3 days | Encrypted metadata in memo pipe |
| **Multi-Chain Support** | High | 5-7 days | Per-chain wallet adapters |
| **Error Handling** | Medium | 3-4 days | Refund scenarios, timeout handling |
| **Testing** | High | 7-10 days | E2E tests, testnet validation |
| **Documentation** | Low | 2-3 days | API docs, integration guide |

**Total Estimate:** 33-51 days (1.5-2.5 months for solo developer)
**With Team (2 devs):** 20-30 days (1-1.5 months)

### Technical Challenges

#### 1. Memo Length Limits (UTXO Chains)
- **Problem:** OP_RETURN limited to 80 bytes
- **Solution:** Use THORChain's long memo format (79 chars + `^`, remaining chars as p2wpkh addresses)
- **Impact:** Stealth addresses fit (42 chars hex), encrypted metadata may require compression

#### 2. Vault Address Rotation
- **Problem:** Asgard vaults rotate periodically (every ~3 days)
- **Solution:** Never cache vault addresses. Fetch fresh before every transaction. Set 10-minute quote expiry.
- **Impact:** Requires robust address refresh logic

#### 3. Async Transaction Flow
- **Problem:** 3-step process: inbound confirmation → swap execution → outbound confirmation
- **Solution:** Implement event listeners for each stage. Use Midgard API for transaction history.
- **Impact:** Requires state machine for intent lifecycle tracking

#### 4. Dust Thresholds
- **Problem:** Each chain has minimum transaction amount (e.g., BTC: 10,000 sats)
- **Solution:** Query thresholds from `/thorchain/inbound_addresses`, validate before submission
- **Impact:** Must handle "amount too small" errors gracefully

#### 5. Cross-Chain Fee Estimation
- **Problem:** Fees span multiple chains (inbound gas + THORChain + outbound gas)
- **Solution:** Use `/thorchain/quote/swap` endpoint for comprehensive quote
- **Impact:** Real-time fee updates required (especially for EVM chains with volatile gas)

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Sent to old vault** | Fetch vault address <10 min before transaction |
| **Swap fails (price slip)** | Use limit price in memo, implement retry logic |
| **Outbound stuck** | Monitor outbound queue, escalate if >1 hour |
| **Refund scenario** | Validate inputs before submission, handle refund to stealth return address |
| **Testnet availability** | Use stagenet for testing (https://stagenet-thornode.ninerealms.com) |

---

## Feasibility Assessment

### Strengths (Why THORChain Works for SIP)

1. **Native Asset Settlement:** No wrapped assets, no bridges. Perfect for cross-chain privacy.
2. **Mature Protocol:** 3+ years live, $2.5B+ volume, battle-tested.
3. **Multi-Chain Coverage:** 11 live chains, Solana coming Q3 2025.
4. **TypeScript SDKs:** XChainJS and SwapKit provide integration paths.
5. **No KYC/Custody:** Privacy-friendly by default.
6. **Decentralized:** No single point of censorship or surveillance.
7. **Active Development:** Regular upgrades (TSS improvements, IBC, EdDSA in progress).
8. **Vertical Pipe Feature:** Enables encrypted metadata passthrough (perfect for viewing keys).

### Weaknesses (Challenges to Consider)

1. **Transparent by Design:** All swap amounts and addresses visible on THORChain state machine. SIP privacy layer is application-level, not protocol-level.
2. **Fee Complexity:** Multiple fee types (network, outbound, liquidity, affiliate) require careful UX design.
3. **Vault Rotation:** Address management adds integration complexity.
4. **Slip Risk:** Large trades in shallow pools can face 5%+ slip. Mitigated by streaming swaps.
5. **No Privacy Coins:** Monero integration failed. Zcash integration uncertain (would need transparent pool).
6. **THORFi Debt Situation:** $210M debt from suspended lending/savings. Core swap functionality unaffected, but protocol health is consideration.

### Alternatives Comparison

| Feature | THORChain | NEAR Intents | Chainflip | Maya Protocol |
|---------|-----------|--------------|-----------|---------------|
| Native Assets | Yes | Yes (via 1Click) | Yes | Yes |
| Multi-Chain | 11 chains | 30+ chains | BTC/ETH/DOT | Fork of THORChain |
| Privacy Support | App-layer | App-layer | App-layer | App-layer |
| TypeScript SDK | XChainJS, SwapKit | 1Click API | Chainflip SDK | THORChain-compatible |
| Maturity | 3+ years | <1 year | Beta | 2+ years |
| Liquidity | $200M+ TVL | Variable | Growing | $20M+ TVL |
| SIP Fit | Excellent | Good (current) | Good | Good |

**Recommendation:** Use **NEAR Intents** for initial launch (M1-M8, already integrated). Add **THORChain** as second backend (M11-M12) for maximum liquidity and Bitcoin/Litecoin/Dogecoin support.

### Fit with SIP Strategy

SIP's Dual Moat Strategy:
- **Settlement Aggregation:** THORChain aligns perfectly. Add as pluggable backend.
- **Proof Composition:** THORChain swaps can be attested by Mina succinct proofs (future).

**Multi-Foundation Grants:** THORChain integration enables positioning for:
- Zcash Foundation (privacy + Bitcoin swaps)
- Bitcoin ecosystem (shielded BTC swaps)
- Ethereum Foundation (shielded ETH/ERC-20)

---

## Implementation Plan

### Phase 1: Core Integration (Weeks 1-2)
- [ ] Implement `ThorchainSettlementBackend` class
- [ ] Add `buildThorchainMemo()` function (convert SIP intent to THORChain memo)
- [ ] Integrate XChainJS for transaction construction
- [ ] Implement `getVaultAddress()` with 10-minute cache
- [ ] Add `estimateFees()` using `/thorchain/quote/swap`

**Deliverable:** Basic THORChain adapter with BTC and ETH support

### Phase 2: Privacy Layer (Weeks 3-4)
- [ ] Integrate stealth address generation for sender/recipient
- [ ] Implement encrypted viewing key embedding (memo pipe feature)
- [ ] Add commitment verification (off-chain proof)
- [ ] Handle privacy level mapping (transparent/shielded/compliant)
- [ ] Implement ephemeral key management

**Deliverable:** Shielded intent support for THORChain swaps

### Phase 3: Multi-Chain Support (Week 5)
- [ ] Add UTXO chain support (BTC, LTC, DOGE, BCH)
- [ ] Add EVM chain support (ETH, AVAX, BASE, BSC)
- [ ] Add Cosmos chain support (ATOM)
- [ ] Implement chain-specific transaction construction
- [ ] Handle per-chain dust thresholds

**Deliverable:** Support for 11 THORChain chains

### Phase 4: Testing & Hardening (Week 6)
- [ ] E2E tests for all supported chains (testnet)
- [ ] Error handling (refund scenarios, timeout, vault rotation)
- [ ] Fee estimation accuracy tests
- [ ] Status tracking validation (inbound → swap → outbound)
- [ ] Load testing (concurrent intent submission)

**Deliverable:** Production-ready THORChain adapter

### Phase 5: Documentation (Week 7)
- [ ] API documentation for `ThorchainSettlementBackend`
- [ ] Integration guide (how to add THORChain as backend)
- [ ] Migration guide (NEAR Intents → THORChain)
- [ ] Troubleshooting guide (common errors)
- [ ] Security considerations (vault rotation, fee estimation)

**Deliverable:** Complete integration documentation

### Code Structure

```
packages/sdk/src/
├── adapters/
│   ├── thorchain/
│   │   ├── index.ts                    # ThorchainSettlementBackend
│   │   ├── memo-builder.ts             # buildThorchainMemo()
│   │   ├── vault-manager.ts            # getVaultAddress(), rotation
│   │   ├── fee-estimator.ts            # estimateFees()
│   │   ├── transaction-builder.ts      # Per-chain tx construction
│   │   ├── status-tracker.ts           # Track intent lifecycle
│   │   └── types.ts                    # THORChain-specific types
│   └── near-intents/                   # Existing adapter
└── tests/
    └── adapters/
        └── thorchain.test.ts           # THORChain adapter tests
```

### Example Usage

```typescript
import { SIP } from '@sip-protocol/sdk'
import { ThorchainSettlementBackend } from '@sip-protocol/sdk/adapters/thorchain'

// Initialize SIP with THORChain backend
const sip = new SIP({
  settlementBackend: new ThorchainSettlementBackend({
    network: 'mainnet', // or 'stagenet' for testing
    rpcUrl: 'https://thornode.ninerealms.com',
  }),
  proofProvider: new NoirProofProvider(),
})

// Create shielded intent
const intent = sip.createIntent({
  sender: {
    address: 'bc1q...',  // Bitcoin address
    chain: 'BTC',
  },
  recipient: {
    // SIP generates stealth address automatically
    spendingKey: '0x...',
    viewingKey: '0x...',
    chain: 'ETH',
  },
  amount: {
    value: '0.1',  // 0.1 BTC
    asset: 'BTC.BTC',
  },
  outputAsset: 'ETH.ETH',  // Swap to ETH
  privacyLevel: 'shielded',  // Use stealth addresses
})

// Submit to THORChain
const result = await sip.submitIntent(intent)

// Track status
const status = await sip.getIntentStatus(result.intentId)
// status.stage: 'pending' | 'inbound_confirmed' | 'swap_executing' | 'outbound_sent' | 'completed'
```

---

## References

### Official Documentation
- [THORChain Docs](https://docs.thorchain.org)
- [THORChain Dev Docs](https://dev.thorchain.org)
- [Swap Guide](https://dev.thorchain.org/swap-guide/quickstart-guide.html)
- [Transaction Memos](https://dev.thorchain.org/concepts/memos.html)
- [Fees](https://docs.thorchain.org/how-it-works/fees)
- [Bifrost, TSS and Vaults](https://docs.thorchain.org/technical-documentation/technology/bifrost-tss-and-vaults)

### SDKs & Tools
- [XChainJS GitHub](https://github.com/xchainjs/xchainjs-lib)
- [SwapKit SDK](https://github.com/thorswap/SwapKit)
- [SwapKit Docs](https://docs.swapkit.dev)
- [THORChain GitHub](https://github.com/thorchain)

### Integration Examples
- [THORSwap Cross-Chain API Examples](https://github.com/thorswap/cross-chain-api-examples)
- [THORChainJS Demo](https://github.com/thorswap/thorchainjs-demo) (archived)

### Network Endpoints
- **Mainnet THORNode:** https://thornode.ninerealms.com
- **Stagenet THORNode:** https://stagenet-thornode.ninerealms.com
- **Midgard API:** https://midgard.ninerealms.com

### Recent Updates
- [THORChain Q2 2025 Ecosystem Report](https://medium.com/thorchain/thorchain-q2-2025-ecosystem-report-q3-roadmap-1f5097a086a9)
- [THORChain V3 Release](https://blog.thorchain.org/thorchain-v3-release/)
- [TRON Integration Complete](https://blog.thorchain.org/tron-integration-complete-native-trx-usdt-swaps-live-on-thorchain/)

---

## Conclusion

**Bismillah, THORChain is an excellent fit for SIP Protocol.** It provides the decentralized, non-custodial, cross-chain settlement infrastructure we need, and its transparent design allows us to overlay our privacy layer without protocol modifications.

**Next Steps:**
1. Create GitHub issue for THORChain integration (M11-M12 milestone)
2. Spike XChainJS integration (2-3 days)
3. Implement MVP adapter (BTC ↔ ETH only)
4. Test on stagenet
5. Expand to all 11 chains
6. Document integration guide
7. Announce multi-backend support

**Tawfeeq min Allah for this integration. May this work bring privacy to millions of users across chains. JazakAllahu khairan for the research opportunity.**

---

**Document Status:** Research Complete
**Next Action:** Review with RECTOR, proceed to implementation planning if approved
**Last Updated:** December 2024
