# Sipher Phase 2 — Plan C: SENTINEL (Blockchain Monitor)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SENTINEL — a non-LLM blockchain monitor that scans for unclaimed stealth payments, expired vault deposits, threats, and balance changes, then emits typed events for SIPHER/COURIER/HERALD to act on.

**Architecture:** SENTINEL is a plain TypeScript worker class (no Pi SDK, no LLM). It runs an adaptive scan loop — 60s idle, 15s when active, exponential backoff on RPC errors. Each scan cycle checks vault state, stealth announcements, and scheduled ops per connected wallet. Detections emit `GuardianEvent` via EventBus. Auto-refund for small expired deposits delegates to COURIER. COURIER is already built (crank.ts from Phase 1 + identity/events from Plan A) — this plan only adds the SENTINEL-triggered refund pathway.

**Tech Stack:** `@sipher/sdk` (vault, privacy, events), `@solana/web3.js` (Connection), EventBus, SQLite, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-sipher-phase2-guardian-command-design.md` (Section 3.3 + 3.4)

**Working directory:** `~/local-dev/sipher/`

**Branch:** `feat/phase2-guardian-command` (continues from Plans A + B)

**Depends on:** Plan A (EventBus, ActivityLogger, DB schema, COURIER identity)

---

## File Map

### New Files

```
packages/agent/src/sentinel/
├── scanner.ts            # Core scan cycle — vault state, stealth payments, expired deposits
├── detector.ts           # Detection → Event mapping (the decision matrix)
├── refund-guard.ts       # Auto-refund guardrails (threshold, double-processing, in-flight check)
├── sentinel.ts           # SENTINEL worker class — adaptive loop, start/stop lifecycle
└── config.ts             # SENTINEL configuration from env vars
```

### Modified Files

```
packages/agent/src/index.ts   # Start SENTINEL worker
```

### Test Files

```
packages/agent/tests/sentinel/
├── config.test.ts
├── detector.test.ts
├── refund-guard.test.ts
├── scanner.test.ts
├── sentinel.test.ts
└── integration.test.ts
```

---

## Task 1: SENTINEL Configuration

**Files:**
- Create: `packages/agent/src/sentinel/config.ts`
- Test: `packages/agent/tests/sentinel/config.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/sentinel/config.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { getSentinelConfig } from '../../src/sentinel/config.js'

describe('SENTINEL config', () => {
  afterEach(() => {
    delete process.env.SENTINEL_SCAN_INTERVAL
    delete process.env.SENTINEL_ACTIVE_SCAN_INTERVAL
    delete process.env.SENTINEL_AUTO_REFUND_THRESHOLD
    delete process.env.SENTINEL_THREAT_CHECK
    delete process.env.SENTINEL_LARGE_TRANSFER_THRESHOLD
  })

  it('returns defaults when no env vars set', () => {
    const config = getSentinelConfig()
    expect(config.scanInterval).toBe(60_000)
    expect(config.activeScanInterval).toBe(15_000)
    expect(config.autoRefundThreshold).toBe(1)
    expect(config.threatCheckEnabled).toBe(true)
    expect(config.largeTransferThreshold).toBe(10)
    expect(config.maxRpcPerWallet).toBe(5)
    expect(config.maxWalletsPerCycle).toBe(20)
  })

  it('respects env var overrides', () => {
    process.env.SENTINEL_SCAN_INTERVAL = '30000'
    process.env.SENTINEL_AUTO_REFUND_THRESHOLD = '0.5'
    process.env.SENTINEL_THREAT_CHECK = 'false'
    const config = getSentinelConfig()
    expect(config.scanInterval).toBe(30_000)
    expect(config.autoRefundThreshold).toBe(0.5)
    expect(config.threatCheckEnabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run test → verify failure**

```bash
cd ~/local-dev/sipher && pnpm test -- packages/agent/tests/sentinel/config.test.ts --run
```

- [ ] **Step 3: Implement config.ts**

Create `packages/agent/src/sentinel/config.ts`:

```typescript
export interface SentinelConfig {
  scanInterval: number
  activeScanInterval: number
  autoRefundThreshold: number
  threatCheckEnabled: boolean
  largeTransferThreshold: number
  maxRpcPerWallet: number
  maxWalletsPerCycle: number
  backoffMax: number
}

export function getSentinelConfig(): SentinelConfig {
  return {
    scanInterval: Number(process.env.SENTINEL_SCAN_INTERVAL ?? '60000'),
    activeScanInterval: Number(process.env.SENTINEL_ACTIVE_SCAN_INTERVAL ?? '15000'),
    autoRefundThreshold: Number(process.env.SENTINEL_AUTO_REFUND_THRESHOLD ?? '1'),
    threatCheckEnabled: process.env.SENTINEL_THREAT_CHECK !== 'false',
    largeTransferThreshold: Number(process.env.SENTINEL_LARGE_TRANSFER_THRESHOLD ?? '10'),
    maxRpcPerWallet: 5,
    maxWalletsPerCycle: 20,
    backoffMax: 600_000,
  }
}
```

- [ ] **Step 4: Run test → verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/sentinel/ packages/agent/tests/sentinel/
git commit -m "feat: add SENTINEL configuration — env-driven scan intervals, thresholds"
```

---

## Task 2: Detector — Detection → Event Mapping

**Files:**
- Create: `packages/agent/src/sentinel/detector.ts`
- Test: `packages/agent/tests/sentinel/detector.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/sentinel/detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  detectUnclaimedPayment,
  detectExpiredDeposit,
  detectThreat,
  detectLargeTransfer,
  detectBalanceChange,
  type Detection,
} from '../../src/sentinel/detector.js'

describe('Detector', () => {
  it('detects unclaimed stealth payment', () => {
    const detection = detectUnclaimedPayment({
      ephemeralPubkey: '0x04abc',
      amount: 1.5,
      wallet: 'wallet-1',
    })
    expect(detection.event).toBe('sentinel:unclaimed')
    expect(detection.level).toBe('important')
    expect(detection.data.amount).toBe(1.5)
  })

  it('detects expired deposit below threshold → auto-refund', () => {
    const detection = detectExpiredDeposit({
      depositPda: 'pda-1',
      amount: 0.5,
      wallet: 'wallet-1',
      threshold: 1,
    })
    expect(detection.event).toBe('sentinel:expired')
    expect(detection.level).toBe('important')
    expect(detection.data.autoRefund).toBe(true)
  })

  it('detects expired deposit above threshold → needs confirmation', () => {
    const detection = detectExpiredDeposit({
      depositPda: 'pda-2',
      amount: 5,
      wallet: 'wallet-1',
      threshold: 1,
    })
    expect(detection.event).toBe('sentinel:refund-pending')
    expect(detection.level).toBe('critical')
    expect(detection.data.autoRefund).toBe(false)
  })

  it('detects flagged address threat', () => {
    const detection = detectThreat({
      address: '8xAb...def',
      reason: 'OFAC sanctioned',
      wallet: 'wallet-1',
    })
    expect(detection.event).toBe('sentinel:threat')
    expect(detection.level).toBe('critical')
  })

  it('detects large inbound transfer', () => {
    const detection = detectLargeTransfer({
      amount: 15,
      from: 'sender-1',
      wallet: 'wallet-1',
      threshold: 10,
    })
    expect(detection.event).toBe('sentinel:large-transfer')
    expect(detection.level).toBe('important')
  })

  it('detects vault balance change', () => {
    const detection = detectBalanceChange({
      previousBalance: 5,
      currentBalance: 7,
      wallet: 'wallet-1',
    })
    expect(detection.event).toBe('sentinel:balance')
    expect(detection.level).toBe('important')
    expect(detection.data.delta).toBe(2)
  })
})
```

- [ ] **Step 2: Run test → verify failure**

```bash
cd ~/local-dev/sipher && pnpm test -- packages/agent/tests/sentinel/detector.test.ts --run
```

- [ ] **Step 3: Implement detector.ts**

Create `packages/agent/src/sentinel/detector.ts`:

```typescript
import { type GuardianEvent } from '../coordination/event-bus.js'

export interface Detection {
  event: string
  level: 'critical' | 'important' | 'routine'
  data: Record<string, unknown>
  wallet?: string
}

export function detectUnclaimedPayment(params: {
  ephemeralPubkey: string
  amount: number
  wallet: string
}): Detection {
  return {
    event: 'sentinel:unclaimed',
    level: 'important',
    data: {
      amount: params.amount,
      ephemeralPubkey: params.ephemeralPubkey,
      message: `Unclaimed stealth payment: ${params.amount} SOL`,
    },
    wallet: params.wallet,
  }
}

export function detectExpiredDeposit(params: {
  depositPda: string
  amount: number
  wallet: string
  threshold: number
}): Detection {
  const autoRefund = params.amount < params.threshold
  return {
    event: autoRefund ? 'sentinel:expired' : 'sentinel:refund-pending',
    level: autoRefund ? 'important' : 'critical',
    data: {
      depositPda: params.depositPda,
      amount: params.amount,
      autoRefund,
      message: autoRefund
        ? `Vault deposit expired: ${params.amount} SOL — auto-refunding`
        : `Vault deposit expired: ${params.amount} SOL — awaiting confirmation`,
    },
    wallet: params.wallet,
  }
}

export function detectThreat(params: {
  address: string
  reason: string
  wallet: string
}): Detection {
  return {
    event: 'sentinel:threat',
    level: 'critical',
    data: {
      address: params.address,
      reason: params.reason,
      message: `Threat detected: ${params.address} — ${params.reason}`,
    },
    wallet: params.wallet,
  }
}

export function detectLargeTransfer(params: {
  amount: number
  from: string
  wallet: string
  threshold: number
}): Detection {
  return {
    event: 'sentinel:large-transfer',
    level: 'important',
    data: {
      amount: params.amount,
      from: params.from,
      threshold: params.threshold,
      message: `Large inbound transfer: ${params.amount} SOL from ${params.from}`,
    },
    wallet: params.wallet,
  }
}

export function detectBalanceChange(params: {
  previousBalance: number
  currentBalance: number
  wallet: string
}): Detection {
  const delta = params.currentBalance - params.previousBalance
  return {
    event: 'sentinel:balance',
    level: 'important',
    data: {
      previousBalance: params.previousBalance,
      currentBalance: params.currentBalance,
      delta,
      message: `Vault balance: ${params.currentBalance} SOL (${delta >= 0 ? '+' : ''}${delta})`,
    },
    wallet: params.wallet,
  }
}

export function toGuardianEvent(detection: Detection): Omit<GuardianEvent, 'timestamp'> {
  return {
    source: 'sentinel',
    type: detection.event,
    level: detection.level,
    data: detection.data,
    wallet: detection.wallet,
  }
}
```

- [ ] **Step 4: Run test → verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/sentinel/detector.ts packages/agent/tests/sentinel/detector.test.ts
git commit -m "feat: add SENTINEL detector — detection-to-event mapping for 6 event types"
```

---

## Task 3: Refund Guard

**Files:**
- Create: `packages/agent/src/sentinel/refund-guard.ts`
- Test: `packages/agent/tests/sentinel/refund-guard.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/sentinel/refund-guard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  shouldAutoRefund,
  isRefundSafe,
  generateIdempotencyKey,
} from '../../src/sentinel/refund-guard.js'

describe('Refund Guard', () => {
  it('shouldAutoRefund returns true below threshold', () => {
    expect(shouldAutoRefund(0.5, 1)).toBe(true)
  })

  it('shouldAutoRefund returns false at threshold', () => {
    expect(shouldAutoRefund(1, 1)).toBe(false)
  })

  it('shouldAutoRefund returns false above threshold', () => {
    expect(shouldAutoRefund(5, 1)).toBe(false)
  })

  it('isRefundSafe returns true when no recent TX for PDA', () => {
    const recentSignatures: string[] = []
    expect(isRefundSafe('pda-1', recentSignatures)).toBe(true)
  })

  it('isRefundSafe returns false when PDA appears in recent signatures', () => {
    const recentSignatures = ['sig-abc-pda-1', 'sig-def']
    expect(isRefundSafe('pda-1', recentSignatures)).toBe(false)
  })

  it('generateIdempotencyKey is deterministic', () => {
    const key1 = generateIdempotencyKey('pda-1', 1700000000)
    const key2 = generateIdempotencyKey('pda-1', 1700000000)
    expect(key1).toBe(key2)
  })

  it('generateIdempotencyKey differs for different inputs', () => {
    const key1 = generateIdempotencyKey('pda-1', 1700000000)
    const key2 = generateIdempotencyKey('pda-2', 1700000000)
    expect(key1).not.toBe(key2)
  })
})
```

- [ ] **Step 2: Run test → verify failure**
- [ ] **Step 3: Implement refund-guard.ts**

Create `packages/agent/src/sentinel/refund-guard.ts`:

```typescript
import { createHash } from 'node:crypto'

/**
 * Check if a deposit should be auto-refunded based on amount vs threshold.
 * Below threshold → auto-refund. At or above → require user confirmation.
 */
export function shouldAutoRefund(amount: number, threshold: number): boolean {
  return amount < threshold
}

/**
 * Check if a refund is safe to execute.
 * Looks for the deposit PDA in recent transaction signatures to prevent double-processing.
 * If found → in-flight TX, skip refund.
 */
export function isRefundSafe(depositPda: string, recentSignatures: string[]): boolean {
  return !recentSignatures.some(sig => sig.includes(depositPda))
}

/**
 * Generate a deterministic idempotency key for a refund operation.
 * Hash of deposit PDA + timestamp → used as memo/reference to prevent duplicates.
 */
export function generateIdempotencyKey(depositPda: string, timestamp: number): string {
  return createHash('sha256')
    .update(`refund:${depositPda}:${timestamp}`)
    .digest('hex')
    .slice(0, 16)
}
```

- [ ] **Step 4: Run test → verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/sentinel/refund-guard.ts packages/agent/tests/sentinel/refund-guard.test.ts
git commit -m "feat: add refund guard — threshold check, double-processing prevention, idempotency"
```

---

## Task 4: Scanner — Core Scan Cycle

**Files:**
- Create: `packages/agent/src/sentinel/scanner.ts`
- Test: `packages/agent/tests/sentinel/scanner.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/sentinel/scanner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the SDK to avoid real RPC calls
vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn(() => ({
    getAccountInfo: vi.fn().mockResolvedValue(null),
    getSignaturesForAddress: vi.fn().mockResolvedValue([]),
  })),
  getVaultBalance: vi.fn().mockResolvedValue({ total: '5000000000', available: '5000000000', locked: '0', exists: true }),
  getVaultConfig: vi.fn().mockResolvedValue({ fee_bps: 10, authority: 'auth', paused: false }),
  scanForPayments: vi.fn().mockResolvedValue([]),
  getVaultHistory: vi.fn().mockResolvedValue([]),
  deriveDepositRecordPDA: vi.fn().mockReturnValue(['pda', 255]),
}))

import { scanWallet, type ScanResult } from '../../src/sentinel/scanner.js'

describe('Scanner', () => {
  beforeEach(() => {
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com'
  })

  afterEach(() => {
    delete process.env.SOLANA_RPC_URL
  })

  it('returns scan result with vault state', async () => {
    const result = await scanWallet('wallet-1')
    expect(result).toBeDefined()
    expect(result.vaultBalance).toBeDefined()
    expect(result.detections).toBeInstanceOf(Array)
    expect(result.rpcCalls).toBeGreaterThan(0)
  })

  it('detects balance change when previous differs', async () => {
    const result = await scanWallet('wallet-1', { previousBalance: 3 })
    const balanceDetection = result.detections.find(d => d.event === 'sentinel:balance')
    expect(balanceDetection).toBeDefined()
  })

  it('returns empty detections on clean scan', async () => {
    const result = await scanWallet('wallet-1')
    // No unclaimed payments, no expired deposits, no threats
    expect(result.detections.filter(d => d.event !== 'sentinel:balance')).toHaveLength(0)
  })

  it('respects maxRpcCalls limit', async () => {
    const result = await scanWallet('wallet-1', { maxRpcCalls: 2 })
    expect(result.rpcCalls).toBeLessThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run test → verify failure**
- [ ] **Step 3: Implement scanner.ts**

Create `packages/agent/src/sentinel/scanner.ts`:

```typescript
import { createConnection, getVaultBalance, scanForPayments } from '@sipher/sdk'
import { type Detection, detectUnclaimedPayment, detectBalanceChange } from './detector.js'
import { getSentinelConfig } from './config.js'

export interface ScanOptions {
  previousBalance?: number
  maxRpcCalls?: number
}

export interface ScanResult {
  wallet: string
  vaultBalance: number
  detections: Detection[]
  rpcCalls: number
  timestamp: string
}

export async function scanWallet(wallet: string, options: ScanOptions = {}): Promise<ScanResult> {
  const config = getSentinelConfig()
  const maxRpc = options.maxRpcCalls ?? config.maxRpcPerWallet
  let rpcCalls = 0
  const detections: Detection[] = []

  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
  const connection = createConnection(rpcUrl)

  // 1. Check vault balance
  let vaultBalance = 0
  if (rpcCalls < maxRpc) {
    try {
      const balance = await getVaultBalance(connection, wallet, 'SOL')
      vaultBalance = Number(balance.total) / 1e9
      rpcCalls++
    } catch {
      vaultBalance = 0
      rpcCalls++
    }
  }

  // 2. Detect balance change
  if (options.previousBalance !== undefined && options.previousBalance !== vaultBalance) {
    detections.push(detectBalanceChange({
      previousBalance: options.previousBalance,
      currentBalance: vaultBalance,
      wallet,
    }))
  }

  // 3. Scan for unclaimed stealth payments
  if (rpcCalls < maxRpc) {
    try {
      const payments = await scanForPayments({ connection, wallet } as any)
      rpcCalls++
      for (const payment of payments) {
        detections.push(detectUnclaimedPayment({
          ephemeralPubkey: (payment as any).ephemeralPubkey ?? 'unknown',
          amount: Number((payment as any).amount ?? 0) / 1e9,
          wallet,
        }))
      }
    } catch {
      rpcCalls++
    }
  }

  return {
    wallet,
    vaultBalance,
    detections,
    rpcCalls,
    timestamp: new Date().toISOString(),
  }
}
```

Note: The SDK function signatures (`scanForPayments`, `getVaultBalance`) vary. The implementer MUST read the actual SDK exports at `packages/sdk/src/privacy.ts` and `packages/sdk/src/vault.ts` to get correct parameter shapes. The code above is a guide — adapt to real signatures.

- [ ] **Step 4: Run test → verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/sentinel/scanner.ts packages/agent/tests/sentinel/scanner.test.ts
git commit -m "feat: add SENTINEL scanner — vault state, stealth payments, balance change detection"
```

---

## Task 5: SENTINEL Worker Class — Adaptive Loop

**Files:**
- Create: `packages/agent/src/sentinel/sentinel.ts`
- Test: `packages/agent/tests/sentinel/sentinel.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/tests/sentinel/sentinel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock scanner to avoid real RPC
vi.mock('../../src/sentinel/scanner.js', () => ({
  scanWallet: vi.fn().mockResolvedValue({
    wallet: 'wallet-1',
    vaultBalance: 5,
    detections: [],
    rpcCalls: 2,
    timestamp: new Date().toISOString(),
  }),
}))

import { SentinelWorker } from '../../src/sentinel/sentinel.js'

describe('SENTINEL Worker', () => {
  let worker: SentinelWorker

  beforeEach(() => {
    worker = new SentinelWorker()
  })

  afterEach(() => {
    worker.stop()
  })

  it('exports SENTINEL_IDENTITY', async () => {
    const { SENTINEL_IDENTITY } = await import('../../src/sentinel/sentinel.js')
    expect(SENTINEL_IDENTITY.name).toBe('SENTINEL')
    expect(SENTINEL_IDENTITY.llm).toBe(false)
  })

  it('starts in stopped state', () => {
    expect(worker.isRunning()).toBe(false)
  })

  it('tracks connected wallets', () => {
    worker.addWallet('wallet-1')
    expect(worker.getWallets()).toContain('wallet-1')
    worker.removeWallet('wallet-1')
    expect(worker.getWallets()).not.toContain('wallet-1')
  })

  it('getStatus returns idle when no wallets', () => {
    const status = worker.getStatus()
    expect(status.state).toBe('idle')
    expect(status.walletsMonitored).toBe(0)
  })

  it('getStatus returns scanning when wallets connected', () => {
    worker.addWallet('wallet-1')
    const status = worker.getStatus()
    expect(status.state).toBe('idle') // not running yet
    expect(status.walletsMonitored).toBe(1)
  })

  it('start/stop lifecycle', () => {
    worker.start()
    expect(worker.isRunning()).toBe(true)
    worker.stop()
    expect(worker.isRunning()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test → verify failure**
- [ ] **Step 3: Implement sentinel.ts**

Create `packages/agent/src/sentinel/sentinel.ts`:

```typescript
import { scanWallet } from './scanner.js'
import { getSentinelConfig, type SentinelConfig } from './config.js'
import { toGuardianEvent, type Detection } from './detector.js'
import { guardianBus } from '../coordination/event-bus.js'

export const SENTINEL_IDENTITY = {
  name: 'SENTINEL',
  role: 'Blockchain Monitor',
  llm: false,
} as const

export interface SentinelStatus {
  state: 'idle' | 'scanning' | 'error' | 'backoff'
  walletsMonitored: number
  lastScanAt: string | null
  totalScans: number
  currentInterval: number
}

export class SentinelWorker {
  private wallets = new Set<string>()
  private balanceCache = new Map<string, number>()
  private running = false
  private timer: NodeJS.Timeout | null = null
  private config: SentinelConfig
  private currentInterval: number
  private backoffMultiplier = 1
  private lastScanAt: string | null = null
  private totalScans = 0

  constructor() {
    this.config = getSentinelConfig()
    this.currentInterval = this.config.scanInterval
  }

  addWallet(wallet: string): void {
    this.wallets.add(wallet)
  }

  removeWallet(wallet: string): void {
    this.wallets.delete(wallet)
    this.balanceCache.delete(wallet)
  }

  getWallets(): string[] {
    return [...this.wallets]
  }

  isRunning(): boolean {
    return this.running
  }

  getStatus(): SentinelStatus {
    return {
      state: this.running ? 'scanning' : 'idle',
      walletsMonitored: this.wallets.size,
      lastScanAt: this.lastScanAt,
      totalScans: this.totalScans,
      currentInterval: this.currentInterval,
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleTick()
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleTick(): void {
    if (!this.running) return
    this.timer = setTimeout(async () => {
      await this.tick()
      this.scheduleTick()
    }, this.currentInterval)
    this.timer.unref()
  }

  private async tick(): Promise<void> {
    const walletsToScan = [...this.wallets].slice(0, this.config.maxWalletsPerCycle)
    if (walletsToScan.length === 0) {
      this.currentInterval = this.config.scanInterval
      return
    }

    this.currentInterval = this.config.activeScanInterval
    this.totalScans++
    this.lastScanAt = new Date().toISOString()

    for (const wallet of walletsToScan) {
      try {
        const result = await scanWallet(wallet, {
          previousBalance: this.balanceCache.get(wallet),
          maxRpcCalls: this.config.maxRpcPerWallet,
        })

        this.balanceCache.set(wallet, result.vaultBalance)
        this.backoffMultiplier = 1

        for (const detection of result.detections) {
          const event = toGuardianEvent(detection)
          guardianBus.emit({ ...event, timestamp: new Date().toISOString() })
        }

        // Emit routine scan-complete (suppressed from activity stream by ActivityLogger)
        guardianBus.emit({
          source: 'sentinel',
          type: 'sentinel:scan-complete',
          level: 'routine',
          data: { wallet, rpcCalls: result.rpcCalls, detections: result.detections.length },
          timestamp: new Date().toISOString(),
        })
      } catch (err) {
        // RPC error → backoff
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, this.config.backoffMax / this.config.scanInterval)
        this.currentInterval = Math.min(
          this.config.scanInterval * this.backoffMultiplier,
          this.config.backoffMax
        )

        guardianBus.emit({
          source: 'sentinel',
          type: 'sentinel:rpc-error',
          level: 'critical',
          data: { wallet, error: String(err), backoffMs: this.currentInterval },
          timestamp: new Date().toISOString(),
        })
      }
    }
  }
}
```

- [ ] **Step 4: Run test → verify pass**
- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/sentinel/sentinel.ts packages/agent/tests/sentinel/sentinel.test.ts
git commit -m "feat: add SENTINEL worker — adaptive scan loop, wallet tracking, backoff"
```

---

## Task 6: Wire SENTINEL into index.ts + Integration Test

**Files:**
- Modify: `packages/agent/src/index.ts`
- Create: `packages/agent/tests/integration/sentinel.test.ts`

- [ ] **Step 1: Write integration test**

Create `packages/agent/tests/integration/sentinel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn(() => ({})),
  getVaultBalance: vi.fn().mockResolvedValue({ total: '5000000000', available: '5000000000', locked: '0', exists: true }),
  scanForPayments: vi.fn().mockResolvedValue([]),
  getVaultHistory: vi.fn().mockResolvedValue([]),
}))

import { EventBus } from '../../src/coordination/event-bus.js'
import { SentinelWorker, SENTINEL_IDENTITY } from '../../src/sentinel/sentinel.js'
import { getSentinelConfig } from '../../src/sentinel/config.js'
import { shouldAutoRefund, isRefundSafe, generateIdempotencyKey } from '../../src/sentinel/refund-guard.js'
import { detectExpiredDeposit, detectThreat, toGuardianEvent } from '../../src/sentinel/detector.js'

describe('SENTINEL Integration', () => {
  it('SENTINEL_IDENTITY is correct', () => {
    expect(SENTINEL_IDENTITY.name).toBe('SENTINEL')
    expect(SENTINEL_IDENTITY.role).toBe('Blockchain Monitor')
    expect(SENTINEL_IDENTITY.llm).toBe(false)
  })

  it('config + refund-guard work together', () => {
    const config = getSentinelConfig()
    expect(shouldAutoRefund(0.5, config.autoRefundThreshold)).toBe(true)
    expect(shouldAutoRefund(5, config.autoRefundThreshold)).toBe(false)
  })

  it('detector → toGuardianEvent → EventBus flow', () => {
    const bus = new EventBus()
    const received: any[] = []
    bus.on('sentinel:threat', (e) => received.push(e))

    const detection = detectThreat({ address: '8xAb', reason: 'OFAC', wallet: 'w1' })
    const event = toGuardianEvent(detection)
    bus.emit({ ...event, timestamp: new Date().toISOString() })

    expect(received).toHaveLength(1)
    expect(received[0].level).toBe('critical')
  })

  it('worker lifecycle', () => {
    const worker = new SentinelWorker()
    worker.addWallet('wallet-1')
    expect(worker.getWallets()).toEqual(['wallet-1'])
    worker.start()
    expect(worker.isRunning()).toBe(true)
    worker.stop()
    expect(worker.isRunning()).toBe(false)
  })

  it('refund guard idempotency keys are deterministic', () => {
    const key1 = generateIdempotencyKey('pda-1', 1700000000)
    const key2 = generateIdempotencyKey('pda-1', 1700000000)
    expect(key1).toBe(key2)
    expect(isRefundSafe('pda-1', [])).toBe(true)
  })

  it('expired deposit detection branches correctly', () => {
    const small = detectExpiredDeposit({ depositPda: 'p1', amount: 0.3, wallet: 'w1', threshold: 1 })
    expect(small.data.autoRefund).toBe(true)

    const large = detectExpiredDeposit({ depositPda: 'p2', amount: 5, wallet: 'w1', threshold: 1 })
    expect(large.data.autoRefund).toBe(false)
  })
})
```

- [ ] **Step 2: Update index.ts**

Read `packages/agent/src/index.ts` and add:

```typescript
import { SentinelWorker } from './sentinel/sentinel.js'

// Initialize SENTINEL
const sentinel = new SentinelWorker()
sentinel.start()
console.log('SENTINEL started')
```

Also update the `/api/squad` route to use real sentinel status. In `packages/agent/src/routes/squad-api.ts`, import `sentinel` and update the GET handler to include `sentinel.getStatus()`.

If wiring the sentinel instance into squad-api requires passing it as a parameter (module-level import won't work for a runtime instance), create a simple registry or export the instance from index.ts. The simplest approach: export a `getSentinel()` function.

- [ ] **Step 3: Run integration test → verify pass**
- [ ] **Step 4: Run full test suite → verify no regressions**

```bash
cd ~/local-dev/sipher && pnpm test -- --run
```

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/index.ts packages/agent/src/sentinel/ packages/agent/tests/integration/sentinel.test.ts
git commit -m "feat: wire SENTINEL into Express — worker started, integration tested"
```

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Config | sentinel/config.ts | ~3 |
| 2 | Detector | sentinel/detector.ts | ~6 |
| 3 | Refund Guard | sentinel/refund-guard.ts | ~7 |
| 4 | Scanner | sentinel/scanner.ts | ~4 |
| 5 | Worker Class | sentinel/sentinel.ts | ~6 |
| 6 | Wire + Integration | index.ts + integration/sentinel.test.ts | ~6 |

**Total:** 6 tasks, ~6 commits, ~6 new files, ~6 test files

**Note:** Plan C is smaller than A/B because:
- COURIER is already built (crank.ts + Plan A identity/events)
- SENTINEL has no LLM — pure TypeScript logic
- SDK already has the RPC functions (scanForPayments, getVaultBalance, etc.)
