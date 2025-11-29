[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickStatusResponse

# Interface: OneClickStatusResponse

Defined in: packages/types/dist/index.d.ts:804

Status response from GET /v0/status

## Properties

### status

> **status**: [`OneClickSwapStatus`](../enumerations/OneClickSwapStatus.md)

Defined in: packages/types/dist/index.d.ts:806

Current swap status

***

### depositTxHash?

> `optional` **depositTxHash**: `string`

Defined in: packages/types/dist/index.d.ts:808

Deposit transaction hash

***

### settlementTxHash?

> `optional` **settlementTxHash**: `string`

Defined in: packages/types/dist/index.d.ts:810

Settlement transaction hash

***

### amountIn?

> `optional` **amountIn**: `string`

Defined in: packages/types/dist/index.d.ts:812

Actual input amount

***

### amountOut?

> `optional` **amountOut**: `string`

Defined in: packages/types/dist/index.d.ts:814

Actual output amount

***

### error?

> `optional` **error**: `string`

Defined in: packages/types/dist/index.d.ts:816

Error message if failed
