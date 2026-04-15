# Sipher Phase 2: Guardian Command

**Date:** 2026-04-09
**Status:** Approved
**Author:** RECTOR + CIPHER
**Repo:** ~/local-dev/sipher/ (sip-protocol/sipher)
**Hackathon:** Frontier (May 11, 2026) — bonus target, not a quality constraint
**Prerequisite:** Phase 1 deployed to VPS (26 tasks complete, not yet live)

---

## 1. Overview

Sipher Phase 2 is a full rewrite from a hand-rolled REST API + agent to a **Pi SDK-native multi-agent platform** with a world-class web frontend called **Guardian Command**.

**What changes:**
- Agent framework: raw Anthropic SDK → Pi SDK (`pi-agent-core` + `pi-ai`)
- LLM routing: hardcoded OpenRouter baseURL hack → `pi-ai` native OpenRouter provider
- Frontend: basic Vite chat app → AI Designer-generated privacy operations interface
- Architecture: monolithic agent → Guardian Squad (SIPHER + HERALD + SENTINEL + COURIER)
- Coordination: direct function calls → EventEmitter (intra-process) + Redis Streams (persistence/SSE)

**What stays:**
- Express 5 server
- SQLite persistence (extended schema)
- Redis (upgraded from pub/sub to Streams)
- @sipher/sdk (vault ops, stealth, swap)
- Mode 2 REST API (71 endpoints)
- `/pay/:id` payment links
- Docker + GHCR deployment

---

## 2. System Architecture

```
+--------------------------------------------------------------+
|  GUARDIAN COMMAND (Web Frontend)                              |
|  AI Designer generated | SSE real-time | Wallet Connect      |
|  Activity Stream | Command Bar | Vault | HERALD | Squad      |
|                        |                                     |
|                   SSE / REST                                  |
+------------------------+-------------------------------------+
                         |
+------------------------+-------------------------------------+
|  EXPRESS 5 SERVER (Single Process)                            |
|                                                              |
|  +-------------+  +-------------+  +-----------------------+ |
|  |   SIPHER    |  |   HERALD    |  |      SENTINEL         | |
|  | pi-agent    |  | pi-agent    |  |   Custom Worker       | |
|  | 21 tools    |  | X API tools |  |   (no LLM)           | |
|  | (4 groups)  |  | 9 tools     |  |                       | |
|  | Sonnet 4.6  |  | Sonnet 4.6  |  | - Block scanner       | |
|  | OpenRouter  |  | OpenRouter  |  | - Stealth detector    | |
|  +------+------+  +------+------+  | - Auto-refund trigger | |
|         |                |         | - Anomaly alerts      | |
|         |                |         +----------+------------+ |
|         |                |                    |              |
|  +------+----------------+--------------------+------------+ |
|  |  COORDINATION LAYER                                     | |
|  |  EventEmitter (intra-process) + Redis Streams (persist) | |
|  +------------------------------+-------------------------+ |
|                                  |                           |
|  +------------------------------+-------------------------+ |
|  |  SHARED SERVICES                                        | |
|  |  @sipher/sdk | SQLite | Redis | COURIER (crank engine)  | |
|  +---------------------------------------------------------+ |
+--------------------------------------------------------------+
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent framework | Pi SDK (`pi-agent-core` + `pi-ai`) | Multi-provider, battle-tested loop, steering, hooks |
| LLM provider | OpenRouter via `pi-ai` native support | Single API key, model flexibility, cost tracking |
| LLM model | `anthropic/claude-sonnet-4-6` for SIPHER + HERALD | Best balance of quality and cost |
| Process model | Single process, 3 agent instances | Simpler deployment, shared memory, EventEmitter coordination |
| Frontend | AI Designer MCP → custom HTML/CSS/JS | World-class design, not stock components |
| Frontend framework | AI Designer output (vanilla or lightweight) | Wired to Express API via SSE + REST |
| Database | SQLite (extended from Phase 1) | Proven, no migration needed, sufficient for single-process |
| Intra-process events | Node.js EventEmitter | Zero latency, no external dependency |
| Persistent events | Redis Streams with consumer groups | No event loss for critical ops, SSE fan-out, replay on reconnect |
| REST API (Mode 2) | Kept as-is | 71 endpoints still serve programmatic consumers |

### Rewrite Map

| Component | Action | Detail |
|-----------|--------|--------|
| `agent.ts` (agentic loop) | **Rewrite** | Replace with `pi-agent-core` Agent class |
| `tools/*.ts` (21 tools) | **Adapt** | Re-register as Pi tools (TypeBox schemas), keep executor logic |
| `index.ts` (Express server) | **Evolve** | Keep Express, add SSE stream endpoints, mount new routes |
| `crank.ts` (scheduler) | **Rename** | Becomes COURIER — same logic, formalized identity |
| `db.ts` (SQLite) | **Extend** | Add 6 new tables (activity_stream, herald_queue, herald_dms, execution_links, cost_log, agent_events) |
| `session.ts` | **Replace** | AgentPool manages Pi agent instances per wallet |
| `src/` (Mode 2 REST) | **Keep** | 71 endpoints untouched |
| `app/` (Vite chat UI) | **Replace** | New frontend via AI Designer MCP |
| `routes/pay.ts` | **Keep** | Payment links stay |
| `routes/admin.ts` | **Absorb** | Merged into Squad view in new frontend |

---

## 3. Agent Designs

### 3.1 SIPHER — Lead Agent

**Identity:** Lead privacy agent. User-facing. Handles all wallet operations and conversations.
**Framework:** `pi-agent-core` Agent class
**Model:** `anthropic/claude-sonnet-4-6` via OpenRouter
**Max tool rounds:** 10
**Tool execution:** parallel (default)

#### Dynamic Tool Loading (Fix for context bloat)

21 tools organized in 4 groups. SIPHER starts with a lightweight router turn — classifies intent, loads only the relevant group.

| Group | Tools | Loaded When |
|-------|-------|-------------|
| **vault** | deposit, send, claim, refund, balance, scan | Intent involves funds |
| **intel** | privacyScore, threatCheck, viewingKey, history, status | Intent involves info/analysis |
| **product** | paymentLink, invoice, swap | Intent involves payments/DeFi |
| **scheduled** | scheduleSend, splitSend, drip, recurring, sweep, consolidate, roundAmount | Intent involves time-based ops |

First turn: SIPHER gets a single `routeIntent` meta-tool (not counted in the 21) → returns group name. Second turn: actual tools from that group loaded. Saves ~75% context per turn.

#### Agent Pool (Multi-tenant)

```
AgentPool {
  agents: Map<walletAddress, { agent: Agent, lastActive: Date }>
  maxPoolSize: 100
  idleTimeout: 30m

  getOrCreate(wallet) → finds existing or creates new Agent
  evict(wallet) → serializes conversation to SQLite sessions table, destroys instance
  evictIdle() → runs every 5m, evicts agents idle > 30m
  resume(wallet) → creates Agent, loads last 20 messages from SQLite
}
```

#### Async Confirmation (Fund-moving ops)

```
beforeToolCall fires for fund-moving ops:
  1. Emit SSE event: { type: 'confirm', toolCall, timeout: 120s }
  2. Return Promise that resolves when:
     a) User confirms via POST /api/confirm/:id → resolve(allow)
     b) User cancels via POST /api/confirm/:id → resolve(block)
     c) 120s timeout → resolve(block) + notify "timed out"
  3. Agent continues or aborts based on resolution
```

#### Service SIPHER (Headless, for HERALD delegation)

Singleton instance with no wallet context, read-only tools only.

```
Tools: privacyScore, threatCheck, history, status
Purpose: HERALD calls directly (in-process function call) for DM requests
No session, no conversation persistence — stateless request/response
```

#### Confirmation Matrix

| Tool | Confirmation Required |
|------|----------------------|
| deposit, send, claim, refund | Yes (fund-moving) |
| swap | Yes (fund-moving) |
| scheduleSend, splitSend, drip, recurring, sweep, consolidate | Yes (fund-moving) |
| balance, scan, history, status | No |
| privacyScore, threatCheck, viewingKey | No |
| paymentLink, invoice, roundAmount | No |

#### Events Emitted (via EventEmitter)

- `sipher:action` — every tool execution (type, params, result)
- `sipher:alert` — security warnings, low balance, failed TX
- `sipher:session` — connect, disconnect, timeout

#### System Prompt Personality

Cypherpunk, confident, concise. Never corporate. First-person ("I've deposited...", "Your privacy score is..."). Proactive warnings on low privacy scores, large unshielded amounts, threat contacts. Islamic expressions natural where appropriate (Bismillah at session start, Alhamdulillah on success).

---

### 3.2 HERALD — X Agent

**Identity:** Content and engagement agent for X/Twitter. Autonomous with budget gates and approval queue.
**Framework:** `pi-agent-core` Agent class
**Model:** `anthropic/claude-sonnet-4-6` via OpenRouter
**Max tool rounds:** 5
**X Account:** @SipProtocol (via OAuth 1.0a — env vars from ~/Documents/secret/.env)

#### Tools (9)

| Tool | Purpose | X API Cost | Auto/Queued |
|------|---------|------------|-------------|
| readMentions | Poll @SipProtocol mentions | $0.005/resource | Auto |
| readDMs | Poll DM events | $0.010/resource | Auto |
| postTweet | Create a post | $0.005/request | **Queued** |
| replyTweet | Reply to mention | $0.005/request | Auto |
| likeTweet | Like a post | $0.015/request | Auto |
| searchPosts | Search keywords | $0.005/resource | Auto |
| readUserProfile | Look up user | $0.010/resource | Auto |
| sendDM | Respond to a DM | $0.015/request | Auto |
| schedulePost | Queue for later | $0 (local) | Local |

#### Adaptive Polling

```
Default: every 10 minutes
  - If poll returns 0 results 3x in a row → back off to 30 minutes
  - If poll returns results → reset to 10 minutes for 30min
  - Budget > 80% → reduce to 15 minutes
  - Budget > 95% → DM-only mode (stop reading mentions)
  - Budget = 100% → full pause
```

Estimated monthly cost at 10m adaptive polling:

| Resource | Calculation | Monthly |
|----------|-------------|---------|
| Mentions | ~100 polls/day x ~3 resources x $0.005 | ~$45 |
| DMs | ~100 polls/day x ~1 resource x $0.010 | ~$30 |
| Posts + replies | ~$2 | ~$2 |
| **Total X API** | | **~$77** |

Hard monthly cap: `HERALD_MONTHLY_BUDGET=150` (USD). Circuit breaker checked before every X API call.

#### Post Approval Queue

| Action | Approval Mode |
|--------|---------------|
| DM replies | Auto (low risk, private) |
| Replies to mentions | Auto (responsive, conversational) |
| Scheduled posts | **Queued** — RECTOR approves via HERALD tab, auto-approve after 30min (configurable) |
| Threads | **Queued** — RECTOR approves |
| Crisis/security posts | **Queued** — RECTOR approves |

Posts queue to `herald_queue` table. Visible in HERALD tab with [Approve] [Edit] [Reject] actions.

```
HERALD_AUTO_APPROVE_POSTS=true       # auto-approve after timeout
HERALD_AUTO_APPROVE_TIMEOUT=1800     # seconds (30 min)
HERALD_REQUIRE_APPROVAL=false        # strict mode: never auto-approve
```

#### Intent Classification (per mention/DM)

```
mention/DM → HERALD classifies:
  command    → execute tool (privacyScore, threatCheck) or generate /tx/:id
  question   → generate helpful reply
  engagement → like, RT, or short reply
  spam       → ignore silently
```

#### Delegation to Service SIPHER

In-process direct function call (not Redis):

```typescript
async function delegateToServiceSipher(tool: string, params: object): Promise<string> {
  return await serviceSipher.prompt(
    `Execute ${tool} with params: ${JSON.stringify(params)}. Return only the result.`
  )
}
```

#### DM → Web Execution Link Flow

1. User DMs @SipProtocol: "deposit 5 SOL"
2. HERALD classifies as `command` → needs wallet signature
3. HERALD creates execution link: `sipher.sip-protocol.org/tx/{id}`
4. Sends DM: "I've prepared your deposit. Sign here: [link] (expires in 15 min)"
5. User clicks link → connects wallet → signs → TX executes
6. HERALD sends follow-up DM: "Deposit confirmed. TX: abc...def"

#### Autonomous Behaviors

| Behavior | Interval | Description |
|----------|----------|-------------|
| Mention poll | 10m (adaptive) | Read mentions, classify, respond |
| DM poll | 10m (adaptive) | Read DMs, handle commands or generate /tx/:id |
| Scheduled posts | Check every 5m | Post approved/auto-approved content |
| Engagement | 30m | Like/RT high-quality privacy content |

#### Events Emitted

- `herald:post` — tweet created or queued (id, text, status)
- `herald:dm` — DM handled (user, intent, response)
- `herald:budget` — threshold crossed (gate change)
- `herald:approval-needed` — post waiting for review

#### Personality

Confident, technical, cypherpunk. Never corporate, never aggressive shilling. Public replies never echo wallet addresses or amounts. Thread context limited to last 5 tweets (no cross-thread memory).

---

### 3.3 SENTINEL — Blockchain Monitor

**Identity:** Silent watchdog. No LLM. Pure code — scans blocks, detects events, triggers actions.
**Framework:** Custom TypeScript worker class (no Pi SDK — not an LLM agent)

#### Adaptive Scan

```
Idle (no connected wallets): every 60s
Active (wallet connected + recent activity): every 15s
WebSocket: subscribe to Helius webhook for real-time events when available
RPC error: exponential backoff (60s → 120s → 240s → max 600s)

Per-wallet budget:
  - Max 5 RPC calls per scan cycle per wallet
  - Max 20 wallets scanned per cycle
  - Helius free tier: 50K credits/day (~35 credits/min)
```

#### Scan Cycle (per wallet)

```
1. Check vault state (getAccountInfo on vault PDA)
2. Scan for new transfer announcements (getProgramAccounts with announcement discriminator)
3. Check scheduled_ops for missed/expired entries
4. Run threat check on any new interacting addresses
5. Emit events for anything found
```

#### Detection → Action Matrix

| Detection | Level | Event | Downstream |
|-----------|-------|-------|------------|
| Unclaimed stealth payment | IMPORTANT | `sentinel:unclaimed` | SIPHER prompts user to claim |
| Vault deposit expired (<1 SOL) | IMPORTANT | `sentinel:expired` | COURIER auto-refunds |
| Vault deposit expired (>=1 SOL) | CRITICAL | `sentinel:refund-pending` | SIPHER prompts user to confirm/extend |
| Flagged address interaction | CRITICAL | `sentinel:threat` | SIPHER alerts user, HERALD posts advisory |
| Large inbound transfer (>threshold) | IMPORTANT | `sentinel:large-transfer` | SIPHER notifies user |
| Vault balance change | IMPORTANT | `sentinel:balance` | Activity stream update |
| RPC error / downtime | CRITICAL | `sentinel:rpc-error` | Admin alert |
| Scan complete, no findings | ROUTINE | (logged to SQLite only) | Suppressed from stream |

#### Auto-Refund Guardrails

```
1. Deposit expired (past 24h timeout)?
   - Amount < SENTINEL_AUTO_REFUND_THRESHOLD (default 1 SOL):
     → auto-refund via COURIER, log to stream
   - Amount >= threshold:
     → emit sentinel:refund-pending → SIPHER prompts user
   - Active withdrawal in-flight:
     → skip, re-check next cycle

2. Double-processing guard:
   - Before refund: check if TX with same deposit PDA exists in last 100 signatures
   - If found → skip
   - Refund TX includes idempotency key (deposit PDA + timestamp hash)
```

#### Configuration

```bash
SENTINEL_SCAN_INTERVAL=60000            # ms (idle)
SENTINEL_ACTIVE_SCAN_INTERVAL=15000     # ms (active)
SENTINEL_AUTO_REFUND_THRESHOLD=1        # SOL
SENTINEL_THREAT_CHECK=true
SENTINEL_LARGE_TRANSFER_THRESHOLD=10    # SOL
```

---

### 3.4 COURIER — Scheduled Executor

**Identity:** Already built as crank engine in Phase 1. Formalized with name. No LLM.
**Framework:** Custom worker (same as Phase 1 crank.ts)

60s interval. Polls `scheduled_ops` table. Calls tool executors directly as plain functions (not through Pi agent loop).

```typescript
const executors: Record<string, ToolExecutor> = {
  deposit: executeDeposit,
  send: executeSend,
  refund: executeRefund,
  scheduleSend: executeScheduleSend,
  splitSend: executeSplitSend,
  drip: executeDrip,
  recurring: executeRecurring,
  sweep: executeSweep,
  consolidate: executeConsolidate,
}
```

#### Events Emitted

- `courier:executed` (IMPORTANT) — op completed
- `courier:failed` (CRITICAL) — op failed, will retry
- `courier:expired` (IMPORTANT) — op expired without execution

---

### 3.5 Agent Coordination Model

```
SENTINEL detects  ──EventEmitter──→  SIPHER receives, prompts user
HERALD needs privacyScore  ──direct call──→  Service SIPHER executes, returns
SENTINEL expired deposit  ──EventEmitter──→  COURIER triggers refund
All events  ──EventEmitter──→  ActivityLogger  ──Redis Stream──→  SSE  ──→  Frontend
```

| Mechanism | Used For | Why |
|-----------|----------|-----|
| **EventEmitter** | Agent-to-agent within process | Zero latency, synchronous when needed |
| **Direct function call** | HERALD → Service SIPHER | Request-reply, no pub/sub gymnastics |
| **Redis Streams** (with consumer groups) | Critical ops (refunds) | Acknowledgment, no event loss, replay |
| **Redis Streams** | Activity → SSE fan-out | Persistence, replay on reconnect, multi-client |
| **SQLite** | All state persistence | Sessions, activity, herald queue, scheduled ops, costs |

Redis Streams channels:

| Stream | Publishers | Consumers |
|--------|-----------|-----------|
| `guardian:activity` | ActivityLogger | SSE endpoint (per-wallet filtered) |
| `guardian:ops` | SENTINEL | COURIER (consumer group, ack required) |

---

## 4. UI/UX Design

### 4.1 Design Philosophy

**Not a chatbot. Not a dashboard. A privacy operations interface run by agents.**

Design language: dark, terminal-inspired, refined. Linear's clarity meets a crypto wallet's purpose. No neon, no glassmorphism, no particle backgrounds. Clean typography, high contrast, color only for agent identity and status.

**Implementation:** AI Designer MCP (`generate_design` + `refine_design`). Section 4 serves as the design brief. Wireframes here translate to AI Designer prompts.

### 4.2 Layout

Single column. One primary view at a time. Bottom nav. Command bar always accessible. Mobile-first.

```
+----------------------------------------------------------+
|  Header: SIPHER logo + wallet status + connection dot    |
+----------------------------------------------------------+
|                                                          |
|  Primary View (one of):                                  |
|  - Activity Stream (default)                             |
|  - Vault                                                 |
|  - HERALD                                                |
|  - Squad                                                 |
|                                                          |
|                                                          |
+----------------------------------------------------------+
|  Command Bar: > Talk to SIPHER...                  Cmd+K |
+----------------------------------------------------------+
|  Nav: [Stream]  [Vault]  [HERALD]  [Squad]               |
+----------------------------------------------------------+
```

| Breakpoint | Behavior |
|------------|----------|
| Mobile (<640px) | Full-width, bottom nav, command bar as bottom sheet |
| Tablet (640-1024px) | Same layout, wider content area |
| Desktop (>1024px) | Centered max-width (720px), keyboard shortcuts active |

### 4.3 Agent Identity System

| Agent | Color | Hex | Indicator | Voice in Stream |
|-------|-------|-----|-----------|-----------------|
| SIPHER | Emerald | `#10B981` | `●` | First-person ("I've deposited...") |
| HERALD | Blue | `#3B82F6` | `●` | Reporter ("Posted: ...", "Replied to: ...") |
| SENTINEL | Amber | `#F59E0B` | `●` | Alert ("Detected: ...", "Scanned: ...") |
| COURIER | Violet | `#8B5CF6` | `●` | Log ("Executed: ...", "Refund complete.") |

### 4.4 View: Activity Stream (Default)

Reverse chronological feed. Every agent reports here. Actionable entries have inline buttons.

**Entry structure:**
```
[Agent Color Dot] [Agent Name]                    [Time ago]
[Title text — one line summary]
[Optional detail — TX link, metrics, extended info]
[Optional action buttons — Claim, Approve, View]
```

**Event filtering:**
- CRITICAL + IMPORTANT events show in stream
- ROUTINE events suppressed (logged to SQLite, visible in Squad view)
- CRITICAL events pin to top until dismissed
- Filter by agent: tap agent name to show only their events

**Behaviors:**
- Real-time — new entries animate in from top via SSE
- Inline actions (Claim, Approve, View TX, View on X)
- Pull-to-refresh on mobile
- Infinite scroll with pagination (GET /api/activity)

### 4.5 View: Vault

Focused financial view. No chat — pure operations.

**Sections:**
1. **Balance card** — SOL amount + USD estimate, [Deposit] and [Withdraw Privately] buttons
2. **Pending operations** — active drips, recurring sends, scheduled ops with next execution time
3. **Recent activity** — deposit/withdraw history with privacy indicators (Stealth checkmark)
4. **Fee summary** — total fees collected

**Deposit flow (overlay, step-by-step):**
1. Enter amount → show vault fee preview
2. Review (amount, fee, destination PDA)
3. Sign → wallet popup
4. Confirmation with TX link + SENTINEL starts watching

**Withdraw flow (overlay, step-by-step):**
1. Enter amount
2. Stealth routing preview (one-time address generated)
3. Review (amount, stealth address, Pedersen commitment)
4. Sign → wallet popup
5. Confirmation + announcement PDA created

### 4.6 View: HERALD

X agent dashboard. Content queue + engagement + DMs.

**Sub-tabs:** [Activity] [Queue] [DMs]

**Activity:** Recent posts + replies with engagement metrics (likes, RTs, replies). Link to view on X.

**Queue:** Pending posts with [Approve] [Edit] [Reject] actions. Shows scheduled time. Budget bar at top (`$47/$150` with color shift at thresholds).

**DMs:** One-line summaries of DM conversations (username, intent classification, resolution). Link to execution link if generated.

### 4.7 View: Squad

Agent coordination overview. The ops room.

**Sections:**
1. **Agent status cards** — each agent with status (active/idle/polling/scanning/error), session count, next action time, today's cost
2. **Today's stats** — tool calls, X posts, blocks scanned, alerts, scheduled ops, total costs
3. **Coordination log** — agent-to-agent events in last 24h (SENTINEL → SIPHER, HERALD → Service SIPHER, etc.)
4. **Kill switch** — [Pause All Vault Ops] emergency button

### 4.8 Command Bar

Always visible at bottom. Activates on tap or `Cmd+K`.

**Collapsed:** Single line input with placeholder "Talk to SIPHER..."

**Expanded:** Bottom sheet overlay with conversation. Does not replace current view — user can switch views and return.

**During active operations:**
- Tool execution shows step indicators (generating address ✓, building proof ✓, awaiting signature...)
- Confirmation cards appear inline with countdown timer (120s)
- Minimizable — shows pill "● SIPHER is working..." when collapsed during active conversation

**Confirmation card structure:**
```
Action: [what will happen]
Amount: [SOL amount]
To: [destination — stealth address or vault PDA]
Fee: [amount]
[Confirm & Sign]    [Cancel]    [countdown timer]
[progress bar]
```

Timeout → auto-cancel. Never hangs.

### 4.9 Visual Design Direction

| Element | Value |
|---------|-------|
| Background | `#0A0A0B` (near black) |
| Cards | `#141416` with `1px #1E1E22` border |
| Text primary | `#F5F5F5` |
| Text secondary | `#71717A` |
| Typography | Mono for addresses/hashes/amounts, sans-serif for everything else |
| Agent colors | Emerald, blue, amber, violet — indicators only, never backgrounds |
| Animations | Subtle — fade-in for stream entries, slide-up for command bar |
| Borders | 1px, rounded-lg (8px). No shadows except command bar overlay |
| Confirmation cards | Elevated (slight border glow matching agent color) |
| Critical alerts | Amber left border, ⚠ icon |

**NOT this:** Neon cyberpunk, glassmorphism, gradient backgrounds, floating orbs, particle effects. Privacy is serious — the UI should feel secure, not flashy.

---

## 5. Data Model

### 5.1 Existing Tables (Kept from Phase 1)

| Table | Purpose | Phase 2 Changes |
|-------|---------|-----------------|
| `sessions` | Per-wallet session state | Add `conversation_json` column (Pi agent state for resume) |
| `audit_log` | All tool executions | Add `agent` column (sipher/herald/courier/sentinel) |
| `scheduled_ops` | COURIER operations | No changes |
| `payment_links` | `/pay/:id` data | No changes |

### 5.2 New Tables

```sql
-- Activity stream (spine of the UI)
CREATE TABLE activity_stream (
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

-- HERALD content queue
CREATE TABLE herald_queue (
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

-- HERALD DM tracking
CREATE TABLE herald_dms (
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

-- Execution links (DM/X -> web TX signing)
CREATE TABLE execution_links (
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

-- Cost tracking (LLM + X API)
CREATE TABLE cost_log (
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

-- Agent coordination events
CREATE TABLE agent_events (
  id          TEXT PRIMARY KEY,
  from_agent  TEXT NOT NULL,
  to_agent    TEXT,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
```

### 5.3 Indexes

```sql
CREATE INDEX idx_activity_wallet_created ON activity_stream(wallet, created_at DESC);
CREATE INDEX idx_activity_level ON activity_stream(level) WHERE level IN ('critical', 'important');
CREATE INDEX idx_herald_queue_status ON herald_queue(status, scheduled_at);
CREATE INDEX idx_herald_dms_user ON herald_dms(x_user_id, created_at DESC);
CREATE INDEX idx_exec_links_status ON execution_links(status, expires_at);
CREATE INDEX idx_cost_log_agent_date ON cost_log(agent, created_at);
CREATE INDEX idx_agent_events_created ON agent_events(created_at DESC);
```

---

## 6. API Routes

### 6.1 New Routes

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/stream` | SSE — real-time activity events | Wallet (scoped) |
| GET | `/api/activity` | Paginated activity history | Wallet (scoped) |
| POST | `/api/command` | Send message to SIPHER (command bar) | Wallet |
| POST | `/api/confirm/:id` | Confirm/cancel fund-moving operation | Wallet |
| GET | `/api/vault` | Vault state (balance, pending, history) | Wallet |
| GET | `/api/herald` | HERALD status (queue, DMs, budget) | Admin |
| POST | `/api/herald/approve/:id` | Approve/reject queued post | Admin |
| GET | `/api/squad` | Agent statuses + coordination log + costs | Admin |
| POST | `/api/squad/kill` | Kill switch — pause all vault ops | Admin |
| GET | `/tx/:id` | Execution link page (DM → web signing) | Public |
| POST | `/tx/:id/sign` | Submit signed TX | Wallet |
| GET | `/link/:nonce` | Wallet linking page (X identity → wallet) | Public |

### 6.4 Wallet Auth for SSE

SSE stream (`/api/stream`) requires wallet authentication:
1. Client connects wallet (Phantom/Solflare)
2. Client signs a nonce via `POST /api/auth` → returns short-lived JWT (1h)
3. SSE connects with `?token=<jwt>` query param
4. Server validates JWT, scopes events to that wallet address
5. On token expiry, client re-signs and reconnects

### 6.5 Wallet Linking Flow (`/link/:nonce`)

For X/Telegram users to link their wallet to their platform identity:
1. HERALD generates a unique nonce + URL: `sipher.sip-protocol.org/link/{nonce}`
2. Sends URL via DM to user
3. User opens link → connects wallet → signs nonce
4. Server stores mapping: `{ x_user_id, wallet_address, linked_at }` in sessions table
5. Future DM commands from that user auto-resolve to their wallet

### 6.2 Existing Routes (Kept)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Non-streaming chat (Mode 1) |
| POST | `/api/chat/stream` | Streaming chat SSE (Mode 1) |
| POST | `/api/tools/:name` | Direct tool execution |
| GET | `/api/health` | Health check |
| GET | `/api/tools` | Tool list |
| GET | `/pay/:id` | Payment link page |
| POST | `/pay/:id/confirm` | Payment confirmation |
| * | `/v1/*` | Mode 2 REST API (71 endpoints) |

### 6.3 SSE Protocol

Client connects to `GET /api/stream` with wallet signature auth. Events:

```
event: activity
data: {"id":"...","agent":"sentinel","level":"important","title":"Unclaimed stealth payment: 1.5 SOL","actionable":true,"action_type":"claim"}

event: confirm
data: {"id":"c3f2","tool":"send","params":{"amount":2},"timeout":120}

event: agent-status
data: {"sipher":"active","herald":"polling","sentinel":"scanning","courier":"idle"}

event: herald-budget
data: {"spent":47.20,"limit":150,"gate":"normal"}

event: cost-update
data: {"today":{"sipher":2.14,"herald":1.87,"sentinel":0,"courier":0}}
```

---

## 7. Infrastructure

### 7.1 Environment Variables

```bash
# Existing (kept)
PORT=3000
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SIPHER_HELIUS_API_KEY=...
REDIS_URL=redis://redis:6379
SIPHER_ADMIN_PASSWORD=...
DB_PATH=/app/data/sipher.db

# Pi SDK / OpenRouter
OPENROUTER_API_KEY=...
SIPHER_MODEL=anthropic/claude-sonnet-4-6
HERALD_MODEL=anthropic/claude-sonnet-4-6

# X API (HERALD)
X_BEARER_TOKEN=...
X_CONSUMER_KEY=...
X_CONSUMER_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
HERALD_MONTHLY_BUDGET=150
HERALD_AUTO_APPROVE_POSTS=true
HERALD_AUTO_APPROVE_TIMEOUT=1800
HERALD_POLL_INTERVAL=600000

# SENTINEL
SENTINEL_SCAN_INTERVAL=60000
SENTINEL_ACTIVE_SCAN_INTERVAL=15000
SENTINEL_AUTO_REFUND_THRESHOLD=1
SENTINEL_THREAT_CHECK=true
SENTINEL_LARGE_TRANSFER_THRESHOLD=10

# Frontend
VITE_API_URL=
VITE_WALLET_NETWORK=mainnet-beta
```

All secrets stored in `~/Documents/secret/.env` (iCloud encrypted, Bitwarden backup).

### 7.2 Docker Compose

```yaml
name: sipher

services:
  api:
    image: ghcr.io/sip-protocol/sipher:latest
    ports:
      - "5006:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - DB_PATH=/app/data/sipher.db
      - TRUST_PROXY=1
    volumes:
      - sipher-data:/app/data
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --appendonly yes
      --maxmemory 100mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped

volumes:
  sipher-data:
  redis-data:
```

### 7.3 Deployment

```
Push to main → GitHub Actions:
  1. pnpm install && pnpm test -- --run
  2. pnpm build (backend + frontend)
  3. Docker build → ghcr.io/sip-protocol/sipher:latest
  4. SSH to VPS → docker compose pull && docker compose up -d
  5. Health check → /api/health
  6. docker image prune -f
```

Frontend builds to `app/dist/`, served as static by Express. Single image, single container.

### 7.4 Cost Estimates

**Monthly operational:**

| Service | Cost |
|---------|------|
| LLM: SIPHER (Sonnet, ~500K tok/day) | ~$99 |
| LLM: HERALD (Sonnet, ~100K tok/day) | ~$20 |
| LLM: Service SIPHER (sporadic) | ~$5 |
| X API (adaptive polling) | ~$77 |
| Helius RPC (free tier) | $0 |
| VPS (shared, already running) | $0 incremental |
| Redis (shared container) | $0 |
| **Total** | **~$201/mo** |

---

## 8. Prerequisites

Before Phase 2 implementation begins:

| # | Task | Detail |
|---|------|--------|
| 1 | Deploy Phase 1 to VPS | Wave B+C code on main, not live. Redeploy container + SQLite volume mount |
| 2 | Verify Phase 1 live | All 21 tools working on sipher.sip-protocol.org |
| 3 | Create Pi SDK skill | cipher-kit plugin at `plugins/pi-sdk/` — API reference for future sessions |
| 4 | X API credentials | Ensure @SipProtocol OAuth 1.0a tokens in ~/Documents/secret/.env |

---

## 9. Out of Scope

| Item | Reason |
|------|--------|
| Telegram bot | Deferred — web + X only for Phase 2 |
| Discord adapter | Deferred to Phase 2.5 |
| Postgres migration | SQLite sufficient for single-process |
| Pi SDK `pi-coding-agent` | Only using `pi-agent-core` + `pi-ai` — no CLI/TUI needed |
| `pi-web-ui` components | Using AI Designer for custom frontend instead |
| MCP skill export | Deferred — not needed for hackathon |
| Mainnet vault CPI | sipher_vault CPI to sip_privacy built but deploy deferred to post-hackathon |

---

## 10. Success Criteria

1. All 3 agents running simultaneously (SIPHER + HERALD + SENTINEL + COURIER)
2. Activity stream showing real-time agent coordination
3. Command bar → SIPHER handles all 21 tools with async confirmation
4. HERALD posting, replying, handling DMs on X with budget gates
5. SENTINEL scanning and alerting with auto-refund (< threshold)
6. Vault deposit/withdraw flows with stealth routing
7. Squad view showing agent status, costs, coordination log
8. Kill switch functional
9. Execution links (`/tx/:id`) working end-to-end from X DM
10. World-class UI — dark, clean, fast, mobile-responsive
11. All existing 385+ tests still passing
12. New tests for: AgentPool, HERALD tools, SENTINEL scanner, coordination layer, SSE stream
