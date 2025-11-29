[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ProofResult

# Interface: ProofResult

Defined in: [packages/sdk/src/proofs/interface.ts:126](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L126)

Result of proof generation

## Properties

### proof

> **proof**: [`ZKProof`](ZKProof.md)

Defined in: [packages/sdk/src/proofs/interface.ts:128](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L128)

The generated proof

***

### publicInputs

> **publicInputs**: `` `0x${string}` ``[]

Defined in: [packages/sdk/src/proofs/interface.ts:130](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L130)

Public inputs used in the proof

***

### commitment?

> `optional` **commitment**: [`Commitment`](Commitment.md)

Defined in: [packages/sdk/src/proofs/interface.ts:132](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L132)

Commitment (if generated as part of proof)
