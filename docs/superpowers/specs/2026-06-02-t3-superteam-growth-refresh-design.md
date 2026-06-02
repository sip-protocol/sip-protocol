# T3 Superteam Growth Phase — Refreshed Design Spec

**Date:** 2026-06-02
**Author:** RECTOR + CIPHER
**Status:** Approved (brainstorm review passed)
**Supersedes:** `2026-03-14-t3-superteam-growth-design.md` — re-scoped against verified June state
**Grant:** Superteam Indonesia / Solana Foundation ($10K USDC)
**Tranche:** T3 ($4,000) — final tranche, "40% upon project completion"
**Grant status:** T1 $3K (received Jan 30) + T2 $3K (received May 2) paid — **$6K of $10K received**

---

## Why a Refresh

The original T3 spec (Mar 14) defined five pillars but was never executed. A state
reconciliation on Jun 2 found the growth mandate essentially **unstarted** — while
building continued elsewhere (Frontier/Torque integration, SNS-stealth, the
VPS→Vercel migration). T3's grant purpose is *distribution and growth*, not more
building. This refresh re-scopes T3 against verified reality and locks the execution
decisions taken in the Jun 2 brainstorm.

### Verified state (Jun 2, 2026)

| Pillar | Mar 14 plan | Jun 2 verified state |
|--------|-------------|----------------------|
| 1. Bounties | 4 listings, not launched | ❌ None on Superteam Earn; no bounty links on the site |
| 2. X Agent | Build new `sip-agents` repo | 🟡 **HERALD built inside `sipher`**, dormant (last post May 12; 124 followers) |
| 3. Discord | Create server | ❌ Not live (only GitHub/X/npm in the website footer) |
| 4A. Close M18 | 22/24 | ❌ #821 (zkSync) + #824 (Blast/Mantle/Mode) still open |
| 4B. dApp Store | Rejected 4× | ❌ No store listing; sip-mobile releases stalled at v0.2.2 (Mar 9) |
| 4D. Docs | Update for T3 | ❌ ROADMAP untouched since Mar 14 (still "deadline Mar 31") |
| Traction (GitHub stars) | 3 → target 50+ | 🔴 **Still 3** |
| Traction (X followers) | 119 → target 300+ | 🔴 **124** (+5 in 2.5 months) |

**Core insight:** HERALD is a fully-built engine sitting switched off. The highest-leverage
T3 move is to *run the distribution machinery already built*, not build new machinery.

### Locked decisions (Jun 2 brainstorm)

1. **Ambition: Full push** — all five pillars in scope.
2. **X engine: operationalize HERALD in `sipher`** — no `sip-agents` repo. Reuse the
   existing agent + poller + approval/publish pipeline.
3. **HERALD posting mode: approval queue ON** — RECTOR approves each post before publish.
4. **Bounties: 4 listings** — prize amounts set by RECTOR at launch (not fixed here).
5. **Scope toggles — all IN:** dApp Store retry, M19 claim-privacy PoC, HERALD approval queue.
6. **Execution: Approach B (parallel tracks)** — growth (RECTOR-paced) and technical
   (agent-driven) run concurrently; they share no state (different repos).

---

## Goal & Success Metrics

**Goal:** Convert the finished technical build into *measurable traction* — the metrics
the T2 milestone report flagged as missed. Success is the engine demonstrably running with
metrics trending up, not necessarily every target hit.

| Metric | Now (Jun 2) | T3 Target | Primary driver |
|--------|-------------|-----------|----------------|
| X followers | 124 | 300+ | HERALD daily content + Thread bounty |
| GitHub stars | 3 | 50+ | Bug bounty + Build bounty + community |
| npm downloads/wk | ~500 | 1,000+ | Build bounty + tutorial content |
| Discord members | 0 | 50+ | Bounty participants + Superteam community |
| HERALD | dormant | live daily (approval-gated) | A2 below |
| M18 | 22/24 | 24/24 | B1 below |
| dApp Store | rejected (v0.2.x) | resubmitted (approval = stretch) | B2 below |

---

## Track A — Growth *(RECTOR-paced)*

### A1. Discord *(prerequisite — bounty listings link to it)*

- **Server + 8 channels:** `announcements`, `general`, `dev-chat`, `bounties`,
  `bug-reports`, `ideas`, `resources`, `bot-commands`.
- **Roles:** Admin, Contributor, Bounty Hunter, Community.
- **Linking:** website footer, GitHub org README, every bounty listing.
- **Seed:** invite the Superteam Indonesia community.
- **Out of scope (T3):** HERALD-as-Discord-bot (deferred to agent-swarm v2).

### A2. Operationalize HERALD *(engineering centerpiece)*

HERALD lives in `sipher` (`packages/agent/src/herald/`). The publish machinery exists;
the proactive content engine and live wiring do not.

**Current architecture — verified, REUSE as-is:**
- HERALD agent (Sonnet 4.6) with 9 tools: `readMentions`, `readDMs`, `searchPosts`,
  `readUserProfile`, `postTweet`, `replyTweet`, `likeTweet`, `sendDM`, `schedulePost`.
- **Poller** (`poller.ts`): 3 timers — mentions (adaptive backoff via recursive
  `setTimeout`), DMs (fixed interval), scheduled-posts (every 60s).
- **Publish pipeline:** `postTweet`/`schedulePost` → `herald_queue` → approval
  (`approval.js#getReadyToPublish`) → `checkScheduledPosts` → `publishTweet` (real X API)
  → `markPublished`. Emits `herald:post-published` / `herald:post-failed` on the guardian bus.
- **Safety:** budget gating (`getBudgetStatus` → `paused` / `dm-only` / `normal`),
  kill switch (`isKillSwitchActive`), SENTINEL coordination via `guardianBus`.
- **Approval UI:** `HeraldView` in the Command Center app.

**Gap to close — NEW work:**
1. **Daily content cron.** A scheduled trigger that, per the weekly content calendar,
   invokes HERALD (LLM) to *draft today's post* from real context, then enqueues it to
   the approval queue. (Today the poller only *reacts* to mentions/DMs and *publishes*
   already-queued posts — nothing proactively generates original content.)
2. **Context ingestion.** A GitHub activity digest (commits, PRs merged, releases, star
   count) plus current bounty state, feeding the content drafts so posts reference real
   shipped progress.
3. **Live wiring.** Generate **@sipprotocol's own X API OAuth credentials** (the app
   currently posts as a different user-context account), deploy to `sipher` prod with the
   poller running, and verify the draft → approve → publish path end-to-end on the real
   account.
4. **Close the reactive loop.** Confirm the path mention/DM → HERALD drafts a reply →
   `herald_queue` → approve → publish actually closes (the poller currently only *emits*
   intent events to the guardian bus).

**Weekly content calendar** (drives the daily cron):

| Day | Theme | Primary source |
|-----|-------|----------------|
| Mon | SDK tip / code snippet | GitHub: recent commits, `examples/` |
| Tue | Privacy explainer | Knowledge base, blog posts |
| Wed | Ecosystem / Solana news | X search: Solana + privacy |
| Thu | Bounty spotlight | Superteam: active bounties, submissions |
| Fri | Week in SIP recap | GitHub: week's commits/PRs/releases |
| Sat | Community highlight | Bounty winners, contributor shoutouts |
| Sun | Vision / roadmap teaser | Strategy context, upcoming milestones |

**Interaction rules (per Feb 2026 X API policy):** max 5–8 posts/day; reply only when
@sipprotocol is mentioned/quoted (arbitrary replies are Enterprise-only); never
auto-follow/unfollow (suspension risk); like ≤20 relevant tweets/day; quote-RT ≤2/day with
added value. **Bio must state automation** once HERALD drives the account.

**Mode:** approval queue ON — every post waits in `HeraldView` for RECTOR's approval before
`checkScheduledPosts` publishes it.

### A3. Bounties *(4 listings on Superteam Earn)*

Full listing copy (titles, descriptions, judging criteria, resources) is reused verbatim
from the original spec §Pillar 1 — `2026-03-14-t3-superteam-growth-design.md`.

| # | Bounty | Type | Purpose | Agent access |
|---|--------|------|---------|--------------|
| 1 | Write a Thread About SIP | Content | X followers, awareness | Human only |
| 2 | Build a Privacy App with SIP SDK | Code | npm downloads, stars, integrations | Agent allowed |
| 3 | Write a Technical Deep-Dive | Content | Blog views, SEO, npm | Human only |
| 4 | Bug Bounty — Find Issues | Code | Stars, code quality, contributors | Human only |

- **Prize amounts:** set by RECTOR at launch (the program total is RECTOR-managed; funded
  from tranche + winnings + personal as needed).
- **Launch sequence:** Discord live first → Thread + Bug Bounty → Deep-Dive → Build-with-SDK.
- **Amplification:** HERALD's Thursday "bounty spotlight" promotes active listings.

---

## Track B — Technical *(agent-driven, concurrent)*

### B1. Close M18 → 24/24
- **#821** — zkSync Era deployment (needs the `foundry-zksync` toolchain).
- **#824** — remaining long-tail L2 deployments (Blast, Mantle; confirm Mode status against
  the live deployment table during planning). Blockers: faucets / bridge in transit.

### B2. dApp Store retry (sip-mobile)
- **Diagnose** the 4th rejection. Likely cause: a zero-balance fresh install reads as
  non-functional to the reviewer.
- **Fixes** to evaluate: onboarding flow, demo mode, devnet faucet on first launch.
- **Resubmit** with a reviewer-facing walkthrough. (Store *approval* is a stretch — outside
  our control; the deliverable is a credible resubmission.)

### B3. M19 stretch — claim-privacy PoC
- Research + proof-of-concept for hiding the claim link: pool PDA + ZK claim proof
  architecture. Moves the privacy score from ~30% toward an 80%+ path.
- Not a grant requirement; pure technical moat. Lowest priority; runs only as bandwidth allows.

---

## Cross-cutting — Docs

| Document | Update |
|----------|--------|
| `ROADMAP.md` | Add T3 growth phase; mark M18 near-complete; add agent-team note; replace "Discourse forum (500+)" with Discord community |
| `STRATEGY.md` (private) | Bounty strategy, agent-team vision, realistic traction targets |
| `CLAUDE.md` | Grant status (T1+T2 paid, $6K/$10K), Discord, HERALD operationalized |

---

## Execution Model — Approach B (parallel tracks)

| Owner | Work |
|-------|------|
| **RECTOR (gated)** | Discord creation; bounty funding + publishing; **@sipprotocol X API credentials**; dApp Store reviewer interaction; HERALD post approvals; T3 form submission |
| **Agents (CIPHER + subagents)** | HERALD content-cron + GitHub ingestion code; M18 deployments; dApp Store fixes; M19 PoC; docs updates |

- The two tracks share no state (growth = `sipher` / Discord / Superteam Earn; technical =
  `sip-protocol` / `sip-mobile`) and run concurrently.
- Each agent unit ships its own PR.
- Technical wins (M18 closed, dApp resubmitted, releases) become HERALD content as they land.

---

## T3 Tranche Submission

- **Criteria:** submit the T3 milestone report once the machine is *demonstrably running*
  with metrics trending up — HERALD live and posting daily (approval-gated), Discord live,
  bounties launched, M18 closed. Not every numeric target must be hit; show the engine
  running + trajectory.
- **Owner:** RECTOR files the Superteam Earn tranche form (agents do not submit).

---

## Implementation Order / Dependencies

1. **Docs refresh** (fast; reflects direction; safe to do first).
2. **Discord** (prerequisite for bounty listings).
3. **HERALD operationalization** (content-cron + ingestion + live wiring + reactive loop).
4. **Bounties** (after Discord; HERALD amplifies once live).
5. **M18 close** — parallel, agent-driven, independent of the growth track.
6. **dApp Store retry** — parallel, agent-driven.
7. **M19 PoC** — parallel, bandwidth-permitting (lowest priority).

Critical path to traction: Discord → HERALD live → Bounties. Everything in Track B runs
alongside without blocking it.

---

## Decomposition for Implementation

This document is the **program-level design**. T3 spans multiple repositories and
independent workstreams, so it is **not** a single implementation plan — each workstream
gets its own plan → PRs cycle, sequenced/parallelized per the order above:

| Workstream | Repo | Type | First plan? |
|------------|------|------|-------------|
| A2. HERALD operationalization | `sipher` | Engineering (deepest) | **Yes — start here** |
| B1. Close M18 | `sip-protocol` | Deployments | Parallel |
| B2. dApp Store retry | `sip-mobile` | Mobile fixes | Parallel |
| B3. M19 PoC | `sip-protocol` | Research spike | Parallel (lowest priority) |
| Docs refresh | `sip-protocol` | Docs | Fast / first |
| A1. Discord · A3. Bounties | — | RECTOR-driven + content | Light plans |

**HERALD operationalization (A2)** is the engineering centerpiece and the right target for
the first implementation plan — its four new components (content-cron, context ingestion,
live wiring, reactive-loop verification) build on the existing `sipher` pipeline. The A2
detail above is sufficient to plan it directly; a focused sub-spec is optional, not required.

---

## Out of Scope

- HERALD-as-Discord-bot (agent-swarm v2).
- `sip-agents` repo extraction (deferred — operationalize in `sipher`; extract only if the
  swarm grows).
- Paid advertising, influencer partnerships, token launch / tokenomics.
- Superteam Earn platform development (used as-is).

---

## Open Items (RECTOR-driven, gate specific work)

- **Bounty prize amounts** — set at launch.
- **@sipprotocol X API OAuth credentials** — required before HERALD can post to the real account.
- **Discord server creation** — RECTOR creates; agents wire the links.
- **dApp Store reviewer thread** — RECTOR handles reviewer communication.
- **Bounty + program funding** — RECTOR-managed across sources.
