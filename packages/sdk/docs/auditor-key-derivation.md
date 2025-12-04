# Auditor Key Derivation

## Overview

The Auditor Key Derivation system provides standardized BIP-44 style hierarchical key derivation for different auditor types in the SIP Protocol. This enables secure and isolated viewing keys for regulatory auditors, internal auditors, and tax authorities.

## Derivation Path Format

```
m/44'/COIN_TYPE'/account'/auditor_type
```

Where:
- `44'` = BIP-44 standard (hardened)
- `COIN_TYPE'` = 1234 (SIP Protocol coin type, hardened)
- `account'` = Account index (default: 0, hardened)
- `auditor_type` = Auditor type index (non-hardened)

## Auditor Types

| Type | Index | Description |
|------|-------|-------------|
| `PRIMARY` | 0 | Primary viewing key for organization |
| `REGULATORY` | 1 | Regulatory auditor key (SEC, FINRA, etc.) |
| `INTERNAL` | 2 | Internal audit key (company auditors) |
| `TAX` | 3 | Tax authority key (IRS, local tax agencies) |

## Usage

### Basic Usage

```typescript
import { AuditorKeyDerivation, AuditorType } from '@sip-protocol/sdk'
import { randomBytes } from '@noble/hashes/utils'

// Generate master seed (32 bytes)
const masterSeed = randomBytes(32)

// Derive regulatory auditor key
const regulatoryKey = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.REGULATORY,
})

console.log(regulatoryKey.path) // "m/44'/1234'/0'/1"
console.log(regulatoryKey.viewingKey.key) // "0x..."
console.log(regulatoryKey.auditorType) // AuditorType.REGULATORY
```

### Multiple Account Support

```typescript
// Derive keys for different accounts (multi-tenant)
const account0Key = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.PRIMARY,
  account: 0,
})

const account1Key = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.PRIMARY,
  account: 1,
})

// Different accounts produce different keys
console.log(account0Key.path) // "m/44'/1234'/0'/0"
console.log(account1Key.path) // "m/44'/1234'/1'/0"
```

### Batch Derivation

```typescript
// Efficiently derive multiple keys at once
const keys = AuditorKeyDerivation.deriveMultiple({
  masterSeed,
  auditorTypes: [
    AuditorType.PRIMARY,
    AuditorType.REGULATORY,
    AuditorType.INTERNAL,
    AuditorType.TAX,
  ],
})

// keys[0] -> PRIMARY key (m/44'/1234'/0'/0)
// keys[1] -> REGULATORY key (m/44'/1234'/0'/1)
// keys[2] -> INTERNAL key (m/44'/1234'/0'/2)
// keys[3] -> TAX key (m/44'/1234'/0'/3)
```

### Path Generation

```typescript
// Generate path string without deriving the key
const path = AuditorKeyDerivation.derivePath(
  AuditorType.REGULATORY,
  5 // account
)

console.log(path) // "m/44'/1234'/5'/1"
```

### Auditor Type Names

```typescript
// Get human-readable names
const name = AuditorKeyDerivation.getAuditorTypeName(AuditorType.REGULATORY)
console.log(name) // "Regulatory"
```

## Integration with ComplianceManager

```typescript
import {
  ComplianceManager,
  AuditorKeyDerivation,
  AuditorType,
} from '@sip-protocol/sdk'
import { randomBytes } from '@noble/hashes/utils'

// Create compliance manager
const compliance = await ComplianceManager.create({
  organizationName: 'Acme Corp',
})

// Derive auditor-specific viewing key
const masterSeed = randomBytes(32)
const auditorKey = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.REGULATORY,
})

// Register auditor with derived key
const auditor = await compliance.registerAuditor(
  {
    organization: 'SEC',
    contactName: 'John Regulator',
    contactEmail: 'john@sec.gov',
    publicKey: auditorKey.viewingKey.key,
    scope: {
      transactionTypes: ['all'],
      chains: ['ethereum'],
      tokens: [],
    },
  },
  'admin@acme.com'
)
```

## Security Properties

### Cryptographic Isolation

Keys derived for different auditor types are cryptographically isolated:

```typescript
const primary = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.PRIMARY,
})

const regulatory = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.REGULATORY,
})

// Keys are completely different and uncorrelated
console.assert(primary.viewingKey.key !== regulatory.viewingKey.key)
```

### Hardened Derivation

The system uses hardened derivation for:
- Purpose (44')
- Coin type (1234')
- Account index

This prevents parent key recovery from child keys.

### Deterministic Derivation

Given the same seed and parameters, the same key is always derived:

```typescript
const key1 = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.REGULATORY,
})

const key2 = AuditorKeyDerivation.deriveViewingKey({
  masterSeed,
  auditorType: AuditorType.REGULATORY,
})

// Keys are identical
console.assert(key1.viewingKey.key === key2.viewingKey.key)
```

## Multi-Tenant Setup

For organizations managing multiple tenants:

```typescript
const masterSeed = randomBytes(32)

// Tenant 0
const tenant0Keys = AuditorKeyDerivation.deriveMultiple({
  masterSeed,
  auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
  account: 0,
})

// Tenant 1
const tenant1Keys = AuditorKeyDerivation.deriveMultiple({
  masterSeed,
  auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
  account: 1,
})

// Tenant 2
const tenant2Keys = AuditorKeyDerivation.deriveMultiple({
  masterSeed,
  auditorTypes: [AuditorType.PRIMARY, AuditorType.REGULATORY],
  account: 2,
})

// All keys are unique and isolated per tenant
```

## Best Practices

### Master Seed Storage

Store the master seed securely:
- Use hardware security modules (HSM) for production
- Encrypt at rest
- Never log or expose in error messages
- Implement key rotation policies

### Account Management

- Use account 0 for the primary organization
- Use accounts 1+ for subsidiaries or tenants
- Document account assignments
- Implement access control per account

### Key Distribution

When sharing derived keys with auditors:
- Use secure channels (encrypted email, secure portals)
- Verify recipient identity
- Log all key distributions
- Implement key expiration where appropriate

### Compliance

- Maintain audit logs of key derivations
- Document which auditor types have access
- Implement periodic key rotation
- Follow industry standards (SOC 2, ISO 27001)

## Error Handling

```typescript
try {
  const key = AuditorKeyDerivation.deriveViewingKey({
    masterSeed: shortSeed, // Only 16 bytes
    auditorType: AuditorType.PRIMARY,
  })
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid parameters:', error.message)
    // "master seed must be at least 32 bytes"
  }
}
```

Common validation errors:
- Master seed too short (< 32 bytes)
- Invalid auditor type
- Invalid account index (negative or >= 2^31)

## Technical Details

### BIP-32 Derivation

The implementation uses HMAC-SHA512 for key derivation, following BIP-32 standards:

1. Master key and chain code derived from seed
2. Each level derived using HMAC-SHA512(chainCode, data)
3. Hardened indices use `index | 0x80000000`
4. Child key = first 32 bytes of HMAC output
5. Child chain code = last 32 bytes of HMAC output

### Memory Security

All sensitive data is securely wiped after use:
- Key bytes zeroed after conversion to hex
- Intermediate derivation values cleared
- Chain codes wiped in finally blocks

## References

- [BIP-32: Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP-44: Multi-Account Hierarchy](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [SLIP-44: Registered Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
