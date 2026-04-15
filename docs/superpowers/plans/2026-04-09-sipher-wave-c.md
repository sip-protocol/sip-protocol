# Sipher Wave C — Time-Based Privacy Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scheduled operations engine (crank) and 7 time-based privacy tools to Sipher, bringing the agent tool count from 14 to 21 and completing Phase 1 of the vision spec.

**Architecture:** A 60-second crank worker polls the `scheduled_ops` SQLite table for due operations and executes them sequentially via the existing tool executor. Each tool creates one or more `scheduled_ops` rows with pre-computed timing. The crank handles status transitions (pending → executing → completed/expired/missed). One tool (roundAmount) is synchronous and skips the crank entirely.

**Tech Stack:** TypeScript, Express 5, better-sqlite3 (existing), @sipher/sdk (vault ops), Vitest

**Repo:** `~/local-dev/sipher/` (run all commands from this directory)

**Spec:** `~/local-dev/sip-protocol/docs/superpowers/specs/2026-04-08-sipher-phase1-completion-design.md` — Wave C section

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/agent/src/crank.ts` | Crank worker — polls scheduled_ops, executes due ops, manages status |
| `packages/agent/src/tools/round-amount.ts` | roundAmount tool — synchronous amount rounding |
| `packages/agent/src/tools/schedule-send.ts` | scheduleSend tool — delayed sends |
| `packages/agent/src/tools/split-send.ts` | splitSend tool — split into N random chunks |
| `packages/agent/src/tools/drip.ts` | drip tool — DCA-style distribution |
| `packages/agent/src/tools/recurring.ts` | recurring tool — repeating payments |
| `packages/agent/src/tools/sweep.ts` | sweep tool — auto-shield incoming funds |
| `packages/agent/src/tools/consolidate.ts` | consolidate tool — merge stealth balances |
| `packages/agent/tests/scheduled-ops.test.ts` | Tests for scheduled_ops DB helpers |
| `packages/agent/tests/crank.test.ts` | Tests for crank engine |
| `packages/agent/tests/round-amount.test.ts` | Tests for roundAmount tool |
| `packages/agent/tests/schedule-send.test.ts` | Tests for scheduleSend tool |
| `packages/agent/tests/split-send.test.ts` | Tests for splitSend tool |
| `packages/agent/tests/drip.test.ts` | Tests for drip tool |
| `packages/agent/tests/recurring.test.ts` | Tests for recurring tool |
| `packages/agent/tests/sweep.test.ts` | Tests for sweep tool |
| `packages/agent/tests/consolidate.test.ts` | Tests for consolidate tool |

### Modified Files

| File | Changes |
|------|---------|
| `packages/agent/src/db.ts` | Add scheduled_ops CRUD functions |
| `packages/agent/src/tools/index.ts` | Re-export 7 new tools |
| `packages/agent/src/agent.ts` | Register 7 new tools + update SYSTEM_PROMPT |
| `packages/agent/src/index.ts` | Start crank worker on server boot |

---

## Task 1: Scheduled Ops DB Helpers

CRUD functions for the `scheduled_ops` table. The table already exists in the schema — we just need helper functions.

**Files:**
- Modify: `packages/agent/src/db.ts`
- Create: `packages/agent/tests/scheduled-ops.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/scheduled-ops.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getDb,
  closeDb,
  getOrCreateSession,
  createScheduledOp,
  getScheduledOp,
  getScheduledOpsBySession,
  getPendingOps,
  updateScheduledOp,
  cancelScheduledOp,
} from '../src/db.js'

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

describe('createScheduledOp', () => {
  it('creates an op with all fields', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: { amount: 10, token: 'SOL', recipient: 'addr' },
      wallet_signature: 'sig123',
      next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000,
      max_exec: 1,
    })

    expect(op.id).toBeDefined()
    expect(op.session_id).toBe(session.id)
    expect(op.action).toBe('send')
    expect(op.params).toEqual({ amount: 10, token: 'SOL', recipient: 'addr' })
    expect(op.status).toBe('pending')
    expect(op.exec_count).toBe(0)
  })

  it('uses custom id when provided', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      id: 'custom-op-id',
      session_id: session.id,
      action: 'send',
      params: {},
      wallet_signature: 'sig',
      next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000,
      max_exec: 1,
    })
    expect(op.id).toBe('custom-op-id')
  })
})

describe('getScheduledOp', () => {
  it('retrieves an existing op', () => {
    const session = getOrCreateSession(WALLET)
    const created = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: { amount: 5 },
      wallet_signature: 'sig',
      next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000,
      max_exec: 1,
    })
    const retrieved = getScheduledOp(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(created.id)
    expect(retrieved!.params).toEqual({ amount: 5 })
  })

  it('returns null for unknown id', () => {
    expect(getScheduledOp('nonexistent')).toBeNull()
  })
})

describe('getScheduledOpsBySession', () => {
  it('returns ops for a session sorted by next_exec ASC', () => {
    const session = getOrCreateSession(WALLET)
    const now = Date.now()
    createScheduledOp({
      session_id: session.id, action: 'send', params: { i: 2 },
      wallet_signature: 'sig', next_exec: now + 120_000, expires_at: now + 3600_000, max_exec: 1,
    })
    createScheduledOp({
      session_id: session.id, action: 'send', params: { i: 1 },
      wallet_signature: 'sig', next_exec: now + 60_000, expires_at: now + 3600_000, max_exec: 1,
    })
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(2)
    expect(ops[0].params.i).toBe(1)
    expect(ops[1].params.i).toBe(2)
  })

  it('returns empty for unknown session', () => {
    expect(getScheduledOpsBySession('unknown')).toHaveLength(0)
  })
})

describe('getPendingOps', () => {
  it('returns ops where next_exec <= now and status is pending', () => {
    const session = getOrCreateSession(WALLET)
    const now = Date.now()
    createScheduledOp({
      session_id: session.id, action: 'send', params: { due: true },
      wallet_signature: 'sig', next_exec: now - 1000, expires_at: now + 3600_000, max_exec: 1,
    })
    createScheduledOp({
      session_id: session.id, action: 'send', params: { due: false },
      wallet_signature: 'sig', next_exec: now + 60_000, expires_at: now + 3600_000, max_exec: 1,
    })
    const pending = getPendingOps(now)
    expect(pending).toHaveLength(1)
    expect(pending[0].params.due).toBe(true)
  })

  it('excludes non-pending statuses', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 1000, expires_at: Date.now() + 3600_000, max_exec: 1,
    })
    updateScheduledOp(op.id, { status: 'completed' })
    expect(getPendingOps()).toHaveLength(0)
  })
})

describe('updateScheduledOp', () => {
  it('updates status', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now(), expires_at: Date.now() + 3600_000, max_exec: 3,
    })
    updateScheduledOp(op.id, { status: 'executing' })
    expect(getScheduledOp(op.id)!.status).toBe('executing')
  })

  it('updates exec_count and next_exec', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now(), expires_at: Date.now() + 3600_000, max_exec: 3,
    })
    const nextExec = Date.now() + 120_000
    updateScheduledOp(op.id, { exec_count: 1, next_exec: nextExec, status: 'pending' })
    const updated = getScheduledOp(op.id)!
    expect(updated.exec_count).toBe(1)
    expect(updated.next_exec).toBe(nextExec)
    expect(updated.status).toBe('pending')
  })
})

describe('cancelScheduledOp', () => {
  it('sets status to cancelled', () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() + 60_000, expires_at: Date.now() + 3600_000, max_exec: 1,
    })
    cancelScheduledOp(op.id)
    expect(getScheduledOp(op.id)!.status).toBe('cancelled')
  })

  it('throws for non-existent op', () => {
    expect(() => cancelScheduledOp('nonexistent')).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/scheduled-ops.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement scheduled ops helpers**

Append to `packages/agent/src/db.ts` (after the admin stats section):

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Scheduled operations
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduledOp {
  id: string
  session_id: string
  action: string
  params: Record<string, unknown>
  wallet_signature: string
  next_exec: number
  expires_at: number
  max_exec: number
  exec_count: number
  status: string
  created_at: number
}

export interface CreateScheduledOpData {
  id?: string
  session_id: string
  action: string
  params: Record<string, unknown>
  wallet_signature: string
  next_exec: number
  expires_at: number
  max_exec: number
}

type ScheduledOpRow = {
  id: string; session_id: string; action: string; params: string
  wallet_signature: string; next_exec: number; expires_at: number
  max_exec: number; exec_count: number; status: string; created_at: number
}

function parseOpRow(row: ScheduledOpRow): ScheduledOp {
  return { ...row, params: JSON.parse(row.params) }
}

/** Create a new scheduled operation. */
export function createScheduledOp(data: CreateScheduledOpData): ScheduledOp {
  const conn = getDb()
  const id = data.id ?? randomUUID()
  const now = Date.now()

  conn.prepare(`
    INSERT INTO scheduled_ops
      (id, session_id, action, params, wallet_signature, next_exec, expires_at, max_exec, exec_count, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?)
  `).run(id, data.session_id, data.action, JSON.stringify(data.params), data.wallet_signature, data.next_exec, data.expires_at, data.max_exec, now)

  return {
    id, session_id: data.session_id, action: data.action, params: data.params,
    wallet_signature: data.wallet_signature, next_exec: data.next_exec,
    expires_at: data.expires_at, max_exec: data.max_exec, exec_count: 0,
    status: 'pending', created_at: now,
  }
}

/** Retrieve a scheduled op by ID. */
export function getScheduledOp(id: string): ScheduledOp | null {
  const conn = getDb()
  const row = conn.prepare('SELECT * FROM scheduled_ops WHERE id = ?').get(id) as ScheduledOpRow | undefined
  return row ? parseOpRow(row) : null
}

/** List scheduled ops for a session, ordered by next_exec ASC. */
export function getScheduledOpsBySession(sessionId: string, limit = 50): ScheduledOp[] {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT * FROM scheduled_ops WHERE session_id = ? ORDER BY next_exec ASC LIMIT ?',
  ).all(sessionId, limit) as ScheduledOpRow[]
  return rows.map(parseOpRow)
}

/** Get all pending ops that are due for execution. */
export function getPendingOps(now?: number): ScheduledOp[] {
  const conn = getDb()
  const ts = now ?? Date.now()
  const rows = conn.prepare(
    "SELECT * FROM scheduled_ops WHERE status = 'pending' AND next_exec <= ? ORDER BY next_exec ASC",
  ).all(ts) as ScheduledOpRow[]
  return rows.map(parseOpRow)
}

/** Update fields on a scheduled op. */
export function updateScheduledOp(
  id: string,
  updates: { status?: string; exec_count?: number; next_exec?: number },
): void {
  const conn = getDb()
  const sets: string[] = []
  const values: (string | number)[] = []

  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status) }
  if (updates.exec_count !== undefined) { sets.push('exec_count = ?'); values.push(updates.exec_count) }
  if (updates.next_exec !== undefined) { sets.push('next_exec = ?'); values.push(updates.next_exec) }

  if (sets.length === 0) return
  values.push(id)
  conn.prepare(`UPDATE scheduled_ops SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

/** Cancel a scheduled op. Throws if not found. */
export function cancelScheduledOp(id: string): void {
  const conn = getDb()
  const result = conn.prepare("UPDATE scheduled_ops SET status = 'cancelled' WHERE id = ?").run(id)
  if (result.changes === 0) throw new Error(`Scheduled op not found: ${id}`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/scheduled-ops.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/db.ts packages/agent/tests/scheduled-ops.test.ts
git commit -m "feat(agent): add scheduled ops CRUD helpers for crank engine"
```

---

## Task 2: Crank Engine

The 60-second worker that polls `scheduled_ops` and executes due operations. Handles expiry, missed ops, max_exec, and recurring next_exec calculation.

**Files:**
- Create: `packages/agent/src/crank.ts`
- Create: `packages/agent/tests/crank.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/crank.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  closeDb,
  getOrCreateSession,
  createScheduledOp,
  getScheduledOp,
} from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { crankTick } = await import('../src/crank.js')

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('crankTick', () => {
  it('executes a due pending op', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: { amount: 10 },
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn().mockResolvedValue({ status: 'success' })
    const result = await crankTick(executor)

    expect(executor).toHaveBeenCalledWith('send', { amount: 10 })
    expect(result.executed).toBe(1)
    const updated = getScheduledOp(op.id)!
    expect(updated.status).toBe('completed')
    expect(updated.exec_count).toBe(1)
  })

  it('marks expired ops without executing', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() - 500, max_exec: 1,
    })

    const executor = vi.fn()
    const result = await crankTick(executor)

    expect(executor).not.toHaveBeenCalled()
    expect(result.expired).toBe(1)
    expect(getScheduledOp(op.id)!.status).toBe('expired')
  })

  it('completes ops that hit max_exec', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 3,
    })
    // Simulate 2 prior executions
    const db = (await import('../src/db.js')).getDb()
    db.prepare('UPDATE scheduled_ops SET exec_count = 2 WHERE id = ?').run(op.id)

    const executor = vi.fn().mockResolvedValue({ status: 'success' })
    await crankTick(executor)

    const updated = getScheduledOp(op.id)!
    expect(updated.status).toBe('completed')
    expect(updated.exec_count).toBe(3)
  })

  it('re-schedules recurring ops with intervalMs in params', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send',
      params: { amount: 50, intervalMs: 120_000 },
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 5,
    })

    const executor = vi.fn().mockResolvedValue({ status: 'success' })
    await crankTick(executor)

    const updated = getScheduledOp(op.id)!
    expect(updated.status).toBe('pending')
    expect(updated.exec_count).toBe(1)
    // next_exec should be roughly now + 120s (with some tolerance)
    expect(updated.next_exec).toBeGreaterThan(Date.now() + 100_000)
    expect(updated.next_exec).toBeLessThan(Date.now() + 150_000)
  })

  it('skips future ops', async () => {
    const session = getOrCreateSession(WALLET)
    createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() + 60_000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn()
    const result = await crankTick(executor)

    expect(executor).not.toHaveBeenCalled()
    expect(result.executed).toBe(0)
  })

  it('continues executing remaining ops if one fails', async () => {
    const session = getOrCreateSession(WALLET)
    createScheduledOp({
      id: 'op-fail', session_id: session.id, action: 'send', params: { fail: true },
      wallet_signature: 'sig', next_exec: Date.now() - 2000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })
    createScheduledOp({
      id: 'op-ok', session_id: session.id, action: 'send', params: { fail: false },
      wallet_signature: 'sig', next_exec: Date.now() - 1000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn().mockImplementation(async (_action: string, params: Record<string, unknown>) => {
      if (params.fail) throw new Error('Test error')
      return { status: 'success' }
    })

    const result = await crankTick(executor)

    expect(result.executed).toBe(1)
    expect(result.failed).toBe(1)
    // Failed op stays pending for retry
    expect(getScheduledOp('op-fail')!.status).toBe('pending')
    // Successful op completes
    expect(getScheduledOp('op-ok')!.status).toBe('completed')
  })

  it('marks missed ops (due > 5 min ago)', async () => {
    const session = getOrCreateSession(WALLET)
    const op = createScheduledOp({
      session_id: session.id, action: 'send', params: {},
      wallet_signature: 'sig', next_exec: Date.now() - 6 * 60_000,
      expires_at: Date.now() + 3600_000, max_exec: 1,
    })

    const executor = vi.fn()
    const result = await crankTick(executor)

    expect(result.missed).toBe(1)
    expect(getScheduledOp(op.id)!.status).toBe('missed')
    expect(executor).not.toHaveBeenCalled()
  })

  it('returns zero counts when no ops pending', async () => {
    const executor = vi.fn()
    const result = await crankTick(executor)
    expect(result).toEqual({ executed: 0, expired: 0, missed: 0, failed: 0 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/crank.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement the crank engine**

```typescript
// packages/agent/src/crank.ts
import {
  getPendingOps,
  updateScheduledOp,
  logAudit,
} from './db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Crank engine — executes due scheduled operations
// ─────────────────────────────────────────────────────────────────────────────

/** Ops due more than 5 minutes ago are marked as missed. */
const MISS_WINDOW_MS = 5 * 60 * 1000

export type OpExecutor = (action: string, params: Record<string, unknown>) => Promise<unknown>

export interface CrankTickResult {
  executed: number
  expired: number
  missed: number
  failed: number
}

/**
 * Single crank tick — process all due scheduled operations.
 * Ops are executed sequentially to avoid race conditions.
 */
export async function crankTick(executor: OpExecutor): Promise<CrankTickResult> {
  const now = Date.now()
  const ops = getPendingOps(now)
  const result: CrankTickResult = { executed: 0, expired: 0, missed: 0, failed: 0 }

  for (const op of ops) {
    // Expired — mark without executing
    if (op.expires_at < now) {
      updateScheduledOp(op.id, { status: 'expired' })
      result.expired++
      continue
    }

    // Missed — too old to execute safely
    if (op.next_exec < now - MISS_WINDOW_MS) {
      updateScheduledOp(op.id, { status: 'missed' })
      result.missed++
      continue
    }

    // Execute the operation
    try {
      updateScheduledOp(op.id, { status: 'executing' })
      await executor(op.action, op.params)

      const newExecCount = op.exec_count + 1
      logAudit(op.session_id, op.action, op.params, 'prepared')

      if (newExecCount >= op.max_exec) {
        // One-shot or final execution — mark completed
        updateScheduledOp(op.id, { status: 'completed', exec_count: newExecCount })
      } else {
        // Recurring — calculate next execution time
        const intervalMs = (op.params.intervalMs as number) ?? 60_000
        const nextExec = now + intervalMs
        updateScheduledOp(op.id, { status: 'pending', exec_count: newExecCount, next_exec: nextExec })
      }

      result.executed++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logAudit(op.session_id, op.action, { ...op.params, error: msg }, 'failed')
      // Revert to pending for retry on next tick
      updateScheduledOp(op.id, { status: 'pending' })
      result.failed++
    }
  }

  return result
}

/** Start the crank interval (60 seconds). Returns the timer handle. */
export function startCrank(executor: OpExecutor): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const result = await crankTick(executor)
      const total = result.executed + result.expired + result.missed + result.failed
      if (total > 0) {
        console.log(`[crank] tick: ${result.executed} exec, ${result.expired} expired, ${result.missed} missed, ${result.failed} failed`)
      }
    } catch (error) {
      console.error('[crank] tick error:', error)
    }
  }, 60_000)
}

/** Stop the crank interval. */
export function stopCrank(timer: NodeJS.Timeout): void {
  clearInterval(timer)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/crank.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/crank.ts packages/agent/tests/crank.test.ts
git commit -m "feat(agent): add crank engine — 60s scheduled ops executor"
```

---

## Task 3: roundAmount Tool

Synchronous tool — no crank dependency. Rounds an amount down to the nearest common denomination and returns the rounded amount + remainder. This is a pure calculation tool that wraps the existing `send` tool.

**Files:**
- Create: `packages/agent/src/tools/round-amount.ts`
- Create: `packages/agent/tests/round-amount.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/round-amount.test.ts
import { describe, it, expect } from 'vitest'

const { roundAmountTool, executeRoundAmount } = await import('../src/tools/round-amount.js')

describe('roundAmount tool definition', () => {
  it('has correct name', () => {
    expect(roundAmountTool.name).toBe('roundAmount')
  })

  it('requires amount and token', () => {
    expect(roundAmountTool.input_schema.required).toContain('amount')
    expect(roundAmountTool.input_schema.required).toContain('token')
  })
})

describe('executeRoundAmount', () => {
  it('rounds 1337.42 to 1000', async () => {
    const result = await executeRoundAmount({ amount: 1337.42, token: 'USDC' })
    expect(result.action).toBe('roundAmount')
    expect(result.roundedAmount).toBe(1000)
    expect(result.remainder).toBeCloseTo(337.42, 2)
    expect(result.denomination).toBe(1000)
  })

  it('rounds 73 to 50', async () => {
    const result = await executeRoundAmount({ amount: 73, token: 'SOL' })
    expect(result.roundedAmount).toBe(50)
    expect(result.remainder).toBeCloseTo(23, 2)
    expect(result.denomination).toBe(50)
  })

  it('rounds 5432 to 5000', async () => {
    const result = await executeRoundAmount({ amount: 5432, token: 'USDC' })
    expect(result.roundedAmount).toBe(5000)
    expect(result.remainder).toBeCloseTo(432, 2)
    expect(result.denomination).toBe(5000)
  })

  it('rounds 15000 to 10000', async () => {
    const result = await executeRoundAmount({ amount: 15000, token: 'USDC' })
    expect(result.roundedAmount).toBe(10000)
    expect(result.remainder).toBeCloseTo(5000, 2)
    expect(result.denomination).toBe(10000)
  })

  it('returns exact amount if already a denomination', async () => {
    const result = await executeRoundAmount({ amount: 100, token: 'USDC' })
    expect(result.roundedAmount).toBe(100)
    expect(result.remainder).toBe(0)
  })

  it('handles amounts below smallest denomination', async () => {
    const result = await executeRoundAmount({ amount: 7, token: 'SOL' })
    expect(result.roundedAmount).toBe(0)
    expect(result.remainder).toBe(7)
    expect(result.denomination).toBe(0)
    expect(result.message).toMatch(/too small/i)
  })

  it('throws when amount is zero or negative', async () => {
    await expect(executeRoundAmount({ amount: 0, token: 'SOL' })).rejects.toThrow(/amount/i)
    await expect(executeRoundAmount({ amount: -5, token: 'SOL' })).rejects.toThrow(/amount/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/round-amount.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement roundAmount tool**

```typescript
// packages/agent/src/tools/round-amount.ts
import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// roundAmount tool — Auto-round to common denominations
// ─────────────────────────────────────────────────────────────────────────────

const DENOMINATIONS = [10000, 5000, 1000, 500, 100, 50, 10]

export interface RoundAmountParams {
  amount: number
  token: string
}

export interface RoundAmountToolResult {
  action: 'roundAmount'
  status: 'success'
  message: string
  roundedAmount: number
  remainder: number
  denomination: number
  token: string
}

export const roundAmountTool: Anthropic.Tool = {
  name: 'roundAmount',
  description:
    'Round a payment amount down to a common denomination to reduce amount correlation. ' +
    'Denominations: 10, 50, 100, 500, 1000, 5000, 10000. ' +
    'The remainder stays in the vault.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to round (will be rounded DOWN to the nearest denomination)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, etc.',
      },
    },
    required: ['amount', 'token'],
  },
}

export async function executeRoundAmount(
  params: RoundAmountParams,
): Promise<RoundAmountToolResult> {
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const token = params.token.toUpperCase()

  // Find the largest denomination that fits
  let denomination = 0
  let roundedAmount = 0
  for (const denom of DENOMINATIONS) {
    if (params.amount >= denom) {
      denomination = denom
      roundedAmount = Math.floor(params.amount / denom) * denom
      break
    }
  }

  const remainder = Math.round((params.amount - roundedAmount) * 100) / 100

  if (roundedAmount === 0) {
    return {
      action: 'roundAmount',
      status: 'success',
      message: `Amount ${params.amount} ${token} is too small to round — minimum denomination is 10. Full amount stays in vault.`,
      roundedAmount: 0,
      remainder: params.amount,
      denomination: 0,
      token,
    }
  }

  return {
    action: 'roundAmount',
    status: 'success',
    message: `Rounded ${params.amount} ${token} → ${roundedAmount} ${token} (denomination: ${denomination}). Remainder: ${remainder} ${token} stays in vault.`,
    roundedAmount,
    remainder,
    denomination,
    token,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/round-amount.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/round-amount.ts packages/agent/tests/round-amount.test.ts
git commit -m "feat(agent): add roundAmount tool — denomination rounding for privacy"
```

---

## Task 4: scheduleSend Tool

The simplest crank-dependent tool. Creates a single scheduled_op with a delayed send.

**Files:**
- Create: `packages/agent/src/tools/schedule-send.ts`
- Create: `packages/agent/tests/schedule-send.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/schedule-send.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOp } from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { scheduleSendTool, executeScheduleSend } = await import('../src/tools/schedule-send.js')

describe('scheduleSend tool definition', () => {
  it('has correct name', () => {
    expect(scheduleSendTool.name).toBe('scheduleSend')
  })

  it('requires wallet, amount, token, recipient', () => {
    const req = scheduleSendTool.input_schema.required as string[]
    expect(req).toContain('wallet')
    expect(req).toContain('amount')
    expect(req).toContain('token')
    expect(req).toContain('recipient')
  })
})

describe('executeScheduleSend', () => {
  it('creates a scheduled op with exact delay', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 100, token: 'USDC', recipient: 'RecipientAddr11111111111111111111',
      delayMinutes: 60, walletSignature: 'sig123',
    })
    expect(result.action).toBe('scheduleSend')
    expect(result.status).toBe('success')
    expect(result.scheduled.opId).toBeDefined()
    expect(result.scheduled.executesAt).toBeGreaterThan(Date.now() + 55 * 60_000)

    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.action).toBe('send')
    expect(op.params.amount).toBe(100)
    expect(op.max_exec).toBe(1)
    expect(op.status).toBe('pending')
  })

  it('creates a scheduled op with random delay range', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 50, token: 'SOL', recipient: 'RecipientAddr11111111111111111111',
      delayMinutesMin: 60, delayMinutesMax: 120, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    const delayMs = op.next_exec - Date.now()
    expect(delayMs).toBeGreaterThan(55 * 60_000)
    expect(delayMs).toBeLessThan(125 * 60_000)
  })

  it('defaults delay to 30-60 minutes when not specified', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 10, token: 'SOL', recipient: 'RecipientAddr11111111111111111111',
      walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    const delayMs = op.next_exec - Date.now()
    expect(delayMs).toBeGreaterThan(25 * 60_000)
    expect(delayMs).toBeLessThan(65 * 60_000)
  })

  it('sets expiry to delay + 1 hour', async () => {
    const result = await executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 10, token: 'SOL', recipient: 'addr',
      delayMinutes: 60, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.expires_at).toBeGreaterThan(op.next_exec + 50 * 60_000)
  })

  it('throws when wallet is missing', async () => {
    await expect(executeScheduleSend({
      amount: 10, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    } as any)).rejects.toThrow(/wallet/i)
  })

  it('throws when amount is zero', async () => {
    await expect(executeScheduleSend({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      amount: 0, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })).rejects.toThrow(/amount/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/schedule-send.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement scheduleSend tool**

```typescript
// packages/agent/src/tools/schedule-send.ts
import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// scheduleSend tool — Delayed private send
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduleSendParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  delayMinutes?: number
  delayMinutesMin?: number
  delayMinutesMax?: number
  walletSignature: string
}

export interface ScheduleSendToolResult {
  action: 'scheduleSend'
  status: 'success'
  message: string
  scheduled: {
    opId: string
    executesAt: number
    amount: number
    token: string
    recipient: string
  }
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export const scheduleSendTool: Anthropic.Tool = {
  name: 'scheduleSend',
  description:
    'Schedule a private send for later execution. ' +
    'Specify an exact delay or a random range (e.g. "in 4-8 hours"). ' +
    'The crank worker executes it automatically.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Amount to send' },
      token: { type: 'string', description: 'Token symbol (SOL, USDC, etc.)' },
      recipient: { type: 'string', description: 'Recipient address or stealth meta-address' },
      delayMinutes: { type: 'number', description: 'Exact delay in minutes' },
      delayMinutesMin: { type: 'number', description: 'Random delay range min (minutes)' },
      delayMinutesMax: { type: 'number', description: 'Random delay range max (minutes)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing this scheduled operation' },
    },
    required: ['wallet', 'amount', 'token', 'recipient'],
  },
}

export async function executeScheduleSend(
  params: ScheduleSendParams,
): Promise<ScheduleSendToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  // Determine delay
  let delayMs: number
  if (params.delayMinutes !== undefined) {
    delayMs = params.delayMinutes * 60_000
  } else if (params.delayMinutesMin !== undefined && params.delayMinutesMax !== undefined) {
    delayMs = randomInRange(params.delayMinutesMin, params.delayMinutesMax) * 60_000
  } else {
    delayMs = randomInRange(30, 60) * 60_000
  }

  const now = Date.now()
  const executesAt = now + delayMs
  const expiresAt = executesAt + 60 * 60_000 // 1 hour after scheduled time

  const session = getOrCreateSession(params.wallet)
  const op = createScheduledOp({
    session_id: session.id,
    action: 'send',
    params: {
      amount: params.amount,
      token: params.token,
      recipient: params.recipient,
      wallet: params.wallet,
    },
    wallet_signature: params.walletSignature ?? 'pending',
    next_exec: executesAt,
    expires_at: expiresAt,
    max_exec: 1,
  })

  const delayMinutes = Math.round(delayMs / 60_000)

  return {
    action: 'scheduleSend',
    status: 'success',
    message: `Send of ${params.amount} ${params.token} scheduled in ~${delayMinutes} minutes. The crank worker will execute it automatically.`,
    scheduled: {
      opId: op.id,
      executesAt,
      amount: params.amount,
      token: params.token,
      recipient: params.recipient,
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/schedule-send.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/schedule-send.ts packages/agent/tests/schedule-send.test.ts
git commit -m "feat(agent): add scheduleSend tool — delayed private sends"
```

---

## Task 5: splitSend Tool

Split an amount into N random chunks with staggered delays. Each chunk gets its own scheduled_op.

**Files:**
- Create: `packages/agent/src/tools/split-send.ts`
- Create: `packages/agent/tests/split-send.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/split-send.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

beforeEach(() => {
  process.env.DB_PATH = ':memory:'
})

afterEach(() => {
  closeDb()
  delete process.env.DB_PATH
})

const { splitSendTool, executeSplitSend } = await import('../src/tools/split-send.js')

const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('splitSend tool definition', () => {
  it('has correct name', () => {
    expect(splitSendTool.name).toBe('splitSend')
  })
})

describe('executeSplitSend', () => {
  it('auto-determines 2 chunks for amount < 100', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 50, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(2)
    const total = result.chunks.reduce((s, c) => s + c.amount, 0)
    expect(total).toBeCloseTo(50, 4)
  })

  it('auto-determines 3 chunks for amount < 1000', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 500, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(3)
  })

  it('auto-determines 4 chunks for amount < 10000', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 5000, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(4)
  })

  it('auto-determines 5 chunks for amount >= 10000', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 50000, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(5)
  })

  it('respects user override for chunk count', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 50, token: 'SOL', recipient: 'addr', chunks: 7, walletSignature: 'sig',
    })
    expect(result.chunks).toHaveLength(7)
  })

  it('chunk amounts sum to total', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 1234.56, token: 'USDC', recipient: 'addr', walletSignature: 'sig',
    })
    const total = result.chunks.reduce((s, c) => s + c.amount, 0)
    expect(total).toBeCloseTo(1234.56, 2)
  })

  it('creates one scheduled_op per chunk', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    const session = getOrCreateSession(WALLET)
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(result.chunks.length)
    expect(ops.every(op => op.action === 'send')).toBe(true)
    expect(ops.every(op => op.max_exec === 1)).toBe(true)
  })

  it('staggers execution times over spread window', async () => {
    const result = await executeSplitSend({
      wallet: WALLET, amount: 200, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    const times = result.chunks.map(c => c.executesAt)
    // Should be sorted ascending
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1])
    }
    // Spread should be within 6 hours default
    const spread = times[times.length - 1] - times[0]
    expect(spread).toBeLessThan(6 * 3600_000 + 60_000)
  })

  it('throws when amount is zero', async () => {
    await expect(executeSplitSend({
      wallet: WALLET, amount: 0, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })).rejects.toThrow(/amount/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/split-send.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement splitSend tool**

```typescript
// packages/agent/src/tools/split-send.ts
import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// splitSend tool — Split amount into N random chunks with staggered delays
// ─────────────────────────────────────────────────────────────────────────────

export interface SplitSendParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  chunks?: number
  spreadHours?: number
  walletSignature: string
}

export interface ChunkInfo {
  opId: string
  amount: number
  executesAt: number
}

export interface SplitSendToolResult {
  action: 'splitSend'
  status: 'success'
  message: string
  chunks: ChunkInfo[]
  totalAmount: number
  token: string
  recipient: string
}

function autoChunkCount(amount: number): number {
  if (amount < 100) return 2
  if (amount < 1000) return 3
  if (amount < 10000) return 4
  return 5
}

/** Split total into N random parts that sum exactly to total. */
function randomSplit(total: number, n: number): number[] {
  if (n <= 1) return [total]
  const cuts: number[] = []
  for (let i = 0; i < n - 1; i++) {
    cuts.push(Math.random() * total)
  }
  cuts.sort((a, b) => a - b)

  const parts: number[] = []
  let prev = 0
  for (const cut of cuts) {
    parts.push(Math.round((cut - prev) * 100) / 100)
    prev = cut
  }
  parts.push(Math.round((total - prev) * 100) / 100)

  // Adjust rounding error on the last chunk
  const sum = parts.reduce((s, p) => s + p, 0)
  parts[parts.length - 1] += Math.round((total - sum) * 100) / 100

  return parts
}

export const splitSendTool: Anthropic.Tool = {
  name: 'splitSend',
  description:
    'Split a payment into N random chunks sent at staggered times. ' +
    'Breaks amount correlation and timing analysis. ' +
    'Chunk count auto-determined by amount size, or specify manually.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Total amount to send' },
      token: { type: 'string', description: 'Token symbol' },
      recipient: { type: 'string', description: 'Recipient address or stealth meta-address' },
      chunks: { type: 'number', description: 'Number of chunks (auto-determined if omitted)' },
      spreadHours: { type: 'number', description: 'Spread window in hours (default: 6)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing the operation' },
    },
    required: ['wallet', 'amount', 'token', 'recipient'],
  },
}

export async function executeSplitSend(
  params: SplitSendParams,
): Promise<SplitSendToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required')
  }
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const n = params.chunks ?? autoChunkCount(params.amount)
  const spreadMs = (params.spreadHours ?? 6) * 3600_000
  const amounts = randomSplit(params.amount, n)
  const token = params.token.toUpperCase()

  const session = getOrCreateSession(params.wallet)
  const now = Date.now()
  const chunks: ChunkInfo[] = []

  for (let i = 0; i < n; i++) {
    // Stagger evenly across the spread window with some randomness
    const baseDelay = (i / (n - 1 || 1)) * spreadMs
    const jitter = (Math.random() - 0.5) * (spreadMs / n) * 0.3
    const executesAt = now + Math.max(60_000, baseDelay + jitter) // min 1 minute

    const op = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: {
        amount: amounts[i],
        token,
        recipient: params.recipient,
        wallet: params.wallet,
      },
      wallet_signature: params.walletSignature ?? 'pending',
      next_exec: executesAt,
      expires_at: executesAt + 3600_000,
      max_exec: 1,
    })

    chunks.push({ opId: op.id, amount: amounts[i], executesAt })
  }

  // Sort by execution time
  chunks.sort((a, b) => a.executesAt - b.executesAt)

  return {
    action: 'splitSend',
    status: 'success',
    message: `Split ${params.amount} ${token} into ${n} chunks over ~${params.spreadHours ?? 6}h. Each chunk uses a unique stealth address.`,
    chunks,
    totalAmount: params.amount,
    token,
    recipient: params.recipient,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/split-send.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/split-send.ts packages/agent/tests/split-send.test.ts
git commit -m "feat(agent): add splitSend tool — random chunk splitting with staggered timing"
```

---

## Task 6: drip Tool

DCA-style distribution — send an amount over N days with randomized amounts and jitter.

**Files:**
- Create: `packages/agent/src/tools/drip.ts`
- Create: `packages/agent/tests/drip.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/drip.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { dripTool, executeDrip } = await import('../src/tools/drip.js')
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('drip tool definition', () => {
  it('has correct name', () => { expect(dripTool.name).toBe('drip') })
})

describe('executeDrip', () => {
  it('creates N drip ops over specified days', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 1000, token: 'USDC', recipient: 'addr',
      days: 5, walletSignature: 'sig',
    })
    expect(result.action).toBe('drip')
    expect(result.drips).toHaveLength(5)
    const total = result.drips.reduce((s, d) => s + d.amount, 0)
    expect(total).toBeCloseTo(1000, 0)
  })

  it('amounts are randomized +-10% of equal split', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 1000, token: 'USDC', recipient: 'addr',
      days: 10, walletSignature: 'sig',
    })
    const equalSplit = 100 // 1000 / 10
    for (const drip of result.drips) {
      expect(drip.amount).toBeGreaterThanOrEqual(equalSplit * 0.85)
      expect(drip.amount).toBeLessThanOrEqual(equalSplit * 1.15)
    }
  })

  it('spreads execution over the correct number of days', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 500, token: 'SOL', recipient: 'addr',
      days: 5, walletSignature: 'sig',
    })
    const first = result.drips[0].executesAt
    const last = result.drips[result.drips.length - 1].executesAt
    const spreadDays = (last - first) / (24 * 3600_000)
    expect(spreadDays).toBeGreaterThan(3.5)
    expect(spreadDays).toBeLessThan(5.5)
  })

  it('creates scheduled_ops in DB', async () => {
    await executeDrip({
      wallet: WALLET, amount: 300, token: 'SOL', recipient: 'addr',
      days: 3, walletSignature: 'sig',
    })
    const session = getOrCreateSession(WALLET)
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(3)
    expect(ops.every(op => op.action === 'send')).toBe(true)
  })

  it('throws when days is less than 1', async () => {
    await expect(executeDrip({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      days: 0, walletSignature: 'sig',
    })).rejects.toThrow(/days/i)
  })

  it('defaults to 5 days when not specified', async () => {
    const result = await executeDrip({
      wallet: WALLET, amount: 500, token: 'SOL', recipient: 'addr', walletSignature: 'sig',
    })
    expect(result.drips).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Implement drip tool**

```typescript
// packages/agent/src/tools/drip.ts
import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'

export interface DripParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  days?: number
  walletSignature: string
}

export interface DripInfo {
  opId: string
  amount: number
  executesAt: number
}

export interface DripToolResult {
  action: 'drip'
  status: 'success'
  message: string
  drips: DripInfo[]
  totalAmount: number
  token: string
  days: number
}

export const dripTool: Anthropic.Tool = {
  name: 'drip',
  description:
    'DCA-style private distribution — send an amount over N days with randomized amounts and timing jitter. ' +
    'Each drip is a separate stealth send.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Total amount to distribute' },
      token: { type: 'string', description: 'Token symbol' },
      recipient: { type: 'string', description: 'Recipient address or stealth meta-address' },
      days: { type: 'number', description: 'Number of days to distribute over (default: 5)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing the operation' },
    },
    required: ['wallet', 'amount', 'token', 'recipient'],
  },
}

export async function executeDrip(params: DripParams): Promise<DripToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) throw new Error('Wallet address is required')
  if (!params.amount || params.amount <= 0) throw new Error('Amount must be greater than zero')

  const days = params.days ?? 5
  if (days < 1) throw new Error('Days must be at least 1')

  const token = params.token.toUpperCase()
  const n = days
  const equalSplit = params.amount / n
  const session = getOrCreateSession(params.wallet)
  const now = Date.now()
  const dayMs = 24 * 3600_000
  const jitterMs = 4 * 3600_000 // +-4h jitter

  // Generate randomized amounts (+-10% of equal split)
  const rawAmounts: number[] = []
  for (let i = 0; i < n; i++) {
    const factor = 0.9 + Math.random() * 0.2 // 0.9 to 1.1
    rawAmounts.push(equalSplit * factor)
  }
  // Normalize so they sum to exactly params.amount
  const rawTotal = rawAmounts.reduce((s, a) => s + a, 0)
  const amounts = rawAmounts.map(a => Math.round((a / rawTotal) * params.amount * 100) / 100)
  // Fix rounding error on last element
  const sum = amounts.reduce((s, a) => s + a, 0)
  amounts[amounts.length - 1] += Math.round((params.amount - sum) * 100) / 100

  const drips: DripInfo[] = []
  for (let i = 0; i < n; i++) {
    const baseTime = now + (i + 1) * dayMs / (n > 1 ? 1 : 1) * (i / Math.max(n - 1, 1)) * (days)
    // Simpler: evenly space across `days` with jitter
    const intervalMs = (days * dayMs) / n
    const scheduleTime = now + intervalMs * i + (Math.random() - 0.5) * jitterMs
    const executesAt = Math.max(now + 60_000, scheduleTime) // min 1 min from now

    const op = createScheduledOp({
      session_id: session.id,
      action: 'send',
      params: { amount: amounts[i], token, recipient: params.recipient, wallet: params.wallet },
      wallet_signature: params.walletSignature ?? 'pending',
      next_exec: executesAt,
      expires_at: executesAt + dayMs, // expires 1 day after scheduled
      max_exec: 1,
    })

    drips.push({ opId: op.id, amount: amounts[i], executesAt })
  }

  drips.sort((a, b) => a.executesAt - b.executesAt)

  return {
    action: 'drip',
    status: 'success',
    message: `Distributing ${params.amount} ${token} over ${days} days in ${n} drips to ${params.recipient}.`,
    drips, totalAmount: params.amount, token, days,
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/drip.test.ts 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/drip.ts packages/agent/tests/drip.test.ts
git commit -m "feat(agent): add drip tool — DCA-style private distribution"
```

---

## Task 7: recurring Tool

Recurring private payments on interval with amount jitter.

**Files:**
- Create: `packages/agent/src/tools/recurring.ts`
- Create: `packages/agent/tests/recurring.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/recurring.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOp } from '../src/db.js'

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { recurringTool, executeRecurring } = await import('../src/tools/recurring.js')
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('recurring tool definition', () => {
  it('has correct name', () => { expect(recurringTool.name).toBe('recurring') })
  it('requires maxExecutions', () => {
    expect(recurringTool.input_schema.required).toContain('maxExecutions')
  })
})

describe('executeRecurring', () => {
  it('creates a single recurring scheduled op', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 500, token: 'USDC', recipient: 'addr',
      intervalDays: 14, maxExecutions: 6, walletSignature: 'sig',
    })
    expect(result.action).toBe('recurring')
    expect(result.scheduled.opId).toBeDefined()
    expect(result.scheduled.maxExecutions).toBe(6)
    expect(result.scheduled.intervalDays).toBe(14)

    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.max_exec).toBe(6)
    expect(op.params.intervalMs).toBe(14 * 24 * 3600_000)
    expect(op.status).toBe('pending')
  })

  it('first execution is approximately intervalDays from now', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, maxExecutions: 4, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    const delayDays = (op.next_exec - Date.now()) / (24 * 3600_000)
    // Should be within ~1 day of 7 (jitter +-24h)
    expect(delayDays).toBeGreaterThan(5.5)
    expect(delayDays).toBeLessThan(8.5)
  })

  it('stores amountJitterPct in params', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, maxExecutions: 2, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    expect(op.params.amountJitterPct).toBe(0.05) // default 5%
  })

  it('throws when maxExecutions is missing', async () => {
    await expect(executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, walletSignature: 'sig',
    } as any)).rejects.toThrow(/maxExecutions/i)
  })

  it('throws when intervalDays is zero', async () => {
    await expect(executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 0, maxExecutions: 3, walletSignature: 'sig',
    })).rejects.toThrow(/interval/i)
  })

  it('sets expiry based on total schedule duration', async () => {
    const result = await executeRecurring({
      wallet: WALLET, amount: 100, token: 'SOL', recipient: 'addr',
      intervalDays: 7, maxExecutions: 4, walletSignature: 'sig',
    })
    const op = getScheduledOp(result.scheduled.opId)!
    // Expires after: maxExecutions * interval + buffer
    const expectedMinExpiry = Date.now() + 4 * 7 * 24 * 3600_000
    expect(op.expires_at).toBeGreaterThan(expectedMinExpiry)
  })
})
```

- [ ] **Step 2: Implement recurring tool**

```typescript
// packages/agent/src/tools/recurring.ts
import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'

export interface RecurringParams {
  wallet: string
  amount: number
  token: string
  recipient: string
  intervalDays: number
  maxExecutions: number
  walletSignature: string
}

export interface RecurringToolResult {
  action: 'recurring'
  status: 'success'
  message: string
  scheduled: {
    opId: string
    firstExecution: number
    intervalDays: number
    maxExecutions: number
    expiresAt: number
  }
}

export const recurringTool: Anthropic.Tool = {
  name: 'recurring',
  description:
    'Set up recurring private payments on an interval. ' +
    'Amount randomized +-5% each execution. Timing jittered +-24h. ' +
    'Max execution count is REQUIRED (no infinite recurring).',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      amount: { type: 'number', description: 'Base amount per payment' },
      token: { type: 'string', description: 'Token symbol' },
      recipient: { type: 'string', description: 'Recipient address' },
      intervalDays: { type: 'number', description: 'Days between payments' },
      maxExecutions: { type: 'number', description: 'Maximum number of payments (required, no infinite)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing the operation' },
    },
    required: ['wallet', 'amount', 'token', 'recipient', 'intervalDays', 'maxExecutions'],
  },
}

export async function executeRecurring(params: RecurringParams): Promise<RecurringToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) throw new Error('Wallet address is required')
  if (!params.amount || params.amount <= 0) throw new Error('Amount must be greater than zero')
  if (!params.intervalDays || params.intervalDays <= 0) throw new Error('Interval must be at least 1 day')
  if (!params.maxExecutions || params.maxExecutions <= 0) throw new Error('maxExecutions is required and must be positive')

  const token = params.token.toUpperCase()
  const intervalMs = params.intervalDays * 24 * 3600_000
  const jitterMs = 24 * 3600_000 // +-24h jitter
  const now = Date.now()

  // First execution: interval from now with jitter
  const firstExec = now + intervalMs + (Math.random() - 0.5) * jitterMs

  // Expires: enough time for all executions + 1 extra interval buffer
  const expiresAt = now + (params.maxExecutions + 1) * intervalMs

  const session = getOrCreateSession(params.wallet)
  const op = createScheduledOp({
    session_id: session.id,
    action: 'send',
    params: {
      amount: params.amount,
      token,
      recipient: params.recipient,
      wallet: params.wallet,
      intervalMs,
      amountJitterPct: 0.05,
    },
    wallet_signature: params.walletSignature ?? 'pending',
    next_exec: firstExec,
    expires_at: expiresAt,
    max_exec: params.maxExecutions,
  })

  return {
    action: 'recurring',
    status: 'success',
    message: `Recurring payment: ~${params.amount} ${token} every ${params.intervalDays} days to ${params.recipient}. Max ${params.maxExecutions} payments.`,
    scheduled: {
      opId: op.id,
      firstExecution: firstExec,
      intervalDays: params.intervalDays,
      maxExecutions: params.maxExecutions,
      expiresAt,
    },
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/recurring.test.ts 2>&1 | tail -5
git add packages/agent/src/tools/recurring.ts packages/agent/tests/recurring.test.ts
git commit -m "feat(agent): add recurring tool — repeating private payments with jitter"
```

---

## Task 8: sweep Tool

Auto-shield incoming wallet funds. Creates a persistent scheduled_op that the crank polls.

**Files:**
- Create: `packages/agent/src/tools/sweep.ts`
- Create: `packages/agent/tests/sweep.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/sweep.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOp, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { sweepTool, executeSweep } = await import('../src/tools/sweep.js')
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

describe('sweep tool definition', () => {
  it('has correct name', () => { expect(sweepTool.name).toBe('sweep') })
})

describe('executeSweep', () => {
  it('creates a persistent sweep scheduled op', async () => {
    const result = await executeSweep({
      wallet: WALLET, token: 'SOL', walletSignature: 'sig',
    })
    expect(result.action).toBe('sweep')
    expect(result.status).toBe('success')
    expect(result.sweep.opId).toBeDefined()

    const op = getScheduledOp(result.sweep.opId)!
    expect(op.action).toBe('sweep')
    expect(op.params.wallet).toBe(WALLET)
    expect(op.params.token).toBe('SOL')
    expect(op.max_exec).toBeGreaterThan(1000)
    expect(op.status).toBe('pending')
  })

  it('sets next_exec to near-immediate', async () => {
    const result = await executeSweep({
      wallet: WALLET, token: 'SOL', walletSignature: 'sig',
    })
    const op = getScheduledOp(result.sweep.opId)!
    expect(op.next_exec - Date.now()).toBeLessThan(61_000)
  })

  it('sets long expiry (30 days default)', async () => {
    const result = await executeSweep({
      wallet: WALLET, token: 'SOL', walletSignature: 'sig',
    })
    const op = getScheduledOp(result.sweep.opId)!
    const thirtyDays = 30 * 24 * 3600_000
    expect(op.expires_at - Date.now()).toBeGreaterThan(thirtyDays - 60_000)
  })

  it('throws when wallet is missing', async () => {
    await expect(executeSweep({ token: 'SOL', walletSignature: 'sig' } as any))
      .rejects.toThrow(/wallet/i)
  })

  it('prevents duplicate sweep for same wallet+token', async () => {
    await executeSweep({ wallet: WALLET, token: 'SOL', walletSignature: 'sig' })
    await expect(executeSweep({ wallet: WALLET, token: 'SOL', walletSignature: 'sig' }))
      .rejects.toThrow(/already.*active/i)
  })
})
```

- [ ] **Step 2: Implement sweep tool**

```typescript
// packages/agent/src/tools/sweep.ts
import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession, getScheduledOpsBySession } from '../db.js'

export interface SweepParams {
  wallet: string
  token?: string
  walletSignature: string
}

export interface SweepToolResult {
  action: 'sweep'
  status: 'success'
  message: string
  sweep: {
    opId: string
    token: string
    expiresAt: number
  }
}

export const sweepTool: Anthropic.Tool = {
  name: 'sweep',
  description:
    'Auto-shield incoming wallet funds. ' +
    'Monitors your wallet for new token transfers and automatically deposits them into the vault. ' +
    'Phase 1: poll-based (every 60 seconds via crank).',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Wallet to monitor (base58)' },
      token: { type: 'string', description: 'Token to sweep (default: SOL)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing auto-deposits' },
    },
    required: ['wallet'],
  },
}

export async function executeSweep(params: SweepParams): Promise<SweepToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) {
    throw new Error('Wallet address is required for sweep')
  }

  const token = (params.token ?? 'SOL').toUpperCase()
  const session = getOrCreateSession(params.wallet)

  // Check for existing active sweep
  const existing = getScheduledOpsBySession(session.id)
  const activeSweep = existing.find(
    op => op.action === 'sweep' && op.status === 'pending' &&
          (op.params.token as string) === token,
  )
  if (activeSweep) {
    throw new Error(`Sweep already active for ${token} on this wallet`)
  }

  const now = Date.now()
  const thirtyDays = 30 * 24 * 3600_000
  const expiresAt = now + thirtyDays

  const op = createScheduledOp({
    session_id: session.id,
    action: 'sweep',
    params: {
      wallet: params.wallet,
      token,
      intervalMs: 60_000, // re-poll every 60s
    },
    wallet_signature: params.walletSignature ?? 'pending',
    next_exec: now + 60_000, // start in 1 minute
    expires_at: expiresAt,
    max_exec: 999_999, // effectively unlimited
  })

  return {
    action: 'sweep',
    status: 'success',
    message: `Auto-sweep enabled for ${token}. Incoming transfers will be auto-deposited into the vault.`,
    sweep: { opId: op.id, token, expiresAt },
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/sweep.test.ts 2>&1 | tail -5
git add packages/agent/src/tools/sweep.ts packages/agent/tests/sweep.test.ts
git commit -m "feat(agent): add sweep tool — auto-shield incoming wallet funds"
```

---

## Task 9: consolidate Tool

Merge multiple unclaimed stealth balances with staggered claim timing.

**Files:**
- Create: `packages/agent/src/tools/consolidate.ts`
- Create: `packages/agent/tests/consolidate.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/agent/tests/consolidate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { closeDb, getScheduledOpsBySession, getOrCreateSession } from '../src/db.js'

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn().mockReturnValue({
    getSignaturesForAddress: vi.fn().mockResolvedValue([]),
    getParsedTransactions: vi.fn().mockResolvedValue([]),
  }),
  scanForPayments: vi.fn().mockResolvedValue({
    payments: [
      { txSignature: 'tx1', stealthAddress: { toBase58: () => 'stealth1' }, transferAmount: 1000000000n, feeAmount: 5000000n, timestamp: 1700000000 },
      { txSignature: 'tx2', stealthAddress: { toBase58: () => 'stealth2' }, transferAmount: 2000000000n, feeAmount: 10000000n, timestamp: 1700000100 },
      { txSignature: 'tx3', stealthAddress: { toBase58: () => 'stealth3' }, transferAmount: 500000000n, feeAmount: 2500000n, timestamp: 1700000200 },
    ],
    eventsScanned: 100,
    hasMore: false,
  }),
}))

beforeEach(() => { process.env.DB_PATH = ':memory:' })
afterEach(() => { closeDb(); delete process.env.DB_PATH })

const { consolidateTool, executeConsolidate } = await import('../src/tools/consolidate.js')
const WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
const VIEW_KEY = 'ab'.repeat(32)
const SPEND_KEY = 'cd'.repeat(32)

describe('consolidate tool definition', () => {
  it('has correct name', () => { expect(consolidateTool.name).toBe('consolidate') })
})

describe('executeConsolidate', () => {
  it('creates staggered claim ops for unclaimed payments', async () => {
    const result = await executeConsolidate({
      wallet: WALLET, viewingKey: VIEW_KEY, spendingKey: SPEND_KEY, walletSignature: 'sig',
    })
    expect(result.action).toBe('consolidate')
    expect(result.claims).toHaveLength(3)
    expect(result.claims.every(c => c.opId)).toBe(true)
  })

  it('staggers claim times 1-4h apart', async () => {
    const result = await executeConsolidate({
      wallet: WALLET, viewingKey: VIEW_KEY, spendingKey: SPEND_KEY, walletSignature: 'sig',
    })
    for (let i = 1; i < result.claims.length; i++) {
      const gap = result.claims[i].executesAt - result.claims[i - 1].executesAt
      expect(gap).toBeGreaterThanOrEqual(55 * 60_000)   // ~1h min
      expect(gap).toBeLessThanOrEqual(4.5 * 3600_000)    // ~4h max
    }
  })

  it('creates scheduled_ops in DB', async () => {
    await executeConsolidate({
      wallet: WALLET, viewingKey: VIEW_KEY, spendingKey: SPEND_KEY, walletSignature: 'sig',
    })
    const session = getOrCreateSession(WALLET)
    const ops = getScheduledOpsBySession(session.id)
    expect(ops).toHaveLength(3)
    expect(ops.every(op => op.action === 'claim')).toBe(true)
  })

  it('throws when viewing key is missing', async () => {
    await expect(executeConsolidate({
      wallet: WALLET, spendingKey: SPEND_KEY, walletSignature: 'sig',
    } as any)).rejects.toThrow(/viewing/i)
  })
})
```

- [ ] **Step 2: Implement consolidate tool**

```typescript
// packages/agent/src/tools/consolidate.ts
import type Anthropic from '@anthropic-ai/sdk'
import { createScheduledOp, getOrCreateSession } from '../db.js'
import { createConnection, scanForPayments } from '@sipher/sdk'

export interface ConsolidateParams {
  wallet: string
  viewingKey: string
  spendingKey: string
  walletSignature: string
}

export interface ClaimInfo {
  opId: string
  txSignature: string
  stealthAddress: string
  executesAt: number
}

export interface ConsolidateToolResult {
  action: 'consolidate'
  status: 'success'
  message: string
  claims: ClaimInfo[]
  paymentsFound: number
}

export const consolidateTool: Anthropic.Tool = {
  name: 'consolidate',
  description:
    'Merge multiple unclaimed stealth balances with staggered claim timing. ' +
    'Scans for unclaimed payments and schedules claims with random 1-4h delays between each. ' +
    'Prevents clustering analysis from simultaneous claims.',
  input_schema: {
    type: 'object' as const,
    properties: {
      wallet: { type: 'string', description: 'Your wallet address (base58)' },
      viewingKey: { type: 'string', description: 'Your viewing private key (hex)' },
      spendingKey: { type: 'string', description: 'Your spending private key (hex)' },
      walletSignature: { type: 'string', description: 'Wallet signature authorizing claims' },
    },
    required: ['wallet', 'viewingKey', 'spendingKey'],
  },
}

export async function executeConsolidate(
  params: ConsolidateParams,
): Promise<ConsolidateToolResult> {
  if (!params.wallet || params.wallet.trim().length === 0) throw new Error('Wallet address is required')
  if (!params.viewingKey || params.viewingKey.trim().length === 0) throw new Error('Viewing key is required for scanning')
  if (!params.spendingKey || params.spendingKey.trim().length === 0) throw new Error('Spending key is required for claiming')

  const network = (process.env.SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  // Parse keys
  const vkHex = params.viewingKey.replace(/^0x/, '')
  const viewingPrivateKey = new Uint8Array(vkHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [])
  const skHex = params.spendingKey.replace(/^0x/, '')
  const spendingPrivateKey = new Uint8Array(skHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [])

  const scanResult = await scanForPayments({
    connection, viewingPrivateKey, spendingPrivateKey, limit: 200,
  })

  if (scanResult.payments.length === 0) {
    return {
      action: 'consolidate',
      status: 'success',
      message: 'No unclaimed payments found to consolidate.',
      claims: [],
      paymentsFound: 0,
    }
  }

  const session = getOrCreateSession(params.wallet)
  const now = Date.now()
  const claims: ClaimInfo[] = []

  for (let i = 0; i < scanResult.payments.length; i++) {
    const payment = scanResult.payments[i]
    // Stagger: 1-4 hours between each claim
    const minGap = 1 * 3600_000
    const maxGap = 4 * 3600_000
    const cumulativeDelay = i * (minGap + Math.random() * (maxGap - minGap))
    const executesAt = now + Math.max(60_000, cumulativeDelay)

    const op = createScheduledOp({
      session_id: session.id,
      action: 'claim',
      params: {
        wallet: params.wallet,
        txSignature: payment.txSignature,
        stealthAddress: payment.stealthAddress.toBase58(),
        viewingKey: params.viewingKey,
        spendingKey: params.spendingKey,
      },
      wallet_signature: params.walletSignature ?? 'pending',
      next_exec: executesAt,
      expires_at: executesAt + 24 * 3600_000,
      max_exec: 1,
    })

    claims.push({
      opId: op.id,
      txSignature: payment.txSignature,
      stealthAddress: payment.stealthAddress.toBase58(),
      executesAt,
    })
  }

  claims.sort((a, b) => a.executesAt - b.executesAt)

  return {
    action: 'consolidate',
    status: 'success',
    message: `Found ${scanResult.payments.length} unclaimed payments. Scheduling staggered claims over ~${Math.round(claims.length * 2.5)}h.`,
    claims,
    paymentsFound: scanResult.payments.length,
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run tests/consolidate.test.ts 2>&1 | tail -5
git add packages/agent/src/tools/consolidate.ts packages/agent/tests/consolidate.test.ts
git commit -m "feat(agent): add consolidate tool — staggered stealth balance merging"
```

---

## Task 10: Wire Everything Into Agent

Register all 7 new tools and start the crank worker.

**Files:**
- Modify: `packages/agent/src/tools/index.ts` — add 7 new exports
- Modify: `packages/agent/src/agent.ts` — register 7 tools in TOOLS, TOOL_EXECUTORS, SYSTEM_PROMPT
- Modify: `packages/agent/src/index.ts` — start crank worker
- Modify: `packages/agent/tests/tools.test.ts` — update count to 21

- [ ] **Step 1: Update tools/index.ts**

Append 7 new tool exports.

- [ ] **Step 2: Update agent.ts**

Merge 14 new imports (7 tools + 7 executors), expand TOOLS from 14→21, expand TOOL_EXECUTORS, update SYSTEM_PROMPT available tools line and add rules for scheduled ops.

- [ ] **Step 3: Update index.ts**

Add crank start after DB init:

```typescript
import { startCrank } from './crank.js'
import { executeTool } from './agent.js'

// Start crank worker (60s interval)
startCrank((action, params) => executeTool(action, params))
console.log('  Crank:   60s interval (scheduled ops)')
```

- [ ] **Step 4: Update tools.test.ts**

Change allTools/toolNames arrays to include 21 tools. Update count assertion from 14→21. Add new tool imports.

- [ ] **Step 5: Run full test suite**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test -- --run 2>&1 | tail -10
```

Expected: ~378+ tests (298 existing + ~80 new).

- [ ] **Step 6: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/tools/index.ts packages/agent/src/agent.ts packages/agent/src/index.ts packages/agent/tests/tools.test.ts
git commit -m "feat(agent): wire 7 time-based privacy tools + crank engine (21 total tools)"
```

---

## Dependency Graph

```
Task 1 (DB helpers) ──── Task 2 (crank engine)
                    \
                     ──── Task 4 (scheduleSend)
                      \── Task 5 (splitSend)
                       \─ Task 6 (drip)
                        \ Task 7 (recurring)
                         \Task 8 (sweep)
                          Task 9 (consolidate)

Task 3 (roundAmount) ─── (independent, no deps)

Tasks 1-9 ───────────── Task 10 (wire everything)
```

**Parallelizable:** Task 1 + Task 3 (no shared deps).
**Sequential after Task 1:** Tasks 2, 4-9 (all need DB helpers).
**Final:** Task 10 (after all).

---

## Test Count Summary

| Test File | New Tests | Purpose |
|-----------|-----------|---------|
| scheduled-ops.test.ts | ~10 | Scheduled ops CRUD |
| crank.test.ts | ~8 | Crank tick, expiry, missed, recurring |
| round-amount.test.ts | ~7 | Denomination rounding |
| schedule-send.test.ts | ~6 | Delayed sends |
| split-send.test.ts | ~9 | Random chunking + staggering |
| drip.test.ts | ~6 | DCA distribution |
| recurring.test.ts | ~6 | Repeating payments |
| sweep.test.ts | ~5 | Auto-shield |
| consolidate.test.ts | ~4 | Staggered claims |
| tools.test.ts (modified) | ~7 | Updated tool count |
| **Total** | **~68-80** | Target: 80 |
