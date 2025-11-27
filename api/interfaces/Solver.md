[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / Solver

# Interface: Solver

Defined in: packages/types/dist/index.d.ts:345

Solver information and metadata

## Properties

### id

> **id**: `string`

Defined in: packages/types/dist/index.d.ts:347

Unique solver identifier

***

### name

> **name**: `string`

Defined in: packages/types/dist/index.d.ts:349

Human-readable name

***

### supportedChains

> **supportedChains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:351

Supported chains

***

### reputation

> **reputation**: `number`

Defined in: packages/types/dist/index.d.ts:353

Solver's reputation score (0-100)

***

### totalVolume

> **totalVolume**: `bigint`

Defined in: packages/types/dist/index.d.ts:355

Total volume processed (in USD equivalent)

***

### successRate

> **successRate**: `number`

Defined in: packages/types/dist/index.d.ts:357

Success rate (0-1)

***

### minOrderSize?

> `optional` **minOrderSize**: `bigint`

Defined in: packages/types/dist/index.d.ts:359

Minimum order size (in USD equivalent)

***

### maxOrderSize?

> `optional` **maxOrderSize**: `bigint`

Defined in: packages/types/dist/index.d.ts:361

Maximum order size (in USD equivalent)

***

### publicKey?

> `optional` **publicKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:363

Solver's public key for encrypted communication
