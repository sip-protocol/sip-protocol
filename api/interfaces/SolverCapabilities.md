[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SolverCapabilities

# Interface: SolverCapabilities

Defined in: packages/types/dist/index.d.ts:368

Solver capabilities

## Properties

### inputChains

> **inputChains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:370

Supported input chains

***

### outputChains

> **outputChains**: [`ChainId`](../type-aliases/ChainId.md)[]

Defined in: packages/types/dist/index.d.ts:372

Supported output chains

***

### supportedPairs

> **supportedPairs**: `Map`\<`string`, `string`[]\>

Defined in: packages/types/dist/index.d.ts:374

Supported asset pairs (input -> output[])

***

### supportsShielded

> **supportsShielded**: `boolean`

Defined in: packages/types/dist/index.d.ts:376

Supports shielded mode

***

### supportsCompliant

> **supportsCompliant**: `boolean`

Defined in: packages/types/dist/index.d.ts:378

Supports compliant mode (viewing keys)

***

### supportsPartialFill

> **supportsPartialFill**: `boolean`

Defined in: packages/types/dist/index.d.ts:380

Supports streaming/partial fills

***

### avgFulfillmentTime

> **avgFulfillmentTime**: `number`

Defined in: packages/types/dist/index.d.ts:382

Average fulfillment time in seconds
