[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolverQuote

# Interface: SolverQuote

Defined in: packages/types/dist/index.d.ts:429

Extended quote with solver-specific details

## Extends

- [`Quote`](Quote.md)

## Properties

### quoteId

> **quoteId**: `string`

Defined in: packages/types/dist/index.d.ts:288

Quote identifier

#### Inherited from

[`Quote`](Quote.md).[`quoteId`](Quote.md#quoteid)

***

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:290

Intent this quote is for

#### Inherited from

[`Quote`](Quote.md).[`intentId`](Quote.md#intentid)

***

### solverId

> **solverId**: `string`

Defined in: packages/types/dist/index.d.ts:292

Solver identifier

#### Inherited from

[`Quote`](Quote.md).[`solverId`](Quote.md#solverid)

***

### outputAmount

> **outputAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:294

Offered output amount

#### Inherited from

[`Quote`](Quote.md).[`outputAmount`](Quote.md#outputamount)

***

### estimatedTime

> **estimatedTime**: `number`

Defined in: packages/types/dist/index.d.ts:296

Estimated execution time (seconds)

#### Inherited from

[`Quote`](Quote.md).[`estimatedTime`](Quote.md#estimatedtime)

***

### expiry

> **expiry**: `number`

Defined in: packages/types/dist/index.d.ts:298

Quote expiry timestamp

#### Inherited from

[`Quote`](Quote.md).[`expiry`](Quote.md#expiry)

***

### fee

> **fee**: `bigint`

Defined in: packages/types/dist/index.d.ts:300

Solver's fee (in output asset)

#### Inherited from

[`Quote`](Quote.md).[`fee`](Quote.md#fee)

***

### signature

> **signature**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:431

Solver's signature on this quote

***

### validUntil

> **validUntil**: `number`

Defined in: packages/types/dist/index.d.ts:433

Quote validity period (Unix timestamp)

***

### estimatedGas?

> `optional` **estimatedGas**: `bigint`

Defined in: packages/types/dist/index.d.ts:435

Gas estimation for fulfillment

***

### route?

> `optional` **route**: [`SwapRoute`](SwapRoute.md)

Defined in: packages/types/dist/index.d.ts:437

Route/path for the swap (if applicable)
