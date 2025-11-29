[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / NoirProofProvider

# Class: NoirProofProvider

Defined in: [packages/sdk/src/proofs/noir.ts:100](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L100)

Noir Proof Provider

Production ZK proof provider using Noir circuits.

## Example

```typescript
const provider = new NoirProofProvider()

await provider.initialize()

const result = await provider.generateFundingProof({
  balance: 100n,
  minimumRequired: 50n,
  blindingFactor: new Uint8Array(32),
  assetId: '0xABCD',
  userAddress: '0x1234...',
  ownershipSignature: new Uint8Array(64),
})
```

## Implements

- [`ProofProvider`](../interfaces/ProofProvider.md)

## Constructors

### Constructor

> **new NoirProofProvider**(`config`): `NoirProofProvider`

Defined in: [packages/sdk/src/proofs/noir.ts:113](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L113)

#### Parameters

##### config

[`NoirProviderConfig`](../interfaces/NoirProviderConfig.md) = `{}`

#### Returns

`NoirProofProvider`

## Properties

### framework

> `readonly` **framework**: [`ProofFramework`](../type-aliases/ProofFramework.md) = `'noir'`

Defined in: [packages/sdk/src/proofs/noir.ts:101](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L101)

The ZK framework this provider uses

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`framework`](../interfaces/ProofProvider.md#framework)

## Accessors

### isReady

#### Get Signature

> **get** **isReady**(): `boolean`

Defined in: [packages/sdk/src/proofs/noir.ts:121](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L121)

Whether the provider is ready to generate proofs
(e.g., circuits compiled, keys loaded)

##### Returns

`boolean`

Whether the provider is ready to generate proofs
(e.g., circuits compiled, keys loaded)

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`isReady`](../interfaces/ProofProvider.md#isready)

## Methods

### derivePublicKey()

> `static` **derivePublicKey**(`privateKey`): `PublicKeyCoordinates`

Defined in: [packages/sdk/src/proofs/noir.ts:154](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L154)

Derive secp256k1 public key coordinates from a private key

Utility method that can be used to generate public key coordinates
for use in ValidityProofParams.senderPublicKey or NoirProviderConfig.oraclePublicKey

#### Parameters

##### privateKey

`Uint8Array`

32-byte private key

#### Returns

`PublicKeyCoordinates`

X and Y coordinates as 32-byte arrays

#### Example

```typescript
const privateKey = new Uint8Array(32).fill(1) // Your secret key
const publicKey = NoirProofProvider.derivePublicKey(privateKey)

// Use for oracle configuration
const provider = new NoirProofProvider({
  oraclePublicKey: publicKey
})

// Or use for validity proof params
const validityParams = {
  // ... other params
  senderPublicKey: {
    x: new Uint8Array(publicKey.x),
    y: new Uint8Array(publicKey.y)
  }
}
```

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/proofs/noir.ts:170](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L170)

Initialize the Noir provider

Loads circuit artifacts and initializes the proving backend.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`initialize`](../interfaces/ProofProvider.md#initialize)

***

### generateFundingProof()

> **generateFundingProof**(`params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/noir.ts:244](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L244)

Generate a Funding Proof using Noir circuits

Proves: balance >= minimumRequired without revealing balance

#### Parameters

##### params

[`FundingProofParams`](../interfaces/FundingProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### See

docs/specs/FUNDING-PROOF.md

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateFundingProof`](../interfaces/ProofProvider.md#generatefundingproof)

***

### generateValidityProof()

> **generateValidityProof**(`params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/noir.ts:355](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L355)

Generate a Validity Proof using Noir circuits

Proves: Intent is authorized by sender without revealing identity

#### Parameters

##### params

[`ValidityProofParams`](../interfaces/ValidityProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### See

docs/specs/VALIDITY-PROOF.md

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateValidityProof`](../interfaces/ProofProvider.md#generatevalidityproof)

***

### generateFulfillmentProof()

> **generateFulfillmentProof**(`params`): `Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/noir.ts:541](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L541)

Generate a Fulfillment Proof using Noir circuits

Proves: Solver correctly executed the intent and delivered the required
output to the recipient, without revealing execution path or liquidity sources.

#### Parameters

##### params

[`FulfillmentProofParams`](../interfaces/FulfillmentProofParams.md)

#### Returns

`Promise`\<[`ProofResult`](../interfaces/ProofResult.md)\>

#### See

docs/specs/FULFILLMENT-PROOF.md

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`generateFulfillmentProof`](../interfaces/ProofProvider.md#generatefulfillmentproof)

***

### verifyProof()

> **verifyProof**(`proof`): `Promise`\<`boolean`\>

Defined in: [packages/sdk/src/proofs/noir.ts:737](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L737)

Verify a Noir proof

#### Parameters

##### proof

[`ZKProof`](../interfaces/ZKProof.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`ProofProvider`](../interfaces/ProofProvider.md).[`verifyProof`](../interfaces/ProofProvider.md#verifyproof)

***

### destroy()

> **destroy**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/proofs/noir.ts:792](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/noir.ts#L792)

Destroy the provider and free resources

#### Returns

`Promise`\<`void`\>
