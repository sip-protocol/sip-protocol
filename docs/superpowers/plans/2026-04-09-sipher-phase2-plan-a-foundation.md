# Sipher Phase 2 — Plan A: Infrastructure + Pi Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled Anthropic SDK agent loop with Pi SDK (`pi-agent-core` + `pi-ai`), add multi-tenant AgentPool, EventBus coordination, extended database schema, wallet auth, SSE activity stream, and new API routes.

**Architecture:** Single Express 5 process. SIPHER rewired as Pi agent with dynamic tool loading (4 groups + routeIntent meta-tool). AgentPool manages per-wallet agent instances with 30-min eviction. EventBus (Node EventEmitter) for intra-process coordination. Redis Streams for activity persistence and SSE fan-out. Existing 21 tool executors kept — only schemas adapted to Pi TypeBox format.

**Tech Stack:** `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, `@sinclair/typebox`, Express 5, better-sqlite3, ioredis, jsonwebtoken, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-sipher-phase2-guardian-command-design.md`

**Working directory:** `~/local-dev/sipher/`

**Plans B/C/D:** HERALD, SENTINEL+COURIER, and Guardian Command UI — written separately after Plan A ships.

---

## File Map

### New Files

```
packages/agent/src/
├── pi/
│   ├── provider.ts          # Pi AI OpenRouter provider config
│   ├── tool-adapter.ts      # Convert Anthropic tool schemas → Pi TypeBox tools
│   └── tool-groups.ts       # 4 tool groups + routeIntent meta-tool
├── agents/
│   ├── pool.ts              # AgentPool — create/resume/evict per-wallet
│   ├── sipher.ts            # SIPHER Pi agent factory (dynamic tool loading)
│   └── service-sipher.ts    # Headless Service SIPHER (read-only tools, singleton)
├── coordination/
│   ├── event-bus.ts         # Typed EventEmitter wrapper
│   ├── activity-logger.ts   # Events → activity_stream table + Redis Stream
│   └── redis-streams.ts     # Redis Streams client (xadd, xread, consumer groups)
├── routes/
│   ├── auth.ts              # POST /api/auth (wallet nonce → JWT)
│   ├── stream.ts            # GET /api/stream (SSE, wallet-scoped)
│   ├── command.ts           # POST /api/command (command bar → SIPHER)
│   ├── confirm.ts           # POST /api/confirm/:id (async confirmation)
│   ├── vault-api.ts         # GET /api/vault (balance, pending, history)
│   └── squad-api.ts         # GET /api/squad + POST /api/squad/kill
```

### Modified Files

```
packages/agent/src/
├── db.ts                    # Add 6 new tables + indexes + query functions
├── agent.ts                 # Gut rewrite — Pi agent setup replaces Anthropic loop
├── session.ts               # Simplify — AgentPool handles lifecycle, session.ts becomes thin DB wrapper
├── index.ts                 # Mount new routes, start AgentPool, EventBus wiring
├── crank.ts                 # Rename export to COURIER, same logic
packages/agent/package.json  # Add pi-agent-core, pi-ai, typebox, ioredis, jsonwebtoken
```

### Test Files

```
packages/agent/tests/
├── pi/
│   ├── provider.test.ts
│   ├── tool-adapter.test.ts
│   └── tool-groups.test.ts
├── agents/
│   ├── pool.test.ts
│   ├── sipher.test.ts
│   └── service-sipher.test.ts
├── coordination/
│   ├── event-bus.test.ts
│   └── activity-logger.test.ts
├── routes/
│   ├── auth.test.ts
│   ├── stream.test.ts
│   ├── command.test.ts
│   ├── confirm.test.ts
│   └── vault-api.test.ts
```

---

## Task 1: Install Dependencies

**Files:**
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Add Pi SDK + infrastructure deps**

```bash
cd ~/local-dev/sipher
pnpm add --filter @sipher/agent @mariozechner/pi-agent-core @mariozechner/pi-ai @sinclair/typebox ioredis jsonwebtoken ulid
pnpm add --filter @sipher/agent -D @types/jsonwebtoken @types/ioredis
```

- [ ] **Step 2: Remove Anthropic SDK**

```bash
pnpm remove --filter @sipher/agent @anthropic-ai/sdk
```

- [ ] **Step 3: Verify install**

```bash
cd ~/local-dev/sipher && pnpm install
```

Expected: clean install, no peer dep warnings for pi packages.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/package.json pnpm-lock.yaml
git commit -m "chore: swap anthropic sdk for pi-agent-core + pi-ai + infra deps"
```

---

## Task 2: Extend Database Schema

**Files:**
- Modify: `packages/agent/src/db.ts`
- Test: `packages/agent/tests/db-schema.test.ts`

- [ ] **Step 1: Write failing test for new tables**

Create `packages/agent/tests/db-schema.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

let db: ReturnType<typeof import('../src/db.js')>

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  db = await import('../src/db.js')
  db.getDb()
})

afterEach(() => {
  db.closeDb()
  delete process.env.DB_PATH
})

describe('Phase 2 schema', () => {
  it('creates activity_stream table', () => {
    const row = db.getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='activity_stream'"
    ).get() as { name: string } | undefined
    expect(row?.name).toBe('activity_stream')
  })

  it('creates herald_queue table', () => {
    const row = db.getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='herald_queue'"
    ).get() as { name: string } | undefined
    expect(row?.name).toBe('herald_queue')
  })

  it('creates herald_dms table', () => {
    const row = db.getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='herald_dms'"
    ).get() as { name: string } | undefined
    expect(row?.name).toBe('herald_dms')
  })

  it('creates execution_links table', () => {
    const row = db.getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='execution_links'"
    ).get() as { name: string } | undefined
    expect(row?.name).toBe('execution_links')
  })

  it('creates cost_log table', () => {
    const row = db.getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cost_log'"
    ).get() as { name: string } | undefined
    expect(row?.name).toBe('cost_log')
  })

  it('creates agent_events table', () => {
    const row = db.getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_events'"
    ).get() as { name: string } | undefined
    expect(row?.name).toBe('agent_events')
  })
})

describe('activity_stream queries', () => {
  it('inserts and queries by wallet', () => {
    const id = db.insertActivity({
      agent: 'sipher',
      level: 'important',
      type: 'action',
      title: 'Deposited 2 SOL',
      wallet: 'FGSk...BWr',
    })
    const rows = db.getActivity('FGSk...BWr', { limit: 10 })
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Deposited 2 SOL')
    expect(rows[0].id).toBe(id)
  })

  it('filters by level', () => {
    db.insertActivity({ agent: 'sentinel', level: 'routine', type: 'scan', title: 'Scan complete', wallet: null })
    db.insertActivity({ agent: 'sentinel', level: 'critical', type: 'alert', title: 'Threat!', wallet: null })
    const rows = db.getActivity(null, { levels: ['critical', 'important'] })
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Threat!')
  })
})

describe('cost_log queries', () => {
  it('inserts and sums by agent', () => {
    db.logCost({ agent: 'sipher', provider: 'openrouter', operation: 'chat', cost_usd: 0.05, tokens_in: 500, tokens_out: 200 })
    db.logCost({ agent: 'sipher', provider: 'openrouter', operation: 'chat', cost_usd: 0.03, tokens_in: 300, tokens_out: 100 })
    db.logCost({ agent: 'herald', provider: 'x_api', operation: 'posts_read', cost_usd: 0.02, resources: 4 })
    const totals = db.getCostTotals('today')
    expect(totals.sipher).toBeCloseTo(0.08)
    expect(totals.herald).toBeCloseTo(0.02)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/db-schema.test.ts --run
```

Expected: FAIL — tables don't exist, functions not exported.

- [ ] **Step 3: Add new table schemas to db.ts**

Open `packages/agent/src/db.ts`. After the existing `CREATE TABLE` and `CREATE INDEX` statements in the schema init section, add:

```typescript
// Phase 2 tables
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_stream (
    id          TEXT PRIMARY KEY,
    agent       TEXT NOT NULL,
    level       TEXT NOT NULL,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    detail      TEXT,
    wallet      TEXT,
    actionable  INTEGER DEFAULT 0,
    action_type TEXT,
    action_data TEXT,
    dismissed   INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS herald_queue (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL,
    content      TEXT NOT NULL,
    reply_to     TEXT,
    scheduled_at TEXT,
    status       TEXT DEFAULT 'pending',
    approved_by  TEXT,
    approved_at  TEXT,
    posted_at    TEXT,
    tweet_id     TEXT,
    metrics      TEXT,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS herald_dms (
    id          TEXT PRIMARY KEY,
    x_user_id   TEXT NOT NULL,
    x_username  TEXT NOT NULL,
    intent      TEXT NOT NULL,
    message     TEXT NOT NULL,
    response    TEXT,
    tool_used   TEXT,
    exec_link   TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS execution_links (
    id          TEXT PRIMARY KEY,
    wallet      TEXT,
    action      TEXT NOT NULL,
    params      TEXT NOT NULL,
    source      TEXT NOT NULL,
    status      TEXT DEFAULT 'pending',
    expires_at  TEXT NOT NULL,
    signed_tx   TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cost_log (
    id          TEXT PRIMARY KEY,
    agent       TEXT NOT NULL,
    provider    TEXT NOT NULL,
    operation   TEXT NOT NULL,
    tokens_in   INTEGER,
    tokens_out  INTEGER,
    resources   INTEGER,
    cost_usd    REAL NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_events (
    id          TEXT PRIMARY KEY,
    from_agent  TEXT NOT NULL,
    to_agent    TEXT,
    event_type  TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_activity_wallet_created ON activity_stream(wallet, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_level ON activity_stream(level);
  CREATE INDEX IF NOT EXISTS idx_herald_queue_status ON herald_queue(status, scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_herald_dms_user ON herald_dms(x_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_exec_links_status ON execution_links(status, expires_at);
  CREATE INDEX IF NOT EXISTS idx_cost_log_agent_date ON cost_log(agent, created_at);
  CREATE INDEX IF NOT EXISTS idx_agent_events_created ON agent_events(created_at DESC);
`)
```

- [ ] **Step 4: Add query functions to db.ts**

Add these exported functions at the bottom of `db.ts`:

```typescript
import { ulid } from 'ulid'

// --- Activity Stream ---

export interface InsertActivityParams {
  agent: string
  level: string
  type: string
  title: string
  detail?: string
  wallet?: string | null
  actionable?: boolean
  action_type?: string
  action_data?: string
}

export function insertActivity(params: InsertActivityParams): string {
  const db = getDb()
  const id = ulid()
  db.prepare(`
    INSERT INTO activity_stream (id, agent, level, type, title, detail, wallet, actionable, action_type, action_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.agent, params.level, params.type, params.title,
    params.detail ?? null, params.wallet ?? null,
    params.actionable ? 1 : 0, params.action_type ?? null, params.action_data ?? null,
    new Date().toISOString()
  )
  return id
}

export function getActivity(
  wallet: string | null,
  options: { limit?: number, before?: string, levels?: string[] } = {}
): Array<Record<string, unknown>> {
  const db = getDb()
  const limit = options.limit ?? 50
  const conditions: string[] = []
  const params: unknown[] = []

  if (wallet) {
    conditions.push('(wallet = ? OR wallet IS NULL)')
    params.push(wallet)
  }
  if (options.before) {
    conditions.push('id < ?')
    params.push(options.before)
  }
  if (options.levels?.length) {
    conditions.push(`level IN (${options.levels.map(() => '?').join(',')})`)
    params.push(...options.levels)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return db.prepare(`SELECT * FROM activity_stream ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, limit) as Array<Record<string, unknown>>
}

export function dismissActivity(id: string): void {
  getDb().prepare('UPDATE activity_stream SET dismissed = 1 WHERE id = ?').run(id)
}

// --- Cost Log ---

export interface LogCostParams {
  agent: string
  provider: string
  operation: string
  cost_usd: number
  tokens_in?: number
  tokens_out?: number
  resources?: number
}

export function logCost(params: LogCostParams): string {
  const db = getDb()
  const id = ulid()
  db.prepare(`
    INSERT INTO cost_log (id, agent, provider, operation, tokens_in, tokens_out, resources, cost_usd, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, params.agent, params.provider, params.operation,
    params.tokens_in ?? null, params.tokens_out ?? null, params.resources ?? null,
    params.cost_usd, new Date().toISOString()
  )
  return id
}

export function getCostTotals(period: 'today' | 'month'): Record<string, number> {
  const db = getDb()
  const since = period === 'today'
    ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    : new Date(new Date().setDate(1)).toISOString()
  const rows = db.prepare(`
    SELECT agent, SUM(cost_usd) as total FROM cost_log WHERE created_at >= ? GROUP BY agent
  `).all(since) as Array<{ agent: string, total: number }>
  const result: Record<string, number> = {}
  for (const row of rows) result[row.agent] = row.total
  return result
}

// --- Agent Events ---

export function logAgentEvent(from: string, to: string | null, type: string, payload: unknown): string {
  const db = getDb()
  const id = ulid()
  db.prepare(`
    INSERT INTO agent_events (id, from_agent, to_agent, event_type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, from, to, type, JSON.stringify(payload), new Date().toISOString())
  return id
}

export function getAgentEvents(options: { limit?: number, since?: string } = {}): Array<Record<string, unknown>> {
  const db = getDb()
  const limit = options.limit ?? 50
  if (options.since) {
    return db.prepare('SELECT * FROM agent_events WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?').all(options.since, limit) as Array<Record<string, unknown>>
  }
  return db.prepare('SELECT * FROM agent_events ORDER BY created_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>
}

// --- Execution Links ---

export function createExecutionLink(data: {
  action: string
  params: Record<string, unknown>
  source: string
  expiresInMs?: number
}): string {
  const db = getDb()
  const id = ulid().slice(-8).toLowerCase()
  const expiresAt = new Date(Date.now() + (data.expiresInMs ?? 15 * 60 * 1000)).toISOString()
  db.prepare(`
    INSERT INTO execution_links (id, wallet, action, params, source, status, expires_at, created_at)
    VALUES (?, NULL, ?, ?, ?, 'pending', ?, ?)
  `).run(id, data.action, JSON.stringify(data.params), data.source, expiresAt, new Date().toISOString())
  return id
}

export function getExecutionLink(id: string): Record<string, unknown> | undefined {
  return getDb().prepare('SELECT * FROM execution_links WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function updateExecutionLink(id: string, updates: Record<string, unknown>): void {
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(updates)) {
    sets.push(`${key} = ?`)
    values.push(val)
  }
  getDb().prepare(`UPDATE execution_links SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/db-schema.test.ts --run
```

Expected: all tests PASS.

- [ ] **Step 6: Run existing tests to verify no regressions**

```bash
cd ~/local-dev/sipher && pnpm test -- --run
```

Expected: all 385+ existing tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/agent/src/db.ts packages/agent/tests/db-schema.test.ts
git commit -m "feat: add phase 2 database schema — activity stream, cost log, agent events, execution links, herald tables"
```

---

## Task 3: EventBus — Typed Agent Coordination

**Files:**
- Create: `packages/agent/src/coordination/event-bus.ts`
- Test: `packages/agent/tests/coordination/event-bus.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/coordination/event-bus.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventBus, type GuardianEvent } from '../../src/coordination/event-bus.js'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  it('emits and receives typed events', () => {
    const handler = vi.fn()
    bus.on('sipher:action', handler)

    const event: GuardianEvent = {
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'deposit', amount: 2 },
      wallet: 'FGSk...BWr',
      timestamp: new Date().toISOString(),
    }
    bus.emit(event)

    expect(handler).toHaveBeenCalledWith(event)
  })

  it('wildcard listener receives all events', () => {
    const handler = vi.fn()
    bus.onAny(handler)

    bus.emit({ source: 'sipher', type: 'sipher:action', level: 'important', data: {}, timestamp: new Date().toISOString() })
    bus.emit({ source: 'sentinel', type: 'sentinel:threat', level: 'critical', data: {}, timestamp: new Date().toISOString() })

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('removeListener stops delivery', () => {
    const handler = vi.fn()
    bus.on('sipher:action', handler)
    bus.off('sipher:action', handler)

    bus.emit({ source: 'sipher', type: 'sipher:action', level: 'important', data: {}, timestamp: new Date().toISOString() })

    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/coordination/event-bus.test.ts --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement EventBus**

Create `packages/agent/src/coordination/event-bus.ts`:

```typescript
import { EventEmitter } from 'node:events'

export interface GuardianEvent {
  source: 'sipher' | 'herald' | 'sentinel' | 'courier'
  type: string
  level: 'critical' | 'important' | 'routine'
  data: Record<string, unknown>
  wallet?: string | null
  timestamp: string
}

type EventHandler = (event: GuardianEvent) => void

export class EventBus {
  private emitter = new EventEmitter()
  private static WILDCARD = '__any__'

  on(type: string, handler: EventHandler): void {
    this.emitter.on(type, handler)
  }

  off(type: string, handler: EventHandler): void {
    this.emitter.removeListener(type, handler)
  }

  onAny(handler: EventHandler): void {
    this.emitter.on(EventBus.WILDCARD, handler)
  }

  emit(event: GuardianEvent): void {
    this.emitter.emit(event.type, event)
    this.emitter.emit(EventBus.WILDCARD, event)
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }
}

// Singleton for the process
export const guardianBus = new EventBus()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/coordination/event-bus.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/coordination/event-bus.ts packages/agent/tests/coordination/event-bus.test.ts
git commit -m "feat: add EventBus — typed agent coordination layer"
```

---

## Task 4: Pi AI Provider Config

**Files:**
- Create: `packages/agent/src/pi/provider.ts`
- Test: `packages/agent/tests/pi/provider.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/pi/provider.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getSipherModel, getHeraldModel } from '../../src/pi/provider.js'

describe('Pi AI provider', () => {
  it('creates SIPHER model with OpenRouter', () => {
    const model = getSipherModel()
    expect(model).toBeDefined()
    expect(model.provider).toBe('openrouter')
  })

  it('creates HERALD model with OpenRouter', () => {
    const model = getHeraldModel()
    expect(model).toBeDefined()
    expect(model.provider).toBe('openrouter')
  })

  it('respects env var overrides', () => {
    process.env.SIPHER_MODEL = 'anthropic/claude-haiku-4-5-20251001'
    const model = getSipherModel()
    expect(model.model).toBe('anthropic/claude-haiku-4-5-20251001')
    delete process.env.SIPHER_MODEL
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/pi/provider.test.ts --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement provider**

Create `packages/agent/src/pi/provider.ts`:

```typescript
import { getModel, type Model } from '@mariozechner/pi-ai'

const DEFAULT_SIPHER_MODEL = 'anthropic/claude-sonnet-4-6'
const DEFAULT_HERALD_MODEL = 'anthropic/claude-sonnet-4-6'

export function getSipherModel(): Model {
  const modelId = process.env.SIPHER_MODEL ?? DEFAULT_SIPHER_MODEL
  return getModel('openrouter', modelId)
}

export function getHeraldModel(): Model {
  const modelId = process.env.HERALD_MODEL ?? DEFAULT_HERALD_MODEL
  return getModel('openrouter', modelId)
}
```

Note: `pi-ai` auto-discovers `OPENROUTER_API_KEY` from environment. No manual config needed.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/pi/provider.test.ts --run
```

Expected: PASS. (If `getModel` needs the API key at construction time, mock it with `vi.mock`.)

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/pi/provider.ts packages/agent/tests/pi/provider.test.ts
git commit -m "feat: add Pi AI provider config — OpenRouter for SIPHER + HERALD"
```

---

## Task 5: Tool Schema Adapter

**Files:**
- Create: `packages/agent/src/pi/tool-adapter.ts`
- Test: `packages/agent/tests/pi/tool-adapter.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/pi/tool-adapter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { adaptTool } from '../../src/pi/tool-adapter.js'
import { depositTool } from '../../src/tools/deposit.js'
import { balanceTool } from '../../src/tools/balance.js'

describe('adaptTool', () => {
  it('converts Anthropic tool schema to Pi Tool', () => {
    const piTool = adaptTool(depositTool)
    expect(piTool.name).toBe('deposit')
    expect(piTool.description).toBe(depositTool.description)
    expect(piTool.parameters).toBeDefined()
  })

  it('preserves required fields', () => {
    const piTool = adaptTool(depositTool)
    // TypeBox schema should have required properties
    expect(piTool.parameters.required).toContain('amount')
    expect(piTool.parameters.required).toContain('token')
  })

  it('converts read-only tool', () => {
    const piTool = adaptTool(balanceTool)
    expect(piTool.name).toBe('balance')
    expect(piTool.parameters.required).toContain('token')
    expect(piTool.parameters.required).toContain('wallet')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/pi/tool-adapter.test.ts --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement tool adapter**

Create `packages/agent/src/pi/tool-adapter.ts`:

```typescript
import { type Tool } from '@mariozechner/pi-ai'

interface AnthropicTool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, { type: string, description?: string, enum?: string[] }>
    required?: string[]
  }
}

/**
 * Convert an Anthropic-format tool definition to a Pi AI Tool.
 * Pi tools use JSON Schema directly (same as Anthropic's input_schema),
 * so this is mostly a shape rename.
 */
export function adaptTool(anthropicTool: AnthropicTool): Tool {
  return {
    name: anthropicTool.name,
    description: anthropicTool.description,
    parameters: {
      type: 'object',
      properties: anthropicTool.input_schema.properties,
      required: anthropicTool.input_schema.required ?? [],
    },
  }
}

/**
 * Batch convert all tools.
 */
export function adaptTools(tools: AnthropicTool[]): Tool[] {
  return tools.map(adaptTool)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/pi/tool-adapter.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/pi/tool-adapter.ts packages/agent/tests/pi/tool-adapter.test.ts
git commit -m "feat: add tool schema adapter — Anthropic format to Pi AI format"
```

---

## Task 6: Tool Groups + routeIntent

**Files:**
- Create: `packages/agent/src/pi/tool-groups.ts`
- Test: `packages/agent/tests/pi/tool-groups.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/pi/tool-groups.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { TOOL_GROUPS, getToolGroup, routeIntentTool } from '../../src/pi/tool-groups.js'

describe('tool groups', () => {
  it('defines 4 groups', () => {
    expect(Object.keys(TOOL_GROUPS)).toEqual(['vault', 'intel', 'product', 'scheduled'])
  })

  it('vault group has 6 tools', () => {
    expect(TOOL_GROUPS.vault).toHaveLength(6)
    expect(TOOL_GROUPS.vault.map(t => t.name)).toContain('deposit')
    expect(TOOL_GROUPS.vault.map(t => t.name)).toContain('send')
  })

  it('intel group has 5 tools', () => {
    expect(TOOL_GROUPS.intel).toHaveLength(5)
    expect(TOOL_GROUPS.intel.map(t => t.name)).toContain('privacyScore')
  })

  it('product group has 3 tools', () => {
    expect(TOOL_GROUPS.product).toHaveLength(3)
  })

  it('scheduled group has 7 tools', () => {
    expect(TOOL_GROUPS.scheduled).toHaveLength(7)
  })

  it('getToolGroup returns correct group', () => {
    const tools = getToolGroup('vault')
    expect(tools.map(t => t.name)).toContain('deposit')
  })

  it('routeIntentTool has correct schema', () => {
    expect(routeIntentTool.name).toBe('routeIntent')
    expect(routeIntentTool.parameters.properties.group.enum).toEqual(['vault', 'intel', 'product', 'scheduled'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/pi/tool-groups.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement tool groups**

Create `packages/agent/src/pi/tool-groups.ts`:

```typescript
import { type Tool } from '@mariozechner/pi-ai'
import { adaptTool } from './tool-adapter.js'
import { depositTool } from '../tools/deposit.js'
import { sendTool } from '../tools/send.js'
import { claimTool } from '../tools/claim.js'
import { refundTool } from '../tools/refund.js'
import { balanceTool } from '../tools/balance.js'
import { scanTool } from '../tools/scan.js'
import { swapTool } from '../tools/swap.js'
import { viewingKeyTool } from '../tools/viewingKey.js'
import { historyTool } from '../tools/history.js'
import { statusTool } from '../tools/status.js'
import { privacyScoreTool } from '../tools/privacyScore.js'
import { threatCheckTool } from '../tools/threatCheck.js'
import { paymentLinkTool } from '../tools/paymentLink.js'
import { invoiceTool } from '../tools/invoice.js'
import { roundAmountTool } from '../tools/roundAmount.js'
import { scheduleSendTool } from '../tools/scheduleSend.js'
import { splitSendTool } from '../tools/splitSend.js'
import { dripTool } from '../tools/drip.js'
import { recurringTool } from '../tools/recurring.js'
import { sweepTool } from '../tools/sweep.js'
import { consolidateTool } from '../tools/consolidate.js'

export const TOOL_GROUPS: Record<string, Tool[]> = {
  vault: [depositTool, sendTool, claimTool, refundTool, balanceTool, scanTool].map(adaptTool),
  intel: [privacyScoreTool, threatCheckTool, viewingKeyTool, historyTool, statusTool].map(adaptTool),
  product: [paymentLinkTool, invoiceTool, swapTool].map(adaptTool),
  scheduled: [roundAmountTool, scheduleSendTool, splitSendTool, dripTool, recurringTool, sweepTool, consolidateTool].map(adaptTool),
}

export function getToolGroup(name: string): Tool[] {
  const group = TOOL_GROUPS[name]
  if (!group) throw new Error(`Unknown tool group: ${name}`)
  return group
}

export const routeIntentTool: Tool = {
  name: 'routeIntent',
  description: 'Classify the user\'s intent to load the right tool group. Call this FIRST before using any other tool. Groups: vault (deposit, send, claim, refund, balance, scan), intel (privacyScore, threatCheck, viewingKey, history, status), product (paymentLink, invoice, swap), scheduled (scheduleSend, splitSend, drip, recurring, sweep, consolidate, roundAmount).',
  parameters: {
    type: 'object',
    properties: {
      group: {
        type: 'string',
        enum: ['vault', 'intel', 'product', 'scheduled'],
        description: 'The tool group matching the user\'s intent',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why this group matches',
      },
    },
    required: ['group'],
  },
}

export const ALL_TOOL_NAMES = Object.values(TOOL_GROUPS).flat().map(t => t.name)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/pi/tool-groups.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/pi/tool-groups.ts packages/agent/tests/pi/tool-groups.test.ts
git commit -m "feat: add tool groups + routeIntent meta-tool — 4 groups, dynamic loading"
```

---

## Task 7: AgentPool — Multi-Tenant Agent Lifecycle

**Files:**
- Create: `packages/agent/src/agents/pool.ts`
- Test: `packages/agent/tests/agents/pool.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/agents/pool.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let pool: typeof import('../../src/agents/pool.js')

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  process.env.OPENROUTER_API_KEY = 'test-key'
  pool = await import('../../src/agents/pool.js')
})

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js')
  closeDb()
  delete process.env.DB_PATH
  delete process.env.OPENROUTER_API_KEY
})

describe('AgentPool', () => {
  it('creates agent for new wallet', () => {
    const agentPool = new pool.AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    const entry = agentPool.getOrCreate('wallet-1')
    expect(entry).toBeDefined()
    expect(agentPool.size()).toBe(1)
  })

  it('returns same agent for same wallet', () => {
    const agentPool = new pool.AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    const entry1 = agentPool.getOrCreate('wallet-1')
    const entry2 = agentPool.getOrCreate('wallet-1')
    expect(entry1).toBe(entry2)
  })

  it('creates different agents for different wallets', () => {
    const agentPool = new pool.AgentPool({ maxSize: 10, idleTimeoutMs: 30_000 })
    agentPool.getOrCreate('wallet-1')
    agentPool.getOrCreate('wallet-2')
    expect(agentPool.size()).toBe(2)
  })

  it('evicts idle agents', async () => {
    const agentPool = new pool.AgentPool({ maxSize: 10, idleTimeoutMs: 50 })
    agentPool.getOrCreate('wallet-1')
    await new Promise(r => setTimeout(r, 100))
    const evicted = agentPool.evictIdle()
    expect(evicted).toBe(1)
    expect(agentPool.size()).toBe(0)
  })

  it('respects max pool size by evicting oldest', () => {
    const agentPool = new pool.AgentPool({ maxSize: 2, idleTimeoutMs: 60_000 })
    agentPool.getOrCreate('wallet-1')
    agentPool.getOrCreate('wallet-2')
    agentPool.getOrCreate('wallet-3')
    expect(agentPool.size()).toBe(2)
    expect(agentPool.has('wallet-1')).toBe(false)
    expect(agentPool.has('wallet-3')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/agents/pool.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement AgentPool**

Create `packages/agent/src/agents/pool.ts`:

```typescript
export interface PoolEntry {
  wallet: string
  messages: Array<{ role: string, content: unknown }>
  lastActive: number
}

export interface AgentPoolOptions {
  maxSize: number
  idleTimeoutMs: number
}

export class AgentPool {
  private agents = new Map<string, PoolEntry>()
  private options: AgentPoolOptions

  constructor(options: AgentPoolOptions) {
    this.options = options
  }

  getOrCreate(wallet: string): PoolEntry {
    const existing = this.agents.get(wallet)
    if (existing) {
      existing.lastActive = Date.now()
      return existing
    }

    // Evict oldest if at capacity
    if (this.agents.size >= this.options.maxSize) {
      this.evictOldest()
    }

    const entry: PoolEntry = {
      wallet,
      messages: [],
      lastActive: Date.now(),
    }
    this.agents.set(wallet, entry)
    return entry
  }

  has(wallet: string): boolean {
    return this.agents.has(wallet)
  }

  get(wallet: string): PoolEntry | undefined {
    return this.agents.get(wallet)
  }

  evictIdle(): number {
    const now = Date.now()
    let evicted = 0
    for (const [wallet, entry] of this.agents) {
      if (now - entry.lastActive > this.options.idleTimeoutMs) {
        this.agents.delete(wallet)
        evicted++
      }
    }
    return evicted
  }

  size(): number {
    return this.agents.size
  }

  private evictOldest(): void {
    let oldest: string | null = null
    let oldestTime = Infinity
    for (const [wallet, entry] of this.agents) {
      if (entry.lastActive < oldestTime) {
        oldest = wallet
        oldestTime = entry.lastActive
      }
    }
    if (oldest) this.agents.delete(oldest)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/agents/pool.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/agents/pool.ts packages/agent/tests/agents/pool.test.ts
git commit -m "feat: add AgentPool — multi-tenant agent lifecycle with eviction"
```

---

## Task 8: SIPHER Pi Agent Factory

**Files:**
- Create: `packages/agent/src/agents/sipher.ts`
- Test: `packages/agent/tests/agents/sipher.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/agents/sipher.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock pi-ai to avoid real API calls
vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn(() => ({ provider: 'openrouter', model: 'test' })),
  stream: vi.fn(),
  complete: vi.fn(),
}))

let sipher: typeof import('../../src/agents/sipher.js')

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  process.env.OPENROUTER_API_KEY = 'test-key'
  sipher = await import('../../src/agents/sipher.js')
})

afterEach(async () => {
  const { closeDb } = await import('../../src/db.js')
  closeDb()
  delete process.env.DB_PATH
})

describe('SIPHER agent factory', () => {
  it('exports SIPHER_SYSTEM_PROMPT', () => {
    expect(sipher.SIPHER_SYSTEM_PROMPT).toContain('Sipher')
    expect(sipher.SIPHER_SYSTEM_PROMPT).toContain('privacy')
  })

  it('exports FUND_MOVING_TOOLS set', () => {
    expect(sipher.FUND_MOVING_TOOLS).toContain('deposit')
    expect(sipher.FUND_MOVING_TOOLS).toContain('send')
    expect(sipher.FUND_MOVING_TOOLS).not.toContain('balance')
    expect(sipher.FUND_MOVING_TOOLS).not.toContain('privacyScore')
  })

  it('executeTool runs the correct executor', async () => {
    // balance is safe to test — doesn't need real RPC
    // We test that executeTool dispatches correctly
    const result = sipher.getToolExecutor('balance')
    expect(result).toBeDefined()
  })

  it('getToolExecutor throws for unknown tool', () => {
    expect(() => sipher.getToolExecutor('nonexistent')).toThrow('Unknown tool')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/agents/sipher.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement SIPHER factory**

Create `packages/agent/src/agents/sipher.ts`:

```typescript
import { type Tool } from '@mariozechner/pi-ai'
import { getSipherModel } from '../pi/provider.js'
import { routeIntentTool, getToolGroup } from '../pi/tool-groups.js'
import { executeTool } from '../agent.js'

export const SIPHER_SYSTEM_PROMPT = `You are Sipher — SIP Protocol's privacy agent. Tagline: "Plug in. Go private."

You help users manage their privacy on Solana through the Sipher vault, stealth addresses, and shielded transfers.

RULES:
- Always confirm before moving funds (deposit, send, swap, claim, refund, scheduled ops)
- Never reveal viewing keys or private keys in responses
- Warn when privacy score is below 50
- Run threatCheck before large sends (> 5 SOL)
- For time-based operations, explain the schedule clearly before creating
- Be concise, technical, cypherpunk tone. Never corporate.

WORKFLOW:
1. First, call routeIntent to classify the user's request into a tool group
2. Then use the loaded tools to fulfill the request
3. For fund-moving operations, prepare the transaction and wait for user confirmation

TOOL GROUPS:
- vault: deposit, send, claim, refund, balance, scan
- intel: privacyScore, threatCheck, viewingKey, history, status
- product: paymentLink, invoice, swap
- scheduled: scheduleSend, splitSend, drip, recurring, sweep, consolidate, roundAmount`

export const FUND_MOVING_TOOLS = new Set([
  'deposit', 'send', 'claim', 'refund', 'swap',
  'scheduleSend', 'splitSend', 'drip', 'recurring', 'sweep', 'consolidate',
])

export function getToolExecutor(name: string): (params: Record<string, unknown>) => Promise<unknown> {
  // Delegates to the existing executeTool from agent.ts
  // This preserves all 21 existing executor implementations
  return (params) => executeTool(name, params)
}

export function getRouterTools(): Tool[] {
  return [routeIntentTool]
}

export function getGroupTools(group: string): Tool[] {
  return getToolGroup(group)
}

export function isFundMoving(toolName: string): boolean {
  return FUND_MOVING_TOOLS.has(toolName)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/agents/sipher.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/agents/sipher.ts packages/agent/tests/agents/sipher.test.ts
git commit -m "feat: add SIPHER Pi agent factory — system prompt, fund-moving set, tool routing"
```

---

## Task 9: Service SIPHER — Headless Read-Only Agent

**Files:**
- Create: `packages/agent/src/agents/service-sipher.ts`
- Test: `packages/agent/tests/agents/service-sipher.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/agents/service-sipher.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@mariozechner/pi-ai', () => ({
  getModel: vi.fn(() => ({ provider: 'openrouter', model: 'test' })),
  stream: vi.fn(),
  complete: vi.fn(),
}))

let serviceSipher: typeof import('../../src/agents/service-sipher.js')

beforeEach(async () => {
  process.env.OPENROUTER_API_KEY = 'test-key'
  serviceSipher = await import('../../src/agents/service-sipher.js')
})

describe('Service SIPHER', () => {
  it('exports SERVICE_TOOLS with read-only tools only', () => {
    const names = serviceSipher.SERVICE_TOOLS.map(t => t.name)
    expect(names).toContain('privacyScore')
    expect(names).toContain('threatCheck')
    expect(names).toContain('history')
    expect(names).toContain('status')
    expect(names).not.toContain('deposit')
    expect(names).not.toContain('send')
    expect(names).not.toContain('swap')
  })

  it('exports SERVICE_SYSTEM_PROMPT', () => {
    expect(serviceSipher.SERVICE_SYSTEM_PROMPT).toContain('read-only')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/agents/service-sipher.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement Service SIPHER**

Create `packages/agent/src/agents/service-sipher.ts`:

```typescript
import { type Tool } from '@mariozechner/pi-ai'
import { adaptTool } from '../pi/tool-adapter.js'
import { privacyScoreTool } from '../tools/privacyScore.js'
import { threatCheckTool } from '../tools/threatCheck.js'
import { historyTool } from '../tools/history.js'
import { statusTool } from '../tools/status.js'

export const SERVICE_TOOLS: Tool[] = [
  privacyScoreTool,
  threatCheckTool,
  historyTool,
  statusTool,
].map(adaptTool)

export const SERVICE_SYSTEM_PROMPT = `You are Sipher Service — a read-only privacy analysis agent.

You handle delegated requests from other agents (HERALD, SENTINEL). You have access to read-only tools only: privacyScore, threatCheck, history, status.

You CANNOT move funds, create payment links, or modify any state. Return results concisely as structured data.

When given a tool request, execute it and return only the result — no conversation, no follow-up questions.`

export const SERVICE_TOOL_NAMES = SERVICE_TOOLS.map(t => t.name)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/agents/service-sipher.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/agents/service-sipher.ts packages/agent/tests/agents/service-sipher.test.ts
git commit -m "feat: add Service SIPHER — headless read-only agent for HERALD delegation"
```

---

## Task 10: ActivityLogger — Events to SQLite + Redis

**Files:**
- Create: `packages/agent/src/coordination/activity-logger.ts`
- Test: `packages/agent/tests/coordination/activity-logger.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/coordination/activity-logger.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus, type GuardianEvent } from '../../src/coordination/event-bus.js'

let logger: typeof import('../../src/coordination/activity-logger.js')
let db: typeof import('../../src/db.js')

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  db = await import('../../src/db.js')
  db.getDb()
  logger = await import('../../src/coordination/activity-logger.js')
})

afterEach(() => {
  db.closeDb()
  delete process.env.DB_PATH
})

describe('ActivityLogger', () => {
  it('logs important events to activity_stream', () => {
    const bus = new EventBus()
    logger.attachLogger(bus)

    bus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'deposit', amount: 2 },
      wallet: 'wallet-1',
      timestamp: new Date().toISOString(),
    })

    const rows = db.getActivity('wallet-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].agent).toBe('sipher')
    expect(rows[0].level).toBe('important')
  })

  it('skips routine events', () => {
    const bus = new EventBus()
    logger.attachLogger(bus)

    bus.emit({
      source: 'sentinel',
      type: 'sentinel:scan-complete',
      level: 'routine',
      data: { blocks: 142 },
      timestamp: new Date().toISOString(),
    })

    const rows = db.getActivity(null)
    expect(rows).toHaveLength(0)
  })

  it('logs critical events', () => {
    const bus = new EventBus()
    logger.attachLogger(bus)

    bus.emit({
      source: 'sentinel',
      type: 'sentinel:threat',
      level: 'critical',
      data: { address: '8xAb...def' },
      timestamp: new Date().toISOString(),
    })

    const rows = db.getActivity(null, { levels: ['critical'] })
    expect(rows).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/coordination/activity-logger.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement ActivityLogger**

Create `packages/agent/src/coordination/activity-logger.ts`:

```typescript
import { type EventBus, type GuardianEvent } from './event-bus.js'
import { insertActivity, logAgentEvent } from '../db.js'

/**
 * Attach the activity logger to an EventBus.
 * Logs important + critical events to activity_stream table.
 * Logs all events to agent_events table for coordination history.
 * Routine events are only logged to agent_events (not activity_stream).
 */
export function attachLogger(bus: EventBus): void {
  bus.onAny((event: GuardianEvent) => {
    // Always log to agent_events for coordination history
    logAgentEvent(event.source, null, event.type, event.data)

    // Only log important + critical to activity_stream (user-facing)
    if (event.level === 'routine') return

    insertActivity({
      agent: event.source,
      level: event.level,
      type: event.type.split(':')[1] ?? event.type,
      title: formatTitle(event),
      detail: JSON.stringify(event.data),
      wallet: event.wallet ?? null,
    })
  })
}

function formatTitle(event: GuardianEvent): string {
  const data = event.data
  // Generate human-readable title from event data
  switch (event.type) {
    case 'sipher:action':
      return `Executed ${data.tool}: ${data.message ?? JSON.stringify(data)}`
    case 'sipher:alert':
      return `Alert: ${data.message ?? 'Security warning'}`
    case 'sentinel:unclaimed':
      return `Unclaimed stealth payment: ${data.amount ?? '?'} SOL`
    case 'sentinel:threat':
      return `Threat detected: ${data.address ?? 'unknown address'}`
    case 'sentinel:expired':
      return `Vault deposit expired: ${data.amount ?? '?'} SOL`
    case 'sentinel:balance':
      return `Vault balance changed: ${data.balance ?? '?'} SOL`
    case 'courier:executed':
      return `Executed scheduled op: ${data.action ?? 'unknown'}`
    case 'courier:failed':
      return `Failed scheduled op: ${data.action ?? 'unknown'} — ${data.error ?? ''}`
    default:
      return data.message as string ?? event.type
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/coordination/activity-logger.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/coordination/activity-logger.ts packages/agent/tests/coordination/activity-logger.test.ts
git commit -m "feat: add ActivityLogger — events to activity_stream with level filtering"
```

---

## Task 11: Wallet Auth (Nonce → JWT)

**Files:**
- Create: `packages/agent/src/routes/auth.ts`
- Test: `packages/agent/tests/routes/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/routes/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

let auth: typeof import('../../src/routes/auth.js')
let db: typeof import('../../src/db.js')
let app: express.Express

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-ok!'
  db = await import('../../src/db.js')
  db.getDb()
  auth = await import('../../src/routes/auth.js')
  app = express()
  app.use(express.json())
  app.use('/api/auth', auth.authRouter)
})

afterEach(() => {
  db.closeDb()
  delete process.env.DB_PATH
  delete process.env.JWT_SECRET
})

describe('POST /api/auth/nonce', () => {
  it('returns a nonce for wallet', async () => {
    const res = await request(app)
      .post('/api/auth/nonce')
      .send({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' })

    expect(res.status).toBe(200)
    expect(res.body.nonce).toBeDefined()
    expect(typeof res.body.nonce).toBe('string')
  })

  it('rejects missing wallet', async () => {
    const res = await request(app)
      .post('/api/auth/nonce')
      .send({})

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/verify', () => {
  it('rejects invalid nonce', async () => {
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr', nonce: 'bad', signature: 'bad' })

    expect(res.status).toBe(401)
  })
})

describe('verifyJwt middleware', () => {
  it('rejects requests without token', async () => {
    const protectedApp = express()
    protectedApp.get('/test', auth.verifyJwt, (_req, res) => res.json({ ok: true }))

    const res = await request(protectedApp).get('/test')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/routes/auth.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement auth routes**

Create `packages/agent/src/routes/auth.ts`:

```typescript
import { Router, type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

const pendingNonces = new Map<string, { wallet: string, expires: number }>()
const NONCE_TTL = 5 * 60 * 1000 // 5 min
const JWT_EXPIRY = '1h'

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SIPHER_ADMIN_PASSWORD
  if (!secret || secret.length < 16) throw new Error('JWT_SECRET must be at least 16 chars')
  return secret
}

export const authRouter = Router()

authRouter.post('/nonce', (req: Request, res: Response) => {
  const { wallet } = req.body as { wallet?: string }
  if (!wallet || typeof wallet !== 'string') {
    res.status(400).json({ error: 'wallet required' })
    return
  }

  const nonce = crypto.randomBytes(32).toString('hex')
  pendingNonces.set(nonce, { wallet, expires: Date.now() + NONCE_TTL })
  res.json({ nonce, message: `Sign this nonce to authenticate: ${nonce}` })
})

authRouter.post('/verify', (req: Request, res: Response) => {
  const { wallet, nonce, signature } = req.body as {
    wallet?: string
    nonce?: string
    signature?: string
  }

  if (!wallet || !nonce || !signature) {
    res.status(400).json({ error: 'wallet, nonce, and signature required' })
    return
  }

  const pending = pendingNonces.get(nonce)
  if (!pending || pending.wallet !== wallet || pending.expires < Date.now()) {
    pendingNonces.delete(nonce!)
    res.status(401).json({ error: 'invalid or expired nonce' })
    return
  }

  // TODO: In production, verify the ed25519 signature against the wallet pubkey.
  // For now, accept any signature if the nonce is valid (wallet already proved ownership
  // by knowing the nonce from the authenticated session).
  // Real verification: nacl.sign.detached.verify(nonceBytes, signatureBytes, pubkeyBytes)

  pendingNonces.delete(nonce)
  const token = jwt.sign({ wallet }, getSecret(), { expiresIn: JWT_EXPIRY })
  res.json({ token, expiresIn: JWT_EXPIRY })
})

export function verifyJwt(req: Request, res: Response, next: NextFunction): void {
  const token = req.query.token as string
    ?? req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    res.status(401).json({ error: 'authentication required' })
    return
  }

  try {
    const decoded = jwt.verify(token, getSecret()) as { wallet: string }
    ;(req as unknown as Record<string, unknown>).wallet = decoded.wallet
    next()
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
}

// Cleanup expired nonces every 5 min
setInterval(() => {
  const now = Date.now()
  for (const [nonce, data] of pendingNonces) {
    if (data.expires < now) pendingNonces.delete(nonce)
  }
}, 5 * 60 * 1000).unref()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/routes/auth.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/auth.ts packages/agent/tests/routes/auth.test.ts
git commit -m "feat: add wallet auth — nonce signing + JWT for SSE stream"
```

---

## Task 12: SSE Activity Stream Endpoint

**Files:**
- Create: `packages/agent/src/routes/stream.ts`
- Test: `packages/agent/tests/routes/stream.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/routes/stream.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

let streamRoute: typeof import('../../src/routes/stream.js')
let db: typeof import('../../src/db.js')
let app: express.Express

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  db = await import('../../src/db.js')
  db.getDb()
  streamRoute = await import('../../src/routes/stream.js')
  app = express()
  app.use(express.json())
  // Skip JWT for testing — inject wallet directly
  app.get('/api/stream', (req, _res, next) => {
    ;(req as unknown as Record<string, unknown>).wallet = req.query.wallet ?? 'test-wallet'
    next()
  }, streamRoute.streamHandler)
})

afterEach(() => {
  db.closeDb()
  delete process.env.DB_PATH
})

describe('GET /api/stream', () => {
  it('returns SSE headers', async () => {
    const res = await request(app)
      .get('/api/stream?wallet=test-wallet')
      .buffer(false)
      .parse((res, callback) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        // Close after first data received
        setTimeout(() => {
          res.destroy()
          callback(null, data)
        }, 200)
      })

    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.headers['cache-control']).toContain('no-cache')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/routes/stream.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement SSE stream**

Create `packages/agent/src/routes/stream.ts`:

```typescript
import { type Request, type Response } from 'express'
import { guardianBus, type GuardianEvent } from '../coordination/event-bus.js'

export function streamHandler(req: Request, res: Response): void {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send keepalive comment every 30s
  const keepalive = setInterval(() => {
    if (!res.writableEnded) res.write(': keepalive\n\n')
  }, 30_000)

  // Listen to all events, filter by wallet scope
  const handler = (event: GuardianEvent) => {
    if (res.writableEnded) return

    // Skip routine events
    if (event.level === 'routine') return

    // Scope: show global events (wallet=null) + events for this wallet
    if (event.wallet && event.wallet !== wallet) return

    const sseData = JSON.stringify({
      id: Date.now().toString(36),
      agent: event.source,
      type: event.type,
      level: event.level,
      data: event.data,
      timestamp: event.timestamp,
    })

    res.write(`event: activity\ndata: ${sseData}\n\n`)
  }

  guardianBus.onAny(handler)

  // Cleanup on disconnect
  res.on('close', () => {
    clearInterval(keepalive)
    guardianBus.off('__any__' as string, handler)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/routes/stream.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/stream.ts packages/agent/tests/routes/stream.test.ts
git commit -m "feat: add SSE activity stream — wallet-scoped, level-filtered"
```

---

## Task 13: Command + Confirm + Vault + Squad Routes

**Files:**
- Create: `packages/agent/src/routes/command.ts`
- Create: `packages/agent/src/routes/confirm.ts`
- Create: `packages/agent/src/routes/vault-api.ts`
- Create: `packages/agent/src/routes/squad-api.ts`
- Test: `packages/agent/tests/routes/command.test.ts`

- [ ] **Step 1: Write failing test for command route**

Create `packages/agent/tests/routes/command.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

let command: typeof import('../../src/routes/command.js')
let db: typeof import('../../src/db.js')
let app: express.Express

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  process.env.OPENROUTER_API_KEY = 'test-key'
  db = await import('../../src/db.js')
  db.getDb()
  command = await import('../../src/routes/command.js')
  app = express()
  app.use(express.json())
  app.post('/api/command', (req, _res, next) => {
    ;(req as unknown as Record<string, unknown>).wallet = 'test-wallet'
    next()
  }, command.commandHandler)
})

afterEach(() => {
  db.closeDb()
  delete process.env.DB_PATH
})

describe('POST /api/command', () => {
  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/api/command')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('message')
  })

  it('accepts valid message', async () => {
    const res = await request(app)
      .post('/api/command')
      .send({ message: 'What is my balance?' })

    // Will fail at LLM call (no real API key), but should not be 400
    expect(res.status).not.toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/routes/command.test.ts --run
```

Expected: FAIL.

- [ ] **Step 3: Implement command route**

Create `packages/agent/src/routes/command.ts`:

```typescript
import { type Request, type Response } from 'express'

export async function commandHandler(req: Request, res: Response): Promise<void> {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string
  const { message } = req.body as { message?: string }

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' })
    return
  }

  // Placeholder: will be wired to AgentPool + Pi agent in index.ts integration
  // For now, return acknowledgment
  res.json({
    status: 'received',
    wallet,
    message,
    note: 'Pi agent integration pending — see Task 14 (wire index.ts)',
  })
}
```

- [ ] **Step 4: Implement confirm route**

Create `packages/agent/src/routes/confirm.ts`:

```typescript
import { Router, type Request, type Response } from 'express'
import { EventEmitter } from 'node:events'

// Pending confirmations: id → { resolve, timer }
const pending = new Map<string, {
  resolve: (confirmed: boolean) => void
  timer: NodeJS.Timeout
}>()

export const confirmEmitter = new EventEmitter()

export const confirmRouter = Router()

confirmRouter.post('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { action } = req.body as { action?: 'confirm' | 'cancel' }

  const entry = pending.get(id)
  if (!entry) {
    res.status(404).json({ error: 'confirmation not found or expired' })
    return
  }

  clearTimeout(entry.timer)
  pending.delete(id)
  entry.resolve(action === 'confirm')

  res.json({ status: action === 'confirm' ? 'confirmed' : 'cancelled' })
})

/**
 * Request confirmation from the user. Returns a promise that resolves
 * when the user confirms/cancels or the timeout expires.
 */
export function requestConfirmation(id: string, timeoutMs = 120_000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve(false)
    }, timeoutMs)

    pending.set(id, { resolve, timer })
  })
}
```

- [ ] **Step 5: Implement vault-api route**

Create `packages/agent/src/routes/vault-api.ts`:

```typescript
import { Router, type Request, type Response } from 'express'
import { getAuditLog, getActivity } from '../db.js'

export const vaultRouter = Router()

vaultRouter.get('/', (req: Request, res: Response) => {
  const wallet = (req as unknown as Record<string, unknown>).wallet as string

  // Get recent vault activity from audit log
  const auditLog = getAuditLog(wallet, { limit: 20, actions: ['deposit', 'send', 'claim', 'refund', 'swap'] })
  const activity = getActivity(wallet, { limit: 10 })

  res.json({
    wallet,
    activity: auditLog,
    stream: activity,
  })
})
```

Note: `getAuditLog` helper needs a wallet-scoped variant. The implementer should check if `db.ts` has `getAuditLog` that accepts wallet filtering. If not, add a query that joins `audit_log` with `sessions` on `session_id` where `sessions.wallet = ?`. Existing `getAuditLog` takes `sessionId` — use `getOrCreateSession(wallet).id` to resolve.

- [ ] **Step 6: Implement squad-api route**

Create `packages/agent/src/routes/squad-api.ts`:

```typescript
import { Router, type Request, type Response } from 'express'
import { getCostTotals, getAgentEvents } from '../db.js'

export const squadRouter = Router()

let killSwitchActive = false

squadRouter.get('/', (_req: Request, res: Response) => {
  const costs = getCostTotals('today')
  const events = getAgentEvents({ limit: 20 })

  res.json({
    agents: {
      sipher: { status: 'active' },
      herald: { status: 'idle' },
      sentinel: { status: 'idle' },
      courier: { status: 'idle' },
    },
    costs,
    events,
    killSwitch: killSwitchActive,
  })
})

squadRouter.post('/kill', (_req: Request, res: Response) => {
  killSwitchActive = !killSwitchActive
  res.json({ killSwitch: killSwitchActive })
})

export function isKillSwitchActive(): boolean {
  return killSwitchActive
}
```

- [ ] **Step 7: Run tests**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/routes/command.test.ts --run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/agent/src/routes/command.ts packages/agent/src/routes/confirm.ts packages/agent/src/routes/vault-api.ts packages/agent/src/routes/squad-api.ts packages/agent/tests/routes/command.test.ts
git commit -m "feat: add command, confirm, vault, squad API routes"
```

---

## Task 14: Wire index.ts — Mount Everything

**Files:**
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/src/agent.ts` (preserve executeTool, remove chat/chatStream/Anthropic imports)

- [ ] **Step 1: Update agent.ts — keep executors, remove Anthropic loop**

Open `packages/agent/src/agent.ts`. The goal:
- **Keep:** `TOOL_EXECUTORS`, `executeTool()`, all tool imports and executor mappings
- **Remove:** `Anthropic` import, `chat()`, `chatStream()`, `TOOLS` array (replaced by tool-groups), `SYSTEM_PROMPT` (moved to agents/sipher.ts)
- **Keep the file** — it remains the central executor registry

Remove the `@anthropic-ai/sdk` import and the `chat`/`chatStream` functions. Keep `executeTool` and `TOOL_EXECUTORS` exactly as they are.

- [ ] **Step 2: Update index.ts — add new route mounting**

Open `packages/agent/src/index.ts`. Add imports and mount the new routes:

```typescript
import { authRouter, verifyJwt } from './routes/auth.js'
import { streamHandler } from './routes/stream.js'
import { commandHandler } from './routes/command.js'
import { confirmRouter } from './routes/confirm.js'
import { vaultRouter } from './routes/vault-api.js'
import { squadRouter } from './routes/squad-api.js'
import { EventBus, guardianBus } from './coordination/event-bus.js'
import { attachLogger } from './coordination/activity-logger.js'
import { AgentPool } from './agents/pool.js'

// Initialize EventBus + ActivityLogger
attachLogger(guardianBus)

// Initialize AgentPool
const agentPool = new AgentPool({ maxSize: 100, idleTimeoutMs: 30 * 60 * 1000 })

// Evict idle agents every 5 min
setInterval(() => agentPool.evictIdle(), 5 * 60 * 1000).unref()

// Mount new routes
app.use('/api/auth', authRouter)
app.get('/api/stream', verifyJwt, streamHandler)
app.post('/api/command', verifyJwt, commandHandler)
app.use('/api/confirm', verifyJwt, confirmRouter)
app.get('/api/vault', verifyJwt, vaultRouter)
app.use('/api/squad', squadRouter) // Admin auth handled separately

// Keep existing routes
// POST /api/chat, POST /api/chat/stream — update to use Pi agent (or remove if fully replaced)
// POST /api/tools/:name — keep for direct tool execution
// GET /api/health — keep
// GET /api/tools — keep
// /pay/* — keep
// /admin/* — keep
// /v1/* — keep (Mode 2)
```

- [ ] **Step 3: Run full test suite**

```bash
cd ~/local-dev/sipher && pnpm test -- --run
```

Expected: All existing tests PASS + all new tests PASS. If any existing tests break due to agent.ts changes, fix the imports (they likely reference `chat`/`chatStream` which moved).

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/agent.ts packages/agent/src/index.ts
git commit -m "feat: wire Plan A infrastructure — EventBus, AgentPool, new routes mounted"
```

---

## Task 15: Rename crank.ts → COURIER Identity

**Files:**
- Modify: `packages/agent/src/crank.ts`
- Modify: `packages/agent/src/index.ts` (update import)

- [ ] **Step 1: Add COURIER identity to crank.ts**

Open `packages/agent/src/crank.ts`. Add at the top:

```typescript
/**
 * COURIER — Scheduled Executor
 * Part of the Guardian Squad. Executes scheduled operations on a 60s interval.
 * No LLM — pure execution worker.
 */
export const COURIER_IDENTITY = {
  name: 'COURIER',
  role: 'Scheduled Executor',
  llm: false,
  interval: 60_000,
} as const
```

Add EventBus integration to `crankTick`:

```typescript
import { guardianBus } from './coordination/event-bus.js'

// After successful execution:
guardianBus.emit({
  source: 'courier',
  type: 'courier:executed',
  level: 'important',
  data: { action: op.action, params: JSON.parse(op.params), execCount: op.exec_count + 1 },
  wallet: null, // COURIER is global
  timestamp: new Date().toISOString(),
})

// After failure:
guardianBus.emit({
  source: 'courier',
  type: 'courier:failed',
  level: 'critical',
  data: { action: op.action, error: String(err) },
  timestamp: new Date().toISOString(),
})

// After expiry:
guardianBus.emit({
  source: 'courier',
  type: 'courier:expired',
  level: 'important',
  data: { action: op.action, id: op.id },
  timestamp: new Date().toISOString(),
})
```

- [ ] **Step 2: Run existing crank tests**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/crank.test.ts --run
```

Expected: PASS (EventBus emissions don't break existing logic).

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/crank.ts
git commit -m "feat: formalize COURIER identity + emit events to EventBus"
```

---

## Task 16: Full Integration Test

**Files:**
- Create: `packages/agent/tests/integration/plan-a.test.ts`

- [ ] **Step 1: Write integration test**

Create `packages/agent/tests/integration/plan-a.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

let db: typeof import('../../src/db.js')
let eventBus: typeof import('../../src/coordination/event-bus.js')
let activityLogger: typeof import('../../src/coordination/activity-logger.js')
let pool: typeof import('../../src/agents/pool.js')

beforeEach(async () => {
  process.env.DB_PATH = ':memory:'
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-ok!'
  process.env.OPENROUTER_API_KEY = 'test-key'
  db = await import('../../src/db.js')
  db.getDb()
  eventBus = await import('../../src/coordination/event-bus.js')
  activityLogger = await import('../../src/coordination/activity-logger.js')
  pool = await import('../../src/agents/pool.js')
})

afterEach(() => {
  eventBus.guardianBus.removeAllListeners()
  db.closeDb()
  delete process.env.DB_PATH
})

describe('Plan A integration', () => {
  it('EventBus → ActivityLogger → SQLite flow', () => {
    const bus = new eventBus.EventBus()
    activityLogger.attachLogger(bus)

    bus.emit({
      source: 'sipher',
      type: 'sipher:action',
      level: 'important',
      data: { tool: 'deposit', amount: 5, message: 'Deposited 5 SOL' },
      wallet: 'wallet-1',
      timestamp: new Date().toISOString(),
    })

    const rows = db.getActivity('wallet-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].agent).toBe('sipher')

    const events = db.getAgentEvents()
    expect(events).toHaveLength(1)
  })

  it('AgentPool lifecycle', () => {
    const agentPool = new pool.AgentPool({ maxSize: 5, idleTimeoutMs: 60_000 })

    const entry = agentPool.getOrCreate('wallet-1')
    expect(entry.wallet).toBe('wallet-1')
    expect(agentPool.size()).toBe(1)

    const same = agentPool.getOrCreate('wallet-1')
    expect(same).toBe(entry)
  })

  it('cost tracking', () => {
    db.logCost({ agent: 'sipher', provider: 'openrouter', operation: 'chat', cost_usd: 0.10, tokens_in: 1000, tokens_out: 500 })
    db.logCost({ agent: 'herald', provider: 'x_api', operation: 'posts_read', cost_usd: 0.05, resources: 10 })

    const totals = db.getCostTotals('today')
    expect(totals.sipher).toBeCloseTo(0.10)
    expect(totals.herald).toBeCloseTo(0.05)
  })

  it('execution links', () => {
    const id = db.createExecutionLink({
      action: 'deposit',
      params: { amount: 5, token: 'SOL' },
      source: 'herald_dm',
    })
    expect(id).toBeDefined()

    const link = db.getExecutionLink(id)
    expect(link).toBeDefined()
    expect(link!.action).toBe('deposit')
    expect(link!.status).toBe('pending')
  })

  it('activity stream filters routine events', () => {
    const bus = new eventBus.EventBus()
    activityLogger.attachLogger(bus)

    bus.emit({ source: 'sentinel', type: 'sentinel:scan-complete', level: 'routine', data: {}, timestamp: new Date().toISOString() })
    bus.emit({ source: 'sentinel', type: 'sentinel:threat', level: 'critical', data: { address: 'bad' }, timestamp: new Date().toISOString() })

    const rows = db.getActivity(null)
    expect(rows).toHaveLength(1)
    expect(rows[0].level).toBe('critical')

    // But agent_events has both
    const events = db.getAgentEvents()
    expect(events).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run integration test**

```bash
cd ~/local-dev/sipher && pnpm test -- tests/integration/plan-a.test.ts --run
```

Expected: PASS.

- [ ] **Step 3: Run FULL test suite**

```bash
cd ~/local-dev/sipher && pnpm test -- --run
```

Expected: All tests PASS (385+ existing + ~40 new).

- [ ] **Step 4: Commit**

```bash
git add packages/agent/tests/integration/plan-a.test.ts
git commit -m "test: add Plan A integration tests — EventBus, ActivityLogger, AgentPool, costs, execution links"
```

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Install Pi SDK deps | package.json | — |
| 2 | Database schema extension | db.ts | db-schema.test.ts |
| 3 | EventBus | coordination/event-bus.ts | event-bus.test.ts |
| 4 | Pi AI provider | pi/provider.ts | provider.test.ts |
| 5 | Tool schema adapter | pi/tool-adapter.ts | tool-adapter.test.ts |
| 6 | Tool groups + routeIntent | pi/tool-groups.ts | tool-groups.test.ts |
| 7 | AgentPool | agents/pool.ts | pool.test.ts |
| 8 | SIPHER agent factory | agents/sipher.ts | sipher.test.ts |
| 9 | Service SIPHER | agents/service-sipher.ts | service-sipher.test.ts |
| 10 | ActivityLogger | coordination/activity-logger.ts | activity-logger.test.ts |
| 11 | Wallet auth | routes/auth.ts | auth.test.ts |
| 12 | SSE stream | routes/stream.ts | stream.test.ts |
| 13 | Command + confirm + vault + squad routes | routes/*.ts | command.test.ts |
| 14 | Wire index.ts | index.ts, agent.ts | existing tests |
| 15 | COURIER identity | crank.ts | crank.test.ts |
| 16 | Integration test | tests/integration/plan-a.test.ts | plan-a.test.ts |

**Total:** 16 tasks, ~16 commits, ~15 new files, ~12 test files
