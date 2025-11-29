[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / withSecureBufferSync

# Function: withSecureBufferSync()

> **withSecureBufferSync**\<`T`\>(`createSecret`, `useSecret`): `T`

Defined in: [packages/sdk/src/secure-memory.ts:122](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/secure-memory.ts#L122)

Synchronous version of withSecureBuffer

## Type Parameters

### T

`T`

## Parameters

### createSecret

() => `Uint8Array`

Function to create the secret buffer

### useSecret

(`secret`) => `T`

Function that uses the secret (sync)

## Returns

`T`

The result of useSecret
