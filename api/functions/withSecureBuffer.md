[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / withSecureBuffer

# Function: withSecureBuffer()

> **withSecureBuffer**\<`T`\>(`createSecret`, `useSecret`): `Promise`\<`T`\>

Defined in: [packages/sdk/src/secure-memory.ts:103](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/secure-memory.ts#L103)

Execute a function with a secret buffer and ensure cleanup

Provides a safer pattern for using secrets - the buffer is
automatically wiped after the function completes (or throws).

## Type Parameters

### T

`T`

## Parameters

### createSecret

() => `Uint8Array`

Function to create the secret buffer

### useSecret

(`secret`) => `T` \| `Promise`\<`T`\>

Function that uses the secret

## Returns

`Promise`\<`T`\>

The result of useSecret

## Example

```typescript
const signature = await withSecureBuffer(
  () => generatePrivateKey(),
  async (privateKey) => {
    return signMessage(message, privateKey)
  }
)
// privateKey is automatically wiped after signing
```
