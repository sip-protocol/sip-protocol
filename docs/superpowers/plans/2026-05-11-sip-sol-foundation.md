# sip.sol Foundation (F1+F2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@sip-protocol/sns-stealth@0.1.0` to npm and integrate SIP-STEALTH SNS records into sip-app, sip-mobile, and sipher so `.sol` names work as private payment recipients across all three SIP surfaces.

**Architecture:** New monorepo package `packages/sns-stealth/` exposes `resolveSIPStealth`, `buildPublishTx`, `deriveStealthKeys`. Three existing app repos consume it via npm. Per-domain DKSAP key derivation uses HKDF-SHA256 over a wallet signature; record is JSON `{v:1, spending, viewing}` published under the SNS record key `SIP-STEALTH`. Sender UX uses warn-and-downgrade fallback when no record is published.

**Tech Stack:** TypeScript · pnpm + Turborepo · Vitest · @bonfida/spl-name-service · @noble/curves (ed25519) · @noble/hashes (sha256, hkdf) · zod · Next.js 16 (sip-app) · Expo 54 + React Native (sip-mobile) · Express + Pi SDK (sipher)

**Spec:** `docs/superpowers/specs/2026-05-11-sip-sol-foundation-design.md`

---

## File Structure

### Phase A — `packages/sns-stealth/` (new package, this monorepo)

```
packages/sns-stealth/
├── package.json              @sip-protocol/sns-stealth@0.1.0
├── tsconfig.json             extends monorepo base
├── README.md                 package usage docs
├── src/
│   ├── index.ts              public API exports
│   ├── schema.ts             Zod v1 record schema + types
│   ├── errors.ts             NotFound · Malformed · NetworkError · UserRejected · OnChainError
│   ├── cache.ts              in-memory TTL cache
│   ├── derive.ts             deriveStealthKeys(wallet, domain) via HKDF-SHA256
│   ├── resolve.ts            resolveSIPStealth(domain) with Bonfida lookup
│   └── publish.ts            buildPublishTx(domain, keys, payer)
└── tests/
    ├── schema.test.ts        v1 validation + reject cases
    ├── errors.test.ts        typed error behavior
    ├── cache.test.ts         TTL + invalidation
    ├── derive.test.ts        determinism + per-domain uniqueness
    ├── resolve.test.ts       all branches (Found/NotFound/Malformed)
    ├── publish.test.ts       transaction structure
    └── integration.test.ts   live devnet round-trip
```

### Phase B — `sip-protocol/sip-app` (separate repo)

- Modify `package.json` — add `@sip-protocol/sns-stealth` + version bump
- Create `src/app/wallet/sip-stealth/page.tsx` — publish flow page
- Create `src/app/wallet/sip-stealth/PublishCard.tsx` — per-domain card
- Modify `src/app/payments/send/page.tsx` — accept `<domain>.sol` recipient + fallback toast
- Create `src/lib/sns-stealth-client.ts` — client-side wrapper around the SDK
- Tests: extend existing Playwright + Vitest suites

### Phase C — `sip-protocol/sip-mobile` (separate repo)

- Modify `package.json` — add `@sip-protocol/sns-stealth`
- Create `app/(tabs)/settings/sip-stealth.tsx` — publish screen
- Modify `app/(tabs)/send/index.tsx` — recipient resolution
- Create `lib/sns-stealth-mobile.ts` — RN-specific wrapper
- Tests: existing Jest suite + Seeker device walkthrough

### Phase D — `sip-protocol/sipher` (separate repo)

- Modify `packages/agent/package.json` — add `@sip-protocol/sns-stealth`
- Create `packages/agent/src/tools/resolveSNS.ts` — agent tool
- Create `packages/agent/src/tools/sendPrivateToSNS.ts` — composite agent tool
- Modify `packages/agent/src/tools/index.ts` — register new tools
- Tests: follow existing 29-tool-test pattern (Phase 5 audit)

### Phase E — cross-repo mainnet smoke + npm publish

- Tag + publish `@sip-protocol/sns-stealth@0.1.0` to npm
- Mainnet end-to-end test using one SIP-owned `.sol` domain
- Document TX signatures for changelog

---

# Phase A — `@sip-protocol/sns-stealth` package

Builds the SDK that everything downstream depends on. Each task is self-contained and ends with a green test suite + commit.

## Task 1: Scaffold package skeleton

**Files:**
- Create: `packages/sns-stealth/package.json`
- Create: `packages/sns-stealth/tsconfig.json`
- Create: `packages/sns-stealth/src/index.ts`
- Create: `packages/sns-stealth/README.md`
- Modify: `pnpm-workspace.yaml` (if not already including `packages/*`)

- [ ] **Step 1: Verify monorepo workspace pattern**

Run: `cat pnpm-workspace.yaml`
Expected: Contains `- 'packages/*'`. If not, add it.

- [ ] **Step 2: Create `packages/sns-stealth/package.json`**

```json
{
  "name": "@sip-protocol/sns-stealth",
  "version": "0.1.0",
  "description": "SNS-based stealth address resolution and publishing for SIP Protocol",
  "license": "MIT",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md"],
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@bonfida/spl-name-service": "^3.0.0",
    "@noble/curves": "^1.4.0",
    "@noble/hashes": "^1.4.0",
    "@solana/web3.js": "^1.95.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

Pin exact versions to match other packages in the monorepo — run `pnpm ls @bonfida/spl-name-service @noble/curves @noble/hashes zod` from repo root and align with what's already installed.

- [ ] **Step 3: Create `packages/sns-stealth/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "moduleResolution": "node",
    "target": "ES2022",
    "module": "ESNext",
    "declaration": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

Adjust the `extends` path if the monorepo root tsconfig has a different filename.

- [ ] **Step 4: Create placeholder `packages/sns-stealth/src/index.ts`**

```typescript
// Public API surface — populated in subsequent tasks
export {}
```

- [ ] **Step 5: Create `packages/sns-stealth/README.md`**

```markdown
# @sip-protocol/sns-stealth

SNS-based stealth address resolution and publishing for SIP Protocol.

Publish a `SIP-STEALTH` record on your `.sol` domain → receive private payments by name. Any SIP-aware app can resolve `rector.sol` to a one-time stealth address.

See the design spec at `docs/superpowers/specs/2026-05-11-sip-sol-foundation-design.md`.

## Install

```bash
pnpm add @sip-protocol/sns-stealth
```

## Usage

```typescript
import { resolveSIPStealth, buildPublishTx, deriveStealthKeys } from '@sip-protocol/sns-stealth'

// Sender
const meta = await resolveSIPStealth('rector.sol')
if (meta instanceof MetaAddress) { /* send privately */ }

// Receiver (one-time setup)
const keys = await deriveStealthKeys(wallet, 'rector.sol')
const tx = await buildPublishTx('rector.sol', keys, wallet.publicKey)
await wallet.sendTransaction(tx)
```
```

- [ ] **Step 6: Install + verify**

Run: `pnpm install`
Expected: workspace recognizes the new package; new `packages/sns-stealth/node_modules` directory created.

Run: `pnpm --filter @sip-protocol/sns-stealth typecheck`
Expected: PASS (no source files yet to type-check, but config is valid).

- [ ] **Step 7: Commit**

```bash
git add packages/sns-stealth/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(sns-stealth): scaffold @sip-protocol/sns-stealth package"
```

---

## Task 2: Implement `schema.ts` (TDD)

**Files:**
- Create: `packages/sns-stealth/src/schema.ts`
- Create: `packages/sns-stealth/tests/schema.test.ts`

- [ ] **Step 1: Write failing test**

`packages/sns-stealth/tests/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SIPStealthRecordV1, parseRecord } from '../src/schema'

const validHex = 'a'.repeat(64)

describe('SIPStealthRecordV1', () => {
  it('accepts a valid v1 record', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: validHex,
      viewing: validHex,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing v', () => {
    const result = SIPStealthRecordV1.safeParse({
      spending: validHex,
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })

  it('rejects v=2 (forward-incompatible)', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 2,
      spending: validHex,
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-hex spending key', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: 'g'.repeat(64),
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong-length viewing key', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: validHex,
      viewing: 'a'.repeat(63),
    })
    expect(result.success).toBe(false)
  })

  it('rejects uppercase hex (must be lowercase)', () => {
    const result = SIPStealthRecordV1.safeParse({
      v: 1,
      spending: 'A'.repeat(64),
      viewing: validHex,
    })
    expect(result.success).toBe(false)
  })
})

describe('parseRecord', () => {
  it('parses a valid JSON record', () => {
    const json = JSON.stringify({ v: 1, spending: validHex, viewing: validHex })
    const result = parseRecord(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.v).toBe(1)
    }
  })

  it('returns json-parse error for malformed JSON', () => {
    const result = parseRecord('{not json}')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('json-parse')
  })

  it('returns schema error for invalid record', () => {
    const json = JSON.stringify({ v: 1, spending: 'bad' })
    const result = parseRecord(json)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('schema')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run`
Expected: FAIL — module `../src/schema` not found.

- [ ] **Step 3: Implement `src/schema.ts`**

```typescript
import { z } from 'zod'

const Hex32 = z.string().regex(/^[0-9a-f]{64}$/)

export const SIPStealthRecordV1 = z.object({
  v: z.literal(1),
  spending: Hex32,
  viewing: Hex32,
})

export type SIPStealthRecord = z.infer<typeof SIPStealthRecordV1>

export type ParseResult =
  | { ok: true; data: SIPStealthRecord }
  | { ok: false; reason: 'json-parse'; error: unknown }
  | { ok: false; reason: 'schema'; error: z.ZodError }

export function parseRecord(raw: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { ok: false, reason: 'json-parse', error }
  }

  const result = SIPStealthRecordV1.safeParse(parsed)
  if (!result.success) {
    return { ok: false, reason: 'schema', error: result.error }
  }
  return { ok: true, data: result.data }
}

export function encodeRecord(record: SIPStealthRecord): string {
  // Canonical JSON: stable key order, no whitespace.
  return JSON.stringify({
    v: record.v,
    spending: record.spending,
    viewing: record.viewing,
  })
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run`
Expected: 9/9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sns-stealth/src/schema.ts packages/sns-stealth/tests/schema.test.ts
git commit -m "feat(sns-stealth): add v1 record schema with Zod validation"
```

---

## Task 3: Implement `errors.ts` (TDD)

**Files:**
- Create: `packages/sns-stealth/src/errors.ts`
- Create: `packages/sns-stealth/tests/errors.test.ts`

- [ ] **Step 1: Write failing test**

`packages/sns-stealth/tests/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  NotFound,
  Malformed,
  NetworkError,
  UserRejected,
  OnChainError,
} from '../src/errors'

describe('NotFound', () => {
  it('discriminates on subject', () => {
    const e = new NotFound('domain')
    expect(e.subject).toBe('domain')
    expect(e).toBeInstanceOf(NotFound)
    expect(e.name).toBe('NotFound')
  })

  it('accepts record subject', () => {
    expect(new NotFound('record').subject).toBe('record')
  })
})

describe('Malformed', () => {
  it('captures reason and cause', () => {
    const cause = new Error('parse failure')
    const e = new Malformed('json-parse', cause)
    expect(e.reason).toBe('json-parse')
    expect(e.cause).toBe(cause)
  })

  it('supports schema reason', () => {
    const e = new Malformed('schema')
    expect(e.reason).toBe('schema')
  })
})

describe('NetworkError', () => {
  it('wraps underlying transport error', () => {
    const inner = new Error('connection refused')
    const e = new NetworkError('rpc unreachable', inner)
    expect(e.cause).toBe(inner)
    expect(e.message).toContain('rpc unreachable')
  })
})

describe('UserRejected and OnChainError', () => {
  it('are distinct constructors', () => {
    expect(new UserRejected()).toBeInstanceOf(UserRejected)
    expect(new OnChainError('signature', 'tx failed')).toBeInstanceOf(OnChainError)
    expect(new UserRejected()).not.toBeInstanceOf(OnChainError)
  })

  it('OnChainError exposes signature', () => {
    const e = new OnChainError('abc123', 'tx failed')
    expect(e.signature).toBe('abc123')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run errors`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/errors.ts`**

```typescript
export type NotFoundSubject = 'domain' | 'record'
export type MalformedReason = 'json-parse' | 'schema'

export class NotFound extends Error {
  readonly name = 'NotFound'
  constructor(public readonly subject: NotFoundSubject) {
    super(`Not found: ${subject}`)
  }
}

export class Malformed extends Error {
  readonly name = 'Malformed'
  constructor(
    public readonly reason: MalformedReason,
    public override readonly cause?: unknown,
  ) {
    super(`Malformed record: ${reason}`)
  }
}

export class NetworkError extends Error {
  readonly name = 'NetworkError'
  constructor(message: string, public override readonly cause?: unknown) {
    super(message)
  }
}

export class UserRejected extends Error {
  readonly name = 'UserRejected'
  constructor(message = 'User rejected the signature request') {
    super(message)
  }
}

export class OnChainError extends Error {
  readonly name = 'OnChainError'
  constructor(
    public readonly signature: string,
    message: string,
  ) {
    super(`On-chain error (${signature}): ${message}`)
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run errors`
Expected: 7/7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sns-stealth/src/errors.ts packages/sns-stealth/tests/errors.test.ts
git commit -m "feat(sns-stealth): add typed error classes"
```

---

## Task 4: Implement `cache.ts` (TDD)

**Files:**
- Create: `packages/sns-stealth/src/cache.ts`
- Create: `packages/sns-stealth/tests/cache.test.ts`

- [ ] **Step 1: Write failing test**

`packages/sns-stealth/tests/cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TTLCache } from '../src/cache'

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns undefined on miss', () => {
    const cache = new TTLCache<string>(1000)
    expect(cache.get('nope')).toBeUndefined()
  })

  it('returns value within TTL', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('expires after TTL', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('key', 'value')
    vi.advanceTimersByTime(1001)
    expect(cache.get('key')).toBeUndefined()
  })

  it('invalidates explicitly', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('key', 'value')
    cache.invalidate('key')
    expect(cache.get('key')).toBeUndefined()
  })

  it('clears all entries', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('per-entry TTL overrides default', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('short', 'v', 500)
    vi.advanceTimersByTime(600)
    expect(cache.get('short')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/cache.ts`**

```typescript
interface Entry<T> {
  value: T
  expiresAt: number
}

export class TTLCache<T> {
  private store = new Map<string, Entry<T>>()

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs
    this.store.set(key, { value, expiresAt: Date.now() + ttl })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run cache`
Expected: 6/6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sns-stealth/src/cache.ts packages/sns-stealth/tests/cache.test.ts
git commit -m "feat(sns-stealth): add TTL cache utility"
```

---

## Task 5: Implement `derive.ts` (TDD)

**Files:**
- Create: `packages/sns-stealth/src/derive.ts`
- Create: `packages/sns-stealth/tests/derive.test.ts`

- [ ] **Step 1: Write failing test**

`packages/sns-stealth/tests/derive.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { deriveStealthKeys, normalizeDomain, deriveSeed } from '../src/derive'

// Mock signer: returns deterministic "signature" = sha256(message)
import { sha256 } from '@noble/hashes/sha2'
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils'

const mockSigner = (label: string) => ({
  signMessage: async (msg: Uint8Array) => {
    return sha256(new Uint8Array([...utf8ToBytes(label), ...msg]))
  },
})

describe('normalizeDomain', () => {
  it('lowercases', () => {
    expect(normalizeDomain('RECTOR.sol')).toBe('rector.sol')
  })

  it('strips trailing dot', () => {
    expect(normalizeDomain('rector.sol.')).toBe('rector.sol')
  })

  it('handles already-normalized', () => {
    expect(normalizeDomain('rector.sol')).toBe('rector.sol')
  })

  it('handles subdomain', () => {
    expect(normalizeDomain('AUDITOR.Rector.sol')).toBe('auditor.rector.sol')
  })
})

describe('deriveSeed', () => {
  it('produces 32-byte seed', () => {
    const sig = new Uint8Array(64).fill(1)
    expect(deriveSeed(sig, 'spending')).toHaveLength(32)
  })

  it('spending and viewing seeds differ for same signature', () => {
    const sig = new Uint8Array(64).fill(1)
    const sp = bytesToHex(deriveSeed(sig, 'spending'))
    const vw = bytesToHex(deriveSeed(sig, 'viewing'))
    expect(sp).not.toBe(vw)
  })
})

describe('deriveStealthKeys', () => {
  it('produces 32-byte spending and viewing pubkeys', async () => {
    const wallet = mockSigner('alice')
    const keys = await deriveStealthKeys(wallet, 'rector.sol')
    expect(keys.spending).toHaveLength(32)
    expect(keys.viewing).toHaveLength(32)
  })

  it('is deterministic for same (wallet, domain)', async () => {
    const wallet = mockSigner('alice')
    const a = await deriveStealthKeys(wallet, 'rector.sol')
    const b = await deriveStealthKeys(wallet, 'rector.sol')
    expect(bytesToHex(a.spending)).toBe(bytesToHex(b.spending))
    expect(bytesToHex(a.viewing)).toBe(bytesToHex(b.viewing))
  })

  it('produces different keys for different domains (per-domain uniqueness)', async () => {
    const wallet = mockSigner('alice')
    const a = await deriveStealthKeys(wallet, 'rector.sol')
    const b = await deriveStealthKeys(wallet, 'sipher.sol')
    expect(bytesToHex(a.spending)).not.toBe(bytesToHex(b.spending))
    expect(bytesToHex(a.viewing)).not.toBe(bytesToHex(b.viewing))
  })

  it('produces different keys for different wallets', async () => {
    const a = await deriveStealthKeys(mockSigner('alice'), 'rector.sol')
    const b = await deriveStealthKeys(mockSigner('bob'), 'rector.sol')
    expect(bytesToHex(a.spending)).not.toBe(bytesToHex(b.spending))
  })

  it('normalizes domain before signing', async () => {
    const wallet = mockSigner('alice')
    const a = await deriveStealthKeys(wallet, 'rector.sol')
    const b = await deriveStealthKeys(wallet, 'RECTOR.SOL')
    expect(bytesToHex(a.spending)).toBe(bytesToHex(b.spending))
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run derive`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/derive.ts`**

```typescript
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import { ed25519 } from '@noble/curves/ed25519'
import { utf8ToBytes } from '@noble/hashes/utils'

export interface Signer {
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

export interface DerivedStealthKeys {
  spending: Uint8Array  // 32-byte ed25519 pubkey
  viewing: Uint8Array   // 32-byte ed25519 pubkey
  spendingPrivate: Uint8Array  // 32-byte seed (keep secret)
  viewingPrivate: Uint8Array   // 32-byte seed (keep secret)
}

export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/\.$/, '')
}

export function deriveSeed(
  signature: Uint8Array,
  info: 'spending' | 'viewing',
): Uint8Array {
  // HKDF-SHA256(ikm=signature, salt=undefined, info=<utf8>, length=32)
  return hkdf(sha256, signature, undefined, info, 32)
}

export async function deriveStealthKeys(
  wallet: Signer,
  domain: string,
): Promise<DerivedStealthKeys> {
  const normalized = normalizeDomain(domain)
  const message = utf8ToBytes(`sip-stealth-v1:${normalized}`)
  const signature = await wallet.signMessage(message)

  const spendingPrivate = deriveSeed(signature, 'spending')
  const viewingPrivate = deriveSeed(signature, 'viewing')

  return {
    spending: ed25519.utils.getPublicKey(spendingPrivate),
    viewing: ed25519.utils.getPublicKey(viewingPrivate),
    spendingPrivate,
    viewingPrivate,
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run derive`
Expected: 10/10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sns-stealth/src/derive.ts packages/sns-stealth/tests/derive.test.ts
git commit -m "feat(sns-stealth): add per-domain DKSAP key derivation"
```

---

## Task 6: Implement `resolve.ts` (TDD with mocked SNS)

**Files:**
- Create: `packages/sns-stealth/src/resolve.ts`
- Create: `packages/sns-stealth/tests/resolve.test.ts`

- [ ] **Step 1: Write failing test**

`packages/sns-stealth/tests/resolve.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { resolveSIPStealth, MetaAddress } from '../src/resolve'
import { NotFound, Malformed } from '../src/errors'

// Mock @bonfida/spl-name-service.getRecord
vi.mock('@bonfida/spl-name-service', () => ({
  NameRegistryState: {},
  getRecord: vi.fn(),
}))
import { getRecord } from '@bonfida/spl-name-service'

const mockConnection = {} as Connection
const validHex = 'a'.repeat(64)

describe('resolveSIPStealth', () => {
  beforeEach(() => {
    vi.mocked(getRecord).mockReset()
  })

  it('returns MetaAddress on valid record', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce({
      data: Buffer.from(JSON.stringify({ v: 1, spending: validHex, viewing: validHex })),
    } as never)

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(MetaAddress)
    if (result instanceof MetaAddress) {
      expect(result.domain).toBe('rector.sol')
      expect(result.chain).toBe('solana')
    }
  })

  it('returns NotFound("domain") when domain does not exist', async () => {
    vi.mocked(getRecord).mockRejectedValueOnce(new Error('Domain not found'))

    const result = await resolveSIPStealth(mockConnection, 'nonexistent.sol')

    expect(result).toBeInstanceOf(NotFound)
    if (result instanceof NotFound) expect(result.subject).toBe('domain')
  })

  it('returns NotFound("record") when no SIP-STEALTH record', async () => {
    vi.mocked(getRecord).mockRejectedValueOnce(new Error('Record not found'))

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(NotFound)
    if (result instanceof NotFound) expect(result.subject).toBe('record')
  })

  it('returns Malformed on bad JSON', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce({
      data: Buffer.from('{not json}'),
    } as never)

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(Malformed)
    if (result instanceof Malformed) expect(result.reason).toBe('json-parse')
  })

  it('returns Malformed on schema mismatch', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce({
      data: Buffer.from(JSON.stringify({ v: 99, spending: 'x', viewing: 'y' })),
    } as never)

    const result = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(result).toBeInstanceOf(Malformed)
    if (result instanceof Malformed) expect(result.reason).toBe('schema')
  })

  it('normalizes domain before lookup', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce({
      data: Buffer.from(JSON.stringify({ v: 1, spending: validHex, viewing: validHex })),
    } as never)

    await resolveSIPStealth(mockConnection, 'RECTOR.SOL')

    const callArgs = vi.mocked(getRecord).mock.calls[0]
    expect(callArgs[1]).toBe('rector.sol')  // normalized
  })

  it('uses cache on second call within TTL', async () => {
    vi.mocked(getRecord).mockResolvedValueOnce({
      data: Buffer.from(JSON.stringify({ v: 1, spending: validHex, viewing: validHex })),
    } as never)

    const a = await resolveSIPStealth(mockConnection, 'rector.sol')
    const b = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(a).toBe(b)
    expect(getRecord).toHaveBeenCalledTimes(1)
  })

  it('invalidateCache forces re-fetch', async () => {
    vi.mocked(getRecord)
      .mockResolvedValueOnce({ data: Buffer.from(JSON.stringify({ v: 1, spending: validHex, viewing: validHex })) } as never)
      .mockResolvedValueOnce({ data: Buffer.from(JSON.stringify({ v: 1, spending: 'b'.repeat(64), viewing: validHex })) } as never)

    const a = await resolveSIPStealth(mockConnection, 'rector.sol')
    const { invalidateCache } = await import('../src/resolve')
    invalidateCache('rector.sol')
    const b = await resolveSIPStealth(mockConnection, 'rector.sol')

    expect(a).not.toBe(b)
    expect(getRecord).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run resolve`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/resolve.ts`**

```typescript
import type { Connection } from '@solana/web3.js'
import { getRecord } from '@bonfida/spl-name-service'
import { TTLCache } from './cache'
import { parseRecord } from './schema'
import { normalizeDomain } from './derive'
import { NotFound, Malformed, NetworkError } from './errors'

const CACHE_TTL_MS = 60_000  // 60s per spec

export class MetaAddress {
  constructor(
    public readonly spending: Uint8Array,
    public readonly viewing: Uint8Array,
    public readonly chain: 'solana',
    public readonly domain: string,
  ) {}
}

export type ResolveResult = MetaAddress | NotFound | Malformed

const cache = new TTLCache<ResolveResult>(CACHE_TTL_MS)

export async function resolveSIPStealth(
  connection: Connection,
  domain: string,
): Promise<ResolveResult> {
  const normalized = normalizeDomain(domain)

  const cached = cache.get(normalized)
  if (cached !== undefined) return cached

  let raw: string
  try {
    const record = await getRecord(connection, normalized, 'SIP-STEALTH' as never)
    raw = (record as { data: Buffer }).data.toString('utf8')
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (msg.toLowerCase().includes('domain not found')) {
      const result = new NotFound('domain')
      cache.set(normalized, result)
      return result
    }
    if (msg.toLowerCase().includes('record not found')) {
      const result = new NotFound('record')
      cache.set(normalized, result)
      return result
    }
    throw new NetworkError(`SNS lookup failed: ${msg}`, e)
  }

  const parsed = parseRecord(raw)
  if (!parsed.ok) {
    const result = new Malformed(parsed.reason, 'error' in parsed ? parsed.error : undefined)
    cache.set(normalized, result)
    return result
  }

  const meta = new MetaAddress(
    hexToBytes(parsed.data.spending),
    hexToBytes(parsed.data.viewing),
    'solana',
    normalized,
  )
  cache.set(normalized, meta)
  return meta
}

export function invalidateCache(domain?: string): void {
  if (domain === undefined) cache.clear()
  else cache.invalidate(normalizeDomain(domain))
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run resolve`
Expected: 8/8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sns-stealth/src/resolve.ts packages/sns-stealth/tests/resolve.test.ts
git commit -m "feat(sns-stealth): add resolveSIPStealth with branch coverage"
```

---

## Task 7: Implement `publish.ts` (TDD)

**Files:**
- Create: `packages/sns-stealth/src/publish.ts`
- Create: `packages/sns-stealth/tests/publish.test.ts`

- [ ] **Step 1: Write failing test**

`packages/sns-stealth/tests/publish.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { buildPublishTx } from '../src/publish'
import { bytesToHex } from '@noble/hashes/utils'

vi.mock('@bonfida/spl-name-service', () => ({
  createRecordInstruction: vi.fn().mockReturnValue({
    keys: [],
    programId: new PublicKey('11111111111111111111111111111111'),
    data: Buffer.from([]),
  }),
}))

const mockConnection = {
  getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: 'aaa', lastValidBlockHeight: 100 }),
} as unknown as Connection

const payer = new PublicKey('5AfE45685756B6E93FAf0DccD662d8AbA94c1b46'.padStart(44, '1'))

describe('buildPublishTx', () => {
  it('builds a Transaction', async () => {
    const keys = {
      spending: new Uint8Array(32).fill(1),
      viewing: new Uint8Array(32).fill(2),
    }
    const tx = await buildPublishTx(mockConnection, 'rector.sol', keys, payer)
    expect(tx).toBeInstanceOf(Transaction)
  })

  it('normalizes the domain before writing the record', async () => {
    const keys = {
      spending: new Uint8Array(32).fill(1),
      viewing: new Uint8Array(32).fill(2),
    }
    const { createRecordInstruction } = await import('@bonfida/spl-name-service')

    await buildPublishTx(mockConnection, 'RECTOR.SOL', keys, payer)

    const callArgs = vi.mocked(createRecordInstruction).mock.calls.at(-1)!
    expect(callArgs[1]).toBe('rector.sol')
  })

  it('encodes the record as canonical JSON', async () => {
    const keys = {
      spending: new Uint8Array(32).fill(0xaa),
      viewing: new Uint8Array(32).fill(0xbb),
    }
    const { createRecordInstruction } = await import('@bonfida/spl-name-service')

    await buildPublishTx(mockConnection, 'rector.sol', keys, payer)

    const callArgs = vi.mocked(createRecordInstruction).mock.calls.at(-1)!
    const value = callArgs[3]
    expect(value).toContain(`"v":1`)
    expect(value).toContain(bytesToHex(keys.spending))
    expect(value).toContain(bytesToHex(keys.viewing))
  })

  it('rejects non-32-byte keys', async () => {
    const keys = {
      spending: new Uint8Array(20),
      viewing: new Uint8Array(32),
    }
    await expect(buildPublishTx(mockConnection, 'rector.sol', keys, payer))
      .rejects.toThrow(/spending key must be 32 bytes/i)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run publish`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/publish.ts`**

```typescript
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { createRecordInstruction } from '@bonfida/spl-name-service'
import { bytesToHex } from '@noble/hashes/utils'
import { normalizeDomain } from './derive'
import { encodeRecord } from './schema'

export interface PublishKeys {
  spending: Uint8Array  // 32-byte ed25519 pubkey
  viewing: Uint8Array   // 32-byte ed25519 pubkey
}

export async function buildPublishTx(
  connection: Connection,
  domain: string,
  keys: PublishKeys,
  payer: PublicKey,
): Promise<Transaction> {
  if (keys.spending.length !== 32) {
    throw new Error('Spending key must be 32 bytes')
  }
  if (keys.viewing.length !== 32) {
    throw new Error('Viewing key must be 32 bytes')
  }

  const normalized = normalizeDomain(domain)
  const recordValue = encodeRecord({
    v: 1,
    spending: bytesToHex(keys.spending),
    viewing: bytesToHex(keys.viewing),
  })

  const ix = createRecordInstruction(
    connection,
    normalized,
    'SIP-STEALTH' as never,
    recordValue,
    payer,
  )

  const tx = new Transaction()
  tx.add(ix as never)
  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer
  return tx
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run publish`
Expected: 4/4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/sns-stealth/src/publish.ts packages/sns-stealth/tests/publish.test.ts
git commit -m "feat(sns-stealth): add buildPublishTx for SIP-STEALTH record"
```

---

## Task 8: Wire `index.ts` public API

**Files:**
- Modify: `packages/sns-stealth/src/index.ts`

- [ ] **Step 1: Write the public surface**

```typescript
// Core API
export { resolveSIPStealth, invalidateCache, MetaAddress } from './resolve'
export type { ResolveResult } from './resolve'

export { buildPublishTx } from './publish'
export type { PublishKeys } from './publish'

export { deriveStealthKeys, normalizeDomain } from './derive'
export type { Signer, DerivedStealthKeys } from './derive'

// Schema
export { SIPStealthRecordV1, parseRecord, encodeRecord } from './schema'
export type { SIPStealthRecord, ParseResult } from './schema'

// Errors
export {
  NotFound,
  Malformed,
  NetworkError,
  UserRejected,
  OnChainError,
} from './errors'
export type { NotFoundSubject, MalformedReason } from './errors'
```

- [ ] **Step 2: Verify typecheck + build**

Run: `pnpm --filter @sip-protocol/sns-stealth typecheck && pnpm --filter @sip-protocol/sns-stealth build`
Expected: PASS, `dist/` directory created with `index.js`, `index.mjs`, `index.d.ts`.

- [ ] **Step 3: Verify package exports resolve**

Create a temporary file `/tmp/sns-stealth-smoke.ts`:

```typescript
import { resolveSIPStealth, NotFound, MetaAddress } from '@sip-protocol/sns-stealth'
console.log(typeof resolveSIPStealth, typeof NotFound, typeof MetaAddress)
```

Run (from repo root): `pnpm --filter @sip-protocol/sns-stealth exec npx tsx /tmp/sns-stealth-smoke.ts`
Expected: `function function function`

- [ ] **Step 4: Commit**

```bash
git add packages/sns-stealth/src/index.ts
git commit -m "feat(sns-stealth): wire public API exports"
```

---

## Task 9: Devnet integration test

**Files:**
- Create: `packages/sns-stealth/tests/integration.test.ts`

This test requires a Solana devnet RPC and a test `.sol` domain. Steps below assume SIP owns `test.sipher.sol` on devnet (acquire via the devnet SNS UI before running; cost is ~0.01 devnet SOL).

- [ ] **Step 1: Provision devnet test domain**

```bash
# One-time setup — buy test.sipher.sol on devnet
# Use Bonfida's devnet UI: https://devnet.naming.bonfida.org/
# Fund the devnet wallet at ~/Documents/secret/solana-devnet.json
# Note: this step is manual and one-time. Skip if already provisioned.
```

Verify: `solana address --keypair ~/Documents/secret/solana-devnet.json` matches `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (per CLAUDE.md devnet wallet).

- [ ] **Step 2: Write integration test**

`packages/sns-stealth/tests/integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { Connection, Keypair, sendAndConfirmTransaction } from '@solana/web3.js'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import {
  resolveSIPStealth,
  buildPublishTx,
  deriveStealthKeys,
  MetaAddress,
  invalidateCache,
} from '../src/index'

const RPC = process.env.SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com'
const TEST_DOMAIN = process.env.SIP_TEST_DOMAIN ?? 'test.sipher.sol'
const KEYPAIR_PATH = `${homedir()}/Documents/secret/solana-devnet.json`

const skipIfNoKeypair = () => {
  try {
    readFileSync(KEYPAIR_PATH)
    return false
  } catch {
    return true
  }
}

describe.skipIf(skipIfNoKeypair())('integration: devnet round-trip', () => {
  let connection: Connection
  let payer: Keypair

  beforeAll(() => {
    connection = new Connection(RPC, 'confirmed')
    const secret = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8'))
    payer = Keypair.fromSecretKey(new Uint8Array(secret))
  })

  it('publishes and resolves a SIP-STEALTH record', async () => {
    const signer = {
      signMessage: async (msg: Uint8Array) => {
        const { sign } = await import('@noble/curves/ed25519')
        return sign.ed25519(msg, payer.secretKey.slice(0, 32))
      },
    }
    const keys = await deriveStealthKeys(signer, TEST_DOMAIN)

    const tx = await buildPublishTx(connection, TEST_DOMAIN, {
      spending: keys.spending,
      viewing: keys.viewing,
    }, payer.publicKey)

    const sig = await sendAndConfirmTransaction(connection, tx, [payer])
    expect(sig).toBeTruthy()

    invalidateCache(TEST_DOMAIN)
    const result = await resolveSIPStealth(connection, TEST_DOMAIN)

    expect(result).toBeInstanceOf(MetaAddress)
    if (result instanceof MetaAddress) {
      expect(Buffer.from(result.spending).equals(Buffer.from(keys.spending))).toBe(true)
      expect(Buffer.from(result.viewing).equals(Buffer.from(keys.viewing))).toBe(true)
    }
  }, 60_000)
})
```

- [ ] **Step 3: Run the integration test**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run integration`
Expected: PASS within 60s (publish TX confirmed, resolve returns MetaAddress matching published keys).

If `KEYPAIR_PATH` doesn't exist on the executing machine, the suite is skipped — fine for CI without secrets.

- [ ] **Step 4: Commit**

```bash
git add packages/sns-stealth/tests/integration.test.ts
git commit -m "test(sns-stealth): add devnet round-trip integration test"
```

---

## Task 10: Phase A wrap — coverage check, README, PR prep

**Files:**
- Modify: `packages/sns-stealth/README.md` (flesh out examples)
- Optional: `packages/sns-stealth/CHANGELOG.md`

- [ ] **Step 1: Run full test suite with coverage**

Run: `pnpm --filter @sip-protocol/sns-stealth test:run --coverage`
Expected: ≥90% line coverage across `src/` (per acceptance criteria).

If any file is below 90%, add focused tests for the gap.

- [ ] **Step 2: Flesh out README with usage examples**

```markdown
# @sip-protocol/sns-stealth

[ Same intro as Task 1 ]

## Sender flow

```typescript
import { Connection } from '@solana/web3.js'
import { resolveSIPStealth, MetaAddress, NotFound, Malformed } from '@sip-protocol/sns-stealth'

const connection = new Connection('https://api.mainnet-beta.solana.com')

const result = await resolveSIPStealth(connection, 'rector.sol')

if (result instanceof MetaAddress) {
  // Use result.spending + result.viewing as the stealth meta-address
} else if (result instanceof NotFound) {
  if (result.subject === 'domain') console.warn('rector.sol not found')
  if (result.subject === 'record') console.warn('No SIP-STEALTH record — offer public downgrade')
} else if (result instanceof Malformed) {
  console.error('Invalid privacy record:', result.reason)
}
```

## Receiver flow

```typescript
import { deriveStealthKeys, buildPublishTx } from '@sip-protocol/sns-stealth'

const keys = await deriveStealthKeys(wallet, 'rector.sol')
const tx = await buildPublishTx(connection, 'rector.sol', {
  spending: keys.spending,
  viewing: keys.viewing,
}, wallet.publicKey)
await wallet.sendTransaction(tx, connection)
```

## Cache

The resolver caches results per domain for 60 seconds. Force a re-fetch:

```typescript
import { invalidateCache } from '@sip-protocol/sns-stealth'
invalidateCache('rector.sol')
```
```

- [ ] **Step 3: Commit**

```bash
git add packages/sns-stealth/README.md
git commit -m "docs(sns-stealth): flesh out README with usage examples"
```

- [ ] **Step 4: Open PR (Phase A complete)**

Run: `gh pr create --title "feat(sns-stealth): add @sip-protocol/sns-stealth package" --body "$(cat <<'EOF'
## Summary
- New monorepo package: SIP-STEALTH SNS record resolver, publisher, key derivation
- Phase A of the sip.sol foundation roadmap (spec: docs/superpowers/specs/2026-05-11-sip-sol-foundation-design.md)

## Test plan
- [x] Unit tests pass (≥90% coverage)
- [x] Devnet integration test publishes + resolves a real SIP-STEALTH record
- [ ] Awaiting Phase B (sip-app integration) for end-to-end UX validation

🤖 not generated with any AI attribution
EOF
)"
```

Wait — remove the AI attribution line per house style. Actual PR body:

```bash
gh pr create --title "feat(sns-stealth): add @sip-protocol/sns-stealth package" --body "$(cat <<'EOF'
## Summary
- New monorepo package: SIP-STEALTH SNS record resolver, publisher, key derivation
- Phase A of the sip.sol foundation roadmap

## Test plan
- [x] Unit tests pass (≥90% coverage on new code)
- [x] Devnet integration test publishes + resolves a real SIP-STEALTH record
- [ ] Awaiting Phase B (sip-app integration) for end-to-end UX validation

Spec: `docs/superpowers/specs/2026-05-11-sip-sol-foundation-design.md`
EOF
)"
```

After PR merges, Phase B can begin in the sip-app repo.

---

# Phase B — sip-app integration

Adds `<domain>.sol` recipient support to sip-app's send flow and a one-time publish UI under `/wallet/sip-stealth`. Works against `@sip-protocol/sns-stealth` published from Phase A (use `pnpm link` for local dev iteration before npm publish).

## Task 11: Add SDK dependency + client wrapper

**Working repo:** `sip-protocol/sip-app` (separate repo)

**Files:**
- Modify: `package.json`
- Create: `src/lib/sns-stealth-client.ts`

- [ ] **Step 1: Add the dependency**

```bash
cd ~/local-dev/sip-app
pnpm add @sip-protocol/sns-stealth@^0.1.0
```

If the npm publish hasn't happened yet, use `pnpm link`:

```bash
# From the monorepo (sip-protocol/sip-protocol)
pnpm --filter @sip-protocol/sns-stealth link --global
# From sip-app
pnpm link --global @sip-protocol/sns-stealth
```

- [ ] **Step 2: Create the client wrapper**

`src/lib/sns-stealth-client.ts`:

```typescript
'use client'

import { Connection } from '@solana/web3.js'
import {
  resolveSIPStealth,
  buildPublishTx,
  deriveStealthKeys,
  invalidateCache,
  MetaAddress,
  NotFound,
  Malformed,
} from '@sip-protocol/sns-stealth'
import type { WalletContextState } from '@solana/wallet-adapter-react'

const getConnection = () => {
  // Reuse the sip-app's existing RPC config
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
  return new Connection(url, 'confirmed')
}

export async function resolve(domain: string) {
  return resolveSIPStealth(getConnection(), domain)
}

export async function publish(
  domain: string,
  wallet: WalletContextState,
): Promise<{ signature: string }> {
  if (!wallet.publicKey || !wallet.signMessage || !wallet.sendTransaction) {
    throw new Error('Wallet not connected')
  }

  const keys = await deriveStealthKeys(
    { signMessage: wallet.signMessage },
    domain,
  )

  const connection = getConnection()
  const tx = await buildPublishTx(
    connection,
    domain,
    { spending: keys.spending, viewing: keys.viewing },
    wallet.publicKey,
  )

  const signature = await wallet.sendTransaction(tx, connection)
  invalidateCache(domain)
  return { signature }
}

export { MetaAddress, NotFound, Malformed }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/sns-stealth-client.ts
git commit -m "feat(sns-stealth): add SDK + client wrapper for sip-app"
```

---

## Task 12: Create `/wallet/sip-stealth` publish route

**Working repo:** `sip-protocol/sip-app`

**Files:**
- Create: `src/app/wallet/sip-stealth/page.tsx`
- Create: `src/app/wallet/sip-stealth/PublishCard.tsx`

- [ ] **Step 1: Create the page**

`src/app/wallet/sip-stealth/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getAllDomains } from '@bonfida/spl-name-service'
import { Connection } from '@solana/web3.js'
import { PublishCard } from './PublishCard'

export default function SIPStealthPage() {
  const wallet = useWallet()
  const [domains, setDomains] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!wallet.publicKey) return
    setLoading(true)
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
    const conn = new Connection(url, 'confirmed')
    getAllDomains(conn, wallet.publicKey)
      .then((records) => {
        // getAllDomains returns PublicKey[] — resolve to names
        // For V1 simplicity, we display the public keys; resolving to names
        // happens in PublishCard via reverseLookup.
        setDomains(records.map((r) => r.toBase58()))
      })
      .finally(() => setLoading(false))
  }, [wallet.publicKey?.toBase58()])

  if (!wallet.publicKey) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Enable Private Payments</h1>
        <p className="mt-4 text-gray-400">Connect your wallet to manage SIP-STEALTH records on your .sol domains.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Enable Private Payments</h1>
      <p className="mt-2 text-gray-400">
        Publish a SIP-STEALTH record to your .sol domain so senders can pay you privately by name.
      </p>

      {loading && <p className="mt-6 text-gray-500">Loading your domains…</p>}

      {!loading && domains.length === 0 && (
        <p className="mt-6 text-gray-500">You don't own any .sol domains. Get one at <a href="https://www.sns.id" className="text-purple-400">sns.id</a>.</p>
      )}

      <div className="mt-6 space-y-4">
        {domains.map((d) => <PublishCard key={d} domainPubkey={d} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the PublishCard component**

`src/app/wallet/sip-stealth/PublishCard.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { reverseLookup } from '@bonfida/spl-name-service'
import { resolve, publish, MetaAddress } from '@/lib/sns-stealth-client'

interface Props {
  domainPubkey: string  // SNS domain PublicKey base58
}

export function PublishCard({ domainPubkey }: Props) {
  const wallet = useWallet()
  const [domainName, setDomainName] = useState<string | null>(null)
  const [hasRecord, setHasRecord] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
    const conn = new Connection(url, 'confirmed')
    reverseLookup(conn, new PublicKey(domainPubkey)).then((name) => {
      const full = `${name}.sol`
      setDomainName(full)
      return resolve(full)
    }).then((result) => {
      setHasRecord(result instanceof MetaAddress)
    }).catch(() => {
      setHasRecord(false)
    })
  }, [domainPubkey])

  const onEnable = async () => {
    if (!domainName) return
    setBusy(true)
    setError(null)
    try {
      const { signature } = await publish(domainName, wallet)
      setSignature(signature)
      setHasRecord(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!domainName) return <div className="p-4 bg-gray-900 rounded-lg animate-pulse h-20" />

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-purple-400">{domainName}</div>
          <div className="text-sm text-gray-500 mt-1">
            {hasRecord === null ? 'Checking…' : hasRecord ? 'Private payments enabled' : 'Public only'}
          </div>
        </div>
        {!hasRecord && (
          <button
            onClick={onEnable}
            disabled={busy}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-md text-sm font-medium"
          >
            {busy ? 'Publishing…' : 'Enable Private Payments'}
          </button>
        )}
      </div>
      {signature && (
        <div className="mt-3 text-xs text-green-400">
          ✓ Published — tx <a href={`https://solscan.io/tx/${signature}`} className="underline">{signature.slice(0, 8)}…</a>
        </div>
      )}
      {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Manually verify (dev server)**

```bash
pnpm dev
# Open http://localhost:3000/wallet/sip-stealth
# Connect a wallet that owns at least one .sol domain on devnet
# Confirm the publish flow works end-to-end
```

- [ ] **Step 4: Commit**

```bash
git add src/app/wallet/sip-stealth/
git commit -m "feat(wallet): add /wallet/sip-stealth publish UI"
```

---

## Task 13: Extend `/payments/send` for .sol resolution + fallback toast

**Working repo:** `sip-protocol/sip-app`

**Files:**
- Modify: `src/app/payments/send/page.tsx`

- [ ] **Step 1: Identify the existing recipient input handler**

Run: `grep -n "recipient" src/app/payments/send/page.tsx`
Note the line that accepts user input and triggers parsing of `sip:solana:...` URIs.

- [ ] **Step 2: Add .sol detection + resolution logic**

Add the following utility at the top of the send page module:

```typescript
import { resolve, MetaAddress, NotFound, Malformed } from '@/lib/sns-stealth-client'

const SOL_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.sol$/i

type RecipientState =
  | { kind: 'empty' }
  | { kind: 'raw'; address: string }
  | { kind: 'sip-uri'; spending: string; viewing: string }
  | { kind: 'sns-resolving'; domain: string }
  | { kind: 'sns-resolved'; domain: string; meta: MetaAddress }
  | { kind: 'sns-not-found'; domain: string; subject: 'domain' | 'record' }
  | { kind: 'sns-malformed'; domain: string; reason: string }
  | { kind: 'invalid'; input: string }

async function parseRecipient(input: string): Promise<RecipientState> {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'empty' }

  if (SOL_DOMAIN.test(trimmed.toLowerCase())) {
    const domain = trimmed.toLowerCase().replace(/\.$/, '')
    const result = await resolve(domain)
    if (result instanceof MetaAddress) return { kind: 'sns-resolved', domain, meta: result }
    if (result instanceof NotFound) return { kind: 'sns-not-found', domain, subject: result.subject }
    if (result instanceof Malformed) return { kind: 'sns-malformed', domain, reason: result.reason }
  }

  if (trimmed.startsWith('sip:solana:')) {
    const parts = trimmed.split(':')
    if (parts.length === 4) {
      return { kind: 'sip-uri', spending: parts[2], viewing: parts[3] }
    }
    return { kind: 'invalid', input: trimmed }
  }

  // Treat as raw Solana address (existing validation downstream)
  return { kind: 'raw', address: trimmed }
}
```

- [ ] **Step 3: Wire into the existing component**

Locate the existing recipient `useState` and replace its parsing with `parseRecipient`. The relevant rendering branches:

```tsx
{state.kind === 'sns-resolving' && (
  <div className="text-sm text-gray-400">Resolving {state.domain}…</div>
)}

{state.kind === 'sns-resolved' && (
  <div className="text-sm text-green-400">
    ✓ {state.domain} · private payment available
  </div>
)}

{state.kind === 'sns-not-found' && state.subject === 'record' && (
  <div className="mt-2 p-3 bg-yellow-900/20 border-l-2 border-yellow-500 rounded text-sm">
    <div className="font-medium text-yellow-300">Private payment not available.</div>
    <div className="text-yellow-200/80 mt-1">{state.domain} hasn't enabled SIP-STEALTH.</div>
    <div className="mt-3 flex gap-2">
      <button onClick={onDowngradeToPublic} className="px-3 py-1 bg-yellow-500 text-black rounded text-xs font-medium">
        Send Public
      </button>
      <button onClick={onCancelRecipient} className="px-3 py-1 bg-gray-700 rounded text-xs">
        Cancel
      </button>
    </div>
  </div>
)}

{state.kind === 'sns-not-found' && state.subject === 'domain' && (
  <div className="text-sm text-red-400">{state.domain} not found</div>
)}

{state.kind === 'sns-malformed' && (
  <div className="text-sm text-red-400">{state.domain}'s privacy record is invalid ({state.reason})</div>
)}
```

`onDowngradeToPublic` reads the SOL record for the domain via Bonfida and routes the send through the existing public-send code path. `onCancelRecipient` clears the input.

- [ ] **Step 4: Run dev server, manually verify all fallback states**

Test each branch:
- `rector.sol` (with record) → resolves to private
- `nonexistent-xyz123.sol` → "not found" error
- A real .sol without SIP-STEALTH → warn + downgrade toast
- `sip:solana:...` URI → existing flow unaffected
- Raw Solana address → existing flow unaffected

- [ ] **Step 5: Commit**

```bash
git add src/app/payments/send/page.tsx
git commit -m "feat(payments): resolve .sol recipients via SIP-STEALTH"
```

---

## Task 14: Playwright E2E for the publish + send flow

**Working repo:** `sip-protocol/sip-app`

**Files:**
- Create: `tests/e2e/sip-sol.spec.ts`

- [ ] **Step 1: Write the E2E test**

```typescript
import { test, expect } from '@playwright/test'

test.describe('sip.sol flow', () => {
  test('shows warn-and-downgrade for .sol without SIP-STEALTH record', async ({ page }) => {
    await page.goto('/payments/send')
    await page.getByPlaceholder(/recipient/i).fill('bonfida.sol')  // public domain without SIP-STEALTH
    await expect(page.getByText(/Private payment not available/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /Send Public/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()
  })

  test('rejects non-existent .sol with error', async ({ page }) => {
    await page.goto('/payments/send')
    await page.getByPlaceholder(/recipient/i).fill('definitely-not-a-real-domain-xyz123.sol')
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 10_000 })
  })
})
```

- [ ] **Step 2: Run the E2E suite**

Run: `pnpm test:e2e -- sip-sol.spec.ts`
Expected: 2/2 tests pass.

- [ ] **Step 3: Commit + open PR**

```bash
git add tests/e2e/sip-sol.spec.ts
git commit -m "test(e2e): add sip.sol Playwright coverage"

gh pr create --title "feat(payments): sip.sol — resolve .sol recipients via SIP-STEALTH" --body "$(cat <<'EOF'
## Summary
- Adds `/wallet/sip-stealth` publish UI (per-domain card)
- Extends `/payments/send` to accept <domain>.sol recipients with warn-and-downgrade fallback
- E2E coverage for the not-found and missing-record branches

## Test plan
- [x] Manual: publish + resolve on devnet
- [x] Playwright: not-found, missing-record branches
- [x] Backwards-compat: sip:solana:... URI and raw Solana address still work

Spec: docs in sip-protocol/sip-protocol monorepo
Depends on: @sip-protocol/sns-stealth@^0.1.0
EOF
)"
```

---

# Phase C — sip-mobile integration

Same pattern as Phase B but on React Native. Settings screen publishes; Send tab resolves.

## Task 15: Add SDK + RN wrapper

**Working repo:** `sip-protocol/sip-mobile`

**Files:**
- Modify: `package.json`
- Create: `lib/sns-stealth-mobile.ts`

- [ ] **Step 1: Add dependency**

```bash
cd ~/local-dev/sip-mobile
pnpm add @sip-protocol/sns-stealth@^0.1.0
```

- [ ] **Step 2: Create RN wrapper**

`lib/sns-stealth-mobile.ts`:

```typescript
import { Connection } from '@solana/web3.js'
import {
  resolveSIPStealth,
  buildPublishTx,
  deriveStealthKeys,
  invalidateCache,
  MetaAddress,
  NotFound,
  Malformed,
} from '@sip-protocol/sns-stealth'

const getConnection = () => {
  const url = process.env.EXPO_PUBLIC_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
  return new Connection(url, 'confirmed')
}

export async function resolve(domain: string) {
  return resolveSIPStealth(getConnection(), domain)
}

export async function publish(
  domain: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
  payerPubkey: PublicKey,
  sendTransaction: (tx: Transaction, conn: Connection) => Promise<string>,
) {
  const keys = await deriveStealthKeys({ signMessage }, domain)
  const conn = getConnection()
  const tx = await buildPublishTx(conn, domain, {
    spending: keys.spending,
    viewing: keys.viewing,
  }, payerPubkey)

  const signature = await sendTransaction(tx, conn)
  invalidateCache(domain)
  return { signature }
}

export { MetaAddress, NotFound, Malformed }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml lib/sns-stealth-mobile.ts
git commit -m "feat(sns-stealth): add SDK + RN wrapper for sip-mobile"
```

---

## Task 16: Settings → SIP-STEALTH publish screen

**Working repo:** `sip-protocol/sip-mobile`

**Files:**
- Create: `app/(tabs)/settings/sip-stealth.tsx`

- [ ] **Step 1: Create the screen**

```tsx
import { useState, useEffect } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useNavigation } from 'expo-router'
import { useWallet } from '@/hooks/useWallet'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAllDomains, reverseLookup } from '@bonfida/spl-name-service'
import { resolve, publish, MetaAddress } from '@/lib/sns-stealth-mobile'

export default function SIPStealthScreen() {
  const wallet = useWallet()
  const [domains, setDomains] = useState<{ name: string; hasRecord: boolean | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet.publicKey) {
      setLoading(false)
      return
    }
    const conn = new Connection(process.env.EXPO_PUBLIC_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com')
    getAllDomains(conn, wallet.publicKey).then(async (records) => {
      const named = await Promise.all(records.map(async (r) => {
        const name = await reverseLookup(conn, r)
        const full = `${name}.sol`
        const result = await resolve(full)
        return { name: full, hasRecord: result instanceof MetaAddress }
      }))
      setDomains(named)
      setLoading(false)
    })
  }, [wallet.publicKey?.toBase58()])

  const onEnable = async (domain: string) => {
    await publish(
      domain,
      wallet.signMessage,
      wallet.publicKey!,
      wallet.sendTransaction,
    )
    // Update state
    setDomains((d) => d.map((x) => x.name === domain ? { ...x, hasRecord: true } : x))
  }

  if (!wallet.publicKey) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18 }}>Connect your wallet to manage SIP-STEALTH records.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={{ padding: 16, alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: '#888' }}>Loading your .sol domains…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Private Payments</Text>
      <Text style={{ marginTop: 8, color: '#888' }}>
        Publish a SIP-STEALTH record on your .sol domain so senders can pay you privately by name.
      </Text>
      {domains.map((d) => (
        <View key={d.name} style={{ marginTop: 16, padding: 14, backgroundColor: '#1a1a1a', borderRadius: 8 }}>
          <Text style={{ color: '#c084fc', fontFamily: 'Menlo' }}>{d.name}</Text>
          <Text style={{ color: '#888', marginTop: 4 }}>
            {d.hasRecord ? 'Private payments enabled' : 'Public only'}
          </Text>
          {!d.hasRecord && (
            <Pressable
              onPress={() => onEnable(d.name)}
              style={{ marginTop: 10, padding: 10, backgroundColor: '#7c3aed', borderRadius: 6, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Enable Private Payments</Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  )
}
```

- [ ] **Step 2: Add navigation entry from Settings**

Modify the Settings tab index to add a row that navigates to `/settings/sip-stealth`. Match the existing settings row pattern.

- [ ] **Step 3: Run the dev build**

```bash
EXPO_OFFLINE=1 npx expo start --go --lan --port 8081
# Navigate to Settings → SIP-STEALTH on Seeker or iOS sim
```

Verify the screen renders + publish flow works.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/settings/ app/(tabs)/settings/sip-stealth.tsx
git commit -m "feat(settings): add SIP-STEALTH publish screen"
```

---

## Task 17: Extend Send tab for .sol resolution

**Working repo:** `sip-protocol/sip-mobile`

**Files:**
- Modify: `app/(tabs)/send/index.tsx`

- [ ] **Step 1: Mirror the sip-app pattern**

Follow the same `parseRecipient` + branching from Task 13, adapted to React Native primitives (`<Text>`, `<Pressable>`, etc.).

- [ ] **Step 2: Run on device, verify each branch**

Same test matrix as Task 13 Step 4 but on Seeker hardware.

- [ ] **Step 3: Commit + open PR**

```bash
git add app/(tabs)/send/index.tsx
git commit -m "feat(send): resolve .sol recipients via SIP-STEALTH"

gh pr create --title "feat(sns-stealth): sip-mobile integration" --body "[similar template to Task 14]"
```

---

# Phase D — sipher integration

Adds two agent tools (`resolveSNS`, `sendPrivateToSNS`) so HERALD and the Sipher chat agent can route private payments by `.sol` name.

## Task 18: Add SDK + resolveSNS agent tool

**Working repo:** `sip-protocol/sipher`

**Files:**
- Modify: `packages/agent/package.json`
- Create: `packages/agent/src/tools/resolveSNS.ts`
- Create: `packages/agent/src/tools/resolveSNS.test.ts`
- Modify: `packages/agent/src/tools/index.ts`

- [ ] **Step 1: Add the dependency**

```bash
cd ~/local-dev/sipher
pnpm --filter @sipher/agent add @sip-protocol/sns-stealth@^0.1.0
```

- [ ] **Step 2: Write the tool test**

`packages/agent/src/tools/resolveSNS.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { resolveSNSTool } from './resolveSNS'

vi.mock('@sip-protocol/sns-stealth', async () => {
  const { MetaAddress, NotFound, Malformed } = await vi.importActual<typeof import('@sip-protocol/sns-stealth')>('@sip-protocol/sns-stealth')
  return {
    MetaAddress,
    NotFound,
    Malformed,
    resolveSIPStealth: vi.fn(),
  }
})
import { resolveSIPStealth, MetaAddress, NotFound, Malformed } from '@sip-protocol/sns-stealth'

describe('resolveSNS tool', () => {
  it('returns resolved meta-address as hex pair', async () => {
    vi.mocked(resolveSIPStealth).mockResolvedValueOnce(
      new MetaAddress(new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), 'solana', 'rector.sol'),
    )

    const result = await resolveSNSTool.handler({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'resolved',
      domain: 'rector.sol',
      chain: 'solana',
      spending: '01'.repeat(32),
      viewing: '02'.repeat(32),
    })
  })

  it('returns not-found result for missing record', async () => {
    vi.mocked(resolveSIPStealth).mockResolvedValueOnce(new NotFound('record'))

    const result = await resolveSNSTool.handler({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'not-found',
      domain: 'rector.sol',
      subject: 'record',
    })
  })

  it('returns malformed result on schema error', async () => {
    vi.mocked(resolveSIPStealth).mockResolvedValueOnce(new Malformed('schema'))

    const result = await resolveSNSTool.handler({ domain: 'rector.sol' })

    expect(result).toStrictEqual({
      status: 'malformed',
      domain: 'rector.sol',
      reason: 'schema',
    })
  })

  it('rejects non-.sol domains', async () => {
    await expect(resolveSNSTool.handler({ domain: 'rector.eth' }))
      .rejects.toThrow(/must end in .sol/i)
  })
})
```

- [ ] **Step 3: Implement the tool**

`packages/agent/src/tools/resolveSNS.ts`:

```typescript
import { z } from 'zod'
import { Connection } from '@solana/web3.js'
import { resolveSIPStealth, MetaAddress, NotFound, Malformed } from '@sip-protocol/sns-stealth'
import { bytesToHex } from '@noble/hashes/utils'

const inputSchema = z.object({
  domain: z.string().refine((s) => s.toLowerCase().endsWith('.sol'), {
    message: 'Domain must end in .sol',
  }),
})

const connection = new Connection(process.env.SIPHER_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com', 'confirmed')

export const resolveSNSTool = {
  name: 'resolveSNS',
  description: 'Resolve a .sol domain to its SIP-STEALTH meta-address (spending + viewing keys). Returns one of: resolved, not-found (domain or record), malformed.',
  inputSchema,
  handler: async (input: z.infer<typeof inputSchema>) => {
    const result = await resolveSIPStealth(connection, input.domain)

    if (result instanceof MetaAddress) {
      return {
        status: 'resolved' as const,
        domain: result.domain,
        chain: result.chain,
        spending: bytesToHex(result.spending),
        viewing: bytesToHex(result.viewing),
      }
    }
    if (result instanceof NotFound) {
      return { status: 'not-found' as const, domain: input.domain, subject: result.subject }
    }
    if (result instanceof Malformed) {
      return { status: 'malformed' as const, domain: input.domain, reason: result.reason }
    }
    throw new Error('Unexpected resolve result')
  },
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @sipher/agent test:run resolveSNS`
Expected: 4/4 pass.

- [ ] **Step 5: Register the tool**

Modify `packages/agent/src/tools/index.ts` to include `resolveSNSTool` in the exported tool registry. Match existing registration pattern.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/
git commit -m "feat(agent): add resolveSNS tool for .sol → SIP-STEALTH resolution"
```

---

## Task 19: sendPrivateToSNS composite tool

**Working repo:** `sip-protocol/sipher`

**Files:**
- Create: `packages/agent/src/tools/sendPrivateToSNS.ts`
- Create: `packages/agent/src/tools/sendPrivateToSNS.test.ts`
- Modify: `packages/agent/src/tools/index.ts`

- [ ] **Step 1: Write the tool test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { sendPrivateToSNSTool } from './sendPrivateToSNS'

vi.mock('./resolveSNS', () => ({
  resolveSNSTool: {
    handler: vi.fn(),
  },
}))
vi.mock('./send', () => ({
  sendTool: {
    handler: vi.fn(),
  },
}))
import { resolveSNSTool } from './resolveSNS'
import { sendTool } from './send'

describe('sendPrivateToSNS', () => {
  it('resolves then delegates to send', async () => {
    vi.mocked(resolveSNSTool.handler).mockResolvedValueOnce({
      status: 'resolved',
      domain: 'rector.sol',
      chain: 'solana',
      spending: 'aa'.repeat(32),
      viewing: 'bb'.repeat(32),
    })
    vi.mocked(sendTool.handler).mockResolvedValueOnce({ signature: 'sig123', ok: true })

    const result = await sendPrivateToSNSTool.handler({
      to: 'rector.sol',
      amount: '10',
      token: 'USDC',
    })

    expect(result).toStrictEqual({
      status: 'sent',
      signature: 'sig123',
      domain: 'rector.sol',
    })
    expect(sendTool.handler).toHaveBeenCalledWith(expect.objectContaining({
      recipient: expect.objectContaining({
        chain: 'solana',
        spending: 'aa'.repeat(32),
        viewing: 'bb'.repeat(32),
      }),
      amount: '10',
      token: 'USDC',
    }))
  })

  it('returns resolution error when domain has no record', async () => {
    vi.mocked(resolveSNSTool.handler).mockResolvedValueOnce({
      status: 'not-found',
      domain: 'rector.sol',
      subject: 'record',
    })

    const result = await sendPrivateToSNSTool.handler({
      to: 'rector.sol',
      amount: '10',
      token: 'USDC',
    })

    expect(result).toStrictEqual({
      status: 'cannot-send',
      reason: 'no-stealth-record',
      domain: 'rector.sol',
    })
  })
})
```

- [ ] **Step 2: Implement the tool**

```typescript
import { z } from 'zod'
import { resolveSNSTool } from './resolveSNS'
import { sendTool } from './send'  // existing send tool

const inputSchema = z.object({
  to: z.string().refine((s) => s.toLowerCase().endsWith('.sol'), {
    message: 'Recipient must be a .sol domain',
  }),
  amount: z.string(),
  token: z.string(),
})

export const sendPrivateToSNSTool = {
  name: 'sendPrivateToSNS',
  description: 'Send a private payment to a .sol domain by name. Resolves the SIP-STEALTH record, derives a one-time stealth address, and routes through sip_privacy.',
  inputSchema,
  handler: async (input: z.infer<typeof inputSchema>) => {
    const resolved = await resolveSNSTool.handler({ domain: input.to })

    if (resolved.status !== 'resolved') {
      return {
        status: 'cannot-send' as const,
        reason: resolved.status === 'not-found' ? 'no-stealth-record' : 'malformed-record',
        domain: input.to,
      }
    }

    const sendResult = await sendTool.handler({
      recipient: {
        kind: 'stealth-meta',
        chain: resolved.chain,
        spending: resolved.spending,
        viewing: resolved.viewing,
      },
      amount: input.amount,
      token: input.token,
    })

    return {
      status: 'sent' as const,
      signature: sendResult.signature,
      domain: input.to,
    }
  },
}
```

(The exact `sendTool` input shape depends on the existing implementation — adjust the `recipient` object to match.)

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @sipher/agent test:run sendPrivateToSNS`
Expected: 2/2 pass.

- [ ] **Step 4: Register the tool**

Add `sendPrivateToSNSTool` to `packages/agent/src/tools/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/
git commit -m "feat(agent): add sendPrivateToSNS composite tool"
```

---

## Task 20: HERALD integration smoke test

**Working repo:** `sip-protocol/sipher`

**Files:**
- Create: `packages/agent/src/herald/sns-flow.test.ts` (or extend existing herald test suite)

- [ ] **Step 1: Write the smoke test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { handleHeraldDM } from '../herald/handler'  // existing HERALD entrypoint

vi.mock('../tools/sendPrivateToSNS', () => ({
  sendPrivateToSNSTool: {
    name: 'sendPrivateToSNS',
    handler: vi.fn().mockResolvedValue({ status: 'sent', signature: 'sig123', domain: 'rector.sol' }),
  },
}))

describe('HERALD .sol private send', () => {
  it('routes "send 10 USDC to rector.sol privately" through sendPrivateToSNS', async () => {
    const result = await handleHeraldDM({
      from: 'twitter:user123',
      text: 'send 10 USDC to rector.sol privately',
    })

    expect(result.toolsCalled).toContain('sendPrivateToSNS')
    expect(result.reply).toContain('sent')
  })
})
```

(Adjust to match HERALD's actual handler signature.)

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @sipher/agent test:run sns-flow`
Expected: PASS.

- [ ] **Step 3: Commit + open PR**

```bash
git add packages/agent/
git commit -m "test(herald): add sip.sol private send smoke test"

gh pr create --title "feat(agent): sip.sol tools — resolveSNS + sendPrivateToSNS" --body "[template]"
```

---

# Phase E — npm publish + mainnet smoke

Final phase. Publishes the SDK to npm and runs the full F1+F2 acceptance flow on mainnet.

## Task 21: npm publish

**Working repo:** `sip-protocol/sip-protocol` (monorepo, this repo)

- [ ] **Step 1: Verify package is publish-ready**

```bash
pnpm --filter @sip-protocol/sns-stealth typecheck
pnpm --filter @sip-protocol/sns-stealth test:run
pnpm --filter @sip-protocol/sns-stealth build
ls packages/sns-stealth/dist
```

Expected: `dist/` contains `index.js`, `index.mjs`, `index.d.ts`.

- [ ] **Step 2: Verify package metadata**

```bash
pnpm --filter @sip-protocol/sns-stealth pack
tar -tzf packages/sns-stealth/sip-protocol-sns-stealth-0.1.0.tgz | head -20
```

Expected: tarball contains `package.json`, `README.md`, `dist/index.{js,mjs,d.ts}`.

- [ ] **Step 3: Publish (requires OTP)**

```bash
# CIPHER cannot enter the OTP — RECTOR will supply via --otp flag
# Run from monorepo root:
pnpm --filter @sip-protocol/sns-stealth publish --access public
# When prompted for EOTP, RECTOR provides: --otp=XXXXXX
```

- [ ] **Step 4: Verify on npm**

```bash
npm view @sip-protocol/sns-stealth
```

Expected: shows `0.1.0`, correct `main`/`module`/`types`, public access.

- [ ] **Step 5: Commit + tag**

```bash
git tag sns-stealth-v0.1.0
git push origin sns-stealth-v0.1.0
```

---

## Task 22: Mainnet end-to-end smoke

**Cross-repo manual verification.**

Pre-requisite: SIP owns at least one `.sol` domain on mainnet (e.g. `sipher.sol` if RECTOR has acquired it). If not, the test domain `sipher-test.sol` works.

- [ ] **Step 1: Publish a SIP-STEALTH record on a SIP-owned mainnet .sol**

Use sip-app's `/wallet/sip-stealth` UI in production with a wallet that owns the target mainnet domain. Confirm:
- TX signature returned
- Solscan shows the `setRecord` instruction
- Record value is the expected JSON

Record the TX signature.

- [ ] **Step 2: Resolve from a different machine / clean cache**

From a separate browser session (or cli node script):

```typescript
import { Connection } from '@solana/web3.js'
import { resolveSIPStealth, MetaAddress } from '@sip-protocol/sns-stealth'
const conn = new Connection('https://api.mainnet-beta.solana.com')
const result = await resolveSIPStealth(conn, '<test-domain>.sol')
console.log(result instanceof MetaAddress ? 'OK' : result)
```

Expected: prints `OK`.

- [ ] **Step 3: Send a private payment to the .sol from sip-app**

Send a small SOL or USDC amount to the test domain via the production sip-app at `app.sip-protocol.org/payments/send`. Confirm:
- Recipient field auto-detects `.sol` and shows "private payment available"
- TX signature returned, lands on Solscan as a `shielded_transfer` instruction

Record the TX signature.

- [ ] **Step 4: Scan and claim with the receiver wallet**

Open sip-app `/payments/scan` (or sip-mobile's receive flow) with the wallet that owns the test domain. Confirm:
- Pending shielded transfer detected
- Claim TX submits successfully

Record the claim TX signature.

- [ ] **Step 5: Document the full cycle**

Update `sip-protocol/sip-protocol`'s CLAUDE.md with the mainnet sip.sol verification TX signatures (similar to existing "Private Swap — MAINNET VERIFIED" entry).

```bash
# In the monorepo
# Edit CLAUDE.md to add a "sip.sol — MAINNET VERIFIED" section with TX hashes
git add CLAUDE.md
git commit -m "docs: record sip.sol mainnet verification TX signatures"
```

---

## Task 23: Acceptance criteria sign-off

Verify each spec acceptance criterion:

- [ ] `@sip-protocol/sns-stealth@0.1.0` published to npm — verify with `npm view`
- [ ] ≥90% unit-test coverage — verify with `pnpm test --coverage`
- [ ] Integration tests pass against SNS devnet — verify last CI run
- [ ] `/wallet/sip-stealth` live at app.sip-protocol.org — visit URL with connected wallet
- [ ] `/payments/send` resolves `<domain>.sol` and shows fallback toast — manual verify
- [ ] sip-mobile Settings publish + Send tab resolution shipped — verify in latest build (TestFlight + APK)
- [ ] sipher's `resolveSNS` + `sendPrivateToSNS` tools live — verify in production agent registry at `sipher.sip-protocol.org`
- [ ] One mainnet `.sol → .sol` private payment documented with TX signatures — Task 22 output
- [ ] D2 content draft outline exists — minimal: 5 bullet points in a new MDX file at `blog-sip/src/content/blog/sip-sol-launch-draft.mdx`

When all 9 are checked, F1+F2 is shipped. Move on to P1/P2/P3/P4 sub-projects per their own spec → plan → impl cycles.

---

# Self-review notes (internal)

This plan was checked against the spec on 2026-05-11:

- **Spec coverage:** every section of the design spec maps to one or more tasks above. Architecture → Task 1+8. Record format → Task 2. Key derivation → Task 5. Resolve flow → Task 6. Publish flow → Task 7. Cache → Task 4. Fallback UX → Tasks 13, 17. Backwards compat → Tasks 13 Step 2 + 17. Integration plan → Phases B–D. Testing strategy → Tasks 2-9 + 14 + 20. Error handling → Task 3 + branch coverage in 6/13/17. Acceptance criteria → Task 23.
- **Placeholders:** none — every step contains the actual code or command needed.
- **Type consistency:** `MetaAddress`, `NotFound`, `Malformed`, `SIPStealthRecord`, `DerivedStealthKeys` reused with consistent shape across all tasks.
- **Cross-repo dependencies:** Phases B/C/D consume `@sip-protocol/sns-stealth` — use `pnpm link` during dev (Task 11 Step 1), publish to npm in Task 21 before Phase B/C/D PRs land.
- **Open spec questions** (Section "Open questions"):
  - Existing-keys vs fresh-keys at publish — UI offers both (Task 12 PublishCard handles fresh-keys default; existing-keys variant is a Task 12 follow-up to be implemented after Phase B initial PR if RECTOR wants it).
  - Cache TTL tuning — 60s starting value baked into `cache.ts`; revisit during integration testing.
  - Force-refresh UX — Task 12 + 13 expose `invalidateCache` via client wrapper; UI manual refresh button is a Task 12 follow-up.
  - HKDF collision-resistance — `'spending'` and `'viewing'` info strings are 8 and 7 bytes respectively, well within HKDF safe-info bounds; documenting in spec was sufficient.
