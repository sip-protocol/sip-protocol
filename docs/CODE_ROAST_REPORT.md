# CODE ROAST REPORT

**Roast Date**: 2026-01-15
**Repository**: sip-protocol/sip-protocol (Core SDK Monorepo)
**Roaster**: CIPHER (`--no-mercy` mode enabled)
**Verdict**: **NEEDS WORK** - Career enders found

---

## EXECUTIVE SUMMARY

Bismillah. The previous roast (2025-12-04) declared this codebase "SHIP IT." But with `--no-mercy` mode and a deeper dive, we found some career-ending issues lurking beneath the surface. The security middleware exists, yes - but the implementation has critical gaps. The API has rate limiting, yes - but it's trivially bypassed. The codebase has 2,757 tests - but the production code has mock values hardcoded in it.

The foundation is solid. The bones are good. But these issues need fixing before any real money flows through this protocol.

---

## CAREER ENDERS

These would get you an emergency meeting with your manager.

---

### 1. In-Memory Swap Storage Without Bounds (Production OOM)

**File**: `packages/api/src/routes/swap.ts:20-30`
**Sin**: Unbounded `Map` storing swap data in production API

**Evidence**:
```typescript
// In-memory swap tracking (in production, use a database)
const swaps = new Map<string, {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionHash?: HexString
  inputAmount: string
  outputAmount?: string
  createdAt: string
  updatedAt: string
  error?: string
}>()
```

**Why it's bad**:
- Server runs out of memory after enough swaps
- No TTL, no cleanup, no eviction policy
- No persistence - server restart loses ALL swap data
- Comment literally says "in production, use a database" - the TODO that ships to prod

**The Fix**:
- Use Redis with TTL or proper database
- If in-memory is required, use LRU cache with max size
- Add cleanup job for old entries

**Severity**: CAREER ENDER

---

### 2. CLI Outputs Private Keys in Plain Text

**File**: `packages/cli/src/commands/scan.ts:59, 76-82`
**Sin**: Private keys displayed in terminal output and stored in shell history

**Evidence**:
```typescript
results.push({
  address,
  isMine: result.isMine,
  privateKey: result.isMine ? result.stealthPrivateKey : undefined,
})

// Later displayed in table:
const rows = results
  .filter(r => r.isMine)
  .map(r => [
    r.address.slice(0, 10) + '...',
    'Yes',
    r.privateKey ? r.privateKey.slice(0, 10) + '...' : 'N/A',
  ])
```

**Why it's bad**:
- Private keys logged to terminal history (`~/.bash_history`, `~/.zsh_history`)
- Even truncated keys provide brute-force attack surface
- `ps aux` exposes running commands with keys
- The "warning" on line 88 comes AFTER the keys are displayed

**The Fix**:
- NEVER display private keys in CLI output
- Write to encrypted file with secure permissions
- Use `--output` flag with file destination only
- Clear screen/terminal buffer after display

**Severity**: CAREER ENDER

---

### 3. Rate Limiter Trivially Bypassed via Proxy Headers

**File**: `packages/api/src/middleware/rate-limit.ts:27`
**Sin**: IPv6/X-Forwarded-For validation explicitly disabled

**Evidence**:
```typescript
validate: { xForwardedForHeader: false }, // Disable IPv6 validation warning
```

**Why it's bad**:
- Behind any reverse proxy (nginx, cloudflare, AWS ALB), attackers set arbitrary `X-Forwarded-For` headers
- IPv6 address space provides unlimited unique "identities"
- The 10/min rate limit on auth endpoints? Useless.
- The 5/min rate limit on expensive proof operations? Bypassed.

**The Fix**:
```typescript
app.set('trust proxy', 1) // Trust first proxy only
// Use Redis-based rate limiter for distributed limiting
```

**Severity**: CAREER ENDER

---

### 4. Hardcoded Mock Values in Production API Endpoints

**File**: `packages/api/src/routes/swap.ts:92, 101, 115, 189`
**Sin**: Test data hardcoded in what's supposed to be production code

**Evidence**:
```typescript
// Line 92, 101 - All assets get 9 decimals (SOL)
decimals: 9,  // Bitcoin has 8, USDC has 6, ETH tokens have 18

// Line 115 - Mock pricing
outputAmount: (BigInt(inputAmount) * 95n / 100n).toString(), // Mock 5% fee

// Line 189 - Swap doesn't even track input amount
inputAmount: '1000000000', // Mock value
```

**Why it's bad**:
- Users get wrong swap quotes (wrong decimals = orders of magnitude errors)
- Actual swap amounts aren't recorded (audit nightmare)
- The quotes are literally `input * 0.95` - not real exchange rates
- Any integration relying on this API gets garbage data

**The Fix**:
- Remove all mock values or gate behind `NODE_ENV !== 'production'`
- Fail loudly if real data source unavailable
- Add integration tests that verify production endpoints return real data

**Severity**: CAREER ENDER

---

## EMBARRASSING MOMENTS

Would make the team Slack channel awkward.

---

### 5. BigInt Input Without Range Validation

**File**: `packages/api/src/routes/swap.ts:94, 104`
**Sin**: Accepting arbitrary numeric strings as BigInt without validation

**Evidence**:
```typescript
amount: BigInt(inputAmount),  // What if "99999999999999999999999999999999"?

// Line 104 - Integer math that can overflow
minAmount: BigInt(inputAmount) * BigInt(10000 - Math.floor((slippageTolerance || 1) * 100)) / 10000n
```

**Why it's bad**:
- No maximum value check (could exceed uint256)
- No minimum value check (could be 0 or negative string "-1")
- Slippage calculation with intermediate multiplication could overflow
- `BigInt("abc")` throws, crashing the endpoint

**The Fix**:
```typescript
const MAX_AMOUNT = 2n ** 256n - 1n
z.string().regex(/^\d+$/).max(78).refine(v => {
  const n = BigInt(v)
  return n > 0n && n <= MAX_AMOUNT
})
```

**Severity**: EMBARRASSING

---

### 6. N+1 Query Pattern in Settlement Router

**File**: `packages/sdk/src/settlement/router.ts:140-195`
**Sin**: Query all backends, then query each one individually for quotes

**Evidence**:
```typescript
const allBackends = this.registry
  .list()
  .map((name) => this.registry.get(name))  // N lookups

// Later:
const quotePromises = compatibleBackends.map(async (backend) => {
  try {
    const quote = await backend.getQuote(quoteParams)  // N network requests
  } catch (e) {
    return null
  }
})
```

**Why it's bad**:
- With 10+ backends, every quote request = 10+ parallel network calls
- No caching - same quote request 5 seconds later repeats everything
- No timeout per-backend - one slow backend delays all results
- Silent `catch (e) { return null }` hides backend failures

**The Fix**:
- Cache quotes with TTL (5-30 seconds)
- Add per-backend timeout with `Promise.race()`
- Use circuit breaker for repeatedly failing backends
- Log/alert on backend failures

**Severity**: EMBARRASSING

---

### 7. Type `any` Abuse Across Codebase

**Files**: Multiple (100+ instances)
**Sin**: TypeScript's escape hatch used too liberally

**Evidence**:
```typescript
// packages/sdk/src/chains/solana/providers/triton.ts:123
private activeStreams: Set<any> = new Set()

// packages/sdk/src/chains/solana/providers/quicknode.ts:107
private activeStreams: Set<any> = new Set()

// packages/cli/src/commands/scan.ts:38
let result: any

// packages/cli/src/commands/keygen.ts:24
let metaAddress: any
```

**Why it's bad**:
- 100+ `as any` casts in tests = mocked-to-death testing
- Production code uses `any` for complex types instead of defining them
- Defeats the purpose of TypeScript
- Bugs slip through that types would have caught

**The Fix**:
- Define proper types for gRPC streams
- Use generics where appropriate
- `unknown` + type guards instead of `any`
- Enable `noImplicitAny` in tsconfig

**Severity**: EMBARRASSING

---

### 8. CORS Wildcard Subdomain Matching with URL Parsing

**File**: `packages/api/src/middleware/cors.ts:66-74`
**Sin**: Trusting untrusted origin string in URL parser

**Evidence**:
```typescript
if (allowed.startsWith('*.')) {
  const domain = allowed.slice(2)
  const originHost = new URL(origin).host  // Can throw on malformed URL!
  if (originHost === domain || originHost.endsWith('.' + domain)) {
    return true
  }
}
```

**Why it's bad**:
- `new URL(malformed)` throws - crashes CORS check on weird origins
- No protocol validation (http vs https)
- Subdomain wildcards can match attacker-controlled subdomains
- If credentials enabled, this leaks tokens cross-origin

**The Fix**:
```typescript
try {
  const url = new URL(origin)
  if (url.protocol !== 'https:') return false // Enforce HTTPS in prod
  // ...
} catch {
  return false // Invalid URL = denied
}
```

**Severity**: EMBARRASSING

---

### 9. TODO: Get from token metadata (Hardcoded Decimals)

**File**: `packages/sdk/src/privacy-backends/combined-privacy.ts:411`
**Sin**: Hardcoding decimals instead of fetching from token

**Evidence**:
```typescript
decimals: 9, // TODO: Get from token metadata
```

**Why it's bad**:
- USDC has 6 decimals, not 9 (1000x error)
- DAI has 18 decimals, not 9 (1 billion x error)
- Bitcoin has 8 decimals
- Financial transactions with wrong decimals = lost funds

**The Fix**:
- Fetch decimals from token metadata
- Cache token metadata
- Fail if decimals unknown (don't guess)

**Severity**: EMBARRASSING

---

### 10. Fire-and-Forget Proof Provider Initialization

**File**: `packages/api/src/routes/proof.ts:13-14`
**Sin**: Initialize async operation without waiting for result

**Evidence**:
```typescript
proofProvider.initialize().catch(console.error)  // Silent fail, no retry
```

**Why it's bad**:
- If initialization fails, all subsequent proof requests fail
- No health check to detect initialization failure
- Error just logs to console, no alerting
- Service appears healthy but can't actually prove anything

**The Fix**:
```typescript
let initialized = false
proofProvider.initialize()
  .then(() => { initialized = true })
  .catch((err) => {
    logger.fatal('Proof provider init failed', err)
    process.exit(1)  // Fail fast
  })

// Health check:
app.get('/health', (req, res) => {
  if (!initialized) return res.status(503).json({ status: 'not ready' })
  // ...
})
```

**Severity**: EMBARRASSING

---

## EYE ROLL COLLECTION

Senior devs would sigh and fix it themselves.

---

### 11. console.warn Deprecation Spam

**File**: `packages/sdk/src/crypto.ts:40-43, 62-65`
**Sin**: Deprecated functions log warnings on every call

**Evidence**:
```typescript
export function createCommitment(...) {
  console.warn(
    'createCommitment() is deprecated and will be removed in v0.2.0. ' +
    'Use commit() from "./commitment" instead.'
  )
```

**Why it's bad**:
- Production logs filled with deprecation warnings
- No way to suppress (no `--no-warnings` flag)
- If called in a loop, performance tanks
- "v0.2.0" is vague - when is that?

**Severity**: EYE ROLL

---

### 12. TODO/FIXME Graveyard

**Files**: Multiple locations
**Sin**: Technical debt documented but never paid

**Evidence**:
```typescript
// packages/react/src/hooks/use-scan-payments.ts:312
// @todo Implement proper claimAll when we can resolve mint strings to PublicKey

// packages/react/src/hooks/use-scan-payments.ts:331
// TODO: Implement when mint resolution is available

// packages/sdk/src/privacy-backends/cspl-token.ts:495
// TODO(#536): _delegate and _owner are reserved for production implementation.
```

**Why it's bad**:
- TODOs with issue numbers are good, most don't have them
- "production implementation" TODOs in production code

**Severity**: EYE ROLL

---

### 13. No Request ID Correlation

**File**: `packages/api/src/server.ts`
**Sin**: X-Request-ID exposed in CORS but never generated

**Evidence**:
```typescript
// Line 29 - exposed in CORS headers:
'X-Request-ID',

// But nowhere in the codebase generates it
```

**Why it's bad**:
- Clients expect request IDs for debugging
- Sentry error reports have no correlation
- Log analysis is impossible without request ID
- "What request caused this error?" is unanswerable

**Severity**: EYE ROLL

---

### 14. eslint-disable-next-line Scattered Throughout

**Files**: 40+ occurrences
**Sin**: Disabling linter instead of fixing issues

**Evidence**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
private activeStreams: Set<any> = new Set()

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const claimAll = async () => { ... }
```

**Why it's bad**:
- 40+ explicit type disables
- Unused variable disables (dead code)
- Signal that types are incomplete

**Severity**: EYE ROLL

---

### 15. Missing .env.example Sync

**Files**: `.env.example` vs `packages/api/.env.example`
**Sin**: Root and package .env.example files have different variables

**Evidence**:
```bash
# Root .env.example:
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# packages/api/.env.example:
CORS_ORIGIN=http://localhost:3000  # Different variable name!
```

**Why it's bad**:
- Root uses `CORS_ORIGINS` (plural)
- Package uses `CORS_ORIGIN` (singular)
- New devs will set the wrong one and wonder why it doesn't work

**Severity**: EYE ROLL

---

## MEH TIER

Annoying but survivable.

---

### 16. 1500-Line Files

**Files**:
- `packages/sdk/src/stealth.ts` (1507 lines)
- `packages/sdk/src/proofs/browser.ts` (1374 lines)
- `packages/sdk/src/proofs/noir.ts` (1143 lines)
- `packages/sdk/src/sip.ts` (1124 lines)

**Why it's bad**:
- Hard to navigate
- Hard to test individual functions
- High cognitive load
- Merge conflicts more likely

**Severity**: MEH

---

### 17. localhost Hardcoded in Multiple Places

**Files**: 15+ occurrences
**Evidence**:
```typescript
localnet: 'http://localhost:8899',
localnet: 'http://localhost:3000',
```

**Why it's bad**:
- Not configurable
- Won't work in Docker without `host.docker.internal`
- Should use 0.0.0.0 or be configurable

**Severity**: MEH

---

## FINAL ROAST SCORE

| Category | Score | Notes |
|----------|-------|-------|
| **Security** | 4/10 | Rate limiter bypass, private key exposure, CORS issues |
| **Scalability** | 5/10 | Unbounded Map, N+1 queries, no caching |
| **Code Quality** | 6/10 | 100+ `any` types, 1500-line files, TODO graveyard |
| **Testing** | 7/10 | 2,757 tests, but `as any` mocking hides real integration issues |
| **Documentation** | 7/10 | Good README, but env vars mismatch |

**Overall**: **29/50**

---

## ROASTER'S CLOSING STATEMENT

This codebase has bones. Good bones, actually. 2,757 tests is impressive. The cryptography uses @noble/curves (correct choice). The architecture separates concerns reasonably well. The team clearly understands what they're building.

But the corners cut are the kind that bite you at 3 AM:

1. **The in-memory swap Map will run you out of RAM** the moment you get real traffic. This is Production 101.

2. **The CLI dumps private keys to terminal** - in a privacy-focused protocol. The irony is painful.

3. **The rate limiter is theater** - anyone behind a proxy (which is everyone in production) bypasses it trivially.

4. **Mock data in production endpoints** - your quotes are literally `input * 0.95`. That's not a DEX, that's a random number generator.

5. **The type system is being ignored** - 100+ `as any` casts mean TypeScript is just expensive linting at this point.

The good news: these are all fixable before launch. The bad news: if you shipped today, your first real user would probably trigger a production incident.

**Priority Fixes (Before Production)**:
1. Replace Map with LRU cache + database in swap.ts
2. Remove or gate mock values behind NODE_ENV
3. Fix rate limiter to work behind proxy
4. Stop displaying private keys in CLI
5. Add BigInt range validation

May Allah guide this code to production-worthiness. InshaAllah, the next audit will find less to roast.

---

*This roast conducted with `--no-mercy` flag. No code crimes went unexamined.*

*Previous roast: 2025-12-04 (50/60 "SHIP IT" - turns out we missed some things)*
*This roast: 2026-01-15 (29/50 "NEEDS WORK" - digging deeper hurts)*
