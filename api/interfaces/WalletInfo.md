[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / WalletInfo

# Interface: WalletInfo

Defined in: packages/types/dist/index.d.ts:1751

Wallet metadata for discovery/display

## Properties

### id

> **id**: `string`

Defined in: packages/types/dist/index.d.ts:1753

Wallet identifier

***

### name

> **name**: `string`

Defined in: packages/types/dist/index.d.ts:1755

Display name

***

### icon?

> `optional` **icon**: `string`

Defined in: packages/types/dist/index.d.ts:1757

Icon URL

***

### chains

> **chains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:1759

Supported chains

***

### url?

> `optional` **url**: `string`

Defined in: packages/types/dist/index.d.ts:1761

Download/install URL

***

### supportsPrivacy

> **supportsPrivacy**: `boolean`

Defined in: packages/types/dist/index.d.ts:1763

Whether wallet supports privacy features
