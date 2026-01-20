# Zcash Cross-Chain Privacy Route Research

**Issues:** #413, #414, #415, #416 (M19 Phase 5)
**Date:** 2026-01-20
**Status:** Research Complete, Implementation Deferred to M20

---

## Executive Summary

This document researches the technical approach for full privacy cross-chain transfers via Zcash shielded pool routing.

**Key Finding:** Zcash routing is technically feasible but adds significant complexity and latency. Recommended as **optional premium feature** for users requiring maximum privacy.

**Recommendation:** Implement as Phase 2 feature (M20+) after core Solana/Ethereum same-chain privacy (M17/M18) is complete.

---

## 1. Privacy Level Comparison

### Current SIP Privacy (NEAR Intents)

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT: PARTIAL PRIVACY                                   │
│                                                             │
│  Sender (Alice)                                             │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────┐                                        │
│  │ SIP SDK         │                                        │
│  │ • Stealth addr  │ ← Recipient hidden                     │
│  │ • Commitment    │ ← Amount hidden                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ NEAR Intents    │                                        │
│  │ • Solver sees   │ ← Sender visible to solver            │
│  │   input/output  │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  Recipient (Bob)                                            │
│                                                             │
│  Privacy: Sender ⚠️ | Amount ✅ | Recipient ✅              │
└─────────────────────────────────────────────────────────────┘
```

### Zcash Route (Full Privacy)

```
┌─────────────────────────────────────────────────────────────┐
│  PROPOSED: FULL PRIVACY VIA ZCASH                           │
│                                                             │
│  Sender (Alice)                                             │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────┐                                        │
│  │ 1. Bridge to ZEC│ ← SOL/ETH → ZEC                       │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ 2. Shield (t→z) │ ← Enter shielded pool                 │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ 3. Shielded Tx  │ ← Fully private (Halo2 proof)         │
│  │    (z→z)        │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ 4. Unshield     │ ← Exit shielded pool                  │
│  │    (z→t)        │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ 5. Bridge out   │ ← ZEC → NEAR/SOL                      │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  Recipient (Bob @ stealth address)                          │
│                                                             │
│  Privacy: Sender ✅ | Amount ✅ | Recipient ✅              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Zcash Shielded Pool Integration (#413)

### 2.1 Zcash Address Types

| Type | Format | Privacy | Notes |
|------|--------|---------|-------|
| Transparent (t-addr) | `t1...` | ❌ None | Like Bitcoin |
| Sapling (z-addr) | `zs1...` | ✅ Full | Legacy shielded |
| Orchard (z-addr) | `u1...` | ✅ Full | Latest, Halo2-based |
| Unified | `u1...` | ✅ Full | Multi-pool support |

**Recommendation:** Target Orchard (Halo2) for best composition with SIP proof system.

### 2.2 Existing ZcashRPCClient

```typescript
// Current implementation: packages/sdk/src/zcash/client.ts
class ZcashRPCClient {
  async getBalance(): Promise<bigint>
  async sendTransaction(to: string, amount: bigint): Promise<string>
  async getTransaction(txid: string): Promise<ZcashTransaction>
}
```

### 2.3 Required Extensions

```typescript
// Proposed extension for shielded operations
interface ZcashShieldedClient {
  // === Address Management ===

  /** Generate new Orchard (unified) address */
  generateUnifiedAddress(): Promise<UnifiedAddress>

  /** Get shielded balance (Sapling + Orchard) */
  getShieldedBalance(address: string): Promise<{
    sapling: bigint
    orchard: bigint
    total: bigint
  }>

  // === Shielded Operations ===

  /** Shield funds (t-addr → z-addr) */
  shield(
    from: string,        // t-addr
    to: string,          // z-addr
    amount: bigint
  ): Promise<string>     // txid

  /** Shielded transfer (z-addr → z-addr) */
  shieldedTransfer(
    from: string,        // z-addr
    to: string,          // z-addr
    amount: bigint,
    memo?: string        // Optional encrypted memo
  ): Promise<string>     // txid

  /** Unshield funds (z-addr → t-addr) */
  unshield(
    from: string,        // z-addr
    to: string,          // t-addr
    amount: bigint
  ): Promise<string>     // txid

  // === Viewing Keys ===

  /** Export viewing key for address */
  exportViewingKey(address: string): Promise<{
    ovk: string          // Outgoing viewing key
    ivk: string          // Incoming viewing key
    fvk: string          // Full viewing key
  }>

  /** Import viewing key (watch-only) */
  importViewingKey(fvk: string): Promise<void>

  // === Note Scanning ===

  /** Scan for notes received at address */
  scanForNotes(
    fvk: string,
    startHeight: number,
    endHeight?: number
  ): Promise<ShieldedNote[]>
}

interface UnifiedAddress {
  unified: string        // u1... (Unified)
  orchard: string        // Orchard component
  sapling?: string       // Sapling component (optional)
  transparent?: string   // t-addr component (optional)
}

interface ShieldedNote {
  txid: string
  noteIndex: number
  value: bigint
  memo?: string
  isSpent: boolean
  confirmations: number
}
```

### 2.4 RPC Methods Required

| Method | Description | Status |
|--------|-------------|--------|
| `z_getnewaddress` | Generate z-addr | ✅ Available |
| `z_listunifiedreceivers` | Get unified components | ✅ Available |
| `z_getbalance` | Get shielded balance | ✅ Available |
| `z_sendmany` | Send shielded | ✅ Available |
| `z_exportviewingkey` | Export VK | ✅ Available |
| `z_importviewingkey` | Import VK | ✅ Available |
| `z_viewtransaction` | View tx with VK | ✅ Available |

**Assessment:** All required RPC methods available in zcashd.

---

## 3. Cross-Chain Bridge Selection (#415)

### 3.1 Bridge Candidates

| Bridge | ZEC Support | Decentralized | Chains | Status |
|--------|-------------|---------------|--------|--------|
| **THORChain** | ✅ Native | ✅ Yes | BTC, ETH, SOL, ATOM, ZEC | Active |
| RenBridge | ✅ renZEC | ⚠️ Semi | ETH, BSC | Deprecated |
| Portal/Wormhole | ❌ No | ✅ Yes | Many | N/A |
| LayerZero | ❌ No | ⚠️ Semi | Many | N/A |

### 3.2 THORChain Analysis (Recommended)

**Pros:**
- Native ZEC support (not wrapped)
- Fully decentralized (no custodian)
- Cross-chain liquidity pools
- Swap + bridge in single transaction

**Cons:**
- Slippage on low-liquidity pairs
- Variable fees (based on pool depth)
- ~30 min confirmation time

**Technical Integration:**

```typescript
interface THORChainAdapter {
  // Get swap quote
  getQuote(params: {
    fromAsset: string    // 'SOL.SOL' | 'ETH.ETH' | etc
    toAsset: string      // 'ZEC.ZEC'
    amount: bigint
  }): Promise<{
    expectedOutput: bigint
    fees: bigint
    slippage: number
    estimatedTime: number  // seconds
    memo: string           // THORChain memo for tx
  }>

  // Execute swap
  executeSwap(params: {
    fromAsset: string
    toAsset: string
    amount: bigint
    destination: string    // Destination address
    wallet: WalletAdapter
  }): Promise<{
    inboundTxHash: string
    outboundTxHash?: string
    status: 'pending' | 'completed' | 'failed'
  }>

  // Track swap status
  trackSwap(inboundTxHash: string): Promise<SwapStatus>
}
```

### 3.3 Fee Analysis

| Route | Estimated Fees | Time |
|-------|----------------|------|
| SOL → ZEC (THORChain) | ~0.3% + gas | ~20 min |
| ZEC shielding | ~0.0001 ZEC | ~2 min |
| ZEC z→z transfer | ~0.0001 ZEC | ~2 min |
| ZEC unshielding | ~0.0001 ZEC | ~2 min |
| ZEC → NEAR (THORChain) | ~0.3% + gas | ~20 min |
| **Total** | **~0.6-1%** | **~45-60 min** |

### 3.4 Liquidity Considerations

```
THORChain ZEC Pool Depth (approximate):

ZEC/RUNE pool: ~$500K-1M
Practical swap limit: ~$50K (before significant slippage)

For larger amounts:
- Split into multiple swaps
- Use time-weighted execution
- Or use alternative bridge (if available)
```

---

## 4. Routing Logic (#414)

### 4.1 Full Route Flow

```typescript
async function executeFullPrivacyRoute(
  params: FullPrivacyParams
): Promise<FullPrivacyResult> {
  const { from, to, amount, viewingKey } = params

  // Step 1: Generate temporary Zcash addresses
  const zcashClient = new ZcashShieldedClient()
  const tempZAddr = await zcashClient.generateUnifiedAddress()

  // Step 2: Bridge source chain → ZEC (transparent)
  const bridgeAdapter = new THORChainAdapter()
  const bridgeIn = await bridgeAdapter.executeSwap({
    fromAsset: chainToThorAsset(from.chain),
    toAsset: 'ZEC.ZEC',
    amount: amount,
    destination: tempZAddr.transparent,
    wallet: from.wallet
  })

  // Wait for bridge completion
  await waitForBridge(bridgeIn.inboundTxHash)

  // Step 3: Shield (t-addr → z-addr)
  const shieldTx = await zcashClient.shield(
    tempZAddr.transparent,
    tempZAddr.orchard,
    bridgeIn.outputAmount
  )
  await waitForConfirmation(shieldTx, 3)

  // Step 4: Shielded transfer (z-addr → z-addr)
  // This is where full privacy happens
  const recipientZAddr = await generateRecipientZAddr(to)
  const privateTx = await zcashClient.shieldedTransfer(
    tempZAddr.orchard,
    recipientZAddr.orchard,
    shieldedAmount,
    encryptMemo(to.address)  // Recipient info in encrypted memo
  )
  await waitForConfirmation(privateTx, 3)

  // Step 5: Unshield (z-addr → t-addr)
  const unshieldTx = await zcashClient.unshield(
    recipientZAddr.orchard,
    recipientZAddr.transparent,
    unshieldAmount
  )
  await waitForConfirmation(unshieldTx, 3)

  // Step 6: Bridge ZEC → destination chain
  const bridgeOut = await bridgeAdapter.executeSwap({
    fromAsset: 'ZEC.ZEC',
    toAsset: chainToThorAsset(to.chain),
    amount: unshieldAmount,
    destination: to.stealthAddress,
    wallet: zcashWallet
  })

  // Step 7: Generate viewing key (if requested)
  let vk = undefined
  if (viewingKey) {
    vk = await zcashClient.exportViewingKey(tempZAddr.orchard)
  }

  return {
    intentId: generateIntentId(),
    status: 'completed',
    route: [from.chain, 'ZEC', to.chain],
    txHashes: {
      bridgeIn: bridgeIn.inboundTxHash,
      shield: shieldTx,
      shielded: privateTx,
      unshield: unshieldTx,
      bridgeOut: bridgeOut.inboundTxHash,
    },
    viewingKey: vk,
    privacyLevel: 'full',
  }
}
```

### 4.2 State Machine

```
┌─────────────────────────────────────────────────────────────┐
│  FULL PRIVACY ROUTE STATE MACHINE                           │
│                                                             │
│  INITIATED                                                  │
│      │                                                      │
│      ▼                                                      │
│  BRIDGING_IN ──────────┐                                   │
│      │                 │ (failure)                         │
│      ▼                 ▼                                    │
│  SHIELDING        BRIDGE_FAILED                            │
│      │                                                      │
│      ▼                                                      │
│  SHIELDED_TRANSFER                                          │
│      │                                                      │
│      ▼                                                      │
│  UNSHIELDING                                                │
│      │                                                      │
│      ▼                                                      │
│  BRIDGING_OUT ─────────┐                                   │
│      │                 │ (failure)                         │
│      ▼                 ▼                                    │
│  COMPLETED        BRIDGE_OUT_FAILED                        │
│                        │                                    │
│                        ▼                                    │
│                   MANUAL_RECOVERY                           │
│                   (funds stuck in ZEC)                      │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Error Recovery

| State | Recovery Action |
|-------|-----------------|
| BRIDGE_FAILED | Retry bridge or refund to source |
| SHIELD_FAILED | Retry shield or return t-addr balance |
| TRANSFER_FAILED | Retry transfer (funds safe in z-addr) |
| UNSHIELD_FAILED | Retry unshield |
| BRIDGE_OUT_FAILED | Manual ZEC withdrawal option |

---

## 5. SDK API Design (#416)

### 5.1 High-Level API

```typescript
// Simple API for full privacy cross-chain transfer
interface SIPClient {
  /**
   * Execute fully private cross-chain transfer
   * Routes through Zcash shielded pool for maximum privacy
   */
  crossChainPrivate(params: CrossChainPrivateParams): Promise<CrossChainPrivateResult>
}

interface CrossChainPrivateParams {
  /** Source chain and address */
  from: {
    chain: ChainId
    address: string
    wallet: WalletAdapter
  }

  /** Destination chain and address */
  to: {
    chain: ChainId
    address: string  // Can be stealth address or regular
  }

  /** Amount in source chain's smallest unit */
  amount: bigint

  /** Generate viewing key for compliance (default: true) */
  viewingKey?: boolean

  /** Progress callback */
  onProgress?: (status: RouteStatus) => void

  /** Slippage tolerance for bridges (default: 1%) */
  slippageTolerance?: number
}

interface CrossChainPrivateResult {
  /** Unique intent identifier */
  intentId: string

  /** Final status */
  status: 'completed' | 'failed' | 'partial'

  /** Route taken */
  route: ChainId[]

  /** Transaction hashes for each step */
  txHashes: {
    bridgeIn?: string
    shield?: string
    shielded?: string
    unshield?: string
    bridgeOut?: string
  }

  /** Viewing key (if requested) */
  viewingKey?: string

  /** Privacy level achieved */
  privacyLevel: 'full' | 'partial'

  /** Actual fees paid */
  fees: {
    bridge: bigint
    zcash: bigint
    total: bigint
  }

  /** Total time taken */
  durationMs: number
}

interface RouteStatus {
  step: 'bridging_in' | 'shielding' | 'shielded' | 'unshielding' | 'bridging_out'
  progress: number  // 0-100
  message: string
  txHash?: string
}
```

### 5.2 Usage Example

```typescript
import { SIP } from '@sip-protocol/sdk'

const sip = new SIP({
  network: 'mainnet',
  proofProvider: new NoirProofProvider(),
})

// Full privacy transfer: SOL → NEAR
const result = await sip.crossChainPrivate({
  from: {
    chain: 'solana',
    address: 'GH7QLW...',
    wallet: phantomWallet,
  },
  to: {
    chain: 'near',
    address: 'alice.near',
  },
  amount: 1_000_000_000n,  // 1 SOL in lamports
  viewingKey: true,
  onProgress: (status) => {
    console.log(`${status.step}: ${status.progress}% - ${status.message}`)
  },
})

console.log('Transfer complete:', result.intentId)
console.log('Privacy level:', result.privacyLevel)  // 'full'
console.log('Viewing key:', result.viewingKey)       // For compliance
```

### 5.3 Comparison with Existing API

```typescript
// Existing: Partial privacy via NEAR Intents
// Fast (~30s), lower fees, sender visible to solver
await sip.swap({
  from: { chain: 'solana', ... },
  to: { chain: 'near', ... },
  amount: 1000000000n,
})

// New: Full privacy via Zcash
// Slower (~60 min), higher fees, fully private
await sip.crossChainPrivate({
  from: { chain: 'solana', ... },
  to: { chain: 'near', ... },
  amount: 1000000000n,
})
```

---

## 6. Implementation Assessment

### 6.1 Effort Estimate

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| ZcashShieldedClient | 2 weeks | zcashd RPC |
| THORChainAdapter | 2 weeks | THORChain API |
| Routing logic | 2 weeks | Both above |
| SDK API | 1 week | Routing logic |
| Testing | 2 weeks | All above |
| **Total** | **9 weeks** | - |

### 6.2 Prerequisites

1. zcashd node access (testnet + mainnet)
2. THORChain API integration
3. Multi-step transaction state management
4. Error recovery system

### 6.3 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| THORChain liquidity | High | Monitor pools, split large swaps |
| Zcash node reliability | Medium | Multiple node endpoints |
| Long confirmation times | Medium | Clear UX, progress updates |
| Bridge failures | High | Robust error recovery |
| Regulatory changes | High | Viewing key compliance |

---

## 7. Recommendations

### 7.1 Implementation Priority

```
PRIORITY ORDER:

1. [HIGH] M17 Solana same-chain privacy
   - Immediate value, simpler implementation
   - No bridge dependency

2. [HIGH] M18 Ethereum same-chain privacy
   - Large user base
   - No bridge dependency

3. [MEDIUM] M20 Zcash cross-chain route
   - Premium feature for max privacy
   - Depends on bridge maturity

4. [LOW] Full proof composition (M21+)
   - Technical moat
   - Research-heavy
```

### 7.2 Phased Approach

**Phase 1 (M19): Research Complete** ✅
- Document technical approach
- Identify dependencies
- Estimate effort

**Phase 2 (M20): Implementation**
- ZcashShieldedClient
- THORChainAdapter
- Basic routing

**Phase 3 (M21): Production**
- Full SDK API
- Error recovery
- Mainnet deployment

### 7.3 Alternative Approaches

If THORChain ZEC liquidity is insufficient:

1. **Zcash-only path:** For Zcash-native users
2. **Aztec Connect (Ethereum):** Similar privacy via Aztec L2
3. **Secret Network:** Alternative privacy chain routing

---

## 8. Research Conclusions

### 8.1 Feasibility

| Aspect | Status | Notes |
|--------|--------|-------|
| Technical | ✅ Feasible | All RPC methods available |
| Bridge | ✅ Available | THORChain supports ZEC |
| Latency | ⚠️ Acceptable | ~45-60 min total |
| Cost | ⚠️ Higher | ~0.6-1% vs ~0.1% regular |
| Complexity | ⚠️ High | Multi-step, error recovery |

### 8.2 Final Recommendation

**Defer implementation to M20**, focus M19 on:
- Completing proof composition research
- Solana/Ethereum same-chain privacy

**Zcash route as premium feature:**
- For users requiring maximum privacy
- Higher cost/latency justified by full privacy
- Viewing keys for compliance

### 8.3 Action Items

| Item | Milestone | Owner |
|------|-----------|-------|
| Complete research doc | M19 ✅ | - |
| ZcashShieldedClient | M20 | TBD |
| THORChainAdapter | M20 | TBD |
| SDK API | M20 | TBD |
| Production deployment | M21 | TBD |

---

## References

- [Zcash RPC Documentation](https://zcash.readthedocs.io/)
- [THORChain Developer Docs](https://docs.thorchain.org/)
- [Zcash Orchard Protocol](https://zcash.github.io/orchard/)
- [Halo2 Book](https://zcash.github.io/halo2/)

---

**Conclusion:** Zcash cross-chain route is technically feasible and provides true full privacy. Implementation deferred to M20 to prioritize same-chain privacy features (M17/M18) which have higher immediate value.
