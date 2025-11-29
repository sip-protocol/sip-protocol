[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / Signature

# Interface: Signature

Defined in: packages/types/dist/index.d.ts:2205

Signature data returned from signing operations

## Properties

### signature

> **signature**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2207

The signature bytes (hex encoded)

***

### recoveryId?

> `optional` **recoveryId**: `number`

Defined in: packages/types/dist/index.d.ts:2209

Recovery id for secp256k1 signatures

***

### publicKey

> **publicKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:2211

Public key used for signing (hex encoded)
