[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / PaymentStatus

# Variable: PaymentStatus

> `const` **PaymentStatus**: `object`

Defined in: packages/types/dist/index.d.ts:1411

Payment status

## Type Declaration

### DRAFT

> `readonly` **DRAFT**: `"draft"`

Payment created but not submitted

### PENDING

> `readonly` **PENDING**: `"pending"`

Payment submitted, awaiting confirmation

### CONFIRMED

> `readonly` **CONFIRMED**: `"confirmed"`

Payment confirmed on source chain

### SETTLED

> `readonly` **SETTLED**: `"settled"`

Payment settled on destination chain

### FAILED

> `readonly` **FAILED**: `"failed"`

Payment failed

### EXPIRED

> `readonly` **EXPIRED**: `"expired"`

Payment expired

### CANCELLED

> `readonly` **CANCELLED**: `"cancelled"`

Payment cancelled
