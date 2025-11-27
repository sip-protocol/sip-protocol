[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FulfillmentProof

# Interface: FulfillmentProof

Defined in: packages/types/dist/index.d.ts:562

Fulfillment proof for verification

## Properties

### intentId

> **intentId**: `string`

Defined in: packages/types/dist/index.d.ts:564

Intent that was fulfilled

***

### quoteId

> **quoteId**: `string`

Defined in: packages/types/dist/index.d.ts:566

Quote that was used

***

### outputAmount

> **outputAmount**: `bigint`

Defined in: packages/types/dist/index.d.ts:568

Actual output amount delivered

***

### txHash

> **txHash**: `string`

Defined in: packages/types/dist/index.d.ts:570

Destination transaction hash

***

### blockNumber

> **blockNumber**: `number`

Defined in: packages/types/dist/index.d.ts:572

Block number of fulfillment

***

### proof

> **proof**: [`ZKProof`](ZKProof.md)

Defined in: packages/types/dist/index.d.ts:574

ZK proof of correct fulfillment

***

### timestamp

> **timestamp**: `number`

Defined in: packages/types/dist/index.d.ts:576

Timestamp of fulfillment
