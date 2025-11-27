[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / Commitment

# Interface: Commitment

Defined in: packages/types/dist/index.d.ts:36

Pedersen commitment: value * G + blinding * H
Hides the actual value while allowing proofs

## Properties

### value

> **value**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:38

The commitment value (hex encoded)

***

### blindingFactor?

> `optional` **blindingFactor**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:40

Optional blinding factor for opening the commitment
