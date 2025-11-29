[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SwapRequest

# Interface: SwapRequest

Defined in: [packages/sdk/src/adapters/near-intents.ts:31](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L31)

Swap request parameters (simplified interface for adapter)

## Properties

### requestId

> **requestId**: `string`

Defined in: [packages/sdk/src/adapters/near-intents.ts:33](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L33)

Unique request ID

***

### privacyLevel

> **privacyLevel**: [`PrivacyLevel`](../enumerations/PrivacyLevel.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:35](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L35)

Privacy level for the swap

***

### inputAsset

> **inputAsset**: [`Asset`](Asset.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:37](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L37)

Input asset

***

### inputAmount

> **inputAmount**: `bigint`

Defined in: [packages/sdk/src/adapters/near-intents.ts:39](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L39)

Input amount in smallest units

***

### outputAsset

> **outputAsset**: [`Asset`](Asset.md)

Defined in: [packages/sdk/src/adapters/near-intents.ts:41](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L41)

Output asset

***

### minOutputAmount?

> `optional` **minOutputAmount**: `bigint`

Defined in: [packages/sdk/src/adapters/near-intents.ts:43](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/adapters/near-intents.ts#L43)

Minimum output amount
