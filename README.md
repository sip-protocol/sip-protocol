<div align="center">

<pre>
███████╗ ██╗ ██████╗
██╔════╝ ██║ ██╔══██╗
███████╗ ██║ ██████╔╝
╚════██║ ██║ ██╔═══╝
███████║ ██║ ██║
╚══════╝ ╚═╝ ╚═╝
</pre>

# Shielded Intents Protocol

> **Privacy is not a feature. It's a right.**

**The privacy layer for cross-chain transactions via NEAR Intents + Zcash**

*One toggle to shield them all • Stealth addresses • Zero-knowledge proofs • Selective disclosure • Multi-chain support*

[![CI](https://github.com/sip-protocol/sip-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/sip-protocol/sip-protocol/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sip-protocol/sip-protocol/graph/badge.svg)](https://codecov.io/gh/sip-protocol/sip-protocol)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![NEAR](https://img.shields.io/badge/NEAR-Intents-00C08B?logo=near&logoColor=white)](https://near.org/)
[![Zcash](https://img.shields.io/badge/Zcash-Shielded-F4B728?logo=zcash&logoColor=black)](https://z.cash/)
[![Circuits](https://img.shields.io/badge/Noir-Circuits-8B5CF6?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=)](docs/specs/CIRCUITS.md)
[![pnpm](https://img.shields.io/badge/pnpm-Monorepo-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**🏆 Winner — [Zypherpunk Hackathon](https://zypherpunk.xyz) ($6,500: NEAR $4,000 + Tachyon $500 + pumpfun $2,000) | #9 of 93 | 3 Tracks**

</div>

---

## Table of Contents

- [What is SIP?](#-what-is-sip)
- [Quick Preview](#-quick-preview)
- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Key Features](#-key-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Architecture](#%EF%B8%8F-architecture)
- [Packages](#-packages)
- [Infrastructure](#-infrastructure)
- [Roadmap](#-roadmap)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Development](#-development)
- [Contributing](#-contributing)
- [Security](#-security)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🛡️ What is SIP?

SIP (Shielded Intents Protocol) brings **HTTPS-level privacy** to cross-chain transactions. Just as HTTPS encrypted the web without changing how users browse, SIP adds privacy to blockchain intents without changing how users swap.

```
HTTP    → HTTPS   (Web privacy upgrade)
Intents → SIP     (Blockchain privacy upgrade)
```

**Stop exposing your financial activity. Start swapping privately.**

---

## 🎥 Quick Preview

### The Privacy Upgrade

<table>
<tr>
<th width="50%">❌ Public Intent (Everyone sees everything)</th>
<th width="50%">✅ Shielded Intent (Solvers see only what they need)</th>
</tr>
<tr>
<td valign="top">

```typescript
{
  from: "0x1234...",
  inputAmount: 10,
  inputToken: "SOL",
  outputToken: "ETH",
  recipient: "0x5678..."
}
```

**Exposed:**
- 🔴 Your wallet address
- 🔴 Exact amounts
- 🔴 Recipient address
- 🔴 Full transaction history

</td>
<td valign="top">

```typescript
{
  intentId: "abc123",
  outputToken: "ETH",
  minOutput: 0.004,
  inputCommitment: "0xabc...",
  recipientStealth: "0xdef...",
  proof: "0x123..."
}
```

**Protected:**
- ✅ Sender hidden (commitment)
- ✅ Amount hidden (ZK proof)
- ✅ Recipient hidden (stealth address)
- ✅ Unlinkable transactions

</td>
</tr>
</table>

**Result:** Solvers can fulfill your intent without knowing who you are or where the funds are going.

---

## 🎯 The Problem

Current cross-chain solutions expose **everything** about your transactions. This isn't just inconvenient — it's a security risk.

### What's Exposed

| Data Point | Visibility | Risk |
|------------|------------|------|
| **Sender Address** | Public | Targeted phishing, social engineering |
| **Transaction Amount** | Public | Front-running, MEV extraction |
| **Recipient Address** | Public | Surveillance, address clustering |
| **Transaction History** | Permanent | Financial profiling, discrimination |

### Real-World Consequences

| Attack Vector | How It Works | Impact |
|---------------|--------------|--------|
| **Front-Running** | Bots see your pending swap, execute first | You get worse price |
| **MEV Extraction** | Validators reorder txs to profit | Value extracted from you |
| **Phishing** | Attackers identify high-value wallets | Direct theft attempts |
| **Surveillance** | Exchanges/govts track all activity | Privacy violation |
| **Price Discrimination** | Services see your balance | Higher fees for wealthy users |

**The blockchain is a public ledger. Without privacy, it's a surveillance system.**

---

## 💡 The Solution

SIP wraps cross-chain intents in a **cryptographic privacy layer** using battle-tested technology from Zcash and cutting-edge stealth address schemes.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER                                    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      SIP SDK                             │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐    │    │
│  │  │ Privacy     │ │ Stealth     │ │ ZK Proof        │    │    │
│  │  │ Toggle      │ │ Address Gen │ │ Generation      │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘    │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SHIELDED INTENT LAYER                       │    │
│  │  • Pedersen commitments (hide amounts)                   │    │
│  │  • Stealth addresses (hide recipients)                   │    │
│  │  • ZK proofs (prove validity without revealing data)     │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 NEAR INTENTS ROUTER                      │    │
│  │  • Intent matching                                       │    │
│  │  • Solver network                                        │    │
│  │  • Cross-chain execution                                 │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│            ┌───────────────┼───────────────┐                    │
│            ▼               ▼               ▼                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │    Solana    │ │    Zcash     │ │   Ethereum   │            │
│  │              │ │  (Privacy    │ │              │            │
│  │              │ │   Backbone)  │ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Core Mechanisms

| Mechanism | Purpose | Technology |
|-----------|---------|------------|
| **Pedersen Commitments** | Hide transaction amounts | `value * G + blinding * H` |
| **Stealth Addresses** | One-time recipient addresses | EIP-5564 style, secp256k1 |
| **ZK Proofs** | Prove validity without revealing data | Zcash proving system |
| **Viewing Keys** | Selective disclosure for compliance | Derived key pairs |

---

## ✨ Key Features

### 🔒 **One-Click Privacy**
Toggle between public and shielded modes with a single switch. No complex setup, no key management headaches.

### 🌐 **Multi-Chain Support**
Works across Solana, Ethereum, NEAR, and more. Privacy shouldn't be chain-specific.

### 📊 **Three Privacy Levels**

| Level | Description | Use Case |
|-------|-------------|----------|
| `TRANSPARENT` | Standard public transaction | When privacy isn't needed |
| `SHIELDED` | Full privacy via Zcash pool | Personal transactions |
| `COMPLIANT` | Privacy + viewing key | Institutional/regulatory |

### 👻 **Stealth Addresses**
Every transaction uses a fresh one-time address. No address reuse, no transaction linkability.

### 🔑 **Viewing Keys**
Selective disclosure for audits and compliance. Prove your transaction history without exposing it to everyone.

### 🛡️ **MEV Protection**
Hidden amounts and recipients mean front-runners can't extract value from your trades.

### ⚡ **Zero UX Friction**
Same swap interface you're used to. Privacy happens under the hood.

---

## 📦 Installation

```bash
# npm
npm install @sip-protocol/sdk

# pnpm
pnpm add @sip-protocol/sdk

# yarn
yarn add @sip-protocol/sdk
```

---

## 🚀 Quick Start

### 1. Initialize the SDK

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk';

const sip = new SIP({
  network: 'mainnet', // NEAR Intents is mainnet-only (no testnet)
});
```

> **Note:** NEAR Intents (1Click API) operates on **mainnet only**. There is no testnet deployment.
> For testing: use `MockSolver` for unit tests, or small mainnet amounts ($5-10) for integration testing.

### 2. Create a Shielded Intent

```typescript
const intent = await sip.createIntent({
  input: {
    chain: 'solana',
    token: 'SOL',
    amount: 10,
  },
  output: {
    chain: 'ethereum',
    token: 'ETH',
  },
  privacy: PrivacyLevel.SHIELDED,
});
```

### 3. Get Quotes & Execute

```typescript
// Solvers compete to fill your intent
const quotes = await intent.getQuotes();

// Execute with the best quote
const result = await intent.execute(quotes[0]);

console.log(result.status);  // 'fulfilled'
console.log(result.txHash);  // null (shielded!)
console.log(result.proof);   // ZK proof of execution
```

### 4. Choose Your Privacy Level

```typescript
// Public mode (standard intent, no privacy)
privacy: PrivacyLevel.TRANSPARENT

// Full privacy (via Zcash shielded pool)
privacy: PrivacyLevel.SHIELDED

// Privacy + audit capability (for institutions)
privacy: PrivacyLevel.COMPLIANT,
viewingKey: generateViewingKey()
```

---

## 🏗️ Architecture

> **Full architecture documentation**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
>
> **Design decisions**: [Why Noir over Halo2?](docs/decisions/NOIR-VS-HALO2.md)

### Component Overview

```
sip-protocol/
├── examples/                  # Integration examples
│   ├── private-swap/          # Private swap example
│   ├── private-payment/       # Stealth payment example
│   └── compliance/            # Viewing key example
├── packages/
│   ├── sdk/                  # @sip-protocol/sdk
│   │   ├── src/stealth.ts    # Stealth address generation
│   │   ├── src/intent.ts     # Intent builder
│   │   ├── src/privacy.ts    # Viewing key management
│   │   ├── src/crypto.ts     # Pedersen commitments
│   │   └── src/sip.ts        # Main client class
│   └── types/                # @sip-protocol/types
│       ├── src/intent.ts     # ShieldedIntent interface
│       ├── src/privacy.ts    # PrivacyLevel enum
│       └── src/stealth.ts    # Stealth address types
└── docs/                     # Documentation
```

### Data Flow

```
User Input → Privacy Layer → Intent Creation → Solver Network → Execution
     │              │              │                 │             │
     │              ▼              │                 │             │
     │       ┌──────────┐         │                 │             │
     │       │ Generate │         │                 │             │
     │       │ Stealth  │         │                 │             │
     │       │ Address  │         │                 │             │
     │       └──────────┘         │                 │             │
     │              │              │                 │             │
     │              ▼              │                 │             │
     │       ┌──────────┐         │                 │             │
     │       │ Create   │         │                 │             │
     │       │ Pedersen │         │                 │             │
     │       │Commitment│         │                 │             │
     │       └──────────┘         │                 │             │
     │              │              │                 │             │
     │              ▼              │                 │             │
     │       ┌──────────┐         │                 │             │
     │       │ Generate │         │                 │             │
     │       │ ZK Proof │         │                 │             │
     │       └──────────┘         │                 │             │
     │              │              │                 │             │
     └──────────────┴──────────────┴─────────────────┴─────────────┘
```

---

## 📚 Packages

| Package | Version | Description | Tests |
|---------|---------|-------------|-------|
| [`@sip-protocol/sdk`](packages/sdk) | 0.7.3 | Core SDK for shielded intents | 6,603 |
| [`@sip-protocol/types`](packages/types) | 0.2.1 | TypeScript type definitions | - |
| [`@sip-protocol/react`](packages/react) | 0.1.0 | React hooks for SIP | 82 |
| [`@sip-protocol/cli`](packages/cli) | 0.2.0 | CLI tool | 10 |
| [`@sip-protocol/api`](packages/api) | 0.1.0 | REST API wrapper | 18 |
| [`@sip-protocol/react-native`](packages/react-native) | 0.1.1 | iOS/Android SDK | 10 |
| [`circuits`](packages/circuits) | - | Noir ZK circuits | - |

**On-chain Programs:**
| Program | Description |
|---------|-------------|
| [`sip-privacy`](programs/sip-privacy) | Solana Anchor program |
| [`sip-ethereum`](contracts/sip-ethereum) | Ethereum Foundry contracts |

**Examples:** 11 integration examples in [`examples/`](examples/)

---

## 🔌 Infrastructure

SIP is **infrastructure-agnostic** — use your preferred RPC providers without changing your application code.

### Solana RPC Providers

| Provider | Best For | Real-time | Special Features |
|----------|----------|-----------|------------------|
| **[Helius](https://helius.dev)** | Production apps | Webhooks | DAS API, rich metadata |
| **[QuickNode](https://quicknode.com)** | Enterprise | Yellowstone gRPC | Global edge network |
| **[Triton](https://triton.one)** | DeFi/Trading | Dragon's Mouth gRPC | ~400ms latency advantage |
| **Generic** | Development | WebSocket | No API key required |

```typescript
import { createProvider } from '@sip-protocol/sdk'

// Same API, different backends — your choice
const provider = createProvider('quicknode', { endpoint: process.env.QUICKNODE_ENDPOINT })
// or: createProvider('helius', { apiKey: process.env.HELIUS_API_KEY })
// or: createProvider('triton', { xToken: process.env.TRITON_TOKEN })
// or: createProvider('generic', { connection })

// All providers work identically
const assets = await provider.getAssetsByOwner('7xK9...')
```

### Why Provider-Agnostic?

- **No vendor lock-in** — switch providers without code changes
- **Best-of-breed** — use Helius for DAS, QuickNode for gRPC, mix and match
- **Open-source tooling** — unified interface benefits the entire ecosystem
- **Resilience** — easy failover between providers

See [SDK README](packages/sdk/README.md) for detailed provider documentation.

---

## 🗺️ Roadmap

See [ROADMAP.md](ROADMAP.md) for detailed milestone tracking.

### Phase 1-3: Foundation ✅ **Complete** (M1-M15)

- ✅ Core SDK with stealth addresses, Pedersen commitments, viewing keys
- ✅ Multi-chain support (15+ chains including Solana, Ethereum, NEAR)
- ✅ ZK proof system (Noir circuits, browser proving)
- ✅ NEAR Intents + Zcash integration
- ✅ React, CLI, API packages
- ✅ 6,661+ tests

### Phase 4: Same-Chain Expansion 🎯 **Active** (M16-M18)

- ✅ M16: Narrative capture (content, community, positioning)
- ✅ M17: Solana same-chain privacy (Complete - Jan 2026)
- 🎯 M18: Ethereum same-chain privacy (Active)

### Phase 5: Technical Moat 🔲 **Planned** (M19-M22)

- 🔲 M19: Proof composition (Zcash + Mina)
- 🔲 M20: Multi-language SDK (Python, Rust, Go)
- 🔲 M21: SIP-EIP standard proposal
- 🔲 M22: Institutional custody integration

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 14 (App Router) | Reference application |
| **Language** | TypeScript (strict mode) | Type safety |
| **Styling** | Tailwind CSS + shadcn/ui | UI components |
| **State** | Zustand | Client state management |
| **Monorepo** | pnpm + Turborepo | Package management |
| **Cryptography** | @noble/curves, @noble/hashes | Stealth addresses, commitments |
| **Deployment** | Vercel | Hosting |

---

## 💻 Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone the repository
git clone https://github.com/sip-protocol/sip-protocol.git
cd sip-protocol

# Install dependencies
pnpm install

# Start development
pnpm dev
```

### Commands

```bash
pnpm dev              # Start development server
pnpm build            # Build all packages
pnpm test -- --run    # Run all tests (6,661+)
pnpm lint             # Lint code
pnpm typecheck        # Type check
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- Protocol improvements
- SDK features
- Documentation
- Security audits
- Chain integrations

---

## 🔐 Security

SIP is experimental software. Use at your own risk.

### Threat Model

See our comprehensive [Threat Model](docs/security/THREAT-MODEL.md) for:
- Identified attack vectors and mitigations
- Trust assumptions and security boundaries
- Severity ratings for each threat category
- Security recommendations for users, integrators, and operators

### Zcash RPC Security

**CRITICAL:** Always use HTTPS/TLS when connecting to Zcash nodes in production.

The Zcash RPC client uses HTTP Basic Authentication, which transmits credentials in base64-encoded cleartext. Without TLS/HTTPS:
- RPC credentials are vulnerable to network sniffing
- All transaction data can be intercepted
- Man-in-the-middle attacks are possible

**Production Requirements:**
- ✅ Use `https://` URLs for Zcash RPC endpoints
- ✅ Configure zcashd with valid TLS certificates
- ✅ Store credentials in secure environment variables
- ✅ Use network-level access controls (firewall rules, VPCs)
- ❌ NEVER use HTTP in production
- ❌ NEVER hardcode credentials in source code

**Example:**
```typescript
// ✅ Production (HTTPS)
const client = new ZcashRPCClient({
  host: 'https://your-node.com',
  port: 8232,
  username: process.env.ZCASH_RPC_USER,
  password: process.env.ZCASH_RPC_PASS,
})

// ⚠️ Development only (HTTP on localhost)
const testClient = new ZcashRPCClient({
  host: '127.0.0.1',
  port: 18232,
  username: 'test',
  password: 'test',
  testnet: true,
})
```

### Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
- Email: security@sip-protocol.xyz
- Do NOT open public issues for security vulnerabilities

---

## 📄 License

[MIT License](LICENSE) — see LICENSE file for details.

---

## 🙏 Acknowledgments

SIP builds on the shoulders of giants:

- [Zcash](https://z.cash) — Privacy-preserving cryptocurrency and proving system
- [NEAR Protocol](https://near.org) — Intent-centric blockchain infrastructure
- [EIP-5564](https://eips.ethereum.org/EIPS/eip-5564) — Stealth address standard
- [@noble/curves](https://github.com/paulmillr/noble-curves) — Audited cryptographic primitives
- The broader privacy and cryptography research community

---

<div align="center">

**🏆 Winner — [Zypherpunk Hackathon](https://zypherpunk.xyz) ($6,500) | #9 of 93 | 3 Tracks**

*Privacy is not a feature. It's a right.*

[Documentation](docs/) · [Examples](examples/) · [Report Bug](https://github.com/RECTOR-LABS/sip-protocol/issues)

</div>
