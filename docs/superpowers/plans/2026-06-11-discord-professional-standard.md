# Discord Professional Standard (v1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the live SIP Discord from plain-markdown posts to a professional Components-V2 standard — git-archived `post.js` posting, reconciled seed messages, an SVG→PNG asset pipeline on the CDN, brand emojis, three automated feeds, and a committed operations playbook.

**Architecture:** The existing zero-dep IaC toolkit (`sip-protocol/.github` → `discord/`) gains a pure `templates.js` renderer (payload → CV2 component tree) shared by a new `post.js` CLI and the seed reconciler in `setup.js`. SVG sources render to PNG via a dev-only `@resvg/resvg-js` dependency; banners are served from `cdn-sip`. Feeds are webhook-based (classic embeds): a GitHub org webhook into a new `#github-feed`, a HERALD Friday-digest cross-post from sipher's poller, and a weekly drift-check GitHub Action alerting `#mod-log`.

**Tech Stack:** Node ≥18 (zero runtime deps, `node:test`), `@resvg/resvg-js` (dev-only), Discord REST API v10 (Components V2, flag `1<<15`), GitHub Actions, sipher = TypeScript + vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-discord-professional-standard-design.md` (sip-protocol repo)

**Repos & branches (work in the existing clones, branch from `origin/main`):**

| Repo | Clone | Branch |
|------|-------|--------|
| `sip-protocol/.github` | `~/local-dev/sip-dot-github` | `feat/discord-professional-standard` |
| `sip-protocol/cdn-sip` | `~/local-dev/cdn-sip` | `feat/discord-assets` |
| `sip-protocol/sipher` | `~/local-dev/sipher` | `feat/herald-discord-digest` |

**Execution order matters:** Tasks 1–12 (.github code + assets, no live writes) → Task 13 (cdn-sip PR merged, banner URL live) → Task 14 (live run against the guild) → Task 15 (.github PR + org webhook + secrets) → Task 16 (sipher) → Task 17 (close-out). Live-API tasks (14, 15) need `DISCORD_BOT_TOKEN`/`DISCORD_GUILD_ID` from `~/Documents/secret/.env` (`set -a; . ~/Documents/secret/.env; set +a`).

**Two RECTOR checkpoints (from spec):** eyeball rendered emoji/banner art (Task 10) BEFORE upload; eyeball the reskinned server (Task 14).

---

### Task 1: Toolkit scaffolding — branch, package.json, shared `api.js`

**Files:**
- Create: `discord/api.js`, `discord/package.json`, `discord/.gitignore`
- Modify: `discord/setup.js` (use shared api), `discord/verify.js` (use shared api)

- [ ] **Step 1: Branch from origin/main**

```bash
cd ~/local-dev/sip-dot-github
git remote -v   # MUST show sip-protocol/.github (clone-trap rule)
git fetch origin && git checkout -b feat/discord-professional-standard origin/main
```

- [ ] **Step 2: Create `discord/package.json` and `discord/.gitignore`**

`discord/package.json` (devDependency only — runtime tools stay zero-dep):

```json
{
  "name": "sip-discord-toolkit",
  "private": true,
  "description": "SIP Protocol Discord infra-as-code toolkit",
  "engines": { "node": ">=18" },
  "scripts": {
    "test": "node --test test/",
    "render": "node render.js"
  },
  "devDependencies": {
    "@resvg/resvg-js": "^2.6.2"
  }
}
```

`discord/.gitignore`:

```
node_modules/
out/
```

- [ ] **Step 3: Extract the shared REST helper into `discord/api.js`**

Move the `api()`/`sleep()` logic out of `setup.js` verbatim (429-aware, actionable errors), parameterizing the audit-log reason:

```js
// discord/api.js — shared Discord REST helper. 429-aware, actionable errors.
'use strict'

const API = 'https://discord.com/api/v10'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function requireEnv() {
  const TOKEN = process.env.DISCORD_BOT_TOKEN
  const GUILD = process.env.DISCORD_GUILD_ID
  if (!TOKEN || !GUILD) {
    console.error('Missing env. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in ~/Documents/secret/.env (zshrc auto-loads).')
    process.exit(1)
  }
  return { TOKEN, GUILD }
}

function makeApi(token, reason) {
  return async function api(method, route, body, extra = {}) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(`${API}${route}`, {
        method,
        headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'X-Audit-Log-Reason': reason, ...extra.headers },
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
}

module.exports = { makeApi, requireEnv }
```

- [ ] **Step 4: Rewire `setup.js` and `verify.js` to use it**

In `setup.js`: delete the inline `const TOKEN/GUILD/DRY/API` env block, `sleep`, and `async function api(...)`; replace with:

```js
const { makeApi, requireEnv } = require('./api.js')
const { TOKEN, GUILD } = requireEnv()
const DRY = process.argv.includes('--plan')
const api = makeApi(TOKEN, 'SIP discord/setup.js')
```

In `verify.js`: delete its env block and bare `get()`; replace with:

```js
const { makeApi, requireEnv } = require('./api.js')
const { TOKEN, GUILD } = requireEnv()
const api = makeApi(TOKEN, 'SIP discord/verify.js')
const get = route => api('GET', route)
```

- [ ] **Step 5: Run existing tests + syntax check**

```bash
cd ~/local-dev/sip-dot-github/discord
node --test test/ && node --check setup.js && node --check verify.js && node --check api.js
```

Expected: 8 tests pass, no syntax errors.

- [ ] **Step 6: Commit**

```bash
git add discord/api.js discord/package.json discord/.gitignore discord/setup.js discord/verify.js
git commit -m "refactor(discord): extract shared REST helper, add toolkit package.json"
```

---

### Task 2: `templates.js` — pure payload → Components V2 renderer (TDD)

**Files:**
- Create: `discord/templates.js`
- Test: `discord/test/templates.test.js`

The single source of the format standard. Message types per spec §3.2; anatomy per §3.1.

- [ ] **Step 1: Write the failing tests**

`discord/test/templates.test.js`:

```js
// Tests for the pure CV2 template renderer. Run: node --test discord/test/
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { TYPES, FLAG_COMPONENTS_V2, validatePayload, render, normalizeComponents } = require('../templates.js')

const base = { type: 'announcement', channel: 'announcements', title: 'Hello', body: 'World **bold**' }

test('TYPES defines the 5 spec types with accent colors', () => {
  assert.deepEqual(Object.keys(TYPES).sort(), ['announcement', 'bounty', 'digest', 'release', 'security'])
  assert.equal(TYPES.announcement.accent, 0x8b5cf6)
  assert.equal(TYPES.release.accent, 0x10b981)
  assert.equal(TYPES.bounty.accent, 0xf59e0b)
  assert.equal(TYPES.security.accent, 0xef4444)
  assert.equal(TYPES.digest.accent, 0x6366f1)
})

test('validatePayload: accepts a minimal announcement', () => {
  assert.deepEqual(validatePayload(base).errors, [])
})

test('validatePayload: rejects unknown type, missing fields, bad channel chars', () => {
  assert.match(validatePayload({ ...base, type: 'nope' }).errors[0], /type must be one of/)
  assert.match(validatePayload({ type: 'release', channel: 'announcements' }).errors[0], /title is required/)
  assert.match(validatePayload({ ...base, channel: 'No Spaces' }).errors[0], /channel/)
})

test('validatePayload: banner must be on cdn.sip-protocol.org over https', () => {
  assert.deepEqual(validatePayload({ ...base, banner: 'https://cdn.sip-protocol.org/discord/x.v1.png' }).errors, [])
  assert.match(validatePayload({ ...base, banner: 'https://evil.com/x.png' }).errors[0], /cdn\.sip-protocol\.org/)
  assert.match(validatePayload({ ...base, banner: 'http://cdn.sip-protocol.org/x.png' }).errors[0], /https/)
})

test('validatePayload: security forbids banner and cardImages', () => {
  const p = { type: 'security', channel: 'announcements', title: 'Advisory', body: 'Upgrade now', banner: 'https://cdn.sip-protocol.org/d/x.png' }
  assert.match(validatePayload(p).errors[0], /security posts are undecorated/)
})

test('validatePayload: bounty requires cells or cardImages', () => {
  assert.match(validatePayload({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b' }).errors[0], /bounty requires/)
  assert.deepEqual(validatePayload({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cells: [{ name: 'X', value: '$1' }] }).errors, [])
})

test('validatePayload: button URLs allowlisted by host (github.com restricted to /sip-protocol)', () => {
  const ok = { ...base, buttons: [{ label: 'Docs', url: 'https://docs.sip-protocol.org' }, { label: 'Repo', url: 'https://github.com/sip-protocol/sip-protocol' }] }
  assert.deepEqual(validatePayload(ok).errors, [])
  assert.match(validatePayload({ ...base, buttons: [{ label: 'X', url: 'https://github.com/evil/repo' }] }).errors[0], /allowlist/)
  assert.match(validatePayload({ ...base, buttons: [{ label: 'X', url: 'https://rando.xyz' }] }).errors[0], /allowlist/)
})

test('validatePayload: enforces limits (body ≤3800, ≤5 buttons, ≤8 cells)', () => {
  assert.match(validatePayload({ ...base, body: 'x'.repeat(3801) }).errors[0], /body exceeds/)
  assert.match(validatePayload({ ...base, buttons: Array(6).fill({ label: 'b', url: 'https://sip-protocol.org' }) }).errors[0], /buttons/)
  const cells = Array(9).fill({ name: 'n', value: 'v' })
  assert.match(validatePayload({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cells }).errors[0], /cells/)
})

test('render: announcement anatomy — container, accent, title, body, footer', () => {
  const msg = render(base)
  assert.equal(msg.flags, FLAG_COMPONENTS_V2)
  assert.equal(msg.components.length, 1)
  const c = msg.components[0]
  assert.equal(c.type, 17)
  assert.equal(c.accent_color, 0x8b5cf6)
  const texts = c.components.filter(x => x.type === 10).map(x => x.content)
  assert.equal(texts[0], '### Hello')
  assert.equal(texts[1], 'World **bold**')
  assert.match(texts.at(-1), /^-# SIP Protocol · \[sip-protocol\.org\]/)
})

test('render: banner becomes a leading media gallery; buttons become a link-button row', () => {
  const msg = render({ ...base, banner: 'https://cdn.sip-protocol.org/discord/w.v1.png', buttons: [{ label: 'Docs', url: 'https://docs.sip-protocol.org' }] })
  const c = msg.components[0]
  assert.equal(c.components[0].type, 12)
  assert.equal(c.components[0].items[0].media.url, 'https://cdn.sip-protocol.org/discord/w.v1.png')
  const row = c.components.find(x => x.type === 1)
  assert.deepEqual(row.components[0], { type: 2, style: 5, label: 'Docs', url: 'https://docs.sip-protocol.org' })
})

test('render: cells become stacked bold lines; cardImages become a gallery after the separator', () => {
  const withCells = render({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cells: [{ name: '🧵 Thread', value: '$1,000', note: 'best thread wins' }] })
  const cellText = withCells.components[0].components.filter(x => x.type === 10).map(x => x.content)
  assert.ok(cellText.some(t => t.includes('**🧵 Thread** — $1,000 — best thread wins')))
  const withCards = render({ type: 'bounty', channel: 'bounties', title: 'B', body: 'b', cardImages: ['https://cdn.sip-protocol.org/discord/c1.v1.png', 'https://cdn.sip-protocol.org/discord/c2.v1.png'] })
  const galleries = withCards.components[0].components.filter(x => x.type === 12)
  assert.equal(galleries.length, 1)
  assert.equal(galleries[0].items.length, 2)
})

test('render: seedKey lands in the footer marker', () => {
  const msg = render(base, { seedKey: 'rules' })
  const footer = msg.components[0].components.at(-1)
  assert.match(footer.content, / · seed:rules$/)
})

test('render: throws on invalid payload', () => {
  assert.throws(() => render({ type: 'nope' }), /type must be one of/)
})

test('normalizeComponents: strips Discord-added ids/proxy fields so live vs rendered compare equal', () => {
  const rendered = render(base, { seedKey: 'k' }).components
  const live = JSON.parse(JSON.stringify(rendered))
  live[0].id = 7
  live[0].components.forEach((c, i) => { c.id = i + 10 })
  assert.deepEqual(normalizeComponents(live), normalizeComponents(rendered))
})

test('normalizeComponents: detects real content drift', () => {
  const a = render(base).components
  const b = render({ ...base, body: 'changed' }).components
  assert.notDeepEqual(normalizeComponents(a), normalizeComponents(b))
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/local-dev/sip-dot-github/discord && node --test test/templates.test.js
```

Expected: FAIL — `Cannot find module '../templates.js'`.

- [ ] **Step 3: Implement `discord/templates.js`**

```js
// discord/templates.js — pure: SIP post payload → Components V2 message body.
// The format standard from docs/superpowers/specs/2026-06-11-discord-professional-standard-design.md §3.
// No I/O. Component types: 17 container, 12 media gallery, 10 text display, 14 separator, 1 action row, 2 button.
'use strict'

const FLAG_COMPONENTS_V2 = 1 << 15 // 32768 — disables content/embeds; everything is components

const TYPES = {
  announcement: { accent: 0x8b5cf6, banner: 'optional', crosspost: true },
  release:      { accent: 0x10b981, banner: 'never',    crosspost: true },
  bounty:       { accent: 0xf59e0b, banner: 'optional', crosspost: false, detailRequired: true },
  security:     { accent: 0xef4444, banner: 'never',    crosspost: true },
  digest:       { accent: 0x6366f1, banner: 'never',    crosspost: true },
}

const CDN_HOST = 'cdn.sip-protocol.org'
const BUTTON_HOSTS = new Set([
  'sip-protocol.org', 'app.sip-protocol.org', 'docs.sip-protocol.org', 'blog.sip-protocol.org',
  'cdn.sip-protocol.org', 'npmjs.com', 'www.npmjs.com', 'earn.superteam.fun', 'superteam.fun',
  'x.com', 'discord.gg', 'github.com',
])
const LIMITS = { title: 150, body: 3800, buttons: 5, cells: 8, cardImages: 4 }

function checkUrl(url, { cdnOnly } = {}) {
  let u
  try { u = new URL(url) } catch { return `invalid URL: ${url}` }
  if (u.protocol !== 'https:') return `URL must be https: ${url}`
  if (cdnOnly) {
    if (u.hostname !== CDN_HOST) return `image URLs must be on cdn.sip-protocol.org (got ${u.hostname})`
    return null
  }
  if (!BUTTON_HOSTS.has(u.hostname)) return `button URL host not in allowlist: ${u.hostname}`
  if (u.hostname === 'github.com' && !u.pathname.startsWith('/sip-protocol')) {
    return `github.com button URLs allowlisted only under /sip-protocol (got ${u.pathname})`
  }
  return null
}

function validatePayload(p) {
  const errors = []
  const t = TYPES[p?.type]
  if (!t) return { errors: [`type must be one of: ${Object.keys(TYPES).join(', ')} (got ${p?.type})`] }
  if (!p.title || typeof p.title !== 'string') errors.push('title is required (string)')
  else if (p.title.length > LIMITS.title) errors.push(`title exceeds ${LIMITS.title} chars`)
  if (!p.body || typeof p.body !== 'string') errors.push('body is required (string)')
  else if (p.body.length > LIMITS.body) errors.push(`body exceeds ${LIMITS.body} chars (Text Display cap is 4000)`)
  if (!p.channel || !/^[a-z0-9-]+$/.test(p.channel)) errors.push(`channel must be a kebab-case channel name (got ${p?.channel})`)

  if (t.banner === 'never' && (p.banner || p.cardImages)) {
    errors.push(`${p.type} posts are undecorated — no banner/cardImages allowed`)
  }
  if (t.detailRequired && !(p.cells?.length || p.cardImages?.length)) {
    errors.push('bounty requires cells or cardImages (the prize block)')
  }
  if (p.banner) { const e = checkUrl(p.banner, { cdnOnly: true }); if (e) errors.push(e) }
  for (const img of p.cardImages || []) { const e = checkUrl(img, { cdnOnly: true }); if (e) errors.push(e) }
  if ((p.cardImages || []).length > LIMITS.cardImages) errors.push(`cardImages exceeds ${LIMITS.cardImages}`)
  if ((p.buttons || []).length > LIMITS.buttons) errors.push(`buttons exceeds ${LIMITS.buttons} (one action row)`)
  for (const b of p.buttons || []) {
    if (!b.label || !b.url) { errors.push('every button needs label + url'); continue }
    const e = checkUrl(b.url); if (e) errors.push(`${e} (allowlist: ${[...BUTTON_HOSTS].join(', ')})`)
  }
  if ((p.cells || []).length > LIMITS.cells) errors.push(`cells exceeds ${LIMITS.cells}`)
  for (const c of p.cells || []) if (!c.name || !c.value) errors.push('every cell needs name + value')
  return { errors }
}

const text = content => ({ type: 10, content })
const sep = () => ({ type: 14, divider: true, spacing: 1 })

function render(p, opts = {}) {
  const { errors } = validatePayload(p)
  if (errors.length) throw new Error(`invalid payload: ${errors.join(' | ')}`)
  const t = TYPES[p.type]
  const inner = []
  if (p.banner) inner.push({ type: 12, items: [{ media: { url: p.banner } }] })
  inner.push(text(`### ${p.title}`))
  inner.push(text(p.body))
  if (p.cells?.length || p.cardImages?.length || p.buttons?.length) inner.push(sep())
  if (p.cells?.length) {
    inner.push(text(p.cells.map(c => `**${c.name}** — ${c.value}${c.note ? ` — ${c.note}` : ''}`).join('\n')))
  }
  if (p.cardImages?.length) {
    inner.push({ type: 12, items: p.cardImages.map(url => ({ media: { url } })) })
  }
  if (p.buttons?.length) {
    inner.push({ type: 1, components: p.buttons.map(b => ({ type: 2, style: 5, label: b.label, url: b.url })) })
  }
  inner.push(sep())
  const marker = opts.seedKey ? ` · seed:${opts.seedKey}` : ''
  inner.push(text(`-# SIP Protocol · [sip-protocol.org](https://sip-protocol.org)${marker}`))
  return { flags: FLAG_COMPONENTS_V2, components: [{ type: 17, accent_color: t.accent, components: inner }] }
}

// Keep only the fields WE author, so live messages (which gain id/proxy_url/size fields)
// compare equal to fresh renders. Field order is fixed here → JSON.stringify is canonical.
function normalizeComponents(components) {
  const norm = c => {
    const out = { type: c.type }
    if (c.accent_color !== undefined) out.accent_color = c.accent_color
    if (c.content !== undefined) out.content = c.content
    if (c.divider !== undefined) out.divider = c.divider
    if (c.spacing !== undefined) out.spacing = c.spacing
    if (c.style !== undefined) out.style = c.style
    if (c.label !== undefined) out.label = c.label
    if (c.url !== undefined) out.url = c.url
    if (c.items) out.items = c.items.map(i => ({ media: { url: i.media.url } }))
    if (c.components) out.components = c.components.map(norm)
    return out
  }
  return (components || []).map(norm)
}

module.exports = { TYPES, FLAG_COMPONENTS_V2, LIMITS, validatePayload, render, normalizeComponents }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/templates.test.js
```

Expected: all templates tests PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add discord/templates.js discord/test/templates.test.js
git commit -m "feat(discord): CV2 template renderer with validation (the format standard)"
```

---

### Task 3: `post.js` — the posting CLI

**Files:**
- Create: `discord/post.js`, `discord/posts/.gitkeep`

Pure logic already tested in templates; `post.js` is a thin I/O shell (smoke-tested live in Task 14).

- [ ] **Step 1: Implement `discord/post.js`**

```js
#!/usr/bin/env node
// discord/post.js — post a SIP-standard CV2 message from a git-archived payload.
// Usage: node post.js posts/<file>.json [--plan]   Env: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
// Payloads live in discord/posts/ and are committed = permanent audit trail.
'use strict'

const fs = require('fs')
const path = require('path')
const { makeApi, requireEnv } = require('./api.js')
const { TYPES, validatePayload, render } = require('./templates.js')
const { rewriteMentions } = require('./lib.js')

const { TOKEN, GUILD } = requireEnv()
const DRY = process.argv.includes('--plan')
const file = process.argv.slice(2).find(a => !a.startsWith('--'))
if (!file) { console.error('Usage: node post.js posts/<file>.json [--plan]'); process.exit(1) }
const api = makeApi(TOKEN, 'SIP discord/post.js')

async function main() {
  const payload = JSON.parse(fs.readFileSync(path.resolve(__dirname, file), 'utf8'))
  const { errors } = validatePayload(payload)
  if (errors.length) {
    console.error(`Invalid payload (${file}):`)
    errors.forEach(e => console.error(`  ✗ ${e}`))
    process.exit(1)
  }

  const channels = await api('GET', `/guilds/${GUILD}/channels`)
  const channel = channels.find(c => c.name === payload.channel && c.type !== 4)
  if (!channel) {
    console.error(`Channel #${payload.channel} not found. Channels: ${channels.filter(c => c.type !== 4).map(c => c.name).join(', ')}`)
    process.exit(1)
  }
  const channelId = name => channels.find(c => c.name === name && c.type !== 4)?.id

  const rewritten = { ...payload, body: rewriteMentions(payload.body, channelId) }
  const msg = render(rewritten)

  console.log(`POST → #${payload.channel} · type=${payload.type} · accent=#${TYPES[payload.type].accent.toString(16)}`)
  console.log(`  title: ${payload.title}`)
  console.log(`  body: ${payload.body.length} chars${payload.banner ? ' · banner' : ''}${payload.cells ? ` · ${payload.cells.length} cells` : ''}${payload.cardImages ? ` · ${payload.cardImages.length} cards` : ''}${payload.buttons ? ` · ${payload.buttons.length} buttons` : ''}`)
  console.log(`  crosspost: ${channel.type === 5 ? 'yes (announcement channel)' : 'no'} · pin: ${payload.pin ? 'yes' : 'no'}`)
  if (DRY) { console.log('\n--plan: no message sent.'); return }

  const posted = await api('POST', `/channels/${channel.id}/messages`, { ...msg, allowed_mentions: { parse: [] } })
  console.log(`✓ posted — message ${posted.id}`)
  if (channel.type === 5) {
    await api('POST', `/channels/${channel.id}/messages/${posted.id}/crosspost`)
    console.log('✓ crossposted to followers')
  }
  if (payload.pin) {
    await api('PUT', `/channels/${channel.id}/pins/${posted.id}`)
    console.log('✓ pinned')
  }
  console.log(`\nReminder: commit ${file} (the audit trail).`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
```

- [ ] **Step 2: Syntax check + tests still green**

```bash
touch posts/.gitkeep && node --check post.js && node --test test/
```

Expected: no syntax errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add discord/post.js discord/posts/.gitkeep
git commit -m "feat(discord): post.js — git-archived CV2 posting CLI"
```

---

### Task 4: `lib.js` planners — emojis, webhooks, seeds (TDD)

**Files:**
- Modify: `discord/lib.js`
- Test: `discord/test/lib.test.js` (append)

- [ ] **Step 1: Append failing tests to `discord/test/lib.test.js`**

```js
const { planEmojis, planWebhooks, planSeeds } = require('../lib.js')
const { render, normalizeComponents } = require('../templates.js')

test('planEmojis creates only missing emojis by name', () => {
  const wanted = [{ name: 'sip_shield', file: 'assets/emoji/sip_shield.png' }, { name: 'sip_zk', file: 'assets/emoji/sip_zk.png' }]
  const plan = planEmojis(wanted, [{ name: 'sip_shield', id: '1' }])
  assert.equal(plan.create.length, 1)
  assert.equal(plan.create[0].name, 'sip_zk')
})

test('planWebhooks creates only missing webhooks by name', () => {
  const wanted = [{ name: 'SIP GitHub', channel: 'github-feed' }, { name: 'HERALD', channel: 'announcements' }]
  const plan = planWebhooks(wanted, [{ name: 'HERALD', channel_id: 'x' }])
  assert.equal(plan.create.length, 1)
  assert.equal(plan.create[0].name, 'SIP GitHub')
})

test('planSeeds: post when no marked message, ok when matching, patch on drift', () => {
  const seed = { key: 'rules', channel: 'rules', pin: true, payload: { type: 'announcement', channel: 'rules', title: 'T', body: 'B' } }
  const renderSeed = s => render(s.payload, { seedKey: s.key })
  const BOT = 'bot1'

  // no messages at all → post
  let plan = planSeeds([seed], { rules: [] }, BOT, renderSeed)
  assert.deepEqual(plan[0], { key: 'rules', channel: 'rules', action: 'post' })

  // live message with marker and identical components → ok
  const liveMsg = { id: 'm1', author: { id: BOT }, pinned: true, components: JSON.parse(JSON.stringify(renderSeed(seed).components)) }
  plan = planSeeds([seed], { rules: [liveMsg] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'ok')

  // drifted content → patch targeting the marked message
  const drifted = JSON.parse(JSON.stringify(liveMsg))
  drifted.components[0].components[1].content = 'old text'
  plan = planSeeds([seed], { rules: [drifted] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'patch')
  assert.equal(plan[0].targetId, 'm1')

  // unmarked legacy bot message (plain content) → migrate = patch oldest bot message
  const legacy = { id: 'm0', author: { id: BOT }, pinned: true, content: '**Welcome**', components: [] }
  plan = planSeeds([seed], { rules: [{ id: 'm9', author: { id: 'someone' } }, legacy] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'patch')
  assert.equal(plan[0].targetId, 'm0')

  // non-bot messages only → post fresh
  plan = planSeeds([seed], { rules: [{ id: 'm9', author: { id: 'someone' }, components: [] }] }, BOT, renderSeed)
  assert.equal(plan[0].action, 'post')
})
```

- [ ] **Step 2: Run to verify failure**

```bash
node --test test/lib.test.js
```

Expected: FAIL — `planEmojis is not a function`.

- [ ] **Step 3: Implement the planners in `discord/lib.js`** (append before `module.exports`, then extend exports)

```js
function planEmojis(wanted, live) {
  const liveBy = byName(live)
  return { create: wanted.filter(e => !liveBy.has(e.name)) }
}

function planWebhooks(wanted, live) {
  const liveBy = byName(live)
  return { create: wanted.filter(w => !liveBy.has(w.name)) }
}

// Seeds are reconciled managed messages. Match: bot-authored message whose components
// JSON contains the `seed:<key>` footer marker; fallback (one-time migration of
// pre-marker seeds): the OLDEST bot-authored message in the channel (Discord returns
// newest-first). normalizeComponents comparison decides ok vs patch.
function planSeeds(seeds, messagesByChannel, botUserId, renderSeed, normalize) {
  const norm = normalize || require('./templates.js').normalizeComponents
  return seeds.map(seed => {
    const msgs = messagesByChannel[seed.channel] || []
    const mine = msgs.filter(m => m.author?.id === botUserId)
    const marked = mine.find(m => JSON.stringify(m.components || []).includes(`seed:${seed.key}`))
    const target = marked || (mine.length ? mine[mine.length - 1] : null)
    if (!target) return { key: seed.key, channel: seed.channel, action: 'post' }
    const want = norm(renderSeed(seed).components)
    const have = norm(target.components || [])
    if (JSON.stringify(want) === JSON.stringify(have)) return { key: seed.key, channel: seed.channel, action: 'ok', targetId: target.id }
    return { key: seed.key, channel: seed.channel, action: 'patch', targetId: target.id, pinned: !!target.pinned }
  })
}
```

Extend the export line:

```js
module.exports = { planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions, planEmojis, planWebhooks, planSeeds }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/
```

Expected: ALL tests pass (templates + lib, 25+).

- [ ] **Step 5: Commit**

```bash
git add discord/lib.js discord/test/lib.test.js
git commit -m "feat(discord): pure planners for emojis, webhooks, reconciled seeds"
```

---

### Task 5: Manifest v2 — `#github-feed`, webhooks, emojis, seeds as payloads

**Files:**
- Modify: `discord/manifest.json`
- Test: `discord/test/lib.test.js` (channel count updates)

- [ ] **Step 1: Add `#github-feed` to the MACHINE category** (insert between `bot-commands` and `mod-log`; the deny mask `309237647360` is the same read-only tier START HERE uses):

```json
{ "name": "github-feed", "type": 0, "topic": "Live firehose from github.com/sip-protocol — releases, merged PRs, issues. Read-only.", "overwrites": [{ "role": "@everyone", "deny": "309237647360" }] }
```

- [ ] **Step 2: Add top-level `webhooks` and `emojis` sections** (after `"invite"`):

```json
"webhooks": [
  { "name": "SIP GitHub", "channel": "github-feed", "env": "DISCORD_GITHUB_WEBHOOK_URL" },
  { "name": "HERALD", "channel": "announcements", "env": "DISCORD_ANNOUNCE_WEBHOOK_URL" },
  { "name": "SIP Ops", "channel": "mod-log", "env": "DISCORD_MODLOG_WEBHOOK_URL" }
],
"emojis": [
  { "name": "sip_shield", "file": "assets/emoji/sip_shield.png" },
  { "name": "sip_stealth", "file": "assets/emoji/sip_stealth.png" },
  { "name": "sip_viewkey", "file": "assets/emoji/sip_viewkey.png" },
  { "name": "sip_zk", "file": "assets/emoji/sip_zk.png" },
  { "name": "sip_commit", "file": "assets/emoji/sip_commit.png" },
  { "name": "sip_bounty", "file": "assets/emoji/sip_bounty.png" },
  { "name": "sip_ship", "file": "assets/emoji/sip_ship.png" },
  { "name": "sip_gm", "file": "assets/emoji/sip_gm.png" },
  { "name": "sip_sol", "file": "assets/emoji/sip_sol.png" },
  { "name": "sip_eth", "file": "assets/emoji/sip_eth.png" }
]
```

- [ ] **Step 3: Replace the `seeds` array with reconciled payloads** (same copy, professional format; the welcome banner URL goes live in Task 13):

```json
"seeds": [
  {
    "key": "rules", "channel": "rules", "pin": true,
    "payload": {
      "type": "announcement", "channel": "rules",
      "title": "Welcome to SIP Protocol 🔒",
      "body": "Accepting these rules unlocks the server.\n\n**1. Be respectful.** No harassment, hate speech, or personal attacks.\n**2. No scams, spam, or shilling.** No unsolicited promo, no \"DM me\" bait. Wallet-drainer links = instant ban.\n**3. English only** — so everyone can follow along.\n**4. No financial advice.** SIP is privacy infrastructure; nobody here tells you what to buy.\n**5. Security:** the team will NEVER DM you first and will NEVER ask you to connect a wallet or share keys. Report impersonators in <#bug-reports>.\n**6. Vulnerabilities:** report privately via GitHub Security advisories (SECURITY.md) — never in public channels."
    }
  },
  {
    "key": "welcome", "channel": "announcements", "pin": false,
    "payload": {
      "type": "announcement", "channel": "announcements",
      "title": "The SIP Protocol Discord is live",
      "body": "SIP (Shielded Intents Protocol) is the privacy standard for Web3 — stealth addresses, hidden amounts, viewing keys for compliance. One toggle to make transactions private.\n\n**Start here:**\n→ What is your wallet leaking? Run the [Privacy Score](https://app.sip-protocol.org/privacy-score)\n→ Build with the [SDK docs](https://docs.sip-protocol.org)\n→ <#dev-chat> for integration help · <#bounties> for paid work\n\nYour wallet is public. Let's fix that — welcome in.",
      "banner": "https://cdn.sip-protocol.org/discord/banner-welcome.v1.png",
      "buttons": [
        { "label": "Privacy Score", "url": "https://app.sip-protocol.org/privacy-score" },
        { "label": "SDK Docs", "url": "https://docs.sip-protocol.org" }
      ]
    }
  },
  {
    "key": "resources", "channel": "resources", "pin": true,
    "payload": {
      "type": "announcement", "channel": "resources",
      "title": "SIP Protocol — Resources 📖",
      "body": "🌐 [Website](https://sip-protocol.org) — what SIP is\n🚀 [App](https://app.sip-protocol.org) — payments, DEX, privacy score\n🔍 [Privacy Score](https://app.sip-protocol.org/privacy-score) — what is your wallet leaking?\n📚 [Docs](https://docs.sip-protocol.org) — build with the SDK\n📦 [SDK on npm](https://www.npmjs.com/package/@sip-protocol/sdk) — `@sip-protocol/sdk`\n🐙 [GitHub](https://github.com/sip-protocol) — all 10 repos, MIT\n✍️ [Blog](https://blog.sip-protocol.org) — deep-dives + updates\n🐦 [X](https://x.com/sipprotocol) — @sipprotocol",
      "buttons": [
        { "label": "Docs", "url": "https://docs.sip-protocol.org" },
        { "label": "GitHub", "url": "https://github.com/sip-protocol" }
      ]
    }
  },
  {
    "key": "bounties", "channel": "bounties", "pin": false,
    "payload": {
      "type": "bounty", "channel": "bounties",
      "title": "4 bounties are launching on Superteam Earn 🏆",
      "body": "Prizes + links land here — watch <#announcements>.",
      "cells": [
        { "name": "🧵 Write a Thread", "value": "TBA" },
        { "name": "🛠️ Build with the SDK", "value": "TBA" },
        { "name": "📖 Technical Deep-Dive", "value": "TBA" },
        { "name": "🐛 Bug Bounty", "value": "TBA" }
      ]
    }
  }
]
```

- [ ] **Step 4: Fix channel-count assertions in `discord/test/lib.test.js`**

The existing test `planCategories + planChannels create everything on empty live` asserts `chans.create.length === 10` → change to `11`. Run the full suite; if the seed payloads broke any test expectation, the failure output names it.

```bash
node --test test/ 2>&1 | tail -5
```

Expected: all pass after the 10→11 edit.

- [ ] **Step 5: Validate every seed payload renders**

```bash
node -e "
const m = require('./manifest.json'); const { render } = require('./templates.js')
for (const s of m.seeds) { render(s.payload, { seedKey: s.key }); console.log('✓', s.key) }
"
```

Expected: `✓ rules ✓ welcome ✓ resources ✓ bounties`.

- [ ] **Step 6: Commit**

```bash
git add discord/manifest.json discord/test/lib.test.js
git commit -m "feat(discord): manifest v2 — github-feed, webhooks, emojis, CV2 seed payloads"
```

---

### Task 6: Wire `setup.js` + `verify.js` to the new manifest sections

**Files:**
- Modify: `discord/setup.js`, `discord/verify.js`, `discord/README.md`

- [ ] **Step 1: Extend `setup.js` imports**

```js
const { planRoles, planCategories, planChannels, buildOverwrites, planAutomod, rewriteMentions, planEmojis, planWebhooks, planSeeds } = require('./lib.js')
const { render, normalizeComponents } = require('./templates.js')
```

- [ ] **Step 2: Replace setup.js section `---- 13. seed messages` with the reconciler**

```js
  // ---- 13. seeds — reconciled managed messages (post if missing, PATCH on drift).
  // Legacy plain seeds (no marker) migrate via oldest-bot-message fallback; if Discord
  // rejects adding the CV2 flag on edit, fall back to delete + repost (channels are quiet).
  const me2 = await api('GET', '/users/@me')
  const messagesByChannel = {}
  for (const seed of manifest.seeds) {
    messagesByChannel[seed.channel] = await api('GET', `/channels/${channelId(seed.channel)}/messages?limit=50`)
  }
  const renderSeed = s => {
    const body = rewriteMentions(s.payload.body, channelId)
    return render({ ...s.payload, body }, { seedKey: s.key })
  }
  for (const action of planSeeds(manifest.seeds, messagesByChannel, me2.id, renderSeed, normalizeComponents)) {
    const seed = manifest.seeds.find(s => s.key === action.key)
    const cid = channelId(seed.channel)
    const msg = renderSeed(seed)
    if (action.action === 'ok') { log(`· seed ${action.key} up to date`); continue }
    if (action.action === 'post') {
      const posted = await api('POST', `/channels/${cid}/messages`, { ...msg, allowed_mentions: { parse: [] } })
      if (seed.pin) await api('PUT', `/channels/${cid}/pins/${posted.id}`)
      log(`✓ seed ${action.key} posted${seed.pin ? ' (pinned)' : ''}`)
      continue
    }
    // patch (includes legacy migration)
    try {
      await api('PATCH', `/channels/${cid}/messages/${action.targetId}`, { ...msg, content: null })
      log(`✓ seed ${action.key} updated in place`)
    } catch (e) {
      log(`  seed ${action.key}: edit-to-CV2 rejected (${e.message.slice(0, 120)}…) — delete + repost`)
      await api('DELETE', `/channels/${cid}/messages/${action.targetId}`)
      const posted = await api('POST', `/channels/${cid}/messages`, { ...msg, allowed_mentions: { parse: [] } })
      if (seed.pin) await api('PUT', `/channels/${cid}/pins/${posted.id}`)
      log(`✓ seed ${action.key} reposted${seed.pin ? ' (pinned)' : ''}`)
    }
    if (seed.pin && action.pinned === false) await api('PUT', `/channels/${cid}/pins/${action.targetId}`).catch(() => {})
  }
```

- [ ] **Step 3: Add emoji + webhook reconciliation after the seeds section**

```js
  // ---- 13b. brand emojis (create-if-missing; never deletes unmanaged)
  const emojisLive = await api('GET', `/guilds/${GUILD}/emojis`)
  for (const e of planEmojis(manifest.emojis, emojisLive).create) {
    const png = fs.readFileSync(path.join(__dirname, e.file))
    await api('POST', `/guilds/${GUILD}/emojis`, { name: e.name, image: `data:image/png;base64,${png.toString('base64')}` })
    log(`✓ emoji :${e.name}:`)
  }

  // ---- 13c. webhooks (create-if-missing; URL printed ONCE — store in ~/Documents/secret/.env)
  const hooksLive = await api('GET', `/guilds/${GUILD}/webhooks`)
  for (const w of planWebhooks(manifest.webhooks, hooksLive).create) {
    const png = fs.readFileSync(path.join(__dirname, manifest.guild.icon_file))
    const hook = await api('POST', `/channels/${channelId(w.channel)}/webhooks`, { name: w.name, avatar: `data:image/png;base64,${png.toString('base64')}` })
    log(`✓ webhook ${w.name} on #${w.channel}`)
    log(`  ★ ${w.env}=https://discord.com/api/webhooks/${hook.id}/${hook.token}`)
    log(`  ★ shown ONCE — append to ~/Documents/secret/.env now`)
  }
```

- [ ] **Step 4: Surface seeds/emojis/webhooks in the `--plan` output** (extend the PLAN block before the `if (DRY)` return):

```js
  const me0 = await api('GET', '/users/@me')
  const msgsByCh = {}
  for (const seed of manifest.seeds) msgsByCh[seed.channel] = await api('GET', `/channels/${channelId(seed.channel) || '0'}/messages?limit=50`).catch(() => [])
  const renderSeed0 = s => render({ ...s.payload, body: rewriteMentions(s.payload.body, channelId) }, { seedKey: s.key })
  const pSeeds = channelId(manifest.seeds[0].channel) ? planSeeds(manifest.seeds, msgsByCh, me0.id, renderSeed0, normalizeComponents) : manifest.seeds.map(s => ({ key: s.key, action: 'post (after channel create)' }))
  const pEmoji = planEmojis(manifest.emojis, await api('GET', `/guilds/${GUILD}/emojis`))
  const pHooks = planWebhooks(manifest.webhooks, await api('GET', `/guilds/${GUILD}/webhooks`))
  log(`       seeds ${pSeeds.map(s => `${s.key}:${s.action}`).join(' ')} · emojis +${pEmoji.create.length} · webhooks +${pHooks.create.length}`)
```

(Keep it simple: compute once here, reuse `pSeeds`/`pEmoji`/`pHooks` below instead of re-fetching in 13b/13c if you prefer — either is fine as long as `--plan` prints and apply executes.)

- [ ] **Step 5: Extend `verify.js`** (after the automod checks, before the drift report):

```js
  const { planEmojis, planWebhooks, planSeeds } = require('./lib.js')          // top of file, merge into existing require
  const { render, normalizeComponents } = require('../discord/templates.js')  // adjust: require('./templates.js')
  const { rewriteMentions } = require('./lib.js')

  const emojis = await get(`/guilds/${GUILD}/emojis`)
  planEmojis(manifest.emojis, emojis).create.forEach(e => drift.push(`missing emoji: ${e.name}`))
  const hooks = await get(`/guilds/${GUILD}/webhooks`)
  planWebhooks(manifest.webhooks, hooks).create.forEach(w => drift.push(`missing webhook: ${w.name}`))
  const me = await get('/users/@me')
  const msgsByCh = {}
  for (const seed of manifest.seeds) msgsByCh[seed.channel] = channelId(seed.channel) ? await get(`/channels/${channelId(seed.channel)}/messages?limit=50`) : []
  const renderSeed = s => render({ ...s.payload, body: rewriteMentions(s.payload.body, channelId) }, { seedKey: s.key })
  planSeeds(manifest.seeds, msgsByCh, me.id, renderSeed, normalizeComponents)
    .filter(a => a.action !== 'ok')
    .forEach(a => drift.push(`seed drift: ${a.key} → ${a.action}`))
```

(Use one merged require line at the top: `const { planRoles, planCategories, planChannels, planAutomod, planEmojis, planWebhooks, planSeeds, rewriteMentions } = require('./lib.js')` and `const { render, normalizeComponents } = require('./templates.js')`.)

- [ ] **Step 6: Syntax check + full test suite**

```bash
node --check setup.js && node --check verify.js && node --test test/
```

Expected: clean checks, all tests pass.

- [ ] **Step 7: Update `discord/README.md`** — add under "## Files":

```markdown
- `templates.js` — pure payload → Components V2 renderer (the format standard, tested)
- `post.js` — post a payload from `posts/` (`node post.js posts/<f>.json [--plan]`); auto-crossposts in announcement channels
- `posts/` — every payload ever posted, committed (audit trail)
- `api.js` — shared REST helper (429-aware)
- `render.js` + `assets-src/` — SVG sources → PNG (`npm run render`); banners ship to cdn-sip
- `PLAYBOOK.md` — operations playbook: message standards, workflows, growth triggers
```

- [ ] **Step 8: Commit**

```bash
git add discord/setup.js discord/verify.js discord/README.md
git commit -m "feat(discord): reconcile seeds/emojis/webhooks in setup.js + verify.js checks"
```

---

### Task 7: Fonts for the render pipeline

**Files:**
- Create: `discord/assets-src/fonts/` (Inter + JetBrains Mono statics + OFL licenses)

- [ ] **Step 1: Download and extract pinned releases**

```bash
cd ~/local-dev/sip-dot-github/discord
mkdir -p assets-src/fonts /tmp/fonts && cd /tmp/fonts
curl -sLO https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
curl -sLO https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip
unzip -o -q Inter-4.1.zip -d inter && unzip -o -q JetBrainsMono-2.304.zip -d jbm
find inter -name "Inter-Regular.ttf" -o -name "Inter-SemiBold.ttf" -o -name "Inter-ExtraBold.ttf" | head
find jbm -name "JetBrainsMono-Regular.ttf" -o -name "JetBrainsMono-Medium.ttf" | head
```

Expected: paths print for all 5 statics (Inter statics live under `extras/ttf/` in the 4.x zip; if the layout differs, `find` locates them regardless).

- [ ] **Step 2: Copy fonts + licenses into the repo**

```bash
cd ~/local-dev/sip-dot-github/discord
for f in Inter-Regular Inter-SemiBold Inter-ExtraBold; do cp "$(find /tmp/fonts/inter -name "$f.ttf" | head -1)" assets-src/fonts/; done
for f in JetBrainsMono-Regular JetBrainsMono-Medium; do cp "$(find /tmp/fonts/jbm -name "$f.ttf" | head -1)" assets-src/fonts/; done
cp "$(find /tmp/fonts/inter -iname "LICENSE*" | head -1)" assets-src/fonts/LICENSE-Inter.txt
cp "$(find /tmp/fonts/jbm -iname "OFL*" | head -1)" assets-src/fonts/LICENSE-JetBrainsMono.txt
ls -la assets-src/fonts/
```

Expected: 5 `.ttf` + 2 license files (both fonts are SIL OFL — redistribution permitted with license).

- [ ] **Step 3: Commit**

```bash
git add discord/assets-src/fonts/
git commit -m "feat(discord): bundle Inter + JetBrains Mono statics (OFL) for SVG rendering"
```

---

### Task 8: Emoji SVG sources (10)

**Files:**
- Create: `discord/assets-src/emoji/sip_{shield,stealth,viewkey,zk,commit,bounty,ship,gm,sol,eth}.svg`

House style: 128×128, rounded-square `#17102b` plate (rx 28), bold geometric glyph in SIP purples, readable at 22px. Complete files below — create each exactly.

- [ ] **Step 1: Create the 10 SVGs**

`sip_shield.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><path d="M64 18l34 15v27c0 22-15 37-34 47-19-10-34-25-34-47V33l34-15z" fill="#8b5cf6"/><path d="M64 30l22 10v19c0 14-10 25-22 32-12-7-22-18-22-32V40l22-10z" fill="#17102b"/><circle cx="64" cy="61" r="8" fill="#a78bfa"/></svg>
```

`sip_stealth.svg` (ghost):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><path d="M64 22c-20 0-34 15-34 35v44l11-9 12 9 11-9 11 9 12-9 11 9V57c0-20-14-35-34-35z" fill="#a78bfa"/><circle cx="52" cy="56" r="6" fill="#17102b"/><circle cx="76" cy="56" r="6" fill="#17102b"/></svg>
```

`sip_viewkey.svg` (eye + key bit):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><path d="M20 58c12-18 28-27 44-27s32 9 44 27c-12 18-28 27-44 27S32 76 20 58z" fill="none" stroke="#8b5cf6" stroke-width="9"/><circle cx="64" cy="58" r="13" fill="#a78bfa"/><path d="M76 86h26M88 86v14M100 86v10" stroke="#8b5cf6" stroke-width="9" stroke-linecap="round"/></svg>
```

`sip_zk.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><text x="64" y="86" font-family="Inter" font-size="60" font-weight="800" fill="#a78bfa" text-anchor="middle" letter-spacing="-2">ZK</text></svg>
```

`sip_commit.svg` (padlock):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><path d="M44 56V44c0-11 9-20 20-20s20 9 20 20v12" fill="none" stroke="#a78bfa" stroke-width="10" stroke-linecap="round"/><rect x="34" y="56" width="60" height="48" rx="10" fill="#8b5cf6"/><circle cx="64" cy="76" r="8" fill="#17102b"/><rect x="60" y="78" width="8" height="14" rx="3" fill="#17102b"/></svg>
```

`sip_bounty.svg` (target + coin):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><circle cx="64" cy="64" r="40" fill="none" stroke="#8b5cf6" stroke-width="8"/><circle cx="64" cy="64" r="24" fill="none" stroke="#a78bfa" stroke-width="7"/><text x="64" y="78" font-family="Inter" font-size="38" font-weight="800" fill="#f2f3f5" text-anchor="middle">$</text></svg>
```

`sip_ship.svg` (rocket):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><path d="M64 16c14 10 20 26 20 44l-8 22H52l-8-22c0-18 6-34 20-44z" fill="#a78bfa"/><circle cx="64" cy="50" r="9" fill="#17102b"/><path d="M44 66L30 86l16-4M84 66l14 20-16-4" fill="#8b5cf6"/><path d="M58 86h12l-6 24-6-24z" fill="#f59e0b"/></svg>
```

`sip_gm.svg` (sunrise):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><path d="M34 72a30 30 0 0160 0z" fill="#f59e0b"/><path d="M64 20v12M30 34l8 8M98 34l-8 8M18 60h12M98 60h12" stroke="#f59e0b" stroke-width="8" stroke-linecap="round"/><text x="64" y="106" font-family="Inter" font-size="34" font-weight="800" fill="#a78bfa" text-anchor="middle">gm</text></svg>
```

`sip_sol.svg` (Solana bars, brand gradient):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><defs><linearGradient id="s" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs><path d="M40 34h54l-12 14H28l12-14zM28 57h54l12 14H40L28 57zM40 94h54L82 80H28l12 14z" fill="url(#s)" transform="translate(0 -3)"/></svg>
```

`sip_eth.svg` (diamond):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17102b"/><path d="M64 18l30 46-30 18-30-18 30-46z" fill="#a78bfa"/><path d="M64 88l30-18-30 40-30-40 30 18z" fill="#8b5cf6"/><path d="M64 18v64" stroke="#17102b" stroke-width="3"/></svg>
```

- [ ] **Step 2: Commit**

```bash
git add discord/assets-src/emoji/
git commit -m "feat(discord): 10 brand emoji SVG sources"
```

---

### Task 9: Welcome banner SVG

**Files:**
- Create: `discord/assets-src/banners/banner-welcome.svg`

Style locked by the approved mockup (dark gradient, grid, glow, shield, Inter/JBM).

- [ ] **Step 1: Create `discord/assets-src/banners/banner-welcome.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c0a14"/><stop offset=".6" stop-color="#17102b"/><stop offset="1" stop-color="#2a1458"/>
    </linearGradient>
    <radialGradient id="glow" cx=".85" cy=".2" r=".9">
      <stop offset="0" stop-color="#8b5cf6" stop-opacity=".5"/><stop offset=".5" stop-color="#8b5cf6" stop-opacity=".08"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="400" fill="url(#bg)"/>
  <rect width="1200" height="400" fill="url(#glow)"/>
  <g stroke="#8b5cf6" stroke-opacity=".12">
    <path d="M0 100h1200M0 200h1200M0 300h1200"/>
    <path d="M200 0v400M400 0v400M600 0v400M800 0v400M1000 0v400"/>
  </g>
  <text x="80" y="148" font-family="Inter" font-size="62" font-weight="800" fill="#f2f3f5" letter-spacing="-1">The privacy standard for Web3</text>
  <text x="82" y="204" font-family="JetBrains Mono" font-size="26" fill="#a78bfa">stealth addresses · hidden amounts · viewing keys</text>
  <g font-family="Inter" font-size="20" font-weight="600">
    <rect x="80" y="252" rx="19" width="200" height="38" fill="#8b5cf6" fill-opacity=".18" stroke="#8b5cf6" stroke-opacity=".55"/>
    <text x="180" y="278" fill="#d6c7ff" text-anchor="middle">One toggle</text>
    <rect x="296" y="252" rx="19" width="250" height="38" fill="#8b5cf6" fill-opacity=".18" stroke="#8b5cf6" stroke-opacity=".55"/>
    <text x="421" y="278" fill="#d6c7ff" text-anchor="middle">Compliance-ready</text>
    <rect x="562" y="252" rx="19" width="220" height="38" fill="#8b5cf6" fill-opacity=".18" stroke="#8b5cf6" stroke-opacity=".55"/>
    <text x="672" y="278" fill="#d6c7ff" text-anchor="middle">Chain-agnostic</text>
  </g>
  <g transform="translate(1040,250)">
    <path d="M40 0l40 18v32c0 26-18 44-40 56C18 94 0 76 0 50V18L40 0z" fill="#8b5cf6" fill-opacity=".9"/>
    <path d="M40 14l26 12v22c0 17-12 30-26 38-14-8-26-21-26-38V26l26-12z" fill="#17102b"/>
    <circle cx="40" cy="50" r="9" fill="#a78bfa"/>
  </g>
  <text x="80" y="356" font-family="JetBrains Mono" font-size="17" fill="#6d6a78">discord.gg/gXRsWkKq9E · sip-protocol.org</text>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add discord/assets-src/banners/
git commit -m "feat(discord): welcome banner SVG source"
```

---

### Task 10: `render.js` + render everything ★ RECTOR ART CHECKPOINT

**Files:**
- Create: `discord/render.js`
- Create (generated): `discord/assets/emoji/*.png` (committed), `discord/out/banner-welcome.v1.png` (gitignored, ships to cdn-sip in Task 13)

- [ ] **Step 1: Implement `discord/render.js`**

```js
#!/usr/bin/env node
// discord/render.js — render assets-src SVGs to PNG. Emojis → assets/emoji/ (committed,
// uploaded by setup.js). Banners → out/ at 2x (copy to cdn-sip/discord/ with a .vN suffix).
// Only file in the toolkit with a dependency: npm install (devDep @resvg/resvg-js).
'use strict'

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

const FONT_DIR = path.join(__dirname, 'assets-src/fonts')
const fontFiles = fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf')).map(f => path.join(FONT_DIR, f))
const fontOpts = { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' }

function renderOne(svgPath, outPath, width) {
  const svg = fs.readFileSync(svgPath, 'utf8')
  const png = new Resvg(svg, { font: fontOpts, fitTo: { mode: 'width', value: width } }).render().asPng()
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, png)
  const kb = (png.length / 1024).toFixed(1)
  console.log(`✓ ${path.basename(outPath)} (${width}px wide, ${kb} KB)`)
  return png.length
}

// Emojis: 128px, must stay ≤256 KB (Discord upload cap)
for (const f of fs.readdirSync(path.join(__dirname, 'assets-src/emoji'))) {
  if (!f.endsWith('.svg')) continue
  const bytes = renderOne(path.join(__dirname, 'assets-src/emoji', f), path.join(__dirname, 'assets/emoji', f.replace('.svg', '.png')), 128)
  if (bytes > 256 * 1024) { console.error(`✗ ${f} exceeds Discord's 256 KB emoji cap`); process.exit(1) }
}

// Banners: 2x for retina (1200×400 → 2400×800)
for (const f of fs.readdirSync(path.join(__dirname, 'assets-src/banners'))) {
  if (!f.endsWith('.svg')) continue
  renderOne(path.join(__dirname, 'assets-src/banners', f), path.join(__dirname, 'out', f.replace('.svg', '.v1.png')), 2400)
}
console.log('\nBanners in out/ — copy to ~/local-dev/cdn-sip/discord/ (Task 13). Bump .vN when changing a shipped banner.')
```

- [ ] **Step 2: Install + render**

```bash
cd ~/local-dev/sip-dot-github/discord && npm install && npm run render
```

Expected: 10 emoji PNGs + 1 banner PNG, all `✓`, no size failures.

- [ ] **Step 3: ★ RECTOR CHECKPOINT — eyeball the art before anything ships**

Send the rendered files to RECTOR for approval (SendUserFile: all of `discord/assets/emoji/*.png` + `discord/out/banner-welcome.v1.png`). Iterate on any SVG he flags, re-render, re-send. **Do not proceed to Task 11 until approved.**

- [ ] **Step 4: Commit (emoji PNGs are committed; out/ stays gitignored)**

```bash
git add discord/render.js discord/assets/emoji/
git commit -m "feat(discord): render pipeline + rendered brand emojis"
```

---

### Task 11: `PLAYBOOK.md`

**Files:**
- Create: `discord/PLAYBOOK.md`

- [ ] **Step 1: Write `discord/PLAYBOOK.md`** (complete content):

```markdown
# SIP Protocol Discord — Operations Playbook

How SIP runs its Discord. The structure is reconciled by `setup.js` (manifest.json);
this document governs everything the manifest can't: what we post, how it looks,
when we act, and what changes as the server grows.
Spec: sip-protocol `docs/superpowers/specs/2026-06-11-discord-professional-standard-design.md`.

## 1. Voice & identity

- SIPHER (the bot) authors every official post, via `post.js`. Humans chat as humans.
- Tone: builder-to-builder. No hype, no price talk, honest numbers. English only.
- The team NEVER DMs first, never asks anyone to connect a wallet (also rule #5 in #rules).

## 2. Message standard

Every official post is a Components V2 container rendered by `templates.js` — never
hand-compose in the client. Types:

| Type | Accent | Banner | Use for | Channel |
|------|--------|--------|---------|---------|
| `announcement` | purple #8b5cf6 | optional | milestones, launches | #announcements |
| `release` | emerald #10b981 | never | npm/program releases | #announcements |
| `bounty` | amber #f59e0b | optional | Earn launches, winners | #bounties (+ #announcements on launch day) |
| `security` | red #ef4444 | never | advisories, impersonation warnings | #announcements |
| `digest` | indigo #6366f1 | never | HERALD weekly recap (automated) | #announcements |

Discipline:
- ≤2 organic announcements/week. Releases as they ship. Security: immediately, undecorated.
- Deadlines always as Discord timestamps (`<t:unix:R>`) — they localize per viewer.
- 1–2 brand emojis per post max. Never emoji walls.
- Banners only on `announcement`/`bounty`; rendered from `assets-src/`, served from
  `cdn.sip-protocol.org/discord/`, content-versioned (`.v2` = new file, never overwrite).

## 3. Posting workflow

1. Write the payload: `discord/posts/YYYY-MM-DD-slug.json` (schema in templates.js).
2. Preview: `node discord/post.js posts/<file>.json --plan`.
3. RECTOR sign-off (in-session or async) — required for every `announcement`/`security`.
4. Post: `node discord/post.js posts/<file>.json` (crosspost + pin are automatic).
5. Commit the payload. The posts/ directory is the audit trail.

Automated paths: HERALD digest (approved in HeraldView → X → webhook cross-post);
GitHub feed (org webhook, no human in the loop); drift alerts (weekly Action → #mod-log).

## 4. Conventions

- One thread per bounty in #bounties for submissions/questions; winners announced in-channel.
- Pins: ≤5 per channel. #rules + #resources seed posts stay pinned (reconciled).
- Contributor role is earned (merged PR / real contribution) — never self-assign, never bulk-grant.
- New channels only via the growth triggers below; structure changes go through manifest.json.

## 5. Moderation runbook

- AutoMod alerts land in #mod-log. Wallet-drainer phrase hits: delete → ban → note in #mod-log.
- Impersonation ("SIP team" DMs): ban + `security` post if any member was plausibly hit.
- Raid: Server Settings → Safety Setup → Pause Invites (or DMs); re-enable after the wave; tighten AutoMod if a pattern emerges.
- Real vulnerability reported in public: delete the message, thank reporter via DM,
  point to SECURITY.md private reporting, assess exposure before any public note.

## 6. Growth triggers

Act when the threshold is hit — not before (YAGNI for community ops):

| Trigger | Action |
|---------|--------|
| 50 members | Recruit first mod → add Moderator role to manifest.json; open #showcase (COMMUNITY) |
| 100 members | #support forum channel (DEVELOPMENT); monthly dev-call scheduled event |
| 250 members | Second mod; AutoMod rule audit; locale channels only if non-English chatter is organic |
| Boost L1 (2) | Animated icon + invite splash (render from assets-src) |
| Boost L2 (7) | Role icons (Contributor, Bounty Hunter) + server banner — SVG pipeline is ready |
| Boost L3 (14) | Vanity URL attempt |

Thresholds are heuristics — RECTOR tunes them.

## 7. Credentials

| Secret | Where | Used by |
|--------|-------|---------|
| `DISCORD_BOT_TOKEN` | `~/Documents/secret/.env` + `.github` repo Actions secret | setup/verify/post + drift cron |
| `DISCORD_GUILD_ID` | same | same |
| `DISCORD_GITHUB_WEBHOOK_URL` | `~/Documents/secret/.env` + GitHub org webhook config | GitHub → #github-feed |
| `DISCORD_ANNOUNCE_WEBHOOK_URL` | `~/Documents/secret/.env` + sipher VPS env | HERALD digest cross-post |
| `DISCORD_MODLOG_WEBHOOK_URL` | `~/Documents/secret/.env` + `.github` Actions secret | drift alerts |

Rotation (do immediately on any suspected leak):
1. Bot token: Developer Portal → SIPHER → Bot → Reset Token (MFA = RECTOR) → update `.env`,
   `.github` Actions secret. 2. Webhooks: delete in Server Settings → Integrations → re-run
   `setup.js` (recreates + prints new URLs) → update `.env`, org webhook config, VPS env,
   Actions secret. Webhook URLs are post-only capabilities; the bot token is Administrator — guard accordingly.

## 8. Gotchas

API behaviors learned in v1 setup (COMMUNITY prerequisites, type-5 timing, managed-role
403, OAuth app-handoff, onboarding minimums) — see the spec for
`2026-06-10-discord-server-design.md` and the session memory `reference_discord-server-iac`.
```

- [ ] **Step 2: Commit**

```bash
git add discord/PLAYBOOK.md
git commit -m "docs(discord): operations playbook — standards, workflows, growth triggers"
```

---

### Task 12: Drift-check GitHub Action

**Files:**
- Create: `.github/workflows/discord-drift.yml` (in the `.github` repo itself)

- [ ] **Step 1: Create the workflow**

```yaml
name: discord-drift
on:
  schedule:
    - cron: '0 6 * * 1'   # Mondays 06:00 UTC
  workflow_dispatch: {}

permissions: {}

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Unit tests
        run: node --test discord/test/
      - name: Drift check
        env:
          DISCORD_BOT_TOKEN: ${{ secrets.DISCORD_BOT_TOKEN }}
          DISCORD_GUILD_ID: ${{ secrets.DISCORD_GUILD_ID }}
        run: node discord/verify.js
      - name: Alert mod-log on drift
        if: failure()
        env:
          HOOK: ${{ secrets.DISCORD_MODLOG_WEBHOOK_URL }}
        run: |
          curl -sf -X POST -H 'Content-Type: application/json' "$HOOK" -d '{
            "username": "SIP Ops",
            "embeds": [{
              "title": "Discord drift detected",
              "description": "`verify.js` failed in the weekly check. Run `node discord/setup.js --plan` locally to see the diff.\n[Workflow run](https://github.com/sip-protocol/.github/actions/runs/'"$GITHUB_RUN_ID"')",
              "color": 15548997
            }]
          }'
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/discord-drift.yml
git commit -m "ci(discord): weekly drift check alerting #mod-log"
```

(Secrets are set in Task 15 — the schedule will no-op red until then; merge + secrets land same day.)

---

### Task 13: cdn-sip — ship the banner

**Files:**
- Create: `~/local-dev/cdn-sip/discord/banner-welcome.v1.png`

- [ ] **Step 1: Branch, copy, commit, PR**

```bash
cd ~/local-dev/cdn-sip
git remote -v   # confirm sip-protocol/cdn-sip
git fetch origin && git checkout -b feat/discord-assets origin/main
mkdir -p discord && cp ~/local-dev/sip-dot-github/discord/out/banner-welcome.v1.png discord/
git add discord/ && git commit -m "feat: Discord banner assets (banner-welcome.v1)"
git push -u origin feat/discord-assets
gh pr create --title "feat: Discord banner assets" --body "Adds \`discord/banner-welcome.v1.png\` (rendered from the SVG source in sip-protocol/.github \`discord/assets-src/\`) for the CV2 welcome seed. Served at cdn.sip-protocol.org/discord/. Part of the Discord professional standard (spec 2026-06-11)."
```

- [ ] **Step 2: Merge + verify live**

```bash
gh pr merge --merge --delete-branch
sleep 60 && curl -sI https://cdn.sip-protocol.org/discord/banner-welcome.v1.png | head -5
```

Expected: `HTTP/2 200`, `content-type: image/png`, immutable cache header. (Vercel auto-deploys main; if 404, wait for the deployment to finish and retry.)

---

### Task 14: LIVE RUN against the guild ★ RECTOR SERVER CHECKPOINT

**Files:** none (live API), env from `~/Documents/secret/.env`

- [ ] **Step 1: CV2 edit-on-plain probe in private #mod-log** (decides nothing in code — the fallback is automatic — but tells us what to expect before touching public seeds):

```bash
cd ~/local-dev/sip-dot-github/discord
set -a; . ~/Documents/secret/.env; set +a
node -e "
const { makeApi, requireEnv } = require('./api.js')
const { render } = require('./templates.js')
const { TOKEN, GUILD } = requireEnv(); const api = makeApi(TOKEN, 'SIP cv2-probe')
;(async () => {
  const chans = await api('GET', \`/guilds/\${GUILD}/channels\`)
  const modlog = chans.find(c => c.name === 'mod-log').id
  const plain = await api('POST', \`/channels/\${modlog}/messages\`, { content: 'cv2 probe' })
  const msg = render({ type: 'announcement', channel: 'mod-log', title: 'Probe', body: 'edit-to-CV2 test' })
  try {
    await api('PATCH', \`/channels/\${modlog}/messages/\${plain.id}\`, { ...msg, content: null })
    console.log('PROBE: edit-to-CV2 ACCEPTED — seeds will update in place')
  } catch (e) { console.log('PROBE: edit-to-CV2 REJECTED — seeds will delete+repost:', e.message.slice(0, 200)) }
  await api('DELETE', \`/channels/\${modlog}/messages/\${plain.id}\`)
  console.log('probe message deleted')
})().catch(e => { console.error(e.message); process.exit(1) })
"
```

Expected: either PROBE line, then `probe message deleted`. Record which path fired.

- [ ] **Step 2: Plan, apply, verify**

```bash
node setup.js --plan    # expect: +1 channel (github-feed), 4 seed patches/posts, +10 emojis, +3 webhooks
node setup.js           # ★ capture the 3 webhook URLs printed ONCE
node verify.js          # expect: ✓ live state matches manifest
node setup.js --plan    # expect: empty plan (idempotency)
```

Append the three printed URLs to `~/Documents/secret/.env`:

```bash
# (values from the setup.js output)
echo 'export DISCORD_GITHUB_WEBHOOK_URL="https://discord.com/api/webhooks/…"' >> ~/Documents/secret/.env
echo 'export DISCORD_ANNOUNCE_WEBHOOK_URL="https://discord.com/api/webhooks/…"' >> ~/Documents/secret/.env
echo 'export DISCORD_MODLOG_WEBHOOK_URL="https://discord.com/api/webhooks/…"' >> ~/Documents/secret/.env
```

- [ ] **Step 3: E2E `post.js` smoke test in #mod-log (private), then delete**

Create `posts/2026-06-XX-e2e-smoke.json` (use today's date):

```json
{
  "type": "release",
  "channel": "mod-log",
  "title": "post.js e2e smoke test",
  "body": "If you can read this in #mod-log, the posting pipeline works. This message will be deleted.",
  "buttons": [{ "label": "Toolkit", "url": "https://github.com/sip-protocol/.github" }]
}
```

```bash
node post.js posts/2026-06-XX-e2e-smoke.json --plan   # preview prints, no send
node post.js posts/2026-06-XX-e2e-smoke.json          # posts
# verify it rendered (accent strip, title, button), then delete via API:
node -e "
const { makeApi, requireEnv } = require('./api.js')
const { TOKEN, GUILD } = requireEnv(); const api = makeApi(TOKEN, 'SIP smoke-cleanup')
;(async () => {
  const chans = await api('GET', \`/guilds/\${GUILD}/channels\`)
  const modlog = chans.find(c => c.name === 'mod-log').id
  const msgs = await api('GET', \`/channels/\${modlog}/messages?limit=5\`)
  const mine = msgs.find(m => JSON.stringify(m.components || []).includes('post.js e2e smoke test'))
  if (mine) { await api('DELETE', \`/channels/\${modlog}/messages/\${mine.id}\`); console.log('smoke message deleted') }
})().catch(e => { console.error(e.message); process.exit(1) })
"
rm posts/2026-06-XX-e2e-smoke.json   # smoke payload is not part of the audit trail
```

- [ ] **Step 4: ★ RECTOR CHECKPOINT — eyeball tour**

RECTOR (or CIPHER via Chrome MCP with RECTOR watching) checks: 4 reskinned seeds (purple containers, welcome banner image, buttons work, pins intact), `:sip_shield:` & friends in the emoji picker, #github-feed exists read-only. **Iterate on any visual complaint by editing manifest payloads / SVGs and re-running `setup.js` (that's the whole point of reconciled seeds).**

- [ ] **Step 5: Commit any payload/manifest tweaks from the tour**

```bash
git add -A discord/ && git diff --cached --quiet || git commit -m "polish(discord): post-tour seed/asset tweaks"
```

---

### Task 15: Ship `.github` — PR, secrets, drift run, GitHub org webhook

- [ ] **Step 1: Push + PR + merge**

```bash
cd ~/local-dev/sip-dot-github
git push -u origin feat/discord-professional-standard
gh pr create --title "feat(discord): professional standard v1.5 — CV2 templates, post.js, reconciled seeds, assets, playbook, drift CI" --body "Implements the Discord professional standard (sip-protocol spec 2026-06-11): pure CV2 template renderer + validation, git-archived post.js, seeds reconciled as managed messages (live server already reskinned + verified drift-free), SVG→PNG pipeline (emojis committed, banner on cdn), PLAYBOOK.md, weekly drift Action. Tests: node --test discord/test/ (25+)."
gh pr merge --merge --delete-branch
```

- [ ] **Step 2: Set Actions secrets + validate the drift workflow**

```bash
set -a; . ~/Documents/secret/.env; set +a
gh secret set DISCORD_BOT_TOKEN --repo sip-protocol/.github --body "$DISCORD_BOT_TOKEN"
gh secret set DISCORD_GUILD_ID --repo sip-protocol/.github --body "$DISCORD_GUILD_ID"
gh secret set DISCORD_MODLOG_WEBHOOK_URL --repo sip-protocol/.github --body "$DISCORD_MODLOG_WEBHOOK_URL"
gh workflow run discord-drift --repo sip-protocol/.github
sleep 90 && gh run list --repo sip-protocol/.github --workflow discord-drift --limit 1
```

Expected: run `completed success`. (If it failed, the #mod-log alert should have fired — that's the alert path verified too; fix and re-dispatch.)

- [ ] **Step 3: Create the GitHub org webhook → #github-feed**

```bash
gh api orgs/sip-protocol/hooks -f name=web -F active=true \
  -f "events[]=release" -f "events[]=pull_request" -f "events[]=issues" \
  -f "config[url]=${DISCORD_GITHUB_WEBHOOK_URL}/github" \
  -f "config[content_type]=json"
gh api orgs/sip-protocol/hooks --jq '.[].config.url' | sed 's#webhooks/.*#webhooks/…#'
```

Expected: hook created (needs `admin:org_hook` scope — if 403, RECTOR grants it: `gh auth refresh -s admin:org_hook`). The feed proves itself on the next real org event (PR/issue/release) — check #github-feed renders it.

---

### Task 16: sipher — HERALD Friday-digest cross-post (TDD)

**Files:**
- Create: `packages/agent/src/herald/discord.ts`
- Modify: `packages/agent/src/herald/poller.ts` (checkScheduledPosts)
- Test: `packages/agent/tests/herald/discord.test.ts`, `packages/agent/tests/herald/poller.test.ts`

- [ ] **Step 1: Branch**

```bash
cd ~/local-dev/sipher
git remote -v && git fetch origin && git checkout -b feat/herald-discord-digest origin/main
```

- [ ] **Step 2: Write failing tests — `packages/agent/tests/herald/discord.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isFridayDigest, formatDigestEmbed, crosspostDigest } from '../../src/herald/discord.js'

describe('isFridayDigest', () => {
  it('true only for content rows created on a UTC Friday', () => {
    // 2026-06-12 is a Friday
    expect(isFridayDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z' })).toBe(true)
    expect(isFridayDigest({ type: 'content', created_at: '2026-06-11T08:00:00.000Z' })).toBe(false) // Thursday
    expect(isFridayDigest({ type: 'post', created_at: '2026-06-12T08:00:00.000Z' })).toBe(false)
    expect(isFridayDigest({ type: 'content', created_at: undefined })).toBe(false)
  })
})

describe('formatDigestEmbed', () => {
  it('builds the indigo HERALD webhook payload linking the X post', () => {
    const p = formatDigestEmbed('This week in SIP: shipped things.', '123456789')
    expect(p.username).toBe('HERALD')
    expect(p.avatar_url).toBe('https://github.com/sip-protocol.png')
    expect(p.embeds).toHaveLength(1)
    expect(p.embeds[0].title).toBe('This Week in SIP')
    expect(p.embeds[0].description).toBe('This week in SIP: shipped things.')
    expect(p.embeds[0].url).toBe('https://x.com/sipprotocol/status/123456789')
    expect(p.embeds[0].color).toBe(0x6366f1)
  })
})

describe('crosspostDigest', () => {
  beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('no-ops when DISCORD_ANNOUNCE_WEBHOOK_URL is unset', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z' }, '1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no-ops for non-digest rows', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await crosspostDigest({ type: 'content', created_at: '2026-06-10T08:00:00.000Z' }, '1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs the webhook for a Friday digest', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)
    await crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z', content: 'recap' }, '42')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://discord.com/api/webhooks/x/y')
    expect(JSON.parse(init.body).embeds[0].url).toContain('/status/42')
  })

  it('swallows fetch failures (X post already succeeded — never throw)', async () => {
    vi.stubEnv('DISCORD_ANNOUNCE_WEBHOOK_URL', 'https://discord.com/api/webhooks/x/y')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(
      crosspostDigest({ type: 'content', created_at: '2026-06-12T08:00:00.000Z', content: 'recap' }, '42')
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: Run to verify failure**

```bash
cd ~/local-dev/sipher/packages/agent && pnpm vitest run tests/herald/discord.test.ts
```

Expected: FAIL — module `src/herald/discord.ts` not found.

- [ ] **Step 4: Implement `packages/agent/src/herald/discord.ts`**

```ts
import { guardianBus } from '../coordination/event-bus.js'

/**
 * HERALD → Discord cross-post (spec: sip-protocol 2026-06-11 Discord professional standard §5.5).
 * Only the Friday "Week in SIP" digest crosses over — daily content stays X-only so
 * #announcements stays high-signal. Keyed on the queue row itself (type='content'
 * created on a UTC Friday), not on publish time, so a Saturday approval still crossposts.
 */
export function isFridayDigest(post: { type?: unknown; created_at?: unknown }): boolean {
  if (post.type !== 'content' || typeof post.created_at !== 'string') return false
  const d = new Date(post.created_at)
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 5
}

export interface DigestWebhookPayload {
  username: string
  avatar_url: string
  embeds: Array<{ title: string; description: string; url: string; color: number; footer: { text: string } }>
}

export function formatDigestEmbed(content: string, tweetId: string): DigestWebhookPayload {
  return {
    username: 'HERALD',
    avatar_url: 'https://github.com/sip-protocol.png',
    embeds: [{
      title: 'This Week in SIP',
      description: content,
      url: `https://x.com/sipprotocol/status/${tweetId}`,
      color: 0x6366f1,
      footer: { text: 'SIP Protocol · weekly digest · also on x.com/sipprotocol' },
    }],
  }
}

/**
 * Fire-and-forget: never throws. The X post already succeeded — a Discord failure
 * must not break the publish loop. Failures emit a guardian event for visibility.
 */
export async function crosspostDigest(post: Record<string, unknown>, tweetId: string): Promise<void> {
  const url = process.env.DISCORD_ANNOUNCE_WEBHOOK_URL
  if (!url || !isFridayDigest(post)) return
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatDigestEmbed(String(post.content ?? ''), tweetId)),
    })
    if (!res.ok) throw new Error(`webhook → ${res.status}`)
    guardianBus.emit({
      source: 'herald', type: 'herald:discord-crosspost', level: 'routine',
      data: { id: post.id ?? null, tweetId }, timestamp: new Date().toISOString(),
    })
  } catch (err) {
    guardianBus.emit({
      source: 'herald', type: 'herald:discord-crosspost-failed', level: 'important',
      data: { id: post.id ?? null, error: err instanceof Error ? err.message : String(err) },
      timestamp: new Date().toISOString(),
    })
  }
}
```

- [ ] **Step 5: Hook into `checkScheduledPosts`** in `packages/agent/src/herald/poller.ts` — add the import and one call after `markPublished`:

```ts
import { crosspostDigest } from './discord.js'
```

Inside the `for (const post of posts)` try block, directly after `markPublished(post.id as string, result.tweet_id)`:

```ts
      await crosspostDigest(post, result.tweet_id)
```

(`crosspostDigest` never throws, so the existing error-handling flow is unchanged.)

- [ ] **Step 6: Add a poller regression test** — in `packages/agent/tests/herald/poller.test.ts`, alongside the existing `checkScheduledPosts` tests, add (mirroring the file's existing mock style for `getReadyToPublish`/`publishTweet`/`markPublished`, and adding a `vi.mock` for the discord module):

```ts
vi.mock('../../src/herald/discord.js', () => ({ crosspostDigest: vi.fn().mockResolvedValue(undefined) }))
import { crosspostDigest } from '../../src/herald/discord.js'

it('crossposts after publishing (digest filtering happens inside crosspostDigest)', async () => {
  // arrange one ready post via the file's existing mocks, then:
  await checkScheduledPosts()
  expect(crosspostDigest).toHaveBeenCalledOnce()
})
```

- [ ] **Step 7: Run the herald suites + typecheck**

```bash
cd ~/local-dev/sipher/packages/agent && pnpm vitest run tests/herald/ && cd ~/local-dev/sipher && pnpm typecheck
```

Expected: all green (poller tests may need their mocks extended for the new import — the failure output names exactly what).

- [ ] **Step 8: Commit + PR + merge (CI: test → build-and-push → deploy)**

```bash
git add packages/agent/src/herald/discord.ts packages/agent/src/herald/poller.ts packages/agent/tests/herald/
git commit -m "feat(herald): cross-post the Friday digest to Discord #announcements"
git push -u origin feat/herald-discord-digest
gh pr create --title "feat(herald): Discord digest cross-post" --body "After a successful X publish of the Friday 'Week in SIP' content row, HERALD now also posts an indigo embed to the Discord #announcements webhook (DISCORD_ANNOUNCE_WEBHOOK_URL — no-op when unset, never throws into the publish loop). Part of the Discord professional standard (sip-protocol spec 2026-06-11)."
gh pr merge --merge --delete-branch
```

- [ ] **Step 9: VPS env + redeploy verification**

The merge auto-deploys via CI. Add the env on the VPS sipher service and recreate:

```bash
ssh sip 'grep -q DISCORD_ANNOUNCE_WEBHOOK_URL ~/app/.env || echo "DISCORD_ANNOUNCE_WEBHOOK_URL=<value from ~/Documents/secret/.env>" >> ~/app/.env'
ssh sip 'cd ~/app && docker compose up -d sipher && docker compose exec sipher printenv DISCORD_ANNOUNCE_WEBHOOK_URL | cut -c1-45'
```

Expected: the URL prefix prints from inside the container. (Adjust the env file path/service name to what `~/app/docker-compose.yml` actually uses — check before editing; if CI deploy is still running, wait for it first: `gh run list --repo sip-protocol/sipher --limit 3`.)

Live proof lands automatically next Friday (HeraldView approval → X → #announcements embed).

---

### Task 17: Close-out

- [ ] **Step 1: sip-protocol PR for spec + this plan**

```bash
cd ~/local-dev/sip-protocol
git checkout docs/discord-professional-standard
git add docs/superpowers/plans/2026-06-11-discord-professional-standard.md
git commit -m "docs: add Discord professional standard implementation plan"
git push -u origin docs/discord-professional-standard
gh pr create --title "docs: Discord professional standard (v1.5) — spec + plan" --body "Design spec + implementation plan for the Discord professional standard: CV2 message format, post.js tooling, reconciled seeds, SVG asset pipeline, brand emojis, feeds (GitHub org webhook / HERALD digest / drift cron), and the operations playbook."
gh pr merge --merge --delete-branch
```

- [ ] **Step 2: Verification sweep (spec §8)**

```bash
cd ~/local-dev/sip-dot-github/discord
node --test test/ && node verify.js && node setup.js --plan   # tests green · drift-free · empty plan
curl -sI https://cdn.sip-protocol.org/discord/banner-welcome.v1.png | head -3
gh run list --repo sip-protocol/.github --workflow discord-drift --limit 1
```

Confirm in Discord: reskinned seeds visible, emojis in picker, #github-feed read-only. Outstanding async proofs: GitHub feed on next org event; HERALD digest next Friday.

- [ ] **Step 3: T3 evidence + trackers**

Add to `~/.claude/sip-protocol/grants/superteam-indonesia-2026-01/reports/T3-milestone-report.md` (Discord section): one line — professional operations standard shipped (CV2 message system, git-audited posting, automated GitHub/HERALD feeds, drift CI, operations playbook). Update `TRACKER.md` weekly log. Update memory (`reference_discord-server-iac` gains: templates/post.js/seeds-v2/render recipe + CV2-edit probe result; MEMORY.md T3_22 line) and write the session handoff.

---

## Self-Review (done at write time)

- **Spec coverage:** §3 format/types → Task 2; §5.1 post.js → Task 3; §5.2 seeds v2 + migration probe → Tasks 4/6/14; §5.3 pipeline → Tasks 7/9/10/13; §5.4 emojis → Tasks 5/8/10/14; §5.5 feeds → Tasks 5/6 (webhooks), 15 (org hook), 16 (HERALD), 12 (drift); §6 playbook → Task 11; §7 testing → TDD throughout; §8 verification → Tasks 14/17; §10 ship shape → Tasks 13/15/16/17. ✓
- **Checkpoints:** RECTOR art eyeball (Task 10 Step 3), RECTOR server tour (Task 14 Step 4) — both blocking. ✓
- **Type consistency:** `render(payload, {seedKey})` / `normalizeComponents(components)` / `planSeeds(seeds, messagesByChannel, botUserId, renderSeed, normalize)` used identically in Tasks 2/4/6; webhook env names match across manifest (Task 5), setup output (Task 6), Actions secrets (Tasks 12/15), sipher (Task 16), playbook (Task 11). ✓
- **Known judgment calls:** seed `--plan` pre-fetches messages (needs channels to exist — guarded for first-run); poller test mock shape follows the existing file's conventions rather than being fully reproduced here (the file's own mocks are authoritative); Inter zip layout located by `find` rather than hardcoded path.
