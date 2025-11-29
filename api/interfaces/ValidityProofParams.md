[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ValidityProofParams

# Interface: ValidityProofParams

Defined in: [packages/sdk/src/proofs/interface.ts:56](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L56)

Parameters for generating a Validity Proof

Proves: intent is authorized by sender without revealing sender

## See

docs/specs/VALIDITY-PROOF.md

## Properties

### intentHash

> **intentHash**: `` `0x${string}` ``

Defined in: [packages/sdk/src/proofs/interface.ts:58](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L58)

Hash of the intent (public)

***

### senderAddress

> **senderAddress**: `string`

Defined in: [packages/sdk/src/proofs/interface.ts:60](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L60)

Sender's address (private)

***

### senderBlinding

> **senderBlinding**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:62](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L62)

Blinding factor for sender commitment (private)

***

### senderSecret

> **senderSecret**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:64](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L64)

Sender's secret key (private) - used to derive public key if senderPublicKey not provided

***

### authorizationSignature

> **authorizationSignature**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:66](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L66)

Signature authorizing the intent (private)

***

### nonce

> **nonce**: `Uint8Array`

Defined in: [packages/sdk/src/proofs/interface.ts:68](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L68)

Nonce for nullifier generation (private)

***

### timestamp

> **timestamp**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:70](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L70)

Intent timestamp (public)

***

### expiry

> **expiry**: `number`

Defined in: [packages/sdk/src/proofs/interface.ts:72](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L72)

Intent expiry (public)

***

### senderPublicKey?

> `optional` **senderPublicKey**: `PublicKeyXY`

Defined in: [packages/sdk/src/proofs/interface.ts:74](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/proofs/interface.ts#L74)

Optional: Sender's public key. If not provided, derived from senderSecret
