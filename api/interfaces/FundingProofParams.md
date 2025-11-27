[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / FundingProofParams

# Interface: FundingProofParams

Defined in: [packages/sdk/src/proofs/interface.ts:24](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L24)

Parameters for generating a Funding Proof

Proves: balance >= minimumRequired without revealing balance

## See

docs/specs/FUNDING-PROOF.md

## Properties

### balance

> **balance**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:26](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L26)

User's actual balance (private)

***

### minimumRequired

> **minimumRequired**: `bigint`

Defined in: [packages/sdk/src/proofs/interface.ts:28](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L28)

Minimum amount required for the intent (public)

***

### blindingFactor

> **blindingFactor**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:30](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L30)

Blinding factor for the commitment (private)

***

### assetId

> **assetId**: `string`

Defined in: [packages/sdk/src/proofs/interface.ts:32](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L32)

Asset identifier (public)

***

### userAddress

> **userAddress**: `string`

Defined in: [packages/sdk/src/proofs/interface.ts:34](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L34)

User's address for ownership proof (private)

***

### ownershipSignature

> **ownershipSignature**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:36](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L36)

Signature proving ownership of the address (private)
