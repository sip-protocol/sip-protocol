[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SIPSolver

# Interface: SIPSolver

Defined in: packages/types/dist/index.d.ts:471

SIP Solver interface - what solvers must implement

Solvers receive intents with hidden sender/amount information
and must fulfill output requirements based only on public data.

## Properties

### info

> `readonly` **info**: [`Solver`](Solver.md)

Defined in: packages/types/dist/index.d.ts:473

Solver information

***

### capabilities

> `readonly` **capabilities**: [`SolverCapabilities`](SolverCapabilities.md)

Defined in: packages/types/dist/index.d.ts:475

Solver capabilities

## Methods

### canHandle()

> **canHandle**(`intent`): `Promise`\<`boolean`\>

Defined in: packages/types/dist/index.d.ts:482

Evaluate if solver can fulfill an intent

#### Parameters

##### intent

[`SolverVisibleIntent`](SolverVisibleIntent.md)

Visible portion of the shielded intent

#### Returns

`Promise`\<`boolean`\>

true if solver can potentially fulfill, false otherwise

***

### generateQuote()

> **generateQuote**(`intent`): `Promise`\<[`SolverQuote`](SolverQuote.md) \| `null`\>

Defined in: packages/types/dist/index.d.ts:494

Generate a quote for fulfilling an intent

Solvers only see public fields - they cannot determine:
- Who is sending
- Exact input amount
- Recipient's real identity

#### Parameters

##### intent

[`SolverVisibleIntent`](SolverVisibleIntent.md)

Visible portion of the shielded intent

#### Returns

`Promise`\<[`SolverQuote`](SolverQuote.md) \| `null`\>

Quote if solver can fulfill, null otherwise

***

### fulfill()

> **fulfill**(`intent`, `quote`): `Promise`\<[`FulfillmentResult`](FulfillmentResult.md)\>

Defined in: packages/types/dist/index.d.ts:502

Fulfill an intent after user accepts quote

#### Parameters

##### intent

[`ShieldedIntent`](ShieldedIntent.md)

Full shielded intent (still privacy-preserving)

##### quote

[`SolverQuote`](SolverQuote.md)

The accepted quote

#### Returns

`Promise`\<[`FulfillmentResult`](FulfillmentResult.md)\>

Fulfillment result with proof

***

### cancel()?

> `optional` **cancel**(`intentId`): `Promise`\<`boolean`\>

Defined in: packages/types/dist/index.d.ts:509

Cancel a pending fulfillment

#### Parameters

##### intentId

`string`

Intent to cancel

#### Returns

`Promise`\<`boolean`\>

true if cancelled, false if already fulfilled

***

### getStatus()?

> `optional` **getStatus**(`intentId`): `Promise`\<[`FulfillmentStatus`](FulfillmentStatus.md) \| `null`\>

Defined in: packages/types/dist/index.d.ts:516

Get status of a fulfillment

#### Parameters

##### intentId

`string`

Intent to check

#### Returns

`Promise`\<[`FulfillmentStatus`](FulfillmentStatus.md) \| `null`\>

Current status or null if not found
