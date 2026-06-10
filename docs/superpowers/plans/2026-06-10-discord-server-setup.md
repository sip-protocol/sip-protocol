# SIP Protocol Discord Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended — Tasks 5–6 are a live Chrome-MCP cowork session with RECTOR-gated clicks and a shared browser; subagents can't drive it) or superpowers:subagent-driven-development for Tasks 1–4 only. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SIP Protocol community Discord per the approved spec (`docs/superpowers/specs/2026-06-10-discord-server-design.md`) — reproducible manifest-driven setup, safety rails, seed content, permanent invite wired into the website footer and org README.

**Architecture:** A zero-dependency Node ≥18 toolkit in the org-config repo (`sip-protocol/.github` → local clone `~/local-dev/.github`): `manifest.json` (declarative desired state) + pure planning library (`lib.js`, TDD via `node:test`) + `setup.js` (REST apply, idempotent, `--plan` dry-run) + `verify.js` (GET-only drift check). Browser bootstrap (server, bot app, OAuth) runs as a Chrome-MCP cowork session in RECTOR's Discord session; two clicks stay RECTOR's (Developer-ToS Create, OAuth Authorize) unless he explicitly authorizes in chat.

**Tech Stack:** Discord REST API v10 (`Authorization: Bot`), Node ≥18 global `fetch`, `node:test`, Chrome MCP, Next.js (sip-website footer), shields.io badge (org README).

**Execution order:** Tasks 1–4 (code, headless) → Tasks 5–6 (browser cowork + live run, RECTOR present) → Tasks 7–9 (PRs + trackers).

**Key IDs/paths:**
- Org repo clone: `~/local-dev/.github` (branch from `origin/main`)
- Secrets: append to `~/Documents/secret/.env` (auto-loaded by zshrc): `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`
- Logo source: `~/local-dev/sip-protocol/.github/assets/logo-512.png`
- sip-website clone: `~/local-dev/sip-website` (footer: `src/components/layout/footer.tsx`)

**Discord API facts used throughout** (v10): channel types — 0 text, 2 voice, 4 category, 5 announcement; permission overwrite `{id, type: 0(role), allow, deny}` with bit-strings; `@everyone` role id == guild id; announcement channels require the guild `COMMUNITY` feature → `#announcements` is created as type 0 and PATCHed to type 5 after COMMUNITY is enabled; AutoMod trigger types — 1 KEYWORD, 3 SPAM, 4 KEYWORD_PRESET, 5 MENTION_SPAM; AutoMod actions — 1 BLOCK_MESSAGE, 2 SEND_ALERT_MESSAGE; verification level 2 = Medium; default_message_notifications 1 = mentions-only; onboarding mode 0 requires ≥7 default channels of which ≥5 sendable.

**Permission bit-strings used** (decimal, computed from the v10 flag table):
- `@everyone` server base (allow-list; MENTION_EVERYONE omitted = denied): CREATE_INSTANT_INVITE(1) + ADD_REACTIONS(64) + VIEW_CHANNEL(1024) + SEND_MESSAGES(2048) + EMBED_LINKS(16384) + ATTACH_FILES(32768) + READ_MESSAGE_HISTORY(65536) + USE_EXTERNAL_EMOJIS(262144) + CHANGE_NICKNAME(67108864) + USE_APPLICATION_COMMANDS(2147483648) + CREATE_PUBLIC_THREADS(34359738368) + SEND_MESSAGES_IN_THREADS(274877906944) = **`311452617793`**
- START HERE read-only deny: SEND_MESSAGES(2048) + CREATE_PUBLIC_THREADS(34359738368) + SEND_MESSAGES_IN_THREADS(274877906944) = **`309237647360`**
- mod-log private deny: VIEW_CHANNEL = **`1024`**
- ADMINISTRATOR = **`8`**

---

### Task 0: Branch + scaffold in the org repo

**Files:**
- Create: `~/local-dev/.github/discord/assets/` (dir)
- Copy: `logo-512.png` into it

- [ ] **Step 1: Sync + branch**

```bash
cd ~/local-dev/.github
git fetch origin main && git checkout -B feat/discord-server origin/main
mkdir -p discord/assets discord/test
cp ~/local-dev/sip-protocol/.github/assets/logo-512.png discord/assets/logo-512.png
```

Expected: branch `feat/discord-server`, file copied (`ls discord/assets` shows `logo-512.png`).

---

### Task 1: `manifest.json` — the declarative desired state

**Files:**
- Create: `~/local-dev/.github/discord/manifest.json`

- [ ] **Step 1: Write the complete manifest**

```json
{
  "guild": {
    "name": "SIP Protocol",
    "verification_level": 2,
    "default_message_notifications": 1,
    "icon_file": "assets/logo-512.png",
    "rules_channel": "rules",
    "public_updates_channel": "mod-log",
    "everyone_permissions": "311452617793"
  },
  "bot_role": { "name": "SIPHER", "color": 6583435 },
  "roles": [
    { "name": "Admin", "color": 16096779, "hoist": true, "mentionable": false, "permissions": "8" },
    { "name": "Contributor", "color": 9133302, "hoist": true, "mentionable": true, "permissions": "0" },
    { "name": "Bounty Hunter", "color": 1357990, "hoist": true, "mentionable": true, "permissions": "0" },
    { "name": "Community", "color": 9741240, "hoist": false, "mentionable": false, "permissions": "0" }
  ],
  "cleanup_defaults": {
    "delete_voice_channels": ["General"],
    "delete_empty_categories": ["Text Channels", "Voice Channels"]
  },
  "categories": [
    {
      "name": "📌 START HERE",
      "overwrites": [{ "role": "@everyone", "deny": "309237647360" }],
      "channels": [
        { "name": "rules", "type": 0, "topic": "Read + accept to unlock the server. The team will NEVER DM you first." },
        { "name": "announcements", "type": 5, "topic": "Releases, milestones, bounty launches. Follow to mirror into your own server." },
        { "name": "resources", "type": 0, "topic": "Docs, SDK, app, blog — everything you need to build." }
      ]
    },
    {
      "name": "💬 COMMUNITY",
      "channels": [
        { "name": "general", "type": 0, "topic": "Privacy, Solana, Web3, and everything SIP." },
        { "name": "ideas", "type": 0, "topic": "Feature requests + use cases. The best ideas become issues (and bounties)." }
      ]
    },
    {
      "name": "🔧 DEVELOPMENT",
      "channels": [
        { "name": "dev-chat", "type": 0, "topic": "SDK questions, integration help. Share code, get unblocked." },
        { "name": "bug-reports", "type": 0, "topic": "Bugs → here or GitHub issues. Security vulns → SECURITY.md (private), never here." }
      ]
    },
    {
      "name": "🏆 BOUNTIES",
      "channels": [
        { "name": "bounties", "type": 0, "topic": "Active Superteam Earn bounties, submissions, winners." }
      ]
    },
    {
      "name": "🤖 MACHINE",
      "channels": [
        { "name": "bot-commands", "type": 0, "topic": "Bot playground. HERALD lands here in v2." },
        { "name": "mod-log", "type": 0, "topic": "AutoMod flags + Discord community notices. Staff only.", "overwrites": [{ "role": "@everyone", "deny": "1024" }] }
      ]
    }
  ],
  "automod": [
    { "name": "Spam (preset)", "event_type": 1, "trigger_type": 3, "actions": [{ "type": 1 }] },
    { "name": "Keyword presets", "event_type": 1, "trigger_type": 4, "trigger_metadata": { "presets": [2, 3], "allow_list": [] }, "actions": [{ "type": 1 }] },
    { "name": "Mention spam", "event_type": 1, "trigger_type": 5, "trigger_metadata": { "mention_total_limit": 5, "mention_raid_protection_enabled": true }, "actions": [{ "type": 1 }, { "type": 2, "alert_channel": "mod-log" }] },
    {
      "name": "Wallet-drainer phrases", "event_type": 1, "trigger_type": 1,
      "trigger_metadata": { "keyword_filter": ["*free nitro*", "*nitro giveaway*", "*claim your airdrop*", "*airdrop claim*", "*connect your wallet*", "*verify your wallet*", "*wallet verification*", "*validate your wallet*", "*synchronize your wallet*", "*dm me to claim*", "*first come first serve*"] },
      "exempt_channels": ["dev-chat", "bug-reports"], "exempt_roles": ["Admin"],
      "actions": [{ "type": 1, "custom_message": "Blocked by SIP AutoMod — see #rules. The team never DMs first." }, { "type": 2, "alert_channel": "mod-log" }]
    }
  ],
  "welcome_screen": {
    "description": "The privacy standard for Web3 — stealth addresses, hidden amounts, viewing keys.",
    "channels": [
      { "channel": "rules", "description": "Start here — accept to unlock the server", "emoji": "📌" },
      { "channel": "general", "description": "Say salam 👋 — main chat", "emoji": "💬" },
      { "channel": "dev-chat", "description": "Get integration help", "emoji": "🔧" },
      { "channel": "bounties", "description": "Paid work, live soon", "emoji": "🏆" }
    ]
  },
  "onboarding": {
    "default_channels": ["rules", "announcements", "resources", "general", "ideas", "dev-chat", "bug-reports", "bounties"],
    "prompt": {
      "title": "What brings you to SIP?",
      "options": [
        { "title": "Here for bounties", "description": "Paid work on Superteam Earn", "emoji": "🏆", "roles": ["Bounty Hunter"], "channels": ["bounties"] },
        { "title": "Building with the SDK", "description": "Integrating privacy into my app", "emoji": "🔧", "roles": ["Community"], "channels": ["dev-chat"] },
        { "title": "Exploring privacy", "description": "Learning what SIP is about", "emoji": "🔒", "roles": ["Community"], "channels": ["general"] }
      ]
    }
  },
  "seeds": [
    {
      "channel": "rules", "pin": true,
      "content": "**Welcome to SIP Protocol** 🔒\nAccepting these rules unlocks the server.\n\n**1. Be respectful.** No harassment, hate speech, or personal attacks.\n**2. No scams, spam, or shilling.** No unsolicited promo, no \"DM me\" bait. Wallet-drainer links = instant ban.\n**3. English only** — so everyone can follow along.\n**4. No financial advice.** SIP is privacy infrastructure; nobody here tells you what to buy.\n**5. Security:** the team will NEVER DM you first and will NEVER ask you to connect a wallet or share keys. Report impersonators in <#bug-reports>.\n**6. Vulnerabilities:** report privately via GitHub Security advisories (SECURITY.md) — never in public channels."
    },
    {
      "channel": "announcements", "pin": false,
      "content": "**The SIP Protocol Discord is live** 🔒\n\nSIP (Shielded Intents Protocol) is the privacy standard for Web3 — stealth addresses, hidden amounts, viewing keys for compliance. One toggle to make transactions private.\n\n**Start here:**\n→ What is your wallet leaking? https://app.sip-protocol.org/privacy-score\n→ Build with the SDK: https://docs.sip-protocol.org\n→ <#dev-chat> for integration help · <#bounties> for paid work (4 bounties launching on Superteam Earn)\n\nYour wallet is public. Let's fix that — welcome in."
    },
    {
      "channel": "resources", "pin": true,
      "content": "**SIP Protocol — Resources** 📖\n\n🌐 Website: https://sip-protocol.org\n🚀 App: https://app.sip-protocol.org\n🔍 Privacy Score: https://app.sip-protocol.org/privacy-score\n📚 Docs: https://docs.sip-protocol.org\n📦 SDK: https://www.npmjs.com/package/@sip-protocol/sdk\n🐙 GitHub: https://github.com/sip-protocol\n✍️ Blog: https://blog.sip-protocol.org\n🐦 X: https://x.com/sipprotocol"
    },
    {
      "channel": "bounties", "pin": false,
      "content": "**4 bounties are launching on Superteam Earn** 🏆\n**Write a Thread** · **Build a Privacy App with the SDK** · **Technical Deep-Dive** · **Bug Bounty**\nPrizes + links land here — watch <#announcements>."
    }
  ],
  "invite": { "channel": "general" }
}
```

Note: seed `content` uses `<#channel-name>` placeholders — `setup.js` rewrites them to real `<#channelId>` mentions before posting (Step covered in Task 3).

- [ ] **Step 2: Validate JSON parses**

```bash
cd ~/local-dev/.github && node -e "JSON.parse(require('fs').readFileSync('discord/manifest.json','utf8')); console.log('manifest OK')"
```

Expected: `manifest OK`

- [ ] **Step 3: Commit**

```bash
git add discord/manifest.json discord/assets/logo-512.png
git commit -m "feat(discord): server manifest + icon asset"
```

---

### Task 2: `lib.js` — pure planning library (TDD)

**Files:**
- Create: `~/local-dev/.github/discord/lib.js`
- Test: `~/local-dev/.github/discord/test/lib.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// discord/test/lib.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions,
} = require('../lib.js')

const manifest = JSON.parse(require('fs').readFileSync(`${__dirname}/../manifest.json`, 'utf8'))
const GUILD_ID = '999000'

function liveFromManifest() {
  // Synthesize a live state that exactly matches the manifest (for idempotency tests)
  const roles = manifest.roles.map((r, i) => ({ id: `r${i}`, name: r.name, color: r.color, hoist: r.hoist, managed: false, permissions: r.permissions }))
  const channels = []
  let cid = 0
  for (const cat of manifest.categories) {
    const catId = `cat${cid++}`
    channels.push({ id: catId, type: 4, name: cat.name, parent_id: null })
    for (const ch of cat.channels) {
      channels.push({ id: `ch${cid++}`, type: ch.type, name: ch.name, topic: ch.topic, parent_id: catId })
    }
  }
  return { roles, channels }
}

test('planRoles creates all roles on empty live, none on matching live', () => {
  const empty = planRoles(manifest.roles, [])
  assert.equal(empty.create.length, 4)
  const live = liveFromManifest()
  const full = planRoles(manifest.roles, live.roles)
  assert.equal(full.create.length, 0)
  assert.equal(full.update.length, 0)
})

test('planRoles updates color drift', () => {
  const live = liveFromManifest()
  live.roles[0].color = 0
  const plan = planRoles(manifest.roles, live.roles)
  assert.equal(plan.update.length, 1)
  assert.equal(plan.update[0].patch.color, manifest.roles[0].color)
})

test('planCategories + planChannels create everything on empty live', () => {
  const cats = planCategories(manifest.categories, [])
  assert.equal(cats.create.length, 5)
  const chans = planChannels(manifest.categories, [], () => null)
  assert.equal(chans.create.length, 10)
})

test('planChannels is empty on manifest-shaped live (idempotency)', () => {
  const live = liveFromManifest()
  const chans = planChannels(manifest.categories, live.channels, name => live.roles.find(r => r.name === name)?.id)
  assert.equal(chans.create.length, 0)
  assert.equal(chans.update.length, 0)
})

test('planChannels flags announcements type drift 0→5 as update', () => {
  const live = liveFromManifest()
  const ann = live.channels.find(c => c.name === 'announcements')
  ann.type = 0
  const chans = planChannels(manifest.categories, live.channels, () => null)
  assert.equal(chans.update.length, 1)
  assert.equal(chans.update[0].patch.type, 5)
})

test('buildOverwrites maps @everyone to guild id with exact deny string', () => {
  const ows = buildOverwrites(
    [{ role: '@everyone', deny: '309237647360' }],
    { guildId: GUILD_ID, roleId: () => null }
  )
  assert.deepEqual(ows, [{ id: GUILD_ID, type: 0, allow: '0', deny: '309237647360' }])
})

test('planAutomod resolves alert channel + exempts, creates missing only', () => {
  const ids = { channelId: n => ({ 'mod-log': 'ML1', 'dev-chat': 'DC1', 'bug-reports': 'BR1' })[n], roleId: n => ({ Admin: 'AD1' })[n] }
  const plan = planAutomod(manifest.automod, [], ids)
  assert.equal(plan.create.length, 4)
  const drainer = plan.create.find(r => r.name === 'Wallet-drainer phrases')
  assert.deepEqual(drainer.exempt_channels, ['DC1', 'BR1'])
  assert.deepEqual(drainer.exempt_roles, ['AD1'])
  assert.equal(drainer.actions[1].metadata.channel_id, 'ML1')
  const none = planAutomod(manifest.automod, plan.create.map(r => ({ name: r.name })), ids)
  assert.equal(none.create.length, 0)
})

test('rewriteMentions swaps <#name> for <#id>', () => {
  const out = rewriteMentions('go to <#dev-chat> or <#bounties>', n => ({ 'dev-chat': '111', bounties: '222' })[n])
  assert.equal(out, 'go to <#111> or <#222>')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/.github && node --test discord/test/
```

Expected: FAIL — `Cannot find module '../lib.js'`

- [ ] **Step 3: Implement `lib.js`**

```js
// discord/lib.js — pure planning logic, no I/O. Style: 2-space, no semicolons not enforced here
// (repo has no JS precedent; match core TS style: 2-space, no semicolons).
'use strict'

const byName = arr => new Map(arr.map(x => [x.name, x]))

function planRoles(wanted, live) {
  const liveBy = byName(live.filter(r => !r.managed))
  const create = []
  const update = []
  for (const r of wanted) {
    const cur = liveBy.get(r.name)
    if (!cur) {
      create.push({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions })
    } else {
      const patch = {}
      if (cur.color !== r.color) patch.color = r.color
      if (cur.hoist !== r.hoist) patch.hoist = r.hoist
      if (Object.keys(patch).length) update.push({ id: cur.id, name: r.name, patch })
    }
  }
  return { create, update }
}

function planCategories(categories, liveChannels) {
  const liveCats = byName(liveChannels.filter(c => c.type === 4))
  const create = categories.filter(c => !liveCats.has(c.name)).map((c, i) => ({ name: c.name, position: i }))
  return { create }
}

function buildOverwrites(overwrites, ids) {
  return (overwrites || []).map(ow => ({
    id: ow.role === '@everyone' ? ids.guildId : ids.roleId(ow.role),
    type: 0,
    allow: ow.allow || '0',
    deny: ow.deny || '0',
  }))
}

function planChannels(categories, liveChannels, roleId) {
  const liveBy = byName(liveChannels.filter(c => c.type !== 4))
  const liveCats = byName(liveChannels.filter(c => c.type === 4))
  const create = []
  const update = []
  for (const cat of categories) {
    for (const ch of cat.channels) {
      const cur = liveBy.get(ch.name)
      if (!cur) {
        create.push({ category: cat.name, spec: ch, overwrites: ch.overwrites || null })
        continue
      }
      const patch = {}
      if (ch.type === 5 && cur.type === 0) patch.type = 5 // announcement upgrade post-COMMUNITY
      if ((cur.topic || '') !== ch.topic) patch.topic = ch.topic
      const wantCat = liveCats.get(cat.name)
      if (wantCat && cur.parent_id !== wantCat.id) patch.parent_id = wantCat.id
      if (Object.keys(patch).length) update.push({ id: cur.id, name: ch.name, patch })
    }
  }
  return { create, update }
}

function planAutomod(rules, liveRules, ids) {
  const liveBy = byName(liveRules)
  const create = []
  for (const r of rules) {
    if (liveBy.has(r.name)) continue
    create.push({
      name: r.name,
      event_type: r.event_type,
      trigger_type: r.trigger_type,
      ...(r.trigger_metadata ? { trigger_metadata: r.trigger_metadata } : {}),
      actions: r.actions.map(a => a.type === 2
        ? { type: 2, metadata: { channel_id: ids.channelId(a.alert_channel) } }
        : { type: 1, ...(a.custom_message ? { metadata: { custom_message: a.custom_message } } : {}) }),
      enabled: true,
      exempt_channels: (r.exempt_channels || []).map(ids.channelId),
      exempt_roles: (r.exempt_roles || []).map(ids.roleId),
    })
  }
  return { create }
}

function rewriteMentions(content, channelId) {
  return content.replace(/<#([a-z0-9-]+)>/g, (m, name) => {
    const id = channelId(name)
    return id ? `<#${id}>` : m
  })
}

module.exports = { planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/local-dev/.github && node --test discord/test/
```

Expected: `pass 8` / `fail 0`

- [ ] **Step 5: Commit**

```bash
git add discord/lib.js discord/test/lib.test.js
git commit -m "feat(discord): pure planning library with tests"
```

---

### Task 3: `setup.js` — apply CLI (+ `--plan` dry-run) and README

**Files:**
- Create: `~/local-dev/.github/discord/setup.js`
- Create: `~/local-dev/.github/discord/README.md`

No unit tests for this file — it is thin I/O orchestration over the tested `lib.js`; its verification is `--plan` output, `verify.js` (Task 4), and the live checks in Task 6.

- [ ] **Step 1: Implement `setup.js`**

```js
#!/usr/bin/env node
// discord/setup.js — reconcile manifest.json → live Discord guild. Idempotent.
// Usage: node setup.js [--plan]   Env: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
'use strict'

const fs = require('fs')
const path = require('path')
const { planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions } = require('./lib.js')

const TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD = process.env.DISCORD_GUILD_ID
const DRY = process.argv.includes('--plan')
const API = 'https://discord.com/api/v10'

if (!TOKEN || !GUILD) {
  console.error('Missing env. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in ~/Documents/secret/.env (zshrc auto-loads).')
  process.exit(1)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function api(method, route, body, extra = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API}${route}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json', 'X-Audit-Log-Reason': 'SIP discord/setup.js', ...extra.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}))
      const wait = Math.ceil((data.retry_after || 1) * 1000)
      console.log(`  rate-limited, waiting ${wait}ms`)
      await sleep(wait)
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`${method} ${route} → ${res.status}: ${text}`)
    }
    if (res.status === 204) return null
    return res.json()
  }
  throw new Error(`${method} ${route} → still rate-limited after 5 attempts`)
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))
  const warnings = []
  const log = (...a) => console.log(...a)

  // ---- read live state
  const guild = await api('GET', `/guilds/${GUILD}`)
  let roles = await api('GET', `/guilds/${GUILD}/roles`)
  let channels = await api('GET', `/guilds/${GUILD}/channels`)
  const automodLive = await api('GET', `/guilds/${GUILD}/auto-moderation/rules`)
  log(`Guild: ${guild.name} (${GUILD}) — ${channels.length} channels, ${roles.length} roles live`)

  const roleId = name => roles.find(r => r.name === name && !r.managed)?.id
  const channelId = name => channels.find(c => c.name === name && c.type !== 4)?.id
  const categoryId = name => channels.find(c => c.name === name && c.type === 4)?.id

  // ---- compute plan
  const pRoles = planRoles(manifest.roles, roles)
  const pCats = planCategories(manifest.categories, channels)
  const pChans = planChannels(manifest.categories, channels, roleId)
  const ids = { guildId: GUILD, roleId, channelId }
  const pAuto = planAutomod(manifest.automod, automodLive, { channelId, roleId })
  const everyoneLive = roles.find(r => r.id === GUILD)
  const needEveryone = everyoneLive.permissions !== manifest.guild.everyone_permissions

  log(`\nPLAN: roles +${pRoles.create.length}/~${pRoles.update.length} · categories +${pCats.create.length} · channels +${pChans.create.length}/~${pChans.update.length} · automod +${pAuto.create.length} · @everyone perms ${needEveryone ? 'PATCH' : 'ok'}`)
  pRoles.create.forEach(r => log(`  + role ${r.name}`))
  pCats.create.forEach(c => log(`  + category ${c.name}`))
  pChans.create.forEach(c => log(`  + channel #${c.spec.name} (${c.category})`))
  pChans.update.forEach(c => log(`  ~ channel #${c.name} ${JSON.stringify(c.patch)}`))
  pAuto.create.forEach(r => log(`  + automod ${r.name}`))
  if (DRY) { log('\n--plan: no changes applied.'); return }

  // ---- 1. @everyone base permissions
  if (needEveryone) {
    await api('PATCH', `/guilds/${GUILD}/roles/${GUILD}`, { permissions: manifest.guild.everyone_permissions })
    log('✓ @everyone base permissions')
  }

  // ---- 2. roles (then refresh)
  for (const r of pRoles.create) { await api('POST', `/guilds/${GUILD}/roles`, r); log(`✓ role ${r.name}`) }
  for (const u of pRoles.update) { await api('PATCH', `/guilds/${GUILD}/roles/${u.id}`, u.patch); log(`✓ role ~${u.name}`) }
  roles = await api('GET', `/guilds/${GUILD}/roles`)
  const botRole = roles.find(r => r.managed && r.name === manifest.bot_role.name)
  if (botRole && botRole.color !== manifest.bot_role.color) {
    await api('PATCH', `/guilds/${GUILD}/roles/${botRole.id}`, { color: manifest.bot_role.color }).catch(e => warnings.push(`bot role color: ${e.message}`))
  }

  // ---- 3. categories (then refresh)
  for (const c of pCats.create) { await api('POST', `/guilds/${GUILD}/channels`, { name: c.name, type: 4, position: c.position }); log(`✓ category ${c.name}`) }
  channels = await api('GET', `/guilds/${GUILD}/channels`)

  // ---- 4. channels (create as type 0; announcement upgrade happens post-COMMUNITY)
  for (const c of planChannels(manifest.categories, channels, roleId).create) {
    const payload = {
      name: c.spec.name,
      type: 0,
      topic: c.spec.topic,
      parent_id: categoryId(c.category),
      permission_overwrites: buildOverwrites(c.overwrites, ids),
    }
    await api('POST', `/guilds/${GUILD}/channels`, payload)
    log(`✓ channel #${c.spec.name}`)
  }
  channels = await api('GET', `/guilds/${GUILD}/channels`)

  // ---- 4b. category-level overwrites (apply to category channels themselves)
  for (const cat of manifest.categories) {
    if (!cat.overwrites) continue
    const id = categoryId(cat.name)
    for (const ow of buildOverwrites(cat.overwrites, ids)) {
      await api('PUT', `/channels/${id}/permissions/${ow.id}`, { type: ow.type, allow: ow.allow, deny: ow.deny })
    }
    log(`✓ overwrites on category ${cat.name}`)
  }
  // child channels of overwritten categories sync on create (parent set at create time);
  // explicit per-channel overwrites (mod-log) were included in the create payload.

  // ---- 5. guild settings
  await api('PATCH', `/guilds/${GUILD}`, {
    verification_level: manifest.guild.verification_level,
    default_message_notifications: manifest.guild.default_message_notifications,
  })
  log('✓ guild settings (verification, notifications)')

  // ---- 6. COMMUNITY
  if (!guild.features.includes('COMMUNITY')) {
    try {
      await api('PATCH', `/guilds/${GUILD}`, {
        features: [...guild.features, 'COMMUNITY'],
        rules_channel_id: channelId(manifest.guild.rules_channel),
        public_updates_channel_id: channelId(manifest.guild.public_updates_channel),
      })
      log('✓ COMMUNITY enabled')
    } catch (e) {
      console.error(`COMMUNITY enable failed (${e.message}).\nFallback: toggle Server Settings → Enable Community in the UI, then re-run setup.js.`)
      process.exit(2)
    }
  }

  // ---- 7. announcements → type 5
  for (const u of planChannels(manifest.categories, channels, roleId).update) {
    await api('PATCH', `/channels/${u.id}`, u.patch)
    log(`✓ channel ~#${u.name} ${JSON.stringify(u.patch)}`)
  }

  // ---- 8. icon
  if (!guild.icon) {
    const png = fs.readFileSync(path.join(__dirname, manifest.guild.icon_file))
    await api('PATCH', `/guilds/${GUILD}`, { icon: `data:image/png;base64,${png.toString('base64')}` })
    log('✓ icon uploaded')
  }

  // ---- 9. automod
  for (const r of planAutomod(manifest.automod, automodLive, { channelId, roleId }).create) {
    await api('POST', `/guilds/${GUILD}/auto-moderation/rules`, r).catch(e => warnings.push(`automod ${r.name}: ${e.message}`))
    log(`✓ automod ${r.name}`)
  }

  // ---- 10. welcome screen
  await api('PATCH', `/guilds/${GUILD}/welcome-screen`, {
    enabled: true,
    description: manifest.welcome_screen.description,
    welcome_channels: manifest.welcome_screen.channels.map(w => ({
      channel_id: channelId(w.channel), description: w.description, emoji_name: w.emoji,
    })),
  }).then(() => log('✓ welcome screen')).catch(e => warnings.push(`welcome screen: ${e.message}`))

  // ---- 11. onboarding
  await api('PUT', `/guilds/${GUILD}/onboarding`, {
    prompts: [{
      id: '0', type: 0, title: manifest.onboarding.prompt.title,
      single_select: true, required: true, in_onboarding: true,
      options: manifest.onboarding.prompt.options.map(o => ({
        title: o.title, description: o.description, emoji_name: o.emoji,
        role_ids: o.roles.map(roleId), channel_ids: o.channels.map(channelId),
      })),
    }],
    default_channel_ids: manifest.onboarding.default_channels.map(channelId),
    enabled: true, mode: 0,
  }).then(() => log('✓ onboarding')).catch(e => warnings.push(`onboarding: ${e.message}`))

  // ---- 12. cleanup Discord-default cruft (scoped, exact-name, voice/empty-category only)
  for (const name of manifest.cleanup_defaults.delete_voice_channels) {
    const v = channels.find(c => c.type === 2 && c.name === name)
    if (v) { await api('DELETE', `/channels/${v.id}`); log(`✓ deleted default voice #${name}`) }
  }
  channels = await api('GET', `/guilds/${GUILD}/channels`)
  for (const name of manifest.cleanup_defaults.delete_empty_categories) {
    const cat = channels.find(c => c.type === 4 && c.name === name)
    if (cat && !channels.some(c => c.parent_id === cat.id)) {
      await api('DELETE', `/channels/${cat.id}`)
      log(`✓ deleted empty default category ${name}`)
    }
  }

  // ---- 13. seed messages (only into empty channels) + pins
  for (const seed of manifest.seeds) {
    const id = channelId(seed.channel)
    const existing = await api('GET', `/channels/${id}/messages?limit=1`)
    if (existing.length) { log(`· #${seed.channel} already has messages, skipping seed`); continue }
    const msg = await api('POST', `/channels/${id}/messages`, { content: rewriteMentions(seed.content, channelId) })
    if (seed.pin) await api('PUT', `/channels/${id}/pins/${msg.id}`)
    log(`✓ seeded #${seed.channel}${seed.pin ? ' (pinned)' : ''}`)
  }

  // ---- 14. permanent invite (reuse if one already exists)
  const invites = await api('GET', `/guilds/${GUILD}/invites`)
  let invite = invites.find(i => i.max_age === 0 && i.channel?.id === channelId(manifest.invite.channel))
  if (!invite) invite = await api('POST', `/channels/${channelId(manifest.invite.channel)}/invites`, { max_age: 0, max_uses: 0, unique: true })
  log(`\n✦ INVITE: https://discord.gg/${invite.code}`)

  if (warnings.length) {
    console.error(`\nCompleted with ${warnings.length} warning(s):`)
    warnings.forEach(w => console.error(`  ⚠ ${w}`))
    process.exit(2)
  }
  log('\nDone. Run verify.js to confirm drift-free.')
}

main().catch(e => { console.error(e.message); process.exit(1) })
```

- [ ] **Step 2: Write `discord/README.md`**

```markdown
# SIP Protocol Discord — infra-as-code

Declarative setup for the community server. `manifest.json` is the desired state;
`setup.js` reconciles live state toward it (create-if-missing, update drift,
never deletes anything except the scoped Discord-default cruft listed in
`cleanup_defaults`). Idempotent — re-run safely any time.

## Run

Requires Node ≥18 and env (in `~/Documents/secret/.env`):
`DISCORD_BOT_TOKEN` (SIPHER bot, Administrator) · `DISCORD_GUILD_ID`

    node discord/setup.js --plan   # dry-run: print what would change
    node discord/setup.js          # apply
    node discord/verify.js         # GET-only drift check (exit 1 on drift)
    node --test discord/test/      # unit tests for the planning library

## Files

- `manifest.json` — guild settings, roles, categories/channels, AutoMod, welcome
  screen, onboarding, seed messages, invite spec
- `lib.js` — pure planning functions (tested)
- `setup.js` — REST apply (rate-limit aware, actionable errors, exit 2 = warnings)
- `verify.js` — drift report

Spec: sip-protocol/docs/superpowers/specs/2026-06-10-discord-server-design.md
```

- [ ] **Step 3: Syntax-check + unit tests still green**

```bash
cd ~/local-dev/.github && node --check discord/setup.js && node --test discord/test/
```

Expected: no syntax error; `pass 8`.

- [ ] **Step 4: Commit**

```bash
git add discord/setup.js discord/README.md
git commit -m "feat(discord): manifest reconciliation CLI with dry-run"
```

---

### Task 4: `verify.js` — drift check

**Files:**
- Create: `~/local-dev/.github/discord/verify.js`

- [ ] **Step 1: Implement**

```js
#!/usr/bin/env node
// discord/verify.js — GET-only: report drift between manifest and live guild. Exit 1 on drift.
'use strict'

const fs = require('fs')
const path = require('path')
const { planRoles, planCategories, planChannels, planAutomod } = require('./lib.js')

const TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD = process.env.DISCORD_GUILD_ID
const API = 'https://discord.com/api/v10'

if (!TOKEN || !GUILD) {
  console.error('Missing env. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID.')
  process.exit(1)
}

async function get(route) {
  const res = await fetch(`${API}${route}`, { headers: { Authorization: `Bot ${TOKEN}` } })
  if (!res.ok) throw new Error(`GET ${route} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))
  const guild = await get(`/guilds/${GUILD}`)
  const roles = await get(`/guilds/${GUILD}/roles`)
  const channels = await get(`/guilds/${GUILD}/channels`)
  const automod = await get(`/guilds/${GUILD}/auto-moderation/rules`)
  const welcome = await get(`/guilds/${GUILD}/welcome-screen`).catch(() => null)

  const roleId = name => roles.find(r => r.name === name && !r.managed)?.id
  const channelId = name => channels.find(c => c.name === name && c.type !== 4)?.id

  const drift = []
  const pR = planRoles(manifest.roles, roles)
  const pC = planCategories(manifest.categories, channels)
  const pCh = planChannels(manifest.categories, channels, roleId)
  const pA = planAutomod(manifest.automod, automod, { channelId, roleId })
  pR.create.forEach(r => drift.push(`missing role: ${r.name}`))
  pR.update.forEach(u => drift.push(`role drift: ${u.name} ${JSON.stringify(u.patch)}`))
  pC.create.forEach(c => drift.push(`missing category: ${c.name}`))
  pCh.create.forEach(c => drift.push(`missing channel: #${c.spec.name}`))
  pCh.update.forEach(u => drift.push(`channel drift: #${u.name} ${JSON.stringify(u.patch)}`))
  pA.create.forEach(r => drift.push(`missing automod: ${r.name}`))
  if (!guild.features.includes('COMMUNITY')) drift.push('COMMUNITY feature not enabled')
  if (guild.verification_level !== manifest.guild.verification_level) drift.push(`verification_level ${guild.verification_level} ≠ ${manifest.guild.verification_level}`)
  if (!guild.icon) drift.push('no server icon')
  if (!welcome || !welcome.welcome_channels?.length) drift.push('welcome screen not configured')

  if (drift.length) {
    console.error(`DRIFT (${drift.length}):`)
    drift.forEach(d => console.error(`  ✗ ${d}`))
    process.exit(1)
  }
  console.log('✓ live state matches manifest')
}

main().catch(e => { console.error(e.message); process.exit(1) })
```

- [ ] **Step 2: Syntax check + commit**

```bash
cd ~/local-dev/.github && node --check discord/verify.js && git add discord/verify.js && git commit -m "feat(discord): drift verifier"
```

---

### Task 5: Browser bootstrap (Chrome-MCP cowork — RECTOR present)

**Files:**
- Modify: `~/Documents/secret/.env` (append 2 lines — never committed)

Tools: Chrome MCP (`tabs_create_mcp`, `navigate`, `read_page`, `computer` click/type, `get_page_text`). Re-verify the active Discord account before every action if RECTOR is also driving the browser.

- [ ] **Step 1: Confirm login + existing-server check**

Open a new MCP tab → `https://discord.com/channels/@me`. If a login wall appears → RECTOR logs in (CIPHER never enters credentials). Read the left guild rail: if a guild named "SIP Protocol" exists, click it and capture `DISCORD_GUILD_ID` from the URL (`discord.com/channels/{guildId}/…`) → skip to Step 3.

- [ ] **Step 2: Create the server (skip if exists)**

Click `+` (Add a Server) → **Create My Own** → **For a club or community** → name `SIP Protocol` → skip icon upload (script PATCHes it) → **Create**. Capture the guild id from the URL.

- [ ] **Step 3: Create the SIPHER bot application**

Navigate `https://discord.com/developers/applications` → **New Application** → name `SIPHER` → the **ToS checkbox + Create click is RECTOR's** (or his explicit in-chat go-ahead). On the app page: Settings → **Bot**:
- **Public Bot → OFF** (only RECTOR can invite it)
- **Reset Token** → (possible 2FA/captcha → RECTOR) → token displays once → CIPHER captures it.

- [ ] **Step 4: Store secrets**

```bash
cat >> ~/Documents/secret/.env <<EOF
DISCORD_BOT_TOKEN=<captured token>
DISCORD_GUILD_ID=<captured guild id>
EOF
```

Then `exec zsh` no — just verify a fresh shell sees them: `zsh -ic 'echo ${DISCORD_GUILD_ID:?missing}'` → prints the id.

- [ ] **Step 5: Authorize the bot into the guild**

Developer Portal → OAuth2 → URL Generator → scopes `bot` + `applications.commands` → Bot Permissions: **Administrator** → copy the generated URL → open it in the tab → select server **SIP Protocol** → **Authorize click is RECTOR's** (or explicit in-chat go-ahead) → captcha if shown → RECTOR.

- [ ] **Step 6: Confirm**

In the server, member list shows **SIPHER** with a BOT tag. API double-check:

```bash
zsh -ic 'curl -s -H "Authorization: Bot $DISCORD_BOT_TOKEN" https://discord.com/api/v10/guilds/$DISCORD_GUILD_ID | head -c 200'
```

Expected: JSON starting with the guild `id` + `name: "SIP Protocol"`.

---

### Task 6: Live run + verification

- [ ] **Step 1: Dry-run**

```bash
cd ~/local-dev/.github && zsh -ic 'node discord/setup.js --plan'
```

Expected: plan lists +4 roles, +5 categories, +9–10 channels (general may already exist from server creation), +4 automod rules. Review output — nothing unexpected.

- [ ] **Step 2: Apply**

```bash
zsh -ic 'node discord/setup.js'
```

Expected: ✓ lines for each phase, final `✦ INVITE: https://discord.gg/<code>` and `Done.` (exit 0). If exit 2: read warnings, fix (welcome/onboarding are the likely culprits — re-run after any manual fallback noted in the error).

- [ ] **Step 3: Verify drift-free**

```bash
zsh -ic 'node discord/verify.js'
```

Expected: `✓ live state matches manifest`

- [ ] **Step 4: Manual verification tour (Chrome MCP + RECTOR)**

1. Reload Discord tab — categories/channels ordered per manifest, icon visible.
2. Server Settings → Onboarding preview renders the question + welcome screen.
3. AutoMod live test: RECTOR (Admin is exempt — so use the test from a logged-out lens or temporarily without role… simplest: post `free nitro giveaway` in `#general` from RECTOR's account *after temporarily removing Admin role*, or accept the rule-exists check in Server Settings → AutoMod showing 4 active rules). Minimum bar: 4 rules listed active + alert channel = #mod-log.
4. Invite link resolves in an incognito window (RECTOR: open `https://discord.gg/<code>` logged-out → server preview shows).
5. Screenshot the final state for the T3 report evidence.

- [ ] **Step 5: Commit any manifest tweaks made during the run**

```bash
cd ~/local-dev/.github && git status --short  # if manifest changed during fixes:
git add discord/ && git commit -m "fix(discord): manifest adjustments from live run"
```

---

### Task 7: `.github` repo PR — scripts + org README Discord badge

**Files:**
- Modify: `~/local-dev/.github/profile/README.md` (2 badge edits)

- [ ] **Step 1: Add Discord badge to the header badge row**

In `profile/README.md`, after the `[![Docs]…` line in the top badge block, add (replace `<code>` with the real invite code):

```markdown
[![Discord](https://img.shields.io/badge/Discord-Join_the_community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/<code>)
```

- [ ] **Step 2: Add Discord badge to the bottom badge row**

After the `[![Website]…` line in the closing `<div align="center">` block:

```markdown
[![Discord](https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/<code>)
```

- [ ] **Step 3: Commit, push, PR**

```bash
cd ~/local-dev/.github
git add profile/README.md && git commit -m "docs: link the community Discord from the org profile"
git push -u origin feat/discord-server
gh pr create --title "feat: Discord community server — infra-as-code setup + org profile link" \
  --body "Manifest-driven Discord setup (spec: sip-protocol docs/superpowers/specs/2026-06-10-discord-server-design.md) — manifest, tested planning lib, idempotent setup CLI, drift verifier, org README badges. Server is live; invite: https://discord.gg/<code>"
```

- [ ] **Step 4: Merge (RECTOR or on his go-ahead) + confirm org profile renders the badge**

```bash
gh pr merge --merge --delete-branch
```

Then open `https://github.com/sip-protocol` → Discord badge visible.

---

### Task 8: sip-website footer PR

**Files:**
- Modify: `~/local-dev/sip-website/src/components/layout/footer.tsx`
- Check: footer tests (`grep -ril footer ~/local-dev/sip-website/tests ~/local-dev/sip-website/src --include='*.test.*'`)

- [ ] **Step 1: Sync + branch**

```bash
cd ~/local-dev/sip-website
git fetch origin main && git checkout -B feat/discord-footer-link origin/main
pnpm install --frozen-lockfile
```

- [ ] **Step 2: Add the Discord link to `footerLinks.community.links`**

In `src/components/layout/footer.tsx` (replace `<code>` with the real invite code):

```tsx
  community: {
    title: 'Community',
    links: [
      { href: 'https://github.com/sip-protocol/sip-protocol', label: 'GitHub', external: true },
      { href: 'https://x.com/sipprotocol', label: 'Twitter', external: true },
      { href: 'https://discord.gg/<code>', label: 'Discord', external: true },
    ],
  },
```

- [ ] **Step 3: Add the Discord icon to the social row**

lucide-react has no Discord glyph — add a local brand-SVG component (same pattern as the lucide icons: `currentColor`, `h-5 w-5`). Below the imports in `footer.tsx`:

```tsx
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}
```

And in the Social Links div, after the Twitter anchor:

```tsx
                <a
                  href="https://discord.gg/<code>"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Discord"
                >
                  <DiscordIcon className="h-5 w-5" />
                </a>
```

- [ ] **Step 4: Update any footer test expectations**

```bash
grep -ril footer ~/local-dev/sip-website --include='*.test.*' | grep -v node_modules
```

If a test asserts the community links array or social anchor count, add the Discord entry to the expected values (mirror how GitHub/Twitter entries are asserted).

- [ ] **Step 5: Tests + typecheck**

```bash
pnpm test -- --run && pnpm typecheck
```

Expected: all pass (157+ tests).

- [ ] **Step 6: Commit, push, PR, merge, verify live**

```bash
git add src/components/layout/footer.tsx
git commit -m "feat: add Discord community link to footer"
git push -u origin feat/discord-footer-link
gh pr create --title "feat: Discord community link in footer" --body "Adds the Discord invite (T3 gate A1) to the footer community column + social icon row. Spec: sip-protocol docs/superpowers/specs/2026-06-10-discord-server-design.md"
gh pr merge --merge --delete-branch
```

Vercel auto-deploys on merge — watch the commit status (`gh api repos/sip-protocol/sip-website/commits/main/status --jq .state` → `success`), then verify `https://sip-protocol.org` footer shows Discord (incognito).

---

### Task 9: Trackers, report gate, memory

**Files:**
- Modify: `~/.claude/sip-protocol/grants/superteam-indonesia-2026-01/reports/T3-milestone-report.md` (§2 Discord `[GATE]`, deliverable table row 3, checklist)
- Modify: `~/.claude/sip-protocol/grants/superteam-indonesia-2026-01/TRACKER.md` (weekly log)
- Modify: `~/.claude/sip-protocol/grants/GRANTS.md` (gate line)
- Modify: memory `project_superteam-grant.md` (pillar A1 → live) + `MEMORY.md` (T3_21 line)
- Push: `docs/discord-server-design` branch (spec + this plan) → PR to sip-protocol → merge

- [ ] **Step 1: Fill the T3 report Discord section** — replace §2's `[GATE]` block with the live facts: invite link, 10 channels/5 categories, member count, screenshot reference; tick the checklist gate.

- [ ] **Step 2: TRACKER.md** — add to the "Week of Jun 9-15" log: `- [x] Discord server live (manifest-driven setup in .github repo) + linked from website footer + org README`.

- [ ] **Step 3: GRANTS.md** — update the gates line: Discord ✅ → remaining: bounties → M18.

- [ ] **Step 4: Memory** — update `project_superteam-grant.md` pillar A1 to LIVE with invite + `.github/discord/` pointer; extend the MEMORY.md T3_21 line.

- [ ] **Step 5: Spec+plan PR**

```bash
cd ~/local-dev/sip-protocol && git checkout docs/discord-server-design
git add docs/superpowers/plans/2026-06-10-discord-server-setup.md
git commit -m "docs: add Discord server implementation plan"
git push -u origin docs/discord-server-design
gh pr create --title "docs: Discord server design spec + implementation plan (T3 gate A1)" --body "Brainstormed + approved design for the community Discord (structure, roles, safety, onboarding, seed content) and the manifest-driven implementation plan. Execution lives in sip-protocol/.github (discord/ toolkit)."
```

Merge on RECTOR's go-ahead (`--merge --delete-branch`).

- [ ] **Step 6: RECTOR follow-ups (out of CIPHER's hands)** — ping Superteam Indonesia with the invite; HERALD's next ecosystem draft announces the Discord (watch tomorrow's queue).

---

## Self-Review (done at write time)

- **Spec coverage:** §3 identity → T1/T6 · §4 structure → T1 · §5 roles/perms → T1/T2/T3 · §6 AutoMod → T1/T3 · §7 onboarding/welcome → T1/T3 · §8 seeds → T1 · §9 architecture → T2-T4 · §10 flow → T5/T6 · §11 wiring → T7/T8 · §12 verification → T4/T6 · §14 open items → T5 (RECTOR clicks), T9 (seeding). Gap check: none.
- **Placeholders:** `<code>`/`<captured …>` are runtime values produced by earlier tasks, listed where produced (T5 step 4, T6 step 2) — not plan gaps.
- **Type consistency:** `planRoles/planCategories/planChannels/buildOverwrites/planAutomod/rewriteMentions` named identically in tests (T2), `setup.js` (T3), `verify.js` (T4). Manifest keys consumed exactly as defined in T1.
- **Known API risk (called out, handled):** COMMUNITY-enable may be owner-gated (T3 exits 2 with the manual fallback; idempotent re-run); onboarding PUT is the most constraint-finicky endpoint (non-fatal warning + verify drift).
