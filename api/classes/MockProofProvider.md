[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / MockProofProvider

# Class: MockProofProvider

Defined in: [packages/sdk/src/proofs/mock.ts:63](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L63)

Mock Proof Provider for testing

## Example

```typescript
// Only use in tests
const provider = new MockProofProvider()
await provider.initialize()

const result = await provider.generateFundingProof({
  balance: 100n,
  minimumRequired: 50n,
  // ... other params
})
```

## Implements

- [`ProofProvider`](../interfaces/ProofProvider.md)

## Constructors

### Constructor

> **new MockProofProvider**(): `MockProofProvider`

#### Returns

`MockProofProvider`

## Properties

### framework

> `readonly` **framework**: [`ProofFramework`](../type-aliases/ProofFramework.md) = `'mock'`

Defined in: [packages/sdk/src/proofs/mock.ts:64](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L64)

The ZK framework this provider uses

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`framework`](../interfaces/ProofProvider.md#framework)

## Accessors

### isReady

#### Get Signature

> **get** **isReady**(): `boolean`

Defined in: [packages/sdk/src/proofs/mock.ts:68](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L68)

Whether the provider is ready to generate proofs
(e.g., circuits compiled, keys loaded)

##### Returns

`boolean`

Whether the provider is ready to generate proofs
(e.g., circuits compiled, keys loaded)

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`isReady`](../interfaces/ProofProvider.md#isready)

## Methods

### isMockProof()

> `static` **isMockProof**(`proof`): `boolean`

Defined in: [packages/sdk/src/proofs/mock.ts:217](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L217)

Check if a proof is a mock proof

#### Parameters

##### proof

[`ZKProof`](../interfaces/ZKProof.md)

#### Returns

`boolean`

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/proofs/mock.ts:77](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L77)

Initialize the mock provider

Logs a warning to console about mock usage.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`initialize`](../interfaces/ProofProvider.md#initialize)

***

### generateFundingProof()

> **generateFundingProof**(`params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/mock.ts:90](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L90)

Generate a mock funding proof

⚠️ This proof provides NO cryptographic guarantees!

#### Parameters

##### params

[`FundingProofParams`](../interfaces/FundingProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateFundingProof`](../interfaces/ProofProvider.md#generatefundingproof)

***

### generateValidityProof()

> **generateValidityProof**(`params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/mock.ts:125](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L125)

Generate a mock validity proof

⚠️ This proof provides NO cryptographic guarantees!

#### Parameters

##### params

[`ValidityProofParams`](../interfaces/ValidityProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateValidityProof`](../interfaces/ProofProvider.md#generatevalidityproof)

***

### generateFulfillmentProof()

> **generateFulfillmentProof**(`params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/mock.ts:162](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L162)

Generate a mock fulfillment proof

⚠️ This proof provides NO cryptographic guarantees!

#### Parameters

##### params

[`FulfillmentProofParams`](../interfaces/FulfillmentProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateFulfillmentProof`](../interfaces/ProofProvider.md#generatefulfillmentproof)

***

### verifyProof()

> **verifyProof**(`proof`): `Promise`\<`boolean`\>

Defined in: [packages/sdk/src/proofs/mock.ts:207](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/mock.ts#L207)

Verify a mock proof

Only verifies that the proof has the mock prefix.
⚠️ This provides NO cryptographic verification!

#### Parameters

##### proof

[`ZKProof`](../interfaces/ZKProof.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`verifyProof`](../interfaces/ProofProvider.md#verifyproof)
