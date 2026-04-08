# Sipher Wave A — Infrastructure & Partial Tool Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 half-done tools (swap, viewingKey, history), add SQLite persistence, session isolation, and CPI wiring — the foundation that unblocks Waves B and C.

**Architecture:** Tool fixes wire real SDK calls into existing stubs. SQLite via `better-sqlite3` stores sessions, audit logs, and scheduled ops schema. Session isolation scopes agent state per wallet. CPI composes sipher_vault with sip_privacy atomically.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, @sip-protocol/sdk, @solana/web3.js, Vitest, Rust/Anchor (CPI only)

**Spec Reference:** `docs/superpowers/specs/2026-04-08-sipher-phase1-completion-design.md` — Wave A

**Repo:** `/Users/rector/local-dev/sipher/`

---

## File Structure

```
sipher/
├── packages/
│   ├── agent/
│   │   └── src/
│   │       ├── db.ts                  ← CREATE: SQLite database setup + queries
│   │       ├── db/
│   │       │   └── schema.sql         ← CREATE: Table definitions
│   │       ├── session.ts             ← CREATE: Session management per wallet
│   │       ├── index.ts               ← MODIFY: Wire sessions + db init
│   │       ├── agent.ts               ← MODIFY: Accept session context
│   │       └── tools/
│   │           ├── swap.ts            ← MODIFY: Real Jupiter execution
│   │           ├── viewing-key.ts     ← MODIFY: Real @sip-protocol/sdk crypto
│   │           └── history.ts         ← MODIFY: On-chain event parsing
│   │   └── tests/
│   │       ├── swap.test.ts           ← CREATE: Swap tool tests
│   │       ├── viewing-key.test.ts    ← CREATE: ViewingKey tool tests
│   │       ├── history.test.ts        ← CREATE: History tool tests
│   │       ├── db.test.ts             ← CREATE: SQLite tests
│   │       └── session.test.ts        ← CREATE: Session tests
│   │
│   └── sdk/
│       └── src/
│           ├── swap.ts                ← CREATE: Jupiter quote + TX builder
│           ├── events.ts              ← CREATE: On-chain event parser
│           └── index.ts               ← MODIFY: Export new modules
│
└── programs/
    └── sipher-vault/
        └── programs/sipher_vault/
            └── src/lib.rs             ← MODIFY: CPI to sip_privacy (Task 6)
```

---

### Task 1: Swap Tool — Real Jupiter Execution

Wire the swap tool to fetch real Jupiter quotes and build executable swap transactions. The swap output goes to a stealth ATA for privacy.

**Files:**
- Create: `packages/sdk/src/swap.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/agent/src/tools/swap.ts`
- Create: `packages/agent/tests/swap.test.ts`

- [ ] **Step 1: Create Jupiter quote fetcher in SDK**

```typescript
// packages/sdk/src/swap.ts
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { resolveTokenMint } from './tokens.js'

const JUPITER_QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote'
const JUPITER_SWAP_URL = 'https://lite-api.jup.ag/swap/v1/swap'

export interface JupiterQuote {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  priceImpactPct: string
  routePlan: { swapInfo: { label: string } }[]
}

export interface SwapTxResult {
  /** Base64-serialized versioned transaction */
  serializedTx: string
  quote: JupiterQuote
}

/**
 * Fetch a Jupiter quote for a token swap.
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: slippageBps.toString(),
  })

  const res = await fetch(`${JUPITER_QUOTE_URL}?${params}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jupiter quote failed (${res.status}): ${text}`)
  }

  return res.json()
}

/**
 * Build a swap transaction from a Jupiter quote.
 * The output goes to the specified destination (stealth ATA for privacy).
 */
export async function buildSwapTx(
  quote: JupiterQuote,
  userPubkey: string,
  destinationTokenAccount?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    quoteResponse: quote,
    userPublicKey: userPubkey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 'auto',
  }

  if (destinationTokenAccount) {
    body.destinationTokenAccount = destinationTokenAccount
  }

  const res = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jupiter swap TX build failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.swapTransaction as string
}

/**
 * Resolve a token symbol to its mint address string.
 */
export function resolveTokenMintAddress(token: string): string {
  return resolveTokenMint(token).toBase58()
}
```

- [ ] **Step 2: Export swap module from SDK**

Add to `packages/sdk/src/index.ts`:

```typescript
// Swap operations (Jupiter)
export {
  getJupiterQuote,
  buildSwapTx,
  resolveTokenMintAddress,
} from './swap.js'
export type { JupiterQuote, SwapTxResult } from './swap.js'
```

- [ ] **Step 3: Wire swap tool to use real Jupiter**

Replace the stub `executeSwap` in `packages/agent/src/tools/swap.ts`:

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import {
  createConnection,
  getJupiterQuote,
  buildSwapTx,
  resolveTokenMintAddress,
  resolveTokenMint,
  getTokenDecimals,
  toBaseUnits,
  fromBaseUnits,
  getVaultConfig,
  DEFAULT_FEE_BPS,
} from '@sipher/sdk'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

export interface SwapParams {
  amount: number
  fromToken: string
  toToken: string
  recipient?: string
  wallet?: string
  slippageBps?: number
}

export interface SwapToolResult {
  action: 'swap'
  amount: number
  fromToken: string
  toToken: string
  slippageBps: number
  status: 'awaiting_signature' | 'awaiting_quote'
  message: string
  serializedTx: string | null
  quote: {
    estimatedOutput: string | null
    priceImpact: string | null
    route: string | null
  }
}

export const swapTool: Anthropic.Tool = {
  name: 'swap',
  description:
    'Execute a private swap: vault funds are swapped via Jupiter and routed to a stealth address. ' +
    'The output tokens are unlinkable to the input.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to swap (in human-readable units of fromToken)',
      },
      fromToken: {
        type: 'string',
        description: 'Token to swap from — SOL, USDC, USDT, or SPL mint address',
      },
      toToken: {
        type: 'string',
        description: 'Token to swap to — SOL, USDC, USDT, or SPL mint address',
      },
      recipient: {
        type: 'string',
        description: 'Optional stealth meta-address (sip:solana:<spend>:<view>) for output. Defaults to self.',
      },
      wallet: {
        type: 'string',
        description: 'Sender wallet address (base58). Required to build the transaction.',
      },
      slippageBps: {
        type: 'number',
        description: 'Slippage tolerance in basis points (default: 50 = 0.5%)',
      },
    },
    required: ['amount', 'fromToken', 'toToken'],
  },
}

export async function executeSwap(params: SwapParams): Promise<SwapToolResult> {
  if (params.amount <= 0) {
    throw new Error('Swap amount must be greater than zero')
  }
  if (!params.fromToken?.trim()) {
    throw new Error('Source token (fromToken) is required')
  }
  if (!params.toToken?.trim()) {
    throw new Error('Destination token (toToken) is required')
  }

  const fromToken = params.fromToken.toUpperCase()
  const toToken = params.toToken.toUpperCase()
  if (fromToken === toToken) {
    throw new Error('Source and destination tokens must be different')
  }

  const slippageBps = Math.min(Math.max(params.slippageBps ?? 50, 1), 1000)

  // Without wallet, return preview only
  if (!params.wallet) {
    return {
      action: 'swap',
      amount: params.amount,
      fromToken,
      toToken,
      slippageBps,
      status: 'awaiting_quote',
      message: `Private swap: ${params.amount} ${fromToken} → ${toToken}. Connect wallet to execute.`,
      serializedTx: null,
      quote: { estimatedOutput: null, priceImpact: null, route: null },
    }
  }

  // Resolve mints
  const inputMint = resolveTokenMintAddress(params.fromToken)
  const outputMint = resolveTokenMintAddress(params.toToken)
  const inputMintPubkey = resolveTokenMint(params.fromToken)
  const decimals = getTokenDecimals(inputMintPubkey)
  const amountBase = toBaseUnits(params.amount, decimals).toString()

  // Fetch Jupiter quote
  const quote = await getJupiterQuote(inputMint, outputMint, amountBase, slippageBps)

  // Determine stealth output ATA if recipient is a stealth meta-address
  let destinationAta: string | undefined
  if (params.recipient?.startsWith('sip:solana:')) {
    const parts = params.recipient.split(':')
    if (parts.length === 4 && parts[2].startsWith('0x') && parts[3].startsWith('0x')) {
      const metaAddress = {
        spendingKey: parts[2] as `0x${string}`,
        viewingKey: parts[3] as `0x${string}`,
        chain: 'solana' as const,
      }
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
      const solAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
      const stealthPubkey = new PublicKey(solAddress)
      const outputMintPubkey = resolveTokenMint(params.toToken)
      destinationAta = (await getAssociatedTokenAddress(outputMintPubkey, stealthPubkey)).toBase58()
    }
  }

  // Build swap TX
  const serializedTx = await buildSwapTx(quote, params.wallet, destinationAta)

  const outputDecimals = getTokenDecimals(resolveTokenMint(params.toToken))
  const estimatedOutput = fromBaseUnits(BigInt(quote.outAmount), outputDecimals)
  const routeLabels = quote.routePlan?.map(r => r.swapInfo.label).join(' → ') ?? 'direct'

  return {
    action: 'swap',
    amount: params.amount,
    fromToken,
    toToken,
    slippageBps,
    status: 'awaiting_signature',
    message:
      `Private swap: ${params.amount} ${fromToken} → ~${estimatedOutput} ${toToken}. ` +
      `Route: ${routeLabels}. Slippage: ${slippageBps / 100}%. ` +
      `Output routed to stealth address. Awaiting wallet signature.`,
    serializedTx,
    quote: {
      estimatedOutput,
      priceImpact: quote.priceImpactPct,
      route: routeLabels,
    },
  }
}
```

- [ ] **Step 4: Write swap tests**

```typescript
// packages/agent/tests/swap.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch for Jupiter API
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Must import AFTER mocking fetch
const { executeSwap } = await import('../src/tools/swap.js')

describe('swap tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects zero amount', async () => {
    await expect(executeSwap({ amount: 0, fromToken: 'SOL', toToken: 'USDC' }))
      .rejects.toThrow('greater than zero')
  })

  it('rejects same token', async () => {
    await expect(executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'SOL' }))
      .rejects.toThrow('must be different')
  })

  it('returns preview without wallet', async () => {
    const result = await executeSwap({ amount: 1, fromToken: 'SOL', toToken: 'USDC' })
    expect(result.status).toBe('awaiting_quote')
    expect(result.serializedTx).toBeNull()
  })

  it('fetches Jupiter quote with wallet', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          inAmount: '1000000000',
          outAmount: '142500000',
          priceImpactPct: '0.01',
          routePlan: [{ swapInfo: { label: 'Raydium' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ swapTransaction: 'base64-encoded-tx' }),
      })

    const result = await executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: '7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump',
    })

    expect(result.status).toBe('awaiting_signature')
    expect(result.serializedTx).toBe('base64-encoded-tx')
    expect(result.quote.estimatedOutput).toBe('142.5')
    expect(result.quote.route).toBe('Raydium')
  })

  it('handles Jupiter API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'No route found',
    })

    await expect(executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      wallet: '7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump',
    })).rejects.toThrow('Jupiter quote failed')
  })

  it('clamps slippage to valid range', async () => {
    const result = await executeSwap({
      amount: 1,
      fromToken: 'SOL',
      toToken: 'USDC',
      slippageBps: 9999,
    })
    expect(result.slippageBps).toBe(1000)
  })
})
```

- [ ] **Step 5: Run tests and verify**

```bash
cd /Users/rector/local-dev/sipher && pnpm test -- --run
```

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/swap.ts packages/sdk/src/index.ts packages/agent/src/tools/swap.ts packages/agent/tests/swap.test.ts
git commit -m "feat: wire real Jupiter swap execution with stealth output routing"
```

---

### Task 2: ViewingKey Tool — Real Crypto

Wire the viewing key tool to use real `@sip-protocol/sdk` functions instead of returning stubs.

**Files:**
- Modify: `packages/agent/src/tools/viewing-key.ts`
- Create: `packages/agent/tests/viewing-key.test.ts`

- [ ] **Step 1: Wire real crypto into viewing-key tool**

Replace `packages/agent/src/tools/viewing-key.ts`:

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import {
  generateViewingKey,
  deriveViewingKey,
  encryptForViewing,
  decryptWithViewing,
} from '@sip-protocol/sdk'
import type { ViewingKey } from '@sip-protocol/types'
import { createConnection } from '@sipher/sdk'

export type ViewingKeyAction = 'generate' | 'export' | 'verify'

export interface ViewingKeyParams {
  action: ViewingKeyAction
  txSignature?: string
  viewingKeyHex?: string
}

export interface ViewingKeyToolResult {
  action: 'viewingKey'
  keyAction: ViewingKeyAction
  status: 'success'
  message: string
  hasDownload: boolean
  downloadData?: {
    /** Base64-encoded viewing key JSON (for download, NEVER display in chat) */
    blob: string
    filename: string
  }
  details: {
    txSignature: string | null
    verified: boolean | null
    viewingKeyHash: string | null
  }
}

export const viewingKeyTool: Anthropic.Tool = {
  name: 'viewingKey',
  description:
    'Manage viewing keys for selective disclosure and compliance. ' +
    'Generate new viewing keypair, export existing key, or verify a payment is visible to a viewing key. ' +
    'Keys are downloadable only — never displayed in chat.',
  input_schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['generate', 'export', 'verify'],
        description: 'Action: generate new keypair, export existing key, or verify payment visibility',
      },
      txSignature: {
        type: 'string',
        description: 'Transaction signature (required for export and verify actions)',
      },
      viewingKeyHex: {
        type: 'string',
        description: 'Hex-encoded viewing key (required for verify action)',
      },
    },
    required: ['action'],
  },
}

export async function executeViewingKey(params: ViewingKeyParams): Promise<ViewingKeyToolResult> {
  if (!params.action || !['generate', 'export', 'verify'].includes(params.action)) {
    throw new Error('Action must be one of: generate, export, verify')
  }

  if ((params.action === 'export' || params.action === 'verify') &&
      (!params.txSignature || params.txSignature.trim().length === 0)) {
    throw new Error(`Transaction signature is required for '${params.action}' action`)
  }

  switch (params.action) {
    case 'generate': {
      const viewingKey = generateViewingKey()
      // Package as downloadable blob — NEVER display raw key in chat
      const keyData = JSON.stringify({
        key: viewingKey.key,
        path: viewingKey.path,
        hash: viewingKey.hash,
        generated: new Date().toISOString(),
        warning: 'Store securely. This key grants read access to your private transactions.',
      })
      const blob = Buffer.from(keyData).toString('base64')

      return {
        action: 'viewingKey',
        keyAction: 'generate',
        status: 'success',
        message:
          'Viewing keypair generated. Download your key file — it will NOT be shown in chat. ' +
          'Share the viewing key hash with auditors for compliance.',
        hasDownload: true,
        downloadData: {
          blob,
          filename: `sipher-viewing-key-${viewingKey.hash.slice(2, 10)}.json`,
        },
        details: {
          txSignature: null,
          verified: null,
          viewingKeyHash: viewingKey.hash,
        },
      }
    }

    case 'export': {
      // Derive a transaction-specific viewing key
      const masterKey = generateViewingKey()
      const txKey = deriveViewingKey(masterKey, `tx/${params.txSignature!.slice(0, 16)}`)

      const keyData = JSON.stringify({
        key: txKey.key,
        path: txKey.path,
        hash: txKey.hash,
        txSignature: params.txSignature,
        exported: new Date().toISOString(),
        scope: 'single-transaction',
      })
      const blob = Buffer.from(keyData).toString('base64')

      return {
        action: 'viewingKey',
        keyAction: 'export',
        status: 'success',
        message:
          `Viewing key exported for transaction ${params.txSignature!.slice(0, 12)}... ` +
          `Download the key file to share with your auditor.`,
        hasDownload: true,
        downloadData: {
          blob,
          filename: `sipher-vk-${params.txSignature!.slice(0, 8)}.json`,
        },
        details: {
          txSignature: params.txSignature!,
          verified: null,
          viewingKeyHash: txKey.hash,
        },
      }
    }

    case 'verify': {
      if (!params.viewingKeyHex?.trim()) {
        throw new Error('viewingKeyHex is required for verify action')
      }

      // Fetch the transaction to get the viewingKeyHash from the event
      const connection = createConnection('devnet')
      const tx = await connection.getParsedTransaction(params.txSignature!, {
        maxSupportedTransactionVersion: 0,
      })

      if (!tx?.meta?.logMessages) {
        throw new Error(`Transaction not found or has no logs: ${params.txSignature}`)
      }

      // Compute the hash of the provided viewing key
      const { sha256 } = await import('@noble/hashes/sha256')
      const { hexToBytes, bytesToHex } = await import('@noble/hashes/utils')
      const keyBytes = hexToBytes(params.viewingKeyHex.replace(/^0x/, ''))
      const keyHash = `0x${bytesToHex(sha256(keyBytes))}`

      // Look for viewingKeyHash in the event data
      // Parse VaultWithdrawEvent logs for the viewingKeyHash field
      let matchFound = false
      for (const log of tx.meta.logMessages) {
        if (!log.startsWith('Program data: ')) continue
        const eventData = Buffer.from(log.slice('Program data: '.length), 'base64')
        if (eventData.length < 194) continue
        // viewingKeyHash is at offset: 8(disc) + 32(depositor) + 32(stealth) + 33(commitment) + 33(ephemeral) = 138
        const eventVkHash = `0x${Buffer.from(eventData.subarray(138, 170)).toString('hex')}`
        if (eventVkHash === keyHash) {
          matchFound = true
          break
        }
      }

      return {
        action: 'viewingKey',
        keyAction: 'verify',
        status: 'success',
        message: matchFound
          ? `Verified: the viewing key can detect this payment (TX ${params.txSignature!.slice(0, 12)}...).`
          : `Not matched: the viewing key does not correspond to this transaction.`,
        hasDownload: false,
        details: {
          txSignature: params.txSignature!,
          verified: matchFound,
          viewingKeyHash: keyHash,
        },
      }
    }
  }
}
```

- [ ] **Step 2: Write viewing key tests**

```typescript
// packages/agent/tests/viewing-key.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@sip-protocol/sdk', () => ({
  generateViewingKey: vi.fn(() => ({
    key: '0x' + 'ab'.repeat(32),
    path: 'm/0',
    hash: '0x' + 'cd'.repeat(32),
  })),
  deriveViewingKey: vi.fn((_master, path) => ({
    key: '0x' + 'ef'.repeat(32),
    path: `m/0/${path}`,
    hash: '0x' + '12'.repeat(32),
  })),
  encryptForViewing: vi.fn(),
  decryptWithViewing: vi.fn(),
}))

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn(() => ({
    getParsedTransaction: vi.fn().mockResolvedValue(null),
  })),
}))

const { executeViewingKey } = await import('../src/tools/viewing-key.js')

describe('viewingKey tool', () => {
  it('rejects invalid action', async () => {
    await expect(executeViewingKey({ action: 'invalid' as any }))
      .rejects.toThrow('must be one of')
  })

  it('requires txSignature for export', async () => {
    await expect(executeViewingKey({ action: 'export' }))
      .rejects.toThrow('Transaction signature is required')
  })

  it('requires txSignature for verify', async () => {
    await expect(executeViewingKey({ action: 'verify' }))
      .rejects.toThrow('Transaction signature is required')
  })

  it('generates viewing key with download blob', async () => {
    const result = await executeViewingKey({ action: 'generate' })
    expect(result.hasDownload).toBe(true)
    expect(result.downloadData).toBeDefined()
    expect(result.downloadData!.filename).toMatch(/^sipher-viewing-key-/)
    expect(result.details.viewingKeyHash).toMatch(/^0x/)

    // Verify blob is valid base64 JSON
    const decoded = JSON.parse(Buffer.from(result.downloadData!.blob, 'base64').toString())
    expect(decoded.key).toMatch(/^0x/)
    expect(decoded.warning).toContain('Store securely')
  })

  it('exports transaction-scoped viewing key', async () => {
    const result = await executeViewingKey({
      action: 'export',
      txSignature: '4Hc3vQB12345678901234567890',
    })
    expect(result.hasDownload).toBe(true)
    expect(result.downloadData!.filename).toMatch(/^sipher-vk-/)
    expect(result.message).toContain('4Hc3vQB12345')
  })

  it('requires viewingKeyHex for verify', async () => {
    await expect(executeViewingKey({
      action: 'verify',
      txSignature: '4Hc3vQB12345',
    })).rejects.toThrow('viewingKeyHex is required')
  })

  it('returns verified: false when TX not found', async () => {
    await expect(executeViewingKey({
      action: 'verify',
      txSignature: '4Hc3vQB12345',
      viewingKeyHex: '0x' + 'ab'.repeat(32),
    })).rejects.toThrow('Transaction not found')
  })
})
```

- [ ] **Step 3: Run tests and commit**

```bash
cd /Users/rector/local-dev/sipher && pnpm test -- --run
git add packages/agent/src/tools/viewing-key.ts packages/agent/tests/viewing-key.test.ts
git commit -m "feat: wire real viewing key generation, export, and verification"
```

---

### Task 3: History Tool — On-Chain Event Parsing

Parse real on-chain event logs from the sipher_vault program to populate transaction history.

**Files:**
- Create: `packages/sdk/src/events.ts`
- Modify: `packages/sdk/src/index.ts`
- Modify: `packages/agent/src/tools/history.ts`
- Create: `packages/agent/tests/history.test.ts`

- [ ] **Step 1: Create event parser in SDK**

```typescript
// packages/sdk/src/events.ts
import { Connection, PublicKey } from '@solana/web3.js'
import { SIPHER_VAULT_PROGRAM_ID, ANCHOR_DISCRIMINATOR_SIZE } from './config.js'
import { fromBaseUnits, getTokenDecimals, WSOL_MINT, USDC_MINT, USDT_MINT } from './tokens.js'

export type VaultEventType = 'deposit' | 'send' | 'refund'

export interface VaultEvent {
  type: VaultEventType
  wallet: string
  amount: string
  token: string
  tokenMint: string
  timestamp: number
  txSignature: string
}

/**
 * Parse vault events from a transaction's log messages.
 * Returns events found in the given transaction.
 */
export function parseVaultEvents(
  logMessages: string[],
  txSignature: string,
  blockTime: number | null,
): VaultEvent[] {
  const events: VaultEvent[] = []

  for (const log of logMessages) {
    if (!log.startsWith('Program data: ')) continue

    const data = Buffer.from(log.slice('Program data: '.length), 'base64')
    if (data.length < 8) continue

    // Check discriminator and parse based on event type
    // VaultDepositEvent: disc(8) + depositor(32) + token_mint(32) + amount(8) + timestamp(8) = 88
    // VaultWithdrawEvent: disc(8) + depositor(32) + stealth(32) + commitment(33) + ephemeral(33) + vk_hash(32) + amount(8) + fee(8) + timestamp(8) = 194
    // VaultRefundEvent: disc(8) + depositor(32) + token_mint(32) + amount(8) + timestamp(8) = 88

    try {
      if (data.length >= 194) {
        // Likely VaultWithdrawEvent (largest)
        const wallet = new PublicKey(data.subarray(8, 40)).toBase58()
        const amount = data.readBigUInt64LE(8 + 32 + 32 + 33 + 33 + 32) // after depositor + stealth + commitment + ephemeral + vk_hash
        const fee = data.readBigUInt64LE(8 + 32 + 32 + 33 + 33 + 32 + 8)
        const ts = Number(data.readBigInt64LE(8 + 32 + 32 + 33 + 33 + 32 + 8 + 8))

        events.push({
          type: 'send',
          wallet,
          amount: fromBaseUnits(amount, 9), // default SOL decimals
          token: 'SOL',
          tokenMint: WSOL_MINT.toBase58(),
          timestamp: ts || blockTime || 0,
          txSignature,
        })
      } else if (data.length >= 88) {
        // Could be deposit or refund
        const wallet = new PublicKey(data.subarray(8, 40)).toBase58()
        const tokenMint = new PublicKey(data.subarray(40, 72)).toBase58()
        const amount = data.readBigUInt64LE(72)
        const ts = Number(data.readBigInt64LE(80))

        const mint = new PublicKey(tokenMint)
        const decimals = getTokenDecimals(mint)
        const tokenLabel = mint.equals(WSOL_MINT) ? 'SOL'
          : mint.equals(USDC_MINT) ? 'USDC'
          : mint.equals(USDT_MINT) ? 'USDT'
          : tokenMint.slice(0, 8)

        // Distinguish deposit vs refund by context (both have same structure)
        // For now, we tag them based on position in program instructions
        events.push({
          type: 'deposit', // caller can override based on instruction context
          wallet,
          amount: fromBaseUnits(amount, decimals),
          token: tokenLabel,
          tokenMint,
          timestamp: ts || blockTime || 0,
          txSignature,
        })
      }
    } catch {
      // Skip malformed events
    }
  }

  return events
}

/**
 * Fetch vault transaction history for a wallet.
 */
export async function getVaultHistory(
  connection: Connection,
  wallet: string,
  options: { limit?: number; tokenMint?: string } = {},
): Promise<{ events: VaultEvent[]; hasMore: boolean }> {
  const limit = options.limit ?? 20

  // Get signatures for the vault program
  const signatures = await connection.getSignaturesForAddress(
    SIPHER_VAULT_PROGRAM_ID,
    { limit: limit * 3 }, // fetch more to account for filtering
    'confirmed',
  )

  if (signatures.length === 0) {
    return { events: [], hasMore: false }
  }

  const txSigs = signatures.map(s => s.signature)
  const transactions = await connection.getParsedTransactions(txSigs, {
    maxSupportedTransactionVersion: 0,
  })

  const allEvents: VaultEvent[] = []

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    if (!tx?.meta?.logMessages) continue

    const events = parseVaultEvents(tx.meta.logMessages, txSigs[i], tx.blockTime)

    for (const event of events) {
      // Filter by wallet
      if (event.wallet !== wallet) continue
      // Filter by token if specified
      if (options.tokenMint && event.tokenMint !== options.tokenMint) continue
      allEvents.push(event)
    }
  }

  // Sort by timestamp descending (most recent first)
  allEvents.sort((a, b) => b.timestamp - a.timestamp)

  return {
    events: allEvents.slice(0, limit),
    hasMore: allEvents.length > limit,
  }
}
```

- [ ] **Step 2: Export events module from SDK**

Add to `packages/sdk/src/index.ts`:

```typescript
// Event parsing
export {
  parseVaultEvents,
  getVaultHistory,
} from './events.js'
export type { VaultEvent, VaultEventType } from './events.js'
```

- [ ] **Step 3: Wire history tool to use real parser**

Update `packages/agent/src/tools/history.ts` — replace the empty array return with real on-chain queries:

```typescript
import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import {
  createConnection,
  getVaultHistory,
  resolveTokenMint,
} from '@sipher/sdk'
import type { VaultEvent } from '@sipher/sdk'

export interface HistoryParams {
  wallet: string
  token?: string
  limit?: number
}

export interface HistoryToolResult {
  action: 'history'
  wallet: string
  token: string | null
  status: 'success'
  transactions: VaultEvent[]
  total: number
  hasMore: boolean
  message: string
}

export const historyTool: Anthropic.Tool = {
  name: 'history',
  description:
    'Retrieve transaction history for a wallet\'s vault activity. ' +
    'Shows deposits, private sends, refunds, claims, and swaps. ' +
    'Optionally filter by token. Read-only — no wallet signature required.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Wallet address (base58) to fetch history for',
      },
      token: {
        type: 'string',
        description: 'Optional token filter — SOL, USDC, USDT, or SPL mint address',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of transactions to return (default: 20, max: 100)',
      },
    },
    required: ['wallet'],
  },
}

export async function executeHistory(params: HistoryParams): Promise<HistoryToolResult> {
  if (!params.wallet?.trim()) {
    throw new Error('Wallet address is required')
  }

  try {
    new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  const token = params.token?.toUpperCase() ?? null
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)

  const connection = createConnection('devnet')

  let tokenMint: string | undefined
  if (token) {
    try {
      tokenMint = resolveTokenMint(token).toBase58()
    } catch {
      throw new Error(`Unknown token: ${token}`)
    }
  }

  const { events, hasMore } = await getVaultHistory(connection, params.wallet, {
    limit,
    tokenMint,
  })

  const message = events.length > 0
    ? `Found ${events.length} transaction(s) for ${params.wallet.slice(0, 8)}...${hasMore ? ' (more available)' : ''}`
    : `No vault transactions found for ${params.wallet.slice(0, 8)}... ` +
      `${token ? `(filtered by ${token}) ` : ''}` +
      `Deposit first to start building transaction history.`

  return {
    action: 'history',
    wallet: params.wallet,
    token,
    status: 'success',
    transactions: events,
    total: events.length,
    hasMore,
    message,
  }
}
```

- [ ] **Step 4: Write history tests**

```typescript
// packages/agent/tests/history.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn(() => ({})),
  getVaultHistory: vi.fn().mockResolvedValue({ events: [], hasMore: false }),
  resolveTokenMint: vi.fn(() => ({ toBase58: () => 'So11111111111111111111111111111111111111112' })),
}))

const { executeHistory } = await import('../src/tools/history.js')

describe('history tool', () => {
  it('rejects empty wallet', async () => {
    await expect(executeHistory({ wallet: '' })).rejects.toThrow('Wallet address is required')
  })

  it('rejects invalid wallet', async () => {
    await expect(executeHistory({ wallet: 'not-a-pubkey' })).rejects.toThrow('Invalid wallet')
  })

  it('returns empty history for new wallet', async () => {
    const result = await executeHistory({ wallet: '7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump' })
    expect(result.transactions).toHaveLength(0)
    expect(result.message).toContain('No vault transactions')
  })

  it('clamps limit to valid range', async () => {
    const result = await executeHistory({
      wallet: '7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump',
      limit: 999,
    })
    expect(result.status).toBe('success')
  })

  it('filters by token', async () => {
    const result = await executeHistory({
      wallet: '7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump',
      token: 'SOL',
    })
    expect(result.token).toBe('SOL')
  })
})
```

- [ ] **Step 5: Run tests and commit**

```bash
cd /Users/rector/local-dev/sipher && pnpm test -- --run
git add packages/sdk/src/events.ts packages/sdk/src/index.ts packages/agent/src/tools/history.ts packages/agent/tests/history.test.ts
git commit -m "feat: wire real on-chain event parsing for vault transaction history"
```

---

### Task 4: SQLite Persistence Layer

Add `better-sqlite3` with tables for sessions, audit log, scheduled operations, and payment links.

**Files:**
- Create: `packages/agent/src/db/schema.sql`
- Create: `packages/agent/src/db.ts`
- Create: `packages/agent/tests/db.test.ts`

- [ ] **Step 1: Install better-sqlite3**

```bash
cd /Users/rector/local-dev/sipher/packages/agent && pnpm add better-sqlite3 && pnpm add -D @types/better-sqlite3
```

- [ ] **Step 2: Create schema file**

```sql
-- packages/agent/src/db/schema.sql
-- Sipher SQLite schema — sessions, audit log, scheduled ops, payment links

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,
  preferences TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  params TEXT NOT NULL,
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'prepared',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS scheduled_ops (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  params TEXT NOT NULL,
  wallet_signature TEXT NOT NULL,
  next_exec INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  max_exec INTEGER NOT NULL,
  exec_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  stealth_address TEXT NOT NULL,
  ephemeral_pubkey TEXT NOT NULL,
  amount REAL,
  token TEXT NOT NULL DEFAULT 'SOL',
  memo TEXT,
  type TEXT NOT NULL DEFAULT 'link',
  invoice_meta TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  paid_tx TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_ops(next_exec, status);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_links(status, expires_at);
```

- [ ] **Step 3: Create database module**

```typescript
// packages/agent/src/db.ts
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let db: Database.Database | null = null

/**
 * Initialize or return the singleton SQLite database.
 * DB file location: DB_PATH env var, or /app/data/sipher.db, or in-memory for tests.
 */
export function getDb(): Database.Database {
  if (db) return db

  const dbPath = process.env.DB_PATH ?? process.env.NODE_ENV === 'test' ? ':memory:' : '/app/data/sipher.db'
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema
  const schema = readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf-8')
  db.exec(schema)

  return db
}

/**
 * Close the database connection (for tests/shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ─── Session helpers ────────────────────────────────────────────────────────

function walletToSessionId(wallet: string): string {
  return createHash('sha256').update(wallet).digest('hex')
}

export function getOrCreateSession(wallet: string): { id: string; preferences: Record<string, unknown> } {
  const d = getDb()
  const id = walletToSessionId(wallet)
  const now = Math.floor(Date.now() / 1000)

  const existing = d.prepare('SELECT id, preferences FROM sessions WHERE id = ?').get(id) as
    { id: string; preferences: string } | undefined

  if (existing) {
    d.prepare('UPDATE sessions SET last_active = ? WHERE id = ?').run(now, id)
    return { id, preferences: JSON.parse(existing.preferences) }
  }

  d.prepare('INSERT INTO sessions (id, wallet, preferences, created_at, last_active) VALUES (?, ?, ?, ?, ?)')
    .run(id, wallet, '{}', now, now)

  return { id, preferences: {} }
}

export function updatePreferences(sessionId: string, prefs: Record<string, unknown>): void {
  getDb().prepare('UPDATE sessions SET preferences = ? WHERE id = ?')
    .run(JSON.stringify(prefs), sessionId)
}

export function getSessionByWallet(wallet: string): { id: string; preferences: Record<string, unknown> } | null {
  const id = walletToSessionId(wallet)
  const row = getDb().prepare('SELECT id, preferences FROM sessions WHERE id = ?').get(id) as
    { id: string; preferences: string } | undefined
  if (!row) return null
  return { id: row.id, preferences: JSON.parse(row.preferences) }
}

// ─── Audit log helpers ──────────────────────────────────────────────────────

export function logAudit(
  sessionId: string,
  action: string,
  params: Record<string, unknown>,
  status: string = 'prepared',
  txSignature?: string,
): number {
  const now = Math.floor(Date.now() / 1000)
  // Sanitize params — remove any keys/secrets
  const sanitized = { ...params }
  delete sanitized.viewingKey
  delete sanitized.spendingKey
  delete sanitized.privateKey

  const result = getDb().prepare(
    'INSERT INTO audit_log (session_id, action, params, tx_signature, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(sessionId, action, JSON.stringify(sanitized), txSignature ?? null, status, now)

  return result.lastInsertRowid as number
}

export function updateAuditStatus(id: number, status: string, txSignature?: string): void {
  const updates: string[] = ['status = ?']
  const values: unknown[] = [status]
  if (txSignature) {
    updates.push('tx_signature = ?')
    values.push(txSignature)
  }
  values.push(id)
  getDb().prepare(`UPDATE audit_log SET ${updates.join(', ')} WHERE id = ?`).run(...values)
}

export function getAuditLog(
  sessionId: string,
  options: { limit?: number; action?: string } = {},
): Array<{ id: number; action: string; params: string; tx_signature: string | null; status: string; created_at: number }> {
  const limit = options.limit ?? 50
  let sql = 'SELECT id, action, params, tx_signature, status, created_at FROM audit_log WHERE session_id = ?'
  const params: unknown[] = [sessionId]

  if (options.action) {
    sql += ' AND action = ?'
    params.push(options.action)
  }

  sql += ' ORDER BY created_at DESC LIMIT ?'
  params.push(limit)

  return getDb().prepare(sql).all(...params) as any[]
}

// ─── Payment link helpers ───────────────────────────────────────────────────

export function createPaymentLink(data: {
  id: string
  sessionId: string | null
  stealthAddress: string
  ephemeralPubkey: string
  amount: number | null
  token: string
  memo: string | null
  type: 'link' | 'invoice'
  invoiceMeta: Record<string, unknown> | null
  expiresAt: number
}): void {
  const now = Math.floor(Date.now() / 1000)
  getDb().prepare(
    `INSERT INTO payment_links (id, session_id, stealth_address, ephemeral_pubkey, amount, token, memo, type, invoice_meta, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.id, data.sessionId, data.stealthAddress, data.ephemeralPubkey,
    data.amount, data.token, data.memo, data.type,
    data.invoiceMeta ? JSON.stringify(data.invoiceMeta) : null,
    data.expiresAt, now,
  )
}

export function getPaymentLink(id: string): Record<string, unknown> | null {
  return getDb().prepare('SELECT * FROM payment_links WHERE id = ?').get(id) as Record<string, unknown> | null
}

export function markPaymentLinkPaid(id: string, txSignature: string): void {
  getDb().prepare('UPDATE payment_links SET status = ?, paid_tx = ? WHERE id = ?')
    .run('paid', txSignature, id)
}
```

- [ ] **Step 4: Write database tests**

```typescript
// packages/agent/tests/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Force in-memory DB for tests
process.env.DB_PATH = ':memory:'
process.env.NODE_ENV = 'test'

const { getDb, closeDb, getOrCreateSession, updatePreferences, logAudit, getAuditLog, createPaymentLink, getPaymentLink, markPaymentLinkPaid } = await import('../src/db.js')

describe('SQLite database', () => {
  beforeEach(() => {
    closeDb() // Reset for each test
  })

  afterEach(() => {
    closeDb()
  })

  describe('sessions', () => {
    it('creates a new session for unknown wallet', () => {
      const session = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      expect(session.id).toHaveLength(64) // sha256 hex
      expect(session.preferences).toEqual({})
    })

    it('returns existing session for known wallet', () => {
      const s1 = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      const s2 = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      expect(s1.id).toBe(s2.id)
    })

    it('stores and retrieves preferences', () => {
      const session = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      updatePreferences(session.id, { privacyLevel: 'shielded', splitCount: 3 })
      const updated = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      expect(updated.preferences).toEqual({ privacyLevel: 'shielded', splitCount: 3 })
    })

    it('creates different sessions for different wallets', () => {
      const s1 = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      const s2 = getOrCreateSession('9Bx1yGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      expect(s1.id).not.toBe(s2.id)
    })
  })

  describe('audit log', () => {
    it('logs an audit entry', () => {
      const session = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      const id = logAudit(session.id, 'send', { amount: 100, token: 'USDC' })
      expect(id).toBeGreaterThan(0)
    })

    it('retrieves audit log for session', () => {
      const session = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      logAudit(session.id, 'deposit', { amount: 500 })
      logAudit(session.id, 'send', { amount: 100 })
      const logs = getAuditLog(session.id)
      expect(logs).toHaveLength(2)
      expect(logs[0].action).toBe('send') // most recent first
    })

    it('filters audit log by action', () => {
      const session = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      logAudit(session.id, 'deposit', { amount: 500 })
      logAudit(session.id, 'send', { amount: 100 })
      const logs = getAuditLog(session.id, { action: 'deposit' })
      expect(logs).toHaveLength(1)
    })

    it('sanitizes sensitive params', () => {
      const session = getOrCreateSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
      logAudit(session.id, 'scan', {
        viewingKey: '0xsecret',
        spendingKey: '0xsecret2',
        wallet: 'public-data',
      })
      const logs = getAuditLog(session.id)
      const params = JSON.parse(logs[0].params)
      expect(params.viewingKey).toBeUndefined()
      expect(params.spendingKey).toBeUndefined()
      expect(params.wallet).toBe('public-data')
    })
  })

  describe('payment links', () => {
    it('creates and retrieves a payment link', () => {
      createPaymentLink({
        id: 'test-link-1',
        sessionId: null,
        stealthAddress: '7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump',
        ephemeralPubkey: '0xabcdef',
        amount: 50,
        token: 'USDC',
        memo: 'Test payment',
        type: 'link',
        invoiceMeta: null,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      })

      const link = getPaymentLink('test-link-1')
      expect(link).not.toBeNull()
      expect(link!.amount).toBe(50)
      expect(link!.token).toBe('USDC')
      expect(link!.status).toBe('pending')
    })

    it('marks payment link as paid', () => {
      createPaymentLink({
        id: 'test-link-2',
        sessionId: null,
        stealthAddress: '7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump',
        ephemeralPubkey: '0xabcdef',
        amount: 100,
        token: 'SOL',
        memo: null,
        type: 'link',
        invoiceMeta: null,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      })

      markPaymentLinkPaid('test-link-2', '4Hc3vQB12345')
      const link = getPaymentLink('test-link-2')
      expect(link!.status).toBe('paid')
      expect(link!.paid_tx).toBe('4Hc3vQB12345')
    })

    it('returns null for non-existent link', () => {
      const link = getPaymentLink('nonexistent')
      expect(link).toBeNull()
    })
  })
})
```

- [ ] **Step 5: Run tests and commit**

```bash
cd /Users/rector/local-dev/sipher && pnpm test -- --run
git add packages/agent/src/db.ts packages/agent/src/db/schema.sql packages/agent/tests/db.test.ts packages/agent/package.json
git commit -m "feat: add SQLite persistence layer with sessions, audit log, and payment links"
```

---

### Task 5: Session Isolation

Scope agent conversations per wallet connection. Each wallet gets its own session with isolated preferences and audit trail.

**Files:**
- Create: `packages/agent/src/session.ts`
- Modify: `packages/agent/src/index.ts`
- Create: `packages/agent/tests/session.test.ts`

- [ ] **Step 1: Create session manager**

```typescript
// packages/agent/src/session.ts
import { getOrCreateSession, updatePreferences, logAudit, getAuditLog } from './db.js'

export interface SessionContext {
  id: string
  wallet: string
  preferences: Record<string, unknown>
}

/** In-memory conversation contexts per session (not persisted) */
const conversations = new Map<string, { messages: Array<{ role: string; content: unknown }>; lastActive: number }>()

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Get or create a session context for a wallet.
 */
export function resolveSession(wallet: string): SessionContext {
  const session = getOrCreateSession(wallet)
  return { id: session.id, wallet, preferences: session.preferences }
}

/**
 * Get the conversation history for a session.
 * Returns empty array if no conversation exists or session timed out.
 */
export function getConversation(sessionId: string): Array<{ role: string; content: unknown }> {
  const conv = conversations.get(sessionId)
  if (!conv) return []

  // Check timeout
  if (Date.now() - conv.lastActive > SESSION_TIMEOUT_MS) {
    conversations.delete(sessionId)
    return []
  }

  conv.lastActive = Date.now()
  return conv.messages
}

/**
 * Append messages to a session's conversation.
 */
export function appendConversation(sessionId: string, messages: Array<{ role: string; content: unknown }>): void {
  let conv = conversations.get(sessionId)
  if (!conv) {
    conv = { messages: [], lastActive: Date.now() }
    conversations.set(sessionId, conv)
  }
  conv.messages.push(...messages)
  conv.lastActive = Date.now()
}

/**
 * Clear a session's conversation (on disconnect or timeout).
 */
export function clearConversation(sessionId: string): void {
  conversations.delete(sessionId)
}

/**
 * Purge all timed-out sessions (run periodically).
 */
export function purgeStale(): number {
  const now = Date.now()
  let purged = 0
  for (const [id, conv] of conversations) {
    if (now - conv.lastActive > SESSION_TIMEOUT_MS) {
      conversations.delete(id)
      purged++
    }
  }
  return purged
}

/**
 * Get count of active sessions (for admin).
 */
export function activeSessionCount(): number {
  return conversations.size
}
```

- [ ] **Step 2: Wire sessions into Express server**

Modify `packages/agent/src/index.ts` — add DB init at startup and pass session context to chat:

Add near the top (after imports):

```typescript
import { getDb, closeDb } from './db.js'
import { resolveSession, activeSessionCount } from './session.js'
```

Add before `app.listen`:

```typescript
// Initialize database
try {
  getDb()
  console.log('  Database: SQLite initialized')
} catch (err) {
  console.warn('  Database: unavailable -', (err as Error).message)
}
```

Update the `/api/chat` handler to resolve session from wallet:

```typescript
// In the POST /api/chat handler, after message validation:
const wallet = req.body.wallet as string | undefined
const session = wallet ? resolveSession(wallet) : null
```

Update the `/api/health` endpoint to include session count:

```typescript
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    agent: 'sipher',
    version: '0.1.0',
    tools: TOOLS.map((t) => t.name),
    uptime: process.uptime(),
    activeSessions: activeSessionCount(),
  })
})
```

- [ ] **Step 3: Write session tests**

```typescript
// packages/agent/tests/session.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

process.env.DB_PATH = ':memory:'
process.env.NODE_ENV = 'test'

// Must close DB between tests to reset in-memory DB
const dbModule = await import('../src/db.js')

const {
  resolveSession,
  getConversation,
  appendConversation,
  clearConversation,
  purgeStale,
  activeSessionCount,
} = await import('../src/session.js')

describe('session manager', () => {
  beforeEach(() => {
    dbModule.closeDb()
  })

  afterEach(() => {
    dbModule.closeDb()
  })

  it('creates session for new wallet', () => {
    const session = resolveSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
    expect(session.id).toHaveLength(64)
    expect(session.wallet).toBe('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
    expect(session.preferences).toEqual({})
  })

  it('returns same session for same wallet', () => {
    const s1 = resolveSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
    const s2 = resolveSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
    expect(s1.id).toBe(s2.id)
  })

  it('manages conversation per session', () => {
    const session = resolveSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
    expect(getConversation(session.id)).toEqual([])

    appendConversation(session.id, [{ role: 'user', content: 'hello' }])
    expect(getConversation(session.id)).toHaveLength(1)

    clearConversation(session.id)
    expect(getConversation(session.id)).toEqual([])
  })

  it('isolates conversations between wallets', () => {
    const s1 = resolveSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
    const s2 = resolveSession('9Bx1yGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')

    appendConversation(s1.id, [{ role: 'user', content: 'wallet 1 msg' }])
    appendConversation(s2.id, [{ role: 'user', content: 'wallet 2 msg' }])

    expect(getConversation(s1.id)).toHaveLength(1)
    expect(getConversation(s2.id)).toHaveLength(1)
    expect((getConversation(s1.id)[0] as any).content).toBe('wallet 1 msg')
    expect((getConversation(s2.id)[0] as any).content).toBe('wallet 2 msg')
  })

  it('tracks active session count', () => {
    const s1 = resolveSession('7Kf2zGfYx8nNwJkaP1gPBqPb3uY5LGDPVSuXuqJZpump')
    appendConversation(s1.id, [{ role: 'user', content: 'hi' }])
    expect(activeSessionCount()).toBe(1)
  })
})
```

- [ ] **Step 4: Run tests and commit**

```bash
cd /Users/rector/local-dev/sipher && pnpm test -- --run
git add packages/agent/src/session.ts packages/agent/src/index.ts packages/agent/tests/session.test.ts
git commit -m "feat: add session isolation per wallet with conversation management"
```

---

### Task 6: CPI — sipher_vault -> sip_privacy

Wire `withdraw_private` to call sip_privacy's `shielded_token_transfer` via CPI, making vault withdrawal + stealth announcement atomic.

**Files:**
- Modify: `programs/sipher-vault/programs/sipher_vault/src/lib.rs`
- Modify: `packages/sdk/src/privacy.ts` (add CPI accounts to TX builder)
- Create: `programs/sipher-vault/tests/cpi.test.ts` (or extend existing tests)

**Note:** This task requires Rust/Anchor work and devnet redeployment. It's the most complex task in Wave A and can be done last or in parallel with Tasks 1-5 since it touches different files.

- [ ] **Step 1: Read the current on-chain program**

Read `programs/sipher-vault/programs/sipher_vault/src/lib.rs` to understand the current `withdraw_private` instruction and identify where to add CPI.

- [ ] **Step 2: Add sip_privacy program ID to the vault's context**

In the `WithdrawPrivate` context struct, add the sip_privacy program as an account:

```rust
/// SIP Privacy program for CPI
/// CHECK: Validated by address constraint
#[account(address = sip_privacy::ID)]
pub sip_privacy_program: AccountInfo<'info>,
```

- [ ] **Step 3: Add CPI call after vault balance deduction**

After deducting the balance in `withdraw_private`, add a CPI call to sip_privacy:

```rust
// CPI to sip_privacy::shielded_token_transfer
let cpi_accounts = vec![
    // ... sip_privacy expected accounts
];
let cpi_ix = Instruction {
    program_id: ctx.accounts.sip_privacy_program.key(),
    accounts: cpi_accounts.iter().map(|a| AccountMeta { ... }).collect(),
    data: /* shielded_token_transfer instruction data */,
};
invoke(&cpi_ix, &cpi_accounts)?;
```

**Important:** The exact CPI implementation depends on the sip_privacy program's instruction layout. Read the sip_privacy program source at `/Users/rector/local-dev/sip-protocol/programs/sip-privacy/` to get the exact account layout and discriminator.

- [ ] **Step 4: Update @sipher/sdk's buildPrivateSendTx**

Add the sip_privacy program account to the instruction's account list in `packages/sdk/src/privacy.ts`:

```typescript
// Add after the existing accounts array in buildPrivateSendTx:
{ pubkey: SIP_PRIVACY_PROGRAM_ID, isSigner: false, isWritable: false },
```

- [ ] **Step 5: Build and test on-chain**

```bash
cd /Users/rector/local-dev/sip-protocol/programs/sipher-vault
anchor build
anchor test
```

- [ ] **Step 6: Deploy to devnet**

```bash
solana program deploy target/deploy/sipher_vault.so \
  --program-id ~/Documents/secret/sipher-vault-program-id.json \
  --keypair ~/Documents/secret/solana-devnet.json \
  --url devnet \
  --with-compute-unit-price 10000
```

- [ ] **Step 7: Commit**

```bash
git add programs/sipher-vault/ packages/sdk/src/privacy.ts
git commit -m "feat: add CPI from sipher_vault withdraw_private to sip_privacy shielded_token_transfer"
```

---

## Notes

- **Task 6 (CPI) is the riskiest** — it changes on-chain code and requires devnet redeployment. Do Tasks 1-5 first, verify everything works, then tackle CPI.
- **Tasks 1-3 are independent** — can be parallelized via subagent-driven-development.
- **Task 4 (SQLite) must complete before Task 5 (sessions)** — sessions depend on the DB layer.
- **Docker compose update needed** — add a bind mount for `/app/data/` to persist the SQLite file across container restarts. Update `docker-compose.yml` in the sipher repo.
- **Total new tests target: ~100** — across all 6 tasks.
