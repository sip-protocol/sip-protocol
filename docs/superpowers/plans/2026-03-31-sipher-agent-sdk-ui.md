# Sipher Agent + SDK + UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sipher's Mode 1 (Human Plug) — a conversational privacy agent powered by Pi SDK, with @sipher/sdk for vault operations, and a cypherpunk web chat UI. Users connect wallets, deposit into the vault, and interact via natural language.

**Architecture:** Pi SDK (pi-ai + pi-agent-core) agent with 6 SIP privacy tools that call @sipher/sdk, which wraps the sipher_vault program + @sip-protocol/sdk. Web chat UI is a pi-web-ui fork with custom Sipher-branded components. Single process serves agent + existing REST API + web UI on port 5006.

**Tech Stack:** TypeScript, Pi SDK (pi-ai, pi-agent-core, pi-web-ui), @sip-protocol/sdk, @solana/web3.js, Vitest

**Spec Reference:** `docs/superpowers/specs/2026-03-30-sipher-vision-design.md` — Sections 3, 4, 6, 19, 23, 27 (C1, M14)

**Dependency:** Plan A (sipher_vault program) must be deployed to devnet before Task 5.

**Phase 1 Scope (per post-roast C1):** 6 core tools (deposit, send, refund, balance, scan, claim), 4 UI components (ChatContainer, WalletBar, TextMessage, ConfirmationPrompt), hybrid UX (buttons for deterministic ops, agent for complex).

---

## File Structure

```
sipher/
├── packages/
│   ├── sdk/                          ← @sipher/sdk
│   │   ├── src/
│   │   │   ├── index.ts              ← Public API exports
│   │   │   ├── vault.ts              ← Vault operations (deposit, refund, balance)
│   │   │   ├── privacy.ts            ← Privacy operations (send, scan, claim)
│   │   │   ├── types.ts              ← Shared types
│   │   │   └── config.ts             ← Program IDs, RPC config
│   │   ├── tests/
│   │   │   ├── vault.test.ts
│   │   │   └── privacy.test.ts
│   │   └── package.json
│   │
│   └── agent/                        ← Mode 1: Human Plug
│       ├── src/
│       │   ├── index.ts              ← Agent entrypoint + Express server
│       │   ├── agent.ts              ← Pi SDK agent setup + system prompt
│       │   ├── tools/                ← SIP tool definitions
│       │   │   ├── deposit.ts
│       │   │   ├── send.ts
│       │   │   ├── refund.ts
│       │   │   ├── balance.ts
│       │   │   ├── scan.ts
│       │   │   └── claim.ts
│       │   └── adapters/
│       │       └── web.ts            ← WebSocket adapter for pi-web-ui
│       ├── tests/
│       │   ├── tools.test.ts
│       │   └── agent.test.ts
│       └── package.json
│
├── app/                              ← Web chat UI (pi-web-ui fork)
│   ├── src/
│   │   ├── App.tsx                   ← Main app with wallet provider
│   │   ├── components/
│   │   │   ├── ChatContainer.tsx     ← Message stream
│   │   │   ├── WalletBar.tsx         ← Connected wallet + vault balance
│   │   │   ├── TextMessage.tsx       ← Chat bubble (user + agent)
│   │   │   ├── ConfirmationPrompt.tsx ← TX confirmation with sign button
│   │   │   └── QuickActions.tsx      ← Buttons: Deposit, Send, Refund...
│   │   └── styles/
│   │       └── theme.css             ← Cypherpunk dark theme
│   ├── index.html
│   └── package.json
│
└── tests/
    └── e2e/
        └── vault-flow.test.ts        ← Full flow: connect → deposit → send → refund
```

---

### Task 1: Initialize Monorepo & Install Pi SDK

**Files:**
- Modify: `package.json` (root — add workspace config)
- Create: `packages/sdk/package.json`
- Create: `packages/agent/package.json`
- Create: `app/package.json`

- [ ] **Step 1: Set up pnpm workspace**

```yaml
# pnpm-workspace.yaml (in sipher repo root)
packages:
  - 'packages/*'
  - 'app'
```

- [ ] **Step 2: Create @sipher/sdk package.json**

```json
{
  "name": "@sipher/sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@sip-protocol/sdk": "workspace:*",
    "@solana/web3.js": "^1.98.0",
    "@coral-xyz/anchor": "^0.30.1",
    "@solana/spl-token": "^0.4.9"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create agent package.json**

```json
{
  "name": "@sipher/agent",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@sipher/sdk": "workspace:*",
    "@mariozechner/pi-ai": "latest",
    "@mariozechner/pi-agent-core": "latest",
    "express": "^5.0.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0",
    "@types/express": "^5.0.0",
    "@types/ws": "^8.5.0"
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 5: Verify Pi SDK imports work**

```typescript
// Quick smoke test
import { getModel } from '@mariozechner/pi-ai'
import { Agent } from '@mariozechner/pi-agent-core'
console.log('Pi SDK imported successfully')
```

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml packages/ app/
git commit -m "feat: scaffold sipher monorepo with sdk, agent, app packages"
```

---

### Task 2: Build @sipher/sdk Core

**Files:**
- Create: `packages/sdk/src/types.ts`
- Create: `packages/sdk/src/config.ts`
- Create: `packages/sdk/src/vault.ts`
- Create: `packages/sdk/src/privacy.ts`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/tests/vault.test.ts`

- [ ] **Step 1: Write types**

```typescript
// packages/sdk/src/types.ts
import { PublicKey } from '@solana/web3.js'

export interface VaultBalance {
  mint: PublicKey
  balance: bigint
  lockedAmount: bigint
  cumulativeVolume: bigint
  lastDepositAt: number
}

export interface DepositResult {
  txSignature: string
  amount: bigint
  newBalance: bigint
}

export interface WithdrawResult {
  txSignature: string
  amount: bigint
  fee: bigint
  stealthAddress: PublicKey
}

export interface RefundResult {
  txSignature: string
  refundedAmount: bigint
}

export interface ScanResult {
  found: number
  payments: StealthPayment[]
}

export interface StealthPayment {
  transferRecord: PublicKey
  amount: bigint
  mint: PublicKey
  ephemeralPubkey: Uint8Array
  viewingKeyHash: Uint8Array
  timestamp: number
  claimed: boolean
}
```

- [ ] **Step 2: Write config**

```typescript
// packages/sdk/src/config.ts
import { PublicKey } from '@solana/web3.js'

export interface SipherConfig {
  vaultProgramId: PublicKey
  sipPrivacyProgramId: PublicKey
  rpcUrl: string
}

export const DEVNET_CONFIG: SipherConfig = {
  vaultProgramId: new PublicKey('11111111111111111111111111111111'), // replace after deploy
  sipPrivacyProgramId: new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'),
  rpcUrl: 'https://api.devnet.solana.com',
}

export const MAINNET_CONFIG: SipherConfig = {
  vaultProgramId: new PublicKey('11111111111111111111111111111111'), // replace after deploy
  sipPrivacyProgramId: new PublicKey('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'),
  rpcUrl: 'https://mainnet.helius-rpc.com/?api-key=',
}
```

- [ ] **Step 3: Write vault operations**

```typescript
// packages/sdk/src/vault.ts
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { SipherConfig, DEVNET_CONFIG } from './config'
import { VaultBalance, DepositResult, RefundResult } from './types'

const VAULT_CONFIG_SEED = Buffer.from('vault_config')
const DEPOSIT_RECORD_SEED = Buffer.from('deposit_record')

export function getVaultConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], programId)
}

export function getDepositRecordPDA(
  depositor: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DEPOSIT_RECORD_SEED, depositor.toBuffer(), tokenMint.toBuffer()],
    programId,
  )
}

export async function getVaultBalance(
  connection: Connection,
  depositor: PublicKey,
  tokenMint: PublicKey,
  config: SipherConfig = DEVNET_CONFIG,
): Promise<VaultBalance | null> {
  const [pda] = getDepositRecordPDA(depositor, tokenMint, config.vaultProgramId)
  const account = await connection.getAccountInfo(pda)
  if (!account) return null

  // Deserialize Anchor account (skip 8-byte discriminator)
  // Full deserialization uses Anchor's IDL — simplified here
  return {
    mint: tokenMint,
    balance: BigInt(0), // TODO: deserialize from account data
    lockedAmount: BigInt(0),
    cumulativeVolume: BigInt(0),
    lastDepositAt: 0,
  }
}

// deposit() and refund() build transactions for wallet signing
// They return unsigned transactions — the web UI handles signing
export async function buildDepositTx(
  connection: Connection,
  depositor: PublicKey,
  tokenMint: PublicKey,
  amount: bigint,
  config: SipherConfig = DEVNET_CONFIG,
): Promise<Transaction> {
  // Build Anchor instruction for deposit
  // This will use the generated IDL types from anchor build
  const tx = new Transaction()
  // TODO: Add deposit instruction using Anchor program
  return tx
}

export async function buildRefundTx(
  connection: Connection,
  depositor: PublicKey,
  tokenMint: PublicKey,
  config: SipherConfig = DEVNET_CONFIG,
): Promise<Transaction> {
  const tx = new Transaction()
  // TODO: Add refund instruction using Anchor program
  return tx
}
```

- [ ] **Step 4: Write privacy operations**

```typescript
// packages/sdk/src/privacy.ts
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import {
  generateStealthAddress,
  createPedersenCommitment,
  generateViewingKey,
} from '@sip-protocol/sdk'
import { SipherConfig, DEVNET_CONFIG } from './config'
import { WithdrawResult, ScanResult } from './types'

export async function buildPrivateSendTx(
  connection: Connection,
  depositor: PublicKey,
  recipientSpendingPubkey: string,
  recipientViewingPubkey: string,
  tokenMint: PublicKey,
  amount: bigint,
  config: SipherConfig = DEVNET_CONFIG,
): Promise<Transaction> {
  // 1. Generate stealth address for recipient
  const stealth = generateStealthAddress(recipientSpendingPubkey, recipientViewingPubkey)

  // 2. Create Pedersen commitment
  const commitment = createPedersenCommitment(Number(amount))

  // 3. Build withdraw_private instruction
  const tx = new Transaction()
  // TODO: Build full instruction with stealth address, commitment, viewing key hash
  return tx
}

export async function scanForPayments(
  connection: Connection,
  viewingPrivateKey: string,
  spendingPublicKey: string,
  config: SipherConfig = DEVNET_CONFIG,
): Promise<ScanResult> {
  // Use existing @sip-protocol/sdk scanning logic
  // Scan transfer record PDAs for payments to our stealth addresses
  return { found: 0, payments: [] }
}
```

- [ ] **Step 5: Write index exports**

```typescript
// packages/sdk/src/index.ts
export * from './types'
export * from './config'
export * from './vault'
export * from './privacy'
```

- [ ] **Step 6: Write vault tests**

```typescript
// packages/sdk/tests/vault.test.ts
import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { getVaultConfigPDA, getDepositRecordPDA } from '../src/vault'

describe('@sipher/sdk vault', () => {
  const programId = new PublicKey('11111111111111111111111111111111')
  const depositor = PublicKey.unique()
  const mint = PublicKey.unique()

  it('derives vault config PDA deterministically', () => {
    const [pda1] = getVaultConfigPDA(programId)
    const [pda2] = getVaultConfigPDA(programId)
    expect(pda1.toString()).to.equal(pda2.toString())
  })

  it('derives unique deposit record PDAs per wallet+mint', () => {
    const [pda1] = getDepositRecordPDA(depositor, mint, programId)
    const otherMint = PublicKey.unique()
    const [pda2] = getDepositRecordPDA(depositor, otherMint, programId)
    expect(pda1.toString()).not.to.equal(pda2.toString())
  })
})
```

- [ ] **Step 7: Run tests**

```bash
cd packages/sdk && pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add packages/sdk/
git commit -m "feat: @sipher/sdk with vault and privacy operations"
```

---

### Task 3: Build Pi SDK Agent with 6 Tools

**Files:**
- Create: `packages/agent/src/agent.ts`
- Create: `packages/agent/src/tools/deposit.ts`
- Create: `packages/agent/src/tools/send.ts`
- Create: `packages/agent/src/tools/refund.ts`
- Create: `packages/agent/src/tools/balance.ts`
- Create: `packages/agent/src/tools/scan.ts`
- Create: `packages/agent/src/tools/claim.ts`
- Create: `packages/agent/src/index.ts`

- [ ] **Step 1: Create agent setup with system prompt**

```typescript
// packages/agent/src/agent.ts
import { getModel } from '@mariozechner/pi-ai'
import { Agent, AgentTool } from '@mariozechner/pi-agent-core'
import { depositTool } from './tools/deposit'
import { sendTool } from './tools/send'
import { refundTool } from './tools/refund'
import { balanceTool } from './tools/balance'
import { scanTool } from './tools/scan'
import { claimTool } from './tools/claim'

const SYSTEM_PROMPT = `You are Sipher — SIP Protocol's privacy agent.
Tagline: "Plug in. Go private."

You help users manage private transactions on Solana through a PDA vault.
Users deposit tokens, then you execute private sends, swaps, and refunds.

Tone: Confident, technical, slightly cypherpunk. Never corporate.
Never say "I'm just an AI." Speak like a privacy engineer who cares.

Available tools: deposit, send, refund, balance, scan, claim.

Rules:
- Every fund-moving operation shows a confirmation before executing
- Never display full viewing keys in chat — provide download links
- If vault anonymity set is low, warn the user
- Always reassure funds are safe when errors occur
- Be concise — bullet points over paragraphs`

export function createSipherAgent(modelProvider = 'anthropic', modelId = 'claude-sonnet-4-6') {
  const model = getModel(modelProvider, modelId)
  const tools: AgentTool[] = [
    depositTool,
    sendTool,
    refundTool,
    balanceTool,
    scanTool,
    claimTool,
  ]

  return new Agent({
    initialState: {
      model,
      tools,
      systemPrompt: SYSTEM_PROMPT,
    },
  })
}
```

- [ ] **Step 2: Create deposit tool**

```typescript
// packages/agent/src/tools/deposit.ts
import { AgentTool } from '@mariozechner/pi-agent-core'
import { Type } from '@sinclair/typebox'

export const depositTool: AgentTool = {
  name: 'deposit',
  description: 'Deposit tokens into the Sipher privacy vault. User must sign the transaction.',
  parameters: Type.Object({
    amount: Type.Number({ description: 'Amount to deposit' }),
    token: Type.String({ description: 'Token symbol (SOL, USDC, etc.)' }),
  }),
  execute: async (toolCallId, params, signal) => {
    const { amount, token } = params
    // Build deposit transaction via @sipher/sdk
    // Return unsigned TX for wallet signing
    return {
      output: `Deposit prepared: ${amount} ${token} into vault. Awaiting wallet signature.`,
      details: {
        action: 'deposit',
        amount,
        token,
        status: 'awaiting_signature',
      },
    }
  },
}
```

- [ ] **Step 3: Create remaining 5 tools (send, refund, balance, scan, claim)**

Each tool follows the same pattern: TypeBox schema for params, execute function that calls @sipher/sdk, returns output + details for rich UI rendering.

```typescript
// packages/agent/src/tools/balance.ts
import { AgentTool } from '@mariozechner/pi-agent-core'
import { Type } from '@sinclair/typebox'

export const balanceTool: AgentTool = {
  name: 'balance',
  description: 'Check vault balance for the connected wallet. Shows all deposited tokens.',
  parameters: Type.Object({}),
  execute: async (toolCallId, params, signal) => {
    // Query all deposit records for connected wallet
    // Return formatted balance list
    return {
      output: 'Vault balance:\n· 450 USDC\n· 2.3 SOL\n· 10,000 BONK\nAuto-refund in: 18h 42m',
      details: {
        action: 'balance',
        tokens: [
          { symbol: 'USDC', balance: 450, usdValue: 450 },
          { symbol: 'SOL', balance: 2.3, usdValue: 322 },
          { symbol: 'BONK', balance: 10000, usdValue: 0.23 },
        ],
      },
    }
  },
}
```

```typescript
// packages/agent/src/tools/send.ts
import { AgentTool } from '@mariozechner/pi-agent-core'
import { Type } from '@sinclair/typebox'

export const sendTool: AgentTool = {
  name: 'send',
  description: 'Send tokens privately from vault to a recipient using stealth addresses.',
  parameters: Type.Object({
    amount: Type.Number({ description: 'Amount to send' }),
    token: Type.String({ description: 'Token symbol' }),
    recipient: Type.String({ description: 'Recipient wallet address or stealth address' }),
  }),
  execute: async (toolCallId, params, signal) => {
    const { amount, token, recipient } = params
    return {
      output: `Private send prepared: ${amount} ${token} to stealth address. Fee: ${(amount * 0.001).toFixed(4)} ${token} (0.1%). Awaiting confirmation.`,
      details: {
        action: 'send',
        amount,
        token,
        recipient,
        fee: amount * 0.001,
        status: 'awaiting_confirmation',
      },
    }
  },
}
```

```typescript
// packages/agent/src/tools/refund.ts
import { AgentTool } from '@mariozechner/pi-agent-core'
import { Type } from '@sinclair/typebox'

export const refundTool: AgentTool = {
  name: 'refund',
  description: 'Refund deposited tokens from the vault back to your wallet.',
  parameters: Type.Object({
    token: Type.String({ description: 'Token symbol to refund (or "all" for all tokens)' }),
  }),
  execute: async (toolCallId, params, signal) => {
    return {
      output: `Refund prepared: returning ${params.token} from vault to your wallet. Awaiting signature.`,
      details: {
        action: 'refund',
        token: params.token,
        status: 'awaiting_signature',
      },
    }
  },
}
```

```typescript
// packages/agent/src/tools/scan.ts
import { AgentTool } from '@mariozechner/pi-agent-core'
import { Type } from '@sinclair/typebox'

export const scanTool: AgentTool = {
  name: 'scan',
  description: 'Scan the blockchain for incoming stealth payments to your addresses.',
  parameters: Type.Object({}),
  execute: async (toolCallId, params, signal) => {
    return {
      output: 'Scanning blockchain for stealth payments... Found 2 unclaimed payments.',
      details: {
        action: 'scan',
        found: 2,
        payments: [],
        status: 'complete',
      },
    }
  },
}
```

```typescript
// packages/agent/src/tools/claim.ts
import { AgentTool } from '@mariozechner/pi-agent-core'
import { Type } from '@sinclair/typebox'

export const claimTool: AgentTool = {
  name: 'claim',
  description: 'Claim a received stealth payment, transferring it to your wallet.',
  parameters: Type.Object({
    paymentId: Type.String({ description: 'Payment ID or transfer record address to claim' }),
  }),
  execute: async (toolCallId, params, signal) => {
    return {
      output: `Claiming payment ${params.paymentId}... Awaiting signature.`,
      details: {
        action: 'claim',
        paymentId: params.paymentId,
        status: 'awaiting_signature',
      },
    }
  },
}
```

- [ ] **Step 4: Create server entrypoint**

```typescript
// packages/agent/src/index.ts
import express from 'express'
import { createSipherAgent } from './agent'

const app = express()
const PORT = process.env.PORT || 5006

// Serve web chat UI (static files)
app.use(express.static('../app/dist'))

// Existing REST API (Mode 2) — mount from packages/api
// app.use('/api/v1', apiRouter)

// WebSocket for agent chat (Mode 1)
// TODO: Set up WebSocket server for pi-agent-core streaming

app.listen(PORT, () => {
  console.log(`Sipher agent running on port ${PORT}`)
  console.log(`Web chat: http://localhost:${PORT}`)
  console.log(`API: http://localhost:${PORT}/api/v1`)
})
```

- [ ] **Step 5: Run agent smoke test**

```bash
cd packages/agent && pnpm dev
```

Expected: Server starts on port 5006.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/
git commit -m "feat: Pi SDK agent with 6 SIP privacy tools"
```

---

### Task 4: Build Web Chat UI (4 Components)

**Files:**
- Create: `app/src/App.tsx`
- Create: `app/src/components/ChatContainer.tsx`
- Create: `app/src/components/WalletBar.tsx`
- Create: `app/src/components/TextMessage.tsx`
- Create: `app/src/components/ConfirmationPrompt.tsx`
- Create: `app/src/components/QuickActions.tsx`
- Create: `app/src/styles/theme.css`
- Create: `app/index.html`

- [ ] **Step 1: Create theme (cypherpunk dark)**

```css
/* app/src/styles/theme.css */
:root {
  --bg: #0a0a0f;
  --surface: #12121a;
  --surface-2: #1a1a26;
  --border: #2a2a3a;
  --text: #e4e4ec;
  --text-muted: #8888a0;
  --accent: #7c5cfc;
  --green: #22c55e;
  --red: #ef4444;
  --yellow: #eab308;
  --cyan: #06b6d4;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}
```

- [ ] **Step 2: Create ChatContainer, WalletBar, TextMessage, ConfirmationPrompt, QuickActions**

These are React components using the cypherpunk theme. Each component is self-contained with its own styles. Implementation follows the wireframe in Section 19 of the spec.

- [ ] **Step 3: Wire up wallet adapter (Phantom, Backpack, Solflare)**

```typescript
// app/src/App.tsx
import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter, BackpackWalletAdapter } from '@solana/wallet-adapter-wallets'
// ... standard Solana wallet adapter setup
```

- [ ] **Step 4: Connect WebSocket to agent**

The chat UI connects to the agent's WebSocket endpoint. Messages stream via pi-agent-core's event system (text_delta, tool_execution_start, tool_end, agent_end).

- [ ] **Step 5: Build and serve**

```bash
cd app && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: web chat UI with cypherpunk dark theme and wallet adapter"
```

---

### Task 5: Integration — Connect Agent to Vault Program

**Files:**
- Modify: `packages/sdk/src/vault.ts` (add real program calls)
- Modify: `packages/agent/src/tools/*.ts` (wire to SDK)

- [ ] **Step 1: Generate Anchor IDL types**

```bash
cd programs/sipher-vault
anchor build
# Copy IDL to packages/sdk
cp target/idl/sipher_vault.json ../../packages/sdk/src/idl/
```

- [ ] **Step 2: Wire vault.ts to real program calls using Anchor IDL**

Replace the TODO placeholders in vault.ts with real Anchor program interactions using the generated IDL.

- [ ] **Step 3: Wire each tool to @sipher/sdk**

Each tool's execute function calls the real @sipher/sdk functions instead of returning mock data.

- [ ] **Step 4: E2E test on devnet**

```bash
# Start agent pointing to devnet
SOLANA_RPC_URL=https://api.devnet.solana.com pnpm dev

# Open browser, connect wallet, deposit, send, refund
```

- [ ] **Step 5: Commit**

```bash
git add packages/
git commit -m "feat: connect agent tools to sipher_vault program via @sipher/sdk"
```

---

### Task 6: Docker & Deploy

**Files:**
- Create: `Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/app/dist ./app/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
EXPOSE 5006
CMD ["node", "dist/packages/agent/src/index.js"]
```

- [ ] **Step 2: Build and test locally**

```bash
docker build -t sipher:latest .
docker run -p 5006:5006 --env-file .env sipher:latest
```

- [ ] **Step 3: Push to GHCR and deploy to VPS**

```bash
docker tag sipher:latest ghcr.io/sip-protocol/sipher:latest
docker push ghcr.io/sip-protocol/sipher:latest
ssh sip "cd ~/app && docker compose pull sipher && docker compose up -d sipher"
```

- [ ] **Step 4: Verify deployment**

```bash
curl https://sipher.sip-protocol.org/api/v1/health
# Open https://sipher.sip-protocol.org in browser — should show web chat
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: Docker deploy for sipher agent + web chat"
```

---

## Notes

- **Tool implementations are scaffolds:** The execute functions return mock data in Phase 1 tasks. Task 5 wires them to real program calls. The executing agent should flesh out each tool with complete @sipher/sdk integration.
- **Wallet signing flow:** The agent builds unsigned transactions. The web UI presents them for wallet signing. The signed TX is submitted by the client, not the server. This keeps private keys out of the server process.
- **Pi SDK learning curve:** The executing agent should reference `https://nader.substack.com/p/how-to-build-a-custom-agent-framework` and `https://github.com/badlogic/pi-mono` for Pi SDK patterns.
- **Existing REST API:** The current Express API (`src/api/`) continues running on `/api/v1/`. It's mounted into the same Express app in `packages/agent/src/index.ts`.
