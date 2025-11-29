[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickSwapStatus

# Enumeration: OneClickSwapStatus

Defined in: packages/types/dist/index.d.ts:686

Status of a swap in the 1Click system

## Enumeration Members

### PENDING\_DEPOSIT

> **PENDING\_DEPOSIT**: `"PENDING_DEPOSIT"`

Defined in: packages/types/dist/index.d.ts:688

Awaiting user deposit

***

### PROCESSING

> **PROCESSING**: `"PROCESSING"`

Defined in: packages/types/dist/index.d.ts:690

Deposit detected, execution in progress

***

### SUCCESS

> **SUCCESS**: `"SUCCESS"`

Defined in: packages/types/dist/index.d.ts:692

Successfully delivered to destination

***

### INCOMPLETE\_DEPOSIT

> **INCOMPLETE\_DEPOSIT**: `"INCOMPLETE_DEPOSIT"`

Defined in: packages/types/dist/index.d.ts:694

Deposit below minimum threshold

***

### REFUNDED

> **REFUNDED**: `"REFUNDED"`

Defined in: packages/types/dist/index.d.ts:696

Funds returned automatically

***

### FAILED

> **FAILED**: `"FAILED"`

Defined in: packages/types/dist/index.d.ts:698

Execution error occurred
