[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SwapRouteStep

# Interface: SwapRouteStep

Defined in: packages/types/dist/index.d.ts:453

Single step in a swap route

## Properties

### protocol

> **protocol**: `string`

Defined in: packages/types/dist/index.d.ts:455

Protocol/DEX name

***

### inputAsset

> **inputAsset**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:457

Input asset for this step

***

### outputAsset

> **outputAsset**: [`Asset`](Asset.md)

Defined in: packages/types/dist/index.d.ts:459

Output asset for this step

***

### poolAddress?

> `optional` **poolAddress**: `string`

Defined in: packages/types/dist/index.d.ts:461

Pool/pair address

***

### estimatedOutput

> **estimatedOutput**: `bigint`

Defined in: packages/types/dist/index.d.ts:463

Estimated output for this step
