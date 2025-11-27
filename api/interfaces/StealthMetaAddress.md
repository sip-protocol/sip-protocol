[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / StealthMetaAddress

# Interface: StealthMetaAddress

Defined in: packages/types/dist/index.d.ts:101

Stealth meta-address published by recipient
Contains two public keys: spending key (P) and viewing key (Q)

## Properties

### spendingKey

> **spendingKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:103

Spending public key (P) - used to derive stealth addresses

***

### viewingKey

> **viewingKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:105

Viewing public key (Q) - used to derive stealth addresses

***

### chain

> **chain**: [`ChainId`](../type-aliases/ChainId.md)

Defined in: packages/types/dist/index.d.ts:107

Chain identifier

***

### label?

> `optional` **label**: `string`

Defined in: packages/types/dist/index.d.ts:109

Human-readable label (optional)
