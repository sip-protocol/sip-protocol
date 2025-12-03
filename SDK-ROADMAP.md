# SIP SDK World-Class Roadmap

**Goal:** Build THE privacy standard for Web3 - like HTTPS for the internet.

**Current State:** 93/100 - Production-grade foundation with 1,291 tests

---

## Phase 1: Foundation Hardening (Week 1-2)

### 1.1 Fix Test Failures
- [ ] Fix 3 NEAR Intents asset mapping tests
- [ ] Verify all 1,347 tests pass (100%)
- [ ] Add CI badge for test status

### 1.2 Real Zcash Swap Integration
**Problem:** ETH→ZEC and SOL→ZEC routes fail because NEAR Intents doesn't support Zcash.

**Solution:** Build direct Zcash integration in SDK.

```
┌─────────────────────────────────────────────────────────────┐
│  Current Flow (BROKEN)                                      │
│  ETH → NEAR Intents → ??? → ZEC                            │
│         (no Zcash support)                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  New Flow (TO BUILD)                                        │
│  ETH → Bridge/DEX → ZEC Transparent → ZEC Shielded Pool    │
│                       │                      │              │
│                       └──────────────────────┘              │
│                         ZcashShieldedService                │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
// packages/sdk/src/zcash/swap-service.ts
export class ZcashSwapService {
  constructor(
    private rpcClient: ZcashRPCClient,
    private shieldedService: ZcashShieldedService
  ) {}

  /**
   * Execute swap to Zcash shielded address
   * 1. Accept source token via bridge (e.g., RenBTC, WBTC wrapper)
   * 2. Convert to ZEC on transparent address
   * 3. Shield to z-address
   */
  async executeSwapToShielded(params: {
    sourceChain: ChainId
    sourceToken: string
    amount: bigint
    recipientZAddress: string // zs1... or u1...
  }): Promise<SwapResult>

  /**
   * Get quote for swap to Zcash
   * Returns estimated ZEC output + fees
   */
  async getQuote(params: QuoteParams): Promise<ZcashQuote>
}
```

**Files to create/modify:**
- `packages/sdk/src/zcash/swap-service.ts` - New
- `packages/sdk/src/zcash/bridge.ts` - New (bridge integration)
- `packages/sdk/src/zcash/index.ts` - Export new service
- `packages/sdk/src/index.ts` - Export ZcashSwapService

### 1.3 Circuit Validation
- [ ] Add CI step to verify circuit artifacts
- [ ] Add proof generation tests with real circuits
- [ ] Document circuit update process

---

## Phase 2: ZK Proofs Production (Week 3-4)

### 2.1 Wire Up Noir Circuits

**Current State:**
- 3 circuit specs exist (funding, validity, fulfillment)
- Pre-compiled JSON artifacts exist
- NoirProofProvider exists but needs real circuit integration

**Implementation:**

```typescript
// packages/sdk/src/proofs/noir.ts - ENHANCE

export class NoirProofProvider implements ProofProvider {
  private fundingCircuit: CompiledCircuit
  private validityCircuit: CompiledCircuit
  private fulfillmentCircuit: CompiledCircuit

  async initialize(): Promise<void> {
    // Load circuits from artifacts
    this.fundingCircuit = await this.loadCircuit('funding_proof')
    this.validityCircuit = await this.loadCircuit('validity_proof')
    this.fulfillmentCircuit = await this.loadCircuit('fulfillment_proof')
  }

  async generateFundingProof(params: FundingProofParams): Promise<ProofResult> {
    const inputs = this.prepareFundingInputs(params)
    const { witness } = await this.fundingCircuit.execute(inputs)
    const proof = await this.backend.generateProof(witness)
    return { proof, publicInputs: this.extractPublicInputs(witness) }
  }

  // Similarly for validity and fulfillment proofs
}
```

**Tasks:**
- [ ] Verify circuit JSON artifacts are valid Noir circuits
- [ ] Implement `prepareFundingInputs()` - map SDK types to circuit inputs
- [ ] Implement `prepareValidityInputs()`
- [ ] Implement `prepareFulfillmentInputs()`
- [ ] Add integration tests with real proof generation
- [ ] Benchmark proof generation times
- [ ] Document circuit constraints and inputs

### 2.2 Browser WASM Optimization

**Current State:** BrowserNoirProvider exists but may have performance issues.

**Tasks:**
- [ ] Profile browser proof generation
- [ ] Implement Web Worker for non-blocking proof generation
- [ ] Add progress callbacks for UI feedback
- [ ] Test on mobile browsers (Safari, Chrome mobile)

```typescript
// Enhanced browser provider
export class BrowserNoirProvider implements ProofProvider {
  async generateProofInWorker(
    type: 'funding' | 'validity' | 'fulfillment',
    params: ProofParams,
    onProgress?: (stage: string, percent: number) => void
  ): Promise<ProofResult>
}
```

### 2.3 Proof Composition Research

**Goal:** Combine proofs from different systems (Zcash + Mina + Noir).

**Research Tasks:**
- [ ] Study Halo2 recursion for Zcash proofs
- [ ] Study Kimchi/Pickles for Mina proofs
- [ ] Identify composition opportunities
- [ ] Write technical feasibility document

---

## Phase 3: Multi-Settlement Backends (Week 5-6)

### 3.1 Settlement Abstraction Layer

**Goal:** Make settlement pluggable - not locked to NEAR Intents.

```typescript
// packages/sdk/src/settlement/interface.ts
export interface SettlementBackend {
  name: string
  supportedChains: ChainId[]

  getQuote(params: QuoteParams): Promise<Quote>
  executeSwap(params: SwapParams): Promise<SwapResult>
  getStatus(swapId: string): Promise<SwapStatus>
}

// packages/sdk/src/settlement/registry.ts
export class SettlementRegistry {
  private backends: Map<string, SettlementBackend> = new Map()

  register(backend: SettlementBackend): void
  get(name: string): SettlementBackend
  getBestForRoute(from: ChainId, to: ChainId): SettlementBackend
}
```

### 3.2 Implement Backends

| Backend | Chains | Status |
|---------|--------|--------|
| `near-intents` | EVM, Solana, NEAR, BTC | ✅ Exists |
| `zcash-native` | Zcash | 🔨 Phase 1 |
| `thorchain` | BTC, ETH, many | 📋 Planned |
| `mina` | Mina | 📋 Research |
| `direct-chain` | Single chain | 📋 Planned |

### 3.3 Smart Routing

```typescript
// packages/sdk/src/settlement/router.ts
export class SmartRouter {
  /**
   * Find best route considering:
   * - Fees
   * - Speed
   * - Privacy level support
   * - Liquidity
   */
  async findBestRoute(params: {
    from: { chain: ChainId, token: string }
    to: { chain: ChainId, token: string }
    amount: bigint
    privacyLevel: PrivacyLevel
  }): Promise<Route[]>
}
```

---

## Phase 4: Multi-Chain Privacy (Week 7-10)

### 4.1 Bitcoin Silent Payments (BIP-352)

**Why:** Bitcoin is the largest crypto by market cap. Silent payments provide stealth address-like privacy.

```typescript
// packages/sdk/src/bitcoin/silent-payments.ts
export class BitcoinSilentPayments {
  /**
   * Generate silent payment address
   * Format: sp1q...
   */
  generateSilentPaymentAddress(
    scanKey: Uint8Array,
    spendKey: Uint8Array
  ): string

  /**
   * Create silent payment output
   */
  createSilentPaymentOutput(
    recipientAddress: string, // sp1q...
    amount: bigint
  ): BitcoinOutput

  /**
   * Scan for received silent payments
   */
  scanForPayments(
    scanPrivateKey: Uint8Array,
    transactions: BitcoinTransaction[]
  ): ReceivedPayment[]
}
```

**Tasks:**
- [ ] Implement BIP-352 spec
- [ ] Add taproot support (required for silent payments)
- [ ] Integrate with Bitcoin wallet adapters
- [ ] Add tests against Bitcoin testnet

### 4.2 Cosmos IBC Privacy

```typescript
// packages/sdk/src/cosmos/ibc-stealth.ts
export class CosmosStealthService {
  /**
   * Generate stealth address for Cosmos chain
   * Uses secp256k1 (Cosmos uses same curve as Ethereum)
   */
  generateStealthAddress(chain: CosmosChainId): StealthResult

  /**
   * Create IBC transfer to stealth address
   */
  createStealthIBCTransfer(params: {
    sourceChain: CosmosChainId
    destChain: CosmosChainId
    recipient: string // Stealth address
    amount: bigint
    denom: string
  }): IBCTransfer
}
```

**Chains to support:**
- [ ] Cosmos Hub (ATOM)
- [ ] Osmosis (OSMO)
- [ ] Secret Network (SCRT) - already private!
- [ ] Injective (INJ)

### 4.3 Move Chains (Aptos, Sui)

```typescript
// packages/sdk/src/move/stealth.ts
export class MoveStealthService {
  /**
   * Aptos uses ed25519 - same as Solana
   * Can reuse ed25519 stealth address logic
   */
  generateAptosStealthAddress(): Ed25519StealthResult

  /**
   * Sui uses ed25519 too
   */
  generateSuiStealthAddress(): Ed25519StealthResult
}
```

---

## Phase 5: Compliance Layer (Week 11-12)

### 5.1 Audit Report Generation

```typescript
// packages/sdk/src/compliance/reports.ts
export class ComplianceReporter {
  /**
   * Generate audit report for viewing key holder
   */
  async generateAuditReport(params: {
    viewingKey: string
    startDate: Date
    endDate: Date
    format: 'json' | 'pdf' | 'csv'
  }): Promise<AuditReport>

  /**
   * Export transactions for regulator
   */
  async exportForRegulator(params: {
    viewingKey: string
    jurisdiction: 'US' | 'EU' | 'UK' | 'SG' | string
    format: 'FATF' | 'FINCEN' | 'raw'
  }): Promise<RegulatoryExport>
}
```

### 5.2 Threshold Viewing Keys

**Use case:** N-of-M disclosure - multiple parties must agree to reveal.

```typescript
// packages/sdk/src/compliance/threshold.ts
export class ThresholdViewingKey {
  /**
   * Create N-of-M threshold viewing key
   */
  static create(params: {
    threshold: number // N
    totalShares: number // M
    viewingKey: string
  }): ThresholdShares

  /**
   * Reconstruct viewing key from shares
   */
  static reconstruct(shares: string[]): string

  /**
   * Verify share is valid without revealing key
   */
  static verifyShare(share: string, commitment: string): boolean
}
```

### 5.3 Conditional Disclosure

```typescript
// packages/sdk/src/compliance/conditional.ts
export class ConditionalDisclosure {
  /**
   * Create time-locked disclosure
   * Automatically reveals after X blocks/time
   */
  createTimeLocked(params: {
    viewingKey: string
    revealAfter: Date | number // Date or block height
  }): TimeLockResult

  /**
   * Create threshold disclosure
   * Reveals if transaction exceeds amount threshold
   */
  createAmountThreshold(params: {
    viewingKey: string
    threshold: bigint
  }): ThresholdDisclosure
}
```

---

## Phase 6: Developer Experience (Week 13-14)

### 6.1 React Hooks Package

```typescript
// packages/react/src/hooks/use-sip.ts
export function useSIP(): {
  client: SIP
  isReady: boolean
  error: Error | null
}

// packages/react/src/hooks/use-stealth-address.ts
export function useStealthAddress(chain: ChainId): {
  metaAddress: string
  stealthAddress: string
  regenerate: () => void
}

// packages/react/src/hooks/use-private-swap.ts
export function usePrivateSwap(): {
  quote: Quote | null
  swap: (params: SwapParams) => Promise<SwapResult>
  status: SwapStatus
  isLoading: boolean
  error: Error | null
}

// packages/react/src/hooks/use-viewing-key.ts
export function useViewingKey(): {
  viewingKey: ViewingKey | null
  generate: () => ViewingKey
  decrypt: (encrypted: string) => Promise<string>
}
```

### 6.2 CLI Tool

```bash
# Install
npm install -g @sip-protocol/cli

# Commands
sip init                          # Initialize SIP in project
sip keygen                        # Generate stealth meta-address
sip commit <amount>               # Create Pedersen commitment
sip prove funding <balance>       # Generate funding proof
sip verify <proof>                # Verify any proof
sip scan --chain solana           # Scan for stealth payments
sip quote eth sol 1.0             # Get swap quote
sip swap eth sol 1.0 --privacy shielded  # Execute swap
```

### 6.3 REST API Service

```typescript
// packages/api/src/server.ts
// Optional REST wrapper for non-JS backends

// Endpoints:
// POST /stealth/generate     - Generate stealth address
// POST /commitment/create    - Create Pedersen commitment
// POST /proof/funding        - Generate funding proof
// POST /quote                - Get swap quote
// POST /swap                 - Execute swap
// GET  /swap/:id/status      - Get swap status
```

### 6.4 Mobile SDKs

| Platform | Approach | Priority |
|----------|----------|----------|
| React Native | JS SDK + native crypto modules | High |
| Flutter | Dart bindings via FFI | Medium |
| Swift | Native port or FFI bindings | Low |
| Kotlin | Native port or FFI bindings | Low |

---

## Phase 7: Advanced Primitives (Week 15-16)

### 7.1 Private NFTs

```typescript
// packages/sdk/src/nft/private-nft.ts
export class PrivateNFT {
  /**
   * Hide NFT ownership until transfer
   * Uses stealth address as owner
   */
  createPrivateOwnership(params: {
    nftContract: string
    tokenId: string
    ownerMetaAddress: string
  }): PrivateNFTOwnership

  /**
   * Transfer NFT privately
   * New owner gets stealth address
   */
  transferPrivately(params: {
    nft: PrivateNFTOwnership
    recipientMetaAddress: string
  }): TransferResult
}
```

### 7.2 Private Voting

```typescript
// packages/sdk/src/governance/private-vote.ts
export class PrivateVoting {
  /**
   * Cast encrypted vote
   * Revealed only after voting ends
   */
  castVote(params: {
    proposalId: string
    choice: number
    weight: bigint
  }): EncryptedVote

  /**
   * Tally votes without revealing individual choices
   * Uses homomorphic encryption
   */
  tallyVotes(votes: EncryptedVote[]): TallyResult
}
```

### 7.3 Private Auctions

```typescript
// packages/sdk/src/auction/sealed-bid.ts
export class SealedBidAuction {
  /**
   * Create sealed bid using commitment
   */
  createBid(params: {
    auctionId: string
    amount: bigint
  }): SealedBid

  /**
   * Reveal bid (after auction ends)
   */
  revealBid(bid: SealedBid): RevealedBid

  /**
   * Verify winner without revealing other bids
   */
  verifyWinner(bids: SealedBid[], winner: RevealedBid): boolean
}
```

---

## Summary: Feature Matrix

| Feature | Current | Target | Priority |
|---------|---------|--------|----------|
| **Core Crypto** |
| Stealth Addresses | ✅ 100% | 100% | - |
| Pedersen Commitments | ✅ 100% | 100% | - |
| Viewing Keys | ✅ 100% | 100% | - |
| **ZK Proofs** |
| Noir Provider | ✅ 85% | 100% | High |
| Browser WASM | ✅ 80% | 100% | High |
| Proof Composition | ❌ 0% | 100% | Medium |
| **Chains** |
| EVM (ETH, Polygon, etc) | ✅ 100% | 100% | - |
| Solana | ✅ 100% | 100% | - |
| NEAR | ✅ 100% | 100% | - |
| Zcash | ⚠️ 60% | 100% | High |
| Bitcoin | ❌ 0% | 100% | High |
| Cosmos | ❌ 0% | 100% | Medium |
| Move (Aptos/Sui) | ❌ 0% | 100% | Low |
| **Settlement** |
| NEAR Intents | ✅ 95% | 100% | High |
| Zcash Native | ❌ 0% | 100% | High |
| THORChain | ❌ 0% | 100% | Medium |
| Direct Chain | ❌ 0% | 100% | Low |
| **Compliance** |
| Basic Viewing Keys | ✅ 100% | 100% | - |
| Audit Reports | ❌ 0% | 100% | Medium |
| Threshold Keys | ❌ 0% | 100% | Medium |
| Conditional Disclosure | ❌ 0% | 100% | Low |
| **DX** |
| TypeScript SDK | ✅ 100% | 100% | - |
| React Hooks | ❌ 0% | 100% | High |
| CLI Tool | ❌ 0% | 100% | Medium |
| REST API | ❌ 0% | 100% | Low |

---

## Milestones

| Milestone | Target | Deliverables |
|-----------|--------|--------------|
| **M9: Stable Core** | Week 2 | 100% tests passing, Zcash swaps working |
| **M10: ZK Production** | Week 4 | Noir circuits wired, browser proving |
| **M11: Multi-Settlement** | Week 6 | Settlement abstraction, THORChain |
| **M12: Multi-Chain** | Week 10 | Bitcoin silent payments, Cosmos |
| **M13: Compliance Pro** | Week 12 | Audit reports, threshold keys |
| **M14: DX Excellence** | Week 14 | React hooks, CLI, docs |
| **M15: Advanced** | Week 16 | Private NFTs, voting, auctions |

---

## Resource Requirements

| Phase | Effort | Skills Needed |
|-------|--------|---------------|
| Phase 1 | 2 weeks | TypeScript, Zcash RPC |
| Phase 2 | 2 weeks | Noir, ZK proofs, WASM |
| Phase 3 | 2 weeks | Settlement protocols, routing |
| Phase 4 | 4 weeks | Bitcoin, Cosmos, Move chains |
| Phase 5 | 2 weeks | Cryptography, compliance |
| Phase 6 | 2 weeks | React, CLI tools, API design |
| Phase 7 | 2 weeks | Advanced crypto, auctions |

**Total:** ~16 weeks for complete world-class SDK

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test Pass Rate | 96% | 100% |
| Supported Chains | 8 | 15+ |
| Settlement Backends | 1 | 4+ |
| npm Downloads | ? | 10K+/month |
| GitHub Stars | ? | 1K+ |
| Documentation Coverage | 75% | 100% |
| TypeDoc Coverage | 60% | 100% |

---

*Last Updated: 2025-12-03*
*Status: Planning*
