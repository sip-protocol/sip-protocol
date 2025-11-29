[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ProofProvider

# Interface: ProofProvider

Defined in: [packages/sdk/src/proofs/interface.ts:156](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L156)

Proof Provider Interface

Implementations of this interface provide ZK proof generation and verification.
The SDK uses this interface to remain agnostic to the underlying ZK framework.

## Example

```typescript
// Use mock provider for testing
const mockProvider = new MockProofProvider()

// Use Noir provider for production
const noirProvider = new NoirProofProvider()

// Configure SIP client with provider
const sip = new SIP({
  network: 'testnet',
  proofProvider: noirProvider,
})
```

## Properties

### framework

> `readonly` **framework**: [`ProofFramework`](../type-aliases/ProofFramework.md)

Defined in: [packages/sdk/src/proofs/interface.ts:160](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L160)

The ZK framework this provider uses

***

### isReady

> `readonly` **isReady**: `boolean`

Defined in: [packages/sdk/src/proofs/interface.ts:166](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L166)

Whether the provider is ready to generate proofs
(e.g., circuits compiled, keys loaded)

## Methods

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/sdk/src/proofs/interface.ts:173](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L173)

Initialize the provider (compile circuits, load keys, etc.)

#### Returns

`Promise`\<`void`\>

#### Throws

Error if initialization fails

***

### generateFundingProof()

> **generateFundingProof**(`params`): `Promise`\<[`ProofResult`](ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/interface.ts:186](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L186)

Generate a Funding Proof

Proves that the user has sufficient balance without revealing the exact amount.

#### Parameters

##### params

[`FundingProofParams`](FundingProofParams.md)

Funding proof parameters

#### Returns

`Promise`\<[`ProofResult`](ProofResult.md)\>

The generated proof with public inputs

#### Throws

ProofGenerationError if proof generation fails

#### See

docs/specs/FUNDING-PROOF.md (~22,000 constraints)

***

### generateValidityProof()

> **generateValidityProof**(`params`): `Promise`\<[`ProofResult`](ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/interface.ts:199](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L199)

Generate a Validity Proof

Proves that the intent is authorized without revealing the sender.

#### Parameters

##### params

[`ValidityProofParams`](ValidityProofParams.md)

Validity proof parameters

#### Returns

`Promise`\<[`ProofResult`](ProofResult.md)\>

The generated proof with public inputs

#### Throws

ProofGenerationError if proof generation fails

#### See

docs/specs/VALIDITY-PROOF.md (~72,000 constraints)

***

### generateFulfillmentProof()

> **generateFulfillmentProof**(`params`): `Promise`\<[`ProofResult`](ProofResult.md)\>

Defined in: [packages/sdk/src/proofs/interface.ts:212](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L212)

Generate a Fulfillment Proof

Proves that the solver correctly delivered the output.

#### Parameters

##### params

[`FulfillmentProofParams`](FulfillmentProofParams.md)

Fulfillment proof parameters

#### Returns

`Promise`\<[`ProofResult`](ProofResult.md)\>

The generated proof with public inputs

#### Throws

ProofGenerationError if proof generation fails

#### See

docs/specs/FULFILLMENT-PROOF.md (~22,000 constraints)

***

### verifyProof()

> **verifyProof**(`proof`): `Promise`\<`boolean`\>

Defined in: [packages/sdk/src/proofs/interface.ts:220](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L220)

Verify a proof

#### Parameters

##### proof

[`ZKProof`](ZKProof.md)

The proof to verify

#### Returns

`Promise`\<`boolean`\>

true if the proof is valid, false otherwise
