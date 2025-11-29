[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockSolver

# Class: MockSolver

Defined in: [packages/sdk/src/solver/mock-solver.ts:62](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L62)

Mock implementation of SIPSolver for testing

This solver demonstrates the privacy-preserving interaction pattern:
- Only accesses visible fields of intents
- Cannot see sender identity or exact input amounts
- Generates valid quotes based on output requirements

## Example

```typescript
const solver = new MockSolver({ name: 'Test Solver' })

// Check if solver can handle intent
if (await solver.canHandle(visibleIntent)) {
  const quote = await solver.generateQuote(visibleIntent)
  if (quote) {
    const result = await solver.fulfill(intent, quote)
  }
}
```

## Implements

- [`SIPSolver`](../interfaces/SIPSolver.md)

## Constructors

### Constructor

> **new MockSolver**(`config`): `MockSolver`

Defined in: [packages/sdk/src/solver/mock-solver.ts:72](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L72)

#### Parameters

##### config

[`MockSolverConfig`](../interfaces/MockSolverConfig.md) = `{}`

#### Returns

`MockSolver`

## Properties

### info

> `readonly` **info**: [`Solver`](../interfaces/Solver.md)

Defined in: [packages/sdk/src/solver/mock-solver.ts:63](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L63)

Solver information

#### Implementation of

[`SIPSolver`](../interfaces/SIPSolver.md).[`info`](../interfaces/SIPSolver.md#info)

***

### capabilities

> `readonly` **capabilities**: [`SolverCapabilities`](../interfaces/SolverCapabilities.md)

Defined in: [packages/sdk/src/solver/mock-solver.ts:64](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L64)

Solver capabilities

#### Implementation of

[`SIPSolver`](../interfaces/SIPSolver.md).[`capabilities`](../interfaces/SIPSolver.md#capabilities)

## Methods

### canHandle()

> **canHandle**(`intent`): `Promise`\<`boolean`\>

Defined in: [packages/sdk/src/solver/mock-solver.ts:116](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L116)

Check if this solver can handle the given intent

Privacy-preserving: Only accesses visible fields

#### Parameters

##### intent

[`SolverVisibleIntent`](../interfaces/SolverVisibleIntent.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`SIPSolver`](../interfaces/SIPSolver.md).[`canHandle`](../interfaces/SIPSolver.md#canhandle)

***

### generateQuote()

> **generateQuote**(`intent`): `Promise`\<[`SolverQuote`](../interfaces/SolverQuote.md) \| `null`\>

Defined in: [packages/sdk/src/solver/mock-solver.ts:144](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L144)

Generate a quote for the intent

Privacy-preserving:
- Does NOT access sender identity (only senderCommitment visible)
- Does NOT know exact input amount (only inputCommitment visible)
- Quotes based solely on output requirements

#### Parameters

##### intent

[`SolverVisibleIntent`](../interfaces/SolverVisibleIntent.md)

#### Returns

`Promise`\<[`SolverQuote`](../interfaces/SolverQuote.md) \| `null`\>

#### Implementation of

[`SIPSolver`](../interfaces/SIPSolver.md).[`generateQuote`](../interfaces/SIPSolver.md#generatequote)

***

### fulfill()

> **fulfill**(`intent`, `quote`): `Promise`\<[`FulfillmentResult`](../interfaces/FulfillmentResult.md)\>

Defined in: [packages/sdk/src/solver/mock-solver.ts:192](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L192)

Fulfill an intent with the given quote

In production, this would:
1. Lock collateral
2. Execute the swap on destination chain
3. Generate fulfillment proof
4. Release collateral after verification

Privacy preserved:
- Funds go to stealth address (unlinkable)
- Solver never learns recipient's real identity

#### Parameters

##### intent

[`ShieldedIntent`](../interfaces/ShieldedIntent.md)

##### quote

[`SolverQuote`](../interfaces/SolverQuote.md)

#### Returns

`Promise`\<[`FulfillmentResult`](../interfaces/FulfillmentResult.md)\>

#### Implementation of

[`SIPSolver`](../interfaces/SIPSolver.md).[`fulfill`](../interfaces/SIPSolver.md#fulfill)

***

### cancel()

> **cancel**(`intentId`): `Promise`\<`boolean`\>

Defined in: [packages/sdk/src/solver/mock-solver.ts:244](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L244)

Cancel a pending fulfillment

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`SIPSolver`](../interfaces/SIPSolver.md).[`cancel`](../interfaces/SIPSolver.md#cancel)

***

### getStatus()

> **getStatus**(`intentId`): `Promise`\<[`FulfillmentStatus`](../interfaces/FulfillmentStatus.md) \| `null`\>

Defined in: [packages/sdk/src/solver/mock-solver.ts:257](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L257)

Get fulfillment status

#### Parameters

##### intentId

`string`

#### Returns

`Promise`\<[`FulfillmentStatus`](../interfaces/FulfillmentStatus.md) \| `null`\>

#### Implementation of

[`SIPSolver`](../interfaces/SIPSolver.md).[`getStatus`](../interfaces/SIPSolver.md#getstatus)

***

### reset()

> **reset**(): `void`

Defined in: [packages/sdk/src/solver/mock-solver.ts:264](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/solver/mock-solver.ts#L264)

Reset solver state (for testing)

#### Returns

`void`
