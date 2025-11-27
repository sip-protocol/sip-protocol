[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ValidityProofParams

# Interface: ValidityProofParams

Defined in: [packages/sdk/src/proofs/interface.ts:46](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L46)

Parameters for generating a Validity Proof

Proves: intent is authorized by sender without revealing sender

## See

docs/specs/VALIDITY-PROOF.md

## Properties

### intentHash

> **intentHash**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:48](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L48)

Hash of the intent (public)

***

### senderAddress

> **senderAddress**: `string`

Defined in: [packages/sdk/src/proofs/interface.ts:50](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L50)

Sender's address (private)

***

### senderBlinding

> **senderBlinding**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:52](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L52)

Blinding factor for sender commitment (private)

***

### senderSecret

> **senderSecret**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:54](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L54)

Sender's secret key (private)

***

### authorizationSignature

> **authorizationSignature**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:56](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L56)

Signature authorizing the intent (private)

***

### nonce

> **nonce**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:58](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L58)

Nonce for nullifier generation (private)

***

### timestamp

> **timestamp**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:60](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L60)

Intent timestamp (public)

***

### expiry

> **expiry**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:62](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/proofs/interface.ts#L62)

Intent expiry (public)
