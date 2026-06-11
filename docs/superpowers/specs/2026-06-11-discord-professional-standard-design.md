# SIP Protocol Discord — Professional Standard (v1.5) — Design Spec

**Date:** 2026-06-11
**Author:** RECTOR + CIPHER
**Status:** Approved (brainstorm review passed — 3 chunks + 2 visual approvals via companion)
**Parent:** `2026-06-10-discord-server-design.md` (the live v1 server this upgrades)
**Context:** T3 Discord gate is already closed; this hardens how SIP *operates* the server — professional formatting, branded imagery, feeds, and a maintenance rulebook — before bounties (A3) drive traffic to it.

---

## 1. Goal

Every SIP-authored Discord post looks deliberate and branded; recurring content arrives automatically; the server's content is reconciled infrastructure-as-code like its structure already is; and a committed playbook tells future-us (and future mods) exactly how to run the server as it scales. Success = reskinned seeds live, `post.js` posting Components V2 messages from git-archived payloads, three feeds flowing, playbook merged.

## 2. Locked Decisions (brainstorm, 2026-06-11)

| Decision | Choice |
|----------|--------|
| Scope | All 4 pillars (playbook, asset pipeline, posting tooling, seed reskin) + activity feeds |
| Message format | **Components V2** (RECTOR picked from visual comparison) — bot-authored posts only; webhook-authored feeds use classic embeds (CV2 is bot-only) |
| Asset hosting | SVG sources + render tooling in `.github/discord/`; rendered banner PNGs served from `cdn-sip` (`cdn.sip-protocol.org/discord/…`) |
| HERALD cross-post | **Friday digest only** → #announcements (daily X content stays X-only; keeps the channel high-signal) |
| GitHub feed | Org-level webhook → new read-only `#github-feed`; releases + PRs + issues, **no pushes**. Covers npm releases for free (changesets creates GitHub Releases) |
| Drift cron | Weekly `verify.js` GitHub Action with bot token as Actions secret — trade-off accepted, rotation runbook in playbook |
| Role icons | Boost-L2-gated → encoded as a growth trigger, not faked with emoji-prefixed role names (renames would break match-by-name reconciliation) |
| Governance | Announcements fire only with RECTOR sign-off in-session; HERALD digest inherits HeraldView approval |

## 3. Message Format Standard

### 3.1 Anatomy (Components V2)

Every SIP-authored post is **one Container (type 17)** with `accent_color` by message type, flag `IS_COMPONENTS_V2` (`1<<15` = 32768; disables `content`/`embeds`). Inside, in order:

1. *(optional)* **Media Gallery (12)** — hero banner, top slot (the layout embeds can't do)
2. **Text Display (10)** — `### Title`
3. **Text Display (10)** — body markdown (links, bold, lists; ≤4000 chars/block)
4. **Separator (14)**
5. *(optional)* detail block — one of:
   - stacked bold lines in a Text Display (default): `**🧵 Write a Thread** — $1,000 — one-liner`
   - **2×2 Media Gallery of SVG-rendered cards** (bounty launches — CV2 has **no** embed-style field grid; the gallery grid is the native equivalent and reads better)
6. *(optional)* **Action Row (1)** of **link buttons (2, style 5)** — link buttons need no gateway/interaction handler; the toolkit stays zero-runtime
7. **Separator (14)**
8. **Text Display (10)** — subtext footer: `-# SIP Protocol · sip-protocol.org` (+ ` · seed:<key>` on managed seeds)

Limits respected by the renderer: ≤40 components/message, ≤4000 chars per Text Display.

### 3.2 Message types

| Type | Accent | Banner | Detail block | Destination | Notes |
|------|--------|--------|--------------|-------------|-------|
| `announcement` | SIP purple `#8b5cf6` | yes | optional | #announcements, auto-crosspost | milestones, launches; ≤2 organic/week |
| `release` | emerald `#10b981` | no | 3-bullet changelog | #announcements, auto-crosspost | compact; headline + docs button |
| `bounty` | amber `#f59e0b` | yes | prize cards (2×2 gallery) or stacked lines | #bounties (+ announcement on launch day) | deadline as `<t:unix:R>` |
| `security` | red `#ef4444` | **never** | action steps | #announcements, auto-crosspost | stark, undecorated, immediate |
| `digest` | indigo `#6366f1` | no | week's highlights | #announcements (webhook → classic embed, same accent) | HERALD Friday recap |

### 3.3 Webhook-authored content (classic embeds)

CV2 is unavailable to incoming webhooks, so feeds use embeds with the same accent colors: GitHub feed (Discord's native `/github` rendering), HERALD digest (indigo embed, username `HERALD`, logo avatar), drift alerts (red embed to #mod-log).

## 4. Architecture — What Lives Where

| Repo | Contents |
|------|----------|
| `sip-protocol/.github` → `discord/` | `PLAYBOOK.md` · `templates.js` (pure payload→CV2 renderer) · `post.js` · `posts/` (git-archived payloads) · extended `manifest.json` / `setup.js` / `verify.js` / `lib.js` · `assets-src/*.svg` + `fonts/` (Inter, JetBrains Mono — OFL, licenses included) · `render.js` + `package.json` (single devDependency `@resvg/resvg-js`) · `assets/emoji/*.png` (rendered, committed) · `.github/workflows/discord-drift.yml` |
| `sip-protocol/cdn-sip` → `discord/` | Rendered banner/card PNGs, content-versioned filenames (`bounty-launch.v1.png` — immutable 1y cache means new version = new filename, never replace in place) |
| `sip-protocol/sipher` | HERALD poller hook: Friday-digest X post success → POST Discord webhook |

Runtime tools (`setup.js`, `verify.js`, `post.js`) stay **zero-dependency** Node ≥18; the devDependency exists only for `render.js`.

## 5. Components

### 5.1 `post.js`

- `node discord/post.js posts/<YYYY-MM-DD-slug>.json [--plan]` — env `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID` (same as setup/verify).
- Payload schema: `{type, channel, title, body, banner?, cells?: [{name, value, note?}], cardImages?: [url], buttons?: [{label, url}], pin?: bool}`. Required per type enforced (e.g. `security` forbids `banner`; `bounty` requires `cells` or `cardImages`).
- Validation before any write: component/char limits; `banner`/`cardImages` URLs must be `https://cdn.sip-protocol.org/…`; button URLs allowlisted to `sip-protocol.org` (+subdomains), `github.com/sip-protocol`, `earn.superteam.fun`, `superteam.fun`, `npmjs.com`, `x.com/sipprotocol`, `discord.gg`. Unknown channel/type → actionable error naming valid options.
- `--plan` prints a readable preview (type, accent, component tree, char counts) and exits without writes.
- Posting: POST as SIPHER bot; if target channel is type 5 → auto-crosspost; `pin: true` → pin. 429s honored via shared API helper (extracted from `setup.js` if not already shared).
- Payloads live in `discord/posts/` → committed = permanent audit trail.

### 5.2 Seed reconciliation v2 (`setup.js`)

- Manifest `seeds` schema becomes `{key, channel, pin, payload}` — same payload schema as `post.js`, rendered by the same `templates.js`.
- Reconcile per seed: find bot-authored message in channel whose footer contains `seed:<key>` → missing: post + pin; present: render manifest payload, canonical-compare against live components, PATCH in place on drift.
- **Migration** of the 4 live plain-markdown seeds (no markers): one-time fallback matcher = oldest bot-authored message in the seed's channel → PATCH to CV2 + marker. **Implementation checkpoint:** probe in #mod-log first whether Discord accepts *adding* the CV2 flag on edit of an existing plain message; if rejected, fallback = delete + repost (channels are quiet; pin re-applied by the seed logic). The probe result decides the migration path; either is acceptable.
- `verify.js` adds: seed drift, emoji set, webhook presence checks.

### 5.3 Asset pipeline (`render.js`)

- `assets-src/` SVG house style (per approved mockup): dark gradient `#0c0a14 → #17102b → #2a1458`, purple radial glow, faint grid lines, shield mark, Inter (headlines) + JetBrains Mono (data), footer URL line.
- Sizes: banners 1200×400 rendered @2x (2400×800 PNG); bounty/prize cards 600×400 @2x; emoji 128×128.
- `render.js` (`@resvg/resvg-js`, bundled fonts) renders all of `assets-src/` → emoji PNGs into `discord/assets/emoji/`; banner/card PNGs into a local `out/` for manual copy to `cdn-sip/discord/`. Playbook documents the 3-step ship: edit SVG → `npm run render` → copy + push both repos.

### 5.4 Brand emoji set

10 manifest-managed emojis, created-if-missing by name (never deletes unmanaged): `sip_shield` `sip_stealth` `sip_viewkey` `sip_zk` `sip_commit` `sip_bounty` `sip_ship` `sip_gm` `sip_sol` `sip_eth`. **Implementation checkpoint:** RECTOR eyeballs rendered art before first upload.

### 5.5 Feeds

- **#github-feed** — new channel under MACHINE, read-only overwrite (deny Send for @everyone), topic set, *not* added to onboarding defaults. `setup.js` creates channel webhook `SIP GitHub` (logo avatar) if missing and prints the URL once → stored in `~/Documents/secret/.env` as `DISCORD_GITHUB_WEBHOOK_URL`. GitHub side: **org-level** webhook (`gh api orgs/sip-protocol/hooks`, needs `admin:org_hook` scope) → URL = channel webhook + `/github`, content-type `json`, events: `release`, `pull_request`, `issues`.
- **HERALD digest** — sipher PR (~30 lines + tests): in the poller, after a successful X post whose calendar slot is the Friday ecosystem digest, POST `DISCORD_ANNOUNCE_WEBHOOK_URL` with an indigo embed (username `HERALD`, logo avatar, link back to the X post). No-op when env unset; failures log and never propagate (the X post already succeeded). VPS: env add + redeploy.
- **Drift cron** — `.github/workflows/discord-drift.yml`: weekly (Mon 06:00 UTC) + `workflow_dispatch`; runs `verify.js` with repo secrets `DISCORD_BOT_TOKEN`/`DISCORD_GUILD_ID`; on drift → POST `DISCORD_MODLOG_WEBHOOK_URL` (red embed) + fail the run. **Accepted trade-off:** the Administrator bot token becomes an Actions secret in a public repo — fork PRs cannot read secrets and workflow edits require maintainer push; rotation runbook in playbook (reset in Dev Portal → update `.env` + Actions secret + VPS if applicable).

## 6. PLAYBOOK.md (outline)

1. **Voice & identity** — SIPHER posts via `post.js`; builder-to-builder, no hype, honest numbers; English only.
2. **Message standards** — §3 tables + discipline: ≤2 organic announcements/week; releases as shipped; security immediate + undecorated; deadlines as `<t:…:R>`; 1-2 brand emojis/post, never emoji walls; banners only on `announcement`/`bounty`.
3. **Posting workflow** — payload → `--plan` → RECTOR sign-off → post → commit payload. HERALD digest via HeraldView approval.
4. **Conventions** — thread-per-bounty in #bounties; pin hygiene ≤5/channel (rules + resources always pinned); Contributor stays earned; channels added only via trigger.
5. **Moderation runbook** — #mod-log alert handling; scam response (delete → ban → log); impersonation response; raid response (pause invites); advisory protocol.
6. **Growth triggers** — 50 members: first mod (Moderator role enters manifest) + #showcase · 100: #support forum + monthly dev-call event · 250: second mod + AutoMod audit + locale channels if organic demand · Boost L1: animated icon + splash · **L2: role icons + server banner** (assets-src ready) · L3: vanity URL. Thresholds are heuristics RECTOR tunes.
7. **Credential runbook** — secret inventory (`.env`, Actions secrets, VPS env), rotation steps, leak response.
8. **Gotchas appendix** — pointer to the Discord API gotchas learned in v1 setup.

## 7. Testing

- All renderable/plannable logic is pure and `node:test`-covered: `templates.js` (payload → component tree, one golden test per message type + limit/allowlist rejections), seed diff/migration matcher, emoji planner, webhook planner. Extends the existing 8-test suite.
- sipher: digest formatter + slot-filter unit tests (vitest, in-repo conventions).
- Executables stay thin I/O shells over the pure modules.

## 8. Verification

1. Extended `node:test` suite green; `pnpm`-equivalents in sipher green.
2. `verify.js` exit 0 including new checks (idempotent re-run of `setup.js` = empty plan).
3. `post.js --plan` golden previews for all 5 types.
4. E2E: one test post into private #mod-log, then deleted.
5. **Reskinned seeds live** — visible proof on the server; RECTOR eyeball tour.
6. GitHub feed renders on the next real org event; digest appears next Friday; drift cron green via manual dispatch.

## 9. Out of Scope (v2+)

- SIPHER gateway runtime (greeter, slash commands, LLM Q&A in #dev-chat) — this cycle stays zero-runtime by design.
- Boost-gated items themselves (encoded as triggers only); #showcase/#support until triggered; scheduled-event content; Discord discovery/ads.
- Retroactive reformatting of feed history; localization.

## 10. Ship Shape

| # | Deliverable | Repo |
|---|-------------|------|
| 1 | Toolkit v2: templates/post/seeds-v2/emoji/render/playbook/drift-workflow | `.github` PR |
| 2 | Rendered banner/card assets | `cdn-sip` PR |
| 3 | HERALD digest cross-post hook | `sipher` PR |
| 4 | GitHub org webhook + Actions secrets + VPS env | config (no PR) |

Order: 1 → 2 (assets referenced by seeds/posts) can interleave; 3/4 independent. T3 report Discord section gains the "professional operations" evidence after ship.
