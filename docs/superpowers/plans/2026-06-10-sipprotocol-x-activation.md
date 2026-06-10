# @sipprotocol X Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revive @sipprotocol as the SIP ecosystem's front gate — reposition the profile, run HERALD as a steady daily broadcaster, and close the HERALD content gap (ecosystem-wide "Week-in-SIP" digest) so the gate's content is real, not core-repo-only.

**Architecture:** Four parts. **Part 1** = manual X profile changes (RECTOR, ~5 min, no code). **Part 2** = one sipher PR (HERALD content fixes, TDD). **Part 3** = adopt the operational rhythm (the spec's playbook). **Part 4** = Phase 2 (reactive concierge) — trigger-gated, planned later, NOT built now.

**Tech Stack:** X (manual UI) · sipher `packages/agent` (TypeScript, Vitest, dependency-injected modules) · VPS Docker.

**Spec:** `docs/superpowers/specs/2026-06-10-sipprotocol-x-activation-design.md`

> **Repo note:** This plan lives in `sip-protocol`. **All code tasks (Part 2) execute in the `sipher` repo** (`~/local-dev/sipher`) — a separate branch + PR there. Part 1 is manual on x.com. GPG auto-signs commits; **no AI attribution** in commits/PRs.

---

## Part 1 — Phase 0: Reposition the profile (manual, RECTOR, ~5 min)

These are manual actions in the X web UI (HERALD has no profile-edit API). No tests/commits — each task ends in a visual verification. Do these first; they are the highest ROI and unblock the funnel immediately.

### Task A: Set the bio

**Where:** x.com → @sipprotocol → "Edit profile" → Bio.

- [ ] **Step 1: Replace the bio** with (X limit 160 chars):

```
Your wallet is public. SIP makes it private — stealth addresses, hidden amounts, viewing keys for compliance. The privacy standard for Web3. Run by @rz1989sol
```

- [ ] **Step 2: Verify** the field saved without truncation (X shows a red counter if over 160). If over, drop "for compliance" → "compliance".

### Task B: Repoint the website field to the front door

**Where:** Edit profile → Website.

- [ ] **Step 1: Set Website** to:

```
https://app.sip-protocol.org/privacy-score
```

- [ ] **Step 2: Verify** the link renders under the bio and resolves to the privacy-score analyzer (the funnel entrance), not the marketing site.

### Task C: Compose + pin the pinned tweet

- [ ] **Step 1: Post** this tweet (≤280 chars; the `app.sip-protocol.org/privacy-score` URL counts as 23):

```
Type any wallet address into a block explorer. Balance, every trade, who pays them — public forever.

SIP makes it private: one toggle hides sender, amount, recipient. Viewing keys keep it compliant.

See what your wallet leaks 👉 app.sip-protocol.org/privacy-score
```

- [ ] **Step 2: Pin it** — on the posted tweet, "More" (•••) → "Pin to your profile".
- [ ] **Step 3: Verify** the tweet shows a "Pinned" badge at the top of the profile and the link card previews the privacy-score page.

> *Note:* You may draft/post the pinned tweet through HERALD's pipeline instead, but pinning is still a manual UI step.

---

## Part 2 — sipher PR: HERALD content fixes (TDD)

**Execute in `~/local-dev/sipher`.** Test command for a single file: `pnpm --filter @sipher/agent exec vitest run <path>`. Typecheck: `pnpm --filter @sipher/agent run typecheck`.

- [ ] **Setup: branch from origin/main**

```bash
cd ~/local-dev/sipher
git fetch origin && git checkout -b feat/herald-ecosystem-content origin/main
```

### Task 1: Normalize the @sipprotocol handle in the content prompt

The system prompt hardcodes `@SipProtocol` (camel-case) twice; the live handle is `@sipprotocol`. Routing is case-insensitive, but rendered mentions should match the real handle.

**Files:**
- Modify: `packages/agent/src/herald/content/prompt.ts`
- Test: `packages/agent/tests/herald/content/prompt.test.ts`

- [ ] **Step 1: Write the failing test** — add inside `describe('content prompt', ...)`:

```typescript
  it('addresses the account by its canonical lowercase handle', () => {
    expect(HERALD_CONTENT_SYSTEM_PROMPT).toContain('@sipprotocol')
    expect(HERALD_CONTENT_SYSTEM_PROMPT).not.toContain('@SipProtocol')
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @sipher/agent exec vitest run tests/herald/content/prompt.test.ts`
Expected: FAIL — `not.toContain('@SipProtocol')` fails (current prompt contains it) and `toContain('@sipprotocol')` fails.

- [ ] **Step 3: Fix the prompt** — in `packages/agent/src/herald/content/prompt.ts`, change both occurrences of `@SipProtocol` to `@sipprotocol`. The two lines become:

```typescript
export const HERALD_CONTENT_SYSTEM_PROMPT = `You are HERALD, SIP Protocol's voice on X/Twitter. Confident, technical, cypherpunk — never corporate, never aggressive shilling. You speak for @sipprotocol, the privacy standard for Web3: stealth addresses, hidden amounts, and viewing keys for compliance.

You are drafting ONE original tweet. Output ONLY the tweet text — no preamble, no surrounding quotes, no "Here's a tweet:", no hashtag spam. Keep it under 280 characters. Use at most one mention (@sipprotocol) and at most two relevant emojis. Never include wallet addresses, amounts, or private keys.`
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @sipher/agent exec vitest run tests/herald/content/prompt.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/herald/content/prompt.ts packages/agent/tests/herald/content/prompt.test.ts
git commit -m "fix(herald): use canonical @sipprotocol handle in content prompt"
```

### Task 2a: Add multi-repo digest functions

Add ecosystem-wide digest helpers **without touching** the existing single-repo `fetchGitHubDigest`/`formatDigest` (keeps their tests green).

**Files:**
- Modify: `packages/agent/src/herald/content/github-digest.ts`
- Test: `packages/agent/tests/herald/content/github-digest.test.ts`

- [ ] **Step 1: Write the failing tests** — update the import line and append two `describe` blocks:

Change the import at the top of the test file to:

```typescript
import { fetchGitHubDigest, fetchGitHubDigests, formatDigest, formatDigests, DEFAULT_REPOS } from '../../../src/herald/content/github-digest.js'
```

Append:

```typescript
describe('fetchGitHubDigests (multi-repo)', () => {
  it('fetches one digest per repo in the list', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (/\/repos\/sip-protocol\/[^/]+$/.test(url)) return jsonResponse({ stargazers_count: 5 })
      if (url.includes('/commits')) return jsonResponse([{ commit: { message: 'feat: x' } }])
      if (url.includes('/pulls')) return jsonResponse([])
      if (url.includes('/releases')) return jsonResponse([])
      return jsonResponse(null, false)
    }))
    const digests = await fetchGitHubDigests(['sip-protocol', 'sip-app'])
    expect(digests).toHaveLength(2)
    expect(digests[0].repo).toBe('sip-protocol/sip-protocol')
    expect(digests[1].repo).toBe('sip-protocol/sip-app')
  })

  it('DEFAULT_REPOS covers the active public-facing repos', () => {
    expect(DEFAULT_REPOS).toContain('sip-protocol')
    expect(DEFAULT_REPOS).toContain('sip-app')
    expect(DEFAULT_REPOS).toContain('sipher')
  })
})

describe('formatDigests', () => {
  it('joins only repos that have activity', () => {
    const active = { repo: 'sip-protocol/sip-app', stars: 1, commits: ['feat: a'], mergedPRs: [], releases: [], errors: [] }
    const empty = { repo: 'sip-protocol/circuits', stars: 0, commits: [], mergedPRs: [], releases: [], errors: [] }
    const text = formatDigests([active, empty])
    expect(text).toContain('sip-protocol/sip-app')
    expect(text).not.toContain('circuits')
  })

  it('falls back when no repo has activity', () => {
    const empty = { repo: 'sip-protocol/circuits', stars: 0, commits: [], mergedPRs: [], releases: [], errors: [] }
    expect(formatDigests([empty])).toContain('no recent ecosystem activity')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @sipher/agent exec vitest run tests/herald/content/github-digest.test.ts`
Expected: FAIL — `fetchGitHubDigests`, `formatDigests`, `DEFAULT_REPOS` are not exported.

- [ ] **Step 3: Implement** — append to `packages/agent/src/herald/content/github-digest.ts` (after `formatDigest`):

```typescript
export const DEFAULT_REPOS = ['sip-protocol', 'sip-app', 'sip-mobile', 'sipher', 'docs-sip', 'blog-sip', 'circuits']

export async function fetchGitHubDigests(
  repos: string[] = DEFAULT_REPOS,
  owner = DEFAULT_OWNER,
): Promise<GitHubDigest[]> {
  return Promise.all(repos.map((r) => fetchGitHubDigest(owner, r)))
}

export function formatDigests(digests: GitHubDigest[]): string {
  const active = digests.filter((d) => d.releases.length || d.mergedPRs.length || d.commits.length)
  if (active.length === 0) return '(no recent ecosystem activity fetched)'
  return active.map(formatDigest).join('\n\n')
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @sipher/agent exec vitest run tests/herald/content/github-digest.test.ts`
Expected: PASS (original 3 + new 4).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/herald/content/github-digest.ts packages/agent/tests/herald/content/github-digest.test.ts
git commit -m "feat(herald): add multi-repo ecosystem digest helpers"
```

### Task 2b: Wire the cron to the multi-repo digest

Make `generateDailyContent` draw on the whole ecosystem instead of just the core repo.

**Files:**
- Modify: `packages/agent/src/herald/content/cron.ts`
- Test: `packages/agent/tests/herald/content/cron.test.ts`

- [ ] **Step 1: Update the test's deps** — in `packages/agent/tests/herald/content/cron.test.ts`, replace the two digest lines inside `makeDeps` (currently `fetchGitHubDigest`/`formatDigest`) with:

```typescript
    fetchGitHubDigests: vi.fn().mockResolvedValue([{ repo: 'sip-protocol/sip-protocol', stars: 1, commits: [], mergedPRs: [], releases: [], errors: [] }]),
    formatDigests: vi.fn().mockReturnValue('digest text'),
```

(The existing `'drafts and enqueues'` test still asserts `generateDraft` is called with `(theme, 'digest text')` — now sourced from `formatDigests`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @sipher/agent exec vitest run tests/herald/content/cron.test.ts`
Expected: FAIL — `DailyContentDeps` still requires `fetchGitHubDigest`/`formatDigest`; the new keys are surplus and the old required keys are missing (type error / runtime `deps.fetchGitHubDigest is not a function`).

- [ ] **Step 3: Rewire `cron.ts`** — apply three edits:

(a) Imports — change the github-digest import line to:

```typescript
import { fetchGitHubDigests, formatDigests } from './github-digest.js'
```

(b) `DailyContentDeps` — replace the two digest fields:

```typescript
  fetchGitHubDigests: typeof fetchGitHubDigests
  formatDigests: typeof formatDigests
```

and `defaultDeps` — replace the two entries:

```typescript
  fetchGitHubDigests,
  formatDigests,
```

(c) `generateDailyContent` — replace the two digest lines:

```typescript
  const digests = await deps.fetchGitHubDigests()
  const digestText = deps.formatDigests(digests)
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @sipher/agent exec vitest run tests/herald/content/cron.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @sipher/agent run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/herald/content/cron.ts packages/agent/tests/herald/content/cron.test.ts
git commit -m "feat(herald): draw daily content from the whole ecosystem, not just core"
```

### Task 3: Finalize the PR

- [ ] **Step 1: Run the full agent suite**

Run: `pnpm --filter @sipher/agent exec vitest run`
Expected: PASS (full suite green — ~1694+ tests; no regressions in herald/content).

- [ ] **Step 2: Push + open the PR**

```bash
git push -u origin feat/herald-ecosystem-content
gh pr create --title "feat(herald): ecosystem-wide content (multi-repo digest + canonical handle)" \
  --body "Closes the gate's content gap: Week-in-SIP now spans the whole org (sip-protocol, sip-app, sip-mobile, sipher, docs-sip, blog-sip, circuits) instead of core-only, and HERALD uses the canonical @sipprotocol handle. Part of the @sipprotocol activation roadmap."
```

- [ ] **Step 3:** RECTOR reviews + merges (`--merge --delete-branch`). Merge to main auto-deploys to the VPS.

---

## Part 3 — Phase 1: Adopt the operational rhythm

No code — these are habits + already-documented guidance (spec §6 playbook).

- [ ] **Daily (~5 min):** open Command Center → HeraldView (`sipher.sip-protocol.org` → admin) → review the pending draft against the voice rules → edit/approve/reject. `HERALD_AUTO_APPROVE_POSTS` stays OFF.
- [ ] **Manual headlines:** hand-craft the occasional milestone/launch/thread per the spec's manual-post guideline.
- [ ] **Weekly (~2 min):** glance at X analytics for the leading metrics (spec §8); monthly roll-up of tap-throughs → sip-app (via sip-umami referrer/UTM).
- [ ] **Optional:** mirror the spec's operational playbook (§6) into `sipher/docs/herald/` so it lives next to the engine.

---

## Part 4 — Phase 2: Reactive concierge (DEFERRED — trigger-gated)

**Do NOT build now.** Open only when ALL three hold (spec §5):

1. ~2–4 weeks of consistent Phase-1 posting, voice proven in production.
2. X API credits topped up.
3. The concierge routing map is built.

When the trigger fires, write a dedicated mini-plan for:

- **Concierge routing map (Gap 2):** a canonical *topic → destination* table wired into a **route-only** reactive path (`packages/agent/src/herald/intent.ts` + `adapters/x.ts`), with hard guardrails deferring deep technical/security questions to humans/docs.
- **Credit top-up:** fund the X API balance (currently $0.42; ~$0.015/post, $0.200 with a link).
- **Flip the flag:** `HERALD_REACTIVE_ENABLED=true` on the VPS `.env` + `docker compose up -d` (no redeploy; gate shipped in sipher #316).

---

## Self-Review

- **Spec coverage:** Phase 0 (bio/website/pin/casing) → Part 1 + Task 1. Phase 1 multi-repo digest → Tasks 2a/2b. Phase 1 ops (rhythm/manual/metrics) → Part 3. Phase 2 (routing map/credits/flag) → Part 4 (deferred per spec). Positioning/voice/funnel/metrics are design context, not code. ✅ All deliverables mapped.
- **Placeholders:** none — every code step shows complete code + exact commands + expected output.
- **Type consistency:** `fetchGitHubDigests`/`formatDigests`/`DEFAULT_REPOS` defined in Task 2a, consumed identically in Task 2b's `cron.ts` rewire and `makeDeps`. `GitHubDigest` shape reused verbatim from the existing module.
