# CLAUDE.md - SIP Protocol

## Project
**SIP (Shielded Intents Protocol)** - Privacy layer for cross-chain transactions via NEAR Intents + Zcash.

## Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript (strict)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Monorepo**: pnpm + Turborepo
- **Crypto**: @noble/curves (secp256k1), @noble/hashes (SHA256)
- **Deploy**: Vercel

## Structure
```
apps/demo/          # Next.js demo app
packages/sdk/       # @sip-protocol/sdk - Core SDK
packages/types/     # @sip-protocol/types - TypeScript definitions
docs/              # Public documentation
.strategy/         # PRIVATE (gitignored) - hackathon strategy
```

## Key Concepts
- **ShieldedIntent**: Intent with hidden sender/amount, visible output requirements
- **Stealth Address**: One-time recipient address (EIP-5564 style, prevents linkability)
- **Privacy Levels**: `transparent` | `shielded` | `compliant`
- **Viewing Key**: Selective disclosure for audit/compliance
- **Pedersen Commitment**: value * G + blinding * H (hides amounts)

## Commands
```bash
pnpm install    # Install deps
pnpm dev        # Dev server (port 3000)
pnpm build      # Build all packages
pnpm lint       # Lint
pnpm typecheck  # Type check
```

## Core Files
- `packages/types/src/intent.ts` - ShieldedIntent interface, IntentStatus enum
- `packages/types/src/privacy.ts` - PrivacyLevel enum
- `packages/types/src/stealth.ts` - StealthMetaAddress, StealthAddress types
- `packages/sdk/src/stealth.ts` - Stealth address generation (secp256k1)
- `packages/sdk/src/intent.ts` - IntentBuilder, createShieldedIntent
- `packages/sdk/src/privacy.ts` - ViewingKey generation, encryption
- `packages/sdk/src/crypto.ts` - Pedersen commitments, mock ZK proofs
- `packages/sdk/src/sip.ts` - Main SIP client class
- `apps/demo/src/app/page.tsx` - Main swap interface
- `apps/demo/src/components/comparison-view.tsx` - Vulnerability demo

## APIs
- **NEAR Intents**: 1Click API for swap execution (TODO: integrate)
- **Zcash**: Testnet RPC for shielded transactions (TODO: integrate)

## Code Style
- 2-space indent, no semicolons
- Explicit types for public APIs
- JSDoc for public functions
- Use enum values (PrivacyLevel.SHIELDED) not string literals

## Progress
- [x] Day 1: Foundation (types, SDK, demo UI)
- [ ] Day 2: Core Protocol (NEAR 1Click, mock proofs, flow)
- [ ] Day 3: Integration (end-to-end, all privacy modes)
- [ ] Day 4: Polish (UI, docs, comparison demo)
- [ ] Day 5: Ship (video, pitch, submit)

## Private Strategy
Hackathon tactics in `.strategy/` - NEVER commit. Reference: `~/.claude/sip-protocol/` for backup.
