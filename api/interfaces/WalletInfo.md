[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletInfo

# Interface: WalletInfo

Defined in: packages/types/dist/index.d.ts:2581

Wallet metadata for discovery/display

## Properties

### id

> **id**: `string`

Defined in: packages/types/dist/index.d.ts:2583

Wallet identifier

***

### name

> **name**: `string`

Defined in: packages/types/dist/index.d.ts:2585

Display name

***

### icon?

> `optional` **icon**: `string`

Defined in: packages/types/dist/index.d.ts:2587

Icon URL

***

### chains

> **chains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:2589

Supported chains

***

### url?

> `optional` **url**: `string`

Defined in: packages/types/dist/index.d.ts:2591

Download/install URL

***

### supportsPrivacy

> **supportsPrivacy**: `boolean`

Defined in: packages/types/dist/index.d.ts:2593

Whether wallet supports privacy features
