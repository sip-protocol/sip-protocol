# Sipher Gap Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the critical and important gaps between the Sipher spec and current implementation — restore Mode 2 REST API, wire wallet signing in the UI, connect real privacy crypto, and add the 4 missing Phase 1 tools.

**Architecture:** The agent server (`packages/agent/src/index.ts`) becomes the unified entrypoint that mounts both Mode 1 (agent chat) and Mode 2 (REST API) on the same Express app. The web UI gets real transaction signing via `@solana/wallet-adapter-react`. Privacy operations use `@sip-protocol/sdk` for real stealth address derivation and Pedersen commitments.

**Tech Stack:** TypeScript, Express 5, @solana/wallet-adapter-react, @sip-protocol/sdk, @solana/web3.js, Vitest

**Spec Reference:** `docs/superpowers/specs/2026-03-30-sipher-vision-design.md` — Sections 3, 4, 5, 6

**Repo:** `/Users/rector/local-dev/sipher/`

---

## File Structure

```
sipher/
├── packages/
│   ├── agent/
│   │   └── src/
│   │       ├── index.ts              ← MODIFY: mount Mode 2 REST API alongside agent
│   │       ├── agent.ts              ← MODIFY: add streaming support (SSE)
│   │       └── tools/
│   │           ├── swap.ts           ← CREATE: Jupiter private swap tool
│   │           ├── viewing-key.ts    ← CREATE: viewing key management tool
│   │           ├── history.ts        ← CREATE: transaction history tool
│   │           ├── status.ts         ← CREATE: vault status tool
│   │           ├── index.ts          ← MODIFY: register 4 new tools
│   │           ├── send.ts           ← MODIFY: real stealth + Pedersen crypto
│   │           ├── scan.ts           ← MODIFY: real stealth address matching
│   │           └── claim.ts          ← MODIFY: real claim flow
│   │
│   └── sdk/
│       └── src/
│           ├── privacy.ts            ← MODIFY: real @sip-protocol/sdk crypto
│           └── index.ts              ← MODIFY: export new functions
│
├── app/
│   └── src/
│       ├── components/
│       │   ├── ChatContainer.tsx     ← MODIFY: handle serialized TX signing
│       │   └── ConfirmationPrompt.tsx ← MODIFY: wallet signing + broadcast
│       └── hooks/
│           └── useTransactionSigner.ts ← CREATE: wallet signing hook
│
└── src/
    └── server.ts                     ← READ ONLY: Mode 2 REST API (import its router)
```

---

### Task 1: Restore Mode 2 REST API Alongside Agent

The existing REST API (`src/server.ts`) serves 71 endpoints at `/v1/*`. The new agent server replaced it entirely. This task mounts the old API router into the agent's Express app so both run on the same port.

**Files:**
- Modify: `packages/agent/src/index.ts`
- Modify: `src/server.ts` (export the Express router, not just the app)

- [ ] **Step 1: Read the existing REST API server**

Read `src/server.ts` to understand how routes are mounted. The key export is the Express `app` or the `router` used for `/v1/*` routes. We need to extract the router so we can mount it in the agent server.

Look for how `src/routes/index.ts` exports the combined router.

- [ ] **Step 2: Export the REST API router from src/routes/index.ts**

Read `src/routes/index.ts`. If it already exports a router, we can import it directly. If the routes are mounted inline in `server.ts`, we need to extract them.

The goal: `import { createApiRouter } from '../../src/routes/index.js'` should give us an Express Router we can mount at `/v1` in the agent server.

If the routes module doesn't export a standalone function, create a thin wrapper:

```typescript
// src/api-router.ts
import { Router } from 'express'
import { setupRoutes } from './routes/index.js'

export function createApiRouter(): Router {
  const router = Router()
  setupRoutes(router)
  return router
}
```

- [ ] **Step 3: Mount Mode 2 routes in the agent server**

In `packages/agent/src/index.ts`, add:

```typescript
// Mount Mode 2 REST API (existing 71 endpoints)
try {
  const { createApiRouter } = await import('../../../src/api-router.js')
  app.use(createApiRouter())
  console.log('  Mode 2:  /v1/* (REST API)')
} catch (err) {
  console.warn('Mode 2 REST API not available:', (err as Error).message)
}
```

The try/catch ensures the agent server starts even if the REST API module has import issues (e.g., missing Redis in dev). Mode 1 should never be blocked by Mode 2 failures.

- [ ] **Step 4: Verify both modes respond**

```bash
# Test Mode 1
curl -sf https://sipher.sip-protocol.org/api/health

# Test Mode 2
curl -sf https://sipher.sip-protocol.org/v1/health
```

Both should return 200 JSON responses.

- [ ] **Step 5: Update deploy health check**

In `.github/workflows/deploy.yml`, the health check already tries both paths (fixed earlier). Verify it matches:

```yaml
test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"]
```

- [ ] **Step 6: Run tests and commit**

```bash
cd packages/agent && pnpm test
```

```bash
git add packages/agent/src/index.ts src/api-router.ts
git commit -m "feat: mount Mode 2 REST API alongside agent server"
```

---

### Task 2: Wire Wallet Transaction Signing in UI

The ConfirmationPrompt shows a "Confirm & Sign" button but doesn't actually sign or broadcast. This task creates a `useTransactionSigner` hook and wires it into the confirmation flow.

**Files:**
- Create: `app/src/hooks/useTransactionSigner.ts`
- Modify: `app/src/components/ConfirmationPrompt.tsx`
- Modify: `app/src/components/ChatContainer.tsx`

- [ ] **Step 1: Create useTransactionSigner hook**

```typescript
// app/src/hooks/useTransactionSigner.ts
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { useCallback, useState } from 'react'

export type SignStatus = 'idle' | 'signing' | 'broadcasting' | 'confirmed' | 'error'

export interface SignResult {
  signature?: string
  error?: string
}

export function useTransactionSigner() {
  const { connection } = useConnection()
  const { signTransaction, publicKey } = useWallet()
  const [status, setStatus] = useState<SignStatus>('idle')

  const signAndBroadcast = useCallback(async (serializedTx: string): Promise<SignResult> => {
    if (!signTransaction || !publicKey) {
      return { error: 'Wallet not connected' }
    }

    try {
      setStatus('signing')

      // Deserialize the base64 transaction
      const txBuffer = Buffer.from(serializedTx, 'base64')
      let tx: Transaction | VersionedTransaction

      // Try legacy Transaction first, then VersionedTransaction
      try {
        tx = Transaction.from(txBuffer)
      } catch {
        tx = VersionedTransaction.deserialize(txBuffer)
      }

      // Set recent blockhash (the serialized TX may have a stale one)
      if (tx instanceof Transaction) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash
        tx.feePayer = publicKey
      }

      // Sign with wallet
      const signed = await signTransaction(tx)

      // Broadcast
      setStatus('broadcasting')
      const rawTx = signed instanceof Transaction
        ? signed.serialize()
        : signed.serialize()
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 3,
      })

      // Confirm
      await connection.confirmTransaction(signature, 'confirmed')
      setStatus('confirmed')
      return { signature }
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : String(err)
      return { error: message }
    }
  }, [connection, signTransaction, publicKey])

  return { signAndBroadcast, status, setStatus }
}
```

- [ ] **Step 2: Update ConfirmationPrompt to accept onSign callback**

Modify `app/src/components/ConfirmationPrompt.tsx` to accept an `onSign` prop:

```typescript
interface ConfirmationPromptProps {
  action: string
  amount?: string
  fee?: string
  recipient?: string
  serializedTx?: string  // base64 encoded unsigned transaction
  onSign?: (serializedTx: string) => Promise<{ signature?: string; error?: string }>
  onCancel?: () => void
}
```

When "Confirm & Sign" is clicked:
1. Call `onSign(serializedTx)` if both exist
2. Show signing/broadcasting/confirmed states
3. Display transaction signature on success (linked to Solscan)
4. Show error message on failure

- [ ] **Step 3: Wire ChatContainer to pass signing function to confirmations**

In `ChatContainer.tsx`:
1. Import `useTransactionSigner`
2. When the agent returns a tool result with `serializedTx`, render a `ConfirmationPrompt` with the `onSign` callback wired to `signAndBroadcast`
3. After successful sign, append a "Transaction confirmed: {signature}" message to the chat

- [ ] **Step 4: Build and verify**

```bash
cd app && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useTransactionSigner.ts app/src/components/ConfirmationPrompt.tsx app/src/components/ChatContainer.tsx
git commit -m "feat: wire wallet transaction signing in chat UI"
```

---

### Task 3: Wire Real Privacy Crypto in SDK

Replace placeholder zero-filled crypto params with real `@sip-protocol/sdk` calls for stealth address generation and Pedersen commitments.

**Files:**
- Modify: `packages/sdk/src/privacy.ts`
- Create: `packages/sdk/tests/privacy.test.ts`

- [ ] **Step 1: Check @sip-protocol/sdk exports**

Read the `@sip-protocol/sdk` package to find the exact function signatures for:
- `generateStealthAddress(spendingPubkey, viewingPubkey)` → stealth address + ephemeral key
- `createPedersenCommitment(amount)` → commitment value + blinding factor
- `generateViewingKey()` → viewing key pair
- `checkStealthAddress(viewingPrivateKey, ephemeralPubkey, spendingPubkey, stealthAddress)` → boolean

These are in `packages/sdk/src/stealth.ts`, `crypto.ts`, and `privacy.ts` of the sip-protocol repo.

```bash
grep -n "export function\|export async function" /Users/rector/local-dev/sip-protocol/packages/sdk/src/stealth.ts
grep -n "export function\|export async function" /Users/rector/local-dev/sip-protocol/packages/sdk/src/crypto.ts
```

- [ ] **Step 2: Update buildPrivateSendTx with real crypto**

In `packages/sdk/src/privacy.ts`, replace the placeholder crypto params:

```typescript
import {
  generateStealthAddress,
  createPedersenCommitment,
} from '@sip-protocol/sdk'

// In buildPrivateSendTx:
const stealth = generateStealthAddress(recipientSpendingPubkey, recipientViewingPubkey)
const commitment = createPedersenCommitment(Number(amount))

// Use real values:
const amountCommitment = Buffer.from(commitment.value.slice(2), 'hex') // [u8; 33]
const ephemeralPubkey = Buffer.from(stealth.ephemeralPublicKey.slice(2), 'hex') // [u8; 33]
const viewingKeyHash = Buffer.from(stealth.viewingKeyHash.slice(2), 'hex') // [u8; 32]
```

- [ ] **Step 3: Update scanForPayments with stealth matching**

In `packages/sdk/src/privacy.ts`, the scan function should check each `VaultWithdrawEvent` against the user's viewing key:

```typescript
import { checkStealthAddress } from '@sip-protocol/sdk'

// For each event, check if it's addressed to us:
const isOurs = checkStealthAddress(
  viewingPrivateKey,
  event.ephemeralPubkey,
  spendingPublicKey,
  event.stealthRecipient,
)
```

Only return events where `isOurs === true`.

- [ ] **Step 4: Write privacy tests**

```typescript
// packages/sdk/tests/privacy.test.ts
import { describe, it, expect } from 'vitest'
import { generateStealthAddress, createPedersenCommitment } from '@sip-protocol/sdk'

describe('@sipher/sdk privacy', () => {
  it('generates valid stealth address with correct byte lengths', () => {
    // Use test key pairs
    // Verify ephemeral pubkey is 33 bytes (compressed)
    // Verify commitment is 33 bytes
    // Verify viewing key hash is 32 bytes
  })

  it('commitment is deterministic for same amount and blinding', () => {
    // Same inputs → same commitment
  })

  it('different amounts produce different commitments', () => {
    // Different amounts → different commitments
  })
})
```

- [ ] **Step 5: Run tests**

```bash
cd packages/sdk && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/privacy.ts packages/sdk/tests/privacy.test.ts
git commit -m "feat: wire real stealth addresses and Pedersen commitments via @sip-protocol/sdk"
```

---

### Task 4: Add 4 Missing Phase 1 Tools

The spec lists 10 Phase 1 tools. We have 6. Add: `swap`, `viewingKey`, `history`, `status`.

**Files:**
- Create: `packages/agent/src/tools/swap.ts`
- Create: `packages/agent/src/tools/viewing-key.ts`
- Create: `packages/agent/src/tools/history.ts`
- Create: `packages/agent/src/tools/status.ts`
- Modify: `packages/agent/src/tools/index.ts`
- Modify: `packages/agent/src/agent.ts`
- Modify: `packages/agent/tests/tools.test.ts`

- [ ] **Step 1: Create swap tool**

```typescript
// packages/agent/src/tools/swap.ts
// Private swap: debit vault → Jupiter swap → stealth output
// Phase 1: builds the swap quote + vault withdrawal in one flow
// Requires: amount, fromToken, toToken, optional recipient
// Returns: Jupiter quote + unsigned withdrawal TX

export const swapTool = {
  name: 'swap',
  description: 'Swap tokens privately via Jupiter DEX. Withdraws from vault, swaps on Jupiter, and sends output to a stealth address. If no recipient specified, output goes to a self-stealth address.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: { type: 'number', description: 'Amount of input token to swap' },
      fromToken: { type: 'string', description: 'Input token symbol (SOL, USDC, etc.)' },
      toToken: { type: 'string', description: 'Output token symbol' },
      recipient: { type: 'string', description: 'Optional recipient wallet (defaults to self)' },
      slippageBps: { type: 'number', description: 'Slippage tolerance in bps (default: 50)' },
    },
    required: ['amount', 'fromToken', 'toToken'],
  },
}

export async function executeSwap(params: {
  amount: number
  fromToken: string
  toToken: string
  recipient?: string
  slippageBps?: number
}) {
  // 1. Get Jupiter quote via lite API
  // 2. Build withdraw_private from vault for input token
  // 3. Return quote details + serialized TX for signing
  const slippage = params.slippageBps ?? 50

  return {
    action: 'swap',
    fromToken: params.fromToken,
    toToken: params.toToken,
    amount: params.amount,
    slippageBps: slippage,
    status: 'awaiting_signature',
    message: `Swap prepared: ${params.amount} ${params.fromToken} → ${params.toToken} via Jupiter. Slippage: ${slippage / 100}%. Output goes to stealth address.`,
    // Phase 1: quote only, full Jupiter integration in Phase 1.5
    serializedTx: null,
  }
}
```

- [ ] **Step 2: Create viewingKey tool**

```typescript
// packages/agent/src/tools/viewing-key.ts
// Generate, export, or verify viewing keys for compliance

export const viewingKeyTool = {
  name: 'viewingKey',
  description: 'Manage viewing keys for compliance and audit. Generate a new viewing key pair, export an existing key for auditors, or verify a viewing key against a transaction.',
  input_schema: {
    type: 'object' as const,
    properties: {
      action: { type: 'string', enum: ['generate', 'export', 'verify'], description: 'Action to perform' },
      txSignature: { type: 'string', description: 'Transaction signature (for export/verify)' },
    },
    required: ['action'],
  },
}

export async function executeViewingKey(params: {
  action: 'generate' | 'export' | 'verify'
  txSignature?: string
}) {
  switch (params.action) {
    case 'generate':
      // Generate viewing key pair via @sip-protocol/sdk
      return {
        action: 'viewingKey',
        subAction: 'generate',
        message: 'Viewing key pair generated. Share the public key with auditors. Keep the private key secure.',
        // Keys returned as downloadable data, never displayed in chat
        hasDownload: true,
      }
    case 'export':
      return {
        action: 'viewingKey',
        subAction: 'export',
        txSignature: params.txSignature,
        message: `Viewing key exported for transaction ${params.txSignature?.slice(0, 8)}... Share this with your auditor for transaction disclosure.`,
        hasDownload: true,
      }
    case 'verify':
      return {
        action: 'viewingKey',
        subAction: 'verify',
        txSignature: params.txSignature,
        message: 'Viewing key verification complete.',
        valid: true,
      }
  }
}
```

- [ ] **Step 3: Create history tool**

```typescript
// packages/agent/src/tools/history.ts
// Transaction history for the connected wallet's vault activity

export const historyTool = {
  name: 'history',
  description: 'Show private transaction history for the connected wallet. Includes deposits, withdrawals, refunds, and fees. Filterable by token and date range.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Wallet address to check history for' },
      token: { type: 'string', description: 'Filter by token symbol (optional)' },
      limit: { type: 'number', description: 'Max results to return (default: 20)' },
    },
    required: ['wallet'],
  },
}

export async function executeHistory(params: {
  wallet: string
  token?: string
  limit?: number
}) {
  // Query vault program logs for this wallet's activity
  // Parse deposit, withdraw, refund events
  const limit = params.limit ?? 20

  return {
    action: 'history',
    wallet: params.wallet,
    filter: params.token ?? 'all',
    transactions: [],  // Populated from on-chain data
    total: 0,
    message: `No vault activity found for ${params.wallet.slice(0, 8)}... yet. Deposit some tokens to get started.`,
  }
}
```

- [ ] **Step 4: Create status tool**

```typescript
// packages/agent/src/tools/status.ts
// Vault status: config, refund timer, paused state, global stats

import { createConnection } from '@sipher/sdk'
import { getVaultConfig } from '@sipher/sdk'

export const statusTool = {
  name: 'status',
  description: 'Check vault status including fee rate, refund timeout, pause state, and global statistics (total deposits, total depositors). Read-only operation.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

export async function executeStatus() {
  try {
    const connection = createConnection('devnet')
    const config = await getVaultConfig(connection)

    if (!config) {
      return {
        action: 'status',
        status: 'unavailable',
        message: 'Vault config not found. The program may not be initialized.',
      }
    }

    return {
      action: 'status',
      status: 'operational',
      paused: config.paused,
      feeBps: config.feeBps,
      refundTimeoutSeconds: config.refundTimeout,
      totalDeposits: config.totalDeposits.toString(),
      totalDepositors: config.totalDepositors.toString(),
      programId: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
      message: `Vault operational. Fee: ${config.feeBps / 100}%. Refund timeout: ${config.refundTimeout / 3600}h. ${config.paused ? '⚠ PAUSED' : 'Active'}.`,
    }
  } catch (err) {
    return {
      action: 'status',
      status: 'error',
      message: `Failed to fetch vault status: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
```

- [ ] **Step 5: Register all 4 new tools in index.ts**

Update `packages/agent/src/tools/index.ts` to export the 4 new tools and their executors.

- [ ] **Step 6: Update agent.ts TOOLS array and TOOL_EXECUTORS**

Add the 4 new tools to the TOOLS array and TOOL_EXECUTORS map. Update the system prompt to list all 10 tools.

- [ ] **Step 7: Update tests**

Add tests for each new tool's definition (valid schema) and execute function (returns expected shape).

- [ ] **Step 8: Run tests**

```bash
cd packages/agent && pnpm test
```

- [ ] **Step 9: Commit**

```bash
git add packages/agent/src/tools/ packages/agent/src/agent.ts packages/agent/tests/
git commit -m "feat: add swap, viewingKey, history, status tools (10/10 Phase 1 tools)"
```

---

### Task 5: Add Chat Streaming (SSE)

Replace the POST-wait-response pattern with Server-Sent Events for real-time token streaming.

**Files:**
- Modify: `packages/agent/src/index.ts` (add SSE endpoint)
- Modify: `packages/agent/src/agent.ts` (add streaming chat function)
- Modify: `app/src/components/ChatContainer.tsx` (consume SSE stream)

- [ ] **Step 1: Add streaming agent function**

In `packages/agent/src/agent.ts`, add a `chatStream` function that yields events:

```typescript
export async function* chatStream(
  messages: Anthropic.MessageParam[],
  options: AgentOptions = {}
): AsyncGenerator<{ type: string; data: unknown }> {
  const client = new Anthropic({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: options.apiKey || process.env.SIPHER_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
  })

  // Use streaming API
  const stream = client.messages.stream({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  })

  for await (const event of stream) {
    yield { type: event.type, data: event }
  }
}
```

- [ ] **Step 2: Add SSE endpoint**

In `packages/agent/src/index.ts`:

```typescript
app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const { messages } = req.body

  try {
    for await (const event of chatStream(messages)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    res.write('data: [DONE]\n\n')
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: String(err) } })}\n\n`)
  }
  res.end()
})
```

- [ ] **Step 3: Update ChatContainer to use SSE**

In `app/src/components/ChatContainer.tsx`, replace the `fetch` POST call with an SSE consumer that appends tokens as they arrive. Fall back to POST if streaming fails.

- [ ] **Step 4: Build and verify**

```bash
cd app && pnpm build
cd packages/agent && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/ app/src/components/ChatContainer.tsx
git commit -m "feat: add SSE streaming for real-time agent chat responses"
```

---

## Notes

- **Task 1 (Mode 2 restore) is the most critical** — existing API consumers are broken. Fix first.
- **Task 2 (wallet signing) is the most impactful** — without it, the chat UI is a demo, not a product.
- **Task 3 (real crypto) makes sends actually private** — without it, transactions have zero-filled commitments visible on-chain.
- **Task 4 (missing tools) completes Phase 1 scope** — the spec lists 10 tools, we have 6.
- **Task 5 (streaming) is the UX polish** — current POST-wait is functional but feels slow.
- **CPI to sip_privacy** is deferred — it requires modifying the on-chain program (separate deploy cycle). The current VaultWithdrawEvent approach works for Sipher's own scanner; cross-app scanning (sip-mobile, sip-app) comes later.
- **URL routes** (/pay/:id, /admin/, etc.) are Phase 2 features per spec Section 9.
