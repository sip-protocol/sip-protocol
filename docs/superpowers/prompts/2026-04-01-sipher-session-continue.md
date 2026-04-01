# Sipher Session Continuation — Gap Fixes (Apr 1, 2026)

> **Paste this entire file as your first message in a new Claude Code session.**
> Working directory: `~/local-dev/sip-protocol`

---

## What Was Done (Previous Session)

### Plan A: sipher_vault Anchor Program — COMPLETE

Built and deployed the on-chain privacy vault program.

- **Repo:** `~/local-dev/sip-protocol/programs/sipher-vault/`
- **Program ID:** `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`
- **Config PDA:** `CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u`
- **Network:** Devnet (deployed + initialized: 10 bps fee, 86400s timeout)
- **Authority:** `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (shared devnet wallet)
- **Keypair:** `~/Documents/secret/sipher-vault-program-id.json`
- **Instructions (7):** initialize, create_vault_token, create_fee_token, deposit, withdraw_private, refund, collect_fee
- **Tests:** 14 passing, 1 pending (pause instruction deferred)
- **Commits:** `ca8e8d4` through `ca3a5a7` on sip-protocol main

### Plan B: Sipher Agent + SDK + UI — COMPLETE

Built Mode 1 (conversational privacy agent) and deployed to VPS.

- **Repo:** `~/local-dev/sipher/`
- **Live at:** https://sipher.sip-protocol.org
- **Packages:**
  - `packages/sdk/` — @sipher/sdk (vault ops, privacy ops, PDA derivation, real deserialization)
  - `packages/agent/` — Sipher agent (10 tools, Anthropic SDK via OpenRouter, Express server)
  - `app/` — Web chat UI (React 19, Vite, cypherpunk dark theme, Solana wallet adapter)
- **LLM:** OpenRouter (`SIPHER_OPENROUTER_API_KEY` env var), model `anthropic/claude-sonnet-4-6`
- **Docker:** Auto-deploy via GitHub Actions (push to main → GHCR → VPS)
- **Tests:** 97 agent + 71 SDK = 168 tests + 573 root REST API tests
- **Commits:** `f6ed2ff` through `fdfa9d1` on sipher main

### Gap Fixes (Partially Done — 3 of 5)

After comparing spec to implementation, wrote a gap fix plan at:
`docs/superpowers/plans/2026-04-01-sipher-gap-fixes.md`

| # | Task | Status |
|---|------|--------|
| 1 | Restore Mode 2 REST API alongside agent | ✅ Done — `src/app.ts` extracted, mounted via dynamic import |
| 2 | Wire wallet TX signing in UI | ✅ Done — `useTransactionSigner` hook, ConfirmationPrompt signs + broadcasts |
| 3 | Real privacy crypto in SDK | **TODO** — replace placeholder zero-fills with real @sip-protocol/sdk stealth + Pedersen |
| 4 | Add 4 missing Phase 1 tools | ✅ Done — swap, viewingKey, history, status (10/10 tools) |
| 5 | Chat streaming (SSE) | **TODO** — replace POST-wait with Server-Sent Events |

---

## What Needs to Be Done (This Session)

### Task 3: Real Privacy Crypto in SDK

**Priority:** Important — without this, private sends have zero-filled commitments on-chain (not actually private).

**What to do:**
1. Check `@sip-protocol/sdk` exports for: `generateStealthAddress`, `createPedersenCommitment`, `checkStealthAddress`
2. In `packages/sdk/src/privacy.ts` — replace placeholder crypto params in `buildPrivateSendTx` with real stealth address generation and Pedersen commitment creation
3. In `packages/sdk/src/privacy.ts` — update `scanForPayments` to use `checkStealthAddress` for matching events to the user's viewing key
4. Write tests in `packages/sdk/tests/privacy.test.ts`
5. Update agent tools `send.ts`, `scan.ts`, `claim.ts` to pass real crypto params

**Key challenge:** The `@sip-protocol/sdk` is installed as `^0.7.4` in the sipher workspace. Need to verify the exact function signatures — they may differ from what the plan assumes. Check: `grep -n "export function\|export async function" node_modules/@sip-protocol/sdk/src/stealth.ts`

**Plan file:** `docs/superpowers/plans/2026-04-01-sipher-gap-fixes.md` — Task 3

### Task 5: Chat Streaming (SSE)

**Priority:** Polish — current POST-wait works but feels slow for long agent responses.

**What to do:**
1. In `packages/agent/src/agent.ts` — add `chatStream` async generator using Anthropic SDK's `.stream()` method
2. In `packages/agent/src/index.ts` — add `POST /api/chat/stream` SSE endpoint
3. In `app/src/components/ChatContainer.tsx` — consume SSE stream, append tokens as they arrive
4. Fall back to POST if streaming fails

**Plan file:** `docs/superpowers/plans/2026-04-01-sipher-gap-fixes.md` — Task 5

---

## Key Architecture Context

```
sipher.sip-protocol.org (VPS, port 5006)
├── / ..................... Web chat UI (app/dist static files)
├── /api/chat ............ POST — Agent conversation (OpenRouter → Claude)
├── /api/health .......... GET — Agent health + tool list
├── /api/tools ........... GET — Tool schemas + system prompt
├── /api/tools/:name ..... POST — Direct tool execution
├── /v1/* ................ Mode 2 REST API (71 endpoints, mounted via src/app.ts)
└── /docs ................ Swagger UI
```

**Flow:** User connects Phantom wallet → chats with Sipher agent → agent calls tools → tools use @sipher/sdk → SDK builds unsigned TXs → UI deserializes + signs with wallet → broadcasts to Solana

**On-chain:** sipher_vault program (devnet) → PDA vault holds deposits → withdraw_private sends to stealth addresses → VaultWithdrawEvent emitted for scanning

---

## Files You'll Need to Read

**For Task 3 (crypto):**
- `~/local-dev/sipher/packages/sdk/src/privacy.ts` — current placeholder implementation
- `~/local-dev/sipher/packages/agent/src/tools/send.ts` — send tool calling SDK
- `~/local-dev/sipher/packages/agent/src/tools/scan.ts` — scan tool calling SDK
- `~/local-dev/sip-protocol/packages/sdk/src/stealth.ts` — real stealth functions
- `~/local-dev/sip-protocol/packages/sdk/src/crypto.ts` — real Pedersen functions

**For Task 5 (streaming):**
- `~/local-dev/sipher/packages/agent/src/agent.ts` — current chat() function
- `~/local-dev/sipher/packages/agent/src/index.ts` — Express server
- `~/local-dev/sipher/app/src/components/ChatContainer.tsx` — chat UI

---

## Execution Method

Use `superpowers:subagent-driven-development` to execute the remaining 2 tasks from:
`docs/superpowers/plans/2026-04-01-sipher-gap-fixes.md`

After both tasks, push and deploy (CI auto-deploys on push to main in sipher repo).

---

## Don't Forget

- **OpenRouter, not direct Anthropic:** Agent uses `https://openrouter.ai/api` as baseURL with Anthropic SDK
- **No AI attribution:** Never add Co-Authored-By or AI mentions in commits
- **Keypairs in `~/Documents/secret/`:** Plain JSON, iCloud encrypted, Bitwarden backup. No age encryption.
- **Pi SDK question still open:** Spec says Pi SDK, we used Anthropic SDK + OpenRouter. RECTOR is aware. Deferred decision.
