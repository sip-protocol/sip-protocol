[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FulfillmentStatus

# Interface: FulfillmentStatus

Defined in: packages/types/dist/index.d.ts:521

Fulfillment status

## Properties

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:523

Intent ID

***

### status

> **status**: `"executing"` \| `"pending"` \| `"completed"` \| `"failed"` \| `"cancelled"`

Defined in: packages/types/dist/index.d.ts:525

Current status

***

### txHash?

> `optional` **txHash**: `string`

Defined in: packages/types/dist/index.d.ts:527

Transaction hash (if submitted)

***

### estimatedCompletion?

> `optional` **estimatedCompletion**: `number`

Defined in: packages/types/dist/index.d.ts:529

Estimated completion time

***

### error?

> `optional` **error**: `string`

Defined in: packages/types/dist/index.d.ts:531

Error message (if failed)
