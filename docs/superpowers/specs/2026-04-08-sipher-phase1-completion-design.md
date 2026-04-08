# Sipher Phase 1 Completion — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Author:** RECTOR + CIPHER
**Ref:** `docs/superpowers/specs/2026-03-30-sipher-vision-design.md` (original vision spec)

---

## Goal

Close the gaps between the Sipher vision spec (Mar 30) and current implementation. Phase 1 is ~60% complete — the core infrastructure works (vault, 10 tools, real crypto, SSE streaming, wallet signing) but 11 agent tools, persistence, CPI wiring, and product features are missing.

**Approach:** Incremental delivery in 3 waves. Wave A builds infrastructure that unblocks B and C.

**Repo:** `/Users/rector/local-dev/sipher/`

---

## Current State (Apr 8, 2026)

**What's shipped:**
- sipher_vault on devnet (7 instructions, 14 tests)
- @sipher/sdk (vault ops, PDA derivation, real deserialization)
- 10 agent tools (deposit, send, refund, balance, scan, claim, swap, viewingKey, history, status)
- Web chat UI (React 19, wallet adapter, SSE streaming, POST fallback)
- Real ed25519 DKSAP stealth addresses + secp256k1 Pedersen commitments
- Mode 1 (agent chat) + Mode 2 (REST API, 71 endpoints) on same Express server
- Deployed: sipher.sip-protocol.org

**What's missing (from vision spec Phase 1):**
- 11 agent tools (privacy-enhancing + product + automation)
- Real Jupiter swap execution (current: quote-only stub)
- Real viewing key generation (current: stub responses)
- Real history parsing (current: returns empty)
- CPI: sipher_vault -> sip_privacy
- SQLite persistence (sessions, preferences, audit, scheduled ops)
- Session isolation per wallet
- URL routes (/pay/:id, /admin/)
- Scheduled operations engine

---

## Wave A — Close Partial Work + Infrastructure

**Purpose:** Fix half-done tools, add persistence and session management that Wave B/C depend on.

### A1. Swap Tool — Real Jupiter Execution

**Current:** Returns quote preview only, no actual swap TX.

**Target:**
- Fetch quote from `lite-api.jup.ag/swap/v1/quote` (free tier)
- Build swap TX server-side with Jupiter swap API
- Stealth output: swap result goes to derived stealth ATA, not user's wallet
- Return serialized TX for wallet signing
- Use `skipPreflight: true` + `maxRetries: 3` (proven pattern from sip-mobile)

**Files:** `packages/agent/src/tools/swap.ts`, `packages/sdk/src/swap.ts` (new)

### A2. ViewingKey Tool — Real Crypto

**Current:** Returns stub `hasDownload: true` without real keys.

**Target:**
- `generate`: call `generateViewingKey()` from `@sip-protocol/sdk`, return as encrypted download blob
- `export`: derive viewing key for a specific TX via `deriveViewingKey()`, package for auditor
- `verify`: check a viewing key against a transaction using `decryptWithViewing()`
- Keys NEVER displayed in chat text — only via download action in UI

**Files:** `packages/agent/src/tools/viewing-key.ts`

### A3. History Tool — On-Chain Parsing

**Current:** Returns empty array.

**Target:**
- Query `getSignaturesForAddress` on sipher_vault program
- Parse VaultWithdrawEvent, deposit, and refund event logs from Anchor program data
- Filter by wallet + optional token
- Return structured timeline: action, amount, token, timestamp, TX signature
- Default 9 decimals (SOL), resolve per-token when available

**Files:** `packages/agent/src/tools/history.ts`, `packages/sdk/src/events.ts` (new)

### A4. SQLite Persistence

**Current:** No persistence. Stateless per request.

**Target:**
- `better-sqlite3` — synchronous, zero-config, production-grade
- DB file: `/app/data/sipher.db` (bind-mounted in Docker for persistence)
- Encryption: defer to Phase 2 (SQLCipher adds build complexity)

**Schema:**

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- sha256(wallet_pubkey)
  wallet TEXT NOT NULL,          -- base58 pubkey
  preferences TEXT DEFAULT '{}', -- JSON blob
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'send', 'deposit', 'swap', etc.
  params TEXT NOT NULL,          -- sanitized JSON (no keys)
  tx_signature TEXT,             -- if TX was broadcast
  status TEXT NOT NULL,          -- 'prepared', 'signed', 'confirmed', 'failed'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE scheduled_ops (
  id TEXT PRIMARY KEY,           -- uuid
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'send', 'splitSend', 'drip', etc.
  params TEXT NOT NULL,          -- encrypted JSON
  wallet_signature TEXT NOT NULL, -- proof of authorization
  next_exec INTEGER NOT NULL,    -- unix timestamp
  expires_at INTEGER NOT NULL,   -- hard expiry
  max_exec INTEGER NOT NULL,     -- max execution count
  exec_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'executing', 'completed', 'cancelled', 'expired', 'missed'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE payment_links (
  id TEXT PRIMARY KEY,           -- short nanoid
  session_id TEXT,               -- creator (nullable for anonymous)
  stealth_address TEXT NOT NULL, -- base58 stealth pubkey
  ephemeral_pubkey TEXT NOT NULL,-- hex
  amount REAL,                   -- requested amount (null = any amount)
  token TEXT DEFAULT 'SOL',
  memo TEXT,
  type TEXT DEFAULT 'link',      -- 'link' or 'invoice'
  invoice_meta TEXT,             -- JSON: description, due_date, reference
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'expired', 'cancelled'
  expires_at INTEGER NOT NULL,
  paid_tx TEXT,                  -- TX signature when paid
  created_at INTEGER NOT NULL
);
```

**Files:** `packages/agent/src/db.ts` (new), `packages/agent/src/db/schema.sql` (new)

### A5. Session Isolation

**Current:** Single shared agent state across all connections.

**Target:**
- Each wallet connection gets a session (wallet pubkey hash)
- Agent conversation scoped to session
- Session timeout: 30min idle -> purge LLM context
- Preferences loaded/saved per session to SQLite
- Chat endpoint receives `wallet` in request body (already sent by UI)
- Agent tool calls receive session context (wallet, preferences)

**Files:** `packages/agent/src/session.ts` (new), modify `packages/agent/src/index.ts`

### A6. CPI: sipher_vault -> sip_privacy

**Current:** Vault and SIP Privacy are independent programs. Withdrawal and stealth announcement are separate calls.

**Target:**
- `withdraw_private` instruction calls sip_privacy's `shielded_token_transfer` via CPI
- Atomic: vault deduction + stealth send + announcement in one TX
- Requires sip_privacy program ID in instruction accounts
- Update @sipher/sdk's `buildPrivateSendTx` to include CPI accounts

**Files:** `programs/sipher-vault/programs/sipher_vault/src/lib.rs`, `packages/sdk/src/privacy.ts`

**Note:** This is on-chain Rust work. Requires anchor build + devnet redeploy.

### A-Tests

Target: **100+ new tests** across Wave A.
- Swap: quote fetch, TX construction, stealth output routing
- ViewingKey: generate, export, verify round-trip
- History: event parsing, filtering, pagination
- SQLite: CRUD for all tables, schema migrations
- Sessions: creation, timeout, isolation, preference persistence
- CPI: integration test with both programs (anchor test)

---

## Wave B — Product Tools + Admin

**Purpose:** Deliver user-facing features that make Sipher useful beyond basic send/receive.

### B1. `paymentLink` Tool

Generate a one-time stealth receive URL. Sender doesn't need Sipher.

**Flow:**
1. User: "Create a payment link for 50 USDC"
2. Agent generates stealth address + ephemeral pubkey via `generateEd25519StealthAddress`
3. Stores in `payment_links` table (SQLite)
4. Returns URL: `sipher.sip-protocol.org/pay/<nanoid>`

**`/pay/:id` page:**
- Server-rendered (Express template or static HTML with API call)
- Shows: amount, token, memo, expiry countdown
- "Pay" button: connects sender's wallet, builds TX to stealth address, signs + broadcasts
- After payment detected: mark as completed
- No Sipher account needed for sender

**Files:** `packages/agent/src/tools/payment-link.ts`, `packages/agent/src/routes/pay.ts` (new)

### B2. `invoice` Tool

Like paymentLink but with structured metadata.

**Additional fields:** description, due_date, reference number
- Stored in `payment_links` table with `type: 'invoice'` and `invoice_meta` JSON
- URL: `sipher.sip-protocol.org/pay/<id>?type=invoice`
- Page shows invoice details + pay button
- Viewing key auto-generated for the invoice TX

**Files:** `packages/agent/src/tools/invoice.ts`

### B3. `privacyScore` Tool

Analyze wallet's on-chain exposure (0-100 score).

**Analysis factors:**
- TX count to known exchange deposit addresses (Jupiter strict list)
- Token diversity and DeFi interaction patterns
- Labeled addresses on public analytics (hardcoded known list Phase 1)
- Transaction frequency and amount patterns
- Known counterparty clustering

**No external API dependency** — pure on-chain analysis using `getSignaturesForAddress` + `getParsedTransactions`.

**Returns:** score (0-100), risk_level (low/medium/high/critical), specific exposure points, recommendations.

**Files:** `packages/agent/src/tools/privacy-score.ts`, `packages/sdk/src/analysis.ts` (new)

### B4. `threatCheck` Tool

Check recipient reputation before sending.

**Sources (Phase 1 — bundled dataset):**
- OFAC SDN list (public, ~2K addresses)
- Known exchange deposit addresses (top 20 exchanges)
- Community-maintained scam database (static JSON, updated with releases)

**Returns:** `safe` / `caution` / `blocked` with reason.

**Files:** `packages/agent/src/tools/threat-check.ts`, `packages/sdk/src/threats.ts` (new)

### B5. Admin Dashboard (`/admin/`)

Password-protected command center for RECTOR.

**Auth:** `SIPHER_ADMIN_PASSWORD` env var, bcrypt hashed, session cookie.

**Panels:**
- Vault: TVL, deposit count, token breakdown (on-chain queries)
- Sessions: active count, today's total (SQLite)
- Transactions: sends, swaps, refunds — 24h/7d/30d volume (SQLite audit_log)
- Fees: collected totals per token (on-chain fee PDAs)
- Kill switch: call `set_paused` on sipher_vault via authority wallet
- Audit log viewer: search by wallet, date, action type
- Payment links: active/expired/paid counts

**Stack:** Server-rendered HTML with Express. No SPA framework — keep it lean. Tailwind for styling. HTMX for interactivity (partial page updates without JS framework).

**Files:** `packages/agent/src/routes/admin.ts` (new), `packages/agent/src/views/` (new, HTML templates)

### B-Tests

Target: **60+ new tests.**
- paymentLink: create, fetch, pay, expire, double-pay prevention
- invoice: create with metadata, payment detection
- privacyScore: score calculation, edge cases (empty wallet, whale wallet)
- threatCheck: OFAC match, exchange detection, safe address
- Admin: auth, panel data queries, kill switch

---

## Wave C — Time-Based Privacy Tools

**Purpose:** The agent differentiators. These are behaviors that run autonomously — an app can't do them.

### C0. Scheduled Operations Engine

Foundation for all Wave C tools.

**Crank worker:**
- Runs every 60 seconds via `setInterval` in the Express server process
- Queries `scheduled_ops` where `next_exec <= now AND status = 'pending'`
- Executes sequentially (no parallel ops to avoid race conditions)
- Updates `exec_count`, `next_exec` (for recurring), `status`
- Missed ops (next_exec < now - window): mark as `missed`, notify user next session
- Hard expiry: if `expires_at < now`, mark as `expired`
- Max exec: if `exec_count >= max_exec`, mark as `completed`

**Authorization model:**
- Every scheduled op requires wallet signature at creation
- Signature covers: action, params hash, expires_at, max_exec
- Cancellation requires wallet signature
- No modification — cancel and recreate

**Files:** `packages/agent/src/crank.ts` (new), `packages/agent/src/scheduled.ts` (new)

### C1. `splitSend`

Split amount into N random chunks via stealth relays.

- N auto-determined: amounts < 100 -> 2 chunks, < 1000 -> 3, < 10000 -> 4, else 5
- User can override N
- Each chunk: random amount (summing to total), random delay (spread over 1-6h default)
- Each chunk sent to unique stealth address -> relayed to final recipient
- Single wallet signature authorizes full schedule
- Creates N scheduled_ops rows

### C2. `scheduleSend`

Delay a send by specified or random time.

- "Send 100 USDC to X in 4-8 hours" -> random delay within range
- Creates 1 scheduled_op row
- Cancellable before execution

### C3. `drip`

DCA-style private distribution.

- "Send 1000 USDC to X over 5 days"
- Amount per drip: randomized +-10% of equal split
- Interval: randomized +-4h jitter around equal spacing
- Each drip = separate stealth send
- Creates N scheduled_ops rows

### C4. `roundAmount`

Auto-round to common denominations.

- 1,337.42 USDC -> sends 1,300 USDC (rounded) + 37.42 remainder stays in vault
- Denominations: 10, 50, 100, 500, 1000, 5000, 10000
- Rounds down to nearest denomination
- Synchronous — no scheduled ops needed
- Returns: sent amount, remainder, denomination used

### C5. `recurring`

Recurring private payments on interval.

- "Send 500 USDC to X every 2 weeks"
- Amount: randomized +-5% each execution
- Timing: randomized +-24h jitter
- Max execution count REQUIRED (no infinite)
- Re-authorization needed after expiry
- Creates 1 scheduled_op row with recurring next_exec calculation

### C6. `sweep`

Auto-shield incoming wallet funds.

- Monitor user's wallet for new token transfers
- When detected: auto-build deposit TX into vault
- Phase 1: poll-based (every 30 seconds via crank worker)
- Phase 2: WebSocket push via Helius
- Creates 1 persistent scheduled_op with `action: 'sweep'`
- Each detected transfer: auto-deposit, log to audit_log

### C7. `consolidate`

Merge multiple unclaimed stealth balances.

- Scan for unclaimed payments (reuse scan tool)
- Claim each with random time delays (1-4h between claims)
- Avoids clustering analysis from simultaneous claims
- Creates N scheduled_ops rows (one per claim, staggered)

### C-Tests

Target: **80+ new tests.**
- Crank worker: timing, expiry, missed ops, cancellation, max exec, concurrent safety
- splitSend: chunk generation, amount sum validation, schedule creation
- scheduleSend: delay calculation, cancellation
- drip: interval jitter, amount randomization, total accuracy
- roundAmount: denomination selection, remainder calculation
- recurring: jitter, re-authorization, max exec
- sweep: transfer detection, auto-deposit
- consolidate: multi-claim scheduling, delay enforcement

---

## Summary

| Wave | Items | New Tests | Dependencies |
|------|-------|-----------|--------------|
| A | swap fix, viewingKey fix, history fix, SQLite, sessions, CPI | ~100 | None (foundation) |
| B | paymentLink, invoice, privacyScore, threatCheck, admin | ~60 | Wave A (SQLite) |
| C | splitSend, scheduleSend, drip, roundAmount, recurring, sweep, consolidate, crank engine | ~80 | Wave A (SQLite, sessions) |
| **Total** | **~25 deliverables** | **~240 tests** | |

**After all 3 waves:** Sipher Phase 1 matches the vision spec. 21/21 tools, persistence, session isolation, admin dashboard, payment links, scheduled operations, CPI wiring. Ready for Phase 2 (multi-platform).
