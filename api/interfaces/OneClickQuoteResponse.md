[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickQuoteResponse

# Interface: OneClickQuoteResponse

Defined in: packages/types/dist/index.d.ts:764

Quote response from POST /v0/quote

## Properties

### quoteId

> **quoteId**: `string`

Defined in: packages/types/dist/index.d.ts:766

Unique quote identifier

***

### depositAddress

> **depositAddress**: `string`

Defined in: packages/types/dist/index.d.ts:768

Address to deposit input tokens

***

### amountIn

> **amountIn**: `string`

Defined in: packages/types/dist/index.d.ts:770

Required input amount in smallest units

***

### amountInFormatted

> **amountInFormatted**: `string`

Defined in: packages/types/dist/index.d.ts:772

Human-readable input amount

***

### amountOut

> **amountOut**: `string`

Defined in: packages/types/dist/index.d.ts:774

Expected output amount in smallest units

***

### amountOutFormatted

> **amountOutFormatted**: `string`

Defined in: packages/types/dist/index.d.ts:776

Human-readable output amount

***

### amountOutUsd?

> `optional` **amountOutUsd**: `string`

Defined in: packages/types/dist/index.d.ts:778

Estimated USD value (display only)

***

### deadline

> **deadline**: `string`

Defined in: packages/types/dist/index.d.ts:780

Quote expiration timestamp

***

### timeEstimate

> **timeEstimate**: `number`

Defined in: packages/types/dist/index.d.ts:782

Estimated completion time in seconds

***

### signature

> **signature**: `string`

Defined in: packages/types/dist/index.d.ts:784

Quote signature

***

### request?

> `optional` **request**: [`OneClickQuoteRequest`](OneClickQuoteRequest.md)

Defined in: packages/types/dist/index.d.ts:786

Original request echo
