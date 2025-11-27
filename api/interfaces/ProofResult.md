[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ProofResult

# Interface: ProofResult

Defined in: [packages/sdk/src/proofs/interface.ts:114](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L114)

Result of proof generation

## Properties

### proof

> **proof**: [`ZKProof`](ZKProof.md)

Defined in: [packages/sdk/src/proofs/interface.ts:116](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L116)

The generated proof

***

### publicInputs

> **publicInputs**: `` `0x${string}` ``[]

Defined in: [packages/sdk/src/proofs/interface.ts:118](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L118)

Public inputs used in the proof

***

### commitment?

> `optional` **commitment**: [`Commitment`](Commitment.md)

Defined in: [packages/sdk/src/proofs/interface.ts:120](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L120)

Commitment (if generated as part of proof)
