[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SignedTransaction

# Interface: SignedTransaction

Defined in: packages/types/dist/index.d.ts:2227

Signed transaction ready for broadcast

## Properties

### unsigned

> **unsigned**: [`UnsignedTransaction`](UnsignedTransaction.md)

Defined in: packages/types/dist/index.d.ts:2229

Original unsigned transaction

***

### signatures

> **signatures**: [`Signature`](Signature.md)[]

Defined in: packages/types/dist/index.d.ts:2231

The signature(s)

***

### serialized

> **serialized**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2233

Serialized transaction ready for broadcast (hex encoded)
