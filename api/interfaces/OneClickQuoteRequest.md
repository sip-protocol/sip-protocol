[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickQuoteRequest

# Interface: OneClickQuoteRequest

Defined in: packages/types/dist/index.d.ts:701

Quote request parameters for POST /v0/quote

## Properties

### dry?

> `optional` **dry**: `boolean`

Defined in: packages/types/dist/index.d.ts:703

Preview only, no deposit address generated

***

### swapType

> **swapType**: [`OneClickSwapType`](../enumerations/OneClickSwapType.md)

Defined in: packages/types/dist/index.d.ts:705

How to calculate the swap

***

### slippageTolerance?

> `optional` **slippageTolerance**: `number`

Defined in: packages/types/dist/index.d.ts:707

Slippage tolerance in basis points (100 = 1%)

***

### originAsset

> **originAsset**: `string`

Defined in: packages/types/dist/index.d.ts:709

Source asset identifier

***

### destinationAsset

> **destinationAsset**: `string`

Defined in: packages/types/dist/index.d.ts:711

Destination asset identifier

***

### amount

> **amount**: `string`

Defined in: packages/types/dist/index.d.ts:713

Amount in smallest units (input or output depending on swapType)

***

### refundTo

> **refundTo**: `string`

Defined in: packages/types/dist/index.d.ts:715

Address for refunds on failed swaps

***

### recipient

> **recipient**: `string`

Defined in: packages/types/dist/index.d.ts:717

Destination address for output tokens

***

### depositType

> **depositType**: `string`

Defined in: packages/types/dist/index.d.ts:719

Source chain identifier

***

### refundType

> **refundType**: `string`

Defined in: packages/types/dist/index.d.ts:721

Refund chain identifier

***

### recipientType

> **recipientType**: `string`

Defined in: packages/types/dist/index.d.ts:723

Destination chain identifier

***

### deadline?

> `optional` **deadline**: `string`

Defined in: packages/types/dist/index.d.ts:725

ISO timestamp for automatic refund trigger

***

### depositMode?

> `optional` **depositMode**: [`OneClickDepositMode`](../enumerations/OneClickDepositMode.md)

Defined in: packages/types/dist/index.d.ts:727

Deposit mode

***

### appFees?

> `optional` **appFees**: `OneClickAppFee`[]

Defined in: packages/types/dist/index.d.ts:729

Optional app-level fees
