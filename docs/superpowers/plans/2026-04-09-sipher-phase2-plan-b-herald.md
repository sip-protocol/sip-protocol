# Sipher Phase 2 — Plan B: HERALD (X Agent)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build HERALD — an autonomous X/Twitter agent that monitors mentions, handles DMs, posts content with approval queue, and coordinates with SIPHER for privacy operations.

**Architecture:** HERALD is a Pi SDK agent (`pi-agent-core` + `pi-ai`) with 9 tools wrapping X API v2. It runs autonomous polling loops (mentions, DMs, scheduled posts, engagement) with adaptive intervals and budget gates. Posts go through an approval queue. DM commands that need wallet signing generate execution links (`/tx/:id`). HERALD delegates read-only privacy operations (privacyScore, threatCheck) to Service SIPHER via in-process function call.

**Tech Stack:** `twitter-api-v2` (X API client), `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, Express 5, SQLite, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-sipher-phase2-guardian-command-design.md` (Section 3.2)

**Working directory:** `~/local-dev/sipher/`

**Branch:** `feat/phase2-guardian-command` (continues from Plan A)

**Depends on:** Plan A complete (EventBus, ActivityLogger, DB schema with `herald_queue`/`herald_dms`/`execution_links`/`cost_log` tables, Service SIPHER, squad routes)

---

## File Map

### New Files

```
packages/agent/src/herald/
├── x-client.ts           # X API v2 client (OAuth 1.0a + Bearer token)
├── budget.ts             # Cost tracking + circuit breaker + budget gates
├── tools/
│   ├── read-mentions.ts  # readMentions tool
│   ├── read-dms.ts       # readDMs tool
│   ├── search-posts.ts   # searchPosts tool
│   ├── read-user.ts      # readUserProfile tool
│   ├── post-tweet.ts     # postTweet tool (queued)
│   ├── reply-tweet.ts    # replyTweet tool
│   ├── like-tweet.ts     # likeTweet tool
│   ├── send-dm.ts        # sendDM tool
│   └── schedule-post.ts  # schedulePost tool (local, no API call)
├── intent.ts             # Intent classifier (command/question/engagement/spam)
├── approval.ts           # Post approval queue manager
├── poller.ts             # Adaptive polling loops (mentions, DMs, scheduled, engagement)
└── herald.ts             # HERALD Pi agent factory (system prompt, tool registry)

packages/agent/src/routes/
└── herald-api.ts         # GET /api/herald, POST /api/herald/approve/:id
```

### Modified Files

```
packages/agent/package.json  # Add twitter-api-v2
packages/agent/src/index.ts  # Mount herald routes, start poller
```

### Test Files

```
packages/agent/tests/herald/
├── x-client.test.ts
├── budget.test.ts
├── tools/read-mentions.test.ts
├── tools/post-tweet.test.ts
├── intent.test.ts
├── approval.test.ts
├── poller.test.ts
└── herald.test.ts
packages/agent/tests/routes/
└── herald-api.test.ts
packages/agent/tests/integration/
└── herald.test.ts
```

---

## Task 1: Install twitter-api-v2

**Files:**
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Add dependency**

```bash
cd ~/local-dev/sipher
pnpm add --filter @sipher/agent twitter-api-v2
```

- [ ] **Step 2: Verify install**

```bash
pnpm install
```

- [ ] **Step 3: Commit**

```bash
git add packages/agent/package.json pnpm-lock.yaml
git commit -m "chore: add twitter-api-v2 for HERALD X agent"
```

---

## Task 2: X API Client Wrapper

**Files:**
- Create: `packages/agent/src/herald/x-client.ts`
- Test: `packages/agent/tests/herald/x-client.test.ts`

### Implementation

`x-client.ts` wraps `twitter-api-v2` with two client modes:

- `getReadClient()` — Bearer token (app-only, read public data)
- `getWriteClient()` — OAuth 1.0a (user context @SipProtocol, read+write)
- `getHeraldUserId()` — returns `HERALD_X_USER_ID` env var

Both throw if credentials are missing. Env vars:
- `X_BEARER_TOKEN` — for reads
- `X_CONSUMER_KEY`, `X_CONSUMER_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` — for writes
- `HERALD_X_USER_ID` — the authenticated user's ID

### Tests (5)

1. Creates read-only client with Bearer token
2. Creates read-write client with OAuth 1.0a
3. Throws when Bearer token missing
4. Throws when OAuth credentials missing
5. Returns HERALD_X_USER_ID from env

### Steps

- [ ] Read `node_modules/twitter-api-v2/dist/index.d.ts` to verify constructor signatures
- [ ] Write test → verify failure
- [ ] Implement x-client.ts
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add X API client wrapper — Bearer token + OAuth 1.0a"`

---

## Task 3: Budget Tracker + Circuit Breaker

**Files:**
- Create: `packages/agent/src/herald/budget.ts`
- Test: `packages/agent/tests/herald/budget.test.ts`

### Implementation

`budget.ts` tracks X API costs via `cost_log` table and enforces budget gates:

- `trackXApiCost(operation, resourceCount)` — logs cost, emits event on gate change
- `getBudgetStatus()` — returns `{ spent, limit, gate, percentage }`
- `canMakeCall(operation)` — returns false if operation blocked by current gate

Cost table (X API v2 pay-per-use):
```
posts_read: $0.005, user_read: $0.010, dm_read: $0.010
content_create: $0.005, dm_create: $0.015, user_interaction: $0.015
mentions_read: $0.005, search_read: $0.005
```

Gates:
- `normal` (< 80%) — all operations allowed
- `cautious` (80-95%) — polling frequency reduced (handled by poller)
- `dm-only` (95-100%) — blocks mentions, search, posts, interactions
- `paused` (100%) — blocks everything

Budget limit from `HERALD_MONTHLY_BUDGET` env var (default 150).

### Tests (7)

1. Starts with zero spend, gate = normal
2. Tracks API call costs correctly
3. Gate → cautious at 80%
4. Gate → dm-only at 95%
5. Gate → paused at 100%
6. canMakeCall returns false when paused
7. canMakeCall blocks mentions in dm-only mode

### Steps

- [ ] Write test → verify failure
- [ ] Implement budget.ts (uses `logCost` and `getCostTotals` from db.ts)
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add HERALD budget tracker — cost tracking + circuit breaker + gate system"`

---

## Task 4: HERALD Read Tools (4 tools)

**Files:**
- Create: `packages/agent/src/herald/tools/read-mentions.ts`
- Create: `packages/agent/src/herald/tools/read-dms.ts`
- Create: `packages/agent/src/herald/tools/search-posts.ts`
- Create: `packages/agent/src/herald/tools/read-user.ts`
- Test: `packages/agent/tests/herald/tools/read-mentions.test.ts`

### Implementation

Each tool exports a Pi `Tool` definition and an `execute*` function. All check `canMakeCall()` before making API requests and call `trackXApiCost()` after.

**readMentions** — `GET /2/users/:id/mentions` via `client.v2.userMentionTimeline()`. Params: `since_id`, `max_results`. Returns `{ mentions: [...], cost }`.

**readDMs** — `client.v2.listDmEvents()` via write client (DMs need user context). Params: `max_results`. Returns `{ dms: [...], cost }`. Wrapped in try/catch (DM API may not be available).

**searchPosts** — `client.v2.search()`. Params: `query`, `max_results`. Returns `{ posts: [...], cost }`.

**readUserProfile** — `client.v2.userByUsername()`. Params: `username`. Returns `{ user, cost }`.

### Tests

Mock `twitter-api-v2` to avoid real API calls. Verify tool definitions have correct names and parameters. Verify execute functions return expected shapes.

### Steps

- [ ] Write test for readMentions (mock twitter-api-v2) → verify failure
- [ ] Implement all 4 read tools
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add HERALD read tools — readMentions, readDMs, searchPosts, readUserProfile"`

---

## Task 5: HERALD Write Tools (5 tools)

**Files:**
- Create: `packages/agent/src/herald/tools/post-tweet.ts`
- Create: `packages/agent/src/herald/tools/reply-tweet.ts`
- Create: `packages/agent/src/herald/tools/like-tweet.ts`
- Create: `packages/agent/src/herald/tools/send-dm.ts`
- Create: `packages/agent/src/herald/tools/schedule-post.ts`
- Test: `packages/agent/tests/herald/tools/post-tweet.test.ts`

### Implementation

**postTweet** — QUEUED, not direct. `executePostTweet()` inserts into `herald_queue` with status `pending` and emits `herald:approval-needed`. Exports a separate `publishTweet()` for the approval system to call when actually posting.

**replyTweet** — AUTO. `executeReplyTweet()` calls `client.v2.reply()` directly. Tracks cost.

**likeTweet** — AUTO. `executeLikeTweet()` calls `client.v2.like()`. Tracks cost.

**sendDM** — AUTO. `executeSendDM()` calls `client.v2.sendDmInConversation()`. Logs to `herald_dms` table. Emits `herald:dm`.

**schedulePost** — LOCAL. `executeSchedulePost()` inserts into `herald_queue` with `scheduled_at`. No API call.

### Tests

1. postTweet queues instead of posting directly (check herald_queue)
2. schedulePost queues with scheduled_at timestamp

### Steps

- [ ] Write tests (mock twitter-api-v2) → verify failure
- [ ] Implement all 5 write tools
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add HERALD write tools — postTweet (queued), replyTweet, likeTweet, sendDM, schedulePost"`

---

## Task 6: Intent Classifier

**Files:**
- Create: `packages/agent/src/herald/intent.ts`
- Test: `packages/agent/tests/herald/intent.test.ts`

### Implementation

Pattern-based classifier (no LLM — fast, free, deterministic):

```
Input: tweet text
Output: { intent, tool?, needsExecLink?, confidence }
```

Patterns:
- **command:** `privacy score`, `threat check`, `is X safe`, `deposit`, `send`, `swap`, `balance`, `scan`, `viewing key`, `history`
- **question:** `how`, `what is`, `why`, `explain`, `?` at end
- **spam:** external links (not sip-protocol), `buy now`, `click here`, `free crypto`, too short (<3 chars after removing @mentions)
- **engagement:** everything else (default)

Commands with `deposit/send/swap/claim/refund` set `needsExecLink: true` (wallet signing required).

### Tests (7)

1. Privacy score → command + privacyScore tool
2. Threat check → command + threatCheck tool
3. Deposit → command + needsExecLink
4. How-to question → question
5. Positive engagement → engagement
6. Scam link → spam
7. Empty/short → spam

### Steps

- [ ] Write test → verify failure
- [ ] Implement intent.ts
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add intent classifier — command/question/engagement/spam classification"`

---

## Task 7: Post Approval Queue

**Files:**
- Create: `packages/agent/src/herald/approval.ts`
- Test: `packages/agent/tests/herald/approval.test.ts`

### Implementation

Functions for managing the `herald_queue` table:

- `getPendingPosts()` — returns all posts with status `pending`
- `getReadyToPublish()` — returns `approved` posts (+ auto-approves pending posts older than `HERALD_AUTO_APPROVE_TIMEOUT`)
- `approvePost(id, approvedBy)` — sets status to `approved`
- `rejectPost(id)` — sets status to `rejected`
- `markPublished(id, tweetId)` — sets status to `posted`, stores tweet_id
- `editQueuedPost(id, newContent)` — updates content for pending/approved posts

Auto-approve: if `HERALD_AUTO_APPROVE_POSTS=true` and post is older than `HERALD_AUTO_APPROVE_TIMEOUT` seconds (default 1800), auto-approve with `approved_by: 'auto'`.

### Tests (5)

1. Returns pending posts
2. Approves a post (status + approved_by)
3. Rejects a post
4. getReadyToPublish returns approved posts
5. markPublished updates status + tweet_id

### Steps

- [ ] Write test → verify failure
- [ ] Implement approval.ts
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add post approval queue — pending, approve, reject, auto-approve, publish"`

---

## Task 8: HERALD Pi Agent Factory

**Files:**
- Create: `packages/agent/src/herald/herald.ts`
- Test: `packages/agent/tests/herald/herald.test.ts`

### Implementation

Central HERALD module:

- `HERALD_SYSTEM_PROMPT` — cypherpunk personality, rules, intent handling instructions
- `HERALD_TOOLS: Tool[]` — all 9 tools
- `HERALD_TOOL_EXECUTORS: Record<string, ToolExecutor>` — executor map
- `HERALD_IDENTITY` — name, role, llm flag, model ID

### Tests (3)

1. System prompt contains HERALD + cypherpunk
2. HERALD_TOOLS has 9 tools with expected names
3. HERALD_TOOL_EXECUTORS has functions for all 9 tools

### Steps

- [ ] Write test (mock pi-ai) → verify failure
- [ ] Implement herald.ts
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add HERALD Pi agent factory — system prompt, 9 tools, executor map"`

---

## Task 9: Adaptive Poller

**Files:**
- Create: `packages/agent/src/herald/poller.ts`
- Test: `packages/agent/tests/herald/poller.test.ts`

### Implementation

Polling state machine with adaptive intervals:

- `createPollerState()` — initial state (intervals, empty streak counter, last IDs)
- `getNextInterval(state)` — returns backed-off interval after 3 empty polls
- `pollMentions(state)` — read mentions, classify intents, emit events
- `pollDMs(state)` — read DMs
- `checkScheduledPosts()` — get approved/auto-approved posts, publish them
- `startPoller(state)` — starts mention/DM/scheduled timers with `.unref()`
- `stopPoller(state, timers)` — clears all intervals

Intervals: default from `HERALD_POLL_INTERVAL` env (default 600000ms = 10min). Backs off to 3x after 3 empty polls. Resets on results.

Budget integration: `pollMentions` skips if gate is `paused` or `dm-only`. `pollDMs` skips if `paused`.

### Tests (3)

1. createPollerState has correct defaults
2. getNextInterval backs off after 3 empty polls
3. getNextInterval resets after results

### Steps

- [ ] Write test → verify failure
- [ ] Implement poller.ts
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add adaptive poller — mentions, DMs, scheduled posts with backoff"`

---

## Task 10: Herald API Routes

**Files:**
- Create: `packages/agent/src/routes/herald-api.ts`
- Test: `packages/agent/tests/routes/herald-api.test.ts`

### Implementation

- `GET /api/herald` — returns `{ queue, budget, dms, recentPosts }` for HERALD dashboard tab
- `POST /api/herald/approve/:id` — approve/reject/edit queued posts

### Tests (4)

1. GET /api/herald returns queue + budget
2. POST approve → status approved
3. POST reject → status rejected
4. POST unknown ID → 404

### Steps

- [ ] Write test → verify failure
- [ ] Implement herald-api.ts
- [ ] Run tests → verify pass
- [ ] Commit: `git commit -m "feat: add HERALD API routes — dashboard data + post approval endpoints"`

---

## Task 11: Wire HERALD into index.ts + Integration Test

**Files:**
- Modify: `packages/agent/src/index.ts`
- Create: `packages/agent/tests/integration/herald.test.ts`

### Implementation

Add to index.ts:
- Import `heraldRouter` from `./routes/herald-api.js`
- Mount at `/api/herald`
- Conditionally start poller if X API credentials present

Integration test verifies:
1. HERALD has 9 tools
2. Intent classifier + budget tracker work together
3. Approval queue → publish flow
4. Poller state management

### Steps

- [ ] Write integration test (mock twitter-api-v2) → verify failure
- [ ] Update index.ts with HERALD route mount + conditional poller start
- [ ] Run integration test → verify pass
- [ ] Run full test suite → verify no regressions
- [ ] Commit: `git commit -m "feat: wire HERALD into Express — routes mounted, poller conditional start"`

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Install twitter-api-v2 | package.json | — |
| 2 | X API Client | herald/x-client.ts | 5 |
| 3 | Budget Tracker | herald/budget.ts | 7 |
| 4 | Read Tools (4) | herald/tools/read-*.ts | ~4 |
| 5 | Write Tools (5) | herald/tools/post-*,reply-*,like-*,send-*,schedule-*.ts | ~3 |
| 6 | Intent Classifier | herald/intent.ts | 7 |
| 7 | Approval Queue | herald/approval.ts | 5 |
| 8 | HERALD Factory | herald/herald.ts | 3 |
| 9 | Adaptive Poller | herald/poller.ts | 3 |
| 10 | Herald API Routes | routes/herald-api.ts | 4 |
| 11 | Wire + Integration | index.ts + integration/herald.test.ts | 4 |

**Total:** 11 tasks, ~11 commits, ~16 new files, ~11 test files
