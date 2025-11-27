# CLAUDE.md - SIP Protocol Core

**Repository:** https://github.com/sip-protocol/sip-protocol
**Website:** https://sip-protocol.org
**Purpose:** Privacy layer for cross-chain transactions via NEAR Intents + Zcash

---

## What is SIP?

Shielded Intents Protocol enables private cross-chain swaps. One toggle to shield sender, amount, and recipient using stealth addresses, Pedersen commitments, and viewing keys for compliance.

**Status:** M5 Complete | 741/741 tests passing | Ready for Launch

---

## Architecture

```
User Intent → Privacy Layer (SIP) → NEAR Intents → Multi-chain Settlement

┌─────────────────────────────────────────────────────────────┐
│  PRIVACY LAYER (SIP)          ← We build this               │
│  • Pedersen Commitments  • Stealth Addresses                │
│  • Viewing Keys          • Shielded Intents                 │
├─────────────────────────────────────────────────────────────┤
│  SETTLEMENT LAYER             ← We leverage this            │
│  • NEAR Intents         • Chain Signatures                  │
├─────────────────────────────────────────────────────────────┤
│  BLOCKCHAIN LAYER             ← We connect to this          │
│  • NEAR  • Ethereum  • Solana  • Bitcoin  • More...         │
└─────────────────────────────────────────────────────────────┘
```

**Key Files:**
- `packages/sdk/src/stealth.ts` - Stealth address generation (EIP-5564, secp256k1)
- `packages/sdk/src/crypto.ts` - Pedersen commitments, cryptographic primitives
- `packages/sdk/src/privacy.ts` - Viewing keys, XChaCha20-Poly1305 encryption
- `packages/sdk/src/intent.ts` - IntentBuilder, createShieldedIntent
- `packages/sdk/src/sip.ts` - Main SIP client class
- `packages/sdk/src/proofs/` - ProofProvider interface, Mock/Noir providers
- `packages/sdk/src/adapters/` - NEAR Intents, wallet adapters

---

## Current Features

| Feature | Status | Notes |
|---------|--------|-------|
| Stealth addresses | ✅ | EIP-5564 style, secp256k1 |
| Pedersen commitments | ✅ | Homomorphic, hiding amounts |
| Viewing keys | ✅ | Selective disclosure for compliance |
| Privacy levels | ✅ | transparent, shielded, compliant |
| NEAR Intents adapter | ✅ | 1Click API integration |
| Zcash RPC client | ✅ | Shielded transaction support |
| Wallet adapters | ✅ | Abstract interface + Solana/Ethereum |
| E2E test suite | ✅ | 128 tests covering all flows |
| ZK proof specs | ✅ | Funding, Validity, Fulfillment |
| Noir circuits | 🔲 | Stubs ready, implementation planned |

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Run all tests (741 tests, ~20s)
pnpm test -- --run

# Run E2E tests only (128 tests)
pnpm test -- tests/e2e --run

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build all packages
pnpm build
```

**Note:** Demo application is in [sip-protocol/sip-website](https://github.com/sip-protocol/sip-website).

---

## Test Suite (741 tests)

| Suite | Count | Location |
|-------|-------|----------|
| Crypto unit tests | ~50 | `packages/sdk/tests/crypto.test.ts` |
| Stealth address tests | ~40 | `packages/sdk/tests/stealth.test.ts` |
| Privacy/encryption tests | ~30 | `packages/sdk/tests/privacy.test.ts` |
| Validation tests | ~60 | `packages/sdk/tests/validation.test.ts` |
| Integration tests | ~100 | `packages/sdk/tests/integration/` |
| E2E tests | 128 | `packages/sdk/tests/e2e/` |
| Benchmarks | ~20 | `packages/sdk/tests/benchmarks/` |

**E2E tests cover:** Cross-chain swaps, privacy verification, compliance flows, error scenarios, performance metrics.

---

## Critical Design Decisions

### 1. Application Layer (Not Infrastructure)
- **Complement, don't compete** with NEAR Intents, Zcash
- Leverage existing chain infrastructure
- Focus on privacy UX, not consensus

### 2. Privacy Levels
```typescript
'transparent' → No privacy, public transaction
'shielded'    → Full privacy, hidden sender/amount/recipient
'compliant'   → Privacy + viewing key for auditors
```

### 3. Stealth Address Format
```
sip:<chain>:<spendingKey>:<viewingKey>
Example: sip:solana:0x02abc...123:0x03def...456
```

### 4. Viewing Key Hash Computation
```typescript
// Hash raw key bytes, not hex string
const keyBytes = hexToBytes(viewingKey.slice(2))
const hash = sha256(keyBytes)
```

### 5. Commitment Structure
```typescript
interface Commitment {
  value: HexString      // The commitment point
  blindingFactor: HexString  // Random blinding
}
```

---

## Strategic Direction

**Positioning:** Application layer for NEAR Intents ecosystem
**Target users:** DAOs, institutions needing compliant privacy
**Expansion:** Horizontal (payments, treasury) before vertical (more chains)

See `.strategy/ROADMAP-INTERNAL.md` for detailed strategy (private).

---

## AI Assistant Guidelines

### ✅ DO:
- Run `pnpm test -- --run` after code changes
- Reference file:line when discussing code (e.g., `stealth.ts:123`)
- Update this file when architecture changes
- Use existing patterns from codebase
- Check E2E tests for integration changes

### ❌ DON'T:
- Create .md files without surveying existing structure
- Use `echo` or bash for communication (output directly)
- Skip validation in public APIs
- Change commitment/stealth formats without updating all usages
- Commit anything in `.strategy/` folder

---

## Project Structure

```
sip-protocol/sip-protocol     # This repo (core SDK monorepo)
├── packages/
│   ├── sdk/                  # @sip-protocol/sdk - Core SDK
│   │   ├── src/
│   │   │   ├── adapters/     # NEAR, wallet adapters
│   │   │   ├── proofs/       # ZK proof providers
│   │   │   ├── stealth.ts    # Stealth addresses
│   │   │   ├── crypto.ts     # Commitments, hashing
│   │   │   ├── privacy.ts    # Viewing keys, encryption
│   │   │   ├── intent.ts     # Intent builder
│   │   │   └── sip.ts        # Main client
│   │   └── tests/            # Test suites
│   └── types/                # @sip-protocol/types
├── docs/                     # Documentation
└── .strategy/                # Private strategy (gitignored)
```

---

## Related Repositories

| Repo | Purpose | URL | Status |
|------|---------|-----|--------|
| `sip-protocol/sip-protocol` | Core SDK + Types (this repo) | - | ✅ Active |
| `sip-protocol/sip-website` | Marketing site + Demo app | sip-protocol.org | ✅ Active |
| `sip-protocol/docs-sip` | Documentation (Astro + Starlight) | docs.sip-protocol.org | 🔲 M6 |
| `sip-protocol/.github` | Org-wide configs, profile | - | 📋 Planned |
| `sip-protocol/circuits` | Noir ZK circuits | - | 📋 M8 |

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **ShieldedIntent** | Intent with hidden sender/amount, visible output |
| **Stealth Address** | One-time recipient address (prevents linkability) |
| **Viewing Key** | Selective disclosure key for compliance/audit |
| **Pedersen Commitment** | `value * G + blinding * H` (hides amounts) |
| **Privacy Level** | transparent \| shielded \| compliant |

---

## Milestones

| Milestone | Status | Focus |
|-----------|--------|-------|
| M1: Architecture & Specification | ✅ Complete | Specs, proofs design |
| M2: Cryptographic Core | ✅ Complete | Real crypto primitives |
| M3: SDK Production | ✅ Complete | Production SDK |
| M4: Network Integration | ✅ Complete | NEAR, Zcash, wallets |
| M5: Documentation & Launch | ✅ Complete | Docs, whitepaper |
| M6: Launch & Publish | 🔲 In Progress | npm publish, docs site |
| M7: Real Demo Integration | 🔲 Planned | Live demo with real txs |
| M8: Production Hardening | 🔲 Planned | Noir circuits, security |
| M9: Horizontal Expansion | 🔲 Future | New use cases |

---

## Tech Stack

- **Language:** TypeScript (strict)
- **Monorepo:** pnpm + Turborepo
- **Crypto:** @noble/curves (secp256k1), @noble/hashes, @noble/ciphers
- **Testing:** Vitest
- **CI/CD:** GitHub Actions
- **Publish:** npm registry

---

## Code Style

- 2-space indent, no semicolons
- Explicit types for public APIs
- JSDoc for public functions
- Use enum values (`PrivacyLevel.SHIELDED`) not string literals
- Validation at system boundaries

---

**Last Updated:** November 27, 2025
**Status:** M5 Complete - Ready for Launch
