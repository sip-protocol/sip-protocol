# @sipprotocol — X Account Activation & Maintenance Roadmap

**Status:** Design / Spec (approved 2026-06-10)
**Date:** 2026-06-10
**Owner:** RECTOR (@rz1989sol) — operated by **HERALD** (the sipher X agent)
**Phase context:** T3 Growth Phase — *distribution > building*
**Front gate:** [@sipprotocol](https://x.com/sipprotocol)

---

## 1. Purpose & Goal

Make **@sipprotocol** a genuinely active account, and give it a durable roadmap/playbook for staying that way.

The account's job is **narrative & mindshare** — but never for its own sake. Mindshare is the top of a funnel whose floor is **revenue**:

> Own the privacy conversation → drive people to the SIP apps → their private transactions pay protocol fees → SIP becomes profitable, not grant-dependent.

The X account does not make money. The **rails** do. SIP already charges **50 bps** on the deployed Solana program and EVM contracts (10 bps on the sipher vault) — the monetization is *already wired and idle*. The account's entire purpose is to **turn the volume on**.

Narrative is chosen as the apex goal because it subsumes the others: a strong narrative makes developers adopt, makes grant officers fund, and makes community gather. The one condition that makes it work: **narrative tethered to proof** — every vision claim rides on shipped evidence (a working SDK, a real week-in-SIP, a bounty that paid). Narrative is the headline; shipping is the byline that makes people believe it.

---

## 2. Positioning & Voice

**Identity (one-liner):** *@sipprotocol is the front gate to the SIP Protocol ecosystem — the account that teaches Web3 why on-chain privacy matters and walks people to the tools that deliver it.*

**Register — privacy educator with a wake-up hook.** Confident, technical, cypherpunk; never corporate, never aggressive shilling (this is HERALD's locked voice, defined in `packages/agent/src/herald/content/prompt.ts`). Every content arc follows the same shape:

```
jolt  →  teach  →  act
(you're   (how      (one tap at
exposed)  privacy   sip-app)
          works)
```

Pointed at the **surveillance status quo**, never at named rival projects. A measured contrarian note is allowed only when there is real news to react to — we earn "the standard" by being the most *useful* voice in the room, not by self-coronation.

**The gate concept.** @sipprotocol speaks for the *whole* ecosystem (SDK, apps, docs, circuits, bounties, grants) — not a Sipher megaphone. HERALD works the gate in both directions:

- **Outbound (broadcast, now):** draw people in with wake-up + education content.
- **Inbound (concierge, Phase 2):** greet arrivals and route them to the right door (docs / app / Discord / the relevant repo).

**Voice rules:**

| DO | DON'T |
|----|-------|
| Teach one concrete thing per post | Self-coronate ("we're THE standard" as a bare assertion) |
| Lead with human stakes ("your salary is public on-chain") | Hype without shipped proof |
| Back every claim with shipped evidence | Shill or beg for engagement |
| ≤280 chars, ≤1 mention, ≤2 emojis | Post addresses, amounts, or keys |
| Tag and credit collaborators | Pick fights with named competitors |

---

## 3. The Funnel (mindshare → usage → revenue)

```
Awareness  →  Education     →  Front door      →  Usage      →  Fee revenue
(wake-up)     (explainers /    (sip-app /          (private      (50 bps,
              SDK tips)        privacy-score)      tx)           already live)
```

**The X account owns Awareness → Front-door. sip-app owns Usage → Revenue.** The whole job is the *handoff* — getting the right person to tap through.

Content → funnel mapping:

- **Top (awareness):** wake-up posts — "here's what the chain reveals about you."
- **Middle (education):** the weekly calendar's Privacy-explainer / Vision / SDK-tip days.
- **Bottom (action):** every arc ends in a CTA to **sip-app** or the **privacy-score** analyzer; the Bounty + Ecosystem days pull **developers** — the volume multiplier (one integration reroutes a whole userbase's fee-paying traffic).

**Front door = sip-app** (`app.sip-protocol.org`), with the **privacy-score / wallet-surveillance analyzer** (`/privacy-score`) as the entry magnet — it is the wake-up and the funnel entrance in one. (sip-mobile is not yet in app stores, so it cannot be the public CTA.)

---

## 4. Current Baseline (observed live, 2026-06-10)

This is a **revival of a dormant-but-credible account**, not a cold launch.

| | |
|---|---|
| **Status** | ✅ Verified · joined **July 2021** · *Follows* @rz1989sol · **dormant** |
| **Followers** | **124** — incl. credible accounts (Quicknode, AgenticReserve, +7 RECTOR follows) |
| **Posts** | **47**, sporadic — last *original* post May 12; before that Mar 13, Feb 1 |
| **Profile** | Bio ✅ · avatar ✅ · banner ✅ · website (sip-protocol.org) ✅ · location "Earth" · **no pinned tweet** |
| **Bio today** | *"Privacy infrastructure for on-chain users. Stop broadcasting your positions. Managed by @rz1989sol"* |
| **Engagement** | Low — typical post 0–3 likes / 26–469 views. Content = hackathon wins + reposts of @rz1989sol + the odd "GM." |

**Implications:**

1. **Revive, don't rebuild.** Verification + an aged 2021 account + 124 credible followers is real equity — we reposition.
2. **The bio is already half-aligned** — "Stop broadcasting your positions" is the wake-up hook; we sharpen it and add a real CTA.
3. **Broadcasting to 124 at ~26 views won't build mindshare alone.** Consistency fixes credibility; *reach* needs engagement. This makes two things first-class: the **pinned tweet** (biggest quick win — prime, currently-empty real estate) and the **inbound concierge** (Phase 2).

---

## 5. Phases

### Phase 0 — Reposition the profile (one sitting, highest ROI)

- **Rewrite the bio** (candidate in Appendix; finalize together).
- **Repoint the website field** from `sip-protocol.org` (marketing) to the **front door** → `app.sip-protocol.org/privacy-score`, so the profile's one clickable link *is* the funnel entrance.
- **Compose + pin the pinned tweet** (candidate in Appendix) — the gate's permanent centerpiece (wake-up + front-door).
- **Normalize `@SipProtocol` → `@sipprotocol`** in `packages/agent/src/herald/content/prompt.ts` (cosmetic casing only; X routing is case-insensitive).
- Banner/avatar are already set — refresh only if off-brand.

*Execution note:* profile edits (bio, website field, pin) are **manual** in the X UI. The pinned tweet's *content* can be drafted/posted via HERALD, then pinned by hand (HERALD has no profile-edit API).

### Phase 1 — Steady broadcast (posture A — now, ongoing)

- **HERALD drafts ~1/day** from the existing weekly calendar (`packages/agent/src/herald/content/calendar.ts`):
  - Sun **Vision** · Mon **SDK tip** · Tue **Privacy explainer** · Wed **Ecosystem** · Thu **Bounty spotlight** · Fri **Week-in-SIP** · Sat **Community**.
- **Approval rhythm (~5 min/day):** RECTOR reviews the pending draft in the Command Center → HeraldView, edits/approves/rejects → publishes within ~60s. `HERALD_AUTO_APPROVE_POSTS` stays **OFF**.
- **Manual high-value posts:** RECTOR (HERALD-assisted) hand-crafts the occasional item too important for the daily cadence — grant wins, mainnet milestones, launches, threads. *The daily cron carries the baseline; RECTOR carries the headlines.*
- **Build item — multi-repo digest (Gap 1):** see §10.
- Guardrails already wired: kill-switch + budget cost-cap (`packages/agent/src/herald/budget.ts`).

### Phase 2 — Reactive concierge (posture B — trigger-gated, later)

**Opens only when all three are true:**

1. ~2–4 weeks of consistent Phase-1 posting, with the voice proven in production.
2. X API credits topped up (see §10).
3. The concierge routing map is built (Gap 2).

**Scope = route-only.** Welcome arrivals and answer "where do I…?" by pointing to docs / app / Discord / the right repo. **Never** freestyle deep technical or security answers — those route to humans/docs. *A concierge knows which door to open, not the whole building.* This keeps the correctness bar (raised by speaking for the whole ecosystem) safely met.

**Flip:** set `HERALD_REACTIVE_ENABLED=true` on the VPS `.env` + `docker compose up -d` (no redeploy needed). The reactive gate is already shipped (sipher #316).

---

## 6. Operational Playbook

**HERALD architecture (already in production).** HERALD starts only when X credentials are present, then has two outward paths with different safety:

1. **Proactive content** (`herald/content/cron.ts`) → drafts → `herald_queue` approval queue → RECTOR approves in HeraldView → poller publishes. Human-gated. Flag: `HERALD_CONTENT_CRON_ENABLED`.
2. **Reactive replies** (`adapters/x.ts`) → auto-post, no approval. Gated OFF by `HERALD_REACTIVE_ENABLED` (Phase 2 only).

**Daily rhythm (the 5 minutes):**
1. Open Command Center → HeraldView (`sipher.sip-protocol.org` → admin).
2. Read today's draft against the voice rules (§2).
3. Edit if needed → approve (publishes in ~60s) or reject (skip the day).
4. Once/week, glance at X analytics for the metrics in §8.

**Manual-post guideline — hand-craft when the moment is bigger than a daily tweet:** mainnet/milestone news, grant wins, launches, a timely take on privacy/surveillance news, or a thread. Otherwise let HERALD carry it.

**Posting constraints (enforced by HERALD):** ≤280 chars, ≤1 mention, ≤2 emojis, no addresses/amounts/keys.

---

## 7. Growth & Engagement *(realistic for low-touch A, 124 base)*

At ~5 min/day into 124 followers, growth compounds slowly — so we lean on levers that cost almost no extra time:

1. **Consistency itself** — daily presence from a dormant account is the single biggest lever; HERALD delivers it for free.
2. **The pinned tweet as a permanent funnel** — every profile visit hits the wake-up + CTA.
3. **Tag-and-credit, never shill** — Ecosystem/Bounty/Community posts tag relevant accounts (Solana, Quicknode, partners, integrators, bounty winners). Each tag is a discovery surface + likely repost.
4. **Ride real news** — a timely manual take on a privacy/surveillance story or a SIP milestone outperforms any scheduled post.
5. **Cross-pollinate** — @rz1989sol ↔ @sipprotocol reposts for milestones (the bio already links them); borrow RECTOR's personal reach to seed the protocol account.

**Rooms to be in:** Solana privacy/infra accounts, existing credible followers (Quicknode, AgenticReserve), Superteam, privacy-adjacent (Zcash et al.), grant/bounty ecosystems.
**Hashtags:** sparingly — `#Solana`, `#privacy`, event tags when relevant.

---

## 8. Metrics *(conversion-oriented, measurable via sip-umami)*

**Leading (steer weekly):**
- Follower growth *from the 124 baseline* (direction, not vanity).
- Pinned-link clicks & profile visits (X analytics).
- **privacy-score visits referred from X** (sip-umami referrer / UTM) — the funnel's first real conversion.
- Engagement *rate* per post (interactions ÷ views), not raw counts.
- Posting consistency (~7 posts/week).

**Lagging (the real goal, monthly/quarterly):**
- X tap-throughs → sip-app sessions → **private transactions → fee volume (50 bps)** — the money line.
- Developer signals: SDK installs, integration inquiries, bounty participation (the multiplier).

**We do NOT chase:** vanity follower counts · viral one-offs that don't convert · engagement-bait. *Mindshare that doesn't move tap-throughs is theater.*

**Honest expectation:** from 124 followers / ~26-view posts, month-1 success = **consistency + a working, measurable funnel**, not big numbers. Compounding arrives with Phase 2 + manual engagement. Tracking = a weekly glance (inside the 5-min rhythm) + a monthly roll-up; don't over-instrument.

---

## 9. Deliverables

The implementation plan will sequence these.

**Phase 0 (now):**
- [ ] Finalize + set the bio.
- [ ] Repoint the website field → `app.sip-protocol.org/privacy-score`.
- [ ] Compose + pin the pinned tweet.
- [ ] Normalize `@SipProtocol` → `@sipprotocol` in `prompt.ts`.

**Phase 1 (ongoing):**
- [ ] Multi-repo GitHub digest (Gap 1 — code, in sipher).
- [ ] Establish the daily approval rhythm in HeraldView.
- [ ] Document the manual-post guideline.
- [ ] Weekly metrics glance.
- [ ] (Optional) UTM tags on bio/pinned links for clean sip-umami attribution.

**Phase 2 (trigger-gated, later):**
- [ ] Build the concierge routing map (Gap 2).
- [ ] Top up X API credits.
- [ ] Flip `HERALD_REACTIVE_ENABLED=true`.

---

## 10. Build Items / Code Changes (the two gaps)

The gate vision exposed two gaps between what HERALD does today and what the roadmap needs.

### Gap 1 — "Week in SIP" digest is core-repo-blind *(Phase 1)*

`packages/agent/src/herald/content/github-digest.ts` digests only `sip-protocol/sip-protocol` (`DEFAULT_OWNER`/`DEFAULT_REPO`). So Week-in-SIP misses sip-app, sip-mobile, sipher, docs, blog, circuits — most of the ecosystem.

`fetchGitHubDigest(owner, repo)` is already parameterized, so the fix is a clean extension: iterate a configured list of active org repos and merge their digests (then de-duplicate / cap for the prompt). Suggested initial repo set (the active, public-facing ones): `sip-protocol`, `sip-app`, `sip-mobile`, `sipher`, `docs-sip`, `blog-sip`, `circuits` — finalize the list during implementation. This makes the ecosystem-gate content *real* rather than aspirational.

### Gap 2 — Reactive HERALD has no concierge routing map *(Phase 2)*

`packages/agent/src/herald/intent.ts` classifies inbound as command/question/engagement/spam, but its "command" intents are all *Sipher vault tools* (deposit, swap, scan…). There is no ecosystem **routing map** that says "want the SDK? → docs; want to go private now? → app; want to build? → Discord/bounties."

Phase 2 requires building that canonical *topic → destination* table and wiring it into the route-only concierge, with hard guardrails that defer deep technical and security questions to humans/docs.

---

## Appendix — candidate copy *(finalize in Phase 0)*

**Bio** *(X limit 160 chars):*

> Your wallet is public. SIP makes it private — stealth addresses, hidden amounts, viewing keys for compliance. The privacy standard for Web3. Run by @rz1989sol

**Pinned tweet** *(≤280 chars; wake-up + front-door):*

> Type any wallet address into a block explorer. Balance, every trade, who pays them — public forever.
>
> SIP makes it private: one toggle hides sender, amount, recipient. Viewing keys keep it compliant.
>
> See what your wallet leaks 👉 app.sip-protocol.org/privacy-score

---

## Cross-references

- HERALD content engine: `sipher/packages/agent/src/herald/content/` (`calendar.ts`, `prompt.ts`, `cron.ts`, `generator.ts`, `github-digest.ts`).
- HERALD reactive: `sipher/packages/agent/src/herald/` (`poller.ts`, `intent.ts`, `adapters/x.ts`).
- Reactive gate: sipher #316 (`HERALD_REACTIVE_ENABLED`).
- Front door: sip-app `/privacy-score`, `app.sip-protocol.org`.
- Analytics: sip-umami, `analytics.sip-protocol.org`.
