[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PrivacyLevel

# Enumeration: PrivacyLevel

Defined in: packages/types/dist/index.d.ts:8

Privacy level for SIP transactions

- transparent: Standard intent with no privacy (equivalent to current NEAR Intents)
- shielded: Full privacy via Zcash shielded pool
- compliant: Shielded mode with viewing key for selective disclosure

## Enumeration Members

### TRANSPARENT

> **TRANSPARENT**: `"transparent"`

Defined in: packages/types/dist/index.d.ts:10

Standard public transaction - no privacy guarantees

***

### SHIELDED

> **SHIELDED**: `"shielded"`

Defined in: packages/types/dist/index.d.ts:12

Full privacy via Zcash shielded pool

***

### COMPLIANT

> **COMPLIANT**: `"compliant"`

Defined in: packages/types/dist/index.d.ts:14

Privacy with viewing key for compliance/audit
