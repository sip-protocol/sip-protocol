# SIP Cross-Chain Privacy Standard

**Version:** 1.0.0-draft
**Status:** Proposal
**Authors:** SIP Protocol Team
**Created:** 2026-01-21

---

## Executive Summary

This document proposes a cross-chain privacy standard that enables private transactions across multiple blockchain networks while maintaining compliance capabilities. Unlike single-chain privacy solutions, this standard addresses the unique challenges of cross-chain value transfer: bridge trust assumptions, multi-chain address management, and jurisdiction-aware compliance.

**Key Innovation:** Privacy-preserving cross-chain transfers where sender chain, recipient chain, sender identity, recipient identity, and amount are all cryptographically hidden from observers, while remaining auditable through viewing keys.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [Design Goals](#3-design-goals)
4. [Architecture Overview](#4-architecture-overview)
5. [Cross-Chain Stealth Addresses](#5-cross-chain-stealth-addresses)
6. [Bridge Integration Patterns](#6-bridge-integration-patterns)
7. [Multi-Chain Viewing Keys](#7-multi-chain-viewing-keys)
8. [Settlement-Agnostic Privacy Layer](#8-settlement-agnostic-privacy-layer)
9. [Security Analysis](#9-security-analysis)
10. [Compliance Framework](#10-compliance-framework)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Appendix](#appendix)

---

## 1. Introduction

### 1.1 Background

Cross-chain transactions have become essential to the multi-chain ecosystem. Users regularly bridge assets between Ethereum, Solana, NEAR, and other networks. However, current cross-chain solutions expose:

- **Source chain identity**: Where funds originated
- **Destination chain identity**: Where funds are going
- **Bridge path**: Which bridge was used
- **Transaction timing**: When the transfer occurred
- **Amount correlation**: Linking source and destination by amounts

This transparency enables sophisticated tracking across the entire multi-chain ecosystem.

### 1.2 Scope

This standard covers:

- Cross-chain stealth address resolution
- Bridge-compatible privacy preservation
- Multi-chain viewing key management
- Settlement-agnostic privacy layer
- Jurisdiction-aware compliance

### 1.3 Terminology

| Term | Definition |
|------|------------|
| **Source Chain** | Blockchain where funds originate |
| **Destination Chain** | Blockchain where funds are received |
| **Bridge** | Protocol enabling cross-chain value transfer |
| **Relay** | Off-chain component facilitating cross-chain messages |
| **Shielded Bridge** | Privacy-preserving cross-chain transfer |
| **Cross-Chain Stealth Address** | One-time address valid across multiple chains |

---

## 2. Problem Statement

### 2.1 Current Cross-Chain Privacy Gaps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURRENT CROSS-CHAIN TRANSFER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Source Chain (Ethereum)           Bridge              Dest Chain (Solana)  │
│  ┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │
│  │ Alice: 0x1234...    │───▶│ Lock 100 USDC   │───▶│ Bob: Hk7x9...       │ │
│  │ Amount: 100 USDC    │    │ Mint 100 USDC   │    │ Amount: 100 USDC    │ │
│  │ Time: 14:32:05      │    │ Relay message   │    │ Time: 14:32:47      │ │
│  └─────────────────────┘    └─────────────────┘    └─────────────────────┘ │
│                                                                             │
│  EXPOSED: Sender, Recipient, Amount, Timing, Bridge Used, Chain Path       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Attack Vectors

| Attack | Description | Impact |
|--------|-------------|--------|
| **Chain Correlation** | Linking addresses across chains by timing/amounts | Identity deanonymization |
| **Bridge Analysis** | Monitoring bridge contracts for patterns | Transaction graph mapping |
| **Timing Analysis** | Correlating source/dest tx timestamps | Breaking privacy sets |
| **Amount Fingerprinting** | Unique amounts link source/dest | Direct address linking |
| **Relay Surveillance** | Compromised relays log all transfers | Complete visibility |

### 2.3 Existing Solution Limitations

| Solution | Limitation |
|----------|------------|
| Single-chain mixers | No cross-chain support |
| Privacy L2s | Walled gardens, no interop |
| Encrypted bridges | Still expose endpoints |
| ZK bridges | Complex, limited chain support |

---

## 3. Design Goals

### 3.1 Primary Goals

1. **Cross-Chain Unlinkability**: Observers cannot link source and destination transactions
2. **Amount Privacy**: Transfer amounts are hidden on both chains
3. **Endpoint Privacy**: Both sender and recipient identities are protected
4. **Bridge Agnosticism**: Works with any bridge infrastructure
5. **Compliance Ready**: Viewing keys enable selective disclosure

### 3.2 Security Requirements

| Requirement | Description |
|-------------|-------------|
| **Forward Secrecy** | Past transactions remain private if keys compromised |
| **Replay Resistance** | Transactions cannot be replayed on other chains |
| **Bridge Collusion Resistance** | Privacy holds even if bridge is compromised |
| **Relay Privacy** | Relays cannot learn transaction details |

### 3.3 Non-Goals

- Hiding that a cross-chain transfer occurred (network-level privacy)
- Protecting against endpoint compromise (wallet security)
- Regulatory circumvention (compliance is required)

---

## 4. Architecture Overview

### 4.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SIP CROSS-CHAIN PRIVACY ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     SIP PRIVACY LAYER                                 │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │  │ Cross-Chain    │  │ Unified        │  │ Multi-Chain    │         │  │
│  │  │ Stealth Addr   │  │ Commitments    │  │ Viewing Keys   │         │  │
│  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘         │  │
│  └──────────┼───────────────────┼───────────────────┼───────────────────┘  │
│             │                   │                   │                       │
│  ┌──────────▼───────────────────▼───────────────────▼───────────────────┐  │
│  │                     BRIDGE ABSTRACTION LAYER                          │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │  │
│  │  │ Wormhole       │  │ LayerZero      │  │ Axelar         │         │  │
│  │  │ Adapter        │  │ Adapter        │  │ Adapter        │         │  │
│  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘         │  │
│  └──────────┼───────────────────┼───────────────────┼───────────────────┘  │
│             │                   │                   │                       │
│  ┌──────────▼───────────────────▼───────────────────▼───────────────────┐  │
│  │                         BLOCKCHAIN LAYER                              │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │  │Ethereum │  │ Solana  │  │  NEAR   │  │ Bitcoin │  │ Cosmos  │    │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Overview

| Component | Purpose |
|-----------|---------|
| **Cross-Chain Stealth Addresses** | Unified addressing across all chains |
| **Unified Commitments** | Chain-agnostic amount hiding |
| **Multi-Chain Viewing Keys** | Single key for all-chain visibility |
| **Bridge Abstraction Layer** | Adapter pattern for any bridge |
| **Settlement Layer** | Chain-specific transaction execution |

---

## 5. Cross-Chain Stealth Addresses

### 5.1 Universal Meta-Address Format

A single meta-address that works across all supported chains:

```
sip:universal:<spendingKey>:<viewingKey>[?chains=<chain1,chain2,...>]
```

**Example:**
```
sip:universal:0x02abc...123:0x03def...456?chains=ethereum,solana,near
```

### 5.2 Chain-Specific Derivation

From a universal meta-address, derive chain-specific addresses:

```
FUNCTION deriveChainAddress(
    universalMetaAddress: UniversalMetaAddress,
    targetChain: ChainId,
    ephemeralPrivateKey: bytes32
) -> ChainSpecificStealthAddress:

    // Get chain-specific curve
    curve = getCurveForChain(targetChain)

    // Convert keys to chain-specific format if needed
    spendingKey = convertKey(universalMetaAddress.spendingKey, curve)
    viewingKey = convertKey(universalMetaAddress.viewingKey, curve)

    // Standard stealth derivation with chain context
    chainContext = sha256("sip-chain-" + targetChain)
    ephemeralWithContext = sha256(ephemeralPrivateKey || chainContext)

    // Derive stealth address
    sharedSecret = ECDH(ephemeralWithContext, viewingKey)
    stealthKey = sha256(sharedSecret) * G + spendingKey

    // Format for target chain
    address = formatAddressForChain(stealthKey, targetChain)

    RETURN {
        chain: targetChain,
        address: address,
        ephemeralPublicKey: ephemeralWithContext * G,
        viewTag: sha256(sharedSecret)[0]
    }
```

### 5.3 Cross-Chain Address Resolution Protocol

```
SEQUENCE crossChainAddressResolution:

    1. Sender has recipient's universal meta-address
       META_ADDRESS = sip:universal:0x02abc...123:0x03def...456

    2. Sender determines target chain (from user input or meta-address params)
       TARGET_CHAIN = "solana"

    3. Sender derives chain-specific stealth address
       STEALTH_ADDR = deriveChainAddress(META_ADDRESS, TARGET_CHAIN, ephemeralKey)
       // Result: Hk7x9Qm...abc (Solana format)

    4. Sender initiates cross-chain transfer to stealth address
       TRANSFER = {
           sourceChain: "ethereum",
           destChain: "solana",
           recipient: STEALTH_ADDR,
           amount: COMMITMENT  // Pedersen commitment
       }

    5. Recipient scans destination chain with viewing key
       PAYMENTS = scanChain("solana", viewingKey, spendingPubKey)
```

### 5.4 Multi-Curve Key Conversion

For chains using different curves:

```
FUNCTION convertKey(
    sourceKey: CompressedPublicKey,
    sourceCurve: CurveType,
    targetCurve: CurveType
) -> CompressedPublicKey:

    IF sourceCurve == targetCurve:
        RETURN sourceKey

    // Extract scalar from source key (requires private key for full conversion)
    // For public-key-only conversion, use hash-based derivation
    keyHash = sha256(sourceKey || targetCurve)

    // Derive new key on target curve
    targetKey = keyHash * G_target  // G_target is generator for target curve

    RETURN compress(targetKey)
```

**Supported Curve Mappings:**

| Source Curve | Target Curve | Method |
|--------------|--------------|--------|
| secp256k1 | ed25519 | Hash derivation |
| ed25519 | secp256k1 | Hash derivation |
| secp256k1 | bn254 | Direct (compatible field) |
| ed25519 | bn254 | Hash derivation |

---

## 6. Bridge Integration Patterns

### 6.1 Shielded Bridge Transfer Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SHIELDED CROSS-CHAIN TRANSFER                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SOURCE CHAIN                  BRIDGE                   DEST CHAIN          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ 1. Create       │    │ 3. Relay        │    │ 5. Announce     │         │
│  │    shielded     │───▶│    encrypted    │───▶│    stealth      │         │
│  │    intent       │    │    payload      │    │    payment      │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                      │                      │                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ 2. Lock tokens  │    │ 4. Verify proof │    │ 6. Recipient    │         │
│  │    in shielded  │    │    (ZK or       │    │    claims with  │         │
│  │    pool         │    │    oracle)      │    │    stealth key  │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
│  HIDDEN: Sender, Recipient, Amount, Source/Dest Correlation                │
│  VISIBLE: Transfer occurred (existence), Bridge used                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Bridge Adapter Interface

```typescript
interface SIPBridgeAdapter {
  // Bridge identification
  readonly bridgeId: string
  readonly supportedChains: ChainId[]

  // Core operations
  initiateShieldedTransfer(params: ShieldedTransferParams): Promise<TransferResult>
  completeShieldedTransfer(proof: TransferProof): Promise<CompletionResult>

  // Scanning
  scanBridgeAnnouncements(viewingKey: ViewingKey): Promise<BridgeAnnouncement[]>

  // Fees
  estimateFees(params: TransferParams): Promise<FeeEstimate>
}

interface ShieldedTransferParams {
  // Source
  sourceChain: ChainId
  sourceCommitment: PedersenCommitment  // Hidden amount

  // Destination
  destChain: ChainId
  destStealthAddress: StealthAddress

  // Privacy
  encryptedMemo?: HexString
  viewingKeyHash?: HexString32  // For compliance

  // Proofs (optional, depends on bridge)
  fundingProof?: ZKProof
  validityProof?: ZKProof
}

interface TransferResult {
  sourceChainTxHash: HexString32
  bridgeMessageId: HexString32
  estimatedArrival: number  // Unix timestamp
}
```

### 6.3 Bridge-Specific Adapters

#### Wormhole Adapter

```typescript
class WormholeAdapter implements SIPBridgeAdapter {
  readonly bridgeId = 'wormhole'
  readonly supportedChains = [
    'ethereum', 'solana', 'polygon', 'avalanche',
    'bsc', 'arbitrum', 'optimism', 'base', 'sui', 'aptos'
  ]

  async initiateShieldedTransfer(params: ShieldedTransferParams): Promise<TransferResult> {
    // 1. Encode shielded payload
    const payload = this.encodeShieldedPayload(params)

    // 2. Call Wormhole TokenBridge with encoded payload
    const txHash = await this.wormhole.transferTokensWithPayload(
      params.sourceChain,
      payload,
      params.destChain
    )

    // 3. Wait for VAA (Verified Action Approval)
    const vaa = await this.wormhole.getVAA(txHash)

    return {
      sourceChainTxHash: txHash,
      bridgeMessageId: vaa.hash,
      estimatedArrival: Date.now() + 15 * 60 * 1000  // ~15 min
    }
  }

  private encodeShieldedPayload(params: ShieldedTransferParams): Uint8Array {
    // SIP-specific payload format
    return encode({
      version: 1,
      type: 'shielded_transfer',
      destStealthAddress: params.destStealthAddress,
      amountCommitment: params.sourceCommitment.value,
      viewingKeyHash: params.viewingKeyHash,
      encryptedMemo: params.encryptedMemo
    })
  }
}
```

#### LayerZero Adapter

```typescript
class LayerZeroAdapter implements SIPBridgeAdapter {
  readonly bridgeId = 'layerzero'
  readonly supportedChains = [
    'ethereum', 'polygon', 'arbitrum', 'optimism',
    'avalanche', 'bsc', 'fantom', 'base'
  ]

  async initiateShieldedTransfer(params: ShieldedTransferParams): Promise<TransferResult> {
    // LayerZero uses OApp (Omnichain Application) pattern
    const message = this.buildOAppMessage(params)

    const txHash = await this.layerzero.send(
      params.destChain,
      message,
      { adapterParams: this.getAdapterParams(params) }
    )

    return {
      sourceChainTxHash: txHash,
      bridgeMessageId: this.deriveBridgeMessageId(txHash),
      estimatedArrival: Date.now() + 5 * 60 * 1000  // ~5 min
    }
  }
}
```

#### Axelar Adapter

```typescript
class AxelarAdapter implements SIPBridgeAdapter {
  readonly bridgeId = 'axelar'
  readonly supportedChains = [
    'ethereum', 'polygon', 'avalanche', 'fantom',
    'moonbeam', 'cosmos', 'osmosis', 'sei'
  ]

  async initiateShieldedTransfer(params: ShieldedTransferParams): Promise<TransferResult> {
    // Axelar uses GMP (General Message Passing)
    const payload = this.encodeGMPPayload(params)

    const txHash = await this.axelar.callContractWithToken(
      params.destChain,
      this.getSIPReceiverAddress(params.destChain),
      payload,
      'USDC',  // Token symbol
      '0'      // Amount is in commitment, not visible
    )

    return {
      sourceChainTxHash: txHash,
      bridgeMessageId: await this.axelar.getMessageId(txHash),
      estimatedArrival: Date.now() + 10 * 60 * 1000
    }
  }
}
```

### 6.4 Privacy-Preserving Bridge Pools

For maximum privacy, use shielded pools on both chains:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SHIELDED POOL BRIDGE PATTERN                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Ethereum                                              Solana               │
│  ┌─────────────────────────┐                ┌─────────────────────────┐    │
│  │   SIP Shielded Pool     │                │   SIP Shielded Pool     │    │
│  │   ┌─────────────────┐   │                │   ┌─────────────────┐   │    │
│  │   │ Commitment Tree │   │    Bridge      │   │ Commitment Tree │   │    │
│  │   │ ┌───┐ ┌───┐     │   │    Message     │   │ ┌───┐ ┌───┐     │   │    │
│  │   │ │C1 │ │C2 │ ... │◄──┼───────────────►│───│ │C1'│ │C2'│ ... │   │    │
│  │   │ └───┘ └───┘     │   │                │   │ └───┘ └───┘     │   │    │
│  │   └─────────────────┘   │                │   └─────────────────┘   │    │
│  │                         │                │                         │    │
│  │   Nullifier Set         │                │   Nullifier Set         │    │
│  │   {N1, N2, N3, ...}     │                │   {N1', N2', N3', ...}  │    │
│  └─────────────────────────┘                └─────────────────────────┘    │
│                                                                             │
│  Privacy: Sender deposits to pool, recipient withdraws from pool           │
│  Linkability: None (pool breaks correlation)                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Multi-Chain Viewing Keys

### 7.1 Unified Viewing Key Architecture

A single viewing key that provides visibility across all chains:

```typescript
interface MultiChainViewingKey {
  // Master key
  masterKey: HexString32

  // Chain-specific derived keys (cached for performance)
  chainKeys: Map<ChainId, ViewingKey>

  // Capabilities
  type: 'incoming' | 'outgoing' | 'full'

  // Metadata
  createdAt: number
  expiresAt?: number
}
```

### 7.2 Chain-Specific Key Derivation

```
FUNCTION deriveChainViewingKey(
    masterViewingKey: bytes32,
    chain: ChainId
) -> ViewingKey:

    // Derive chain-specific key
    chainContext = sha256("sip-vk-" + chain)
    chainKey = HKDF(masterViewingKey, chainContext, 32)

    // Get chain's curve
    curve = getCurveForChain(chain)

    // Derive public key on chain's curve
    publicKey = curve.getPublicKey(chainKey)

    RETURN {
        privateKey: chainKey,
        publicKey: publicKey,
        chain: chain
    }
```

### 7.3 Cross-Chain Scanning

```typescript
async function scanAllChains(
  multiChainViewingKey: MultiChainViewingKey,
  spendingPublicKey: CompressedPublicKey,
  chains: ChainId[]
): Promise<Map<ChainId, Payment[]>> {

  const results = new Map<ChainId, Payment[]>()

  // Parallel scanning across all chains
  const scanPromises = chains.map(async (chain) => {
    const chainViewingKey = deriveChainViewingKey(
      multiChainViewingKey.masterKey,
      chain
    )

    const rpc = getRPCForChain(chain)
    const announcements = await rpc.getStealthAnnouncements()

    const payments = scanForPayments(
      chainViewingKey.privateKey,
      spendingPublicKey,
      announcements
    )

    return { chain, payments }
  })

  const chainResults = await Promise.all(scanPromises)

  for (const { chain, payments } of chainResults) {
    results.set(chain, payments)
  }

  return results
}
```

### 7.4 Cross-Chain Audit Trail

For compliance, generate unified audit reports:

```typescript
interface CrossChainAuditTrail {
  // Account identifier
  universalMetaAddress: string

  // Time range
  startTime: number
  endTime: number

  // Per-chain transactions
  chainTransactions: Map<ChainId, AuditedTransaction[]>

  // Cross-chain transfers
  crossChainTransfers: CrossChainTransfer[]

  // Totals
  summary: {
    totalIncoming: Map<string, bigint>  // token -> amount
    totalOutgoing: Map<string, bigint>
    netPosition: Map<string, bigint>
    chainBreakdown: Map<ChainId, ChainSummary>
  }

  // Verification
  viewingKeyHash: HexString32
  generatedAt: number
  auditorSignature: HexString
}

interface CrossChainTransfer {
  sourceChain: ChainId
  sourceTxHash: HexString32
  destChain: ChainId
  destTxHash: HexString32
  bridgeUsed: string
  amount: string
  token: string
  timestamp: number
}
```

---

## 8. Settlement-Agnostic Privacy Layer

### 8.1 Abstraction Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SETTLEMENT-AGNOSTIC ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  APPLICATION LAYER                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ createPrivateTransfer({ amount, recipient, destChain })               │ │
│  │ // Same API regardless of settlement backend                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│                                      ▼                                      │
│  PRIVACY LAYER (SIP CORE)                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • Stealth address derivation                                          │ │
│  │ • Pedersen commitment creation                                        │ │
│  │ • Viewing key management                                              │ │
│  │ • ZK proof generation (optional)                                      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│                                      ▼                                      │
│  SETTLEMENT ABSTRACTION                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ interface SettlementProvider {                                        │ │
│  │   settle(intent: ShieldedIntent): Promise<SettlementResult>           │ │
│  │   verify(proof: SettlementProof): Promise<boolean>                    │ │
│  │ }                                                                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                      │                                      │
│      ┌───────────────────┬───────────┴───────────┬───────────────────┐     │
│      ▼                   ▼                       ▼                   ▼     │
│  ┌────────┐         ┌────────┐             ┌────────┐          ┌────────┐  │
│  │ Direct │         │  NEAR  │             │ Zcash  │          │  Mina  │  │
│  │ Chain  │         │Intents │             │Shielded│          │Succinct│  │
│  └────────┘         └────────┘             └────────┘          └────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Settlement Provider Interface

```typescript
interface SettlementProvider {
  // Provider identification
  readonly providerId: string
  readonly supportedChains: ChainId[]
  readonly capabilities: SettlementCapability[]

  // Core settlement
  settle(intent: ShieldedIntent): Promise<SettlementResult>

  // Verification
  verify(proof: SettlementProof): Promise<boolean>

  // Status
  getStatus(settlementId: string): Promise<SettlementStatus>

  // Fees
  estimateFees(intent: ShieldedIntent): Promise<FeeEstimate>
}

type SettlementCapability =
  | 'cross_chain'
  | 'atomic_swap'
  | 'zk_proofs'
  | 'instant_finality'
  | 'compliance_reporting'
```

### 8.3 Provider Implementations

#### Direct Chain Settlement

```typescript
class DirectChainProvider implements SettlementProvider {
  readonly providerId = 'direct'
  readonly capabilities = ['instant_finality']

  async settle(intent: ShieldedIntent): Promise<SettlementResult> {
    // Direct on-chain transaction
    const tx = await this.buildTransaction(intent)
    const receipt = await this.rpc.sendTransaction(tx)

    return {
      settlementId: receipt.hash,
      status: 'confirmed',
      chain: intent.recipient.chain,
      blockNumber: receipt.blockNumber
    }
  }
}
```

#### NEAR Intents Settlement

```typescript
class NEARIntentsProvider implements SettlementProvider {
  readonly providerId = 'near-intents'
  readonly capabilities = ['cross_chain', 'atomic_swap']

  async settle(intent: ShieldedIntent): Promise<SettlementResult> {
    // Submit to NEAR Intents network
    const nearIntent = this.convertToNEARFormat(intent)
    const result = await this.nearClient.submitIntent(nearIntent)

    return {
      settlementId: result.intentId,
      status: 'pending',
      estimatedCompletion: result.estimatedTime
    }
  }
}
```

#### Zcash Shielded Settlement

```typescript
class ZcashShieldedProvider implements SettlementProvider {
  readonly providerId = 'zcash-shielded'
  readonly capabilities = ['zk_proofs', 'compliance_reporting']

  async settle(intent: ShieldedIntent): Promise<SettlementResult> {
    // Create Zcash shielded transaction
    const zTx = await this.zcash.createShieldedTx({
      from: intent.sender,
      to: this.deriveZcashAddress(intent.recipient),
      amount: intent.amount,
      memo: intent.encryptedMemo
    })

    const txid = await this.zcash.broadcast(zTx)

    return {
      settlementId: txid,
      status: 'pending',
      chain: 'zcash'
    }
  }
}
```

### 8.4 Settlement Router

Automatically select optimal settlement provider:

```typescript
class SettlementRouter {
  private providers: Map<string, SettlementProvider>

  async route(intent: ShieldedIntent): Promise<SettlementResult> {
    // Score providers based on:
    // - Chain support
    // - Fee estimates
    // - Speed requirements
    // - Privacy level requirements

    const scores = await this.scoreProviders(intent)
    const bestProvider = this.selectBest(scores)

    return bestProvider.settle(intent)
  }

  private async scoreProviders(intent: ShieldedIntent): Promise<ProviderScore[]> {
    const scores: ProviderScore[] = []

    for (const [id, provider] of this.providers) {
      // Check chain support
      if (!this.supportsRoute(provider, intent)) continue

      // Estimate fees
      const fees = await provider.estimateFees(intent)

      // Calculate score
      const score = this.calculateScore(intent, provider, fees)
      scores.push({ providerId: id, score, fees })
    }

    return scores.sort((a, b) => b.score - a.score)
  }
}
```

---

## 9. Security Analysis

### 9.1 Threat Model

| Threat Actor | Capabilities | Mitigations |
|--------------|--------------|-------------|
| **Passive Observer** | Monitors all public data | Stealth addresses, commitments |
| **Bridge Operator** | Sees bridge messages | Encrypted payloads, ZK proofs |
| **Relay Node** | Processes cross-chain messages | Encryption, threshold signatures |
| **Chain Analyzer** | Advanced on-chain analysis | Unified pool privacy sets |
| **Compromised RPC** | Logs all queries | Client-side scanning |

### 9.2 Privacy Guarantees

| Property | Guarantee | Mechanism |
|----------|-----------|-----------|
| **Sender Privacy** | Unlinkable | Commitments + pool mixing |
| **Recipient Privacy** | Unlinkable | Stealth addresses |
| **Amount Privacy** | Hidden | Pedersen commitments |
| **Chain Correlation** | Broken | Encrypted bridge payloads |
| **Timing Correlation** | Reduced | Batched settlements |

### 9.3 Security Proofs

#### 9.3.1 Cross-Chain Unlinkability

**Theorem:** Given a cross-chain transfer from chain A to chain B, an observer cannot link the source transaction on A to the destination transaction on B with probability better than random guessing.

**Proof Sketch:**
1. Source commitment C_A = v·G + r_A·H hides amount v
2. Destination stealth address derived from independent ephemeral key
3. Bridge payload encrypted with recipient's viewing public key
4. No correlation exists between r_A, ephemeral key, or stealth derivation

### 9.4 Attack Resistance

#### Amount Correlation Attack

**Attack:** Link source/dest by matching amounts.

**Defense:** Pedersen commitments hide amounts. Even if amount is revealed via viewing key on destination, source amount remains hidden.

#### Timing Correlation Attack

**Attack:** Link by transaction timing.

**Defense:**
- Batch settlements (multiple intents per bridge message)
- Random delays
- Pool-based mixing

#### Bridge Collusion Attack

**Attack:** Bridge operator logs all transfers.

**Defense:**
- Encrypted payloads (operator sees ciphertext only)
- ZK proofs for validity (no plaintext needed)
- Multiple bridge options (no single point of surveillance)

---

## 10. Compliance Framework

### 10.1 Multi-Jurisdiction Compliance

Different jurisdictions have different requirements:

| Jurisdiction | Requirements | SIP Compliance |
|--------------|--------------|----------------|
| **US (FinCEN)** | Travel Rule ($3,000+) | Viewing keys to institutions |
| **EU (MiCA)** | Full traceability | Full viewing key to regulators |
| **Singapore (MAS)** | Risk-based approach | Tiered viewing key disclosure |
| **Switzerland (FINMA)** | Privacy-preserving compliance | Time-bounded viewing keys |

### 10.2 Travel Rule Compliance

For cross-chain transfers meeting Travel Rule thresholds:

```typescript
interface TravelRulePayload {
  // Originator information (encrypted)
  originator: {
    name: string
    accountId: string
    address?: string
    // ... FATF-required fields
  }

  // Beneficiary information (encrypted)
  beneficiary: {
    name: string
    accountId: string
    // ... FATF-required fields
  }

  // Transaction details
  amount: string
  currency: string
  sourceChain: ChainId
  destChain: ChainId

  // Compliance
  viewingKeyHash: HexString32
  complianceProof?: ZKProof  // Proves amount > threshold
}
```

### 10.3 Compliance Disclosure Protocol

```
SEQUENCE complianceDisclosure:

    1. Regulator identifies cross-chain transfer via viewing key hash

    2. Regulator → User: Request viewing key for specific transfer
       REQUEST {
           transferId: "bridge-msg-123",
           chains: ["ethereum", "solana"],
           legalBasis: "AML investigation",
           scope: "single_transfer"
       }

    3. User → Regulator: Provide scoped viewing key
       RESPONSE {
           viewingKey: encryptedViewingKey,  // Encrypted to regulator
           scope: {
               transferId: "bridge-msg-123",
               validFor: "single_use"
           }
       }

    4. Regulator decrypts and verifies transfer details

    5. Key automatically expires after use
```

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Q1 2026)

| Deliverable | Status | Description |
|-------------|--------|-------------|
| Universal meta-address format | Spec complete | Multi-chain addressing |
| Chain-specific derivation | Implementation | Stealth address derivation |
| Multi-chain viewing keys | Implementation | Unified key management |
| Wormhole adapter | Development | First bridge integration |

### Phase 2: Bridge Expansion (Q2 2026)

| Deliverable | Status | Description |
|-------------|--------|-------------|
| LayerZero adapter | Planned | Second bridge integration |
| Axelar adapter | Planned | Third bridge integration |
| Shielded pools | Research | Maximum privacy option |
| Cross-chain scanning | Development | Unified payment discovery |

### Phase 3: Production (Q3-Q4 2026)

| Deliverable | Status | Description |
|-------------|--------|-------------|
| Mainnet deployment | Planned | Production launch |
| Compliance tools | Planned | Regulatory reporting |
| Audit completion | Planned | Security verification |
| SDK release | Planned | Developer tools |

---

## Appendix

### A. Supported Chains

| Chain | Curve | Address Format | Bridge Support |
|-------|-------|----------------|----------------|
| Ethereum | secp256k1 | 0x (20 bytes) | Wormhole, LayerZero, Axelar |
| Solana | ed25519 | Base58 (32 bytes) | Wormhole |
| NEAR | ed25519 | Named accounts | NEAR Intents |
| Bitcoin | secp256k1 | Bech32 | Wormhole (wrapped) |
| Polygon | secp256k1 | 0x (20 bytes) | All major bridges |
| Arbitrum | secp256k1 | 0x (20 bytes) | LayerZero, Axelar |
| Avalanche | secp256k1 | 0x (20 bytes) | All major bridges |
| Cosmos | secp256k1 | Bech32 | Axelar, IBC |

### B. Bridge Comparison

| Bridge | Chains | Speed | Security Model | SIP Support |
|--------|--------|-------|----------------|-------------|
| Wormhole | 20+ | ~15 min | Guardian network | Full |
| LayerZero | 30+ | ~5 min | Oracle + Relayer | Full |
| Axelar | 40+ | ~10 min | Validator network | Full |
| IBC | Cosmos only | ~30 sec | Consensus | Partial |

### C. Test Vectors

See [Cross-Chain Test Vectors](./test-vectors/cross-chain.json).

### D. Reference Implementation

```typescript
import { SIPCrossChain } from '@sip-protocol/cross-chain'

// Initialize with universal meta-address
const recipient = 'sip:universal:0x02abc...123:0x03def...456'

// Create cross-chain transfer
const transfer = await SIPCrossChain.createTransfer({
  sourceChain: 'ethereum',
  destChain: 'solana',
  recipient: recipient,
  amount: 1000000n,  // 1 USDC
  privacyLevel: 'compliant'
})

// Execute via best bridge
const result = await transfer.execute()
console.log(`Transfer: ${result.bridgeMessageId}`)

// Recipient scans
const payments = await SIPCrossChain.scan({
  viewingKey: recipientViewingKey,
  chains: ['solana']
})
```

---

**Document Status:** Draft
**Last Updated:** 2026-01-21
**Next Review:** 2026-02-21
