[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FulfillmentResult

# Interface: FulfillmentResult

Defined in: packages/types/dist/index.d.ts:305

Result of intent fulfillment

## Properties

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:307

Intent that was fulfilled

***

### status

> **status**: [`FULFILLED`](../enumerations/IntentStatus.md#fulfilled) \| [`FAILED`](../enumerations/IntentStatus.md#failed)

Defined in: packages/types/dist/index.d.ts:309

Final status

***

### outputAmount?

> `optional` **outputAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:311

Actual output amount received

***

### txHash?

> `optional` **txHash**: `string`

Defined in: packages/types/dist/index.d.ts:313

Transaction hash (only for transparent mode)

***

### fulfillmentProof?

> `optional` **fulfillmentProof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:315

ZK proof of fulfillment (for shielded modes)

***

### fulfilledAt

> **fulfilledAt**: `number`

Defined in: packages/types/dist/index.d.ts:317

Timestamp of fulfillment

***

### error?

> `optional` **error**: `string`

Defined in: packages/types/dist/index.d.ts:319

Error message (if failed)
