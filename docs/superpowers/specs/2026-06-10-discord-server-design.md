# SIP Protocol Discord Server — Design Spec

**Date:** 2026-06-10
**Author:** RECTOR + CIPHER
**Status:** Approved (brainstorm review passed — 3 chunks approved individually)
**Parent:** `2026-06-02-t3-superteam-growth-refresh-design.md` §A1 (T3 gate — bounty listings link to it)
**Prior art:** `2026-03-14-t3-superteam-growth-design.md` §Pillar 3 (channel skeleton + Discord-over-Discourse rationale)

---

## 1. Goal

Stand up the SIP Protocol community Discord — the T3 prerequisite that bounty listings, the website footer, and the GitHub org README link to. Success = server live with the locked structure, safety rails on, seed content posted, permanent invite wired into public surfaces, all reproducible from a committed script.

## 2. Locked Decisions (brainstorm, 2026-06-10)

| Decision | Choice |
|----------|--------|
| Language | **English-only** — no locale channels (revisit only if Indonesian chatter shows up organically) |
| Launch posture | **Public immediately** — links go live same day as setup; quiet-but-open beats delayed |
| Setup workflow | **Chrome-MCP cowork + API script** — CIPHER drives the browser in RECTOR's session for the human-gated steps, then a committed zero-dep script does the bulk via the Discord REST API |
| Community mode | **ON** (rules screening, welcome screen, native onboarding, announcement channels, insights) |
| Bot identity | **SIPHER** — durable application; one-shot setup today, becomes HERALD's Discord body in agent-swarm v2 |
| Moderator role | **Not yet** — solo founder; add when the first real mod appears |

## 3. Server Identity

- **Name:** SIP Protocol
- **Icon:** `.github/assets/logo-512.png` (uploaded via API `PATCH /guilds/{id}` base64 — avoids browser file-picker friction)
- **Banner / vanity URL:** out of scope (boost-gated)
- **Verification level:** Medium (email-verified + account ≥5 min old)
- **Default notifications:** mentions-only (server-wide blasts off)

## 4. Structure — Categories, Channels, Topics

10 channels = the 8 locked in the T3 spec + 2 required by Community mode (#rules, #mod-log).

| Category | Channel | Type | Access | Topic |
|----------|---------|------|--------|-------|
| 📌 START HERE | `#rules` | text (rules channel) | read-only | Read + accept to unlock the server. The team will NEVER DM you first. |
| 📌 START HERE | `#announcements` | **announcement** | read-only | Releases, milestones, bounty launches. Follow to mirror into your own server. |
| 📌 START HERE | `#resources` | text | read-only | Docs, SDK, app, blog — everything you need to build. |
| 💬 COMMUNITY | `#general` | text | open | Privacy, Solana, Web3, and everything SIP. |
| 💬 COMMUNITY | `#ideas` | text | open | Feature requests + use cases. The best ideas become issues (and bounties). |
| 🔧 DEVELOPMENT | `#dev-chat` | text | open | SDK questions, integration help. Share code, get unblocked. |
| 🔧 DEVELOPMENT | `#bug-reports` | text | open | Bugs → here or GitHub issues. Security vulns → SECURITY.md (private), never here. |
| 🏆 BOUNTIES | `#bounties` | text | open | Active Superteam Earn bounties, submissions, winners. |
| 🤖 MACHINE | `#bot-commands` | text | open | Bot playground. HERALD lands here in v2. |
| 🤖 MACHINE | `#mod-log` | text | **private** (Admin + SIPHER) | AutoMod flags + Discord community notices. Staff only. |

Community-mode bindings: `rules_channel_id` → #rules · `public_updates_channel_id` → #mod-log.

Rationale: START HERE front-loads orientation so a joiner's first screen isn't an empty #general; MACHINE sits last to keep bot noise out of the human flow. Growth slots are obvious without restructuring (e.g. #support forum under DEVELOPMENT, #showcase under COMMUNITY).

## 5. Roles & Permissions

| Role | Color | Hoisted | Granted | Permissions |
|------|-------|---------|---------|-------------|
| **Admin** | amber `#F59E0B` | yes | RECTOR (manual) | Administrator |
| **SIPHER** | slate `#64748B` | no | bot-invite (managed) | Administrator (own bot, own server; scope down later if v2 demands) |
| **Contributor** | purple `#8B5CF6` | yes | **earned** — manual, for merged PRs / real contributions | cosmetic |
| **Bounty Hunter** | teal `#14B8A6` | yes | self-assigned via onboarding | cosmetic |
| **Community** | grey-blue `#94A3B8` | no | default via onboarding | baseline |

Contributor is never self-assignable — it keeps signal value.

**Permission tiers** (category-level overwrites; channels inherit):

- `@everyone` server base: View Channels, Send Messages, Read History, Embed Links, Attach Files, Add Reactions, External Emoji, Create Invite, Use Application Commands. **Deny:** Mention @everyone/@here/all-roles.
- **Read-only tier** (START HERE category): deny Send for `@everyone`; Admin + SIPHER can post.
- **Private tier** (#mod-log): deny View for `@everyone`; allow Admin + SIPHER.

## 6. Safety (AutoMod & Anti-Scam)

Crypto Discords attract wallet-drainer bots within hours of going public. Rails, all configured by the script:

1. **AutoMod — spam preset:** ON (Discord-maintained).
2. **AutoMod — keyword presets:** slurs/sexual-content default lists ON.
3. **AutoMod — mention spam:** block messages with >5 unique mentions.
4. **AutoMod — custom keyword rule "wallet-drainer phrases":** block + alert to #mod-log. List: `free nitro`, `nitro giveaway`, `claim your airdrop`, `airdrop claim`, `connect your wallet`, `verify your wallet`, `wallet verification`, `validate your wallet`, `synchronize your wallet`, `dm me to claim`, `first come first serve`. **Exempt channels:** #dev-chat, #bug-reports (the phrases appear in legitimate technical discussion); exempt role: Admin.
5. **Verification level Medium** + **rules screening** (Community gate).
6. **Norms in #rules:** team never DMs first; no one from SIP ever asks to connect a wallet; vulnerability reports go to GitHub private reporting (SECURITY.md), never public channels.

## 7. Onboarding & Welcome Screen

- **Welcome screen** (4 recommended channels): #rules "Start here — accept to unlock", #general "Say salam 👋", #dev-chat "Get integration help", #bounties "Paid work, live soon".
- **Native onboarding** (no runtime bot needed): one required question — *"What brings you to SIP?"*
  - 🏆 Here for bounties → grants **Bounty Hunter**, adds #bounties
  - 🔧 Building with the SDK → grants **Community**, adds #dev-chat
  - 🔒 Exploring privacy → grants **Community**, adds #general
- **Onboarding default channels** (API constraint: ≥7 defaults, ≥5 sendable): rules, announcements, resources, general, ideas, dev-chat, bug-reports, bounties (8 defaults / 5 sendable ✓).

## 8. Seed Content (posted by SIPHER at setup)

**#rules** (also the screening text):
1. **Be respectful.** No harassment, hate speech, or personal attacks.
2. **No scams, spam, or shilling.** No unsolicited promo, no "DM me" bait. Wallet-drainer links = instant ban.
3. **English only** — so everyone can follow along.
4. **No financial advice.** SIP is privacy infrastructure; nobody here tells you what to buy.
5. **Security:** the team will NEVER DM you first and will NEVER ask you to connect a wallet or share keys. Report impersonators in #bug-reports.
6. **Vulnerabilities:** report privately via GitHub Security advisories (SECURITY.md) — never in public channels.

**#announcements** — launch post:
> **The SIP Protocol Discord is live** 🔒
> SIP (Shielded Intents Protocol) is the privacy standard for Web3 — stealth addresses, hidden amounts, viewing keys for compliance. One toggle to make transactions private.
> **Start here:**
> → What is your wallet leaking? https://app.sip-protocol.org/privacy-score
> → Build with the SDK: https://docs.sip-protocol.org
> → #dev-chat for integration help · #bounties for paid work (4 bounties launching on Superteam Earn)
> Your wallet is public. Let's fix that — welcome in.

**#resources** — pinned link block: website `sip-protocol.org` · app `app.sip-protocol.org` (+ `/privacy-score`) · docs `docs.sip-protocol.org` · SDK `npmjs.com/package/@sip-protocol/sdk` · GitHub `github.com/sip-protocol` · blog `blog.sip-protocol.org` · X `x.com/sipprotocol`.

**#bounties** — placeholder:
> 4 bounties are launching on Superteam Earn: **Write a Thread** · **Build a Privacy App with the SDK** · **Technical Deep-Dive** · **Bug Bounty**. Prizes + links land here — watch #announcements.

## 9. Architecture — Reproducible Setup (`.github` repo, `discord/` dir)

The core repo stays clean; org-level community config lives in the org-config repo. Public — contains no secrets.

```
.github/discord/
├── manifest.json   # declarative: settings, categories, channels (+topics/overwrites),
│                   # roles, automod rules, welcome screen, onboarding, seed messages
├── setup.js        # zero-dep Node ≥18 (global fetch). Reads DISCORD_BOT_TOKEN +
│                   # DISCORD_GUILD_ID from env. Reconciles manifest → live state:
│                   # create-if-missing (matched by name), update drifted topics/perms,
│                   # NEVER deletes unmanaged objects. Seed posts only into empty
│                   # channels (idempotent) + pins the rules/resources posts.
│                   # --plan flag = dry-run diff, no writes.
├── verify.js       # GET-only diff of live state vs manifest; non-zero exit on drift
└── README.md       # run instructions
```

- **Secrets:** `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` in `~/Documents/secret/.env` (auto-loaded by zshrc). Never committed.
- **Bot:** application **SIPHER**, scopes `bot` (+`applications.commands`), permission Administrator. REST-only — no gateway intents, no runtime process.
- **Icon:** script PATCHes guild icon from `assets/logo-512.png` (base64).
- **Invite:** script creates one permanent invite (`max_age=0, max_uses=0`) on **#general** and prints it — the canonical link for all wiring.
- **Community-mode caveat:** the script enables the `COMMUNITY` feature via `PATCH /guilds/{id}` after setting verification + rules/updates channels. If Discord rejects API enablement (owner-only guideline acceptance), fallback = CIPHER toggles it in Server Settings via Chrome MCP (~1 min), then re-runs the script.

## 10. Execution Flow (Chrome-MCP cowork)

| # | Step | Owner | Notes |
|---|------|-------|-------|
| 1 | Verify login + whether a "SIP Protocol" server already exists | CIPHER (Chrome) | discord.com/channels/@me in RECTOR's session |
| 2 | Create bare server (skip if exists) | CIPHER (Chrome) | "Create My Own → For a club or community", name only — icon comes via API |
| 3 | Create **SIPHER** app in the Developer Portal | CIPHER (Chrome) + **RECTOR clicks Create** | the Create button accepts Discord Developer ToS — RECTOR's click (or his explicit in-chat authorization) |
| 4 | Bot tab → Reset Token → store | CIPHER | token → `~/Documents/secret/.env`; shown once, captured immediately |
| 5 | Authorize bot into the server (OAuth) | **RECTOR clicks Authorize** (or explicit in-chat authorization) | OAuth grant = permission-gated action |
| 6 | `node setup.js --plan` then `node setup.js` | CIPHER | full structure + safety + content + invite |
| 7 | `node verify.js` + screenshot tour | CIPHER | GET-diff vs manifest; visual sanity pass |
| 8 | RECTOR eyeball + joins onboarding preview | RECTOR | ~2 min |
| 9 | Wire links (PRs) | CIPHER | see §11 |
| 10 | Update T3 report `[GATE]` Discord section, TRACKER.md, GRANTS.md, memory | CIPHER | |

## 11. Link Wiring (public same day)

| Surface | Change | Repo/PR |
|---------|--------|---------|
| Website footer | Discord icon + invite link | `sip-website` PR |
| GitHub org profile | Discord badge/link in README | `.github` PR (same PR as the `discord/` scripts is fine) |
| Bounty listings | Invite in every listing | at bounty launch (A3) |
| docs/blog footers | Optional, follow-up — not a T3 gate | — |

HERALD content tie-in: the next ecosystem-theme draft announces the Discord (X → Discord funnel both ways).

## 12. Verification

1. `verify.js` exits 0 (live state matches manifest).
2. Manual: fresh-eye walkthrough via onboarding preview; welcome screen renders; rules screening fires; AutoMod test (post `free nitro` in #general as non-admin → blocked + #mod-log alert) — test message deleted after.
3. Invite link resolves logged-out (incognito check).
4. Website footer + org README live links verified post-merge.

## 13. Out of Scope

- HERALD-as-Discord-bot runtime (agent-swarm v2 — the SIPHER app created here becomes its body)
- Vanity URL, banner art (boost-gated), scheduled events, Discord ads/promotion
- Moderator role (add at first real mod), locale channels (revisit on demand)

## 14. Open Items

- RECTOR: the two gated clicks (Developer-ToS Create, OAuth Authorize) — or explicit in-chat authorization for CIPHER to perform them in-session
- Superteam Indonesia seeding ping (RECTOR's network) — after links are live
