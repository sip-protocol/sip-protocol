[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / IntentStatus

# Enumeration: IntentStatus

Defined in: packages/types/dist/index.d.ts:267

Intent status

## Enumeration Members

### PENDING

> **PENDING**: `"pending"`

Defined in: packages/types/dist/index.d.ts:269

Intent created, awaiting quotes

***

### QUOTED

> **QUOTED**: `"quoted"`

Defined in: packages/types/dist/index.d.ts:271

Quotes received, awaiting user selection

***

### EXECUTING

> **EXECUTING**: `"executing"`

Defined in: packages/types/dist/index.d.ts:273

User accepted a quote, execution in progress

***

### FULFILLED

> **FULFILLED**: `"fulfilled"`

Defined in: packages/types/dist/index.d.ts:275

Intent successfully fulfilled

***

### EXPIRED

> **EXPIRED**: `"expired"`

Defined in: packages/types/dist/index.d.ts:277

Intent expired without fulfillment

***

### CANCELLED

> **CANCELLED**: `"cancelled"`

Defined in: packages/types/dist/index.d.ts:279

Intent cancelled by user

***

### FAILED

> **FAILED**: `"failed"`

Defined in: packages/types/dist/index.d.ts:281

Intent failed during execution
