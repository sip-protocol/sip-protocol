[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / Signature

# Interface: Signature

Defined in: packages/types/dist/index.d.ts:1376

Signature data returned from signing operations

## Properties

### signature

> **signature**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1378

The signature bytes (hex encoded)

***

### recoveryId?

> `optional` **recoveryId**: `number`

Defined in: packages/types/dist/index.d.ts:1380

Recovery id for secp256k1 signatures

***

### publicKey

> **publicKey**: `` `0x${string}` ``

Defined in: packages/types/dist/index.d.ts:1382

Public key used for signing (hex encoded)
