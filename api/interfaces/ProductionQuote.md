[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ProductionQuote

# Interface: ProductionQuote

Defined in: [packages/sdk/src/sip.ts:104](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L104)

Extended quote with deposit info for production mode

## Extends

- [`Quote`](Quote.md)

## Properties

### depositAddress?

> `optional` **depositAddress**: `string`

Defined in: [packages/sdk/src/sip.ts:106](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L106)

Deposit address for input tokens (production mode only)

***

### rawQuote?

> `optional` **rawQuote**: [`OneClickQuoteResponse`](OneClickQuoteResponse.md)

Defined in: [packages/sdk/src/sip.ts:108](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/sip.ts#L108)

Raw 1Click quote response (production mode only)

***

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
