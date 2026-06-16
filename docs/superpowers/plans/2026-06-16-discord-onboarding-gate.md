# Discord Onboarding Gate + Tiered Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the SIP Discord behind a required structured self-introduction that a stateless Cloudflare Worker auto-rewards with the unlock role, and restructure roles into a contribution-earned tier ladder.

**Architecture:** Infra-as-code changes (`manifest.json` + `setup.js`) restructure roles, flip `@everyone` base permissions to hide all but `#rules`/`#introductions`, retire native onboarding, and seed an interactive "Introduce yourself" button. A new Cloudflare Worker (`discord/worker/`) receives the button → opens a modal → on submit validates/sanitizes input, grants the `Community` role via REST, and replies with a public Components-V2 intro card. Signature verification uses Discord's official `discord-interactions` `verifyKey`.

**Tech Stack:** Node.js (CommonJS toolkit + ESM Worker), `discord-interactions`, Cloudflare Workers (`wrangler`), `node --test`, Discord REST API v10.

**Implementation repo:** `sip-protocol/.github` (clone: `/Users/rector/local-dev/sip-dot-github`). This plan + spec live in `sip-protocol/docs/superpowers/` per convention. All file paths below are relative to the `.github` repo root unless absolute.

**Spec:** `sip-protocol/docs/superpowers/specs/2026-06-16-discord-onboarding-gate-design.md`

**Planning refinements vs spec (intentional, same acceptance criteria):**
1. **Gate** uses a base-permission flip (remove VIEW from `@everyone`, grant VIEW to `Community`, explicitly allow VIEW on `#rules`+`#introductions`, deny `Community` on `#mod-log`) instead of per-channel deny/allow on 10 channels. Cleaner; identical end-state (unverified see only rules+intro; Community sees all but mod-log).
2. **Signature verification** uses `discord-interactions` `verifyKey` (Discord's canonical edge approach) — no hand-rolled WebCrypto `verify.js`. Verification correctness is delegated to the library (battle-tested) and exercised end-to-end by Discord's live PING at deploy; our unit tests cover routing/sanitize/render.

**Prerequisites (one-time, RECTOR — outside this plan):** the SIPHER app's **public key** (Dev Portal → General Information) and a Cloudflare account for `wrangler`. The bot token + modlog webhook URL already exist in `~/Documents/secret/.env`.

**File map**
- Modify: `discord/templates.js` (interactive button), `discord/manifest.json` (roles, gate, onboarding, seed, welcome), `discord/setup.js` (disable-onboarding branch), `discord/test/templates.test.js`, `discord/PLAYBOOK.md`
- Create: `discord/worker/{package.json,wrangler.toml}`, `discord/worker/src/{sanitize.js,render-intro.js,discord.js,index.js}`, `discord/worker/test/{sanitize.test.js,render-intro.test.js,discord.test.js,handlers.test.js}`

---

## Task 1: `templates.js` — interactive (custom_id) button support

The seed renderer currently emits only link buttons (`style: 5, url`). The intro-gate seed needs an interactive button (`custom_id`, no URL) so its clicks route to the Worker.

**Files:**
- Modify: `discord/templates.js` (`validatePayload`, `render`, `normalizeComponents`)
- Test: `discord/test/templates.test.js`

- [ ] **Step 1: Write failing tests** — append to `discord/test/templates.test.js`:

```js
const { test } = require('node:test')
const assert = require('node:assert')
const { validatePayload, render, normalizeComponents } = require('../templates.js')

test('validatePayload accepts an interactive (custom_id) button', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Introduce yourself', custom_id: 'sip_intro' }] }
  assert.deepStrictEqual(validatePayload(p).errors, [])
})

test('validatePayload rejects a bad custom_id', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Go', custom_id: 'Bad ID!' }] }
  assert.ok(validatePayload(p).errors.some(e => e.includes('custom_id')))
})

test('validatePayload rejects a button with both url and custom_id', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Go', custom_id: 'sip_intro', url: 'https://sip-protocol.org' }] }
  assert.ok(validatePayload(p).errors.some(e => e.includes('both')))
})

test('render emits a primary custom_id button', () => {
  const p = { type: 'announcement', channel: 'introductions', title: 'Hi', body: 'x'.repeat(20),
    buttons: [{ label: 'Introduce yourself', custom_id: 'sip_intro' }] }
  const row = render(p).components[0].components.find(c => c.type === 1)
  assert.deepStrictEqual(row.components[0], { type: 2, style: 1, label: 'Introduce yourself', custom_id: 'sip_intro' })
})

test('normalizeComponents preserves custom_id', () => {
  const norm = normalizeComponents([{ type: 2, style: 1, label: 'x', custom_id: 'sip_intro' }])
  assert.strictEqual(norm[0].custom_id, 'sip_intro')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord && node --test test/templates.test.js`
Expected: FAIL (the 5 new tests — current renderer ignores `custom_id`, `validatePayload` requires `url`).

- [ ] **Step 3: Implement** — in `discord/templates.js`:

In `validatePayload`, replace the button loop:
```js
  for (const b of buttons) {
    if (!b.label) { errors.push('every button needs a label'); continue }
    if (b.custom_id) {
      if (b.url) errors.push('button cannot have both custom_id and url')
      if (!/^[a-z0-9_]+$/.test(b.custom_id)) errors.push(`button custom_id must match ^[a-z0-9_]+$ (got ${b.custom_id})`)
      continue
    }
    if (!b.url) { errors.push('every button needs url or custom_id'); continue }
    const e = checkUrl(b.url); if (e) errors.push(`${e} (allowlist: ${[...BUTTON_HOSTS].join(', ')})`)
  }
```

In `render`, replace the buttons block:
```js
  if (p.buttons?.length) {
    inner.push({ type: 1, components: p.buttons.map(b => (
      b.custom_id
        ? { type: 2, style: b.style ?? 1, label: b.label, custom_id: b.custom_id }
        : { type: 2, style: 5, label: b.label, url: b.url }
    )) })
  }
```

In `normalizeComponents`, add after the `out.url` line:
```js
    if (c.custom_id !== undefined) out.custom_id = c.custom_id
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord && node --test test/templates.test.js`
Expected: PASS (all, including existing tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/templates.js discord/test/templates.test.js
git commit -S -m "feat(discord): support interactive custom_id buttons in CV2 renderer"
```

---

## Task 2: `manifest.json` — tier roles + Community view permission

**Files:**
- Modify: `discord/manifest.json` (`roles` array)

- [ ] **Step 1: Verify the Moderator permission bitfield**

Run:
```bash
node -e 'const P={KICK:1n<<1n,BAN:1n<<2n,AUDIT:1n<<7n,MSGS:1n<<13n,NICKS:1n<<27n,THREADS:1n<<34n,TIMEOUT:1n<<40n};console.log((P.KICK|P.BAN|P.AUDIT|P.MSGS|P.NICKS|P.THREADS|P.TIMEOUT).toString())'
```
Expected: `1116825723014`

- [ ] **Step 2: Replace the `roles` array** in `discord/manifest.json`:

```json
  "roles": [
    { "name": "Admin", "color": 16096779, "hoist": true, "mentionable": false, "permissions": "8" },
    { "name": "Moderator", "color": 15105570, "hoist": true, "mentionable": true, "permissions": "1116825723014" },
    { "name": "Core", "color": 10181046, "hoist": true, "mentionable": true, "permissions": "0" },
    { "name": "Contributor", "color": 9133302, "hoist": true, "mentionable": true, "permissions": "0" },
    { "name": "Builder", "color": 3447003, "hoist": true, "mentionable": true, "permissions": "0" },
    { "name": "Bounty Hunter", "color": 1357990, "hoist": true, "mentionable": true, "permissions": "0" },
    { "name": "OG", "color": 16766720, "hoist": true, "mentionable": false, "permissions": "0" },
    { "name": "Community", "color": 9741240, "hoist": false, "mentionable": false, "permissions": "1024" }
  ],
```

Note: `Community` permission changes `"0"` → `"1024"` (VIEW_CHANNEL) — this is the base view grant for verified members (Task 3 relies on it).

- [ ] **Step 3: Validate the manifest + preview the plan**

Run:
```bash
cd /Users/rector/local-dev/sip-dot-github
node -e 'JSON.parse(require("fs").readFileSync("discord/manifest.json","utf8")); console.log("manifest JSON OK")'
node discord/setup.js --plan
```
Expected: "manifest JSON OK"; the `--plan` output lists role creations (`Moderator`, `Core`, `Builder`, `OG`) and a `Community` permission update, with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/manifest.json
git commit -S -m "feat(discord): add contribution-earned tier roles + Community view perm"
```

---

## Task 3: `manifest.json` — strict gate via base-permission flip + `#introductions`

**Files:**
- Modify: `discord/manifest.json` (`guild.everyone_permissions`, `categories` → START HERE + MACHINE, add `#introductions`)

- [ ] **Step 1: Confirm the new `@everyone` permission value**

Run:
```bash
node -e 'console.log((311452617793n & ~(1n<<10n)).toString())'
```
Expected: `311452616769` (current value minus VIEW_CHANNEL).

- [ ] **Step 2: Set `guild.everyone_permissions`** in `discord/manifest.json`:

```json
    "everyone_permissions": "311452616769"
```

- [ ] **Step 3: Add `#introductions` + view-allow on `#rules`** — replace the `📌 START HERE` category's `channels` array:

```json
      "channels": [
        { "name": "rules", "type": 0, "topic": "Read + accept to unlock the server. The team will NEVER DM you first.", "overwrites": [{ "role": "@everyone", "allow": "1024" }] },
        { "name": "introductions", "type": 0, "topic": "Introduce yourself to unlock the server — who you are and why you're here. The button posts your intro and grants access.", "overwrites": [{ "role": "@everyone", "allow": "1024" }] },
        { "name": "announcements", "type": 5, "topic": "Releases, milestones, bounty launches. Follow to mirror into your own server." },
        { "name": "resources", "type": 0, "topic": "Docs, SDK, app, blog — everything you need to build." }
      ]
```

(`rules` + `introductions` get explicit `@everyone allow VIEW` so they remain visible after the base flip; they inherit the category read-only deny, so neither is sendable by members. `announcements`/`resources` get no view-allow → hidden from unverified, visible to `Community` via its base VIEW perm.)

- [ ] **Step 4: Deny `Community` view on `#mod-log`** — replace the `mod-log` channel entry in the `🤖 MACHINE` category:

```json
        { "name": "mod-log", "type": 0, "topic": "AutoMod flags + Discord community notices. Staff only.", "overwrites": [{ "role": "@everyone", "deny": "1024" }, { "role": "Community", "deny": "1024" }] }
```

(All other channels need no change: hidden from `@everyone` via the base flip, visible to `Community` via base VIEW; `#github-feed` keeps its read-only `@everyone` deny so `Community` can read but not post.)

- [ ] **Step 5: Validate + preview**

Run:
```bash
cd /Users/rector/local-dev/sip-dot-github
node -e 'JSON.parse(require("fs").readFileSync("discord/manifest.json","utf8")); console.log("manifest JSON OK")'
node discord/setup.js --plan
```
Expected: "manifest JSON OK"; `--plan` shows `@everyone` base-permission update, a new `introductions` channel, and overwrite changes on `rules`/`introductions`/`mod-log`. No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/manifest.json
git commit -S -m "feat(discord): strict join gate via base-permission flip + #introductions"
```

---

## Task 4: Retire native onboarding + seed the intro-gate card + welcome screen

**Files:**
- Modify: `discord/manifest.json` (`onboarding`, `welcome_screen`, `seeds`)
- Modify: `discord/setup.js` (disable-onboarding branch)

- [ ] **Step 1: Disable onboarding in the manifest** — replace the `onboarding` block:

```json
  "onboarding": { "enabled": false },
```

- [ ] **Step 2: Repoint the welcome screen at the gate** — replace `welcome_screen`:

```json
  "welcome_screen": {
    "description": "The privacy standard for Web3 — introduce yourself to unlock the server.",
    "channels": [
      { "channel": "rules", "description": "Read the rules first", "emoji": "📌" },
      { "channel": "introductions", "description": "Introduce yourself → instant access", "emoji": "👋" }
    ]
  },
```

- [ ] **Step 3: Add the intro-gate seed** — append to the `seeds` array:

```json
    {
      "key": "intro-gate", "channel": "introductions", "pin": true,
      "payload": {
        "type": "announcement", "channel": "introductions",
        "title": "Introduce yourself to unlock SIP Protocol 👋",
        "body": "New here? Tell us who you are and why you're here — and you'll get instant access to the whole server.\n\nNo wallet. No email. Just a hello. Click the button below to introduce yourself.",
        "buttons": [{ "label": "Introduce yourself", "custom_id": "sip_intro" }]
      }
    }
```

- [ ] **Step 4: Teach `setup.js` to disable onboarding** — in `discord/setup.js`, replace the onboarding `PUT` block (the `await api('PUT', \`/guilds/${GUILD}/onboarding\`, {...})` call) with:

```js
  // ---- 11. onboarding (disabled when manifest.onboarding.enabled === false)
  try {
    if (manifest.onboarding && manifest.onboarding.enabled === false) {
      await api('PUT', `/guilds/${GUILD}/onboarding`, {
        prompts: [], default_channel_ids: [], enabled: false, mode: 0,
      })
      log('✓ onboarding disabled (custom intro gate in use)')
    } else {
      await api('PUT', `/guilds/${GUILD}/onboarding`, {
        prompts: [{
          id: '0', type: 0, title: manifest.onboarding.prompt.title,
          single_select: true, required: true, in_onboarding: true,
          options: manifest.onboarding.prompt.options.map(o => ({
            title: o.title, description: o.description,
            emoji: o.emoji ? { name: o.emoji } : undefined,
            role_ids: (o.roles || []).map(roleId), channel_ids: (o.channels || []).map(channelId),
          })),
        }],
        default_channel_ids: manifest.onboarding.default_channels.map(channelId),
        enabled: true, mode: 0,
      })
      log('✓ onboarding')
    }
  } catch (e) {
    warnings.push(`onboarding: ${e.message}`)
  }
```

(Preserve the surrounding `roleId`/`channelId` helpers and `warnings` array already in `setup.js`; only the onboarding block changes. If the existing block's exact shape differs, keep its option-mapping and only wrap it in the `enabled === false` branch.)

- [ ] **Step 5: Validate + preview**

Run:
```bash
cd /Users/rector/local-dev/sip-dot-github
node -e 'JSON.parse(require("fs").readFileSync("discord/manifest.json","utf8")); console.log("manifest JSON OK")'
node --test discord/test/lib.test.js
node discord/setup.js --plan
```
Expected: "manifest JSON OK"; existing `lib.test.js` passes; `--plan` shows the `intro-gate` seed as `intro-gate:create`, welcome-screen update, and onboarding planned as disabled. No errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/manifest.json discord/setup.js
git commit -S -m "feat(discord): retire native onboarding, seed intro-gate card + welcome screen"
```

---

## Task 5: Worker scaffold

**Files:**
- Create: `discord/worker/package.json`, `discord/worker/wrangler.toml`

- [ ] **Step 1: Create `discord/worker/package.json`**

```json
{
  "name": "sip-discord-interactions",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "discord-interactions": "^4.1.0"
  },
  "devDependencies": {
    "wrangler": "^3.90.0"
  }
}
```

- [ ] **Step 2: Create `discord/worker/wrangler.toml`**

```toml
name = "sip-discord-interactions"
main = "src/index.js"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

# Non-secret config. Fill COMMUNITY_ROLE_ID from `setup.js` output (it prints role ids).
[vars]
DISCORD_GUILD_ID = "REPLACE_WITH_GUILD_ID"
COMMUNITY_ROLE_ID = "REPLACE_WITH_COMMUNITY_ROLE_ID"

# Secrets (NOT here — set with `wrangler secret put`):
#   DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY, DISCORD_MODLOG_WEBHOOK_URL
```

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && npm install`
Expected: `discord-interactions` + `wrangler` installed; `node_modules/` created.

- [ ] **Step 4: Add `node_modules` ignore** — create `discord/worker/.gitignore`:

```
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/worker/package.json discord/worker/wrangler.toml discord/worker/package-lock.json discord/worker/.gitignore
git commit -S -m "chore(discord): scaffold Cloudflare Worker for interaction handling"
```

---

## Task 6: `sanitize.js` — input validation + sanitization (pure)

**Files:**
- Create: `discord/worker/src/sanitize.js`, `discord/worker/test/sanitize.test.js`

- [ ] **Step 1: Write failing tests** — `discord/worker/test/sanitize.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert'
import { validateAndSanitize } from '../src/sanitize.js'

const good = { handle: 'satoshi', who: 'A privacy researcher from Jakarta', why: 'I care about on-chain privacy a lot', building: '' }

test('accepts a valid intro', () => {
  const r = validateAndSanitize(good)
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.fields.handle, 'satoshi')
})

test('rejects a missing required field', () => {
  const r = validateAndSanitize({ ...good, why: '   ' })
  assert.strictEqual(r.ok, false)
  assert.match(r.reason, /Why SIP/)
})

test('rejects too-short input', () => {
  const r = validateAndSanitize({ ...good, who: 'hi' })
  assert.strictEqual(r.ok, false)
  assert.match(r.reason, /too short/)
})

test('rejects URLs in any field', () => {
  for (const bad of ['visit https://evil.link', 'join discord.gg/x', 'go to evil.xyz now', 'www.evil.com']) {
    const r = validateAndSanitize({ ...good, why: `I am here because ${bad} ok` })
    assert.strictEqual(r.ok, false, bad)
    assert.match(r.reason, /[Ll]inks/)
  }
})

test('rejects drainer phrases', () => {
  const r = validateAndSanitize({ ...good, who: 'I am here to claim your airdrop friend' })
  assert.strictEqual(r.ok, false)
  assert.match(r.reason, /AutoMod/)
})

test('escapes markdown + mention tokens', () => {
  const r = validateAndSanitize({ ...good, who: 'I am @everyone and **admin** of #general here ok' })
  assert.strictEqual(r.ok, true)
  assert.ok(!r.fields.who.includes('@everyone'))
  assert.ok(r.fields.who.includes('\\*\\*'))
})

test('optional building may be empty', () => {
  const r = validateAndSanitize({ ...good, building: '' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.fields.building, '')
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test test/sanitize.test.js`
Expected: FAIL ("Cannot find module '../src/sanitize.js'").

- [ ] **Step 3: Implement `discord/worker/src/sanitize.js`**

```js
// worker/src/sanitize.js — pure input validation + sanitization for intro submissions.
// No I/O. Rejects unsafe content; escapes the rest for safe rendering in a bot-posted card.

const FIELD_RULES = {
  handle: { label: 'Name / handle', min: 2, max: 50, required: true },
  who: { label: 'Who are you', min: 15, max: 300, required: true },
  why: { label: 'Why SIP', min: 20, max: 300, required: true },
  building: { label: 'What you are building', min: 0, max: 300, required: false },
}

// Mirrors the wallet-drainer intent of manifest.json automod (kept in sync manually).
const DRAINER_PATTERNS = [
  'free nitro', 'nitro giveaway', 'claim your airdrop', 'airdrop claim', 'connect your wallet',
  'verify your wallet', 'wallet verification', 'validate your wallet', 'synchronize your wallet',
  'dm me to claim', 'first come first serve',
]

const URL_RE = /(https?:\/\/|www\.|discord\.gg\/|t\.me\/|[a-z0-9-]+\.(xyz|io|com|net|org|app|fi|finance|link|click|gift|claim)\b)/i

function escapeMarkdown(s) {
  return s
    .replace(/[\\`*_~|>#-]/g, '\\$&')
    .replace(/@/g, '@​')            // break @everyone/@here/@user
    .replace(/<(@|#|@&)/g, '<​$1')  // break channel/role/user component mentions
}

// fields: { handle, who, why, building } raw strings (may be undefined)
// returns { ok: true, fields } | { ok: false, reason }
export function validateAndSanitize(fields) {
  const out = {}
  for (const [key, rule] of Object.entries(FIELD_RULES)) {
    const trimmed = (fields[key] ?? '').toString().trim()
    if (!trimmed) {
      if (rule.required) return { ok: false, reason: `${rule.label} is required.` }
      out[key] = ''
      continue
    }
    if (trimmed.length < rule.min) return { ok: false, reason: `${rule.label} is too short (min ${rule.min}).` }
    if (trimmed.length > rule.max) return { ok: false, reason: `${rule.label} is too long (max ${rule.max}).` }
    if (URL_RE.test(trimmed)) return { ok: false, reason: `Links aren't allowed in your intro (${rule.label}).` }
    if (DRAINER_PATTERNS.some(p => trimmed.toLowerCase().includes(p))) {
      return { ok: false, reason: 'Your intro was blocked by SIP AutoMod. The team never DMs first.' }
    }
    out[key] = escapeMarkdown(trimmed)
  }
  return { ok: true, fields: out }
}

export const _internals = { URL_RE, DRAINER_PATTERNS, escapeMarkdown, FIELD_RULES }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test test/sanitize.test.js`
Expected: PASS (all 7).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/worker/src/sanitize.js discord/worker/test/sanitize.test.js
git commit -S -m "feat(discord-worker): intro input validation + sanitization"
```

---

## Task 7: `render-intro.js` — modal + intro card builders (pure)

**Files:**
- Create: `discord/worker/src/render-intro.js`, `discord/worker/test/render-intro.test.js`

- [ ] **Step 1: Write failing tests** — `discord/worker/test/render-intro.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert'
import { buildModal, buildIntroCard, ephemeral } from '../src/render-intro.js'

test('buildModal returns a type-9 modal with 4 text inputs', () => {
  const m = buildModal()
  assert.strictEqual(m.type, 9)
  assert.strictEqual(m.data.custom_id, 'sip_intro_modal')
  assert.ok(m.data.title.length <= 45)
  assert.strictEqual(m.data.components.length, 4)
  const handle = m.data.components[0].components[0]
  assert.strictEqual(handle.type, 4)
  assert.strictEqual(handle.custom_id, 'handle')
  assert.strictEqual(handle.style, 1)
  assert.strictEqual(handle.required, true)
  const building = m.data.components[3].components[0]
  assert.strictEqual(building.required, false)
})

test('buildIntroCard returns a public type-4 CV2 card pinging only the joiner', () => {
  const c = buildIntroCard({ handle: 'satoshi', who: 'a builder', why: 'privacy', building: '' }, '123')
  assert.strictEqual(c.type, 4)
  assert.strictEqual(c.data.flags, 1 << 15)
  assert.deepStrictEqual(c.data.allowed_mentions, { parse: [], users: ['123'] })
  assert.strictEqual(c.data.components[0].type, 17)
  const txt = JSON.stringify(c.data.components)
  assert.ok(txt.includes('satoshi'))
  assert.ok(!txt.includes('**Building:**')) // omitted when empty
})

test('buildIntroCard includes Building when present', () => {
  const c = buildIntroCard({ handle: 'a', who: 'b', why: 'c', building: 'a privacy wallet' }, '1')
  assert.ok(JSON.stringify(c.data.components).includes('a privacy wallet'))
})

test('ephemeral returns a flag-64 text reply', () => {
  const e = ephemeral('nope')
  assert.strictEqual(e.type, 4)
  assert.strictEqual(e.data.flags, 1 << 6)
  assert.strictEqual(e.data.content, 'nope')
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test test/render-intro.test.js`
Expected: FAIL ("Cannot find module '../src/render-intro.js'").

- [ ] **Step 3: Implement `discord/worker/src/render-intro.js`**

```js
// worker/src/render-intro.js — pure builders: the modal, the public intro card, ephemeral replies.
// Mirrors the SIP Components-V2 card style from discord/templates.js.

const FLAG_COMPONENTS_V2 = 1 << 15  // 32768
const FLAG_EPHEMERAL = 1 << 6       // 64
const SIP_ACCENT = 0x8b5cf6         // announcement purple

const row = (custom_id, label, style, required, min, max, placeholder) => ({
  type: 1, // action row
  components: [{ type: 4, custom_id, label, style, required, min_length: min, max_length: max, placeholder }],
})

// Interaction response type 9 (MODAL)
export function buildModal() {
  return {
    type: 9,
    data: {
      custom_id: 'sip_intro_modal',
      title: 'Introduce yourself to SIP',
      components: [
        row('handle', 'Name / handle', 1, true, 2, 50, 'How should we call you?'),
        row('who', 'Who are you?', 2, true, 15, 300, 'Builder, researcher, curious about privacy…'),
        row('why', 'Why SIP — what brings you here?', 2, true, 20, 300, 'What pulled you in?'),
        row('building', 'What are you building / interested in?', 2, false, 0, 300, 'Optional'),
      ],
    },
  }
}

const text = content => ({ type: 10, content })
const sep = () => ({ type: 14, divider: true, spacing: 1 })

// Interaction response type 4 (CHANNEL_MESSAGE_WITH_SOURCE), public, Components V2.
export function buildIntroCard(fields, userId) {
  const inner = [text(`### 👋 ${fields.handle} just joined`)]
  inner.push(text(`**Who:** ${fields.who}`))
  inner.push(text(`**Here for:** ${fields.why}`))
  if (fields.building) inner.push(text(`**Building:** ${fields.building}`))
  inner.push(sep())
  inner.push(text(`-# Welcome in, <@${userId}> — you're now a member. Explore the server.`))
  return {
    type: 4,
    data: {
      flags: FLAG_COMPONENTS_V2,
      allowed_mentions: { parse: [], users: [userId] },
      components: [{ type: 17, accent_color: SIP_ACCENT, components: inner }],
    },
  }
}

// Ephemeral text reply (errors + already-in).
export function ephemeral(content) {
  return { type: 4, data: { flags: FLAG_EPHEMERAL, content } }
}

export const _internals = { FLAG_COMPONENTS_V2, FLAG_EPHEMERAL, SIP_ACCENT }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test test/render-intro.test.js`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/worker/src/render-intro.js discord/worker/test/render-intro.test.js
git commit -S -m "feat(discord-worker): modal + public intro card builders"
```

---

## Task 8: `discord.js` — REST helpers (role grant + modlog)

**Files:**
- Create: `discord/worker/src/discord.js`, `discord/worker/test/discord.test.js`

- [ ] **Step 1: Write failing tests** — `discord/worker/test/discord.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert'
import { grantRole, logModlog } from '../src/discord.js'

const env = { DISCORD_GUILD_ID: 'G', DISCORD_BOT_TOKEN: 'tok', DISCORD_MODLOG_WEBHOOK_URL: 'https://hook' }

test('grantRole PUTs the member-role route with the bot token', async () => {
  const calls = []
  globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 204 } }
  const r = await grantRole(env, 'U', 'R')
  assert.strictEqual(r.ok, true)
  assert.strictEqual(calls[0].url, 'https://discord.com/api/v10/guilds/G/members/U/roles/R')
  assert.strictEqual(calls[0].opts.method, 'PUT')
  assert.match(calls[0].opts.headers.Authorization, /^Bot tok$/)
})

test('grantRole reports failure status', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 403 })
  const r = await grantRole(env, 'U', 'R')
  assert.deepStrictEqual(r, { ok: false, status: 403 })
})

test('logModlog posts to the webhook and never throws', async () => {
  let body
  globalThis.fetch = async (url, opts) => { body = JSON.parse(opts.body); return { ok: true } }
  await logModlog(env, 'hello')
  assert.strictEqual(body.content, 'hello')
  assert.deepStrictEqual(body.allowed_mentions, { parse: [] })
})

test('logModlog is a no-op without a webhook url', async () => {
  globalThis.fetch = async () => { throw new Error('should not be called') }
  await logModlog({ ...env, DISCORD_MODLOG_WEBHOOK_URL: undefined }, 'x') // must not throw
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test test/discord.test.js`
Expected: FAIL ("Cannot find module '../src/discord.js'").

- [ ] **Step 3: Implement `discord/worker/src/discord.js`**

```js
// worker/src/discord.js — minimal Discord REST calls for the Worker (bot token).
const API = 'https://discord.com/api/v10'

// Add a single role to a member. Returns { ok, status }.
export async function grantRole(env, userId, roleId) {
  const res = await fetch(`${API}/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      'X-Audit-Log-Reason': 'SIP intro gate auto-grant',
      'Content-Length': '0',
    },
  })
  return { ok: res.ok, status: res.status }
}

// Best-effort note to #mod-log via the Ops webhook. Never throws.
export async function logModlog(env, content) {
  if (!env.DISCORD_MODLOG_WEBHOOK_URL) return
  try {
    await fetch(env.DISCORD_MODLOG_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    })
  } catch { /* best-effort logging */ }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test test/discord.test.js`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/worker/src/discord.js discord/worker/test/discord.test.js
git commit -S -m "feat(discord-worker): REST helpers for role grant + modlog"
```

---

## Task 9: `index.js` — `handleInteraction` router + tests

**Files:**
- Create: `discord/worker/src/index.js` (router half), `discord/worker/test/handlers.test.js`

- [ ] **Step 1: Write failing tests** — `discord/worker/test/handlers.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert'
import { handleInteraction } from '../src/index.js'

const env = { COMMUNITY_ROLE_ID: 'R', DISCORD_GUILD_ID: 'G' }
const modalSubmit = (fields, roles = []) => ({
  type: 5,
  data: { custom_id: 'sip_intro_modal', components: Object.entries(fields).map(([custom_id, value]) => ({ components: [{ custom_id, value }] })) },
  member: { user: { id: 'U' }, roles },
})
const goodFields = { handle: 'satoshi', who: 'a privacy researcher here', why: 'I care about on-chain privacy' }

test('PING → PONG', async () => {
  assert.deepStrictEqual(await handleInteraction({ type: 1 }, env), { type: 1 })
})

test('intro button → modal', async () => {
  const r = await handleInteraction({ type: 3, data: { custom_id: 'sip_intro' } }, env)
  assert.strictEqual(r.type, 9)
})

test('valid modal submit grants role and returns the intro card', async () => {
  const calls = []
  const deps = { grantRole: async (...a) => { calls.push(a); return { ok: true, status: 204 } }, logModlog: async () => {} }
  const r = await handleInteraction(modalSubmit(goodFields), env, deps)
  assert.strictEqual(r.type, 4)
  assert.strictEqual(r.data.flags, 1 << 15) // public CV2 card
  assert.deepStrictEqual(calls[0], [env, 'U', 'R'])
})

test('already-Community submit is a no-op (ephemeral, no grant)', async () => {
  let granted = false
  const deps = { grantRole: async () => { granted = true; return { ok: true, status: 204 } }, logModlog: async () => {} }
  const r = await handleInteraction(modalSubmit(goodFields, ['R']), env, deps)
  assert.strictEqual(r.data.flags, 1 << 6) // ephemeral
  assert.strictEqual(granted, false)
})

test('invalid input → ephemeral error, no grant', async () => {
  let granted = false
  const deps = { grantRole: async () => { granted = true; return { ok: true, status: 204 } }, logModlog: async () => {} }
  const r = await handleInteraction(modalSubmit({ ...goodFields, why: 'go to evil.xyz' }), env, deps)
  assert.strictEqual(r.data.flags, 1 << 6)
  assert.match(r.data.content, /Links/)
  assert.strictEqual(granted, false)
})

test('grant failure → ephemeral error + modlog', async () => {
  let logged = false
  const deps = { grantRole: async () => ({ ok: false, status: 403 }), logModlog: async () => { logged = true } }
  const r = await handleInteraction(modalSubmit(goodFields), env, deps)
  assert.strictEqual(r.data.flags, 1 << 6)
  assert.match(r.data.content, /ping a moderator/)
  assert.strictEqual(logged, true)
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test test/handlers.test.js`
Expected: FAIL ("Cannot find module '../src/index.js'").

- [ ] **Step 3: Implement `discord/worker/src/index.js`** (router + entrypoint together)

```js
// worker/src/index.js — Cloudflare Worker entrypoint for SIP Discord interactions.
import { verifyKey } from 'discord-interactions'
import { validateAndSanitize } from './sanitize.js'
import { buildModal, buildIntroCard, ephemeral } from './render-intro.js'
import { grantRole, logModlog } from './discord.js'

const PONG = { type: 1 }

// Router. Side effects go through `deps` for testability.
export async function handleInteraction(interaction, env, deps = { grantRole, logModlog }) {
  if (interaction.type === 1) return PONG // PING

  if (interaction.type === 3 && interaction.data?.custom_id === 'sip_intro') {
    return buildModal()
  }

  if (interaction.type === 5 && interaction.data?.custom_id === 'sip_intro_modal') {
    const member = interaction.member
    const userId = member?.user?.id
    if (member?.roles?.includes(env.COMMUNITY_ROLE_ID)) {
      return ephemeral("You're already in 🎉 — welcome back.")
    }
    const fields = {}
    for (const r of interaction.data.components ?? []) {
      const c = r.components?.[0]
      if (c) fields[c.custom_id] = c.value
    }
    const result = validateAndSanitize(fields)
    if (!result.ok) return ephemeral(`Couldn't post your intro: ${result.reason}`)

    const grant = await deps.grantRole(env, userId, env.COMMUNITY_ROLE_ID)
    if (!grant.ok) {
      await deps.logModlog(env, `⚠️ intro-gate: failed to grant Community to <@${userId}> (status ${grant.status})`)
      return ephemeral("Couldn't unlock automatically — please ping a moderator.")
    }
    return buildIntroCard(result.fields, userId)
  }

  return ephemeral('Unsupported interaction.')
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const signature = request.headers.get('X-Signature-Ed25519')
    const timestamp = request.headers.get('X-Signature-Timestamp')
    if (!signature || !timestamp) return new Response('Missing signature', { status: 401 })
    const body = await request.text() // RAW body — required for verification
    const valid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY)
    if (!valid) return new Response('Bad request signature', { status: 401 })

    const interaction = JSON.parse(body)
    const response = await handleInteraction(interaction, env)
    return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } })
  },
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test`
Expected: PASS — all worker suites (sanitize, render-intro, discord, handlers).

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/worker/src/index.js discord/worker/test/handlers.test.js
git commit -S -m "feat(discord-worker): interaction router + signature-verified entrypoint"
```

---

## Task 10: Local Worker smoke (wrangler dev) + dependency-free verification

**Files:** none (verification only)

- [ ] **Step 1: Lint-run the whole worker test suite + check coverage of new modules**

Run: `cd /Users/rector/local-dev/sip-dot-github/discord/worker && node --test`
Expected: all suites PASS. (sanitize 7 + render-intro 4 + discord 4 + handlers 6 = 21 tests.)

- [ ] **Step 2: Start `wrangler dev` and PING locally** (verifies the fetch entrypoint wiring; uses a throwaway PING that fails signature → 401, proving verification runs)

Run (terminal A): `cd /Users/rector/local-dev/sip-dot-github/discord/worker && npx wrangler dev --var DISCORD_PUBLIC_KEY:deadbeef --port 8787`
Run (terminal B):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8787 \
  -H 'X-Signature-Ed25519: 00' -H 'X-Signature-Timestamp: 0' -d '{"type":1}'
```
Expected: `401` (bad signature rejected — the verification path is live). Stop `wrangler dev` after.

- [ ] **Step 3: Commit** (no code change; this is a checkpoint — skip if nothing changed)

---

## Task 11: `PLAYBOOK.md` — onboarding gate + granting tiers

**Files:**
- Modify: `discord/PLAYBOOK.md`

- [ ] **Step 1: Add two sections** to `discord/PLAYBOOK.md` (after §4 Conventions):

```markdown
## 4a. Onboarding gate (the intro flow)

New members see only `#rules` + `#introductions` until they introduce themselves. The
`#introductions` seed card has an **Introduce yourself** button → a 4-field modal
(handle / who / why / building). On submit, the Cloudflare Worker
(`discord/worker/`) validates + sanitizes the input, grants `Community` (the unlock
role), and posts a public intro card. Fully automatic — no mod approval.

- Worker source: `discord/worker/` — deploy with `npm run deploy` (wrangler).
- Endpoint URL is set in the Discord Dev Portal (SIPHER app → Interactions Endpoint URL).
- Secrets: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_MODLOG_WEBHOOK_URL`
  (`wrangler secret put`). Vars: `DISCORD_GUILD_ID`, `COMMUNITY_ROLE_ID` (wrangler.toml).
- Failure (e.g. role hierarchy) → ephemeral "ping a moderator" + a note in `#mod-log`.
  Fix: ensure the SIPHER integration role sits **above** `Community` in the role list.

## 4b. Granting earned tiers

The ladder is `Community` (auto) → `Builder` → `Contributor` → `Core`. All but
`Community` are granted **manually**, never self-assigned (rule below):

- **Builder** — actively building with the SDK / sustained help in `#dev-chat`.
- **Contributor** — merged a PR to any `sip-protocol` repo.
- **Core** — sustained maintainer / deeply trusted (Admin grants).
- **OG** — batch-granted to the first wave of members (one-time, RECTOR's cutoff).

Grant via Server Settings → Members, or `node` against the REST API. Never bulk-grant
earned tiers; the value is that they're earned.
```

- [ ] **Step 2: Update the growth-triggers note** — in `discord/PLAYBOOK.md` §6, change the `50 members` row's "add Moderator role" clause to note it already exists:

```markdown
| 50 members | Recruit first mod → grant the existing `Moderator` role; open #showcase (COMMUNITY) |
```

- [ ] **Step 3: Commit**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/PLAYBOOK.md
git commit -S -m "docs(discord): playbook — onboarding gate + granting earned tiers"
```

---

## Task 12: Deploy + live integration smoke (runbook)

**Files:** none (operational; RECTOR runs the one-time portal step)

- [ ] **Step 1: Set Worker secrets**

```bash
cd /Users/rector/local-dev/sip-dot-github/discord/worker
echo "$DISCORD_BOT_TOKEN" | npx wrangler secret put DISCORD_BOT_TOKEN
echo "$DISCORD_PUBLIC_KEY" | npx wrangler secret put DISCORD_PUBLIC_KEY        # SIPHER app public key
echo "$DISCORD_MODLOG_WEBHOOK_URL" | npx wrangler secret put DISCORD_MODLOG_WEBHOOK_URL
```
(`DISCORD_BOT_TOKEN` + `DISCORD_MODLOG_WEBHOOK_URL` are in `~/Documents/secret/.env`; `DISCORD_PUBLIC_KEY` from the Dev Portal.)

- [ ] **Step 2: Fill `wrangler.toml` vars + deploy**

Set `DISCORD_GUILD_ID` and `COMMUNITY_ROLE_ID` in `wrangler.toml` (run `node discord/setup.js --plan` once to print role ids, or read them from the guild). Then:
```bash
cd /Users/rector/local-dev/sip-dot-github/discord/worker && npx wrangler deploy
```
Expected: a deployed URL, e.g. `https://sip-discord-interactions.<subdomain>.workers.dev`.

- [ ] **Step 3: Register the Interactions Endpoint URL** *(RECTOR, one-time)*

In the Discord Developer Portal → SIPHER app → General Information → **Interactions Endpoint URL** = the Worker URL → Save. Discord sends a PING; save succeeds only if the Worker verifies + PONGs. **This is the real end-to-end signature-verification test.**

- [ ] **Step 4: Apply the server changes**

```bash
cd /Users/rector/local-dev/sip-dot-github
node discord/setup.js --plan   # review
node discord/setup.js          # apply: roles, gate, #introductions, onboarding off, intro seed
node discord/verify.js         # expect: no drift
```
Then confirm the **SIPHER integration role is above `Community`** in Server Settings → Roles (drag if needed) — required for the grant.

- [ ] **Step 5: Alt-account smoke test** *(verifies the full acceptance criteria)*

With a throwaway account: join → confirm only `#rules` + `#introductions` are visible → click **Introduce yourself** → fill the modal → submit → confirm (a) the role is granted and the rest of the server appears, (b) a public intro card is posted pinging only you. Then: click the button again → confirm the "already in" ephemeral (no duplicate card). Submit a fresh alt with a URL in a field → confirm rejection.

- [ ] **Step 6: Final commit (wrangler.toml vars)**

```bash
cd /Users/rector/local-dev/sip-dot-github
git add discord/worker/wrangler.toml
git commit -S -m "chore(discord-worker): set guild + community-role vars for deploy"
```

---

## Self-Review

**Spec coverage:**
- §4 tiered roles → Task 2 ✓ · §5 strict gate → Task 3 (base-flip refinement) ✓ · §6 onboarding retired → Task 4 ✓ · §7 intro UX → Tasks 4+7+9 ✓ · §8 Worker behavior (PING/button/modal/idempotency/grant-then-card) → Tasks 7+9 ✓ · §9 anti-abuse sanitize → Task 6 ✓ · §10 edge cases (idempotency, grant-fail, hierarchy) → Task 9 + Task 12 step 4 ✓ · §11 code layout → Tasks 5–9 (no `verify.js`; `discord-interactions` used instead — noted) ✓ · §12 secrets → Task 12 ✓ · §13 testing → Tasks 1,6,7,8,9 (verify.test replaced by deploy-time live PING, noted) ✓ · §14 deploy sequence → Task 12 ✓ · §15 acceptance criteria → Task 12 step 5 ✓.

**Placeholder scan:** No "TBD"/"add error handling"/vague steps. The only `REPLACE_WITH_*` tokens are `wrangler.toml` vars filled in Task 12 step 2 (explicitly). Permission bitfields are computed by runnable snippets, not hand-asserted.

**Type consistency:** `validateAndSanitize` returns `{ ok, fields | reason }` — consumed identically in Task 9. `grantRole` returns `{ ok, status }` — matched in handler + tests. `buildModal`/`buildIntroCard`/`ephemeral` signatures match between Task 7 and Task 9. `custom_id`s (`sip_intro`, `sip_intro_modal`) consistent across manifest seed (Task 4), modal (Task 7), router (Task 9). `COMMUNITY_ROLE_ID` env var consistent across Tasks 5/9/12.

---

## Execution Handoff

(Filled by the brainstorming/writing-plans flow — see the next message for the execution-mode choice.)
