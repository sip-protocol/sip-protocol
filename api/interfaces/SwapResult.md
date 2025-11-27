[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SwapResult

# Interface: SwapResult

Defined in: [packages/sdk/src/adapters/near-intents.ts:65](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L65)

Result of executing a swap

## Properties

### requestId

> **requestId**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:67](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L67)

Request ID

***

### quoteId

> **quoteId**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:69](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L69)

1Click quote ID

***

### depositAddress

> **depositAddress**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:71](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L71)

Deposit address for input tokens

***

### amountIn

> **amountIn**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:73](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L73)

Expected input amount

***

### amountOut

> **amountOut**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:75](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L75)

Expected output amount

***

### status

> **status**: [`OneClickSwapStatus`](../enumerations/OneClickSwapStatus.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:77](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L77)

Current status

***

### depositTxHash?

> `optional` **depositTxHash**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:79](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L79)

Deposit transaction hash (after deposit)

***

### settlementTxHash?

> `optional` **settlementTxHash**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:81](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L81)

Settlement transaction hash (after success)

***

### stealthRecipient?

> `optional` **stealthRecipient**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:83](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L83)

Stealth address for recipient (if privacy mode)

***

### ephemeralPublicKey?

> `optional` **ephemeralPublicKey**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:85](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L85)

Ephemeral public key (for recipient to derive stealth key)
