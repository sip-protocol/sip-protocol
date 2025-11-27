[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / deriveViewingKey

# Function: deriveViewingKey()

> **deriveViewingKey**(`masterKey`, `childPath`): [`ViewingKey`](../interfaces/ViewingKey.md)

Defined in: [packages/sdk/src/privacy.ts:124](https://github.com/sip-protocol/sip-protocol/blob/25dc84cb065f1312864981e7c4ad22352fff4815/packages/sdk/src/privacy.ts#L124)

Derive a child viewing key using BIP32-style hierarchical derivation

Uses HMAC-SHA512 for proper key derivation:
- childKey = HMAC-SHA512(masterKey, childPath)
- Takes first 32 bytes as the derived key

This provides:
- Cryptographic standard compliance (similar to BIP32)
- One-way derivation (cannot derive parent from child)
- Non-correlatable keys (different paths produce unrelated keys)

## Parameters

### masterKey

[`ViewingKey`](../interfaces/ViewingKey.md)

### childPath

`string`

## Returns

[`ViewingKey`](../interfaces/ViewingKey.md)
