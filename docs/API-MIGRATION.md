# API Migration Guide

> Guide for migrating from deprecated APIs to their replacements

This guide helps you migrate code that uses deprecated methods before they are removed in v0.2.0.

---

## Overview

| Deprecated Method | Replacement | Status | Removal Version |
|-------------------|-------------|--------|-----------------|
| `createCommitment()` | `commit()` | ⚠️ Deprecated | v0.2.0 |
| `verifyCommitment()` | `verifyOpening()` | ⚠️ Deprecated | v0.2.0 |
| `generateShieldedAddress()` | `createAccount()` + `getAddressForAccount()` | ⚠️ Deprecated | v0.2.0 |

---

## Migration Instructions

### 1. Pedersen Commitments

#### `createCommitment()` → `commit()`

**Old API (Deprecated):**
```typescript
import { createCommitment } from '@sip-protocol/sdk'

const commitment = createCommitment(1000n)
// Returns: { value: HexString, blindingFactor: HexString }
```

**New API:**
```typescript
import { commit } from '@sip-protocol/sdk/commitment'

const { commitment, blinding } = commit(1000n)
// Returns: { commitment: HexString, blinding: HexString }
```

**Key Differences:**
- Property names changed: `value` → `commitment`, `blindingFactor` → `blinding`
- Import path changed: `@sip-protocol/sdk` → `@sip-protocol/sdk/commitment`

**Migration Steps:**
1. Update import statement to use `/commitment` subpath
2. Rename destructured properties in your code
3. Update any references to `commitment.value` → `commitment`
4. Update any references to `commitment.blindingFactor` → `blinding`

---

#### `verifyCommitment()` → `verifyOpening()`

**Old API (Deprecated):**
```typescript
import { verifyCommitment } from '@sip-protocol/sdk'

const isValid = verifyCommitment(commitment, 1000n)
// commitment is { value: HexString, blindingFactor: HexString }
```

**New API:**
```typescript
import { verifyOpening } from '@sip-protocol/sdk/commitment'

const isValid = verifyOpening(commitment, 1000n, blinding)
// commitment is HexString, blinding is HexString
```

**Key Differences:**
- Separate parameters instead of object: `(commitment, value, blinding)`
- Import path changed: `@sip-protocol/sdk` → `@sip-protocol/sdk/commitment`
- First parameter is now the commitment value directly, not an object

**Migration Steps:**
1. Update import statement to use `/commitment` subpath
2. Change function call from object parameter to three separate parameters
3. Pass `commitment.value`, `expectedValue`, and `commitment.blindingFactor` separately

**Example:**
```typescript
// Before
import { verifyCommitment } from '@sip-protocol/sdk'
const isValid = verifyCommitment(commitmentObj, 1000n)

// After
import { verifyOpening } from '@sip-protocol/sdk/commitment'
const isValid = verifyOpening(
  commitmentObj.value,
  1000n,
  commitmentObj.blindingFactor
)
```

---

### 2. Zcash Shielded Addresses

#### `generateShieldedAddress()` → `createAccount()` + `getAddressForAccount()`

**Old API (Deprecated):**
```typescript
import { ZcashRPCClient } from '@sip-protocol/sdk'

const client = new ZcashRPCClient(config)
const address = await client.generateShieldedAddress('sapling')
// Returns: string (z-address)
```

**New API:**
```typescript
import { ZcashRPCClient } from '@sip-protocol/sdk'

const client = new ZcashRPCClient(config)

// Step 1: Create a new HD account
const { account } = await client.createAccount()

// Step 2: Get address for the account
const { address } = await client.getAddressForAccount(account)
// Returns: { address: string, account: number }
```

**Why This Changed:**
- Modern Zcash uses HD accounts (hierarchical deterministic wallets)
- Provides better key management and organization
- Supports multiple addresses per account
- Unified addresses require account-based approach

**Migration Steps:**
1. Replace `generateShieldedAddress()` calls with two-step process
2. Store the account number if you need to generate more addresses later
3. Optional: Specify receiver types for unified addresses

**Advanced Usage:**
```typescript
// Generate unified address with specific receiver types
const { address } = await client.getAddressForAccount(
  account,
  ['sapling', 'p2pkh'], // Receiver types
  0 // Diversifier index (optional)
)
```

**Example Migration:**
```typescript
// Before
const address1 = await client.generateShieldedAddress('sapling')
const address2 = await client.generateShieldedAddress('sapling')

// After
const { account: account1 } = await client.createAccount()
const { address: address1 } = await client.getAddressForAccount(account1)

const { account: account2 } = await client.createAccount()
const { address: address2 } = await client.getAddressForAccount(account2)

// Or reuse same account for multiple addresses
const { account } = await client.createAccount()
const { address: addr1 } = await client.getAddressForAccount(account, undefined, 0)
const { address: addr2 } = await client.getAddressForAccount(account, undefined, 1)
```

---

## Testing Your Migration

After migrating, ensure your code still works correctly:

```bash
# Run full test suite
pnpm test -- --run

# Run specific tests
pnpm test -- tests/integration --run

# Type check
pnpm typecheck
```

---

## Deprecation Timeline

### v0.1.x (Current)
- ✅ Deprecated methods work with console warnings
- ✅ New methods available
- ✅ Both APIs supported

### v0.2.0 (Planned)
- ❌ Deprecated methods removed
- ✅ Only new APIs supported
- 🔴 **Breaking change**

**Action Required:** Migrate before upgrading to v0.2.0

---

## Need Help?

- **Documentation:** https://docs.sip-protocol.org
- **Issues:** https://github.com/sip-protocol/sip-protocol/issues
- **Discussions:** https://github.com/sip-protocol/sip-protocol/discussions

If you encounter issues during migration, please open an issue with:
1. The deprecated method you're migrating from
2. Your current code snippet
3. Any error messages you're seeing

---

## Related Documentation

- [CHANGELOG.md](../CHANGELOG.md) - All changes including deprecations
- [SIP Specification](specs/SIP-SPEC.md) - Protocol specification
- [Zcash Integration Guide](specs/ZCASH-PROVING-EVALUATION.md) - Zcash details

---

*Last Updated: November 27, 2025*
