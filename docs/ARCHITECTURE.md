# SIP Protocol Architecture

> Visual documentation of SIP Protocol architecture and flows

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Transaction Flows](#transaction-flows)
3. [Cryptographic Flows](#cryptographic-flows)
4. [Privacy Comparison](#privacy-comparison)
5. [Integration Architecture](#integration-architecture)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   DApps     │  │   Wallets   │  │    DAOs     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    @sip-protocol/sdk                       │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐  │  │
│  │  │ Intent  │ │ Stealth │ │ Privacy │ │ Wallet Adapters │  │  │
│  │  │ Builder │ │ Address │ │ Manager │ │ (ETH/SOL/NEAR)  │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
├──────────────────────────┼───────────────────────────────────────┤
│                   PRIVACY LAYER (SIP)                            │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │   Pedersen   │  │   Stealth    │  │   Viewing Keys   │ │  │
│  │  │ Commitments  │  │  Addresses   │  │  (Compliance)    │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘ │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │   Funding    │  │   Validity   │  │   Fulfillment    │ │  │
│  │  │    Proof     │  │    Proof     │  │     Proof        │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
├──────────────────────────┼───────────────────────────────────────┤
│                   SETTLEMENT LAYER                               │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │              NEAR Intents + Chain Signatures               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │  │
│  │  │  1Click API  │  │   Solvers    │  │ Chain Signatures │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
├──────────────────────────┼───────────────────────────────────────┤
│                    BLOCKCHAIN LAYER                              │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │
│  │  NEAR  │  │  ETH   │  │ Solana │  │ Zcash  │  │Bitcoin │    │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### SDK Internal Structure

```mermaid
graph TB
    subgraph SDK["@sip-protocol/sdk"]
        SIP[SIP Client]
        IB[IntentBuilder]

        subgraph Crypto["Cryptographic Core"]
            ST[Stealth Addresses]
            CM[Commitments]
            VK[Viewing Keys]
        end

        subgraph Proofs["Proof Providers"]
            MP[MockProofProvider]
            NP[NoirProofProvider]
        end

        subgraph Wallet["Wallet Adapters"]
            BA[BaseAdapter]
            EA[EthereumAdapter]
            SA[SolanaAdapter]
        end

        subgraph Network["Network Adapters"]
            OC[OneClickClient]
            NA[NEARIntentsAdapter]
            ZS[ZcashShieldedService]
        end
    end

    SIP --> IB
    SIP --> Crypto
    SIP --> Proofs
    SIP --> Wallet
    SIP --> Network

    IB --> ST
    IB --> CM
    IB --> VK
```

---

## Transaction Flows

### Transparent Flow

Standard cross-chain swap without privacy features.

```mermaid
sequenceDiagram
    participant U as User
    participant SDK as SIP SDK
    participant S as Solver
    participant Src as Source Chain
    participant Dst as Destination Chain

    U->>SDK: Create Intent (TRANSPARENT)
    SDK->>SDK: Build standard intent
    Note over SDK: No commitments<br/>No stealth address
    SDK->>S: Submit intent (public)

    S->>S: Evaluate quote
    S-->>SDK: Quote (visible)
    SDK-->>U: Display quote

    U->>SDK: Accept quote
    SDK->>S: Execute

    S->>Src: Lock input tokens
    Note over Src: Sender visible<br/>Amount visible

    S->>Dst: Release output tokens
    Note over Dst: Recipient visible<br/>Amount visible

    S-->>SDK: Fulfillment complete
    SDK-->>U: Transaction hash
```

### Shielded Flow

Full privacy with hidden sender, amount, and unlinkable recipient.

```mermaid
sequenceDiagram
    participant U as User
    participant SDK as SIP SDK
    participant PP as Proof Provider
    participant S as Solver
    participant Src as Source Chain
    participant Dst as Destination Chain

    U->>SDK: Create Intent (SHIELDED)

    SDK->>SDK: Generate stealth address
    Note over SDK: One-time recipient<br/>Unlinkable

    SDK->>SDK: Create Pedersen commitment
    Note over SDK: C = amount·G + blinding·H

    SDK->>PP: Generate funding proof
    PP-->>SDK: ZK Proof (balance ≥ min)

    SDK->>PP: Generate validity proof
    PP-->>SDK: ZK Proof (authorized)

    SDK->>S: Submit shielded intent
    Note over S: Sees: commitments<br/>Cannot see: amount, sender

    S->>S: Verify proofs
    S-->>SDK: Quote (based on output only)
    SDK-->>U: Display quote

    U->>SDK: Accept quote
    SDK->>S: Execute with proofs

    S->>Src: Lock via commitment
    Note over Src: Sender: HIDDEN<br/>Amount: HIDDEN

    S->>Dst: Send to stealth address
    Note over Dst: Recipient: UNLINKABLE<br/>Amount: HIDDEN

    S->>PP: Generate fulfillment proof
    PP-->>S: ZK Proof (correct execution)

    S-->>SDK: Fulfillment + proof
    SDK-->>U: Transaction complete
```

### Compliant Flow

Privacy with selective disclosure via viewing keys.

```mermaid
sequenceDiagram
    participant U as User
    participant SDK as SIP SDK
    participant A as Auditor
    participant S as Solver
    participant Src as Source Chain
    participant Dst as Destination Chain

    U->>SDK: Generate viewing key
    SDK-->>U: Viewing key (share with auditor)
    U->>A: Share viewing key

    U->>SDK: Create Intent (COMPLIANT)

    SDK->>SDK: Create commitments + stealth
    SDK->>SDK: Encrypt metadata with viewing key
    Note over SDK: Auditor can decrypt<br/>Public cannot

    SDK->>S: Submit compliant intent
    Note over S: Sees: commitments + encrypted metadata

    S-->>SDK: Quote
    U->>SDK: Accept
    SDK->>S: Execute

    S->>Src: Lock (hidden from public)
    S->>Dst: Release (hidden from public)
    S-->>SDK: Complete

    Note over A: Auditor View
    A->>SDK: Decrypt with viewing key
    SDK-->>A: Full transaction details
    Note over A: Sees: sender, amount, recipient
```

---

## Cryptographic Flows

### Stealth Address Generation

```mermaid
flowchart TB
    subgraph Recipient["Recipient (One-time setup)"]
        R1[Generate spending key sk]
        R2[Generate viewing key vk]
        R3[Compute SK = sk·G]
        R4[Compute VK = vk·G]
        R5[Publish meta-address: SK, VK]

        R1 --> R3
        R2 --> R4
        R3 --> R5
        R4 --> R5
    end

    subgraph Sender["Sender (Per payment)"]
        S1[Get recipient meta-address]
        S2[Generate ephemeral key r]
        S3[Compute R = r·G]
        S4[Compute shared secret: s = r·VK]
        S5[Compute stealth address: P = SK + hash_s_·G]
        S6[Send funds to P, publish R]

        S1 --> S2
        S2 --> S3
        S2 --> S4
        S4 --> S5
        S3 --> S6
        S5 --> S6
    end

    subgraph Recovery["Recipient Recovery"]
        RC1[Scan for R values]
        RC2[Compute s = vk·R]
        RC3[Compute P' = SK + hash_s_·G]
        RC4{P' == P?}
        RC5[Derive private key: p = sk + hash_s_]
        RC6[Skip - not for me]

        RC1 --> RC2
        RC2 --> RC3
        RC3 --> RC4
        RC4 -->|Yes| RC5
        RC4 -->|No| RC6
    end

    R5 -.-> S1
    S6 -.-> RC1
```

### Pedersen Commitment Scheme

```mermaid
flowchart LR
    subgraph Input
        V[Value: v]
        B[Blinding: r]
    end

    subgraph Generators
        G[Generator G]
        H[Generator H]
    end

    subgraph Computation
        VG[v · G]
        RH[r · H]
        C[C = vG + rH]
    end

    V --> VG
    G --> VG
    B --> RH
    H --> RH
    VG --> C
    RH --> C

    subgraph Properties
        P1[Hiding: Cannot extract v from C]
        P2[Binding: Cannot open to different v]
        P3[Homomorphic: C1 + C2 = C_v1+v2_]
    end

    C --> P1
    C --> P2
    C --> P3
```

### Proof Generation Pipeline

```mermaid
flowchart TB
    subgraph Inputs["Private Inputs"]
        I1[Balance]
        I2[Blinding factor]
        I3[Sender address]
        I4[Signature]
    end

    subgraph Public["Public Inputs"]
        P1[Commitment hash]
        P2[Minimum amount]
        P3[Intent hash]
    end

    subgraph Proofs["Proof Generation"]
        FP[Funding Proof<br/>balance ≥ minimum]
        VP[Validity Proof<br/>authorized sender]
        FFP[Fulfillment Proof<br/>correct execution]
    end

    subgraph Verification["On-chain Verification"]
        V1[Verify FP]
        V2[Verify VP]
        V3[Verify FFP]
        V4{All valid?}
        V5[Accept]
        V6[Reject]
    end

    I1 --> FP
    I2 --> FP
    P1 --> FP
    P2 --> FP

    I3 --> VP
    I4 --> VP
    P3 --> VP

    FP --> V1
    VP --> V2
    FFP --> V3

    V1 --> V4
    V2 --> V4
    V3 --> V4
    V4 -->|Yes| V5
    V4 -->|No| V6
```

---

## Privacy Comparison

### Before SIP: The ZachXBT Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    STANDARD CROSS-CHAIN SWAP                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Whale Wallet                         Exchange                  │
│   ┌─────────┐                         ┌─────────┐               │
│   │  0xABC  │ ──── 1000 ETH ────────▶ │  0xDEF  │               │
│   │ $50M+   │                         │ Kraken  │               │
│   └─────────┘                         └─────────┘               │
│       │                                                          │
│       │ 100% VISIBLE:                                           │
│       │ • Sender: 0xABC (known whale)                           │
│       │ • Amount: 1000 ETH ($3.5M)                              │
│       │ • Recipient: 0xDEF (exchange deposit)                   │
│       │ • Time: Block 18234567                                  │
│       ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    BLOCKCHAIN EXPLORER                    │   │
│   │  Anyone can see:                                          │   │
│   │  • Transaction history                                    │   │
│   │  • Balance changes                                        │   │
│   │  • Linked addresses                                       │   │
│   │  • Trading patterns                                       │   │
│   └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    ATTACK VECTORS                         │   │
│   │  ❌ Front-running: Bots see large trade incoming          │   │
│   │  ❌ Sandwich attacks: Profit from price impact            │   │
│   │  ❌ Social engineering: Target whale directly             │   │
│   │  ❌ Physical threats: Know wealth location                │   │
│   │  ❌ Tax surveillance: Complete transaction history        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### After SIP: Privacy Preserved

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHIELDED CROSS-CHAIN SWAP                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Whale Wallet                         Stealth Address          │
│   ┌─────────┐                         ┌─────────┐               │
│   │  0xABC  │ ──── C(amount) ───────▶ │  0x???  │               │
│   │ Hidden  │      commitment          │One-time │               │
│   └─────────┘                         └─────────┘               │
│       │                                                          │
│       │ WHAT OBSERVERS SEE:                                     │
│       │ • Sender: Pedersen commitment (random curve point)      │
│       │ • Amount: Pedersen commitment (hidden)                  │
│       │ • Recipient: Fresh stealth address (unlinkable)         │
│       │ • Proof: ZK proof of validity (no secrets revealed)     │
│       ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    BLOCKCHAIN EXPLORER                    │   │
│   │  Observer sees:                                           │   │
│   │  • Commitment: 0x7a3f...9c2d (meaningless)               │   │
│   │  • Proof: Valid ZK proof                                  │   │
│   │  • Recipient: 0xf8e2...1b4a (one-time, unlinkable)       │   │
│   │  • NO connection to whale wallet                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    PROTECTION PROVIDED                    │   │
│   │  ✅ No front-running: Amount unknown                      │   │
│   │  ✅ No sandwich attacks: Can't predict impact             │   │
│   │  ✅ No targeting: Identity hidden                         │   │
│   │  ✅ No wealth exposure: Balance unknown                   │   │
│   │  ✅ Compliance ready: Viewing key for authorized audit    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Side-by-Side Comparison

```mermaid
flowchart LR
    subgraph Before["❌ Without SIP"]
        B1[Sender: 0xABC...123]
        B2[Amount: 1000 ETH]
        B3[Recipient: 0xDEF...456]
        B4[Time: Visible]
        B5[History: Linkable]
    end

    subgraph After["✅ With SIP"]
        A1[Sender: C_hidden_]
        A2[Amount: C_hidden_]
        A3[Recipient: Stealth]
        A4[Time: Visible]
        A5[History: Unlinkable]
    end

    Before -.->|SIP Transform| After
```

---

## Integration Architecture

### Wallet Adapter Architecture

```mermaid
classDiagram
    class WalletAdapter {
        <<interface>>
        +chain: ChainId
        +address: string
        +connect()
        +disconnect()
        +signMessage(message)
        +signTransaction(tx)
    }

    class BaseWalletAdapter {
        #state: ConnectionState
        #eventHandlers: Map
        +emit(event)
        +on(event, handler)
    }

    class EthereumWalletAdapter {
        -provider: EIP1193Provider
        +switchChain(chainId)
        +addToken(token)
    }

    class SolanaWalletAdapter {
        -provider: SolanaProvider
        +signAllTransactions(txs)
    }

    class MockWalletAdapter {
        -privateKey: string
        +setBalance(amount)
    }

    WalletAdapter <|.. BaseWalletAdapter
    BaseWalletAdapter <|-- EthereumWalletAdapter
    BaseWalletAdapter <|-- SolanaWalletAdapter
    BaseWalletAdapter <|-- MockWalletAdapter
```

### Network Adapter Architecture

```mermaid
flowchart TB
    subgraph SDK["SIP SDK"]
        SIP[SIP Client]
    end

    subgraph Adapters["Network Adapters"]
        NA[NEARIntentsAdapter]
        OC[OneClickClient]
        ZS[ZcashShieldedService]
    end

    subgraph External["External Services"]
        NI[NEAR Intents API]
        OA[1Click API]
        ZN[Zcash Node]
    end

    SIP --> NA
    SIP --> OC
    SIP --> ZS

    NA --> NI
    OC --> OA
    ZS --> ZN

    NI --> |"Solvers"| Solvers[(Solver Network)]
    OA --> |"Swaps"| DEX[(DEX Aggregator)]
    ZN --> |"Shielded"| Orchard[(Orchard Pool)]
```

### Complete Integration Flow

```mermaid
flowchart TB
    subgraph App["Your Application"]
        UI[User Interface]
        Hook[useSIP Hook]
    end

    subgraph SDK["@sip-protocol/sdk"]
        SIP[SIP Client]
        IB[IntentBuilder]
        WA[Wallet Adapter]
        PP[Proof Provider]
    end

    subgraph Privacy["Privacy Layer"]
        ST[Stealth Address]
        CM[Commitment]
        VK[Viewing Key]
    end

    subgraph Network["Network Layer"]
        NA[NEAR Adapter]
        ZA[Zcash Adapter]
    end

    subgraph Chains["Blockchains"]
        NEAR[NEAR]
        ETH[Ethereum]
        SOL[Solana]
        ZEC[Zcash]
    end

    UI --> Hook
    Hook --> SIP
    SIP --> IB
    SIP --> WA
    SIP --> PP

    IB --> ST
    IB --> CM
    IB --> VK

    SIP --> NA
    SIP --> ZA

    NA --> NEAR
    NA --> ETH
    NA --> SOL
    ZA --> ZEC
```

---

## Quick Reference

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `SIP` | Main client, orchestrates all operations |
| `IntentBuilder` | Fluent API for creating intents |
| `WalletAdapter` | Chain-specific wallet interactions |
| `ProofProvider` | ZK proof generation |
| `NEARIntentsAdapter` | NEAR Intents API integration |
| `ZcashShieldedService` | Zcash shielded transactions |

### Data Flow Summary

```
User Input → IntentBuilder → Privacy Layer → Proofs → Network → Blockchain
                   ↓              ↓           ↓
              Validation    Commitments    Verification
                   ↓              ↓           ↓
              Type Safety   Stealth Addr   Settlement
```

---

*Part of the [SIP Protocol](https://github.com/sip-protocol) ecosystem*
