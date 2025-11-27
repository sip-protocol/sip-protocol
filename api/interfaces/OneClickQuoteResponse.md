[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickQuoteResponse

# Interface: OneClickQuoteResponse

Defined in: packages/types/dist/index.d.ts:734

Quote response from POST /v0/quote

## Properties

### quoteId

> **quoteId**: `string`

Defined in: packages/types/dist/index.d.ts:736

Unique quote identifier

***

### depositAddress

> **depositAddress**: `string`

Defined in: packages/types/dist/index.d.ts:738

Address to deposit input tokens

***

### amountIn

> **amountIn**: `string`

Defined in: packages/types/dist/index.d.ts:740

Required input amount in smallest units

***

### amountInFormatted

> **amountInFormatted**: `string`

Defined in: packages/types/dist/index.d.ts:742

Human-readable input amount

***

### amountOut

> **amountOut**: `string`

Defined in: packages/types/dist/index.d.ts:744

Expected output amount in smallest units

***

### amountOutFormatted

> **amountOutFormatted**: `string`

Defined in: packages/types/dist/index.d.ts:746

Human-readable output amount

***

### amountOutUsd?

> `optional` **amountOutUsd**: `string`

Defined in: packages/types/dist/index.d.ts:748

Estimated USD value (display only)

***

### deadline

> **deadline**: `string`

Defined in: packages/types/dist/index.d.ts:750

Quote expiration timestamp

***

### timeEstimate

> **timeEstimate**: `number`

Defined in: packages/types/dist/index.d.ts:752

Estimated completion time in seconds

***

### signature

> **signature**: `string`

Defined in: packages/types/dist/index.d.ts:754

Quote signature

***

### request?

> `optional` **request**: [`OneClickQuoteRequest`](OneClickQuoteRequest.md)

Defined in: packages/types/dist/index.d.ts:756

Original request echo
