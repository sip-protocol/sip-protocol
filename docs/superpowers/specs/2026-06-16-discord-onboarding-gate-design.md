# Discord Onboarding Gate + Tiered Roles — Design

**Date:** 2026-06-16
**Status:** Approved (brainstorm) — pending implementation plan
**Spec lives in:** `sip-protocol/docs/superpowers/specs/` (convention; the `.github` Discord README points here)
**Implementation lands in:** `sip-protocol/.github` repo, `discord/` (infra-as-code) + a new `discord/worker/` (Cloudflare Worker)
**Related specs:** `2026-06-10-discord-server-design.md`, `2026-06-11-discord-professional-standard-design.md`

---

## 1. Summary

Turn the SIP Protocol Discord into a **gated, day-one-active** community. A new member lands with access to only `#rules` + `#introductions`. To unlock the server they must submit a **structured introduction** (a Discord modal: who they are, why they're here, what they're building). On submit, a **stateless Cloudflare Worker** auto-grants the unlock role and posts a clean intro card — no moderator in the loop. Roles are restructured into a **contribution-earned tier ladder**.

**Goal (RECTOR's words):** "A new user becomes active and starts from day one" — the introduction forces a first interaction before access, so nobody lurks silently.

## 2. Current state (what exists)

The Discord is already a mature infra-as-code system in `.github/discord/`, reconciled from `manifest.json` by `setup.js` (idempotent, drift-checked by `verify.js`), with a Components-V2 post standard (`templates.js`/`post.js`), AutoMod (spam, mention-raid, wallet-drainer phrases), seeded pinned content, brand emojis, and GitHub/HERALD/Ops webhooks. Posting uses the **bot token** (`api.js`), not incoming webhooks.

**Today's roles (flat, 4):** `Admin`, `Contributor` (earned via merged PR), `Bounty Hunter`, `Community` (default).
**Today's entry:** native Discord onboarding prompt ("What brings you to SIP?", 3 options) auto-assigns `Community`/`Bounty Hunter` at join + a welcome screen + rules screening. **No introduction is required and access is not gated.**

## 3. Goals & non-goals

**Goals**
- Hard-gate the server behind a required, structured self-introduction.
- Auto-grant the unlock role on intro submit — fully automatic, no manual mod approval.
- Restructure roles into a contribution-earned tier ladder.
- Stay within the project's ethos: pure-SIPHER (no third-party bot), infra-as-code, no always-on process, English-only, privacy-respecting.

**Non-goals (this iteration)**
- Activity/XP leveling (explicitly rejected — would need a third-party bot or always-on tracker).
- Perk-gated channels per tier (deferred to growth triggers; tiers are status-only now).
- GitHub→Discord identity linking for auto-`Contributor` (noted as a clean future add).
- The self-assign notification panel (designed as a phase-2 reuse of the Worker, not built in v1).

## 4. Role hierarchy (tiered, contribution-earned)

Declared in `manifest.json`. Empty hoisted roles do not render a sidebar group until someone holds one, so declaring the full ladder now just makes the structure ready.

| Role | Kind | Hoist | Grant mechanism | Notes |
|------|------|-------|-----------------|-------|
| 🛡️ `Admin` | Staff | yes | manual | Existing. Administrator. |
| 🧹 `Moderator` | Staff | yes | manual (you, when recruited) | New. Permission intent: kick, ban, timeout (moderate members), manage messages, manage threads, view audit log. Exact bitfield computed in implementation. |
| ⚙️ `Core` | Earned tier | yes | admin-granted | New. Sustained maintainer / deeply trusted. Status only (perms `0`). |
| 💻 `Contributor` | Earned tier | yes | mod-granted on merged PR | Existing. GitHub auto-grant is a future add. Status only. |
| 🔨 `Builder` | Earned tier | yes | mod-granted on recognition | New. Actively building with the SDK / sustained help in `#dev-chat`. Status only. |
| 🔓 `Community` | Entry tier | no | **auto (intro gate)** | Existing, repurposed as the **unlock role**. Base perms `0`; channel access comes from overwrites (§5). |
| 🌱 `OG` | Status | yes | batch-granted (manual) | New. First wave of members. One-time tenure badge; cutoff is RECTOR's call (e.g. first 50–100), not automated. |
| 💎 `Server Booster` | Status | — | Discord-managed | Not declared (Discord auto-creates). Optional styling later. |
| 🏆 `Bounty Hunter` | Self-assign tag | yes | self-assign (phase 2) | Existing. No longer an *entry path*; becomes an interest tag. |

**The climbable ladder a normal member sees:** `Community` (verified) → `Builder` → `Contributor` → `Core`. Earned by building, never self-assigned (per PLAYBOOK §4). Manual granting = **zero extra infra** beyond the intro-gate Worker.

**Role ordering constraint:** the SIPHER integration (managed bot) role MUST sit **above** `Community` in the role list, or the Worker's role grant returns `403`. `setup.js`/`verify.js` assert this ordering.

## 5. The gate (channel permissions — strict)

`VIEW_CHANNEL = 1024`, `SEND_MESSAGES = 2048`.

**Unverified (`@everyone`) sees ONLY `#rules` + `#introductions`.** Everything else is hidden until they hold `Community`.

Channel/overwrite deltas (expressed in `manifest.json` `overwrites`):

| Channel | `@everyone` | `Community` |
|---------|-------------|-------------|
| `#rules` | view ✓ (send already denied) | inherits |
| `#introductions` | **view ✓, send ✗** (deny `2048`) | view ✓ |
| `#announcements`, `#resources` | **deny view** (`1024`) | **allow view** (`1024`) |
| `#general`, `#ideas`, `#dev-chat`, `#bug-reports`, `#bounties`, `#bot-commands` | **deny view** (`1024`) | **allow view** (`1024`) |
| `#github-feed` | **deny view** (`1024`) — was visible read-only, now gated | **allow view** (`1024`) |
| `#mod-log` | already staff-only (view denied) | no change (stays staff-only — Community does *not* get view) |

`#introductions` is **send-denied for everyone** — members interact only via the button, so the channel stays a clean wall of bot-rendered intro cards. The bot (Administrator) posts the cards via interaction responses, bypassing the send-deny.

**New channel:** `#introductions` in the `📌 START HERE` category, positioned right after `#rules`.

## 6. Onboarding retirement (why)

Discord's native Server Onboarding **cannot coexist with a 2-channel hard gate**: enabling onboarding ties a minimum set of `@everyone`-visible default channels to the feature (the two modes literally "count Default Channels toward constraints" — practical minimum ~7 visible / ~5 sendable; `setup.js` already wraps the onboarding `PUT` in a try/catch because the team hit these minimums).

**Resolution:** retire the native onboarding prompt (`PUT /guilds/{id}/onboarding` with `enabled: false`, prompt removed). **Kept:** rules-screening (membership screening) and the welcome-screen splash — neither conflicts with the permission gate. The "what brings you to SIP" intent is captured *better* by the written introduction.

## 7. The intro flow (UX)

1. Member joins → accepts rules (membership screening).
2. Lands on `#introductions` (the only door besides `#rules`).
3. The pinned **gate card** shows an **"Introduce yourself"** button.
4. Click → a **modal** opens with four fields (§8).
5. Submit → server unlocks instantly + a public **intro card** welcomes them in `#introductions`.
6. They're now `Community` — full access, already on record, active on day one.

## 8. The Cloudflare Worker (interaction handling)

Stateless `fetch` handler. **Every request: verify Ed25519 first** (`X-Signature-Ed25519` + `X-Signature-Timestamp` over the raw body, against the app public key, via WebCrypto `Ed25519`). Invalid → `401`.

Routes by interaction `type`:

**Type 1 — `PING`** → respond `{ type: 1 }` (PONG). Used by Discord to validate the endpoint and for health pings.

**Type 3 — `MESSAGE_COMPONENT`, `custom_id: sip_intro`** → respond `{ type: 9, data: <modal> }`:
- `custom_id: sip_intro_modal`, title "Introduce yourself to SIP"
- 4 text inputs (each in its own action row):

  | id | label | style | required | min | max |
  |----|-------|-------|----------|-----|-----|
  | `handle` | Name / handle | short (1) | yes | 2 | 50 |
  | `who` | Who are you? | paragraph (2) | yes | 15 | 300 |
  | `why` | Why SIP — what brings you here? | paragraph (2) | yes | 20 | 300 |
  | `building` | What are you building / interested in? | paragraph (2) | no | 0 | 300 |

**Type 5 — `MODAL_SUBMIT`, `custom_id: sip_intro_modal`**:
1. **Idempotency:** the submit payload carries `member.roles`. If it already includes `Community` → respond ephemeral "You're already in 🎉" and stop. No grant, no duplicate card, no extra API call.
2. **Validate + sanitize** the four fields (§9). On rejection → respond ephemeral with the specific reason; no grant, no card.
3. **Grant:** `PUT /guilds/{GUILD}/members/{user}/roles/{COMMUNITY_ROLE_ID}` (awaited), `X-Audit-Log-Reason: SIP intro gate`.
4. **On success** → respond `{ type: 4, data: <public intro card> }` (Components-V2, SIP accent) — posted into `#introductions`. The card IS the response (no second hot-path call). `allowed_mentions: { parse: [], users: [userId] }` → pings only the new member, suppresses everything else.
5. **On grant failure** (e.g. `403` hierarchy) → respond `{ type: 4, flags: 64 }` ephemeral error ("Couldn't unlock automatically — ping a mod") + `POST` a note to `#mod-log` via the Ops webhook.

**Timing:** one awaited role-`PUT` + one response — comfortably inside Discord's 3-second deadline. If telemetry ever shows timeouts, the documented hardening lever is a **deferred** response (type 5 DEFERRED → follow-up); v1 is inline.

**Why fully automatic + stateless:** the button lives in a persistent bot-posted message; Discord pushes every interaction to the Worker; the Worker holds no cross-request state; the bot-token secret authorizes the grant. No always-on process, no mod in the loop.

## 9. Anti-abuse & security

**Primary surface — scam content in the intro card.** Because the Worker posts the card via the bot, keyword AutoMod does not reliably scan it. The Worker therefore **sanitizes server-side, before posting** (non-negotiable):

- `allowed_mentions: { parse: [], users: [joinerId] }` — `@everyone`/role/other-user pings can never fire.
- **Reject URLs** in any field (intros need no links): reject on `http`, `://`, `discord.gg`, `t.me`, `www.`, or domain-like patterns → ephemeral "links aren't allowed in your intro."
- **Drainer-phrase filter** reusing the manifest wallet-drainer keyword list → reject + `#mod-log` log.
- **Escape markdown** in user text (backticks/fences, `#` headings, `*_~|>`) so it renders literally — no faking an "official"-looking card; strip raw `@`, `<@`, `<#`, `<@&` tokens.
- **Trim + non-whitespace length re-check** server-side — modal `min_length` is client-only and untrusted.
- **Length caps** re-enforced server-side.

**Other vectors**
- **Gate bypass:** impossible — a grant fires only on a valid Ed25519-signed `sip_intro_modal`; unforgeable without Discord's key.
- **Verified actor spams a member channel:** that is AutoMod's job (spam/mention-raid/drainer rules cover member channels). The gate is a **quality/friction filter, not an anti-spam shield** — AutoMod remains the spam defense.
- **Mass-join raid:** the gate *helps* — raiders are contained in rules+intro until they pass the modal; the friction slows automation. PLAYBOOK §5 raid runbook still applies.

**Privacy (on-brand):** the modal asks who/why/building only — all voluntary and public-by-design. No PII, no wallet, no email. A privacy protocol does not hoover data on its own doorstep.

## 10. Edge cases & failure modes

- **Role hierarchy misconfig** → grant `403`. Mitigated by §4 ordering assertion in `setup.js`/`verify.js`; Worker degrades gracefully (ephemeral + log).
- **Worker unreachable / Discord can't reach endpoint** → user sees "interaction failed", retries; button persists, no state lost (Workers ~100% uptime).
- **Leave & rejoin** → loses `Community`, re-gated, re-introduces; old card left in place (harmless).
- **Double-submit / re-click** → idempotency check makes it a no-op.
- **Whitespace-only fields** passing `min_length` via spaces → server-side trim + non-whitespace re-check rejects.
- **3-second deadline** under slow Discord API → inline is fast; deferred-response is the documented fallback.

## 11. Code layout & changes

In the `.github` repo, beside `manifest.json` (one Discord home):

```
discord/
  worker/                  # NEW — Cloudflare Worker
    src/index.js           # fetch handler: verify sig → route PING / button / modal-submit
    src/verify.js          # Ed25519 verification (WebCrypto)
    src/sanitize.js        # pure: field validation + URL/mention/drainer/markdown sanitization
    src/render-intro.js    # pure: modal builder + public intro CV2 card builder
    src/discord.js         # tiny REST helper (role grant, modlog post) — bot token
    wrangler.toml          # name, route/workers.dev, plain vars; secrets via `wrangler secret put`
    test/                  # node --test (or vitest): sanitize, render-intro, verify, handlers (mocked fetch)
    package.json
  templates.js             # EXTEND: interactive (custom_id) button support
  manifest.json            # EXTEND: #introductions channel; strict perm overwrites; retire onboarding;
                           #         intro-gate seed (interactive button); new roles (Moderator/Builder/Core/OG)
  setup.js / lib.js        # EXTEND: render interactive-button seed; disable onboarding; assert role hierarchy
  PLAYBOOK.md              # EXTEND: "onboarding gate" + "granting earned tiers" subsections
```

**`templates.js` button extension (precise):**
- `render()`: per button — if `b.url` → `{ type: 2, style: 5, label, url }` (unchanged); else if `b.custom_id` → `{ type: 2, style: b.style ?? 1, label, custom_id }`.
- `validatePayload()`: a button needs `label` AND (`url` XOR `custom_id`); `url` → `checkUrl`; `custom_id` → match `^[a-z0-9_]+$`.
- `normalizeComponents()`: add `if (c.custom_id !== undefined) out.custom_id = c.custom_id` so seed drift-compare stays canonical.

**Intro-gate seed (manifest `seeds[]`):**
```json
{
  "key": "intro-gate",
  "channel": "introductions",
  "pin": true,
  "payload": {
    "type": "announcement",
    "channel": "introductions",
    "title": "Introduce yourself to unlock SIP Protocol 👋",
    "body": "New here? Tell us who you are and why you're here — you'll get instant access to the whole server.\n\nNo wallet. No email. Just a hello. Click below to introduce yourself.",
    "buttons": [{ "label": "Introduce yourself", "custom_id": "sip_intro" }]
  }
}
```

## 12. Secrets & config

Worker secrets (`wrangler secret put`, never in git):
- `DISCORD_BOT_TOKEN` — reused (the role grant + modlog post).
- `DISCORD_PUBLIC_KEY` — app public key (signature verification).
- `DISCORD_MODLOG_WEBHOOK_URL` — reused (failure logging).

Plain vars (`wrangler.toml`): `DISCORD_GUILD_ID`, `COMMUNITY_ROLE_ID`, `INTRO_CHANNEL_ID` — or resolved by name at cold start via one cached REST GET. IDs are printed by `setup.js` for convenience.

## 13. Testing strategy

Matches the repo's `node --test` discipline; **80%+ coverage on new code**. Pure tests dominate:
- `sanitize.test`: URL rejection, drainer-phrase rejection, mention/markdown escaping, whitespace-only rejection, length caps, happy path.
- `render-intro.test`: modal shape (4 inputs, types, min/max, required), public-card CV2 shape + accent + `allowed_mentions` empty-parse.
- `verify.test`: valid vs tampered signature (known Ed25519 test vectors).
- `handlers.test` (mocked `fetch`): PING→PONG; button→modal(type 9); modal-submit happy path (grant `PUT` called + type-4 card); idempotent (already-`Community` → ephemeral, no grant); grant-failure → ephemeral + modlog post.
- `templates.test.js`: extend for custom_id button render + normalize.
- Existing `lib.test.js` / `templates.test.js` keep passing.

## 14. Deploy sequence

Order matters — the endpoint must be live before Discord validates it.
1. `wrangler deploy` the Worker → obtain its URL.
2. Set the **Interactions Endpoint URL** in the SIPHER app (Discord Dev Portal) → Discord sends a PING; Worker must verify-sig + PONG or Discord rejects it. *(One-time, RECTOR — behind app settings/MFA.)*
3. `node discord/setup.js --plan` → review → apply: creates `#introductions`, applies the strict permission lock, retires onboarding, adds the new roles, seeds the intro-gate card.
4. **Alt-account smoke test:** join → gated to rules+intro → click → modal → submit → unlocked + card posted; re-click (idempotent); a deliberately bad input (URL) → rejected.
5. `node discord/verify.js` → drift clean. Commit the intro-gate seed payload (audit trail) + Worker code + manifest.

**Ongoing ops:** Worker deploys via `wrangler` (manual, or a `.github` Action mirroring the existing drift cron). Drift CI unchanged.

## 15. Acceptance criteria

- A fresh account joining sees **only** `#rules` + `#introductions`; all other channels hidden.
- Clicking "Introduce yourself" opens the 4-field modal; submitting a valid intro **auto-grants `Community`** and posts a sanitized public intro card pinging only the joiner — with **no moderator action**.
- An intro containing a URL or a drainer phrase is **rejected** (ephemeral), no role granted, no card posted.
- Re-submitting after already being `Community` is a **no-op** (ephemeral "already in").
- Invalid Ed25519 signatures get `401`.
- `node discord/verify.js` reports **no drift** after `setup.js`.
- New unit tests pass at **80%+** coverage on new code; the existing suite stays green.
- Native onboarding is disabled; rules-screening + welcome screen still function.

## 16. Future enhancements (out of scope here)

- **Self-assign notification panel** (phase 2): reuse the Worker — a button/select panel post-unlock for `Bounty Hunter` + notify opt-ins (Releases/Events).
- **GitHub → `Contributor` auto-grant**: link Discord↔GitHub identity (OAuth) and grant on merged PR.
- **Per-tier perk channels** + **role icons** (Boost L2) — attach at growth triggers.

---

*Authored during brainstorming session `stgrants_T3_27`. Implementation plan to follow via writing-plans.*
