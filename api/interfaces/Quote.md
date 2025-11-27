[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / Quote

# Interface: Quote

Defined in: packages/types/dist/index.d.ts:286

Quote from a solver

## Extended by

- [`SolverQuote`](SolverQuote.md)

## Properties

### quoteId

> **quoteId**: `string`

Defined in: packages/types/dist/index.d.ts:288

Quote identifier

***

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:290

Intent this quote is for

***

### solverId

> **solverId**: `string`

Defined in: packages/types/dist/index.d.ts:292

Solver identifier

***

### outputAmount

> **outputAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:294

Offered output amount

***

### estimatedTime

> **estimatedTime**: `number`

Defined in: packages/types/dist/index.d.ts:296

Estimated execution time (seconds)

***

### expiry

> **expiry**: `number`

Defined in: packages/types/dist/index.d.ts:298

Quote expiry timestamp

***

### fee

> **fee**: `bigint`

Defined in: packages/types/dist/index.d.ts:300

Solver's fee (in output asset)
