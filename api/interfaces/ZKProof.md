[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ZKProof

# Interface: ZKProof

Defined in: packages/types/dist/index.d.ts:45

Zero-knowledge proof

## Properties

### type

> **type**: `"funding"` \| `"validity"` \| `"fulfillment"`

Defined in: packages/types/dist/index.d.ts:47

Proof type identifier

***

### proof

> **proof**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:49

The proof data (hex encoded)

***

### publicInputs

> **publicInputs**: `` `0x${string}` ``[]

Defined in: packages/types/dist/index.d.ts:51

Public inputs to the proof
