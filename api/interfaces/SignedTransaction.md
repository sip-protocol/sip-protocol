[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / SignedTransaction

# Interface: SignedTransaction

Defined in: packages/types/dist/index.d.ts:1398

Signed transaction ready for broadcast

## Properties

### unsigned

> **unsigned**: [`UnsignedTransaction`](UnsignedTransaction.md)

Defined in: packages/types/dist/index.d.ts:1400

Original unsigned transaction

***

### signatures

> **signatures**: [`Signature`](Signature.md)[]

Defined in: packages/types/dist/index.d.ts:1402

The signature(s)

***

### serialized

> **serialized**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1404

Serialized transaction ready for broadcast (hex encoded)
