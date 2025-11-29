[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / OneClickQuoteRequest

# Interface: OneClickQuoteRequest

Defined in: packages/types/dist/index.d.ts:731

Quote request parameters for POST /v0/quote

## Properties

### dry?

> `optional` **dry**: `boolean`

Defined in: packages/types/dist/index.d.ts:733

Preview only, no deposit address generated

***

### swapType

> **swapType**: [`OneClickSwapType`](../enumerations/OneClickSwapType.md)

Defined in: packages/types/dist/index.d.ts:735

How to calculate the swap

***

### slippageTolerance

> **slippageTolerance**: `number`

Defined in: packages/types/dist/index.d.ts:737

Slippage tolerance in basis points (100 = 1%), required

***

### originAsset

> **originAsset**: `string`

Defined in: packages/types/dist/index.d.ts:739

Source asset identifier (NEP-141 format)

***

### destinationAsset

> **destinationAsset**: `string`

Defined in: packages/types/dist/index.d.ts:741

Destination asset identifier (NEP-141 format)

***

### amount

> **amount**: `string`

Defined in: packages/types/dist/index.d.ts:743

Amount in smallest units (input or output depending on swapType)

***

### refundTo

> **refundTo**: `string`

Defined in: packages/types/dist/index.d.ts:745

Address for refunds on failed swaps (format must match refundType)

***

### recipient

> **recipient**: `string`

Defined in: packages/types/dist/index.d.ts:747

Destination address for output tokens (format must match recipientType)

***

### depositType

> **depositType**: `string`

Defined in: packages/types/dist/index.d.ts:749

Where user deposits tokens

***

### refundType

> **refundType**: `string`

Defined in: packages/types/dist/index.d.ts:751

Where refunds go on failure

***

### recipientType

> **recipientType**: `string`

Defined in: packages/types/dist/index.d.ts:753

Where output tokens are sent

***

### deadline

> **deadline**: `string`

Defined in: packages/types/dist/index.d.ts:755

ISO 8601 timestamp for automatic refund trigger (required)

***

### depositMode?

> `optional` **depositMode**: [`OneClickDepositMode`](../enumerations/OneClickDepositMode.md)

Defined in: packages/types/dist/index.d.ts:757

Deposit mode

***

### appFees?

> `optional` **appFees**: `OneClickAppFee`[]

Defined in: packages/types/dist/index.d.ts:759

Optional app-level fees
