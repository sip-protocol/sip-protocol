[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SwapRequest

# Interface: SwapRequest

Defined in: [packages/sdk/src/adapters/near-intents.ts:29](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L29)

Swap request parameters (simplified interface for adapter)

## Properties

### requestId

> **requestId**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:31](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L31)

Unique request ID

***

### privacyLevel

> **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:33](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L33)

Privacy level for the swap

***

### inputAsset

> **inputAsset**: [`Asset`](Asset.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:35](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L35)

Input asset

***

### inputAmount

> **inputAmount**: `bigint`

Defined in: [packages/sdk/src/adapters/near-intents.ts:37](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L37)

Input amount in smallest units

***

### outputAsset

> **outputAsset**: [`Asset`](Asset.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:39](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L39)

Output asset

***

### minOutputAmount?

> `optional` **minOutputAmount**: `bigint`

Defined in: [packages/sdk/src/adapters/near-intents.ts:41](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/adapters/near-intents.ts#L41)

Minimum output amount
