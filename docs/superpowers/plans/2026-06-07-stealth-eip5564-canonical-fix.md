# Stealth EIP-5564 Canonical Fix — SDK + React + CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the SIP stealth scheme on both curves to canonical EIP-5564 so view-only scanning works, the four broken scanners function unchanged, and existing `SIP:1` funds stay claimable.

**Architecture:** Mechanical role-swap in `generate`/`derive`/`check` (ECDH → viewing key, address → spending key). `checkStealthAddress` becomes a view-only `(addr, viewingPrivateKey, spendingPublicKey)` function (breaking). The old swapped `derive`/`check` are preserved as `*V1` for claiming legacy `SIP:1` announcements; new sends emit `SIP:2`; the claim path routes by version.

**Tech Stack:** TypeScript, `@noble/curves` (secp256k1, ed25519), `@noble/hashes`, Vitest, pnpm/Turborepo.

**Design spec:** `docs/superpowers/specs/2026-06-07-stealth-eip5564-canonical-fix-design.md` · **Issue:** [#1099](https://github.com/sip-protocol/sip-protocol/issues/1099)

**Confirmed decisions:** keep minimal v1 back-compat (claim-side only); breaking `checkStealthAddress` signature flip.

---

## File Structure

- `packages/sdk/src/stealth/ed25519.ts` — flip generate/derive/check; add `deriveEd25519StealthPrivateKeyV1`, `checkEd25519StealthAddressV1`
- `packages/sdk/src/stealth/secp256k1.ts` — same for secp256k1
- `packages/sdk/src/stealth/index.ts` — new `checkStealthAddress` sig + header comment; export V1 fns; version-aware `deriveStealthPrivateKey`
- `packages/sdk/src/chains/solana/constants.ts` — `SIP_MEMO_PREFIX`/version constants
- `packages/sdk/src/chains/solana/types.ts` — `createAnnouncementMemo` emits v2; `parseAnnouncement` returns `version`
- `packages/sdk/src/chains/solana/scan.ts` — version-routed `claimStealthPayment`; view-only `scanForPayments` (no call-site change)
- `packages/cli/src/commands/scan.ts` — view-only check + version-routed derive + legacy v1 fallback
- `packages/react/src/hooks/use-scan-payments.ts` — no change; add hook test
- Tests: `packages/sdk/tests/crypto/stealth-ed25519.test.ts`, `tests/crypto/stealth.test.ts`, `tests/chains/solana/scan.test.ts`, `tests/e2e/**`, `packages/react/tests/**`, `packages/cli/tests/**`

---

### Task 0: Branch + baseline

- [ ] **Step 1: Create branch**

```bash
cd /Users/rector/local-dev/sip-protocol
git checkout main && git pull
git checkout -b fix/stealth-eip5564-canonical
```

- [ ] **Step 2: Baseline the SDK suite (record current pass count)**

Run: `pnpm --filter @sip-protocol/sdk test -- --run 2>&1 | tail -15`
Expected: all green (note the totals; this is the regression baseline).

---

### Task 1: Red test — ed25519 view-only delegation

**Files:**
- Test: `packages/sdk/tests/crypto/stealth-ed25519-canonical.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519'
import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
} from '../../src/stealth'
import type { ChainId, HexString } from '@sip-protocol/types'

describe('ed25519 canonical EIP-5564', () => {
  it('detects with viewing-private + spending-PUBLIC only (view-only)', () => {
    const { metaAddress, viewingPrivateKey } = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    // canonical view-only signature: (addr, viewingPrivateKey, spendingPublicKey)
    expect(checkStealthAddress(stealthAddress, viewingPrivateKey, metaAddress.spendingKey)).toBe(true)
  })

  it('does NOT detect with the wrong viewing key', () => {
    const a = generateStealthMetaAddress('solana' as ChainId)
    const b = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(a.metaAddress)
    expect(checkStealthAddress(stealthAddress, b.viewingPrivateKey, a.metaAddress.spendingKey)).toBe(false)
  })

  it('spend key requires BOTH privates and controls the address', () => {
    const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress('solana' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    const { privateKey } = deriveStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
    const scalar = leToBig(hexBytes(privateKey)) % ED25519_L
    const pub = ed25519.ExtendedPoint.BASE.multiply(scalar).toRawBytes()
    expect('0x' + Buffer.from(pub).toString('hex')).toBe(stealthAddress.address)
  })
})

const ED25519_L = 2n ** 252n + 27742317777372353535851937790883648493n
function hexBytes(h: HexString): Uint8Array { const s = h.slice(2); const o = new Uint8Array(s.length/2); for (let i=0;i<o.length;i++) o[i]=parseInt(s.substr(i*2,2),16); return o }
function leToBig(b: Uint8Array): bigint { let r=0n; for (let i=b.length-1;i>=0;i--) r=(r<<8n)|BigInt(b[i]); return r }
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/crypto/stealth-ed25519-canonical.test.ts`
Expected: FAIL (current code uses the swapped convention + old signature).

---

### Task 2: Flip ed25519 generation to canonical

**Files:** Modify `packages/sdk/src/stealth/ed25519.ts:229-248` (inside `generateEd25519StealthAddress`)

- [ ] **Step 1: Replace the ECDH + address lines**

Current:
```typescript
    // S = ephemeral_scalar * P_spend
    const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingKeyBytes)
    const sharedSecretPoint = spendingPoint.multiply(ephemeralScalar)
    ...
    // Add to viewing key: P_stealth = P_view + hash(S)*G
    const viewingPoint = ed25519.ExtendedPoint.fromHex(viewingKeyBytes)
    const stealthPoint = viewingPoint.add(hashTimesG)
```

Canonical:
```typescript
    // S = ephemeral_scalar * P_view  (EIP-5564: ECDH on the VIEWING key)
    const viewingPoint = ed25519.ExtendedPoint.fromHex(viewingKeyBytes)
    const sharedSecretPoint = viewingPoint.multiply(ephemeralScalar)
    ...
    // Add to spending key: P_stealth = P_spend + hash(S)*G
    const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingKeyBytes)
    const stealthPoint = spendingPoint.add(hashTimesG)
```

Also update the doc comment at `ed25519.ts:198-203` to `S = r * P_view` and `P_stealth = P_spend + h*G`.

- [ ] **Step 2: Commit (test still red until check is flipped)**

```bash
git add packages/sdk/src/stealth/ed25519.ts
git commit -m "refactor(stealth): ed25519 generation to canonical EIP-5564 roles"
```

---

### Task 3: Flip ed25519 derivation + preserve legacy V1

**Files:** Modify `packages/sdk/src/stealth/ed25519.ts` (`deriveEd25519StealthPrivateKey:280-352`)

- [ ] **Step 1: Rename the current function to `deriveEd25519StealthPrivateKeyV1`**

Keep its body byte-for-byte (the swapped convention: `S = spending_scalar·R`, `p = view + H(S)`). Add a JSDoc: `@deprecated Legacy SIP:1 swapped scheme — claim-side back-compat only.`

- [ ] **Step 2: Add the canonical `deriveEd25519StealthPrivateKey`**

Same signature `(stealthAddress, spendingPrivateKey, viewingPrivateKey)`, with the two scalars swapped in usage:

```typescript
    // S = viewing_scalar * R  (canonical)
    const rawViewingScalar = getEd25519Scalar(viewingPrivBytes)
    const viewingScalar = rawViewingScalar % ED25519_ORDER
    if (viewingScalar === 0n) throw new Error('CRITICAL: Zero viewing scalar after reduction')
    const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralPubBytes)
    const sharedSecretPoint = ephemeralPoint.multiply(viewingScalar)
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

    // p = spending_scalar + hash(S)  (canonical)
    const rawSpendingScalar = getEd25519Scalar(spendingPrivBytes)
    const spendingScalar = rawSpendingScalar % ED25519_ORDER
    if (spendingScalar === 0n) throw new Error('CRITICAL: Zero spending scalar after reduction')
    const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
    if (hashScalar === 0n) throw new Error('CRITICAL: Zero hash scalar after reduction')
    const stealthPrivateScalar = (spendingScalar + hashScalar) % ED25519_ORDER
    if (stealthPrivateScalar === 0n) throw new Error('CRITICAL: Zero stealth scalar after reduction')
```

(Validation block + `bigIntToBytesLE` output + secureWipe unchanged.)

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/stealth/ed25519.ts
git commit -m "refactor(stealth): ed25519 derivation canonical + preserve V1 for back-compat"
```

---

### Task 4: Rewrite ed25519 check as canonical view-only + preserve V1

**Files:** Modify `packages/sdk/src/stealth/ed25519.ts` (`checkEd25519StealthAddress:359-431`)

- [ ] **Step 1: Rename current function to `checkEd25519StealthAddressV1`** (body unchanged; signature stays `(addr, spendingPrivateKey, viewingPrivateKey)`). JSDoc `@deprecated Legacy SIP:1 full-wallet check.`

- [ ] **Step 2: Add canonical view-only `checkEd25519StealthAddress`**

```typescript
/**
 * Check if an ed25519 stealth address is ours — canonical EIP-5564 view-only.
 * Requires only the viewing PRIVATE key + the spending PUBLIC key.
 */
export function checkEd25519StealthAddress(
  stealthAddress: StealthAddress,
  viewingPrivateKey: HexString,
  spendingPublicKey: HexString,
): boolean {
  validateEd25519StealthAddress(stealthAddress)
  if (!isValidPrivateKey(viewingPrivateKey)) {
    throw new ValidationError('must be a valid 32-byte hex string', 'viewingPrivateKey')
  }
  if (!isValidEd25519PublicKey(spendingPublicKey)) {
    throw new ValidationError('must be a valid ed25519 public key (32 bytes)', 'spendingPublicKey')
  }
  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2))
  const spendingPubBytes = hexToBytes(spendingPublicKey.slice(2))
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey.slice(2))
  try {
    const rawViewingScalar = getEd25519Scalar(viewingPrivBytes)
    const viewingScalar = rawViewingScalar % ED25519_ORDER
    if (viewingScalar === 0n) throw new Error('CRITICAL: Zero viewing scalar after reduction')
    const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralPubBytes)
    const sharedSecretPoint = ephemeralPoint.multiply(viewingScalar)
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())
    if (sharedSecretHash[0] !== stealthAddress.viewTag) return false
    const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
    if (hashScalar === 0n) throw new Error('CRITICAL: Zero hash scalar after reduction')
    const hashTimesG = ed25519.ExtendedPoint.BASE.multiply(hashScalar)
    const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingPubBytes)
    const expectedPoint = spendingPoint.add(hashTimesG)
    const providedAddress = hexToBytes(stealthAddress.address.slice(2))
    return bytesToHex(expectedPoint.toRawBytes()) === bytesToHex(providedAddress)
  } finally {
    secureWipe(viewingPrivBytes)
  }
}
```

- [ ] **Step 3: Run Task 1 test → PASS**

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/crypto/stealth-ed25519-canonical.test.ts`
Expected: PASS (3/3).

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/stealth/ed25519.ts
git commit -m "feat(stealth): ed25519 canonical view-only checkStealthAddress + preserve V1"
```

---

### Task 5: secp256k1 — red test, then flip generate/derive/check (+ V1)

**Files:** Test `packages/sdk/tests/crypto/stealth-secp256k1-canonical.test.ts` (create); modify `packages/sdk/src/stealth/secp256k1.ts`

- [ ] **Step 1: Write the failing test** (mirror Task 1 with `'ethereum'`; verify recovered key via `secp256k1.getPublicKey(priv, true)`)

```typescript
import { describe, it, expect } from 'vitest'
import { secp256k1 } from '@noble/curves/secp256k1'
import { generateStealthMetaAddress, generateStealthAddress, checkStealthAddress, deriveStealthPrivateKey } from '../../src/stealth'
import type { ChainId, HexString } from '@sip-protocol/types'

describe('secp256k1 canonical EIP-5564', () => {
  it('detects view-only (viewing-priv + spending-pub)', () => {
    const { metaAddress, viewingPrivateKey } = generateStealthMetaAddress('ethereum' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    expect(checkStealthAddress(stealthAddress, viewingPrivateKey, metaAddress.spendingKey)).toBe(true)
  })
  it('recovered key controls the address (both privates)', () => {
    const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateStealthMetaAddress('ethereum' as ChainId)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    const { privateKey } = deriveStealthPrivateKey(stealthAddress, spendingPrivateKey, viewingPrivateKey)
    const pub = secp256k1.getPublicKey(hb(privateKey), true)
    expect('0x' + Buffer.from(pub).toString('hex')).toBe(stealthAddress.address)
  })
})
function hb(h: HexString){const s=h.slice(2);const o=new Uint8Array(s.length/2);for(let i=0;i<o.length;i++)o[i]=parseInt(s.substr(i*2,2),16);return o}
```

Run: `pnpm --filter @sip-protocol/sdk test -- --run tests/crypto/stealth-secp256k1-canonical.test.ts` → Expected: FAIL.

- [ ] **Step 2: Flip `generateSecp256k1StealthAddress:166-181`**

```typescript
    // S = r * K_view  (ECDH on viewing key)
    const sharedSecretPoint = secp256k1.getSharedSecret(ephemeralPrivateKey, viewingKeyBytes)
    const sharedSecretHash = sha256(sharedSecretPoint)
    const hashTimesG = secp256k1.getPublicKey(sharedSecretHash, true)
    // A = K_spend + hash(S)*G
    const spendingKeyPoint = secp256k1.ProjectivePoint.fromHex(spendingKeyBytes)
    const hashTimesGPoint = secp256k1.ProjectivePoint.fromHex(hashTimesG)
    const stealthPoint = spendingKeyPoint.add(hashTimesGPoint)
```

- [ ] **Step 3: Rename current `deriveSecp256k1StealthPrivateKey`→`...V1`; add canonical** (`deriveSecp256k1StealthPrivateKey:231-242`):

```typescript
    // S = k_view * R
    const sharedSecretPoint = secp256k1.getSharedSecret(viewingPrivBytes, ephemeralPubBytes)
    const sharedSecretHash = sha256(sharedSecretPoint)
    // p = k_spend + hash(S)
    const spendingScalar = bytesToBigInt(spendingPrivBytes)
    const hashScalar = bytesToBigInt(sharedSecretHash)
    const stealthPrivateScalar = (spendingScalar + hashScalar) % secp256k1.CURVE.n
```

- [ ] **Step 4: Rename current `checkSecp256k1StealthAddress`→`...V1`; add canonical view-only**

```typescript
export function checkSecp256k1StealthAddress(
  stealthAddress: StealthAddress,
  viewingPrivateKey: HexString,
  spendingPublicKey: HexString,
): boolean {
  validateSecp256k1StealthAddress(stealthAddress)
  if (!isValidPrivateKey(viewingPrivateKey)) throw new ValidationError('must be a valid 32-byte hex string', 'viewingPrivateKey')
  if (!isValidCompressedPublicKey(spendingPublicKey)) throw new ValidationError('must be a valid compressed secp256k1 public key', 'spendingPublicKey')
  const viewingPrivBytes = hexToBytes(viewingPrivateKey.slice(2))
  const spendingPubBytes = hexToBytes(spendingPublicKey.slice(2))
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey.slice(2))
  try {
    const sharedSecretPoint = secp256k1.getSharedSecret(viewingPrivBytes, ephemeralPubBytes)
    const sharedSecretHash = sha256(sharedSecretPoint)
    if (sharedSecretHash[0] !== stealthAddress.viewTag) return false
    const hashTimesG = secp256k1.getPublicKey(sharedSecretHash, true)
    const expectedPoint = secp256k1.ProjectivePoint.fromHex(spendingPubBytes).add(secp256k1.ProjectivePoint.fromHex(hashTimesG))
    const providedAddress = hexToBytes(stealthAddress.address.slice(2))
    return bytesToHex(expectedPoint.toRawBytes(true)) === bytesToHex(providedAddress)
  } finally {
    secureWipe(viewingPrivBytes)
  }
}
```

Add `isValidCompressedPublicKey` to the imports from `../validation`.

- [ ] **Step 5: Run secp256k1 test → PASS; commit**

```bash
pnpm --filter @sip-protocol/sdk test -- --run tests/crypto/stealth-secp256k1-canonical.test.ts
git add packages/sdk/src/stealth/secp256k1.ts packages/sdk/tests/crypto/stealth-secp256k1-canonical.test.ts packages/sdk/tests/crypto/stealth-ed25519-canonical.test.ts
git commit -m "feat(stealth): secp256k1 canonical EIP-5564 (generate/derive/check) + V1"
```

---

### Task 6: Update unified dispatchers + exports (`stealth/index.ts`)

**Files:** Modify `packages/sdk/src/stealth/index.ts`

- [ ] **Step 1: Update the module header comment (lines 6-11)** to canonical: `S = r * P_view`, `A = P_spend + hash(S)*G`, scan `S = p_view * R`.

- [ ] **Step 2: Change `checkStealthAddress` signature (180-195)** to `(stealthAddress, viewingPrivateKey, spendingPublicKey)`; pass through to `check{Ed25519,Secp256k1}StealthAddress` unchanged-order. Update JSDoc params.

- [ ] **Step 3: Export the V1 functions** in the re-export block (202-211): add `checkEd25519StealthAddressV1`, `deriveEd25519StealthPrivateKeyV1`, and the secp256k1 V1 equivalents.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter @sip-protocol/sdk typecheck`
Expected: errors ONLY in call sites still using the old `checkStealthAddress` signature (fixed in Tasks 7-11).

```bash
git add packages/sdk/src/stealth/index.ts
git commit -m "feat(stealth): canonical view-only checkStealthAddress dispatcher + V1 exports"
```

---

### Task 7: End-to-end Solana scan round-trip (the missing test)

**Files:** Modify `packages/sdk/tests/chains/solana/scan.test.ts`

- [ ] **Step 1: Add a round-trip test that builds a real announcement and scans it**

```typescript
import { generateStealthMetaAddress, generateStealthAddress, ed25519PublicKeyToSolanaAddress } from '../../../src/stealth'
import { createAnnouncementMemo, parseAnnouncement } from '../../../src/chains/solana/types'
import { checkEd25519StealthAddress } from '../../../src/stealth'

it('scan detects a payment produced by the send path (view-only)', () => {
  const { metaAddress, viewingPrivateKey } = generateStealthMetaAddress('solana')
  const { stealthAddress } = generateStealthAddress(metaAddress)
  // Sender publishes: ephemeral + viewTag (canonical SIP:2 announcement)
  const memo = createAnnouncementMemo(
    ed25519PublicKeyToSolanaAddress(stealthAddress.ephemeralPublicKey),
    stealthAddress.viewTag.toString(16).padStart(2, '0'),
    ed25519PublicKeyToSolanaAddress(stealthAddress.address),
  )
  const ann = parseAnnouncement(memo)!
  expect(ann.version).toBe('2')
  // Recipient scans view-only with viewing-priv + spending-PUBLIC
  const detected = checkEd25519StealthAddress(stealthAddress, viewingPrivateKey, metaAddress.spendingKey)
  expect(detected).toBe(true)
})
```

- [ ] **Step 2: Run → it will fail on `ann.version` until Task 8.** That is expected; proceed to Task 8, then re-run.

---

### Task 8: Solana announcement versioning (SIP:2)

**Files:** `packages/sdk/src/chains/solana/constants.ts`, `packages/sdk/src/chains/solana/types.ts`

- [ ] **Step 1: Add v2 prefix constants** in `constants.ts` (keep `SIP_MEMO_PREFIX` as the v1 marker for back-compat):

```typescript
export const SIP_MEMO_PREFIX = 'SIP:1:'        // legacy (read-only back-compat)
export const SIP_MEMO_PREFIX_V2 = 'SIP:2:'
export const SIP_MEMO_PREFIX_ANY = 'SIP:'      // log scan filter
```

- [ ] **Step 2: `createAnnouncementMemo` emits v2; `parseAnnouncement` reads version** (`types.ts:184-239`):

```typescript
export function createAnnouncementMemo(ephemeralPublicKey: string, viewTag: string, stealthAddress?: string): string {
  const parts = ['SIP:2', ephemeralPublicKey, viewTag]
  if (stealthAddress) parts.push(stealthAddress)
  return parts.join(':')
}
// parseAnnouncement: accept SIP:1 or SIP:2, return { version: '1'|'2', ... }
```

Change the guard from `memo.startsWith('SIP:1:')` to match `SIP:1:` or `SIP:2:`, capture the version digit into the returned object, and add `version: string` to the `SolanaAnnouncement` interface.

- [ ] **Step 3: Update log-scan filters** that reference `SIP_MEMO_PREFIX` in `scan.ts:114`, `stealth-scanner.ts:424`, `providers/webhook.ts` to use `SIP_MEMO_PREFIX_ANY`.

- [ ] **Step 4: Run Task 7 test → PASS; commit**

```bash
pnpm --filter @sip-protocol/sdk test -- --run tests/chains/solana/scan.test.ts
git add packages/sdk/src/chains/solana/constants.ts packages/sdk/src/chains/solana/types.ts packages/sdk/src/chains/solana/scan.ts packages/sdk/src/chains/solana/stealth-scanner.ts packages/sdk/src/chains/solana/providers/webhook.ts packages/sdk/tests/chains/solana/scan.test.ts
git commit -m "feat(solana): SIP:2 canonical announcements + version-aware parsing + e2e scan test"
```

---

### Task 9: Version-routed claim (v1 back-compat)

**Files:** `packages/sdk/src/chains/solana/scan.ts` (`claimStealthPayment:253-393`), `packages/sdk/src/stealth/index.ts`

- [ ] **Step 1: Add a version param to the claim/derive path.** `claimStealthPayment` already receives the announcement; thread its `version` through. Add `deriveStealthPrivateKeyV1` to `index.ts` (dispatches to the `*V1` curve fns) and select:

```typescript
const recovery = version === '1'
  ? deriveStealthPrivateKeyV1(stealthAddressObj, spendingPrivateKey, viewingPrivateKey)
  : deriveStealthPrivateKey(stealthAddressObj, spendingPrivateKey, viewingPrivateKey)
```

- [ ] **Step 2: Back-compat test** — `packages/sdk/tests/chains/solana/scan.test.ts`:

```typescript
it('legacy SIP:1 announcement is still claimable via V1 derivation', () => {
  // Build a v1 stealth address with the legacy swapped generator path is gone;
  // assert deriveStealthPrivateKeyV1 recovers a key whose pubkey == a known v1 address fixture.
  // (Use a captured v1 fixture: { address, ephemeralPublicKey, spendingPriv, viewingPriv })
  const r = deriveStealthPrivateKeyV1(V1_FIXTURE.stealth, V1_FIXTURE.spendingPriv, V1_FIXTURE.viewingPriv)
  const pub = ed25519.ExtendedPoint.BASE.multiply(leToBig(hexBytes(r.privateKey)) % ED25519_L).toRawBytes()
  expect('0x' + Buffer.from(pub).toString('hex')).toBe(V1_FIXTURE.stealth.address)
})
```

Generate `V1_FIXTURE` once by checking out the pre-flip `generateEd25519StealthAddress` in a scratch script, or capture from git history of `ed25519.ts` before Task 2. Store as an inline constant.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @sip-protocol/sdk test -- --run tests/chains/solana/scan.test.ts
git add -A && git commit -m "feat(solana): version-routed claim with SIP:1 back-compat (V1 derivation)"
```

---

### Task 10: CLI scan — view-only + version-routed derive

**Files:** `packages/cli/src/commands/scan.ts:93-124`

- [ ] **Step 1: Split check (view-only) from derive.** The CLI holds both keys, so it can scan canonical AND legacy:

```typescript
// canonical view-only check (needs spending PUBLIC key — derive it from the private key)
const spendingPub = curveIsEd25519
  ? `0x${bytesToHex(ed25519.getPublicKey(hexToBytes(options.spendingKey.slice(2))))}`
  : `0x${bytesToHex(secp256k1.getPublicKey(hexToBytes(options.spendingKey.slice(2)), true))}`
let isMine = checkStealthAddress(stealthAddr, options.viewingKey, spendingPub as HexString)
let version: '1' | '2' = '2'
if (!isMine && useEd25519) { isMine = checkEd25519StealthAddressV1(stealthAddr, options.spendingKey, options.viewingKey); if (isMine) version = '1' }
if (isMine) {
  const derived = version === '1'
    ? deriveStealthPrivateKeyV1(stealthAddr, options.spendingKey, options.viewingKey)
    : deriveStealthPrivateKey(stealthAddr, options.spendingKey, options.viewingKey)
  result = { isMine: true, stealthPrivateKey: derived.privateKey }
}
```

Import `checkStealthAddress`, `checkEd25519StealthAddressV1`, `deriveStealthPrivateKeyV1` and the curve libs.

- [ ] **Step 2: Run CLI tests + commit**

```bash
pnpm --filter @sip-protocol/cli test -- --run
git add packages/cli/src/commands/scan.ts && git commit -m "feat(cli): view-only scan + SIP:1 back-compat fallback"
```

---

### Task 11: Sweep remaining `check*` call sites to the new signature

**Files:** all test files calling `check*StealthAddress(addr, spendingPriv, viewingPriv)`

- [ ] **Step 1: List them**

Run: `rg -n "check(Ed25519|Secp256k1)?StealthAddress\(" packages/sdk/tests packages/react/tests | rg -v "V1|canonical"`
Expected list includes: `tests/e2e/cross-chain-stealth.test.ts`, `tests/e2e/privacy-verification.test.ts`, `tests/e2e/solana/receive-flow.e2e.test.ts`, `tests/e2e/solana/multi-party.e2e.test.ts`, `tests/e2e/performance-metrics.test.ts`.

- [ ] **Step 2: For each, change the call** from `check*(addr, X.spendingPrivateKey, X.viewingPrivateKey)` to `check*(addr, X.viewingPrivateKey, X.metaAddress.spendingKey)` (view-only). Where a test asserts an *attacker* cannot detect, pass the attacker's `viewingPrivateKey` + victim's `spendingKey` → expect `false`. Where a test then derives/claims, leave `deriveStealthPrivateKey(addr, spendingPrivateKey, viewingPrivateKey)` unchanged.

- [ ] **Step 3: Run the full SDK suite**

Run: `pnpm --filter @sip-protocol/sdk test -- --run 2>&1 | tail -15`
Expected: green, total ≥ baseline (Task 0) + new tests.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/tests && git commit -m "test(stealth): migrate check call sites to canonical view-only signature"
```

---

### Task 12: React hook detection test

**Files:** `packages/react/tests/hooks/use-scan-payments.test.ts` (create or extend)

- [ ] **Step 1: Test that the hook's scan path detects a canonical payment** (mock the connection to return one `SIP:2` memo announcement built from `generateStealthAddress`; assert `payments.length === 1`). Use the existing hook test harness/mocks in `packages/react/tests`.

- [ ] **Step 2: Run + commit**

```bash
pnpm --filter @sip-protocol/react test -- --run
git add packages/react/tests && git commit -m "test(react): useScanPayments detects canonical stealth payment"
```

---

### Task 13: Full verification + CHANGELOG + version bump

- [ ] **Step 1: Whole-repo typecheck + tests**

Run: `pnpm typecheck && pnpm test -- --run 2>&1 | tail -25`
Expected: all green.

- [ ] **Step 2: CHANGELOG + bump** — `packages/sdk/CHANGELOG.md` (and `package.json`): note the **breaking** `checkStealthAddress` signature (now `(addr, viewingPrivateKey, spendingPublicKey)`, view-only), canonical EIP-5564 scheme, `SIP:2` announcements, `*V1` back-compat. Minor bump 0.9.0 → 0.10.0.

- [ ] **Step 3: Commit + push + PR**

```bash
git add -A && git commit -m "chore(sdk): changelog + 0.10.0 for canonical EIP-5564 stealth scheme"
git push -u origin fix/stealth-eip5564-canonical
gh pr create --repo sip-protocol/sip-protocol --title "fix(stealth): canonical EIP-5564 key roles (closes #1099 core)" --body "Implements the SDK+react+cli portion of the #1099 fix per docs/superpowers/plans/2026-06-07-stealth-eip5564-canonical-fix.md. Flips both curves to canonical EIP-5564, makes view-only scanning work, preserves SIP:1 claim back-compat. Breaking: checkStealthAddress signature."
```

---

## Self-Review

**Spec coverage:** §3 scheme flip → Tasks 2,3,4,5. §5 API change → Tasks 4,5,6,11. §6 versioning/back-compat → Tasks 8,9,10. §7 test strategy → Tasks 1,5,7,9,12. §8 rollout Plan 1 → all tasks (Plans 2/3 = sip-mobile, docs-sip, separate). ✓

**Placeholder scan:** `V1_FIXTURE` (Task 9) is the one item requiring a captured value — generation method specified (checkout pre-flip generator / git history). No "TODO/handle edge cases" left.

**Type consistency:** new `checkStealthAddress(addr, viewingPrivateKey, spendingPublicKey)` used consistently in Tasks 4,5,6,10,11,12; `deriveStealthPrivateKey(addr, spendingPrivateKey, viewingPrivateKey)` unchanged everywhere; `*V1` names consistent across Tasks 3,4,5,9,10.

**Out of scope (sibling plans):** sip-mobile `src/lib/stealth.ts` flip + auditor UI copy (Plan 2); docs-sip #109 revert (Plan 3); EVM `schemeId` verification (low-risk, testnet — fold into Plan 1 follow-up if contracts emit a non-1 id).
