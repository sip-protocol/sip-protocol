# T3 Superteam Growth Phase — Design Spec

**Date:** 2026-03-14
**Author:** RECTOR + CIPHER
**Status:** Reviewed (spec review passed)
**Grant:** Superteam Indonesia / Solana Foundation ($10K USDC)
**Tranche:** T3 ($4,000) — "40% upon project completion"

---

## Problem Statement

T2 delivered all technical milestones but missed traction KPIs (119 X followers vs 500, 3 GitHub stars vs 60, 184 blog views vs 2,500). T3 must close these gaps through structured growth programs while continuing technical momentum (close M18, ship dApp Store approval, stretch toward M19).

**Core insight:** Solo founder can't scale marketing alone. Solution: bounty program (community-driven growth) + X agent (autonomous daily presence) + Discord (community home).

**Budget note:** Suggested bounty budget ($5,750) exceeds the T3 tranche ($4,000). RECTOR manages budgeting — bounties may be funded from multiple sources (tranche + hackathon winnings + personal). Budget numbers are suggestions, not constraints.

**Timeline note:** Grant deadline is dynamic per RECTOR. No hard Mar 31 cutoff. Implementation is sequenced by dependency, not calendar.

---

## Pillars

| # | Pillar | Goal |
|---|--------|------|
| 1 | **Bounty Program** | Community-driven growth via Superteam Earn |
| 2 | **X Agent** | Autonomous @sipprotocol presence (dedicated project) |
| 3 | **Discord** | Community home for developers + bounty participants |
| 4 | **Technical** | Close M18, dApp Store approval, stretch M19 |
| 5 | **Docs & Strategy** | Update roadmap/strategy to reflect T3 direction |

---

## Pillar 1: Bounty Program (Superteam Earn)

### Platform Research Summary

Superteam Earn supports 3 listing types: Bounty (competitive), Project (freelance), Grant. Key findings from analyzing 51 live bounties:

- Content bounties get 50-170+ submissions (high engagement)
- Code bounties get 1-10 submissions (low volume, high value)
- $500-$2,000 is the sweet spot for content bounties
- 3 prize tiers + bonus spots maximizes participation
- Human Only reduces spam; Agent Allowed increases volume
- Clear requirements + weighted judging criteria = quality submissions
- Global region outperforms restricted listings

### Required Fields per Bounty

| Field | Description |
|-------|-------------|
| title | 1-80 characters |
| description | Rich text — hook, context, task, requirements, judging, resources |
| type | `bounty` (competitive) |
| compensationType | `fixed` |
| token | USDC |
| rewardAmount | Total prize pool |
| rewards | JSON: position-based prizes (1st, 2nd, 3rd, bonus) |
| skills | From 8 categories, 69 sub-skills |
| region | Global |
| deadline | 2-4 weeks from publish |
| pocSocials | @sipprotocol (Twitter) |
| agentAccess | HUMAN_ONLY (content) or AGENT_ALLOWED (code) |

---

### Bounty #1: "Write a Thread About SIP Protocol"

**Purpose:** X followers, awareness, social proof
**Type:** Content | **Budget:** $1,000 USDC | **Deadline:** 2 weeks

| Position | Prize |
|----------|-------|
| 1st | $500 |
| 2nd | $300 |
| 3rd | $200 |

**Skills:** Content (Writing, Social Media), Growth (Digital Marketing)
**Agent Access:** Human Only
**Region:** Global

**Description:**

> **What is SIP Protocol?**
>
> SIP (Shielded Intents Protocol) is the privacy standard for Solana — stealth addresses, hidden amounts, and viewing keys for compliance. Think HTTPS for Web3. Live on mainnet, 11,100+ tests across 9 repositories, SDK on npm.
>
> **Your Task**
>
> Write a Twitter/X thread (minimum 6 tweets) explaining SIP Protocol to the Solana community. You can focus on:
> - Why privacy matters for Solana users
> - How stealth addresses work (vs mixer approach like Tornado Cash)
> - The developer experience (SDK integration in <10 lines)
> - SIP's compliance angle (viewing keys for institutions)
> - The Seeker mobile wallet for private payments
>
> **Requirements**
> 1. Follow @sipprotocol on X
> 2. Thread must be 6+ tweets with at least 2 visuals (screenshots, diagrams, or infographics)
> 3. Tag @sipprotocol in the first tweet
> 4. Must be original — AI-generated content will be disqualified
> 5. Submit your thread link on this listing
>
> **Judging Criteria**
> - Technical Accuracy: 30%
> - Clarity (explainable to non-crypto audience): 25%
> - Engagement (likes, RTs, replies): 25%
> - Visual Quality: 20%
>
> **Resources**
> - Website: https://sip-protocol.org
> - SDK: https://www.npmjs.com/package/@sip-protocol/sdk
> - Docs: https://docs.sip-protocol.org
> - Blog: https://blog.sip-protocol.org
> - App: https://app.sip-protocol.org
> - GitHub: https://github.com/sip-protocol/sip-protocol

---

### Bounty #2: "Build a Privacy App with SIP SDK"

**Purpose:** npm downloads, GitHub stars, real integrations
**Type:** Code | **Budget:** $2,500 USDC | **Deadline:** 3 weeks

| Position | Prize |
|----------|-------|
| 1st | $1,200 |
| 2nd | $800 |
| 3rd | $500 |

**Skills:** Frontend (React), Backend (TypeScript, Node.js), Blockchain (Rust)
**Agent Access:** Agent Allowed
**Region:** Global

**Description:**

> **Build something real with @sip-protocol/sdk**
>
> SIP Protocol provides privacy primitives for Solana: stealth addresses, Pedersen commitments, viewing keys, and private transfers. Your challenge: build a working application that uses the SDK.
>
> **Ideas (not limited to)**
> - Private tip jar (accept SOL/SPL tips to stealth addresses)
> - Shielded DAO treasury viewer (viewing key-based transparency)
> - Stealth payroll tool (batch private payments)
> - Privacy-first donation page
> - Stealth NFT transfer tool
> - Private OTC desk
>
> **Requirements**
> 1. Must use `@sip-protocol/sdk` (latest: v0.9.0)
> 2. Working demo (deployed URL or video walkthrough, max 5 min)
> 3. Public GitHub repo with README explaining setup
> 4. Must work on Solana devnet or mainnet
> 5. Submit: GitHub repo link + demo link/video
>
> **Judging Criteria**
> - Functionality: 30% (does it work end-to-end?)
> - Creativity: 25% (novel use of privacy primitives)
> - Code Quality: 25% (tests, clean code, documentation)
> - UX/Design: 20% (usable by non-technical users)
>
> **Resources**
> - SDK: `npm install @sip-protocol/sdk`
> - 14 example integrations: https://github.com/sip-protocol/sip-protocol/tree/main/examples
> - React hooks: `npm install @sip-protocol/react`
> - API docs: https://docs.sip-protocol.org
> - Solana program: `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`

---

### Bounty #3: "Write a Technical Deep-Dive"

**Purpose:** Blog views, SEO backlinks, npm downloads
**Type:** Content | **Budget:** $750 USDC | **Deadline:** 3 weeks

| Position | Prize |
|----------|-------|
| 1st | $400 |
| 2nd | $200 |
| 3rd | $150 |

**Skills:** Content (Writing, Research)
**Agent Access:** Human Only
**Region:** Global

**Description:**

> **Write a technical article about blockchain privacy using SIP Protocol**
>
> We're looking for well-researched articles (1,500+ words) published on dev.to, Hashnode, Medium, or your personal blog. Topics can include:
> - Stealth addresses vs mixer pools — technical comparison
> - How Pedersen commitments hide amounts on Solana
> - Building compliant privacy with viewing keys
> - SIP Protocol architecture deep-dive
> - Privacy on Solana vs Ethereum — state of the ecosystem
>
> **Requirements**
> 1. Minimum 1,500 words, technically accurate
> 2. Published on dev.to, Hashnode, Medium, or personal blog
> 3. Must include code snippets using @sip-protocol/sdk where relevant
> 4. Link to sip-protocol.org and GitHub repo
> 5. Share on X tagging @sipprotocol
> 6. Original content — AI-generated will be disqualified
> 7. Submit: article link + tweet link
>
> **Judging Criteria**
> - Technical Depth: 35%
> - Clarity & Readability: 30%
> - SEO Quality (title, structure, keywords): 20%
> - Social Reach: 15%
>
> **Resources**
> - Website: https://sip-protocol.org
> - Blog (reference): https://blog.sip-protocol.org
> - SDK docs: https://docs.sip-protocol.org
> - GitHub: https://github.com/sip-protocol/sip-protocol

---

### Bounty #4: "Bug Bounty — Find Issues in SIP Protocol"

**Purpose:** GitHub stars, code quality, external contributors
**Type:** Code | **Budget:** $1,500 USDC | **Deadline:** 4 weeks

| Position | Prize |
|----------|-------|
| 1st | $750 |
| 2nd | $400 |
| 3rd | $200 |
| Bonus (up to 3) | $50 each |

**Skills:** Backend (TypeScript), Blockchain (Rust, Solidity), Frontend (React)
**Agent Access:** Human Only
**Region:** Global

**Description:**

> **Help us harden SIP Protocol — find bugs, get paid**
>
> SIP Protocol has 11,100+ tests across 9 repos, but we want more eyes on the code. Find bugs, security issues, or developer experience problems.
>
> **Scope (all repos under github.com/sip-protocol)**
> - `sip-protocol/sip-protocol` — Core SDK + Solana program + EVM contracts (TypeScript, Rust, Solidity)
> - `sip-protocol/sip-app` — Production app (Next.js)
> - `sip-protocol/sip-mobile` — Seeker wallet (React Native)
> - `sip-protocol/sipher` — Privacy API (Express/TypeScript)
>
> **Severity & Rewards**
> - Critical (funds at risk, key leakage): Top prize
> - High (logic errors, broken flows): 2nd-3rd prize
> - Medium (UX bugs, edge cases): Bonus rewards
> - Low (typos, cosmetic): Acknowledged, not rewarded
>
> **Requirements**
> 1. Open a GitHub issue with reproduction steps
> 2. Label as `bug` + severity level
> 3. Include: expected vs actual behavior, environment, code references
> 4. One issue per submission (multiple submissions allowed)
> 5. Submit: GitHub issue link
>
> **Out of Scope**
> - Known issues (check existing GitHub issues first)
> - Spam or trivially obvious issues
> - Social engineering / phishing

---

### Bounty Launch Sequence

| Week | Bounty | Rationale |
|------|--------|-----------|
| 1 | #1 Thread + #4 Bug Bounty | Low barrier (thread) creates awareness; bug bounty runs longest |
| 2 | #3 Technical Deep-Dive | After threads create initial awareness |
| 3 | #2 Build with SDK | After content establishes context for developers |

**Total suggested budget: $5,750 USDC**

---

## Pillar 2: X Agent (Dedicated Project)

### Overview

Autonomous X agent for @sipprotocol — first member of the SIP agent team. Gets its own repo, spec, and implementation plan.

### Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Agent brain | Claude Agent SDK (TypeScript) | — |
| LLM provider | OpenRouter (Haiku for routine, Sonnet for content, Opus for planning) | ~$20-50/mo |
| X API | Pay-Per-Use ($0.01/post, $0.005/read) | ~$50-100/mo |
| GitHub API | @octokit/rest (free for public repos) | $0 |
| Memory | SQLite (local) or Turso (edge) | $0-5/mo |
| Scheduler | node-cron or system crontab | $0 |
| Deployment | VPS (reclabs3) or Railway/Fly.io | $0-10/mo |
| **Total** | | **~$100-200/mo** |

### API Constraints (Feb 2026 Policy)

| Action | Status | Constraint |
|--------|--------|-----------|
| Post original tweets/threads | Allowed | 100/15min, 2400/day |
| Reply when @sipprotocol mentioned/quoted | Allowed | Only reactive replies |
| Reply to arbitrary tweets | BLOCKED | Enterprise only (Feb 2026 crackdown) |
| Like tweets | Allowed (paid tier) | 1,000/day, 50/15min |
| Quote tweet | Allowed | Same as posting |
| Retweet | Allowed | 50/15min |
| Read mentions/timeline | Allowed (paid tier) | 300/15min |
| Search tweets | Allowed (paid tier) | 300/15min, 7-day history (Basic) |
| Auto-follow/unfollow | PROHIBITED | Instant suspension |
| Bot label in bio | MANDATORY | Must display "Automated" |

### Context Awareness — Data Sources

| Source | Data | Update Frequency |
|--------|------|-----------------|
| GitHub API (sip-protocol org) | Commits, PRs merged, issues, releases, star count | Every 6 hours |
| X API (mentions) | @sipprotocol mentions, quote tweets | Every 15 minutes |
| X API (own timeline) | Past posts, engagement metrics | Daily digest |
| Superteam Earn | Active bounties, submission counts, winners | Every 6 hours |
| Memory store | Post history, topic tracker, voice guide, learnings | Persistent |
| Strategy context | Roadmap, grants, milestones (static config) | Updated by RECTOR |

### Memory Management

| Memory Type | Content | Purpose |
|-------------|---------|---------|
| Post history | Every tweet: content, timestamp, engagement metrics, thread context | Avoid repetition, track what works |
| Topic tracker | Topics covered + recency score | Prevent covering same topic too frequently |
| GitHub digest | Daily summary of activity across all sip-protocol repos | Inform content about real progress |
| Bounty state | Active bounties, submissions, winners, deadlines | Amplify bounty program |
| Engagement learnings | Which post types perform best, optimal posting times, hashtag performance | Improve over time |
| Voice guide | SIP brand personality, tone rules, prohibited topics | Consistent brand voice |
| Conversation threads | Ongoing discussions the agent participates in | Don't drop context mid-conversation |

### Daily Cycle

```
1. INGEST  — Pull GitHub activity, X mentions, bounty updates
2. REFLECT — What happened since last post? What's newsworthy?
3. PLAN    — Select today's theme, draft content with full context
4. REVIEW  — Check against post history (no repeats), verify accuracy
5. POST    — Publish via X API
6. MONITOR — Track engagement, respond to mentions (when tagged)
7. LEARN   — Update memory with engagement results
```

### Weekly Content Calendar

| Day | Theme | Primary Source |
|-----|-------|---------------|
| Mon | SDK tip / code snippet | GitHub: recent commits, examples/ |
| Tue | Privacy explainer | Knowledge base, blog posts |
| Wed | Ecosystem / Solana news | X search: Solana + privacy topics |
| Thu | Bounty spotlight | Superteam: active bounties, submissions |
| Fri | Week in SIP recap | GitHub: week's commits, PRs, releases |
| Sat | Community highlight | Bounty winners, contributor shoutouts |
| Sun | Vision / roadmap teaser | Strategy context, upcoming milestones |

### GitHub Activity → Tweet Triggers

| Event | Agent Action |
|-------|-------------|
| New release (tag push) | Tweet: SDK v0.9.1 released — changelog highlights |
| Significant PR merged | Tweet: Shipped [feature] — 1-line summary |
| New external issue | Tweet: New contributor opened issue about [topic] |
| Star milestone (10, 25, 50, 100) | Tweet: [n] stars! Thanks for the support |
| Test count milestone | Tweet: 11,500+ tests passing across SIP ecosystem |
| Bounty submission | Tweet: New bounty submission for [name]! [n] entries |
| Bounty winner announced | Thread: spotlight winner's work |

### Interaction Rules

| Rule | Rationale |
|------|-----------|
| Max 5-8 posts/day (including replies) | Stay under spam detection |
| Only reply when @sipprotocol mentioned/quoted | Feb 2026 API restriction |
| Reply within 1hr during active hours (9am-9pm UTC) | Shows project is alive |
| Like relevant Solana privacy tweets (max 20/day) | Builds visibility safely |
| Quote RT with added value (max 2/day) | Shows thought, not just amplification |
| Never auto-follow/unfollow | Account suspension risk |
| Human review queue for sensitive topics | RECTOR reviews regulation/competitor posts |
| Bio states "Automated by SIP Labs" | Mandatory compliance |

### Weekly Planning Cycle

```
Sunday night (automated):
1. Pull week's GitHub activity digest
2. Pull X analytics (follower growth, top posts, engagement rate)
3. Pull bounty status updates
4. Agent drafts weekly content plan (7 themes + hooks)
5. RECTOR reviews Monday morning (approve/edit/reject queue)
6. Agent executes approved plan through the week
7. Friday: mid-week performance check, adjust remaining days
```

### Architecture — Future Agent Swarm

```
┌─────────────────────────────────────────────────────────────┐
│  RECTOR (Orchestrator / Human in the Loop)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ X Agent     │  │ Community   │  │ GitHub      │         │
│  │ (v1 — T3)   │  │ Agent (v2)  │  │ Triage (v3) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│  ┌──────┴────────────────┴────────────────┴──────┐          │
│  │           Shared Brain / Memory Layer          │          │
│  │  Project context, voice, strategy, activity log │          │
│  └────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

v1 (T3): X Agent only
v2 (Post-T3): Discord community manager agent
v3 (Future): GitHub triage, bounty tracker, analytics reporter

### Repo

- **New repo:** `sip-protocol/sip-agents`
- **Separate brainstorming → spec → plan cycle** (not implemented in this spec)

---

## Pillar 3: Discord

### Decision

Discord over Discourse. Rationale:
- Superteam ecosystem lives on Discord
- Zero infrastructure cost
- Dead forum looks worse than quiet Discord
- Mature bot ecosystem for agent integration
- Bounty coordination fits naturally in channels

### Channel Structure

```
SIP Protocol Discord
├── 📢 announcements        — Releases, milestones, bounty launches
├── 💬 general              — Community chat
├── 🔧 dev-chat             — SDK questions, integration help
├── 🏆 bounties             — Active bounties, submissions, winners
├── 🐛 bug-reports          — Bug bounty submissions (mirrors GitHub issues)
├── 💡 ideas                — Feature requests, use case discussions
├── 📖 resources            — Links to docs, blog, examples
└── 🤖 bot-commands         — Agent interactions (future)
```

### Setup Scope

- Create Discord server with channel structure
- Basic roles: Admin, Contributor, Bounty Hunter, Community
- Link in sip-protocol.org footer, GitHub README, bounty listings
- Invite Superteam Indonesia community
- Future: integrate X agent as Discord bot (v2)

---

## Pillar 4: Technical Deliverables

### 4A: Close M18 (Ethereum Same-Chain)

22/24 issues complete. Remaining:

| Issue | Task | Effort | Blocker |
|-------|------|--------|---------|
| #821 | zkSync Era deployment | Medium | Needs `foundry-zksync` toolchain |
| #824 | Blast + Mantle deployments | Low | Blast: bridge in transit. Mantle: MNT faucet |

**Action:** Complete these to mark M18 as done.

### 4B: dApp Store Approval (sip-mobile)

v0.2.3 rejected Mar 14 — 4th rejection. Awaiting reviewer response to email asking for specifics.

**Likely issue:** Zero-balance fresh install appearing non-functional.
**Strategy:** Iterate on reviewer feedback. Potential fixes: onboarding flow, demo mode, devnet faucet on first launch.

### 4C: Stretch — M19 Progress

Not a T3 commitment to Superteam. Internal push goal.

| Item | What | Impact |
|------|------|--------|
| Claim linkability research | Design pool PDA + ZK claim proof architecture | Privacy score ~30% → path to 80%+ |
| Proof of concept | Single stealth claim with ZK proof hiding the link | Technical validation |

### 4D: Roadmap & Strategy Updates

| Document | Update |
|----------|--------|
| `ROADMAP.md` | Add T3 growth phase, update M18 near-complete, add agent team initiative |
| `STRATEGY.md` | Add bounty strategy, agent team vision, realistic traction targets |
| `CLAUDE.md` | Update grant status, add Discord, add agent project reference |
| `ROADMAP.md` 2026 Targets | Replace "Discourse forum (500+ members)" with Discord community |

---

## Expected Impact

| Metric | Current | T3 Target | Primary Driver |
|--------|---------|-----------|---------------|
| X followers | 119 | 300+ | X agent daily content + thread bounty |
| GitHub stars | 3 | 50+ | Bug bounty + build bounty + community push |
| npm downloads/wk | ~500 | 1,000+ | Build bounty + tutorial content |
| Blog views/mo | 184 | 2,000+ | Deep-dive bounty SEO backlinks |
| Community | 0 | 50+ Discord members | Bounty participants + Superteam community |
| dApp Store | Rejected (v0.2.3) | Approved | Iterate on reviewer feedback |
| M18 | 22/24 | 24/24 | Close remaining L2 deployments |

---

## Implementation Order

1. **Discord setup** — Create server, channels, roles (prerequisite for bounty listings)
2. **Bounty #1 (Thread) + #4 (Bug Bounty)** — Launch on Superteam Earn
3. **X Agent spec** — Separate brainstorming → spec → plan (dedicated project)
4. **M18 close** — Finish remaining L2 deployments
5. **dApp Store iteration** — Act on reviewer feedback
6. **Bounty #3 (Deep-Dive)** — Launch week 2
7. **Bounty #2 (Build with SDK)** — Launch week 3
8. **Roadmap/Strategy updates** — Align docs with T3 direction
9. **M19 stretch** — If bandwidth allows after above

---

## Out of Scope

- X agent implementation (gets its own spec in `sip-agents` repo)
- Superteam Earn platform development (we use it as-is)
- Paid advertising or influencer partnerships
- Token launch or tokenomics design
- Form submission for T3 tranche (RECTOR does this after execution)
