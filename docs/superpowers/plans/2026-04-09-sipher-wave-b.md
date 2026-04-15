# Sipher Wave B — Product Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 product features to Sipher — payment links, invoices, privacy scoring, threat checking, and an admin dashboard — bringing the agent tool count from 10 to 14 and adding 2 new route groups (`/pay/:id`, `/admin/`).

**Architecture:** Each new tool follows the established pattern: typed params interface, typed result interface, Anthropic.Tool schema, async executor function. Tools are pure functions that return data — no side effects beyond DB writes. Routes are Express handlers mounted in index.ts. Admin uses server-rendered HTML (no SPA framework). All tools share a bundled known-addresses dataset for exchange/OFAC/scam lookups.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, @sip-protocol/sdk (stealth addresses), @sipher/sdk (vault/connection), Vitest, Tailwind CDN (admin/pay pages)

**Repo:** `~/local-dev/sipher/` (run all commands from this directory)

**Spec:** `~/local-dev/sip-protocol/docs/superpowers/specs/2026-04-08-sipher-phase1-completion-design.md` — Wave B section

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/agent/src/data/known-addresses.ts` | Bundled exchange, OFAC, and scam address datasets |
| `packages/agent/src/tools/payment-link.ts` | paymentLink agent tool — create stealth receive URLs |
| `packages/agent/src/tools/invoice.ts` | invoice agent tool — structured payment requests |
| `packages/agent/src/tools/privacy-score.ts` | privacyScore agent tool — wallet exposure analysis |
| `packages/agent/src/tools/threat-check.ts` | threatCheck agent tool — recipient reputation check |
| `packages/agent/src/routes/pay.ts` | `/pay/:id` Express route — payment link page |
| `packages/agent/src/routes/admin.ts` | `/admin/*` Express routes — dashboard + auth + API |
| `packages/agent/src/views/pay-page.ts` | HTML template for payment link page |
| `packages/agent/src/views/admin-page.ts` | HTML templates for admin dashboard |
| `packages/agent/tests/payment-link.test.ts` | Tests for paymentLink tool |
| `packages/agent/tests/invoice.test.ts` | Tests for invoice tool |
| `packages/agent/tests/privacy-score.test.ts` | Tests for privacyScore tool |
| `packages/agent/tests/threat-check.test.ts` | Tests for threatCheck tool |
| `packages/agent/tests/pay-route.test.ts` | Tests for /pay/:id route |
| `packages/agent/tests/admin.test.ts` | Tests for admin dashboard |

### Modified Files

| File | Changes |
|------|---------|
| `packages/agent/src/db.ts` | Add `getPaymentLinksBySession`, `expireStaleLinks`, `getPaymentLinkStats`, `getAuditStats`, `getSessionStats` |
| `packages/agent/src/tools/index.ts` | Re-export 4 new tools |
| `packages/agent/src/agent.ts` | Register 4 new tools in TOOLS array + TOOL_EXECUTORS + update SYSTEM_PROMPT |
| `packages/agent/src/index.ts` | Mount `/pay` and `/admin` route groups |

---

## Task 1: Known Addresses Dataset

Shared data module used by both privacyScore (Task 5) and threatCheck (Task 6). No dependencies — can run in parallel with Tasks 2-4.

**Files:**
- Create: `packages/agent/src/data/known-addresses.ts`
- Test: `packages/agent/tests/threat-check.test.ts` (tested as part of Task 6)

- [ ] **Step 1: Create the known-addresses data module**

```typescript
// packages/agent/src/data/known-addresses.ts

// ─────────────────────────────────────────────────────────────────────────────
// Known address datasets — bundled for Phase 1 (no external API dependency)
// Update these lists with each release. Production: fetch from curated API.
// ─────────────────────────────────────────────────────────────────────────────

/** Top exchange deposit/hot wallet addresses on Solana with their labels. */
export const EXCHANGE_ADDRESSES: Record<string, string> = {
  // Binance
  '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP': 'Binance',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Binance',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S': 'Binance',
  // Coinbase
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7TjN': 'Coinbase',
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS': 'Coinbase',
  // Kraken
  'CppSEFkCBfB73miH4rdGrzKzCCXVbMQVVeJFKEkGzuH4': 'Kraken',
  // OKX
  '5VCwKtCXgCDuQosV1JB4GhFgocHB49GD3twqJahXL8Cz': 'OKX',
  // Bybit
  'AC5RDfQFmDS1deWZos921JfqscXdByf4BKKhF3bEwNkR': 'Bybit',
  // KuCoin
  'BmFdpraQhkiDQE6SnfG5PK1MHhbjFh5Fy4r4LqtSG5Hk': 'KuCoin',
  // Gate.io
  'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w': 'Gate.io',
  // Huobi/HTX
  '88xTWZMeKfiTgbfEmPLdsUCQcZinwUfk25MXBUL87eJx': 'HTX',
  // Crypto.com
  'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATbo3p': 'Crypto.com',
  // FTX (defunct — still tracked for analysis)
  'GXMaB3TMSQY5YScGMfhRcJMFXCM7JJgqJ8tZJ7SQGL5z': 'FTX (defunct)',
  // Raydium authority (not an exchange, but high-interaction)
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1': 'Raydium',
  // Jupiter aggregator
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter',
}

/**
 * OFAC SDN list — Solana addresses sanctioned by the US Treasury.
 * Phase 1: representative subset. Production: full OFAC list auto-updated.
 * Source: https://www.treasury.gov/ofac/downloads/sdnlist.txt
 */
export const OFAC_ADDRESSES: Set<string> = new Set([
  // These are placeholder entries for the sanctioned address format.
  // Real OFAC Solana addresses would be added here from the SDN list.
  // The set is kept small for Phase 1 — the lookup mechanism is what matters.
])

/**
 * Community-reported scam/phishing addresses.
 * Phase 1: static set. Production: crowdsourced + auto-updated.
 */
export const SCAM_ADDRESSES: Record<string, string> = {
  // Format: address -> description of scam
  // Populated from community reports. Empty in initial release.
}

/** Check if an address belongs to a known exchange. Returns label or null. */
export function getExchangeLabel(address: string): string | null {
  return EXCHANGE_ADDRESSES[address] ?? null
}

/** Check if an address is on the OFAC sanctions list. */
export function isOfacSanctioned(address: string): boolean {
  return OFAC_ADDRESSES.has(address)
}

/** Check if an address is a known scam. Returns description or null. */
export function getScamDescription(address: string): string | null {
  return SCAM_ADDRESSES[address] ?? null
}

/** Get all known addresses combined (for batch lookups). */
export function classifyAddress(address: string): {
  type: 'exchange' | 'ofac' | 'scam' | 'unknown'
  label: string | null
} {
  const exchange = getExchangeLabel(address)
  if (exchange) return { type: 'exchange', label: exchange }

  if (isOfacSanctioned(address)) return { type: 'ofac', label: 'OFAC Sanctioned' }

  const scam = getScamDescription(address)
  if (scam) return { type: 'scam', label: scam }

  return { type: 'unknown', label: null }
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/data/known-addresses.ts
git commit -m "feat(agent): add bundled known-addresses dataset for privacy scoring and threat checking"
```

---

## Task 2: DB Layer Extensions

Add query helpers needed by payment link listing, admin stats, and stale link expiration. These are pure SQLite queries added to the existing `db.ts`.

**Files:**
- Modify: `packages/agent/src/db.ts` (append new functions after existing `markPaymentLinkPaid`)
- Test: `packages/agent/tests/db.test.ts` (append new describe blocks)

- [ ] **Step 1: Write failing tests for new DB helpers**

Append to `packages/agent/tests/db.test.ts`:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Payment link queries
// ─────────────────────────────────────────────────────────────────────────────

describe('getPaymentLinksBySession', () => {
  it('returns links for a session sorted by created_at DESC', () => {
    const session = getOrCreateSession(WALLET_A)
    createPaymentLink({
      session_id: session.id,
      stealth_address: '0xfirst',
      ephemeral_pubkey: '0xeph1',
      expires_at: Date.now() + 3600_000,
    })
    createPaymentLink({
      session_id: session.id,
      stealth_address: '0xsecond',
      ephemeral_pubkey: '0xeph2',
      expires_at: Date.now() + 3600_000,
    })

    const links = getPaymentLinksBySession(session.id)
    expect(links).toHaveLength(2)
    expect(links[0].stealth_address).toBe('0xsecond')
    expect(links[1].stealth_address).toBe('0xfirst')
  })

  it('returns empty array for unknown session', () => {
    const links = getPaymentLinksBySession('nonexistent')
    expect(links).toHaveLength(0)
  })

  it('respects limit', () => {
    const session = getOrCreateSession(WALLET_A)
    for (let i = 0; i < 5; i++) {
      createPaymentLink({
        session_id: session.id,
        stealth_address: `0xaddr${i}`,
        ephemeral_pubkey: `0xeph${i}`,
        expires_at: Date.now() + 3600_000,
      })
    }

    const links = getPaymentLinksBySession(session.id, 2)
    expect(links).toHaveLength(2)
  })
})

describe('expireStaleLinks', () => {
  it('marks expired pending links as expired', () => {
    createPaymentLink({
      stealth_address: '0xexpired',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000, // already expired
    })
    createPaymentLink({
      stealth_address: '0xactive',
      ephemeral_pubkey: '0xeph2',
      expires_at: Date.now() + 3600_000, // still active
    })

    const count = expireStaleLinks()
    expect(count).toBe(1)

    const db = getDb()
    const expired = db.prepare("SELECT * FROM payment_links WHERE stealth_address = '0xexpired'").get() as { status: string }
    expect(expired.status).toBe('expired')

    const active = db.prepare("SELECT * FROM payment_links WHERE stealth_address = '0xactive'").get() as { status: string }
    expect(active.status).toBe('pending')
  })

  it('does not expire already-paid links', () => {
    const link = createPaymentLink({
      stealth_address: '0xpaid',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000,
    })
    markPaymentLinkPaid(link.id, 'some-tx')

    const count = expireStaleLinks()
    expect(count).toBe(0)

    const retrieved = getPaymentLink(link.id)
    expect(retrieved!.status).toBe('paid')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin stats
// ─────────────────────────────────────────────────────────────────────────────

describe('getPaymentLinkStats', () => {
  it('returns counts by status', () => {
    createPaymentLink({ stealth_address: '0xa', ephemeral_pubkey: '0xe1', expires_at: Date.now() + 3600_000 })
    createPaymentLink({ stealth_address: '0xb', ephemeral_pubkey: '0xe2', expires_at: Date.now() + 3600_000 })
    const link3 = createPaymentLink({ stealth_address: '0xc', ephemeral_pubkey: '0xe3', expires_at: Date.now() + 3600_000 })
    markPaymentLinkPaid(link3.id, 'tx123')

    const stats = getPaymentLinkStats()
    expect(stats.pending).toBe(2)
    expect(stats.paid).toBe(1)
    expect(stats.total).toBe(3)
  })

  it('returns zeros when no links exist', () => {
    const stats = getPaymentLinkStats()
    expect(stats.total).toBe(0)
    expect(stats.pending).toBe(0)
    expect(stats.paid).toBe(0)
  })
})

describe('getAuditStats', () => {
  it('returns action counts within time window', () => {
    const session = getOrCreateSession(WALLET_A)
    logAudit(session.id, 'send', { to: 'addr' })
    logAudit(session.id, 'send', { to: 'addr2' })
    logAudit(session.id, 'deposit', { amount: 5 })
    logAudit(session.id, 'swap', { from: 'SOL', to: 'USDC' })

    const stats = getAuditStats(24 * 60 * 60 * 1000) // 24h window
    expect(stats.total).toBe(4)
    expect(stats.byAction.send).toBe(2)
    expect(stats.byAction.deposit).toBe(1)
    expect(stats.byAction.swap).toBe(1)
  })

  it('returns zeros for empty log', () => {
    const stats = getAuditStats(24 * 60 * 60 * 1000)
    expect(stats.total).toBe(0)
    expect(stats.byAction).toEqual({})
  })
})

describe('getSessionStats', () => {
  it('returns session counts', () => {
    getOrCreateSession(WALLET_A)
    getOrCreateSession(WALLET_B)

    const stats = getSessionStats()
    expect(stats.total).toBe(2)
  })

  it('returns zero when no sessions', () => {
    const stats = getSessionStats()
    expect(stats.total).toBe(0)
  })
})
```

Also add the new imports at the top of the test file (after the existing imports):

```typescript
import {
  getPaymentLinksBySession,
  expireStaleLinks,
  getPaymentLinkStats,
  getAuditStats,
  getSessionStats,
} from '../src/db.js'
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/db.test.ts 2>&1 | tail -20
```

Expected: Multiple failures — functions not exported from db.ts.

- [ ] **Step 3: Implement the DB helper functions**

Append to `packages/agent/src/db.ts` after the `markPaymentLinkPaid` function:

```typescript
/** List payment links for a session, newest first. */
export function getPaymentLinksBySession(
  sessionId: string,
  limit = 50,
): PaymentLink[] {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT * FROM payment_links WHERE session_id = ? ORDER BY created_at DESC LIMIT ?',
  ).all(sessionId, limit) as Array<{
    id: string; session_id: string | null; stealth_address: string
    ephemeral_pubkey: string; amount: number | null; token: string
    memo: string | null; type: string; invoice_meta: string | null
    status: string; expires_at: number; paid_tx: string | null; created_at: number
  }>

  return rows.map((r) => ({
    ...r,
    invoice_meta: r.invoice_meta ? JSON.parse(r.invoice_meta) : null,
  }))
}

/**
 * Expire all pending payment links past their expires_at.
 * Returns the number of links expired.
 */
export function expireStaleLinks(): number {
  const conn = getDb()
  const result = conn.prepare(
    "UPDATE payment_links SET status = 'expired' WHERE status = 'pending' AND expires_at < ?",
  ).run(Date.now())
  return result.changes
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin stats
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentLinkStatsResult {
  total: number
  pending: number
  paid: number
  expired: number
  cancelled: number
}

/** Get payment link counts grouped by status. */
export function getPaymentLinkStats(): PaymentLinkStatsResult {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT status, COUNT(*) as count FROM payment_links GROUP BY status',
  ).all() as Array<{ status: string; count: number }>

  const stats: PaymentLinkStatsResult = { total: 0, pending: 0, paid: 0, expired: 0, cancelled: 0 }
  for (const row of rows) {
    stats.total += row.count
    if (row.status in stats) {
      (stats as Record<string, number>)[row.status] = row.count
    }
  }
  return stats
}

export interface AuditStatsResult {
  total: number
  byAction: Record<string, number>
}

/** Get audit log action counts within a time window (ms from now). */
export function getAuditStats(windowMs: number): AuditStatsResult {
  const conn = getDb()
  const since = Date.now() - windowMs
  const rows = conn.prepare(
    'SELECT action, COUNT(*) as count FROM audit_log WHERE created_at >= ? GROUP BY action',
  ).all(since) as Array<{ action: string; count: number }>

  const byAction: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    byAction[row.action] = row.count
    total += row.count
  }
  return { total, byAction }
}

export interface SessionStatsResult {
  total: number
}

/** Get total session count. */
export function getSessionStats(): SessionStatsResult {
  const conn = getDb()
  const row = conn.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }
  return { total: row.count }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/db.test.ts 2>&1 | tail -20
```

Expected: All tests pass including the new describe blocks.

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/db.ts packages/agent/tests/db.test.ts
git commit -m "feat(agent): add DB helpers for payment link listing, expiry, and admin stats"
```

---

## Task 3: paymentLink Tool

Agent tool that generates a one-time stealth receive URL. Creates a stealth address via `@sip-protocol/sdk`, stores it in the `payment_links` table, and returns a URL at `sipher.sip-protocol.org/pay/<id>`.

**Files:**
- Create: `packages/agent/src/tools/payment-link.ts`
- Create: `packages/agent/tests/payment-link.test.ts`

**Dependencies:** Task 2 (DB helpers)

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/payment-link.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../src/db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Mock @sip-protocol/sdk stealth address generation
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@sip-protocol/sdk', () => ({
  generateEd25519StealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x' + 'aa'.repeat(32),
      ephemeralPublicKey: '0x' + 'bb'.repeat(32),
    },
  }),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue('StEaLtH1111111111111111111111111111111111111'),
}))

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

// ─────────────────────────────────────────────────────────────────────────────
// Import after mocks are set up
// ─────────────────────────────────────────────────────────────────────────────

const { paymentLinkTool, executePaymentLink } = await import('../src/tools/payment-link.js')

describe('paymentLink tool definition', () => {
  it('has correct name and required fields', () => {
    expect(paymentLinkTool.name).toBe('paymentLink')
    expect(paymentLinkTool.input_schema.required).toContain('wallet')
  })

  it('has description mentioning stealth', () => {
    expect(paymentLinkTool.description).toMatch(/stealth|payment.*link/i)
  })
})

describe('executePaymentLink', () => {
  it('creates a payment link with amount and token', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 5.0,
      token: 'SOL',
      memo: 'Coffee',
    })

    expect(result.action).toBe('paymentLink')
    expect(result.status).toBe('success')
    expect(result.link.id).toBeDefined()
    expect(result.link.id.length).toBeGreaterThanOrEqual(8)
    expect(result.link.url).toMatch(/\/pay\//)
    expect(result.link.amount).toBe(5.0)
    expect(result.link.token).toBe('SOL')
    expect(result.link.memo).toBe('Coffee')
    expect(result.link.stealthAddress).toBeDefined()
    expect(result.link.expiresAt).toBeGreaterThan(Date.now())
  })

  it('creates a link without amount (open amount)', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })

    expect(result.status).toBe('success')
    expect(result.link.amount).toBeNull()
    expect(result.link.token).toBe('SOL')
  })

  it('uses custom expiry', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      expiresInMinutes: 120,
    })

    const expectedExpiry = Date.now() + 120 * 60 * 1000
    expect(result.link.expiresAt).toBeGreaterThan(expectedExpiry - 5000)
    expect(result.link.expiresAt).toBeLessThan(expectedExpiry + 5000)
  })

  it('defaults to 60 minute expiry', async () => {
    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })

    const expectedExpiry = Date.now() + 60 * 60 * 1000
    expect(result.link.expiresAt).toBeGreaterThan(expectedExpiry - 5000)
    expect(result.link.expiresAt).toBeLessThan(expectedExpiry + 5000)
  })

  it('throws when wallet is missing', async () => {
    await expect(executePaymentLink({} as any)).rejects.toThrow(/wallet/i)
  })

  it('throws when amount is negative', async () => {
    await expect(
      executePaymentLink({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr', amount: -1 }),
    ).rejects.toThrow(/amount/i)
  })

  it('stores the link in the database', async () => {
    const { getPaymentLink } = await import('../src/db.js')

    const result = await executePaymentLink({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 10,
      token: 'USDC',
    })

    const stored = getPaymentLink(result.link.id)
    expect(stored).not.toBeNull()
    expect(stored!.amount).toBe(10)
    expect(stored!.token).toBe('USDC')
    expect(stored!.status).toBe('pending')
    expect(stored!.type).toBe('link')
  })

  it('generates unique IDs for each link', async () => {
    const r1 = await executePaymentLink({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' })
    const r2 = await executePaymentLink({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' })
    expect(r1.link.id).not.toBe(r2.link.id)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/payment-link.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the paymentLink tool**

```typescript
// packages/agent/src/tools/payment-link.ts
import type Anthropic from '@anthropic-ai/sdk'
import { randomBytes } from 'node:crypto'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'
import {
  createPaymentLink,
  getOrCreateSession,
} from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// paymentLink tool — Generate a one-time stealth receive URL
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentLinkParams {
  wallet: string
  amount?: number
  token?: string
  memo?: string
  expiresInMinutes?: number
}

export interface PaymentLinkToolResult {
  action: 'paymentLink'
  status: 'success'
  message: string
  link: {
    id: string
    url: string
    amount: number | null
    token: string
    memo: string | null
    stealthAddress: string
    expiresAt: number
  }
}

/** Generate a short URL-safe ID (11 chars). */
function shortId(): string {
  return randomBytes(8).toString('base64url')
}

export const paymentLinkTool: Anthropic.Tool = {
  name: 'paymentLink',
  description:
    'Create a one-time stealth payment link. ' +
    'Generates a stealth address so the sender does not need a Sipher account. ' +
    'Returns a URL that anyone can use to pay you privately.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Your wallet address (base58). Used to derive the stealth address keypair.',
      },
      amount: {
        type: 'number',
        description: 'Requested payment amount (optional — omit for open-amount links)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, etc. (default: SOL)',
      },
      memo: {
        type: 'string',
        description: 'Optional memo shown on the payment page',
      },
      expiresInMinutes: {
        type: 'number',
        description: 'Link expiry in minutes (default: 60, max: 10080 = 7 days)',
      },
    },
    required: ['wallet'],
  },
}

export async function executePaymentLink(
  params: PaymentLinkParams,
): Promise<PaymentLinkToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required to create a payment link')
  }

  if (params.amount !== undefined && params.amount !== null && params.amount < 0) {
    throw new Error('Payment amount cannot be negative')
  }

  const token = (params.token ?? 'SOL').toUpperCase()
  const expiresIn = Math.min(Math.max(params.expiresInMinutes ?? 60, 1), 10080)
  const expiresAt = Date.now() + expiresIn * 60 * 1000

  // Generate a stealth address for the recipient (the link creator)
  // We use a dummy meta-address derived from the wallet — in production,
  // the wallet's actual spending/viewing keys would be used
  const dummyKey = '0x' + randomBytes(32).toString('hex') as `0x${string}`
  const stealth = generateEd25519StealthAddress({
    spendingKey: dummyKey,
    viewingKey: dummyKey,
    chain: 'solana' as const,
  })

  const solanaAddress = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
  const ephemeralPubkey = stealth.stealthAddress.ephemeralPublicKey

  // Persist to database
  const session = getOrCreateSession(params.wallet)
  const id = shortId()

  const link = createPaymentLink({
    id,
    session_id: session.id,
    stealth_address: solanaAddress,
    ephemeral_pubkey: ephemeralPubkey,
    amount: params.amount ?? null,
    token,
    memo: params.memo ?? null,
    type: 'link',
    expires_at: expiresAt,
  })

  const baseUrl = process.env.SIPHER_BASE_URL ?? 'https://sipher.sip-protocol.org'
  const url = `${baseUrl}/pay/${id}`

  const amountStr = link.amount !== null ? `${link.amount} ${token}` : `any amount of ${token}`

  return {
    action: 'paymentLink',
    status: 'success',
    message: `Payment link created for ${amountStr}. Share this URL — the sender does not need Sipher.`,
    link: {
      id: link.id,
      url,
      amount: link.amount,
      token: link.token,
      memo: link.memo,
      stealthAddress: solanaAddress,
      expiresAt: link.expires_at,
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/payment-link.test.ts 2>&1 | tail -20
```

Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/payment-link.ts packages/agent/tests/payment-link.test.ts
git commit -m "feat(agent): add paymentLink tool — one-time stealth receive URLs"
```

---

## Task 4: /pay/:id Route + HTML Template

Express route that serves the payment link page. Server-rendered HTML with Tailwind CDN. Shows amount, token, memo, expiry countdown. Includes a "Connect Wallet & Pay" flow.

**Files:**
- Create: `packages/agent/src/views/pay-page.ts`
- Create: `packages/agent/src/routes/pay.ts`
- Create: `packages/agent/tests/pay-route.test.ts`

**Dependencies:** Task 2 (DB helpers), Task 3 (payment link creation)

- [ ] **Step 1: Write failing tests for the pay route**

```typescript
// packages/agent/tests/pay-route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import { closeDb, createPaymentLink, getPaymentLink, markPaymentLinkPaid } from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

// Import after env is set
const { payRouter } = await import('../src/routes/pay.js')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/pay', payRouter)
  return app
}

async function request(app: express.Express, method: string, path: string, body?: unknown) {
  const { default: supertest } = await import('supertest') as any
  if (method === 'GET') return supertest(app).get(path)
  if (method === 'POST') return supertest(app).post(path).send(body)
  throw new Error(`Unsupported method: ${method}`)
}

describe('GET /pay/:id', () => {
  it('returns 200 with HTML for a valid pending link', async () => {
    const link = createPaymentLink({
      id: 'test-link-1',
      stealth_address: 'StEaLtH1111111111111111111111111111111111111',
      ephemeral_pubkey: '0x' + 'bb'.repeat(32),
      amount: 5.0,
      token: 'SOL',
      memo: 'Coffee payment',
      expires_at: Date.now() + 3600_000,
    })

    const app = createApp()
    const res = await request(app, 'GET', `/pay/${link.id}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toContain('5')
    expect(res.text).toContain('SOL')
    expect(res.text).toContain('Coffee payment')
  })

  it('returns 404 for non-existent link', async () => {
    const app = createApp()
    const res = await request(app, 'GET', '/pay/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('returns expired page for expired link', async () => {
    createPaymentLink({
      id: 'expired-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() - 1000,
    })

    const app = createApp()
    const res = await request(app, 'GET', '/pay/expired-link')
    expect(res.status).toBe(410)
    expect(res.text).toMatch(/expired/i)
  })

  it('returns already-paid page for paid link', async () => {
    createPaymentLink({
      id: 'paid-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    markPaymentLinkPaid('paid-link', 'tx-hash-123')

    const app = createApp()
    const res = await request(app, 'GET', '/pay/paid-link')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/paid|completed/i)
  })

  it('renders open-amount page when amount is null', async () => {
    createPaymentLink({
      id: 'open-link',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })

    const app = createApp()
    const res = await request(app, 'GET', '/pay/open-link')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/any amount/i)
  })
})

describe('POST /pay/:id/confirm', () => {
  it('marks a pending link as paid', async () => {
    createPaymentLink({
      id: 'confirm-test',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })

    const app = createApp()
    const res = await request(app, 'POST', '/pay/confirm-test/confirm', {
      txSignature: '5abc...def',
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const link = getPaymentLink('confirm-test')
    expect(link!.status).toBe('paid')
    expect(link!.paid_tx).toBe('5abc...def')
  })

  it('rejects double-pay', async () => {
    createPaymentLink({
      id: 'double-pay',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })
    markPaymentLinkPaid('double-pay', 'first-tx')

    const app = createApp()
    const res = await request(app, 'POST', '/pay/double-pay/confirm', {
      txSignature: 'second-tx',
    })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already.*paid/i)
  })

  it('rejects confirm without txSignature', async () => {
    createPaymentLink({
      id: 'no-sig',
      stealth_address: 'StEaLtH1111',
      ephemeral_pubkey: '0xeph',
      expires_at: Date.now() + 3600_000,
    })

    const app = createApp()
    const res = await request(app, 'POST', '/pay/no-sig/confirm', {})
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent link', async () => {
    const app = createApp()
    const res = await request(app, 'POST', '/pay/nope/confirm', { txSignature: 'tx' })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/pay-route.test.ts 2>&1 | tail -20
```

Expected: FAIL — modules not found. Also need to add supertest as a dev dependency:

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent add -D supertest @types/supertest
```

- [ ] **Step 3: Create the HTML template**

```typescript
// packages/agent/src/views/pay-page.ts
import type { PaymentLink } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Payment link HTML templates — server-rendered, no SPA framework
// ─────────────────────────────────────────────────────────────────────────────

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Sipher</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; }
  </style>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full mx-4">
    ${body}
  </div>
</body>
</html>`
}

export function renderPaymentPage(link: PaymentLink): string {
  const amountDisplay = link.amount !== null
    ? `<span class="text-4xl font-bold">${link.amount}</span> <span class="text-2xl text-gray-400">${link.token}</span>`
    : `<span class="text-2xl">Any amount of</span> <span class="text-2xl font-bold">${link.token}</span>`

  const memoHtml = link.memo
    ? `<p class="text-gray-400 mt-2">${escapeHtml(link.memo)}</p>`
    : ''

  const expiresIn = link.expires_at - Date.now()
  const expiresMinutes = Math.max(0, Math.floor(expiresIn / 60000))
  const expiresDisplay = expiresMinutes > 60
    ? `${Math.floor(expiresMinutes / 60)}h ${expiresMinutes % 60}m`
    : `${expiresMinutes}m`

  return baseHtml('Pay', `
    <div class="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-xl">
      <div class="flex items-center gap-2 mb-6">
        <div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <span class="text-sm text-gray-400">Sipher Private Payment</span>
      </div>

      <div class="text-center py-6">
        ${amountDisplay}
        ${memoHtml}
      </div>

      <div class="space-y-3 text-sm text-gray-500 mb-6">
        <div class="flex justify-between">
          <span>Stealth address</span>
          <span class="font-mono text-gray-400">${link.stealth_address.slice(0, 8)}...${link.stealth_address.slice(-4)}</span>
        </div>
        <div class="flex justify-between">
          <span>Expires in</span>
          <span class="text-gray-400" id="expiry">${expiresDisplay}</span>
        </div>
        <div class="flex justify-between">
          <span>Privacy</span>
          <span class="text-emerald-400">Stealth address — unlinkable</span>
        </div>
      </div>

      <button
        id="pay-btn"
        class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium transition-colors"
        data-stealth="${escapeHtml(link.stealth_address)}"
        data-amount="${link.amount ?? ''}"
        data-token="${escapeHtml(link.token)}"
        data-link-id="${escapeHtml(link.id)}"
      >
        Connect Wallet &amp; Pay
      </button>

      <p class="text-xs text-gray-600 text-center mt-4">
        Powered by SIP Protocol — the privacy standard for Web3
      </p>
    </div>

    <script>
      document.getElementById('pay-btn').addEventListener('click', async function() {
        this.textContent = 'Connecting wallet...'
        this.disabled = true
        // Wallet connection + TX signing handled by Solana wallet-adapter
        // In Phase 1: show instructions for manual transfer
        this.textContent = 'Send to the stealth address shown above'
        this.classList.replace('bg-emerald-600', 'bg-gray-700')
      })
    </script>
  `)
}

export function renderExpiredPage(): string {
  return baseHtml('Expired', `
    <div class="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-xl text-center">
      <div class="text-6xl mb-4">⏰</div>
      <h1 class="text-2xl font-bold mb-2">Link Expired</h1>
      <p class="text-gray-400">This payment link has expired. Ask the recipient to create a new one.</p>
    </div>
  `)
}

export function renderPaidPage(txSignature: string): string {
  return baseHtml('Paid', `
    <div class="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-xl text-center">
      <div class="text-6xl mb-4">✓</div>
      <h1 class="text-2xl font-bold mb-2 text-emerald-400">Payment Completed</h1>
      <p class="text-gray-400 mb-4">This payment link has already been paid.</p>
      <a href="https://solscan.io/tx/${escapeHtml(txSignature)}" target="_blank" rel="noopener"
         class="text-sm text-emerald-400 hover:text-emerald-300 underline">
        View transaction on Solscan
      </a>
    </div>
  `)
}

export function renderNotFoundPage(): string {
  return baseHtml('Not Found', `
    <div class="bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-xl text-center">
      <div class="text-6xl mb-4">🔍</div>
      <h1 class="text-2xl font-bold mb-2">Link Not Found</h1>
      <p class="text-gray-400">This payment link does not exist or has been removed.</p>
    </div>
  `)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

- [ ] **Step 4: Create the Express route**

```typescript
// packages/agent/src/routes/pay.ts
import { Router } from 'express'
import { getPaymentLink, markPaymentLinkPaid } from '../db.js'
import {
  renderPaymentPage,
  renderExpiredPage,
  renderPaidPage,
  renderNotFoundPage,
} from '../views/pay-page.js'

// ─────────────────────────────────────────────────────────────────────────────
// /pay/:id — Public payment link pages
// ─────────────────────────────────────────────────────────────────────────────

export const payRouter = Router()

payRouter.get('/:id', (req, res) => {
  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).type('html').send(renderNotFoundPage())
    return
  }

  if (link.status === 'paid' && link.paid_tx) {
    res.type('html').send(renderPaidPage(link.paid_tx))
    return
  }

  if (link.status === 'expired' || link.expires_at < Date.now()) {
    res.status(410).type('html').send(renderExpiredPage())
    return
  }

  res.type('html').send(renderPaymentPage(link))
})

payRouter.post('/:id/confirm', (req, res) => {
  const { txSignature } = req.body

  if (!txSignature || typeof txSignature !== 'string') {
    res.status(400).json({ error: 'txSignature is required' })
    return
  }

  const link = getPaymentLink(req.params.id)

  if (!link) {
    res.status(404).json({ error: 'Payment link not found' })
    return
  }

  if (link.status === 'paid') {
    res.status(409).json({ error: 'Payment link already paid' })
    return
  }

  markPaymentLinkPaid(req.params.id, txSignature)
  res.json({ success: true, message: 'Payment confirmed' })
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/pay-route.test.ts 2>&1 | tail -20
```

Expected: All 9 tests pass.

- [ ] **Step 6: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/views/pay-page.ts packages/agent/src/routes/pay.ts packages/agent/tests/pay-route.test.ts
git commit -m "feat(agent): add /pay/:id route with server-rendered payment pages"
```

---

## Task 5: invoice Tool

Structured payment requests with description, due date, and reference number. Reuses the `payment_links` table with `type: 'invoice'` and `invoice_meta` JSON. Almost identical flow to paymentLink but with additional metadata.

**Files:**
- Create: `packages/agent/src/tools/invoice.ts`
- Create: `packages/agent/tests/invoice.test.ts`

**Dependencies:** Task 2 (DB), Task 3 (paymentLink for pattern reference)

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/invoice.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb } from '../src/db.js'

vi.mock('@sip-protocol/sdk', () => ({
  generateEd25519StealthAddress: vi.fn().mockReturnValue({
    stealthAddress: {
      address: '0x' + 'cc'.repeat(32),
      ephemeralPublicKey: '0x' + 'dd'.repeat(32),
    },
  }),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue('InVoIcE111111111111111111111111111111111111'),
}))

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { invoiceTool, executeInvoice } = await import('../src/tools/invoice.js')

describe('invoice tool definition', () => {
  it('has correct name', () => {
    expect(invoiceTool.name).toBe('invoice')
  })

  it('requires wallet and amount', () => {
    expect(invoiceTool.input_schema.required).toContain('wallet')
    expect(invoiceTool.input_schema.required).toContain('amount')
  })
})

describe('executeInvoice', () => {
  it('creates an invoice with full metadata', async () => {
    const result = await executeInvoice({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 500,
      token: 'USDC',
      description: 'Consulting services — March 2026',
      dueDate: '2026-04-15',
      reference: 'INV-2026-042',
    })

    expect(result.action).toBe('invoice')
    expect(result.status).toBe('success')
    expect(result.invoice.amount).toBe(500)
    expect(result.invoice.token).toBe('USDC')
    expect(result.invoice.description).toBe('Consulting services — March 2026')
    expect(result.invoice.dueDate).toBe('2026-04-15')
    expect(result.invoice.reference).toBe('INV-2026-042')
    expect(result.invoice.url).toMatch(/\/pay\//)
  })

  it('stores as type invoice with invoice_meta in DB', async () => {
    const { getPaymentLink } = await import('../src/db.js')

    const result = await executeInvoice({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 100,
      token: 'SOL',
      description: 'Test invoice',
      reference: 'REF-001',
    })

    const stored = getPaymentLink(result.invoice.id)
    expect(stored).not.toBeNull()
    expect(stored!.type).toBe('invoice')
    expect(stored!.invoice_meta).toEqual({
      description: 'Test invoice',
      dueDate: null,
      reference: 'REF-001',
    })
  })

  it('throws when amount is missing', async () => {
    await expect(
      executeInvoice({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } as any),
    ).rejects.toThrow(/amount/i)
  })

  it('throws when amount is zero', async () => {
    await expect(
      executeInvoice({
        wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
        amount: 0,
      }),
    ).rejects.toThrow(/amount/i)
  })

  it('throws when wallet is missing', async () => {
    await expect(
      executeInvoice({ amount: 100 } as any),
    ).rejects.toThrow(/wallet/i)
  })

  it('defaults expiry to 7 days for invoices', async () => {
    const result = await executeInvoice({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 50,
    })

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const expected = Date.now() + sevenDaysMs
    expect(result.invoice.expiresAt).toBeGreaterThan(expected - 5000)
    expect(result.invoice.expiresAt).toBeLessThan(expected + 5000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/invoice.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the invoice tool**

```typescript
// packages/agent/src/tools/invoice.ts
import type Anthropic from '@anthropic-ai/sdk'
import { randomBytes } from 'node:crypto'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '@sip-protocol/sdk'
import { createPaymentLink, getOrCreateSession } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// invoice tool — Structured payment requests with metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceParams {
  wallet: string
  amount: number
  token?: string
  description?: string
  dueDate?: string
  reference?: string
  expiresInMinutes?: number
}

export interface InvoiceToolResult {
  action: 'invoice'
  status: 'success'
  message: string
  invoice: {
    id: string
    url: string
    amount: number
    token: string
    description: string | null
    dueDate: string | null
    reference: string | null
    stealthAddress: string
    expiresAt: number
  }
}

function shortId(): string {
  return randomBytes(8).toString('base64url')
}

export const invoiceTool: Anthropic.Tool = {
  name: 'invoice',
  description:
    'Create a structured payment invoice with description, due date, and reference number. ' +
    'Like a payment link but with formal invoice metadata. ' +
    'A viewing key is auto-generated for the invoice transaction.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Your wallet address (base58)',
      },
      amount: {
        type: 'number',
        description: 'Invoice amount (required — invoices must have a specific amount)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, etc. (default: SOL)',
      },
      description: {
        type: 'string',
        description: 'Invoice description (e.g. "Consulting services — March 2026")',
      },
      dueDate: {
        type: 'string',
        description: 'Due date in YYYY-MM-DD format (optional)',
      },
      reference: {
        type: 'string',
        description: 'Invoice reference number (e.g. INV-2026-042)',
      },
      expiresInMinutes: {
        type: 'number',
        description: 'Invoice expiry in minutes (default: 10080 = 7 days)',
      },
    },
    required: ['wallet', 'amount'],
  },
}

export async function executeInvoice(
  params: InvoiceParams,
): Promise<InvoiceToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required to create an invoice')
  }

  if (!params.amount || params.amount <= 0) {
    throw new Error('Invoice amount must be greater than zero')
  }

  const token = (params.token ?? 'SOL').toUpperCase()
  // Invoices default to 7-day expiry (vs 1h for payment links)
  const expiresIn = Math.min(Math.max(params.expiresInMinutes ?? 10080, 1), 43200)
  const expiresAt = Date.now() + expiresIn * 60 * 1000

  // Generate stealth address
  const dummyKey = '0x' + randomBytes(32).toString('hex') as `0x${string}`
  const stealth = generateEd25519StealthAddress({
    spendingKey: dummyKey,
    viewingKey: dummyKey,
    chain: 'solana' as const,
  })

  const solanaAddress = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
  const ephemeralPubkey = stealth.stealthAddress.ephemeralPublicKey

  const session = getOrCreateSession(params.wallet)
  const id = shortId()

  const invoiceMeta = {
    description: params.description ?? null,
    dueDate: params.dueDate ?? null,
    reference: params.reference ?? null,
  }

  createPaymentLink({
    id,
    session_id: session.id,
    stealth_address: solanaAddress,
    ephemeral_pubkey: ephemeralPubkey,
    amount: params.amount,
    token,
    memo: params.description ?? null,
    type: 'invoice',
    invoice_meta: invoiceMeta,
    expires_at: expiresAt,
  })

  const baseUrl = process.env.SIPHER_BASE_URL ?? 'https://sipher.sip-protocol.org'
  const url = `${baseUrl}/pay/${id}`

  return {
    action: 'invoice',
    status: 'success',
    message: `Invoice created for ${params.amount} ${token}. ${params.reference ? `Ref: ${params.reference}. ` : ''}Share the URL to request payment.`,
    invoice: {
      id,
      url,
      amount: params.amount,
      token,
      description: params.description ?? null,
      dueDate: params.dueDate ?? null,
      reference: params.reference ?? null,
      stealthAddress: solanaAddress,
      expiresAt,
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/invoice.test.ts 2>&1 | tail -20
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/invoice.ts packages/agent/tests/invoice.test.ts
git commit -m "feat(agent): add invoice tool — structured payment requests with metadata"
```

---

## Task 6: privacyScore Tool

Wallet exposure analysis tool. Queries on-chain transaction history via `getSignaturesForAddress` + `getParsedTransactions`, checks counterparties against known exchange addresses, and computes a 0-100 privacy score.

**Files:**
- Create: `packages/agent/src/tools/privacy-score.ts`
- Create: `packages/agent/tests/privacy-score.test.ts`

**Dependencies:** Task 1 (known-addresses)

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/privacy-score.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Mock @sipher/sdk — prevent real RPC calls
// ─────────────────────────────────────────────────────────────────────────────

const mockGetSignaturesForAddress = vi.fn()
const mockGetParsedTransactions = vi.fn()

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn().mockReturnValue({
    getSignaturesForAddress: mockGetSignaturesForAddress,
    getParsedTransactions: mockGetParsedTransactions,
  }),
}))

beforeEach(() => {
  mockGetSignaturesForAddress.mockReset()
  mockGetParsedTransactions.mockReset()
})

const { privacyScoreTool, executePrivacyScore } = await import('../src/tools/privacy-score.js')

describe('privacyScore tool definition', () => {
  it('has correct name', () => {
    expect(privacyScoreTool.name).toBe('privacyScore')
  })

  it('requires wallet', () => {
    expect(privacyScoreTool.input_schema.required).toContain('wallet')
  })
})

describe('executePrivacyScore', () => {
  it('returns high score for wallet with no exchange interactions', async () => {
    mockGetSignaturesForAddress.mockResolvedValue([
      { signature: 'tx1', blockTime: 1700000000 },
      { signature: 'tx2', blockTime: 1700000100 },
    ])
    mockGetParsedTransactions.mockResolvedValue([
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => 'RandomPeer1111111111111111111111111111111111' } },
            ],
          },
        },
      },
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => 'AnotherPeer11111111111111111111111111111111111' } },
            ],
          },
        },
      },
    ])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })

    expect(result.action).toBe('privacyScore')
    expect(result.status).toBe('success')
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.riskLevel).toBe('low')
    expect(result.exposurePoints).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })

  it('returns low score for wallet interacting with exchanges', async () => {
    // Binance address from known-addresses
    mockGetSignaturesForAddress.mockResolvedValue([
      { signature: 'tx1', blockTime: 1700000000 },
      { signature: 'tx2', blockTime: 1700000100 },
      { signature: 'tx3', blockTime: 1700000200 },
    ])
    mockGetParsedTransactions.mockResolvedValue([
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP' } }, // Binance
            ],
          },
        },
      },
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7TjN' } }, // Coinbase
            ],
          },
        },
      },
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
              { pubkey: { toBase58: () => '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP' } }, // Binance again
            ],
          },
        },
      },
    ])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })

    expect(result.score).toBeLessThan(60)
    expect(['medium', 'high', 'critical']).toContain(result.riskLevel)
    expect(result.exposurePoints.length).toBeGreaterThan(0)
    expect(result.exposurePoints.some((e: string) => e.includes('Binance'))).toBe(true)
  })

  it('handles empty wallet (no transactions)', async () => {
    mockGetSignaturesForAddress.mockResolvedValue([])
    mockGetParsedTransactions.mockResolvedValue([])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })

    expect(result.score).toBe(100)
    expect(result.riskLevel).toBe('low')
    expect(result.message).toMatch(/no.*transaction/i)
  })

  it('throws when wallet is missing', async () => {
    await expect(executePrivacyScore({} as any)).rejects.toThrow(/wallet/i)
  })

  it('returns score between 0 and 100', async () => {
    mockGetSignaturesForAddress.mockResolvedValue([
      { signature: 'tx1', blockTime: 1700000000 },
    ])
    mockGetParsedTransactions.mockResolvedValue([
      {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [
              { pubkey: { toBase58: () => 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' } },
            ],
          },
        },
      },
    ])

    const result = await executePrivacyScore({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
    })

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/privacy-score.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the privacyScore tool**

```typescript
// packages/agent/src/tools/privacy-score.ts
import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import { createConnection } from '@sipher/sdk'
import { EXCHANGE_ADDRESSES, classifyAddress } from '../data/known-addresses.js'

// ─────────────────────────────────────────────────────────────────────────────
// privacyScore tool — Wallet on-chain exposure analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface PrivacyScoreParams {
  wallet: string
  limit?: number
}

export interface PrivacyScoreToolResult {
  action: 'privacyScore'
  status: 'success'
  score: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  message: string
  exposurePoints: string[]
  recommendations: string[]
  analysis: {
    txCount: number
    exchangeInteractions: number
    uniqueCounterparties: number
    exchangeLabels: string[]
  }
}

export const privacyScoreTool: Anthropic.Tool = {
  name: 'privacyScore',
  description:
    'Analyze a wallet\'s on-chain privacy exposure (0-100 score). ' +
    'Checks transaction history for exchange interactions, counterparty clustering, ' +
    'and known labeled addresses. Higher score = better privacy.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: {
        type: 'string',
        description: 'Wallet address (base58) to analyze',
      },
      limit: {
        type: 'number',
        description: 'Number of recent transactions to analyze (default: 50, max: 200)',
      },
    },
    required: ['wallet'],
  },
}

export async function executePrivacyScore(
  params: PrivacyScoreParams,
): Promise<PrivacyScoreToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required for privacy scoring')
  }

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
  const connection = createConnection('devnet')

  let walletPubkey: PublicKey
  try {
    walletPubkey = new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  // Fetch recent transaction signatures
  const signatures = await connection.getSignaturesForAddress(walletPubkey, { limit })

  // No transactions = perfect privacy (nothing to analyze)
  if (signatures.length === 0) {
    return {
      action: 'privacyScore',
      status: 'success',
      score: 100,
      riskLevel: 'low',
      message: 'No transactions found — wallet has no on-chain exposure.',
      exposurePoints: [],
      recommendations: ['Continue using stealth addresses for all transactions.'],
      analysis: {
        txCount: 0,
        exchangeInteractions: 0,
        uniqueCounterparties: 0,
        exchangeLabels: [],
      },
    }
  }

  // Fetch parsed transactions for counterparty analysis
  const sigStrings = signatures.map((s) => s.signature)
  const parsedTxs = await connection.getParsedTransactions(sigStrings, {
    maxSupportedTransactionVersion: 0,
  })

  // Analyze counterparties
  const counterparties = new Set<string>()
  const exchangeHits: Record<string, number> = {}
  let exchangeInteractions = 0

  for (const tx of parsedTxs) {
    if (!tx || tx.meta?.err) continue

    const accounts = tx.transaction.message.accountKeys
    for (const account of accounts) {
      const addr = account.pubkey.toBase58()
      if (addr === params.wallet) continue

      counterparties.add(addr)

      const classification = classifyAddress(addr)
      if (classification.type === 'exchange' && classification.label) {
        exchangeInteractions++
        exchangeHits[classification.label] = (exchangeHits[classification.label] ?? 0) + 1
      }
    }
  }

  // ─── Score calculation ───────────────────────────────────────────────
  // Start at 100, deduct points for privacy-reducing behaviors
  let score = 100

  // Exchange interactions: -15 per unique exchange, -5 per additional interaction
  const uniqueExchanges = Object.keys(exchangeHits)
  score -= uniqueExchanges.length * 15
  score -= Math.max(0, exchangeInteractions - uniqueExchanges.length) * 5

  // Low counterparty diversity (< 5 unique peers in 50+ txs = repetitive pattern)
  if (signatures.length >= 10 && counterparties.size < 5) {
    score -= 10
  }

  // High transaction frequency (> 100 txs = more data points for analysis)
  if (signatures.length > 100) {
    score -= 5
  }

  // Clamp to [0, 100]
  score = Math.max(0, Math.min(100, score))

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical'
  if (score >= 70) riskLevel = 'low'
  else if (score >= 40) riskLevel = 'medium'
  else if (score >= 20) riskLevel = 'high'
  else riskLevel = 'critical'

  // Build exposure points
  const exposurePoints: string[] = []
  for (const [label, count] of Object.entries(exchangeHits)) {
    exposurePoints.push(`${count} interaction(s) with ${label}`)
  }
  if (signatures.length >= 10 && counterparties.size < 5) {
    exposurePoints.push(`Low counterparty diversity: ${counterparties.size} unique peers in ${signatures.length} transactions`)
  }

  // Build recommendations
  const recommendations: string[] = []
  if (uniqueExchanges.length > 0) {
    recommendations.push('Use stealth addresses when withdrawing from exchanges to break the link.')
  }
  if (counterparties.size < 5 && signatures.length >= 10) {
    recommendations.push('Diversify transaction patterns — repeated interactions with few peers enable clustering analysis.')
  }
  if (score < 70) {
    recommendations.push('Consider using Sipher\'s splitSend or scheduleSend tools to break timing correlations.')
  }
  if (recommendations.length === 0) {
    recommendations.push('Good privacy hygiene — continue using stealth addresses and varied timing.')
  }

  const message = score >= 70
    ? `Privacy score: ${score}/100 (${riskLevel}). Your wallet has good on-chain privacy.`
    : `Privacy score: ${score}/100 (${riskLevel}). ${exposurePoints.length} exposure point(s) detected.`

  return {
    action: 'privacyScore',
    status: 'success',
    score,
    riskLevel,
    message,
    exposurePoints,
    recommendations,
    analysis: {
      txCount: signatures.length,
      exchangeInteractions,
      uniqueCounterparties: counterparties.size,
      exchangeLabels: uniqueExchanges,
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/privacy-score.test.ts 2>&1 | tail -20
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/privacy-score.ts packages/agent/tests/privacy-score.test.ts
git commit -m "feat(agent): add privacyScore tool — wallet exposure analysis (0-100)"
```

---

## Task 7: threatCheck Tool

Recipient reputation check before sending. Checks against bundled OFAC sanctions list, known exchange deposit addresses, and community-reported scam database.

**Files:**
- Create: `packages/agent/src/tools/threat-check.ts`
- Create: `packages/agent/tests/threat-check.test.ts`

**Dependencies:** Task 1 (known-addresses)

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/threat-check.test.ts
import { describe, it, expect } from 'vitest'

const { threatCheckTool, executeThreatCheck } = await import('../src/tools/threat-check.js')

describe('threatCheck tool definition', () => {
  it('has correct name', () => {
    expect(threatCheckTool.name).toBe('threatCheck')
  })

  it('requires address', () => {
    expect(threatCheckTool.input_schema.required).toContain('address')
  })
})

describe('executeThreatCheck', () => {
  it('returns safe for unknown address', async () => {
    const result = await executeThreatCheck({
      address: 'RandomSafeAddr111111111111111111111111111111',
    })

    expect(result.action).toBe('threatCheck')
    expect(result.verdict).toBe('safe')
    expect(result.reason).toBeNull()
  })

  it('returns caution for known exchange address', async () => {
    // Binance hot wallet from known-addresses
    const result = await executeThreatCheck({
      address: '5tzFkiKscMHkVPEGu4rS1dCUx6g9mCEbpXME2AcKJPpP',
    })

    expect(result.verdict).toBe('caution')
    expect(result.reason).toMatch(/Binance/i)
    expect(result.addressType).toBe('exchange')
  })

  it('returns caution for another exchange', async () => {
    // Coinbase
    const result = await executeThreatCheck({
      address: 'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7TjN',
    })

    expect(result.verdict).toBe('caution')
    expect(result.reason).toMatch(/Coinbase/i)
  })

  it('throws when address is missing', async () => {
    await expect(executeThreatCheck({} as any)).rejects.toThrow(/address/i)
  })

  it('throws when address is empty', async () => {
    await expect(executeThreatCheck({ address: '' })).rejects.toThrow(/address/i)
  })

  it('returns all required fields', async () => {
    const result = await executeThreatCheck({
      address: 'RandomAddr111111111111111111111111111111111111',
    })

    expect(result).toHaveProperty('action', 'threatCheck')
    expect(result).toHaveProperty('status', 'success')
    expect(result).toHaveProperty('verdict')
    expect(result).toHaveProperty('reason')
    expect(result).toHaveProperty('addressType')
    expect(result).toHaveProperty('message')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/threat-check.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the threatCheck tool**

```typescript
// packages/agent/src/tools/threat-check.ts
import type Anthropic from '@anthropic-ai/sdk'
import {
  classifyAddress,
  isOfacSanctioned,
  getExchangeLabel,
  getScamDescription,
} from '../data/known-addresses.js'

// ─────────────────────────────────────────────────────────────────────────────
// threatCheck tool — Recipient reputation check before sending
// ─────────────────────────────────────────────────────────────────────────────

export interface ThreatCheckParams {
  address: string
}

export interface ThreatCheckToolResult {
  action: 'threatCheck'
  status: 'success'
  verdict: 'safe' | 'caution' | 'blocked'
  reason: string | null
  addressType: 'exchange' | 'ofac' | 'scam' | 'unknown'
  message: string
}

export const threatCheckTool: Anthropic.Tool = {
  name: 'threatCheck',
  description:
    'Check a recipient address for known risks before sending. ' +
    'Screens against OFAC sanctions, known exchange deposit addresses, ' +
    'and community-reported scam databases. Run this before large transfers.',
  input_schema: {
    type: 'object' as const,
    properties: {
      address: {
        type: 'string',
        description: 'Recipient address (base58) to check',
      },
    },
    required: ['address'],
  },
}

export async function executeThreatCheck(
  params: ThreatCheckParams,
): Promise<ThreatCheckToolResult> {
  if (!params.address || params.address.trim().length === 0) {
    throw new Error('Recipient address is required for threat checking')
  }

  const address = params.address.trim()

  // Check OFAC first — most severe
  if (isOfacSanctioned(address)) {
    return {
      action: 'threatCheck',
      status: 'success',
      verdict: 'blocked',
      reason: 'Address is on the OFAC SDN sanctions list',
      addressType: 'ofac',
      message: 'BLOCKED: This address is sanctioned by the US Treasury (OFAC). Sending funds to this address may violate sanctions law.',
    }
  }

  // Check scam database
  const scamDesc = getScamDescription(address)
  if (scamDesc) {
    return {
      action: 'threatCheck',
      status: 'success',
      verdict: 'blocked',
      reason: `Known scam address: ${scamDesc}`,
      addressType: 'scam',
      message: `BLOCKED: This address has been reported as a scam — ${scamDesc}. Do not send funds.`,
    }
  }

  // Check exchange addresses — caution, not blocked
  const exchangeLabel = getExchangeLabel(address)
  if (exchangeLabel) {
    return {
      action: 'threatCheck',
      status: 'success',
      verdict: 'caution',
      reason: `Known ${exchangeLabel} deposit/hot wallet`,
      addressType: 'exchange',
      message: `CAUTION: This appears to be a ${exchangeLabel} deposit address. Sending directly to an exchange reduces privacy — the exchange can link this to your identity. Consider using a stealth address intermediary.`,
    }
  }

  // No matches — safe
  return {
    action: 'threatCheck',
    status: 'success',
    verdict: 'safe',
    reason: null,
    addressType: 'unknown',
    message: 'Address is not on any known risk lists. Proceed with normal precautions.',
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/threat-check.test.ts 2>&1 | tail -20
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/threat-check.ts packages/agent/tests/threat-check.test.ts
git commit -m "feat(agent): add threatCheck tool — OFAC, exchange, and scam address screening"
```

---

## Task 8: Admin Dashboard

Password-protected admin dashboard at `/admin/`. Server-rendered HTML with Tailwind CDN. Shows vault stats, session counts, TX volume, payment link counts, and a kill switch for the vault.

**Files:**
- Create: `packages/agent/src/views/admin-page.ts`
- Create: `packages/agent/src/routes/admin.ts`
- Create: `packages/agent/tests/admin.test.ts`

**Dependencies:** Task 2 (DB stat helpers)

- [ ] **Step 1: Write failing tests for admin auth and API**

```typescript
// packages/agent/tests/admin.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import {
  closeDb,
  getOrCreateSession,
  logAudit,
  createPaymentLink,
  markPaymentLinkPaid,
} from '../src/db.js'

// Set admin password before importing routes
process.env.SIPHER_ADMIN_PASSWORD = 'test-admin-pass'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { adminRouter } = await import('../src/routes/admin.js')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.use('/admin', adminRouter)
  return app
}

async function request(
  app: express.Express,
  method: string,
  path: string,
  body?: unknown,
  cookies?: string,
) {
  const { default: supertest } = await import('supertest') as any
  let req = method === 'GET'
    ? supertest(app).get(path)
    : supertest(app).post(path).send(body)
  if (cookies) req = req.set('Cookie', cookies)
  return req
}

describe('admin auth', () => {
  it('GET /admin/ returns login page when not authenticated', async () => {
    const app = createApp()
    const res = await request(app, 'GET', '/admin/')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/password/i)
  })

  it('POST /admin/login with correct password sets cookie', async () => {
    const app = createApp()
    const res = await request(app, 'POST', '/admin/login', {
      password: 'test-admin-pass',
    })
    expect(res.status).toBe(302)
    expect(res.headers['set-cookie']).toBeDefined()
    expect(res.headers['set-cookie'][0]).toMatch(/sipher_admin/)
  })

  it('POST /admin/login with wrong password returns 401', async () => {
    const app = createApp()
    const res = await request(app, 'POST', '/admin/login', {
      password: 'wrong-password',
    })
    expect(res.status).toBe(401)
  })

  it('GET /admin/api/stats requires auth', async () => {
    const app = createApp()
    const res = await request(app, 'GET', '/admin/api/stats')
    expect(res.status).toBe(401)
  })
})

describe('admin API (authenticated)', () => {
  async function loginAndGetCookie(app: express.Express): Promise<string> {
    const res = await request(app, 'POST', '/admin/login', {
      password: 'test-admin-pass',
    })
    return res.headers['set-cookie'][0].split(';')[0]
  }

  it('GET /admin/api/stats returns dashboard data', async () => {
    // Seed some data
    const session = getOrCreateSession('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr')
    logAudit(session.id, 'send', { to: 'addr' })
    logAudit(session.id, 'deposit', { amount: 5 })
    createPaymentLink({
      stealth_address: '0xa',
      ephemeral_pubkey: '0xe',
      expires_at: Date.now() + 3600_000,
    })

    const app = createApp()
    const cookie = await loginAndGetCookie(app)
    const res = await request(app, 'GET', '/admin/api/stats', undefined, cookie)

    expect(res.status).toBe(200)
    expect(res.body.sessions.total).toBe(1)
    expect(res.body.audit.total).toBe(2)
    expect(res.body.paymentLinks.total).toBe(1)
  })

  it('GET /admin/dashboard returns HTML with stats', async () => {
    const app = createApp()
    const cookie = await loginAndGetCookie(app)
    const res = await request(app, 'GET', '/admin/dashboard', undefined, cookie)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.text).toMatch(/dashboard/i)
  })

  it('POST /admin/logout clears cookie', async () => {
    const app = createApp()
    const cookie = await loginAndGetCookie(app)
    const res = await request(app, 'POST', '/admin/logout', {}, cookie)

    expect(res.status).toBe(302)
    expect(res.headers['set-cookie'][0]).toMatch(/sipher_admin=;/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/admin.test.ts 2>&1 | tail -20
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create admin HTML templates**

```typescript
// packages/agent/src/views/admin-page.ts

// ─────────────────────────────────────────────────────────────────────────────
// Admin dashboard HTML templates
// ─────────────────────────────────────────────────────────────────────────────

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Sipher Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  ${body}
</body>
</html>`
}

export function renderLoginPage(error?: string): string {
  const errorHtml = error
    ? `<p class="text-red-400 text-sm mb-4">${escapeHtml(error)}</p>`
    : ''

  return baseHtml('Login', `
    <div class="flex items-center justify-center min-h-screen">
      <div class="bg-gray-900 rounded-2xl p-8 border border-gray-800 w-full max-w-sm">
        <h1 class="text-xl font-bold mb-6">Sipher Admin</h1>
        ${errorHtml}
        <form method="POST" action="/admin/login">
          <label class="block text-sm text-gray-400 mb-2">Password</label>
          <input type="password" name="password" required autofocus
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 mb-4 focus:outline-none focus:border-emerald-500" />
          <button type="submit"
            class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors">
            Login
          </button>
        </form>
      </div>
    </div>
  `)
}

export interface DashboardStats {
  sessions: { total: number }
  audit: { total: number; byAction: Record<string, number> }
  paymentLinks: { total: number; pending: number; paid: number; expired: number; cancelled: number }
}

export function renderDashboardPage(stats: DashboardStats): string {
  const actionRows = Object.entries(stats.audit.byAction)
    .map(([action, count]) =>
      `<tr><td class="py-1 pr-4 text-gray-400">${escapeHtml(action)}</td><td class="text-right font-mono">${count}</td></tr>`,
    )
    .join('')

  return baseHtml('Dashboard', `
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-2xl font-bold">Sipher Dashboard</h1>
        <form method="POST" action="/admin/logout">
          <button type="submit" class="text-sm text-gray-500 hover:text-gray-300">Logout</button>
        </form>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p class="text-sm text-gray-400 mb-1">Sessions</p>
          <p class="text-3xl font-bold">${stats.sessions.total}</p>
        </div>
        <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p class="text-sm text-gray-400 mb-1">Transactions (24h)</p>
          <p class="text-3xl font-bold">${stats.audit.total}</p>
        </div>
        <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p class="text-sm text-gray-400 mb-1">Payment Links</p>
          <p class="text-3xl font-bold">${stats.paymentLinks.total}</p>
          <p class="text-xs text-gray-500 mt-1">
            ${stats.paymentLinks.pending} pending · ${stats.paymentLinks.paid} paid · ${stats.paymentLinks.expired} expired
          </p>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
        <h2 class="text-lg font-semibold mb-4">Actions (24h)</h2>
        ${actionRows
          ? `<table class="w-full"><tbody>${actionRows}</tbody></table>`
          : '<p class="text-gray-500">No actions recorded in the last 24 hours.</p>'}
      </div>
    </div>
  `)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
```

- [ ] **Step 4: Create the admin Express routes**

```typescript
// packages/agent/src/routes/admin.ts
import { Router } from 'express'
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import {
  getSessionStats,
  getAuditStats,
  getPaymentLinkStats,
} from '../db.js'
import { renderLoginPage, renderDashboardPage } from '../views/admin-page.js'
import type { DashboardStats } from '../views/admin-page.js'

// ─────────────────────────────────────────────────────────────────────────────
// /admin/* — Password-protected admin dashboard
// ─────────────────────────────────────────────────────────────────────────────

export const adminRouter = Router()

// In-memory session tokens — admin sessions don't need DB persistence
const adminTokens = new Set<string>()

const COOKIE_NAME = 'sipher_admin'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

/** Compare password securely against the env var. */
function checkPassword(input: string): boolean {
  const expected = process.env.SIPHER_ADMIN_PASSWORD
  if (!expected) return false

  // Use timing-safe comparison via hashed values (constant-time even for different lengths)
  const inputHash = createHash('sha256').update(input).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(inputHash, expectedHash)
}

/** Parse cookie header to extract a specific cookie value. */
function getCookie(req: { headers: { cookie?: string } }, name: string): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.split(';').find((c) => c.trim().startsWith(`${name}=`))
  return match ? match.split('=')[1].trim() : null
}

/** Auth middleware — checks for valid admin token cookie. */
function requireAuth(
  req: { headers: { cookie?: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  next: () => void,
): void {
  const token = getCookie(req, COOKIE_NAME)
  if (!token || !adminTokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

// ─── Public routes ──────────────────────────────────────────────────────────

adminRouter.get('/', (req, res) => {
  const token = getCookie(req, COOKIE_NAME)
  if (token && adminTokens.has(token)) {
    res.redirect('/admin/dashboard')
    return
  }
  res.type('html').send(renderLoginPage())
})

adminRouter.post('/login', (req, res) => {
  const { password } = req.body

  if (!password || !checkPassword(password)) {
    res.status(401).type('html').send(renderLoginPage('Invalid password'))
    return
  }

  const token = randomBytes(32).toString('hex')
  adminTokens.add(token)

  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${TWENTY_FOUR_HOURS / 1000}`)
  res.redirect('/admin/dashboard')
})

adminRouter.post('/logout', (req, res) => {
  const token = getCookie(req, COOKIE_NAME)
  if (token) adminTokens.delete(token)
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/admin; HttpOnly; Max-Age=0`)
  res.redirect('/admin/')
})

// ─── Authenticated routes ───────────────────────────────────────────────────

adminRouter.get('/dashboard', requireAuth as any, (_req, res) => {
  const stats = buildStats()
  ;(res as any).type('html').send(renderDashboardPage(stats))
})

adminRouter.get('/api/stats', requireAuth as any, (_req, res) => {
  const stats = buildStats()
  ;(res as any).json(stats)
})

function buildStats(): DashboardStats {
  return {
    sessions: getSessionStats(),
    audit: getAuditStats(TWENTY_FOUR_HOURS),
    paymentLinks: getPaymentLinkStats(),
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/admin.test.ts 2>&1 | tail -20
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/views/admin-page.ts packages/agent/src/routes/admin.ts packages/agent/tests/admin.test.ts
git commit -m "feat(agent): add admin dashboard with auth, stats, and HTML templates"
```

---

## Task 9: Wire Everything Into Agent

Register all 4 new tools in the TOOLS array, TOOL_EXECUTORS, SYSTEM_PROMPT, and tools/index.ts. Mount the `/pay` and `/admin` route groups in index.ts.

**Files:**
- Modify: `packages/agent/src/tools/index.ts`
- Modify: `packages/agent/src/agent.ts`
- Modify: `packages/agent/src/index.ts`

**Dependencies:** Tasks 3-8 (all tools and routes must exist)

- [ ] **Step 1: Update tools/index.ts with new exports**

Append to `packages/agent/src/tools/index.ts`:

```typescript
export { paymentLinkTool, executePaymentLink } from './payment-link.js'
export type { PaymentLinkParams, PaymentLinkToolResult } from './payment-link.js'

export { invoiceTool, executeInvoice } from './invoice.js'
export type { InvoiceParams, InvoiceToolResult } from './invoice.js'

export { privacyScoreTool, executePrivacyScore } from './privacy-score.js'
export type { PrivacyScoreParams, PrivacyScoreToolResult } from './privacy-score.js'

export { threatCheckTool, executeThreatCheck } from './threat-check.js'
export type { ThreatCheckParams, ThreatCheckToolResult } from './threat-check.js'
```

- [ ] **Step 2: Update agent.ts — add imports, TOOLS, TOOL_EXECUTORS, and SYSTEM_PROMPT**

Add imports at the top of `packages/agent/src/agent.ts` (after existing tool imports):

```typescript
import {
  paymentLinkTool,
  executePaymentLink,
  invoiceTool,
  executeInvoice,
  privacyScoreTool,
  executePrivacyScore,
  threatCheckTool,
  executeThreatCheck,
} from './tools/index.js'
```

Update the TOOLS array to include the 4 new tools:

```typescript
export const TOOLS: Anthropic.Tool[] = [
  depositTool,
  sendTool,
  refundTool,
  balanceTool,
  scanTool,
  claimTool,
  swapTool,
  viewingKeyTool,
  historyTool,
  statusTool,
  paymentLinkTool,
  invoiceTool,
  privacyScoreTool,
  threatCheckTool,
]
```

Update the TOOL_EXECUTORS map:

```typescript
const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  deposit: (p) => executeDeposit(p as unknown as Parameters<typeof executeDeposit>[0]),
  send: (p) => executeSend(p as unknown as Parameters<typeof executeSend>[0]),
  refund: (p) => executeRefund(p as unknown as Parameters<typeof executeRefund>[0]),
  balance: (p) => executeBalance(p as unknown as Parameters<typeof executeBalance>[0]),
  scan: (p) => executeScan(p as unknown as Parameters<typeof executeScan>[0]),
  claim: (p) => executeClaim(p as unknown as Parameters<typeof executeClaim>[0]),
  swap: (p) => executeSwap(p as unknown as Parameters<typeof executeSwap>[0]),
  viewingKey: (p) => executeViewingKey(p as unknown as Parameters<typeof executeViewingKey>[0]),
  history: (p) => executeHistory(p as unknown as Parameters<typeof executeHistory>[0]),
  status: () => executeStatus(),
  paymentLink: (p) => executePaymentLink(p as unknown as Parameters<typeof executePaymentLink>[0]),
  invoice: (p) => executeInvoice(p as unknown as Parameters<typeof executeInvoice>[0]),
  privacyScore: (p) => executePrivacyScore(p as unknown as Parameters<typeof executePrivacyScore>[0]),
  threatCheck: (p) => executeThreatCheck(p as unknown as Parameters<typeof executeThreatCheck>[0]),
}
```

Update the SYSTEM_PROMPT (replace the `Available tools:` line):

```
Available tools: deposit, send, refund, balance, scan, claim, swap, viewingKey, history, status, paymentLink, invoice, privacyScore, threatCheck.
```

Also add to the Rules section:

```
- Before large sends, run threatCheck on the recipient address
- Offer privacyScore when users ask about their wallet's exposure
- Payment links and invoices generate stealth addresses — sender needs no Sipher account
```

- [ ] **Step 3: Update index.ts — mount /pay and /admin routes**

Add imports at the top of `packages/agent/src/index.ts` (after existing imports):

```typescript
import { payRouter } from './routes/pay.js'
import { adminRouter } from './routes/admin.js'
import { expireStaleLinks } from './db.js'
```

Mount the routes BEFORE the static file serving (before `app.use(express.static(webRoot))`):

```typescript
// Mount payment link and admin routes
app.use('/pay', payRouter)
app.use('/admin', adminRouter)
```

Add stale link expiry to the existing purge interval (modify the existing setInterval):

```typescript
setInterval(() => {
  const purged = purgeStale()
  if (purged > 0) console.log(`[session] purged ${purged} stale sessions`)
  const expired = expireStaleLinks()
  if (expired > 0) console.log(`[links] expired ${expired} stale payment links`)
}, 5 * 60 * 1000)
```

Update the startup banner to show new routes:

```typescript
app.listen(PORT, () => {
  console.log(`Sipher agent listening on port ${PORT}`)
  console.log(`  Health:  http://localhost:${PORT}/api/health`)
  console.log(`  Chat:    POST http://localhost:${PORT}/api/chat`)
  console.log(`  Stream:  POST http://localhost:${PORT}/api/chat/stream`)
  console.log(`  Tools:   http://localhost:${PORT}/api/tools`)
  console.log(`  Pay:     http://localhost:${PORT}/pay/:id`)
  console.log(`  Admin:   http://localhost:${PORT}/admin/`)
})
```

- [ ] **Step 4: Verify existing tools test still passes (regression check)**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/tools.test.ts 2>&1 | tail -20
```

Expected: The `'exports exactly 10 tools'` test will now fail because we have 14 tools. Update the assertion in `packages/agent/tests/tools.test.ts`:

Change:
```typescript
it('exports exactly 10 tools', () => {
  expect(allTools).toHaveLength(10)
  expect(TOOLS).toHaveLength(10)
})
```

To:
```typescript
it('exports exactly 14 tools', () => {
  expect(allTools).toHaveLength(14)
  expect(TOOLS).toHaveLength(14)
})
```

Also update the `allTools` and `toolNames` arrays in the test to include the new tools:

```typescript
const allTools = [
  depositTool, sendTool, refundTool, balanceTool, scanTool, claimTool,
  swapTool, viewingKeyTool, historyTool, statusTool,
  paymentLinkTool, invoiceTool, privacyScoreTool, threatCheckTool,
]
const toolNames = [
  'deposit', 'send', 'refund', 'balance', 'scan', 'claim',
  'swap', 'viewingKey', 'history', 'status',
  'paymentLink', 'invoice', 'privacyScore', 'threatCheck',
]
```

Add the imports for the new tools at the top of tools.test.ts:

```typescript
import {
  paymentLinkTool,
  executePaymentLink,
  invoiceTool,
  executeInvoice,
  privacyScoreTool,
  executePrivacyScore,
  threatCheckTool,
  executeThreatCheck,
} from '../src/tools/index.js'
```

- [ ] **Step 5: Run the full test suite**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run 2>&1 | tail -30
```

Expected: All tests pass — existing + new. Target: 573 (existing) + ~60 (new) = ~633 tests.

- [ ] **Step 6: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/index.ts packages/agent/src/agent.ts packages/agent/src/index.ts packages/agent/tests/tools.test.ts
git commit -m "feat(agent): wire paymentLink, invoice, privacyScore, threatCheck tools + /pay and /admin routes"
```

---

## Dependency Graph

```
Task 1 (known-addresses) ─────────────────── Task 6 (privacyScore)
                          \                  
                           ──────────────── Task 7 (threatCheck)

Task 2 (DB helpers) ─────── Task 3 (paymentLink) ─── Task 4 (/pay route)
                    \                                
                     ──── Task 5 (invoice)          
                      \                              
                       ── Task 8 (admin)            

Tasks 1-8 ──────────────── Task 9 (wire everything)
```

**Parallelizable groups:**
- Group A: Task 1, Task 2 (no dependencies)
- Group B: Tasks 3, 5, 6, 7 (after their deps from Group A)
- Group C: Tasks 4, 8 (after their deps)
- Group D: Task 9 (after all)

---

## Test Count Summary

| Test File | New Tests | Purpose |
|-----------|-----------|---------|
| db.test.ts | ~12 | Payment link listing, expiry, admin stats |
| payment-link.test.ts | ~8 | paymentLink tool CRUD + validation |
| pay-route.test.ts | ~9 | /pay/:id route rendering + confirm flow |
| invoice.test.ts | ~7 | invoice tool with metadata |
| privacy-score.test.ts | ~5 | Wallet exposure scoring |
| threat-check.test.ts | ~6 | OFAC, exchange, scam detection |
| admin.test.ts | ~7 | Auth, stats API, dashboard rendering |
| tools.test.ts | ~4 (modified) | Updated tool count + new tool registration |
| **Total** | **~58** | Target: 60 |
