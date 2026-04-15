# Sipher Phase 2 — Plan D: Guardian Command UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic Vite chat app with Guardian Command — a world-class privacy operations interface with activity stream, command bar, vault view, HERALD tab, and squad view.

**Architecture:** Two phases. Phase 1 (interactive) uses AI Designer MCP to generate the visual design — RECTOR must be present to approve. Phase 2 (subagent) implements the approved designs as React components wired to the Express API via SSE and REST. Single-page app with client-side routing. Solana wallet adapter for auth + TX signing.

**Tech Stack:** React 19, Vite, Tailwind CSS 4, Solana wallet adapter, EventSource (SSE), fetch (REST)

**Spec:** `docs/superpowers/specs/2026-04-09-sipher-phase2-guardian-command-design.md` (Section 4)

**Working directory:** `~/local-dev/sipher/`

**Branch:** `feat/phase2-guardian-command` (continues from Plans A + B + C)

**Depends on:** Plans A-C complete (all API endpoints, SSE stream, wallet auth)

---

## Phase 1: Design Generation (Interactive — RECTOR Required)

**This phase is NOT subagent-driven.** It requires RECTOR present to approve designs via AI Designer MCP.

### Task 0: Generate Designs with AI Designer

This task is executed by CIPHER (the controller) directly, NOT by a subagent. It uses `mcp__plugin_design_aidesigner__generate_design` and `mcp__plugin_design_aidesigner__refine_design`.

- [ ] **Step 1: Generate main layout + activity stream**

Prompt for AI Designer:
```
Dark privacy operations interface called "Guardian Command" for a Solana privacy protocol.

Layout: Single column, mobile-first. Header (logo + wallet status), primary view area, command bar input at bottom, bottom navigation tabs.

Design tokens:
- Background: #0A0A0B
- Cards: #141416 with 1px #1E1E22 border
- Text: #F5F5F5 primary, #71717A secondary
- Agent colors: Emerald #10B981 (SIPHER), Blue #3B82F6 (HERALD), Amber #F59E0B (SENTINEL), Violet #8B5CF6 (COURIER)
- Borders: 1px, 8px radius
- No shadows except command bar overlay
- Mono font for addresses/hashes, sans-serif for everything else

Activity stream view (default): Reverse chronological feed. Each entry has colored dot + agent name + time ago + title + optional detail + optional action buttons (Claim, View TX, Approve). Critical alerts have amber left border.

Command bar: Collapsed single-line input "Talk to SIPHER..." at bottom. Dark, minimal.

Bottom nav: 4 tabs — Stream, Vault, HERALD, Squad. Active tab highlighted.

Style: Linear meets crypto wallet. Terminal-inspired but polished. NOT neon, NOT glassmorphism. Clean, fast, secure.
```

- [ ] **Step 2: RECTOR reviews and refines**

Iterate with `refine_design` until approved.

- [ ] **Step 3: Generate vault view**

Prompt: Balance card (SOL amount + USD), Deposit/Withdraw buttons, pending operations list, recent activity with privacy indicators. Same design tokens.

- [ ] **Step 4: Generate HERALD view**

Prompt: X agent dashboard with sub-tabs (Activity, Queue, DMs). Budget bar at top. Queue shows pending posts with Approve/Edit/Reject. Same design tokens.

- [ ] **Step 5: Generate squad view**

Prompt: Agent status cards (4 agents, each with status dot + name + state + cost). Today's stats grid. Coordination log. Kill switch button. Same design tokens.

- [ ] **Step 6: Generate command bar expanded state**

Prompt: Bottom sheet overlay. Chat conversation with SIPHER. Tool execution progress steps. Confirmation card with countdown. Minimizable to pill.

- [ ] **Step 7: Save approved designs**

Save final HTML/CSS from AI Designer as reference files in `app/designs/`. These are the source of truth for implementation.

---

## Phase 2: Implementation (Subagent-Driven)

### File Map

```
app/
├── index.html               # Modify: update title, meta
├── src/
│   ├── main.tsx             # Modify: mount new App with router
│   ├── App.tsx              # Rewrite: shell with routing + providers
│   ├── api/
│   │   ├── client.ts        # REST API client (fetch wrapper)
│   │   ├── sse.ts           # SSE client (EventSource + reconnect)
│   │   └── auth.ts          # Wallet auth (nonce → JWT flow)
│   ├── components/
│   │   ├── Header.tsx       # Logo + wallet status + connection dot
│   │   ├── BottomNav.tsx    # 4-tab navigation
│   │   ├── CommandBar.tsx   # Collapsed input + expanded sheet
│   │   ├── ActivityEntry.tsx # Single stream entry (agent dot + title + actions)
│   │   ├── ConfirmCard.tsx  # Confirmation with countdown
│   │   └── AgentDot.tsx     # Colored status dot component
│   ├── views/
│   │   ├── StreamView.tsx   # Activity stream (SSE-powered)
│   │   ├── VaultView.tsx    # Balance + deposit/withdraw + history
│   │   ├── HeraldView.tsx   # X agent dashboard (queue + DMs + budget)
│   │   └── SquadView.tsx    # Agent status + costs + coordination log
│   ├── hooks/
│   │   ├── useSSE.ts        # SSE connection hook
│   │   ├── useAuth.ts       # Wallet auth hook (JWT management)
│   │   └── useApi.ts        # API fetch hook with auth headers
│   ├── styles/
│   │   └── theme.css        # Rewrite: design tokens from AI Designer
│   └── lib/
│       ├── agents.ts        # Agent identity constants (colors, names)
│       └── format.ts        # Time formatting, address truncation, SOL formatting
```

---

### Task 1: Install Tailwind CSS 4 + Design System

**Files:**
- Modify: `app/package.json`
- Rewrite: `app/src/styles/theme.css`
- Create: `app/src/lib/agents.ts`
- Create: `app/src/lib/format.ts`

- [ ] **Step 1: Install Tailwind CSS 4**

```bash
cd ~/local-dev/sipher/app
pnpm add tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Vite for Tailwind**

Update `app/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
```

- [ ] **Step 3: Write design system CSS**

Rewrite `app/src/styles/theme.css`:
```css
@import 'tailwindcss';

@theme {
  --color-bg: #0A0A0B;
  --color-card: #141416;
  --color-border: #1E1E22;
  --color-text: #F5F5F5;
  --color-text-secondary: #71717A;
  --color-sipher: #10B981;
  --color-herald: #3B82F6;
  --color-sentinel: #F59E0B;
  --color-courier: #8B5CF6;
  --radius-lg: 8px;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  margin: 0;
  min-height: 100dvh;
}

.font-mono {
  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
}
```

- [ ] **Step 4: Create agent identity constants**

Create `app/src/lib/agents.ts`:
```typescript
export const AGENTS = {
  sipher: { name: 'SIPHER', color: '#10B981', role: 'Lead Agent' },
  herald: { name: 'HERALD', color: '#3B82F6', role: 'X Agent' },
  sentinel: { name: 'SENTINEL', color: '#F59E0B', role: 'Monitor' },
  courier: { name: 'COURIER', color: '#8B5CF6', role: 'Executor' },
} as const

export type AgentName = keyof typeof AGENTS
```

- [ ] **Step 5: Create formatting utilities**

Create `app/src/lib/format.ts`:
```typescript
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function formatSOL(lamports: number | string): string {
  const sol = typeof lamports === 'string' ? parseFloat(lamports) : lamports
  return sol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}
```

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: install Tailwind CSS 4 + design system tokens + agent constants"
```

---

### Task 2: API Client Layer (REST + SSE + Auth)

**Files:**
- Create: `app/src/api/client.ts`
- Create: `app/src/api/sse.ts`
- Create: `app/src/api/auth.ts`
- Create: `app/src/hooks/useAuth.ts`
- Create: `app/src/hooks/useSSE.ts`
- Create: `app/src/hooks/useApi.ts`

- [ ] **Step 1: Implement REST client**

Create `app/src/api/client.ts`:
```typescript
const BASE = import.meta.env.VITE_API_URL ?? ''

export async function apiFetch<T>(path: string, options?: RequestInit & { token?: string }): Promise<T> {
  const { token, ...fetchOpts } = options ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE}${path}`, { ...fetchOpts, headers: { ...headers, ...fetchOpts.headers as Record<string, string> } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as any).error ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}
```

- [ ] **Step 2: Implement SSE client**

Create `app/src/api/sse.ts`:
```typescript
export type SSEHandler = (event: MessageEvent) => void

export function connectSSE(token: string, onEvent: SSEHandler, onError?: (err: Event) => void): EventSource {
  const url = `${import.meta.env.VITE_API_URL ?? ''}/api/stream?token=${encodeURIComponent(token)}`
  const source = new EventSource(url)

  source.addEventListener('activity', onEvent)
  source.addEventListener('confirm', onEvent)
  source.addEventListener('agent-status', onEvent)
  source.addEventListener('herald-budget', onEvent)
  source.addEventListener('cost-update', onEvent)

  source.onerror = (err) => {
    onError?.(err)
    // Auto-reconnect is built into EventSource
  }

  return source
}
```

- [ ] **Step 3: Implement wallet auth**

Create `app/src/api/auth.ts`:
```typescript
import { apiFetch } from './client.js'

export async function requestNonce(wallet: string): Promise<{ nonce: string, message: string }> {
  return apiFetch('/api/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  })
}

export async function verifySignature(wallet: string, nonce: string, signature: string): Promise<{ token: string, expiresIn: string }> {
  return apiFetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, nonce, signature }),
  })
}
```

- [ ] **Step 4: Implement React hooks**

Create `app/src/hooks/useAuth.ts`:
```typescript
import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { requestNonce, verifySignature } from '../api/auth'

export function useAuth() {
  const { publicKey, signMessage } = useWallet()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) return null
    setLoading(true)
    try {
      const wallet = publicKey.toBase58()
      const { nonce, message } = await requestNonce(wallet)
      const encoded = new TextEncoder().encode(message)
      const sig = await signMessage(encoded)
      const sigHex = Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('')
      const result = await verifySignature(wallet, nonce, sigHex)
      setToken(result.token)
      return result.token
    } finally {
      setLoading(false)
    }
  }, [publicKey, signMessage])

  return { token, authenticate, loading, isAuthenticated: !!token }
}
```

Create `app/src/hooks/useSSE.ts`:
```typescript
import { useEffect, useRef, useState } from 'react'
import { connectSSE } from '../api/sse'

export interface ActivityEvent {
  id: string
  agent: string
  type: string
  level: string
  data: Record<string, unknown>
  timestamp: string
}

export function useSSE(token: string | null) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!token) return

    const source = connectSSE(token, (e) => {
      const data = JSON.parse(e.data) as ActivityEvent
      setEvents(prev => [data, ...prev].slice(0, 200))
    })

    sourceRef.current = source
    return () => { source.close(); sourceRef.current = null }
  }, [token])

  return { events, connected: !!sourceRef.current }
}
```

Create `app/src/hooks/useApi.ts`:
```typescript
import { useCallback } from 'react'
import { apiFetch } from '../api/client'

export function useApi(token: string | null) {
  const authFetch = useCallback(<T>(path: string, options?: RequestInit) => {
    return apiFetch<T>(path, { ...options, token: token ?? undefined })
  }, [token])

  return { fetch: authFetch }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/src/api/ app/src/hooks/
git commit -m "feat: add API client layer — REST, SSE, wallet auth hooks"
```

---

### Task 3: App Shell + Routing + Bottom Nav

**Files:**
- Rewrite: `app/src/App.tsx`
- Rewrite: `app/src/main.tsx`
- Create: `app/src/components/Header.tsx`
- Create: `app/src/components/BottomNav.tsx`
- Create: `app/src/components/AgentDot.tsx`

- [ ] **Step 1: Rewrite App.tsx — shell with routing**

```typescript
import { useState, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'
import './styles/theme.css'

import Header from './components/Header'
import BottomNav from './components/BottomNav'
import CommandBar from './components/CommandBar'
import StreamView from './views/StreamView'
import VaultView from './views/VaultView'
import HeraldView from './views/HeraldView'
import SquadView from './views/SquadView'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'

type View = 'stream' | 'vault' | 'herald' | 'squad'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
const ENDPOINTS: Record<string, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

export default function App() {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL ?? ENDPOINTS[NETWORK]
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [])
  const [activeView, setActiveView] = useState<View>('stream')
  const { token, authenticate, isAuthenticated } = useAuth()
  const { events } = useSSE(token)

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="flex flex-col h-dvh bg-bg">
            <Header onAuth={authenticate} isAuthenticated={isAuthenticated} />
            <main className="flex-1 overflow-y-auto">
              {activeView === 'stream' && <StreamView events={events} token={token} />}
              {activeView === 'vault' && <VaultView token={token} />}
              {activeView === 'herald' && <HeraldView token={token} />}
              {activeView === 'squad' && <SquadView token={token} />}
            </main>
            <CommandBar token={token} />
            <BottomNav active={activeView} onChange={setActiveView} />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
```

- [ ] **Step 2: Create Header, BottomNav, AgentDot components**

Header — logo + wallet button + connection status dot.
BottomNav — 4 tabs (Stream, Vault, HERALD, Squad) with active highlight.
AgentDot — small colored circle component.

Each component uses Tailwind classes matching the design tokens.

- [ ] **Step 3: Update main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd ~/local-dev/sipher/app && pnpm dev
```

Open http://localhost:5173 — should show dark background, header, bottom nav.

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: add app shell — header, bottom nav, view routing, wallet providers"
```

---

### Task 4: Activity Stream View

**Files:**
- Create: `app/src/views/StreamView.tsx`
- Create: `app/src/components/ActivityEntry.tsx`

- [ ] **Step 1: Implement ActivityEntry component**

Single stream entry: colored agent dot, agent name, time ago, title, optional detail, optional action buttons.

Critical alerts get amber left border. Actionable entries show inline buttons (Claim, Approve, View TX).

- [ ] **Step 2: Implement StreamView**

Reverse chronological list of ActivityEntry components. Receives `events` from SSE hook. Falls back to `GET /api/activity` on initial load. New entries animate in with fade. Filter by agent tap.

- [ ] **Step 3: Commit**

```bash
git add app/src/views/StreamView.tsx app/src/components/ActivityEntry.tsx
git commit -m "feat: add activity stream view — SSE-powered real-time feed"
```

---

### Task 5: Command Bar

**Files:**
- Create: `app/src/components/CommandBar.tsx`
- Create: `app/src/components/ConfirmCard.tsx`

- [ ] **Step 1: Implement CommandBar**

Collapsed: single line input with "Talk to SIPHER..." placeholder. Activates on tap or Cmd+K.

Expanded: bottom sheet overlay (position: fixed, slides up). Shows conversation with SIPHER. Sends messages via `POST /api/command`. Shows tool execution steps. Minimizable to pill "SIPHER is working..."

Key behaviors:
- `Escape` or swipe-down minimizes
- Conversation persists across view switches
- Active operation shows step indicators

- [ ] **Step 2: Implement ConfirmCard**

Confirmation card for fund-moving operations: action, amount, destination, fee, confirm/cancel buttons, countdown timer bar (120s default). Sends `POST /api/confirm/:id` on confirm/cancel. Auto-cancels on timeout.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/CommandBar.tsx app/src/components/ConfirmCard.tsx
git commit -m "feat: add command bar — bottom sheet chat with confirmation cards"
```

---

### Task 6: Vault View

**Files:**
- Create: `app/src/views/VaultView.tsx`

- [ ] **Step 1: Implement VaultView**

Fetches data from `GET /api/vault`. Sections:

1. **Balance card** — large SOL amount + USD estimate. [Deposit] and [Withdraw Privately] buttons.
2. **Pending operations** — list of active scheduled ops (drip, recurring, sweep) with next execution time.
3. **Recent activity** — deposit/withdraw history from vault API. Privacy indicator (stealth checkmark).
4. **Fee summary** — total fees collected.

Deposit/withdraw buttons open a step-by-step overlay (not implemented as functional yet — shows the flow mockup). Real TX submission is through the command bar (talk to SIPHER: "deposit 5 SOL").

- [ ] **Step 2: Commit**

```bash
git add app/src/views/VaultView.tsx
git commit -m "feat: add vault view — balance, pending ops, activity, fee summary"
```

---

### Task 7: HERALD View

**Files:**
- Create: `app/src/views/HeraldView.tsx`

- [ ] **Step 1: Implement HeraldView**

Fetches data from `GET /api/herald`. Three sub-tabs:

**Activity tab:** Recent posts + replies with engagement metrics (likes, RTs). "View on X" links.

**Queue tab:** Pending posts with [Approve] [Edit] [Reject] buttons. Budget bar at top showing `$spent/$limit` with color shift (green → amber → red). Actions call `POST /api/herald/approve/:id`.

**DMs tab:** One-line summaries (username, intent, resolution). Links to execution links if generated.

- [ ] **Step 2: Commit**

```bash
git add app/src/views/HeraldView.tsx
git commit -m "feat: add HERALD view — X activity, approval queue, DMs, budget bar"
```

---

### Task 8: Squad View

**Files:**
- Create: `app/src/views/SquadView.tsx`

- [ ] **Step 1: Implement SquadView**

Fetches data from `GET /api/squad`. Sections:

1. **Agent status cards** — 4 cards, each with colored dot, agent name, status (active/idle/polling/scanning), today's cost.
2. **Today's stats** — grid: tool calls, X posts, blocks scanned, alerts, scheduled ops, total costs.
3. **Coordination log** — last 24h of agent-to-agent events (from agent_events table).
4. **Kill switch** — red [Pause All Vault Ops] button. Calls `POST /api/squad/kill`. Shows active state.

- [ ] **Step 2: Commit**

```bash
git add app/src/views/SquadView.tsx
git commit -m "feat: add squad view — agent status, costs, coordination log, kill switch"
```

---

### Task 9: Integration + Build Verification

**Files:**
- Modify: `app/index.html` (update title, meta)

- [ ] **Step 1: Update index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Guardian Command — Sipher</title>
  <meta name="description" content="Privacy operations interface by SIP Protocol" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Verify build succeeds**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

Expected: builds to `app/dist/` without errors.

- [ ] **Step 3: Verify dev server + API proxy work together**

Start both:
```bash
# Terminal 1: API server
cd ~/local-dev/sipher && pnpm dev

# Terminal 2: Frontend dev server
cd ~/local-dev/sipher/app && pnpm dev
```

Open http://localhost:5173 — should show Guardian Command with dark theme, bottom nav, empty activity stream.

- [ ] **Step 4: Remove old components**

Delete old chat components that are no longer used:
- `app/src/components/ChatContainer.tsx`
- `app/src/components/TextMessage.tsx`
- `app/src/components/QuickActions.tsx`

Keep `WalletBar.tsx` only if Header.tsx doesn't fully replace it.

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: Guardian Command UI complete — all views, command bar, build verified"
```

---

## Summary

| Task | What | Type | Files |
|------|------|------|-------|
| 0 | AI Designer — generate designs | Interactive (RECTOR) | app/designs/ |
| 1 | Tailwind + design system + constants | Code | theme.css, agents.ts, format.ts |
| 2 | API client layer (REST + SSE + Auth) | Code | api/*.ts, hooks/*.ts |
| 3 | App shell + routing + nav | Code | App.tsx, Header, BottomNav |
| 4 | Activity stream view | Code | StreamView, ActivityEntry |
| 5 | Command bar | Code | CommandBar, ConfirmCard |
| 6 | Vault view | Code | VaultView |
| 7 | HERALD view | Code | HeraldView |
| 8 | Squad view | Code | SquadView |
| 9 | Integration + build | Code | index.html, cleanup |

**Total:** 10 tasks (1 interactive + 9 code), ~9 commits, ~20 files

**Execution note:** Task 0 requires RECTOR present for AI Designer approval. Tasks 1-9 can be subagent-driven after designs are approved. Tasks 4-8 (view components) are independent and can be parallelized (max 2 at a time for resource safety).

**Frontend testing note:** This plan does NOT include frontend unit tests (no Vitest for React components). The views are API consumers — correctness is verified by the backend tests (Plans A-C) plus manual visual verification during Task 9. If RECTOR wants component tests, add them as a follow-up.
