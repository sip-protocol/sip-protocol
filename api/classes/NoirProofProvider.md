[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / NoirProofProvider

# Class: NoirProofProvider

Defined in: [packages/sdk/src/proofs/noir.ts:79](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L79)

Noir Proof Provider

Production ZK proof provider using Noir circuits.

## Example

```typescript
const provider = new NoirProofProvider({
  artifactsPath: './circuits/target',
})

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

> **new NoirProofProvider**(`config`): `NoirProofProvider`

Defined in: [packages/sdk/src/proofs/noir.ts:85](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L85)

#### Parameters

##### config

[`NoirProviderConfig`](../interfaces/NoirProviderConfig.md) = `{}`

#### Returns

`NoirProofProvider`

## Properties

### framework

> `readonly` **framework**: [`ProofFramework`](../type-aliases/ProofFramework.md) = `'noir'`

Defined in: [packages/sdk/src/proofs/noir.ts:80](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L80)

The ZK framework this provider uses

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`framework`](../interfaces/ProofProvider.md#framework)

## Accessors

### isReady

#### Get Signature

> **get** **isReady**(): `boolean`

Defined in: [packages/sdk/src/proofs/noir.ts:93](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L93)

Whether the provider is ready to generate proofs
(e.g., circuits compiled, keys loaded)

##### Returns

`boolean`

Whether the provider is ready to generate proofs
(e.g., circuits compiled, keys loaded)

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`isReady`](../interfaces/ProofProvider.md#isready)

## Methods

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/proofs/noir.ts:104](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L104)

Initialize the Noir provider

Loads circuit artifacts and initializes the proving backend.

#### Returns

`Promise`\<`void`\>

#### Throws

Error if circuits are not yet implemented

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`initialize`](../interfaces/ProofProvider.md#initialize)

***

### generateFundingProof()

> **generateFundingProof**(`_params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/noir.ts:139](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L139)

Generate a Funding Proof using Noir circuits

#### Parameters

##### \_params

[`FundingProofParams`](../interfaces/FundingProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### See

docs/specs/FUNDING-PROOF.md

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateFundingProof`](../interfaces/ProofProvider.md#generatefundingproof)

***

### generateValidityProof()

> **generateValidityProof**(`_params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/noir.ts:173](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L173)

Generate a Validity Proof using Noir circuits

#### Parameters

##### \_params

[`ValidityProofParams`](../interfaces/ValidityProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### See

docs/specs/VALIDITY-PROOF.md

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateValidityProof`](../interfaces/ProofProvider.md#generatevalidityproof)

***

### generateFulfillmentProof()

> **generateFulfillmentProof**(`_params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/noir.ts:188](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L188)

Generate a Fulfillment Proof using Noir circuits

#### Parameters

##### \_params

[`FulfillmentProofParams`](../interfaces/FulfillmentProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### See

docs/specs/FULFILLMENT-PROOF.md

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateFulfillmentProof`](../interfaces/ProofProvider.md#generatefulfillmentproof)

***

### verifyProof()

> **verifyProof**(`_proof`): `Promise`\<`boolean`\>

Defined in: [packages/sdk/src/proofs/noir.ts:201](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/noir.ts#L201)

Verify a Noir proof

#### Parameters

##### \_proof

[`ZKProof`](../interfaces/ZKProof.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`verifyProof`](../interfaces/ProofProvider.md#verifyproof)
